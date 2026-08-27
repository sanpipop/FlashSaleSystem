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

#### `DEC-006` — Micro-batched Pessimistic Row Locking (`place_order_batch`)
- **Status:** `ACCEPTED` | **Date:** 2026-08-26 | **Owners:** Team
- **Context:** ป้องกัน Race Condition เมื่อ Worker หลายตัวดึงงานสินค้าเดียวกันมาประมวลผลพร้อมกัน
- **Decision:** ใช้ `place_order_batch(jsonb)` รวม 10–32 Jobs, ตรวจ Durable Result และล็อก Product Row ด้วย `SELECT ... FOR UPDATE` หนึ่งครั้งต่อ Batch
- **Consequences:** ยัง Serialize Stock อย่างถูกต้องแต่ลด DB Round-trip; ค่า Batch เริ่ม 16 และต้อง Benchmark เทียบ 32

#### `DEC-007` — Redis Cache-Aside & Post-Commit Invalidation
- **Status:** `ACCEPTED` | **Date:** 2026-08-26 | **Owners:** Team
- **Context:** ต้องรองรับ Read Traffic ปริมาณสูง (`GET /products`) โดยไม่ทำให้ DB โหลดเกินไป
- **Decision:** ใช้ Versioned Cache-Aside + Single-Flight และ `INCR fs:cache:products:epoch` หลัง Commit พร้อม Transactional Outbox Retry
- **Consequences:** Invalidation O(1), ไม่ใช้ Wildcard DEL, ลด Cache Stampede และซ่อมตัวเองได้เมื่อ Redis ล่ม

#### `DEC-008` — Correctness Before Performance Optimization Policy
- **Status:** `ACCEPTED` | **Date:** 2026-08-26 | **Owners:** Team
- **Context:** ป้องกันการรีบเร่งทำ Optimization จนทำให้ข้อมูลเสียหาย
- **Decision:** การปรับแต่งประสิทธิภาพใดๆ ที่ทำให้ Invariants เสีย จะถูกปฏิเสธเป็น `INVALID RESULT` และสั่ง `REVERT` ทันที
- **Consequences:** ทีมต้องทดสอบ Correctness ให้ผ่านก่อนนำผล Benchmark ไปอ้างอิง

---

#### `DEC-009` — Durable Result Ledger and Transactional Outbox
- **Status:** `ACCEPTED` | **Date:** 2026-08-26 | **Owners:** Member 3
- **Decision:** เพิ่ม `order_results(job_id PRIMARY KEY)` และ `transactional_outbox` ใน Transaction เดียวกับ Order/Stock
- **Consequences:** Worker Retry ปลอดภัยและ Cache Invalidation ไม่สูญหายหลัง DB Commit

#### `DEC-010` — Physical Redis Separation
- **Status:** `ACCEPTED` | **Date:** 2026-08-26 | **Owners:** Member 2
- **Decision:** แยก Redis Operations (`noeviction`, AOF) และ Redis Cache (`allkeys-lru`) เป็นคนละ Container
- **Consequences:** Cache Eviction/Traffic ไม่กระทบ BullMQ และใช้งบ RAM รวมตาม Architecture

### 3.2 กลุ่มข้อตกลงที่ต้องตัดสินด้วยผลการรัน Benchmark (BENCHMARK-DRIVEN DECISIONS)

#### `DEC-011` — Optimal API Container Instance Count (3 vs 4 Instances)
- **Status:** `BENCHMARK-DRIVEN` | **Date:** 2026-08-26 | **Owners:** Member 1
- **Options:** 3 Instances (Baseline) vs 4 Instances
- **Decision Rule:** เลือกจำนวนที่ให้ RPS สูงสุดและ p95 Latency ต่ำสุด โดยไม่เกิด CPU Context Switching Saturation บน 4 vCPU VM

#### `DEC-012` — BullMQ Worker Concurrency Level Tuning
- **Status:** `BENCHMARK-DRIVEN` | **Date:** 2026-08-26 | **Owners:** Member 2
- **Options:** Concurrency 8 vs 12 vs 16 และ Batch Size 16 vs 32
- **Decision Rule:** เลือกค่าที่ลด Queue Drain Time ได้มากที่สุด โดยไม่ทำให้เกิด DB Lock Wait Timeout

