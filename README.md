# Flash Sale System

ระบบ Backend สำหรับการแข่งขัน Flash Sale ที่ออกแบบให้รับคำขอพร้อมกันจำนวนมากบน VM เครื่องเดียว โดยให้ความสำคัญตามลำดับคือ **ข้อมูลถูกต้อง → ตรงตาม Requirement → ตอบกลับเร็ว → วัดผลได้ → ปรับแต่งจาก Benchmark**

> **สถานะปัจจุบัน:** Architecture, Shared Contracts และแผนพัฒนาเสร็จแล้ว อยู่ระหว่างเริ่ม Implementation

## เป้าหมายหลัก

- ผู้ใช้หนึ่งคนซื้อสินค้าแต่ละรหัสได้สูงสุดหนึ่งชิ้น
- สต็อกใน PostgreSQL ต้องไม่ติดลบและห้ามขายเกินจำนวน
- รองรับคำขอซ้ำและคำขอพร้อมกันโดยไม่สร้าง Order ซ้ำ
- ตอบรับคำสั่งซื้ออย่างรวดเร็วด้วย Queue แบบ Asynchronous
- รองรับ Read-heavy traffic ด้วย Redis Cache
- รันบริการทั้งหมดด้วย Docker Compose บน VM ขนาด 4 vCPU และ RAM 6 GB

## Architecture Overview

```mermaid
flowchart LR
    Client[Mobile / Browser / k6] --> Nginx[Nginx Load Balancer]
    Nginx --> API[NestJS + Fastify API x3]

    API -->|GET products: Cache-Aside| Cache[(Redis Cache)]
    Cache -->|Cache miss| DB[(PostgreSQL)]

    API -->|Atomic claim + enqueue| Queue[(Redis Operations + BullMQ)]
    Queue --> Worker[BullMQ Worker]
    Worker -->|ACID transaction + stock lock| DB
    Worker -->|Invalidate after commit| Cache

    API -. metrics / logs .-> Observe[Prometheus / Grafana]
    Worker -. metrics / logs .-> Observe
    Queue -. queue status .-> Board[Bull Board]
```

ระบบใช้ API แบบ Stateless จำนวน 3 Instance หลัง Nginx เพื่อกระจายโหลด ส่วน Redis มีบทบาททางตรรกะแยกกันระหว่าง Queue/Admission และ Product Cache โดย PostgreSQL เป็นแหล่งข้อมูลจริงเพียงแห่งเดียวสำหรับ Order และ Stock

## Request Flows

### อ่านรายการสินค้า

```text
Client → Nginx → API → Redis Cache
                         └─ Cache miss → PostgreSQL → เติม Cache → Response
```

ใช้ Cache-Aside เพื่อลดภาระ PostgreSQL สำหรับ `GET /api/v1/products` หาก Cache ใช้งานไม่ได้ API ต้องอ่านจาก PostgreSQL ได้โดยไม่ทำให้ข้อมูลธุรกิจผิดพลาด

### สั่งซื้อสินค้า

```text
Client → Nginx → API
→ ตรวจ JWT และ Request
→ Atomic duplicate claim ใน Redis
→ เพิ่ม Job เข้า BullMQ
→ ตอบ 202 Accepted

BullMQ → Worker
→ PostgreSQL Transaction
→ ตรวจ Duplicate และล็อก/ลด Stock แบบ Atomic
→ บันทึก Order
→ Commit
→ Invalidate Product Cache
```

`202 Accepted` หมายถึงระบบรับงานเข้าคิวสำเร็จเท่านั้น ไม่ได้หมายความว่าผู้ใช้ได้สินค้าแล้ว ผลถาวรต้องตัดสินจาก Transaction ใน PostgreSQL

## Correctness and Concurrency

ระบบป้องกันความผิดพลาดหลายชั้น:

1. **API admission:** ใช้ Redis Atomic Operation เช่น `SET ... NX` ป้องกันผู้ใช้ส่งคำขอเดิมพร้อมกันหลายครั้ง
2. **Queue idempotency:** ใช้ Deterministic Job ID จาก `userId` และ `productId` เพื่อลดโอกาสสร้าง Job ซ้ำ
3. **Database transaction:** Worker ตรวจและลด Stock ภายใน Transaction พร้อม Row Lock หรือ Atomic Conditional Update
4. **Unique constraint:** PostgreSQL บังคับ `UNIQUE(user_id, product_id)` เป็นด่านสุดท้ายของกฎหนึ่งคนต่อหนึ่งสินค้า
5. **Cache invalidation:** ล้างหรือเปลี่ยนรุ่น Cache หลัง Database Commit สำเร็จเท่านั้น

Redis ช่วยให้ตัดสินใจเร็วในเส้นทางรับคำขอ แต่ไม่ใช่ Source of Truth หากข้อมูล Redis กับ PostgreSQL ไม่ตรงกัน ต้องยึด PostgreSQL เสมอ

## API Surface

| Method | Endpoint | หน้าที่ |
| --- | --- | --- |
| `POST` | `/api/v1/auth/token` | ออก JWT จาก `userId` |
| `GET` | `/api/v1/products` | อ่านรายการสินค้าแบบ Pagination ผ่าน Cache-Aside |
| `POST` | `/api/v1/orders` | รับคำขอสั่งซื้อเข้า Queue และตอบ `202 Accepted` |

รายละเอียด Request, Response และ Error Code อยู่ใน [API Contract](doc/contracts/api-contract.md)

## Technology Stack

| ส่วน | เทคโนโลยี |
| --- | --- |
| Edge / Load Balancing | Nginx |
| API | NestJS, Fastify, JWT |
| Queue / Admission | BullMQ, Redis Atomic Operations |
| Cache | Redis Cache-Aside |
| Worker | NestJS/BullMQ Worker |
| Durable Storage | PostgreSQL, ACID Transaction, Constraints |
| Runtime | Docker Compose บน Single VM |
| Observability | Structured Logs, Prometheus, Grafana, Bull Board |
| Performance Testing | k6 จากเครื่องภายนอก VM |

## Benchmark-Gated Optimizations

เทคนิคต่อไปนี้เป็น Candidate Optimization ต้องเปิดใช้ต่อเมื่อผล k6 แสดงว่าดีกว่า Baseline และยังรักษาความถูกต้องของข้อมูล:

- Queue lane sharding ตาม Product ID
- Worker micro-batching และ PostgreSQL batch function
- Redis sold-out marker ที่เขียนหลัง Database Commit
- แยก Redis Queue และ Redis Cache เป็นคนละ Instance

## Branch Flow

```text
feat/* → develop → main
```

สมาชิกสร้าง Branch ตามงานจาก `develop` แล้วเปิด Pull Request กลับเข้า `develop` เมื่อระบบรวมพร้อมจึงเปิด Pull Request จาก `develop` เข้า `main` รายละเอียดอยู่ใน [CONTRIBUTING.md](CONTRIBUTING.md)
