import { closeSync, constants, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildUnifiedModelRegistry, buildUnifiedModelRegistryWithLiveDiscovery } from "./unifiedModelRegistry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const DEFAULT_STATE_PATH = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-312a-model-library-state.json");
const MAX_STATE_BYTES = 16 * 1024 * 1024;

export function createModelLibraryStore({ env = process.env, runtimeCredentialStore, storagePath = DEFAULT_STATE_PATH } = {}) {
  const loaded = loadState(storagePath);
  let state = loaded.state;
  let expectedDigest = loaded.digest;
  let outcomeUnknown = false;

  function assertAvailable() {
    if (outcomeUnknown) throw stateError("WRITE_UNCERTAIN");
  }
  function commit(nextState) {
    assertAvailable();
    let snapshot;
    try { snapshot = JSON.parse(JSON.stringify(nextState)); } catch { throw stateError("INVALID"); }
    try { expectedDigest = saveState(storagePath, snapshot, expectedDigest); }
    catch (error) { if (error.code === "MODEL_LIBRARY_STATE_WRITE_UNCERTAIN") outcomeUnknown = true; throw error; }
    state = snapshot;
  }

  function providerConfigSnapshot() {
    const runtimeCredential = runtimeCredentialStore?.describe?.("nvidia");
    const envApiKeyConfigured = Boolean(env.NVIDIA_API_KEY);
    const envBaseUrlConfigured = Boolean(env.NVIDIA_BASE_URL);
    return {
      nvidia: {
        providerId: "nvidia",
        configured: envApiKeyConfigured || runtimeCredential?.apiKeyPresent === true,
        apiKeyConfigured: envApiKeyConfigured || runtimeCredential?.apiKeyPresent === true,
        apiKeySource: runtimeCredential?.apiKeyPresent ? runtimeCredential.secretStorage : envApiKeyConfigured ? "environment" : "none",
        baseUrlConfigured: envBaseUrlConfigured || runtimeCredential?.endpointConfigured === true,
        baseUrlSource: runtimeCredential?.endpointConfigured ? runtimeCredential.secretStorage : envBaseUrlConfigured ? "environment" : "default",
        lastTestAt: state.providerStatus?.nvidia?.lastTestAt ?? null,
        lastTestResult: state.providerStatus?.nvidia?.lastTestResult ?? null,
      },
    };
  }

  function getRegistry() {
    assertAvailable();
    const cachedDiscovery = Array.isArray(state.lastDiscoveryRecords) && state.lastDiscoveryRecords.length
      ? {
          records: state.lastDiscoveryRecords,
          discovery: state.lastDiscovery ?? {
            providerId: "nvidia",
            source: "cached-live-discovery",
            blockers: [],
          },
        }
      : undefined;
    return structuredClone(buildUnifiedModelRegistry({
      providerConfig: providerConfigSnapshot(),
      smokeState: state.smokeState,
      taskDefaults: state.taskDefaults,
      discovery: cachedDiscovery,
    }));
  }

  async function refreshCatalog({ allowLiveDiscovery = false } = {}) {
    assertAvailable();
    const registry = allowLiveDiscovery
      ? await buildUnifiedModelRegistryWithLiveDiscovery({
          providerConfig: providerConfigSnapshot(),
          smokeState: state.smokeState,
          taskDefaults: state.taskDefaults,
        })
      : getRegistry();
    const nextState = {
      ...state,
      lastRefreshAt: new Date().toISOString(),
      lastDiscovery: registry.discovery,
      lastDiscoveryRecords: registry.discovery?.liveDiscoverySucceeded === true
        ? stripRuntimeSelectionFields(registry.models)
        : state.lastDiscoveryRecords ?? null,
      catalogSummary: registry.summary,
    };
    commit(nextState);
    return registry;
  }

  function recordProviderTest({ providerId = "nvidia", success, code, message, testedAt = new Date().toISOString(), realExternalCall = false } = {}) {
    const nextState = {
      ...state,
      providerStatus: {
        ...(state.providerStatus ?? {}),
        [providerId]: {
          providerId,
          keyStatus: success ? "tested_passed" : "tested_failed",
          lastTestAt: testedAt,
          lastTestResult: {
            success: Boolean(success),
            code: code ?? (success ? "provider_key_test_passed" : "provider_key_test_failed"),
            message: message ?? "",
            realExternalCall: Boolean(realExternalCall),
          },
        },
      },
    };
    commit(nextState);
    return structuredClone(state.providerStatus[providerId]);
  }

  function recordSmokeResult({ providerId = "nvidia", modelId, result } = {}) {
    if (!modelId) {
      throw new Error("modelId is required to record model smoke result.");
    }
    const now = new Date().toISOString();
    const success = result?.success === true;
    const sanitized = sanitizeSmokeResult(result);
    const nextState = {
      ...state,
      smokeState: {
        ...(state.smokeState ?? {}),
        [providerId]: {
          ...(state.smokeState?.[providerId] ?? {}),
          [modelId]: {
            testStatus: success ? "smoke_passed" : "smoke_failed",
            lastSmokeAt: now,
            lastSmokeResult: sanitized,
            notes: success ? "Real NVIDIA smoke passed." : `Real NVIDIA smoke failed: ${sanitized.code}`,
          },
        },
      },
    };
    commit(nextState);
    return structuredClone(state.smokeState[providerId][modelId]);
  }

  function setTaskDefault({ providerId = "nvidia", modelId } = {}) {
    const registry = getRegistry();
    const model = registry.models.find((item) => item.providerId === providerId && item.modelId === modelId);
    if (!model) {
      return { success: false, code: "model_not_found", message: "Model is not in the unified model library." };
    }
    if (!model.state?.default_candidate) {
      return {
        success: false,
        code: "model_not_default_candidate",
        message: "Only smoke-passed, direct-chat, commercial-safe, non-deprecated NVIDIA models can become task defaults.",
        model,
      };
    }
    const nextState = {
      ...state,
      taskDefaults: {
        ...(state.taskDefaults ?? {}),
        chatDefaultProviderId: providerId,
        chatDefaultModelId: modelId,
        updatedAt: new Date().toISOString(),
      },
    };
    commit(nextState);
    return { success: true, code: "task_default_set", message: "Task default model updated.", taskDefaults: structuredClone(state.taskDefaults) };
  }

  function getState() {
    assertAvailable();
    return structuredClone(state);
  }

  return {
    getRegistry,
    refreshCatalog,
    recordProviderTest,
    recordSmokeResult,
    setTaskDefault,
    getState,
    storagePath,
  };
}

