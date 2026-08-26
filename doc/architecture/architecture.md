# สถาปัตยกรรมรวมของระบบ Flash Sale (High-Level Architecture Overview)

**วันที่อัปเดต:** 26 สิงหาคม 2026  
**สถานะ:** Draft Baseline Architecture (Phase 1)  
**ขอบเขตโปรเจกต์:** Flash Sale Backend System สำหรับ Mobile Application (ทีมพัฒนา 3 คน)

---

## 1. วัตถุประสงค์ของเอกสาร (Purpose)

เอกสารฉบับนี้เป็น **Source of Truth หลักด้านสถาปัตยกรรมระบบ (Architecture Overview)** สำหรับโปรเจกต์ **FlashSaleSystem** จัดทำขึ้นก่อนเริ่มกระบวนการลงมือเขียนโค้ด (Implementation Phase) เพื่อให้สมาชิกในทีมทั้ง 3 คนมีภาพจำและความเข้าใจตรงกัน ลดปัญหาการติดขัดระหว่างเชื่อมต่อระบบ (Integration Blocker) และมั่นใจได้ว่าระบบสามารถรองรับปริมาณคำสั่งซื้อจำนวนมาก (High Concurrency Traffic) ได้อย่างถูกต้อง เที่ยงตรง และมีประสิทธิภาพสูงสุดภายใต้ทรัพยากรที่จำกัด

---

## 2. เป้าหมายทางสถาปัตยกรรม (Architecture Goals)

การออกแบบสถาปัตยกรรมระบบยึดหลักการสำคัญ 5 ประการตามลำดับความสำคัญ (Core Priority):

> **Correctness First → Complete Requirements → Observable → Benchmark → Optimize**

1. **ความถูกต้องของข้อมูลและสต็อก (Data Integrity & Zero Overselling):** ห้ามเกิดกรณี สต็อกติดลบ (`remainingStock < 0`) หรือผู้ใช้คนเดียวกันซื้อสินค้าชิ้นเดียวกันเกิน 1 ชิ้น (`Limit 1 per User per Product`) โดยเด็ดขาด
2. **การรองรับปริมาณคำขอสูง (High Throughput & Low Latency):** ระบบต้องตอบรับคำสั่งซื้อ (API Admission) ได้รวดเร็ว โดยเฉลี่ยไม่เกินระดับ p95 latency ที่กำหนด และสามารถแยกกระบวนการตัดสต็อกที่ใช้เวลานานออกไปทำแบบ Asynchronous
3. **การป้องกันคำขอซ้ำ (Idempotency & Duplicate Protection):** รองรับกรณีผู้ใช้ส่ง Request ซ้ำพร้อมกันหลายครั้ง (Concurrent Duplicate Requests) โดยระบบต้องรับและประมวลผลคำสั่งซื้อที่ถูกต้องเพียงรายการเดียว
4. **ความสามารถในการขยายระบบแนวระนาบ (Horizontal Scalability & Stateless API):** ส่วนประมวลผลหน้าบ้าน (API Instances) ต้องเป็น Stateless 100% ไม่พึ่งพา In-Memory Session บนเครื่อง เพิ่ม/ลด Container ได้อิสระ
5. **ความพร้อมในการติดตามและวัดผล (Observability & Auditability):** สามารถวัดค่า RPS, Latency, Cache Hit Ratio, Queue Backlog และแสดงหลักฐานความถูกต้องของข้อมูลหลังการทดสอบได้อย่างชัดเจน

---

## 3. ข้อจำกัดของโครงสร้างพื้นฐานและทรัพยากร (System Constraints)

โปรเจกต์นี้ถูกออกแบบและติดตั้งบน Virtual Machine (VM) สำหรับการแข่งขัน โดยมีข้อจำกัดทรัพยากรที่ต้องจัดสรร (Resource Budget Awareness) ดังนี้:

