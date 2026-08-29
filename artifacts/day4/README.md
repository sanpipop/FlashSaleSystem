# Day 4–5 benchmark evidence

แต่ละ directory เป็นหลักฐานหนึ่งรอบและต้องอ่าน `notes.md` ก่อนนำตัวเลขไปใช้

## Valid final evidence

- `final-read-warm-r1-20260829/` ถึง `r3` — official warm-read 3 runs
- `singleflight-write-r1-20260829/` ถึง `r3` — final write 3 runs หลัง Single-Flight
- `final-read-cold-r1-20260829/` — cold-cache read
- `final-duplicate-r1-20260829/` — duplicate burst
- `final-auth-r1-20260829/` — authentication profile

## Valid comparison evidence

- `final-write-r1-20260829/` ถึง `r3` — write baseline ก่อน Single-Flight
- `candidate4-read-warm-r1-20260829/` ถึง `r3` — 4 API experiment; ผลคือ REVERT

## ห้ามใช้ตัดสิน performance

Directory ที่ `notes.md` ระบุ `INVALID`, `DIAGNOSTIC ONLY` หรือ `NON-OFFICIAL PREFLIGHT` เก็บไว้เพื่อความโปร่งใสและกฎ no cherry-picking เท่านั้น

## ไฟล์ที่ official run ต้องมี

- `metadata.json` — target/load-generator identity, profile, parameters, commit cleanliness
- `k6-summary.json` และ `k6-output.txt` — metric จริงจาก k6
- `integrity.txt` — SQL correctness หลัง queue drain
- `queue.txt` — queue depth/drain evidence
- `load-generator-resource.txt` และ `target-resource.txt` — resource ของทั้งสองฝั่ง
- `target-environment.txt` — สเปกและ commit ของ Target VM
- `notes.md` — คำตัดสิน validity

ห้ามเก็บ JWT, Authorization header, signing secret, database/Redis password, SSH key หรือ `.env` ใน artifacts
