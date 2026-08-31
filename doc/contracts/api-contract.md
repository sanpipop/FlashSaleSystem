# สัญญาเชื่อมต่อ HTTP API สาธารณะ (Public HTTP API Contract)

**วันที่อัปเดต:** 26 สิงหาคม 2026  
**สถานะ:** FROZEN WINNING FASTEST-SAFE (Phase 2)
**ขอบเขตโปรเจกต์:** ข้อตกลงการเชื่อมต่อระหว่าง External Client / Mobile App / k6 กับ NestJS API (ขอบเขต Member 1)

---

## 1. วัตถุประสงค์ (Purpose)

เอกสารฉบับนี้เป็น **Shared Contract ล็อกข้อกำหนดอินเทอร์เฟซของ RESTful HTTP API (Public API Boundaries)** สำหรับระบบ Flash Sale เพื่อให้สมาชิกในทีม (โดยเฉพาะ Member 1 ฝั่ง API) สามารถพัฒนา API Endpoints ได้ทันทีโดยไม่ต้องรอส่วนประมวลผล Worker หรือ Database และรับประกันว่า Client / k6 Generator จะสามารถเรียกใช้งานได้อย่างถูกต้องตามข้อกำหนดของการแข่งขัน

---

## 2. ขอบเขตของเอกสาร (Scope)

ครอบคลุมรายละเอียดอินเทอร์เฟซ 3 Endpoints บังคับ:
1. `POST /api/v1/auth/token` — การออก JWT Access Token
2. `GET /api/v1/products` — การอ่านรายการสินค้าแบบแบ่งหน้า (Read-heavy Cache Path)
3. `POST /api/v1/orders` — การอนุมัติรับคำสั่งซื้อ Flash Sale (Async Admission)

รวมถึงข้อกำหนดรูปแบบ Error Envelope, Response Headers, Naming Conventions และ HTTP Status Codes

---

## 3. ข้อตกลงสถานะของสัญญา (Contract Status Summary)

| หัวข้อ / ข้อกำหนด | สถานะ Contract | คำอธิบาย |
| --- | --- | --- |
| HTTP Endpoints Path & Methods | `MUST` | ห้ามเปลี่ยนจากข้อกำหนด Assignment |
| Authorization Header Format | `MUST` | ต้องใช้ `Bearer <JWT_ACCESS_TOKEN>` |
| Order Request Body (`productId` only) | `MUST` | Client ส่งเฉพาะ `productId` ห้ามส่ง `userId` หรือ `quantity` |
| Mandatory Quantity = 1 | `MUST` | คำสั่งซื้อแต่ละครั้งถูกบังคับเป็น 1 ชิ้นเสมอ |
| Async Order Admission (`202 Accepted`) | `FROZEN BASELINE` | API ตอบ 202 เมื่อ Enqueue งานสำเร็จ โดยไม่รอ DB Commit |
| JSON Naming Style (`camelCase`) | `FROZEN BASELINE` | JSON Payload ทั้งหมดใช้ camelCase |
| Response Envelope (`status`, `data`, `meta`) | `FROZEN BASELINE` | รูปแบบมาตรฐานของ Response |
| Exact Expiration Duration of JWT | `IMPLEMENTATION DETAIL` | เช่น 1 ชม. หรือ 24 ชม. สามารถปรับเปลี่ยนได้ |
| Duplicate Order HTTP Response Code | `FROZEN WINNING` | 202 พร้อม Job ID เดิมเมื่อยืนยันว่า Job มีอยู่; 409 เฉพาะ Claim ค้างแต่ยังหา Job ไม่พบ |

---

## 4. คำศัพท์และการแปลงชื่อเรียก (Terminology & Naming Conventions)

| Concept | API Protocol (JSON) | Internal Domain / DB | ชนิดข้อมูล (Data Type) |
| --- | --- | --- | --- |
| User Identifier | `userId` | `user_id` | `string` (e.g. `"user-999"`) |
| Product Identifier | `productId` | `product_id` | `string` (e.g. `"p-1001"`) |
| Correlation Request ID | `requestId` | - | `string` (UUID v4) |
| Order Processing Job ID | `orderJobId` / `jobId` | `job_id` | `string` |
| Initial Quota Stock | `availableStock` | `available_stock` | `integer` (e.g. `50`) |
| Remaining Sellable Stock | `remainingStock` | `remaining_stock` | `integer` (e.g. `30`) |
| Flash Sale Active Status | `isFlashSaleActive` | `is_flash_sale_active` | `boolean` (`true`/`false`) |

---

## 5. ข้อกำหนดของทั้งระบบ (General API Conventions)

