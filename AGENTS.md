# FlashSaleSystem Agent Instructions

Before designing or implementing anything in this repository:

1. Read `README.md` and the assigned file under `doc/task/`.
2. Treat `doc/contracts/` as frozen integration contracts.
3. Treat `doc/architecture/architecture.md` as the winning Fastest-Safe source of truth.
4. Read `.agent/howtouseskill.md`, then apply the relevant repository skill files under `.agent/skills/`.
5. Preserve these invariants: `remaining_stock >= 0`, no duplicate successful `(user_id, product_id)`, every retry is idempotent through `order_results`, and PostgreSQL is the final authority.
6. Never claim an optimization is fastest until real k6 results from the target VM pass all SQL correctness gates.

For Worker/Database tasks, always combine:

- `.agent/skills/flash-sale-project-context/SKILL.md`
- `.agent/skills/follow-project-contracts/SKILL.md`
- `.agent/skills/bullmq-queue-processing/SKILL.md`
- `.agent/skills/postgres-typeorm-concurrency/SKILL.md`
- `.agent/skills/flash-sale-testing/SKILL.md`

If a skill conflicts with a frozen contract, stop and report the mismatch. Do not silently choose one.
