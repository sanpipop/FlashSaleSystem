# งานตั้งต้นโปรเจกต์และโครงสร้าง Monorepo (Project Bootstrap)

## Goal
ตั้งต้นโครงสร้าง Monorepo ปรับแต่ง Package Manager (pnpm) สคริปต์กลางของโปรเจกต์ และสร้างโครงสร้างโฟลเดอร์สำหรับบริการทั้งหมดเพื่อให้ทีมเริ่มลงมือเขียนโค้ดได้

## Owner
Owner: Integration Captain

## Reviewer
Reviewer: Member 1, Member 2, Member 3

## Priority
P0 (Critical Path - Blocks All Tasks)

## Dependencies
- Hard Dependencies: None
- Soft Dependencies: None

## Can Start Immediately?
Yes (เริ่มทำเป็นงานแรกของ Day 1 เช้า)

## Allowed Paths
- `package.json`
- `pnpm-workspace.yaml`
- `.env.example`
- `.gitignore`
- `tsconfig.json`
- `apps/`
- `packages/`
- `infra/`
- `scripts/`

## Forbidden Paths
- `doc/contracts/**`
- `doc/architecture/**`

## Contracts Used
N/A (โครงสร้างโปรเจกต์)

## Architecture References
- [architecture.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/architecture.md)

## Scope
- ตั้งค่า pnpm workspace (`pnpm-workspace.yaml`)
- สร้างโครงสร้าง Root `package.json` พร้อมสคริปต์มาตรฐาน (`lint`, `typecheck`, `test`, `build`, `db:migrate`)
- สร้างโฟลเดอร์เปล่าสำหรับ `apps/api`, `apps/worker`, `packages/contracts`, `packages/queue`, `packages/cache`, `infra/nginx`
- กำหนด `.env.example` พร้อมตัวแปรสภาวะแวดล้อมพื้นฐาน

## Out of Scope
- การเขียน Business Logic ใน API หรือ Worker
- การสร้าง Docker Compose (ส่งต่อให้ task `docker-compose.md`)

## Implementation Requirements
- ต้องระบุ `"packageManager": "pnpm@10.0.0"` (หรือเวอร์ชันที่แน่นอน) ใน `package.json` ตามข้อกำหนด CI
- ห้ามใส่ Secret หรือ Password จริงลงใน `.env.example`

## Acceptance Criteria
1. รัน `pnpm install` ที่ root แล้วผ่านโดยไม่มีข้อผิดพลาด
2. สคริปต์คุณภาพใน `package.json` มีครบตามที่ CI ใน `ci.yml` ต้องการ (`lint`, `typecheck`, `test`, `test:integration`, `build`, `db:migrate`)
3. โครงสร้างโฟลเดอร์ `apps/` และ `packages/` ถูกสร้างครบถ้วน

## Test / Verification
```bash
pnpm install
pnpm build
```

## Evidence Required
- ภาพจับหน้าจอหรือ log ผลการรัน `pnpm install` สำเร็จ

## Handoff
ส่งต่อโครงสร้าง Monorepo ให้ Member 1, 2, 3 นำไปพัฒนาแอปพลิเคชันย่อย

## Definition of Done
โครงสร้าง Monorepo สมบูรณ์ มีไฟล์ตั้งต้นครบถ้วน CI สคริปต์รันผ่านเบื้องต้น

## Blockers / Risks
- pnpm lockfile สับสนหรือเวอร์ชัน Node.js ไม่ตรงกับ CI (กำหนด Node.js 22)
