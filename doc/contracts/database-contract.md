# สัญญาโครงสร้างฐานข้อมูลและกฎความถูกต้อง (Database Logical Schema & Integrity Contract)

**วันที่อัปเดต:** 26 สิงหาคม 2026  
**สถานะ:** FROZEN WINNING FASTEST-SAFE (Phase 2)
**ขอบเขตโปรเจกต์:** ข้อตกลงการออกแบบตาราง ข้อจำกัด (Constraints) และการทำ Transaction ใน PostgreSQL (ขอบเขต Member 3)

---

## 1. วัตถุประสงค์ (Purpose)

เอกสารฉบับนี้เป็น **Shared Contract ล็อกข้อกำหนดของ PostgreSQL Database Engine (Logical Data Contract)** เพื่อกำหนดโครงสร้างตาราง, ชนิดข้อมูล, ข้อบังคับทางธุรกิจ (Business Constraints) และขอบเขตการทำ ACID Transaction สำหรับ Member 3 (ผู้รับผิดชอบหลักฝั่ง Database/Worker) ให้สามารถสร้าง Entity, Migration และ Query ได้ถูกต้องสอดคล้องกับ API และ Queue

---

## 2. PostgreSQL เป็นศูนย์กลางความจริงสัมบูรณ์ (Database Source of Truth)

> [!IMPORTANT]
> **PostgreSQL เป็นเพียงผู้เดียวที่ถือสิทธิ์ Persistent Source of Truth**  
> ข้อมูลเกี่ยวกับสต็อกสินค้าคงเหลือจริง ประวัติการสั่งซื้อ และผลลัพธ์การซื้อสำเร็จ ต้องถูกยืนยันผ่านการ Commit ใน PostgreSQL เท่านั้น ข้อมูลใดๆ ใน Redis Cache หรือ Redis Queue ทำหน้าที่เป็นเพียง Read Replica ชั่วคราว

---

## 3. สัญญาโครงสร้างตาราง logical (Logical Schema Definitions)

### 3.1 ตารางสินค้า (`products`)

ตารางเก็บข้อมูลสินค้าและสต็อกคงเหลือสำหรับ Flash Sale

