#!/usr/bin/env python3
import json
import os
import re
import statistics

# Defaults preserve the historical candidate list for audit purposes.  Supply
# EXP_A_API085_RUNS / EXP_A_API090_RUNS as comma-separated artifact paths when
# producing a clean-series comparison.
default_series = {
    "api085": [
        "artifacts/day5/stress/exp-a-baseline-r1c-20260829T221620Z",
        "artifacts/day5/stress/exp-a-baseline-r2-20260829T212642Z",
        "artifacts/day5/stress/exp-a-baseline-r3c-20260829T221840Z",
    ],
    "api090": [
        "artifacts/day5/stress/exp-a-api090-r1-20260829T214013Z",
        "artifacts/day5/stress/exp-a-api090-r2-20260829T214440Z",
        "artifacts/day5/stress/exp-a-api090-r3c-20260829T221400Z",
    ],
}


def series_from_environment(name):
    raw = os.environ.get(name)
    if not raw:
        return None
    return [item.strip() for item in raw.split(",") if item.strip()]


series = {
    "api085": series_from_environment("EXP_A_API085_RUNS") or default_series["api085"],
    "api090": series_from_environment("EXP_A_API090_RUNS") or default_series["api090"],
}

def metric(m, name, key, default=0):
    return m.get(name, {}).get("values", {}).get(key, default)


def clean_reasons(meta, metrics):
    """Return every reason an artifact cannot enter an EXP-A clean median."""
    reasons = []
    if meta.get("validityStatus") != "VALID":
        reasons.append(f"metadata.validityStatus={meta.get('validityStatus')!r}")

    bad_reads = metric(metrics, "reads_bad_contract", "count", 0)
    if bad_reads != 0:
        reasons.append(f"reads_bad_contract={bad_reads}")

    orders = metric(metrics, "orders_requests", "count", 0)
    if orders != 1500:
        reasons.append(f"orders_requests={orders} (expected 1500)")

    dropped = metric(metrics, "dropped_iterations", "count", 0)
    if dropped != 0:
        reasons.append(f"dropped_iterations={dropped}")

    auth_failures = metric(metrics, "auth_setup_failures", "count", 0)
    if auth_failures != 0:
        reasons.append(f"auth_setup_failures={auth_failures}")

    exit_codes = meta.get("exitCodes", {})
    for key in ("queueDrain", "integrity", "targetMonitoring"):
        if exit_codes.get(key) != 0:
            reasons.append(f"exitCodes.{key}={exit_codes.get(key)!r}")
    return reasons

def parse_cgroup_file(filepath):
    services = {}
    if not os.path.exists(filepath):
        return services
    current_svc = None
    with open(filepath) as f:
        for line in f:
            line = line.strip()
            if line.startswith("phase=") and "service=" in line:
                m = re.search(r'service=([^\s]+)', line)
                if m:
                    current_svc = m.group(1)
                    services[current_svc] = {}
            elif current_svc and " " in line:
                parts = line.split()
                if len(parts) == 2 and parts[1].isdigit():
                    services[current_svc][parts[0]] = int(parts[1])
    return services

def get_cgroup_deltas(d):
    before = parse_cgroup_file(os.path.join(d, "cgroup-before.txt"))
    after = parse_cgroup_file(os.path.join(d, "cgroup-after.txt"))
    deltas = {}
    for svc, a_stats in after.items():
        b_stats = before.get(svc, {})
        deltas[svc] = {
            "nr_periods": a_stats.get("nr_periods", 0) - b_stats.get("nr_periods", 0),
            "nr_throttled": a_stats.get("nr_throttled", 0) - b_stats.get("nr_throttled", 0),
            "throttled_usec": a_stats.get("throttled_usec", 0) - b_stats.get("throttled_usec", 0),
        }
        if deltas[svc]["nr_periods"] > 0:
            deltas[svc]["throttle_pct"] = (deltas[svc]["nr_throttled"] / deltas[svc]["nr_periods"]) * 100
        else:
            deltas[svc]["throttle_pct"] = 0.0
    return deltas

