# งานพัฒนาระบบยืนยันตัวตน JWT (Authentication & Authorization Day 2)

## Goal
พัฒนาระบบออก JWT Access Token (`POST /api/v1/auth/token`) และ NestJS JwtAuthGuard เพื่อดึงและตรวจสอบ `userId` สำหรับใช้ใน Order API

## Owner
Owner: Member 1 (Edge / API)

## Reviewer
Reviewer: Member 2

## Priority
P0

## Dependencies
- Hard Dependencies: [api-nginx.md](file:///FlashSaleSystem/doc/task/day1/api-nginx.md)
- Soft Dependencies: None

## Can Start Immediately?
Yes

## Allowed Paths
- `apps/api/src/auth/**`
- `apps/api/src/common/**`

## Forbidden Paths
- `apps/worker/**`
- `database/**`
- `doc/contracts/**`

## Contracts Used
- [api-contract.md](file:///FlashSaleSystem/doc/contracts/api-contract.md)

## Scope
- สร้าง Auth Module และ Auth Controller ใน NestJS API
- Implement Endpoint `POST /api/v1/auth/token` รับ JSON `{ "userId": "user-999" }` และออก JWT Token คืน `200 OK`
- ตั้งค่า JWT Signer ให้ใส่ Payload `sub: userId`
- สร้าง `JwtAuthGuard` สำหรับสกัด `userId` จาก Header `Authorization: Bearer <token>`

## Out of Scope
- การเชื่อมต่อกับตาราง User ใน Database (ใช้ JWT Signed Claim ตรงตาม Assignment)

## Implementation Requirements
- SecretKey ต้องอ่านจากตัวแปรสภาวะแวดล้อม `JWT_SECRET`
- ห้าม Client ส่ง `userId` มาทาง Order Body ให้ยึดจาก JWT Token ที่ผ่าน Guard แล้วเท่านั้น

## Acceptance Criteria
1. เรียก `POST /api/v1/auth/token` ได้รับ JSON `{ "status": "success", "accessToken": "..." }`
2. ส่ง Header JWT ที่ไม่ถูกต้องไปยัง Protected Endpoint แล้วได้รับการปฏิเสธด้วย `401 Unauthorized`

## Test / Verification
```bash
# 1. Get Token
TOKEN=$(curl -s -X POST http://localhost/api/v1/auth/token -H "Content-Type: application/json" -d '{"userId":"user-001"}' | jq -r .accessToken)

# 2. Test Invalid Token
curl -i -X POST http://localhost/api/v1/orders -H "Authorization: Bearer invalid_token"
```

## Evidence Required
- cURL Output แสดงการออก Token สำเร็จ และการปฏิเสธ Token ที่ไม่ถูกต้องด้วย status 401

## Handoff
ส่งต่อ JWT Guard ให้ Member 1 นำไปสวมทับ Endpoint `POST /api/v1/orders`

## Definition of Done
Auth Module ออก Token ได้จริง Guard ทำงานถูกต้องตาม api-contract.md