```sql
CREATE TABLE products (
    product_id             VARCHAR(64) PRIMARY KEY,
    name                   VARCHAR(255) NOT NULL,
    description            TEXT,
    price                  NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    available_stock        INTEGER NOT NULL CHECK (available_stock >= 0),
    remaining_stock        INTEGER NOT NULL CHECK (remaining_stock >= 0),
    is_flash_sale_active   BOOLEAN NOT NULL DEFAULT true,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### รายละเอียดฟิลด์และกฎบังคับ (Field Constraints Matrix):
- `product_id` (`VARCHAR(64)`, Primary Key): รหัสสินค้า (เช่น `'p-1001'`)
- `available_stock` (`INTEGER`, `MUST`): สต็อกตั้งต้นของช่วง Flash Sale (ค่า Reference คงที่ เช่น `50`)
- `remaining_stock` (`INTEGER`, `MUST`): สต็อกคงเหลือที่ขายได้จริง **มี Check Constraint `CHECK (remaining_stock >= 0)` ห้ามติดลบเด็ดขาด**
- `is_flash_sale_active` (`BOOLEAN`, `MUST`): สถานะเปิด/ปิดโปรโมชัน Flash Sale

---

### 3.2 ตารางคำสั่งซื้อ (`orders`)

ตารางเก็บเฉพาะคำสั่งซื้อที่สำเร็จ

```sql
CREATE TABLE orders (
    id           VARCHAR(64) PRIMARY KEY,
    job_id       VARCHAR(128) NOT NULL UNIQUE,
    user_id      VARCHAR(64) NOT NULL,
    product_id   VARCHAR(64) NOT NULL REFERENCES products(product_id),
    status       VARCHAR(32) NOT NULL CHECK (status = 'SUCCESS'),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_user_product UNIQUE (user_id, product_id)
);
```

#### รายละเอียดฟิลด์และข้อจำกัดสำคัญ (Crucial Constraints):
- `id` (`VARCHAR(64)`, Primary Key): UUID รหัสอ้างอิงของ Order (เช่น `'ord-550e84...'`)
- `job_id` (`VARCHAR(128)`, Unique): รหัส Job จาก BullMQ ป้องกันการบันทึก Job ซ้ำ
- `user_id` (`VARCHAR(64)`, `MUST`): รหัสผู้ใช้ที่สั่งซื้อ
- `product_id` (`VARCHAR(64)`, `MUST`): รหัสสินค้าที่สั่งซื้อ
- **`CONSTRAINT unique_user_product UNIQUE (user_id, product_id)` (`MUST`):** ข้อบังคับระดับ Database Engine **ห้ามผู้ใช้คนเดียวกันซื้อสินค้าชิ้นเดียวกันเกิน 1 ครั้งโดยเด็ดขาด**

### 3.3 ตารางผลการประมวลผลแบบถาวร (`order_results`)

```sql
CREATE TABLE order_results (
    job_id        VARCHAR(128) PRIMARY KEY,
    user_id       VARCHAR(64) NOT NULL,
    product_id    VARCHAR(64) NOT NULL REFERENCES products(product_id),
    status        VARCHAR(32) NOT NULL CHECK (status IN (
                     'SUCCESS', 'REJECTED_SOLD_OUT',
                     'REJECTED_INACTIVE', 'REJECTED_DUPLICATE'
                  )),
    order_id      VARCHAR(64) NULL REFERENCES orders(id),
    processed_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    message       TEXT NOT NULL,
    CONSTRAINT result_order_consistency CHECK (
      (status = 'SUCCESS' AND order_id IS NOT NULL) OR
      (status <> 'SUCCESS' AND order_id IS NULL)
    )
);
```

`order_results.job_id` เป็น Idempotency Ledger ถาวร หาก Worker ได้ Job เดิมซ้ำต้องคืนผลเดิมจากตารางนี้โดยไม่ลดสต็อกและไม่สร้าง Order ใหม่

### 3.4 ตาราง Transactional Outbox (`transactional_outbox`)

```sql
CREATE TABLE transactional_outbox (
    event_id         UUID PRIMARY KEY,
    aggregate_id     VARCHAR(64) NOT NULL,
    event_type       VARCHAR(64) NOT NULL CHECK (event_type = 'PRODUCT_STOCK_CHANGED'),
    payload          JSONB NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at     TIMESTAMPTZ NULL,
    attempts         INTEGER NOT NULL DEFAULT 0,
    next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_outbox_pending
ON transactional_outbox (next_attempt_at, created_at)
WHERE published_at IS NULL;
```

เมื่อ Stock เปลี่ยน Worker ต้องเขียน Outbox Event ใน Transaction เดียวกับ Orders/Results เพื่อให้การ Invalidate Cache ซ่อมตัวเองได้แม้ Redis ล่มหลัง DB Commit

---

## 4. สัญญาการทำธุรกรรมและการล็อกข้อมูล (Database Transaction & Locking Contract)

เส้นทางแข่งขันหลักใช้ `place_order_batch(jsonb)` เพื่อรวม 10-32 Jobs ของสินค้าเดียวกัน ลด DB Round-trip และล็อกแถวสินค้าเพียงครั้งเดียว โดยทุกผลลัพธ์ต้องอยู่ใน **Transaction เดียว (ACID Scope)**:

```sql
CREATE FUNCTION place_order_batch(p_jobs JSONB)
RETURNS TABLE (
  job_id VARCHAR(128), status VARCHAR(32),
  order_id VARCHAR(64), message TEXT
);
```

```sql
-- Step 0: Start Transaction
BEGIN;

-- Step 1: Return previously persisted results for duplicate job_id values.
-- Step 2: Acquire Pessimistic Lock on Target Product Row.
SELECT remaining_stock, is_flash_sale_active 
FROM products 
WHERE product_id = 'p-1001' 
FOR UPDATE;

-- Step 3: Deduplicate the batch by job_id and (user_id, product_id).
-- Step 4: Exclude users that already have a successful order.
-- Step 5: Choose at most remaining_stock winners.
-- Step 6: Bulk INSERT winners into orders with UNIQUE constraints active.
-- Step 7: Decrement remaining_stock by the actual INSERT ... RETURNING row count.
-- Step 8: INSERT one durable order_results row for every distinct logical job.
-- Step 9: INSERT one PRODUCT_STOCK_CHANGED outbox event if stock changed.
-- Step 10: Commit all changes atomically.
COMMIT;
```

กฎเพิ่มเติม:

- หาก Batch มีหลาย Product ต้อง Lock ตาม `product_id` ที่ Sort แล้วเสมอเพื่อป้องกัน Deadlock
- ห้ามเรียก Redis, HTTP หรือเขียน Log หนักภายใน Transaction
- `CHECK (remaining_stock >= 0)`, `UNIQUE(user_id, product_id)` และ `order_results(job_id)` ต้องเปิดใช้งานตลอด ห้ามแลก Correctness กับความเร็ว
- Baseline fallback แบบ Job เดี่ยวใช้ Algorithm เดียวกันได้ แต่การแข่งขันให้เริ่ม Micro-batch ที่ 16 Jobs / สูงสุดรอ 1 ms แล้ววัด 16 เทียบ 32

---

## 5. ดัชนีการค้นหา (Indexes Contract)

เพื่อเพิ่มความเร็วในการอ่านข้อมูลและการค้นหาอย่างมีประสิทธิภาพ:

1. **Correctness & Constraint Indexes (สร้างอัตโนมัติ):**
   - `PRIMARY KEY (product_id)` บนตาราง `products`
   - `PRIMARY KEY (id)` บนตาราง `orders`
   - `UNIQUE INDEX (user_id, product_id)` บนตาราง `orders`
   - `UNIQUE INDEX (job_id)` บนตาราง `orders`
   - `PRIMARY KEY (job_id)` บนตาราง `order_results`

2. **Performance Optimization Indexes (`FROZEN BASELINE`):**
   - ไม่สร้าง Index ซ้ำกับ `UNIQUE(user_id, product_id)` โดยไม่มี Query Plan ยืนยัน
   - `idx_outbox_pending` เป็น Partial Index สำหรับ Outbox Relay

---

## 6. คำสั่ง SQL ตรวจสอบความถูกต้องของข้อมูล (Data Integrity Proof Queries)

หลังจบการยิงทดสอบโหลด (Competition Benchmark Test) สำหรับสินค้า `p-1001` (สต็อกเริ่มต้น 50 ชิ้น) ข้อมูลใน PostgreSQL ต้องผ่านการตรวจสอบตาม SQL ด้านล่างนี้:

```sql
-- Proof 1: remaining_stock ต้องไม่ติดลบและต้องเหลือ 0 พอดี (ถ้าขายหมด)
SELECT product_id, available_stock, remaining_stock 
FROM products 
WHERE product_id = 'p-1001';
-- Expected Result: remaining_stock = 0 (>= 0เสมอ)

-- Proof 2: จำนวน Order ที่สำเร็จต้องไม่เกิน สต็อกเริ่มต้น (<= 50)
SELECT COUNT(*) AS total_successful_orders 
FROM orders 
WHERE product_id = 'p-1001' AND status = 'SUCCESS';
-- Expected Result: Exactly 50

-- Proof 3: จำนวนผู้ใช้ที่ซื้อสำเร็จต้องไม่ซ้ำกัน (Distinct Users = Total Orders = 50)
SELECT COUNT(DISTINCT user_id) AS distinct_users_count 
FROM orders 
WHERE product_id = 'p-1001' AND status = 'SUCCESS';
-- Expected Result: Exactly 50

-- Proof 4: ต้องไม่มี Order ซ้ำสำหรับคู่ (user_id, product_id) เดียวกัน
SELECT user_id, product_id, COUNT(*) 
FROM orders 
GROUP BY user_id, product_id 
HAVING COUNT(*) > 1;
-- Expected Result: 0 rows returned

-- Proof 5: ทุก Successful result ต้องอ้างถึง Order จริง
SELECT COUNT(*)
FROM order_results r
LEFT JOIN orders o ON o.id = r.order_id
WHERE r.status = 'SUCCESS' AND o.id IS NULL;
-- Expected Result: 0
```
