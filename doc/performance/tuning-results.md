# Performance Tuning Results

**วันที่วัด:** 29 สิงหาคม 2026

**สถานะ:** `MEASURED — KEEP/REVERT RECORDED`

## กติกาตัดสิน

เปลี่ยนตัวแปรหลักครั้งละหนึ่งจุด, วัด 3 รอบ, ใช้ median และผ่าน SQL correctness ทุกครั้ง ผลล้มเหลวไม่ลบเพื่อป้องกันการ cherry-pick

## PERF-EDGE — แก้ CPU throttling และ Nginx upstream blackout

- **Commit:** `ad8264a`
- **ปัญหา:** เดิม Nginx จำกัดเพียง 0.10 CPU และถูก throttle 519 จาก 672 periods รวม 132 วินาที จากนั้น Nginx มอง API ทั้งสามตัวว่าล่มชั่วคราว ทำให้ HTTP error 20.94%
- **การเปลี่ยน:** จัด CPU budget ใหม่ให้พอดี 4 vCPU, เพิ่ม Nginx file/connection limits, keep-alive 256 และใช้ `max_fails=0`
- **ผล:** official 3-run read series มี HTTP error 0% และ checks 100%
- **Decision:** `KEEP`

## PERF-API-COUNT — API 3 เทียบ 4 instances

- **Candidate commit:** `8c30c55`
- **Baseline (3 API) median:** 3,474.55 RPS, p95 388.70 ms, p99 522.00 ms
- **Candidate (4 API) median:** 4,016.80 RPS, p95 453.53 ms, p99 564.02 ms
- **ผล:** throughput เพิ่ม 15.61% แต่ p95 ช้าลง 16.68% และ p99 ช้าลง
- **Decision:** `REVERT` ด้วย commit `90688df` เพราะโจทย์ให้คะแนนความเร็วตอบกลับ ไม่ใช่ RPS เพียงค่าเดียว
- **หลักฐาน:** `candidate4-read-warm-r1-20260829/` ถึง `r3`

## PERF-SINGLE-FLIGHT — รวม DB lookup ที่เกิดพร้อมกันของสินค้าเดียวกัน

- **Commit:** `0230002`
- **ตัวแปร:** เพิ่ม in-flight Single-Flight เฉพาะช่วงที่ query กำลังทำงาน ไม่มี TTL และไม่เก็บค่าค้าง
- **เหตุผลด้านความถูกต้อง:** แชร์เฉพาะผล query ตรวจ eligibility ที่เกิดพร้อมกัน; PostgreSQL transaction ยังเป็นผู้ตัดสิน stock/order สุดท้าย และ map ถูกลบทันทีเมื่อ query จบ

| Metric (median 3 runs) | Before | After | Change |
| --- | ---: | ---: | ---: |
| Admission RPS | 236.05 | 288.68 | +22.30% |
| Admission p95 | 1,238.43 ms | 741.36 ms | **เร็วขึ้น 40.14%** |
| Queue drain | 81 ms | 116 ms | +35 ms |
| HTTP error | 0% | 0% | เท่าเดิม |
| SQL correctness | PASS | PASS | เท่าเดิม |

- **Decision:** `KEEP` เพราะลด latency อย่างมีนัยสำคัญ โดย stock/order/dedup/retry ยังถูกต้องครบ
- **หลักฐาน:** `singleflight-write-r1-20260829/` ถึง `r3`

## PERF-MIXED-BULKHEAD — แยก Read Traffic ออกจาก Order Admission

- **Baseline evidence:** `artifacts/day5/stress/baseline-mixed-r3-20260830T131958Z/`
- **Baseline workload:** Read 1,000 VUs เป็นเวลา 30 วินาที พร้อม Write 500 VUs คนละ 3 requests
- **ปัญหา:** Read Traffic ใช้ CPU ของ API ทั้งสามตัวพร้อมกันจน Order Admission รอเกิน Nginx timeout 10 วินาที เกิด `504` จำนวน 288 requests, Write infrastructure error 19.20% และ Write 202 p95 6,623.94 ms แม้ SQL correctness ผ่านทั้งหมด
- **ตัวแปรเดียวที่เปลี่ยน:** Nginx route isolation โดยให้ `api-1` และ `api-2` รับ Read/General Traffic และสงวน `api-3` สำหรับ `POST /api/v1/orders`; จำนวน API, CPU limit, timeout และ keepalive รวม 256 เท่าเดิม
- **สมมติฐาน:** การแยก Event Loop ของ Order Admission จะป้องกัน Read Flood แย่ง CPU จน POST ค้าง โดยไม่เปลี่ยน Business Logic หรือฐานข้อมูล
- **Correctness:** Baseline PASS; Candidate ต้องผ่าน `remainingStock=0`, `successfulOrders=50`, `duplicatePairs=0`, `negativeStockRows=0` และ `durableResults=500`
- **Decision:** `REJECTED` — Route isolation แก้ Order 504 ได้ แต่ Read Pool สองตัวมี Capacity ไม่พอ

