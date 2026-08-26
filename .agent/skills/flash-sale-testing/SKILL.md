# Skill: Flash Sale Testing

## Purpose
Guide AI agents in designing, implementing, executing, and validating correctness tests for the Flash Sale System. This skill enforces the **Correctness First** principle (`Correctness → Requirement Completeness → Integration → Observability → Baseline → Benchmark`), ensuring zero overselling, zero duplicate purchases, and non-negative stock persistence before any performance optimization is attempted.

## When to Use
Activate this skill whenever:
- Writing or running Unit, Integration, Contract, End-to-End, Concurrency, or Data Integrity tests.
- Verifying P0/P1 functional acceptance criteria in `doc/task/dayX/<task>.md`.
- Executing pre-performance validation gates (`Stock=1 Race Test` and `Stock=50 High-Contention Test`).
- Debugging test failures, race conditions, or stock discrepancies.

## Required Context
Testing authority is defined in Phase 7 (`doc/testing/`). Automated unit tests reside in application packages, while integration and correctness tests verify the end-to-end flow.

> [!IMPORTANT]
> **Real Dependency Requirement for Concurrency Tests:**  
> Unit tests may use mocks for isolated class logic. However, **Concurrency, Atomicity, and Data Integrity tests MUST run against REAL PostgreSQL, REAL Redis, and REAL BullMQ instances**. Mocked databases or mocked Redis clients CANNOT prove distributed race safety or pessimistic row locking correctness.

## Authoritative References
- **Testing Strategy Source of Truth:** [doc/testing/testing-strategy.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/testing/testing-strategy.md)
- **Load Testing Specification:** [doc/testing/load-testing.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/testing/load-testing.md)
- **Concurrency Architecture:** [doc/architecture/concurrency-and-idempotency.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/concurrency-and-idempotency.md)
- **Day 3 Integration Testing Task:** [doc/task/day3/integration-testing.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day3/integration-testing.md)
- **Day 4 Correctness Test Task:** [doc/task/day4/correctness-test.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day4/correctness-test.md)

## Preconditions
1. Verify test environment (PostgreSQL, Redis, BullMQ) is running via Docker Compose.
2. Ensure database state is cleanly reset using `bash scripts/reset-db.sh` before running concurrency suites.

## Responsibilities
- **Test Hierarchy Management:** Execute tests across levels (Unit → Integration → Concurrency → Integrity → Load).
- **Invariant Verification:** Verify `CHECK (remaining_stock >= 0)` and `UNIQUE (user_id, product_id)` constraints in DB.
- **Pre-Performance Gate Enforcement:** Execute and pass `Stock=1` and `Stock=50` correctness gates before approving benchmark runs.
- **Queue Drain Synchronization:** Wait for BullMQ queue `orders` to reach terminal state (`waiting=0`, `active=0`) before querying PostgreSQL final integrity.

## Non-Responsibilities
- **DO NOT** rewrite frozen contract DTOs or database schemas to make a failing test pass.
- **DO NOT** delete failing assertions or swallow test exceptions.

---

## Core Rules

### 1. Inviolable Testing Invariants
Every valid test suite must enforce:
1. `remainingStock >= 0` (Stock NEVER drops below zero).
2. `successfulOrders(userId, productId) <= 1` (Max 1 successful order per user per product).
3. `isFlashSaleActive = false` MUST reject order placement.
4. `remainingStock = 0` MUST reject new orders as `SOLD_OUT`.
5. Multi-Product Purchase: `user-001 + p-1001` AND `user-001 + p-1002` MUST both be allowed.
6. Retrying the same `jobId` MUST return the same `order_results` outcome without changing Stock or Orders.
7. Every `SUCCESS` result MUST reference an existing Order, and every accepted Job must eventually have one terminal durable result.

### 2. Mandatory Pre-Performance Correctness Gates

#### Gate A: Stock = 1 Race Test (TEST-008)
- **Setup:** Target product `p-1001`, initial stock `remaining_stock = 1`.
- **Action:** 50 concurrent distinct users execute `POST /orders` simultaneously.
- **Queue Drain:** Wait until BullMQ `waiting=0` and `active=0`.
- **Expected Result:**
  - PostgreSQL `successful_orders = 1`
  - PostgreSQL `remaining_stock = 0`
  - PostgreSQL `rejected_orders = 49`
  - `negative_stock_count = 0`
- **Gate Outcome:** If `successful_orders > 1` or `remaining_stock < 0` -> **TEST FAILED / BENCHMARK BLOCKED**.

