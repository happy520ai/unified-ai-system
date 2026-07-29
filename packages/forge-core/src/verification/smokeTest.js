/**
 * Run a smoke test by spawning the server and checking its response.
 */
export async function runSmokeTest(projectRoot) {
  const start = Date.now();
  const port = 30000 + Math.floor(Math.random() * 10000);

  try {
    const { spawn } = await import('node:child_process');
    const serverProcess = spawn('node', ['src/server.js'], {
      cwd: projectRoot,
      env: { ...process.env, PORT: String(port) },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000,
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(5000),
      });

      const body = await res.text();
      serverProcess.kill('SIGTERM');

      if (res.ok) {
        return {
          name: 'Smoke Test',
          status: 'PASS',
          output: `Server responded ${res.status}: ${body.slice(0, 500)}`,
          durationMs: Date.now() - start,
        };
      }

      return {
        name: 'Smoke Test',
        status: 'FAIL',
        output: `Server responded ${res.status}: ${body.slice(0, 500)}`,
        durationMs: Date.now() - start,
      };
    } catch (fetchError) {
      serverProcess.kill('SIGTERM');
      return {
        name: 'Smoke Test',
        status: 'FAIL',
        output: `Server did not respond on port ${port}: ${fetchError.message}`,
        durationMs: Date.now() - start,
      };
    }
  } catch (error) {
    return {
      name: 'Smoke Test',
      status: 'FAIL',
      output: `Failed to start server: ${error.message}`,
      durationMs: Date.now() - start,
    };
  }
}
