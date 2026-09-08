// @test-scope local
// Explicit opt-in: existing local Linux Node image; never starts Docker or pulls an image.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createIsolatedCodeRunner } from "./codeRunIsolation.ts";

const enginePath = process.env.AI_GATEWAY_TEST_CODE_RUN_ENGINE;
const image = process.env.AI_GATEWAY_TEST_CODE_RUN_IMAGE;
const enabled = Boolean(enginePath && image);

function containers() {
  return execFileSync(enginePath!, ["ps", "-aq", "--filter", "label=forge.sandbox.managed=true"],
    { encoding: "utf8", timeout: 15000, windowsHide: true }).trim().split(/\s+/).filter(Boolean).sort();
}

describe.skipIf(!enabled)("code_run actual container acceptance (explicit local opt-in)", () => {
  it("executes ordinary, async and allowlisted module snippets without project mounts", async () => {
    const before = containers();
    const root = await realpath(await mkdtemp(join(tmpdir(), "code-run-real-test-")));
    const canaryName = `CODE_RUN_HOST_CANARY_${randomUUID().replaceAll("-", "")}`;
    process.env[canaryName] = "synthetic-host-only";
    const run = createIsolatedCodeRunner({ enginePath, image, scratchRoot: root });
    try {
      for (const [code, expected] of [
        ["return 1 + 2", "3"],
        ['console.log("hello"); return JSON.stringify({ok:true})', '{"ok":true}'],
        ['await new Promise(resolve => setTimeout(resolve, 10)); return "done"', "done"],
        ['const crypto = await require("node:crypto"); return crypto.createHash("sha256").update("abc").digest("hex")',
          "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
      ]) expect(await run({ code })).toMatchObject({ status: "success", result: expected, sandbox: "container" });
      const boundary = await run({ code: `
        const fs = process.getBuiltinModule('node:fs');
        const os = process.getBuiltinModule('node:os');
        return JSON.stringify({ files:fs.readdirSync('/workspace').sort(),
          uid:process.getuid(), nonLoopback:Object.values(os.networkInterfaces()).flat().some(i=>!i.internal),
          canary:process.env[${JSON.stringify(canaryName)}] !== undefined });
      ` });
      expect(boundary.status).toBe("success");
      if (boundary.status !== "success") throw new Error(boundary.code);
      expect(JSON.parse(String(boundary.result))).toEqual({ files: ["runner.cjs", "snippet.js"], uid: 65532,
        nonLoopback: false, canary: false });
      expect(await readdir(root)).toEqual([]);
    } finally {
      delete process.env[canaryName];
      // Preserve input if a container may still hold its mount.
      if (JSON.stringify(containers()) === JSON.stringify(before)) await rm(root, { recursive: true, force: true });
      expect(containers()).toEqual(before);
    }
  }, 180000);

  it("terminates sync/async runaway code and reports errors, output bounds and abort", async () => {
    const before = containers();
    const root = await realpath(await mkdtemp(join(tmpdir(), "code-run-real-limits-")));
    const run = createIsolatedCodeRunner({ enginePath, image, scratchRoot: root });
    try {
      for (const code of ["while(true) {}", "await Promise.resolve(); while(true) {}"]) {
        expect(await run({ code, timeout_ms: 500 })).toMatchObject({ status: "error", code: "CODE_RUN_TIMEOUT" });
      }
      expect(await run({ code: 'throw new Error("expected")' })).toMatchObject({ code: "CODE_RUN_EXECUTION_FAILED" });
      expect(await run({ code: 'return "x".repeat(100000)' })).toMatchObject({ code: "CODE_RUN_OUTPUT_LIMIT" });
      expect(await run({ code: 'const blocks=[]; while(true) blocks.push(Buffer.alloc(16*1024*1024,1))' }))
        .toMatchObject({ code: "CODE_RUN_EXECUTION_FAILED" });
      const controller = new AbortController(); controller.abort();
      expect(await run({ code: "return 3" }, { signal: controller.signal })).toMatchObject({ code: "CODE_RUN_CANCELLED" });
      const activeController = new AbortController();
      const active = run({ code: "await new Promise(resolve => setTimeout(resolve, 20000)); return 3" }, { signal: activeController.signal });
      try {
        let running: string | undefined;
        for (let i = 0; i < 60 && !running; i++) {
          const ids = execFileSync(enginePath!, ["ps", "-q", "--filter", "label=forge.sandbox.managed=true"],
            { encoding: "utf8", timeout: 15000, windowsHide: true }).trim().split(/\s+/).filter(Boolean);
          running = ids.find(id => !before.includes(id));
          if (!running) await delay(100);
        }
        expect(running).toBeDefined();
        const logDriver = execFileSync(enginePath!, ["inspect", "--format", "{{.HostConfig.LogConfig.Type}}", running!],
          { encoding: "utf8", timeout: 15000, windowsHide: true }).trim();
        expect(logDriver).toBe("none");
      } finally {
        activeController.abort();
        expect(await active).toMatchObject({ code: "CODE_RUN_CANCELLED" });
      }
      expect(await readdir(root)).toEqual([]);
    } finally {
      if (JSON.stringify(containers()) === JSON.stringify(before)) await rm(root, { recursive: true, force: true });
      expect(containers()).toEqual(before);
    }
  }, 180000);
});
