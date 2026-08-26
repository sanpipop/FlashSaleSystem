# ภาพรวมแผนงานวันที่ 2 (Day 2 Overview: Core Business Flow & Async Processing)

**วันที่อัปเดต:** 26 สิงหาคม 2026  
**สถานะ:** FROZEN EXECUTION PLAN (Phase 3)  
**เป้าหมายหลัก:** พัฒนาฟังก์ชันการทำงานหลัก (Core Business Logic) ครบตั้งแต่ Authentication, Read Products API จนถึงการกดสั่งซื้อผ่าน Async Queue และตัดสต็อกใน Worker อย่างปลอดภัย

---

## 1. เป้าหมายของวัน (Day Goal)

ทำให้คำสั่งซื้อสามารถประมวลผลได้แบบ End-to-End (ตั้งแต่ Client ยิงคำขอ Auth -> ดึงรายการสินค้า -> กดสั่งซื้อ Flash Sale -> API รับเข้า Queue ตอบ 202 -> Worker ดึงงานไปตัดสต็อกลง DB) โดยการันตีสต็อกไม่ติดลบและกันการซื้อซ้ำสำเร็จ

---

## 2. สถานะเป้าหมายปลายวัน (Expected End State)

- Endpoint `POST /api/v1/auth/token` สามารถออก JWT Token สำหรับ `userId` ใดๆ ได้
- Endpoint `GET /api/v1/products` สามารถอ่านข้อมูลสินค้า 20 รายการแบบแบ่งหน้าได้
- Endpoint `POST /api/v1/orders` สามารถตรวจสอบ JWT, ตรวจสอบ Payload และ Enqueue งานเข้า BullMQ พร้อมตอบ `202 Accepted` ได้รวดเร็ว
- BullMQ Worker สามารถดึง Job ไปตัดสต็อกลง PostgreSQL ภายใต้ ACID Transaction และ Pessimistic Row Lock (`SELECT FOR UPDATE`) ได้สำเร็จ
- ป้องกันกรณี สต็อกติดลบ (`remainingStock < 0`) และการซื้อซ้ำ (`Limit 1 per User per Product`) ได้ 100%

---

## 3. แผนการทำงานขนานกัน (Parallel Work Plan)

| สมาชิก / บทบาท | ช่วงเช้า (09:00 - 12:00) | ช่วงบ่าย (13:00 - 17:30) |
| --- | --- | --- |
| **Member 1 (Edge/API)** | พัฒนาระบบ JWT Authentication & Guard ([authentication.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day2/authentication.md)) และ Products Read API ([products-api.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day2/products-api.md)) | พัฒนา Orders Admission API ([orders-api.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day2/orders-api.md)) ต่อเข้ากับ Queue Producer |
| **Member 2 (Queue/Redis)** | ช่วย Member 1 ทดสอบ Queue Producer Enqueue และเตรียม Redis Claim Key Helper (`SET ... NX`) | เตรียมพร้อมรับ Job Result Event และซัพพอร์ต Member 3 ในการล้างแคชหลัง Commit |
| **Member 3 (Worker/DB)** | พัฒนา Order Processing Logic ใน Worker ([order-processing.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day2/order-processing.md)) ร่วมกับ Transaction & Pessimistic Row Locking | เขียน Concurrency Integration Test พิสูจน์สต็อกไม่ติดลบและการกันซื้อซ้ำ |

---

## 4. ประตูตรวจสอบการรวมระบบปลายวัน (End-of-Day Integration Gate)

เวลา 17:30 - 18:00 น. รัน E2E Test Flow:
1. ขอ JWT Token สำหรับ `user-001`
2. ดึงรายการสินค้า `GET /api/v1/products` ยืนยันสต็อก `p-1001` เท่ากับ 50
3. ยิง `POST /api/v1/orders` ด้วย Bearer Token สำหรับสินค้า `p-1001` ได้รับ `202 Accepted`
4. ตรวจสอบใน PostgreSQL พบว่ามี Order เพิ่มขึ้น 1 รายการ และสต็อก `p-1001` ลดเหลือ 49
5. ยิง `POST /api/v1/orders` ด้วย `user-001` ซ้ำอีกครั้ง ยืนยันว่าระบบปฏิเสธการซื้อซ้ำ
