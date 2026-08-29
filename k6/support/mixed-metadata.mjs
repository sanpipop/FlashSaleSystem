import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';

const [action, metadataPath, targetMetadataPath, ...args] = process.argv.slice(2);

function command(name, commandArgs, fallback = 'unavailable') {
  try {
    return execFileSync(name, commandArgs, { encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
}

function parseTargetMetadata(path) {
  const values = Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf('=');
        if (separator < 1) throw new Error(`Malformed target metadata line: ${line}`);
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
  const required = [
    'targetCommitSha',
    'targetDirtyState',
    'targetHostname',
    'targetCpu',
    'targetLogicalCpuCount',
    'targetRamBytes',
  ];
  for (const key of required) {
    if (!values[key]) throw new Error(`Target metadata is missing ${key}.`);
  }
  if (!/^[0-9a-f]{40}$/.test(values.targetCommitSha)) {
    throw new Error('Target commit SHA is invalid.');
  }
  return {
    ...values,
    targetLogicalCpuCount: Number(values.targetLogicalCpuCount),
    targetRamBytes: Number(values.targetRamBytes),
  };
}

function metric(summary, name, field, fallback = 0) {
  return summary?.metrics?.[name]?.values?.[field] ?? fallback;
}

if (action === 'start') {
  const target = parseTargetMetadata(targetMetadataPath);
  const metadata = {
    classification: 'NON_OFFICIAL_MIXED_STRESS_INVESTIGATION',
    runId: process.env.RUN_ID,
    timestampStart: new Date().toISOString(),
    timestampEnd: null,
    baseUrl: process.env.BASE_URL,
    targetSsh: process.env.TARGET_SSH,
    targetRepoDir: process.env.TARGET_REPO_DIR,
    ...target,
    harnessCommitSha: command('git', ['rev-parse', 'HEAD']),
    harnessDirtyState: command('git', ['status', '--porcelain']) ? 'dirty' : 'clean',
    loadtestSha256: command('sha256sum', ['k6/LoadtestO.js']).split(/\s+/)[0],
    officialCompetitionSha256: command('sha256sum', ['k6/competition.js']).split(/\s+/)[0],
    k6Version: command(process.env.K6_BIN || 'k6', ['version']),
    loadGenerator: {
      hostname: os.hostname(),
      cpuModel: os.cpus()[0]?.model || 'unknown',
      logicalCpuCount: os.cpus().length,
      ramBytes: os.totalmem(),
      os: `${os.type()} ${os.release()} ${os.arch()}`,
      openFileLimit: command('sh', ['-c', 'ulimit -n']),
    },
    parameters: {
      readVus: Number(process.env.READ_VUS || 1_000),
      readDuration: process.env.READ_DURATION || '30s',
      writeVus: Number(process.env.WRITE_VUS || 500),
      writeIterations: Number(process.env.WRITE_ITERATIONS || 3),
      writeStartTime: process.env.WRITE_START_TIME || '10s',
      writeMaxDuration: process.env.WRITE_MAX_DURATION || '20s',
      productId: process.env.TARGET_PRODUCT_ID || 'p-1001',
      monitorSeconds: Number(process.env.MONITOR_SECONDS || 75),
      monitorIntervalSeconds: Number(process.env.MONITOR_INTERVAL_SECONDS || 1),
    },
    proxyVariablesDetected: Boolean(
      process.env.HTTP_PROXY || process.env.HTTPS_PROXY ||
      process.env.http_proxy || process.env.https_proxy,
    ),
    validityStatus: 'RUNNING',
    invalidReason: null,
  };
  writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
} else if (action === 'finish') {
  const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
  const [summaryPath, k6Exit, queueExit, integrityExit, monitorExit, secretExit] = [
    targetMetadataPath,
    ...args,
  ];
  let summary = {};
  try {
    summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
  } catch {
    summary = {};
  }
  const exitCodes = {
    k6: Number(k6Exit),
    queueDrain: Number(queueExit),
    integrity: Number(integrityExit),
    targetMonitoring: Number(monitorExit),
    secretScan: Number(secretExit),
  };
  const droppedIterations = metric(summary, 'dropped_iterations', 'count', 0);
  const failures = Object.entries(exitCodes)
    .filter(([name, value]) => name !== 'k6' && value !== 0)
    .map(([name, value]) => `${name}=${value}`);
  if (![0, 99].includes(exitCodes.k6)) {
    failures.push(`k6=${exitCodes.k6}`);
  }
  if (!summary.metrics) {
    failures.push('k6-summary=missing');
  }
  if (droppedIterations !== 0) {
    failures.push(`dropped_iterations=${droppedIterations}`);
  }
  metadata.timestampEnd = new Date().toISOString();
  metadata.exitCodes = exitCodes;
  metadata.k6Evidence = {
    checksRate: metric(summary, 'checks', 'rate', null),
    httpFailureRate: metric(summary, 'http_req_failed', 'rate', null),
    droppedIterations,
    orders202: metric(summary, 'orders_202', 'count', 0),
    orders409: metric(summary, 'orders_409', 'count', 0),
    orders503: metric(summary, 'orders_503', 'count', 0),
    orders5xx: metric(summary, 'orders_5xx', 'count', 0),
    ordersUnexpected: metric(summary, 'orders_unexpected', 'count', 0),
    infrastructureErrorRate: metric(summary, 'orders_infrastructure_error', 'rate', null),
  };
  metadata.performanceGate = exitCodes.k6 === 0
    ? 'PASS'
    : exitCodes.k6 === 99
      ? 'FAILED_THRESHOLDS'
      : 'K6_EXECUTION_ERROR';
  metadata.validityStatus = failures.length === 0 ? 'VALID' : 'INVALID';
  metadata.invalidReason = failures.length === 0 ? null : failures.join(', ');
  writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
} else {
  throw new Error(
    'Usage: mixed-metadata.mjs start <metadata.json> <target.txt> | ' +
      'finish <metadata.json> <summary.json> <k6> <queue> <integrity> <monitor> <secret>',
  );
}
