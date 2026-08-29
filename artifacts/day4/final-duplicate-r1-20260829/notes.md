# Run classification

- Status: `VALID`
- Reason: 50 users sent three concurrent requests each; 150 responses followed the 202/409 contract and only 50 durable jobs/orders were created.
- Evidence: `metadata.json`, `k6-summary.json`, `k6-output.txt`, and resource files in this directory.
- Correctness: see `integrity.txt`; write scenarios also include `queue.txt`.

