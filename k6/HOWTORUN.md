# 🚀 คู่มือการรัน k6 Load Test (Flash Sale System)

คู่มือนี้รวบรวมวิธีรันชุดทดสอบ Performance และ Benchmark ทั้งหมดในโฟลเดอร์ `k6/` ทั้งการยิงใส่ **Local Docker** และยิงใส่ **Target VM (172.30.58.6 หรือ 172.30.58.10)**

---

## ⚡ Quick Recipes (คำสั่งลัดยอดนิยม — ก๊อปปี้ไปวางได้ทันที)

### 📌 1. คำสั่งเทพ: สั่ง Reset Database บน VM + รัน Full Mixed Stress จบในคำสั่งเดียว
```bash
cd /home/netiwut/Documents/shareproject/FlashSaleSystem && \
ssh admin@172.30.58.6 "cd /srv/project_backend/FlashSaleSystem && CONFIRM_BENCHMARK_RESET=YES bash scripts/reset-db.sh" && \
CONFIRM_MIXED_STRESS_RUN=YES \
BASE_URL=http://172.30.58.6 \
TARGET_SSH=admin@172.30.58.6 \
TARGET_REPO_DIR=/srv/project_backend/FlashSaleSystem \
RUN_ID="baseline-mixed-r3-$(date -u +%Y%m%dT%H%M%SZ)" \
bash k6/run-mixed-stress.sh
```

*(หรือเปลี่ยนเป็น `bash k6/run-mixed-stress-NAC.sh` เพื่อใช้ตัววัดระดับ Next-Gen พร้อม Cache Observability)*

---

### 📌 2. คำสั่ง Reset Database บน Target VM โดยตรง (SSH เข้าไปรัน)
```bash
CONFIRM_BENCHMARK_RESET=YES bash scripts/reset-db.sh
```

---

### 📌 3. ยิงตรงผ่าน k6 ไปยัง Target IP (เช่น `172.30.58.10` หรือ `172.30.58.6`)
```bash
BASE_URL="http://172.30.58.10" \
WRITE_MAX_DURATION=45s \
k6 run k6/LoadtestO.js
```
*(หรือเปลี่ยนเป็น `k6 run k6/LoadtestNAC.js` เพื่อดูสถิติ Cache HIT/MISS และ Latency Percentiles)*

---

## 📂 สรุปไฟล์ในโฟลเดอร์ `k6/`

| ไฟล์ | รายละเอียด |
| :--- | :--- |
| **`LoadtestNAC.js`** | ⭐ **(แนะนำตัวนี้)** Next-Gen Load Test รองรับ Cache Observability (HIT/MISS), TTFB breakdown, Stampede Detection, Percentiles (p50/p90/p95/p99/max) |
| **`LoadtestO.js`** | Script Benchmark หลัก (Mixed Load: 1,000 Read VUs + 500 Write VUs แย่ง 50 ชิ้น) |
| **`flash-sale.js`** | Script มาตรฐาน (รองรับ profile: `auth`, `read`, `write`, `duplicate`) |
| **`run-mixed-stress-NAC.sh`** | Shell wrapper อัตโนมัติสำหรับ `LoadtestNAC.js` (เก็บหลักฐานใน `artifacts/day5/stress-nac/`) |
| **`run-mixed-stress.sh`** | Shell wrapper อัตโนมัติสำหรับ `LoadtestO.js` (เก็บหลักฐานใน `artifacts/day5/stress/`) |
| **`run-external.sh`** | Shell wrapper สำหรับ `flash-sale.js` |

---

## 1. วิธียิงใส่ Local Docker (`localhost`)

> 💡 **ก่อนยิงทุกครั้ง:** แนะนำให้ Reset Data เพื่อให้สต็อกสินค้า `p-1001` กลับมาเป็น 50 ชิ้น:
> ```bash
> sh scripts/reset-target-state.sh
> ```

### 1.1 รันแบบเร็ว (Default: Read 1,000 VUs + Write 500 VUs)
```bash
# รัน LoadtestNAC.js (แสดงสถิติ Cache & Percentiles ครบถ้วน)
k6 run -e BASE_URL=http://localhost:80 k6/LoadtestNAC.js

# หรือรัน LoadtestO.js
k6 run -e BASE_URL=http://localhost:80 k6/LoadtestO.js
```

### 1.2 รันแบบปรับลดโหลด (สำหรับเครื่อง Dev ที่ CPU ไม่พอ)
```bash
k6 run \
  -e BASE_URL=http://localhost:80 \
  -e READ_VUS=200 \
  -e READ_DURATION=15s \
  -e WRITE_VUS=100 \
  -e WRITE_ITERATIONS=3 \
  -e WRITE_START_TIME=5s \
  k6/LoadtestNAC.js
```

### 1.3 รันโหมดทดสอบ Hot-Key Contention (ทดสอบ Cache Key เดียวรัวๆ)
```bash
k6 run \
  -e BASE_URL=http://localhost:80 \
  -e ENABLE_HOT_KEY_TEST=true \
  -e HOT_KEY_VUS=500 \
  -e HOT_KEY_DURATION=10s \
  k6/LoadtestNAC.js
```

---

## 2. วิธียิงใส่ Target VM (`172.30.58.6` หรือ `172.30.58.10`)

