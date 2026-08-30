import { existsSync, lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { createHmac, timingSafeEqual } from "node:crypto";
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
import { createProviderDispatchGate } from "../providers/providerDispatchGate.ts";
import { createExternalEffectGate } from "../external-effects/externalEffectGate.ts";
import { createUsageLedger } from "../logging/usageLedgerFactory.ts";
import { createProviderStatementReconciliationService } from "../billing/providerStatementReconciliationService.ts";
import { createContentGuardrails } from "../guardrails/contentGuardrails.js";
import { createLocalKnowledgeService } from "../knowledge/localKnowledgeService.js";
import { createKnowledgeInfra } from "../knowledge/knowledgeInfra.js";
import { createMcpGatewayService } from "../mcpGateway/mcpGatewayService.ts";
import { createAgentGovernanceService } from "../agent-governance/agentGovernanceService.ts";
import { createAgentGovernanceToolProxy } from "../agent-governance/toolProxy.ts";
import { createGatewayModelProposer } from "../agent-governance/gatewayModelProposer.ts";
import { resolveGovernanceSecret } from "../agent-governance/governanceSecret.ts";
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
import {
  createLocalClientManagementService,
  preflightLocalClientRegistryIntegrity,
} from "../capabilities/localClientManagementService.ts";
import { createLocalClientAdapterRegistry } from "../capabilities/localClientAdapterRegistry.ts";
import { createLocalClientRoutePlanStore } from "../capabilities/localClientRoutePlanStore.ts";
import { createLocalClientSqliteRoutePlanStore } from "../capabilities/localClientSqliteRoutePlanStore.ts";
import { createLocalClientSqliteExecutionClaimStore } from "../capabilities/localClientSqliteExecutionClaimStore.ts";
import { createLocalClientSqliteVerificationAuthorityEpochStore } from "../capabilities/localClientSqliteVerificationAuthorityEpochStore.ts";
import { assertLocalClientExecutionReadiness } from "../capabilities/localClientExecutionReadiness.ts";
import {
  createLocalClientLoopbackAdapter,
  createLocalClientLoopbackVerificationProbe,
} from "../capabilities/localClientLoopbackAdapter.ts";
import { createCredentialResolver } from "../credentials/credentialResolver.js";
import { createWorkforceExecutionControl } from "../workforce/workforceExecutionControlFactory.ts";
import { createLocalClientProviderRuntimeRouter } from "../routing/localClientProviderRuntimeRouter.ts";
import { createConfiguredLocalClientProviderPolicyResolver } from "../routing/localClientProviderPolicyConfig.ts";
import { createIdempotencyCoordinator } from "../http/idempotencyCoordinator.ts";
import { createLocalClientVerificationService } from "../capabilities/localClientVerificationService.ts";
import { createLocalClientExecutionPreview } from "../capabilities/localClientExecutionPreview.ts";
import { createLocalClientExecutionOrchestrator } from "../capabilities/localClientExecutionOrchestrator.ts";
import { createLocalClientExecutionIdempotencyCoordinator } from "../capabilities/localClientExecutionIdempotencyCoordinator.ts";
import { createLocalClientGovernedExecutionApi } from "../capabilities/localClientGovernedExecutionApi.ts";
import { createLocalClientVerifiedExecutionFence } from "../capabilities/localClientVerifiedExecutionFence.ts";
import { resolveLocalClientLoopbackAdapterConfiguration } from "../capabilities/localClientLoopbackAdapterConfig.ts";
import { createLocalClientVerificationOwnershipGate } from "../capabilities/localClientVerificationOwnership.ts";
import { createLocalClientSqliteFeedbackDedupStore } from "../capabilities/localClientSqliteFeedbackDedupStore.ts";
import { LocalClientSqliteExecutionFeedbackOutbox } from "../capabilities/localClientSqliteExecutionFeedbackOutbox.ts";
import { createLocalClientExecutionFeedbackDispatcher } from "../capabilities/localClientExecutionFeedbackDispatcher.ts";
import {
  createLocalClientSqliteExecutionReceiptJournal,
  LOCAL_CLIENT_RECEIPT_RECONCILIATION_KEY_DERIVATION_DOMAIN,
} from "../capabilities/localClientExecutionReceiptReconciliation.ts";
import { createLocalClientExecutionReceiptJournalRegistry } from "../capabilities/localClientExecutionReceiptJournalRegistry.ts";
import { createLocalClientExecutionReceiptRecoveryService } from "../capabilities/localClientExecutionReceiptRecoveryService.ts";
import { resolveLocalClientOnboardingConfiguration } from "../capabilities/localClientOnboardingConfig.ts";
import { createLocalClientGovernedOnboardingRuntime } from "../capabilities/localClientGovernedOnboardingRuntime.ts";
import { createLocalClientSqliteOnboardingReceiptAuthorityStore } from "../capabilities/localClientSqliteOnboardingReceiptAuthorityStore.ts";
import {
  createManagedLocalClientPopIdentityAuthority,
  deriveManagedLocalClientPopKey,
} from "../capabilities/localClientPopIdentityAuthority.ts";
import { createLocalClientSqlitePopReplayGuard } from "../capabilities/localClientSqlitePopReplayGuard.ts";
import {
  LOCAL_CLIENT_POP_SNAPSHOT_ROLLBACK_BOUNDARIES,
  LOCAL_CLIENT_POP_SNAPSHOT_ROLLBACK_NATIVE_DEPLOYMENT_BLOCKERS,
} from "../capabilities/localClientPopSnapshotRollbackProtection.ts";
import { LocalClientSmartManagementScheduler } from "../capabilities/localClientSmartManagementScheduler.ts";
import { resolveLocalClientSmartManagementSchedulerConfig } from "../capabilities/localClientSmartManagementSchedulerConfig.ts";
import { createLocalClientPopHttpAuth } from "../capabilities/localClientPopHttpAuth.ts";
import { resolveLocalClientProtocolPrincipalConfiguration } from "../capabilities/localClientProtocolPrincipalConfig.ts";

const repoRoot = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const LOCAL_CLIENT_FIXTURE_RECEIPT_CLOSURE_CAPABILITY = Symbol(
  "local-client-fixture-receipt-closure",
);

export function createGatewayApplication(env = process.env) {
  return createGatewayApplicationInternal(env, null);
}

/**
 * Direct-source test support only. This function is intentionally absent from
 * the service entrypoint and cannot be enabled by runtime environment/config.
 */
export function createGatewayApplicationForLocalClientFixtureTests(env = {}) {
  if (process.env.VITEST !== "true") {
    throw new Error("The local-client fixture application factory is available only under Vitest.");
  }
  return createGatewayApplicationInternal(env, LOCAL_CLIENT_FIXTURE_RECEIPT_CLOSURE_CAPABILITY);
}

function createGatewayApplicationInternal(env, fixtureCapability) {
  const agentExecWorkingDirectory = resolveAgentExecWorkingDirectory(env);
  const localClientFixtureReceiptClosure =
    fixtureCapability === LOCAL_CLIENT_FIXTURE_RECEIPT_CLOSURE_CAPABILITY;
  const parsedLocalClientOnboardingConfiguration = resolveLocalClientOnboardingConfiguration(env);
  const localClientSmartManagementSchedulerConfiguration =
    resolveLocalClientSmartManagementSchedulerConfig(env);
  const localClientProtocolPrincipalConfiguration =
    resolveLocalClientProtocolPrincipalConfiguration(env);
  const localClientExecutionRequested = readStrictBoolean(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED,
    false,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED",
  );
  const localClientMultiInstanceRequested = readStrictBoolean(
    env.AI_GATEWAY_MULTI_INSTANCE,
    false,
    "AI_GATEWAY_MULTI_INSTANCE",
  );
  validateLocalClientStaticConfiguration(env);
  validateLocalClientFeedbackDedupConfiguration(env, localClientExecutionRequested);
  validateLocalClientExecutionFeedbackOutboxConfiguration(env, localClientExecutionRequested);
  validateLocalClientReceiptReconciliationConfiguration(env, localClientExecutionRequested);
  validateLocalClientPopReplayConfiguration(env);
  validateLocalClientOnboardingGovernanceConfiguration(
    env,
    parsedLocalClientOnboardingConfiguration,
  );
  const localClientGovernedMutationRequested = localClientExecutionRequested
    || parsedLocalClientOnboardingConfiguration.enabled;
  const localClientProviderPolicyResolver = createConfiguredLocalClientProviderPolicyResolver(env);
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
  // Usage ledger — persists every real chat attempt (tokens, latency,
  // provider/model) to either fsynced local JSONL or the central PostgreSQL
  // store. Neither schema accepts prompt/response bodies or credentials.
  const requestLogger = createUsageLedger({
    env,
    realProviderEnabled: config.aiGatewayService.realProviderEnabled,
  });
  const providerDispatchGate = createProviderDispatchGate({
    env,
    realProviderEnabled: config.aiGatewayService.realProviderEnabled,
  });
  const agentGovernanceRuntime = resolveAgentGovernanceRuntimeConfiguration(env);
  const externalEffectEnabled = resolveExternalEffectEnabled(
    env,
    parsedLocalClientOnboardingConfiguration.enabled,
  ) || agentGovernanceRuntime.highRiskTools.length > 0;
  const externalEffectGate = createExternalEffectGate({ env, enabled: externalEffectEnabled });
  const providerStatementReconciliationService = createProviderStatementReconciliationService({
    requestLogger,
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
  const enterpriseGovernanceService = createEnterpriseGovernanceService({
    env,
    auditLogPath: env.PME_AUDIT_LOG_PATH,
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
      requireProviderDispatchGate: config.aiGatewayService.realProviderEnabled,
      shadowRealProviderEnabled: String(env.AI_GATEWAY_SHADOW_REAL_PROVIDER_ENABLED ?? "false").toLowerCase() === "true",
      shadowTimeoutMs: readBoundedNumber(env.AI_GATEWAY_SHADOW_TIMEOUT_MS, 30_000, 1_000, 120_000),
      // Opt-in model-access enforcement. Requires identity (metadata.userId) and
      // role assignments; off by default so the fake-provider default is intact.
      modelAccessEnforce: String(env.AI_GATEWAY_MODEL_ACCESS_ENFORCE ?? "").toLowerCase() === "true",
    },
    healthScorer,
    requestLogger,
    enterpriseAudit: enterpriseGovernanceService,
    governance,
    contentGuardrails,
    providerDispatchGate,
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
  // 反向 MCP 治理：聚合运维声明的上游 MCP server，工具调用全部入审计链。
  const mcpGatewayService = createMcpGatewayService({
    env,
    externalEffectGate,
    recordAudit: (event) => enterpriseGovernanceService.recordAudit(event),
  });
  // Agent 治理控制平面：生成→校验→编译→登记→逐调用 Tool Proxy 强制。
  // 无 agentGovernance 身份的 legacy 调用方不受影响；
  // AI_GATEWAY_AGENT_GOVERNANCE_ENABLED=false 可整体关闭。
  const agentGovernanceEnabled = agentGovernanceRuntime.enabled;
  let agentGovernance = null;
  if (agentGovernanceEnabled) {
    const agentGovernanceDataDir = env.AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR
      ? (isAbsolute(env.AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR)
        ? env.AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR
        : resolve(repoRoot, env.AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR))
      : resolve(repoRoot, ".data", "agent-governance");
    const governancePathFromRepo = relative(repoRoot, agentGovernanceDataDir);
    const governanceInsideRepo = governancePathFromRepo === ""
      || (!governancePathFromRepo.startsWith(`..${sep}`) && governancePathFromRepo !== ".." && !isAbsolute(governancePathFromRepo));
    const approvedRuntimeDataRoot = resolve(repoRoot, ".data");
    const governancePathFromRuntimeData = relative(approvedRuntimeDataRoot, agentGovernanceDataDir);
    const insideApprovedRuntimeData = governancePathFromRuntimeData === ""
      || (!governancePathFromRuntimeData.startsWith(`..${sep}`)
        && governancePathFromRuntimeData !== ".."
        && !isAbsolute(governancePathFromRuntimeData));
    if (governanceInsideRepo && !insideApprovedRuntimeData) {
      const error = new Error(
        "Agent Governance state inside the repository must remain under the protected .data directory.",
      );
      error.code = "AGENT_GOVERNANCE_DATA_DIR_UNSAFE";
      error.category = "configuration";
      throw error;
    }
    const modelProposer = agentGovernanceRuntime.modelProposer.enabled
      ? createGatewayModelProposer({
        gatewayService,
        providerId: agentGovernanceRuntime.modelProposer.providerId,
        modelId: agentGovernanceRuntime.modelProposer.modelId,
      })
      : null;
    const registryConfiguration = resolveAgentGovernanceRegistryConfiguration(
      env,
      repoRoot,
      agentGovernanceDataDir,
    );
    // Establish the no-link/private-ACL governance root before SQLite can
    // create its database or WAL files in that authority directory.
    resolveGovernanceSecret({ env, dataDir: agentGovernanceDataDir });
    // SQLite/PostgreSQL adapters remain testable migration candidates, but no
    // runtime may promote them until Registry rollback/authority anchoring has
    // independent evidence. The only executable authority is signed JSON.
    const agentRegistryStore = null;
    let agentGovernanceService;
    try {
      agentGovernanceService = createAgentGovernanceService({
        env,
        dataDir: agentGovernanceDataDir,
        modelProposer,
        registryAuthority: registryConfiguration.authorityBinding,
      });
    } catch (error) {
      void agentRegistryStore?.close?.();
      throw error;
    }
    agentGovernance = Object.freeze({
      service: agentGovernanceService,
      toolProxy: createAgentGovernanceToolProxy({ service: agentGovernanceService }),
      dataDir: agentGovernanceDataDir,
      highRiskTools: agentGovernanceRuntime.highRiskTools,
      healthCheckIntervalMs: agentGovernanceRuntime.healthCheckIntervalMs,
      registryStore: agentRegistryStore,
      get registry() {
        return Object.freeze(agentRegistryStore
          ? agentRegistryStore.getHealth()
          : {
            storageMode: "single-process-json",
            durable: true,
            transactional: false,
            distributed: false,
            singleHost: true,
            pathExposed: false,
          });
      },
    });
  }
  const enterpriseOpsService = createEnterpriseOpsService({
    env,
    config,
    enterpriseGovernanceService,
    knowledgeInfra,
    knowledgeService,
    agentGovernance,
  });
  const capabilityRouterService = createCapabilityRouterService({
    providerRegistry,
    config,
  });
  const localClientAdapterRegistry = createLocalClientAdapterRegistry();
  let localClientOnboardingConfiguration;
  let localClientAdapterConfiguration;
  try {
    validateLocalClientOnboardingGovernanceConfiguration(
      env,
      parsedLocalClientOnboardingConfiguration,
    );
    localClientOnboardingConfiguration = materializeLocalClientOnboardingRuntimeConfiguration(
      env,
      parsedLocalClientOnboardingConfiguration,
    );
    localClientAdapterConfiguration = registerConfiguredLocalClientAdapters(
      localClientAdapterRegistry,
      env,
    );
    if (localClientProtocolPrincipalConfiguration.enabled) {
      if (!localClientAdapterConfiguration.popAuthorityRegistry) {
        throw localClientProtocolPrincipalBindingError();
      }
      for (const binding of localClientProtocolPrincipalConfiguration.bindings) {
        if (!localClientAdapterConfiguration.popAuthorityRegistry.hasBinding(
          binding.tenantId,
          binding.clientId,
        )) {
          throw localClientProtocolPrincipalBindingError();
        }
      }
    }
  } catch (error) {
    if (localClientOnboardingConfiguration) {
      zeroLocalClientOnboardingBackupKey(localClientOnboardingConfiguration);
    }
    closeFailedLocalClientStartupResources([
      localClientAdapterConfiguration?.popAuthorityRegistry,
      localClientAdapterConfiguration?.receiptJournalRegistry,
      ...(localClientAdapterConfiguration?.probes ?? []),
      localClientAdapterRegistry,
      agentGovernance?.registryStore,
      externalEffectGate,
      workforceExecutor,
      requestLogger,
      providerDispatchGate,
      mcpGatewayService,
      enterpriseGovernanceService,
    ]);
    throw error;
  }
  const localClientVerificationProbes = localClientAdapterConfiguration.probes;
  let localClientAuthorityEpochStore = null;
  let localClientFeedbackDedupStore = null;
  let localClientExecutionFeedbackOutbox = null;
  let localClientOnboardingReceiptAuthorityStore = null;
  let localClientVerificationAuthorityStatus = null;
  let localClientRoutePlanStore;
  try {
    localClientOnboardingReceiptAuthorityStore = createConfiguredLocalClientOnboardingReceiptAuthorityStore(
      env,
      localClientOnboardingConfiguration.enabled,
    );
    localClientFeedbackDedupStore = createConfiguredLocalClientFeedbackDedupStore(
      env,
      localClientAdapterConfiguration.registryIntegrityKey,
    );
    localClientExecutionFeedbackOutbox = createConfiguredLocalClientExecutionFeedbackOutbox(
      env,
      localClientAdapterConfiguration.registryIntegrityKey,
    );
    localClientAuthorityEpochStore = createConfiguredLocalClientAuthorityEpochStore(
      env,
      localClientAdapterConfiguration.registryIntegrityKey,
    );
    localClientVerificationAuthorityStatus = localClientAdapterConfiguration.registryIntegrityKey
      ? preflightLocalClientRegistryIntegrity({
        registryPath: env.AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH,
        registryIntegrityKey: localClientAdapterConfiguration.registryIntegrityKey,
        epochStore: localClientAuthorityEpochStore ?? undefined,
      })
      : null;
    localClientRoutePlanStore = createConfiguredLocalClientRoutePlanStore(env);
  } catch (error) {
    closeFailedLocalClientStartupResources([
      localClientAdapterConfiguration.popAuthorityRegistry,
      localClientAdapterConfiguration.receiptJournalRegistry,
      ...localClientAdapterConfiguration.probes,
      localClientAdapterRegistry,
      localClientOnboardingReceiptAuthorityStore,
      localClientExecutionFeedbackOutbox,
      localClientFeedbackDedupStore,
      localClientAuthorityEpochStore,
      agentGovernance?.registryStore,
      externalEffectGate,
      workforceExecutor,
      requestLogger,
      providerDispatchGate,
      mcpGatewayService,
      enterpriseGovernanceService,
    ]);
    localClientAdapterConfiguration.registryIntegrityKey?.fill(0);
    zeroLocalClientOnboardingBackupKey(localClientOnboardingConfiguration);
    throw error;
  }
  let localClientExecutionControl;
  let localClientExecutionClaimStore;
  let idempotencyCoordinator;
  try {
    localClientExecutionControl = createConfiguredLocalClientExecutionControl(
      env,
      localClientOnboardingConfiguration.enabled
        ? Math.max(localClientRoutePlanStore.status.ttlMs, 10 * 60_000)
        : localClientRoutePlanStore.status.ttlMs,
      localClientGovernedMutationRequested,
    );
    localClientExecutionClaimStore = createConfiguredLocalClientExecutionClaimStore(env);
    idempotencyCoordinator = localClientGovernedMutationRequested
      ? createIdempotencyCoordinator({ env })
      : null;
    if (localClientOnboardingConfiguration.enabled) {
      validateLocalClientOnboardingGovernanceConfiguration(
        env,
        parsedLocalClientOnboardingConfiguration,
      );
    }
  } catch (error) {
    closeFailedLocalClientStartupResources([
      localClientAdapterConfiguration.popAuthorityRegistry,
      localClientAdapterConfiguration.receiptJournalRegistry,
      ...localClientAdapterConfiguration.probes,
      localClientAdapterRegistry,
      idempotencyCoordinator,
      localClientExecutionClaimStore,
      localClientRoutePlanStore,
      localClientExecutionControl,
      localClientOnboardingReceiptAuthorityStore,
      localClientExecutionFeedbackOutbox,
      localClientFeedbackDedupStore,
      localClientAuthorityEpochStore,
      agentGovernance?.registryStore,
      externalEffectGate,
      workforceExecutor,
      requestLogger,
      providerDispatchGate,
      mcpGatewayService,
      enterpriseGovernanceService,
    ]);
    localClientAdapterConfiguration.registryIntegrityKey?.fill(0);
    zeroLocalClientOnboardingBackupKey(localClientOnboardingConfiguration);
    throw error;
  }
  let localClientExecutionReadiness;
  try {
    localClientExecutionReadiness = assertLocalClientExecutionReadiness({
      env,
      routePlanStatus: localClientRoutePlanStore.status,
      executionControlStatus: {
        ...localClientExecutionControl.getHealth(),
        available: localClientExecutionControl.getHealth().available !== false,
      },
      externalEffectStatus: {
        ...externalEffectGate.status,
        available: externalEffectGate.getHealth().available === true,
      },
      claimStatus: localClientExecutionClaimStore?.status ?? null,
      idempotencyStatus: toLocalClientIdempotencyReadinessStatus(idempotencyCoordinator),
      verificationAuthorityStatus: localClientVerificationAuthorityStatus,
      receiptJournalStatus: projectLocalClientReceiptJournalReadinessStatus(
        localClientAdapterConfiguration.receiptJournalRegistry?.status ?? null,
        localClientFixtureReceiptClosure,
      ),
      adapterDescriptors: localClientAdapterRegistry.list(),
    });
  } catch (error) {
    closeFailedLocalClientStartupResources([
      localClientAdapterConfiguration.popAuthorityRegistry,
      localClientAdapterConfiguration.receiptJournalRegistry,
      ...localClientAdapterConfiguration.probes,
      localClientAdapterRegistry,
      idempotencyCoordinator,
      localClientExecutionClaimStore,
      localClientRoutePlanStore,
      localClientExecutionControl,
      localClientOnboardingReceiptAuthorityStore,
      localClientExecutionFeedbackOutbox,
      localClientFeedbackDedupStore,
      localClientAuthorityEpochStore,
      agentGovernance?.registryStore,
      externalEffectGate,
      workforceExecutor,
      requestLogger,
      providerDispatchGate,
      mcpGatewayService,
      enterpriseGovernanceService,
    ]);
    localClientAdapterConfiguration.registryIntegrityKey?.fill(0);
    zeroLocalClientOnboardingBackupKey(localClientOnboardingConfiguration);
    throw error;
  }
  let localClientManagementService;
  let localClientGovernedOnboardingRuntime;
  try {
    localClientManagementService = createLocalClientManagementService({
      env,
      repoRoot,
      adapterRegistry: localClientAdapterRegistry,
      executionReadiness: localClientExecutionReadiness,
      registryIntegrityKey: localClientAdapterConfiguration.registryIntegrityKey ?? undefined,
      epochStore: localClientAuthorityEpochStore ?? undefined,
      feedbackDedupStore: localClientFeedbackDedupStore ?? undefined,
      registryPath: env.AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH,
      executionLogPath: env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH,
      staleClientThresholdMs: env.AI_GATEWAY_LOCAL_CLIENT_STALE_THRESHOLD_MS,
      executionEnabled: env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED,
      discoveryHintsPath: env.AI_GATEWAY_LOCAL_CLIENT_DISCOVERY_HINTS_PATH,
      maxAlternatives: env.AI_GATEWAY_LOCAL_CLIENT_MAX_ALTERNATIVES,
    });
    localClientGovernedOnboardingRuntime = createLocalClientGovernedOnboardingRuntime({
      configuration: localClientOnboardingConfiguration,
      approvalGate: localClientExecutionControl.approvalGate,
      idempotencyCoordinator: toLocalClientOnboardingIdempotencyCoordinator(
        idempotencyCoordinator,
      ),
      externalEffectGate,
      receiptAuthorityStore: localClientOnboardingReceiptAuthorityStore,
    });
  } catch (error) {
    closeFailedLocalClientStartupResources([
      localClientAdapterConfiguration.popAuthorityRegistry,
      localClientAdapterConfiguration.receiptJournalRegistry,
      ...localClientAdapterConfiguration.probes,
      localClientAdapterRegistry,
      localClientManagementService,
      idempotencyCoordinator,
      localClientExecutionClaimStore,
      localClientRoutePlanStore,
      localClientExecutionControl,
      localClientOnboardingReceiptAuthorityStore,
      localClientExecutionFeedbackOutbox,
      localClientFeedbackDedupStore,
      localClientAuthorityEpochStore,
      agentGovernance?.registryStore,
      externalEffectGate,
      workforceExecutor,
      requestLogger,
      providerDispatchGate,
      mcpGatewayService,
      enterpriseGovernanceService,
    ]);
    zeroLocalClientOnboardingBackupKey(localClientOnboardingConfiguration);
    throw error;
  } finally {
    localClientAdapterConfiguration.registryIntegrityKey?.fill(0);
  }
  const localClientVerificationOwnership = localClientAdapterConfiguration.ownershipBindings.length > 0
    ? createLocalClientVerificationOwnershipGate({
      store: localClientManagementService.verificationStore,
      resolveVerifiedTarget: (input) => localClientManagementService.resolveVerifiedTarget(input),
      bindings: localClientAdapterConfiguration.ownershipBindings,
    })
    : null;
  const resolveConfiguredLocalClientTarget = localClientVerificationOwnership
    ? (input) => localClientVerificationOwnership.resolveVerifiedTarget(input)
    : (input) => localClientManagementService.resolveVerifiedTarget(input);
  const localClientProviderRuntimeRouter = createLocalClientProviderRuntimeRouter({
    providerRegistry,
    healthFacts: healthScorer,
    resolvePolicy: (input) => localClientProviderPolicyResolver.resolve(input),
    authorizeClient: resolveConfiguredLocalClientTarget,
  });
  const localClientVerificationService = createLocalClientVerificationService({
    store: localClientVerificationOwnership?.store ?? localClientManagementService.verificationStore,
    probes: localClientVerificationProbes,
    maxEvidenceTtlMs: localClientAdapterConfiguration.maxVerificationTtlMs,
  });
  const localClientPopHttpAuth = localClientAdapterConfiguration.popAuthorityRegistry
    ? createLocalClientPopHttpAuth({
        authority: localClientAdapterConfiguration.popAuthorityRegistry,
        resolveVerifiedTarget: resolveConfiguredLocalClientTarget,
      })
    : null;
  const localClientRealProviderDispatchConfigured =
    config.aiGatewayService.realProviderEnabled === true
    && config.aiGatewayService.providerMode !== "fake";
  const readLocalClientManagedProtocolDispatchBlockers = () => {
    const popStatus = localClientAdapterConfiguration.popAuthorityRegistry?.status;
    return Object.freeze([
      ...(!localClientProtocolPrincipalConfiguration.enabled
        ? ["server_bound_protocol_principal_required"]
        : []),
      ...(localClientPopHttpAuth === null || popStatus?.available !== true
        ? ["pop_replay_guard_unavailable"]
        : []),
      ...(localClientMultiInstanceRequested
        ? ["distributed_pop_replay_guard_required"]
        : []),
      ...(localClientRealProviderDispatchConfigured && popStatus?.durableReplayProtection !== true
        ? ["durable_pop_replay_guard_required_for_real_provider"]
        : []),
      ...(localClientRealProviderDispatchConfigured && popStatus?.authenticatedReplaySet !== true
        ? ["authenticated_pop_replay_set_required_for_real_provider"]
        : []),
      ...(localClientRealProviderDispatchConfigured && popStatus?.snapshotRollbackProtected !== true
        ? ["rollback_resistant_pop_replay_guard_required_for_real_provider"]
        : []),
    ]);
  };
  const localClientManagedProtocolDispatchStatus = Object.freeze({
    get enabled() {
      return localClientPopHttpAuth !== null
        && localClientProtocolPrincipalConfiguration.enabled;
    },
    get ready() {
      return localClientPopHttpAuth !== null
        && localClientProtocolPrincipalConfiguration.enabled
        && readLocalClientManagedProtocolDispatchBlockers().length === 0;
    },
    fakeProviderOnly: !localClientRealProviderDispatchConfigured,
    realProviderConfigured: localClientRealProviderDispatchConfigured,
    multiInstance: localClientMultiInstanceRequested,
    get replayProtection() {
      return localClientAdapterConfiguration.popAuthorityRegistry?.status.replayMode ?? "disabled";
    },
    get durableReplayProtection() {
      return localClientAdapterConfiguration.popAuthorityRegistry?.status.durableReplayProtection === true;
    },
    get authenticatedReplaySet() {
      return localClientAdapterConfiguration.popAuthorityRegistry?.status.authenticatedReplaySet === true;
    },
    get snapshotRollbackProtected() {
      return localClientAdapterConfiguration.popAuthorityRegistry?.status.snapshotRollbackProtected === true;
    },
    get defensiveEnabled() {
      return localClientAdapterConfiguration.popAuthorityRegistry?.status.defensiveEnabled === true;
    },
    get capacityIsolatedByScope() {
      return localClientAdapterConfiguration.popAuthorityRegistry?.status.capacityIsolatedByScope === true;
    },
    principalBindingCount: localClientProtocolPrincipalConfiguration.bindings.length,
    get blockers() {
      return readLocalClientManagedProtocolDispatchBlockers();
    },
  });
  const localClientPopSnapshotRollbackProtectionStatus = Object.freeze({
    protocolCoreAvailable: true,
    configured: false,
    ready: false,
    snapshotRollbackProtected: false,
    nativeDeploymentVerified: false,
    blockers: LOCAL_CLIENT_POP_SNAPSHOT_ROLLBACK_NATIVE_DEPLOYMENT_BLOCKERS,
    boundaries: LOCAL_CLIENT_POP_SNAPSHOT_ROLLBACK_BOUNDARIES,
  });
  const localClientExecutionPreview = createLocalClientExecutionPreview({
    routePlanStore: localClientRoutePlanStore,
    adapterRegistry: localClientAdapterRegistry,
    resolveVerifiedTarget: resolveConfiguredLocalClientTarget,
  }, {
    policyVersion: "local-client-execution-policy-v1",
  });
  const unavailableFence = async () => {
    throw Object.assign(new Error("The local-client execution claim store is unavailable."), {
      code: "LOCAL_CLIENT_EXECUTION_CLAIM_UNAVAILABLE",
      category: "concurrency",
      statusCode: 503,
    });
  };
  const resolveExecutionTarget = ({ plan, identity }) => resolveConfiguredLocalClientTarget({
    identity,
    clientId: plan.clientId,
  });
  const acquireExecutionFence = localClientExecutionClaimStore
    ? createLocalClientVerifiedExecutionFence({
      acquireClaimFence: localClientExecutionClaimStore.acquireFence,
      resolveVerifiedTarget: resolveExecutionTarget,
      lifecycle: localClientExecutionControl.lifecycle,
    })
    : unavailableFence;
  const localClientAggregateFeedbackSink = localClientFeedbackDedupStore
    ? {
        async record(input, scope) {
          const result = await localClientManagementService.feedback(input, scope);
          if (
            result?.deduplication?.mode !== "sqlite-feedback-dedup"
            || result?.deduplication?.exactlyOnce !== true
            || typeof result?.deduplication?.replayed !== "boolean"
          ) {
            throw Object.assign(new Error("Exactly-once local-client feedback was not confirmed."), {
              code: "LOCAL_CLIENT_AUTOMATIC_FEEDBACK_NOT_CONFIRMED",
            });
          }
          return Object.freeze({
            persisted: true,
            exactlyOnce: true,
            replayed: result.deduplication.replayed,
          });
        },
      }
    : null;
  const localClientExecutionFeedbackDispatcher =
    createConfiguredLocalClientExecutionFeedbackDispatcher(
      env,
      localClientExecutionFeedbackOutbox,
      localClientAggregateFeedbackSink,
    );
  const localClientExecutionReceiptRecoveryService =
    localClientAdapterConfiguration.receiptJournalRegistry
      && localClientExecutionFeedbackDispatcher
      ? createLocalClientExecutionReceiptRecoveryService({
          receiptRegistry: localClientAdapterConfiguration.receiptJournalRegistry,
          adapterRegistry: localClientAdapterRegistry,
          resolveVerifiedTarget: ({ tenantId, subjectId, clientId }) => (
            resolveConfiguredLocalClientTarget({
              identity: { tenantId, subjectId },
              clientId,
            })
          ),
          feedbackSink: localClientExecutionFeedbackDispatcher,
          lifecycle: localClientExecutionControl.lifecycle,
          intervalMs: readStrictLocalClientReceiptReconciliationInteger(
            env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_INTERVAL_MS,
            5_000,
            100,
            60 * 60_000,
            "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_INTERVAL_MS",
          ),
          batchSize: readStrictLocalClientReceiptReconciliationInteger(
            env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_BATCH_SIZE,
            32,
            1,
            1_000,
            "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_BATCH_SIZE",
          ),
          recoveryGraceMs: readStrictLocalClientReceiptReconciliationInteger(
            env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_GRACE_MS,
            120_000,
            0,
            24 * 60 * 60_000,
            "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_GRACE_MS",
          ),
        })
      : null;
  const localClientExecutionOrchestrator = createLocalClientExecutionOrchestrator({
    routePlanStore: localClientRoutePlanStore,
    approvalGate: localClientExecutionControl.approvalGate,
    lifecycle: localClientExecutionControl.lifecycle,
    externalEffectGate,
    adapterRegistry: localClientAdapterRegistry,
    resolveVerifiedTarget: resolveExecutionTarget,
    acquireFence: acquireExecutionFence,
    resolveReceiptJournal: ({ plan, identity }) => (
      localClientAdapterConfiguration.receiptJournalRegistry?.resolve({
        tenantId: identity.tenantId,
        clientId: plan.clientId,
      }) ?? null
    ),
    feedbackSink: localClientExecutionFeedbackDispatcher
      ?? localClientAggregateFeedbackSink
      ?? undefined,
  });
  const localClientExecutionIdempotency = createLocalClientExecutionIdempotencyCoordinator({
    idempotencyCoordinator: idempotencyCoordinator ?? createDisabledLocalClientIdempotencyCoordinator(),
    routePlanStore: localClientRoutePlanStore,
    orchestrator: localClientExecutionOrchestrator,
  }, {
    executionRequested: localClientExecutionRequested,
  });
  const localClientGovernedExecutionApi = createLocalClientGovernedExecutionApi({
    executionPreview: localClientExecutionPreview,
    routePlanStore: localClientRoutePlanStore,
    approvalGate: localClientExecutionControl.approvalGate,
    executionIdempotency: localClientExecutionIdempotency,
    orchestrator: localClientExecutionOrchestrator,
  });
  const localClientSmartManagementScheduler = localClientSmartManagementSchedulerConfiguration.enabled
    ? new LocalClientSmartManagementScheduler({
        managementApi: {
          async smartManage(input) {
            if (input.dryRun !== true) {
              throw Object.assign(new Error("Scheduled local-client management is dry-run only."), {
                code: "LOCAL_CLIENT_SMART_MANAGEMENT_AUTOMATIC_APPLY_DENIED",
              });
            }
            return localClientManagementService.smartManage({
              dryRun: true,
              signal: input.signal,
            }, {
              tenantId: input.tenantId,
              userId: input.subjectId,
            });
          },
        },
        tenantProvider: {
          async listTenants(signal) {
            if (signal?.aborted) {
              throw Object.assign(new Error("Scheduled local-client management was cancelled."), {
                code: "LOCAL_CLIENT_SMART_MANAGEMENT_CANCELLED",
              });
            }
            return localClientSmartManagementSchedulerConfiguration.tenants;
          },
        },
        ...localClientSmartManagementSchedulerConfiguration.schedulerOptions,
      })
    : null;
  localClientExecutionFeedbackDispatcher?.start();
  localClientExecutionReceiptRecoveryService?.start();
  localClientSmartManagementScheduler?.start();
  const codexExecCrsRuntimeCandidate = createCodexExecCrsRuntimeCandidate({
    repoRoot,
  });
  const fiveCapabilityActivationService = createFiveCapabilityActivationService({
    repoRoot,
    workforceService,
    workforceExecutor,
  });

  return {
    agentGovernance,
    agentExecWorkingDirectory,
    auditHashChain: enterpriseGovernanceService.getAuditHashChain(),
    capabilityRouterService,
    contentGuardrails,
    codexExecCrsRuntimeCandidate,
    config,
    enterpriseGovernanceService,
    enterpriseOpsService,
    localClientAdapterRegistry,
    localClientLoopbackAdapterStatus: localClientAdapterConfiguration.status,
    localClientPopIdentityAuthority: localClientAdapterConfiguration.popAuthorityRegistry,
    localClientExecutionReceiptJournalRegistry:
      localClientAdapterConfiguration.receiptJournalRegistry,
    get localClientExecutionReceiptJournalStatus() {
      return localClientAdapterConfiguration.receiptJournalRegistry?.status
        ?? Object.freeze({
          enabled: false,
          available: false,
          durable: false,
          distributed: false,
          singleHost: true,
          bindingCount: 0,
          recoveryContextEncrypted: false,
          snapshotRollbackProtected: false,
          clientAtomicEffectReceiptVerified: false,
        });
    },
    localClientExecutionReceiptRecoveryService,
    get localClientExecutionReceiptRecoveryStatus() {
      return localClientExecutionReceiptRecoveryService?.status
        ?? Object.freeze({
          enabled: false,
          available: false,
          lifecycle: "disabled",
          executionRedispatchAllowed: false,
          runInFlight: false,
          runCount: 0,
          resolvedCount: 0,
          unresolvedCount: 0,
          failureCount: 0,
          consecutiveFailureCount: 0,
          lastErrorCode: null,
          lastRunSucceeded: null,
          lastSuccessAt: null,
          lastRunAt: null,
        });
    },
    localClientPopHttpAuth,
    localClientManagedProtocolDispatchStatus,
    localClientPopSnapshotRollbackProtectionStatus,
    localClientProtocolPrincipalResolver: localClientProtocolPrincipalConfiguration,
    localClientProtocolPrincipalStatus: localClientProtocolPrincipalConfiguration.status,
    get localClientPopIdentityStatus() {
      return localClientAdapterConfiguration.popAuthorityRegistry?.status
        ?? Object.freeze({
        enabled: false,
        available: false,
        bindingCount: 0,
        replayMode: "disabled",
        durableReplayProtection: false,
        distributedReplayProtection: false,
        authenticatedReplaySet: false,
        snapshotRollbackProtected: false,
        defensiveEnabled: false,
        perClientDerivedKeys: false,
        exactRawBodyBinding: true,
        bearerProofAloneGrantsAuthority: false,
        });
    },
    localClientVerificationOwnershipStatus: localClientVerificationOwnership?.status ?? Object.freeze({
      bindingCount: 0,
      tenantCount: 0,
      clientCount: 0,
      requestBodyOwnershipAccepted: false,
    }),
    localClientExecutionReadiness,
    localClientExecutionControl,
    localClientExecutionClaimStore,
    localClientOnboardingReceiptAuthorityStore,
    get localClientOnboardingReceiptAuthorityStatus() {
      return localClientOnboardingReceiptAuthorityStore?.status
        ?? Object.freeze({
        mode: "disabled",
        storageMode: "disabled",
        available: false,
        durable: false,
        distributed: false,
        oneTimeRollbackAuthorization: false,
        });
    },
    localClientFeedbackDedupStore,
    get localClientFeedbackDedupStatus() {
      return localClientFeedbackDedupStore?.status ?? Object.freeze({
        mode: "disabled",
        storageMode: "disabled",
        available: false,
        durable: false,
        distributed: false,
        singleHost: true,
      });
    },
    localClientExecutionFeedbackOutbox,
    get localClientExecutionFeedbackOutboxStatus() {
      return localClientExecutionFeedbackOutbox?.status
        ?? Object.freeze({
        mode: "disabled",
        storageMode: "disabled",
        available: false,
        durable: false,
        distributed: false,
        singleHost: true,
        });
    },
    localClientExecutionFeedbackDispatcher,
    get localClientExecutionFeedbackDispatcherStatus() {
      return localClientExecutionFeedbackDispatcher?.status
        ?? Object.freeze({
        enabled: false,
        available: false,
        lifecycle: "disabled",
        });
    },
    localClientAuthorityEpochStore,
    localClientExecutionPreview,
    localClientExecutionOrchestrator,
    localClientExecutionIdempotency,
    localClientGovernedExecutionApi,
    localClientSmartManagementScheduler,
    localClientSmartManagementSchedulerStatus: localClientSmartManagementScheduler?.getStatus()
      ?? localClientSmartManagementSchedulerConfiguration.status,
    localClientGovernedOnboardingRuntime,
    localClientGovernedOnboardingApi: localClientGovernedOnboardingRuntime.api,
    localClientGovernedOnboardingStatus: localClientGovernedOnboardingRuntime.getStatus(),
    localClientVerificationService,
    idempotencyCoordinator,
    localClientRoutePlanStore,
    localClientManagementService,
    localClientProviderPolicyResolver,
    localClientProviderRuntimeRouter,
    externalEffectGate,
    fiveCapabilityActivationService,
    gatewayService,
    healthScorer,
    knowledgeInfra,
    knowledgeService,
    mcpGatewayService,
    modelImportService,
    modelLibraryStore,
    providerConfigRoutes,
    providerDispatchGate,
    providerKeyConfigStore,
    providerRegistry,
    providerStatementReconciliationService,
    responseSessionStore,
    runtimeEnv: env,
    runtimeCredentialStore,
    requestLogger,
    userExperienceService,
    workforceExecutor,
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

function closeFailedLocalClientStartupResources(resources) {
  for (const resource of resources) {
    try {
      Promise.resolve(resource?.close?.()).catch(() => undefined);
    } catch {
      // Preserve the original fail-closed startup error.
    }
  }
}

function resolveExternalEffectEnabled(env, localClientOnboardingEnabled = false) {
  const configured = String(env.AI_GATEWAY_EXTERNAL_EFFECT_ENABLED ?? "").trim().toLowerCase();
  if (configured && !new Set(["true", "1", "false", "0"]).has(configured)) {
    throw new Error("AI_GATEWAY_EXTERNAL_EFFECT_ENABLED must be true or false when configured.");
  }
  return configured === "true"
    || configured === "1"
    || localClientOnboardingEnabled === true
    || String(env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED ?? "").trim().toLowerCase() === "true"
    || String(env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED ?? "").trim() === "1"
    || Boolean(String(env.FEISHU_WEBHOOK_URL ?? "").trim())
    || Boolean(String(env.WECOM_WEBHOOK_URL ?? "").trim())
    || hasConfiguredMcpUpstreams(env.MCP_UPSTREAM_SERVERS_JSON);
}

const SUPPORTED_AGENT_GOVERNANCE_HIGH_RISK_TOOLS = new Set(["git_push", "git_create_pr"]);

function resolveAgentGovernanceRuntimeConfiguration(env) {
  const setting = String(env.AI_GATEWAY_AGENT_GOVERNANCE_ENABLED ?? "").trim().toLowerCase();
  if (setting && setting !== "true" && setting !== "false") {
    const error = new Error("AI_GATEWAY_AGENT_GOVERNANCE_ENABLED must be true or false when configured.");
    error.code = "AGENT_GOVERNANCE_CONFIGURATION_INVALID";
    error.category = "configuration";
    throw error;
  }
  const multiRaw = String(env.AI_GATEWAY_MULTI_INSTANCE ?? "").trim().toLowerCase();
  if (multiRaw && !new Set(["true", "1", "false", "0"]).has(multiRaw)) {
    const error = new Error("AI_GATEWAY_MULTI_INSTANCE must be true or false when configured.");
    error.code = "AGENT_GOVERNANCE_CONFIGURATION_INVALID";
    error.category = "configuration";
    throw error;
  }
  const multiInstance = multiRaw === "true" || multiRaw === "1";
  // Governance changes the contract of execution-bearing routes (Agent Exec,
  // reverse MCP, controlled Workforce and Forge). Keep it an explicit opt-in
  // so an upgrade cannot silently turn existing legacy callers into governed
  // callers that suddenly require a server-issued agentId.
  const enabled = setting === "true";
  const configuredTools = String(env.AI_GATEWAY_AGENT_GOVERNANCE_HIGH_RISK_TOOLS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const highRiskTools = Object.freeze(Array.from(new Set(configuredTools)));
  const unknown = highRiskTools.filter((toolName) => !SUPPORTED_AGENT_GOVERNANCE_HIGH_RISK_TOOLS.has(toolName));
  if (unknown.length > 0) {
    const error = new Error(`Unsupported Agent Governance high-risk tool(s): ${unknown.join(", ")}.`);
    error.code = "AGENT_GOVERNANCE_HIGH_RISK_TOOL_UNSUPPORTED";
    error.category = "configuration";
    throw error;
  }
  if (highRiskTools.length > 0 && !enabled) {
    const error = new Error("High-risk Agent tools require Agent Governance to be enabled.");
    error.code = "AGENT_GOVERNANCE_HIGH_RISK_REQUIRES_GOVERNANCE";
    error.category = "configuration";
    throw error;
  }
  if (enabled && multiInstance) {
    const error = new Error(
      "Agent Governance requires a transactional shared-state backend before multi-instance mode can be enabled.",
    );
    error.code = "AGENT_GOVERNANCE_MULTI_INSTANCE_UNSUPPORTED";
    error.category = "configuration";
    throw error;
  }
  const proposerSetting = String(
    env.AI_GATEWAY_AGENT_GOVERNANCE_MODEL_PROPOSER_ENABLED ?? "",
  ).trim().toLowerCase();
  if (proposerSetting && proposerSetting !== "true" && proposerSetting !== "false") {
    const error = new Error(
      "AI_GATEWAY_AGENT_GOVERNANCE_MODEL_PROPOSER_ENABLED must be true or false when configured.",
    );
    error.code = "AGENT_GOVERNANCE_CONFIGURATION_INVALID";
    error.category = "configuration";
    throw error;
  }
  const modelProposerEnabled = proposerSetting === "true";
  if (modelProposerEnabled && !enabled) {
    const error = new Error("Agent model proposal requires Agent Governance to be enabled.");
    error.code = "AGENT_GOVERNANCE_MODEL_PROPOSER_REQUIRES_GOVERNANCE";
    error.category = "configuration";
    throw error;
  }
  const proposerProviderId = String(
    env.AI_GATEWAY_AGENT_GOVERNANCE_MODEL_PROPOSER_PROVIDER_ID ?? "",
  ).trim();
  const proposerModelId = String(
    env.AI_GATEWAY_AGENT_GOVERNANCE_MODEL_PROPOSER_MODEL_ID ?? "",
  ).trim();
  if (modelProposerEnabled && !proposerProviderId) {
    const error = new Error(
      "AI_GATEWAY_AGENT_GOVERNANCE_MODEL_PROPOSER_PROVIDER_ID is required when model proposal is enabled.",
    );
    error.code = "AGENT_GOVERNANCE_MODEL_PROPOSER_PROVIDER_REQUIRED";
    error.category = "configuration";
    throw error;
  }
  return Object.freeze({
    enabled,
    multiInstance,
    highRiskTools,
    healthCheckIntervalMs: strictRegistryInteger(
      env.AI_GATEWAY_AGENT_GOVERNANCE_HEALTH_CHECK_INTERVAL_MS,
      60_000,
      1_000,
      300_000,
      "AI_GATEWAY_AGENT_GOVERNANCE_HEALTH_CHECK_INTERVAL_MS",
    ),
    modelProposer: Object.freeze({
      enabled: modelProposerEnabled,
      providerId: proposerProviderId,
      modelId: proposerModelId || undefined,
    }),
  });
}

function resolveAgentGovernanceRegistryConfiguration(env, repositoryRoot, dataDir) {
  const mode = String(
    env.AI_GATEWAY_AGENT_GOVERNANCE_REGISTRY_STORE_MODE ?? "json",
  ).trim().toLowerCase();
  if (mode !== "json" && mode !== "sqlite" && mode !== "postgres") {
    const error = new Error(
      "AI_GATEWAY_AGENT_GOVERNANCE_REGISTRY_STORE_MODE must be json, sqlite, or postgres.",
    );
    error.code = "AGENT_GOVERNANCE_REGISTRY_CONFIGURATION_INVALID";
    error.category = "configuration";
    throw error;
  }
  if (mode !== "json") {
    const error = new Error(
      `${mode} Agent Registry is implemented but not promoted: rollback and external authority anchoring are not proven.`,
    );
    error.code = "AGENT_GOVERNANCE_REGISTRY_BACKEND_UNPROMOTED";
    error.category = "configuration";
    throw error;
  }
  const postgresConfigured = [
    "AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_URL",
    "AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_URL_FILE",
    "AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_NAMESPACE",
    "AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_TLS_REQUIRED",
    "AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_POOL_MAX",
    "AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_STATEMENT_TIMEOUT_MS",
  ].some((name) => String(env[name] ?? "").trim() !== "");
  if (postgresConfigured) {
    const error = new Error(
      "PostgreSQL Agent Registry configuration is present, but that authority is not promoted for runtime use.",
    );
    error.code = "AGENT_GOVERNANCE_REGISTRY_BACKEND_UNPROMOTED";
    error.category = "configuration";
    throw error;
  }
  const configuredPath = String(env.AI_GATEWAY_AGENT_GOVERNANCE_SQLITE_PATH ?? "").trim();
  const sqlitePath = configuredPath
    ? (isAbsolute(configuredPath) ? configuredPath : resolve(repositoryRoot, configuredPath))
    : resolve(dataDir, "agent-registry.sqlite");
  const sqliteConfigured = configuredPath
    || String(env.AI_GATEWAY_AGENT_GOVERNANCE_HOST_ID ?? "").trim()
    || String(env.AI_GATEWAY_AGENT_GOVERNANCE_SQLITE_BUSY_TIMEOUT_MS ?? "").trim();
  if (sqliteConfigured || existsSync(sqlitePath)) {
    const error = new Error(
      "SQLite Agent Registry artifacts/configuration are present, but that authority is not promoted for runtime use.",
    );
    error.code = "AGENT_GOVERNANCE_REGISTRY_BACKEND_UNPROMOTED";
    error.category = "configuration";
    throw error;
  }
  return Object.freeze({ mode: "json", authorityBinding: "signed-json-v1" });
}

function strictRegistryInteger(value, fallback, minimum, maximum, name) {
  const raw = String(value ?? "").trim();
  const parsed = raw ? Number(raw) : fallback;
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    const error = new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
    error.code = "AGENT_GOVERNANCE_REGISTRY_CONFIGURATION_INVALID";
    error.category = "configuration";
    throw error;
  }
  return parsed;
}

function resolveAgentExecWorkingDirectory(env) {
  const configured = String(env.AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY ?? "").trim();
  const candidate = configured
    ? (isAbsolute(configured) ? configured : resolve(repoRoot, configured))
    : repoRoot;
  try {
    const stats = lstatSync(candidate);
    if (!stats.isDirectory()) throw new Error("not a directory");
    return realpathSync.native(candidate);
  } catch (cause) {
    const error = new Error("AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY must resolve to an existing directory.");
    error.code = "AGENT_EXEC_WORKING_DIRECTORY_INVALID";
    error.category = "configuration";
    error.cause = cause;
    throw error;
  }
}

function toLocalClientIdempotencyReadinessStatus(coordinator) {
  if (!coordinator) return null;
  const snapshot = coordinator.getStats();
  const storeMode = snapshot.storeMode;
  return Object.freeze({
    mode: storeMode,
    storageMode: storeMode,
    available: snapshot.available !== false,
    durable: storeMode === "sqlite" || storeMode === "postgres",
    distributed: storeMode === "postgres",
  });
}

function toLocalClientOnboardingIdempotencyCoordinator(coordinator) {
  if (!coordinator) return null;
  return Object.freeze({
    execute: (input) => coordinator.execute(input),
    getStats: () => coordinator.getStats(),
    checkHealth: async () => (
      typeof coordinator.checkHealth === "function"
        ? coordinator.checkHealth()
        : coordinator.getStats()
    ),
  });
}

function createDisabledLocalClientIdempotencyCoordinator() {
  const stats = Object.freeze({
    entries: 0,
    inFlight: 0,
    replayable: 0,
    tombstones: 0,
    ttlMs: 0,
    maxEntries: 0,
    maxResultBytes: 0,
    storeMode: "memory",
    available: true,
    distributed: false,
    statsUpdatedAt: null,
  });
  return Object.freeze({
    async execute() {
      throw Object.assign(new Error("Local-client execution idempotency is disabled."), {
        code: "LOCAL_CLIENT_EXECUTION_DISABLED",
      });
    },
    getStats: () => stats,
    checkHealth: async () => stats,
  });
}

function createConfiguredLocalClientPopReplayGuard(env, registryIntegrityKey) {
  const mode = readLocalClientPopReplayStoreMode(env);
  if (mode === "memory") return null;
  if (!(registryIntegrityKey instanceof Uint8Array)) {
    throw localClientPopReplayConfigError(
      "INTEGRITY_KEY_REQUIRED",
      "SQLite PoP replay protection requires authenticated local-client adapter material.",
    );
  }
  const dedicatedKey = createHmac("sha256", registryIntegrityKey)
    .update("local-client-pop-replay-integrity-key-v1")
    .digest();
  try {
    const maxEntries = readStrictLocalClientPopReplayInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES,
      10_000,
      1,
      1_000_000,
      "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES",
    );
    const configuredPerScope = String(
      env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES_PER_SCOPE ?? "",
    ).trim();
    return createLocalClientSqlitePopReplayGuard({
      sqlitePath: resolveLocalClientPopReplayPath(
        env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH,
      ),
      hostId: requireLocalClientPopReplayHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID),
      integrityKey: dedicatedKey,
      namespace: readLocalClientPopReplayNamespace(
        env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_NAMESPACE,
      ),
      maxEntries,
      ...(configuredPerScope
        ? {
            maxEntriesPerScope: readStrictLocalClientPopReplayInteger(
              configuredPerScope,
              1,
              1,
              maxEntries,
              "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES_PER_SCOPE",
            ),
          }
        : {}),
      busyTimeoutMs: readStrictLocalClientPopReplayInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_BUSY_TIMEOUT_MS,
        5_000,
        100,
        30_000,
        "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_BUSY_TIMEOUT_MS",
      ),
    });
  } finally {
    dedicatedKey.fill(0);
  }
}

function readLocalClientPopReplayStoreMode(env) {
  const mode = String(
    env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_STORE_MODE ?? "memory",
  ).trim().toLowerCase();
  if (mode !== "memory" && mode !== "sqlite") {
    throw localClientPopReplayConfigError(
      "STORE_MODE_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_STORE_MODE must be memory or sqlite.",
    );
  }
  return mode;
}

function resolveLocalClientPopReplayPath(value) {
  const path = String(value ?? "");
  if (
    !path.trim()
    || path !== path.trim()
    || path.length > 4_096
    || path === ":memory:"
    || path.startsWith("\\\\")
    || path.startsWith("//")
    || /[\u0000-\u001f\u007f]/u.test(path)
  ) {
    throw localClientPopReplayConfigError(
      "SQLITE_PATH_REQUIRED",
      "SQLite PoP replay protection requires an explicit bounded local database path.",
    );
  }
  const absolute = resolve(repoRoot, path);
  if (absolute.startsWith("\\\\") || absolute.startsWith("//")) {
    throw localClientPopReplayConfigError(
      "SQLITE_PATH_INVALID",
      "The PoP replay SQLite path must remain on this host.",
    );
  }
  return absolute;
}

function requireLocalClientPopReplayHostId(value) {
  const hostId = String(value ?? "").trim();
  if (
    hostId.length < 8
    || hostId.length > 256
    || /[\u0000-\u001f\u007f]/u.test(hostId)
  ) {
    throw localClientPopReplayConfigError(
      "HOST_ID_REQUIRED",
      "SQLite PoP replay protection requires AI_GATEWAY_LOCAL_CLIENT_HOST_ID.",
    );
  }
  return hostId;
}

function readLocalClientPopReplayNamespace(value) {
  const namespace = String(value ?? "local-client-pop-replay").trim();
  if (!/^[a-z][a-z0-9._-]{0,127}$/u.test(namespace)) {
    throw localClientPopReplayConfigError(
      "CONFIG_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_NAMESPACE must be a portable identifier.",
    );
  }
  return namespace;
}

function readStrictLocalClientPopReplayInteger(value, fallback, minimum, maximum, name) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim();
  if (!/^(?:0|[1-9][0-9]*)$/u.test(normalized)) {
    throw localClientPopReplayConfigError("CONFIG_INVALID", `${name} must be a bounded integer.`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw localClientPopReplayConfigError("CONFIG_INVALID", `${name} must be a bounded integer.`);
  }
  return parsed;
}

function localClientPopReplayConfigError(reason, message) {
  return Object.assign(new Error(message), {
    code: `LOCAL_CLIENT_POP_REPLAY_${reason}`,
    category: "configuration",
    statusCode: 503,
  });
}

function createConfiguredLocalClientReceiptJournal({
  env,
  entry,
  sharedSecret,
  registryIntegrityKey,
}) {
  const directory = resolveLocalClientReceiptReconciliationDirectory(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIR,
  );
  const bindingDigest = createHmac("sha256", registryIntegrityKey)
    .update("local-client-receipt-journal-file-v1\0", "utf8")
    .update(entry.tenantId, "utf8")
    .update("\0", "utf8")
    .update(entry.clientId, "utf8")
    .digest("hex");
  const keyContext = `${entry.tenantId}\0${entry.clientId}`;
  const deriveSharedProtocolKey = (domain) => createHmac("sha256", sharedSecret)
    .update(`${domain}\0`, "utf8")
    .update(keyContext, "utf8")
    .digest();
  const deriveGatewayAuthorityKey = (domain) => createHmac("sha256", registryIntegrityKey)
    .update(`${domain}\0`, "utf8")
    .update(keyContext, "utf8")
    .digest();
  // Only the wire-protocol key is shared with the managed client. Gateway
  // journal integrity and encrypted recovery context remain under the
  // gateway-only registry authority so a client cannot forge or decrypt the
  // gateway's restart state even when both processes run as the same user.
  const integrityKey = deriveGatewayAuthorityKey(
    "local-client-gateway-receipt-journal-integrity-v2",
  );
  const protocolKey = deriveSharedProtocolKey(
    LOCAL_CLIENT_RECEIPT_RECONCILIATION_KEY_DERIVATION_DOMAIN,
  );
  const recoveryEncryptionKey = deriveGatewayAuthorityKey(
    "local-client-gateway-receipt-recovery-encryption-v2",
  );
  try {
    return createLocalClientSqliteExecutionReceiptJournal({
      sqlitePath: join(directory, `${bindingDigest}.sqlite`),
      role: "gateway",
      hostId: requireLocalClientReceiptReconciliationHostId(
        env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID,
      ),
      integrityKey,
      protocolKey,
      recoveryEncryptionKey,
      namespace: readLocalClientReceiptReconciliationNamespace(
        env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_NAMESPACE,
      ),
      maxEntries: readStrictLocalClientReceiptReconciliationInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_MAX_ENTRIES,
        2_000,
        1,
        100_000,
        "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_MAX_ENTRIES",
      ),
      retentionMs: readStrictLocalClientReceiptReconciliationInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_RETENTION_MS,
        7 * 24 * 60 * 60_000,
        1_000,
        365 * 24 * 60 * 60_000,
        "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_RETENTION_MS",
      ),
      intentTtlMs: readStrictLocalClientReceiptReconciliationInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_INTENT_TTL_MS,
        60_000,
        1_000,
        10 * 60_000,
        "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_INTENT_TTL_MS",
      ),
      queryTtlMs: readStrictLocalClientReceiptReconciliationInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_QUERY_TTL_MS,
        30_000,
        1_000,
        60_000,
        "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_QUERY_TTL_MS",
      ),
      allowedClockSkewMs: readStrictLocalClientReceiptReconciliationInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_CLOCK_SKEW_MS,
        5_000,
        0,
        60_000,
        "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_CLOCK_SKEW_MS",
      ),
      busyTimeoutMs: readStrictLocalClientReceiptReconciliationInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_BUSY_TIMEOUT_MS,
        5_000,
        100,
        30_000,
        "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_BUSY_TIMEOUT_MS",
      ),
    });
  } finally {
    integrityKey.fill(0);
    protocolKey.fill(0);
    recoveryEncryptionKey.fill(0);
  }
}

