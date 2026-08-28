# เอกสารการวัดค่าประสิทธิภาพเริ่มต้น (Baseline Performance Benchmark)

**วันที่อัปเดต:** 26 สิงหาคม 2026  
**สถานะ:** HARNESS READY / PENDING EXTERNAL BENCHMARK (Phase 4)
**ขอบเขตโปรเจกต์:** มาตรฐานการวัดผล ประสิทธิภาพเริ่มต้นและเกณฑ์การทดสอบระบบก่อนทำการ Tuning (ทุกสมาชิกในทีม)

---

## 1. วัตถุประสงค์ (Purpose)

เอกสารฉบับนี้จัดทำขึ้นเพื่อกำหนด **มาตรฐานการวัดผลและเกณฑ์การทดสอบประสิทธิภาพเริ่มต้น (Baseline Performance Benchmark Framework)** ของระบบ Flash Sale ก่อนเริ่มกระบวนการปรับแต่งประสิทธิภาพ (Performance Tuning) ใน Phase 5 เพื่อให้ทีมมีค่าเปรียบเทียบเชิงประจักษ์ (Empirical Evidence) ว่าการปรับแต่งแต่ละจุดส่งผลดีหรือแย่ลงอย่างไรภายใต้สภาวะแวดล้อมเดียวกัน

---

## 2. สถานะการวัดผลปัจจุบัน (Benchmark Status)

```text
Status: HARNESS READY / PENDING EXTERNAL BENCHMARK
Reason: สคริปต์ k6, deterministic reset และ integrity verifier พร้อมและผ่าน local
functional validation แล้ว แต่ยังไม่มี Target VM BASE_URL สำหรับยิงจาก external load
generator จึงยังไม่มี official 3-run baseline ที่ใช้รายงานประสิทธิภาพได้
```

> [!IMPORTANT]
> **No Fake Metrics Rule**  
> ตามกฎของโปรเจกต์ ตารางผลการทดสอบทั้งหมดจะใช้สถานะ `PENDING BENCHMARK` จนกว่าจะได้รับการรัน k6 Load Test จริงจากเครื่องภายนอก ห้ามแต่งตัวเลขหรือใส่ค่าสมมติโดยเด็ดขาด

### 2.1 หลักฐานความพร้อมของ Harness (ไม่ใช่ Baseline)

- k6 syntax/config ผ่านทั้ง `auth`, `read`, `write` และ `duplicate`
- **Benchmark generator version: k6 v2.2.0** (frozen for official series)
- Previous v0.57.0 results were preflight-only and are excluded from official baseline
- Reason for migration: v2.2.0 is the latest maintained major version; official series
  has not begun; benchmark generator can still be re-frozen safely; major-version
  compatibility has been revalidated
- Summary evidence ใช้ k6 `handleSummary` ตัด `setup_data` ที่มี JWT ก่อน persist โดยไม่
  แก้ไข metric values
- Local write validation 5 users ผ่าน BullMQ drain, durable-result correlation และ retry
  idempotency: `artifacts/day4/harness-validation-local-r3/`
- Local duplicate validation 2 users × 3 concurrent requests สร้าง 2 logical jobs และ
  durable orders เท่านั้น: `artifacts/day4/duplicate-validation-local-r2/`
- Local read cold/warm functional validation: `artifacts/day4/read-cold-validation-local/`
  และ `artifacts/day4/read-warm-validation-local/`

หลักฐานข้างต้นรัน k6 บน host เดียวกับ backend จึงมีสถานะ
`NON-OFFICIAL HARNESS VALIDATION` และห้ามนำค่า RPS/latency ไปคำนวณ median หรือใช้เป็น
baseline ของ Target VM

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
- **Tool:** Grafana k6 v2.2.0 (pinned native binary; Docker `grafana/k6:2.2.0` for sanity check only)
- **Network Context:** ยิงผ่าน Public IP เข้า Nginx Proxy บน Port 80

---

## 4. โครงสร้างสถาปัตยกรรมและค่าคอนฟิกเริ่มต้น (Baseline Configuration)

