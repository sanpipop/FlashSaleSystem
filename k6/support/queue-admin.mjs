import Redis from 'ioredis';
import { AppDataSource } from '@flash-sale/database';
import {
  createOrdersQueue,
  enqueueOrderJob,
  redisOpsConnectionFromEnv,
} from '@flash-sale/queue';

const POLL_MS = 50;
const DEFAULT_TIMEOUT_MS = 30_000;
const queue = createOrdersQueue(redisOpsConnectionFromEnv());
let dataSourceInitialized = false;

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function positiveInteger(name, fallback) {
  const value = Number(argument(name, String(fallback)));
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`--${name} must be a non-negative integer.`);
  }
  return value;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function counts() {
  return queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');
}

async function waitFor(predicate, description) {
  const timeoutMs = positiveInteger('timeout-ms', DEFAULT_TIMEOUT_MS);
  const deadline = Date.now() + timeoutMs;
  let current = await counts();
  while (!predicate(current) && Date.now() < deadline) {
    await delay(POLL_MS);
    current = await counts();
  }
  if (!predicate(current)) {
    throw new Error(`${description} within ${timeoutMs} ms; counts=${JSON.stringify(current)}`);
  }
  return current;
}

async function ensureDataSource() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    dataSourceInitialized = true;
  }
}

async function pauseAndDrainActive() {
  await queue.pause();
  const state = await waitFor(
    (value) => (value.active ?? 0) === 0,
    'Active jobs did not finish',
  );
  console.log(JSON.stringify({ action: 'pause-and-drain-active', state }));
}

async function resetQueue() {
  const before = await counts();
  if ((before.active ?? 0) !== 0) {
    throw new Error(`Refusing to reset a queue with active jobs: ${JSON.stringify(before)}`);
  }
  await queue.obliterate({ force: true });
  await queue.resume();
  const after = await counts();
  const nonEmpty = ['waiting', 'active', 'completed', 'failed', 'delayed']
    .some((state) => (after[state] ?? 0) !== 0);
  if (nonEmpty) {
    throw new Error(`Queue reset postcondition failed: ${JSON.stringify(after)}`);
  }
  console.log(JSON.stringify({ action: 'reset-queue', before, after }));
}

async function clearClaims() {
  const productId = argument('product', 'p-1001');
  if (!/^[A-Za-z0-9_-]+$/.test(productId)) {
    throw new Error('Product ID contains characters unsafe for the claim namespace reset.');
  }
  const redis = new Redis({
    ...redisOpsConnectionFromEnv(),
    maxRetriesPerRequest: 1,
  });
  const prefix = 'fs:claim:order:';
  const suffix = `:${productId}`;
  let cursor = '0';
  let removed = 0;
  try {
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        `${prefix}*${suffix}`,
        'COUNT',
        200,
      );
      cursor = nextCursor;
      const validated = keys.filter((key) => key.startsWith(prefix) && key.endsWith(suffix));
      if (validated.length !== keys.length) {
        throw new Error('Redis SCAN returned a key outside the validated claim namespace.');
      }
      if (validated.length > 0) {
        removed += await redis.unlink(...validated);
      }
    } while (cursor !== '0');
  } finally {
    await redis.quit().catch(() => redis.disconnect());
  }
  console.log(JSON.stringify({ action: 'clear-claims', productId, removed }));
}

async function waitDrain() {
  const startedAt = Date.now();
  const state = await waitFor(
    (value) =>
      (value.waiting ?? 0) === 0 &&
      (value.active ?? 0) === 0 &&
      (value.delayed ?? 0) === 0,
    'Queue did not drain',
  );
  if ((state.failed ?? 0) > 0) {
    throw new Error(`Queue drained with failed jobs: ${JSON.stringify(state)}`);
  }
  console.log(JSON.stringify({
    action: 'wait-drain',
    queueDrainMs: Date.now() - startedAt,
    state,
  }));
}

async function verifyDurableResults() {
  const productId = argument('product', 'p-1001');
  const expected = positiveInteger('expected', 500);
  const completed = await queue.getJobs(['completed'], 0, -1, true);
  const relevant = completed.filter((job) => job.data.productId === productId);
  const jobIds = [...new Set(relevant.map((job) => job.data.jobId))];

  await ensureDataSource();
  const [result] = await AppDataSource.query(
    `
      SELECT COUNT(*)::integer AS durable_count
      FROM order_results
      WHERE product_id = $1 AND job_id = ANY($2::varchar[])
    `,
    [productId, jobIds],
  );
  const durableCount = Number(result?.durable_count ?? 0);
  if (relevant.length !== expected || jobIds.length !== expected || durableCount !== expected) {
    throw new Error(JSON.stringify({
      message: 'Accepted-to-durable verification failed.',
      expected,
      completedJobs: relevant.length,
      distinctJobIds: jobIds.length,
      durableCount,
    }));
  }
  console.log(JSON.stringify({
    action: 'verify-durable',
    productId,
    expected,
    completedJobs: relevant.length,
    durableCount,
    acceptedWithoutDurableResult: expected - durableCount,
  }));
}

