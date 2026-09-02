#!/usr/bin/env bash
# ==============================================================================
# Cache Stats Aggregator — Flash Sale System
#
# Usage:
#   bash scripts/cache-stats.sh                  # Checks default VM (172.30.58.6)
#   bash scripts/cache-stats.sh 172.30.58.17     # Checks another VM IP
#   bash scripts/cache-stats.sh admin@172.30.58.6
#   bash scripts/cache-stats.sh --local          # Checks local Docker containers
# ==============================================================================

set -euo pipefail

TARGET="${1:-${TARGET_SSH:-admin@172.30.58.6}}"

# Embedded Node.js script to fetch and aggregate /metrics from all API instances
NODE_SCRIPT='
const http = require("http");
const instances = ["api-1", "api-2", "api-3", "api-4"];

function fetchMetrics(inst) {
  return new Promise((resolve) => {
    http.get(`http://${inst}:3000/metrics`, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => {
        let hit = 0, miss = 0, fallback = 0;
        const hitMatch = data.match(/flash_sale_product_cache_requests_total\{[^}]*outcome="hit"[^}]*\}\s+([0-9.]+)/);
        const missMatch = data.match(/flash_sale_product_cache_requests_total\{[^}]*outcome="miss"[^}]*\}\s+([0-9.]+)/);
        const fbMatch = data.match(/flash_sale_product_cache_requests_total\{[^}]*outcome="fallback"[^}]*\}\s+([0-9.]+)/);
        if (hitMatch) hit = parseFloat(hitMatch[1]);
        if (missMatch) miss = parseFloat(missMatch[1]);
        if (fbMatch) fallback = parseFloat(fbMatch[1]);
        resolve({ inst, hit, miss, fallback, total: hit + miss + fallback });
      });
    }).on("error", () => resolve({ inst, hit: 0, miss: 0, fallback: 0, total: 0 }));
  });
}

Promise.all(instances.map(fetchMetrics)).then((rows) => {
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│  📊 TOTAL PRODUCT CACHE METRICS (ALL INSTANCES)             │");
  console.log("├─────────┬──────────────┬─────────────┬────────────┬─────────┤");
  console.log("│ INSTANCE│     HIT      │    MISS     │  FALLBACK  │ HIT RATE│");
  console.log("├─────────┼──────────────┼─────────────┼────────────┼─────────┤");
  let sumHit = 0, sumMiss = 0, sumFb = 0;
  for (const r of rows) {
    sumHit += r.hit;
    sumMiss += r.miss;
    sumFb += r.fallback;
    const rate = r.total > 0 ? ((r.hit / r.total) * 100).toFixed(2) + "%" : "n/a";
    console.log(`│ ${r.inst.padEnd(8)}│ ${r.hit.toLocaleString().padStart(12)} │ ${r.miss.toLocaleString().padStart(11)} │ ${r.fallback.toLocaleString().padStart(10)} │ ${rate.padStart(7)} │`);
  }
  const grandTotal = sumHit + sumMiss + sumFb;
  const overallRate = grandTotal > 0 ? ((sumHit / grandTotal) * 100).toFixed(2) + "%" : "0%";
  console.log("├─────────┼──────────────┼─────────────┼────────────┼─────────┤");
  console.log(`│ TOTAL   │ ${sumHit.toLocaleString().padStart(12)} │ ${sumMiss.toLocaleString().padStart(11)} │ ${sumFb.toLocaleString().padStart(10)} │ ${overallRate.padStart(7)} │`);
  console.log("└─────────┴──────────────┴─────────────┴────────────┴─────────┘");
  console.log(` 🔥 OVERALL CACHE HIT RATE: ${overallRate} (${sumHit.toLocaleString()} hits / ${grandTotal.toLocaleString()} total requests)\n`);
});
'

if [ "$TARGET" = "--local" ]; then
  echo "Fetching cache metrics from local Docker..."
  docker compose exec -T api-1 node -e "$NODE_SCRIPT"
else
  # Add user@ if only IP is provided
  if [[ "$TARGET" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    TARGET="admin@$TARGET"
  fi
  echo "Connecting to $TARGET to fetch cache metrics..."
  ssh "$TARGET" "cd /srv/project_backend/FlashSaleSystem 2>/dev/null || cd /srv/FlashSaleSystem 2>/dev/null || cd ~/FlashSaleSystem 2>/dev/null; docker compose exec -T api-1 node -e '$(echo "$NODE_SCRIPT" | tr '\n' ' ')'"
fi
