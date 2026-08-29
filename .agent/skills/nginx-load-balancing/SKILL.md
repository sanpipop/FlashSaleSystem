# Skill: Nginx Load Balancing

## Purpose
Guide AI agents in configuring, integrating, and tuning Nginx as the reverse proxy, SSL/HTTP entry point, and load balancer for the Flash Sale System. This skill ensures Nginx efficiently distributes incoming traffic across at least 3 stateless NestJS API instances without owning business logic.

## When to Use
Activate this skill whenever:
- Modifying Nginx configuration files in `infra/nginx/`.
- Configuring upstream load balancing strategies (`round_robin`, `least_conn`).
- Setting up request proxying, header forwarding (`X-Request-ID`, `X-Forwarded-For`), timeouts, or keepalive parameters.
- Debugging multi-instance traffic distribution or troubleshooting Nginx 502/504 errors.

## Required Context
Nginx is owned by **Member 1 (Edge / API Lead)**. It acts as the single public entry point on Port 80 for the entire system VM. NestJS API containers run on an internal Docker network and are NOT directly exposed to the public host.

## Authoritative References
- **Architecture Overview:** [doc/architecture/architecture.md](file:///FlashSaleSystem/doc/architecture/architecture.md)
- **API Traffic Flow:** [doc/architecture/api-flow.md](file:///FlashSaleSystem/doc/architecture/api-flow.md)
- **Observability Architecture:** [doc/architecture/observability.md](file:///FlashSaleSystem/doc/architecture/observability.md)
- **Nginx & API Task Plan:** [doc/task/day1/api-nginx.md](file:///FlashSaleSystem/doc/task/day1/api-nginx.md)
- **Load Testing Specification:** [doc/testing/load-testing.md](file:///FlashSaleSystem/doc/testing/load-testing.md)

## Preconditions
1. Confirm allowed paths include `infra/nginx/**`.
2. Inspect Docker Compose service discovery names for NestJS API containers.

## Responsibilities
- **Reverse Proxy & Entry Point:** Accept public HTTP requests on Port 80 and proxy to internal API instances.
- **Load Balancing:** Balance requests across NestJS API instances (at least 3 instances).
- **Header Forwarding:** Forward `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Request-ID`.
- **Connection Optimization:** Manage client/upstream keepalive connections and proxy timeouts.

## Non-Responsibilities
- **DO NOT** embed application business logic (such as JWT verification, duplicate checking, or stock checks) inside Nginx lua/configuration files.
- **DO NOT** load balance database or Redis internal traffic through Nginx.

---

## Core Rules

### 1. Mandatory Topology & Service Discovery
```text
External Client / k6 (Public Port 80)
        ↓
  Nginx Proxy (infra/nginx/nginx.conf)
        ↓ (Internal Docker Network)
┌─────────────────┬─────────────────┬─────────────────┐
│ NestJS API #1   │ NestJS API #2   │ NestJS API #3+  │
└─────────────────┴─────────────────┴─────────────────┘
```
- Nginx MUST upstream to service discovery hostnames defined in Docker Compose (e.g., `http://api:3000` or `api-1`, `api-2`, `api-3`).
- **NEVER** hard-code static IP addresses for containers in `nginx.conf`.

### 2. Load Balancing Strategy Rules
- Baseline load balancing strategy defaults to `round_robin` or `least_conn`.
- **Baseline vs. Experiment:** Do not claim `least_conn` is faster than `round_robin` without empirical k6 benchmark evidence.
- Strategy changes during tuning MUST follow the `performance-tuning` experiment framework (Change one variable → Run k6 → Verify correctness → KEEP/REVERT).

### 3. Request Correlation Header Forwarding
Nginx MUST forward or generate `X-Request-ID` to ensure end-to-end tracing across API, Queue, and Worker:
```nginx
# Example Standard Nginx Header Forwarding
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Request-ID $request_id;
```

### 4. Connection & Timeout Parameters
- **Short Sync Path:** Since `POST /orders` is an Async Admission endpoint (returning 202 Accepted quickly), Nginx `proxy_read_timeout` should be configured cleanly (e.g., 10s–30s) without allowing hung connections to linger.
- **Keepalive Connections:** Upstream keepalive configuration should be treated as a benchmark-driven parameter.

---

## Recommended Workflow

1. **Step 1 — Configuration Inspection:** Inspect `infra/nginx/nginx.conf` and `infra/nginx/conf.d/default.conf`.
2. **Step 2 — Upstream Definition:** Verify upstream pool includes all API instances:
   ```nginx
   upstream api_backend {
       least_conn;
       server api1:3000 max_fails=3 fail_timeout=10s;
       server api2:3000 max_fails=3 fail_timeout=10s;
       server api3:3000 max_fails=3 fail_timeout=10s;
       keepalive 32;
   }
   ```
3. **Step 3 — Configuration Validation:** Validate syntax using `nginx -t` (or via Docker container test command).
4. **Step 4 — Verification:** Send multiple requests to Nginx Port 80 and verify headers and distribution across API containers.

## Verification
- Validate syntax: `docker run --rm -v $(pwd)/infra/nginx/nginx.conf:/etc/nginx/nginx.conf:ro nginx:alpine nginx -t`.
- Verify using `curl -i http://localhost/api/v1/products` that headers (`X-Request-ID`) are returned.
- Check Nginx access logs to verify traffic is distributed across all 3 API instances.

## Performance Considerations
- **Log Level Tuning:** Avoid verbose `debug` access logging during heavy k6 load tests to prevent disk I/O bottleneck.
- **Worker Connections:** Configure `worker_connections 1024` or higher based on host limits.
- **Buffer Settings:** Optimize proxy buffer settings for small JSON payloads.

## Common Anti-Patterns to Avoid
- **Anti-Pattern 1:** Exposing individual NestJS API containers on public host ports (e.g., exposing 3001, 3002, 3003 publicly) alongside Nginx.
- **Anti-Pattern 2:** Hard-coding container IP addresses (e.g., `172.18.0.4`) inside `nginx.conf`.
- **Anti-Pattern 3:** Implementing JWT authentication or rate-limiting scripts inside Nginx Lua instead of NestJS API.
- **Anti-Pattern 4:** Rewriting HTTP 5xx errors to HTTP 200 to mask backend errors during load tests.

## Stop Conditions
- Stop immediately if Nginx service discovery names do not match Docker Compose configuration.
- Stop if modifying Nginx configuration requires changing shared Compose files outside task scope.

## Forbidden Actions
- DO NOT bypass Nginx by having clients call API containers directly during competition load tests.
- DO NOT log sensitive JWT authorization tokens or user credentials in Nginx access logs.
- DO NOT modify Nginx settings during a performance experiment without recording baseline metrics.

## Related Skills
- `loop-engineering` — Orchestrates iterative configuration testing.
- `flash-sale-project-context` — Provides VM infrastructure constraints.
- `execute-task-safely` — Controls task boundaries and git safety.
- `nestjs-api-development` — Governs upstream API behavior behind Nginx.
- `docker-compose-integration` — Coordinates Compose service networking.

## Completion / Handoff
Confirm Nginx configuration syntax is valid, proxy headers forward `X-Request-ID`, traffic balances across 3 API instances, and no files outside `infra/nginx/` were modified.
