import { performance } from "node:perf_hooks";
import { Worker } from "node:worker_threads";
import { digest, normalizeProfileArguments, normalizeProfileParameters, profileError, runtimeProfileHash, verifyProfileArtifact } from "./sandboxRuntimeProfiles.ts";
import type { RuntimeArtifact, RuntimeProfileId } from "./sandboxRuntimeProfiles.ts";

export type SandboxRuntimeInput = {
  capability?: { capabilityId?: unknown; profileId?: unknown; implementationHash?: unknown; parameters?: unknown };
  lease?: { leaseId?: unknown; capabilityId?: unknown; expiresAt?: unknown; maxRuntimeMs?: unknown; maxTokenBudget?: unknown; maxRequests?: unknown };
  arguments?: unknown; [key: string]: unknown;
};
export type SandboxRuntimeContext = {
  /** Owning application callbacks, never copied from an HTTP body. */
  enabled: () => boolean; assertActive: () => Promise<void>; signal?: AbortSignal;
};
export type SandboxRuntimeResult = {
  capabilityId: string | null; runtimeKind: "sandbox_local"; executionStatus: "passed" | "failed" | "blocked" | "cancelled";
  blockedReason: string | null; actualExecution: boolean; workerClosed: boolean; artifact: RuntimeArtifact | null;
  startedAt: string; endedAt: string; durationMs: number; requestCount: number; providerCallsMade: false; tokensUsed: 0;
  measuredUsage: { source: "owned-worker-lifecycle"; providerRequests: 0; tokens: 0; elapsedMs: number };
  productionRuntimeAutoEnabled: false;
};

