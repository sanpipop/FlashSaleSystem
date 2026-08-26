# โครงร่างรายงานสรุปผลการดำเนินงานโครงการ (Final Report Outline)

**วันที่อัปเดต:** 26 สิงหาคม 2026  
**สถานะ:** PREPARATION FRAMEWORK (Phase 6)  
**ขอบเขตโปรเจกต์:** โครงร่างเนื้อหารายละเอียดสำหรับจัดทำรายงานสรุปผลโครงการ Flash Sale System (Final Report PDF)

---

## 1. วัตถุประสงค์ (Purpose)

เอกสารฉบับนี้เป็น **โครงร่างเนื้อหารายงานฉบับสมบูรณ์ (Final Report Outline Framework)** จัดทำขึ้นเพื่อกำหนดโครงสร้างบทเรียน ลำดับการเล่าเรื่อง (Narrative Flow) ตาราง รูปภาพ และการเชื่อมโยงหลักฐานเชิงประจักษ์ (Evidence Mapping) เพื่อให้สมาชิกในทีมสามารถนำไปเขียนเป็นรายงานฉบับจริง (Final PDF/Document) ได้ทันทีโดยไม่ต้องเสียเวลารื้อค้นข้อมูลในคืนก่อนวันส่งมอบงาน

---

## 2. ตารางสอบทานความสัมพันธ์ของข้อกำหนด (Requirement Traceability Table)

| Assignment Requirement | Target Implementation Area | Primary Report Section | Evidence ID |
| --- | --- | --- | --- |
| **Nginx Reverse Proxy & 3+ API Instances** | `infra/nginx/`, `apps/api/` | Section 3 — สถาปัตยกรรมระบบ | EVD-002, EVD-003 |
| **Stateless JWT Authentication** | `apps/api/src/auth/` | Section 4 — API & Authentication | EVD-004 |
| **Products Read API & Pagination** | `apps/api/src/products/` | Section 4 — API & Authentication | EVD-005 |
| **Async Orders Admission (202 Accepted)** | `apps/api/src/orders/` | Section 6 — Async Order Processing | EVD-006 |
| **Redis Product Cache-Aside & Invalidation** | `packages/cache/` | Section 5 — การออกแบบ Cache | EVD-007, EVD-008 |
| **BullMQ Queue & Atomic Claim Guard** | `packages/queue/` | Section 6, 7 — Concurrency | EVD-009, EVD-010 |
| **PostgreSQL Transaction & Row Locking** | `apps/worker/`, `database/` | Section 8 — Database & Integrity | EVD-011, EVD-012 |
| **Bull Board Dashboard UI** | `@bull-board/nestjs` | Section 9 — Observability | EVD-010 |
| **k6 Load Testing & Baseline Metrics** | `k6/` | Section 10, 11 — Baseline Benchmark | EVD-017 |
| **Bottleneck Analysis & Single-Variable Tuning**| `doc/performance/` | Section 12, 13 — Tuning Experiments | EVD-018 |
| **Final Performance Competition Results** | `doc/performance/final-results.md` | Section 14 — Final Performance | EVD-019 |
| **Data Integrity Proof (Stock 0, Orders 50)** | Database Verification Queries | Section 15 — Integrity Verification | EVD-012..EVD-015 |
| **Cross-Team Benchmark Comparison** | Comparative Load Test | Section 16 — Cross-Team Comparison | EVD-020 |
| **Team Responsibilities & Ownership** | `doc/planning/team-ownership.md` | Section 18 — การแบ่งหน้าที่สมาชิก | EVD-001 |

---

## 3. โครงสร้างเนื้อหารายงานฉบับสมบูรณ์ (20 Sections Outline)

### บทที่ 1: บทนำ (Introduction)
- **1.1 ที่มาและความสำคัญ:** ปัญหาของระบบ Flash Sale เมื่อมีทราฟฟิกยิงเข้ามาแย่งซื้อสินค้าพร้อมกันจำนวนมาก (Read Heavy + Write Heavy Peak)
- **1.2 ความท้าทายทางวิศวกรรม:** การสร้างระบบที่มี Throughput สูง Latency ต่ำ โดยคงความถูกต้องของสต็อกสินค้า (Zero Overselling)

