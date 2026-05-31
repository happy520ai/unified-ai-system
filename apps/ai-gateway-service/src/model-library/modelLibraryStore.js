import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildUnifiedModelRegistry, buildUnifiedModelRegistryWithLiveDiscovery } from "./unifiedModelRegistry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const DEFAULT_STATE_PATH = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-312a-model-library-state.json");

export function createModelLibraryStore({ env = process.env, runtimeCredentialStore, storagePath = DEFAULT_STATE_PATH } = {}) {
  let state = loadState(storagePath);

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
    return buildUnifiedModelRegistry({
      providerConfig: providerConfigSnapshot(),
      smokeState: state.smokeState,
      taskDefaults: state.taskDefaults,
      discovery: cachedDiscovery,
    });
  }

  async function refreshCatalog({ allowLiveDiscovery = false } = {}) {
    const registry = allowLiveDiscovery
      ? await buildUnifiedModelRegistryWithLiveDiscovery({
          providerConfig: providerConfigSnapshot(),
          smokeState: state.smokeState,
          taskDefaults: state.taskDefaults,
        })
      : getRegistry();
    state = {
      ...state,
      lastRefreshAt: new Date().toISOString(),
      lastDiscovery: registry.discovery,
      lastDiscoveryRecords: registry.discovery?.liveDiscoverySucceeded === true
        ? stripRuntimeSelectionFields(registry.models)
        : state.lastDiscoveryRecords ?? null,
      catalogSummary: registry.summary,
    };
    saveState(storagePath, state);
    return registry;
  }

  function recordProviderTest({ providerId = "nvidia", success, code, message, testedAt = new Date().toISOString(), realExternalCall = false } = {}) {
    state = {
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
    saveState(storagePath, state);
    return state.providerStatus[providerId];
  }

  function recordSmokeResult({ providerId = "nvidia", modelId, result } = {}) {
    if (!modelId) {
      throw new Error("modelId is required to record model smoke result.");
    }
    const now = new Date().toISOString();
    const success = result?.success === true;
    const sanitized = sanitizeSmokeResult(result);
    state = {
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
    saveState(storagePath, state);
    return state.smokeState[providerId][modelId];
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
    state = {
      ...state,
      taskDefaults: {
        ...(state.taskDefaults ?? {}),
        chatDefaultProviderId: providerId,
        chatDefaultModelId: modelId,
        updatedAt: new Date().toISOString(),
      },
    };
    saveState(storagePath, state);
    return { success: true, code: "task_default_set", message: "Task default model updated.", taskDefaults: state.taskDefaults };
  }

  function getState() {
    return JSON.parse(JSON.stringify(state));
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
  if (!existsSync(storagePath)) {
    return createEmptyState();
  }
  try {
    return {
      ...createEmptyState(),
      ...JSON.parse(readFileSync(storagePath, "utf8")),
    };
  } catch {
    return createEmptyState();
  }
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

function saveState(storagePath, state) {
  mkdirSync(dirname(storagePath), { recursive: true });
  const tmpPath = `${storagePath}.${process.pid}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  renameSync(tmpPath, storagePath);
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
