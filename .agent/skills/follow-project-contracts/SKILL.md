# Skill: Follow Project Contracts

## Purpose
Protect and enforce all frozen integration boundaries (`doc/contracts/`) across the Flash Sale System. This skill ensures that producer and consumer components developed by Member 1, Member 2, and Member 3 integrate seamlessly without contract drift or breaking changes.

## When to Use
Activate this skill whenever:
- Designing or implementing API endpoints, DTOs, or Controller responses.
- Constructing or consuming BullMQ queue job payloads.
- Defining or querying PostgreSQL database schemas, entity properties, or constraints.
- Reading or writing Redis cache keys, TTL values, or claim flags.

## Required Context
Integration boundaries are frozen in Phase 2 to enable parallel development. Contracts are NOT suggestions or draft guides; they are strict engineering specifications.

## Authoritative References
Before implementing any component boundary, inspect the corresponding contract document:
- **Public HTTP API Contract:** [doc/contracts/api-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/api-contract.md)
- **Queue Job & Message Contract:** [doc/contracts/queue-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/queue-contract.md)
- **Database Schema & Constraint Contract:** [doc/contracts/database-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/database-contract.md)
- **Redis Key & Data Structure Contract:** [doc/contracts/redis-contract.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/contracts/redis-contract.md)

## Preconditions
1. Identify whether your current task is a **Producer** (e.g., API enqueueing a job) or a **Consumer** (e.g., Worker processing a job).
2. Open and inspect the relevant contract document in `doc/contracts/`.

## Core Rules

### 1. Inviolable Contract Elements
An implementation agent MUST NOT independently modify or change:
- HTTP endpoint paths (e.g., `/api/v1/orders`), HTTP methods (`POST`), or Status Codes (`202 Accepted`).
- Request/Response JSON field casing (`camelCase` for external API and Queue; `snake_case` for DB columns).
- Queue names (e.g., BullMQ Queue name `orders`).
- Queue job payload schema (`userId`, `productId`, `requestId`, `jobId`).
- Deterministic Redis key formats (e.g., `fs:claim:order:{userId}:{productId}` and `fs:cache:products:page={page}:limit={limit}`).
- PostgreSQL uniqueness constraints (`UNIQUE(user_id, product_id)`) or check constraints (`CHECK(remaining_stock >= 0)`).

### 2. Producer-Consumer Compatibility Matrix

| Boundary Pair | Producer Component | Consumer Component | Contract Reference | Key Integration Requirement |
| --- | --- | --- | --- | --- |
| **API ↔ Queue** | NestJS API Order Controller | BullMQ Queue Producer | `queue-contract.md` | API enqueues job with exact `camelCase` payload. |
| **Queue ↔ Worker** | BullMQ Queue | Worker Order Consumer | `queue-contract.md` | Worker reads job payload without expecting extra fields. |
| **Worker ↔ Database**| Worker Order Processor | PostgreSQL Database Engine | `database-contract.md` | Worker executes transaction with `SELECT FOR UPDATE`. |
| **API ↔ Redis Cache** | NestJS Products Controller | Redis Cache Store | `redis-contract.md` | API reads/writes Product Cache using exact TTL key. |
| **Worker ↔ Invalidation**| Worker Post-Commit Handler | Redis Cache Store | `redis-contract.md` | Worker issues `DEL fs:cache:products:*` after DB Commit. |

## Workflow

### Step 1: Boundary Inspection
Before writing code in `apps/api/`, `apps/worker/`, or `packages/`, verify the target interface against `doc/contracts/`.

### Step 2: Implementation Alignment
Ensure all DTO classes, Interfaces, Database Entities, and Query Parameters strictly implement the schema defined in the contract.

### Step 3: Contract Conflict Resolution
If implementation becomes difficult or inefficient due to a contract specification:
1. **DO NOT** edit the contract document independently.
2. Identify the affected Producer components.
3. Identify the affected Consumer components.
4. Formulate the proposed contract update and assess breaking changes.
5. Report the issue and stop execution with:
   `BLOCKED — CONTRACT / ARCHITECTURE REVIEW REQUIRED`

## Verification
- Run TypeScript type checking (`pnpm typecheck`) and integration tests (`pnpm test:integration`).
- Confirm that API JSON responses use `camelCase` and match the exact contract response DTO.
- Confirm that database queries use `snake_case` column names matching `database-contract.md`.

## Stop Conditions
- Stop immediately if a task requirement contradicts a frozen contract in `doc/contracts/`.
- Stop if implementing a change requires altering a payload field consumed by another member's module without cross-team approval.

## Forbidden Actions
- DO NOT convert `camelCase` API payload fields to `snake_case` in external contracts.
- DO NOT change Queue name from `orders` to any custom name.
- DO NOT bypass PostgreSQL `UNIQUE(user_id, product_id)` or `CHECK(remaining_stock >= 0)` constraints.
- DO NOT silently update contract markdown documents in `doc/contracts/` during task execution.

## Related Skills
- `flash-sale-project-context` — Provides overarching project goals and invariants.
- `execute-task-safely` — Enforces task boundaries and allowed file paths.
- `clean-code-separation` — Enforces clean separation between DTOs, controllers, and services.
- `loop-engineering` — Orchestrates the step-by-step implementation loop.

## Handoff / Completion
Confirm that all contract boundaries are strictly respected, interface types match contract DTOs, and integration verification tests pass.
