/* eslint-disable */
// =============================================================================
// Flash Sale System — k6 Load Test  [NAC EDITION ⭐]  (architecture.md §9.2)
//
// NAC = Next-Gen Analytics & Cache-profiling
// ─────────────────────────────────────────────────────────────────────────────
// เพิ่มเติมจาก LoadtestO.js:
//   ⭐ B.1  Cache observability — HIT/MISS/BYPASS via X-Cache-Status header
//   ⭐ B.2  TTFB vs Processing time breakdown (waiting / transfer / connect)
//   ⭐ B.3  Hot-key contention scenario (ENABLE_HOT_KEY_TEST=true)
//   ⭐ B.4  Cache stampede detection (cold-start probe)
//   ⭐ B.5  Full percentile distribution: p50/p90/p95/p99/max (via summaryTrendStats)
//   ⭐ B.6  Write forensic tagging: timeout / connReset / 504
//   ⭐ B.7  Queue health probe & Teardown Diagnostics Box
//   ⭐ B.8  Compact Pretty Log Sampling (PRETTY_LOG / VERBOSE_SAMPLE)
//
// ข้อจำกัดที่ห้ามเปลี่ยน (FROZEN):
//   - Frozen API contracts (202/409/503/401/5xx response shapes)
//   - Existing thresholds สำหรับ read_heavy / write_burst
//   - VU-domain JWT mapping (ห้าม modulo)
//   - ออฟไลน์: ห้าม import jslib จากอินเทอร์เน็ต
// =============================================================================

import http from 'k6/http';
import exec from 'k6/execution';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// ANSI Color Codes
// ---------------------------------------------------------------------------
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

// ---------------------------------------------------------------------------
// Config — env var overrides with safe defaults
// ---------------------------------------------------------------------------
const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');
const REQ_TIMEOUT = __ENV.REQ_TIMEOUT || '60s';

// สินค้าเป้าหมายของ write burst — สามารถกำหนดตัวเดียว (Default: p-1001) หรือหลายตัวคั่นด้วย comma เช่น TARGET_PRODUCTS="p-1001,p-1002,p-1004"
const TARGET_PRODUCT_RAW = __ENV.TARGET_PRODUCTS || __ENV.TARGET_PRODUCT_ID || 'p-1001';
const TARGET_PRODUCTS    = TARGET_PRODUCT_RAW.split(',').map((s) => s.trim()).filter(Boolean);
const TARGET_PRODUCT_ID  = TARGET_PRODUCTS[0] || 'p-1001';

const READ_VUS       = integerEnv('READ_VUS',        1_000, 1, 10_000);
const READ_DURATION  = __ENV.READ_DURATION  || '30s';
const WRITE_VUS      = integerEnv('WRITE_VUS',        500,  1, 5_000);
const WRITE_ITERATIONS  = integerEnv('WRITE_ITERATIONS', 3,  1, 100);
const WRITE_START_TIME  = __ENV.WRITE_START_TIME  || '10s';
const WRITE_MAX_DURATION = __ENV.WRITE_MAX_DURATION || '45s';

// ⭐ B.3 — Hot-key stress scenario (optional, off by default)
const ENABLE_HOT_KEY_TEST = (__ENV.ENABLE_HOT_KEY_TEST || 'false').toLowerCase() === 'true';
const HOT_KEY_VUS      = integerEnv('HOT_KEY_VUS',    2_000, 1, 5_000);
const HOT_KEY_DURATION = __ENV.HOT_KEY_DURATION || '10s';

// ⭐ B.8 — Response body sampling (0.1% default)
const BODY_SAMPLE_RATE = Number(__ENV.BODY_SAMPLE_RATE || '0.001');
const VERBOSE_SAMPLE   = (__ENV.VERBOSE_SAMPLE || '0') === '1';

// ⭐ B.7 — Queue health probe URL
const QUEUE_METRICS_URL = __ENV.QUEUE_METRICS_URL || `${BASE_URL}/debug/queue/metrics`;

// k6 จอง VU IDs ร่วมกันระหว่าง scenarios และ IDs ของ write scenario
// อาจมีช่องว่าง จึง mint token ครอบคลุม VU ID domain ทั้งสอง scenarios
// แล้ว map idInTest โดยตรง ห้าม modulo เพราะทำให้สอง write VUs ใช้ user ซ้ำได้
const VU_ID_DOMAIN = READ_VUS + WRITE_VUS + (ENABLE_HOT_KEY_TEST ? HOT_KEY_VUS : 0);
const USER_COUNT   = integerEnv('USER_COUNT', VU_ID_DOMAIN, VU_ID_DOMAIN, 15_000);

// จำนวนสินค้าทั้งหมดใน seed — ใช้คำนวณช่วง page ที่ถูกต้อง
const TOTAL_PRODUCTS = integerEnv('TOTAL_PRODUCTS', 20, 1, 100_000);

// -----------------------------------------------------------------------------
// 200/202/409 เป็น healthy HTTP outcomes ของ workload นี้
// 503 อยู่ใน API contract แต่ยังเป็น availability failure จึงต้องคงเป็น
// http_req_failed และมี custom infrastructure metric แยกต่างหาก
// -----------------------------------------------------------------------------
http.setResponseCallback(http.expectedStatuses(200, 202, 409));

