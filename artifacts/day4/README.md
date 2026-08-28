# Day 4 benchmark evidence

Official run evidence belongs in a unique directory per profile, cache state, run number,
and timestamp. A run must never overwrite another run.

Expected files include:

- `metadata.json` — target and load-generator identity, profile, parameters, and validity.
- `k6-summary.json` — k6 `handleSummary` output with only sensitive `setup_data`
  removed; metrics remain unedited.
- `k6-output.txt` — console summary from the same run.
- `integrity.txt` — output from `scripts/verify-integrity.sh` after queue drain.
- `queue.txt` — queue depth and drain-time evidence.
- `resource-summary.txt` — target and load-generator CPU/RAM observations.
- `notes.md` — validity decision and any invalidating condition.

Never store JWTs, authorization headers, signing secrets, database passwords, Redis
credentials, SSH keys, or `.env` contents in this directory.
