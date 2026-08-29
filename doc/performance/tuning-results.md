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

## Final selected configuration

- Nginx `least_conn`, API 3 instances
- API CPU limit 0.65 ต่อ instance; Nginx 0.50
- Worker CPU 1.25, concurrency 8, batch 16, wait 1 ms
- PostgreSQL CPU 1.25; API pool 4 ต่อ instance และ Worker pool 12
- Redis Operations `noeviction + AOF`; Redis Cache `allkeys-lru`
- Versioned cache invalidation หลัง DB commit พร้อม transactional outbox retry
- In-flight Single-Flight สำหรับ concurrent product lookup

ค่าที่ไม่ได้วัดแบบ 3 รอบจะไม่ถูกอ้างว่าเร็วกว่าค่าอื่น
