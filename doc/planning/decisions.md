# บันทึกการตัดสินใจของโปรเจกต์ (Project Decision Log)

**วันที่อัปเดต:** 26 สิงหาคม 2026  
**สถานะ:** FROZEN PLANNING SOURCE OF TRUTH (Phase 5)  
**ขอบเขตโปรเจกต์:** รวบรวมข้อตกลงและบันทึกการตัดสินใจทางสถาปัตยกรรม เทคโนโลยี และนโยบายการประมวลผล (ทุกสมาชิกในทีม)

---

## 1. วัตถุประสงค์ (Purpose)

เอกสารฉบับนี้จัดทำขึ้นเพื่อเป็น **สมุดบันทึกการตัดสินใจของโปรเจกต์ (Project Decision Log / Lightweight ADR)** สำหรับรวบรวมข้อตกลงที่ทีมพัฒนาได้ตัดสินใจยอมรับแล้ว (`ACCEPTED`), ข้อตกลงที่ต้องตัดสินใจด้วยผลการรัน Benchmark (`BENCHMARK-DRIVEN`) และข้อตกลงที่ยังคงอยู่ระหว่างการพิจารณา (`PENDING`) เพื่อให้สมาชิกทุกคนและ AI Agent อ้างอิงได้จากจุดเดียวกัน

---

## 2. สถานะของการตัดสินใจ (Decision Status Convention)

- **`ACCEPTED`:** ทีมตกลงยอมรับและเลือกใช้เป็นข้อกำหนดมาตรฐานเรียบร้อยแล้ว
- **`BENCHMARK-DRIVEN`:** ห้ามตัดสินใจจากความรู้สึก ต้องรอวัดผลตัวเลขจริงจากการทดสอบ k6 Benchmark ใน Phase 4-5
- **`PENDING`:** อยู่ในระหว่างรอการพิจารณาหรือรอมติตกลงในทีม
- **`REJECTED` / `SUPERSEDED`:** ข้อเสนอที่ถูกปฏิเสธหรือไม่ใช้แล้ว

---

## 3. รายการการตัดสินใจหลัก (Key Decision Log Entries)

### 3.1 กลุ่มข้อตกลงที่ยอมรับแล้ว (ACCEPTED DECISIONS)

#### `DEC-001` — Single VM Deployment with Docker Compose
- **Status:** `ACCEPTED` | **Date:** 2026-08-26 | **Owners:** Team
- **Context:** โปรเจกต์ได้รับ VM 1 เครื่อง (4 vCPU, RAM 6 GB, Disk 50 GB) สำหรับรันระบบระบบทั้งหมด
- **Decision:** รันบริการทั้งหมด (Nginx, API x3, Worker, Redis, PostgreSQL) ผ่าน **Docker Compose** ภายใน VM เดียวกัน
- **Consequences:** ต้องควบคุมการใช้ CPU/RAM ของทุก Container ไม่ให้เกิน 6 GB และไม่เพิ่ม Microservices เกินจำเป็น

#### `DEC-002` — NestJS Framework for Stateless API & Worker
- **Status:** `ACCEPTED` | **Date:** 2026-08-26 | **Owners:** Team
- **Context:** ต้องการ Framework ที่มี Modular Architecture ปลอดภัย และขยายตัวได้ง่าย
- **Decision:** ใช้ **NestJS** สำหรับพัฒนา API และ Worker โดยทำตัวเป็น Stateless 100% อ่าน User Identity จาก JWT
- **Consequences:** สมาชิกต้องปฏิบัติตาม NestJS Modular Structure (`apps/api`, `apps/worker`)

#### `DEC-003` — PostgreSQL as Persistent Source of Truth
- **Status:** `ACCEPTED` | **Date:** 2026-08-26 | **Owners:** Team
- **Context:** ต้องเลือกศูนย์กลางความจริงสัมบูรณ์สำหรับสต็อกคงเหลือและประวัติการสั่งซื้อ
- **Decision:** ให้ **PostgreSQL เป็นเพียงผู้เดียวที่ถือสิทธิ์ Persistent Source of Truth** ข้อมูลใน Redis ทำหน้าที่เป็นเพียง Read Replica หรือ Temporary Guard ชั่วคราวเท่านั้น
- **Consequences:** การตัดสินผลสั่งซื้อสำเร็จต้องผ่านการ COMMIT ใน PostgreSQL เท่านั้น

