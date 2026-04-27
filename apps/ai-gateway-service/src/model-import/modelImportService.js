import {
  cleanApiKey,
  createApiKeyRef,
  getProviderProbeConfig,
  isLikelyMaskedApiKey,
  maskApiKey,
  probeProviderModels,
  resolveProviderCandidates,
} from "./providerProbeRegistry.js";

const DEFAULT_PENDING_TTL_MS = 15 * 60 * 1_000;

export function createModelImportService({
  providerRegistry,
  runtimeCredentialStore,
  fetchImpl = globalThis.fetch,
  pendingTtlMs = DEFAULT_PENDING_TTL_MS,
} = {}) {
  const pendingImports = new Map();
  const devRegistry = new Map();

  return {
    async preview(request = {}) {
      cleanupExpiredPending(pendingImports, pendingTtlMs);

      const apiKey = cleanApiKey(request.apiKey);
      const maskedKey = maskApiKey(apiKey);
      const providerCandidates = resolveProviderCandidates({
        apiKey,
        providerHint: request.providerHint ?? "auto",
        baseUrl: request.baseUrl,
      });

      if (!apiKey) {
        return createFailure({
          status: "invalid_api_key",
          reason: "api_key_required",
          providerCandidates: [],
          maskedKey,
        });
      }

      if (isLikelyMaskedApiKey(apiKey)) {
        return createFailure({
          status: "invalid_api_key",
          reason: "masked_api_key_not_usable",
          providerCandidates: [],
          maskedKey,
        });
      }

      if (!providerCandidates.length) {
        return createFailure({
          status: "needs_provider_selection",
          reason: "api_key_prefix_unknown_choose_provider_or_base_url",
          providerCandidates: [],
          maskedKey,
        });
      }

      const probeResults = await Promise.all(providerCandidates.map((candidate) => {
        return probeProviderModels({
          candidate,
          apiKey,
          fetchImpl,
        });
      }));
      const discovered = probeResults.filter((result) => result.ok);
      const unprobed = probeResults.filter((result) => result.skipped);
      const rejected = probeResults.filter((result) => result.status === "invalid_api_key");

      if (discovered.length > 1) {
        return createFailure({
          status: "needs_user_selection",
          reason: "multiple_provider_model_apis_returned_models",
          providerCandidates: discovered.map((result) => result.providerId),
          maskedKey,
          modelsByProvider: createModelsByProvider(discovered),
        });
      }

      if (discovered.length === 1) {
        const [result] = discovered;
        if (!result.models.length) {
          return createFailure({
            status: "provider_detected_but_models_empty",
            reason: "provider_models_api_returned_empty_list",
            providerCandidates: [result.providerId],
            providerId: result.providerId,
            maskedKey,
          });
        }

        const allModels = result.models;
        const chatModels = allModels.filter(isChatModel);
        if (!chatModels.length) {
          return createFailure({
            status: "provider_detected_but_no_chat_models",
            reason: "provider_models_api_returned_no_chat_capable_models",
            providerCandidates: [result.providerId],
            providerId: result.providerId,
            maskedKey,
            models: allModels,
          });
        }

        const apiKeyRef = createApiKeyRef();
        pendingImports.set(apiKeyRef, {
          apiKey,
          maskedKey,
          providerId: result.providerId,
          baseUrl: providerCandidates.find((candidate) => candidate.providerId === result.providerId)?.baseUrl ?? "",
          models: allModels,
          chatModelIds: chatModels.map((model) => model.modelId),
          createdAt: Date.now(),
        });

        return {
          success: true,
          status: "models_discovered",
          providerId: result.providerId,
          providerCandidates: providerCandidates.map((candidate) => candidate.providerId),
          models: allModels,
          chatModels,
          modelCounts: createModelCounts(allModels),
          apiKeyRef,
          maskedKey,
          source: "provider_models_api",
          secretStorage: "memory-only",
          defaultChatMainLaneChanged: false,
          userMessage: "已通过服务商 models/list 接口拿到真实模型列表。请选择要添加的模型，再执行聊天可用性检测。",
          nextActions: [
            "选择一个返回的模型",
            "点击一键检测并保存",
            "通过后再设为默认或继续聊天",
          ],
        };
      }

      if (unprobed.length) {
        return createFailure({
          status: "needs_base_url",
          reason: "openai_compatible_base_url_required_or_provider_choice_required",
          providerCandidates: providerCandidates.map((candidate) => candidate.providerId),
          maskedKey,
        });
      }

      if (rejected.length === probeResults.length) {
        return createFailure({
          status: "invalid_api_key",
          reason: "all_candidate_provider_model_apis_rejected_key",
          providerCandidates: providerCandidates.map((candidate) => candidate.providerId),
          maskedKey,
        });
      }

      return createFailure({
        status: "probe_failed",
        reason: "candidate_provider_model_apis_did_not_return_valid_models",
        providerCandidates: providerCandidates.map((candidate) => candidate.providerId),
        maskedKey,
      });
    },

    confirm(request = {}) {
      cleanupExpiredPending(pendingImports, pendingTtlMs);

      const providerId = String(request.providerId ?? "").trim();
      const modelId = String(request.modelId ?? "").trim();
      const apiKeyRef = String(request.apiKeyRef ?? "").trim();
      const pending = pendingImports.get(apiKeyRef);

      if (!providerId || !modelId || !apiKeyRef || !pending) {
        return createFailure({
          status: "invalid_api_key",
          reason: "valid_api_key_ref_provider_and_model_required",
          providerCandidates: providerId ? [providerId] : [],
        });
      }

      if (providerId !== pending.providerId) {
        return createFailure({
          status: "needs_user_selection",
          reason: "provider_id_does_not_match_preview",
          providerCandidates: [pending.providerId],
          maskedKey: pending.maskedKey,
        });
      }

      const selectedModel = pending.models.find((model) => model.modelId === modelId);
      if (!selectedModel) {
        return createFailure({
          status: "needs_user_selection",
          reason: "model_id_not_in_provider_models_api_result",
          providerCandidates: [pending.providerId],
          maskedKey: pending.maskedKey,
        });
      }

      if (!isChatModel(selectedModel)) {
        return createFailure({
          status: "model_not_chat_capable",
          reason: "selected_model_is_not_chat_capable",
          providerCandidates: [pending.providerId],
          providerId: pending.providerId,
          maskedKey: pending.maskedKey,
          models: [selectedModel],
        });
      }

      const displayName = String(request.displayName ?? selectedModel.displayName ?? modelId);
      const registryKey = `${providerId}::${modelId}`;
      const providerConfig = getProviderProbeConfig(providerId);
      const runtimeProviderId = resolveRuntimeProviderId(providerId, providerRegistry);
      const runtimeChatUsable = Boolean(runtimeProviderId && providerRegistry?.has?.(runtimeProviderId));

      devRegistry.set(registryKey, {
        providerId,
        runtimeProviderId,
        modelId,
        displayName,
        source: "model-import-confirm",
        secretStorage: "memory-only",
        persisted: false,
        importedAt: new Date().toISOString(),
      });

      if (runtimeChatUsable) {
        const credentialResult = runtimeCredentialStore?.set?.({
          providerId: runtimeProviderId,
          apiKey: pending.apiKey,
          endpoint: pending.baseUrl || providerConfig?.baseUrl,
          source: "models-import-confirm-local-user",
          models: [{
            id: modelId,
            displayName,
            capabilities: selectedModel.capabilities,
            source: "provider_models_api",
            metadata: {
              importedProviderId: providerId,
              modelImportLocalUser: true,
            },
          }],
        });
        providerRegistry?.addRuntimeModels?.(runtimeProviderId, [{
          id: modelId,
          displayName,
          capabilities: selectedModel.capabilities,
          source: "provider_models_api",
          metadata: {
            importedProviderId: providerId,
            modelImportLocalUser: true,
          },
        }]);
        providerRegistry?.enableProvider?.(runtimeProviderId);
        devRegistry.get(registryKey).secretStorage = credentialResult?.secretStorage ?? devRegistry.get(registryKey).secretStorage;
        devRegistry.get(registryKey).persisted = credentialResult?.persisted === true;
      }

      pendingImports.delete(apiKeyRef);

      return {
        success: true,
        status: "model_imported",
        providerId,
        runtimeProviderId,
        modelId,
        displayName,
        secretStorage: runtimeCredentialStore?.describe?.(runtimeProviderId)?.secretStorage ?? "memory-only",
        persisted: runtimeCredentialStore?.describe?.(runtimeProviderId)?.persisted === true,
        localOnly: true,
        devOnly: false,
        runtimeChatUsable,
        defaultChatMainLaneChanged: false,
      };
    },

    listImportedModels() {
      return Array.from(devRegistry.values());
    },
  };
}

