# ภาพรวมแผนงานวันที่ 4 (Day 4 Overview: Load Testing, Correctness Verification & Bottleneck Analysis)

**วันที่อัปเดต:** 26 สิงหาคม 2026  
**สถานะ:** FROZEN EXECUTION PLAN (Phase 3)  
**เป้าหมายหลัก:** สั่งรัน k6 Load Test จากเครื่องภายนอก ตรวจสอบความถูกต้องของข้อมูล (Data Integrity Proof) และวิเคราะห์จุดคอขวดของระบบเพื่อจัดลำดับแผนการปรับแต่งใน Day 5

---

## 1. เป้าหมายของวัน (Day Goal)

หยุดการเพิ่ม Feature ใหม่ทั้งหมด และดำเนินกระบวนการทดสอบวัดผลสภาวะระบบภายใต้โหลดการแข่งขันจริง (1,000 Concurrent Read Users + 500 Concurrent Write Requests) รวบรวมข้อมูล Baseline Metrics และวิเคราะห์หาจุดคอขวดที่แท้จริง

> [!WARNING]
> **No Speculative Tuning Before Baseline**  
> ห้ามปรับแต่งโค้ดหรือพารามิเตอร์ระบบโดยเด็ดขาดจนกว่าจะได้ผลการวัดค่า Baseline Benchmark และบันทึกหลักฐานครบถ้วนแล้ว

---

## 2. สถานะเป้าหมายปลายวัน (Expected End State)

- สคริปต์ `k6/competition.js` สามารถยิงทดสอบ Scenario การแข่งขันจากเครื่องภายนอกไปยัง VM ได้สำเร็จ
- ได้รับค่า Baseline Performance Metrics (RPS, p50, p95, p99 Latency, Error Rate, Cache Hit Ratio)
- ผ่านการตรวจสอบ Data Integrity หลังยิงโหลด:
  - `remainingStock = 0`
  - `successful orders = 50`
  - `distinct successful users = 50`
  - `duplicate successful orders = 0`
  - `negative stock = 0`
- ได้รับรายงานวิเคราะห์จุดคอขวด (Bottleneck Analysis Report) พร้อมรายการ Candidate Optimizations ที่จัดลำดับความสำคัญ (P0-P3) สำหรับทดลองใน Day 5

---

## 3. แผนการทำงานขนานกัน (Parallel Work Plan)

| สมาชิก / บทบาท | ช่วงเช้า (09:00 - 12:00) | ช่วงบ่าย (13:00 - 17:30) |
| --- | --- | --- |
| **Member 1 (Edge/API)** | เตรียมและรันสคริปต์ k6 Load Test Scenarios ([k6-load-test.md](file:///FlashSaleSystem/doc/task/day4/k6-load-test.md)) จากเครื่องภายนอก | รวบรวม k6 Summary Report และสถิติ HTTP Latency p95/p99 |
| **Member 2 (Queue/Redis)** | ตรวจสอบสถานะ Queue ผ่าน Bull Board และรวบรวม Cache Hit Ratio / Redis Metrics | ร่วมทำ Bottleneck Analysis วิเคราะห์ภาระงานบน CPU/RAM และ Queue Drain Time ([bottleneck-analysis.md](file:///FlashSaleSystem/doc/task/day4/bottleneck-analysis.md)) |
| **Member 3 (Worker/DB)** | จัดเตรียม DB Reset Procedure และรัน SQL Data Integrity Verification ([correctness-test.md](file:///FlashSaleSystem/doc/task/day4/correctness-test.md)) | ตรวจสอบ DB Lock Wait Time และ Connection Pool Usage ในระหว่างยิงโหลด |

### 3.1 รายการ Task Checklist ประจำวัน (Day 4 Status: 0% Pending)

- [ ] **[Member 1]** [k6-load-test.md](file:///FlashSaleSystem/doc/task/day4/k6-load-test.md) — ยิง k6 Benchmark (1,000 Read VUs + 500 Write Requests) จากเครื่องภายนอก VM
- [ ] **[Member 3]** [correctness-test.md](file:///FlashSaleSystem/doc/task/day4/correctness-test.md) — รัน SQL Data Integrity Verification Confirm zero negative stock & zero duplicate orders
- [ ] **[Member 2]** [bottleneck-analysis.md](file:///FlashSaleSystem/doc/task/day4/bottleneck-analysis.md) — วิเคราะห์จุดคอขวด (CPU/RAM, Queue Drain, DB Locks) และจัดทำ Candidate Optimizations Table

---

## 4. ประตูตรวจสอบการรวมระบบปลายวัน (End-of-Day Integration Gate)

เวลา 17:30 - 18:00 น. ตรวจสอบความพร้อมก่อนเข้าสู่ Day 5:
- [ ] มีไฟล์ k6 Summary JSON และ Screenshots ของระบบ ณ ช่วง Peak Load
- [ ] ผลการรัน SQL Verification ใน PostgreSQL แสดง `remainingStock = 0` และ `orders = 50` พอดี
- [ ] มีตารางจัดลำดับ Candidate Optimizations สำหรับ Day 5 พร้อมเหตุผลอ้างอิงจาก Metrics
