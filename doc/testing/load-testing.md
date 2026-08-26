# แนวทางการยิงทดสอบโหลดและวัดผลการแข่งขัน (Load Testing & Competition Benchmark Specification)

**วันที่อัปเดต:** 26 สิงหาคม 2026  
**สถานะ:** FROZEN TESTING SOURCE OF TRUTH (Phase 7)  
**ขอบเขตโปรเจกต์:** ข้อกำหนดการยิงทดสอบโหลด k6 จากเครื่องภายนอก การเก็บ Metrics และเกณฑ์การประเมินผลการแข่งขัน (ทุกสมาชิกในทีม)

---

## 1. วัตถุประสงค์ (Purpose)

เอกสารฉบับนี้เป็น **ข้อกำหนดการยิงทดสอบโหลดและการแข่งขัน (Load Testing & Competition Specification)** จัดทำขึ้นเพื่อกำหนดสภาพแวดล้อม สถานการณ์การยิง k6 (Test Scenarios), การจำแนกประเภทข้อผิดพลาด (Error Classification), ระเบียบการรันซ้ำเพื่อหาค่ากลาง (Median Policy) และการตรวจสอบความถูกต้องของข้อมูลควบคู่กับการวัดผล Throughput และ Latency

---

## 2. ข้อกำหนดสภาพแวดล้อมเครื่องยิงโหลด (Load Generator Constraints)

> [!CAUTION]
> **External Load Generator Rule**  
> สคริปต์ k6 สำหรับการวัดผลแข่งขัน **ต้องยิงมาจากเครื่องภายนอก VM เท่านั้น** ห้ามรัน k6 ภายใน VM เครื่องเดียวกับระบบ Backend โดยเด็ดขาด เพราะกระบวนการยิงของ k6 จะแย่ง CPU, RAM, Network I/O และ OS Thread Scheduler จากระบบ Backend ทำให้ผลการวัดประสิทธิภาพผิดเพี้ยน

- **Target System:** VM เครื่องแข่งขัน (4 vCPU, RAM 6 GB, Disk 50 GB) รันบริการผ่าน Docker Compose
- **Target Endpoint:** Public IP ของ VM บน Port 80 (ผ่าน Nginx Reverse Proxy)
- **Load Generator Tool:** Grafana k6 (ยิงจากเครื่องภายนอกผ่านเครือข่ายเดียวกับที่ใช้แข่ง)

---

## 3. ขั้นตอนการรีเซ็ตระบบก่อนยิงทดสอบ (Reset Procedure & Pre-conditions)

ก่อนเริ่มยิง Write Benchmark ทุกรอบ ต้องรันสคริปต์ `scripts/reset-db.sh` เพื่อเตรียมสภาพแวดล้อมระบบ:
1. ล้างตารางคำสั่งซื้อ `TRUNCATE TABLE orders;`
2. คืนค่าสต็อกสินค้า `p-1001` ให้เท่ากับ 50 ชิ้น (`UPDATE products SET remaining_stock = 50 WHERE product_id = 'p-1001';`)
3. ลบ Redis Atomic Claim Keys (`DEL fs:claim:order:*`) และล้าง Queue Job ตกค้างใน BullMQ
4. ลบแคชสินค้า `DEL fs:cache:products:*`

---

## 4. สถานการณ์การทดสอบโหลดหลัก (Load Test Scenarios & Profiles)

### Profile A — Authentication Preparation (500 Unique Users)
- **วัตถุประสงค์:** ออก JWT Access Token สำหรับผู้ใช้ 500 คนผ่าน `POST /api/v1/auth/token`
- **การนำไปใช้:** จัดเก็บ Token เพื่อนำไปใส่ใน Header `Authorization: Bearer <token>` สำหรับ Profile C & D

### Profile B — Read-Heavy Scenario (1,000 Concurrent Users)
- **วัตถุประสงค์:** จำลองผู้ใช้ 1,000 คนยิงอ่านรายการสินค้า `GET /api/v1/products?page=1&limit=10` พร้อมกัน
- **การแยกสภาวะ:**
  - **Cold Cache:** ล้างแคชก่อนยิง เพื่อวัดผล Cache Miss และการ Fallback ไปอ่าน DB
  - **Warm Cache (Steady State):** อุ่นแคชก่อน 1 รอบ และยิงวัดผล Throughput (RPS) และ p95 Latency

### Profile C — Write-Heavy Competition Scenario (500 Concurrent Orders on p-1001)
- **วัตถุประสงค์:** ผู้ใช้ 500 คน (JWT ไม่ซ้ำกัน) ยิงสั่งซื้อสินค้า `p-1001` (สต็อกเริ่มต้น 50) พร้อมกัน
- **คำขอ:** `POST /api/v1/orders` Body: `{"productId": "p-1001"}`
- **การวัดผล:** วัดทั้ง API Admission RPS (การตอบ `202 Accepted`) และ Queue Drain Time จนกระทั่ง Worker ประมวลผลเสร็จครบทุก Job

### Profile D — Duplicate Burst Scenario
- **วัตถุประสงค์:** จำลองผู้ใช้บางคนยิงคำขอสั่งซื้อสินค้าเดียวกันซ้ำ 2–3 ครั้งพร้อมกัน
- **การวัดผล:** ตรวจสอบว่า Atomic Claim Guard ใน Redis และ DB Constraint สามารถปฏิเสธคำขอซ้ำได้อย่างรวดเร็ว

