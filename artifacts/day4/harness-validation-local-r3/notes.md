# Sanitized non-official local harness validation

Status: `NON-OFFICIAL HARNESS VALIDATION`

Five unique users exercised k6 authentication, Nginx order admission, BullMQ, the Worker,
and PostgreSQL. Integrity verification confirmed stock 45, five orders, five durable
results, no duplicate/negative/orphan state, and an unchanged durable snapshot after a
committed-job replay. `k6-summary.json` excludes sensitive `setup_data` and retains metric
values.

Do not use the RPS or latency values as a baseline: k6 and the backend shared one host.
