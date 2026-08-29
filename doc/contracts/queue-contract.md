# สัญญาเชื่อมต่อระบบคิวประมวลผล (Queue Job Contract)

**วันที่อัปเดต:** 26 สิงหาคม 2026  
**สถานะ:** FROZEN WINNING FASTEST-SAFE (Phase 2)
**ขอบเขตโปรเจกต์:** ข้อตกลงการรับส่ง Message / Job Payload ระหว่าง NestJS API (Producer), BullMQ (Queue) และ Worker (Consumer) (ขอบเขต Member 1, 2, 3)

---

## 1. วัตถุประสงค์ (Purpose)

เอกสารฉบับนี้เป็น **Shared Contract ล็อกข้อกำหนดของ Queue และ Job Payload (Queue Job Interface)** เพื่อให้:
- **Member 1 (API):** สามารถสร้าง Job Producer ส่งงานเข้า Queue ได้ถูกต้อง
- **Member 2 (Queue/Redis):** สามารถตั้งค่า BullMQ Queue และติดตามสถานะใน Bull Board ได้
- **Member 3 (Worker):** สามารถเขียน Consumer ดึงข้อมูลจาก Job Payload ไปเปิด Database Transaction ตัดสต็อกได้โดยตรง

---

## 2. หน้าที่และความรับผิดชอบของ Queue (Queue Responsibilities)

1. **Decoupling:** แยกการทำงานระหว่างการรับคำขอ HTTP ของ API ออกจากการประมวลผลตัดสต็อกหนักใน Database
2. **Traffic Buffering:** ทำหน้าที่เป็นกันชน (Buffer) รองรับ Spike Traffic เมื่อมีคำสั่งซื้อยิงเข้ามาพร้อมกันหลายร้อยคำขอ
3. **Deterministic Job Identity:** ป้องกันคำสั่งซื้อซ้ำโดยใช้ Unique Job ID ในระดับ Queue
4. **Transient Retry Handling:** รองรับการทำ Retry อัตโนมัติกรณีเกิดข้อผิดพลาดชั่วคราวทางเทคนิค (เช่น DB Connection Timeout)
5. **Observability Expose:** แสดงสถานะ Backlog ของ Queue ให้ Bull Board และ Prometheus ดึง Metrics ไปแสดงผลได้

> [!IMPORTANT]
> **Queue ไม่ใช่ Persistent Source of Truth ของ Order Outcome**  
> สถานะ Job ของ BullMQ (เช่น `completed`) เป็นเพียงสถานะการประมวลผลสคริปต์ Worker จบสิ้น ไม่ใช่หลักฐานยืนยันว่าผู้ใช้ซื้อสินค้าสำเร็จ 100%

---

## 3. ชื่อคิวมาตรฐาน (Queue Logical Naming Convention)

- **Main Processing Queue Name:** `orders` (`FROZEN`)
- **Job Name:** `process-order` (`FROZEN`)

```text
BullMQ Queue Instance Name : "orders"
BullMQ Job Name           : "process-order"
```

---

## 4. ข้อกำหนดโครงสร้างข้อมูล Job Payload (Job Payload Schema)

ข้อมูลที่ API Producer ต้องใส่ไว้ใน Job Payload เมื่อเรียก `queue.add()` ต้องเป็น valid JSON ตาม Schema ต่อไปนี้:

### 4.1 Interface Definitions (TypeScript Representation):
```typescript
export interface OrderJobPayload {
  jobId: string;        // Deterministic Job Identifier (SHA-256 or Pattern)
  requestId: string;    // Correlation Request ID (UUID v4) for End-to-End Tracing
  userId: string;       // User ID extracted from trusted JWT Claim
  productId: string;    // Target Product ID extracted from Request Body
  createdAt: string;    // Timestamp in ISO-8601 format (e.g. "2026-08-26T11:30:00.000Z")
}
```

### 4.2 ตารางระบุรายละเอียดฟิลด์ (Payload Field Mapping Matrix):

| Field Name | Type | Status | Source Origin | Description / Constraints |
| --- | --- | --- | --- | --- |
| `jobId` | `string` | `MUST` | Calculated in API | `ord-` ตามด้วย SHA-256 lowercase hex และ **ห้ามมี `:`** |
| `requestId` | `string` | `MUST` | Nginx / API Header | UUID v4 ใช้ตามร่องรอย Log ข้ามระบบ |
| `userId` | `string` | `MUST` | **Derived from JWT Claim** | **ห้ามยึดจาก Request Body ที่ Client ส่งมา** |
| `productId` | `string` | `MUST` | Request Body | รหัสสินค้าที่ต้องการสั่งซื้อ |
| `createdAt` | `string` | `MUST` | API Admission Time | เวลาที่คำขอถูกรับเข้า Queue (ISO-8601) |

---

## 5. การสร้างรหัสงานแบบคงที่ (Deterministic Job Identity)

เพื่อป้องกันการสร้าง Job ซ้ำเข้า Queue เมื่อผู้ใช้ยิง Request พร้อมกันหลายครั้ง ระบบกำหนดให้สร้าง `jobId` แบบ Deterministic:

- **Canonical input (`FROZEN`):** UTF-8 ของ `userId + "|" + productId`
- **Formula / Pattern (`FROZEN`):**
  $$\text{jobId} = \text{"ord-"} + \operatorname{hex}(\operatorname{SHA256}(\text{userId} + "|" + \text{productId}))$$
  *ตัวอย่าง:* `ord-6f4d...e91a`
