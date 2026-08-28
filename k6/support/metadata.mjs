import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';

const action = process.argv[2];
const outputPath = process.argv[3];

function command(commandName, args, fallback = 'unavailable') {
  try {
    return execFileSync(commandName, args, { encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
}

if (action === 'start') {
  const requiredTargetMetadata = [
    'TARGET_COMMIT_SHA',
    'TARGET_DIRTY_STATE',
    'TARGET_HOSTNAME',
    'TARGET_CPU',
    'TARGET_RAM',
  ];
  const missingTargetMetadata = requiredTargetMetadata.filter(
    (name) => !process.env[name]?.trim(),
  );
  if (missingTargetMetadata.length > 0) {
    throw new Error(`Missing target metadata: ${missingTargetMetadata.join(', ')}`);
  }

  const metadata = {
    runId: process.env.RUN_ID,
    timestampStart: new Date().toISOString(),
    timestampEnd: null,
    scenario: process.env.TEST_PROFILE,
    cacheState: process.env.CACHE_STATE || 'not-applicable',
    baseUrl: process.env.BASE_URL,
    targetCommitSha: process.env.TARGET_COMMIT_SHA,
    targetDirtyState: process.env.TARGET_DIRTY_STATE,
    targetHostname: process.env.TARGET_HOSTNAME,
    targetCpu: process.env.TARGET_CPU,
    targetRam: process.env.TARGET_RAM,
    loadGenerator: {
      hostname: os.hostname(),
      cpu: `${os.cpus()[0]?.model || 'unknown'} / ${os.cpus().length} logical CPUs`,
      ramBytes: os.totalmem(),
      os: `${os.type()} ${os.release()} ${os.arch()}`,
    },
    k6Version: command(process.env.K6_BIN || 'k6', ['version']),
    k6ScriptSha256: command('sha256sum', ['k6/competition.js']).split(/\s+/)[0],
    harnessCommitSha: command('git', ['rev-parse', 'HEAD']),
    harnessDirtyState: command('git', ['status', '--porcelain']) ? 'dirty' : 'clean',
    parameters: {
      readVus: process.env.READ_VUS || '1000',
      readDuration: process.env.READ_DURATION || '30s',
      writeUsers: process.env.WRITE_USERS || '500',
      duplicateUsers: process.env.DUPLICATE_USERS || '50',
      productId: process.env.PRODUCT_ID || 'p-1001',
      userPrefix: process.env.USER_PREFIX || 'user',
    },
    proxyVariablesDetected: Boolean(
      process.env.HTTP_PROXY || process.env.HTTPS_PROXY ||
      process.env.http_proxy || process.env.https_proxy,
    ),
    validityStatus: 'AWAITING_INTEGRITY_VERIFICATION',
    invalidReason: null,
  };
  writeFileSync(outputPath, `${JSON.stringify(metadata, null, 2)}\n`);
} else if (action === 'finish') {
  const metadata = JSON.parse(readFileSync(outputPath, 'utf8'));
  metadata.timestampEnd = new Date().toISOString();
  metadata.k6ExitCode = Number(process.argv[4]);
  if (metadata.k6ExitCode !== 0) {
    metadata.validityStatus = 'INVALID';
    metadata.invalidReason = process.argv[5] || 'k6 command failed or a contract threshold was crossed';
  }
  writeFileSync(outputPath, `${JSON.stringify(metadata, null, 2)}\n`);
} else {
  throw new Error('Usage: metadata.mjs start|finish <metadata.json> [k6-exit-code]');
}
