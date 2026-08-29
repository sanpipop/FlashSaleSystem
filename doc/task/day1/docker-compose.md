# งานการตั้งค่าบริการผ่าน Docker Compose (Docker Compose Setup)

## Goal
จัดทำไฟล์ `compose.yaml` (หรือ `docker-compose.yml`) เพื่อเปิดบริการ Nginx, NestJS API (3 Instances), BullMQ Worker, Redis และ PostgreSQL พร้อม Health Check และ Volume ถาวร

## Owner
Owner: Integration Captain

## Reviewer
Reviewer: Member 1, Member 2, Member 3

## Priority
P0 (Critical Path)

## Dependencies
- Hard Dependencies: [project-bootstrap.md](file:///FlashSaleSystem/doc/task/day1/project-bootstrap.md)
- Soft Dependencies: [api-nginx.md](file:///FlashSaleSystem/doc/task/day1/api-nginx.md), [worker-database.md](file:///FlashSaleSystem/doc/task/day1/worker-database.md)

## Can Start Immediately?
No (ต้องรอโครงสร้างโฟลเดอร์จาก bootstrap)

## Allowed Paths
- `compose.yaml`
- `docker-compose.yml`
- `.env.example`
- `infra/`

## Forbidden Paths
- `doc/contracts/**`
- `doc/architecture/**`

## Contracts Used
N/A

## Architecture References
- [architecture.md](file:///FlashSaleSystem/doc/architecture/architecture.md)

## Scope
- เขียนบริการใน Compose File:
  - `nginx`: Port 80 (External entry point)
  - `api-1`, `api-2`, `api-3`: NestJS API Instances
  - `worker`: BullMQ Worker Process
  - `postgres`: PostgreSQL 16 Alpine (Port 5432)
  - `redis`: Redis 7 Alpine (Port 6379 / 6380)
- กำหนด Health Check ให้บริการ DB และ Redis
- กำหนด Persistent Volume สำหรับ PostgreSQL Data (`pgdata`)

## Out of Scope
- การตั้งค่า Prometheus/Grafana (เลื่อนไปทำ Day 3)
- การปรับแต่ง Performance Parameter ขั้นสูง

## Implementation Requirements
- บริการ Nginx ต้องเป็นเพียงจุดเดียวที่เปิด Public Port 80
- API Containers ห้ามแมป Port ออกสาธารณะ ให้คุยผ่าน Nginx Internal Network

## Acceptance Criteria
1. คำสั่ง `docker compose config --quiet` รันผ่านโดยไม่มี Syntax Error
2. คำสั่ง `docker compose up --build -d` สามารถสั่งเปิด Container ทั้งหมดได้โดยไม่ Crash
3. PostgreSQL และ Redis ผ่าน Health Check

## Test / Verification
```bash
docker compose config
docker compose up --build -d
docker compose ps
```

## Evidence Required
- ผลการรัน `docker compose ps` แสดงทุก Container มีสถานะ `Up` หรือ `healthy`

## Handoff
ให้ทีมนำ Compose Environment ไปใช้รัน Integration Test

## Definition of Done
 Compose File สมบูรณ์ บริการหลักขึ้นครบ และตรวจสอบความถูกต้องผ่าน CI `ci.yml`

## Blockers / Risks
- Port ชนกับบริการบนเครื่องโฮสต์ หรือทรัพยากร RAM/CPU ใน VM ไม่เพียงพอ
