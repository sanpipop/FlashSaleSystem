# งานตรวจรับความพร้อมขั้นสุดท้ายก่อนส่งมอบ (Final Validation & Release Checklist Day 5)

## Goal
ตรวจสอบความพร้อมขั้นสุดท้ายของระบบ (Final Release Audit) ให้ครอบคลุมทุกมิติ ทั้ง Architecture, API Compatibility, Correctness Invariants, Observability, Deployment และ Repository Governance ก่อนปิดโปรเจกต์

## Owner
Owner: Integration Captain

## Participants
Member 1, Member 2, Member 3

## Priority
P0 (Final Release Gate)

## Dependencies
- Hard Dependencies: [final-benchmark.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day5/final-benchmark.md)

## Can Start Immediately?
No (รันเป็นงานสุดท้ายของโปรเจกต์)

## Allowed Paths
- `doc/report/final-report-outline.md`
- `doc/report/evidence-checklist.md`

## Forbidden Paths
- `doc/contracts/**`

## Contracts Used
- [README.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/README.md)
- [CONTRIBUTING.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/CONTRIBUTING.md)

## Comprehensive Final Verification Checklist

### 1. Dimension A: Architecture & Infrastructure Audit
- [ ] Nginx Reverse Proxy รันเป็น Public Entry Point บน Port 80 และกระจายทราฟฟิกไปยัง API อย่างน้อย 3 Instances
- [ ] NestJS API Containers ทำงานเป็น Stateless 100% อ่าน identity จาก JWT
- [ ] PostgreSQL รันเป็น Persistent Source of Truth พร้อม Volume ถาวร
- [ ] Redis (Cache & Queue) และ BullMQ Worker ทำงานร่วมกันได้สมบูรณ์
- [ ] ระบบทั้งหมดเปิดขึ้นมาทำงานพร้อมกันผ่านคำสั่งเดียว `docker compose up --build -d`

### 2. Dimension B: API Compatibility & Contract Adherence Audit
- [ ] Endpoint `POST /api/v1/auth/token` ออก JWT Token ได้ถูกต้อง
- [ ] Endpoint `GET /api/v1/products?page=1&limit=10` อ่านข้อมูลแบบแบ่งหน้าได้ตรงตาม Schema
- [ ] Endpoint `POST /api/v1/orders` รับคำขอ Enqueue เข้า Queue และตอบกลับ `202 Accepted` รวดเร็ว
- [ ] API คืน Response เป็น JSON `camelCase` และมี Header `X-Request-ID` แนบกลับมาเสมอ

### 3. Dimension C: Correctness Invariants Audit
- [ ] **Non-Negative Stock:** สต็อกสินค้าคงเหลือไม่เคยติดลบ (`remainingStock >= 0`)
- [ ] **Limit 1 per User per Product:** ไม่เคยมีผู้ใช้สั่งซื้อสินค้าชิ้นเดียวกันสำเร็จมากกว่า 1 ครั้ง
- [ ] **Exact Stock Allocation:** สำหรับ `p-1001` (สต็อก 50) หลังยิงแข่ง จะได้ Order สำเร็จ 50 รายการ และสต็อกคงเหลือเท่ากับ 0 พอดี
- [ ] **Flash Sale Active Check:** สินค้าที่ `isFlashSaleActive = false` ไม่สามารถถูกสั่งซื้อได้

### 4. Dimension D: Observability & Auditability
- [ ] Bull Board UI สามารถเปิดดูสถานะ Queue บนเบราว์เซอร์ได้
- [ ] Metrics Exporter สามารถดึงค่า RPS, Latency p95, Cache Hit Ratio และ CPU/RAM ได้
- [ ] Log ของ API และ Worker เป็น JSON Format และมี `requestId` และ `jobId` ตรงกันทุกบรรทัด

### 5. Dimension E: Repository Governance & Security Audit
- [ ] คำสั่ง `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration` และ `pnpm build` รันผ่านสีเขียว 100%
- [ ] GitHub Actions CI (`ci.yml`, `smoke.yml`) ผ่านการตรวจสมบูรณ์
- [ ] ไม่มีการ Commit Secret, Password จริง หรือไฟล์ `.env` ค้างอยู่ใน Git Repository
- [ ] เอกสารคู่มือ [README.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/README.md) อธิบายขั้นตอนการเปิดระบบและการรันสคริปต์ได้ชัดเจน

---

## Final Definition of Done
ระบบผ่านการตรวจสอบทั้ง 5 มิติครบถ้วน 100% พร้อมส่งมอบและเข้าร่วมการแข่งขัน Flash Sale System
