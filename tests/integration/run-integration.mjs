import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('docker', ['compose', 'up', '-d', '--build', '--force-recreate', '--wait']);

let workerStopped = false;
try {
  run('docker', ['compose', 'stop', 'worker']);
  workerStopped = true;

  run('docker', [
    'compose', 'run', '--rm', '--no-deps', 'worker',
    'node', '/app/node_modules/vitest/vitest.mjs', 'run',
    '--config', '/app/apps/api/vitest.integration.config.ts',
    '--root', '/app/apps/api',
  ]);
  run('docker', [
    'compose', 'run', '--rm', '--no-deps', 'worker',
    'node', '/app/node_modules/vitest/vitest.mjs', 'run',
    '--config', '/app/apps/worker/vitest.integration.config.ts',
    '--root', '/app/apps/worker',
  ]);
} finally {
  if (workerStopped) {
    run('docker', ['compose', 'up', '-d', '--wait', 'worker']);
  }
}
run(process.execPath, ['tests/integration/day3-system.mjs']);
