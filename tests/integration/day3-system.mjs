import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const baseUrl = process.env.BASE_URL ?? 'http://localhost';
const productId = 'p-day3-integration';
const userOne = `day3-user-a-${Date.now()}`;
const userTwo = `day3-user-b-${Date.now()}`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr ?? ''}`);
  }
  return (result.stdout ?? '').trim();
}

function compose(args, capture = false) {
  return run('docker', ['compose', ...args], { capture });
}

function sql(statement) {
  return compose(
    [
      'exec', '-T', 'postgres', 'psql', '-U', process.env.POSTGRES_USER ?? 'flashsale',
      '-d', process.env.POSTGRES_DB ?? 'flashsale', '-At', '-v', 'ON_ERROR_STOP=1', '-c', statement,
    ],
    true,
  );
}

function apiMetricSum(metricName, labelName, labelValue) {
  let total = 0;
  for (const service of ['api-1', 'api-2', 'api-3']) {
    const body = compose([
      'exec', '-T', service, 'wget', '-q', '-O', '-', 'http://127.0.0.1:3000/metrics',
    ], true);
    for (const line of body.split('\n')) {
      if (
        line.startsWith(`${metricName}{`) &&
        line.includes(`${labelName}="${labelValue}"`)
      ) {
        total += Number(line.slice(line.lastIndexOf(' ') + 1));
      }
    }
  }
  return total;
}

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(5_000),
  });
  return response;
}

async function token(userId) {
  const response = await request('/api/v1/auth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'success');
  assert.equal(typeof body.accessToken, 'string');
  return body.accessToken;
}

async function order(accessToken, requestId) {
  const response = await request('/api/v1/orders', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'x-request-id': requestId,
    },
    body: JSON.stringify({ productId }),
  });
  assert.equal(response.status, 202);
  return response.json();
}

async function poll(description, predicate, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${description}.`);
}

function setupProduct() {
  sql(`
    DELETE FROM transactional_outbox WHERE aggregate_id = '${productId}';
    DELETE FROM order_results WHERE product_id = '${productId}';
    DELETE FROM orders WHERE product_id = '${productId}';
    DELETE FROM products WHERE product_id = '${productId}';
    INSERT INTO products (
      product_id, name, price, available_stock, remaining_stock, is_flash_sale_active
    ) VALUES ('${productId}', 'Day 3 Integration Product', 1, 2, 2, true);
  `);
}

function cleanupProduct() {
  sql(`
    DELETE FROM transactional_outbox WHERE aggregate_id = '${productId}';
    DELETE FROM order_results WHERE product_id = '${productId}';
    DELETE FROM orders WHERE product_id = '${productId}';
    DELETE FROM products WHERE product_id = '${productId}';
  `);
}

