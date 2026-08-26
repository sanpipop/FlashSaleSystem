# ยุทธศาสตร์การทดสอบระบบ (Flash Sale System — Testing Strategy)

**วันที่อัปเดต:** 26 สิงหาคม 2026  
**สถานะ:** FROZEN TESTING SOURCE OF TRUTH (Phase 7)  
**ขอบเขตโปรเจกต์:** ยุทธศาสตร์การทดสอบความถูกต้องของระบบทุกระดับ (ทุกสมาชิกในทีม)

---

## 1. วัตถุประสงค์ (Purpose)

เอกสารฉบับนี้เป็น **ยุทธศาสตร์การทดสอบความถูกต้องของระบบ (Testing Strategy Source of Truth)** จัดทำขึ้นเพื่อกำหนดกรอบการทดสอบระบบทุกระดับ (Static Checks, Unit, Integration, Concurrency, E2E, Smoke, Regression) เพื่อพิสูจน์ความถูกต้องของฟังก์ชันธุรกิจ (Functional Correctness) และความปลอดภัยจากการทำงานขนาน (Concurrency Safety) ก่อนเริ่มกระบวนการยิงทดสอบโหลดใน Phase 4-5

---

## 2. ปรัชญาการทดสอบ (Testing Philosophy)

ยุทธศาสตร์การทดสอบยึดหลักการสร้างความมั่นใจเป็นลำดับขั้น (Incremental Confidence Sequence):

> **Static Checks → Unit Tests → Component Contract Tests → Integration Tests → Concurrency Correctness Tests → End-to-End Tests → Smoke Tests → Baseline Load → Performance Tuning → Final Benchmark**

> [!WARNING]
> **Correctness Gate Before Performance**  
> ห้ามสรุปว่าระบบใช้งานได้ดีเพียงเพราะการยิง k6 ไม่ทำให้ Server ล่ม (No Crash) การทดสอบความถูกต้อง (Correctness Testing) ต้องผ่าน 100% ก่อนจึงจะถือว่าระบบพร้อมสำหรับการวัดผลประสิทธิภาพ (Performance Testing)

---

## 3. เงื่อนไขความถูกต้องบังคับที่ห้ามผิดพลาด (Non-Negotiable Correctness Invariants)

1. **Non-Negative Stock:** สต็อกคงเหลือใน PostgreSQL ต้องไม่ติดลบเด็ดขาด (`remainingStock >= 0`)
2. **Limit 1 Success Per User Per Product:** ผู้ใช้ 1 คนสั่งซื้อสินค้าชิ้นเดียวกันสำเร็จได้ไม่เกิน 1 ครั้ง (`successfulOrders(userId, productId) <= 1`)
3. **Multi-Product Allowed:** ผู้ใช้ 1 คนสามารถสั่งซื้อสินค้าต่างประเภทกันได้ (`user-001 + p-1001 = success` และ `user-001 + p-1002 = success`)
4. **Flash Sale Active Rule:** สินค้าที่ `isFlashSaleActive = false` ต้องไม่สามารถเกิดคำสั่งซื้อ Flash Sale ที่สำเร็จได้
5. **Exact Competition Target (p-1001):** สินค้า `p-1001` (สต็อก 50) หลังยิงแข่ง จะต้องได้ `remainingStock = 0`, `successful orders = 50`, `distinct successful users = 50`, `duplicate successful orders = 0`

---

## 4. เมทริกซ์สภาพแวดล้อมการทดสอบ (Test Environment Matrix)

| สภาพแวดล้อม (Environment) | วัตถุประสงค์การใช้งาน | ประเภทการทดสอบที่อนุญาต | Tooling & Constraints |
| --- | --- | --- | --- |
| **Local Developer Machine** | ทดสอบ Unit & Component Logic | Unit Tests, Static Checks | Node.js, pnpm, Jest |
| **GitHub Actions CI** | ตรวจสอบคุณภาพโค้ดอัตโนมัติ | Lint, Typecheck, Unit, Integration | Automated Workflow (`ci.yml`) |
| **Team Target VM** | ทดสอบการทำงานร่วมกันและ Concurrency | Integration, Concurrency, E2E, Smoke | Docker Compose (4 vCPU, 6GB) |
| **External Load Generator** | ยิงทดสอบโหลดเพื่อแข่งขัน | Baseline & Final k6 Load Benchmark | k6 CLI / Container ภายนอก VM |