function readLocalClientReceiptReconciliationStoreMode(env) {
  const mode = String(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_STORE_MODE ?? "disabled",
  ).trim().toLowerCase();
  if (mode !== "disabled" && mode !== "sqlite") {
    throw localClientReceiptReconciliationConfigError(
      "STORE_MODE_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_STORE_MODE must be disabled or sqlite.",
    );
  }
  return mode;
}

function resolveLocalClientReceiptReconciliationDirectory(value) {
  const path = String(value ?? "");
  if (
    !path.trim()
    || path !== path.trim()
    || path.length > 4_096
    || path.startsWith("\\\\")
    || path.startsWith("//")
    || /[\u0000-\u001f\u007f]/u.test(path)
  ) throw localClientReceiptReconciliationConfigError(
    "DIRECTORY_REQUIRED",
    "Receipt reconciliation requires an explicit bounded local directory.",
  );
  const absolute = resolve(repoRoot, path);
  const filesystemRoot = resolve(parse(absolute).root);
  if (
    normalizeLocalClientReceiptPath(absolute) === normalizeLocalClientReceiptPath(repoRoot)
    || normalizeLocalClientReceiptPath(absolute) === normalizeLocalClientReceiptPath(filesystemRoot)
    || absolute.startsWith("\\\\")
    || absolute.startsWith("//")
  ) {
    throw localClientReceiptReconciliationConfigError(
      "DIRECTORY_INVALID",
      "The receipt reconciliation directory must be a scoped local subdirectory.",
    );
  }
  try {
    const info = lstatSync(absolute, { throwIfNoEntry: false });
    if (info && (!info.isDirectory() || info.isSymbolicLink())) {
      throw localClientReceiptReconciliationConfigError(
        "DIRECTORY_INVALID",
        "The receipt reconciliation directory cannot be a file or reparse link.",
      );
    }
  } catch (error) {
    if (error?.code?.startsWith?.("LOCAL_CLIENT_RECEIPT_RECONCILIATION_")) throw error;
    if (error?.code !== "ENOENT") {
      throw localClientReceiptReconciliationConfigError(
        "DIRECTORY_INVALID",
        "The receipt reconciliation directory could not be verified.",
      );
    }
  }
  return absolute;
}

