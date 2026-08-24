import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRuntimeConfig } from "@unified-ai-system/shared-config";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { createFakeProvider } from "../providers/fakeProvider.js";
import { createOpenAIAdapter } from "../providers/openAiAdapter.js";
import { createNvidiaAdapter } from "../providers/nvidiaAdapter.js";
import { createAnthropicAdapter } from "../providers/anthropicAdapter.js";
import { createGeminiAdapter } from "../providers/geminiAdapter.ts";
import { createHttpLLMProviderAdapter } from "../providers/httpLlmProviderAdapter.js";
import { createRuntimeCredentialStore } from "../providers/runtimeCredentialStore.js";
import { getProviderExecutionDecision } from "../providers/providerExecutionGate.ts";
import { createModelImportService } from "../model-import/modelImportService.js";
import { createModelLibraryStore } from "../model-library/modelLibraryStore.js";
import { createProviderKeyConfigStore } from "../provider-config/providerKeyConfigStore.js";
import { createProviderConfigRoutes } from "../provider-config/providerConfigRoutes.js";
import { GatewayService } from "../core/gatewayService.js";
import { createWeightedTrafficPolicy } from "../routing/weightedTrafficPolicy.js";
import { createPriorityProviderSelectionPolicy } from "../core/providerSelectionPolicy.js";
import { createProviderHealthScorer } from "../providers/providerHealthScorer.js";
import { createRequestLogger } from "../logging/requestLogger.js";
import { createContentGuardrails } from "../guardrails/contentGuardrails.js";
import { createLocalKnowledgeService } from "../knowledge/localKnowledgeService.js";
import { createKnowledgeInfra } from "../knowledge/knowledgeInfra.js";
import { createMcpGatewayService } from "../mcpGateway/mcpGatewayService.ts";
import { createLocalWorkflowService } from "../workflow/localWorkflowService.js";
import { createWorkforceService } from "../workforce/workforceService.js";
import { createControlledExecutor } from "../workforce/workforceControlledExecutor.js";
import { createUserExperienceService } from "../capabilities/userExperienceService.js";
import { createCapabilityRouterService } from "../capabilities/capabilityRouterService.js";
import { createEnterpriseGovernanceService } from "../enterprise/enterpriseGovernanceService.js";
import { createAdvancedRBAC } from "../enterprise/advancedRBAC.js";
import { createResponseSessionStore } from "../responses/responseSessionStore.js";
import { createEnterpriseOpsService } from "../enterprise/enterpriseOpsService.js";
import { createCodexExecCrsRuntimeCandidate } from "../runtime-candidate/codexExecCrsRuntimeCandidate.js";
import { createFiveCapabilityActivationService } from "../real-capabilities/fiveCapabilityActivationService.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));