// =============================================================================
// Custom Metrics — เดิมจาก LoadtestO.js (ห้ามเปลี่ยนชื่อ)
// =============================================================================
const authSetupCount           = new Counter('auth_setup_count');
const authSetupFailures        = new Counter('auth_setup_failures');
const authSetupRequestDuration = new Trend('auth_setup_request_duration', true);
const authSetupWallDuration    = new Trend('auth_setup_wall_duration',    true);

const orderRequests          = new Counter('orders_requests');
const orders202              = new Counter('orders_202');
const orders409              = new Counter('orders_409');
const orders503              = new Counter('orders_503');
const orders5xx              = new Counter('orders_5xx');
const orders401              = new Counter('orders_unauthorized_401');
const ordersOther            = new Counter('orders_unexpected');
const orderContractValid     = new Rate('orders_contract_valid');
const orderSuccessfulAdmission  = new Rate('orders_successful_admission');
const orderInfrastructureError  = new Rate('orders_infrastructure_error');

const readOk         = new Counter('reads_ok_200');
const readBadShape   = new Counter('reads_bad_contract');
const readStockFresh = new Rate('reads_remaining_stock_present');
const readLatency    = new Trend('read_products_latency',    true);
const orderLatency   = new Trend('place_order_latency',      true);
const order202Latency = new Trend('place_order_202_latency', true);
const order5xxLatency = new Trend('place_order_5xx_latency', true);

// =============================================================================
// ⭐ New Custom Metrics — NAC EDITION
// =============================================================================

// --- B.1 Cache observability ---
const cacheHit      = new Rate('cache_hit_rate');
const cacheMiss     = new Rate('cache_miss_rate');
const cacheBypass   = new Rate('cache_bypass_rate');
const readLatencyHit  = new Trend('read_latency_hit',  true); // latency เมื่อ HIT
const readLatencyMiss = new Trend('read_latency_miss', true); // latency เมื่อ MISS

// --- B.2 TTFB / Timing breakdown (Read) ---
const readServerProcessing = new Trend('read_server_processing_time', true); // waiting
const readNetworkTransfer  = new Trend('read_network_transfer_time',  true); // send+recv
const readConnectionSetup  = new Trend('read_connection_setup_time',  true); // blocked+connect

// --- B.2 TTFB / Timing breakdown (Write) ---
const writeServerProcessing = new Trend('write_server_processing_time', true);
const writeNetworkTransfer  = new Trend('write_network_transfer_time',  true);
const writeConnectionSetup  = new Trend('write_connection_setup_time',  true);

// --- B.3 Hot-key scenario ---
const hotKeyLatency     = new Trend('hot_key_latency', true);
const hotKeyOk          = new Counter('hot_key_ok_200');
const hotKeyCacheHit    = new Rate('hot_key_cache_hit_rate');

// --- B.4 Stampede detection ---
const cacheStampedeEvents = new Counter('cache_stampede_events'); // latency >500ms ใน 2s แรก

// --- B.6 Write forensics ---
const ordersTimeout     = new Counter('orders_timeout');     // status 0, body "timeout"
const ordersConnReset   = new Counter('orders_conn_reset');  // status 0, body "reset"
const ordersGateway504  = new Counter('orders_504');         // status 504

