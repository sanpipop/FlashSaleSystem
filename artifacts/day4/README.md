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
- `load-generator-resource.txt` — GNU time CPU/RAM observations from the external k6 host.
- `target-resource.txt` — output from `k6/support/capture-target-evidence.sh` on the VM
  while the matching k6 run is active.
- `notes.md` — validity decision and any invalidating condition.

Never store JWTs, authorization headers, signing secrets, database passwords, Redis
credentials, SSH keys, or `.env` contents in this directory.

For an official run, start target sampling in a separate VM terminal immediately before
launching k6 from the external host:

```bash
CAPTURE_SECONDS=45 CAPTURE_INTERVAL_SECONDS=5 \
  bash k6/support/capture-target-evidence.sh > /tmp/target-resource.txt
```

Pass the values observed on that same target VM to the external runner; do not copy
values from a developer laptop:

```bash
BASE_URL=https://team-x.example.com TEST_PROFILE=write RUN_ID=write-run-1 \
TARGET_COMMIT_SHA='<full-40-character-target-sha>' TARGET_DIRTY_STATE=clean \
TARGET_HOSTNAME='<target-hostname>' TARGET_CPU='4 vCPU' TARGET_RAM='6144 MB' \
  bash k6/run-external.sh
```

After the run, copy `/tmp/target-resource.txt` into the matching artifact directory. A
run without this file, integrity output, a clean target commit SHA, and the external k6
summary remains `AWAITING_INTEGRITY_VERIFICATION` and must not be used as a baseline.
