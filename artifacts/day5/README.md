# Day 5 visual evidence

- `bull-board.png` — Bull Board บน Target VM เห็น queue `orders` และสถานะ 0 jobs หลัง official run drain สำเร็จ
- `grafana-overview.png` — Flash Sale Competition Overview บน Target VM แสดง RPS, HTTP p95, cache hit ratio, queue, worker outcomes, CPU, RAM และ process memory

ภาพถูกเก็บหลังจบ benchmark จึงใช้พิสูจน์ว่า dashboard/provisioning ทำงานและมี time-series จริง ไม่ใช้แทนตัวเลข official k6 ใน `artifacts/day4/`