### บทที่ 2: วัตถุประสงค์และข้อกำหนดระบบ (Objectives & Requirements)
- **2.1 วัตถุประสงค์หลัก:** พัฒนาระบบ Backend รองรับทราฟฟิก Flash Sale ภายใต้ข้อจำกัด VM 4 vCPU, 6 GB RAM
- **2.2 ข้อกำหนดเชิงฟังก์ชัน (Functional Requirements):** 3 Required Endpoints (`POST /auth/token`, `GET /products`, `POST /orders`)
- **2.3 ข้อกำหนดเชิงไม่ใช้ฟังก์ชัน (Non-Functional Requirements):** Latency p95 ต่ำ, High Cache Hit Ratio, Data Integrity 100%

### บทที่ 3: สถาปัตยกรรมระบบภาพรวม (Overall System Architecture)
- **3.1 แผนผังแสดงสถาปัตยกรรม (Architecture Diagram):** การเชื่อมต่อ Client (k6) -> Nginx (Port 80) -> API x3 -> Redis (Cache/Queue) -> Worker -> PostgreSQL
- **3.2 เหตุผลในการเลือกใช้เทคโนโลยี (Tech Stack Rationale):** NestJS, PostgreSQL 16, Redis, BullMQ, Nginx, Docker Compose

### บทที่ 4: การออกแบบ API และระบบยืนยันตัวตน (API Design & Authentication)
- **4.1 RESTful HTTP API Specifications:** รายละเอียดอินเทอร์เฟซตาม `api-contract.md`
- **4.2 Stateless JWT Authentication Mechanism:** การออก Access Token และการตรวจสอบ Token โดยไม่ต้องคิวรี DB

### บทที่ 5: การออกแบบระบบแคชอ่านสินค้า (Cache Strategy)
- **5.1 Cache-Aside Pattern Implementation:** ขั้นตอนการอ่านข้อมูลจาก Redis และ Fallback ไป DB
- **5.2 Post-Commit Cache Invalidation Strategy:** การสั่งลบแคช (`DEL fs:cache:products:*`) เฉพาะหลัง DB Transaction Commit สำเร็จเพื่อป้องกัน Race Condition

### บทที่ 6: การประมวลผลคำสั่งซื้อแบบไม่พร้อมกัน (Asynchronous Order Processing)
- **6.1 Async Admission Concept:** เหตุผลที่ API ตอบ `202 Accepted` พร้อม `orderJobId` ทันทีหลัง Enqueue
- **6.2 BullMQ Queue Architecture:** โครงสร้าง Queue `orders`, Job Options (Retry Policy, Backoff)

### บทที่ 7: การจัดการความซ้ำซ้อนและการแข่งขัน (Concurrency & Idempotency)
- **7.1 Multi-Layer Defense Architecture:** ด่านป้องกัน 4 ชั้น (API Atomic Claim -> Queue Job ID -> Worker Tx -> DB Constraint)
- **7.2 Atomic Claim Admission Guard:** การใช้ `SET fs:claim:order:{userId}:{productId} 1 EX 60 NX` ป้องกันการ Enqueue คำขอซ้ำ

### บทที่ 8: การออกแบบฐานข้อมูลและความถูกต้องของข้อมูล (Database Design & Stock Integrity)
- **8.1 Entity Relationship Diagram & Schema Constraints:** ตาราง `products` และ `orders` พร้อม `CHECK(remaining_stock >= 0)` และ `UNIQUE(user_id, product_id)`
- **8.2 Transaction & Pessimistic Row Locking:** การใช้ `SELECT FOR UPDATE` บนแถวสินค้าที่กำลังตัดสต็อก

### บทที่ 9: ระบบการติดตามและการวัดผล (Observability & Monitoring)
- **9.1 Bull Board Dashboard UI:** การติดตามสถานะคิว (`waiting`, `active`, `completed`, `failed`) แบบ Real-time
- **9.2 Metrics & Structured JSON Logging:** การสกัด `X-Request-ID` และการแนบ `requestId`/`jobId` ข้ามส่วนประกอบ

