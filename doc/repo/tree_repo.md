# โครงสร้างโปรเจกต์และการวิเคราะห์ไฟล์ (Repository Tree & File Analysis)

**วันที่อัปเดต:** 26 สิงหาคม 2026 (26 ส.ค. 2569)

---

## 1. โครงสร้างไดเรกทอรี (Directory Tree)

ผลจากการรันคำสั่ง `tree -a -I '.git|node_modules|.next|dist|build'` ในโปรเจกต์:

```text
/home/netiwut/Documents/shareproject/FlashSaleSystem
├── CONTRIBUTING.md
├── doc
│   ├── architecture
│   │   ├── api-flow.md
│   │   ├── architecture.md
│   │   ├── cache-strategy.md
│   │   ├── concurrency-and-idempotency.md
│   │   ├── observability.md
│   │   └── order-flow.md
│   ├── contracts
│   │   ├── api-contract.md
│   │   ├── database-contract.md
│   │   ├── queue-contract.md
│   │   └── redis-contract.md
│   ├── performance
│   │   ├── baseline.md
│   │   ├── final-results.md
│   │   └── tuning-results.md
│   ├── planning
│   │   ├── decisions.md
│   │   ├── master-plan.md
│   │   └── team-ownership.md
│   ├── repo
│   │   └── tree_repo.md
│   ├── report
│   │   ├── evidence-checklist.md
│   │   └── final-report-outline.md
│   ├── task
│   │   ├── day1
│   │   │   ├── api-nginx.md
│   │   │   ├── day1-overview.md
│   │   │   ├── docker-compose.md
│   │   │   ├── project-bootstrap.md
│   │   │   ├── queue-redis.md
│   │   │   └── worker-database.md
│   │   ├── day2
│   │   │   ├── authentication.md
│   │   │   ├── day2-overview.md
│   │   │   ├── order-processing.md
│   │   │   ├── orders-api.md
│   │   │   └── products-api.md
│   │   ├── day3
│   │   │   ├── bull-board.md
│   │   │   ├── caching.md
│   │   │   ├── day3-overview.md
│   │   │   ├── integration-testing.md
│   │   │   └── metrics-and-logging.md
│   │   ├── day4
│   │   │   ├── bottleneck-analysis.md
│   │   │   ├── correctness-test.md
│   │   │   ├── day4-overview.md
│   │   │   └── k6-load-test.md
│   │   └── day5
│   │       ├── day5-overview.md
│   │       ├── final-benchmark.md
│   │       ├── final-validation.md
│   │       └── performance-tuning.md
│   └── testing
│       ├── load-testing.md
│       └── testing-strategy.md
├── .github
│   ├── ISSUE_TEMPLATE
│   │   ├── bug.yml
│   │   ├── config.yml
│   │   └── task.yml
│   ├── pull_request_template.md
│   └── workflows
│       ├── ci.yml
│       ├── load-test.yml
│       └── smoke.yml
├── output
│   └── Flash_Sale_Competition_Fastest_Safe_TH.docx
└── README.md

19 directories, 55 files
```

---

## 2. การวิเคราะห์ไฟล์ทั้งหมดในโปรเจกต์ (File Analysis)

โปรเจกต์นี้คือ **FlashSaleSystem** ซึ่งเป็นระบบ Flash Sale ที่ออกแบบมาเพื่อรองรับปริมาณ Traffic สูง (High Load) โดยเน้นย้ำเรื่องความเร็ว (Performance), ความถูกต้องของสต็อกสินค้า (Preventing Negative Stock), และการป้องกันการสั่งซื้อซ้ำ (Idempotency / Anti-duplicate orders)

จากการวิเคราะห์ไฟล์ทั้งหมดในระบบ สามารถแบ่งกลุ่มหน้าที่ตามหมวดหมู่โฟลเดอร์ได้ดังนี้:

### 2.1 ไฟล์เอกสารหลักและ Workflow สภาพแวดล้อมระบบ (`/`, `.github/`)

- **[README.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/README.md)**: อธิบายภาพรวมโปรเจกต์ เป้าหมายระบบ Flash Sale และการรัน Automation
- **[CONTRIBUTING.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/CONTRIBUTING.md)**: แนวทางการทำงานร่วมกันของทีม ตารางแบ่งบทบาทและ Reviewer กฎ Definition of Done และรอบ Stand-up
- **[.github/ISSUE_TEMPLATE/](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/.github/ISSUE_TEMPLATE)**: แบบฟอร์มสร้าง Issue ([bug.yml](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/.github/ISSUE_TEMPLATE/bug.yml), [task.yml](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/.github/ISSUE_TEMPLATE/task.yml), [config.yml](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/.github/ISSUE_TEMPLATE/config.yml))
- **[.github/pull_request_template.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/.github/pull_request_template.md)**: Checklist ตรวจทานก่อน Merge PR
- **[.github/workflows/](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/.github/workflows)**: Workflows CI/CD ([ci.yml](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/.github/workflows/ci.yml), [smoke.yml](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/.github/workflows/smoke.yml), [load-test.yml](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/.github/workflows/load-test.yml))