def analyze(name, dirs):
    rows = []
    cgroup_rows = []

    for d in dirs:
        meta_path = os.path.join(d, "metadata.json")
        k6_path = os.path.join(d, "k6-summary.json")

        if not os.path.isdir(d) or not os.path.exists(meta_path) or not os.path.exists(k6_path):
            print(f"SKIP {os.path.basename(d)}: missing artifact directory, metadata, or summary")
            continue

        with open(meta_path) as f:
            meta = json.load(f)

        with open(k6_path) as f:
            s = json.load(f)

        m = s["metrics"]
        reasons = clean_reasons(meta, m)
        if reasons:
            print(f"SKIP {os.path.basename(d)}: " + "; ".join(reasons))
            continue
        row = {
            "run": os.path.basename(d),
            "read_rps": metric(m, "reads_ok_200", "rate"),
            "read_p50": metric(m, "read_products_latency", "med"),
            "read_p90": metric(m, "read_products_latency", "p(90)"),
            "read_p95": metric(m, "read_products_latency", "p(95)"),
            "read_p99": metric(m, "read_products_latency", "p(99)", None),
            "read_avg": metric(m, "read_products_latency", "avg"),
            "orders": metric(m, "orders_requests", "count"),
            "202": metric(m, "orders_202", "count"),
            "409": metric(m, "orders_409", "count"),
            "503": metric(m, "orders_503", "count"),
            "5xx": metric(m, "orders_5xx", "count"),
            "write_p50": metric(m, "place_order_latency", "med"),
            "write_p90": metric(m, "place_order_latency", "p(90)"),
            "write_p95": metric(m, "place_order_latency", "p(95)"),
            "write_p99": metric(m, "place_order_latency", "p(99)", None),
            "write_avg": metric(m, "place_order_latency", "avg"),
            "p95_202": metric(m, "place_order_202_latency", "p(95)"),
            "p95_5xx": metric(m, "place_order_5xx_latency", "p(95)"),
        }
        rows.append(row)
        cgroup_rows.append(get_cgroup_deltas(d))

    print(f"\n=== {name.upper()} RUN DETAILS ===")
    for i, r in enumerate(rows):
        cg = cgroup_rows[i]
        api_throttled = sum(cg.get(f"api-{n}", {}).get("nr_throttled", 0) for n in [1, 2, 3])
        api_periods = sum(cg.get(f"api-{n}", {}).get("nr_periods", 0) for n in [1, 2, 3])
        api_pct = (api_throttled / api_periods * 100) if api_periods else 0
        api_time_ms = sum(cg.get(f"api-{n}", {}).get("throttled_usec", 0) for n in [1, 2, 3]) / 1000
        nginx_cg = cg.get("nginx", {})
        print(
            f"{r['run']}:\n"
            f"  Read : {r['read_rps']:,.2f} rps | p50={r['read_p50']:.2f}ms | p95={r['read_p95']:.2f}ms\n"
            f"  Write: 202={r['202']:.0f} | 409={r['409']:.0f} | 503={r['503']:.0f} | 5xx={r['5xx']:.0f} | p50={r['write_p50']:.2f}ms | 202 p95={r['p95_202']:.2f}ms\n"
            f"  Cgroup: API Throttle={api_throttled}/{api_periods} ({api_pct:.1f}%, {api_time_ms:,.1f}ms) | Nginx Throttle={nginx_cg.get('nr_throttled',0)} ({nginx_cg.get('throttled_usec',0)/1000:,.1f}ms)"
        )

    if len(rows) != 3:
        raise SystemExit(f"{name}: expected 3 VALID runs, got {len(rows)}")

    keys = ["read_rps", "read_p50", "read_p90", "read_p95", "read_avg", "202", "409", "503", "5xx", "write_p50", "write_p90", "write_p95", "write_avg", "p95_202", "p95_5xx"]
    med = {k: statistics.median(r[k] for r in rows) for k in keys}

    for percentile_key in ("read_p99", "write_p99"):
        values = [r[percentile_key] for r in rows if r[percentile_key] is not None]
        med[percentile_key] = statistics.median(values) if len(values) == 3 else None

    med["api_throttled"] = statistics.median(sum(cg.get(f"api-{n}", {}).get("nr_throttled", 0) for n in [1, 2, 3]) for cg in cgroup_rows)
    med["api_periods"] = statistics.median(sum(cg.get(f"api-{n}", {}).get("nr_periods", 0) for n in [1, 2, 3]) for cg in cgroup_rows)
    med["api_throttle_pct"] = (med["api_throttled"] / med["api_periods"] * 100) if med["api_periods"] else 0
    med["api_throttled_ms"] = statistics.median(sum(cg.get(f"api-{n}", {}).get("throttled_usec", 0) for n in [1, 2, 3]) / 1000 for cg in cgroup_rows)

    med["nginx_throttled"] = statistics.median(cg.get("nginx", {}).get("nr_throttled", 0) for cg in cgroup_rows)
    med["nginx_periods"] = statistics.median(cg.get("nginx", {}).get("nr_periods", 0) for cg in cgroup_rows)
    med["nginx_throttle_pct"] = (med["nginx_throttled"] / med["nginx_periods"] * 100) if med["nginx_periods"] else 0
    med["nginx_throttled_ms"] = statistics.median(cg.get("nginx", {}).get("throttled_usec", 0) / 1000 for cg in cgroup_rows)

    print(f"\n--- {name.upper()} MEDIANS ---")
    for k in keys:
        print(f"  {k:16s} = {med[k]:.2f}")
    for k in ("read_p99", "write_p99"):
        print(f"  {k:16s} = {med[k]:.2f}" if med[k] is not None else f"  {k:16s} = N/A (not emitted by this harness revision)")
    print(f"  api_throttle_pct = {med['api_throttle_pct']:.2f}% ({med['api_throttled_ms']:,.1f} ms)")
    print(f"  nginx_throttle_ms= {med['nginx_throttled_ms']:,.1f} ms")
    return med

b = analyze("API 0.85 (Baseline)", series["api085"])
c = analyze("API 0.90 (Candidate)", series["api090"])

print("\n=== DELTA: API 0.90 vs API 0.85 ===")
for k in ["read_rps", "read_p50", "read_p90", "read_p95", "read_p99", "read_avg", "202", "409", "503", "5xx", "write_p50", "write_p90", "write_p95", "write_p99", "write_avg", "p95_202", "p95_5xx", "api_throttled", "api_throttle_pct", "api_throttled_ms", "nginx_throttled", "nginx_throttle_pct", "nginx_throttled_ms"]:
    if b[k] is None or c[k] is None:
        print(f"{k:20s}: N/A (not emitted by this harness revision)")
        continue
    delta = c[k] - b[k]
    pct = (delta / b[k] * 100) if b[k] != 0 else 0
    print(f"{k:20s}: {b[k]:>10.2f} -> {c[k]:>10.2f}  ({delta:>+10.2f}, {pct:>+7.2f}%)")
