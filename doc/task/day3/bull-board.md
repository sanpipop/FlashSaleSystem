# งานติดตั้ง Bull Board Dashboard (Bull Board Setup Day 3)

## Goal
ติดตั้งและตั้งค่า Bull Board UI Dashboard สำหรับติดตามสถานะของ BullMQ Queue (`orders`) แบบ Real-time ผ่านเว็บเบราว์เซอร์

## Owner
Owner: Member 2 (Queue / Redis / Cache)

## Reviewer
Reviewer: Member 3

## Priority
P1

## Dependencies
- Hard Dependencies: [queue-redis.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day1/queue-redis.md)
- Soft Dependencies: None

## Can Start Immediately?
Yes

## Allowed Paths
- `apps/api/src/admin/**`
- `observability/bull-board/**`

## Forbidden Paths
- `doc/contracts/**`

## Contracts Used
- [queue-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/queue-contract.md)

## Scope
- ติดตั้งแพ็กเกจ `@bull-board/nestjs` และ `@bull-board/api`
- Mount UI Dashboard เข้ากับ NestJS API ที่ Endpoint (เช่น `/admin/queues` หรือตาม Security Scope ที่กำหนด)
- เชื่อมต่อ BullMQ Queue `orders` เข้ากับ Dashboard แสดงสถานะ `waiting`, `active`, `completed`, `failed`

## Out of Scope
- การเปิด Public Access โดยไม่มีมาตรการความปลอดภัยกรณีนำขึ้น Production

## Implementation Requirements
- Dashboard ต้องอ่านข้อมูลสถานะคิวจาก Redis เดียวกับที่ BullMQ ใช้งาน

## Acceptance Criteria
1. สามารถเปิดเว็บเบราว์เซอร์เข้าไปที่ URL แดชบอร์ด (เช่น `http://localhost/admin/queues`) ได้สำเร็จ
2. เมื่อมียอดสั่งซื้อยิงเข้ามา สามารถเห็นยอด Job ในคิวเพิ่มขึ้นและลดลงได้แบบ Real-time

## Test / Verification
```bash
curl -i http://localhost/admin/queues
```

## Evidence Required
- ภาพจับหน้าจอ (Screenshot) ของ Bull Board UI แสดงสถิติของ Queue `orders`

## Handoff
ใช้เป็นเครื่องมือติดตามการทำงานของ Queue ระหว่างการรัน k6 Load Test ใน Day 4

## Definition of Done
Bull Board UI ติดตั้งสำเร็จ แสดงผลสถานะ คิวได้อย่างถูกต้อง
