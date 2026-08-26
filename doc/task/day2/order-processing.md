# งานพัฒนา Worker ประมวลผลคำสั่งซื้อและตัดสต็อก (Order Processing Worker Day 2)

## Goal
พัฒนา BullMQ Worker Consumer ดึง Job คำสั่งซื้อจาก Queue เปิด PostgreSQL ACID Transaction ล็อกแถวสินค้าด้วย `SELECT FOR UPDATE` ตรวจสอบสต็อก ตัดสต็อก ป้องกันการซื้อซ้ำ และบันทึกผลลงตาราง `orders`

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
- พัฒนา BullMQ Worker Consumer รับฟัง Queue `orders`
- สำหรับแต่ละ Job:
  1. เปิด PostgreSQL Transaction (`BEGIN`)
  2. ล็อกแถวสินค้า `SELECT remaining_stock, is_flash_sale_active FROM products WHERE product_id = $1 FOR UPDATE`
  3. ตรวจสอบว่า `is_flash_sale_active == true` และ `remaining_stock > 0`
  4. ตรวจสอบว่า `user_id` เคยสั่งซื้อ `product_id` นี้สำเร็จแล้วหรือไม่
  5. หากผ่านทุกเงื่อนไข: ลดสต็อก `remaining_stock = remaining_stock - 1`, เพิ่ม Order ลงตาราง `orders` สถานะ `SUCCESS` และ `COMMIT`
  6. หากไม่ผ่าน: `ROLLBACK` และบันทึก Result Log (`REJECTED_SOLD_OUT` / `REJECTED_DUPLICATE`)

## Out of Scope
- การสั่งล้าง Redis Cache หลัง Commit (เพิ่มทำใน Day 3)

## Implementation Requirements
- ต้องอาศัย Database Constraints `UNIQUE(user_id, product_id)` และ `CHECK(remaining_stock >= 0)` เป็นด่านความปลอดภัยขั้นสูงสุดเสมอ

## Acceptance Criteria
1. ทดสอบยิงสั่งซื้อสินค้า `p-1001` (สต็อก 50) ด้วยผู้ใช้ 100 คนซ้ำกัน พบว่าสร้าง Order สำเร็จเพียง 50 รายการ และสต็อกคงเหลือเท่ากับ 0 พอดี
2. ไม่เกิดกรณี สต็อกติดลบ (`remaining_stock < 0`) หรือ Order ซ้ำเด็ดขาด

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
