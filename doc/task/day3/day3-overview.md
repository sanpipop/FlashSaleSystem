# ภาพรวมแผนงานวันที่ 3 (Day 3 Overview: Performance Foundation & Observability)

**วันที่อัปเดต:** 26 สิงหาคม 2026  
**สถานะ:** FROZEN EXECUTION PLAN (Phase 3)  
**เป้าหมายหลัก:** ยกระดับประสิทธิภาพฝั่ง Read ด้วย Redis Caching ติดตั้งระบบ Observability (Bull Board, Metrics, Structured Logging) และเขียน Integration Tests เพื่อเตรียมความพร้อมสำหรับการยิง Load Test ใน Day 4

---

## 1. เป้าหมายของวัน (Day Goal)

ติดตั้งรากฐานด้านประสิทธิภาพและการติดตามผลระบบ (Performance Foundation & Observability) โดยไม่ทำลาย Data Correctness ที่สร้างไว้ใน Day 2 เพื่อให้ระบบพร้อมสำหรับการวัดผล k6 Load Test และ Bottleneck Analysis ใน Day 4

---

## 2. สถานะเป้าหมายปลายวัน (Expected End State)

- Endpoint `GET /api/v1/products` ใช้งาน Redis Cache (Cache-Aside Pattern) โดยคำขอครั้งถัดไปจะดึงข้อมูลจาก Redis โดยตรงโดยไม่แตะ Database (Cache Hit)
- เมื่อ Worker ตัดสต็อกสินค้าใน PostgreSQL สั่ง Commit สำเร็จ จะส่งสัญญาณลบแคช (`DEL fs:cache:products:*`) ทำให้คำขออ่านถัดไปได้ข้อมูลสต็อกอัปเดตล่าสุด
- ติดตั้ง Bull Board Dashboard เพื่อให้สามารถดูสถานะ Queue (`waiting`, `active`, `completed`, `failed`) ผ่านเบราว์เซอร์ได้
- มีการบันทึก Log ในรูปแบบ JSON พร้อม `requestId` และ `jobId` ข้ามส่วนประกอบ
- Metrics หลัก (RPS, Latency, Cache Hit Ratio, Queue Backlog, CPU/RAM) พร้อมแสดงผล
- Integration Tests ผ่าน 100% ยืนยันความถูกต้องของระบบก่อนเริ่มยิง Load Test

---

## 3. แผนการทำงานขนานกัน (Parallel Work Plan)

| สมาชิก / บทบาท | ช่วงเช้า (09:00 - 12:00) | ช่วงบ่าย (13:00 - 17:30) |
| --- | --- | --- |
| **Member 1 (Edge/API)** | พัฒนาระบบ Structured Logging ใน API พร้อมสกัด `X-Request-ID` ([metrics-and-logging.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day3/metrics-and-logging.md)) | เชื่อมต่อ API Metrics Exporter (RPS, Latency p95) และสนับสนุน Integration Test |
| **Member 2 (Queue/Redis)** | พัฒนาระบบ Redis Cache-Aside สำหรับ Products API และระบบ ล้างแคช ([caching.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day3/caching.md)) | ติดตั้ง Bull Board Dashboard ([bull-board.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day3/bull-board.md)) และตั้งค่า Queue/Cache Metrics Exporter |
| **Member 3 (Worker/DB)** | เชื่อมต่อระบบ Cache Invalidation Signal ใน Worker หลัง Transaction Commit สำเร็จ | เขียนและรันชุด Integration & Correctness Test Suite ([integration-testing.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day3/integration-testing.md)) |

---

## 4. ประตูตรวจสอบการรวมระบบปลายวัน (End-of-Day Integration Gate)

เวลา 17:30 - 18:00 น. ตรวจสอบระบบก่อนขึ้น Day 4:
1. ยิง `GET /api/v1/products` สองครั้งติดต่อกัน ครั้งแรกต้องได้ Cache Miss ครั้งที่สองต้องได้ Cache Hit
2. ยิงสั่งซื้อสินค้าสำเร็จ ตรวจสอบพบว่า Redis Product Cache ถูกลบทันทีหลัง DB Commit
3. เปิด Bull Board UI บนเบราว์เซอร์ สามารถมองเห็นสถานะ คิวได้ถูกต้อง
4. รัน `pnpm test:integration` ผลการทดสอบทุกข้อต้องเป็นสีเขียว (Pass 100%)