async function main() {
  setupProduct();
  let cacheStopped = false;
  try {
    const epoch = Number(compose(['exec', '-T', 'redis-cache', 'redis-cli', 'INCR', 'fs:cache:products:epoch'], true));
    assert.ok(Number.isSafeInteger(epoch));

    const firstProducts = await request('/api/v1/products?page=1&limit=37');
    assert.equal(firstProducts.status, 200);
    const firstBody = await firstProducts.json();
    assert.equal(firstBody.status, 'success');
    assert.ok(firstBody.data.some((product) => product.productId === productId));

    const secondProducts = await request('/api/v1/products?page=1&limit=37');
    assert.equal(secondProducts.status, 200);
    const cacheExists = compose([
      'exec', '-T', 'redis-cache', 'redis-cli', 'EXISTS',
      `fs:cache:products:v=${epoch}:page=1:limit=37`,
    ], true);
    assert.equal(cacheExists, '1');

    compose(['exec', '-T', 'redis-cache', 'redis-cli', 'SCRIPT', 'FLUSH']);
    const afterScriptFlush = await request('/api/v1/products?page=1&limit=37');
    assert.equal(afterScriptFlush.status, 200);

    const fillsBefore = apiMetricSum('flash_sale_product_cache_fills_total', 'outcome', 'winner');
    const fallbacksBefore = apiMetricSum('flash_sale_product_cache_requests_total', 'outcome', 'fallback');
    compose(['exec', '-T', 'redis-cache', 'redis-cli', 'INCR', 'fs:cache:products:epoch']);
    const burst = await Promise.all(
      Array.from({ length: 30 }, () => request('/api/v1/products?page=1&limit=37')),
    );
    assert.ok(burst.every((response) => response.status === 200));
    const fillsAfter = apiMetricSum('flash_sale_product_cache_fills_total', 'outcome', 'winner');
    const fallbacksAfter = apiMetricSum('flash_sale_product_cache_requests_total', 'outcome', 'fallback');
    assert.equal(fillsAfter - fillsBefore, 1);
    assert.equal(fallbacksAfter - fallbacksBefore, 0);

    const metrics = await request('/metrics');
    assert.equal(metrics.status, 200);
    const metricsText = await metrics.text();
    assert.match(metricsText, /flash_sale_http_requests_total/);
    assert.match(metricsText, /flash_sale_product_cache_requests_total/);

    const board = await request('/admin/queues/');
    assert.equal(board.status, 200);
    assert.match(await board.text(), /Bull Dashboard/i);
    const boardData = await request('/admin/queues/api/queues');
    assert.equal(boardData.status, 200);
    const boardBody = await boardData.json();
    assert.ok(boardBody.queues.some((queue) => queue.name === 'orders'));
    const grafana = await request('/grafana/');
    assert.equal(grafana.status, 200);
    assert.match(await grafana.text(), /Grafana/i);

    const firstToken = await token(userOne);
    const admitted = await order(firstToken, 'day3-correlation-request-a');
    assert.equal(admitted.status, 'processing');
    assert.match(admitted.orderJobId, /^ord-[a-f0-9]{64}$/);

    const duplicateResponses = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        order(firstToken, `day3-duplicate-${index}`),
      ),
    );
    assert.ok(duplicateResponses.every((item) => item.orderJobId === admitted.orderJobId));

    await poll('first durable order result', () =>
      Promise.resolve(sql(`SELECT COUNT(*) FROM order_results WHERE job_id = '${admitted.orderJobId}' AND status = 'SUCCESS';`) === '1'),
    );
    assert.equal(sql(`SELECT COUNT(*) FROM orders WHERE user_id = '${userOne}' AND product_id = '${productId}';`), '1');

    compose(['stop', 'redis-cache']);
    cacheStopped = true;
    const secondToken = await token(userTwo);
    const admittedDuringOutage = await order(secondToken, 'day3-cache-outage-request');
    await poll('order commit while cache Redis is down', () =>
      Promise.resolve(sql(`SELECT COUNT(*) FROM order_results WHERE job_id = '${admittedDuringOutage.orderJobId}' AND status = 'SUCCESS';`) === '1'),
    );
    assert.ok(Number(sql(`SELECT COUNT(*) FROM transactional_outbox WHERE aggregate_id = '${productId}' AND published_at IS NULL;`)) >= 1);

    compose(['up', '-d', '--wait', 'redis-cache']);
    cacheStopped = false;
    await poll('outbox cache invalidation recovery', () =>
      Promise.resolve(sql(`SELECT COUNT(*) FROM transactional_outbox WHERE aggregate_id = '${productId}' AND published_at IS NULL;`) === '0'),
    );

    assert.equal(sql(`SELECT remaining_stock FROM products WHERE product_id = '${productId}';`), '0');
    assert.equal(sql(`SELECT COUNT(*) FROM orders WHERE product_id = '${productId}';`), '2');
    assert.equal(sql(`SELECT COUNT(*) FROM orders WHERE product_id = '${productId}' GROUP BY user_id HAVING COUNT(*) > 1;`), '');
    assert.equal(sql('SELECT COUNT(*) FROM products WHERE remaining_stock < 0;'), '0');
    assert.equal(sql(`SELECT COUNT(*) FROM order_results r LEFT JOIN orders o ON o.id = r.order_id WHERE r.product_id = '${productId}' AND r.status = 'SUCCESS' AND o.id IS NULL;`), '0');

    const logs = compose(['logs', '--since', '10m', 'api-1', 'api-2', 'api-3', 'worker'], true);
    assert.match(logs, /"event":"ORDER_ENQUEUED"/);
    assert.match(logs, /"event":"ORDER_PROCESSED"/);
    assert.match(logs, new RegExp(admitted.orderJobId));

    console.log('PASS Day 3: cache, Bull Board, metrics, correlation, dedup, outbox recovery, and SQL gates.');
  } finally {
    if (cacheStopped) {
      compose(['up', '-d', '--wait', 'redis-cache']);
    }
    cleanupProduct();
  }
}

await main();
