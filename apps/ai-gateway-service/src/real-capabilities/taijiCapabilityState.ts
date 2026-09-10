import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { constants, realpathSync } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { resolve } from "node:path";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { createGovernanceStateFileBinding } from "../agent-governance/governanceStateAnchor.ts";

export type TaijiOwner = { tenantId: string; userId: string; agentId: string };
export type TaijiEvaluation = { suiteHash: string; passed: boolean; tests: Array<{
  id: string; status: string; code: string | null; artifactHash: string | null; durationMs: number; workerClosed: boolean;
  actualExecution: boolean;
}> };
export type TaijiCandidate = {
  revision: number; request: string; profileId: string; implementationHash: string; candidateHash: string;
  status: "evaluating" | "evaluated" | "failed" | "unknown" | "revoked";
  evaluation: TaijiEvaluation | null; createdAt: string;
  parameters: { additionalRiskKeywords?: Record<string, string[]> };
  weight: number;
  feedback: Array<{ operation: "repair" | "reweight" | "prune"; runId: string }>;
  regression: { runId: string; arguments: Record<string, unknown>; argumentsHash: string; resultHash: string } | null;
};
export type TaijiActivation = {
  revision: number; epoch: number; policyHash: string; approvalId: string; expiresAt: number;
  maxRequests: number; maxRuntimeMs: number; requests: number; elapsedMs: number;
  runningId: string | null;
};
export type TaijiCapability = {
  id: string; owner: TaijiOwner; lifecycleRevision: number; versions: TaijiCandidate[]; activation: TaijiActivation | null;
  totalRequests: number; totalElapsedMs: number; history: Array<{ operation: string; revision: number; at: string; reason: string }>;
};
export type TaijiRun = {
  id: string; owner: TaijiOwner; capabilityId: string; revision: number; activationEpoch: number;
  argumentsHash: string; status: "running" | "passed" | "failed" | "cancelled" | "unknown";
  candidateHash: string; profileId: string; implementationHash: string; parametersHash: string; policyHash: string; approvalId: string;
  startedAt: string; endedAt: string | null; result: Record<string, unknown> | null;
};
export type TaijiState = {
  version: 1; revision: number; ownerEpoch: string;
  capabilities: Record<string, TaijiCapability>; runs: Record<string, TaijiRun>;
};
const MAX_STATE_BYTES = 8 * 1024 * 1024;
const ownerPaths = new Map<string, string>();

/** Dedicated capability records reuse the existing signed state anchor/WAL.
 * This is explicitly the single-process JSON profile, not a distributed store.
 * Startup suspends every old activation and classifies unfinished work unknown. */
export class TaijiCapabilityStateStore {
  readonly path: string;
  readonly #secret: string;
  readonly #epoch = randomUUID();
  readonly #ownerKey: string;
  readonly #binding: ReturnType<typeof createGovernanceStateFileBinding>;
  #tail: Promise<unknown> = Promise.resolve();
  #initialized = false;
  #closed = false;

