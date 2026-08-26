# สัญญาข้อกำหนดการใช้งาน Redis (Redis Key Schema & Operation Contract)

**วันที่อัปเดต:** 26 สิงหาคม 2026  
**สถานะ:** FROZEN BASELINE (Phase 2)  
**ขอบเขตโปรเจกต์:** ข้อตกลงรูปแบบ Keys, TTL, Cache Invalidation และ Atomic Protection ใน Redis (ขอบเขต Member 1 & Member 2)

---

## 1. วัตถุประสงค์ (Purpose)

เอกสารฉบับนี้เป็น **Shared Contract ล็อกข้อกำหนดการใช้งาน Redis (Redis Data Structure & Namespace Contract)** เพื่อให้การเรียกใช้งาน Redis ระหว่าง API (Member 1) และ Queue/Cache Infrastructure (Member 2) เป็นไปในทิศทางเดียวกัน ป้องกันปัญหา Key ชนกัน (Key Collisions) และกำหนดพฤติกรรมเมื่อเกิด Cache Invalidation หรือ Duplicate Claim

---

## 2. ขอบเขตสิทธิ์ของ Redis (Redis vs PostgreSQL Authority Boundary)

> [!CAUTION]
> **Redis ไม่ใช่ Persistent Source of Truth**  
> 1. Redis Cache ทำหน้าที่เป็น Read Replica ชั่วคราวสำหรับดึงรายการสินค้า  
> 2. Atomic Keys ใน Redis (เช่น Claim Keys) ทำหน้าที่เป็น Admission Guard ป้องกันคำขอซ้ำในระดับ API  
> 3. **ห้ามถือว่าการมีอยู่ของ Key ใน Redis เป็นคำตัดสินว่าผู้ใช้สั่งซื้อสำเร็จ 100%** (การตัดสินผลถาวรต้องมาจาก PostgreSQL เท่านั้น)

---

## 3. รูปแบบการตั้งชื่อ Key (Redis Key Namespace Pattern Convention)

ระบบกำหนดให้ใช้ Namespace Prefix มาตรฐานเพื่อแบ่งโดเมนการใช้งานอย่างชัดเจน:

- **Format Pattern:** `fs:<domain>:<resource>:<identifier>`

```text
fs:cache:products:page=1:limit=10    -> Product Listing Read Cache
fs:claim:order:user-999:p-1001      -> Atomic Admission Duplicate Claim
bull:orders:...                      -> BullMQ Internal Queue Namespace
```

---

## 4. สัญญาข้อกำหนดสำหรับ Product Read Cache (Product Cache Contract)

### 4.1 Key Format Design:
- **Pattern:** `fs:cache:products:page={page}:limit={limit}`
- **ตัวอย่าง:** `fs:cache:products:page=1:limit=10`

### 4.2 Data Type & Value Structure:
- **Data Type:** Redis `String` (JSON Serialized)
- **TTL Value:** `60` วินาที (สุ่มเพิ่ม Jitter `±5s` ใน Implementation เพื่อกัน Cache Stampede)
- **Value Content Examples:**
  ```json
  {
    "status": "success",
    "data": [
      {
        "productId": "p-1001",
        "name": "Limited Edition Sneaker",
        "price": 2990,
        "availableStock": 50,
        "remainingStock": 30,
        "isFlashSaleActive": true
      }
    ],
    "meta": {
      "total": 20,
      "page": 1,
      "limit": 10,
      "totalPages": 2
    }
  }
  ```

---

## 5. สัญญาการล้างแคช (Cache Invalidation Trigger Contract)

1. **Trigger Condition:** เกิดขึ้นเมื่อ BullMQ Worker ทำการตัดสต็อกลง PostgreSQL และ **`COMMIT` Transaction เรียบร้อยแล้วเท่านั้น**
2. **Invalidation Action:** Worker (หรือ Service ล้างแคช) จะส่งคำสั่งลบแคชออกด้วย Pattern:
   - **Command:** `DEL fs:cache:products:*` หรือลบ Key เฉพาะหน้าที่เกี่ยวข้อง
3. **Failure Recovery:** หากการส่งคำสั่ง Invalidation ไปยัง Redis ล้มเหลว ข้อมูลแคชจะหมดอายุตามค่า TTL (60s) โดยไม่ส่งผลกระทบต่อ Data Integrity ใน PostgreSQL

---

## 6. สัญญาการกันคำขอซ้ำระดับ API (Atomic Duplicate Claim Contract)

เพื่อป้องกันผู้ใช้คนเดียวกันยิงคำขอสั่งซื้อสินค้าเดิมพร้อมกันหลายครั้งในระดับ API Admission:

### 6.1 Key Format Design:
- **Pattern:** `fs:claim:order:{userId}:{productId}`
- **ตัวอย่าง:** `fs:claim:order:user-999:p-1001`

### 6.2 Atomic Operation Execution (`FROZEN BASELINE`):
API จะส่งคำสั่ง Redis Atomic Operation ก่อนทำการ Enqueue งานเข้า BullMQ:

```text
SET fs:claim:order:user-999:p-1001 "1" EX 60 NX
```

- **พฤติกรรมกรณีคำขอใหม่ (First Request):**  
  Redis ตอบกลับ `OK` -> API รับงานแล้วทำการสั่ง `queue.add()` ส่งเข้า BullMQ
- **พฤติกรรมกรณีคำขอซ้ำ (Duplicate Request):**  
  Redis ตอบกลับ `nil` ( Key มีอยู่แล้ว) -> API ทำการ Fast-Reject หรือส่งคืน Response Idempotent โดย **ไม่ทำการส่งงานซ้ำเข้า Queue**

### 6.3 Claim Key TTL Policy:
- **TTL Duration:** `60` วินาที
- **เหตุผล:** ป้องกันปัญหา Deadlock Claim ในกรณีที่ API หรือ Queue เกิด Crash กลางคันหลังจากตั้งค่า Key ไปแล้ว

---

## 7. ขอบเขตการทำงานร่วมกับ BullMQ (BullMQ Namespace Boundary)

- **Queue Name:** `orders`
- **Internal Redis Keys:** BullMQ จะสร้าง Keys ขึ้นต้นด้วย `bull:orders:*` (เช่น `bull:orders:id`, `bull:orders:waiting`)
- **ทีมพัฒนาห้ามทำการแก้ไข หรือลบ Keys ใน Namespace `bull:orders:*` ด้วยตนเองผ่านสคริปต์ภายนอก** ให้สั่งงานผ่าน BullMQ Library API เท่านั้น