| ทรัพยากร | ข้อจำกัด / ขนาด | ผลกระทบต่อการออกแบบสถาปัตยกรรม |
| --- | --- | --- |
| **CPU** | 4 vCPU | ห้ามสร้าง Microservices หรือ Container ย่อยมากเกินไป ต้องประหยัด CPU Context Switch |
| **RAM** | 6 GB | ต้องควบคุมขนาด Connection Pool, Redis Memory และ Node.js Heap Size |
| **Disk** | 50 GB | ใช้สำหรับ Docker Images, Database Storage และ Log Files |
| **Environment** | 1 Single VM | บริการทั้งหมดรันผ่าน **Docker Compose** ภายใน VM เครื่องเดียวกัน |
| **Load Testing** | External Machine | เครื่องมือทดสอบโหลด (เช่น k6) ต้องยิงมาจากภายนอก VM เพื่อไม่ให้แย่ง CPU/RAM ระบบ |
| **Team Size** | 3 คน | แบ่งขอบเขตความรับผิดชอบชัดเจน (API/Nginx, Queue/Redis, Worker/DB) ไม่บล็อกงานกัน |

---

## 4. องค์ประกอบหลักของระบบ (System Components)

สถาปัตยกรรมแบ่งออกเป็น 11 องค์ประกอบหลัก โดยแต่ละส่วนมีหน้าที่เฉพาะเจาะจง:

```mermaid
graph TD
    subgraph External System
        Client["External Mobile / Browser"]
        k6["External k6 Load Generator"]
    end

    subgraph Edge Layer
        Nginx["Nginx Reverse Proxy / Load Balancer"]
    end

    subgraph API Layer Stateless
        API1["NestJS API Instance 1"]
        API2["NestJS API Instance 2"]
        API3["NestJS API Instance 3"]
    end

    subgraph Data & Queue Layer
        RedisCache["Redis Cache (Product Cache)"]
        RedisOps["Redis Operations (BullMQ Queue / Dedup)"]
        Worker["BullMQ Worker (Order Processor)"]
        PostgreSQL[("PostgreSQL (Persistent Source of Truth)")]
    end

    subgraph Observability Layer
        BullBoard["Bull Board (Queue Dashboard)"]
        Metrics["Metrics Stack (Prometheus / Grafana)"]
        Logs["Structured Logs (Request ID / Job ID)"]
    end

    Client --> Nginx
    k6 --> Nginx
    Nginx -->|Least Connections / Round Robin| API1
    Nginx -->|Least Connections / Round Robin| API2
    Nginx -->|Least Connections / Round Robin| API3

    API1 -->|Read Product| RedisCache
    API2 -->|Read Product| RedisCache
    API3 -->|Read Product| RedisCache

    API1 -->|Enqueue Job / Atomic Dedup| RedisOps
    API2 -->|Enqueue Job / Atomic Dedup| RedisOps
    API3 -->|Enqueue Job / Atomic Dedup| RedisOps

    RedisOps -->|Fetch Job| Worker
    Worker -->|Execute Transaction & Lock Stock| PostgreSQL
    Worker -->|Invalidate / Update Cache| RedisCache

    RedisOps -.-> BullBoard
    API1 -.-> Logs
    API2 -.-> Logs
    API3 -.-> Logs
    Worker -.-> Logs
    API1 -.-> Metrics
    API2 -.-> Metrics
    API3 -.-> Metrics
    Worker -.-> Metrics
```

### หน้าที่และข้อห้ามของแต่ละ Component (Component Responsibilities & Boundaries)

1. **Nginx Reverse Proxy:**
   - **หน้าที่:** เป็น Public Entry Point รับ HTTP Traffic ทั้งหมด, กระจาย Load ไปยัง NestJS API ด้วย Least Connections หรือ Round Robin, จัดการ SSL/TLS Termination (ถ้ามี)
   - **ข้อห้าม:** ห้ามประมวลผล Business Logic หรือตรวจสอบ JWT Authentication ใน Nginx

2. **NestJS API Instances (อย่างน้อย 3 Container):**
   - **หน้าที่:** ตรวจสอบความถูกต้องของ JWT Token, รับและตรวจสอบ Request Format, ดึงข้อมูลสินค้าจาก Redis Cache ( Cache-Aside), คำนวณ Atomic Deduplication และ Enqueue งานไปยัง BullMQ ก่อนตอบกลับ `202 Accepted`
   - **ข้อห้าม:** **ห้ามเปิด Database Transaction เพื่อตัดสต็อกโดยตรง**, ห้ามเก็บ In-Memory Session หรือ Local State ที่ทำให้ระบบไม่เป็น Stateless

