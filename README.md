# FlashSaleSystem

ระบบ Flash Sale สำหรับทดสอบการรับโหลดสูง โดยให้ความสำคัญกับความเร็ว ความถูกต้องของสต็อก และการป้องกันคำสั่งซื้อซ้ำ

## การทำงานร่วมกัน

- อ่าน [CONTRIBUTING.md](CONTRIBUTING.md) ก่อนเริ่มงาน
- เปิด GitHub Issue ก่อนเขียนโค้ด และใช้ Branch แยกตามงาน
- ทุก Pull Request ต้องผ่าน GitHub Actions และมีเพื่อนต่างส่วน Review อย่างน้อยหนึ่งคน
- ห้าม Push เข้า `main` โดยตรง

## Automation

- `CI` ตรวจ lint, typecheck, unit test, build, integration test และ Compose config
- `Compose smoke test` เปิดระบบรวมและเก็บ log หลัง Merge เข้า `main`
- `Manual k6 load test` ใช้สั่งทดสอบโหลดด้วยตนเองเมื่อมี `k6/competition.js`

Workflow จะข้ามขั้นตอนของแอปชั่วคราวระหว่างที่ยังไม่มี `package.json` หรือ Compose file และจะเริ่มตรวจส่วนเหล่านั้นอัตโนมัติเมื่อไฟล์ถูกเพิ่มเข้ามา