### ผลรอบแรก — `REJECTED`

- Run: `candidate-bulkhead-r1b-20260830`
- Order ดีขึ้นจาก 1,212 Accepted และ 288 HTTP 504 เป็น 1,500/1,500 HTTP 202; Write p95 ดีขึ้นจาก 6,623.94 ms เป็น 4,042.34 ms
- PostgreSQL correctness, durable result และ retry idempotency ผ่านทั้งหมด
- ไม่เลือก Candidate นี้ เพราะ Read Pool ที่เหลือสอง API ทำให้ `GET /api/v1/products` เกิด HTTP 504 จำนวน 368 requests
- ปัญหานี้ไม่ใช่ข้อมูล Stock ค้าง: Product response ทุกคำขอที่ได้ HTTP 200 ผ่าน Contract และมี `remainingStock` เป็นตัวเลข

## PERF-MIXED-FOURTH-API — เพิ่ม Read API โดยคง Order Bulkhead

- **ตัวแปรที่เปลี่ยนจาก Candidate ก่อนหน้า:** เพิ่ม API process หนึ่งตัวเข้า Read Pool
- Read/General Traffic ใช้ `api-1`, `api-2`, `api-4`; `POST /api/v1/orders` ยังคงใช้ `api-3` แยกต่างหาก
- ไม่เปลี่ยน Database, Redis, Worker, Timeout, Test Load หรือ CPU limit ต่อ Container
- **เหตุผล:** คืนความสามารถฝั่ง Read เป็นสาม Event Loops เท่ากับ Baseline และยังรักษา Event Loop อิสระสำหรับ Order Admission โดย VM มี RAM เพียงพอ แต่ต้องวัดว่า 4 vCPU จัดตาราง CPU ได้ดีพอหรือไม่
- **ผล 3 Valid Runs:** `candidate-fourthapi-r1c-20260830T1531Z`, `candidate-fourthapi-r2-20260830T1536Z`, `candidate-fourthapi-r3-20260830T1540Z`

| Mixed-load metric | Baseline 3 API | Candidate median (3 runs) | ผลต่าง |
| --- | ---: | ---: | ---: |
| Read HTTP 200 | 112,807 | 107,675 | -4.55% |
| Read p95 | 360.33 ms | 371.06 ms | +2.98% |
| Order HTTP 202 | 1,212/1,500 | 1,500/1,500 | ครบ 100% |
| Order HTTP 5xx | 288 | 0 | กำจัด 504 ทั้งหมด |
| Order 202 p95 | 6,623.94 ms | 2,146.20 ms | เร็วขึ้น 67.60% |
| SQL correctness | PASS | PASS ทั้ง 3 รอบ | เท่าเดิม |

- ทุก Candidate run มี Contract violation = 0, Queue drain สำเร็จ, `remainingStock=0`, successful orders = 50 users, duplicate pair = 0, negative stock = 0, durable results = 500 และ retry แล้วข้อมูลไม่เปลี่ยน
- k6 latency threshold แบบเข้มของ Mixed Investigation ยังไม่ผ่าน จึงไม่อ้างว่ารองรับ Latency SLO ทุกระดับ แต่ Candidate กำจัด Availability failure และลด Write p95 อย่างชัดเจนโดยแลก Read p95 เพียง 2.98%
- **Decision:** `KEEP` — เลือก 3 Read APIs + 1 Order API เพราะเป็นค่าที่ดีที่สุดจาก Candidate ที่วัดบน Target VM และผ่าน Correctness ครบ

### Order admission failover validation

- หยุด `api-3` จริงแล้วส่ง `POST /api/v1/orders` เดิมสองครั้งผ่าน Nginx
- ทั้งสองคำขอได้ HTTP 202 และ deterministic Job ID เดียวกัน โดย Read API รับหน้าที่เป็น Backup เฉพาะช่วงที่ Primary ติดต่อไม่ได้
- หลังประมวลผล PostgreSQL มี successful order 1 รายการ, distinct user 1, duplicate pair 0, stock ลดเพียง 1 และ durable result 1
- Retry proof ผ่านและไม่เปลี่ยน stock/order/result ซ้ำ จากนั้น reset ระบบคืน stock 50 และ smoke test ผ่าน

## PERF-HOT-READ-LOGGING — ลด synchronous log บนเส้นทางอ่านที่ร้อนที่สุด