function normalizeLocalClientReceiptPath(value) {
  const absolute = resolve(value);
  return process.platform === "win32" ? absolute.toLowerCase() : absolute;
}

function localClientReceiptPathsConflict(left, right) {
  const leftPath = normalizeLocalClientReceiptPath(left);
  const rightPath = normalizeLocalClientReceiptPath(right);
  return leftPath === rightPath
    || leftPath.startsWith(`${rightPath}${sep}`)
    || rightPath.startsWith(`${leftPath}${sep}`);
}

function requireLocalClientReceiptReconciliationHostId(value) {
  const hostId = String(value ?? "").trim();
  if (hostId.length < 8 || hostId.length > 256 || /[\u0000-\u001f\u007f]/u.test(hostId)) {
    throw localClientReceiptReconciliationConfigError(
      "HOST_ID_REQUIRED",
      "Receipt reconciliation requires AI_GATEWAY_LOCAL_CLIENT_HOST_ID.",
    );
  }
  return hostId;
}

function readLocalClientReceiptReconciliationNamespace(value) {
  const namespace = String(value ?? "local-client-execution-receipts").trim();
  if (!/^[a-z][a-z0-9._-]{0,127}$/u.test(namespace)) {
    throw localClientReceiptReconciliationConfigError(
      "CONFIG_INVALID",
      "Receipt reconciliation namespace must be a portable identifier.",
    );
  }
  return namespace;
}