#### `DEC-013` — PostgreSQL Connection Pool Size Adjustment
- **Status:** `BENCHMARK-DRIVEN` | **Date:** 2026-08-26 | **Owners:** Member 3
- **Options:** Pool รวม 24 vs 28 vs 32 ภายใต้ PostgreSQL `max_connections` 35–40
- **Decision Rule:** เลือกค่าที่สัมพันธ์กับจำนวน API + Worker โดยไม่เกิด DB Connection Exhaustion

---

### 3.3 ข้อตกลงพฤติกรรม HTTP ที่ Freeze แล้ว

#### `DEC-015` — Duplicate Admission HTTP Response Policy
- **Status:** `ACCEPTED` | **Date:** 2026-08-26 | **Owners:** Member 1, 2
- **Decision:** คำขอซ้ำที่อ้าง Logical Order เดิมให้ตอบ `202 Accepted` และคืน deterministic `orderJobId` เดิมแบบ Idempotent; ห้ามสื่อว่าซื้อสำเร็จแล้ว
- **Consequences:** Load script ได้ Contract คงที่และ Client Retry ไม่ถูกนับเป็น HTTP error ขณะที่ PostgreSQL ยังเป็นผู้ตัดสินผลจริง

---

## 4. ตารางสรุปสถานะการตัดสินใจทั้งหมด (Decision Summary Table)

| ID | Title / Summary | Status | Primary Owner | References / Source |
| --- | --- | --- | --- | --- |
| `DEC-001` | Single VM Deployment with Docker Compose | `ACCEPTED` | Team | [architecture.md](file:///FlashSaleSystem/doc/architecture/architecture.md) |
| `DEC-002` | NestJS Framework for Stateless API & Worker | `ACCEPTED` | Team | [architecture.md](file:///FlashSaleSystem/doc/architecture/architecture.md) |
| `DEC-003` | PostgreSQL as Persistent Source of Truth | `ACCEPTED` | Member 3 | [database-contract.md](file:///FlashSaleSystem/doc/contracts/database-contract.md) |
| `DEC-004` | Async Order Admission with `202 Accepted` | `ACCEPTED` | Member 1 | [api-contract.md](file:///FlashSaleSystem/doc/contracts/api-contract.md) |
| `DEC-005` | Database Final Protection Constraints | `ACCEPTED` | Member 3 | [database-contract.md](file:///FlashSaleSystem/doc/contracts/database-contract.md) |
| `DEC-006` | Micro-batched Pessimistic Locking | `ACCEPTED` | Member 3 | [concurrency-and-idempotency.md](file:///FlashSaleSystem/doc/architecture/concurrency-and-idempotency.md) |
| `DEC-007` | Redis Product Cache-Aside & Invalidation | `ACCEPTED` | Member 2 | [cache-strategy.md](file:///FlashSaleSystem/doc/architecture/cache-strategy.md) |
| `DEC-008` | Correctness Before Performance Policy | `ACCEPTED` | Team | [baseline.md](file:///FlashSaleSystem/doc/performance/baseline.md) |
| `DEC-009` | Durable Result Ledger + Transactional Outbox | `ACCEPTED` | Member 3 | [database-contract.md](file:///FlashSaleSystem/doc/contracts/database-contract.md) |
| `DEC-010` | Physical Redis Separation | `ACCEPTED` | Member 2 | [redis-contract.md](file:///FlashSaleSystem/doc/contracts/redis-contract.md) |
| `DEC-011` | Optimal API Container Instance Count | `BENCHMARK-DRIVEN` | Member 1 | [performance-tuning.md](file:///FlashSaleSystem/doc/task/day5/performance-tuning.md) |
| `DEC-012` | BullMQ Worker Concurrency Level | `BENCHMARK-DRIVEN` | Member 2 | [performance-tuning.md](file:///FlashSaleSystem/doc/task/day5/performance-tuning.md) |
| `DEC-013` | PostgreSQL Connection Pool Size | `BENCHMARK-DRIVEN` | Member 3 | [performance-tuning.md](file:///FlashSaleSystem/doc/task/day5/performance-tuning.md) |
| `DEC-015` | Duplicate Admission Response Policy | `ACCEPTED` | Member 1 | [api-contract.md](file:///FlashSaleSystem/doc/contracts/api-contract.md) |
