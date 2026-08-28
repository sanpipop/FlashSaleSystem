import http from 'k6/http';
import { check, fail } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || '').replace(/\/$/, '');
const TEST_PROFILE = __ENV.TEST_PROFILE || 'read';
const PRODUCT_ID = __ENV.PRODUCT_ID || 'p-1001';
const USER_PREFIX = __ENV.USER_PREFIX || 'user';
const READ_VUS = integerEnv('READ_VUS', 1_000, 1, 10_000);
const READ_DURATION = __ENV.READ_DURATION || '30s';
const WRITE_USERS = integerEnv('WRITE_USERS', 500, 1, 5_000);
const DUPLICATE_USERS = integerEnv('DUPLICATE_USERS', 50, 1, 500);
const DUPLICATE_REQUESTS = integerEnv('DUPLICATE_REQUESTS', 3, 2, 3);

if (!BASE_URL) {
  throw new Error('BASE_URL is required. Example: BASE_URL=http://target-vm');
}

http.setResponseCallback(http.expectedStatuses(200, 202, 409));

const authDuration = new Trend('auth_duration', true);
const authInfrastructureErrors = new Rate('auth_infra_error');
const authRequests = new Counter('auth_requests');
const readDuration = new Trend('read_duration', true);
const readInfrastructureErrors = new Rate('read_infra_error');
const readRequests = new Counter('read_requests');
const writeDuration = new Trend('write_admission_duration', true);
const writeInfrastructureErrors = new Rate('write_infra_error');
const writeRequests = new Counter('write_admission_requests');
const duplicateDuration = new Trend('duplicate_admission_duration', true);
const duplicateInfrastructureErrors = new Rate('duplicate_infra_error');
const duplicateRequests = new Counter('duplicate_admission_requests');

const profileScenarios = {
  auth: {
    auth_preparation: {
      executor: 'per-vu-iterations',
      vus: WRITE_USERS,
      iterations: 1,
      maxDuration: '2m',
      exec: 'authPreparation',
      tags: { workload: 'auth' },
    },
  },
  read: {
    read_products: {
      executor: 'constant-vus',
      vus: READ_VUS,
      duration: READ_DURATION,
      gracefulStop: '5s',
      exec: 'readProducts',
      tags: { workload: 'read' },
    },
  },
  write: {
    write_competition: {
      executor: 'per-vu-iterations',
      vus: WRITE_USERS,
      iterations: 1,
      maxDuration: '2m',
      exec: 'writeCompetition',
      tags: { workload: 'write' },
    },
  },
  duplicate: {
    duplicate_burst: {
      executor: 'per-vu-iterations',
      vus: DUPLICATE_USERS,
      iterations: 1,
      maxDuration: '2m',
      exec: 'duplicateBurst',
      tags: { workload: 'duplicate' },
    },
  },
};

if (!(TEST_PROFILE in profileScenarios)) {
  throw new Error(`Unknown TEST_PROFILE '${TEST_PROFILE}'. Use auth, read, write, or duplicate.`);
}

const infrastructureMetricByProfile = {
  auth: 'auth_infra_error',
  read: 'read_infra_error',
  write: 'write_infra_error',
  duplicate: 'duplicate_infra_error',
};