// =============================================================================
// Helper Functions
// =============================================================================
function integerEnv(name, fallback, minimum, maximum) {
  const raw = __ENV[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function contractOrderStatus(status) {
  return [202, 400, 401, 404, 409, 422, 500, 503].includes(status);
}

function infrastructureFailure(status) {
  return status === 0 || status >= 500;
}

// ⭐ Pretty Log Formatter สำหรับ Sampling Log (GET /api/v1/products)
function fmtSampleLog(page, limit, cacheHeader, body, durationMs) {
  let cacheLabel = '';
  if (cacheHeader === 'HIT') {
    cacheLabel = `${C.green}HIT${C.reset}`;
  } else if (cacheHeader === 'MISS') {
    cacheLabel = `${C.magenta}MISS${C.reset}`;
  } else if (cacheHeader === 'EXPIRED') {
    cacheLabel = `${C.yellow}EXPIRED${C.reset}`;
  } else if (cacheHeader === 'BYPASS') {
    cacheLabel = `${C.cyan}BYPASS${C.reset}`;
  } else {
    // Backend operates Cache-Aside internally (Redis) without custom headers:
    cacheLabel = durationMs < 300 ? `${C.green}HIT (Redis)${C.reset}` : `${C.yellow}MISS/SLOW (${durationMs.toFixed(0)}ms)${C.reset}`;
  }

  let productsSummary = 'no data';
  if (body && Array.isArray(body.data) && body.data.length > 0) {
    productsSummary = body.data
      .slice(0, 3)
      .map((p) => `${p.productId || '?'}:${p.remainingStock ?? '?'}/${p.availableStock ?? '?'}`)
      .join(' | ');
    if (body.data.length > 3) {
      productsSummary += ` (+${body.data.length - 3} items)`;
    }
  }

  if (VERBOSE_SAMPLE) {
    return `[SAMPLE 📖 GET /products] page=${page} limit=${limit} (${durationMs.toFixed(1)}ms) | cache=${cacheLabel} | body=${JSON.stringify(body).slice(0, 300)}`;
  }
  return `[SAMPLE 📖 GET /products] page=${page} limit=${limit} (${durationMs.toFixed(1)}ms) | cache=${cacheLabel} | ${productsSummary}`;
}

// =============================================================================
// Options — scenarios, percentiles, and thresholds
// =============================================================================
const _scenarios = {
  read_heavy: {
    // 1,000 concurrent readers
    executor: 'constant-vus',
    vus: READ_VUS,
    duration: READ_DURATION,
    exec: 'readProducts',
    startTime: '5s',
    tags: { scenario_kind: 'read' },
  },
  write_burst: {
    // 500 คนแย่ง 50 ชิ้น พร้อมกัน — iterations: 3 = จำลองการ "กดรัว"
    executor: 'per-vu-iterations',
    vus: WRITE_VUS,
    iterations: WRITE_ITERATIONS,
    exec: 'placeOrder',
    startTime: WRITE_START_TIME,
    maxDuration: WRITE_MAX_DURATION,
    tags: { scenario_kind: 'write' },
  },
};

// ⭐ B.3 — เพิ่ม hot_key_stress ถ้าเปิดใช้
if (ENABLE_HOT_KEY_TEST) {
  _scenarios.hot_key_stress = {
    executor: 'constant-vus',
    vus: HOT_KEY_VUS,
    duration: HOT_KEY_DURATION,
    exec: 'readHotKey',
    startTime: '0s',
    tags: { scenario_kind: 'hot_key' },
  };
}

export const options = {
  discardResponseBodies: false,
  scenarios: _scenarios,
  // ⭐ B.5: บังคับให้ k6 คำนวณ percentiles ครบถ้วน (รวมถึง med/p50 และ p99)
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  thresholds: {
    'http_req_duration{scenario:read_heavy}':  ['p(95)<200'],
    'http_req_duration{scenario:write_burst}': ['p(95)<300'],
  },
};

// =============================================================================
// setup() — mint JWT ครอบคลุม VU ID domain + ⭐ cache-probe (B.4)
// =============================================================================
export function setup() {
  const setupStartedAt = Date.now();
  const tokens = [];
  const failures = [];

  // --- ⭐ B.4 Cache Stampede Probe ---
  const probe = http.get(`${BASE_URL}/api/v1/products?page=1&limit=10`, {
    timeout: REQ_TIMEOUT,
    tags: { name: 'setup:cache-probe' },
  });
  const probeStatus = probe.headers['X-Cache-Status'] || probe.headers['x-cache-status'] || '';
  const probeDuration = probe.timings ? probe.timings.duration : 0;
  const isColdStart = probeStatus === 'MISS' || probeStatus === 'EXPIRED';
  const hasCacheHeader = Boolean(probeStatus);

  if (hasCacheHeader) {
    if (probeStatus === 'HIT') {
      console.log(`[setup] cache probe => ${C.green}HIT (cache is warm)${C.reset}`);
    } else {
      console.log(`[setup] cache probe => ${C.magenta}${probeStatus} (cold start detected)${C.reset}`);
    }
  } else {
    console.log(`[setup] cache probe => ${C.green}READY (${probeDuration.toFixed(1)}ms)${C.reset}`);
  }

  // --- Mint JWTs ---
  for (let i = 1; i <= USER_COUNT; i++) {
    const userId = `user-${i}`;
    const res = http.post(
      `${BASE_URL}/api/v1/auth/token`,
      JSON.stringify({ userId }),
      {
        timeout: REQ_TIMEOUT,
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'setup:auth-token' },
      },
    );

    authSetupCount.add(1);
    authSetupRequestDuration.add(res.timings.duration);

    let token = null;
    if (res.status === 200) {
      try {
        token = res.json('accessToken');
      } catch (e) {
        token = null;
      }
    }

    if (token) {
      tokens[i - 1] = { userId, token };
    } else {
      authSetupFailures.add(1);
      tokens[i - 1] = null;
      failures.push(`${userId} -> HTTP ${res.status}`);
    }
  }

  authSetupWallDuration.add(Date.now() - setupStartedAt);

  if (failures.length > 0) {
    exec.test.abort(
      `setup: minted ${tokens.length - failures.length}/${USER_COUNT} JWTs; ` +
        `refusing a partial identity set (${failures.slice(0, 5).join(', ')})`,
    );
  }

  console.log(
    `[setup] minted ${tokens.length}/${USER_COUNT} JWTs from ${BASE_URL}` +
      (failures.length ? ` (failed: ${failures.slice(0, 5).join(', ')}…)` : ''),
  );

  // ดึง initial cache metrics จาก /metrics เพื่อใช้คำนวณ delta ตอนจบ
  let initialCache = { hits: 0, misses: 0, fallbacks: 0, valid: false };
  try {
    const initRes = http.get(`${BASE_URL}/metrics`, { timeout: '5s', tags: { name: 'setup:init-cache-metrics' } });
    if (initRes.status === 200) {
      initialCache = parseCacheMetrics(initRes.body);
    }
  } catch (e) {
    // fallback if endpoint not accessible
  }

  return { tokens, baseUrl: BASE_URL, isColdStart, hasCacheHeader, initialCache, testStartMs: Date.now() };
}

// =============================================================================
// readProducts — read-heavy
//   สุ่ม page/limit เพื่อไม่ให้ยิงโดน cache key เดียวตลอด
//   ⭐ B.1: อ่าน X-Cache-Status header
//   ⭐ B.2: เก็บ timing breakdown
//   ⭐ B.4: Stampede detection 2s แรก
//   ⭐ B.8: Pretty sampling log
// =============================================================================
export function readProducts(data) {
  const limits = [5, 10, 20];
  const limit = limits[Math.floor(Math.random() * limits.length)];
  const totalPages = Math.max(1, Math.ceil(TOTAL_PRODUCTS / limit));
  const page = 1 + Math.floor(Math.random() * totalPages);

  const res = http.get(
    `${BASE_URL}/api/v1/products?page=${page}&limit=${limit}`,
    {
      timeout: REQ_TIMEOUT,
      tags: { name: 'GET /api/v1/products' },
    },
  );

  readLatency.add(res.timings.duration);

  // ⭐ B.2 — Timing breakdown
  readServerProcessing.add(res.timings.waiting);
  readNetworkTransfer.add(res.timings.sending + res.timings.receiving);
  readConnectionSetup.add(res.timings.blocked + res.timings.connecting);

  // ⭐ B.1 — Cache observability
  const cacheStatus = res.headers['X-Cache-Status'] || res.headers['x-cache-status'] || res.headers['X-Cache'] || res.headers['x-cache'] || '';
  const isHit    = cacheStatus === 'HIT' || (!cacheStatus && res.timings.duration < 300);
  const isMiss   = cacheStatus === 'MISS' || cacheStatus === 'EXPIRED' || (!cacheStatus && res.timings.duration >= 300);
  const isBypass = cacheStatus === 'BYPASS';
  cacheHit.add(isHit);
  cacheMiss.add(isMiss);
  cacheBypass.add(isBypass);

  if (isHit)  { readLatencyHit.add(res.timings.duration);  }
  if (isMiss) { readLatencyMiss.add(res.timings.duration); }

  // ⭐ B.4 — Stampede detection: latency >500ms ใน 2 วินาทีแรก
  const testStartMs = (data && data.testStartMs) ? data.testStartMs : 0;
  if (isMiss && testStartMs > 0) {
    const elapsedMs = Date.now() - testStartMs;
    if (elapsedMs < 2000 && res.timings.duration > 500) {
      cacheStampedeEvents.add(1);
    }
  }

  const ok = check(res, {
    'read: status is 200': (r) => r.status === 200,
  });

  if (!ok) {
    readBadShape.add(1);
    return;
  }

  readOk.add(1);

  // ตรวจ contract (architecture.md §9) — field ต้องครบและ type ต้องถูก
  let body = null;
  try {
    body = res.json();
  } catch (e) {
    readBadShape.add(1);
    return;
  }

  const shapeOk = check(body, {
    'read: status === "success"': (b) => b && b.status === 'success',
    'read: data is array': (b) => b && Array.isArray(b.data),
    'read: meta has total/page/limit/totalPages': (b) =>
      !!b &&
      !!b.meta &&
      typeof b.meta.total === 'number' &&
      typeof b.meta.page === 'number' &&
      typeof b.meta.limit === 'number' &&
      typeof b.meta.totalPages === 'number',
    'read: price is a number (ไม่ใช่ string จาก NUMERIC)': (b) =>
      !b || !Array.isArray(b.data) || b.data.length === 0
        ? true
        : typeof b.data[0].price === 'number',
    'read: remainingStock is a number (อ่านสดจาก Redis)': (b) =>
      !b || !Array.isArray(b.data) || b.data.length === 0
        ? true
        : typeof b.data[0].remainingStock === 'number',
  });

  if (!shapeOk) {
    readBadShape.add(1);
  }

  const hasFreshStock =
    !!body &&
    Array.isArray(body.data) &&
    body.data.every((p) => typeof p.remainingStock === 'number');
  readStockFresh.add(hasFreshStock);

  // ⭐ B.8 — Pretty Sampling Log
  if (BODY_SAMPLE_RATE > 0 && Math.random() < BODY_SAMPLE_RATE) {
    console.log(
      fmtSampleLog(page, limit, cacheStatus, body, res.timings.duration),
    );
  }
}

// =============================================================================
// ⭐ B.3 — readHotKey — always hits the SAME cache key (page=1&limit=10)
// =============================================================================
export function readHotKey() {
  const res = http.get(
    `${BASE_URL}/api/v1/products?page=1&limit=10`,
    {
      timeout: REQ_TIMEOUT,
      tags: { name: 'GET /api/v1/products (hot-key)' },
    },
  );

  hotKeyLatency.add(res.timings.duration);

  const cacheStatus = res.headers['X-Cache-Status'];
  hotKeyCacheHit.add(cacheStatus === 'HIT');

  const ok = check(res, { 'hot-key: status is 200': (r) => r.status === 200 });
  if (ok) hotKeyOk.add(1);
}

// =============================================================================
// placeOrder — write burst
//   ⭐ B.2: Timing breakdown
//   ⭐ B.6: Forensic tagging (timeout / conn-reset / 504)
// =============================================================================
export function placeOrder(data) {
  const tokens = data.tokens;

  const idx = exec.vu.idInTest - 1;
  if (idx < 0 || idx >= tokens.length) {
    exec.test.abort(
      `write VU id ${exec.vu.idInTest} exceeds prepared token domain ${tokens.length}`,
    );
  }
  const { userId, token } = tokens[idx];
  const targetProduct = TARGET_PRODUCTS.length === 1
    ? TARGET_PRODUCTS[0]
    : TARGET_PRODUCTS[Math.floor(Math.random() * TARGET_PRODUCTS.length)];

  const res = http.post(
    `${BASE_URL}/api/v1/orders`,
    JSON.stringify({ productId: targetProduct }),
    {
      timeout: REQ_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      tags: { name: 'POST /api/v1/orders' },
    },
  );

  orderLatency.add(res.timings.duration);
  orderRequests.add(1);

  // ⭐ B.2 — Write timing breakdown
  writeServerProcessing.add(res.timings.waiting);
  writeNetworkTransfer.add(res.timings.sending + res.timings.receiving);
  writeConnectionSetup.add(res.timings.blocked + res.timings.connecting);

  const isContractStatus    = contractOrderStatus(res.status);
  const isInfrastructureFailure = infrastructureFailure(res.status);
  orderContractValid.add(isContractStatus);
  orderSuccessfulAdmission.add(res.status === 202);
  orderInfrastructureError.add(isInfrastructureFailure);

  if (res.status >= 500) {
    orders5xx.add(1);
    order5xxLatency.add(res.timings.duration);
  }

  // ⭐ B.6 — Forensic tagging
  if (res.status === 504) {
    ordersGateway504.add(1);
  } else if (res.status === 0) {
    const bodyStr = String(res.body || '').toLowerCase();
    if (bodyStr.includes('connection reset') || bodyStr.includes('econnreset')) {
      ordersConnReset.add(1);
    } else if (bodyStr.includes('timeout') || bodyStr.includes('etimedout')) {
      ordersTimeout.add(1);
    } else {
      ordersTimeout.add(1);
    }
  }

  check(res, {
    'order: status exists in frozen API contract': () => isContractStatus,
  });

  switch (res.status) {
    case 202: {
      orders202.add(1);
      order202Latency.add(res.timings.duration);
      check(res, {
        'order 202: status === "processing"': (r) => {
          try {
            return r.json('status') === 'processing';
          } catch (e) {
            return false;
          }
        },
        'order 202: orderJobId matches ord-<sha256>': (r) => {
          try {
            return /^ord-[a-f0-9]{64}$/.test(r.json('orderJobId'));
          } catch (e) {
            return false;
          }
        },
      });
      break;
    }
    case 409:
      orders409.add(1);
      check(res, {
        'order 409: admission-in-progress contract response': () => true,
      });
      break;
    case 503:
      orders503.add(1);
      break;
    case 401:
      orders401.add(1);
      break;
    default:
      ordersOther.add(1);
      console.error(
        `[order] unexpected status ${res.status} for ${userId}: ${String(res.body).slice(0, 200)}`,
      );
      break;
  }

  // ⭐ Sampling Log สำหรับ POST /api/v1/orders
  if (BODY_SAMPLE_RATE > 0 && Math.random() < BODY_SAMPLE_RATE * 3) {
    const statusColor = res.status === 202 ? C.green : (res.status >= 500 ? C.red : C.yellow);
    let jobTag = '';
    try {
      const parsed = JSON.parse(res.body || '{}');
      if (parsed.data && parsed.data.orderJobId) {
        jobTag = ` | jobId=${parsed.data.orderJobId.slice(0, 16)}...`;
      }
    } catch {}
    console.log(
      `[SAMPLE ⚡ POST /orders] user=${userId} prod=${targetProduct} (${res.timings.duration.toFixed(1)}ms) | status=${statusColor}${res.status}${C.reset}${jobTag}`,
    );
  }
}

// ⭐ Helper แปลงและคำนวณ Cache Metrics จาก Prometheus /metrics endpoint
function parseCacheMetrics(text) {
  let hits = 0;
  let misses = 0;
  let fallbacks = 0;
  let winnerFills = 0;
  let followerFills = 0;

  if (!text || typeof text !== 'string') {
    return { hits: 0, misses: 0, fallbacks: 0, winnerFills: 0, followerFills: 0, total: 0, hitRate: 'n/a', valid: false };
  }

  const reqRegex = /flash_sale_product_cache_requests_total\{[^}]*outcome="([^"]+)"[^}]*\}\s+([0-9.]+)/g;
  let match;
  while ((match = reqRegex.exec(text)) !== null) {
    const outcome = match[1];
    const value = parseFloat(match[2]) || 0;
    if (outcome === 'hit') hits += value;
    else if (outcome === 'miss') misses += value;
    else if (outcome === 'fallback') fallbacks += value;
  }

  const fillRegex = /flash_sale_product_cache_fills_total\{[^}]*outcome="([^"]+)"[^}]*\}\s+([0-9.]+)/g;
  while ((match = fillRegex.exec(text)) !== null) {
    const outcome = match[1];
    const value = parseFloat(match[2]) || 0;
    if (outcome === 'winner') winnerFills += value;
    else if (outcome === 'follower') followerFills += value;
  }

  const total = hits + misses + fallbacks;
  const hitRate = total > 0 ? ((hits / total) * 100).toFixed(2) + '%' : 'n/a';
  return { hits, misses, fallbacks, winnerFills, followerFills, total, hitRate, valid: total > 0 };
}

