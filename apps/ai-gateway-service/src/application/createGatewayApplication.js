import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRuntimeConfig } from "../../../../packages/shared-config/src/index.js";
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
  const enterpriseGovernanceService = createEnterpriseGovernanceService({
    env,
    auditLogPath: env.PME_AUDIT_LOG_PATH,
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

  return {
    capabilityRouterService,
    codexExecCrsRuntimeCandidate,
    config,
    enterpriseGovernanceService,
    enterpriseOpsService,
    fiveCapabilityActivationService,
    gatewayService,
    knowledgeInfra,
    knowledgeService,
    modelImportService,
    modelLibraryStore,
    providerConfigRoutes,
    providerKeyConfigStore,
    providerRegistry,
    runtimeEnv: env,
    runtimeCredentialStore,
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
