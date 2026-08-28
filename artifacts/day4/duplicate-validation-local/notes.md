# Non-official duplicate-burst validation

Status: `NON-OFFICIAL HARNESS VALIDATION`

Two unique users each sent three order requests concurrently. Contract checks passed,
and the durable gate found only two logical jobs, two successful orders, stock 48, and no
duplicate/negative/orphan state. Retry replay left durable state unchanged.

Do not use the performance values as a baseline: k6 and the backend shared one host.
