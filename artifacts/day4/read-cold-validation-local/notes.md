# Non-official cold-cache read validation

Status: `NON-OFFICIAL HARNESS VALIDATION`

The isolated cache database was cleared before this short 2-VU contract/metrics test.
It validates the harness path only; requests after the initial miss naturally warm the cache.
Do not report these values as a cold-cache baseline because the backend shared the k6 host.
