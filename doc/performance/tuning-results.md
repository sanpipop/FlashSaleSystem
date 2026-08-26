# บันทึกผลการปรับแต่งและเปรียบเทียบประสิทธิภาพ (Performance Tuning Results Log)

**วันที่อัปเดต:** 26 สิงหาคม 2026  
**สถานะ:** EXPERIMENT FRAMEWORK (Phase 4 Framework)  
**ขอบเขตโปรเจกต์:** บันทึกประวัติการทดลองปรับแต่งประสิทธิภาพแบบเปลี่ยนทีละตัวแปร (ทุกสมาชิกในทีม)

---

## 1. วัตถุประสงค์ (Purpose)

เอกสารฉบับนี้เป็น **สมุดบันทึกผลการทดลองปรับแต่งประสิทธิภาพ (Performance Experiment Log)** ของระบบ Flash Sale เพื่อบันทึกประวัติการทดลอง สมมติฐาน ค่าเปรียบเทียบ ก่อน/หลัง (Before/After Metrics) การตรวจสอบความถูกต้องของข้อมูล (Correctness Validation) และคำตัดสินใจว่า **`KEEP` (นำไปใช้จริง)** หรือ **`REVERT` (ยกเลิกและย้อนกลับ)**

---

## 2. กฎการทดลองปรับแต่งประสิทธิภาพ (Tuning Rules)

1. **Single Primary Variable Rule:** แต่ละการทดลองต้อง **เปลี่ยนตัวแปรหลักเพียงอย่างเดียว** ในแต่ละรอบ (เช่น เปลี่ยน Total DB Pool จาก 24 เป็น 28 โดยคงค่าอื่นไว้เท่าเดิม)
2. **Three Runs & Median Policy:** การวัดผลแต่ละรอบต้องรันอย่างน้อย 3 ครั้ง และใช้ค่ากลาง (Median) เป็นตัวแทนข้อมูล ห้ามใช้ผลการรันครั้งเดียว
3. **Automatic Revert on Correctness Failure:** หากการปรับแต่งทำให้ Data Integrity Fail (สต็อกติดลบ, สั่งซื้อเกิน 50 รายการ, ซื้อซ้ำได้) ให้ปรับคำตัดสินใจเป็น **`REVERT`** ทันที ไม่ว่าตัวเลข Throughput หรือ Latency จะดีขึ้นเพียงใดก็ตาม
4. **No Cherry-Picking:** ห้ามลบประวัติการทดลองที่ล้มเหลว เพื่อเป็นบทเรียนไม่ให้ทีมวนกลับไปทดลองสิ่งเดิมที่เคยแย่ลง

---

## 3. กรอบรูปแบบบันทึกการทดลอง (Experiment Record Template)

ทุกการทดลองต้องบันทึกด้วยรูปแบบมาตรฐานดังนี้:

```text
### [PERF-XXX] — ชื่อการทดลอง

- **Status:** PENDING BENCHMARK / MEASURED
- **Owner:** Member X
- **Date:** YYYY-MM-DD
- **Git Commit SHA:** PENDING
- **Hypothesis (สมมติฐาน):** อธิบายว่าคาดหวังอะไรจากการเปลี่ยนตัวแปรนี้

#### 1. Variable Changed (ตัวแปรที่เปลี่ยน)
- **Primary Variable:** ชื่อตัวแปร
- **Baseline Value:** ค่าเดิม
- **Candidate Value:** ค่าใหม่ที่ทดลอง

#### 2. Test Results (ผลการทดลอง)
- **GET RPS:** Before = PENDING -> After = PENDING (Change = PENDING %)
- **GET Latency (p95):** Before = PENDING ms -> After = PENDING ms (Change = PENDING %)
- **POST Admission Latency (p95):** Before = PENDING ms -> After = PENDING ms
- **Queue Drain Time:** Before = PENDING s -> After = PENDING s

#### 3. Correctness Validation (ความถูกต้อง)
- **Stock Integrity:** PASS / FAIL (Remaining Stock = 0, Successful Orders = 50)

#### 4. Decision & Analysis (คำตัดสินและการวิเคราะห์)
- **Decision:** KEEP / REVERT / RETEST
- **Analysis:** อธิบายเหตุผลเบื้องหลังผลการทดลอง
```

---

## 4. รายการหมวดหมู่การทดลองของสมาชิกในทีม (Candidate Experiments Matrix)

### 4.1 Member 1 — Edge & API Layer Experiments

#### `PERF-001`: Adjustment of NestJS API Container Count (3 vs 4 Instances)
- **Status:** `CANDIDATE / PENDING BENCHMARK`
- **Owner:** Member 1
- **Hypothesis:** การเพิ่ม API Container จาก 3 เป็น 4 จะช่วยเพิ่ม Throughput ฝั่ง Read แต่อาจเพิ่ม CPU Context Switching และ DB Pool Competition บน 4 vCPU VM
- **Primary Variable:** `API Instance Count` (3 -> 4)
- **Results:** `PENDING BENCHMARK`

#### `PERF-002`: Nginx Upstream Load Balancing Strategy (`least_conn` vs `round_robin`)
- **Status:** `CANDIDATE / PENDING BENCHMARK`
- **Owner:** Member 1
- **Hypothesis:** อัลกอริทึม `least_conn` จะช่วยลด Latency tail p95 เมื่อ API Containers มีระยะเวลาประมวลผลคำขอไม่เท่ากัน
- **Primary Variable:** Nginx upstream balancing algorithm
- **Results:** `PENDING BENCHMARK`