function loadState(storagePath) {
  let before;
  try { before = lstatSync(storagePath, { bigint: true }); }
  catch (error) {
    if (error.code === "ENOENT") return { state: createEmptyState(), digest: null };
    throw stateError("UNAVAILABLE");
  }
  if (!before.isFile() || before.isSymbolicLink() || before.size < 1n || before.size > BigInt(MAX_STATE_BYTES)) throw stateError("INVALID");
  let descriptor;
  try {
    descriptor = openSync(storagePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    if (!sameFile(fstatSync(descriptor, { bigint: true }), before, true)) throw stateError("UNAVAILABLE");
    const buffer = Buffer.alloc(Number(before.size) + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = readSync(descriptor, buffer, length, buffer.length - length, length);
      if (count === 0) break;
      length += count;
    }
    if (length !== Number(before.size) || !sameFile(fstatSync(descriptor, { bigint: true }), before, true)
      || !sameFile(lstatSync(storagePath, { bigint: true }), before, true)) throw stateError("UNAVAILABLE");
    const bytes = buffer.subarray(0, length);
    let parsed;
    try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { throw stateError("INVALID"); }
    validateState(parsed);
    return { state: { ...createEmptyState(), ...parsed }, digest: digest(bytes) };
  } catch (error) {
    throw error.code?.startsWith("MODEL_LIBRARY_STATE_") ? error : stateError("UNAVAILABLE");
  } finally {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { throw stateError("UNAVAILABLE"); }
    }
  }
}

