# รายการตรวจสอบหลักฐานสำหรับการส่งมอบงาน (Final Report Evidence Checklist)

**วันที่อัปเดต:** 26 สิงหาคม 2026  
**สถานะ:** PREPARATION FRAMEWORK (Phase 6)  
**ขอบเขตโปรเจกต์:** คู่มือการจัดเก็บหลักฐานเชิงประจักษ์ (Evidence Collection Checklist) สำหรับจัดทำรายงานฉบับสมบูรณ์ (ทุกสมาชิกในทีม)

---

## 1. วัตถุประสงค์ (Purpose)

เอกสารฉบับนี้จัดทำขึ้นเพื่อใช้เป็น **คู่มือรวบรวมหลักฐานเชิงประจักษ์ (Evidence Checklist)** สำหรับการทำรายงานฉบับสมบูรณ์ (Final Report PDF) โดยช่วยให้ทีมรับทราบว่าต้องจัดเก็บหลักฐานประเภทใด จากส่วนประกอบใด เมื่อไร และใครเป็นผู้รับผิดชอบ เพื่อป้องกันการตกหล่นของ Screenshot, Metric หรือ Log สำคัญก่อนถึงกำหนดส่งมอบงาน

---

## 2. กฎการรวบรวมหลักฐาน (Evidence Collection Rules)

1. **No Fake Evidence Rule:** ห้ามสร้าง Screenshot, Metric, Log หรือตัวเลขการทดลองปลอมขึ้นมาโดยเด็ดขาด ให้ใช้เฉพาะหลักฐานที่รันจากระบบจริงเท่านั้น
2. **Primary Evidence Priority:** รายงานต้องอ้างอิงหลักฐานปฐมภูมิ (Primary Evidence) เช่น k6 Summary JSON, Grafana/Bull Board Screenshot, SQL Query Log เป็นหลัก
3. **Sensitive Data Redaction:** ก่อนนำ Screenshot หรือ Log มาใช้ในรายงาน ต้องตรวจสอบและเซ็นเซอร์ข้อมูลลับ (JWT Secret, Database Password, `.env` file) เสมอ

---

## 3. สถานะของหลักฐาน (Evidence Status Convention)

- **`AVAILABLE`:** มีหลักฐานจริง ตรวจสอบย้อนกลับได้ พร้อมใช้นำเสนอในรายงาน
- **`PENDING`:** อยู่ในระหว่างรอรันการทดสอบและจัดเก็บหลักฐาน
- **`PARTIAL`:** มีหลักฐานบางส่วน แต่ยังไม่สมบูรณ์สำหรับหัวข้อนั้น
- **`INVALID`:** หลักฐานถูกรันจากสภาวะที่ผิดเงื่อนไขหรือเกิด Data Integrity Failure
- **`NOT IMPLEMENTED`:** ฟังก์ชันดังกล่าวไม่ได้พัฒนาจริง (ไม่ต้องเก็บหลักฐาน)

---

## 4. เมทริกซ์การรวบรวมหลักฐาน (Evidence Matrix 20 Categories)