function readStrictLocalClientReceiptReconciliationInteger(value, fallback, minimum, maximum, name) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim();
  if (!/^(?:0|[1-9][0-9]*)$/u.test(normalized)) {
    throw localClientReceiptReconciliationConfigError("CONFIG_INVALID", `${name} must be bounded.`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw localClientReceiptReconciliationConfigError("CONFIG_INVALID", `${name} must be bounded.`);
  }
  return parsed;
}

function localClientReceiptReconciliationConfigError(reason, message) {
  return Object.assign(new Error(message), {
    code: `LOCAL_CLIENT_RECEIPT_RECONCILIATION_${reason}`,
    category: "configuration",
    statusCode: 503,
  });
}

function projectLocalClientReceiptJournalReadinessStatus(status, fixtureCapability) {
  if (!fixtureCapability || status === null) return status;
  return Object.freeze({
    ...status,
    // Synthetic values exercise downstream HTTP orchestration only. The
    // application's public journal status remains false for both claims, and
    // this projection is reachable only through the private Vitest capability,
    // never through runtime environment or a public request.
    snapshotRollbackProtected: true,
    clientAtomicEffectReceiptVerified: true,
  });
}

function hasConfiguredMcpUpstreams(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

function readBoundedNumber(value, fallback, minimum, maximum) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function createConfiguredLocalClientFeedbackDedupStore(env, registryIntegrityKey) {
  const mode = readLocalClientFeedbackDedupStoreMode(env);
  if (mode === "disabled") return null;
  if (!(registryIntegrityKey instanceof Uint8Array)) {
    throw localClientFeedbackDedupConfigError(
      "INTEGRITY_KEY_REQUIRED",
      "The feedback dedup store requires a dedicated key derived from authenticated local-client adapter material.",
    );
  }
  const dedicatedKey = createHmac("sha256", registryIntegrityKey)
    .update("local-client-feedback-dedup-key-v1")
    .digest();
  try {
    return createLocalClientSqliteFeedbackDedupStore({
      sqlitePath: resolveLocalClientFeedbackDedupPath(
        env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH,
      ),
      hostId: requireLocalClientFeedbackDedupHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID),
      integrityKey: dedicatedKey,
      namespace: readLocalClientFeedbackDedupNamespace(
        env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_NAMESPACE,
      ),
      ttlMs: readStrictLocalClientFeedbackDedupInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_TTL_MS,
        7 * 24 * 60 * 60_000,
        10,
        90 * 24 * 60 * 60_000,
        "AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_TTL_MS",
      ),
      leaseTtlMs: readStrictLocalClientFeedbackDedupInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_LEASE_TTL_MS,
        30_000,
        10,
        60 * 60_000,
        "AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_LEASE_TTL_MS",
      ),
      maxEvents: readStrictLocalClientFeedbackDedupInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_MAX_EVENTS,
        50_000,
        1,
        1_000_000,
        "AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_MAX_EVENTS",
      ),
      busyTimeoutMs: readStrictLocalClientFeedbackDedupInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_BUSY_TIMEOUT_MS,
        5_000,
        100,
        30_000,
        "AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_BUSY_TIMEOUT_MS",
      ),
    });
  } finally {
    dedicatedKey.fill(0);
  }
}

function readLocalClientFeedbackDedupStoreMode(env) {
  const mode = String(
    env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_STORE_MODE ?? "disabled",
  ).trim().toLowerCase();
  if (mode !== "disabled" && mode !== "sqlite") {
    throw localClientFeedbackDedupConfigError(
      "STORE_MODE_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_STORE_MODE must be disabled or sqlite.",
    );
  }
  return mode;
}

function resolveLocalClientFeedbackDedupPath(value) {
  const path = String(value ?? "");
  if (
    !path.trim()
    || path !== path.trim()
    || path.length > 4_096
    || path === ":memory:"
    || path.startsWith("\\\\")
    || path.startsWith("//")
    || /[\u0000-\u001f\u007f]/u.test(path)
  ) {
    throw localClientFeedbackDedupConfigError(
      "SQLITE_PATH_REQUIRED",
      "SQLite feedback dedup requires an explicit bounded local database path.",
    );
  }
  const absolute = resolve(repoRoot, path);
  if (absolute.startsWith("\\\\") || absolute.startsWith("//")) {
    throw localClientFeedbackDedupConfigError(
      "SQLITE_PATH_INVALID",
      "The feedback dedup SQLite path must remain on this host.",
    );
  }
  return absolute;
}

function requireLocalClientFeedbackDedupHostId(value) {
  const hostId = String(value ?? "").trim();
  if (
    hostId.length < 8
    || hostId.length > 256
    || /[\u0000-\u001f\u007f]/u.test(hostId)
  ) {
    throw localClientFeedbackDedupConfigError(
      "HOST_ID_REQUIRED",
      "SQLite feedback dedup requires AI_GATEWAY_LOCAL_CLIENT_HOST_ID as a stable bounded identifier.",
    );
  }
  return hostId;
}

function readLocalClientFeedbackDedupNamespace(value) {
  const namespace = String(value ?? "local-client-feedback-dedup").trim();
  if (!/^[a-z][a-z0-9._-]{0,127}$/u.test(namespace)) {
    throw localClientFeedbackDedupConfigError(
      "CONFIG_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_NAMESPACE must be a portable identifier.",
    );
  }
  return namespace;
}

function readStrictLocalClientFeedbackDedupInteger(value, fallback, minimum, maximum, name) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim();
  if (!/^(?:0|[1-9][0-9]*)$/u.test(normalized)) {
    throw localClientFeedbackDedupConfigError("CONFIG_INVALID", `${name} must be a bounded integer.`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw localClientFeedbackDedupConfigError("CONFIG_INVALID", `${name} must be a bounded integer.`);
  }
  return parsed;
}

function localClientFeedbackDedupConfigError(reason, message) {
  return Object.assign(new Error(message), {
    code: `LOCAL_CLIENT_FEEDBACK_DEDUP_${reason}`,
    category: "configuration",
    statusCode: 503,
  });
}

function createConfiguredLocalClientExecutionFeedbackOutbox(env, registryIntegrityKey) {
  const mode = readLocalClientExecutionFeedbackOutboxStoreMode(env);
  if (mode === "disabled") return null;
  if (!(registryIntegrityKey instanceof Uint8Array)) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "INTEGRITY_KEY_REQUIRED",
      "The execution feedback outbox requires authenticated local-client adapter material.",
    );
  }
  const dedicatedKey = createHmac("sha256", registryIntegrityKey)
    .update("local-client-execution-feedback-outbox-key-v1")
    .digest();
  try {
    return new LocalClientSqliteExecutionFeedbackOutbox({
      sqlitePath: resolveLocalClientExecutionFeedbackOutboxPath(
        env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SQLITE_PATH,
      ),
      hostId: requireLocalClientExecutionFeedbackOutboxHostId(
        env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID,
      ),
      integrityKey: dedicatedKey,
      namespace: readLocalClientExecutionFeedbackOutboxNamespace(
        env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_NAMESPACE,
      ),
      deliveredTtlMs: readStrictLocalClientExecutionFeedbackOutboxInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_DELIVERED_TTL_MS,
        7 * 24 * 60 * 60_000,
        10,
        90 * 24 * 60 * 60_000,
        "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_DELIVERED_TTL_MS",
      ),
      leaseTtlMs: readStrictLocalClientExecutionFeedbackOutboxInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_LEASE_TTL_MS,
        30_000,
        10,
        60 * 60_000,
        "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_LEASE_TTL_MS",
      ),
      maxEvents: readStrictLocalClientExecutionFeedbackOutboxInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_MAX_EVENTS,
        50_000,
        1,
        1_000_000,
        "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_MAX_EVENTS",
      ),
      maxBatchSize: readStrictLocalClientExecutionFeedbackOutboxInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_MAX_BATCH_SIZE,
        100,
        1,
        1_000,
        "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_MAX_BATCH_SIZE",
      ),
      busyTimeoutMs: readStrictLocalClientExecutionFeedbackOutboxInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_BUSY_TIMEOUT_MS,
        5_000,
        100,
        30_000,
        "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_BUSY_TIMEOUT_MS",
      ),
    });
  } finally {
    dedicatedKey.fill(0);
  }
}

function createConfiguredLocalClientExecutionFeedbackDispatcher(env, outbox, aggregateSink) {
  if (!outbox) return null;
  if (!aggregateSink) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "AGGREGATE_REQUIRED",
      "The execution feedback outbox requires the exactly-once feedback aggregate.",
    );
  }
  return createLocalClientExecutionFeedbackDispatcher({
    outbox,
    aggregateSink,
    intervalMs: readStrictLocalClientExecutionFeedbackOutboxInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_INTERVAL_MS,
      1_000,
      10,
      60 * 60_000,
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_INTERVAL_MS",
    ),
    deliveryTimeoutMs: readStrictLocalClientExecutionFeedbackOutboxInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DELIVERY_TIMEOUT_MS,
      5_000,
      10,
      60_000,
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DELIVERY_TIMEOUT_MS",
    ),
    batchSize: readStrictLocalClientExecutionFeedbackOutboxInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_BATCH_SIZE,
      4,
      1,
      1_000,
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_BATCH_SIZE",
    ),
    maxBatchesPerRun: readStrictLocalClientExecutionFeedbackOutboxInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_MAX_BATCHES,
      4,
      1,
      100,
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_MAX_BATCHES",
    ),
  });
}

function readLocalClientExecutionFeedbackOutboxStoreMode(env) {
  const mode = String(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_STORE_MODE ?? "disabled",
  ).trim().toLowerCase();
  if (mode !== "disabled" && mode !== "sqlite") {
    throw localClientExecutionFeedbackOutboxConfigError(
      "STORE_MODE_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_STORE_MODE must be disabled or sqlite.",
    );
  }
  return mode;
}

function resolveLocalClientExecutionFeedbackOutboxPath(value) {
  const path = String(value ?? "");
  if (
    !path.trim()
    || path !== path.trim()
    || path.length > 4_096
    || path === ":memory:"
    || path.startsWith("\\\\")
    || path.startsWith("//")
    || /[\u0000-\u001f\u007f]/u.test(path)
  ) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "SQLITE_PATH_REQUIRED",
      "The execution feedback outbox requires an explicit bounded local SQLite path.",
    );
  }
  const absolute = resolve(repoRoot, path);
  if (absolute.startsWith("\\\\") || absolute.startsWith("//")) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "SQLITE_PATH_INVALID",
      "The execution feedback outbox SQLite path must remain on this host.",
    );
  }
  return absolute;
}

