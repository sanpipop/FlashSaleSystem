# งานตั้งค่า Queue และ Redis Abstraction (Queue & Redis Setup Day 1)

## Goal
ตั้งค่าการเชื่อมต่อ Redis และสร้าง Shared Library สำหรับ BullMQ Queue (`orders`) เพื่อใช้เป็นฐานสำหรับการทำ Job Enqueue และ Deduplication Claim

## Owner
Owner: Member 2 (Queue / Redis / Cache)

## Reviewer
Reviewer: Member 3

## Priority
P0

## Dependencies
- Hard Dependencies: [project-bootstrap.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day1/project-bootstrap.md)
- Soft Dependencies: None (เชื่อมต่อกับ Redis Docker Container เปล่า)

## Can Start Immediately?
Yes

## Allowed Paths
- `packages/queue/**`
- `packages/cache/**`

## Forbidden Paths
- `apps/api/**`
- `apps/worker/**`
- `database/**`
- `doc/contracts/**`

## Contracts Used
- [queue-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/queue-contract.md)
- [redis-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/redis-contract.md)

## Architecture References
- [architecture.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/architecture.md)

## Scope
- สร้าง Shared Package `packages/queue` บรรจุ BullMQ Producer Module
- สร้าง helper `jobId = ord-<SHA256(userId|productId)>` ซึ่งไม่มี `:` ตาม `queue-contract.md`
- แยก Redis Operations (`noeviction`, AOF everysec) และ Redis Cache (`allkeys-lru`) เป็นคนละ Instance/Connection
- ตั้ง Job retention, attempts และ exponential backoff ตาม Queue Contract
- สร้าง Shared Package `packages/cache` สำหรับจัดการ Redis Client Connection
- เขียน Unit Test ทดสอบการเชื่อมต่อและสั่ง Enqueue Test Job

## Out of Scope
- การเชื่อมต่อ Bull Board Dashboard (เลื่อนไป Day 3)
- การทำ Cache-Aside Logic เต็มรูปแบบ

## Implementation Requirements
- Redis Key Namespace ทั้งหมดต้องขึ้นต้นด้วย `fs:` ตามข้อตกลงใน [redis-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/redis-contract.md)

## Acceptance Criteria
1. สามารถรันสคริปต์ทดสอบ Enqueue Job เข้า BullMQ Queue `orders` บน Redis ได้สำเร็จ
2. รัน `pnpm test` ใน `packages/queue` ผ่าน 100%

## Test / Verification
```bash
pnpm --filter queue test
```

## Evidence Required
- Result Log ของ Unit Test ที่แสดงการ Enqueue Job และได้ Job ID ตรงตามรูปแบบ

## Handoff
ส่งต่อ `packages/queue` ให้ Member 1 นำไปใช้ใน API Producer และ Member 3 นำไปใช้ใน Worker Consumer

## Definition of Done
Queue & Redis Package พร้อมใช้งาน มี TypeScript Interfaces และ Unit Test ผ่าน

## Blockers / Risks
- Redis Connection Host / Port คอนฟิกไม่ตรงกับ Docker Environment