### บทที่ 10: วิธีการทดสอบประสิทธิภาพ (Load Testing Methodology)
- **10.1 สภาพแวดล้อมและเครื่องมือทดสอบ:** การยิง k6 จากเครื่องภายนอกไปยัง VM (4 vCPU, 6 GB RAM)
- **10.2 Scenarios การทดสอบ:** Read Heavy (1,000 VUs), Write Heavy (500 VUs แย่งซื้อ `p-1001` สต็อก 50) และ Duplicate Burst

### บทที่ 11: ผลการวัดค่าประสิทธิภาพเริ่มต้น (Baseline Performance Results)
- **11.1 Baseline Benchmark Results:** ค่า Throughput (RPS), Latency (p50, p95, p99), Cache Hit Ratio และ CPU/RAM ก่อน Tuning
- **11.2 ข้อสังเกตและพฤติกรรมเริ่มต้นของระบบ**

### บทที่ 12: การวิเคราะห์จุดคอขวดของระบบ (Bottleneck Analysis)
- **12.1 การระบุจุดคอขวดหลัก (Bottleneck Identification):** การวิเคราะห์สถิติ Resource Saturation, DB Lock Wait Time และ Queue Drain Time
- **12.2 สมมติฐานสำหรับการปรับแต่ง (Tuning Hypotheses)**

### บทที่ 13: การทดลองปรับแต่งประสิทธิภาพ (Performance Tuning Experiments)
- **13.1 กระบวนการทดลองแบบตัวแปรเดียว (Single-Variable Experiment Method):** การทดลองเปลี่ยนค่าทีละจุดและเปรียบเทียบผล
- **13.2 สรุปผลการทดลอง (Tuning Experiments Summary Table):** สรุปผลการทดลองที่เลือกใช้ (`KEEP`) และที่ไม่เลือกใช้ (`REVERT`)

### บทที่ 14: ผลสรุปประสิทธิภาพขั้นสุดท้าย (Final Performance Results)
- **14.1 Final Benchmark Competition Results:** ค่า Throughput และ Latency สูงสุดที่ระบบทำได้หลัง Tuning
- **14.2 สรุปอัตราการเติบโตของประสิทธิภาพ (Improvement Ratio):** เปรียบเทียบ % การเพิ่มขึ้นของ RPS และ % การลดลงของ Latency p95

### บทที่ 15: การพิสูจน์ความถูกต้องของข้อมูล (Data Integrity Verification)
- **15.1 SQL Proof Results Matrix:** ผลการรัน Query พิสูจน์ Data Integrity ครบทั้ง 5 ข้อหลังการทดสอบ Peak Load
- **15.2 การยืนยัน Zero Overselling และ Zero Duplicate Order**

### บทที่ 16: การเปรียบเทียบกับระบบของทีมอื่น (Cross-Team Benchmark Comparison)
- **16.1 Comparative Analysis Table:** เปรียบเทียบผล RPS, Latency p95, Error Rate กับทีมอื่นภายใต้ Load Script เดียวกัน
- **16.2 วิเคราะห์ความแตกต่างทางสถาปัตยกรรมและข้อดีข้อเสีย**

### บทที่ 17: ข้อจำกัดของระบบและแนวทางการพัฒนาในอนาคต (Limitations & Future Work)
- **17.1 ข้อจำกัดของระบบปัจจุบัน:** ทรัพยากร Single VM (4 vCPU) และขอบเขตการทดสอบ
- **17.2 ข้อเสนอแนะการพัฒนาต่อ (Future Enhancements):** การทำ Micro-batching, L1 Memory Cache หรือ Physical Redis Separation

### บทที่ 18: การแบ่งขอบเขตความรับผิดชอบของสมาชิกในทีม (Team Responsibilities)
- **18.1 Member 1 (Edge / API Lead):** พัฒนา Nginx, API Containers, JWT Auth และ k6 Scenarios
- **18.2 Member 2 (Queue / Cache Lead):** พัฒนา Redis Cache, BullMQ Queue, Bull Board และ Observability
- **18.3 Member 3 (Worker / Database Lead):** พัฒนา PostgreSQL Schema, Migrations, Seed Data และ Worker Order Processing

