import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadRuntimeConfig } from "@unified-ai-system/shared-config";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { createFakeProvider } from "../providers/fakeProvider.js";
import { createOpenAIAdapter } from "../providers/openAiAdapter.js";
import { createNvidiaAdapter } from "../providers/nvidiaAdapter.js";
import { createHttpLLMProviderAdapter } from "../providers/httpLlmProviderAdapter.js";
import { createRuntimeCredentialStore } from "../providers/runtimeCredentialStore.js";
import { createModelImportService } from "../model-import/modelImportService.js";
import { createModelLibraryStore } from "../model-library/modelLibraryStore.js";
import { createProviderKeyConfigStore } from "../provider-config/providerKeyConfigStore.js";
import { createProviderConfigRoutes } from "../provider-config/providerConfigRoutes.js";
import { GatewayService } from "../core/gatewayService.js";
import { createPriorityProviderSelectionPolicy } from "../core/providerSelectionPolicy.js";
import { createLocalKnowledgeService } from "../knowledge/localKnowledgeService.js";
import { createKnowledgeInfra } from "../knowledge/knowledgeInfra.js";
import { createLocalWorkflowService } from "../workflow/localWorkflowService.js";
import { createWorkforceService } from "../workforce/workforceService.js";
import { createUserExperienceService } from "../capabilities/userExperienceService.js";
import { createCapabilityRouterService } from "../capabilities/capabilityRouterService.js";
import { createEnterpriseGovernanceService } from "../enterprise/enterpriseGovernanceService.js";
import { createEnterpriseOpsService } from "../enterprise/enterpriseOpsService.js";
import { createCodexExecCrsRuntimeCandidate } from "../runtime-candidate/codexExecCrsRuntimeCandidate.js";
import { createFiveCapabilityActivationService } from "../real-capabilities/fiveCapabilityActivationService.js";
import { createAuditHashChain } from "../enterprise/auditHashChain.js";
import { createRevocationStore } from "../enterprise/revocationStore.js";
import { createAuthRateLimiter } from "../http/authRateLimiter.js";
import { createMetricsCollector } from "../http/metricsCollector.js";
import { createCircuitBreakerRegistry } from "../providers/providerCircuitBreaker.js";
import { createForgeGatewayService } from "./forgeGatewayService.js";
import { createSqliteRepository } from "../database/sqliteRepository.js";
import { createPromClientExporter } from "../observability/promClientExporter.js";
import { createLiveSkillRegistry } from "../capabilities/liveSkillRegistry.js";
import { createSelfEvolutionPipeline } from "../capabilities/selfEvolutionPipeline.js";
import { createNeuronRuntimeExecutor } from "../capabilities/neuronRuntimeExecutor.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));