| Evidence ID | Requirement / Item | Source | Expected Evidence | Target Report Section | Primary Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| **EVD-001** | Repository Structure & CI | GitHub / Repo | Git Commit SHA & CI Green Result | Section 1, 18 | Member 1 | `AVAILABLE` |
| **EVD-002** | Docker Compose Deployment | VM Console | `docker compose ps` (All containers healthy) | Section 3 | Integration Captain | `PENDING` |
| **EVD-003** | Nginx Multi-API Load Balancing | Nginx Log / API | Access log showing distribution to 3 API instances | Section 3, 4 | Member 1 | `PENDING` |
| **EVD-004** | Authentication API (`POST /auth/token`) | curl / HTTP Client | Valid 200 response with JWT access token | Section 4 | Member 1 | `PENDING` |
| **EVD-005** | Products Read API & Pagination | curl / HTTP Client | 200 JSON response with page & limit | Section 4 | Member 1 | `PENDING` |
| **EVD-006** | Orders Async Admission API | curl / HTTP Client | 202 Accepted response with `orderJobId` | Section 4, 6 | Member 1 | `PENDING` |
| **EVD-007** | Redis Product Cache-Aside (Hit/Miss)| API Metrics / Log | First GET = Miss, Second GET = Hit | Section 5 | Member 2 | `PENDING` |
| **EVD-008** | Versioned Cache + Outbox Recovery | Redis / API / DB | Epoch changes after Commit and Outbox repairs Redis outage | Section 5, 8 | Member 2, 3 | `PENDING` |
| **EVD-009** | Duplicate/Retry Prevention | Integration Test | Concurrent duplicates create 1 logical Job; retry returns durable result without extra stock cut | Section 7 | Member 3 | `PENDING` |
| **EVD-010** | Bull Board Queue Dashboard UI | Browser Screenshot | Real-time Waiting/Active/Completed/Failed counts | Section 6, 9 | Member 2 | `PENDING` |
| **EVD-011** | BullMQ Micro-batch Worker | Worker/DB Metrics | Job count, batch-call count, mapping and JSON correlation logs | Section 6, 9 | Member 3 | `PENDING` |
| **EVD-012** | Database Non-Negative Stock Proof | SQL Query Output | `SELECT remaining_stock FROM products WHERE product_id='p-1001'` (>=0) | Section 8, 15 | Member 3 | `PENDING` |
| **EVD-013** | Database Total Successful Orders Proof | SQL Query Output | `SELECT COUNT(*) FROM orders WHERE product_id='p-1001'` (==50) | Section 8, 15 | Member 3 | `PENDING` |
| **EVD-014** | Database Distinct Users Proof | SQL Query Output | `SELECT COUNT(DISTINCT user_id) FROM orders` (==50) | Section 8, 15 | Member 3 | `PENDING` |
| **EVD-015** | Zero Duplicate Successful Orders Proof | SQL Query Output | `HAVING COUNT(*) > 1` query returning 0 rows | Section 8, 15 | Member 3 | `PENDING` |
| **EVD-016** | System Observability Metrics | Prometheus / API | HTTP RPS, p95 Latency, Cache Hit Ratio %, CPU/RAM | Section 9 | Member 2 | `PENDING` |
| **EVD-017** | Baseline k6 Benchmark Results | k6 Summary JSON | Raw k6 output summary for Baseline run | Section 10, 11 | Member 1 | `PENDING` |
| **EVD-018** | Performance Tuning Experiments Log | `tuning-results.md` | Single-variable experiment before/after table | Section 13 | Member 1, 2, 3 | `PENDING` |
| **EVD-019** | Final Benchmark Competition Results | k6 Summary JSON | Peak RPS, p95 Latency, Error Rate summary | Section 14 | Member 1 | `PENDING` |
| **EVD-020** | Cross-Team Benchmark Comparison | Load Test Metrics | Comparative RPS/p95 table under same load script | Section 16 | Member 1, 2 | `PENDING` |

---

## 5. รายการตรวจสอบความปลอดภัยของข้อมูลลับ (Sensitive Data Review Checklist)

ก่อนนำหลักฐานทุกชิ้นใส่ในรายงาน ให้ตรวจสอบและขีดฆ่า/ปิดทับ (Redact) ข้อมูลต่อไปนี้:

- [ ] **JWT Secret / Signing Keys:** ปิดทับ Secret ที่อยู่ใน `.env` หรือโค้ด
- [ ] **Database & Redis Passwords:** ปิดทับ Password ใน Connection String
- [ ] **User Credentials:** ปิดทับ Plaintext Password ในคำขอทดสอบ
- [ ] **Full JWT Access Tokens:** ตัดแสดงเฉพาะตัวอย่างย่อ (เช่น `eyJhbGciOi...`)

---

## 6. ประตูตรวจสอบความพร้อมของการส่งมอบ (Final Submission Gate)

- [ ] หลักฐาน EVD-001 ถึง EVD-020 ถูกจัดเก็บครบถ้วนและอยู่ในสถานะ `AVAILABLE`
- [ ] ผลการรัน SQL Verification ใน EVD-012 ถึง EVD-015 ผ่าน 100% (สต็อก 0, Order 50, User 50, Duplicate 0)
- [ ] มี k6 Summary JSON และ Screenshots คุณภาพสูงที่อ่านตัวเลขได้ชัดเจน
- [ ] ผ่านการตรวจขีดฆ่าข้อมูลลับเรียบร้อยแล้ว
