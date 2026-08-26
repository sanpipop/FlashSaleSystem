# Skill: PostgreSQL TypeORM Concurrency and Integrity

## Purpose
Guide AI agents in implementing PostgreSQL database schemas, TypeORM entities, pessimistic row locking (`SELECT FOR UPDATE`), ACID transactions, and database constraints for the Flash Sale System. This skill ensures zero overselling, zero duplicate successful orders, non-negative stock persistence, and worker idempotency under extreme concurrency.

## When to Use
Activate this skill whenever:
- Developing or modifying PostgreSQL entities, migrations, or repositories in `database/` or `apps/worker/`.
- Implementing Worker stock reduction transactions (`SELECT FOR UPDATE`) or order creation logic.
- Configuring PostgreSQL connection pool settings, indexes, or database constraints.
- Debugging concurrency race conditions, lock wait timeouts, or data integrity failures.

## Required Context
Database operations and worker transaction execution are owned by **Member 3 (Worker / PostgreSQL / TypeORM Lead)**.
- **PostgreSQL is the Ultimate Source of Truth:** All persistent stock counts and completed purchase records reside in PostgreSQL.
- **Worker Concurrency Engine:** `apps/worker/` consumes BullMQ jobs and executes database transactions under pessimistic row locking.

## Authoritative References
- **Database Contract:** [doc/contracts/database-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/database-contract.md)
- **Queue Payload Contract:** [doc/contracts/queue-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/queue-contract.md)
- **Order Flow Architecture:** [doc/architecture/order-flow.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/order-flow.md)
- **Concurrency & Idempotency Architecture:** [doc/architecture/concurrency-and-idempotency.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/concurrency-and-idempotency.md)
- **Testing Strategy:** [doc/testing/testing-strategy.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/testing/testing-strategy.md)

## Preconditions
1. Confirm allowed task paths (e.g., `database/**`, `apps/worker/src/`, or `packages/database/`).
2. Inspect table schemas, constraints, and column names in `doc/contracts/database-contract.md`.

## Responsibilities
- **Inviolable Data Integrity Constraints:** Enforce `CHECK(remaining_stock >= 0)` and `UNIQUE(user_id, product_id)` at the database DDL level.
- **Stock Semantics:** Maintain distinction between `available_stock` (initial allocated stock) and `remaining_stock` (mutable current stock). Decrement ONLY `remaining_stock`.
- **Pessimistic Row Locking:** Use TypeORM `PESSIMISTIC_WRITE` (`SELECT FOR UPDATE`) inside transactions to serialize competing worker threads for hot products.
- **ACID Transaction Boundaries:** Execute product lock, sale active check, stock check, order creation, and stock decrement within a single atomic database transaction.
- **Post-Commit Invalidation Trigger:** Trigger Redis cache invalidation ONLY after the database transaction successfully commits.

## Non-Responsibilities
- **DO NOT** execute slow HTTP calls, Redis operations, or heavy log formatting inside the PostgreSQL transaction lock scope.
- **DO NOT** use TypeORM auto-synchronization (`synchronize: true`) in production or competition runtime.

---

## Core Rules

### 1. Inviolable Database Invariants & Constraints

```text
Constraint 1: CHECK (remaining_stock >= 0)
→ Prevents negative stock persistence at DB engine level.

Constraint 2: UNIQUE (user_id, product_id)
→ Enforces maximum 1 successful order per user per product.

Constraint 3: is_flash_sale_active = true
→ Rejects purchase if sale is inactive.
```

- **Uniqueness Boundary:** `UNIQUE(user_id, product_id)` allows the same user to buy different products (`user-001 + p-1001` AND `user-001 + p-1002`). It strictly blocks duplicate purchases of the same product by the same user.

### 2. Pessimistic Lock Transaction Workflow (`SELECT FOR UPDATE`)

```typescript
// Conceptual Concurrency-Safe Worker Processing Flow
await dataSource.transaction(async (transactionalEntityManager) => {
  // 1. Lock Target Product Row
  const product = await transactionalEntityManager
    .createQueryBuilder(Product, 'product')
    .setLock('pessimistic_write')
    .where('product.id = :productId', { productId })
    .getOne();

  // 2. Validate Flash Sale Active State
  if (!product.isFlashSaleActive) {
    return { status: 'REJECTED_INACTIVE' };
  }

  // 3. Validate Stock Availability
  if (product.remainingStock <= 0) {
    return { status: 'REJECTED_SOLD_OUT' };
  }

  // 4. Create Order Entry (UNIQUE constraint will catch duplicate user/product)
  const order = transactionalEntityManager.create(Order, {
    userId,
    productId,
    jobId,
    status: 'CONFIRMED',
  });
  await transactionalEntityManager.save(order);

  // 5. Decrement Stock
  product.remainingStock -= 1;
  await transactionalEntityManager.save(product);

  return { status: 'SUCCESS', orderId: order.id };
});
```