// =============================================================================
// ⭐ B.7 — teardown() — Diagnostics Box & Exact Prometheus Cache Report
// =============================================================================
export function teardown(data) {
  const queueUrl = QUEUE_METRICS_URL;
  let queueStatusText = '';
  let queueDetails = '';

  try {
    const res = http.get(queueUrl, { timeout: '5s', tags: { name: 'teardown:queue-probe' } });
    if (res.status === 200) {
      try {
        const q = res.json();
        queueStatusText = `${C.green}✅ 200 OK${C.reset}`;
        queueDetails = `waiting=${q.waiting || 0}, active=${q.active || 0}, completed=${q.completed || 0}, failed=${q.failed || 0}`;
      } catch (e) {
        queueStatusText = `${C.yellow}⚠️ 200 OK (invalid JSON body)${C.reset}`;
      }
    } else if (res.status === 404) {
      queueStatusText = `${C.yellow}⚠️ SKIP (404 — endpoint missing)${C.reset}`;
      queueDetails = 'Tip: Add GET /debug/queue/metrics to backend for queue depth';
    } else {
      queueStatusText = `${C.red}⚠️ HTTP ${res.status}${C.reset}`;
    }
  } catch (e) {
    queueStatusText = `${C.red}⚠️ Connection Failed (${e})${C.reset}`;
  }

  // ดึง /metrics จาก API เพื่อคำนวณ Cache Hit / Miss / Hit Rate จริง
  let cacheReport = null;
  try {
    const metricsRes = http.get(`${BASE_URL}/metrics`, { timeout: '5s', tags: { name: 'teardown:cache-metrics' } });
    if (metricsRes.status === 200) {
      const finalMetrics = parseCacheMetrics(metricsRes.body);
      const init = (data && data.initialCache) ? data.initialCache : { hits: 0, misses: 0, fallbacks: 0 };
      const deltaHits = Math.max(0, finalMetrics.hits - init.hits);
      const deltaMisses = Math.max(0, finalMetrics.misses - init.misses);
      const deltaFallbacks = Math.max(0, finalMetrics.fallbacks - init.fallbacks);
      const totalDelta = deltaHits + deltaMisses + deltaFallbacks;
      const rateStr = totalDelta > 0 ? ((deltaHits / totalDelta) * 100).toFixed(2) + '%' : (finalMetrics.valid ? finalMetrics.hitRate : 'n/a');

      cacheReport = {
        hits: totalDelta > 0 ? deltaHits : finalMetrics.hits,
        misses: totalDelta > 0 ? deltaMisses : finalMetrics.misses,
        fallbacks: totalDelta > 0 ? deltaFallbacks : finalMetrics.fallbacks,
        total: totalDelta > 0 ? totalDelta : finalMetrics.total,
        hitRate: rateStr,
        winnerFills: finalMetrics.winnerFills,
        followerFills: finalMetrics.followerFills,
      };
    }
  } catch (e) {
    cacheReport = null;
  }

  const hasCacheHeader = data && data.hasCacheHeader;

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  📊 TEARDOWN & CACHE ANALYTICS REPORT                       │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  if (cacheReport && cacheReport.total > 0) {
    console.log(`│  🎯 PRODUCT CACHE PERFORMANCE (from /metrics)               │`);
    console.log(`│    • Cache HITs       : ${String(cacheReport.hits).padEnd(35)} │`);
    console.log(`│    • Cache MISSes     : ${String(cacheReport.misses).padEnd(35)} │`);
    console.log(`│    • Cache Fallbacks  : ${String(cacheReport.fallbacks).padEnd(35)} │`);
    console.log(`│    • Total Requests   : ${String(cacheReport.total).padEnd(35)} │`);
    console.log(`│    🔥 CACHE HIT RATE  : ${C.green}${C.bold}${cacheReport.hitRate.padEnd(35)}${C.reset} │`);
    console.log(`│    • Stampede Winners : ${String(cacheReport.winnerFills).padEnd(35)} │`);
  } else {
    console.log(`│  🎯 PRODUCT CACHE PERFORMANCE                               │`);
    console.log(`│    X-Cache-Status Header : ${hasCacheHeader ? `${C.green}PRESENT${C.reset}` : `${C.yellow}⚠️ NOT SENT BY BACKEND${C.reset}`}       │`);
    console.log(`│    Tip: ดูเพิ่มเติมผ่าน redis-cli INFO stats หรือ Grafana    │`);
  }
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│  Queue Metrics Probe                                        │');
  console.log(`│    Status: ${queueStatusText.padEnd(48)} │`);
  if (queueDetails) {
    console.log(`│    Info  : ${queueDetails.slice(0, 48).padEnd(48)} │`);
  }
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
}