---

## 5. การจำแนกประเภทข้อผิดพลาด (Error Classification Rules)

ในการรายงานผล Load Test ต้องแยกประเภท Error ออกจากกันอย่างชัดเจน:

1. **Infrastructure Error (ความล้มเหลวของระบบ):**
   - HTTP Status `500 Internal Server Error`, `502 Bad Gateway`, `503 Service Unavailable`
   - Connection Refused, Connection Timeout, Socket Hang Up
   - *หมายเหตุ: ต้องถูกนำมาคำนวณเป็น HTTP Error Rate %*
2. **Business Rejection (การปฏิเสธตามเงื่อนไขธุรกิจ):**
   - คำสั่งซื้อที่ได้รับผลเป็น `SOLD_OUT` (สินค้าหมด) หรือ `DUPLICATE` (ผู้ใช้ซื้อซ้ำแล้ว)
   - *หมายเหตุ: การปฏิเสธตามเงื่อนไขธุรกิจถือเป็นพฤติกรรมที่ถูกต้องของระบบ **ห้ามจัดเป็น Infrastructure Error***

---

## 6. กฎการสิ้นสุดกระบวนการคิวแบบไม่พร้อมกัน (Async Queue Completion Rules)

การทดสอบใน Profile C (Write Heavy) ไม่ถือว่าสิ้นสุดเพียงแค่ k6 ส่งคำขอ HTTP ครบ 500 รายการ ต้องรอจนกระทั่งระบบเข้าสู่สถานะ **Queue Drain Complete**:

```text
Conditions for Queue Completion:
1. BullMQ Queue 'orders' Status: waiting_jobs == 0 AND active_jobs == 0
2. Database Outcome Status: สรุปผล Order สำเร็จเรียบร้อยแล้ว
3. Timeout Limit: ภายในเวลาไม่เกิน 30 วินาทีหลังจบ HTTP Burst
```

---

## 7. เกณฑ์การยกเลิกผลการทดสอบ (Invalid Run Criteria)

ผลการยิง k6 Benchmark ในรอบนั้นๆ จะถือว่าเป็น **`INVALID RUN` (ใช้ไม่ได้) และห้ามนำไปอ้างอิง** หากเกิดกรณีใดกรณีหนึ่งดังนี้:

1. **Integrity Gate Failed:** เกิดสต็อกติดลบ (`remainingStock < 0`), Order สำเร็จเกิน 50 รายการ หรือมี Order ซ้ำ
2. **Load Generator Saturated:** CPU ของเครื่องยิง k6 ขึ้นสูงถึง 100% (ทำให้ k6 กลายเป็นจุดคอขวดเสียเอง)
3. **Queue Not Drained:** มี Job ค้างอยู่ในคิว BullMQ เกิน 30 วินาทีหลังจบการยิง
4. **Environment Mismatch:** มีการรัน k6 ภายใน VM เครื่องเดียวกับระบบ หรือมีการเปลี่ยนสคริปต์ระหว่างการเปรียบเทียบ

---

## 8. กฎการรันซ้ำเพื่อหาค่ากลาง (Repetition & Median Policy)

- **Number of Runs:** ทุกการตั้งค่าที่นำมาเปรียบเทียบต้องยิงทดสอบอย่างน้อย **3 รอบ** (Run 1, Run 2, Run 3)
- **Aggregation Metric:** ใช้ **ค่ากลาง (Median)** ของ RPS และ p95 Latency เป็นตัวแทนในการตัดสินใจ
- **No Cherry-Picking:** ห้ามเลือกเฉพาะรอบที่ได้ตัวเลขสูงที่สุดเพียงรอบเดียวมาอ้างอิง

---

## 9. ตารางสรุป Metrics สำคัญที่ต้องจัดเก็บ (Load Test Metrics Table)

| Metric Group | Specific Metric | Unit | Collection Source | Target Threshold / Goal |
| --- | --- | --- | --- | --- |
| **HTTP Read** | GET Throughput (RPS) | `req/s` | k6 Summary JSON | Maximize for Competition |
| **HTTP Read** | GET Latency (p95) | `ms` | k6 Summary JSON | Minimize (< 100ms Target) |
| **HTTP Read** | Cache Hit Ratio | `%` | API / Prometheus | > 90% (Warm Cache) |
| **HTTP Write**| POST Admission RPS | `req/s` | k6 Summary JSON | Maximize |
| **HTTP Write**| Admission Latency (p95)| `ms` | k6 Summary JSON | Minimize (< 50ms Target) |
| **Async Queue**| Queue Drain Time | `s` | Bull Board / Worker Log | Minimize (< 5s Target) |
| **Data Integrity**| Successful Orders Count | `count` | PostgreSQL Query | Exactly `50` (p-1001) |
| **Data Integrity**| Remaining Stock Count | `count` | PostgreSQL Query | Exactly `0` (p-1001) |
| **Data Integrity**| Duplicate Success Count| `count` | PostgreSQL Query | Exactly `0` |
| **Resource** | VM CPU Utilization Peak | `%` | Docker Stats / Host | High Utilization (< 95%) |
| **Resource** | VM RAM Utilization Peak | `MB` | Docker Stats / Host | Headroom < 5.5 GB (Limit 6GB) |