function isChatModel(model) {
  const capabilities = Array.isArray(model?.capabilities) ? model.capabilities.map((item) => String(item).toLowerCase()) : [];
  return capabilities.includes("chat") || capabilities.includes("completion") || capabilities.includes("reasoning");
}

function resolveRuntimeProviderId(providerId, providerRegistry) {
  if (providerRegistry?.has?.(providerId)) return providerId;
  if (providerId === "openai-compatible" && providerRegistry?.has?.("generic-openai-compatible")) {
    return "generic-openai-compatible";
  }
  return "";
}

function createModelsByProvider(results) {
  return Object.fromEntries(results.map((result) => [result.providerId, result.models]));
}

function createModelCounts(models = []) {
  const capabilityCounts = {};
  for (const model of models) {
    for (const capability of Array.isArray(model?.capabilities) ? model.capabilities : []) {
      const key = String(capability || "").toLowerCase();
      if (!key) continue;
      capabilityCounts[key] = (capabilityCounts[key] ?? 0) + 1;
    }
  }
  return {
    total: models.length,
    chat: models.filter(isChatModel).length,
    byCapability: capabilityCounts,
  };
}

function createFailure({ status, reason, providerCandidates = [], providerId, maskedKey, modelsByProvider, models }) {
  const safeModels = models ?? [];
  const guidance = createFailureGuidance({ status, reason, providerCandidates });
  return {
    success: false,
    status,
    providerId,
    providerCandidates,
    models: safeModels,
    modelsByProvider,
    modelCounts: createModelCounts(safeModels),
    maskedKey,
    reason,
    userMessage: guidance.userMessage,
    nextActions: guidance.nextActions,
    source: "provider_models_api",
    secretStorage: "memory-only",
    defaultChatMainLaneChanged: false,
  };
}