---

### 2.2 หมวดหมู่สถาปัตยกรรมระบบ (`doc/architecture/`)

- **[architecture.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/architecture.md)**: อธิบายสถาปัตยกรรมรวมของระบบ
- **[api-flow.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/api-flow.md)**: การไหลของข้อมูลและวงจรคำขอ (Request Lifecycle) ฝั่ง API
- **[order-flow.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/order-flow.md)**: กระบวนการสร้างคำสั่งซื้อ ตั้งแต่รับคำขอ เข้าคิว จนถึงการตัดสต็อก
- **[cache-strategy.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/cache-strategy.md)**: กลยุทธ์การทำ Caching ด้วย Redis (Invalidation, Warm-up, TTL)
- **[concurrency-and-idempotency.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/concurrency-and-idempotency.md)**: การจัดการ Concurrency, Race Condition และการทำ Idempotency
- **[observability.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/observability.md)**: การติดตามระบบด้วย Logging, Metrics, Tracing และ Dashboard

---

### 2.3 หมวดหมู่ข้อตกลงและสัญญาเชื่อมต่อ (`doc/contracts/`)

- **[api-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/api-contract.md)**: ข้อกำหนด RESTful API Endpoints
- **[queue-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/queue-contract.md)**: ข้อกำหนด Message / Job Payload และ Queue Names
- **[database-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/database-contract.md)**: ข้อกำหนด PostgreSQL Schema, Table Definitions และ Migration
- **[redis-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/redis-contract.md)**: ข้อกำหนด Redis Key Schema, Data Structures และ Lua scripts

---

### 2.4 หมวดหมู่การวางแผนและทีม (`doc/planning/`)

- **[master-plan.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/planning/master-plan.md)**: แผนการพัฒนารวมของโปรเจกต์
- **[team-ownership.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/planning/team-ownership.md)**: การแบ่งหน้าที่และความรับผิดชอบของสมาชิกและ Reviewer
- **[decisions.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/planning/decisions.md)**: บันทึกการตัดสินใจทางสถาปัตยกรรม (ADR)

---

### 2.5 หมวดหมู่แผนงานรายวัน (`doc/task/`)

#### Day 1 (`doc/task/day1/`)
- **[day1-overview.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day1/day1-overview.md)**: ภาพรวมงานวันแรก
- **[project-bootstrap.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day1/project-bootstrap.md)**: การตั้งต้นโปรเจกต์และโฟลเดอร์
- **[docker-compose.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day1/docker-compose.md)**: การตั้งค่า Compose บริการพื้นฐาน (PostgreSQL, Redis, Nginx)
- **[api-nginx.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day1/api-nginx.md)**: งาน API Skeleton & Nginx Proxy (สมาชิก 1)
- **[queue-redis.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day1/queue-redis.md)**: งาน Redis Queue & Admission Control (สมาชิก 2)
- **[worker-database.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day1/worker-database.md)**: งาน Worker & Database Setup (สมาชิก 3)

#### Day 2 (`doc/task/day2/`)
- **[day2-overview.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day2/day2-overview.md)**: ภาพรวมงานวันที่สอง
- **[authentication.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day2/authentication.md)**: ระบบ JWT Authentication
- **[products-api.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day2/products-api.md)**: API ข้อมูลสินค้าและสต็อก
- **[orders-api.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day2/orders-api.md)**: API รับคำสั่งซื้อ Flash Sale
- **[order-processing.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day2/order-processing.md)**: Worker ประมวลผลคำสั่งซื้อจาก Queue

#### Day 3 (`doc/task/day3/`)
- **[day3-overview.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day3/day3-overview.md)**: ภาพรวมงานวันที่สาม
- **[caching.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day3/caching.md)**: ระบบ Redis Cache สำหรับ Read/Pre-check
- **[bull-board.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day3/bull-board.md)**: Dashboard ติดตามสถานะ Queue
- **[metrics-and-logging.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day3/metrics-and-logging.md)**: ระบบ Logging & Request ID / Job ID Tracing
- **[integration-testing.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day3/integration-testing.md)**: สคริปต์ Integration Test

#### Day 4 (`doc/task/day4/`)
- **[day4-overview.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day4/day4-overview.md)**: ภาพรวมงานวันที่สี่
- **[k6-load-test.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day4/k6-load-test.md)**: สคริปต์ทดสอบโหลด k6/competition.js
- **[correctness-test.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day4/correctness-test.md)**: การทดสอบความถูกต้องของสต็อกและการสั่งซื้อซ้ำ
- **[bottleneck-analysis.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day4/bottleneck-analysis.md)**: การวิเคราะห์จุดคอขวดของระบบ

