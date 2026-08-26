# การแบ่งขอบเขตความรับผิดชอบและสิทธิ์การเข้าถึง (Team Ownership & Governance Policy)

**วันที่อัปเดต:** 26 สิงหาคม 2026  
**สถานะ:** FROZEN PLANNING SOURCE OF TRUTH (Phase 5)  
**ขอบเขตโปรเจกต์:** การกำหนด Code Ownership, Review Chain, สิทธิ์การแก้ไขไฟล์ และกฎการทำงานของ AI Agent (ทุกสมาชิกในทีม)

---

## 1. วัตถุประสงค์ (Purpose)

เอกสารฉบับนี้จัดทำขึ้นเพื่อกำหนด **ขอบเขตความรับผิดชอบของสมาชิกในทีม (Code Ownership Matrix)**, การส่งต่อและตรวจทานโค้ด (Review Chain), สิทธิ์การจัดการไฟล์ส่วนกลาง (Shared Files Governance) และกฎความปลอดภัยในการใช้ AI Agent เพื่อป้องกันการแก้ไขโค้ดทับซ้อน (Git Conflict) และลดการติดขัดระหว่างการพัฒนา

---

## 2. หลักการแบ่งขอบเขตความรับผิดชอบ (Ownership Principles)

1. **Strict Area Ownership:** แต่ละสมาชิกเป็นเจ้าของหลัก (Primary Owner) ในโฟลเดอร์งานของตนเอง และต้องได้รับการตรวจทานจาก Reviewer ที่กำหนด
2. **Contract-Based Boundary:** สมาชิกสื่อสารกันผ่าน Frozen Shared Contracts (`doc/contracts/`) ห้ามเข้าไปแก้ไขโค้ดภายในโฟลเดอร์ของสมาชิกคนอื่นโดยไม่ได้รับอนุมัติ
3. **Integration Captain Leadership:** การรวมไฟล์ส่วนกลาง (Shared Files) ต้องผ่านการควบคุมของ Integration Captain ประจำวัน

---

## 3. รายละเอียดบทบาทของสมาชิกแต่ละคน (Member Detailed Ownership)

### 3.1 Member 1 — Edge / API Layer
- **ขอบเขตความรับผิดชอบหลัก:** NestJS API Framework, Nginx Reverse Proxy, JWT Authentication, Auth API (`POST /auth/token`), Products Read API (`GET /products`), Orders Admission API (`POST /orders`), API Queue Producer Integration, API Metrics & k6 Load Test Scenario
- **โฟลเดอร์หลักที่อนุญาตให้แก้ไข (Allowed Paths):**
  - `apps/api/**`
  - `infra/nginx/**`
  - `k6/**`
- **ผู้ตรวจทานหลัก (Primary Reviewer):** **Member 2**

### 3.2 Member 2 — Queue / Redis / Cache / Observability Layer
- **ขอบเขตความรับผิดชอบหลัก:** Redis Operations & Cache Configuration, BullMQ Infrastructure, Atomic Claim Admission Guard (`SET ... NX`), Product Read Cache-Aside, Cache Invalidation Signal Support, Bull Board Dashboard, Queue & Cache Metrics Exporter, Observability Setup
- **โฟลเดอร์หลักที่อนุญาตให้แก้ไข (Allowed Paths):**
  - `packages/queue/**`
  - `packages/cache/**`
  - `observability/**`
- **ผู้ตรวจทานหลัก (Primary Reviewer):** **Member 3**

### 3.3 Member 3 — Worker / Database Layer
- **ขอบเขตความรับผิดชอบหลัก:** PostgreSQL Engine & TypeORM Connection, Database Migrations, Seed Data 20 รายการ, BullMQ Worker Consumer, Transaction & Pessimistic Row Locking (`SELECT FOR UPDATE`), Database Constraints (`UNIQUE`, `CHECK`), Stock Integrity & Retry Safety
- **โฟลเดอร์หลักที่อนุญาตให้แก้ไข (Allowed Paths):**
  - `apps/worker/**`
  - `database/**`
- **ผู้ตรวจทานหลัก (Primary Reviewer):** **Member 1**

---

## 4. ตารางเมทริกซ์ความรับผิดชอบภาพรวม (Ownership Matrix Table)