  constructor(options: { dataDir: string; secret: string }) {
    this.path = resolve(options.dataDir, "taiji-capabilities.json");
    const physicalPath = resolve(realpathSync(options.dataDir), "taiji-capabilities.json");
    this.#ownerKey = process.platform === "win32" ? physicalPath.toLowerCase() : physicalPath;
    this.#secret = options.secret;
    this.#binding = createGovernanceStateFileBinding({ filePath: this.path, secret: options.secret, kind: "json",
      validateLegacy: () => { throw taijiStateError("STATE_UNANCHORED", "Existing capability state needs its original signed heads."); } });
  }

  snapshot(): Promise<TaijiState> { return this.#exclusive(async () => structuredClone(await this.#load())); }
  update<T>(mutate: (state: TaijiState) => T): Promise<T> {
    return this.#exclusive(async () => {
      const state = await this.#load(), result = mutate(state);
      state.revision++;
      await this.#save(state);
      return structuredClone(result);
    });
  }
  async close(): Promise<void> {
    this.#closed = true;
    await this.#tail;
    if (ownerPaths.get(this.#ownerKey) === this.#epoch) ownerPaths.delete(this.#ownerKey);
  }
  #exclusive<T>(run: () => Promise<T>): Promise<T> {
    const operation = this.#tail.then(async () => {
      if (this.#closed) throw taijiStateError("CLOSED", "Capability runtime is closed.");
      return run();
    });
    this.#tail = operation.catch(() => undefined);
    return operation;
  }
  async #load(): Promise<TaijiState> {
    const initializing = !this.#initialized;
    if (initializing) {
      const current = ownerPaths.get(this.#ownerKey);
      if (current && current !== this.#epoch) throw taijiStateError("OWNER_ACTIVE", "A capability runtime already owns this state in the current process.");
      // Claim before the first asynchronous filesystem operation.
      ownerPaths.set(this.#ownerKey, this.#epoch);
    }
    try { return await this.#loadOwned(); }
    catch (error) {
      if (initializing && !this.#initialized && ownerPaths.get(this.#ownerKey) === this.#epoch) ownerPaths.delete(this.#ownerKey);
      throw error;
    }
  }
  async #loadOwned(): Promise<TaijiState> {
    try {
      const before = await lstat(this.path, { bigint: true });
      if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || before.size > BigInt(MAX_STATE_BYTES)) throw taijiStateError("STATE_UNSAFE", "Capability state file is unsafe or too large.");
    } catch (error) { if ((error as { code?: string }).code !== "ENOENT") throw error; }
    await this.#binding.verify();
    const state = await this.#read();
    await this.#binding.verify();
    if (!this.#initialized) {
      try {
        const now = new Date().toISOString();
        for (const capability of Object.values(state.capabilities)) {
          if (capability.activation) {
            capability.activation = null; capability.lifecycleRevision++;
            capability.history.push({ operation: "restart-suspend", revision: capability.lifecycleRevision, at: now, reason: "Fresh approval is required after runtime restart." });
          }
          for (const version of capability.versions) if (version.status === "evaluating") version.status = "unknown";
        }
        for (const run of Object.values(state.runs)) if (run.status === "running") {
          run.status = "unknown"; run.endedAt = now;
        }
        state.ownerEpoch = this.#epoch; state.revision++;
        await this.#save(state); this.#initialized = true;
      } catch (error) { if (ownerPaths.get(this.#ownerKey) === this.#epoch) ownerPaths.delete(this.#ownerKey); throw error; }
    } else if (state.ownerEpoch !== this.#epoch) throw taijiStateError("OWNER_CHANGED", "Capability state ownership changed.");
    return state;
  }
  async #read(): Promise<TaijiState> {
    let before;
    try { before = await lstat(this.path, { bigint: true }); }
    catch (error) {
      if ((error as { code?: string }).code === "ENOENT" && !this.#initialized) return { version: 1, revision: 0, ownerEpoch: this.#epoch, capabilities: {}, runs: {} };
      throw error;
    }
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || before.size > BigInt(MAX_STATE_BYTES)) throw taijiStateError("STATE_UNSAFE", "Capability state file is unsafe or too large.");
    const handle = await open(this.path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    let bytes: Buffer;
    try {
      const opened = await handle.stat({ bigint: true });
      if (!opened.isFile() || opened.nlink !== 1n || opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size) throw taijiStateError("STATE_UNSAFE", "Capability state identity changed.");
      const buffer = Buffer.alloc(Number(opened.size) + 1);
      let offset = 0;
      while (offset < buffer.length) { const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset); if (!bytesRead) break; offset += bytesRead; }
      if (offset !== Number(opened.size)) throw taijiStateError("STATE_UNSAFE", "Capability state changed while being read.");
      const after = await lstat(this.path, { bigint: true });
      if (after.dev !== opened.dev || after.ino !== opened.ino || after.nlink !== 1n || after.mtimeNs !== opened.mtimeNs || after.size !== opened.size) throw taijiStateError("STATE_UNSAFE", "Capability state changed while being read.");
      bytes = buffer.subarray(0, offset);
    } finally { await handle.close(); }
    let envelope;
    try { envelope = JSON.parse(bytes.toString("utf8")); }
    catch { throw taijiStateError("STATE_CORRUPT", "Capability state is not valid JSON."); }
    if (!envelope || typeof envelope !== "object" || Object.keys(envelope).sort().join() !== "hmac,state"
      || typeof envelope.hmac !== "string" || !/^[a-f0-9]{64}$/.test(envelope.hmac)) throw taijiStateError("STATE_CORRUPT", "Capability state envelope is invalid.");
    const expected = this.#mac(envelope.state);
    if (!timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(envelope.hmac, "hex"))) throw taijiStateError("STATE_CORRUPT", "Capability state signature is invalid.");
    validateState(envelope.state);
    return envelope.state;
  }
  #mac(state: TaijiState): string { return createHmac("sha256", this.#secret).update("taiji-capabilities/v1\0").update(stableStringify(state)).digest("hex"); }
  async #save(state: TaijiState): Promise<void> {
    validateState(state);
    const content = JSON.stringify({ state, hmac: this.#mac(state) });
    if (Buffer.byteLength(content) > MAX_STATE_BYTES) throw taijiStateError("STATE_FULL", "Capability evidence capacity is exhausted; no records were silently removed.");
    await this.#binding.commit(content);
  }
}

export function taijiStateError(suffix: string, message: string, statusCode = 409): Error & { code: string; statusCode: number } {
  return Object.assign(new Error(message), { code: `TAIJI_${suffix}`, statusCode });
}
function validateState(value: unknown): asserts value is TaijiState {
  const state = value as TaijiState;
  if (!state || state.version !== 1 || !Number.isSafeInteger(state.revision) || state.revision < 0
    || typeof state.ownerEpoch !== "string" || !/^[a-f0-9-]{36}$/.test(state.ownerEpoch)
    || !state.capabilities || !state.runs || Array.isArray(state.capabilities) || Array.isArray(state.runs)
    || Object.keys(state.capabilities).length > 100 || Object.keys(state.runs).length > 1000) throw taijiStateError("STATE_CORRUPT", "Capability state schema or capacity is invalid.");
  for (const [key, capability] of Object.entries(state.capabilities)) {
    if (!/^sha256:[a-f0-9]{64}$/.test(key) || !capability || !Array.isArray(capability.versions) || capability.versions.length > 20
      || !Array.isArray(capability.history) || capability.history.length > 1000 || !Number.isSafeInteger(capability.lifecycleRevision)
      || !Number.isSafeInteger(capability.totalRequests) || !Number.isFinite(capability.totalElapsedMs)) throw taijiStateError("STATE_CORRUPT", "Capability record is invalid.");
    for (const version of capability.versions) {
      if (!Number.isSafeInteger(version.revision) || version.revision < 1
        || !["evaluating", "evaluated", "failed", "unknown", "revoked"].includes(version.status)
        || !/^sha256:[a-f0-9]{64}$/.test(version.implementationHash) || !/^sha256:[a-f0-9]{64}$/.test(version.candidateHash)
        || !Number.isFinite(version.weight) || version.weight < 0 || version.weight > 1
        || !version.parameters || typeof version.parameters !== "object" || Array.isArray(version.parameters)
        || !Array.isArray(version.feedback) || version.feedback.length > 1000) throw taijiStateError("STATE_CORRUPT", "Capability version is invalid.");
    }
  }
  for (const [key, run] of Object.entries(state.runs)) {
    if (!/^sha256:[a-f0-9]{64}$/.test(key) || !run || !["running", "passed", "failed", "cancelled", "unknown"].includes(run.status)
      || !Number.isSafeInteger(run.revision) || run.revision < 1) throw taijiStateError("STATE_CORRUPT", "Capability run is invalid.");
  }
}
