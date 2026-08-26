# งานพัฒนาระบบแคชและการล้างแคช (Caching & Invalidation Day 3)

## Goal
พัฒนาระบบ Redis Cache-Aside สำหรับ `GET /api/v1/products` พร้อมระบบ Cache Invalidation เมื่อ Worker ตัดสต็อกใน PostgreSQL สั่ง Commit สำเร็จ

## Owner
Owner: Member 2 (Queue / Redis / Cache)

## Contributors
Member 1 (API Integrator), Member 3 (Worker Trigger)

## Reviewer
Reviewer: Member 1

## Priority
P0

## Dependencies
- Hard Dependencies: [products-api.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day2/products-api.md), [order-processing.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day2/order-processing.md)
- Soft Dependencies: None

## Can Start Immediately?
Yes

## Allowed Paths
- `packages/cache/**`
- `apps/api/src/products/**`
- `apps/worker/src/**`

## Forbidden Paths
- `doc/contracts/**`

## Contracts Used
- [cache-strategy.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/cache-strategy.md)
- [redis-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/redis-contract.md)

## Scope
- พัฒนา Cache Interceptor / Service ใน Products API อ่าน Key `fs:cache:products:page={page}:limit={limit}`
- หากเจอปริมาณแคช (Hit): คืนค่าจาก Redis ทันทีโดยไม่คิวรี DB
- หากไม่เจอ (Miss): ดึง DB นำผลมาบันทึกใน Redis ด้วย TTL 60s (เพิ่ม Jitter ±5s)
- ใน Worker: หลังสั่ง DB `COMMIT` ตัดสต็อกสำเร็จ ให้ส่งคำสั่งลบแคช `DEL fs:cache:products:*`
- หาก Redis Cache Down: API ต้อง Fallback ไปคิวรี DB โดยตรงโดยไม่ Crash (Fail-Safe)

## Out of Scope
- การทำ L1 In-Memory API Cache (พิจารณาเพิ่มเติมใน Day 5)

## Implementation Requirements
- **ห้ามทำการล้างแคชก่อน DB Commit สำเร็จเป็นอันขาด** เพื่อป้องกัน Race Condition

## Acceptance Criteria
1. เรียก `GET /api/v1/products?page=1&limit=10` ครั้งแรกเกิด Cache Miss ครั้งที่สองเกิด Cache Hit (วัดผลได้จาก Response Time หรือ Metrics)
2. เมื่อมีการตัดสต็อกสำเร็จ การเรียก `GET /api/v1/products` ครั้งถัดไปจะอ่านได้สต็อกคงเหลือล่าสุดที่อัปเดตแล้ว

## Test / Verification
```bash
# 1. First Call (Miss)
curl -i "http://localhost/api/v1/products?page=1&limit=10"
# 2. Second Call (Hit)
curl -i "http://localhost/api/v1/products?page=1&limit=10"
```

## Evidence Required
- Log หรือ Metrics แสดงสถิติ Cache Miss ในครั้งแรก และ Cache Hit ในครั้งถัดมา

## Handoff
ส่งมอบระบบ Caching ให้ทีมทดสอบประสิทธิภาพใน Day 4

## Definition of Done
Cache-Aside และ Invalidation ทำงานถูกต้อง มี Fallback Behavior เมื่อ Redis มีปัญหา