function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function validateState(value) {
  if (!isRecord(value) || value.version !== 1) throw stateError("INVALID");
  for (const key of ["smokeState", "providerStatus", "taskDefaults"]) {
    if (value[key] !== undefined && !isRecord(value[key])) throw stateError("INVALID");
  }
  for (const key of ["phase", "warning"]) if (value[key] !== undefined && typeof value[key] !== "string") throw stateError("INVALID");
  for (const key of ["lastDiscovery", "catalogSummary"]) if (value[key] != null && !isRecord(value[key])) throw stateError("INVALID");
  if (value.lastRefreshAt != null && (typeof value.lastRefreshAt !== "string" || !Number.isFinite(Date.parse(value.lastRefreshAt)))) throw stateError("INVALID");
  if (value.lastDiscoveryRecords != null && (!Array.isArray(value.lastDiscoveryRecords) || !value.lastDiscoveryRecords.every(isRecord))) throw stateError("INVALID");
  for (const record of Object.values(value.providerStatus ?? {})) {
    if (!isRecord(record) || record.lastTestResult != null && !isRecord(record.lastTestResult)) throw stateError("INVALID");
    for (const key of ["providerId", "keyStatus", "lastTestAt"]) if (record[key] != null && typeof record[key] !== "string") throw stateError("INVALID");
  }
  for (const record of Object.values(value.smokeState ?? {})) {
    if (!isRecord(record)) throw stateError("INVALID");
    // Legacy v1 can contain either provider->model maps or flat model entries.
    const entries = "testStatus" in record || "lastSmokeResult" in record ? [record] : Object.values(record);
    for (const entry of entries) {
      if (!isRecord(entry) || entry.lastSmokeResult != null && !isRecord(entry.lastSmokeResult)) throw stateError("INVALID");
      for (const key of ["testStatus", "lastSmokeAt", "notes"]) if (entry[key] != null && typeof entry[key] !== "string") throw stateError("INVALID");
    }
  }
  for (const key of ["chatDefaultProviderId", "chatDefaultModelId", "updatedAt"]) {
    if (value.taskDefaults?.[key] != null && typeof value.taskDefaults[key] !== "string") throw stateError("INVALID");
  }
}

