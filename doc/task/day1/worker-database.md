# งานการตั้งค่า Worker และ Database Schema (Worker & Database Setup Day 1)

## Goal
ตั้งค่าโครงสร้างฐานข้อมูล PostgreSQL สร้าง Migration สำหรับตาราง `products` และ `orders` เขียน Seed Data สินค้า 20 รายการ และสแกฟโฟลด์ Worker App Skeleton

## Owner
Owner: Member 3 (Worker / Database)

## Reviewer
Reviewer: Member 1

## Priority
P0

## Dependencies
- Hard Dependencies: [project-bootstrap.md](file:///FlashSaleSystem/doc/task/day1/project-bootstrap.md)
- Soft Dependencies: None (ใช้ PostgreSQL Container เปล่า)

## Can Start Immediately?
Yes

## Allowed Paths
- `apps/worker/**`
- `database/**`

## Forbidden Paths
- `apps/api/**`
- `infra/nginx/**`
- `doc/contracts/**`

## Contracts Used
- [database-contract.md](file:///FlashSaleSystem/doc/contracts/database-contract.md)

## Architecture References
- [architecture.md](file:///FlashSaleSystem/doc/architecture/architecture.md)

## Scope
- สร้าง TypeORM Config และ Migration ใน `database/` สำหรับ:
  - ตาราง `products` (`product_id`, `name`, `price`, `available_stock`, `remaining_stock`, `is_flash_sale_active`)
  - ตาราง `orders` (`id`, `job_id`, `user_id`, `product_id`, `status`)
  - ตาราง `order_results` (`job_id`, `user_id`, `product_id`, `status`, `order_id`, `processed_at`)
  - ตาราง `transactional_outbox` สำหรับ Retry Cache Epoch หลัง Commit
- เพิ่ม Constraints: `UNIQUE(user_id, product_id)` และ `CHECK(remaining_stock >= 0)`
- สร้าง Seed Script สำหรับนำเข้าสินค้า 20 รายการ (รวมสินค้า `p-1001` สต็อก 50)
- สแกฟโฟลด์ Worker Skeleton App ใน `apps/worker/` ที่รองรับการเชื่อมต่อ DB และดึง Test Job จาก BullMQ

## Out of Scope
- การเขียน `place_order_batch(jsonb)` และ Worker Micro-batch Coordinator เต็มรูปแบบ (ทำใน Day 2)

## Implementation Requirements
- สคริปต์ Migration ต้องสามารถสั่ง `pnpm db:migrate` ได้อย่างถูกต้องและสอดคล้องกับ CI

## Acceptance Criteria
1. รัน Migration และ Seed สั่งผ่านโดยไม่มีข้อผิดพลาด
2. ตาราง `products` มีข้อมูลสินค้า `p-1001` สต็อก 50 ชิ้นพร้อมขาย
3. ตาราง `order_results` และ `transactional_outbox` มี Constraints/Partial Index ตรง `database-contract.md`
4. Worker Skeleton เปิดขึ้นมาเชื่อมต่อ PostgreSQL และ Redis ได้โดยไม่ Crash

## Test / Verification
```bash
pnpm db:migrate
pnpm db:seed
```

## Evidence Required
- SQL Query Result แสดงข้อมูล `p-1001` ในตาราง `products`

## Handoff
ส่งต่อ Database Migration และ Worker Skeleton ให้ Member 3 ทำการพัฒนา Order Processing Logic ใน Day 2

## Definition of Done
Database Migration และ Seed พร้อมใช้งาน Worker Skeleton App เริ่มทำงานได้

## Blockers / Risks
- Database Credentials คอนฟิกไม่ตรงกับ `.env`