3. **Redis Cache (Product Listing & Read Cache):**
   - **หน้าที่:** เก็บแคชข้อมูลรายการสินค้า และข้อมูลแบ่งหน้า (Pagination) เพื่อรับ Read-Heavy Load (`GET /api/v1/products`)
   - **ข้อห้าม:** **ห้ามใช้ Redis Cache เป็น Persistent Source of Truth ของ Order หรือ Remaining Stock**

4. **Redis Operations / BullMQ:**
   - **หน้าที่:** เก็บ Queue Job ของ BullMQ และทำหน้าที่เป็น Atomic Protection ในระดับ Admission
   - **ข้อห้าม:** ห้ามใช้เป็นที่เก็บข้อมูลถาวร (Persistent Storage) ระยะยาว

5. **BullMQ Worker:**
   - **หน้าที่:** ดึง Job คำสั่งซื้อจาก Queue มาเปิด Database Transaction ทำการล็อกแถวสินค้า (Row-level locking), ตรวจสอบเงื่อนไขการซื้อ, บันทึก Order, ตัดสต็อกลง PostgreSQL และล้าง Cache เมื่อสำเร็จ
   - **ข้อห้าม:** ห้ามตอบกลับ HTTP Response ตรงไปยัง Client

6. **PostgreSQL (Database):**
   - **หน้าที่:** เป็น **Persistent Source of Truth สัมบูรณ์** สำหรับข้อมูลสินค้า, สต็อกสินค้าคงเหลือ, ประวัติการสั่งซื้อ และ UNIQUE Constraints (`user_id`, `product_id`)
   - **ข้อห้าม:** ห้ามใช้เป็น Read Cache สำหรับ High-Frequency Read Traffic โดยไม่ผ่าน Redis Cache

7. **Bull Board / Metrics / Logs:**
   - **หน้าที่:** ติดตามสถานะ Queue, ประสิทธิภาพ HTTP, อัตรา Cache Hit Ratio, ทรัพยากร VM และประสาน Traceability ผ่าน Request ID / Job ID

---

## 5. ความเป็นเจ้าของข้อมูล (Data Ownership Matrix)

| ประเภทข้อมูล | Storage / Location หลัก | ผู้เขียนข้อมูล (Write Owner) | ผู้อ่านข้อมูล (Read Owner) | บทบาททางสถาปัตยกรรม |
| --- | --- | --- | --- | --- |
| **Product Information & Stock Truth** | PostgreSQL | PostgreSQL Migration / Admin | BullMQ Worker / API | **Persistent Source of Truth** |
| **Order Record & Purchase Result** | PostgreSQL | BullMQ Worker | API / Database | **Persistent Source of Truth** |
| **Product Read Cache** | Redis Cache | API (Cache-Aside) / Worker (Invalidation) | NestJS API | Volatile Read Replica |
| **Pending Order Queue & Job State** | Redis Operations | NestJS API (Producer) | BullMQ Worker (Consumer) | Temporary Processing Queue |
| **User Authentication / Claims** | Client Side (JWT) | Auth Endpoint (`POST /auth/token`) | NestJS API (JWT Guard) | Stateless Credential |

---

## 6. รูปแบบการสื่อสารภายในระบบ (Communication Patterns)

1. **Synchronous Path (เน้นความเร็วในการอ่านข้อมูลและตอบรับ):**
   - `Client → Nginx → NestJS API` (HTTP RESTful)
   - `NestJS API → Redis Cache` (Redis Protocol - Single Round-trip)
   - Response: `200 OK` สำหรับ Auth/Products หรือ `202 Accepted` สำหรับ Order Admission
2. **Asynchronous Path (เน้นความถูกต้องและความทนทานของข้อมูล):**
   - `NestJS API → Redis Operations / BullMQ` (Enqueue Job)
   - `BullMQ Queue → BullMQ Worker` (Job Event Consumption)
   - `BullMQ Worker → PostgreSQL` (TCP / Connection Pool w/ ACID Transaction)
   - `BullMQ Worker → Redis Cache` (Post-commit Invalidation Signal)

---

## 7. แบบโมเดลการขยายระบบและการจัดการทรัพยากร (Scaling Model & Resource Budget)