export function createGatewayApplication(env = process.env) {
  const config = loadRuntimeConfig(env);
  const runtimeCredentialStore = createRuntimeCredentialStore({ env });

  // Health scorer is always created; it powers health-weighted provider selection
  // when mode === "health-weighted" and records outcomes from GatewayService.
  const healthScorer = createProviderHealthScorer();
  const selectionPolicyConfig = {
    ...config.aiGatewayService.providerSelection,
    healthScorer,
  };

  const providerRegistry = new ProviderRegistry({
    selectionPolicy: createPriorityProviderSelectionPolicy(selectionPolicyConfig),
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
    }, config, runtimeCredentialStore, env));
  }
  const providerExecutionConfig = {
    providerMode: config.aiGatewayService.providerMode,
    realProviderEnabled: config.aiGatewayService.realProviderEnabled,
    enabledProviders: config.aiGatewayService.providerSelection.enabledProviders,
  };
  restoreRuntimeCredentialProviders({
    providerRegistry,
    runtimeCredentialStore,
    runtimeConfig: providerExecutionConfig,
  });

  // OpenAI Responses compatibility: previous_response_id chaining state.
  // Memory-only with TTL; stores normalized message text, never credentials.
  const responseSessionStore = createResponseSessionStore({ env });

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
  // Usage ledger — persists every real chat call (tokens, latency, provider/model)
  // to a queryable JSONL store. Disable body logging to keep credentials/contents
  // out of the ledger. Set AI_GATEWAY_USAGE_LOG_DIR to relocate. An empty path
  // is allowed only for fake-only preview; real-provider startup fails closed.
  const requestLogger = createRequestLogger({
    logDir: env.AI_GATEWAY_USAGE_LOG_DIR,
    enableBodyLogging: false,
    // A real provider call can create external cost. Those records must be
    // fsynced individually; fake-only preview keeps the bounded buffer path.
    durableWrites: config.aiGatewayService.realProviderEnabled,
  });
  // Optional model-access governance. The RBAC checker starts empty; role
  // assignments are loaded from AI_GATEWAY_RBAC_ROLES (JSON: { userId: [role] }).
  const governance = createAdvancedRBAC();
  applyRbacRolesFromEnv(governance, env);
  const contentGuardrailMode = String(env.AI_GATEWAY_CONTENT_GUARDRAILS_MODE ?? "block").trim().toLowerCase();
  if (contentGuardrailMode !== "block" && contentGuardrailMode !== "audit") {
    throw new Error("AI_GATEWAY_CONTENT_GUARDRAILS_MODE must be block or audit.");
  }
  const contentGuardrails = createContentGuardrails({
    blockOnInjection: contentGuardrailMode === "block",
  });
  const gatewayService = new GatewayService({
    providerRegistry,
    // 运营可配加权分流/影子流量(AI_GATEWAY_WEIGHTED_ROUTES_JSON);未配置时策略禁用、零行为变化。
    weightedTrafficPolicy: createWeightedTrafficPolicy({ env }),
    runtimeConfig: {
      ...providerExecutionConfig,
      fallbackEnabled: config.aiGatewayService.fallbackEnabled,
      // Long-conversation compaction via the unified context compaction
      // engine; thresholds of 0 disable it.
      chatContextCompaction: config.aiGatewayService.chatContextCompaction,
      // Cost guard is secure-by-default; operators may explicitly disable it.
      costGuardEnforce: String(env.AI_GATEWAY_COST_GUARD_ENFORCE ?? "true").toLowerCase() !== "false",
      requireDurableUsageLedger: config.aiGatewayService.realProviderEnabled,
      shadowRealProviderEnabled: String(env.AI_GATEWAY_SHADOW_REAL_PROVIDER_ENABLED ?? "false").toLowerCase() === "true",
      shadowTimeoutMs: readBoundedNumber(env.AI_GATEWAY_SHADOW_TIMEOUT_MS, 30_000, 1_000, 120_000),
      // Opt-in model-access enforcement. Requires identity (metadata.userId) and
      // role assignments; off by default so the fake-provider default is intact.
      modelAccessEnforce: String(env.AI_GATEWAY_MODEL_ACCESS_ENFORCE ?? "").toLowerCase() === "true",
    },
    healthScorer,
    requestLogger,
    governance,
    contentGuardrails,
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
  const workforceExecutor = createControlledExecutor({
    env,
    repoRoot,
    executionDir: env.WORKFORCE_EXECUTION_DIR,
  });
  const userExperienceService = createUserExperienceService({
    config,
    env,
    gatewayService,
    knowledgeService,
    workflowService,
  });
  const enterpriseGovernanceService = createEnterpriseGovernanceService({
    env,
    auditLogPath: env.PME_AUDIT_LOG_PATH,
  });
  // 反向 MCP 治理：聚合运维声明的上游 MCP server，工具调用全部入审计链。
  const mcpGatewayService = createMcpGatewayService({
    env,
    recordAudit: (event) => enterpriseGovernanceService.recordAudit(event),
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
    workforceExecutor,
  });

  return {
    auditHashChain: enterpriseGovernanceService.getAuditHashChain(),
    capabilityRouterService,
    contentGuardrails,
    codexExecCrsRuntimeCandidate,
    config,
    enterpriseGovernanceService,
    enterpriseOpsService,
    fiveCapabilityActivationService,
    gatewayService,
    healthScorer,
    knowledgeInfra,
    knowledgeService,
    mcpGatewayService,
    modelImportService,
    modelLibraryStore,
    providerConfigRoutes,
    providerKeyConfigStore,
    providerRegistry,
    responseSessionStore,
    runtimeEnv: env,
    runtimeCredentialStore,
    requestLogger,
    userExperienceService,
    workforceService,
    workflowService,
  };
}

function applyRbacRolesFromEnv(governance, env) {
  const raw = env.AI_GATEWAY_RBAC_ROLES;
  if (!raw) return;
  try {
    const mapping = JSON.parse(raw);
    for (const [userId, roleIds] of Object.entries(mapping)) {
      for (const roleId of Array.isArray(roleIds) ? roleIds : [roleId]) {
        governance.assignRole(String(userId), String(roleId));
      }
    }
  } catch {
    // Malformed RBAC config: leave governance with no assigned users (fail closed).
  }
}

function readBoundedNumber(value, fallback, minimum, maximum) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export function restoreRuntimeCredentialProviders({ providerRegistry, runtimeCredentialStore, runtimeConfig }) {
  for (const record of runtimeCredentialStore.listRecords?.() ?? []) {
    if (!providerRegistry.has(record.providerId)) {
      continue;
    }

    if (Array.isArray(record.models) && record.models.length) {
      providerRegistry.addRuntimeModels(record.providerId, record.models);
    }
    const provider = providerRegistry.get(record.providerId);
    const decision = getProviderExecutionDecision({
      providerId: record.providerId,
      providerType: provider.descriptor?.metadata?.providerType,
      runtimeConfig,
    });
    if (decision.allowed) {
      providerRegistry.enableProvider(record.providerId);
    }
  }
}

function isRuntimeCredentialCapableProvider(modelConfig) {
  const providerType = modelConfig.providerType ?? modelConfig.providerId;
  return providerType === "openai" ||
    providerType === "nvidia" ||
    providerType === "anthropic" ||
    providerType === "gemini" ||
    providerType === "http-llm" ||
    providerType === "openai-compatible";
}

function createProviderAdapter(modelConfig, config, runtimeCredentialStore, env) {
  const options = {
    timeoutMs: config.aiGatewayService.requestTimeoutMs,
    runtimeCredentialStore,
    certificationToolMode: env.AI_GATEWAY_FAKE_PROVIDER_TOOL_MODE,
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

  if (modelConfig.providerType === "anthropic" || modelConfig.providerId === "anthropic") {
    return createAnthropicAdapter(modelConfig, options);
  }

  if (modelConfig.providerType === "gemini" || modelConfig.providerId === "gemini") {
    return createGeminiAdapter(modelConfig, options);
  }

  return createHttpLLMProviderAdapter(modelConfig, options);
}
