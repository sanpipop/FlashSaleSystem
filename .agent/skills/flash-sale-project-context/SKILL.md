# Skill: Flash Sale Project Context

## Purpose
Provide the minimal, authoritative project context that any AI coding agent working on the `FlashSaleSystem` repository must understand before inspecting files, designing components, or writing code.

## When to Use
Activate this skill at the beginning of every task or conversation in this repository. It serves as the baseline context for all architectural, contract, task, and implementation decisions.

## Required Context

### 1. Project Identity & Core Goals
- **Project Name:** Flash Sale System
- **Core Engineering Goal:** Build a correct, observable, high-performance Flash Sale backend that survives extreme traffic surges.
- **Key Characteristics:**
  - **Correctness First:** Zero overselling, zero duplicate successful orders, stock never negative.
  - **High Throughput & Low Latency:** Fast Read path using Redis Cache-Aside, fast Write path using Asynchronous Order Admission.
  - **Stateless Horizontal Scaling:** NestJS API instances scaling behind Nginx Load Balancer.
  - **PostgreSQL Source of Truth:** PostgreSQL holds the persistent, authoritative state of stock and completed orders.

### 2. Infrastructure Constraints
- **Target Host:** Single Virtual Machine per team.
- **Hardware Allocation:** 4 vCPU, 6 GB RAM, 50 GB Disk.
- **Deployment Model:** Docker Compose (`compose.yaml` / `docker-compose.yml`).
- **Load Generator Location:** Grafana k6 MUST run on an **external machine** outside the backend VM to prevent resource contention.

### 3. Team Ownership & Responsibilities
- **Member 1 (Edge / API Lead):**
  - Scope: NestJS API (`apps/api/`), Nginx LB (`infra/nginx/`), JWT Auth, Auth API, Products API, Orders API Admission, k6 Load Test scenarios (`k6/`).
- **Member 2 (Queue / Cache Lead):**
  - Scope: Redis Operations, Product Cache-Aside (`packages/cache/`), BullMQ Infrastructure (`packages/queue/`), Atomic Claim Guard (`SET NX`), Bull Board UI, Observability stack (`observability/`).
- **Member 3 (Worker / Database Lead):**
  - Scope: PostgreSQL Engine & Migrations (`database/`), Seed Data, BullMQ Worker Consumer (`apps/worker/`), Transaction & Pessimistic Row Locking (`SELECT FOR UPDATE`), Database Constraints.

### 4. Required Public HTTP APIs
- `POST /api/v1/auth/token` — Issue JWT Access Token.
- `GET /api/v1/products` — Read paginated products (Cache-Aside Path).
- `POST /api/v1/orders` — Flash Sale Order Admission (`202 Accepted` Async Admission).

### 5. Inviolable Business Invariants
1. **Stock Non-Negative:** `remainingStock >= 0` enforced at Database layer via `CHECK (remaining_stock >= 0)`.
2. **Limit 1 Per User Per Product:** `successfulOrders(userId, productId) <= 1` enforced via PostgreSQL `UNIQUE(user_id, product_id)`.
3. **Multi-Product Allowed:** A single user CAN purchase different products (`user-001 + p-1001 = success` and `user-001 + p-1002 = success`).
4. **202 Accepted Semantics:** An HTTP `202 Accepted` response indicates the order request was enqueued successfully, NOT that the purchase is confirmed.

## Authoritative References
Do not copy full technical specifications into this skill. Always refer agents to the canonical documentation:
- **Architecture Source of Truth:** [doc/architecture/](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/architecture.md)
- **Frozen Contracts Source of Truth:** [doc/contracts/](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/api-contract.md)
- **Project Master Plan & Ownership:** [doc/planning/](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/planning/master-plan.md)
- **Daily Task Execution Plan:** [doc/task/](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day1/day1-overview.md)
- **Testing & Verification Standards:** [doc/testing/](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/testing/testing-strategy.md)
- **Performance Framework:** [doc/performance/](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/performance/baseline.md)
- **Report & Evidence Checklist:** [doc/report/](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/report/evidence-checklist.md)

## Preconditions
Before starting any technical action, confirm that you have read the relevant task file in `doc/task/` and checked git status.

## Core Rules
1. **Source of Truth Priority:** If project documentation and implementation differ, DO NOT silently rewrite either side. Stop and report the mismatch as `BLOCKED — CONTRACT / ARCHITECTURE REVIEW REQUIRED`.
2. **Correctness Over Performance:** Never propose or implement performance optimizations that compromise Data Integrity or bypass frozen constraints.
3. **No Unilateral Boundary Changes:** Respect component boundaries and file ownership assigned to Member 1, 2, and 3.

## Workflow
1. Read the assigned task prompt and identify the affected domain (API, Queue/Cache, Worker/DB).
2. Cross-reference the domain with authoritative docs in `doc/architecture/` and `doc/contracts/`.
3. Inspect `doc/planning/team-ownership.md` to confirm allowed file paths.
4. Execute technical actions within assigned allowed paths using the `loop-engineering` framework.

## Verification
- Verify that your proposed solution adheres to all 4 Inviolable Business Invariants.
- Confirm that no files outside your assigned allowed paths were modified.

## Stop Conditions
- Stop immediately if you discover a conflict between contracts and architecture.
- Stop if task requirements require modifying another member's module without explicit task permission.

## Forbidden Actions
- DO NOT rewrite contracts in `doc/contracts/` during feature implementation.
- DO NOT invent new API endpoints or change request/response JSON field names without team alignment.
- DO NOT run destructive git or database commands.

## Related Skills
- `follow-project-contracts` — Enforces frozen contract boundaries.
- `execute-task-safely` — Enforces task scoping and allowed paths.
- `clean-code-separation` — Enforces modular separation of concerns.
- `loop-engineering` — Orchestrates the iterative engineering execution loop.

## Handoff / Completion
Upon task completion, summarize the completed work, list modified files, confirm that all invariants are preserved, and provide test verification results.
