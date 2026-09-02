#!/usr/bin/env bash
# ==============================================================================
# Check Product Stock & Orders — Flash Sale System
#
# Usage:
#   bash scripts/check-stock.sh                   # Checks p-1001 on default VM (172.30.58.6)
#   bash scripts/check-stock.sh p-1002            # Checks another product ID
#   bash scripts/check-stock.sh p-1001 172.30.58.17
#   bash scripts/check-stock.sh p-1001 --local    # Checks local Docker
# ==============================================================================

set -euo pipefail

PRODUCT_ID="p-1001"
TARGET="${TARGET_SSH:-admin@172.30.58.6}"

# Parse arguments: first can be product_id or target/flag
for arg in "$@"; do
  if [[ "$arg" =~ ^p-[0-9]+$ ]]; then
    PRODUCT_ID="$arg"
  elif [ "$arg" = "--local" ]; then
    TARGET="--local"
  elif [[ "$arg" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    TARGET="admin@$arg"
  elif [[ "$arg" =~ @ ]]; then
    TARGET="$arg"
  fi
done

SQL="
SELECT
  product_id,
  available_stock,
  remaining_stock,
  (available_stock - remaining_stock) AS total_sold
FROM products
WHERE product_id = '${PRODUCT_ID}';

SELECT
  COUNT(*) AS total_orders,
  COUNT(DISTINCT user_id) AS unique_buyers
FROM orders
WHERE product_id = '${PRODUCT_ID}';
"

if [ "$TARGET" = "--local" ]; then
  echo "Checking stock for ${PRODUCT_ID} on local Docker..."
  docker compose exec postgres psql -U flashsale -d flashsale -c "$SQL"
else
  echo "Connecting to ${TARGET} to check stock for ${PRODUCT_ID}..."
  ssh "$TARGET" "cd /srv/project_backend/FlashSaleSystem 2>/dev/null || cd /srv/FlashSaleSystem 2>/dev/null || cd ~/FlashSaleSystem 2>/dev/null; docker compose exec postgres psql -U flashsale -d flashsale -c \"$SQL\""
fi
