# งานพัฒนา API Skeleton และ Nginx Proxy (API & Nginx Setup Day 1)

## Goal
สร้าง NestJS API Skeleton App ที่รองรับ Health Endpoint และคอนฟิก Nginx Reverse Proxy เพื่อกระจายทราฟฟิกไปยัง API Instances 3 ตัว

## Owner
Owner: Member 1 (Edge / API)

## Reviewer
Reviewer: Member 2

## Priority
P0

## Dependencies
- Hard Dependencies: [project-bootstrap.md](file:///FlashSaleSystem/doc/task/day1/project-bootstrap.md)
- Soft Dependencies: None (ใช้ Mock Nginx Upstream ก่อนได้)

## Can Start Immediately?
Yes (หลัง Bootstrap สร้างโฟลเดอร์ `apps/api`)

## Allowed Paths
- `apps/api/**`
- `infra/nginx/**`

## Forbidden Paths
- `apps/worker/**`
- `database/**`
- `doc/contracts/**`

## Contracts Used
- [api-contract.md](file:///FlashSaleSystem/doc/contracts/api-contract.md)

## Architecture References
- [architecture.md](file:///FlashSaleSystem/doc/architecture/architecture.md)
- [api-flow.md](file:///FlashSaleSystem/doc/architecture/api-flow.md)

## Scope
- สแกฟโฟลด์ NestJS App สเกเลตันใน `apps/api/`
- สร้าง Endpoint `GET /health` ตอบกลับ `{ "status": "ok", "instanceId": "api-1" }`
- เขียน `nginx.conf` คอนฟิก Upstream บล็อกไปยัง `api-1:3000`, `api-2:3000`, `api-3:3000` โดยใช้ Least Connections หรือ Round Robin
- ตั้งค่า Nginx ให้ส่งต่อ Header `X-Request-ID` ไปยัง API Containers

## Out of Scope
- การเขียน Business Logic ของ Auth, Products และ Orders API (ทำใน Day 2)

## Implementation Requirements
- API App ต้องทำตัวเป็น Stateless 100% อ่าน Instance ID จากตัวแปรสภาวะแวดล้อม `INSTANCE_ID`

## Acceptance Criteria
1. เรียก `curl http://localhost/health` ผ่าน Nginx แล้วกระจาย Request ไปยัง API ทั้ง 3 ตัวสลับกัน
2. Response มี Header `X-Request-ID` แนบกลับมาทุกครั้ง

## Test / Verification
```bash
curl -i http://localhost/health
```

## Evidence Required
- Log จาก Nginx และ cURL Output แสดงการสลับอ่านจาก `api-1`, `api-2`, `api-3`

## Handoff
พร้อมให้ Member 1 นำ API Skeleton ไปพัฒนา Auth/Products/Orders Endpoints ใน Day 2

## Definition of Done
Nginx และ API 3 Instances สื่อสารกันได้สำเร็จผ่าน Docker Network

## Blockers / Risks
- Nginx Upstream Name ไม่ตรงกับชื่อ Service ใน Docker Compose
