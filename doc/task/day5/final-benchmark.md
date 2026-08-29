# งานยิงทดสอบและบันทึกผล Final Benchmark (Final Benchmark Day 5)

## Goal
ดำเนินการยิงทดสอบโหลดรอบสุดท้าย (Final Benchmark) ด้วยการตั้งค่าที่ดีที่สุด (Optimal Configuration) บันทึกผลลัพธ์ลงใน [final-results.md](file:///FlashSaleSystem/doc/performance/final-results.md) และรวบรวมหลักฐานประกอบการส่งมอบงาน

## Owner
Owner: Member 1 (Benchmark Executor)

## Participants
Member 2 (Metrics Collector), Member 3 (Integrity Verifier)

## Reviewer
Reviewer: Integration Captain

## Priority
P0

## Dependencies
- Hard Dependencies: [performance-tuning.md](file:///FlashSaleSystem/doc/task/day5/performance-tuning.md)

## Can Start Immediately?
No (รันหลังกระบวนการ Tuning เสร็จสิ้นและเลือก Optimal Config แล้ว)

## Allowed Paths
- `doc/performance/final-results.md`
- `doc/report/evidence-checklist.md`
- `artifacts/**`

## Forbidden Paths
- `doc/contracts/**`

## Contracts Used
- [observability.md](file:///FlashSaleSystem/doc/architecture/observability.md)

## Scope
- เตรียมสภาพแวดล้อมระบบ รันสคริปต์ `reset-db.sh` ยืนยันสต็อก `p-1001` เท่ากับ 50
- ยิงทดสอบ k6 Load Test หลายรอบต่อเนื่องกัน (Multiple Benchmark Rounds) จากเครื่องภายนอก เพื่อตรวจดูความสม่ำเสมอของผลลัพธ์
- จัดเก็บ Artifacts สำคัญ:
  - k6 Summary JSON Output
  - ภาพถ่าย แดชบอร์ด Bull Board และ Metrics (Peak RPS, Latency p95, Cache Hit Ratio, CPU/RAM)
  - Output การรัน `verify-integrity.sh` พิสูจน์ `remainingStock = 0` และ `orders = 50`
- บันทึกผลสรุปในเอกสาร [final-results.md](file:///FlashSaleSystem/doc/performance/final-results.md) และรวบรวมใน [evidence-checklist.md](file:///FlashSaleSystem/doc/report/evidence-checklist.md)

## Out of Scope
- การเลือกผลการทดสอบเฉพาะรอบที่เร็วผิดปกติโดยไม่สม่ำเสมอ (ห้าม Cherry-Pick ผลงาน)

## Implementation Requirements
- การยิงต้องทำผ่านการตั้งค่าระบบและสภาพแวดล้อมจริงแบบเดียวกับที่จะใช้ในการแข่งขัน

## Acceptance Criteria
1. ผลการยิงทดสอบรอบสุดท้ายแสดง Throughput, Latency p95 และ Error Rate ที่สม่ำเสมอทุกรอบ
2. ผ่านการตรวจสอบ SQL/Retry Invariants 100% ครบทั้ง 8 ข้อหลังจบการทดสอบทุกรอบ

## Test / Verification
```bash
# 1. Reset
bash scripts/reset-db.sh
# 2. Run k6 Final Benchmark
k6 run --summary-export=artifacts/final-summary.json k6/competition.js
# 3. Verify
bash scripts/verify-integrity.sh
```

## Evidence Required
- `artifacts/final-summary.json`, SQL Proof Output และ Screenshots ของ Dashboard

## Handoff
นำหลักฐานทั้งหมดไปใช้ประกอบการส่งมอบงานใน Final Validation Task

## Definition of Done
Final Benchmark รันจบสมบูรณ์ บันทึกผลลัพธ์และรวบรวมหลักฐานครบถ้วนตามข้อกำหนด