### บทที่ 19: สรุปผลการดำเนินงาน (Conclusion)
- **19.1 สรุปการบรรลุเป้าหมายโปรเจกต์:** ความสำเร็จในการสร้างระบบ Flash Sale ที่รวดเร็วและปลอดภัย 100%
- **19.2 สิ่งที่ทีมได้รับจากการแข่งขัน**

### บทที่ 20: ภาคผนวกและดรรชนีหลักฐาน (Appendix & Evidence Index)
- **20.1 ตารางเชื่อมโยงหลักฐาน (Evidence Index Table EVD-001 ถึง EVD-020)**
- **20.2 สคริปต์ SQL Verification และ k6 Scenarios**

---

## 4. รายการรูปภาพและตารางที่วางแผนจัดใส่ในรายงาน (Planned Figures & Tables)

### 4.1 รายการรูปภาพ (Planned Figures Table):
| Figure ID | Figure Title | Source Origin | Evidence ID |
| --- | --- | --- | --- |
| **Figure 1** | Overall Flash Sale System Architecture Diagram | `doc/architecture/architecture.md` | EVD-002 |
| **Figure 2** | Product Read Cache-Aside & Invalidation Flow | `doc/architecture/cache-strategy.md` | EVD-007 |
| **Figure 3** | End-to-End Order Processing Flow | `doc/architecture/order-flow.md` | EVD-006 |
| **Figure 4** | Multi-Layer Concurrency & Duplicate Prevention | `doc/architecture/concurrency-and-idempotency.md` | EVD-009 |
| **Figure 5** | Bull Board Queue Dashboard Screenshot | Bull Board UI | EVD-010 |
| **Figure 6** | Read Heavy Load Test Result Graph | k6 Summary / Grafana | EVD-017 |
| **Figure 7** | Write Heavy Load Test Result Graph | k6 Summary / Grafana | EVD-019 |
| **Figure 8** | System Resource Usage (CPU & RAM) Graph | Prometheus / Grafana | EVD-016 |

### 4.2 รายการตาราง (Planned Tables Table):
| Table ID | Table Title | Primary Source |
| --- | --- | --- |
| **Table 1** | Public HTTP API Specifications Summary | `doc/contracts/api-contract.md` |
| **Table 2** | VM Host Hardware & Software Specifications | `doc/performance/baseline.md` |
| **Table 3** | Baseline Benchmark Performance Results | `doc/performance/baseline.md` |
| **Table 4** | Performance Tuning Experiments Log Table | `doc/performance/tuning-results.md` |
| **Table 5** | Winning Final System Configuration Parameters | `doc/performance/final-results.md` |
| **Table 6** | Final Performance Competition Benchmark Results | `doc/performance/final-results.md` |
| **Table 7** | Data Integrity Proof Matrix Results | `doc/performance/final-results.md` |
| **Table 8** | Cross-Team Comparative Benchmark Results | `doc/performance/final-results.md` |
| **Table 9** | Team Ownership & Individual Responsibilities Matrix | `doc/planning/team-ownership.md` |

---

## 5. รายการข้อมูลที่รอเติมหลังรัน Benchmark จริง (Pending Report Data Table)

| Data Field | Description | Target Section | Status |
| --- | --- | --- | --- |
| **Baseline Read RPS & p95** | ตัวเลข RPS และ Latency p95 ก่อน Tuning | Section 11 | `PENDING BENCHMARK` |
| **Baseline Write RPS & p95**| ตัวเลข POST RPS และ Latency p95 ก่อน Tuning | Section 11 | `PENDING BENCHMARK` |
| **Winning Config Parameters**| จำนวน Container, Concurrency, DB Pool สุดท้าย | Section 13, 14 | `PENDING BENCHMARK` |
| **Final Read RPS & p95** | ตัวเลข Read Performance สูงสุดที่ทำได้ | Section 14 | `PENDING BENCHMARK` |
| **Final Write RPS & p95** | ตัวเลข Write Performance สูงสุดที่ทำได้ | Section 14 | `PENDING BENCHMARK` |
| **Cross-Team Metrics** | สถิติตัวเลขเปรียบเทียบกับทีมคู่แข่ง | Section 16 | `PENDING BENCHMARK` |
