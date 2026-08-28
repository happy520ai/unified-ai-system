import { execFileSync } from 'node:child_process';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  ContainerSandboxBackend,
  SandboxExecutor,
} from '../src/sandbox-executor/index.js';
import { runSmokeTest } from '../src/verification/smokeTest.js';

const enginePath = process.env.FORGE_TEST_DOCKER_ENGINE;
const image = process.env.FORGE_TEST_DOCKER_SANDBOX_IMAGE;
const enabled = Boolean(enginePath && image);

function managedContainers() {
  if (!enabled) return new Set();
  const output = execFileSync(
    enginePath,
    ['ps', '-aq', '--filter', 'label=forge.sandbox.managed=true'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return new Set(output.split(/\r?\n/).filter(Boolean));
}

describe('real container sandbox boundary', { skip: !enabled }, () => {
  it('proves minimal env, read-only mounts, no network, and deterministic cleanup', async () => {
    const root = await mkdtemp(join(tmpdir(), 'forge-container-sandbox-'));
    const workspace = join(root, 'workspace');
    const outsideSentinel = join(root, 'outside-sentinel');
    await mkdir(workspace);
    await mkdir(join(workspace, 'src'));
    await mkdir(join(workspace, '.git'));
    await writeFile(join(workspace, 'visible.txt'), 'workspace-only\n', 'utf8');
    await writeFile(join(workspace, '.git', 'config'), 'git-metadata-marker\n', 'utf8');
    await writeFile(
      join(workspace, 'src', 'server.js'),
      "const http=require('node:http');const server=http.createServer((_req,res)=>{res.end('smoke-ok')});server.listen(Number(process.env.PORT));\n",
      'utf8',
    );
    await writeFile(outsideSentinel, 'host-only\n', 'utf8');

    const previousCanary = process.env.FORGE_CONTAINER_SECRET_CANARY;
    process.env.FORGE_CONTAINER_SECRET_CANARY = 'must-not-leak';
    try {
      const backend = new ContainerSandboxBackend({
        enginePath,
        image,
        workspaceRoots: [root],
      });
      const executor = new SandboxExecutor({
        level: 'full',
        allowedPaths: [root],
        backend,
        maxTimeMs: 10_000,
        maxMemoryMB: 128,
      });

      const before = managedContainers();
      const command = [
        'test -f /workspace/visible.txt',
        'test ! -e /outside-sentinel',
        'test ! -e /workspace/.git/config',
        'if touch /etc/forge-escape 2>/dev/null; then exit 10; fi',
        'if touch /workspace/forge-write 2>/dev/null; then exit 11; fi',
        `node -e "const net=require('net');if(process.env.FORGE_CONTAINER_SECRET_CANARY)process.exit(12);const s=net.connect({host:'1.1.1.1',port:80});s.on('connect',()=>process.exit(13));s.on('error',()=>process.exit(0));setTimeout(()=>process.exit(0),500)"`,
      ].join(' && ');
      const result = await executor.execute(command, { cwd: workspace });

      assert.equal(result.exitCode, 0, result.stderr);
      assert.equal(result.backend, 'container');
      assert.equal(result.isolation?.networkIsolation, true);
      assert.equal(result.isolation?.readOnlyRoot, true);
      assert.equal(result.cleanupUncertain, false);

      const smoke = await runSmokeTest(workspace, executor);
      assert.equal(smoke.status, 'PASS', smoke.output);
      assert.match(smoke.output, /status=200 smoke-ok/);

      const forbidden = await executor.execute('true', {
        cwd: workspace,
        env: { OPENAI_API_KEY: 'fake-secret' },
      });
      assert.equal(forbidden.exitCode, -1);
      assert.equal(forbidden.killReason, 'SANDBOX_ENV_REJECTED');

      const timedOut = await executor.execute('while :; do :; done', {
        cwd: workspace,
        timeout: 500,
      });
      assert.equal(timedOut.killed, true);
      assert.ok(timedOut.killReason?.includes('timeout'));

      await mkdir(join(workspace, 'app'));
      await writeFile(join(workspace, 'app', '.EnV.Local'), 'SENSITIVE_CANARY=value\n', 'utf8');
      const sensitiveWorkspace = await executor.execute('true', { cwd: workspace });
      assert.equal(sensitiveWorkspace.exitCode, -1);
      assert.equal(sensitiveWorkspace.killReason, 'SANDBOX_SENSITIVE_WORKSPACE');

      const after = managedContainers();
      assert.deepEqual([...after].filter((id) => !before.has(id)), []);
    } finally {
      if (previousCanary === undefined) delete process.env.FORGE_CONTAINER_SECRET_CANARY;
      else process.env.FORGE_CONTAINER_SECRET_CANARY = previousCanary;
      await rm(root, { recursive: true, force: true });
    }
  });
});