#### Day 5 (`doc/task/day5/`)
- **[day5-overview.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day5/day5-overview.md)**: ภาพรวมงานวันที่ห้า
- **[performance-tuning.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day5/performance-tuning.md)**: การปรับแต่งประสิทธิภาพ (Indexing, Pipeline, Worker Concurrency)
- **[final-benchmark.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day5/final-benchmark.md)**: ผล Benchmark รอบสุดท้าย
- **[final-validation.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day5/final-validation.md)**: การตรวจสอบความพร้อมตาม Definition of Done

---

### 2.6 หมวดหมู่การทดสอบ ประสิทธิภาพ และรายงาน (`doc/testing/`, `doc/performance/`, `doc/report/`, `doc/repo/`, `output/`)

- **[doc/testing/testing-strategy.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/testing/testing-strategy.md)**: กลยุทธ์การทดสอบระบบ
- **[doc/testing/load-testing.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/testing/load-testing.md)**: แนวทางการยิงทดสอบโหลดและเกณฑ์วัดผล
- **[doc/performance/baseline.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/performance/baseline.md)**: ผลการวัดประสิทธิภาพเริ่มต้น (Baseline)
- **[doc/performance/tuning-results.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/performance/tuning-results.md)**: บันทึกผลการเปรียบเทียบการปรับแต่งระบบ
- **[doc/performance/final-results.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/performance/final-results.md)**: สรุปผลประสิทธิภาพระบบฉบับสมบูรณ์
- **[doc/report/evidence-checklist.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/report/evidence-checklist.md)**: รายการหลักฐานสำหรับส่งมอบงาน
- **[doc/report/final-report-outline.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/report/final-report-outline.md)**: โครงร่างรายงานสรุปผลงานโครงการ
- **[doc/repo/tree_repo.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/repo/tree_repo.md)**: เอกสารสรุปโครงสร้างโปรเจกต์และการวิเคราะห์ไฟล์ (ไฟล์ปัจจุบัน)
- **[output/Flash_Sale_Competition_Fastest_Safe_TH.docx](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/output/Flash_Sale_Competition_Fastest_Safe_TH.docx)**: เอกสารอธิบายกติกาการแข่งขัน Flash Sale

---

## 3. หมายเหตุสำคัญ (Important Remarks)

> [!IMPORTANT]
> **1. สถานะโครงสร้างเอกสาร (Documentation Skeleton Ready)**
> ขณะนี้ไดเรกทอรี `doc/` ได้ถูกสร้างโครงสร้างไฟล์รองรับ (Placeholder Documentation Structure) ครบถ้วนทั้ง 44 ไฟล์ตามหมวดหมู่ สมาชิกในทีมสามารถเริ่มลงรายละเอียดในแต่ละหมวดหมู่ (Architecture, Contracts, Planning, Tasks Day 1-5, Testing, Performance, Reports) ได้ทันทีเมื่อเริ่มพัฒนา

> [!NOTE]
> **2. การเชื่อมโยงระหว่าง Task รายวันและ Contract**
> เอกสารแผนงานรายวัน (`doc/task/day1/` ถึง `doc/task/day5/`) จะต้องสอดคล้องกับ Contract ใน `doc/contracts/` หากมีการเปลี่ยนแปลง Interface หรือ Data Payload ในระหว่างพัฒนา ต้องอัปเดตเอกสาร Contract และแจ้งเตือนทีมก่อนเสมอตามข้อตกลงใน `CONTRIBUTING.md`

> [!WARNING]
> **3. กฎเหล็กการพัฒนาและส่งงาน (Development Constraints)**
> - **ห้าม Push เข้า branch `main` โดยตรง:** ต้องผ่าน Feature Branch และได้รับการอนุมัติจาก Reviewer อย่างน้อย 1 คนตามตารางใน `CONTRIBUTING.md`
> - **ห้าม AI แก้ไขไฟล์ส่วนกลางโดยไม่แจ้งทีม:** หากใช้ AI ต้องระบุ Allowed Paths ชัดเจน และห้ามให้ AI ปรับแก้ Database Schema, Shared Contracts หรือ Compose Config โดยไม่ผ่านการตกลonร่วมกัน
> - **Idempotency & Zero Negative Stock:** ทุก PR ที่เกี่ยวข้องกับระบบซื้อสินค้า ต้องผ่าน Checklist ป้องกันการซื้อซ้ำ ห้ามเกิดกรณี Remaining Stock ติดลบ และต้องบันทึก Request ID / Job ID ใน Log เสมอ

> [!TIP]
> **4. ลำดับการกรอกข้อมูลในเอกสาร (Recommended Workflow)**
> 1. **ระยะตกลง Contract (Day 1):** เติมข้อมูลลงใน `doc/contracts/` และ `doc/architecture/`
> 2. **ระยะลงมือพัฒนา (Day 1 - Day 3):** อัปเดตสถานะงานย่อยใน `doc/task/day1/` ถึง `doc/task/day3/`
> 3. **ระยะทดสอบและวัดผล (Day 4 - Day 5):** บันทึกค่า Baseline และผลการปรับแต่งลงใน `doc/performance/` และสรุปใน `doc/report/`
