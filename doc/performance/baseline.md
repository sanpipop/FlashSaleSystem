# Baseline Performance Benchmark

**วันที่วัด:** 29 สิงหาคม 2026

**สถานะ:** `MEASURED ON TARGET VM`

**Target:** 4 vCPU, RAM 6144 MB, Disk 50 GB

**Load generator:** เครื่องภายนอก Target VM, Grafana k6 v2.2.0

**หลักการ:** ใช้ 3 รอบและรายงานค่ากลาง (median); ทุกครั้งต้องมี clean commit, resource capture, queue drain และ SQL integrity

## Baseline configuration

ค่าตั้งต้นที่ใช้เปรียบเทียบหลังแก้ CPU throttling และ Nginx upstream blackout:

- Commit ฝั่งอ่าน: `aa06262`
- Commit ฝั่งเขียนก่อน Single-Flight: `90688df`
- Nginx `least_conn`, keep-alive 256, ไม่ตัด upstream ชั่วคราวจากอาการ overload
- Stateless NestJS/Fastify API 3 instances
- Redis Operations แยกจาก Redis Product Cache
- Worker concurrency 8, micro-batch 16 jobs, รอสูงสุด 1 ms
- PostgreSQL เป็นผู้ตัดสิน Order และ Stock ขั้นสุดท้าย

## Read-warm baseline — 1,000 VUs, 30 วินาที

| Run | RPS | p50 (ms) | p95 (ms) | p99 (ms) | HTTP error | Checks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 3,403.01 | 198.78 | 388.70 | 1,124.58 | 0% | 100% |
| 2 | 3,510.41 | 226.10 | 404.60 | 471.52 | 0% | 100% |
| 3 | 3,474.55 | 189.52 | 375.41 | 522.00 | 0% | 100% |
| **Median** | **3,474.55** | **198.78** | **388.70** | **522.00** | **0%** | **100%** |

หลักฐาน: `artifacts/day4/final-read-warm-r1-20260829/` ถึง `r3`

## Write baseline — 500 users แย่งสินค้า stock 50

ตารางนี้ใช้ metric `write_admission_duration` ซึ่งวัดเฉพาะเวลาที่ API รับคำสั่งและสร้างงานสำเร็จ ไม่ปนเวลาขอ JWT

| Run | Admission RPS | Admission p95 (ms) | Queue drain (ms) | HTTP error | SQL gates |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 | 258.27 | 967.40 | 81 | 0% | PASS |
| 2 | 208.52 | 1,254.36 | 50 | 0% | PASS |
| 3 | 236.05 | 1,238.43 | 129 | 0% | PASS |
| **Median** | **236.05** | **1,238.43** | **81** | **0%** | **PASS** |

หลักฐาน: `artifacts/day4/final-write-r1-20260829/` ถึง `r3`

## Correctness gates

ทุก write run ต้องได้ผลพร้อมกันดังนี้:

- `remaining_stock = 0`
- successful orders = 50
- distinct successful users = 50
- duplicate successful `(user_id, product_id)` = 0
- durable `order_results` = 500 และการ retry ไม่ลด stock ซ้ำ

หากข้อใดผิด ผล performance รอบนั้นเป็น `INVALID` ทันที