### 4.1 Baseline Architecture Overview
`Client → Nginx → NestJS API x3 → Redis Ops/BullMQ → Micro-batch Worker → PostgreSQL Results/Outbox` และ `GET → Redis Cache Version → PostgreSQL on miss`

### 4.2 ตารางค่าคอนฟิกเริ่มต้น (Baseline Parameters Table):

| Component / Layer | Parameter | Baseline Value | Source Origin |
| --- | --- | --- | --- |
| **Edge / LB** | Nginx Proxy Strategy | `least_conn` หรือ `round_robin` | `infra/nginx/nginx.conf` |
| **API Layer** | API Instance Count | `3 Containers` | `compose.yaml` |
| **API Layer** | Node Runtime Heap | Default (`PENDING`) | Runtime Environment |
| **Queue / Cache** | Redis Instances | `2`: Operations `noeviction+AOF`, Cache `allkeys-lru` | `compose.yaml` |
| **Worker** | BullMQ Concurrency | `8` initial; tune 8/12/16 | `apps/worker/src/config` |
| **Worker** | Micro-batch | `16 jobs`, max wait `1 ms`; tune 16/32 | `apps/worker/src/config` |
| **Cache Layer** | Strategy | Versioned key + Single-Flight, TTL `60s ±5s` | `packages/cache` |
| **Database** | Connections | `max_connections 35–40`, application pools total about `28` | `database/ormconfig` |

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
   - ล้างเฉพาะ Redis Cache Instance หรือเปลี่ยน Epoch ก่อนรัน ห้ามใช้ Wildcard `DEL`
   - วัดผลการเกิด Cache Miss ในครั้งแรก และการ Fallback ไปอ่าน PostgreSQL เพื่อสร้างแคชใหม่
2. **Warm Cache Scenario (แคชอุ่น / Steady State):**
   - ทำการยิงคำขอ `GET /products` ก่อน 1 รอบเพื่อเติมแคช
   - วัดผลประสิทธิภาพการอ่านแบบ Steady State (Cache Hit Ratio สูงสุด)

---

## 7. ขั้นตอนการรีเซ็ตระบบก่อนการทดสอบ (Reset Procedure)

ก่อนเริ่มยิง Write Benchmark ทุกรอบ ต้องรันสคริปต์ `scripts/reset-db.sh` เพื่อคืนค่าระบบสู่สถานะ Deterministic:
1. ล้างตาราง `orders` ใน PostgreSQL (`TRUNCATE TABLE orders;`)
2. คืนค่าสต็อกสินค้า `p-1001` ในตาราง `products` (`UPDATE products SET remaining_stock = 50 WHERE product_id = 'p-1001';`)
3. ลบ Claim Keys ด้วย `SCAN` + `UNLINK` แบบจำกัด Prefix และลบ Queue Jobsผ่าน BullMQ API เท่านั้น
4. Reset Redis Cache Instance/Epoch โดยไม่แตะ Redis Operations

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
> ผล Benchmark ใดๆ จะถูกระบุเป็น `INVALID RESULT` ทันทีหากไม่ผ่านเกณฑ์ SQL/Retry 8 ข้อหลังรัน Scenario C:

1. **Non-Negative Stock:** `remainingStock >= 0` (สำหรับ `p-1001` ขายหมดต้องเท่ากับ `0`)
2. **Total Successful Orders Cap:** `successful orders == 50`พอดี
3. **Distinct Successful Users:** `distinct successful users == 50`พอดี
4. **Zero Duplicate Successful Orders:** `duplicate successful orders == 0`
5. **No Database Integrity Error:** ไม่เกิด Deadlock หรือ Database Corruption
6. **Result Referential Integrity:** Successful Result ที่ไม่มี Order อ้างอิงต้องเท่ากับ 0
7. **Accepted-to-Durable Completion:** หลัง Queue Drain ทุก Accepted Job ต้องมี `order_results` หนึ่งผล
8. **Retry Idempotency:** ส่ง Job เดิมซ้ำแล้ว Stock/Order count ต้องไม่เปลี่ยน

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
