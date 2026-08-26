# เอกสารการวัดค่าประสิทธิภาพเริ่มต้น (Baseline Performance Benchmark)

**วันที่อัปเดต:** 26 สิงหาคม 2026  
**สถานะ:** PENDING BENCHMARK (Phase 4 Framework)  
**ขอบเขตโปรเจกต์:** มาตรฐานการวัดผล ประสิทธิภาพเริ่มต้นและเกณฑ์การทดสอบระบบก่อนทำการ Tuning (ทุกสมาชิกในทีม)

---

## 1. วัตถุประสงค์ (Purpose)

เอกสารฉบับนี้จัดทำขึ้นเพื่อกำหนด **มาตรฐานการวัดผลและเกณฑ์การทดสอบประสิทธิภาพเริ่มต้น (Baseline Performance Benchmark Framework)** ของระบบ Flash Sale ก่อนเริ่มกระบวนการปรับแต่งประสิทธิภาพ (Performance Tuning) ใน Phase 5 เพื่อให้ทีมมีค่าเปรียบเทียบเชิงประจักษ์ (Empirical Evidence) ว่าการปรับแต่งแต่ละจุดส่งผลดีหรือแย่ลงอย่างไรภายใต้สภาวะแวดล้อมเดียวกัน

---

## 2. สถานะการวัดผลปัจจุบัน (Benchmark Status)

```text
Status: PENDING BENCHMARK / PENDING IMPLEMENTATION
Reason: ระบบอยู่ในระหว่างการเตรียมแอปพลิเคชันและสคริปต์ k6 Load Test (ยังไม่มีผลการรันจริง)
```

> [!IMPORTANT]
> **No Fake Metrics Rule**  
> ตามกฎของโปรเจกต์ ตารางผลการทดสอบทั้งหมดจะใช้สถานะ `PENDING BENCHMARK` จนกว่าจะได้รับการรัน k6 Load Test จริงจากเครื่องภายนอก ห้ามแต่งตัวเลขหรือใส่ค่าสมมติโดยเด็ดขาด

---

## 3. สภาพแวดล้อมสำหรับการทดสอบ (Benchmark Environment)

### 3.1 VM Target Host Specification (เครื่องระบบที่ถูกทดสอบ)
- **CPU Allocation:** 4 vCPU
- **RAM Allocation:** 6 GB
- **Disk Allocation:** 50 GB
- **Operating System:** Linux (VM 1 เครื่องต่อทีม มี Public IP แยก)
- **Container Runtime:** Docker & Docker Compose
- **Commit SHA:** `PENDING` (จะถูกบันทึกเมื่อเริ่มรัน Benchmark)

### 3.2 External Load Generator (เครื่องยิงโหลด k6)
- **Execution Location:** **เครื่องภายนอก VM** (เพื่อไม่ให้ k6 แย่ง CPU/RAM จากระบบที่ถูกทดสอบ)
- **Tool:** Grafana k6 (Latest Docker image หรือ CLI)
- **Network Context:** ยิงผ่าน Public IP เข้า Nginx Proxy บน Port 80

---

## 4. โครงสร้างสถาปัตยกรรมและค่าคอนฟิกเริ่มต้น (Baseline Configuration)

### 4.1 Baseline Architecture Overview
`Client (k6) → Nginx Reverse Proxy (Port 80) → NestJS API (3 Instances) → Redis (Cache & Queue) → BullMQ Worker → PostgreSQL 16`

### 4.2 ตารางค่าคอนฟิกเริ่มต้น (Baseline Parameters Table):

| Component / Layer | Parameter | Baseline Value | Source Origin |
| --- | --- | --- | --- |
| **Edge / LB** | Nginx Proxy Strategy | `least_conn` หรือ `round_robin` | `infra/nginx/nginx.conf` |
| **API Layer** | API Instance Count | `3 Containers` | `compose.yaml` |
| **API Layer** | Node Runtime Heap | Default (`PENDING`) | Runtime Environment |
| **Queue / Cache** | Redis Instances | Single Shared Instance (Port 6379/6380) | `compose.yaml` |
| **Queue / Cache** | BullMQ Worker Concurrency | `10` (`PENDING`) | `apps/worker/src/config` |
| **Cache Layer** | Product Cache TTL | `60s` (Jitter ±5s) | `packages/cache` |
| **Database** | PostgreSQL Max Connections | `30` (`PENDING`) | `database/ormconfig` |

