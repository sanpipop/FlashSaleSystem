## งานที่ทำ

<!-- อธิบายสิ่งที่เปลี่ยนและเหตุผลแบบสั้น ๆ -->

ผู้รับผิดชอบหลัก:

ไฟล์หรือโฟลเดอร์ที่ตั้งใจแก้:

เงื่อนไขที่ถือว่างานเสร็จ:

## ขอบเขตที่แก้

- [ ] API / Nginx
- [ ] Queue / Redis admission
- [ ] Worker / Microbatch
- [ ] PostgreSQL / Migration
- [ ] Cache / Cache invalidation
- [ ] Observability / Dashboard
- [ ] k6 / Tests
- [ ] Shared contract / Docker Compose

## ความถูกต้องของ Flash Sale

- [ ] ผู้ใช้หนึ่งคนซื้อสินค้าหนึ่งรหัสได้ไม่เกินหนึ่งชิ้น
- [ ] คำขอพร้อมกันถูกกันซ้ำแบบ Atomic ก่อนเข้าคิว
- [ ] Database ป้องกันสต็อกติดลบและมี Unique Constraint
- [ ] Cache ถูกล้างหรือเปลี่ยนรุ่นหลัง Database commit สำเร็จ
- [ ] Retry แล้วไม่สร้าง Order ซ้ำ
- [ ] ไม่คืนสถานะสำเร็จก่อนมีความหมายที่ระบุไว้ใน API contract

## การทดสอบ

<!-- ระบุคำสั่ง ผลทดสอบ และหลักฐานที่ใช้ตรวจ -->

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:migrate
pnpm test:integration
```

## ผลกระทบและการย้อนกลับ

<!-- มี Migration, Environment variable หรือวิธี rollback หรือไม่ -->

## การส่งต่อความรู้

- [ ] Reviewer มาจากคนละส่วนกับผู้เขียน
- [ ] อธิบาย Contract และ Failure case ที่เกี่ยวข้องให้ Reviewer แล้ว
- [ ] ถ้าแก้ไฟล์ส่วนกลาง ได้แจ้งสมาชิกทุกคนแล้ว
