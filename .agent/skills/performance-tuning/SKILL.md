# Skill: Performance Tuning

## Purpose
Guide AI coding agents in conducting evidence-driven performance tuning and system optimization for the Flash Sale System. This skill enforces single-variable experiment discipline, ensuring that throughput and latency optimizations never compromise data integrity or violate frozen contracts.

## When to Use
Activate this skill whenever:
- Planning, executing, or evaluating performance tuning experiments in Phase 5 (`doc/performance/`).
- Tuning API instance counts, Nginx keepalive, Redis connections, BullMQ worker concurrency, or PostgreSQL connection pools.
- Analyzing bottleneck metrics (CPU, RAM, DB Lock Wait, Queue Backlog) to formulate tuning hypotheses.
- Recording experiment results in `doc/performance/tuning-results.md`.

## Required Context
Performance tuning is a **Cross-Team Collaborative Skill**. Member 1 tunes API/Nginx, Member 2 tunes Redis/BullMQ, and Member 3 tunes PostgreSQL/Worker.

> [!IMPORTANT]
> **Performance Entry Gate Rule:**  
> Performance tuning MUST NOT begin until all P0/P1 functional correctness tests pass 100%. If correctness tests fail, **PERFORMANCE TUNING IS BLOCKED**.

## Authoritative References
- **Baseline Specification:** [doc/performance/baseline.md](file:///FlashSaleSystem/doc/performance/baseline.md)
- **Tuning Results Matrix:** [doc/performance/tuning-results.md](file:///FlashSaleSystem/doc/performance/tuning-results.md)
- **Final Results Specification:** [doc/performance/final-results.md](file:///FlashSaleSystem/doc/performance/final-results.md)
- **Project Decisions Log:** [doc/planning/decisions.md](file:///FlashSaleSystem/doc/planning/decisions.md)

## Preconditions
1. Verify system baseline configuration is documented in `doc/performance/baseline.md`.
2. Confirm P0 correctness gates (`Stock=1` and `Stock=50`) pass 100%.

## Responsibilities
- **Single-Variable Discipline:** Modify ONLY ONE primary tuning variable per experiment.
- **"Fastest Safe" Enforcement:** Automatically reject any performance tuning change that bypasses DB row locks, removes unique constraints, or fakes 202 responses.
- **Bottleneck Analysis:** Analyze system metrics to identify the primary bottleneck (CPU, RAM, DB Lock Wait, Queue Drain) before tuning.
- **Decision Tracking:** Assign explicit decision states (`KEEP`, `REVERT`, `RETEST`) for every experiment and record failed experiments to prevent duplicate work.

## Non-Responsibilities
- **DO NOT** make random multi-variable changes (e.g., changing API count, DB pool, worker concurrency, and Nginx settings all in one test run).
- **DO NOT** remove frozen Winning primitives (micro-batching, versioned cache, result ledger, outbox). Tune their numeric parameters one variable at a time; L1 cache remains benchmark-only.

---

## Core Rules

### 1. The Performance Tuning Execution Loop

```text
1. Establish Baseline Configuration & Benchmark Metrics
2. Formulate Bottleneck Hypothesis (e.g., Worker CPU underutilized due to low concurrency)
3. Change ONE Primary Variable (e.g., Worker Concurrency 8 -> 12)
4. Execute Identical k6 Load Benchmark (3 Runs -> Median)
5. Evaluate Correctness Gate (Zero Overselling, Zero Duplicates, Stock = 0)
   ├── If Correctness Fails → DECISION: REVERT
   └── If Correctness Passes → Compare RPS & Latency p95 vs. Baseline
       ├── Better → DECISION: KEEP (Record in tuning-results.md)
       └── Worse / Equal → DECISION: REVERT
```

### 2. Team Member Tuning Domains

| Member / Role | Allowed Tuning Variables | Primary Bottleneck Focus |
| --- | --- | --- |
| **Member 1 (Edge/API)** | NestJS API Instance Count (min 3), Nginx keepalive, proxy buffers, Node heap | API CPU utilization, HTTP latency p95 |
| **Member 2 (Queue/Cache)** | Redis connection pool, Cache TTL jitter, BullMQ worker concurrency, queue retention | Queue backlog drain time, Cache hit ratio |
| **Member 3 (Worker/DB)** | PostgreSQL connection pool size, TypeORM lock timeout, SQL query indexes | DB lock wait time, DB CPU/Disk I/O |

### 3. The "Fastest Safe" Principle
A candidate optimization MUST be **REJECTED** immediately if it relies on any forbidden compromise:
- **REJECT:** Deleting `CHECK (remaining_stock >= 0)` or `UNIQUE (user_id, product_id)` constraints.
- **REJECT:** Decrementing stock in API memory without PostgreSQL pessimistic row lock.
- **REJECT:** Returning HTTP 202 Accepted without enqueueing job into BullMQ.
- **REJECT:** Serving stale stock counts indefinitely without post-commit cache invalidation.

---

## Recommended Workflow

1. **Step 1 — Baseline Check:** Inspect `doc/performance/baseline.md` for target metrics.
2. **Step 2 — Hypothesis Formulation:** Identify one candidate variable (e.g., `PERF-003: Worker Concurrency 8 -> 12`).
3. **Step 3 — Single Variable Edit:** Update configuration file in target allowed path.
4. **Step 4 — Benchmark Execution:** Run k6 scenario using `k6-performance-testing` skill (3 runs → Median).
5. **Step 5 — Integrity Check:** Run `bash scripts/verify-integrity.sh`.
6. **Step 6 — Decision & Recording:** Log result in `doc/performance/tuning-results.md`:
   ```markdown
   | ID | Variable Changed | Baseline RPS | New RPS | Latency p95 | Integrity | Decision |
   | --- | --- | --- | --- | --- | --- | --- |
   | PERF-003 | Worker Concurrency 8->12 | measured | measured | measured | PASS | KEEP/REVERT |
   ```

## Verification
- Verify that `doc/performance/tuning-results.md` contains entry with raw evidence references.
- Verify system correctness remains 100% compliant after candidate adoption.

## Performance Considerations
- **Total System RAM (6 GB Limit):** Ensure combined container memory limits do not exceed ~5.0 GB total.
- **DB Connection Budget:** Ensure total DB connections across all API containers + Worker containers fit within PostgreSQL `max_connections` (e.g., 100).

## Common Anti-Patterns to Avoid
- **Anti-Pattern 1:** Modifying 5 environment variables simultaneously and guessing which one improved performance.
- **Anti-Pattern 2:** Deleting failed experiment logs from `tuning-results.md`.
- **Anti-Pattern 3:** Declaring an optimization "successful" when RPS increased by 2% but RAM consumption increased by 200%.
- **Anti-Pattern 4:** Tuning PostgreSQL indexes before establishing an initial baseline.

## Stop Conditions
- Stop immediately if a performance change causes data integrity checks to fail.
- Stop if host VM memory usage exceeds 5.2 GB, risking OOM container kills.

## Forbidden Actions
- DO NOT remove database constraints or pessimistic row locks to artificially boost RPS.
- DO NOT modify files outside your assigned tuning domain without team coordination.
- DO NOT alter k6 load test script parameters during a tuning experiment series.

## Related Skills
- `loop-engineering` — Orchestrates performance experiment loops.
- `flash-sale-project-context` — Provides host hardware limits (4 vCPU / 6 GB RAM).
- `flash-sale-testing` — Verifies correctness gates before and after tuning.
- `k6-performance-testing` — Executes benchmark load tests.
- `benchmark-evidence-collection` — Records tuning evidence for final report.

## Completion / Handoff
Confirm experiment followed single-variable discipline, k6 benchmark median metrics were recorded, data integrity passed 100%, decision (`KEEP`/`REVERT`) was logged in `tuning-results.md`, and no forbidden files were modified.