---

## 5. ชุดข้อมูลสำหรับทดสอบ (Test Dataset)

- **Total Products:** 20 รายการ
- **Hot Product Target (`p-1001`):**
  - `productId`: `p-1001`
  - `name`: `Limited Edition Sneaker`
  - `availableStock`: `50` (สต็อกตั้งต้น)
  - `remainingStock`: `50` (สต็อกคงเหลือเริ่มต้น)
  - `isFlashSaleActive`: `true`

---

## 6. นโยบายการอุ่นแคช (Warm-up Policy)

การทดสอบต้องแยกรายงานระหว่าง 2 สภาวะอย่างชัดเจน:

1. **Cold Cache Scenario (แคชเย็น):**
   - ดำเนินการล้างแคชใน Redis (`DEL fs:cache:products:*`) ก่อนรันคำสั่ง
   - วัดผลการเกิด Cache Miss ในครั้งแรก และการ Fallback ไปอ่าน PostgreSQL เพื่อสร้างแคชใหม่
2. **Warm Cache Scenario (แคชอุ่น / Steady State):**
   - ทำการยิงคำขอ `GET /products` ก่อน 1 รอบเพื่อเติมแคช
   - วัดผลประสิทธิภาพการอ่านแบบ Steady State (Cache Hit Ratio สูงสุด)

---

## 7. ขั้นตอนการรีเซ็ตระบบก่อนการทดสอบ (Reset Procedure)

ก่อนเริ่มยิง Write Benchmark ทุกรอบ ต้องรันสคริปต์ `scripts/reset-db.sh` เพื่อคืนค่าระบบสู่สถานะ Deterministic:
1. ล้างตาราง `orders` ใน PostgreSQL (`TRUNCATE TABLE orders;`)
2. คืนค่าสต็อกสินค้า `p-1001` ในตาราง `products` (`UPDATE products SET remaining_stock = 50 WHERE product_id = 'p-1001';`)
3. ลบ Redis Atomic Claim Keys (`DEL fs:claim:order:*`) และลบ Queue Job ตกค้างใน BullMQ
4. ลบแคชสินค้า `DEL fs:cache:products:*`

---

## 8. สถานการณ์การทดสอบโหลด (Required Competition Scenarios)

### Scenario A — Authentication Preparation
- **รายละเอียด:** ออก JWT Access Token สำหรับ 500 Unique Users (`POST /api/v1/auth/token`) เพื่อเตรียมนำ Token ไปใช้ใน Scenario C
- **Metrics ที่บันทึก:** Latency (ms), Token Failure Count

### Scenario B — Read Heavy Load (GET /products)
- **รายละเอียด:** ยิง `GET /api/v1/products?page=1&limit=10` ด้วย 1,000 Concurrent Virtual Users (VUs)
- **Metrics ที่บันทึก:** RPS (`req/s`), Latency p50/p95/p99 (`ms`), Error Rate (%), Cache Hit Ratio (%)

### Scenario C — Write Heavy Competition (POST /orders)
- **รายละเอียด:** ผู้ใช้ 500 คนยิงสั่งซื้อสินค้า `p-1001` (สต็อก 50) พร้อมกัน
- **Metrics ที่บันทึก:** POST RPS (`req/s`), Latency p50/p95/p99 (`ms`), Error Rate (%), Queue Drain Time (`s`), Worker Throughput (`jobs/s`)

### Scenario D — Duplicate Burst Stress
- **รายละเอียด:** ผู้ใช้บางคนยิง Request ซ้ำสินค้าเดียวกัน 2–3 ครั้งพร้อมกัน
- **Metrics ที่บันทึก:** API Fast Reject Rate (%), Worker Duplicate Rejection Count

### Scenario E — Stock = 1 Race Condition Test
- **รายละเอียด:** ตั้งสต็อกสินค้าเท่ากับ 1 ชิ้น และใช้ 50 Users แย่งซื้อพร้อมกัน เพื่อทดสอบ Lock Contention

---

## 9. ด่านความถูกต้องทางธุรกิจ (Correctness Gate)