#### Gate B: Stock = 50 High-Contention Test (TEST-009)
- **Setup:** Target product `p-1001`, initial stock `remaining_stock = 50`.
- **Action:** 500 concurrent distinct users execute `POST /orders`.
- **Queue Drain:** Wait until queue is fully processed (< 30s timeout).
- **Expected Terminal State:**
  - `successful_orders = 50`
  - `distinct_successful_users = 50`
  - `remaining_stock = 0`
  - `duplicate_successful_orders = 0`

#### Gate C: Retry and Cache-Recovery Test
- Re-deliver at least one already committed Job and assert Stock/Order counts remain unchanged.
- Simulate Redis Cache outage after DB commit, restore it, and assert the Outbox Relay increments the Cache Epoch and marks the event published.
- Under a burst, assert DB batch call count is lower than processed Job count and every Job receives a mapped result.

---

## Recommended Workflow

```mermaid
graph TD
    A[Start Test Execution] --> B[Run Unit Tests pnpm test]
    B -- Pass --> C[Reset DB & Redis bash scripts/reset-db.sh]
    C --> D[Run Integration Tests pnpm test:integration]
    D -- Pass --> E[Execute Stock=1 Race Gate]
    E -- Pass --> F[Execute Stock=50 High-Contention Gate]
    F -- Pass --> G[Verify SQL Data Integrity Queries]
    G -- Pass --> H[PASS: System Approved for Benchmark]
    E / F / G -- Fail --> I[FAIL: Block Benchmark & Log Defect]
```

1. **Step 1 — Environment Initialization:** Execute reset script `bash scripts/reset-db.sh`.
2. **Step 2 — Unit & Integration Execution:** Run automated test scripts using `pnpm test` and `pnpm test:integration`.
3. **Step 3 — Concurrency Gate Execution:** Execute `pnpm test:correctness`.
4. **Step 4 — SQL Data Integrity Audit:** Execute verification SQL queries:
   ```sql
   -- Query 1: Verify Zero Negative Stock
   SELECT COUNT(*) FROM products WHERE remaining_stock < 0;
   
   -- Query 2: Verify Zero Duplicate Purchases
    SELECT user_id, product_id, COUNT(*) FROM orders
    GROUP BY user_id, product_id HAVING COUNT(*) > 1;

    -- Query 3: Successful results without an order must be zero
    SELECT COUNT(*) FROM order_results r
    LEFT JOIN orders o ON o.id = r.order_id
    WHERE r.status = 'SUCCESS' AND o.id IS NULL;
   ```
5. **Step 5 — Evidence Recording:** Log test pass/fail results in task evidence records.

## Verification
- Run `pnpm test:correctness` and verify output shows 100% passing tests for `Stock=1` and `Stock=50` scenarios.
- Verify SQL Query 1 and Query 2 both return `0` rows.

## Performance Considerations
- **Test Execution Speed:** Run fast unit tests first; run heavy integration and concurrency suites before benchmark milestones.
- **Bounded Waits:** Use bounded timeouts (max 30s) when polling BullMQ queue drain status. NEVER use infinite loops.

## Common Anti-Patterns to Avoid
- **Anti-Pattern 1:** Mocking PostgreSQL or Redis in concurrency tests and declaring row locking "verified".
- **Anti-Pattern 2:** Checking HTTP 202 Accepted count and treating it as proof of confirmed purchases in PostgreSQL.
- **Anti-Pattern 3:** Retrying a flaky test 5 times until it passes once, then marking it "PASS".
- **Anti-Pattern 4:** Deleting `CHECK (remaining_stock >= 0)` constraint from DB to make tests run faster.

## Stop Conditions
- Stop immediately if `Stock=1` or `Stock=50` race tests produce negative stock or duplicate orders.
- Stop if running integration tests requires modifying frozen contract schemas.

## Forbidden Actions
- DO NOT claim a feature is complete without running automated test commands.
- DO NOT bypass database uniqueness constraints during test execution.
- DO NOT use arbitrary `sleep 10` instead of proper queue drain polling in test scripts.

## Related Skills
- `loop-engineering` — Orchestrates test execution and state tracking.
- `flash-sale-project-context` — Defines business invariants.
- `follow-project-contracts` — Protects contract boundaries during testing.
- `k6-performance-testing` — Executes load testing after correctness gates pass.
- `benchmark-evidence-collection` — Captures test logs and SQL integrity evidence.

## Completion / Handoff
Confirm all P0/P1 unit, integration, and concurrency tests pass 100%, SQL integrity queries return zero violations, and test results are documented.