### วิธีที่ 2.1: รันผ่าน k6 CLI ตรงๆ (เน้นดูผลลัพธ์สดบนหน้าจอ)
วิธีนี้ง่ายและเร็วที่สุด ไม่ต้องต่อ SSH เหมาะสำหรับดูค่า Latency และข้อผิดพลาดแบบ Real-time:

```bash
# 1. ยิงด้วย LoadtestNAC.js (โหมดปกติ)
k6 run -e BASE_URL=http://172.30.58.6:80 k6/LoadtestNAC.js

# 2. ยิงพร้อม Export ผลลัพธ์เป็นไฟล์ JSON
k6 run \
  -e BASE_URL=http://172.30.58.6:80 \
  -e SUMMARY_PATH=my-result.json \
  k6/LoadtestNAC.js
```

---

### วิธีที่ 2.2: รันผ่าน Full Automation Wrapper (`run-mixed-stress-NAC.sh` หรือ `run-mixed-stress.sh`)
วิธีนี้เป็นวิธีมาตรฐานระดับ Production Benchmark โดย Script จะ:
1. ต่อ SSH ไปดึง Telemetry และตรวจสอบ Database Pre-condition บน VM
2. สั่งเริ่มตัว Monitor CPU/Memory บน VM
3. รัน k6 Load Test
4. รอ Worker เคลียร์คิวให้หมด (`wait-drain`)
5. ตรวจสอบ SQL Integrity (สต็อกต้อง = 0, ออเดอร์ต้อง = 50, ไม่มี duplicate)
6. บันทึก Artifact ทั้งหมดลงใน `artifacts/day5/stress-nac/<RUN_ID>/` หรือ `artifacts/day5/stress/<RUN_ID>/`

**คำสั่งรัน (NAC Edition):**
```bash
BASE_URL=http://172.30.58.6:80 \
TARGET_SSH=admin@172.30.58.6 \
TARGET_REPO_DIR=/srv/project_backend/FlashSaleSystem \
CONFIRM_MIXED_STRESS_RUN=YES \
bash k6/run-mixed-stress-NAC.sh
```

**ถ้าต้องการเปิด Hot-Key Contention ผ่าน Wrapper:**
```bash
BASE_URL=http://172.30.58.6:80 \
TARGET_SSH=admin@172.30.58.6 \
TARGET_REPO_DIR=/srv/project_backend/FlashSaleSystem \
CONFIRM_MIXED_STRESS_RUN=YES \
ENABLE_HOT_KEY_TEST=true \
HOT_KEY_VUS=2000 \
bash k6/run-mixed-stress-NAC.sh
```

---

## 3. สรุป Environment Variables ที่ปรับแต่งได้

| ตัวแปร | ค่า Default | คำอธิบาย |
| :--- | :--- | :--- |
| `BASE_URL` | `http://localhost:8080` | URL ปลายทาง (เช่น `http://172.30.58.6:80` หรือ `http://172.30.58.10`) |
| `TARGET_PRODUCT_ID`| `p-1001` | Product ID ที่ต้องการยิงแย่งซื้อ |
| `READ_VUS` | `1000` | จำนวน Concurrent Users ฝั่ง Read |
| `READ_DURATION` | `30s` | ระยะเวลาที่ยิง Read |
| `WRITE_VUS` | `500` | จำนวน Concurrent Users ฝั่ง Write (แย่งสต็อก) |
| `WRITE_ITERATIONS` | `3` | จำนวนครั้งที่แต่ละ User กดรัวสั่งซื้อ |
| `WRITE_START_TIME` | `10s` | วินาทีที่เริ่มปล่อย Write โถมเข้ามา |
| `WRITE_MAX_DURATION`| `45s` | Timeout สูงสุดของ Write Scenario |
| `ENABLE_HOT_KEY_TEST`| `false` | เปิด/ปิด Scenario ยิงเจาะจง Cache Key เดียว (`true`/`false`) |
| `HOT_KEY_VUS` | `2000` | จำนวน VU ที่ใช้ยิง Hot-Key |
| `BODY_SAMPLE_RATE` | `0.001` | อัตราการสุ่มปริ้นต์ Response Body (0.1%) |
| `SUMMARY_PATH` | `loadtest-nac.k6-summary.json` | Path ไฟล์ JSON สรุปผล |

---

## 4. การตรวจสอบความถูกต้องหลังยิงเสร็จ (Data Integrity Gate)

หลังจากยิงเสร็จ ให้ตรวจสอบ Database บนเป้าหมาย (Local หรือ VM):

```bash
# 1. เช็กว่าสต็อกเหลือ 0 ชิ้นพอดี (ห้ามติดลบ)
docker compose exec postgres psql -U flashsale -d flashsale_db -c "SELECT remaining_stock FROM products WHERE id = 'p-1001';"

# 2. เช็กว่ายอด Order สำเร็จได้ 50 ใบ และ User ID ไม่ซ้ำกัน
docker compose exec postgres psql -U flashsale -d flashsale_db -c "SELECT COUNT(*), COUNT(DISTINCT user_id) FROM orders WHERE product_id = 'p-1001';"

# 3. เช็กสต็อกใน Redis Ops
docker compose exec redis-ops redis-cli GET stock:flash_sale:p-1001
```
*(ถ้าถูกต้อง: PostgreSQL remaining_stock ต้องได้ `0`, Orders ต้องได้ `50, 50`, Redis ต้องได้ `"0"`)*