- **ข้อห้าม:** Custom Job ID ของ BullMQ ห้ามมีเครื่องหมาย `:` และห้ามเป็นตัวเลขล้วน
- **พฤติกรรมใน BullMQ:**  
  เมื่อ API เรียก `ordersQueue.add('process-order', payload, { jobId })` หาก Job ID เดิมยังถูกเก็บอยู่ BullMQ จะไม่สร้าง Job ซ้ำ (Atomic Queue Deduplication)
- **Defense in depth:** API ยังต้องใช้ Redis `SET ... NX EX` ตาม `redis-contract.md` เพื่อให้เห็นการป้องกันระดับ API ตาม Requirement อาจารย์ ส่วน PostgreSQL เป็นด่านตัดสินถาวร

### 5.1 Job Options ที่บังคับใช้

```typescript
{
  jobId,
  attempts: 3,
  backoff: { type: 'exponential', delay: 100 },
  removeOnComplete: { age: 86_400, count: 10_000 },
  removeOnFail: { age: 259_200, count: 5_000 }
}
```

Retention ทำให้ Job ID เดิมยังช่วย Deduplicate ระหว่างช่วงทดสอบ แต่ **ห้ามใช้ Retention เป็นความถูกต้องชั้นสุดท้าย** เพราะ Job ที่ถูกลบสามารถถูกเพิ่มด้วย ID เดิมได้อีก การ Retry ถาวรต้องอาศัย `order_results.job_id` และ Database Constraints

---

## 6. วงจรชีวิตของ Job ในคิว (Queue Job Lifecycle & Result Contract)

### 6.1 BullMQ Technical Lifecycle (สถานะเชิงเทคนิคของ คิว)
- `waiting`: Job ถูก enqueue เข้ามาแล้ว กำลังรอ Worker มาดึงไปทำ
- `active`: Worker กำลังประมวลผล Job นี้อยู่ภายใต้ DB Transaction
- `completed`: Worker ประมวลผลสคริปต์จบสิ้นเรียบร้อย (ไม่ว่าผลทางธุรกิจจะเป็น SUCCESS หรือ REJECTED)
- `failed`: เกิด Unhandled Infrastructure Exception (เช่น DB Down) และหมดจำนวน Retry

### 6.2 Business Processing Result Contract (ผลลัพธ์การประมวลผลทางธุรกิจ)
เมื่อ Worker ประมวลผลจบ จะส่งคืน Business Result Object ทาง Job Return Value:

```typescript
export type BusinessResultStatus = 
  | 'SUCCESS'             // ตัดสต็อกสำเร็จ บันทึก Order เรียบร้อย
  | 'REJECTED_SOLD_OUT'   // สต็อกหมด (remainingStock <= 0)
  | 'REJECTED_INACTIVE'   // สินค้าปิดโปรโมชัน Flash Sale
  | 'REJECTED_DUPLICATE'; // เคยซื้อสินค้านี้สำเร็จไปแล้ว (Duplicate Order)

export interface OrderJobResult {
  status: BusinessResultStatus;
  jobId: string;
  userId: string;
  productId: string;
  orderId?: string;       // มีค่าเฉพาะเมื่อ status == 'SUCCESS'
  processedAt: string;    // ISO-8601 Timestamp
  message: string;
}
```

---

## 7. เงื่อนไขการส่งงานทำซ้ำ (Retry Semantics)

1. **Transient Errors (Retry Allowed):** หากเกิดปัญหา DB Connection Drop, Lock Wait Timeout สคริปต์ Worker จะ throw Error เพื่อให้ BullMQ สั่ง Retry Job นั้นใหม่ตาม Backoff Policy
2. **Business Rejections (No Retry):** หากผลลัพธ์เป็น `REJECTED_SOLD_OUT` หรือ `REJECTED_DUPLICATE` Worker จะทำการ **Commit/Release Job เป็น Completed** (พร้อมบันทึก Result Status) ห้าม throw error เพื่อไม่ให้ BullMQ ยิง Retry งานที่ขายหมดแล้วซ้ำซ้อน
3. **Idempotent Retry Guarantee:** Worker ต้องอ่าน/เขียน `order_results.job_id` ภายใน Transaction เดียวกับ Order และ Stock หากพบผลเดิมให้คืนผลเดิมโดยไม่ลดสต็อกซ้ำ
4. **Micro-batch Processing (`FROZEN WINNING`):** Worker สามารถรวบ 10-32 Jobs หรือรอสูงสุด 1 ms แล้วส่งเข้า `place_order_batch(jsonb)` หนึ่งครั้ง แต่ต้องคืนผลให้ BullMQ แยกตาม `jobId` ครบทุก Distinct Logical Job
5. **Benchmark Gate:** เริ่มที่ batch size `16` และ Worker concurrency `8`; ทดลอง `16/32` และ `8/12/16` ทีละตัวแปร ห้ามตั้งค่าสูงโดยไม่มีผลวัด DB lock wait และ queue drain time

---

## 8. ตัวอย่างข้อมูล Job Payload (Payload JSON Examples)

### ตัวอย่าง Job Payload ที่ API ส่งให้ BullMQ:
```json
{
  "jobId": "ord-6f4d8f0f-example-sha256",
  "requestId": "req-8f7b2a1c-90de-4321-bbcd-123456789abc",
  "userId": "user-999",
  "productId": "p-1001",
  "createdAt": "2026-08-26T11:30:00.000Z"
}
```

### ตัวอย่าง Job Return Value ที่ Worker ส่งกลับเมื่อสำเร็จ:
```json
{
  "status": "SUCCESS",
  "jobId": "ord-6f4d8f0f-example-sha256",
  "userId": "user-999",
  "productId": "p-1001",
  "orderId": "ord-550e8400-e29b-41d4-a716-446655440000",
  "processedAt": "2026-08-26T11:30:00.045Z",
  "message": "Order processed and stock decremented successfully."
}
```
