# FlashSaleSystem

ระบบ Flash Sale สำหรับทดสอบการรับโหลดสูง โดยให้ความสำคัญกับความเร็ว ความถูกต้องของสต็อก และการป้องกันคำสั่งซื้อซ้ำ

## การทำงานร่วมกัน

- อ่าน [CONTRIBUTING.md](CONTRIBUTING.md) ก่อนเริ่มงาน
- ตกลงขอบเขตงานกับทีม แล้วใช้ Branch แยกตามงาน
- ทุก Pull Request ต้องผ่าน GitHub Actions 
- ห้าม Push เข้า `main` โดยตรง

## Automation

- `CI` ตรวจ dependency, lint, typecheck, quick test และ Compose syntax แบบรวดเร็ว
- `Compose smoke test` กดรันเองเมื่อต้องการเปิดระบบรวมและเก็บ log
- `Manual k6 load test` ใช้สั่งทดสอบโหลดด้วยตนเองเมื่อมี `k6/competition.js`

Workflow จะข้ามขั้นตอนของแอปชั่วคราวระหว่างที่ยังไม่มี `package.json` หรือ Compose file และจะเริ่มตรวจส่วนเหล่านั้นอัตโนมัติเมื่อไฟล์ถูกเพิ่มเข้ามา