export const options = {
  discardResponseBodies: false,
  scenarios: profileScenarios[TEST_PROFILE],
  thresholds: {
    checks: ['rate==1'],
    [infrastructureMetricByProfile[TEST_PROFILE]]: ['rate==0'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function integerEnv(name, fallback, minimum, maximum) {
  const raw = __ENV[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function userId(index) {
  return `${USER_PREFIX}-${String(index).padStart(3, '0')}`;
}

function infrastructureFailure(response) {
  return response.status === 0 || response.status >= 500;
}

function authRequest(index) {
  return {
    method: 'POST',
    url: `${BASE_URL}/api/v1/auth/token`,
    body: JSON.stringify({ userId: userId(index) }),
    params: {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'auth' },
      responseType: 'text',
    },
  };
}

function recordAuth(response) {
  authRequests.add(1);
  authDuration.add(response.timings.duration);
  authInfrastructureErrors.add(infrastructureFailure(response));

  let token = '';
  try {
    token = response.json('accessToken') || '';
  } catch {
    token = '';
  }
  check(response, {
    'auth returns 200': (value) => value.status === 200,
    'auth returns an access token': () => token.length > 0,
  });
  return token;
}

function prepareTokens(count) {
  const tokens = [];
  const batchSize = 50;
  for (let start = 1; start <= count; start += batchSize) {
    const requests = [];
    const end = Math.min(count, start + batchSize - 1);
    for (let index = start; index <= end; index += 1) {
      requests.push(authRequest(index));
    }
    const responses = http.batch(requests);
    for (const response of responses) {
      const token = recordAuth(response);
      if (!token) {
        fail('Token preparation failed; write workload was not started.');
      }
      tokens.push(token);
    }
  }
  return tokens;
}

export function setup() {
  if (TEST_PROFILE === 'write') {
    return { tokens: prepareTokens(WRITE_USERS) };
  }
  if (TEST_PROFILE === 'duplicate') {
    return { tokens: prepareTokens(DUPLICATE_USERS) };
  }
  return { tokens: [] };
}

export function authPreparation() {
  recordAuth(http.post(
    `${BASE_URL}/api/v1/auth/token`,
    JSON.stringify({ userId: userId(__VU) }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'auth' } },
  ));
}

export function readProducts() {
  const response = http.get(`${BASE_URL}/api/v1/products?page=1&limit=10`, {
    tags: { endpoint: 'products' },
  });
  readRequests.add(1);
  readDuration.add(response.timings.duration);
  readInfrastructureErrors.add(infrastructureFailure(response));

  check(response, {
    'products returns 200': (value) => value.status === 200,
    'products response follows contract': (value) => {
      try {
        const body = value.json();
        return body.status === 'success' && Array.isArray(body.data) && body.meta?.page === 1;
      } catch {
        return false;
      }
    },
  });
}

function orderParams(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    tags: { endpoint: 'orders' },
  };
}

function validAcceptedResponse(response) {
  if (response.status !== 202) {
    return false;
  }
  try {
    const body = response.json();
    return body.status === 'processing' && typeof body.orderJobId === 'string';
  } catch {
    return false;
  }
}

export function writeCompetition(data) {
  const token = data.tokens[__VU - 1];
  if (!token) {
    fail(`No prepared token for VU ${__VU}.`);
  }
  const response = http.post(
    `${BASE_URL}/api/v1/orders`,
    JSON.stringify({ productId: PRODUCT_ID }),
    orderParams(token),
  );
  writeRequests.add(1);
  writeDuration.add(response.timings.duration);
  writeInfrastructureErrors.add(infrastructureFailure(response));
  check(response, {
    'order admission returns confirmed 202': validAcceptedResponse,
  });
}

export function duplicateBurst(data) {
  const token = data.tokens[__VU - 1];
  if (!token) {
    fail(`No prepared token for duplicate VU ${__VU}.`);
  }
  const request = {
    method: 'POST',
    url: `${BASE_URL}/api/v1/orders`,
    body: JSON.stringify({ productId: PRODUCT_ID }),
    params: orderParams(token),
  };
  const responses = http.batch(Array.from({ length: DUPLICATE_REQUESTS }, () => request));
  const acceptedJobIds = [];

  for (const response of responses) {
    duplicateRequests.add(1);
    duplicateDuration.add(response.timings.duration);
    duplicateInfrastructureErrors.add(infrastructureFailure(response));
    if (response.status === 202) {
      try {
        acceptedJobIds.push(response.json('orderJobId'));
      } catch {
        acceptedJobIds.push(undefined);
      }
    }
  }

  check(responses, {
    'duplicate responses follow 202/409 contract': (values) =>
      values.every((response) => response.status === 202 || response.status === 409),
    'duplicate 202 responses contain one deterministic job id': () =>
      acceptedJobIds.length > 0 &&
      acceptedJobIds.every(
        (jobId) => typeof jobId === 'string' && jobId === acceptedJobIds[0],
      ),
  });
}

export function handleSummary(data) {
  const summaryPath = __ENV.SUMMARY_PATH;
  if (!summaryPath) {
    throw new Error('SUMMARY_PATH is required so the sanitized k6 summary can be preserved.');
  }

  // k6 0.57 includes setup_data in --summary-export. It contains prepared JWTs,
  // so remove only that sensitive field before persisting benchmark evidence.
  const sanitized = { ...data };
  delete sanitized.setup_data;

  const checks = sanitized.metrics?.checks?.values;
  const requestMetric =
    sanitized.metrics?.read_requests ??
    sanitized.metrics?.write_admission_requests ??
    sanitized.metrics?.duplicate_admission_requests ??
    sanitized.metrics?.auth_requests;
  const consoleSummary = [
    `profile=${TEST_PROFILE}`,
    `requests=${requestMetric?.values?.count ?? 0}`,
    `request_rate=${requestMetric?.values?.rate ?? 0}`,
    `checks_rate=${checks?.rate ?? 0}`,
    `sanitized_summary=${summaryPath}`,
  ].join(' ');

  return {
    [summaryPath]: `${JSON.stringify(sanitized, null, 2)}\n`,
    stdout: `${consoleSummary}\n`,
  };
}
