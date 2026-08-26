# สัญญาข้อกำหนดการใช้งาน Redis (Redis Key Schema & Operation Contract)

**วันที่อัปเดต:** 26 สิงหาคม 2026  
**สถานะ:** FROZEN WINNING FASTEST-SAFE (Phase 2)
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
fs:cache:products:epoch                     -> Current confirmed cache generation
fs:cache:products:v=15:page=1:limit=10      -> Versioned Product Listing Cache
fs:cache:fill:v=15:page=1:limit=10          -> Short single-flight fill guard
fs:claim:order:user-999:p-1001              -> Atomic Admission Duplicate Claim
bull:orders:...                              -> BullMQ Internal Queue Namespace
```

---

## 4. สัญญาข้อกำหนดสำหรับ Product Read Cache (Product Cache Contract)

### 4.1 Key Format Design:
- **Epoch Key:** `fs:cache:products:epoch`
- **Data Key Pattern:** `fs:cache:products:v={epoch}:page={page}:limit={limit}`
- **ตัวอย่าง:** `fs:cache:products:v=15:page=1:limit=10`

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

### 4.3 One-Round-Trip Read (`FROZEN WINNING`)

API ใช้ Redis Lua Script ที่โหลดไว้ล่วงหน้าและเรียกด้วย `EVALSHA` เพื่ออ่าน Epoch, สร้าง Versioned Key และอ่าน Cache Value ใน Redis round-trip เดียว ห้ามใช้ `KEYS` บน Request Path หาก Script Cache หายให้รับ `NOSCRIPT` แล้วโหลด Script ใหม่หนึ่งครั้ง

---

## 5. สัญญาการล้างแคช (Cache Invalidation Trigger Contract)

1. **Trigger Condition:** เกิดขึ้นเมื่อ BullMQ Worker ตัดสต็อกใน PostgreSQL และ **`COMMIT` สำเร็จแล้วเท่านั้น**
2. **Invalidation Action (`FROZEN`):** สั่ง `INCR fs:cache:products:epoch` เพื่อเปลี่ยน Cache Generation แบบ O(1) ห้ามใช้ `DEL fs:cache:products:*` เพราะ `DEL` ไม่รองรับ Wildcard
3. **Old-Key Cleanup:** ไม่ต้องไล่ลบ Key บน Request Path ให้ Key รุ่นเก่าหมดอายุเองตาม TTL; งานเบื้องหลังอาจใช้ `SCAN` + `UNLINK` ได้เท่านั้น
4. **Failure Recovery:** Transaction ต้องเขียน `transactional_outbox` ใน PostgreSQL พร้อม Order จากนั้น Outbox Relay จะ Retry การ `INCR epoch` จนสำเร็จ การเพิ่ม Epoch ซ้ำยอมรับได้เพราะเป็น Cache Invalidation แบบ Idempotent Effect
5. **Cache Miss Stampede Protection:** ใช้ Single-Flight ต่อ Cache Key (`SET fill-key token NX PX 1000`) ผู้ชนะอ่าน DB และเติม Cache ผู้แพ้รอแบบสั้นมากแล้วอ่าน Cache ซ้ำ; ก่อนเติม Cache ต้องยืนยันว่า Epoch ยังเท่ากับค่าที่อ่านมา หาก Redis ล่มให้ Fallback DB

---

## 6. สัญญาการกันคำขอซ้ำระดับ API (Atomic Duplicate Claim Contract)

เพื่อป้องกันผู้ใช้คนเดียวกันยิงคำขอสั่งซื้อสินค้าเดิมพร้อมกันหลายครั้งในระดับ API Admission:

### 6.1 Key Format Design:
- **Pattern:** `fs:claim:order:{userId}:{productId}`
- **ตัวอย่าง:** `fs:claim:order:user-999:p-1001`

### 6.2 Atomic Operation Execution (`FROZEN BASELINE`):
API จะส่งคำสั่ง Redis Atomic Operation ก่อนทำการ Enqueue งานเข้า BullMQ:

```text
SET fs:claim:order:user-999:p-1001 "<random-request-token>" EX 60 NX
```

- **พฤติกรรมกรณีคำขอใหม่ (First Request):**  
  Redis ตอบกลับ `OK` -> API รับงานแล้วทำการสั่ง `queue.add()` ส่งเข้า BullMQ
- **พฤติกรรมกรณีคำขอซ้ำ (Duplicate Request):**  
  Redis ตอบกลับ `nil` ( Key มีอยู่แล้ว) -> API ทำการ Fast-Reject หรือส่งคืน Response Idempotent โดย **ไม่ทำการส่งงานซ้ำเข้า Queue**

### 6.3 Claim Key TTL Policy:
- **TTL Duration:** `60` วินาที
- **เหตุผล:** ป้องกันปัญหา Deadlock Claim ในกรณีที่ API หรือ Queue เกิด Crash กลางคันหลังจากตั้งค่า Key ไปแล้ว
- **Safe Release:** หาก `queue.add()` ล้มเหลว ให้ลบ Claim ด้วย Lua compare-and-delete เฉพาะเมื่อค่าใน Key เท่ากับ Token ของ Request นี้ ห้ามใช้ `DEL` โดยไม่ตรวจ Token
- **Success Lifecycle:** เมื่อ Enqueue สำเร็จไม่ต้องปลด Claim ทันที ให้ TTL ป้องกัน HTTP retry burst; ความถูกต้องถาวรอยู่ที่ BullMQ Job ID และ PostgreSQL

---

## 7. ขอบเขตการทำงานร่วมกับ BullMQ (BullMQ Namespace Boundary)

- **Queue Redis:** ใช้ Redis Operations Instance ที่ `maxmemory-policy=noeviction` และ AOF `appendfsync everysec`
- **Cache Redis:** ใช้ Redis Cache Instance แยกต่างหากและตั้ง `allkeys-lru`; Cache สูญหายได้เพราะสร้างใหม่จาก PostgreSQL
- **Queue Name:** `orders`
- **Internal Redis Keys:** BullMQ จะสร้าง Keys ขึ้นต้นด้วย `bull:orders:*` (เช่น `bull:orders:id`, `bull:orders:waiting`)
- **ทีมพัฒนาห้ามทำการแก้ไข หรือลบ Keys ใน Namespace `bull:orders:*` ด้วยตนเองผ่านสคริปต์ภายนอก** ให้สั่งงานผ่าน BullMQ Library API เท่านั้น