export async function executeSandboxRuntime(input: SandboxRuntimeInput = {}, context?: SandboxRuntimeContext): Promise<SandboxRuntimeResult> {
  const started = performance.now(), startedAt = new Date().toISOString();
  let actualExecution = false, workerClosed = true;
  let maxDurationMs = Infinity, expiresAt = Infinity;
  const capabilityId = typeof input.capability?.capabilityId === "string" ? input.capability.capabilityId : null;
  const finish = (executionStatus: SandboxRuntimeResult["executionStatus"], code: string | null, artifact: RuntimeArtifact | null): SandboxRuntimeResult => {
    const durationMs = Math.max(0, performance.now() - started);
    if (executionStatus === "passed" && (durationMs > maxDurationMs || Date.now() >= expiresAt)) {
      executionStatus = "failed"; code = "TAIJI_RUNTIME_TIMEOUT"; artifact = null;
    }
    return { capabilityId, runtimeKind: "sandbox_local", executionStatus, blockedReason: code, actualExecution, workerClosed,
      artifact, startedAt, endedAt: new Date().toISOString(), durationMs, requestCount: actualExecution ? 1 : 0,
      providerCallsMade: false, tokensUsed: 0, measuredUsage: { source: "owned-worker-lifecycle", providerRequests: 0, tokens: 0, elapsedMs: durationMs },
      productionRuntimeAutoEnabled: false };
  };
  try {
    if (!context || typeof context.enabled !== "function" || typeof context.assertActive !== "function") throw profileError("EXECUTION_CONTEXT_REQUIRED");
    if (!context.enabled()) throw profileError("RUNTIME_DISABLED");
    if (context.signal?.aborted) throw profileError("CANCELLED");
    const profileId = input.capability?.profileId as RuntimeProfileId;
    const implementationHash = input.capability?.implementationHash;
    if (!capabilityId || implementationHash !== runtimeProfileHash(profileId)) throw profileError("IMPLEMENTATION_CHANGED");
    const lease = input.lease ? Object.freeze({ ...input.lease }) : null;
    if (!lease || typeof lease.leaseId !== "string" || !lease.leaseId || lease.capabilityId !== capabilityId
      || !Number.isSafeInteger(lease.maxRuntimeMs) || (lease.maxRuntimeMs as number) < 1 || (lease.maxRuntimeMs as number) > 30_000
      || !Number.isSafeInteger(lease.maxTokenBudget) || (lease.maxTokenBudget as number) < 0 || (lease.maxTokenBudget as number) > 4000
      || !Number.isSafeInteger(lease.maxRequests) || (lease.maxRequests as number) < 1 || (lease.maxRequests as number) > 3
      || typeof lease.expiresAt !== "number" || !Number.isSafeInteger(lease.expiresAt) || lease.expiresAt <= Date.now()
      || lease.expiresAt > Date.now() + 300_000) throw profileError("LEASE_INVALID");
    maxDurationMs = lease.maxRuntimeMs as number; expiresAt = lease.expiresAt;
    const args = normalizeProfileArguments(profileId, input.arguments);
    const parameters = normalizeProfileParameters(profileId, input.capability?.parameters);
    await context.assertActive();
    if (context.signal?.aborted) throw profileError("CANCELLED");
    if (!context.enabled()) throw profileError("RUNTIME_DISABLED");
    const remainingMs = Math.floor(Math.min((lease.maxRuntimeMs as number) - (performance.now() - started), lease.expiresAt - Date.now()));
    if (remainingMs < 1) throw profileError("RUNTIME_TIMEOUT");
    const worker = new Worker(new URL("./sandboxRuntimeWorker.ts", import.meta.url), {
      workerData: { profileId, arguments: args, parameters }, env: {}, execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16, stackSizeMb: 2 }, stdout: true, stderr: true,
    });
    actualExecution = true; workerClosed = false;
    const message = await new Promise<{ implementationHash: string; parametersHash: string; artifact: unknown }>((resolve, reject) => {
      let failure: unknown = null, output: { implementationHash: string; parametersHash: string; artifact: unknown } | null = null;
      let messageCount = 0, bytes = 0;
      const stop = (error: unknown) => { failure ??= error; void worker.terminate().catch(error => { failure ??= error; }); };
      const abort = () => stop(profileError("CANCELLED"));
      const timer = setTimeout(() => stop(profileError("RUNTIME_TIMEOUT")), remainingMs);
      const disabled = setInterval(() => { if (!context.enabled()) stop(profileError("RUNTIME_DISABLED")); }, 25);
      const stdout = (chunk: Buffer) => { bytes += chunk.length; if (bytes > 1024) stop(profileError("UNEXPECTED_WORKER_OUTPUT")); };
      worker.stdout?.on("data", stdout); worker.stderr?.on("data", stdout);
      worker.on("message", value => { messageCount++; if (messageCount > 1) stop(profileError("WORKER_RESULT_INVALID")); else output = value; });
      worker.on("error", error => { failure ??= error; });
      worker.once("exit", code => {
        workerClosed = true; clearTimeout(timer); clearInterval(disabled); context.signal?.removeEventListener("abort", abort);
        if (failure) reject(failure);
        else if (code !== 0 || messageCount !== 1 || !output) reject(profileError("WORKER_RESULT_INVALID"));
        else resolve(output);
      });
      context.signal?.addEventListener("abort", abort, { once: true });
      if (context.signal?.aborted) abort();
    });
    if (context.signal?.aborted) throw profileError("CANCELLED");
    if (!context.enabled()) throw profileError("RUNTIME_DISABLED");
    if (Date.now() >= lease.expiresAt || performance.now() - started > (lease.maxRuntimeMs as number)) throw profileError("RUNTIME_TIMEOUT");
    await context.assertActive();
    if (Date.now() >= lease.expiresAt || performance.now() - started > (lease.maxRuntimeMs as number)) throw profileError("RUNTIME_TIMEOUT");
    if (message.implementationHash !== implementationHash || message.parametersHash !== digest(JSON.stringify(parameters))) throw profileError("IMPLEMENTATION_CHANGED");
    const artifact = verifyProfileArtifact(profileId, args, message.artifact);
    if (context.signal?.aborted) throw profileError("CANCELLED");
    return finish("passed", null, artifact);
  } catch (error) {
    const code = typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : "TAIJI_EXECUTION_FAILED";
    return finish(code === "TAIJI_CANCELLED" ? "cancelled" : actualExecution ? "failed" : "blocked", code, null);
  }
}