function stateError(reason) {
  const messages = {
    INVALID: "Model-library state is invalid; existing evidence was preserved.",
    UNAVAILABLE: "Model-library state could not be accessed safely.",
    CHANGED: "Model-library state changed outside this writer; reopen it before writing.",
    SAVE_FAILED: "Model-library state was not saved; the last committed snapshot remains unchanged.",
    WRITE_UNCERTAIN: "Model-library save outcome is uncertain; verify the stored state and reopen before continuing.",
    CLEANUP_FAILED: "Model-library save did not complete cleanly; only owned temporary files may be removed.",
  };
  return Object.assign(new Error(messages[reason]), { code: `MODEL_LIBRARY_STATE_${reason}`, statusCode: 503,
    category: "persistence", retryable: false, ...(reason === "WRITE_UNCERTAIN" ? { outcomeUnknown: true } : {}) });
}
function digest(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function sameFile(current, expected, includeContentMetadata = false) {
  return current.isFile() && !current.isSymbolicLink() && current.dev === expected.dev && current.ino === expected.ino
    && current.birthtimeNs === expected.birthtimeNs
    && (!includeContentMetadata || current.size === expected.size && current.mtimeNs === expected.mtimeNs);
}

function createEmptyState() {
  return {
    version: 1,
    phase: "312A",
    warning: "No plaintext provider API keys are stored in this model library state file.",
    smokeState: {},
    providerStatus: {},
    taskDefaults: {},
    lastRefreshAt: null,
    lastDiscovery: null,
    lastDiscoveryRecords: null,
    catalogSummary: null,
  };
}

function stripRuntimeSelectionFields(models = []) {
  return models.map((model) => {
    const {
      state,
      directChat,
      defaultCandidate,
      taskDefault,
      commercialDefault,
      ...record
    } = model;
    return record;
  });
}

function saveState(storagePath, state, expectedDigest) {
  validateState(state);
  let bytes;
  try { bytes = Buffer.from(`${JSON.stringify(state, null, 2)}\n`, "utf8"); }
  catch { throw stateError("INVALID"); }
  if (bytes.length > MAX_STATE_BYTES) throw stateError("INVALID");
  const nextDigest = digest(bytes);
  const assertUnchanged = () => {
    if (loadState(storagePath).digest !== expectedDigest) throw stateError("CHANGED");
  };
  assertUnchanged();
  const tmpPath = `${storagePath}.${process.pid}.${randomUUID()}.tmp`;
  let descriptor;
  let identity;
  let renameAttempted = false;
  let failure;
  try {
    mkdirSync(dirname(storagePath), { recursive: true, mode: 0o700 });
    descriptor = openSync(tmpPath, "wx", 0o600);
    identity = fstatSync(descriptor, { bigint: true });
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
    closeSync(descriptor); descriptor = undefined;
    assertUnchanged();
    renameAttempted = true;
    renameSync(tmpPath, storagePath);
    if (loadState(storagePath).digest !== nextDigest) throw stateError("WRITE_UNCERTAIN");
    // Windows has no portable Node directory-fsync guarantee. File fsync and
    // verified rename still apply; the documented power-loss boundary is weaker.
    if (process.platform !== "win32") {
      const directory = openSync(dirname(storagePath), constants.O_RDONLY | (constants.O_DIRECTORY ?? 0));
      try { fsyncSync(directory); } finally { closeSync(directory); }
    }
  } catch (error) {
    failure = renameAttempted ? stateError("WRITE_UNCERTAIN")
      : error.code?.startsWith("MODEL_LIBRARY_STATE_") ? error : stateError("SAVE_FAILED");
  } finally {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { failure ??= stateError("SAVE_FAILED"); }
    }
    if (identity) {
      try {
        let current;
        try { current = lstatSync(tmpPath, { bigint: true }); }
        catch (error) { if (error.code !== "ENOENT") throw error; }
        if (current) {
          if (!sameFile(current, identity)) throw stateError("CLEANUP_FAILED");
          unlinkSync(tmpPath);
        }
      } catch { failure ??= stateError(renameAttempted ? "WRITE_UNCERTAIN" : "CLEANUP_FAILED"); }
    }
  }
  if (failure) throw failure;
  return nextDigest;
}

function sanitizeSmokeResult(result = {}) {
  return {
    success: Boolean(result.success),
    code: String(result.code ?? (result.success ? "smoke_passed" : "smoke_failed")),
    message: redactSecrets(result.message ?? ""),
    endpointType: result.meta?.endpointType ?? result.endpointType ?? null,
    providerCalled: Boolean(result.meta?.providerCalled),
    modelCalled: result.meta?.modelCalled ?? null,
    realExternalCall: Boolean(result.meta?.realExternalCall),
    durationMs: result.meta?.durationMs ?? null,
    fallbackUsed: Boolean(result.meta?.fallbackUsed),
    outputPreview: redactSecrets(String(result.data?.outputText ?? result.data?.text ?? "").slice(0, 160)),
  };
}

function redactSecrets(text) {
  return String(text)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/\b(nvapi|sk|pk|ak|sk-proj)[A-Za-z0-9._-]{8,}\b/gi, "[redacted]")
    .replace(/([?&](?:api[_-]?key|token|secret|key)=)[^&\s]+/gi, "$1[redacted]");
}