export function createGatewayApplication(env = process.env) {
  const config = loadRuntimeConfig(env);
  const runtimeCredentialStore = createRuntimeCredentialStore({ env });
  const providerRegistry = new ProviderRegistry({
    selectionPolicy: createPriorityProviderSelectionPolicy(config.aiGatewayService.providerSelection),
    enabledProviders: config.aiGatewayService.providerSelection.enabledProviders,
  });
  const modelImportService = createModelImportService({
    providerRegistry,
    runtimeCredentialStore,
  });

  for (const modelConfig of config.aiGatewayService.providerModels) {
    const runtimeCredentialCapable = isRuntimeCredentialCapableProvider(modelConfig);
    if (!modelConfig.enabled && !runtimeCredentialCapable) {
      continue;
    }

    providerRegistry.register(createProviderAdapter({
      ...modelConfig,
      enabled: modelConfig.enabled || runtimeCredentialCapable,
    }, config, runtimeCredentialStore));
  }
  restoreRuntimeCredentialProviders({ providerRegistry, runtimeCredentialStore });

  // 从环境变量加载 API Key 到 runtimeCredentialStore
  loadApiKeysFromEnv(runtimeCredentialStore, env);

  const modelLibraryStore = createModelLibraryStore({
    env,
    runtimeCredentialStore,
  });
  const providerKeyConfigStore = createProviderKeyConfigStore({
    env,
    runtimeCredentialStore,
    providerRegistry,
    modelLibraryStore,
  });
  const providerConfigRoutes = createProviderConfigRoutes({
    providerKeyConfigStore,
  });
  const gatewayService = new GatewayService({
    providerRegistry,
    runtimeConfig: {
      providerMode: config.aiGatewayService.providerMode,
      realProviderEnabled: config.aiGatewayService.realProviderEnabled,
      fallbackEnabled: config.aiGatewayService.fallbackEnabled,
    },
  });
  const knowledgeService = createLocalKnowledgeService({
    env,
    storageMode: env.KNOWLEDGE_STORAGE_MODE,
    persistenceDir: env.KNOWLEDGE_PERSISTENCE_DIR,
    fileStorePath: env.KNOWLEDGE_FILE_STORE_PATH,
    sqlitePath: env.KNOWLEDGE_SQLITE_PATH,
  });
  const knowledgeInfra = createKnowledgeInfra(env);
  const workflowService = createLocalWorkflowService({
    env,
    knowledgeService,
    outputDir: env.WORKFLOW_OUTPUT_DIR,
  });
  const workforceService = createWorkforceService({
    env,
  });
  const userExperienceService = createUserExperienceService({
    config,
    env,
    gatewayService,
    knowledgeService,
    workflowService,
  });
  const auditHashChain = createAuditHashChain({
    chainPath: env.AUDIT_CHAIN_PATH ?? ".data/audit/audit-chain.jsonl",
  });
  const revocationStore = createRevocationStore({
    storePath: env.REVOCATION_STORE_PATH ?? ".data/enterprise/revocations.json",
  });
  const authRateLimiter = createAuthRateLimiter({
    maxAttempts: Number(env.AUTH_RATE_LIMIT_MAX_ATTEMPTS) || 5,
    windowMs: Number(env.AUTH_RATE_LIMIT_WINDOW_MS) || 300_000,
    lockoutMs: Number(env.AUTH_RATE_LIMIT_LOCKOUT_MS) || 900_000,
  });
  const metricsCollector = createMetricsCollector();
  const circuitBreakerRegistry = createCircuitBreakerRegistry({
    failureThreshold: Number(env.CIRCUIT_BREAKER_FAILURE_THRESHOLD) || 5,
    successThreshold: Number(env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD) || 2,
    resetTimeoutMs: Number(env.CIRCUIT_BREAKER_RESET_MS) || 30_000,
  });
  const enterpriseGovernanceService = createEnterpriseGovernanceService({
    env,
    auditLogPath: env.PME_AUDIT_LOG_PATH,
    auditHashChain,
    revocationStore,
  });
  const enterpriseOpsService = createEnterpriseOpsService({
    env,
    config,
    enterpriseGovernanceService,
    knowledgeInfra,
    knowledgeService,
  });
  const capabilityRouterService = createCapabilityRouterService({
    providerRegistry,
    config,
  });
  const codexExecCrsRuntimeCandidate = createCodexExecCrsRuntimeCandidate({
    repoRoot,
  });
  const fiveCapabilityActivationService = createFiveCapabilityActivationService({
    repoRoot,
    workforceService,
  });
  const forgeService = createForgeGatewayService({
    env,
    port: config.aiGatewayService.endpoint.port,
  });

  // Wire forgeService into workforce executor for code generation
  if (workforceService.setForgeService) {
    workforceService.setForgeService(forgeService);
  }

  // --- Self-Evolution Pipeline ---
  const liveSkillRegistry = createLiveSkillRegistry({
    storageDir: env.LIVE_SKILL_REGISTRY_DIR ?? resolve(repoRoot, ".data", "capabilities"),
  });
  const selfEvolutionPipeline = createSelfEvolutionPipeline({
    registry: liveSkillRegistry,
    autoApprove: env.SELF_EVOLUTION_AUTO_APPROVE === "true",
  });
  const neuronRuntimeExecutor = createNeuronRuntimeExecutor({
    registry: liveSkillRegistry,
    failOpen: true,
  });

  const repository = createSqliteRepository({
    dataDir: env.DATA_DIR ?? resolve(repoRoot, ".data"),
  });

  const promClientExporter = createPromClientExporter();

  return {
    auditHashChain,
    repository,
    authRateLimiter,
    capabilityRouterService,
    codexExecCrsRuntimeCandidate,
    config,
    enterpriseGovernanceService,
    enterpriseOpsService,
    fiveCapabilityActivationService,
    forgeService,
    gatewayService,
    knowledgeInfra,
    knowledgeService,
    liveSkillRegistry,
    metricsCollector,
    neuronRuntimeExecutor,
    promClientExporter,
    circuitBreakerRegistry,
    modelImportService,
    modelLibraryStore,
    providerConfigRoutes,
    providerKeyConfigStore,
    providerRegistry,
    revocationStore,
    runtimeEnv: env,
    runtimeCredentialStore,
    selfEvolutionPipeline,
    userExperienceService,
    workforceService,
    workflowService,
  };
}