function requireLocalClientExecutionFeedbackOutboxHostId(value) {
  const hostId = String(value ?? "").trim();
  if (hostId.length < 8 || hostId.length > 256 || /[\u0000-\u001f\u007f]/u.test(hostId)) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "HOST_ID_REQUIRED",
      "The execution feedback outbox requires AI_GATEWAY_LOCAL_CLIENT_HOST_ID.",
    );
  }
  return hostId;
}

function readLocalClientExecutionFeedbackOutboxNamespace(value) {
  const namespace = String(value ?? "local-client-execution-feedback-outbox").trim();
  if (!/^[a-z][a-z0-9._-]{0,127}$/u.test(namespace)) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "CONFIG_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_NAMESPACE must be portable.",
    );
  }
  return namespace;
}

function readStrictLocalClientExecutionFeedbackOutboxInteger(
  value,
  fallback,
  minimum,
  maximum,
  name,
) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim();
  if (!/^(?:0|[1-9][0-9]*)$/u.test(normalized)) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "CONFIG_INVALID",
      `${name} must be a bounded integer.`,
    );
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "CONFIG_INVALID",
      `${name} must be a bounded integer.`,
    );
  }
  return parsed;
}

function localClientExecutionFeedbackOutboxConfigError(reason, message) {
  return Object.assign(new Error(message), {
    code: `LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_${reason}`,
    category: "configuration",
    statusCode: 503,
  });
}

function readStrictLocalClientExecutionFeedbackOutboxBoolean(value, fallback, name) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw localClientExecutionFeedbackOutboxConfigError(
    "CONFIG_INVALID",
    `${name} must be true or false when the execution feedback outbox is configured.`,
  );
}

function createConfiguredLocalClientOnboardingReceiptAuthorityStore(env, enabled) {
  if (!enabled) return null;
  const rootKey = materializeLocalClientOnboardingRootKey(env);
  const dedicatedKey = createHmac("sha256", rootKey)
    .update("local-client-onboarding-receipt-authority-key-v1")
    .digest();
  rootKey.fill(0);
  try {
    return createLocalClientSqliteOnboardingReceiptAuthorityStore({
      sqlitePath: resolveLocalClientOnboardingReceiptAuthorityPath(
        env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SQLITE_PATH,
      ),
      hostId: requireLocalClientOnboardingHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID),
      integrityKey: dedicatedKey,
      namespace: readLocalClientOnboardingReceiptAuthorityNamespace(
        env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_NAMESPACE,
      ),
      ttlMs: readStrictLocalClientOnboardingInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_TTL_MS,
        30 * 24 * 60 * 60_000,
        10,
        365 * 24 * 60 * 60_000,
        "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_TTL_MS",
      ),
      leaseTtlMs: readStrictLocalClientOnboardingInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_LEASE_TTL_MS,
        10 * 60_000,
        10 * 60_000,
        60 * 60_000,
        "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_LEASE_TTL_MS",
      ),
      maxRows: readStrictLocalClientOnboardingInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_MAX_ROWS,
        10_000,
        1,
        1_000_000,
        "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_MAX_ROWS",
      ),
      busyTimeoutMs: readStrictLocalClientOnboardingInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_BUSY_TIMEOUT_MS,
        5_000,
        100,
        30_000,
        "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_BUSY_TIMEOUT_MS",
      ),
    });
  } finally {
    dedicatedKey.fill(0);
  }
}

function createConfiguredLocalClientAuthorityEpochStore(env, registryIntegrityKey) {
  const mode = readLocalClientAuthorityEpochStoreMode(env);
  if (mode === "disabled") return null;
  if (!(registryIntegrityKey instanceof Uint8Array)) {
    throw localClientAuthorityEpochConfigError(
      "INTEGRITY_KEY_REQUIRED",
      "The SQLite authority checkpoint requires a dedicated key derived from authenticated local-client adapter material.",
    );
  }
  const hostId = requireLocalClientAuthorityEpochHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID);
  const dedicatedKey = createHmac("sha256", registryIntegrityKey)
    .update("local-client-verification-authority-epoch-key-v1")
    .digest();
  try {
    return createLocalClientSqliteVerificationAuthorityEpochStore({
      sqlitePath: resolveLocalClientAuthorityEpochPath(
        env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH,
      ),
      hostId,
      integrityKey: dedicatedKey,
      namespace: readLocalClientAuthorityEpochNamespace(
        env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_NAMESPACE,
      ),
      maxCheckpoints: readStrictLocalClientAuthorityEpochInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_MAX_CHECKPOINTS,
        32,
        2,
        4_096,
        "AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_MAX_CHECKPOINTS",
      ),
      busyTimeoutMs: readStrictLocalClientAuthorityEpochInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_BUSY_TIMEOUT_MS,
        5_000,
        100,
        30_000,
        "AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_BUSY_TIMEOUT_MS",
      ),
    });
  } finally {
    dedicatedKey.fill(0);
  }
}

function readLocalClientAuthorityEpochStoreMode(env) {
  const mode = String(
    env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_MODE ?? "disabled",
  ).trim().toLowerCase();
  if (mode !== "disabled" && mode !== "sqlite") {
    throw localClientAuthorityEpochConfigError(
      "STORE_MODE_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_MODE must be disabled or sqlite.",
    );
  }
  return mode;
}

function requireLocalClientAuthorityEpochHostId(value) {
  const hostId = String(value ?? "").trim();
  if (
    hostId.length < 8
    || hostId.length > 256
    || /[\u0000-\u001f\u007f]/u.test(hostId)
  ) {
    throw localClientAuthorityEpochConfigError(
      "HOST_ID_REQUIRED",
      "The SQLite authority checkpoint requires AI_GATEWAY_LOCAL_CLIENT_HOST_ID as a stable bounded non-secret identifier.",
    );
  }
  return hostId;
}

function resolveLocalClientAuthorityEpochPath(value) {
  const path = String(
    value ?? resolve(repoRoot, ".data/local-clients/verification-authority-epoch.sqlite"),
  );
  if (
    !path.trim()
    || path !== path.trim()
    || path.length > 4_096
    || path === ":memory:"
    || path.startsWith("\\\\")
    || path.startsWith("//")
    || /[\u0000-\u001f\u007f]/u.test(path)
  ) {
    throw localClientAuthorityEpochConfigError(
      "SQLITE_PATH_INVALID",
      "The authority checkpoint SQLite path must be a bounded local file path.",
    );
  }
  const absolute = resolve(repoRoot, path);
  if (absolute.startsWith("\\\\") || absolute.startsWith("//")) {
    throw localClientAuthorityEpochConfigError(
      "SQLITE_PATH_INVALID",
      "The authority checkpoint SQLite path must remain on this host.",
    );
  }
  return absolute;
}

function readLocalClientAuthorityEpochNamespace(value) {
  const namespace = String(value ?? "local-client-verification-authority").trim();
  if (!/^[a-z][a-z0-9._-]{0,127}$/u.test(namespace)) {
    throw localClientAuthorityEpochConfigError(
      "CONFIG_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_NAMESPACE must be a portable identifier.",
    );
  }
  return namespace;
}

function readStrictLocalClientAuthorityEpochInteger(value, fallback, minimum, maximum, name) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim();
  if (!/^(?:0|[1-9][0-9]*)$/u.test(normalized)) {
    throw localClientAuthorityEpochConfigError("CONFIG_INVALID", `${name} must be a bounded integer.`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw localClientAuthorityEpochConfigError("CONFIG_INVALID", `${name} must be a bounded integer.`);
  }
  return parsed;
}

function localClientAuthorityEpochConfigError(reason, message) {
  return Object.assign(new Error(message), {
    code: `LOCAL_CLIENT_AUTHORITY_EPOCH_${reason}`,
    category: "configuration",
    statusCode: 503,
  });
}

function createConfiguredLocalClientRoutePlanStore(env) {
  const mode = String(env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE ?? "memory")
    .trim()
    .toLowerCase();
  if (mode === "memory") return createLocalClientRoutePlanStore();
  if (mode !== "sqlite") {
    throw Object.assign(new Error(
      "AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE must be memory or sqlite.",
    ), {
      code: "LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE_INVALID",
      category: "configuration",
      statusCode: 503,
    });
  }
  const hostId = String(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID ?? "").trim();
  if (!hostId) {
    throw Object.assign(new Error(
      "SQLite local-client route plans require AI_GATEWAY_LOCAL_CLIENT_HOST_ID.",
    ), {
      code: "LOCAL_CLIENT_ROUTE_PLAN_HOST_ID_REQUIRED",
      category: "configuration",
      statusCode: 503,
    });
  }
  return createLocalClientSqliteRoutePlanStore({
    sqlitePath: String(
      env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH
        ?? resolve(repoRoot, ".data/local-clients/route-plans.sqlite"),
    ),
    hostId,
    ttlMs: readStrictBoundedInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_TTL_MS, 60_000, 1, 300_000,
      "AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_TTL_MS",
    ),
    maxEntries: readStrictBoundedInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_MAX_ENTRIES, 1_024, 1, 10_000,
      "AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_MAX_ENTRIES",
    ),
    maxInputBytes: readStrictBoundedInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_MAX_INPUT_BYTES, 65_536, 2, 65_536,
      "AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_MAX_INPUT_BYTES",
    ),
    busyTimeoutMs: readStrictBoundedInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_BUSY_TIMEOUT_MS, 5_000, 100, 30_000,
      "AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_BUSY_TIMEOUT_MS",
    ),
  });
}

function createConfiguredLocalClientExecutionClaimStore(env) {
  const mode = readLocalClientExecutionClaimStoreMode(env);
  if (mode === "disabled") return null;
  const hostId = requireLocalClientExecutionClaimHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID);
  const sqlitePath = resolveLocalClientExecutionClaimPath(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH,
  );
  return createLocalClientSqliteExecutionClaimStore({
    sqlitePath,
    hostId,
    namespace: readLocalClientExecutionClaimNamespace(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_NAMESPACE,
    ),
    ttlMs: readStrictLocalClientExecutionClaimInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_TTL_MS,
      60_000,
      10,
      300_000,
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_TTL_MS",
    ),
    maxClaims: readStrictLocalClientExecutionClaimInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_MAX_CLAIMS,
      1_024,
      1,
      100_000,
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_MAX_CLAIMS",
    ),
    busyTimeoutMs: readStrictLocalClientExecutionClaimInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_BUSY_TIMEOUT_MS,
      5_000,
      100,
      30_000,
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_BUSY_TIMEOUT_MS",
    ),
  });
}

function readLocalClientExecutionClaimStoreMode(env) {
  const mode = String(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_STORE_MODE ?? "disabled",
  ).trim().toLowerCase();
  if (mode !== "disabled" && mode !== "sqlite") {
    throw localClientExecutionClaimConfigError(
      "STORE_MODE_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_STORE_MODE must be disabled or sqlite.",
    );
  }
  return mode;
}

function requireLocalClientExecutionClaimHostId(value) {
  const hostId = String(value ?? "").trim();
  if (!hostId) {
    throw localClientExecutionClaimConfigError(
      "HOST_ID_REQUIRED",
      "SQLite local-client execution claims require AI_GATEWAY_LOCAL_CLIENT_HOST_ID.",
    );
  }
  if (
    hostId.length < 8
    || hostId.length > 256
    || /[\u0000-\u001f\u007f]/u.test(hostId)
  ) {
    throw localClientExecutionClaimConfigError(
      "CONFIG_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_HOST_ID must be a stable bounded non-secret identifier.",
    );
  }
  return hostId;
}

function resolveLocalClientExecutionClaimPath(value) {
  const path = String(value ?? "");
  if (!path.trim()) {
    throw localClientExecutionClaimConfigError(
      "SQLITE_PATH_REQUIRED",
      "SQLite local-client execution claims require an explicit database path.",
    );
  }
  if (
    path !== path.trim()
    || path.length > 4_096
    || path === ":memory:"
    || path.startsWith("\\\\")
    || path.startsWith("//")
    || /[\u0000-\u001f\u007f]/u.test(path)
  ) {
    throw localClientExecutionClaimConfigError(
      "SQLITE_PATH_INVALID",
      "The local-client execution claim SQLite path must be a bounded local file path.",
    );
  }
  const absolute = resolve(repoRoot, path);
  if (absolute.startsWith("\\\\") || absolute.startsWith("//")) {
    throw localClientExecutionClaimConfigError(
      "SQLITE_PATH_INVALID",
      "The local-client execution claim SQLite path must remain on this host.",
    );
  }
  return absolute;
}

function readLocalClientExecutionClaimNamespace(value) {
  const namespace = String(value ?? "local-client-execution").trim();
  if (!/^[a-z][a-z0-9._-]{0,127}$/u.test(namespace)) {
    throw localClientExecutionClaimConfigError(
      "CONFIG_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_NAMESPACE must be a portable identifier.",
    );
  }
  return namespace;
}

function readStrictLocalClientExecutionClaimInteger(value, fallback, minimum, maximum, name) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim();
  if (!/^(?:0|[1-9][0-9]*)$/u.test(normalized)) {
    throw localClientExecutionClaimConfigError("CONFIG_INVALID", `${name} must be a bounded integer.`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw localClientExecutionClaimConfigError("CONFIG_INVALID", `${name} must be a bounded integer.`);
  }
  return parsed;
}

function localClientExecutionClaimConfigError(reason, message) {
  return Object.assign(new Error(message), {
    code: `LOCAL_CLIENT_EXECUTION_CLAIM_${reason}`,
    category: "configuration",
    statusCode: 503,
  });
}

function readStrictBoundedInteger(value, fallback, minimum, maximum, name) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim();
  if (!/^(?:0|[1-9][0-9]*)$/u.test(normalized)) throw localClientRoutePlanConfigError(name);
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw localClientRoutePlanConfigError(name);
  }
  return parsed;
}

function localClientRoutePlanConfigError(name) {
  return Object.assign(new Error(`${name} must be a bounded integer.`), {
    code: "LOCAL_CLIENT_ROUTE_PLAN_CONFIG_INVALID",
    category: "configuration",
    statusCode: 503,
  });
}

function registerConfiguredLocalClientAdapters(registry, env) {
  const configuration = resolveLocalClientLoopbackAdapterConfiguration(env);
  if (!configuration.enabled) return Object.freeze({
    probes: Object.freeze([]),
    registryIntegrityKey: null,
    ownershipBindings: Object.freeze([]),
    popAuthorityRegistry: null,
    receiptJournalRegistry: null,
    maxVerificationTtlMs: 5 * 60_000,
    status: configuration.status,
  });
  const credentialResolver = createCredentialResolver({ env });
  const registrySecret = materializeLocalClientLoopbackSecret(
    credentialResolver,
    configuration.registryIntegritySecretRef,
  );
  const registryIntegrityKey = createHmac("sha256", registrySecret)
    .update("local-client-registry-integrity-key-v1")
    .digest();
  let popReplayGuard = null;
  const probes = [];
  const popAuthorityBindings = [];
  const receiptJournalBindings = [];
  try {
    popReplayGuard = createConfiguredLocalClientPopReplayGuard(
      env,
      registryIntegrityKey,
    );
    const popReplayGuardPort = popReplayGuard
      ? createNonOwningLocalClientPopReplayGuardPort(popReplayGuard)
      : null;
    for (const entry of configuration.entries) {
      const secret = materializeLocalClientLoopbackSecret(credentialResolver, entry.secretRef);
      try {
        assertLocalClientGatewaySecretSeparated(registrySecret, secret);
        const sharedOptions = {
          adapterId: entry.adapterId,
          endpoint: entry.endpoint,
          expectedClientId: entry.clientId,
          expectedManifestSha256: entry.manifestSha256,
          sharedSecret: secret,
          timeoutMs: entry.timeoutMs,
          challengeTtlMs: entry.challengeTtlMs,
          maxResponseBytes: entry.maxResponseBytes,
        };
        registry.register(createLocalClientLoopbackAdapter(sharedOptions));
        probes.push(createLocalClientLoopbackVerificationProbe({
          ...sharedOptions,
          verificationTtlMs: entry.verificationTtlMs,
        }));
        const derivedPopKey = deriveManagedLocalClientPopKey({
          sharedSecret: secret,
          tenantId: entry.tenantId,
          clientId: entry.clientId,
        });
        popAuthorityBindings.push(Object.freeze({
          tenantId: entry.tenantId,
          clientId: entry.clientId,
          authority: createManagedLocalClientPopIdentityAuthority({
            key: derivedPopKey.key,
            keyId: derivedPopKey.keyId,
            ...(popReplayGuardPort ? { replayGuard: popReplayGuardPort } : {}),
          }),
        }));
        if (readLocalClientReceiptReconciliationStoreMode(env) === "sqlite") {
          receiptJournalBindings.push(Object.freeze({
            tenantId: entry.tenantId,
            clientId: entry.clientId,
            journal: createConfiguredLocalClientReceiptJournal({
              env,
              entry,
              sharedSecret: secret,
              registryIntegrityKey,
            }),
          }));
        }
      } finally {
        secret.fill(0);
      }
    }
    const popAuthorityRegistry = createLocalClientPopAuthorityRegistry(
      popAuthorityBindings,
      popReplayGuard,
    );
    const receiptJournalRegistry = receiptJournalBindings.length > 0
      ? createLocalClientExecutionReceiptJournalRegistry(receiptJournalBindings)
      : null;
    return Object.freeze({
      probes: Object.freeze(probes),
      registryIntegrityKey,
      popAuthorityRegistry,
      receiptJournalRegistry,
      ownershipBindings: Object.freeze(configuration.entries.map((entry) => Object.freeze({
        tenantId: entry.tenantId,
        clientId: entry.clientId,
        adapterId: entry.adapterId,
      }))),
      maxVerificationTtlMs: Math.max(...configuration.entries.map((entry) => entry.verificationTtlMs)),
      status: configuration.status,
    });
  } catch (error) {
    registryIntegrityKey.fill(0);
    for (const binding of popAuthorityBindings) {
      void binding.authority.close().catch(() => undefined);
    }
    for (const binding of receiptJournalBindings) {
      void binding.journal.close().catch(() => undefined);
    }
    try { popReplayGuard?.close?.(); } catch { /* Preserve startup failure. */ }
    throw error;
  } finally {
    registrySecret.fill(0);
  }
}

function createNonOwningLocalClientPopReplayGuardPort(guard) {
  return Object.freeze({
    get status() {
      return guard.status;
    },
    consumeOnce(input) {
      return guard.consumeOnce(input);
    },
  });
}

