/**
 * Run the target service and its loopback probe inside the same no-network
 * container. No host port is published and the container lifecycle owns the
 * complete server process tree.
 */
export async function runSmokeTest(projectRoot, sandboxExecutor = null, signal) {
  const start = Date.now();
  if (!sandboxExecutor) {
    return {
      name: 'Smoke Test',
      status: 'FAIL',
      output: 'SANDBOX_BACKEND_UNAVAILABLE: smoke tests require an attested isolation backend.',
      durationMs: Date.now() - start,
    };
  }

  const port = 30000 + Math.floor(Math.random() * 10000);
  const probe = [
    `PORT=${port} node src/server.js >/tmp/forge-smoke.log 2>&1 &`,
    'server_pid=$!',
    `trap 'kill "$server_pid" 2>/dev/null || true' EXIT`,
    `node -e "setTimeout(async()=>{try{const r=await fetch('http://127.0.0.1:${port}/');const b=await r.text();console.log('status='+r.status+' '+b.slice(0,500));process.exit(r.ok?0:1)}catch(e){console.error(e.message);process.exit(1)}},2000)"`,
  ].join('\n');

  const result = await sandboxExecutor.execute(probe, {
    cwd: projectRoot,
    level: 'full',
    workspaceMode: 'ro',
    timeout: 15_000,
    signal,
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').slice(0, 3000);
  return {
    name: 'Smoke Test',
    status: result.exitCode === 0 ? 'PASS' : 'FAIL',
    output: output || String(result.killReason || ''),
    durationMs: Date.now() - start,
  };
}