---

## 5. การแบ่งขอบเขตรับผิดชอบการทดสอบ (Test Ownership)

- **Member 1 (API / Edge Lead):** พัฒนาและรัน Test ฝั่ง API (`apps/api/`), JWT Authentication, Products API, Orders API Admission และ k6 Load Test Scenarios
- **Member 2 (Queue / Cache Lead):** พัฒนาและรัน Test ฝั่ง Redis Operations (`packages/cache/`), BullMQ Queue (`packages/queue/`), Atomic Claim Guard, Product Cache-Aside, Cache Invalidation และ Bull Board Dashboard UI
- **Member 3 (Worker / DB Lead):** พัฒนาและรัน Test ฝั่ง PostgreSQL (`database/`), TypeORM Migrations, BullMQ Worker Consumer (`apps/worker/`), Transaction & Pessimistic Lock (`SELECT FOR UPDATE`), Database Constraints และ Data Integrity Verification Queries

---

## 6. ลำดับชั้นของการทดสอบ (Testing Levels & Details)

### 6.1 Static Quality Checks
- **คำสั่งที่รัน:** `pnpm lint`, `pnpm typecheck`
- **เป้าหมาย:** ตรวจสอบ Syntax, Code Style และ Type Safety ก่อนสร้าง Container

### 6.2 Unit Tests
- **ขอบเขต:** ฟังก์ชันเดี่ยว (Isolated Logic) เช่น JWT Generation/Verification, Cache Key Calculation, Job ID Hashing, DTO Validation
- **ข้อจำกัด:** Unit Test ไม่สามารถใช้พิสูจน์ Race Condition ข้ามบริการได้

### 6.3 Component & API Contract Tests
- **ขอบเขต:** ทดสอบ Endpoints ตาม [api-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/api-contract.md)
- **Scenarios:**
  - `POST /api/v1/auth/token`: Valid user -> 200 + JWT; Missing body -> 400 Bad Request
  - `GET /api/v1/products`: Page 1 limit 10 -> 200 + Pagination metadata; Invalid page -> 400
  - `POST /api/v1/orders`: Valid JWT + Payload -> 202 Accepted + `orderJobId`; Missing JWT -> 401 Unauthorized

### 6.4 Concurrency & Race Condition Correctness Tests (P0 Tests)
- **Scenario A (Stock = 1 Race):** ตั้งสต็อกสินค้าเท่ากับ 1 ชิ้น ยิงสั่งซื้อพร้อมกันด้วย 50 Users ผลที่ได้ต้องสร้าง Order สำเร็จ 1 รายการ สต็อกคงเหลือเท่ากับ 0
- **Scenario B (Same User Duplicate Burst):** ผู้ใช้คนเดียวกันยิงสั่งซื้อสินค้าเดิมพร้อมกัน 50 คำขอ ผลที่ได้ต้องสร้าง Order สำเร็จไม่เกิน 1 รายการ
- **Scenario C (Stock = 50 Competition):** สินค้าสต็อก 50 ชิ้น ยิงพร้อมกันด้วย 500 Users ผลที่ได้ต้องสร้าง Order สำเร็จ 50 รายการ และผู้ใช้ 50 คนไม่ซ้ำกัน

### 6.5 Smoke Tests & Integration Tests
- **คำสั่งที่รัน:** `bash scripts/smoke-test.sh` และ `pnpm test:integration`
- **เป้าหมาย:** ตรวจสอบความพร้อมของ Container ทั้งหมด (Nginx, API x3, Redis, Worker, PostgreSQL) ก่อนเริ่มยิง k6

---

## 7. ตารางเมทริกซ์ชุดการทดสอบหลัก (Core Test Case Matrix Table)