| ส่วนงาน (Component / Subsystem) | เจ้าของหลัก (Primary Owner) | ผู้ตรวจทาน (Primary Reviewer) | ผู้สนับสนุน (Contributor/Backup) |
| --- | --- | --- | --- |
| **Nginx Reverse Proxy & Load Balancer** | Member 1 | Member 2 | Integration Captain |
| **NestJS API (Auth, Products, Orders)** | Member 1 | Member 2 | Member 3 |
| **JWT Auth & Authorization Guard** | Member 1 | Member 2 | Member 3 |
| **Redis Cache & Invalidation Strategy** | Member 2 | Member 3 | Member 1 |
| **BullMQ Queue & Atomic Claim Guard** | Member 2 | Member 3 | Member 1 |
| **Bull Board UI & Metrics Exporter** | Member 2 | Member 3 | Integration Captain |
| **PostgreSQL Migration, Schema & Seed** | Member 3 | Member 1 | Member 2 |
| **BullMQ Worker & Order Transaction** | Member 3 | Member 1 | Member 2 |
| **k6 Load Test Scenarios & Execution** | Member 1 | Member 2 | Member 3 |
| **Docker Compose & Shared Bootstrap** | Integration Captain | Member 1 | Member 2, 3 |

---

## 5. นโยบายการจัดการไฟล์ส่วนกลาง (Shared Files Governance Policy)

ไฟล์ต่อไปนี้ถือเป็น **Shared Integration Files** ซึ่งกระทบทุกบริการในระบบ:

```text
package.json (Root)
pnpm-workspace.yaml
compose.yaml / docker-compose.yml
.env.example
doc/contracts/**
```

> [!WARNING]
> **Shared Files Control Rules:**  
> 1. ห้ามสมาชิกแก้ไข Shared Files โดยเด็ดขาดเว้นแต่ได้รับมอบหมายใน Task หรือประสานงานกับ Integration Captain  
> 2. สมาชิก 2 คนห้ามแก้ไข Shared File เดียวกันพร้อมกันในเวลาเดียวกัน  
> 3. การรวมการเปลี่ยนแปลงใน Shared Files จะทำโดย Integration Captain ในรอบรวมงานประจำวัน (12:00 น. และ 18:00 น.)

---

## 6. ลำดับการหมุนเวียนตำแหน่ง Integration Captain (Captain Rotation)

ตามข้อตกลงใน [CONTRIBUTING.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/CONTRIBUTING.md) ตำแหน่ง Integration Captain จะหมุนเวียนดังนี้:
- **Day 1 (26 ส.ค.):** สมาชิก 1
- **Day 2 (27 ส.ค.):** สมาชิก 2
- **Day 3 (28 ส.ค.):** สมาชิก 3
- **Day 4 (29 ส.ค.):** สมาชิก 1
- **Day 5 (30 ส.ค.):** สมาชิก 2

---

## 7. กฎความปลอดภัยสำหรับการสั่งงาน AI Agent (AI Agent Governance Rules)

เมื่อมีการใช้ AI Agent ในการช่วยเขียนโค้ด ทุกคำสั่ง (Prompt/Task Issue) ต้องระบุขอบเขต 6 ประการต่อไปนี้เสมอ:

```text
1. Goal: เป้าหมายของงานย่อย
2. Allowed Paths: โฟลเดอร์ที่อนุญาตให้แก้ไข (ตรงตาม Ownership)
3. Forbidden Paths: โฟลเดอร์ที่ห้ามแตะเด็ดขาด (โฟลเดอร์ของเพื่อน + Shared Files + Contracts)
4. Contracts Used: สัญญาอ้างอิงใน doc/contracts/
5. Acceptance Criteria: เงื่อนไขที่ถือว่าเสร็จ
6. Test Command: คำสั่งทดสอบความถูกต้อง
```

> [!CAUTION]
> **ข้อห้ามเด็ดขาดสำหรับ AI Agent:**  
> - **ห้าม AI แก้ไขไฟล์ใน `doc/contracts/` หรือ `doc/architecture/` เองโดยเด็ดขาด**
> - **ห้าม AI แก้ไข Database Schema, Shared Contracts หรือ Compose Config โดยไม่ได้รับอนุมัติจากทีม**
> - **ห้าม AI ทำการ Refactor โค้ดนอกขอบเขต Allowed Paths**

---

## 8. เมทริกซ์การอนุมัติการเปลี่ยนแปลง (Escalation & Approval Matrix)

| ระดับการเปลี่ยนแปลง (Change Scope) | ผู้มีอำนาจอนุมัติ (Approval Required) | ขั้นตอนที่ต้องทำ (Required Workflow) |
| --- | --- | --- |
| **โค้ดภายในโฟลเดอร์ตนเอง** | เจ้าของหลัก + Reviewer 1 คน | PR -> CI Pass -> Review -> Squash Merge |
| **ไฟล์ส่วนกลาง (Shared Files)** | Integration Captain | แจ้งทีมใน Stand-up -> PR -> Integration Captain Merge |
| **สัญญาเชื่อมต่อ (`doc/contracts/`)** | สมาชิกในทีมทั้ง 3 คน | เปิด Issue ตกลง -> PR อัปเดต Contract -> สมาชิกทุกคน Approve |
| **สถาปัตยกรรมหลัก (`doc/architecture/`)** | สมาชิกในทีมทั้ง 3 คน | สรุปมติทีม -> อัปเดตเอกสาร -> Freeze |