function restoreRuntimeCredentialProviders({ providerRegistry, runtimeCredentialStore }) {
  for (const record of runtimeCredentialStore.listRecords?.() ?? []) {
    if (!providerRegistry.has(record.providerId)) {
      continue;
    }

    if (Array.isArray(record.models) && record.models.length) {
      providerRegistry.addRuntimeModels(record.providerId, record.models);
    }
    providerRegistry.enableProvider(record.providerId);
  }
}

function isRuntimeCredentialCapableProvider(modelConfig) {
  const providerType = modelConfig.providerType ?? modelConfig.providerId;
  return providerType === "openai" ||
    providerType === "nvidia" ||
    providerType === "http-llm" ||
    providerType === "openai-compatible";
}

/**
 * 从环境变量和 providers-config.json 加载 API Key 到 runtimeCredentialStore
 */
function loadApiKeysFromEnv(store, env) {
  // 1. 从环境变量加载
  const apiKeyMap = {
    OPENAI_API_KEY: "openai",
    NVIDIA_API_KEY: "nvidia",
    ZHIPU_API_KEY: "zhipu",
    SILICONFLOW_API_KEY: "siliconflow",
    XIAOMI_API_KEY: "xiaomi",
    GROQ_API_KEY: "groq",
    GOOGLE_API_KEY: "google",
    DEEPSEEK_API_KEY: "deepseek",
    MOONSHOT_API_KEY: "moonshot",
    BAICHUAN_API_KEY: "baichuan",
    QIANFAN_API_KEY: "qianfan",
    TENCENT_API_KEY: "tencent-hunyuan",
    ALIBABA_API_KEY: "dashscope",
    MODELSCOPE_API_KEY: "modelscope",
    OPENROUTER_API_KEY: "openrouter",
    CLOUDFLARE_API_KEY: "cloudflare",
    AGNES_API_KEY: "agnes",
    BLOOM_API_KEY: "bloom",
    VOLCENGINE_API_KEY: "volcengine-doubao",
    MINIMAX_API_KEY: "minimax",
    STEPFUN_API_KEY: "stepfun",
    IFLYTEK_API_KEY: "xunfei-spark",
    YI_API_KEY: "yi",
    PUBLICWELFARE_API_KEY: "publicwelfare",
    MIMO_API_KEY: "xiaomi",
  };

  for (const [envKey, providerId] of Object.entries(apiKeyMap)) {
    const apiKey = env[envKey];
    if (apiKey && !store.has(providerId)) {
      try {
        store.set({ providerId, apiKey });
      } catch (err) {
        // 忽略
      }
    }
  }

  // 2. 从 providers-config.json 加载（补充环境变量中没有的）
  try {
    const configPath = resolve(process.cwd(), "providers-config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    for (const provider of config.providers) {
      if (provider.apiKey && provider.apiKey.length > 5 && !store.has(provider.id)) {
        try {
          store.set({ providerId: provider.id, apiKey: provider.apiKey });
        } catch (err) {
          // 忽略
        }
      }
    }
  } catch (err) {
    // providers-config.json 不存在或无法读取，忽略
  }
}

function createProviderAdapter(modelConfig, config, runtimeCredentialStore) {
  const options = {
    timeoutMs: config.aiGatewayService.requestTimeoutMs,
    runtimeCredentialStore,
  };

  if (modelConfig.providerType === "fake") {
    return createFakeProvider(modelConfig, options);
  }

  if (modelConfig.providerType === "openai" || modelConfig.providerId === "openai") {
    return createOpenAIAdapter(modelConfig, options);
  }

  if (modelConfig.providerType === "nvidia" || modelConfig.providerId === "nvidia") {
    return createNvidiaAdapter(modelConfig, options);
  }

  return createHttpLLMProviderAdapter(modelConfig, options);
}