> [!CAUTION]
> **Hard Correctness Rule**  
> ผล Benchmark ใดๆ จะถูกระบุเป็น `INVALID RESULT` ทันทีหากไม่ผ่านเกณฑ์ Data Integrity 5 ข้อหลังรัน Scenario C:

1. **Non-Negative Stock:** `remainingStock >= 0` (สำหรับ `p-1001` ขายหมดต้องเท่ากับ `0`)
2. **Total Successful Orders Cap:** `successful orders == 50`พอดี
3. **Distinct Successful Users:** `distinct successful users == 50`พอดี
4. **Zero Duplicate Successful Orders:** `duplicate successful orders == 0`
5. **No Database Integrity Error:** ไม่เกิด Deadlock หรือ Database Corruption

---

## 10. ตารางบันทึกผลการวัดค่าเริ่มต้น (Baseline Benchmark Results Table)

### 10.1 Read Heavy Scenario (GET /api/v1/products)

| Metric Category | Specific Metric | Unit | Run 1 | Run 2 | Run 3 | Median Result | Baseline Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **HTTP Throughput** | Requests Per Second (RPS) | `req/s` | PENDING | PENDING | PENDING | PENDING | `PENDING BENCHMARK` |
| **HTTP Latency** | Median Latency (p50) | `ms` | PENDING | PENDING | PENDING | PENDING | `PENDING BENCHMARK` |
| **HTTP Latency** | 95th Percentile (p95) | `ms` | PENDING | PENDING | PENDING | PENDING | `PENDING BENCHMARK` |
| **HTTP Latency** | 99th Percentile (p99) | `ms` | PENDING | PENDING | PENDING | PENDING | `PENDING BENCHMARK` |
| **HTTP Reliability**| Error Rate | `%` | PENDING | PENDING | PENDING | PENDING | `PENDING BENCHMARK` |
| **Cache Performance**| Cache Hit Ratio | `%` | PENDING | PENDING | PENDING | PENDING | `PENDING BENCHMARK` |
| **Resource Usage** | Host CPU Utilization | `%` | PENDING | PENDING | PENDING | PENDING | `PENDING BENCHMARK` |
| **Resource Usage** | Host RAM Utilization | `MB` | PENDING | PENDING | PENDING | PENDING | `PENDING BENCHMARK` |

### 10.2 Write Heavy Scenario (POST /api/v1/orders on p-1001)

| Metric Category | Specific Metric | Unit | Run 1 | Run 2 | Run 3 | Median Result | Baseline Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **API Admission** | POST Requests Per Second | `req/s` | PENDING | PENDING | PENDING | PENDING | `PENDING BENCHMARK` |
| **API Admission** | Admission Latency (p95) | `ms` | PENDING | PENDING | PENDING | PENDING | `PENDING BENCHMARK` |
| **Queue Performance**| Queue Drain Time | `s` | PENDING | PENDING | PENDING | PENDING | `PENDING BENCHMARK` |
| **Worker Execution**| Worker Jobs Throughput | `jobs/s` | PENDING | PENDING | PENDING | PENDING | `PENDING BENCHMARK` |
| **Data Integrity** | Remaining Stock (`p-1001`)| `count` | PENDING | PENDING | PENDING | PENDING | `PENDING BENCHMARK` |
| **Data Integrity** | Successful Orders Count | `count` | PENDING | PENDING | PENDING | PENDING | `PENDING BENCHMARK` |
| **Data Integrity** | Distinct User Count | `count` | PENDING | PENDING | PENDING | PENDING | `PENDING BENCHMARK` |
| **Data Integrity** | Duplicate Orders Count | `count` | PENDING | PENDING | PENDING | PENDING | `PENDING BENCHMARK` |

---

## 11. บริเวณที่ต้องเฝ้าระวังจุดคอขวด (Potential Areas to Observe)

1. **Database Row Lock Wait Time:** ช่วงที่ Worker หลายตัวแย่งกันตัดสต็อก `p-1001` ด้วย `SELECT FOR UPDATE`
2. **API Event Loop Saturation:** ภาระ CPU ของ NestJS API Containers เมื่อมีคำขอเข้า 1,000 VUs
3. **Queue Backlog Accumulation:** ระยะเวลาที่ Job ค้างในคิว `orders` ก่อน Worker จะประมวลผลหมด
4. **Redis I/O & Connection Limits:** ปริมาณ Connection และ Command Latency ใน Redis
