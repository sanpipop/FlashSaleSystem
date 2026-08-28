# Invalid harness validation

Status: `INVALID`

Reason: k6 rejected the initial script before generating traffic because the write
infrastructure-error threshold referenced a non-existent metric. The harness was fixed,
and validation restarted in a new evidence directory. These numbers are not an official
baseline because k6 and the backend were on the same host.
