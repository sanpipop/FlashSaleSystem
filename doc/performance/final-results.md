# Final Performance Competition Report

**วันที่วัด:** 29 สิงหาคม 2026

**สถานะ:** `FINAL TARGET-VM BENCHMARK PASSED`

**Runtime commit:** `0230002`

**Target:** 4 vCPU, RAM 6144 MB, Disk 50 GB

**Generator:** external host, Grafana k6 v2.2.0

## สถาปัตยกรรมที่ใช้จริง

`Client/k6 → Nginx → Stateless API x3 → Redis Ops/BullMQ → Worker micro-batch → PostgreSQL`

ฝั่งอ่านใช้ Redis Cache แบบ versioned cache-aside ส่วน PostgreSQL เป็นแหล่งข้อมูลจริง ฝั่งเขียนใช้ Redis atomic admission และ deterministic Job ID ก่อนตอบ `202 Accepted`; Worker ตัด stock ใน ACID transaction และบันทึก durable result/outbox ก่อน invalidate cache

## Final read-warm — median 3 runs

| Metric | Final result |
| --- | ---: |
| Throughput | **3,474.55 req/s** |
| p50 latency | **198.78 ms** |
| p95 latency | **388.70 ms** |
| p99 latency | **522.00 ms** |
| HTTP error | **0%** |
| Checks | **100%** |

หลักฐาน: `final-read-warm-r1-20260829/` ถึง `r3`

## Final write — median 3 runs

| Metric | Baseline | Final | Improvement |
| --- | ---: | ---: | ---: |
| Admission RPS | 236.05 | **288.68** | **+22.30%** |
| Admission p95 | 1,238.43 ms | **741.36 ms** | **เร็วขึ้น 40.14%** |
| Queue drain | 81 ms | **116 ms** | ช้าลง 35 ms |
| HTTP error | 0% | **0%** | คงเดิม |
| Checks | 100% | **100%** | คงเดิม |

Queue drain ช้าขึ้นเล็กน้อย 35 ms แต่ยังต่ำกว่า 0.25 วินาทีทุก final run และแลกกับเวลาตอบรับที่เร็วขึ้นมาก

หลักฐาน: `singleflight-write-r1-20260829/` ถึง `r3`

## Additional final scenarios

| Scenario | Result |
| --- | --- |
| Cold read | 3,188.97 RPS, p95 344.80 ms, error 0%, checks 100% |
| Duplicate burst | 50 users × 3 concurrent requests; 50 logical jobs/orders เท่านั้น, p95 137.56 ms |
| Authentication | 500 requests; error 0%, checks 100%, ไม่มี state mutation |

## Correctness proof

ทุก final write run ผ่านเงื่อนไขต่อไปนี้:

1. stock เริ่ม 50 และจบที่ 0 โดยไม่ติดลบ
2. successful orders = 50
3. distinct successful users = 50
4. duplicate successful `(user_id, product_id)` = 0
5. durable `order_results` = 500
6. retry งานเดิมไม่ตัด stock หรือสร้าง order ซ้ำ

ดังนั้น Redis ไม่ได้ตัดสินผู้ชนะสุดท้าย การตอบ `202` ยืนยันเพียงว่างานถูกสร้างแล้ว ส่วนผลซื้อสำเร็จยึด PostgreSQL transaction และ durable result เท่านั้น

## ขอบเขตของคำกล่าวด้านประสิทธิภาพ

ผลนี้พิสูจน์ว่าคอนฟิกที่เลือกเร็วกว่า baseline ของทีมภายใต้ VM, dataset, k6 profile และ network เดียวกัน ไม่ได้พิสูจน์ว่าเร็วที่สุดในโลก การจัดอันดับกับทีมอื่นต้องใช้สคริปต์และเงื่อนไขเดียวกันก่อนจึงเปรียบเทียบได้อย่างยุติธรรม