- **Stateless API Scaling:** API สามารถขยายแนวนอนจาก 3 เป็น N Instances ได้ทันทีเมื่อ CPU สูงขึ้น โดยไม่ต้องปรับแต่ง Code
- **Worker Scaling:** จำนวน Worker Concurrency ต้องถูกปรับแต่งตามขนาด Connection Pool ของ PostgreSQL (เช่น max 30 connection pool) เพื่อป้องกัน Database CPU Overhead หรือ Connection Exhaustion
- **Resource Allocation Rules:**
  - Nginx: 0.5 vCPU / 256 MB RAM
  - API Instances (x3): 1.5 vCPU / 1.5 GB RAM รวม
  - Worker: 0.75 vCPU / 768 MB RAM
  - Redis (Cache + Queue): 0.5 vCPU / 1 GB RAM
  - PostgreSQL: 0.75 vCPU / 1.5 GB RAM

---

## 8. การเปรียบเทียบระหว่าง Baseline Architecture และ Candidate Optimizations

เอกสารฉบับนี้กำหนดให้แบ่งแยกระหว่าง **ของที่ต้องทำ (Baseline Requirements)** และ **เทคนิคเพิ่มความเร็วที่รอการทดสอบ (Candidate Optimizations)** อย่างชัดเจน:

### 8.1 Baseline Architecture (ข้อบังคับสำหรับระบบพื้นฐาน - MUST HAVE)

- **LB & API:** Nginx Round Robin / Least Connections กระจายเข้า NestJS API 3 Containers
- **Auth:** Stateless JWT Authentication
- **Products API:** Read Cache แบบ Cache-Aside Pattern ด้วย Redis
- **Orders API:** รับคำสั่งซื้อ อนุมัติผ่าน Queue และตอบ `202 Accepted` ทันที
- **Queue System:** ใช้ BullMQ ประมวลผล Order Asynchronously ทีละงานหรือแบบควบคุม Concurrency
- **Database Safety:** ใช้ PostgreSQL Transaction ร่วมกับ Row Locking (เช่น `SELECT ... FOR UPDATE`) และ `UNIQUE(user_id, product_id)` constraint
- **Cache Invalidation:** Worker ลบหรือล้าง Product Cache หลัง PostgreSQL Transaction Commit สำเร็จ

### 8.2 Candidate Optimizations (ตัวเลือกปรับแต่งประสิทธิภาพ - PENDING BENCHMARK)

> [!NOTE]
> รายการต่อไปนี้เป็นข้อเสนอแนะเพื่อเร่งความเร็วในการแข่งขัน (เช่น ข้อมูลในไฟล์ `Flash_Sale_Competition_Fastest_Safe_TH.docx`) แต่ **ยังไม่ใช่ข้อบังคับ baseline** ต้องผ่านการพิสูจน์ด้วย k6 benchmark ใน Phase 4-5 ก่อน:

1. **Deterministic Job ID Deduplication (Single Redis Hop):** คำนวณ Job ID = `SHA-256(userId|productId)` ส่งให้ `queue.add` เพื่อรวบขั้นตอน Deduplicate และ Enqueue ใน Redis call เดียว
2. **Micro-batching Worker (`place_order_batch`):** รวมงานใน Queue 10–32 Jobs รันผ่าน PostgreSQL Stored Procedure ใน Transaction เดียวเพื่อลด DB Round-trips
3. **Queue Lane Sharding (8 Queue Lanes):** แยก Queue ย่อยตาม Hash ของ Product ID เพื่อลด Lock Contention
4. **Stock Projection / Confirmed Sold-Out Marker:** ให้ Worker เขียน Sold-Out Marker ลง Redis หลัง DB Commit เพื่อให้ API ข้ามการ Enqueue สำหรับสินค้าที่หมดแล้ว
5. **Multi-Instance Redis Separation:** แยก Redis Cache (Port 6380) ออกจาก Redis Queue (Port 6379) เพื่อป้องกัน I/O และ Memory Contention

---

## 9. หลักการสำคัญทางสถาปัตยกรรม (Architecture Principles)

1. **Single Source of Truth:** PostgreSQL เป็นคำตอบสุดท้ายของสต็อกและคำสั่งซื้อเสมอ
2. **Fail-Safe Cache:** หาก Redis Cache ขัดข้อง ระบบต้องสามารถ Fallback ไปอ่าน PostgreSQL ได้โดยไม่ทำให้สต็อกผิดพลาด
3. **No In-Memory Authority:** ห้ามใช้ In-Memory State ของ API Instance ในการตัดสินผลทางธุรกิจ
4. **Traceable Operations:** ทุกคำขอต้องมี Request ID และ Job ID สำหรับการสืบค้นย้อนหลัง