function createLocalClientPopAuthorityRegistry(rawBindings, ownedReplayGuard = null) {
  const bindings = new Map();
  for (const binding of rawBindings) {
    const key = `${binding.tenantId}\0${binding.clientId}`;
    if (bindings.has(key)) {
      for (const existing of bindings.values()) void existing.authority.close().catch(() => undefined);
      throw localClientAdapterConfigError("POP_BINDING_DUPLICATE");
    }
    bindings.set(key, binding);
  }
  const initialBindingCount = bindings.size;
  let closed = false;
  return Object.freeze({
    get status() {
      const authorityStatuses = [...bindings.values()].map((binding) => binding.authority.status);
      const replayStatuses = authorityStatuses.map((status) => status.replayGuard);
      const allReplay = (predicate) => replayStatuses.length > 0 && replayStatuses.every(predicate);
      const replayModes = [...new Set(replayStatuses.map((status) => status.mode))];
      const perScopeLimits = [...new Set(
        replayStatuses
          .map((status) => status.maxEntriesPerScope)
          .filter((value) => Number.isSafeInteger(value)),
      )];
      return Object.freeze({
        enabled: initialBindingCount > 0,
        available: !closed
          && authorityStatuses.length === initialBindingCount
          && authorityStatuses.every((status) => status.available === true),
        bindingCount: initialBindingCount,
        replayMode: replayModes.length === 1 ? replayModes[0] : replayModes.length === 0 ? "closed" : "mixed",
        durableReplayProtection: allReplay(
          (status) => status.available === true && status.durable === true,
        ),
        distributedReplayProtection: allReplay(
          (status) => status.available === true && status.distributed === true,
        ),
        authenticatedReplaySet: allReplay(
          (status) => status.authenticatedReplaySet === true,
        ),
        snapshotRollbackProtected: allReplay(
          (status) => status.snapshotRollbackProtected === true,
        ),
        defensiveEnabled: allReplay((status) => status.defensiveEnabled === true),
        capacityIsolatedByScope: allReplay(
          (status) => status.capacityIsolatedByScope === true,
        ),
        maxEntriesPerScope: perScopeLimits.length === 1 ? perScopeLimits[0] : null,
        perClientDerivedKeys: true,
        exactRawBodyBinding: true,
        bearerProofAloneGrantsAuthority: false,
      });
    },
    async verify({ expectedIdentity, request, proof }) {
      if (closed) throw localClientPopUnavailableError();
      const binding = bindings.get(`${expectedIdentity?.tenantId ?? ""}\0${expectedIdentity?.clientId ?? ""}`);
      if (!binding) throw localClientPopUnavailableError();
      return binding.authority.verify({ expectedIdentity, request, proof });
    },
    hasBinding(tenantId, clientId) {
      return !closed && bindings.has(`${tenantId ?? ""}\0${clientId ?? ""}`);
    },
    async close() {
      if (closed) return;
      closed = true;
      const results = await Promise.allSettled([
        ...[...bindings.values()].map((binding) => binding.authority.close()),
        ...(ownedReplayGuard?.close ? [Promise.resolve().then(() => ownedReplayGuard.close())] : []),
      ]);
      bindings.clear();
      const failures = results
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason);
      if (failures.length > 0) {
        throw new AggregateError(failures, "The local-client PoP authority registry failed to close.");
      }
    },
  });
}

function localClientPopUnavailableError() {
  return Object.assign(new Error("A configured managed local-client proof authority is required."), {
    code: "LOCAL_CLIENT_POP_AUTHORITY_UNAVAILABLE",
    category: "auth",
    statusCode: 401,
    retryable: false,
  });
}

function localClientProtocolPrincipalBindingError() {
  return Object.assign(new Error(
    "Every managed protocol principal must reference an exact configured loopback client.",
  ), {
    code: "LOCAL_CLIENT_PROTOCOL_PRINCIPAL_BINDING_INVALID",
    category: "configuration",
    statusCode: 503,
    retryable: false,
  });
}

function materializeLocalClientLoopbackSecret(credentialResolver, secretRef) {
  const materialized = credentialResolver.materializeCredentialRef(secretRef);
  if (materialized.materialized !== true || typeof materialized.secret !== "string") {
    throw localClientAdapterConfigError("SECRET_UNAVAILABLE");
  }
  return decodeLocalClientLoopbackSecret(materialized.secret);
}

function validateLocalClientStaticConfiguration(env) {
  const executionRequested = readStrictBoolean(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED,
    false,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED",
  );
  const routePlanMode = String(env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE ?? "memory")
    .trim()
    .toLowerCase();
  if (routePlanMode !== "memory" && routePlanMode !== "sqlite") {
    throw Object.assign(new Error(
      "AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE must be memory or sqlite.",
    ), {
      code: "LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE_INVALID",
      category: "configuration",
      statusCode: 503,
    });
  }
  if (routePlanMode === "sqlite") {
    const hostId = String(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID ?? "").trim();
    if (!hostId) {
      throw Object.assign(new Error(
        "SQLite local-client route plans require AI_GATEWAY_LOCAL_CLIENT_HOST_ID.",
      ), {
        code: "LOCAL_CLIENT_ROUTE_PLAN_HOST_ID_REQUIRED",
        category: "configuration",
        statusCode: 503,
      });
    }
  }
  readStrictBoundedInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_TTL_MS, 60_000, 1, 300_000,
    "AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_TTL_MS",
  );
  readStrictBoundedInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_MAX_ENTRIES, 1_024, 1, 10_000,
    "AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_MAX_ENTRIES",
  );
  readStrictBoundedInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_MAX_INPUT_BYTES, 65_536, 2, 65_536,
    "AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_MAX_INPUT_BYTES",
  );
  readStrictBoundedInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_BUSY_TIMEOUT_MS, 5_000, 100, 30_000,
    "AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_BUSY_TIMEOUT_MS",
  );
  validateLocalClientSynchronousExecutionBackends(env, executionRequested, routePlanMode);
  validateLocalClientExecutionClaimConfiguration(env, executionRequested, routePlanMode);
  validateLocalClientIdempotencyConfiguration(env, executionRequested, routePlanMode);
  validateLocalClientAuthorityEpochConfiguration(env, executionRequested, routePlanMode);
  const loopbackConfiguration = resolveLocalClientLoopbackAdapterConfiguration(env);
  if (!loopbackConfiguration.enabled) return;
  const credentialResolver = createCredentialResolver({ env });
  const registrySecret = materializeLocalClientLoopbackSecret(
    credentialResolver,
    loopbackConfiguration.registryIntegritySecretRef,
  );
  try {
    for (const entry of loopbackConfiguration.entries) {
      const clientSecret = materializeLocalClientLoopbackSecret(
        credentialResolver,
        entry.secretRef,
      );
      try {
        assertLocalClientGatewaySecretSeparated(registrySecret, clientSecret);
      } finally {
        clientSecret.fill(0);
      }
    }
  } finally {
    registrySecret.fill(0);
  }
}

function assertLocalClientGatewaySecretSeparated(registrySecret, clientSecret) {
  if (
    !(registrySecret instanceof Uint8Array)
    || !(clientSecret instanceof Uint8Array)
    || (
      registrySecret.byteLength === clientSecret.byteLength
      && timingSafeEqual(registrySecret, clientSecret)
    )
  ) {
    throw localClientAdapterConfigError("REGISTRY_SECRET_NOT_SEPARATE");
  }
}

function validateLocalClientPopReplayConfiguration(env) {
  const mode = readLocalClientPopReplayStoreMode(env);
  const sqliteSpecificNames = [
    "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH",
    "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_NAMESPACE",
    "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES",
    "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES_PER_SCOPE",
    "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_BUSY_TIMEOUT_MS",
  ];
  if (mode === "memory") {
    if (sqliteSpecificNames.some((name) => String(env[name] ?? "").trim())) {
      throw localClientPopReplayConfigError(
        "CONFIG_INVALID",
        "SQLite PoP replay settings require AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_STORE_MODE=sqlite.",
      );
    }
    return;
  }
  if (!resolveLocalClientLoopbackAdapterConfiguration(env).enabled) {
    throw localClientPopReplayConfigError(
      "LOOPBACK_REQUIRED",
      "SQLite PoP replay protection requires an explicitly configured loopback client.",
    );
  }
  requireLocalClientPopReplayHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID);
  const replayPath = resolveLocalClientPopReplayPath(
    env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH,
  );
  readLocalClientPopReplayNamespace(env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_NAMESPACE);
  const maxEntries = readStrictLocalClientPopReplayInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES,
    10_000,
    1,
    1_000_000,
    "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES",
  );
  const perScopeValue = String(
    env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES_PER_SCOPE ?? "",
  ).trim();
  if (perScopeValue) {
    const maxEntriesPerScope = readStrictLocalClientPopReplayInteger(
      perScopeValue,
      1,
      1,
      maxEntries,
      "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES_PER_SCOPE",
    );
    if (maxEntries > 1 && maxEntriesPerScope >= maxEntries) {
      throw localClientPopReplayConfigError(
        "CONFIG_INVALID",
        "Per-scope PoP replay capacity must preserve global capacity for another client.",
      );
    }
  }
  readStrictLocalClientPopReplayInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_BUSY_TIMEOUT_MS,
    5_000,
    100,
    30_000,
    "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_BUSY_TIMEOUT_MS",
  );

  const comparedPaths = [];
  if (String(env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE ?? "memory").trim().toLowerCase() === "sqlite") {
    comparedPaths.push(resolve(
      repoRoot,
      String(env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH
        ?? resolve(repoRoot, ".data/local-clients/route-plans.sqlite")),
    ));
  }
  if (readLocalClientExecutionClaimStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientExecutionClaimPath(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH,
    ));
  }
  if (readLocalClientAuthorityEpochStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientAuthorityEpochPath(
      env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH,
    ));
  }
  if (readLocalClientExecutionFeedbackOutboxStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientExecutionFeedbackOutboxPath(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SQLITE_PATH,
    ));
  }
  if (readLocalClientFeedbackDedupStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientFeedbackDedupPath(
      env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH,
    ));
  }
  for (const configuredPath of [
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SQLITE_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SQLITE_PATH,
    env.AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH,
    env.AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH,
    env.AI_GATEWAY_PROVIDER_DISPATCH_SQLITE_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH,
  ]) {
    if (typeof configuredPath === "string" && configuredPath.trim()) {
      comparedPaths.push(resolve(repoRoot, configuredPath));
    }
  }
  if (comparedPaths.some((candidate) => candidate.toLowerCase() === replayPath.toLowerCase())) {
    throw localClientPopReplayConfigError(
      "SQLITE_PATH_CONFLICT",
      "PoP replay protection requires a path distinct from registry and every known state store.",
    );
  }
}

function validateLocalClientFeedbackDedupConfiguration(env, executionRequested) {
  const mode = readLocalClientFeedbackDedupStoreMode(env);
  if (executionRequested && mode !== "sqlite") {
    throw localClientFeedbackDedupConfigError(
      "STORE_REQUIRED",
      "Local-client execution requires AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_STORE_MODE=sqlite.",
    );
  }
  if (mode !== "sqlite") return;
  if (readStrictLocalClientFeedbackBoolean(env.AI_GATEWAY_MULTI_INSTANCE, false)) {
    throw localClientFeedbackDedupConfigError(
      "MULTI_INSTANCE_UNSUPPORTED",
      "SQLite feedback dedup is single-host only and cannot be used in multi-instance mode.",
    );
  }
  requireLocalClientFeedbackDedupHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID);
  const feedbackPath = resolveLocalClientFeedbackDedupPath(
    env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH,
  );
  readLocalClientFeedbackDedupNamespace(env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_NAMESPACE);
  readStrictLocalClientFeedbackDedupInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_TTL_MS,
    7 * 24 * 60 * 60_000,
    10,
    90 * 24 * 60 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_TTL_MS",
  );
  readStrictLocalClientFeedbackDedupInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_LEASE_TTL_MS,
    30_000,
    10,
    60 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_LEASE_TTL_MS",
  );
  readStrictLocalClientFeedbackDedupInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_MAX_EVENTS,
    50_000,
    1,
    1_000_000,
    "AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_MAX_EVENTS",
  );
  readStrictLocalClientFeedbackDedupInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_BUSY_TIMEOUT_MS,
    5_000,
    100,
    30_000,
    "AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_BUSY_TIMEOUT_MS",
  );

  const comparedPaths = [];
  const routePlanMode = String(env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE ?? "memory")
    .trim().toLowerCase();
  if (routePlanMode === "sqlite") {
    comparedPaths.push(resolve(
      repoRoot,
      String(env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH
        ?? resolve(repoRoot, ".data/local-clients/route-plans.sqlite")),
    ));
  }
  if (readLocalClientExecutionClaimStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientExecutionClaimPath(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH,
    ));
  }
  if (readLocalClientAuthorityEpochStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientAuthorityEpochPath(
      env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH,
    ));
  }
  if (readLocalClientPopReplayStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientPopReplayPath(
      env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH,
    ));
  }
  if (readLocalClientExecutionFeedbackOutboxStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientExecutionFeedbackOutboxPath(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SQLITE_PATH,
    ));
  }
  for (const configuredPath of [
    env.AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH,
    env.AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH,
    env.AI_GATEWAY_PROVIDER_DISPATCH_SQLITE_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH,
  ]) {
    if (typeof configuredPath === "string" && configuredPath.trim()) {
      comparedPaths.push(resolve(repoRoot, configuredPath));
    }
  }
  if (comparedPaths.some((candidate) => candidate.toLowerCase() === feedbackPath.toLowerCase())) {
    throw localClientFeedbackDedupConfigError(
      "SQLITE_PATH_CONFLICT",
      "Feedback dedup requires a path distinct from registry and every known SQLite store.",
    );
  }
}

function validateLocalClientExecutionFeedbackOutboxConfiguration(env, executionRequested) {
  const mode = readLocalClientExecutionFeedbackOutboxStoreMode(env);
  const optionNames = [
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SQLITE_PATH",
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_NAMESPACE",
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_DELIVERED_TTL_MS",
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_LEASE_TTL_MS",
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_MAX_EVENTS",
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_MAX_BATCH_SIZE",
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_BUSY_TIMEOUT_MS",
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_INTERVAL_MS",
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DELIVERY_TIMEOUT_MS",
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_BATCH_SIZE",
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_MAX_BATCHES",
  ];
  if (executionRequested && mode !== "sqlite") {
    throw localClientExecutionFeedbackOutboxConfigError(
      "STORE_REQUIRED",
      "Local-client execution requires a durable SQLite execution feedback outbox.",
    );
  }
  if (mode === "disabled") {
    if (optionNames.some((name) => String(env[name] ?? "").trim())) {
      throw localClientExecutionFeedbackOutboxConfigError(
        "CONFIG_INVALID",
        "Execution feedback outbox settings require STORE_MODE=sqlite.",
      );
    }
    return;
  }
  if (readLocalClientFeedbackDedupStoreMode(env) !== "sqlite") {
    throw localClientExecutionFeedbackOutboxConfigError(
      "AGGREGATE_REQUIRED",
      "The execution feedback outbox requires SQLite exactly-once feedback deduplication.",
    );
  }
  if (!resolveLocalClientLoopbackAdapterConfiguration(env).enabled) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "LOOPBACK_REQUIRED",
      "The execution feedback outbox requires an authenticated loopback client configuration.",
    );
  }
  if (readStrictLocalClientExecutionFeedbackOutboxBoolean(
    env.AI_GATEWAY_MULTI_INSTANCE,
    false,
    "AI_GATEWAY_MULTI_INSTANCE",
  )) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "MULTI_INSTANCE_UNSUPPORTED",
      "The SQLite execution feedback outbox is single-host and cannot serve multi-instance mode.",
    );
  }
  requireLocalClientExecutionFeedbackOutboxHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID);
  const outboxPath = resolveLocalClientExecutionFeedbackOutboxPath(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SQLITE_PATH,
  );
  readLocalClientExecutionFeedbackOutboxNamespace(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_NAMESPACE,
  );
  readStrictLocalClientExecutionFeedbackOutboxInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_DELIVERED_TTL_MS,
    7 * 24 * 60 * 60_000,
    10,
    90 * 24 * 60 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_DELIVERED_TTL_MS",
  );
  const leaseTtlMs = readStrictLocalClientExecutionFeedbackOutboxInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_LEASE_TTL_MS,
    30_000,
    10,
    60 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_LEASE_TTL_MS",
  );
  readStrictLocalClientExecutionFeedbackOutboxInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_MAX_EVENTS,
    50_000,
    1,
    1_000_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_MAX_EVENTS",
  );
  const maxBatchSize = readStrictLocalClientExecutionFeedbackOutboxInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_MAX_BATCH_SIZE,
    100,
    1,
    1_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_MAX_BATCH_SIZE",
  );
  const busyTimeoutMs = readStrictLocalClientExecutionFeedbackOutboxInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_BUSY_TIMEOUT_MS,
    5_000,
    100,
    30_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_BUSY_TIMEOUT_MS",
  );
  readStrictLocalClientExecutionFeedbackOutboxInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_INTERVAL_MS,
    1_000,
    10,
    60 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_INTERVAL_MS",
  );
  const deliveryTimeoutMs = readStrictLocalClientExecutionFeedbackOutboxInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DELIVERY_TIMEOUT_MS,
    5_000,
    10,
    60_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DELIVERY_TIMEOUT_MS",
  );
  const dispatchBatchSize = readStrictLocalClientExecutionFeedbackOutboxInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_BATCH_SIZE,
    4,
    1,
    1_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_BATCH_SIZE",
  );
  readStrictLocalClientExecutionFeedbackOutboxInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_MAX_BATCHES,
    4,
    1,
    100,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_MAX_BATCHES",
  );
  if (
    dispatchBatchSize > maxBatchSize
    || leaseTtlMs < (
      (dispatchBatchSize * deliveryTimeoutMs)
      + busyTimeoutMs
      + 1_000
    )
  ) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "DELIVERY_BUDGET_INVALID",
      "The outbox lease must exceed the bounded sequential delivery budget and batch limits.",
    );
  }

  const comparedPaths = [];
  if (String(env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE ?? "memory").trim().toLowerCase() === "sqlite") {
    comparedPaths.push(resolve(
      repoRoot,
      String(env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH
        ?? resolve(repoRoot, ".data/local-clients/route-plans.sqlite")),
    ));
  }
  if (readLocalClientExecutionClaimStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientExecutionClaimPath(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH,
    ));
  }
  if (readLocalClientAuthorityEpochStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientAuthorityEpochPath(
      env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH,
    ));
  }
  if (readLocalClientFeedbackDedupStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientFeedbackDedupPath(
      env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH,
    ));
  }
  if (readLocalClientPopReplayStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientPopReplayPath(
      env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH,
    ));
  }
  for (const configuredPath of [
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SQLITE_PATH,
    env.AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH,
    env.AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH,
    env.AI_GATEWAY_PROVIDER_DISPATCH_SQLITE_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH,
  ]) {
    if (typeof configuredPath === "string" && configuredPath.trim()) {
      comparedPaths.push(resolve(repoRoot, configuredPath));
    }
  }
  if (comparedPaths.some((candidate) => candidate.toLowerCase() === outboxPath.toLowerCase())) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "SQLITE_PATH_CONFLICT",
      "The execution feedback outbox requires a path distinct from every known state store.",
    );
  }
}

