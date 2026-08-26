# งานพัฒนา Orders Admission API (Orders API Admission Day 2)

## Goal
พัฒนา Endpoint `POST /api/v1/orders` รับคำสั่งซื้อ Flash Sale ตรวจสอบ JWT, คำนวณ Atomic Claim Guard, Enqueue งานเข้า BullMQ Queue `orders` และตอบกลับ `202 Accepted` รวดเร็ว

## Owner
Owner: Member 1 (Edge / API)

## Reviewer
Reviewer: Member 2

## Priority
P0

## Dependencies
- Hard Dependencies: [authentication.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day2/authentication.md), [queue-redis.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day1/queue-redis.md)
- Soft Dependencies: None

## Can Start Immediately?
No (ต้องใช้ JwtAuthGuard และ Queue Producer Package)

## Allowed Paths
- `apps/api/src/orders/**`

## Forbidden Paths
- `apps/worker/**`
- `database/**`
- `doc/contracts/**`

## Contracts Used
- [api-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/api-contract.md)
- [queue-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/queue-contract.md)
- [redis-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/redis-contract.md)

## Scope
- สร้าง Orders Module และ Controller ใน NestJS API
- ป้องกันด้วย `JwtAuthGuard` สกัด `userId` จาก Token
- รับ Request Body `{ "productId": "p-1001" }`
- เรียกใช้ Redis Atomic Operation (`SET fs:claim:order:{userId}:{productId} 1 EX 60 NX`) เพื่อกันคำขอซ้ำในระดับ API
- สร้าง Deterministic `jobId` (`job:userId:productId`) แล้วสั่ง Enqueue เข้า BullMQ Queue `orders`
- ตอบกลับ HTTP `202 Accepted` พร้อม `{ "status": "processing", "orderJobId": "..." }`

## Out of Scope
- การเปิด Database Transaction ตัดสต็อกใน Controller (ห้ามทำเด็ดขาด!)

## Implementation Requirements
- ปริมาณการซื้อถูกบังคับเป็น 1 ชิ้นเสมอ ห้ามรับ `quantity` จาก Client

## Acceptance Criteria
1. คำขอที่ถูกต้องและมี Bearer Token จะได้รับตอบกลับ `202 Accepted` ภายในเวลารวดเร็ว
2. งานถูกส่งเข้า BullMQ Queue `orders` พร้อม Payload ที่ถูกต้องตาม `queue-contract.md`

## Test / Verification
```bash
TOKEN=$(curl -s -X POST http://localhost/api/v1/auth/token -H "Content-Type: application/json" -d '{"userId":"user-001"}' | jq -r .accessToken)

curl -i -X POST http://localhost/api/v1/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"productId":"p-1001"}'
```

## Evidence Required
- cURL Output แสดง HTTP Status `202 Accepted` พร้อม `orderJobId`

## Handoff
ส่งต่อ Job ใน Queue ให้ Worker (Member 3) ดึงไปประมวลผลตัดสต็อก

## Definition of Done
Orders API Admission ทำงานถูกต้อง Enqueue Job เข้า BullMQ สำเร็จ
