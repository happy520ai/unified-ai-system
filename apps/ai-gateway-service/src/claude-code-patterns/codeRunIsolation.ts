import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

export interface CodeRunIsolationOptions {
  enginePath?: string;
  image?: string;
  scratchRoot?: string;
}

type CodeRunFailure = {
  status: "error"; code: string; error: string; sandbox: "container";
  workspaceRetained?: boolean; recoveryRequired?: boolean;
};
export type CodeRunResult = CodeRunFailure | {
  status: "success"; result: string; logs: { level: string; args: string[] }[]; sandbox: "container";
};

// This file is executed ONLY inside the configured container. Code/result text
// remains untrusted; no result field supplies an authorization or isolation claim.
const RUNNER = `
const fs = require('node:fs');
const allowed = new Set(['node:crypto','node:buffer','node:util','node:url','node:path','node:querystring']);
const logs = [];
const consoleProxy = Object.fromEntries(['log','warn','error','info'].map(level => [level,
  (...args) => { if (logs.length < 100) logs.push({level,args:args.map(value => String(value).slice(0,2048))}); }]));
const finish = (payload, exitCode) => { process.stdout.write(JSON.stringify(payload), () => process.exit(exitCode)); };
(async () => {
  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  const execute = new AsyncFunction('require','console',fs.readFileSync('/workspace/snippet.js','utf8'));
  const value = await execute(async name => {
    if (!allowed.has(name)) throw new Error('Module is not allowlisted');
    return import(name);
  },consoleProxy);
  finish({status:'success',result:String(value),logs},0);
})().catch(error => finish({status:'error',error:String(error?.message || 'Code failed').slice(0,2048)},1));
`;

function failure(code: string, error: string): CodeRunFailure {
  return { status: "error" as const, code, error, sandbox: "container" as const };
}

/** Configuration is captured from server-owned options, never execution params/context. */
export function createIsolatedCodeRunner(options: CodeRunIsolationOptions = {}) {
  const enginePath = options.enginePath ?? process.env.AI_GATEWAY_CODE_RUN_ENGINE_PATH ?? "";
  const image = options.image ?? process.env.AI_GATEWAY_CODE_RUN_IMAGE ?? "";
  const scratchRoot = options.scratchRoot ?? tmpdir();

  return async (params: { code?: unknown; timeout_ms?: unknown }, context: { signal?: AbortSignal } = {}): Promise<CodeRunResult> => {
    const code = params?.code;
    const timeoutMs = params?.timeout_ms ?? 10000;
    if (typeof code !== "string" || code.length === 0 || Buffer.byteLength(code, "utf8") > 65536
        || !Number.isInteger(timeoutMs) || (timeoutMs as number) < 1 || (timeoutMs as number) > 30000) {
      return failure("CODE_RUN_INPUT_INVALID", "code must be 1-65536 UTF-8 bytes; timeout_ms must be an integer from 1 to 30000.");
    }
    if (!enginePath || !image) {
      return failure("CODE_RUN_ISOLATION_UNAVAILABLE", "Configure a dedicated container engine and pinned local Node image before enabling code_run.");
    }
    if (!isAbsolute(enginePath) || !/@sha256:[a-f0-9]{64}$/i.test(image) || !isAbsolute(scratchRoot)) {
      return failure("CODE_RUN_CONFIGURATION_INVALID", "The engine/scratch paths must be absolute and the container image must be digest-pinned.");
    }
    if (context.signal?.aborted) return failure("CODE_RUN_CANCELLED", "Execution was cancelled.");

    let privateRoot: string | undefined;
    let canonicalRoot: string | undefined;
    let cleanupUncertain = false;
    let result: CodeRunResult;
    try {
      const { ContainerSandboxBackend } = await import("@unified-ai-system/forge-core");
      canonicalRoot = await realpath(scratchRoot);
      privateRoot = await mkdtemp(join(canonicalRoot, "unified-code-run-"));
      const workspace = join(privateRoot, "workspace");
      // Only this inner directory is mounted. The outer directory stays private.
      await mkdir(workspace, { mode: 0o755 });
      await writeFile(join(workspace, "snippet.js"), code, { mode: 0o444 });
      await writeFile(join(workspace, "runner.cjs"), RUNNER, { mode: 0o444 });
      const backend = new ContainerSandboxBackend({ enginePath, image, workspaceRoots: [workspace], allowNetwork: false });
      const execution = await backend.run({
        command: "node /workspace/runner.cjs", workspace, workspaceMode: "ro", networkAccess: false,
        env: {}, timeoutMs, maxMemoryMB: 128, maxOutputBytes: 65536, pidsLimit: 32, cpus: 1,
        signal: context.signal,
      });
      cleanupUncertain = execution.cleanupUncertain !== false;
      if (cleanupUncertain) result = failure("CODE_RUN_CLEANUP_UNCERTAIN", "Container cleanup is unconfirmed; temporary input was retained.");
      else if (execution.truncated) result = failure("CODE_RUN_OUTPUT_LIMIT", "Code output exceeded the bounded capture limit.");
      else if (execution.killed) result = failure(
        execution.killReason?.includes("timeout") ? "CODE_RUN_TIMEOUT"
          : execution.killReason === "aborted" ? "CODE_RUN_CANCELLED" : "CODE_RUN_EXECUTION_FAILED",
        "The container did not complete normally.",
      );
      else {
        let payload;
        try { payload = JSON.parse(execution.stdout); } catch { payload = null; }
        if (execution.exitCode === 0 && payload?.status === "success" && typeof payload.result === "string"
            && Array.isArray(payload.logs) && payload.logs.length <= 100
            && payload.logs.every((entry: { level?: unknown; args?: unknown }) => entry &&
              ["log", "warn", "error", "info"].includes(String(entry.level)) && Array.isArray(entry.args)
              && entry.args.every((value: unknown) => typeof value === "string"))) {
          result = { status: "success", result: payload.result, logs: payload.logs, sandbox: "container" };
        } else result = failure("CODE_RUN_EXECUTION_FAILED", "Code failed or returned an invalid execution result.");
      }
    } catch (error) {
      cleanupUncertain = (error as { cleanupUncertain?: boolean })?.cleanupUncertain === true;
      result = failure(cleanupUncertain ? "CODE_RUN_CLEANUP_UNCERTAIN"
        : (error as { code?: string })?.code === "SANDBOX_ABORTED" ? "CODE_RUN_CANCELLED" : "CODE_RUN_ISOLATION_UNAVAILABLE",
        "Container execution could not be completed; no host fallback was attempted.");
    }
    if (privateRoot && !cleanupUncertain) {
      try {
        // Validate the resolved deletion target; never remove caller workspace.
        const target = await realpath(privateRoot);
        if (dirname(target) !== canonicalRoot || target !== privateRoot) throw new Error("unexpected temporary root");
        await rm(target, { recursive: true, force: true });
      } catch {
        cleanupUncertain = true;
        result = failure("CODE_RUN_CLEANUP_UNCERTAIN", "Temporary input cleanup is unconfirmed.");
      }
    }
    return { ...result, ...(cleanupUncertain ? { workspaceRetained: true, recoveryRequired: true } : {}) };
  };
}