function validateLocalClientReceiptReconciliationConfiguration(env, executionRequested) {
  const mode = readLocalClientReceiptReconciliationStoreMode(env);
  const optionNames = [
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIR",
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_NAMESPACE",
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_MAX_ENTRIES",
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_RETENTION_MS",
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_INTENT_TTL_MS",
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_QUERY_TTL_MS",
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_CLOCK_SKEW_MS",
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_BUSY_TIMEOUT_MS",
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_INTERVAL_MS",
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_BATCH_SIZE",
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_GRACE_MS",
  ];
  if (executionRequested && mode !== "sqlite") {
    throw localClientReceiptReconciliationConfigError(
      "STORE_REQUIRED",
      "Governed local-client execution requires durable receipt reconciliation.",
    );
  }
  if (mode === "disabled") {
    if (optionNames.some((name) => String(env[name] ?? "").trim())) {
      throw localClientReceiptReconciliationConfigError(
        "CONFIG_INVALID",
        "Receipt reconciliation options require STORE_MODE=sqlite.",
      );
    }
    return;
  }
  const loopback = resolveLocalClientLoopbackAdapterConfiguration(env);
  if (!loopback.enabled) {
    throw localClientReceiptReconciliationConfigError(
      "LOOPBACK_REQUIRED",
      "Receipt reconciliation requires an authenticated loopback client.",
    );
  }
  if (readStrictLocalClientReceiptReconciliationBoolean(env.AI_GATEWAY_MULTI_INSTANCE, false)) {
    throw localClientReceiptReconciliationConfigError(
      "MULTI_INSTANCE_UNSUPPORTED",
      "The SQLite receipt journal is single-host and cannot serve multi-instance execution.",
    );
  }
  requireLocalClientReceiptReconciliationHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID);
  const directory = resolveLocalClientReceiptReconciliationDirectory(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIR,
  );
  readLocalClientReceiptReconciliationNamespace(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_NAMESPACE,
  );
  readStrictLocalClientReceiptReconciliationInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_MAX_ENTRIES,
    2_000,
    1,
    100_000,
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_MAX_ENTRIES",
  );
  readStrictLocalClientReceiptReconciliationInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_RETENTION_MS,
    7 * 24 * 60 * 60_000,
    1_000,
    365 * 24 * 60 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_RETENTION_MS",
  );
  const intentTtlMs = readStrictLocalClientReceiptReconciliationInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_INTENT_TTL_MS,
    60_000,
    1_000,
    10 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_INTENT_TTL_MS",
  );
  const clockSkewMs = readStrictLocalClientReceiptReconciliationInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_CLOCK_SKEW_MS,
    5_000,
    0,
    60_000,
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_CLOCK_SKEW_MS",
  );
  const queryTtlMs = readStrictLocalClientReceiptReconciliationInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_QUERY_TTL_MS,
    30_000,
    1_000,
    60_000,
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_QUERY_TTL_MS",
  );
  readStrictLocalClientReceiptReconciliationInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_BUSY_TIMEOUT_MS,
    5_000,
    100,
    30_000,
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_BUSY_TIMEOUT_MS",
  );
  readStrictLocalClientReceiptReconciliationInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_INTERVAL_MS,
    5_000,
    100,
    60 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_INTERVAL_MS",
  );
  readStrictLocalClientReceiptReconciliationInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_BATCH_SIZE,
    32,
    1,
    1_000,
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_BATCH_SIZE",
  );
  const recoveryGraceMs = readStrictLocalClientReceiptReconciliationInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_GRACE_MS,
    120_000,
    0,
    24 * 60 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_GRACE_MS",
  );
  const maxAdapterTimeoutMs = Math.max(...loopback.entries.map((entry) => entry.timeoutMs));
  const minimumReconciliationWindowMs = maxAdapterTimeoutMs + clockSkewMs + 1_000;
  if (intentTtlMs < minimumReconciliationWindowMs) {
    throw localClientReceiptReconciliationConfigError(
      "INTENT_TTL_INVALID",
      "Receipt intent TTL must exceed adapter timeout plus clock skew and safety margin.",
    );
  }
  if (queryTtlMs < minimumReconciliationWindowMs) {
    throw localClientReceiptReconciliationConfigError(
      "QUERY_TTL_INVALID",
      "Receipt query TTL must cover adapter timeout plus clock skew and safety margin.",
    );
  }
  if (recoveryGraceMs < minimumReconciliationWindowMs) {
    throw localClientReceiptReconciliationConfigError(
      "RECOVERY_GRACE_INVALID",
      "Receipt recovery grace must cover adapter timeout plus clock skew and safety margin.",
    );
  }
  for (const configuredPath of [
    env.AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SQLITE_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SQLITE_PATH,
    env.AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH,
    env.AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH,
    env.AI_GATEWAY_PROVIDER_DISPATCH_SQLITE_PATH,
  ]) {
    if (
      typeof configuredPath === "string"
      && configuredPath.trim()
      && localClientReceiptPathsConflict(resolve(repoRoot, configuredPath), directory)
    ) {
      throw localClientReceiptReconciliationConfigError(
        "DIRECTORY_CONFLICT",
        "Receipt reconciliation requires a directory distinct from state files.",
      );
    }
  }
}

function readStrictLocalClientReceiptReconciliationBoolean(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw localClientReceiptReconciliationConfigError(
    "CONFIG_INVALID",
    "AI_GATEWAY_MULTI_INSTANCE must be true or false for receipt reconciliation.",
  );
}

function readStrictLocalClientFeedbackBoolean(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw localClientFeedbackDedupConfigError(
    "CONFIG_INVALID",
    "AI_GATEWAY_MULTI_INSTANCE must be true or false when feedback dedup is configured.",
  );
}

function materializeLocalClientOnboardingRuntimeConfiguration(env, configuration) {
  if (!configuration.enabled) return configuration;
  const rootKey = materializeLocalClientOnboardingRootKey(env);
  try {
    const backupEncryptionKey = createHmac("sha256", rootKey)
      .update("local-client-onboarding-backup-encryption-key-v1")
      .digest();
    return Object.freeze({
      ...configuration,
      registryOptions: Object.freeze({
        ...configuration.registryOptions,
        backupEncryptionKey,
        committedRetentionMs: readStrictLocalClientOnboardingInteger(
          env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_TTL_MS,
          30 * 24 * 60 * 60_000,
          10,
          365 * 24 * 60 * 60_000,
          "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_TTL_MS",
        ),
      }),
    });
  } finally {
    rootKey.fill(0);
  }
}

function materializeLocalClientOnboardingRootKey(env) {
  const secretRef = String(
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ROOT_SECRET_REF ?? "",
  ).trim();
  if (!secretRef) {
    throw localClientOnboardingRuntimeConfigError(
      "ROOT_SECRET_REQUIRED",
      "Governed onboarding requires AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ROOT_SECRET_REF.",
    );
  }
  const credentialResolver = createCredentialResolver({ env });
  const materialized = credentialResolver.materializeCredentialRef(secretRef);
  if (materialized.materialized !== true || typeof materialized.secret !== "string") {
    throw localClientOnboardingRuntimeConfigError(
      "ROOT_SECRET_UNAVAILABLE",
      "The governed onboarding root secret reference is unavailable.",
    );
  }
  const match = /^hex:([a-f0-9]{64,128})$/iu.exec(materialized.secret.trim());
  if (!match || match[1].length % 2 !== 0) {
    throw localClientOnboardingRuntimeConfigError(
      "ROOT_SECRET_INVALID",
      "The governed onboarding root secret must be a 32-64 byte hex credential.",
    );
  }
  return Buffer.from(match[1], "hex");
}

function localClientOnboardingRootSecretFilePaths(env) {
  const secretRef = String(
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ROOT_SECRET_REF ?? "",
  ).trim();
  const match = /^file_key_path:(.+)$/u.exec(secretRef);
  if (!match) return [];
  const vaultRootRaw = String(env.CREDENTIAL_VAULT_DIR ?? "").trim();
  if (!vaultRootRaw) return [];
  const vaultRoot = resolve(vaultRootRaw);
  const candidate = resolve(vaultRoot, match[1]);
  if (candidate !== vaultRoot && !candidate.startsWith(`${vaultRoot}${sep}`)) {
    throw localClientOnboardingRuntimeConfigError(
      "ROOT_SECRET_INVALID",
      "The governed onboarding root secret path escapes the credential vault.",
    );
  }
  return [candidate];
}

function zeroLocalClientOnboardingBackupKey(configuration) {
  if (configuration.enabled) {
    configuration.registryOptions.backupEncryptionKey?.fill(0);
  }
}

function validateLocalClientOnboardingGovernanceConfiguration(env, configuration) {
  if (!configuration.enabled) return;
  if (readStrictLocalClientOnboardingBoolean(env.AI_GATEWAY_MULTI_INSTANCE, false)) {
    throw localClientOnboardingRuntimeConfigError(
      "MULTI_INSTANCE_UNSUPPORTED",
      "Governed onboarding currently supports one local gateway instance only.",
    );
  }
  requireLocalClientOnboardingHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID);
  const receiptAuthorityPath = resolveLocalClientOnboardingReceiptAuthorityPath(
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SQLITE_PATH,
  );
  readLocalClientOnboardingReceiptAuthorityNamespace(
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_NAMESPACE,
  );
  const receiptTtlMs = readStrictLocalClientOnboardingInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_TTL_MS,
    30 * 24 * 60 * 60_000,
    15 * 60_000,
    365 * 24 * 60 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_TTL_MS",
  );
  const receiptLeaseTtlMs = readStrictLocalClientOnboardingInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_LEASE_TTL_MS,
    10 * 60_000,
    10 * 60_000,
    60 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_LEASE_TTL_MS",
  );
  if (receiptTtlMs < receiptLeaseTtlMs + 5 * 60_000) {
    throw localClientOnboardingRuntimeConfigError(
      "RECEIPT_RETENTION_INVALID",
      "Onboarding receipt retention must exceed the rollback claim lease by at least five minutes.",
    );
  }
  readStrictLocalClientOnboardingInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_MAX_ROWS,
    10_000,
    1,
    1_000_000,
    "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_MAX_ROWS",
  );
  readStrictLocalClientOnboardingInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_BUSY_TIMEOUT_MS,
    5_000,
    100,
    30_000,
    "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_BUSY_TIMEOUT_MS",
  );
  const configuredControlMode = String(
    env.AI_GATEWAY_LOCAL_CLIENT_CONTROL_STORE_MODE
      ?? env.AI_GATEWAY_WORKFORCE_CONTROL_STORE_MODE
      ?? "",
  ).trim().toLowerCase();
  const controlPostgresUrl = String(
    env.AI_GATEWAY_LOCAL_CLIENT_CONTROL_POSTGRES_URL
      ?? env.AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_URL
      ?? "",
  ).trim();
  const controlMode = configuredControlMode || (controlPostgresUrl ? "postgres" : "local");
  if (controlMode !== "local") {
    throw localClientOnboardingRuntimeConfigError(
      "LOCAL_CONTROL_REQUIRED",
      "Governed onboarding currently requires local atomic approval and lifecycle control.",
    );
  }
  if (String(env.AI_GATEWAY_IDEMPOTENCY_STORE_MODE ?? "").trim().toLowerCase() !== "sqlite") {
    throw localClientOnboardingRuntimeConfigError(
      "IDEMPOTENCY_SQLITE_REQUIRED",
      "Governed onboarding requires AI_GATEWAY_IDEMPOTENCY_STORE_MODE=sqlite.",
    );
  }
  const idempotencyPath = resolveLocalClientIdempotencyPath(
    env.AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH,
  );
  const idempotencySecret = env.AI_GATEWAY_IDEMPOTENCY_HMAC_SECRET;
  if (typeof idempotencySecret !== "string" || Buffer.byteLength(idempotencySecret) < 32) {
    throw localClientOnboardingRuntimeConfigError(
      "IDEMPOTENCY_SECRET_REQUIRED",
      "Governed onboarding requires a stable idempotency HMAC secret of at least 32 bytes.",
    );
  }
  if (String(env.AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE ?? "").trim().toLowerCase() !== "sqlite") {
    throw localClientOnboardingRuntimeConfigError(
      "EXTERNAL_EFFECT_SQLITE_REQUIRED",
      "Governed onboarding requires AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE=sqlite.",
    );
  }
  const externalEffectPath = resolveLocalClientGovernedMutationPath(
    env.AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH,
    "AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH",
  );
  const externalEffectSecret = String(env.AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET ?? "").trim();
  let externalEffectSecretPath = null;
  if (externalEffectSecret) {
    if (Buffer.byteLength(externalEffectSecret) < 32) {
      throw localClientOnboardingRuntimeConfigError(
        "EXTERNAL_EFFECT_SECRET_REQUIRED",
        "Governed onboarding requires a stable external-effect HMAC secret of at least 32 bytes.",
      );
    }
  } else {
    const secretPath = String(env.AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET_PATH ?? "").trim();
    if (!secretPath) {
      throw localClientOnboardingRuntimeConfigError(
        "EXTERNAL_EFFECT_SECRET_REQUIRED",
        "Governed onboarding requires a stable external-effect HMAC secret or explicit secret path.",
      );
    }
    externalEffectSecretPath = resolveLocalClientGovernedMutationPath(
      secretPath,
      "AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET_PATH",
    );
  }
  if (
    idempotencyPath.toLowerCase() === externalEffectPath.toLowerCase()
    || receiptAuthorityPath.toLowerCase() === idempotencyPath.toLowerCase()
    || receiptAuthorityPath.toLowerCase() === externalEffectPath.toLowerCase()
  ) {
    throw localClientOnboardingRuntimeConfigError(
      "SQLITE_PATH_CONFLICT",
      "Governed onboarding idempotency and external-effect state require distinct SQLite paths.",
    );
  }
  const peerPaths = [];
  const routePlanMode = String(env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE ?? "memory")
    .trim().toLowerCase();
  if (routePlanMode === "sqlite") {
    peerPaths.push(resolve(
      repoRoot,
      String(env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH
        ?? resolve(repoRoot, ".data/local-clients/route-plans.sqlite")),
    ));
  }
  if (readLocalClientExecutionClaimStoreMode(env) === "sqlite") {
    peerPaths.push(resolveLocalClientExecutionClaimPath(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH,
    ));
  }
  if (readLocalClientAuthorityEpochStoreMode(env) === "sqlite") {
    peerPaths.push(resolveLocalClientAuthorityEpochPath(
      env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH,
    ));
  }
  if (readLocalClientFeedbackDedupStoreMode(env) === "sqlite") {
    peerPaths.push(resolveLocalClientFeedbackDedupPath(
      env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH,
    ));
  }
  for (const configuredPath of [
    env.AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH,
    env.AI_GATEWAY_PROVIDER_DISPATCH_SQLITE_PATH,
  ]) {
    if (typeof configuredPath === "string" && configuredPath.trim()) {
      peerPaths.push(resolve(repoRoot, configuredPath));
    }
  }
  if (peerPaths.some((peerPath) => (
    peerPath.toLowerCase() === idempotencyPath.toLowerCase()
    || peerPath.toLowerCase() === externalEffectPath.toLowerCase()
  ))) {
    throw localClientOnboardingRuntimeConfigError(
      "SQLITE_PATH_CONFLICT",
      "Governed onboarding stores require paths distinct from registry and every configured SQLite subsystem.",
    );
  }
  if (peerPaths.some((peerPath) => peerPath.toLowerCase() === receiptAuthorityPath.toLowerCase())) {
    throw localClientOnboardingRuntimeConfigError(
      "SQLITE_PATH_CONFLICT",
      "Onboarding receipt authority requires a path distinct from every configured SQLite subsystem.",
    );
  }
  const governancePaths = [
    idempotencyPath,
    externalEffectPath,
    receiptAuthorityPath,
    ...peerPaths,
    ...(externalEffectSecretPath === null ? [] : [externalEffectSecretPath]),
    ...localClientOnboardingRootSecretFilePaths(env),
  ];
  assertLocalClientOnboardingPathGraph(configuration, governancePaths);
  const onboardingRootKey = materializeLocalClientOnboardingRootKey(env);
  onboardingRootKey.fill(0);
  const allStorePaths = governancePaths.map((path) => path.toLowerCase());
  for (const profile of Object.values(configuration.registryOptions.profiles)) {
    const targetPath = resolve(profile.targetPath).toLowerCase();
    const journalPath = resolve(profile.journalPath).toLowerCase();
    const backupDir = resolve(profile.backupDir).toLowerCase();
    if (allStorePaths.some((storePath) => (
      storePath === targetPath
      || storePath === journalPath
      || storePath === backupDir
      || storePath.startsWith(`${backupDir}${sep}`.toLowerCase())
    ))) {
      throw localClientOnboardingRuntimeConfigError(
        "SQLITE_PATH_CONFLICT",
        "Governance stores must not overlap any lazy onboarding target, journal, or backup location.",
      );
    }
  }
}

function assertLocalClientOnboardingPathGraph(configuration, governancePaths) {
  const exclusiveFiles = governancePaths.map((path, index) => (
    localClientOnboardingPathFact(path, `governance:${index}`)
  ));
  const backupDirectories = [];
  for (const [profileName, profile] of Object.entries(configuration.registryOptions.profiles)) {
    exclusiveFiles.push(
      localClientOnboardingPathFact(profile.targetPath, `${profileName}:target`),
      localClientOnboardingPathFact(profile.journalPath, `${profileName}:journal`),
    );
    backupDirectories.push(
      localClientOnboardingPathFact(profile.backupDir, `${profileName}:backup`),
    );
  }
  const server = configuration.registryOptions.serverDefinition;
  exclusiveFiles.push(localClientOnboardingPathFact(server.command, "server:command"));
  for (const [index, argument] of server.args.entries()) {
    if (isAbsolute(argument)) {
      exclusiveFiles.push(localClientOnboardingPathFact(argument, `server:arg:${index}`));
    }
  }
  const cwd = server.cwd === undefined
    ? null
    : localClientOnboardingPathFact(server.cwd, "server:cwd");

  for (let leftIndex = 0; leftIndex < exclusiveFiles.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < exclusiveFiles.length; rightIndex += 1) {
      if (sameLocalClientOnboardingPathFact(
        exclusiveFiles[leftIndex],
        exclusiveFiles[rightIndex],
      )) {
        throw localClientOnboardingRuntimeConfigError(
          "PATH_CONFLICT",
          "Governed onboarding paths for configuration, governance, and runtime entry files must be distinct.",
        );
      }
    }
  }
  for (const backup of backupDirectories) {
    for (const candidate of [...exclusiveFiles, ...(cwd === null ? [] : [cwd])]) {
      if (
        backup.canonicalPath === candidate.canonicalPath
        || localClientOnboardingPathContains(backup.canonicalPath, candidate.canonicalPath)
      ) {
        throw localClientOnboardingRuntimeConfigError(
          "PATH_CONFLICT",
          "No governance, target, or runtime entry path may overlap an onboarding backup directory.",
        );
      }
    }
  }
  if (cwd && exclusiveFiles.some((candidate) => sameLocalClientOnboardingPathFact(cwd, candidate))) {
    throw localClientOnboardingRuntimeConfigError(
      "PATH_CONFLICT",
      "The onboarding runtime working directory must not be a governed file path.",
    );
  }
}

