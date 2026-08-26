# งานพัฒนาระบบแคชและการล้างแคช (Caching & Invalidation Day 3)

## Goal
พัฒนาระบบ Versioned Redis Cache-Aside + Single-Flight พร้อม Immediate Epoch Invalidation และ Transactional Outbox Recovery

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
- พัฒนา Cache Service/Preloaded Lua Script ใช้ `EVALSHA` อ่าน Epoch + Versioned Key ใน Redis round-trip เดียว
- เมื่อ Cache Miss ใช้ Short Single-Flight Guard ให้มี DB Fill เพียงหนึ่ง Request ต่อ Key
- หากเจอปริมาณแคช (Hit): คืนค่าจาก Redis ทันทีโดยไม่คิวรี DB
- หากไม่เจอ (Miss): ดึง DB นำผลมาบันทึกใน Redis ด้วย TTL 60s (เพิ่ม Jitter ±5s)
- หลัง DB `COMMIT` สำเร็จ ให้ `INCR fs:cache:products:epoch` ทันที
- พัฒนา Outbox Relay อ่าน Pending Event ด้วย `FOR UPDATE SKIP LOCKED` แล้ว Retry Epoch Increment/mark published
- หาก Redis Cache Down: API ต้อง Fallback ไปคิวรี DB โดยตรงโดยไม่ Crash (Fail-Safe)

## Out of Scope
- การใช้ L1 In-Memory Stock เป็น Authority (ห้ามทำ)

## Implementation Requirements
- **ห้ามทำการล้างแคชก่อน DB Commit สำเร็จเป็นอันขาด** เพื่อป้องกัน Race Condition

## Acceptance Criteria
1. เรียก `GET /api/v1/products?page=1&limit=10` ครั้งแรกเกิด Cache Miss ครั้งที่สองเกิด Cache Hit (วัดผลได้จาก Response Time หรือ Metrics)
2. Burst Cache Miss หลายสิบคำขอสร้าง DB Query เติม Cache เพียงหนึ่งครั้งต่อ Key โดยประมาณตาม Metric
3. Cache Hit Path ใช้ Redis command round-trip เดียวและทดสอบ `NOSCRIPT` recovery
4. หลัง Commit ค่า Epoch เพิ่มและ GET ถัดไปอ่าน Stock จาก Generation ใหม่
5. ปิด Redis ชั่วคราวหลัง Commitแล้วเปิดใหม่ Outbox Relay ต้องซ่อม Invalidation ได้
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
