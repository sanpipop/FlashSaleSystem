# ภาพรวมแผนงานวันที่ 5 (Day 5 Overview: Performance Tuning, Final Benchmark & Final Validation)

**วันที่อัปเดต:** 26 สิงหาคม 2026  
**สถานะ:** FROZEN EXECUTION PLAN (Phase 3)  
**เป้าหมายหลัก:** ดำเนินการปรับแต่งประสิทธิภาพ (Performance Tuning) ตามผลการวิเคราะห์จุดคอขวด ยึดหลักการทดลอง "เปลี่ยนทีละตัวแปร" ยิง Final Benchmark รอบสุดท้าย และตรวจสอบความพร้อมขั้นสุดท้ายก่อนส่งมอบโปรเจกต์

---

## 1. เป้าหมายของวัน (Day Goal)

เร่งประสิทธิภาพระบบให้ได้ Throughput สูงสุดและ Latency p95 ต่ำสุด โดยยังคงรักษา Data Integrity และข้อกำหนดของ Assignment ไว้ได้อย่างครบถ้วน 100% พร้อมจัดทำเอกสารหลักฐานส่งมอบงาน

> [!IMPORTANT]
> **Single Variable Experiment Rule**  
> ในการทดลองปรับแต่งประสิทธิภาพ ให้เปลี่ยนค่าตัวแปรเพียงอย่างเดียวในแต่ละรอบ (เช่น เปลี่ยนเฉพาะ DB Pool Size หรือ Worker Concurrency) รัน Benchmark แล้วเปรียบเทียบผล ห้ามเปลี่ยนหลายค่าพร้อมกันจนหาสาเหตุไม่ได้

---

## 2. สถานะเป้าหมายปลายวัน (Expected End State)

- ผ่านกระบวนการทดลองปรับแต่งประสิทธิภาพ (Performance Experiments Log) และได้การตั้งค่าที่ดีที่สุด (Optimal Configuration)
- ยิง Final Benchmark รอบสุดท้ายและบันทึกผลลงใน [final-results.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/performance/final-results.md)
- ผ่านการตรวจรับความพร้อมตาม Final Validation Checklist ทั้งด้าน Architecture, API Compatibility, Correctness, Observability, Deployment และ Repository Governance
- สรุปผลการดำเนินงานและจัดเตรียมหลักฐานส่งมอบพร้อมแข่งขัน

---

## 3. แผนการทำงานขนานกัน (Parallel Work Plan)

| สมาชิก / บทบาท | ช่วงเช้า (09:00 - 12:00) | ช่วงบ่าย (13:00 - 17:30) |
| --- | --- | --- |
| **Member 1 (Edge/API)** | ทดลองปรับแต่ง API Instance Count, Nginx Keepalive & Upstream Tuning ([performance-tuning.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day5/performance-tuning.md)) | ช่วยยิง k6 Final Benchmark และจัดเก็บ k6 Output ([final-benchmark.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day5/final-benchmark.md)) |
| **Member 2 (Queue/Redis)** | ทดลองปรับแต่ง BullMQ Concurrency, Redis Pool Size และ Cache Strategy | รวบรวม ภาพถ่าย Screenshots ของ Bull Board และ Metrics Dashboard ณ ช่วง Peak Load |
| **Member 3 (Worker/DB)** | ทดลองปรับแต่ง DB Connection Pool, Query Indexes และ Lock Duration | ตรวจสอบ Data Integrity หลัง Final Benchmark และตรวจรับ Final Checklist ([final-validation.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day5/final-validation.md)) |

---

## 4. ประตูตรวจสอบขั้นสุดท้าย (Final Release Gate)

เวลา 17:30 - 18:00 น. ตรวจสอบความสมบูรณ์ครั้งสุดท้ายก่อน Freeze โค้ด:
- [ ] `docker compose up --build` สามารถสั่งเปิดระบบใหม่ทั้งหมดขึ้นมาทำงานได้ในคำสั่งเดียว
- [ ] สคริปต์ `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration` ผ่าน 100%
- [ ] GitHub Actions CI Workflow (`ci.yml`, `smoke.yml`) ผ่านสถานะสีเขียว
- [ ] มีหลักฐาน k6 Summary JSON, SQL Integrity Verification Output และ Screenshots ครบถ้วน
- [ ] ไม่มีการ Commit Secret หรือไฟล์ `.env` จริงค้างอยู่ใน Git Repository