function localClientOnboardingPathFact(rawPath, role) {
  const absolutePath = resolve(rawPath);
  if (absolutePath.startsWith("\\\\") || absolutePath.startsWith("//")) {
    throw localClientOnboardingRuntimeConfigError(
      "PATH_UNSAFE",
      "Governed onboarding paths must remain on this host.",
    );
  }
  const root = parse(absolutePath).root;
  const relativeParts = absolutePath.slice(root.length).split(/[\\/]+/u).filter(Boolean);
  let cursor = root;
  let finalStat = null;
  for (let index = 0; index < relativeParts.length; index += 1) {
    cursor = resolve(cursor, relativeParts[index]);
    try {
      const stat = lstatSync(cursor, { bigint: true });
      if (stat.isSymbolicLink()) {
        throw localClientOnboardingRuntimeConfigError(
          "PATH_UNSAFE",
          "Governed onboarding paths must not traverse a symlink or junction.",
        );
      }
      if (index === relativeParts.length - 1) finalStat = stat;
    } catch (error) {
      if (error?.code === "ENOENT") break;
      throw error;
    }
  }
  return Object.freeze({
    role,
    canonicalPath: process.platform === "win32" ? absolutePath.toLowerCase() : absolutePath,
    identity: finalStat === null
      ? null
      : Object.freeze({ device: finalStat.dev, inode: finalStat.ino }),
  });
}

function sameLocalClientOnboardingPathFact(left, right) {
  return left.canonicalPath === right.canonicalPath
    || (
      left.identity !== null
      && right.identity !== null
      && left.identity.inode !== 0n
      && left.identity.device === right.identity.device
      && left.identity.inode === right.identity.inode
    );
}

function localClientOnboardingPathContains(parentPath, candidatePath) {
  const suffix = candidatePath.slice(parentPath.length);
  return suffix.startsWith(sep);
}

function readStrictLocalClientOnboardingBoolean(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw localClientOnboardingRuntimeConfigError(
    "CONFIG_INVALID",
    "AI_GATEWAY_MULTI_INSTANCE must be true or false when governed onboarding is enabled.",
  );
}

function readStrictLocalClientOnboardingInteger(value, fallback, minimum, maximum, name) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim();
  if (!/^(?:0|[1-9][0-9]*)$/u.test(normalized)) {
    throw localClientOnboardingRuntimeConfigError(
      "CONFIG_INVALID",
      `${name} must be a bounded integer.`,
    );
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw localClientOnboardingRuntimeConfigError(
      "CONFIG_INVALID",
      `${name} must be a bounded integer.`,
    );
  }
  return parsed;
}

function resolveLocalClientGovernedMutationPath(value, name) {
  const path = String(value ?? "");
  if (
    !path.trim()
    || path !== path.trim()
    || path.length > 4_096
    || path === ":memory:"
    || path.startsWith("\\\\")
    || path.startsWith("//")
    || /[\u0000-\u001f\u007f]/u.test(path)
  ) {
    throw localClientOnboardingRuntimeConfigError(
      "SQLITE_PATH_REQUIRED",
      `${name} must be an explicit bounded local file path.`,
    );
  }
  const absolute = resolve(repoRoot, path);
  if (absolute.startsWith("\\\\") || absolute.startsWith("//")) {
    throw localClientOnboardingRuntimeConfigError(
      "SQLITE_PATH_INVALID",
      `${name} must remain on this host.`,
    );
  }
  return absolute;
}

function resolveLocalClientOnboardingReceiptAuthorityPath(value) {
  return resolveLocalClientGovernedMutationPath(
    value,
    "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SQLITE_PATH",
  );
}

function requireLocalClientOnboardingHostId(value) {
  const hostId = String(value ?? "").trim();
  if (
    hostId.length < 8
    || hostId.length > 256
    || /[\u0000-\u001f\u007f]/u.test(hostId)
  ) {
    throw localClientOnboardingRuntimeConfigError(
      "HOST_ID_REQUIRED",
      "Governed onboarding receipt authority requires AI_GATEWAY_LOCAL_CLIENT_HOST_ID as a stable bounded identifier.",
    );
  }
  return hostId;
}

function readLocalClientOnboardingReceiptAuthorityNamespace(value) {
  const namespace = String(value ?? "local-client-onboarding-receipt-authority").trim();
  if (!/^[a-z][a-z0-9._-]{0,127}$/u.test(namespace)) {
    throw localClientOnboardingRuntimeConfigError(
      "CONFIG_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_NAMESPACE must be a portable identifier.",
    );
  }
  return namespace;
}

function localClientOnboardingRuntimeConfigError(reason, message) {
  return Object.assign(new Error(message), {
    code: `LOCAL_CLIENT_ONBOARDING_${reason}`,
    category: "configuration",
    statusCode: 503,
  });
}

function validateLocalClientAuthorityEpochConfiguration(env, executionRequested, routePlanMode) {
  const mode = readLocalClientAuthorityEpochStoreMode(env);
  if (executionRequested && mode !== "sqlite") {
    throw localClientAuthorityEpochConfigError(
      "STORE_REQUIRED",
      "Local-client execution requires AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_MODE=sqlite.",
    );
  }
  if (mode !== "sqlite") return;

  requireLocalClientAuthorityEpochHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID);
  const authorityPath = resolveLocalClientAuthorityEpochPath(
    env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH,
  );
  readLocalClientAuthorityEpochNamespace(env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_NAMESPACE);
  readStrictLocalClientAuthorityEpochInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_MAX_CHECKPOINTS,
    32,
    2,
    4_096,
    "AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_MAX_CHECKPOINTS",
  );
  readStrictLocalClientAuthorityEpochInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_BUSY_TIMEOUT_MS,
    5_000,
    100,
    30_000,
    "AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_BUSY_TIMEOUT_MS",
  );

  const comparedPaths = [];
  if (routePlanMode === "sqlite") {
    comparedPaths.push(resolve(
      repoRoot,
      String(
        env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH
          ?? resolve(repoRoot, ".data/local-clients/route-plans.sqlite"),
      ),
    ));
  }
  if (readLocalClientExecutionClaimStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientExecutionClaimPath(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH,
    ));
  }
  if (String(env.AI_GATEWAY_IDEMPOTENCY_STORE_MODE ?? "").trim().toLowerCase() === "sqlite") {
    comparedPaths.push(resolveLocalClientIdempotencyPath(env.AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH));
  }
  for (const candidate of [
    env.AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH,
    env.AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH,
  ]) {
    if (typeof candidate === "string" && candidate.trim()) {
      comparedPaths.push(resolve(repoRoot, candidate));
    }
  }
  if (comparedPaths.some((candidate) => candidate.toLowerCase() === authorityPath.toLowerCase())) {
    throw localClientAuthorityEpochConfigError(
      "SQLITE_PATH_CONFLICT",
      "The authority checkpoint requires a database path distinct from registry, route-plan, claim, idempotency, and external-effect state.",
    );
  }
}

function validateLocalClientSynchronousExecutionBackends(env, executionRequested, routePlanMode) {
  if (!executionRequested) return;
  if (routePlanMode !== "sqlite") {
    throw Object.assign(new Error(
      "Local-client execution requires the durable SQLite route-plan store.",
    ), {
      code: "LOCAL_CLIENT_ROUTE_PLAN_DURABLE_REQUIRED",
      category: "configuration",
      statusCode: 503,
    });
  }
  const configuredControlMode = String(
    env.AI_GATEWAY_LOCAL_CLIENT_CONTROL_STORE_MODE
      ?? env.AI_GATEWAY_WORKFORCE_CONTROL_STORE_MODE
      ?? "",
  ).trim().toLowerCase();
  const controlPostgresUrl = String(
    env.AI_GATEWAY_LOCAL_CLIENT_CONTROL_POSTGRES_URL
      ?? env.AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_URL
      ?? "",
  ).trim();
  const controlMode = configuredControlMode || (controlPostgresUrl ? "postgres" : "local");
  if (controlMode !== "local") {
    throw Object.assign(new Error(
      "This synchronous single-host local-client runtime currently requires local atomic approval/lifecycle control; PostgreSQL readiness wiring is not yet available.",
    ), {
      code: "LOCAL_CLIENT_CONTROL_POSTGRES_STARTUP_PROBE_UNSUPPORTED",
      category: "configuration",
      statusCode: 503,
    });
  }
  const configuredEffectMode = String(env.AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE ?? "")
    .trim()
    .toLowerCase();
  const effectPostgresUrl = String(
    env.AI_GATEWAY_EXTERNAL_EFFECT_POSTGRES_URL
      ?? env.AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_URL
      ?? env.AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL
      ?? "",
  ).trim();
  const effectMode = configuredEffectMode || (effectPostgresUrl ? "postgres" : "sqlite");
  if (effectMode !== "sqlite") {
    throw Object.assign(new Error(
      "This synchronous single-host local-client runtime currently requires SQLite external-effect reservations; PostgreSQL readiness wiring is not yet available.",
    ), {
      code: "LOCAL_CLIENT_EXTERNAL_EFFECT_POSTGRES_STARTUP_PROBE_UNSUPPORTED",
      category: "configuration",
      statusCode: 503,
    });
  }
}

function validateLocalClientIdempotencyConfiguration(env, executionRequested, routePlanMode) {
  if (!executionRequested) return;
  const mode = String(env.AI_GATEWAY_IDEMPOTENCY_STORE_MODE ?? "memory").trim().toLowerCase();
  if (mode !== "sqlite" && mode !== "postgres") {
    throw localClientIdempotencyConfigError(
      "DURABLE_STORE_REQUIRED",
      "Local-client execution requires AI_GATEWAY_IDEMPOTENCY_STORE_MODE=sqlite or postgres.",
    );
  }
  if (mode === "postgres") {
    throw localClientIdempotencyConfigError(
      "POSTGRES_STARTUP_PROBE_UNSUPPORTED",
      "This synchronous single-host local-client runtime currently requires SQLite idempotency; PostgreSQL readiness wiring is not yet available.",
    );
  }
  const secret = env.AI_GATEWAY_IDEMPOTENCY_HMAC_SECRET;
  if (typeof secret !== "string" || Buffer.byteLength(secret) < 32) {
    throw localClientIdempotencyConfigError(
      "HMAC_SECRET_REQUIRED",
      "Local-client execution requires a stable idempotency HMAC secret of at least 32 bytes.",
    );
  }
  const idempotencyPath = resolveLocalClientIdempotencyPath(
    env.AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH,
  );
  if (routePlanMode === "sqlite") {
    const routePlanPath = resolve(
      repoRoot,
      String(
        env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH
          ?? resolve(repoRoot, ".data/local-clients/route-plans.sqlite"),
      ),
    );
    if (idempotencyPath.toLowerCase() === routePlanPath.toLowerCase()) {
      throw localClientIdempotencyConfigError(
        "SQLITE_PATH_CONFLICT",
        "Local-client idempotency and route plans require separate SQLite files.",
      );
    }
  }
  if (readLocalClientExecutionClaimStoreMode(env) === "sqlite") {
    const claimPath = resolveLocalClientExecutionClaimPath(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH,
    );
    if (idempotencyPath.toLowerCase() === claimPath.toLowerCase()) {
      throw localClientIdempotencyConfigError(
        "SQLITE_PATH_CONFLICT",
        "Local-client idempotency and execution claims require separate SQLite files.",
      );
    }
  }
}

function resolveLocalClientIdempotencyPath(value) {
  const path = String(value ?? "");
  if (!path.trim()) {
    throw localClientIdempotencyConfigError(
      "SQLITE_PATH_REQUIRED",
      "SQLite local-client idempotency requires AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH.",
    );
  }
  if (
    path !== path.trim()
    || path.length > 4_096
    || path === ":memory:"
    || path.startsWith("\\\\")
    || path.startsWith("//")
    || /[\u0000-\u001f\u007f]/u.test(path)
  ) {
    throw localClientIdempotencyConfigError(
      "SQLITE_PATH_INVALID",
      "The local-client idempotency SQLite path must be a bounded local file path.",
    );
  }
  const absolute = resolve(repoRoot, path);
  if (absolute.startsWith("\\\\") || absolute.startsWith("//")) {
    throw localClientIdempotencyConfigError(
      "SQLITE_PATH_INVALID",
      "The local-client idempotency SQLite path must remain on this host.",
    );
  }
  return absolute;
}

function localClientIdempotencyConfigError(reason, message) {
  return Object.assign(new Error(message), {
    code: `LOCAL_CLIENT_IDEMPOTENCY_${reason}`,
    category: "configuration",
    statusCode: 503,
  });
}

function validateLocalClientExecutionClaimConfiguration(env, executionRequested, routePlanMode) {
  const mode = readLocalClientExecutionClaimStoreMode(env);
  const multiInstance = readStrictLocalClientExecutionClaimBoolean(
    env.AI_GATEWAY_MULTI_INSTANCE,
    false,
    "AI_GATEWAY_MULTI_INSTANCE",
  );
  if (executionRequested && multiInstance) {
    const error = localClientExecutionClaimConfigError(
      "DISTRIBUTED_REQUIRED",
      "Multi-instance local-client execution requires a distributed claim store; SQLite is single-host only.",
    );
    error.blockers = Object.freeze(["claim_not_distributed"]);
    throw error;
  }
  if (executionRequested && mode !== "sqlite") {
    throw localClientExecutionClaimConfigError(
      "STORE_REQUIRED",
      "Single-host local-client execution requires the explicit SQLite fenced claim store.",
    );
  }
  if (mode !== "sqlite") return;

  requireLocalClientExecutionClaimHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID);
  const claimPath = resolveLocalClientExecutionClaimPath(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH,
  );
  readLocalClientExecutionClaimNamespace(env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_NAMESPACE);
  readStrictLocalClientExecutionClaimInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_TTL_MS,
    60_000,
    10,
    300_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_TTL_MS",
  );
  readStrictLocalClientExecutionClaimInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_MAX_CLAIMS,
    1_024,
    1,
    100_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_MAX_CLAIMS",
  );
  readStrictLocalClientExecutionClaimInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_BUSY_TIMEOUT_MS,
    5_000,
    100,
    30_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_BUSY_TIMEOUT_MS",
  );

  if (routePlanMode === "sqlite") {
    const routePlanPath = resolve(
      repoRoot,
      String(
        env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH
          ?? resolve(repoRoot, ".data/local-clients/route-plans.sqlite"),
      ),
    );
    if (routePlanPath.toLowerCase() === claimPath.toLowerCase()) {
      throw localClientExecutionClaimConfigError(
        "SQLITE_PATH_CONFLICT",
        "Route plans and execution claims require distinct SQLite database paths.",
      );
    }
  }
}

function readStrictLocalClientExecutionClaimBoolean(value, fallback, name) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw localClientExecutionClaimConfigError(
    "CONFIG_INVALID",
    `${name} must be true or false when configured.`,
  );
}

function readStrictBoolean(value, fallback, name) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw localClientAdapterConfigError(`${name}_INVALID`);
}

function decodeLocalClientLoopbackSecret(value) {
  const normalized = String(value ?? "").trim();
  const match = /^hex:([a-f0-9]{64,128})$/iu.exec(normalized);
  if (!match || match[1].length % 2 !== 0) throw localClientAdapterConfigError("SECRET_FORMAT_INVALID");
  return Buffer.from(match[1], "hex");
}

function localClientAdapterConfigError(reason) {
  return Object.assign(new Error("Local-client loopback adapter configuration is incomplete or invalid."), {
    code: `LOCAL_CLIENT_LOOPBACK_${reason}`,
    category: "configuration",
    statusCode: 503,
  });
}

function createConfiguredLocalClientExecutionControl(
  env,
  routePlanTtlMs,
  localClientGovernedMutationRequested = false,
) {
  const mappedEnv = {
    ...env,
    WORKFORCE_EXECUTION_ENABLED: localClientGovernedMutationRequested ? "true" : "false",
    AI_GATEWAY_WORKFORCE_CONTROL_STORE_MODE:
      env.AI_GATEWAY_LOCAL_CLIENT_CONTROL_STORE_MODE
      ?? env.AI_GATEWAY_WORKFORCE_CONTROL_STORE_MODE,
    AI_GATEWAY_WORKFORCE_CONTROL_CENTRAL_REQUIRED:
      env.AI_GATEWAY_LOCAL_CLIENT_CONTROL_CENTRAL_REQUIRED
      ?? env.AI_GATEWAY_WORKFORCE_CONTROL_CENTRAL_REQUIRED,
    AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_URL:
      env.AI_GATEWAY_LOCAL_CLIENT_CONTROL_POSTGRES_URL
      ?? env.AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_URL,
    AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_TLS_REQUIRED:
      env.AI_GATEWAY_LOCAL_CLIENT_CONTROL_POSTGRES_TLS_REQUIRED
      ?? env.AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_TLS_REQUIRED,
    AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_POOL_MAX:
      env.AI_GATEWAY_LOCAL_CLIENT_CONTROL_POSTGRES_POOL_MAX
      ?? env.AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_POOL_MAX,
    AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_STATEMENT_TIMEOUT_MS:
      env.AI_GATEWAY_LOCAL_CLIENT_CONTROL_POSTGRES_STATEMENT_TIMEOUT_MS
      ?? env.AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_STATEMENT_TIMEOUT_MS,
    AI_GATEWAY_WORKFORCE_CONTROL_NAMESPACE:
      env.AI_GATEWAY_LOCAL_CLIENT_CONTROL_NAMESPACE
      ?? "local-client",
    // Local-client execution is an independent control plane and must not
    // silently inherit a Workforce queue/claim database.
    AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_URL: undefined,
    AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL: undefined,
  };
  return createWorkforceExecutionControl({
    env: mappedEnv,
    executionDir: String(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR
        ?? resolve(repoRoot, ".data/local-clients/execution-control"),
    ),
    approvalTtlMs: routePlanTtlMs,
  });
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
