# งานพัฒนา API ดึงข้อมูลสินค้า (Products API Day 2)

## Goal
พัฒนา Endpoint `GET /api/v1/products?page=1&limit=10` สำหรับดึงรายการสินค้า 20 รายการแบบแบ่งหน้า พร้อมสต็อกคงเหลือล่าสุดจาก Database

## Owner
Owner: Member 1 (Edge / API)

## Reviewer
Reviewer: Member 3

## Priority
P0

## Dependencies
- Hard Dependencies: [worker-database.md](file:///FlashSaleSystem/doc/task/day1/worker-database.md) (ต้องการตาราง products และ seed)
- Soft Dependencies: [caching.md](file:///FlashSaleSystem/doc/task/day3/caching.md) (ทำ DB Path ใน Day 2 ก่อน แล้วเพิ่ม Redis Cache ใน Day 3)

## Can Start Immediately?
Yes

## Allowed Paths
- `apps/api/src/products/**`

## Forbidden Paths
- `apps/worker/**`
- `doc/contracts/**`

## Contracts Used
- [api-contract.md](file:///FlashSaleSystem/doc/contracts/api-contract.md)

## Scope
- สร้าง Products Module, Controller, และ Service ใน NestJS API
- Implement Endpoint `GET /api/v1/products` รับ Query Parameters `page` และ `limit`
- คืนค่ารายการสินค้าพร้อม Response Structure (`status`, `data`, `meta`) ตรงตาม [api-contract.md](file:///FlashSaleSystem/doc/contracts/api-contract.md)

## Out of Scope
- การทำ Redis Caching (ทำเพิ่มเติมใน Day 3)

## Implementation Requirements
- ฟิลด์ที่คืนกลับต้องใช้ `camelCase` (`productId`, `availableStock`, `remainingStock`, `isFlashSaleActive`)

## Acceptance Criteria
1. เรียก `GET /api/v1/products?page=1&limit=10` ได้รับรายการสินค้า 10 รายการแรก พร้อม `meta` แสดง `total: 20`
2. ข้อมูลสินค้า `p-1001` แสดง `availableStock: 50` และ `remainingStock: 50` (ก่อนมีการซื้อ)

## Test / Verification
```bash
curl -s "http://localhost/api/v1/products?page=1&limit=10" | jq .
```

## Evidence Required
- cURL Output แสดงผลลัพธ์ JSON ของ Products API ตามมาตรฐาน

## Handoff
ให้ทีมใช้อ่านข้อมูลสินค้าตั้งต้นสำหรับเตรียมทดสอบสั่งซื้อ

## Definition of Done
Products API คืนข้อมูลตรงตาม api-contract.md ดึงจาก DB ได้ถูกต้อง
