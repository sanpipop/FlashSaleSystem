# การทดสอบและรวมระบบประจำวันที่ 1 (Day 1 Integration Check)

## Goal
ตรวจสอบว่างานสเกเลตันและโครงสร้างพื้นฐานทั้งหมดจากสมาชิกทั้ง 3 คน สามารถประกอบรวมกัน รันผ่าน Docker Compose และสื่อสารข้ามส่วนได้สำเร็จตามข้อกำหนดของ Day 1

## Owner
Owner: Integration Captain

## Participants
Member 1, Member 2, Member 3

## Priority
P0 (End-of-Day Quality Gate)

## Dependencies
- [project-bootstrap.md](file:///FlashSaleSystem/doc/task/day1/project-bootstrap.md)
- [docker-compose.md](file:///FlashSaleSystem/doc/task/day1/docker-compose.md)
- [api-nginx.md](file:///FlashSaleSystem/doc/task/day1/api-nginx.md)
- [queue-redis.md](file:///FlashSaleSystem/doc/task/day1/queue-redis.md)
- [worker-database.md](file:///FlashSaleSystem/doc/task/day1/worker-database.md)

## Can Start Immediately?
No (เริ่มเวลา 17:30 น. หลังทุกงานย่อยใน Day 1 เสร็จ)

## Integration Checklist & Automated Verification Steps

### 1. Verification Step 1: Docker Compose Up & Service Health Check
```bash
docker compose up --build -d
docker compose ps
```
- **Expected Outcome:** ทุก Container (`nginx`, `api-1`, `api-2`, `api-3`, `worker`, `postgres`, `redis`) มีสถานะ `Up` หรือ `healthy`

### 2. Verification Step 2: Nginx Load Balancing to API Verification
```bash
for i in {1..6}; do curl -s http://localhost/health; echo ""; done
```
- **Expected Outcome:** ได้ตอบกลับ HTTP 200 OK และพบว่า Instance ID สลับกันระหว่าง `api-1`, `api-2`, `api-3`

### 3. Verification Step 3: PostgreSQL Migration & Seed Verification
```bash
docker compose exec postgres psql -U flashsale -d flashsale -c "SELECT product_id, name, remaining_stock FROM products WHERE product_id = 'p-1001';"
```
- **Expected Outcome:** พบข้อมูลสินค้า `p-1001` ชื่อ `Limited Edition Sneaker` สต็อกคงเหลือ `50`

### 4. Verification Step 4: Redis & Queue Connectivity Check
```bash
docker compose exec redis redis-cli ping
```
- **Expected Outcome:** ตอบกลับ `PONG`

---

## Blockers / Resolution Criteria
หากขั้นตอนใดไม่ผ่านตามคาด:
1. ให้หยุดกระบวนการรวมระบบ และตรวจ Log สเปกเฉพาะบริการด้วย `docker compose logs <service>`
2. มอบหมายให้เจ้าของส่วนนั้นแก้ไขทันทีก่อนแยกย้าย
3. ห้ามถือว่า Day 1 เสร็จสิ้นหาก Integration Gate นี้ไม่ผ่าน 100%

## Definition of Done Day 1
ผลการตรวจทั้ง 4 ขั้นตอนผ่านเรียบร้อย ระบบพร้อมสำหรับลงมือพัฒนา Business Logic ใน Day 2
