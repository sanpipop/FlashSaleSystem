# งานทดลองและปรับแต่งประสิทธิภาพระบบ (Performance Tuning Experiments Day 5)

## Goal
ดำเนินการทดลองปรับแต่งประสิทธิภาพ (Performance Experiments) ตามผลวิเคราะห์จุดคอขวด ยึดหลัก "เปลี่ยนทีละตัวแปร" บันทึกผลเปรียบเทียบใน Log เพื่อค้นหาการตั้งค่าที่ดีที่สุด (Optimal Configuration)

## Owner
Owner: Member 1, Member 2, Member 3 (แบ่งตามขอบเขตส่วนงาน)

## Reviewer
Reviewer: Integration Captain

## Priority
P1 (Required before Final Benchmark)

## Dependencies
- Hard Dependencies: [bottleneck-analysis.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day4/bottleneck-analysis.md)

## Can Start Immediately?
Yes

## Allowed Paths
- `apps/api/src/**`
- `apps/worker/src/**`
- `infra/nginx/**`
- `database/**`
- `doc/performance/tuning-results.md`

## Forbidden Paths
- `doc/contracts/**`

## Contracts Used
- [architecture.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/architecture.md)

## Scope
- แบ่งหัวข้อทดลองตามความรับผิดชอบ:
  - **Member 1 (Edge/API):** ทดลองปรับจำนวน API Containers (3 vs 4), ปรับ Nginx `keepalive` และ `worker_connections`
  - **Member 2 (Queue/Redis):** ทดลอง Worker Concurrency 8/12/16 และตรวจ Redis Ops/Cache latency แยกกัน
  - **Member 3 (Worker/DB):** ทดลอง Micro-batch 16/32, DB Pool รวม 24/28/32, ตรวจ Lock Wait, Batch Calls และ Query Plan
- Micro-batching, Versioned Cache, Result Ledger และ Outbox เป็น Winning Baseline ห้ามถอด; Day 5 ปรับเฉพาะค่าตัวเลขทีละตัวแปร
- บันทึกการทดลองแต่ละรอบลงตารางใน [tuning-results.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/performance/tuning-results.md)

## Out of Scope
- การปรับแต่งที่ทำลาย Data Integrity หรือหลีกเลี่ยง Business Invariants (ห้ามปิด Transaction หรือตัด Auth เพื่อทำคะแนนเด็ดขาด)

## Implementation Requirements
- ทุกรอบการทดลอง ต้องรันสคริปต์ `reset-db.sh` และ `verify-integrity.sh` เพื่อการันตีความถูกต้องของข้อมูล

## Acceptance Criteria
1. ทุกรอบการทดลองได้รับการบันทึกค่า (RPS, p95 Latency, Error Rate, Resource Usage) ลงใน `tuning-results.md`
2. การตั้งค่าสุดท้ายที่เลือกใช้ (Keep Decision) แสดง Throughput หรือ Latency ที่ดีขึ้นกว่า Baseline โดยยังคงผ่าน Data Integrity Verification 100%

## Test / Verification
```bash
# Workflow per Experiment:
# 1. Apply single config change
# 2. bash scripts/reset-db.sh
# 3. k6 run k6/competition.js
# 4. bash scripts/verify-integrity.sh
# 5. Record result & decide KEEP / REVERT
```

## Evidence Required
- บันทึกตารางการทดลองใน `tuning-results.md` พร้อมเหตุผลในการเลือก/ยกเลิกแต่ละตัวแปร

## Handoff
นำการตั้งค่าที่ได้ผลดีที่สุดไปใช้ในการยิง Final Benchmark รอบสุดท้าย

## Definition of Done
กระบวนการปรับแต่งประสิทธิภาพเสร็จสิ้น ได้รับ Optimal Configuration ที่ผ่านการพิสูจน์ด้วยข้อมูล