async function snapshot(productId) {
  const [row] = await AppDataSource.query(
    `
      SELECT
        (SELECT remaining_stock FROM products WHERE product_id = $1)::integer AS remaining_stock,
        (SELECT COUNT(*) FROM orders WHERE product_id = $1)::integer AS order_count,
        (SELECT COUNT(*) FROM order_results WHERE product_id = $1)::integer AS result_count,
        (SELECT COUNT(*) FROM transactional_outbox WHERE aggregate_id = $1)::integer AS outbox_count
    `,
    [productId],
  );
  return row;
}

async function retryProof() {
  const productId = argument('product', 'p-1001');
  await ensureDataSource();
  const completed = await queue.getJobs(['completed'], 0, -1, true);
  let selected;
  for (const job of completed) {
    if (job.data.productId !== productId) continue;
    const [result] = await AppDataSource.query(
      'SELECT status FROM order_results WHERE job_id = $1',
      [job.data.jobId],
    );
    if (result?.status === 'SUCCESS') {
      selected = job;
      break;
    }
  }
  if (!selected) {
    throw new Error(`No completed successful ${productId} job is available for retry proof.`);
  }

  const before = await snapshot(productId);
  const queueBefore = await counts();
  const expectedResult = selected.returnvalue;
  if (!expectedResult) {
    throw new Error(`Completed job ${selected.id} has no BullMQ return value.`);
  }
  await queue.remove(selected.id);
  const replayedJobId = await enqueueOrderJob(queue, selected.data);
  const timeoutMs = positiveInteger('timeout-ms', DEFAULT_TIMEOUT_MS);
  const deadline = Date.now() + timeoutMs;
  let replayedJob = await queue.getJob(replayedJobId);
  let replayedState = replayedJob === undefined ? 'missing' : await replayedJob.getState();
  while (!['completed', 'failed'].includes(replayedState) && Date.now() < deadline) {
    await delay(POLL_MS);
    replayedJob = await queue.getJob(replayedJobId);
    replayedState = replayedJob === undefined ? 'missing' : await replayedJob.getState();
  }
  if (replayedJob === undefined || replayedState !== 'completed') {
    throw new Error(
      `Retried job did not complete successfully within ${timeoutMs} ms; state=${replayedState}`,
    );
  }

  const replayedResult = replayedJob.returnvalue;
  const resultFields = ['status', 'jobId', 'userId', 'productId', 'orderId'];
  const resultMismatch = resultFields.some(
    (field) => expectedResult[field] !== replayedResult?.[field],
  );
  if (resultMismatch) {
    throw new Error(
      `Retried job returned a different durable result: expected=${JSON.stringify(expectedResult)} actual=${JSON.stringify(replayedResult)}`,
    );
  }

  const queueAfter = await counts();
  if ((queueAfter.failed ?? 0) !== (queueBefore.failed ?? 0)) {
    throw new Error(
      `Retry changed failed-job count: before=${queueBefore.failed ?? 0} after=${queueAfter.failed ?? 0}`,
    );
  }
  const after = await snapshot(productId);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error(`Retry changed durable state: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  }
  console.log(JSON.stringify({
    action: 'retry-proof',
    productId,
    jobId: selected.data.jobId,
    replayedState,
    before,
    after,
    unchanged: true,
  }));
}

const actions = {
  'pause-and-drain-active': pauseAndDrainActive,
  'reset-queue': resetQueue,
  'clear-claims': clearClaims,
  'wait-drain': waitDrain,
  'verify-durable': verifyDurableResults,
  'retry-proof': retryProof,
  resume: async () => {
    await queue.resume();
    console.log(JSON.stringify({ action: 'resume', state: await counts() }));
  },
};

const action = process.argv[2];
if (!action || !(action in actions)) {
  throw new Error(`Unknown action '${action ?? ''}'. Valid actions: ${Object.keys(actions).join(', ')}`);
}

try {
  await queue.waitUntilReady();
  await actions[action]();
} finally {
  await queue.close();
  if (dataSourceInitialized && AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}