---

### 4.2 Member 2 — Queue & Redis Cache Layer Experiments

#### `PERF-003`: BullMQ Worker Concurrency Level Tuning (8 vs 12 vs 16)
- **Status:** `CANDIDATE / PENDING BENCHMARK`
- **Owner:** Member 2
- **Hypothesis:** Concurrency ที่พอดีกับ Micro-batch จะลด Queue Drain โดยไม่สร้าง Product Row Lock wait และ DB connection queue เกินจำเป็น
- **Primary Variable:** `BullMQ Worker Concurrency`
- **Results:** `PENDING BENCHMARK`

#### `PERF-004`: Product Read Cache TTL Duration (60s vs 300s)
- **Status:** `CANDIDATE / PENDING BENCHMARK`
- **Owner:** Member 2
- **Hypothesis:** การขยาย TTL ของ Product Cache ใน Redis จะช่วยลด DB Fallback ทราฟฟิกในกรณีอ่านต่อเนื่อง
- **Primary Variable:** `Redis Cache TTL`
- **Results:** `PENDING BENCHMARK`

---

### 4.3 Member 3 — Worker & Database Layer Experiments

#### `PERF-005`: PostgreSQL Total Application Pool Size (24 vs 28 vs 32)
- **Status:** `CANDIDATE / PENDING BENCHMARK`
- **Owner:** Member 3
- **Hypothesis:** Pool รวมที่พอดีจะลด Connection Wait โดยไม่แย่ง CPU/RAM บน 4 vCPU และต้องอยู่ใต้ `max_connections=35–40`
- **Primary Variable:** Total application pool across API + Worker
- **Results:** `PENDING BENCHMARK`

#### `PERF-006`: Database Index Optimization on `orders(user_id, product_id)`
- **Status:** `CANDIDATE / PENDING BENCHMARK`
- **Owner:** Member 3
- **Hypothesis:** การจัด Alignment Index บน `orders` จะช่วยลดเวลาการเช็ก `UNIQUE` constraint ระหว่างเปิด Transaction
- **Primary Variable:** Index Definition
- **Results:** `PENDING BENCHMARK`

---

### 4.4 Winning Mechanisms และสิ่งที่ยังเป็น Optional

> [!NOTE]
> รายการต่อไปนี้เป็นข้อเสนอแนะเทคนิคขั้นสูง (เช่น ในไฟล์ `Flash_Sale_Competition_Fastest_Safe_TH.docx`) จะดำเนินการทดลอง **เฉพาะเมื่อผล Baseline Metrics ชี้ว่ามีความจำเป็น และมีเวลาเหลือพอใน Day 5 เท่านั้น**:

| Optimization Candidate | Expected Benefit | Complexity | Correctness Risk | Status |
| --- | --- | --- | --- | --- |
| **Micro-batch Size 16 vs 32** | หา Batch ที่ Drain เร็วสุด | Medium | Low เมื่อ Contract เดิม | `FROZEN MECHANISM / VALUE PENDING` |
| **Redis Physical Separation** | แยก I/O & Memory ระหว่าง Queue และ Cache | Medium | Low | `FROZEN WINNING` |
| **Versioned Cache + Single-Flight** | Invalidation O(1) และลด DB stampede | Medium | Low | `FROZEN WINNING` |
| **L1 In-Memory API Product Cache** | ดึงข้อมูลสินค้า static จาก API Memory ตรง ไม่แตะ Redis | Medium | Medium | `CANDIDATE / PENDING BENCHMARK` |

---

## 5. ตารางสรุปค่าคอนฟิกที่ดีที่สุด ณ ปัจจุบัน (Current Best Configuration Table)

| System Layer | Parameter | Baseline Value | Current Best Value | Verified Date | Evidence / Status |
| --- | --- | --- | --- | --- | --- |
| **Nginx** | Upstream Strategy | `round_robin` | `PENDING` | `PENDING` | `PENDING BENCHMARK` |
| **API Containers**| Instance Count | `3` | `PENDING` | `PENDING` | `PENDING BENCHMARK` |
| **BullMQ Worker** | Concurrency Level | `8` | `PENDING (8/12/16)` | `PENDING` | `PENDING BENCHMARK` |
| **Worker Batch** | Batch Size / Wait | `16 / 1ms` | `PENDING (16/32)` | `PENDING` | `PENDING BENCHMARK` |
| **Redis Cache** | TTL Duration | `60s ±5s` | `PENDING` | `PENDING` | `PENDING BENCHMARK` |
| **PostgreSQL** | Total App Pool | `28` | `PENDING (24/28/32)` | `PENDING` | `PENDING BENCHMARK` |

---

## 6. ตารางประวัติการทดลองที่ถูกปฏิเสธ (Rejected Optimizations History Table)

| Experiment ID | Change Description | Performance Impact | Reason for Rejection | Decision |
| --- | --- | --- | --- | --- |
| *Example* | *Set API Instances to 8* | *RPS decreased by 15%* | *High CPU Context Switching Overhead on 4 vCPU* | `REVERT` |
| - | - | - | - | `PENDING BENCHMARK` |
