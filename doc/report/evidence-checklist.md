# Final Evidence Checklist

**วันที่ตรวจ:** 29 สิงหาคม 2026

**สถานะ:** `CLI / BENCHMARK EVIDENCE AVAILABLE; RELEASE EVIDENCE PENDING`

## Evidence matrix

| ID | หลักฐาน | สถานะ | ตำแหน่ง/หมายเหตุ |
| --- | --- | --- | --- |
| EVD-001 | Git SHA และ CI green บน release PR | `PENDING` | รอ merge `develop → main` |
| EVD-002 | Docker Compose services healthy | `AVAILABLE` | VM smoke test ผ่าน |
| EVD-003 | Nginx กระจาย health ไป API 1/2/3 | `AVAILABLE` | `scripts/smoke-test.sh` |
| EVD-004 | Auth profile | `AVAILABLE` | `artifacts/day4/final-auth-r1-20260829/` |
| EVD-005 | Read API/caching profile | `AVAILABLE` | final read warm/cold artifacts |
| EVD-006 | Order admission 202 + Job ID | `AVAILABLE` | final write artifacts/integration tests |
| EVD-007 | Cache miss/hit | `AVAILABLE` | Day 3 integration suite |
| EVD-008 | Versioned invalidation + outbox recovery | `AVAILABLE` | Day 3 integration suite |
| EVD-009 | Duplicate/retry prevention | `AVAILABLE` | duplicate artifact + worker integration |
| EVD-010 | Bull Board UI screenshot | `AVAILABLE` | `artifacts/day5/bull-board.png` |
| EVD-011 | Worker micro-batch/correlation | `AVAILABLE` | worker integration + queue evidence |
| EVD-012 | Stock ไม่ติดลบ | `AVAILABLE` | `integrity.txt` ทุก valid write run |
| EVD-013 | Successful orders = 50 | `AVAILABLE` | `integrity.txt` |
| EVD-014 | Distinct successful users = 50 | `AVAILABLE` | `integrity.txt` |
| EVD-015 | Duplicate successful orders = 0 | `AVAILABLE` | `integrity.txt` |
| EVD-016 | Observability + resource metrics | `AVAILABLE` | `artifacts/day5/grafana-overview.png`, `target-resource.txt`, `load-generator-resource.txt` |
| EVD-017 | Official 3-run baseline | `AVAILABLE` | final-read-warm และ final-write series |
| EVD-018 | Keep/Revert tuning log | `AVAILABLE` | `doc/performance/tuning-results.md` |
| EVD-019 | Final 3-run benchmark | `AVAILABLE` | singleflight-write series + final report |
| EVD-020 | Cross-team comparison | `PENDING EXTERNAL DATA` | ต้องได้ผลทีมอื่นภายใต้เงื่อนไขเดียวกัน |

## Correctness gate

- [x] `remaining_stock >= 0` และ final stock = 0
- [x] successful orders = 50
- [x] distinct successful users = 50
- [x] duplicate successful `(user_id, product_id)` = 0
- [x] durable results = 500
- [x] retry idempotency ผ่าน

## Sensitive-data review

- [x] สแกน artifacts ไม่พบ `JWT_SECRET`, database password, Bearer token, private-key marker หรือ local test secret
- [x] `metadata.json` เก็บเฉพาะ allowlisted environment fields
- [x] ไม่ commit `.env`
- [x] ตรวจภาพหน้าจอ Bull Board/Grafana ด้วยตาและไม่พบ secret/token/password

## Final submission gate

- [x] Typecheck, lint, unit test และ build ผ่าน
- [x] Integration/concurrency/correctness suites ผ่าน
- [x] Official external k6 3 runs และ SQL gate ผ่าน
- [x] Valid/invalid/diagnostic runs แยกชัดใน `notes.md`
- [ ] Release PR CI green และ merge เข้า `main`
- [x] เก็บ Bull Board/Grafana screenshots จาก Target VM
- [ ] เติมผลทีมอื่นเมื่ออาจารย์ให้ข้อมูลเทียบ

ห้ามเปลี่ยน `PENDING` เป็น `AVAILABLE` จากการคาดเดา ต้องมีหลักฐานจริงเท่านั้น