### 3. Migration & Seed Discipline
- **Single Process Execution:** Database migrations MUST be run by a single migration container/process. Never let replicated API instances or Workers race to execute migrations simultaneously.
- **Idempotent Seeds:** Seed scripts (`doc/requirement/products-seed.json`) must be idempotent and executed via explicit command (`pnpm seed`).

---

## Competition Correctness Verification Gates

### Gate 1: Stock = 1 Race Gate
- **Setup:** Initial stock `remaining_stock = 1`.
- **Load:** Concurrent worker processing of 50 distinct user orders for `p-1001`.
- **Expected Outcome:**
  - `successful_orders = 1`
  - `remaining_stock = 0`
  - `rejected_orders = 49`
  - `negative_stock_count = 0`

### Gate 2: Competition Benchmark Gate (`p-1001` Stock = 50)
- **Setup:** Initial stock `remaining_stock = 50`.
- **Load:** 500 concurrent unique user order attempts.
- **Expected Terminal State (After Queue Drain):**
  - `remaining_stock = 0`
  - `successful_orders = 50`
  - `distinct_successful_users = 50`
  - `duplicate_successful_orders = 0`

> [!CAUTION]
> **Performance Benchmark Invalidation Rule:** If any test run yields `remaining_stock < 0` or `duplicate successful orders > 0`, the performance benchmark result is **INVALID** regardless of RPS or Latency metrics.

---

## Recommended Workflow

1. **Step 1 — Entity & Schema Audit:** Check `database-contract.md` for exact column names (`snake_case` in SQL, `camelCase` in TypeORM).
2. **Step 2 — Migration Creation:** Create DDL migrations using TypeORM CLI.
3. **Step 3 — Transaction Processor:** Implement pessimistic row lock logic inside `OrderProcessorService` in `apps/worker/`.
4. **Step 4 — Post-Commit Trigger:** Register post-commit hook or service call to issue Redis cache invalidation (`DEL fs:cache:products:*`).

## Verification
- Run real PostgreSQL integration tests (`pnpm test:integration`). Do NOT mock PostgreSQL for concurrency tests.
- Execute SQL data integrity check query:
  `SELECT product_id, remaining_stock FROM products WHERE remaining_stock < 0;` (MUST return 0 rows).
- Execute duplicate check query:
  `SELECT user_id, product_id, COUNT(*) FROM orders GROUP BY user_id, product_id HAVING COUNT(*) > 1;` (MUST return 0 rows).

## Performance Considerations
- **Keep Lock Window Short:** Do not perform external network calls or heavy CPU work inside the transaction lock.
- **Connection Pool Sizing:** Balance PostgreSQL connection pool (`max: 20-30`) across API instances and Workers to prevent DB connection exhaustion on 4 vCPU VM.

## Common Anti-Patterns to Avoid
- **Anti-Pattern 1:** Updating stock without row locking (`UPDATE products SET remaining_stock = remaining_stock - 1`).
- **Anti-Pattern 2:** Decrementing both `available_stock` and `remaining_stock` (violates stock contract semantics).
- **Anti-Pattern 3:** Executing Redis cache invalidation inside the active DB transaction block before commit.
- **Anti-Pattern 4:** Setting `synchronize: true` in TypeORM configuration.

## Stop Conditions
- Stop immediately if DB schemas or column names conflict with `doc/contracts/database-contract.md`.
- Stop if implementing a DB feature requires modifying API controller files in forbidden paths.

## Forbidden Actions
- DO NOT remove `CHECK (remaining_stock >= 0)` or `UNIQUE (user_id, product_id)` constraints to gain artificial speed.
- DO NOT commit raw database passwords in source files or migrations.
- DO NOT execute destructive `DROP DATABASE` or `TRUNCATE` commands in production/competition environments.

## Related Skills
- `loop-engineering` — Orchestrates iterative test execution.
- `flash-sale-project-context` — Defines invariants and PostgreSQL source of truth.
- `follow-project-contracts` — Guarantees alignment with `database-contract.md`.
- `bullmq-queue-processing` — Governs Worker job delivery to DB transaction engine.
- `redis-cache-and-dedup` — Governs post-commit cache invalidation.

## Completion / Handoff
Confirm DDL migrations pass, `SELECT FOR UPDATE` transaction logic is verified with real PostgreSQL concurrency tests, Stock=1 and Stock=50 correctness gates pass 100%, and no files outside `database/` or `apps/worker/` were modified.
