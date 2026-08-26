# Skill: Docker Compose Integration

## Purpose
Guide AI agents in defining, integrating, and maintaining the shared Docker Compose runtime topology for the entire Flash Sale System. This skill ensures all core services (Nginx, NestJS API Instances, Redis, BullMQ Worker, PostgreSQL, Bull Board, Observability) integrate seamlessly on a single 4 vCPU / 6 GB RAM VM without port collisions, resource exhaustion, or race conditions.

## When to Use
Activate this skill whenever:
- Modifying shared Docker Compose configuration files (`compose.yaml` or `docker-compose.yml`).
- Adding, updating, or configuring service definitions, internal networks, volumes, health checks, or environment variables.
- Wiring container startup ordering, database migrations, or seed execution.
- Troubleshooting container-to-container network connectivity or startup race conditions.

## Required Context
Docker Compose configuration is a **High-Risk Shared Area** controlled by the **Integration Captain** (rotated daily among Member 1, 2, and 3). Because all three team members rely on Docker Compose to run their services, uncoordinated edits can break the entire development or test environment.

## Authoritative References
- **Architecture Overview:** [doc/architecture/architecture.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/architecture/architecture.md)
- **Team Ownership Policy:** [doc/planning/team-ownership.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/planning/team-ownership.md)
- **Day 1 Compose Task:** [doc/task/day1/docker-compose.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day1/docker-compose.md)
- **Day 1 Integration Check:** [doc/task/day1/day1-integration-check.md](file:///home/netiwut/Documents/shareproject/FlashSaleSystem/doc/task/day1/day1-integration-check.md)

## Preconditions
1. Verify task assignment authorizes shared Docker Compose modifications or that you are serving as Integration Captain.
2. Run `git status` to ensure working directory is clean before making shared Compose edits.

## Responsibilities
- **Service Topology Definition:** Define container services (`nginx`, `api1`, `api2`, `api3`, `worker`, `postgres`, `redis`, `bull-board`).
- **Network Isolation:** Configure internal Docker networks (`frontend-net`, `backend-net`).
- **Volume & Storage Management:** Manage persistent volumes for PostgreSQL (`postgres-data`) and Redis data where appropriate.
- **Environment & Secrets Wiring:** Pass safe environment variables via `.env` files without hard-coding production secrets.
- **Service Healthchecks & Dependency Ordering:** Define readiness healthchecks to prevent startup race conditions.

## Non-Responsibilities
- **DO NOT** embed application business logic, custom shell pipelines, or complex inline SQL scripts inside Docker Compose command strings.
- **DO NOT** use Docker Compose to execute per-request application logic.

---

## Core Rules

### 1. Host Hardware Constraints (4 vCPU / 6 GB RAM Limit)
- Total system resource consumption MUST fit comfortably inside the VM budget:
  - **Host RAM Limit:** 6 GB Total. Container memory limits MUST leave headroom for the OS (Target max container memory footprint: ~4.5–5.0 GB total).
  - **Host CPU Limit:** 4 vCPU Total. Avoid running unnecessary background containers (such as heavy unused monitoring tools during baseline runs).

### 2. Service Exposure & Network Isolation Rules
```text
Public Host Network (Port 80)
        ↓
  [ Nginx Container ]
        ↓ (Internal Docker Network ONLY - No Direct Host Exposure)
┌───────────────────────────────────────────────────────────┐
│  [ NestJS API 1 ]   [ NestJS API 2 ]   [ NestJS API 3 ]   │
│  [ BullMQ Worker ]  [ PostgreSQL ]     [ Redis ]          │
└───────────────────────────────────────────────────────────┘
```
- **Public Entry Point:** ONLY Nginx (Port 80) and Bull Board UI (if scoped for admin) should expose public host ports.
- **Internal Infrastructure:** PostgreSQL (Port 5432) and Redis (Port 6379) MUST run on the internal Docker network and SHOULD NOT expose public host ports in final deployment.

### 3. Startup Readiness & Migration Race Prevention
- **Container Started ≠ Service Ready:** A PostgreSQL container process starting up does NOT mean PostgreSQL is ready to accept connections.
- **Healthcheck Dependency:** Use `depends_on` with `condition: service_healthy` for services dependent on DB/Redis:
  ```yaml
  postgres:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5
  
  worker:
    build: .
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
  ```
- **Single Migration Executor:** Ensure database migrations are executed by a **single dedicated process or init container**. DO NOT let API #1, API #2, API #3, and Worker #1 all race to execute `typeorm migration:run` simultaneously during startup.

### 4. Secret & Environment Variable Rules
- NEVER commit plaintext secrets (passwords, JWT secrets) inside `compose.yaml`.
- Use `.env` file for runtime configuration and maintain `.env.example` with safe placeholder defaults.

---

## Recommended Integration Workflow

1. **Step 1 — Task & Path Audit:** Confirm assigned task explicitly permits Compose changes.
2. **Step 2 — Minimal Edit:** Add or update service definition using standard image tags or multi-stage Dockerfiles.
3. **Step 3 — Configuration Validation:** Run `docker compose config` to validate Compose YAML syntax.
4. **Step 4 — Container Startup Test:** Run `docker compose up --build -d` and inspect container statuses using `docker compose ps`.
5. **Step 5 — Health Audit:** Check logs using `docker compose logs -f <service>` to ensure zero crash loops.
6. **Step 6 — Diff Audit:** Verify `git diff compose.yaml` shows only intended service modifications.

## Verification
- Validate YAML syntax: `docker compose config`.
- Verify all containers reach `healthy` or `running` state: `docker compose ps`.
- Run smoke test: `bash scripts/smoke-test.sh`.

## Performance Considerations
- **Log Rotation:** Configure logging drivers to prevent container logs from filling up the 50 GB host disk:
  ```yaml
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
  ```
- **API Replication:** Minimum required API instance count is 3 containers (`api1`, `api2`, `api3`). Scaling beyond 3 is a benchmark-driven decision.

## Common Anti-Patterns to Avoid
- **Anti-Pattern 1:** Running `docker compose down -v` casually during development, which wipes persistent database volumes.
- **Anti-Pattern 2:** Hard-coding `POSTGRES_PASSWORD=secret123` directly inside `compose.yaml`.
- **Anti-Pattern 3:** Relying on `sleep 10` in shell scripts instead of proper Docker Compose container healthchecks.
- **Anti-Pattern 4:** Allowing all 3 API containers to run schema migrations simultaneously on startup.

## Stop Conditions
- Stop immediately if adding a Compose service causes host memory consumption to exceed 5 GB.
- Stop if modifying service names breaks Nginx or application service discovery without coordination.

## Forbidden Actions
- DO NOT execute `docker compose down -v` unless explicitly instructed for a disposable clean test.
- DO NOT commit `.env` files containing real production passwords or JWT secrets to Git.
- DO NOT expose PostgreSQL or Redis directly to the public host in final competition deployment.

## Related Skills
- `loop-engineering` — Orchestrates the iterative integration testing loop.
- `flash-sale-project-context` — Provides host hardware limits (4 vCPU / 6 GB RAM).
- `execute-task-safely` — Controls shared file governance and path limits.
- `nestjs-api-development` — Governs NestJS API container requirements.
- `nginx-load-balancing` — Governs Nginx container upstream resolution.

## Completion / Handoff
Confirm `docker compose config` passes, all containers start cleanly (`docker compose ps`), `smoke-test.sh` succeeds, and no unauthorized shared files were modified.