#### `DEC-004` — Asynchronous Order Admission with `202 Accepted`
- **Status:** `ACCEPTED` | **Date:** 2026-08-26 | **Owners:** Team
- **Context:** การตัดสต็อกใน Database ใช้เวลานาน หากทำแบบ Synchronous จะทำให้ API Latency สูง
- **Decision:** API จะรับคำขอ Enqueue งานเข้า BullMQ แล้วตอบ `202 Accepted` ทันที โดยแยกขั้นตอน Worker ตัดสต็อกไปทำแบบ Asynchronous
- **Consequences:** `202 Accepted` หมายถึง "รับงานเข้าคิวสำเร็จ" ยังไม่ได้หมายความว่าสั่งซื้อสำเร็จ 100%

#### `DEC-005` — Database-Level Final Protection Constraints
- **Status:** `ACCEPTED` | **Date:** 2026-08-26 | **Owners:** Team
- **Context:** ต้องป้องกันการซื้อซ้ำและการเกิดสต็อกติดลบอย่างถาวร
- **Decision:** เพิ่ม `UNIQUE(user_id, product_id)` ในตาราง `orders` และ `CHECK(remaining_stock >= 0)` ในตาราง `products`
- **Consequences:** PostgreSQL Engine จะปฏิเสธ Transaction ที่ผิดเงื่อนไขโดยอัตโนมัติ การันตี Zero Overselling

#### `DEC-006` — Pessimistic Row Locking (`SELECT FOR UPDATE`)
- **Status:** `ACCEPTED` | **Date:** 2026-08-26 | **Owners:** Team
- **Context:** ป้องกัน Race Condition เมื่อ Worker หลายตัวดึงงานสินค้าเดียวกันมาประมวลผลพร้อมกัน
- **Decision:** ใช้ Pessimistic Row Lock (`SELECT ... FOR UPDATE`) บนแถวสินค้าที่กำลังตัดสต็อกภายใต้ DB Transaction
- **Consequences:** การประมวลผลตัดสต็อกสินค้าเดียวกันจะถูกเรียงคิวทำทีละรายการ การันตี Data Correctness 100%

#### `DEC-007` — Redis Cache-Aside & Post-Commit Invalidation
- **Status:** `ACCEPTED` | **Date:** 2026-08-26 | **Owners:** Team
- **Context:** ต้องรองรับ Read Traffic ปริมาณสูง (`GET /products`) โดยไม่ทำให้ DB โหลดเกินไป
- **Decision:** ใช้ Redis Cache-Aside Pattern สำหรับหน้าสินค้า และล้างแคช (`DEL fs:cache:products:*`) เฉพาะหลัง DB Commit สำเร็จ
- **Consequences:** ลดภาระ DB อ่าน และป้องกันปัญหา Race Condition จากการล้างแคชก่อน DB Commit

#### `DEC-008` — Correctness Before Performance Optimization Policy
- **Status:** `ACCEPTED` | **Date:** 2026-08-26 | **Owners:** Team
- **Context:** ป้องกันการรีบเร่งทำ Optimization จนทำให้ข้อมูลเสียหาย
- **Decision:** การปรับแต่งประสิทธิภาพใดๆ ที่ทำให้ Invariants เสีย จะถูกปฏิเสธเป็น `INVALID RESULT` และสั่ง `REVERT` ทันที
- **Consequences:** ทีมต้องทดสอบ Correctness ให้ผ่านก่อนนำผล Benchmark ไปอ้างอิง

---

### 3.2 กลุ่มข้อตกลงที่ต้องตัดสินด้วยผลการรัน Benchmark (BENCHMARK-DRIVEN DECISIONS)

#### `DEC-011` — Optimal API Container Instance Count (3 vs 4 Instances)
- **Status:** `BENCHMARK-DRIVEN` | **Date:** 2026-08-26 | **Owners:** Member 1
- **Options:** 3 Instances (Baseline) vs 4 Instances
- **Decision Rule:** เลือกจำนวนที่ให้ RPS สูงสุดและ p95 Latency ต่ำสุด โดยไม่เกิด CPU Context Switching Saturation บน 4 vCPU VM

