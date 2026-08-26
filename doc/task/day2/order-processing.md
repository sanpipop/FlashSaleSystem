# งานพัฒนา Worker ประมวลผลคำสั่งซื้อและตัดสต็อก (Order Processing Worker Day 2)

## Goal
พัฒนา BullMQ Worker Consumer แบบ Micro-batch เรียก `place_order_batch(jsonb)` ภายใต้ PostgreSQL ACID Transaction เพื่อรักษา Zero Oversell/Zero Duplicate และลด DB Round-trip

## Owner
Owner: Member 3 (Worker / Database)

## Reviewer
Reviewer: Member 1

## Priority
P0

## Dependencies
- Hard Dependencies: [worker-database.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day1/worker-database.md), [queue-redis.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day1/queue-redis.md)
- Soft Dependencies: [orders-api.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day2/orders-api.md) (สามารถใช้ Mock Queue Payload ทดสอบก่อนได้)

## Can Start Immediately?
Yes

## Allowed Paths
- `apps/worker/src/**`
- `database/**`

## Forbidden Paths
- `apps/api/**`
- `infra/nginx/**`
- `doc/contracts/**`

## Contracts Used
- [queue-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/queue-contract.md)
- [database-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/database-contract.md)

## Architecture References
- [architecture.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/architecture.md)
- [order-flow.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/order-flow.md)
- [concurrency-and-idempotency.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/concurrency-and-idempotency.md)

## Scope
- พัฒนา BullMQ Worker รับ Queue `orders` และรวม 10–32 Jobs หรือรอสูงสุด 1 ms (ค่าเริ่ม 16)
- ส่ง Batch เข้า `place_order_batch(jsonb)` ซึ่งต้อง:
  1. คืน `order_results` เดิมสำหรับ `job_id` ที่เคยประมวลผลแล้ว
  2. Deduplicate ภายใน Batch ด้วย `job_id` และ `(user_id, product_id)`
  3. ล็อก Product Row ด้วย `SELECT ... FOR UPDATE` หนึ่งครั้ง
  4. คัดผู้ชนะไม่เกิน `remaining_stock` และ Bulk Insert `orders`
  5. ลด Stock ตามจำนวน Row ที่ Insert สำเร็จจริง
  6. บันทึก `order_results` ให้ครบทุก Job และเขียน `transactional_outbox` เมื่อ Stock เปลี่ยน
  7. Commit ทั้งหมดพร้อมกันและ Mapping ผลกลับ BullMQ แยกตาม Job

## Out of Scope
- Immediate Redis Epoch Increment และ Outbox Relay (ต่อระบบใน Day 3; Outbox schema ทำ Day 1)

## Implementation Requirements
- ต้องอาศัย Database Constraints `UNIQUE(user_id, product_id)` และ `CHECK(remaining_stock >= 0)` เป็นด่านความปลอดภัยขั้นสูงสุดเสมอ

## Acceptance Criteria
1. ทดสอบยิงสั่งซื้อสินค้า `p-1001` (สต็อก 50) ด้วยผู้ใช้ 100 คนซ้ำกัน พบว่าสร้าง Order สำเร็จเพียง 50 รายการ และสต็อกคงเหลือเท่ากับ 0 พอดี
2. ไม่เกิดกรณี สต็อกติดลบ (`remaining_stock < 0`) หรือ Order ซ้ำเด็ดขาด
3. Retry Job เดิมหลัง Commit คืนผลเดิมจาก `order_results` โดย Stock/Order ไม่เปลี่ยน
4. วัดจำนวน DB batch calls และต้องน้อยกว่าจำนวน Jobs อย่างชัดเจนเมื่อ Burst พร้อมกัน

## Test / Verification
```bash
# Integration concurrency test script
pnpm --filter worker test:integration
```

## Evidence Required
- SQL Query Result แสดงว่า `orders` มี 50 รายการ และ `remaining_stock` เท่ากับ 0

## Handoff
ให้ทีมพร้อมสำหรับการเพิ่มระบบ Caching และ Observability ใน Day 3

## Definition of Done
Worker ประมวลผลคำสั่งซื้อและตัดสต็อกได้ถูกต้อง การันตีสต็อกไม่ติดลบและไม่ซื้อซ้ำ
