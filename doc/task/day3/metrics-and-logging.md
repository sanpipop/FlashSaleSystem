# งานระบบวัดผลและบันทึก Log (Metrics & Logging Day 3)

## Goal
ติดตั้งระบบ Metrics Exporter (RPS, Latency p95, Cache Hit Ratio, Queue Backlog, CPU/RAM) และจัดทำ Structured JSON Logging พร้อมส่งต่อ Request ID ข้ามระบบ

## Owner
Owner: Member 2 (Metrics Lead)

## Contributors
Member 1 (API Logging/Metrics), Member 3 (Worker Logging/Metrics)

## Reviewer
Reviewer: Member 1

## Priority
P1

## Dependencies
- Hard Dependencies: [api-nginx.md](file:///FlashSaleSystem/doc/task/day1/api-nginx.md), [order-processing.md](file:///FlashSaleSystem/doc/task/day2/order-processing.md)
- Soft Dependencies: None

## Can Start Immediately?
Yes

## Allowed Paths
- `apps/api/src/common/logger/**`
- `apps/worker/src/common/logger/**`
- `observability/**`

## Forbidden Paths
- `doc/contracts/**`

## Contracts Used
- [observability.md](file:///FlashSaleSystem/doc/architecture/observability.md)

## Scope
- ตั้งค่า Winston/Pino Logger ให้บันทึก Log ในรูปแบบ JSON Format
- สกัด `X-Request-ID` จาก Nginx/API และแนบไปใน Log ทุกบรรทัดใน API และ Worker
- ติดตั้ง Prometheus Exporter (หรือ Metrics Endpoint) ดึงค่า:
  - HTTP RPS, Latency p50/p95/p99
  - Cache Hit / Miss Counter & Ratio
  - Queue Waiting / Active / Completed / Failed Count
  - VM CPU & RAM Usage Metrics

## Out of Scope
- การตั้งค่า Grafana Dashboard ขั้นสูงที่ซับซ้อนเกินจำเป็น

## Implementation Requirements
- Log ต้องไม่มีข้อมูลลับ เช่น JWT Secret หรือ Password

## Acceptance Criteria
1. Log ของ API และ Worker พิมพ์ออกมาในรูปแบบ JSON และมีฟิลด์ `requestId` และ `jobId` ตรงกัน
2. สามารถดึงข้อมูล Metrics ได้จาก Endpoint `/metrics`

## Test / Verification
```bash
curl -s http://localhost/metrics | grep http_requests_total
```

## Evidence Required
- ตัวอย่าง Log JSON Output 1 ชุดที่แสดง `requestId` และ `jobId` ส่งต่อสำเร็จ

## Handoff
ใช้ Metrics Endpoint เป็นข้อมูลตั้งต้นสำหรับ Bottleneck Analysis ใน Day 4

## Definition of Done
Structured Logging และ Metrics Exporter ทำงานครบถ้วน สอดคล้องกับ observability.md