function createFailureGuidance({ status, reason, providerCandidates = [] }) {
  if (reason === "masked_api_key_not_usable") {
    return {
      userMessage: "当前输入看起来是脱敏后的 API Key，不是真实密钥。请重新粘贴完整 API Key 后再检测。",
      nextActions: [
        "重新粘贴完整 API Key",
        "不要粘贴带 **** 或圆点的脱敏文本",
        "确认后再点击一键添加并检测",
      ],
    };
  }

  if (status === "needs_provider_selection") {
    return {
      userMessage: "无法仅凭 API Key 判断服务商。请选择 provider，或填写 OpenAI-compatible Base URL 后继续检测。",
      nextActions: [
        "如果知道服务商，请在 provider 下拉框选择它",
        "如果是中转或兼容接口，请填写 Base URL",
        "再点击一键添加并检测",
      ],
    };
  }

  if (status === "needs_base_url") {
    return {
      userMessage: "这个 API Key 可能来自 OpenAI-compatible 或第三方中转平台，但缺少 Base URL，暂时不能安全发送探测请求。",
      nextActions: [
        "填写该平台提供的 OpenAI-compatible Base URL",
        "确认 Base URL 和 API Key 属于同一个平台",
        "再重新检测模型列表",
      ],
    };
  }

  if (status === "invalid_api_key") {
    return {
      userMessage: "候选服务商的 models/list 接口拒绝了这把 API Key。请检查 key、服务商、余额、权限或网络状态。",
      nextActions: [
        "确认 provider 选择正确",
        "确认 API Key 没有过期、欠费或无模型权限",
        providerCandidates.length ? "可尝试切换候选 provider 后重试" : "无法判断 provider 时请手动选择服务商",
      ],
    };
  }

  if (status === "provider_detected_but_no_chat_models") {
    return {
      userMessage: "已识别到服务商并拿到模型列表，但这些模型当前不适合作为聊天模型添加。",
      nextActions: [
        "查看返回模型的能力类型",
        "视觉、音频、生图、embedding 等非聊天能力需要后续专门入口",
        "不要把非聊天模型强行添加到聊天窗口",
      ],
    };
  }

  if (status === "provider_detected_but_models_empty") {
    return {
      userMessage: "已识别到服务商，但 models/list 返回为空。可能是账号暂无可用模型、区域不匹配或服务商接口暂时异常。",
      nextActions: [
        "检查账号模型权限",
        "检查服务商区域和控制台配置",
        "稍后重试或换一个明确 provider",
      ],
    };
  }

  if (status === "probe_failed") {
    return {
      userMessage: "models/list 探测没有成功返回可用模型。请检查网络、Base URL、服务商状态或稍后重试。",
      nextActions: [
        "确认本地服务可访问外部 provider",
        "确认 Base URL 以正确的 /v1 或服务商兼容路径结尾",
        "运行 health / doctor / logs 查看本地服务状态",
      ],
    };
  }

  if (status === "needs_user_selection") {
    return {
      userMessage: "多个候选服务商都返回了模型列表。为了避免误用密钥，请手动选择要添加的 provider 和模型。",
      nextActions: [
        "查看候选 provider 列表",
        "选择你确认要使用的平台",
        "再执行添加和聊天可用性检测",
      ],
    };
  }

  return {
    userMessage: "模型导入暂时没有完成。请检查 provider、Base URL、API Key 和服务状态后重试。",
    nextActions: [
      "重新选择 provider",
      "必要时填写 Base URL",
      "运行 health / doctor / logs 查看状态",
    ],
  };
}

function cleanupExpiredPending(pendingImports, pendingTtlMs) {
  const now = Date.now();
  for (const [key, value] of pendingImports) {
    if (now - value.createdAt > pendingTtlMs) {
      pendingImports.delete(key);
    }
  }
}