#### `DEC-012` — BullMQ Worker Concurrency Level Tuning
- **Status:** `BENCHMARK-DRIVEN` | **Date:** 2026-08-26 | **Owners:** Member 2
- **Options:** Concurrency 10 vs 20 vs 30
- **Decision Rule:** เลือกค่าที่ลด Queue Drain Time ได้มากที่สุด โดยไม่ทำให้เกิด DB Lock Wait Timeout

#### `DEC-013` — PostgreSQL Connection Pool Size Adjustment
- **Status:** `BENCHMARK-DRIVEN` | **Date:** 2026-08-26 | **Owners:** Member 3
- **Options:** Pool Size 15 vs 30 vs 45
- **Decision Rule:** เลือกค่าที่สัมพันธ์กับจำนวน API + Worker โดยไม่เกิด DB Connection Exhaustion

---

### 3.3 กลุ่มข้อตกลงที่รอการพิจารณา (PENDING DECISIONS)

#### `DEC-015` — Duplicate Admission HTTP Response Policy
- **Status:** `PENDING` | **Date:** 2026-08-26 | **Owners:** Member 1, 2
- **Options:** Option A (ตอบ `202 Accepted` คืน Job ID เดิม) vs Option B (ตอบ `409 Conflict`)
- **Revisit When:** สรุปใน Day 2 ก่อนรวมระบบ

#### `DEC-016` — Physical Redis Separation (Shared vs Separate Ports 6379/6380)
- **Status:** `PENDING` | **Date:** 2026-08-26 | **Owners:** Member 2
- **Options:** Single Redis Container vs 2 Separate Containers (Port 6379 สำหรับ Queue, Port 6380 สำหรับ Cache)
- **Revisit When:** ทดลองใน Day 5 หากพบ Redis Memory/IO Bottleneck

---

## 4. ตารางสรุปสถานะการตัดสินใจทั้งหมด (Decision Summary Table)

| ID | Title / Summary | Status | Primary Owner | References / Source |
| --- | --- | --- | --- | --- |
| `DEC-001` | Single VM Deployment with Docker Compose | `ACCEPTED` | Team | [architecture.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/architecture.md) |
| `DEC-002` | NestJS Framework for Stateless API & Worker | `ACCEPTED` | Team | [architecture.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/architecture.md) |
| `DEC-003` | PostgreSQL as Persistent Source of Truth | `ACCEPTED` | Member 3 | [database-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/database-contract.md) |
| `DEC-004` | Async Order Admission with `202 Accepted` | `ACCEPTED` | Member 1 | [api-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/api-contract.md) |
| `DEC-005` | Database Final Protection Constraints | `ACCEPTED` | Member 3 | [database-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/database-contract.md) |
| `DEC-006` | Pessimistic Row Locking (`SELECT FOR UPDATE`) | `ACCEPTED` | Member 3 | [concurrency-and-idempotency.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/concurrency-and-idempotency.md) |
| `DEC-007` | Redis Product Cache-Aside & Invalidation | `ACCEPTED` | Member 2 | [cache-strategy.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/cache-strategy.md) |
| `DEC-008` | Correctness Before Performance Policy | `ACCEPTED` | Team | [baseline.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/performance/baseline.md) |
| `DEC-011` | Optimal API Container Instance Count | `BENCHMARK-DRIVEN` | Member 1 | [performance-tuning.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day5/performance-tuning.md) |
| `DEC-012` | BullMQ Worker Concurrency Level | `BENCHMARK-DRIVEN` | Member 2 | [performance-tuning.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day5/performance-tuning.md) |
| `DEC-013` | PostgreSQL Connection Pool Size | `BENCHMARK-DRIVEN` | Member 3 | [performance-tuning.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day5/performance-tuning.md) |
| `DEC-015` | Duplicate Admission Response Policy | `PENDING` | Member 1 | [api-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/api-contract.md) |
| `DEC-016` | Physical Redis Separation (Port 6379/6380) | `PENDING` | Member 2 | [redis-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/redis-contract.md) |