// =============================================================================
// handleSummary — ⭐ NAC EDITION
// แสดง Cache Layer, TTFB Breakdown, Stampede Analysis, Hot-Key, Write Forensics
// =============================================================================
export function handleSummary(data) {
  const summaryPath = __ENV.SUMMARY_PATH || 'loadtest-nac.k6-summary.json';

  const c = (name) =>
    data.metrics[name] && data.metrics[name].values
      ? data.metrics[name].values.count || 0
      : 0;

  const trend = (name, stat) =>
    data.metrics[name] && data.metrics[name].values
      ? Number(data.metrics[name].values[stat] || 0).toFixed(2)
      : 'n/a';

  const rate = (name) =>
    data.metrics[name] && data.metrics[name].values
      ? `${(Number(data.metrics[name].values.rate || 0) * 100).toFixed(2)}%`
      : 'n/a';

  // ⭐ B.5 — Full percentile row helper (รองรับ med, p50, p90, p95, p99, max)
  const pct = (name) => {
    const m = data.metrics[name];
    if (!m || !m.values) return 'n/a / n/a / n/a / n/a / n/a';
    const v = m.values;
    const f = (k) => {
      const val = v[k] !== undefined ? v[k] : (k === 'p(50)' ? v['med'] : 0);
      return Number(val || 0).toFixed(1);
    };
    return `${f('p(50)')} / ${f('p(90)')} / ${f('p(95)')} / ${f('p(99)')} / ${f('max')} ms`;
  };

  const accepted      = c('orders_202');
  const conflict      = c('orders_409');
  const unavailable   = c('orders_503');
  const serverErrors  = c('orders_5xx');
  const unauthorized  = c('orders_unauthorized_401');
  const unexpected    = c('orders_unexpected');
  const totalOrders   = c('orders_requests');

  const hitRate    = rate('cache_hit_rate');
  const missRate   = rate('cache_miss_rate');
  const bypassRate = rate('cache_bypass_rate');
  const stampedeCount = c('cache_stampede_events');

  const lines = [];
  lines.push('');
  lines.push('══════════════════════════════════════════════════════════════');
  lines.push('  FLASH SALE — LOAD TEST SUMMARY  [NAC EDITION ⭐]');
  const productLabel = TARGET_PRODUCTS.length === 1 ? TARGET_PRODUCTS[0] : `[${TARGET_PRODUCTS.join(', ')}] (${TARGET_PRODUCTS.length} products)`;
  lines.push(`  target: ${BASE_URL}   product(s): ${productLabel}`);
  lines.push('══════════════════════════════════════════════════════════════');
  lines.push('');

  // ─── AUTH SETUP ────────────────────────────────────────────────────────────
  lines.push('  🔐 AUTH SETUP — [POST /api/v1/auth/token]');
  lines.push(`    requests                    : ${c('auth_setup_count')}`);
  lines.push(`    failures                    : ${c('auth_setup_failures')}   (ต้อง = 0)`);
  lines.push(`    request p95                : ${trend('auth_setup_request_duration', 'p(95)')} ms`);
  lines.push(`    total wall duration        : ${trend('auth_setup_wall_duration', 'max')} ms`);
  lines.push('');

  // ─── READ PATH ─────────────────────────────────────────────────────────────
  lines.push('  📖 READ PATH — [GET /api/v1/products] (Cache-Aside Engine)');
  lines.push(`    200 OK                     : ${c('reads_ok_200')}`);
  lines.push(`    contract violations        : ${c('reads_bad_contract')}   (ต้อง = 0)`);
  lines.push(`    p50/p90/p95/p99/max        : ${pct('read_products_latency')}`);
  lines.push(`    avg latency                : ${trend('read_products_latency', 'avg')} ms`);
  lines.push('');

  // ⭐ B.1 — Cache Layer
  lines.push('    ⭐ CACHE LAYER (Redis Performance)');
  if (hitRate === '0.00%' && missRate === '0.00%') {
    lines.push(`       Header Status           : ⚠️ Backend does not attach X-Cache-Status`);
    lines.push(`       Prometheus Cache Rate   : ดูในกล่อง [TEARDOWN & CACHE ANALYTICS] ด้านบน`);
  } else {
    lines.push(`       HIT rate                : ${hitRate}`);
    lines.push(`       MISS rate               : ${missRate}`);
    lines.push(`       BYPASS rate             : ${bypassRate}`);
    lines.push(`       p95 latency (HIT)       : ${trend('read_latency_hit',  'p(95)')} ms`);
    lines.push(`       p95 latency (MISS)      : ${trend('read_latency_miss', 'p(95)')} ms`);
  }
  lines.push('');

  // ⭐ B.2 — Read TTFB Breakdown
  lines.push('    ⭐ SERVER BREAKDOWN (READ - GET)');
  lines.push(`       processing (waiting)    : ${trend('read_server_processing_time', 'p(95)')} ms p95`);
  lines.push(`       network transfer        : ${trend('read_network_transfer_time',  'p(95)')} ms p95`);
  lines.push(`       connection setup        : ${trend('read_connection_setup_time',  'p(95)')} ms p95`);
  lines.push('');

  // ─── WRITE PATH ────────────────────────────────────────────────────────────
  lines.push('  ⚡ WRITE PATH — [POST /api/v1/orders] (Queue Async Admission)');
  lines.push(`    202 accepted (เข้าคิว)      : ${accepted}`);
  lines.push(`    409 admission in progress  : ${conflict}`);
  lines.push(`    503 queue unavailable      : ${unavailable}   (availability fail)`);
  lines.push(`    all 5xx                    : ${serverErrors}   (ต้อง = 0)`);
  lines.push(`    401 unauthorized           : ${unauthorized}   (ต้อง = 0)`);
  lines.push(`    ⚠️ unexpected status        : ${unexpected}   (ต้อง = 0)`);
  lines.push(`    ────────────────────────────────────────────`);
  lines.push(`    total order requests       : ${totalOrders}`);
  lines.push(`    contract-valid rate        : ${rate('orders_contract_valid')}`);
  lines.push(`    successful-admission rate  : ${rate('orders_successful_admission')}`);
  lines.push(`    infrastructure-error rate  : ${rate('orders_infrastructure_error')}`);
  lines.push(`    p50/p90/p95/p99/max        : ${pct('place_order_latency')}`);
  lines.push(`    p95 latency (202 only)     : ${trend('place_order_202_latency', 'p(95)')} ms`);
  lines.push(`    p95 latency (5xx only)     : ${trend('place_order_5xx_latency', 'p(95)')} ms`);
  lines.push('');

  // ⭐ B.2 — Write TTFB Breakdown
  lines.push('    ⭐ SERVER BREAKDOWN (WRITE - POST)');
  lines.push(`       processing (waiting)    : ${trend('write_server_processing_time', 'p(95)')} ms p95`);
  lines.push(`       network transfer        : ${trend('write_network_transfer_time',  'p(95)')} ms p95`);
  lines.push(`       connection setup        : ${trend('write_connection_setup_time',  'p(95)')} ms p95`);
  lines.push('');

  // ⭐ B.6 — Write Forensics
  lines.push('    ⭐ WRITE FORENSICS');
  lines.push(`       connection resets       : ${c('orders_conn_reset')}`);
  lines.push(`       gateway timeouts (504)  : ${c('orders_504')}`);
  lines.push(`       client timeouts         : ${c('orders_timeout')}`);
  lines.push('');

  // ⭐ B.3 — Hot-Key Stress (conditional)
  if (ENABLE_HOT_KEY_TEST) {
    const hotKeyCount  = c('hot_key_ok_200');
    const hotKeyHitR   = rate('hot_key_cache_hit_rate');
    const hotKeyP95    = trend('hot_key_latency', 'p(95)');
    const hotKeyP99    = trend('hot_key_latency', 'p(99)');
    const hotKeyMax    = trend('hot_key_latency', 'max');
    const stampedeFlag = (Number(hotKeyP99) > 1000) ? 'YES ⚠️  (p99>1000ms)' : 'NO ✅';
    lines.push('  ⭐ HOT KEY STRESS — GET /api/v1/products?page=1&limit=10');
    lines.push(`    requests                   : ${hotKeyCount}`);
    lines.push(`    p95 / p99 / max latency    : ${hotKeyP95} / ${hotKeyP99} / ${hotKeyMax} ms`);
    lines.push(`    HIT rate                   : ${hotKeyHitR}`);
    lines.push(`    stampede detected          : ${stampedeFlag}`);
    lines.push('');
  }

  // ⭐ B.4 — Cache Stampede Analysis
  lines.push('  ⭐ CACHE STAMPEDE ANALYSIS');
  lines.push(`    cold start detected        : (see [setup] log above)`);
  lines.push(`    stampede events (>500ms)   : ${stampedeCount}`);
  if (stampedeCount > 0) {
    lines.push(`    recommendation             : pre-warm cache before flash sale OR`);
    lines.push(`                                 implement cache-aside with SETNX lock`);
  } else {
    lines.push(`    recommendation             : ✅ no stampede detected`);
  }
  lines.push('');

  // ─── Data Integrity ────────────────────────────────────────────────────────
  lines.push('  ตรวจ Data Integrity ต่อ (architecture.md §9.3):');
  for (const pid of TARGET_PRODUCTS.slice(0, 3)) {
    lines.push(`    psql: SELECT product_id, available_stock, remaining_stock FROM products WHERE product_id = '${pid}';`);
  }
  lines.push(`    psql: SELECT COUNT(*), COUNT(DISTINCT user_id) FROM orders WHERE product_id = '${TARGET_PRODUCT_ID}'; -- ต้อง = 50, 50`);
  lines.push(`    redis-cli -p 6380 GET stock:flash_sale:${TARGET_PRODUCT_ID}                    -- ต้อง = "0"`);
  lines.push('══════════════════════════════════════════════════════════════');
  lines.push('');

  const sanitized = { ...data };
  delete sanitized.setup_data;

  return {
    stdout: lines.join('\n'),
    [summaryPath]: JSON.stringify(sanitized, null, 2),
  };
}
