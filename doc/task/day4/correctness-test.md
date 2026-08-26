# งานตรวจสอบความถูกต้องของข้อมูลหลังยิงโหลด (Correctness Verification Day 4)

## Goal
รัน SQL Data Integrity Proof Queries ตรวจสอบความถูกต้องของสต็อกและคำสั่งซื้อใน PostgreSQL หลังการยิง k6 Load Test และจัดทำขั้นตอน DB Reset สำหรับการรัน Benchmark รอบถัดไป

## Owner
Owner: Member 3 (Worker / Database)

## Reviewer
Reviewer: Member 1

## Priority
P0

## Dependencies
- Hard Dependencies: [k6-load-test.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day4/k6-load-test.md)

## Can Start Immediately?
No (รันหลัง k6 Load Test จบสิ้นในแต่ละรอบ)

## Allowed Paths
- `scripts/verify-integrity.sh`
- `scripts/reset-db.sh`

## Forbidden Paths
- `doc/contracts/**`

## Contracts Used
- [database-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/database-contract.md)

## Scope
- เขียนและรันสคริปต์ `scripts/verify-integrity.sh` ตรวจสอบ 5 เงื่อนไขบังคับ:
  1. `remainingStock = 0` (กรณีขายหมด)
  2. `successful orders = 50`
  3. `distinct successful users = 50`
  4. `duplicate successful orders = 0`
  5. `negative stock = 0`
- เขียนสคริปต์ `scripts/reset-db.sh` ล้างข้อมูล `orders`, รีเซ็ตสต็อก `products` กลับเป็น 50 และล้าง Redis Cache/Queue เพื่อเตรียมพร้อมก่อนยิงรอบถัดไป

## Out of Scope
- การแก้ไข Code ของระบบ (หากพบความผิดพลาด ให้เปิด Issue รายงานทันที)

## Implementation Requirements
- สคริปต์ต้องพิมพ์รายงานสรุปผลลัพธ์เป็น PASS/FAIL ชัดเจน

## Acceptance Criteria
1. ผลการรัน SQL Verification สำหรับสินค้า `p-1001` ผ่านเกณฑ์ครบทั้ง 5 ข้อ (100% Correctness)
2. สคริปต์ `reset-db.sh` สามารถคืนค่าระบบกลับสู่สถานะเริ่มต้นพร้อมทดสอบรอบใหม่ได้ในคำสั่งเดียว

## Test / Verification
```bash
bash scripts/verify-integrity.sh
```

## Evidence Required
- Output Text หรือ Screenshot ของการรัน `verify-integrity.sh` ที่แสดงผล PASS ทุกข้อ

## Handoff
ยืนยัน Data Correctness ให้ทีมนำไปประกอบรายงานวิเคราะห์จุดคอขวด

## Definition of Done
Data Integrity Verification ผ่าน 100% และมีสคริปต์ Reset พร้อมใช้งาน