- **ตัวแปรที่เปลี่ยน:** ไม่เขียน Nginx access log เฉพาะ `GET /api/v1/products` ที่ตอบ 2xx; request ที่ผิดพลาด, Order, Auth, Health และ Admin ยังคงบันทึกตามเดิม
- **เหตุผล:** Prometheus เก็บ request count/latency ของ successful read อยู่แล้ว การเขียนข้อความซ้ำมากกว่าหนึ่งแสนบรรทัดใน 30 วินาทีเพิ่ม CPU และ Docker logging I/O โดยไม่เพิ่มหลักฐาน correctness
- **หลักฐาน 3 Valid Runs:** `candidate-accesslog-r1-20260830T170905Z`, `candidate-accesslog-r2b-20260830T171911Z`, `candidate-accesslog-r3-20260830T172206Z`

| Mixed-load metric | ก่อนปรับ median | หลังปรับ median | ผลต่าง |
| --- | ---: | ---: | ---: |
| Read HTTP 200 | 107,675 | 119,106 | **+10.62%** |
| Read p95 | 371.06 ms | 327.84 ms | **เร็วขึ้น 11.65%** |
| Order HTTP 202 | 1,500/1,500 | 1,500/1,500 | เท่าเดิม |
| Order HTTP 5xx | 0 | 0 | เท่าเดิม |
| Order 202 p95 | 2,146.20 ms | 2,432.36 ms | ช้าลง 13.33% |
| Order 202 average | 505.00 ms | 476.78 ms | เร็วขึ้น 5.59% |
| SQL correctness | PASS | PASS ทั้ง 3 รอบ | เท่าเดิม |

- Nginx log ต่อรอบลดจากประมาณ 12.4 MB เหลือประมาณ 0.4 MB โดยยังเก็บ error และเส้นทางสำคัญอื่นครบ
- **Decision:** `KEEP` — Read throughput/p95 ดีขึ้นชัดเจน, Order availability และ correctness ไม่ถดถอย และ Order average ดีขึ้น แต่บันทึกอย่างตรงไปตรงมาว่า Order p95 ยังผันผวนและ strict mixed-load threshold ยังไม่ผ่าน

## PERF-REJECTED-EDGE-EXPERIMENTS — ทดลองแล้วไม่เก็บ

| Candidate | ผลที่วัด | Decision |
| --- | --- | --- |
| Nginx `reuseport` + backlog 4,096 | 3-run median Read p95 338.47 ms, Order p95 2,895.51 ms; ทุก integrity gate ผ่าน | `REVERT` เพราะ Order p95 แย่กว่าค่าที่เลือก |
| ให้ `api-3` มี CPU shares 2 เท่า | รอบแรก Order p95 6,237.36 ms แม้ไม่มี 5xx และ integrity ผ่าน | `REVERT EARLY` เพราะแย่ง scheduling จาก edge/cache และแย่ชัดเจน |
| ปิด success access log ของ Order เพิ่ม | รอบแรก Order p95 5,479.83 ms แม้ไม่มี 5xx และ integrity ผ่าน | `REVERT EARLY` เพราะไม่ใช่คอขวด |
| เปิด overflow จาก `api-3` ไป Read APIs ที่ 256 connections | Order p95 4,862.05 ms; Order ถูกกระจายไป API ที่กำลังรับ read flood | `REVERT EARLY` เพราะทำลาย bulkhead |

การสุ่มตัวอย่าง application timing ยืนยันว่า business logic ภายใน API ใช้เวลาหลักสิบมิลลิวินาที (สร้าง Job เฉลี่ย 10.29 ms, ตรวจ Job ซ้ำเฉลี่ย 27.19 ms) ขณะที่ client-side p95 เป็นหลักวินาที จึงไม่ลด Redis/BullMQ/PostgreSQL safety เพื่อแก้ latency ที่เกิดจาก VM scheduling/connection queue ภายใต้ 1,500 concurrent VUs

## Final selected configuration

- Nginx แยก Upstream แบบ Bulkhead: `api-1`, `api-2`, `api-4` รับ Read/General และ `api-3` รับ `POST /api/v1/orders`; Read APIs เป็น failover สำรองเมื่อ `api-3` ติดต่อไม่ได้
- API 4 instances, CPU limit 0.85 ต่อ instance; Nginx 0.80
- Worker CPU 1.25, concurrency 8, batch 16, wait 1 ms
- PostgreSQL CPU 1.25; API pool 4 ต่อ instance และ Worker pool 12
- Redis Operations `noeviction + AOF`; Redis Cache `allkeys-lru`
- Versioned cache invalidation หลัง DB commit พร้อม transactional outbox retry
- In-flight Single-Flight สำหรับ concurrent product lookup
- Nginx ไม่เขียน access log ซ้ำสำหรับ successful product GET; Prometheus metrics และ error/access logs ของเส้นทางอื่นยังคงอยู่

ค่าที่ไม่ได้วัดแบบ 3 รอบจะไม่ถูกอ้างว่าเร็วกว่าค่าอื่น
