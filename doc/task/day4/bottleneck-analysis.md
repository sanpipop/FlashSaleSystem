# งานวิเคราะห์จุดคอขวดของระบบ (Bottleneck Analysis Day 4)

## Goal
รวบรวมข้อมูล Performance Metrics, Resource Usage และ k6 Summary เพื่อวิเคราะห์หาจุดคอขวด (Bottleneck) ของระบบ และจัดลำดับแผนการปรับแต่งประสิทธิภาพ (Candidate Optimizations P0-P3) สำหรับ Day 5

## Owner
Owner: Member 2 (Bottleneck Lead)

## Participants
Member 1, Member 3

## Reviewer
Reviewer: Integration Captain

## Priority
P0

## Dependencies
- Hard Dependencies: [k6-load-test.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day4/k6-load-test.md), [correctness-test.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day4/correctness-test.md)

## Can Start Immediately?
No (ทำเป็นงานสุดท้ายของ Day 4 หลังยิง Load Test และตรวจ Integrity แล้ว)

## Allowed Paths
- `doc/performance/baseline.md`
- `doc/task/day5/performance-tuning.md`

## Forbidden Paths
- `doc/contracts/**`

## Contracts Used
- [observability.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/observability.md)

## Scope
- รวบรวมข้อมูล Baseline Metrics:
  - Throughput (RPS) และ Latency (p50, p95, p99)
  - CPU & RAM Usage ภาพรวม VM (4 vCPU Limit)
  - Queue Backlog & Drain Time
  - Cache Hit Ratio (%)
  - PostgreSQL Lock Wait Time & DB Connection Pool Usage
- ตอบคำถามให้ได้ด้วยหลักฐานเชิงประจักษ์ว่า จุดคอขวดของระบบ ณ ปัจจุบันอยู่ที่ใด (เช่น Nginx, API Memory, Queue Backlog, DB Lock Wait)
- จัดทำตาราง Candidate Optimizations ที่จัดลำดับความสำคัญ (P0 - P3) สำหรับทดลองใน Day 5

## Out of Scope
- การปรับเปลี่ยนการตั้งค่าระบบทันทีใน Day 4 (ให้วางแผนไปทดลองใน Day 5)

## Implementation Requirements
- ข้อสรุปจุดคอขวดต้องมีตัวเลข Metrics อ้างอิง ห้ามเดาจากความรู้สึก

## Acceptance Criteria
1. เอกสาร [baseline.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/performance/baseline.md) ถูกบันทึกค่า Baseline Benchmark สมบูรณ์
2. ได้รับตารางจัดลำดับ Candidate Optimizations สำหรับ Day 5

## Test / Verification
- ตรวจสอบความสอดคล้องระหว่าง k6 Summary JSON และเอกสารวิเคราะห์

## Evidence Required
- เอกสารสรุปจุดคอขวดพร้อมกราฟ/ตัวเลขประกอบ

## Handoff
ส่งต่อรายการ Candidate Optimizations ให้สมาชิกทุกคนนำไปทดลองใน Day 5

## Definition of Done
วิเคราะห์จุดคอขวดสำเร็จด้วยหลักฐานเชิงประจักษ์ แผนการ Tune ใน Day 5 ถูกจัดลำดับชัดเจน
