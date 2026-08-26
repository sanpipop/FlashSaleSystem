# ภาพรวมแผนงานวันที่ 1 (Day 1 Overview: Foundation & Infrastructure Bootstrap)

**วันที่อัปเดต:** 26 สิงหาคม 2026  
**สถานะ:** FROZEN EXECUTION PLAN (Phase 3)  
**เป้าหมายหลัก:** สร้างโครงสร้างพื้นฐาน (Foundation Skeleton) เปลี่ยนจาก Repository เอกสารไปสู่ระบบที่ Docker Compose สามารถขึ้นบริการหลัก (Nginx, API x3, Worker, Redis, PostgreSQL) และสื่อสารกันได้ในระดับสเกเลตัน

---

## 1. เป้าหมายของวัน (Day Goal)

เปลี่ยนสภาพแวดล้อมโปรเจกต์ให้มีโครงสร้าง Monorepo / Application Skeleton สำเร็จ เพื่อให้สมาชิกทั้ง 3 คนสามารถแยกกันเขียนโค้ดบน Feature Branch ของตัวเองได้ทันทีในวันถัดไปโดยไม่มี Integration Blocker

---

## 2. สถานะเป้าหมายปลายวัน (Expected End State)

- คำสั่ง `docker compose up --build` สามารถสั่งเปิดบริการทั้งหมดได้ในคำสั่งเดียว
- Nginx สามารถพร็อกซีทราฟฟิกไปยัง NestJS API Instances 3 ตัวได้แบบ Round Robin / Least Connections
- NestJS API มี Health Endpoint (`GET /health`) ตอบกลับ `200 OK`
- Redis (Queue & Cache) ทำงานพร้อม Health Check ผ่าน
- PostgreSQL รัน Migration สร้างตาราง `products`, `orders` และใส่ Seed สินค้า 20 รายการ (รวม `p-1001` สต็อก 50) สำเร็จ
- BullMQ Worker สามารถเปิดขึ้นมาดึง Test Job จาก Queue ได้

---

## 3. แผนการทำงานขนานกัน (Parallel Work Plan)

| สมาชิก / บทบาท | ช่วงเช้า (09:00 - 12:00) | ช่วงบ่าย (13:00 - 17:30) |
| --- | --- | --- |
| **Integration Captain** | สแกฟโฟลด์ Monorepo Structure & Root `package.json` ([project-bootstrap.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day1/project-bootstrap.md)) | จัดทำ `compose.yaml` รวมบริการ Nginx, API x3, Worker, Redis, PostgreSQL ([docker-compose.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day1/docker-compose.md)) |
| **Member 1 (Edge/API)** | สร้าง NestJS API Skeleton App (`apps/api/`) และตั้งค่า Bootstrap ([api-nginx.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day1/api-nginx.md)) | คอนฟิก Nginx Reverse Proxy (`infra/nginx/`) ให้ Load Balance ไปยัง 3 API Instances |
| **Member 2 (Queue/Redis)** | สร้าง Shared Package `packages/queue` และ `packages/cache` ([queue-redis.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day1/queue-redis.md)) | ทดสอบการเชื่อมต่อ Redis และสร้าง BullMQ Test Producer/Consumer Skeleton |
| **Member 3 (Worker/DB)** | สร้าง Database Migration & Schema สำหรับ `products` และ `orders` ([worker-database.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day1/worker-database.md)) | เขียน Seed Script ใส่สินค้า 20 ชิ้น และสร้าง BullMQ Worker Skeleton App (`apps/worker/`) |

---

## 4. เส้นทางวิกฤต (Critical Path Analysis)

```text
[project-bootstrap] ──> [docker-compose setup] ──> [day1-integration-check]
        │
        ├──> [api-nginx] (Member 1) ───────────────┤
        ├──> [queue-redis] (Member 2) ─────────────┤
        └──> [worker-database] (Member 3) ─────────┘
```

> [!IMPORTANT]
> **Task ที่เป็น Critical Path คือ `project-bootstrap`** เนื่องจากเป็นโครงสร้าง Monorepo กลาง หากทำช้า สมาชิกคนอื่นจะไม่สามารถนำโค้ดไปวางใน `apps/` หรือ `packages/` ได้

---

## 5. การควบคุมไฟล์ส่วนกลาง (Shared Files Control)

ไฟล์ต่อไปนี้ถือเป็น **Shared Integration Files** ห้ามสมาชิกแก้ไขโดยไม่ได้รับอนุมัติจาก Integration Captain:
- `package.json` (Root)
- `pnpm-workspace.yaml`
- `compose.yaml` / `docker-compose.yml`
- `.env.example`
- `doc/contracts/**`

---

## 6. ประตูตรวจสอบการรวมระบบปลายวัน (End-of-Day Integration Gate)

เวลา 17:30 - 18:00 น. ทีมต้องร่วมกันรันสคริปต์ตรวจสอบความพร้อมตาม checklist ใน [day1-integration-check.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day1/day1-integration-check.md):

- [ ] `docker compose up --build -d` สำเร็จทุก Container
- [ ] `curl http://localhost/health` ตอบ 200 OK และกระจายเข้า API ทั้ง 3 ตัว
- [ ] PostgreSQL มีสินค้า `p-1001` พร้อมสต็อก 50 ในตาราง `products`
- [ ] BullMQ สามารถ enqueue และ consume test job สำเร็จ
