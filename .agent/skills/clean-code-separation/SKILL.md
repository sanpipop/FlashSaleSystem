# Skill: Clean Code Separation

## Purpose
Enforce strict separation of concerns across all modules in the Flash Sale System. This skill prevents AI agents from generating monolithic "God files" or mixing architectural responsibilities (such as combining Controllers, Business Logic, Database Queries, Queue Operations, and Metrics into a single file).

## When to Use
Activate this skill whenever:
- Creating new files or modules in `apps/api/`, `apps/worker/`, `packages/`, or `database/`.
- Adding new features, endpoints, consumers, or services to existing code.
- Writing operational scripts, event handlers, or queue processors.

## Required Context
FlashSaleSystem mandates modular, single-responsibility file design. Combining distinct architectural layers into a single file makes code fragile, difficult to test, prone to concurrency bugs, and challenging to review.

## Authoritative References
- **NestJS Architecture Guide:** [doc/architecture/architecture.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/architecture.md)
- **Order Flow Separation:** [doc/architecture/order-flow.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/order-flow.md)
- **Team Ownership Boundaries:** [doc/planning/team-ownership.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/planning/team-ownership.md)

## Preconditions
Before creating or modifying a file, evaluate its primary responsibility using the **File-Split Decision Test**.

## Core Rules

### 1. The Single Responsibility Rule
**One file must have exactly ONE clear primary responsibility.**  
Do not combine unrelated architectural layers merely because the implementation is small.

### 2. Forbidden Anti-Patterns ("God Files")

| Forbidden Combination | Why It Is Forbidden | Required Separation |
| --- | --- | --- |
| **Controller + Business Logic + DB Query in 1 file** | Mixes HTTP layer with business & persistence layers | Split into `*.controller.ts`, `*.service.ts`, `*.repository.ts` |
| **Queue Producer + Queue Consumer in 1 file** | Mixes API enqueueing with Worker processing | Split into `*.producer.ts` (API) and `*.consumer.ts` (Worker) |
| **Event Publisher + Event Handler in 1 file** | Blurs event trigger with business execution | Split into `*.event.ts`, `*.publisher.ts`, `*.handler.ts` |
| **Database Entity + Migration in 1 file** | Mixes runtime ORM model with schema DDL | Split into `*.entity.ts` and `migration/*.ts` |
| **Worker Bootstrap + Processing + DB Tx in 1 file** | Mixes application lifecycle with business logic | Split into `main.ts`, `*.processor.ts`, `*.service.ts` |
| **Multiple Operational Jobs in 1 Giant Script** | Creates unsafe, monolithic scripts | Split into `bootstrap.sh`, `migrate.sh`, `reset-db.sh`, `smoke-test.sh` |

---

## Domain-Specific Separation Guidelines

### 1. Backend Layer Separation (NestJS API & Worker)
Separate responsibilities into clean file boundaries:
```text
apps/api/src/orders/
├── orders.controller.ts      # HTTP Request Routing & Response Formatting ONLY
├── orders.service.ts         # Business Logic Orchestration ONLY
├── orders.dto.ts             # Input/Output DTO Validation Schemas ONLY
└── order-queue.producer.ts   # Enqueueing Jobs to BullMQ ONLY
```

### 2. Queue & Event Separation (BullMQ)
- **Queue Producer (`order-queue.producer.ts`):** Validates payload and pushes job to BullMQ queue `orders`.
- **Queue Consumer (`order-queue.consumer.ts`):** Listens for BullMQ jobs and delegates processing to the service.
- **Worker Processor (`order-processor.service.ts`):** Opens PostgreSQL transaction, locks row (`SELECT FOR UPDATE`), and updates stock.

### 3. Function-Level Separation
Avoid giant monolithic functions that perform input validation, claim acquisition, queue enqueueing, database update, metric logging, and response formatting all in one block.  
Prefer orchestration functions that delegate to specialized helpers:
```typescript
// Good Orchestration Pattern Example
async placeOrder(dto: CreateOrderDto, userId: string): Promise<OrderAdmissionResultDto> {
  this.validationService.validateActiveSale(dto.productId);
  await this.claimGuard.acquireClaim(userId, dto.productId);
  const job = await this.orderProducer.enqueueOrderJob(userId, dto.productId);
  this.metricsService.incrementAdmissionCount();
  return this.orderMapper.toAdmissionResult(job);
}
```

### 4. Operational Script Separation
Operational scripts must have a single, explicit purpose:
- `scripts/reset-db.sh` — Resets database state and clears cache/queue.
- `scripts/smoke-test.sh` — Runs HTTP endpoint smoke checks.
- `scripts/verify-integrity.sh` — Executes SQL data integrity queries.

---

## File-Split Decision Test
Before adding new code to an existing file, ask these 6 questions:
1. Does this logic have the same primary responsibility as the rest of the file?
2. Would this logic change for a different reason than the existing code?
3. Does this logic belong to a different architectural layer (e.g., HTTP vs DB vs Queue)?
4. Would another component need to reuse this logic independently?
5. Does placing it here increase tight coupling between unrelated services?
6. Would unit/integration testing be clearer if this logic were isolated in its own file?

If you answer **YES** to any of questions 2–6, **CREATE A SEPARATE FILE**.

---

## Clean Code vs. Over-Engineering
Separation of concerns does NOT mean creating over-engineered abstractions.
- **DO NOT** create an interface for every single 3-line function.
- **DO NOT** create factory classes or wrappers around standard libraries without a clear domain need.
- **DO** maintain cohesive, simple modules with explicit dependencies and clear layer boundaries.

## Verification
Before completing any task, inspect modified files:
- Check file size and ensure no single file exceeds ~250–300 lines of code without strong justification.
- Verify that Controllers do not contain raw TypeORM `createQueryBuilder` or SQL statements.
- Verify that Queue Producers and Queue Consumers reside in separate files and modules.

## Stop Conditions
- Stop if modularizing a file requires modifying forbidden paths outside your task scope. Report the refactoring need to the Integration Captain.

## Forbidden Actions
- DO NOT create "god files" (e.g., `app.service.ts` containing all API, DB, Queue, and Cache logic).
- DO NOT write inline SQL queries directly inside HTTP Controller handlers.
- DO NOT mix BullMQ Worker job processing logic inside API Controller files.

## Related Skills
- `flash-sale-project-context` — Provides system architecture context.
- `follow-project-contracts` — Ensures separated modules still adhere to frozen contracts.
- `execute-task-safely` — Enforces path boundaries while creating new files.
- `loop-engineering` — Orchestrates clean iterative development.

## Handoff / Completion
Confirm that all newly created or modified files follow single-responsibility separation, contain no god-file anti-patterns, and pass typechecking.