- **Base Path:** `/api/v1`
- **Content-Type Header:** `application/json; charset=utf-8` (สำหรับ POST requests)
- **Request Identification:** API จะอ่าน Header `X-Request-ID` หากไม่มี API จะสร้าง UUID v4 ขึ้นใหม่ และส่งกลับทาง Response Header `X-Request-ID` เสมอ
- **JSON Field Naming:** ใช้รูปแบบ `camelCase` เท่านั้น

---

## 6. ข้อกำหนดรายละเอียดของแต่ละ Endpoint (Endpoint Definitions)

### 6.1 Authentication Endpoint: `POST /api/v1/auth/token`

ออก JWT Access Token สำหรับยืนยันตัวตนของผู้ใช้ในการสั่งซื้อ

- **HTTP Method & Path:** `POST /api/v1/auth/token`
- **Authentication:** Public Access (ไม่ต้องส่ง Bearer Token)
- **Request Body (JSON):**
  ```json
  {
    "userId": "user-999"
  }
  ```
  - `userId` (`string`, `MUST`, Required): รหัสผู้ใช้ระบบ ห้ามเป็นค่าว่าง
- **Response Success (`200 OK`):**
  ```json
  {
    "status": "success",
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
  }
  ```
- **JWT Claims Spec (`FROZEN BASELINE`):**
  - Claim หลักสำหรับระบุผู้ใช้: `sub` หรือ `userId` ต้องถูกตั้งค่าเป็น `userId` (เช่น `"sub": "user-999"`)
  - Verification: NestJS API Guard จะถอดรหัสและดึง `userId` ไปประมวลผลในขั้นตอนถัดไป

---

### 6.2 Products Endpoint: `GET /api/v1/products`

ดึงรายการสินค้าพร้อมข้อมูลสต็อกล่าสุดแบบแบ่งหน้า (Read-heavy Path ผ่าน Redis Cache)

- **HTTP Method & Path:** `GET /api/v1/products`
- **Query Parameters:**
  - `page` (`integer`, Optional, Default: `1`, Min: `1`): ลำดับหน้าข้อมูล
  - `limit` (`integer`, Optional, Default: `10`, Min: `1`, Max: `50`): จำนวนรายการต่อหน้า
- **Authentication:** Public Access
- **Response Success (`200 OK`):**
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
- **Stock Semantics (`FROZEN BASELINE`):**
  - `availableStock`: สต็อกตั้งต้นทั้งหมดของช่วง Flash Sale (ค่า Reference คงที่ เช่น 50)
  - `remainingStock`: จำนวนสินค้าคงเหลือที่สามารถขายได้จริง ณ ปัจจุบัน (ลดลงเมื่อมี Order สำเร็จ)

---

### 6.3 Orders Endpoint: `POST /api/v1/orders`

อนุมัติรับคำสั่งซื้อสินค้าแบบ Asynchronous Admission

- **HTTP Method & Path:** `POST /api/v1/orders`
- **Headers:**
  - `Authorization: Bearer <JWT_ACCESS_TOKEN>` (`MUST`, Required)
  - `Content-Type: application/json`
- **Request Body (JSON):**
  ```json
  {
    "productId": "p-1001"
  }
  ```
  - `productId` (`string`, `MUST`, Required): รหัสสินค้าที่ต้องการซื้อ
  - **ข้อห้ามย้ำเตือน:** Client **ห้ามส่ง `userId`** ( API จะดึงจาก JWT เอง) และ **ห้ามส่ง `quantity`** (ระบบบังคับ `quantity = 1` เสมอ)
- **Response Success (`202 Accepted`):**
  ```json
  {
    "status": "processing",
    "orderJobId": "ord-6f4d8f0f-example-sha256",
    "message": "Your order is in the queue."
  }
  ```
- **ความหมายของ `202 Accepted` (`FROZEN BASELINE`):**
  - `202 Accepted` หมายถึง "คำสั่งซื้อผ่านการตรวจสอบเบื้องต้นและถูกยอมรับเข้าสู่ Queue เรียบร้อยแล้ว"
  - **ยังไม่ได้หมายความว่าคำสั่งซื้อตัดสต็อกสำเร็จหรือได้สินค้าแน่นอน** (ผลการซื้อจริงจะถูกตัดสินโดย Worker/PostgreSQL ในภายหลัง)

---

## 7. ข้อกำหนด Error Envelope และ HTTP Status Codes

### 7.1 รูปแบบ Error Envelope มาตรฐาน (`FROZEN BASELINE`):
```json
{
  "status": "error",
  "code": "INVALID_JWT_TOKEN",
  "message": "The provided JWT access token is invalid or expired.",
  "requestId": "req-8f7b2a1c-90de-4321-bbcd-123456789abc"
}
```

