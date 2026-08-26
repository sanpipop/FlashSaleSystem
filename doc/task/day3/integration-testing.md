# งานพัฒนาสคริปต์ทดสอบการทำงานรวมระบบ (Integration Testing Day 3)

## Goal
เขียนและรันชุด Integration & Concurrency Tests ยืนยันความถูกต้องของระบบ (API Contract, JWT, Caching, Stock Locking, Anti-duplication) ก่อนเริ่มยิง Load Test ใน Day 4

## Owner
Owner: Test Captain (Member 3 / Team)

## Reviewer
Reviewer: Member 1, Member 2

## Priority
P0 (Gatekeeper before Day 4 Load Testing)

## Dependencies
- Hard Dependencies: [authentication.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day2/authentication.md), [products-api.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day2/products-api.md), [orders-api.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day2/orders-api.md), [order-processing.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day2/order-processing.md), [caching.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day3/caching.md)

## Can Start Immediately?
No (เริ่มช่วงบ่ายหลัง Feature หลักใน Day 2-3 พัฒนาเสร็จ)

## Allowed Paths
- `tests/integration/**`
- `scripts/smoke-test.sh`

## Forbidden Paths
- `doc/contracts/**`

## Contracts Used
- [api-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/api-contract.md)
- [queue-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/queue-contract.md)
- [database-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/database-contract.md)

## Scope
- เขียน Integration Test Cases ครอบคลุม:
  1. Auth Flow: ขอ Token และเรียก Protected Endpoint
  2. Products Cache Flow: เรียกครั้งแรก Miss ครั้งถัดไป Hit
  3. Stock Concurrency Test: ยิงซื้อสินค้า `p-1001` (สต็อก 50) พร้อมกัน 100 คำขอ ต้องได้ Order สำเร็จ 50 รายการ สต็อกเหลือ 0
  4. Duplicate Protection Test: ยิงซื้อสินค้าเดียวกันด้วย User เดียวกันพร้อมกัน ปฏิเสธคำขอซ้ำ
  5. Durable Retry Test: ส่ง Job เดิมซ้ำหลัง Commit ต้องได้ Result เดิมและ Stock/Order ไม่เปลี่ยน
  6. Micro-batch Mapping Test: ทุก Job มี `order_results` หนึ่งแถวและ DB batch calls น้อยกว่า Job count ใน Burst
  7. Cache Recovery Test: Redis Cache ล่มหลัง Commit แล้ว Outbox Relay ต้องเปลี่ยน Epoch เมื่อ Redis กลับมา
- จัดทำสคริปต์ `scripts/smoke-test.sh` เพื่อใช้รันใน CI Smoke Workflow

## Out of Scope
- การวัดค่า Benchmark RPS (ทำใน Day 4)

## Implementation Requirements
- สคริปต์ต้องสามารถสั่งรันแบบอัตโนมัติผ่าน `pnpm test:integration` ได้

## Acceptance Criteria
1. รัน `pnpm test:integration` ผ่าน 100% (Green)
2. สคริปต์ `bash scripts/smoke-test.sh` รันผ่านโดยไม่มี Error exit code
3. Stock=1, Stock=50, Retry และ Outbox Recovery Gates ผ่านทั้งหมด

## Test / Verification
```bash
pnpm test:integration
bash scripts/smoke-test.sh
```

## Evidence Required
- Result Output ของการรัน Integration Test Suite และ Smoke Test Script

## Handoff
การันตีความถูกต้องของระบบให้ทีมพร้อมสำหรับการยิง k6 Load Test ใน Day 4

## Definition of Done
Integration Tests ครอบคลุมทุก Business Cases รันผ่าน 100%