| Test ID | Test Case Name | Target Layer | Key Verification Rule | Priority | Owner |
| --- | --- | --- | --- | --- | --- |
| **TEST-001** | JWT Token Generation & Guard | API / Auth | Valid JWT returns 200, Protected endpoint requires Bearer token | P0 | Member 1 |
| **TEST-002** | Products Pagination & Schema | API / Product | Returns 200 with `camelCase` DTO and pagination metadata | P0 | Member 1 |
| **TEST-003** | Orders Admission Async Flow | API / Queue | Valid request enqueues job and returns `202 Accepted` | P0 | Member 1 |
| **TEST-004** | Atomic Claim Guard (`SET NX`) | Redis / Queue| Same user + product claim winner is exactly 1 request | P0 | Member 2 |
| **TEST-005** | Product Cache-Aside Hit/Miss | Redis / Cache| 1st GET = Miss & populate DB, 2nd GET = Hit from Redis | P1 | Member 2 |
| **TEST-006** | Post-Commit Cache Invalidation | Worker / Cache| Invalidation signal deletes cache after DB Commit | P1 | Member 2 |
| **TEST-007** | Worker Tx & Pessimistic Lock | Worker / DB | `SELECT FOR UPDATE` prevents stock race condition | P0 | Member 3 |
| **TEST-008** | Database `UNIQUE` Constraint | DB Engine | Rejects duplicate `(user_id, product_id)` at DB level | P0 | Member 3 |
| **TEST-009** | Database `CHECK` Non-Negative | DB Engine | Database rejects any transaction that makes stock < 0 | P0 | Member 3 |
| **TEST-010** | Stock = 1 Race Condition Test | Concurrency | 50 concurrent buyers on stock=1 yields exactly 1 order | P0 | Member 3 |
| **TEST-011** | Same User Duplicate Burst Test | Concurrency | 50 concurrent requests from same user yields <= 1 order | P0 | Member 2, 3 |
| **TEST-012** | Same User Multi-Product Test | Concurrency | User can buy `p-1001` and `p-1002` independently | P1 | Member 1, 3 |
| **TEST-013** | Flash Sale Inactive Product Test| Business Logic| Inactive sale product returns rejection without stock reduction | P1 | Member 3 |
| **TEST-014** | Sold-Out Rejection Test | Business Logic| Order on stock=0 is rejected without DB lock deadlock | P1 | Member 3 |
| **TEST-015** | Nginx Multi-Instance Balancing | Nginx / API | Traffic distributed across 3 NestJS API instances | P1 | Member 1 |

---

## 8. รายการตรวจสอบความถูกต้องก่อนเริ่มทดสอบโหลด (Pre-Performance Correctness Gate)

ก่อนที่ทีมจะอนุญาตให้เริ่มยิง k6 Load Benchmark ใน Phase 4-5 รายการต่อไปนี้ต้องผ่าน 100%:

- [ ] คำสั่ง `pnpm lint` และ `pnpm typecheck` ผ่านโดยไม่มีข้อผิดพลาด
- [ ] คำสั่ง `pnpm test:integration` ผ่าน 100% (Green)
- [ ] สคริปต์ `bash scripts/smoke-test.sh` รันผ่านครบทุก Endpoint
- [ ] ชุดการทดสอบ Concurrency (`TEST-010`, `TEST-011`) ผ่านการพิสูจน์ว่าไม่มีสต็อกติดลบและซื้อซ้ำ
- [ ] ผลการรัน SQL/Retry Verification แสดงความถูกต้องตามเงื่อนไข 8 ข้อ รวม Result Ledger และ Retry Idempotency

---

## 9. นโยบายจัดการการทดสอบที่ไม่เสถียร (Flaky Test Policy)

1. **No Arbitrary Sleep Rule:** ห้ามใช้คำสั่ง `sleep` หน่วงเวลารอคิวโดยเด็ดขาด ให้ใช้การตรวจสอบสถานะแบบ Explicit Bounded Timeout (เช่น สั่ง Poll ดู Queue Active/Waiting count จนกว่าจะเท่ากับ 0)
2. **Deterministic Test Isolation:** การทดสอบทุกตัวต้องทำการรีเซ็ตข้อมูลผ่าน `scripts/reset-db.sh` เพื่อไม่ให้มีข้อมูลตกค้างข้ามการทดสอบ
3. **Flaky Investigation Requirement:** หากพบ Test ที่ผลลัพธ์ไม่สม่ำเสมอ ห้ามกด rerun ให้ผ่านแล้วมองข้าม ต้องเปิด Issue ตรวจสอบสาเหตุทันที