### 7.2 ตารางสรุป HTTP Status Codes & Machine Codes:

| Status Code | Code Meaning | Error Code (`code`) | สถานการณ์ที่เกิด |
| --- | --- | --- | --- |
| `200 OK` | Request Succeeded | - | อ่านสินค้า หรือ ออก JWT สำเร็จ |
| `202 Accepted` | Async Job Enqueued | - | รับคำสั่งซื้อเข้า Queue สำเร็จ |
| `400 Bad Request` | Validation Failed | `INVALID_PAYLOAD` | Body สภาพไม่ถูกต้อง หรือ missing `productId` |
| `401 Unauthorized` | Authentication Failed | `INVALID_JWT_TOKEN` | Token ไม่ถูกต้อง, สัญญาณเตือนล้มเหลว หรือ Missing Header |
| `404 Not Found` | Resource Not Found | `PRODUCT_NOT_FOUND` | ไม่พบ `productId` ที่ระบุ |
| `409 Conflict` | Admission In-Flight | `ORDER_ADMISSION_IN_PROGRESS` | Redis Claim มีอยู่แต่ยังยืนยันว่า BullMQ Job ถูกสร้างแล้วไม่ได้ ให้ Client Retry |
| `422 Unprocessable` | Business Validation Fail| `FLASH_SALE_INACTIVE` | สินค้าไม่อยู่ในโปรโมชัน Flash Sale (`isFlashSaleActive = false`) |
| `503 Unavailable` | Dependency Down | `QUEUE_UNAVAILABLE` | Redis Operations ล่ม ไม่สามารถ Enqueue งานได้ |
| `500 Server Error` | Internal Error | `INTERNAL_SERVER_ERROR` | Unhandled Error ในระบบ API |

---

## 8. สิ่งที่ Consumer สามารถและห้ามสันนิษฐาน (Assumptions & Non-Assumptions)

### 8.1 สิ่งที่ Consumer สามารถสันนิษฐานได้ (What Consumers May Assume):
- เมื่อได้ HTTP `202 Accepted` แปลว่า Job ID ถูกสร้างและเข้าคิวเรียบร้อยแล้วแน่นอน
- ข้อมูล `remainingStock` ที่ได้จาก `GET /products` เป็นข้อมูลที่ผ่านการตัดสต็อกที่ยืนยันแล้วใน Database หรือ Read Projection ล่าสุด

### 8.2 สิ่งที่ Consumer ห้ามสันนิษฐาน (What Consumers Must Not Assume):
- **ห้ามสันนิษฐานว่าการได้ `202 Accepted` แปลว่าสั่งซื้อสำเร็จและได้สต็อกแน่นอน**
- **ห้ามส่ง `userId` มาใน Body ของ `POST /orders`** เพราะ API จะยึด `userId` จาก JWT Token เท่านั้นเพื่อความปลอดภัย

---

## 9. พฤติกรรมคำขอซ้ำที่ Freeze แล้ว

- API คำนวณ deterministic `orderJobId` เดิมจาก `(userId, productId)` ทุกครั้ง
- หาก `SET NX` สำเร็จ ให้รอเพียง `queue.add()` สำเร็จแล้วตอบ `202 Accepted` ทันที โดยไม่เรียก `queue.getJob()` ซ้ำในเส้นทางคำขอแรก
- หาก `SET NX` ไม่สำเร็จและ `queue.getJob(orderJobId)` พบ Job เดิม ให้ตอบ `202 Accepted` พร้อม Job ID เดิมแบบ Idempotent
- หาก Claim มีอยู่แต่ยังหา Job ไม่พบ ให้รอแบบสั้นและตรวจซ้ำหนึ่งครั้ง; หากยังไม่พบให้ตอบ `409 ORDER_ADMISSION_IN_PROGRESS` ห้ามตอบ 202 เท็จ
- ผลซื้อจริงยังยึด `order_results`/`orders` ใน PostgreSQL เท่านั้น

---

## 10. กฎความเข้ากันได้และการเปลี่ยนสัญญา (Compatibility Rules)

1. การแก้ไข Contract ในเอกสารนี้ถือเป็น Breaking Change ที่กระทบ Member 1 และ Mobile Client
2. ห้ามลบหรือเปลี่ยนชื่อ Field ที่เป็น `MUST` หรือ `FROZEN BASELINE`
3. การเพิ่ม Optional Response Fields สามารถทำได้แบบ Backward-Compatible
