# 🛠️ คู่มือการใช้งาน k6 Support Tools (`k6/support/`)

โฟลเดอร์ `k6/support/` รวบรวมเครื่องมือเสริมและ Automation Scripts สำหรับการทำ Benchmark, การเก็บหลักฐาน (Telemetry Evidence), การจัดการคิว BullMQ และการตรวจสอบความถูกต้องของข้อมูล (Data Integrity)

---

## 📂 สรุปไฟล์ทั้งหมดใน `k6/support/`

| ไฟล์ | ประเภท | หน้าที่หลัก |
| :--- | :--- | :--- |
| **`queue-admin.mjs`** | Node.js | จัดการคิว BullMQ (ตรวจสอบสถานะ, รอระบายคิว `wait-drain`, ล้าง Claim `clear-claims`, รีเซ็ตคิว) |
| **`capture-mixed-target.sh`** | Bash | สคริปต์ Background Monitor จับ CPU, Memory, PostgreSQL Locks, Redis Ops, และ Worker Metrics ทุก 1–2 วินาที |
| **`capture-target-evidence.sh`** | Bash | สคริปต์ดึงหลักฐานของ Single-scenario Benchmark |
| **`collect-target-metadata.sh`** | Bash | ดึงข้อมูลสเปกเครื่องเป้าหมาย (OS, Kernel, CPU, Docker version, Git commit) |
| **`mixed-metadata.mjs`** | Node.js | สร้างและอัปเดตไฟล์ `metadata.json` เพื่อประเมินผลการทดสอบ (Pass/Fail) |
| **`metadata.mjs`** | Node.js | จัดการ Metadata สำหรับ Single Profile Test |
| **`reset-state.sql`** | SQL | ล้าง Orders และคืนสต็อกสินค้า `p-1001` ให้กลับมาเป็น 50 ชิ้น |
| **`verify-integrity.sql`** | SQL | ตรวจสอบความถูกต้องของ Orders, Duplicate และสต็อกหลังยิงเสร็จ |
| **`verify-reset.sql`** | SQL | ตรวจสอบว่าระบบอยู่ในสถานะพร้อมทดสอบ (Precondition Check) |

---

## 1. การใช้งาน `queue-admin.mjs` (จัดการคิว BullMQ)

`queue-admin.mjs` ต้องรันผ่าน Node.js ที่มี Environment ของ Worker/Redis

### 1.1 รันบน Local Docker
```bash
# รอให้ Worker ประมวลผลคิวที่ค้างอยู่จนหมด (Timeout 30 วินาที)
docker compose run --rm --no-deps worker node /app/apps/worker/benchmark-support/queue-admin.mjs wait-drain --timeout-ms 30000

# ล้าง Claim การจองสต็อกใน Redis (fs:claim:order:*:p-1001)
docker compose run --rm --no-deps worker node /app/apps/worker/benchmark-support/queue-admin.mjs clear-claims --product p-1001

# ล้างคิวและประวัติงานทั้งหมดใน BullMQ
docker compose run --rm --no-deps worker node /app/apps/worker/benchmark-support/queue-admin.mjs reset-queue
```

### 1.2 รันบน Target VM ผ่าน SSH
```bash
# สั่ง Target VM รอระบายคิวจนหมด
ssh admin@172.30.58.6 "cd /srv/project_backend/FlashSaleSystem && \
  docker compose run --rm --no-deps \
  -v /srv/project_backend/FlashSaleSystem/k6/support:/app/apps/worker/benchmark-support:ro \
  worker node /app/apps/worker/benchmark-support/queue-admin.mjs wait-drain --timeout-ms 30000"
```

---

## 2. การใช้งาน Background Telemetry Monitor (`capture-mixed-target.sh`)

สคริปต์นี้จะถูกเรียกอัตโนมัติจาก `run-mixed-stress.sh` หรือ `run-mixed-stress-NAC.sh` เพื่อจับ Monitor เครื่องเป้าหมายแบบละเอียด

### คำสั่งรันโดยตรง (กรณีต้องการจับ Monitor เอง):
```bash
# พารามิเตอร์: <TARGET_REPO_DIR> <MONITOR_SECONDS> <INTERVAL_SECONDS>
bash k6/support/capture-mixed-target.sh /srv/project_backend/FlashSaleSystem 75 1 > target-monitor.tar.gz
```

**สิ่งที่สคริปต์นี้บันทึกออกมา:**
1. `docker-stats.txt`: CPU/RAM usage ของทุก Container
2. `cgroup-before.txt / cgroup-after.txt`: สถิติ CPU Throttling (`nr_throttled`, `throttled_usec`)
3. `postgres-samples.txt`: จำนวน Connection, Active State, และ Lock Contention ของ PostgreSQL ทุกๆ 2 วินาที
4. `redis-samples.txt`: Connected Clients, Memory, Ops/Sec ของ `redis-cache` และ `redis-ops`
5. `bullmq-worker-samples.txt`: Metrics คิวและ Batch Duration ของ Worker

---

## 3. การใช้งาน `collect-target-metadata.sh` (ดึงสเปกเครื่อง)

ใช้ตรวจสอบสภาพแวดล้อมของ Target VM ก่อนเริ่ม Benchmark:

```bash
# รันผ่าน SSH เพื่อดูข้อมูลสภาพแวดล้อมของ VM
ssh admin@172.30.58.6 "sh -s -- /srv/project_backend/FlashSaleSystem" < k6/support/collect-target-metadata.sh
```

**ตัวอย่างข้อมูลที่ได้:**
* Hostname, OS Architecture, CPU Cores
* Git Commit Hash ล่าสุดบน VM
* Docker Compose Services & Container IDs
* ขนาด RAM และ Swap

---

## 4. การรัน SQL Scripts ด้วย `psql`

### 4.1 รีเซ็ต Database (`reset-state.sql`)
```bash
docker compose exec -T postgres psql -U flashsale -d flashsale < k6/support/reset-state.sql
```

### 4.2 ตรวจสอบความถูกต้องของข้อมูลหลังทดสอบ (`verify-integrity.sql`)
```bash
docker compose exec -T postgres psql -U flashsale -d flashsale < k6/support/verify-integrity.sql
```

### 4.3 ตรวจสอบความพร้อมก่อนเริ่มทดสอบ (`verify-reset.sql`)
```bash
docker compose exec -T postgres psql -U flashsale -d flashsale < k6/support/verify-reset.sql
```

---

## 5. การทำงานร่วมกับ `run-mixed-stress-NAC.sh`

ไฟล์ทั้งหมดใน `k6/support/` ถูกออกแบบให้ทำงานร่วมกันแบบอัตโนมัติ (Pipeline Flow):
1. `collect-target-metadata.sh` $\rightarrow$ บันทึกสเปกเริ่มต้น
2. `verify-reset.sql` $\rightarrow$ ตรวจสอบ Precondition
3. `capture-mixed-target.sh` $\rightarrow$ เริ่มบันทึก Telemetry ใน Background
4. `k6/LoadtestNAC.js` $\rightarrow$ ยิง Load Test
5. `queue-admin.mjs (wait-drain)` $\rightarrow$ รอ Worker ตัดสต็อกเสร็จ
6. `verify-integrity.sql` $\rightarrow$ ยืนยันผลลัพธ์ว่าสต็อกเหลือ 0 และออเดอร์มี 50 ใบพอดี
7. `mixed-metadata.mjs` $\rightarrow$ สรุปผล Pass/Fail ลง `metadata.json`
