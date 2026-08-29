# งานเตรียมและรัน k6 Load Test (k6 Load Testing Setup Day 4)

## Goal
เขียนและรันสคริปต์ `k6/competition.js` จากเครื่องภายนอก VM เพื่อจำลองสภาวะโหลดการแข่งขัน (500 Auth Users, 1,000 Concurrent Read Users, 500 Concurrent Write Requests แย่งซื้อ `p-1001`)

## Owner
Owner: Member 1 (Edge / API)

## Contributors
Member 2 (Queue/Cache Monitor), Member 3 (DB Correctness Verify)

## Reviewer
Reviewer: Member 2

## Priority
P0

## Dependencies
- Hard Dependencies: [day3-overview.md](file:///FlashSaleSystem/doc/task/day3/day3-overview.md) (ระบบต้องรันครบถ้วน)
- Soft Dependencies: None

## Can Start Immediately?
Yes

## Allowed Paths
- `k6/**`
- `artifacts/**`

## Forbidden Paths
- `doc/contracts/**`

## Contracts Used
- [api-contract.md](file:///FlashSaleSystem/doc/contracts/api-contract.md)

## Scope
- พัฒนาสคริปต์ `k6/competition.js` รองรับ Scenarios:
  1. Auth Prep: ออก JWT สภาพพร้อมใช้งานสำหรับ 500 Unique Users
  2. Read Test: ยิง `GET /api/v1/products` ด้วย 1,000 Concurrent Virtual Users (VUs)
  3. Write Competition Test: ยิง `POST /api/v1/orders` แย่งซื้อ `p-1001` ด้วย 500 VUs พร้อมกัน
  4. Duplicate Request Burst: จำลองผู้ใช้บางคนยิง Request ซ้ำ 2-3 ครั้ง
- ยิงทดสอบจาก **เครื่องภายนอก VM** ไปยัง Public IP ของ VM
- Export ผลลัพธ์การทดสอบไว้ใน `artifacts/summary.json`

## Out of Scope
- การยิง k6 ภายใน VM เครื่องเดียวกับระบบ (ห้ามเด็ดขาดเพื่อไม่ให้แย่ง CPU/RAM)

## Implementation Requirements
- สคริปต์ k6 ต้องอ่านค่า `BASE_URL` และ `TEST_PROFILE` จาก Environment Variables

## Acceptance Criteria
1. สามารถรันสคริปต์ k6 ผ่าน Workflow หรือ CLI ภายนอกได้จบสมบูรณ์โดยไม่เกิด Script Exception
2. บันทึกผล RPS, p50, p95, p99 Latency และ HTTP Error Rate ลงใน Artifacts เรียบร้อย

## Test / Verification
```bash
k6 run --summary-export=artifacts/summary.json k6/competition.js
```

## Evidence Required
- `artifacts/summary.json` และภาพถ่ายสรุปผลการรัน k6

## Handoff
ส่งต่อผล k6 Summary ให้ทีมใช้วิเคราะห์ใน Bottleneck Analysis Task

## Definition of Done
k6 Load Test รันจบสมบูรณ์ ได้รับข้อมูล Baseline Metrics จากเครื่องภายนอก
