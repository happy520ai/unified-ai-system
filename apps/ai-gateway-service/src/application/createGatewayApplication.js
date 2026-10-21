import { lstatSync } from "node:fs";
import { isAbsolute, join, parse, relative, resolve, sep } from "node:path";
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
import { createCredentialPool } from "../providers/credentialPool.ts";
import {
  restoreRuntimeCredentialProviders,
  isRuntimeCredentialCapableProvider,
  createCredentialPoolSafely,
  createProviderAdapter,
} from "../providers/providerAdapterFactory.js";

// Re-export: the provider adapter factory moved to providers/; existing
// importers of this file keep working unchanged.
export { restoreRuntimeCredentialProviders } from "../providers/providerAdapterFactory.js";
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
import { createGovernanceStateFileBinding } from "../agent-governance/governanceStateAnchor.ts";
import { freezeGovernedAgentTaskProfile } from "../agentic/governedAgentTaskProfile.ts";
import { createGovernedAgentTaskWorkspace } from "../agentic/governedAgentTaskWorkspace.ts";
import { createGovernedAgentTaskRuntime } from "../agentic/governedAgentTaskRuntime.ts";
import { createGovernedAgentTaskPool } from "../agentic/governedAgentTaskPool.ts";
import { inheritResidentExecution } from "../agentic/governedAgentTaskResident.ts";
import { TaskQueueManager } from "../workforce/taskQueueManager.js";
import { inheritVirtualKeyRequestAccounting } from "../enterprise/virtualKeyRequestAccounting.ts";
import {
  resolveAgentGovernanceRuntimeConfiguration,
  resolveAgentGovernanceRegistryConfiguration,
  createConfiguredAgentGovernanceRegistryStore,
  resolveAgentExecWorkingDirectory,
} from "./agentGovernanceConfiguration.js";
import {
  createConfiguredLocalClientFeedbackDedupStore,
  readLocalClientFeedbackDedupStoreMode,
  resolveLocalClientFeedbackDedupPath,
  requireLocalClientFeedbackDedupHostId,
  readLocalClientFeedbackDedupNamespace,
  readStrictLocalClientFeedbackDedupInteger,
  localClientFeedbackDedupConfigError,
  createConfiguredLocalClientExecutionFeedbackOutbox,
  createConfiguredLocalClientExecutionFeedbackDispatcher,
  readLocalClientExecutionFeedbackOutboxStoreMode,
  resolveLocalClientExecutionFeedbackOutboxPath,
  requireLocalClientExecutionFeedbackOutboxHostId,
  readLocalClientExecutionFeedbackOutboxNamespace,
  readStrictLocalClientExecutionFeedbackOutboxInteger,
  localClientExecutionFeedbackOutboxConfigError,
  readStrictLocalClientExecutionFeedbackOutboxBoolean,
} from "./localClientFeedbackConfiguration.js";
import {
  readStrictLocalClientReceiptReconciliationInteger,
  projectLocalClientReceiptJournalReadinessStatus,
  hasConfiguredMcpUpstreams,
  readBoundedNumber,
  createConfiguredLocalClientOnboardingReceiptAuthorityStore,
  registerConfiguredLocalClientAdapters,
  localClientProtocolPrincipalBindingError,
  validateLocalClientStaticConfiguration,
  validateLocalClientPopReplayConfiguration,
  validateLocalClientFeedbackDedupConfiguration,
  validateLocalClientExecutionFeedbackOutboxConfiguration,
  validateLocalClientReceiptReconciliationConfiguration,
  materializeLocalClientOnboardingRuntimeConfiguration,
  zeroLocalClientOnboardingBackupKey,
  validateLocalClientOnboardingGovernanceConfiguration,
  readStrictBoolean,
} from "./localClientConfiguration.js";
import {
  createConfiguredLocalClientAuthorityEpochStore,
  readLocalClientAuthorityEpochStoreMode,
  requireLocalClientAuthorityEpochHostId,
  resolveLocalClientAuthorityEpochPath,
  readLocalClientAuthorityEpochNamespace,
  readStrictLocalClientAuthorityEpochInteger,
  localClientAuthorityEpochConfigError,
  createConfiguredLocalClientRoutePlanStore,
  createConfiguredLocalClientExecutionClaimStore,
  readLocalClientExecutionClaimStoreMode,
  requireLocalClientExecutionClaimHostId,
  resolveLocalClientExecutionClaimPath,
  readLocalClientExecutionClaimNamespace,
  readStrictLocalClientExecutionClaimInteger,
  localClientExecutionClaimConfigError,
  readStrictBoundedInteger,
} from "./localClientStoreConfiguration.js";
import { createLocalWorkflowService } from "../workflow/localWorkflowService.js";
import { createWorkflowRunHandoff } from "../workforce/workflowRunHandoff.js";
import { createWorkforceService } from "../workforce/workforceService.js";
import { createWorkforceLifecycleHooks } from "../workforce/workforceLifecycleHooks.ts";
import { createControlledExecutor } from "../workforce/workforceControlledExecutor.js";
import { createWorkforceRoleProviderFactory } from "../workforce/workforceRoleProvider.ts";
import { freezeWorkforceRoleExecutionProfile } from "../workforce/workforceRoleExecutionProfile.ts";
import { createConfiguredWorkforceRoleSelection } from "../workforce/workforceRoleSelection.ts";
import { freezeWorkforceCodeDeliveryProfile } from "../workforce/workforceCodeDeliveryProfile.ts";
import { createWorkforceCodeDeliveryFactory } from "../workforce/workforceCodeDeliveryRuntime.ts";
import { freezeWorkforceExternalRunnerProfile } from "../workforce/workforceExternalRunnerProfile.ts";
import { createWorkforceExternalRunnerFactory } from "../workforce/workforceExternalRunnerRuntime.ts";
import { createUserExperienceService } from "../capabilities/userExperienceService.js";
import { createCapabilityRouterService } from "../capabilities/capabilityRouterService.js";
import { createEnterpriseGovernanceService } from "../enterprise/enterpriseGovernanceService.js";
import { createAdvancedRBAC } from "../enterprise/advancedRBAC.js";
import { createResponseSessionStore } from "../responses/responseSessionStore.js";
import { createEnterpriseOpsService } from "../enterprise/enterpriseOpsService.js";
import { createCodexExecCrsRuntimeCandidate } from "../runtime-candidate/codexExecCrsRuntimeCandidate.js";
import { createFiveCapabilityActivationService } from "../real-capabilities/fiveCapabilityActivationService.js";
import { createTaijiCapabilityService } from "../real-capabilities/taijiCapabilityService.ts";
import {
  createLocalClientManagementService,
  preflightLocalClientRegistryIntegrity,
} from "../capabilities/localClientManagementService.ts";
import { createLocalClientAdapterRegistry } from "../capabilities/localClientAdapterRegistry.ts";
import { assertLocalClientExecutionReadiness } from "../capabilities/localClientExecutionReadiness.ts";
import {
  createLocalClientLoopbackAdapter,
  createLocalClientLoopbackVerificationProbe,
} from "../capabilities/localClientLoopbackAdapter.ts";
import { createCredentialResolver } from "../credentials/credentialResolver.js";
import { createImConnectorRuntime, readImConnectorConfiguration } from "../connectors/imConnectorRuntime.ts";
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
import { createConfiguredLocalClientPopReplayGuard, readLocalClientPopReplayStoreMode, resolveLocalClientPopReplayPath,
  requireLocalClientPopReplayHostId, readLocalClientPopReplayNamespace, readStrictLocalClientPopReplayInteger,
  localClientPopReplayConfigError } from "../capabilities/localClientPopReplayConfiguration.ts";
import { createNonOwningNativePopReplayGuardPort, isLocalClientNativePopReplayRuntime,
  prepareLocalClientNativePopReplayRuntime } from "../capabilities/localClientNativePopReplayRuntime.ts";
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

function agentLongTaskConfigurationError(reason) {
  return Object.assign(new Error("Governed Agent tasks require a valid local server configuration."), {
    code: `AGENT_LONG_TASK_${reason}`, category: "configuration", statusCode: 503, retryable: false,
  });
}

function parseAgentLongTaskConfiguration(env) {
  const raw = env.AI_GATEWAY_AGENT_LONG_TASK_CONFIG_JSON;
  if (raw === undefined) return null;
  if (typeof raw !== "string" || !raw.trim() || Buffer.byteLength(raw, "utf8") > 262144) throw agentLongTaskConfigurationError("CONFIGURATION_INVALID");
  if (env.AI_GATEWAY_AGENT_GOVERNANCE_ENABLED === "false") throw agentLongTaskConfigurationError("GOVERNANCE_REQUIRED");
  if (![undefined, "false"].includes(env.AI_GATEWAY_MULTI_INSTANCE)
    || ![undefined, "false"].includes(env.AI_GATEWAY_WORKFORCE_CLAIM_STORE_REQUIRED)
    || ![undefined, "", "memory"].includes(env.AI_GATEWAY_WORKFORCE_CLAIM_STORE_MODE)
    || (!env.AI_GATEWAY_WORKFORCE_CLAIM_STORE_MODE && env.AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL)) throw agentLongTaskConfigurationError("LOCAL_STORAGE_REQUIRED");
  let value;
  try { value = JSON.parse(raw); } catch { throw agentLongTaskConfigurationError("CONFIGURATION_INVALID"); }
  function project(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)
      || Object.keys(input).sort().join("|") !== "enginePath|profile|repoRoot|scratchRoot|worktreeRoot"
      || [input.repoRoot, input.worktreeRoot, input.scratchRoot, input.enginePath].some(path => typeof path !== "string" || !isAbsolute(path))) {
      throw agentLongTaskConfigurationError("CONFIGURATION_INVALID");
    }
    return Object.freeze({ ...input, profile: freezeGovernedAgentTaskProfile(input.profile) });
  }
  if (value?.version === 1 && Array.isArray(value.projects)) {
    if (Object.keys(value).sort().join("|") !== "pool|projects|version" || !value.projects.length || value.projects.length > 16
      || !value.pool || Object.keys(value.pool).sort().join("|") !== "chunkIterations|maxConcurrentWorkers|maxDurationMs|maxGoals"
      || !Number.isSafeInteger(value.pool.maxConcurrentWorkers) || value.pool.maxConcurrentWorkers < 1 || value.pool.maxConcurrentWorkers > 8
      || !Number.isSafeInteger(value.pool.maxGoals) || value.pool.maxGoals < 1 || value.pool.maxGoals > 64
      || value.pool.maxConcurrentWorkers > value.pool.maxGoals
      || !Number.isSafeInteger(value.pool.chunkIterations) || value.pool.chunkIterations < 1 || value.pool.chunkIterations > 10
      || !Number.isSafeInteger(value.pool.maxDurationMs) || value.pool.maxDurationMs < 1000 || value.pool.maxDurationMs > 86400000) {
      throw agentLongTaskConfigurationError("CONFIGURATION_INVALID");
    }
    const projects = value.projects.map(project);
    if (new Set(projects.map(entry => entry.profile.projectId)).size !== projects.length) throw agentLongTaskConfigurationError("DUPLICATE_PROJECT");
    return Object.freeze({ projects: Object.freeze(projects), pool: Object.freeze({ ...value.pool }) });
  }
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join("|") !== "enginePath|profile|repoRoot|scratchRoot|worktreeRoot"
    || [value.repoRoot, value.worktreeRoot, value.scratchRoot, value.enginePath].some(path => typeof path !== "string" || !isAbsolute(path))) {
    throw agentLongTaskConfigurationError("CONFIGURATION_INVALID");
  }
  return Object.freeze({ projects: Object.freeze([project(value)]), pool: null });
}

// Provider runtime wiring: runtime config, credential store/pool, health
// scorer, provider registry and its adapters, provider config routes, the
// usage ledger, and the dispatch gate. Extracted verbatim from the assembly
// root (createGatewayApplicationInternal); behaviour unchanged.
function createGatewayProviderRuntime(env) {
  const config = loadRuntimeConfig(env);
  const runtimeCredentialStore = createRuntimeCredentialStore({ env });
  // Multi-key pool: additive layer over the single-credential store. Constructed
  // only when the store is meaningful; a failure here must not break startup,
  // so a broken pool degrades to "no pool" (single-key behavior) with a log.
  const credentialPool = createCredentialPoolSafely(env);

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
    }, config, runtimeCredentialStore, env, credentialPool));
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
    storagePath: env.AI_GATEWAY_MODEL_LIBRARY_STATE_PATH,
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
    return {
      config,
      runtimeCredentialStore,
      credentialPool,
      healthScorer,
      providerRegistry,
      modelImportService,
      responseSessionStore,
      modelLibraryStore,
      providerKeyConfigStore,
      providerConfigRoutes,
      requestLogger,
      providerDispatchGate,
    };
}

function createGatewayApplicationInternal(env, fixtureCapability) {
  const agentLongTaskConfiguration = parseAgentLongTaskConfiguration(env);
  let initializeAgentLongTask;
  let agentLongTaskQueue;
  let agentLongTaskPool;
  let agentLongTaskPromise;
  let agentLongTaskClosing = false;
  let agentLongTaskClosePromise;
  const agentLongTaskAbort = new AbortController();
  const agentLongTaskInFlight = new Set();
  async function getAgentLongTaskRuntime(selector = {}) {
    if (agentLongTaskClosing || !initializeAgentLongTask) throw agentLongTaskConfigurationError("UNAVAILABLE");
    agentLongTaskPromise ??= initializeAgentLongTask();
    const registry = await agentLongTaskPromise;
    if (selector.taskId) {
      const record = agentLongTaskQueue.readRetainedTask(selector.taskId, selector.identity);
      const selected = registry.get(record.continuation.state?.review?.profile?.profileHash);
      if (!selected) throw agentLongTaskConfigurationError("PROFILE_CHANGED");
      return selected;
    }
    if (selector.projectId) {
      const selected = [...registry.values()].find(runtime => runtime.profile.projectId === selector.projectId);
      if (!selected) throw agentLongTaskConfigurationError("PROJECT_NOT_CONFIGURED"); return selected;
    }
    if (registry.size !== 1) throw agentLongTaskConfigurationError("PROJECT_REQUIRED");
    return registry.values().next().value;
  }
  async function startAgentLongTaskRuntime() {
    if (agentLongTaskConfiguration?.pool) {
      if (agentLongTaskClosing || !initializeAgentLongTask) throw agentLongTaskConfigurationError("UNAVAILABLE");
      agentLongTaskPromise ??= initializeAgentLongTask();
      await agentLongTaskPromise;
    }
  }
  function closeAgentLongTaskRuntime() {
    agentLongTaskClosing = true;
    agentLongTaskClosePromise ??= (async () => {
      await Promise.allSettled(agentLongTaskPromise ? [agentLongTaskPromise] : []);
      let firstError;
      try { await agentLongTaskPool?.close(); }
      catch (error) { firstError = error; }
      finally { agentLongTaskAbort.abort(agentLongTaskConfigurationError("SHUTDOWN")); }
      await Promise.allSettled([...agentLongTaskInFlight]);
      try { await agentLongTaskQueue?.close(); }
      catch (error) { if (!firstError) firstError = error; }
      if (firstError) throw firstError;
    })();
    return agentLongTaskClosePromise;
  }
  const hookSetting = env.AI_GATEWAY_WORKFORCE_LIFECYCLE_HOOKS_ENABLED;
  if (hookSetting !== undefined && hookSetting !== "true" && hookSetting !== "false") {
    throw Object.assign(new Error("Workforce lifecycle hooks must be explicitly true or false."), { code: "WORKFORCE_HOOK_CONFIGURATION_INVALID" });
  }
  const workforceLifecycleHooks = createWorkforceLifecycleHooks({ enabled: hookSetting === "true" });
  const externalRunnerSetting = env.AI_GATEWAY_WORKFORCE_EXTERNAL_RUNNER_ENABLED;
  if (externalRunnerSetting !== undefined && externalRunnerSetting !== "true" && externalRunnerSetting !== "false") {
    throw Object.assign(new Error("Native Workforce execution must be explicitly true or false."), { code: "WORKFORCE_EXTERNAL_RUNNER_CONFIGURATION_INVALID" });
  }
  let workforceExternalRunnerProfiles = [];
  const externalRunnerJson = String(env.AI_GATEWAY_WORKFORCE_EXTERNAL_RUNNER_PROFILES_JSON ?? "").trim();
  if (externalRunnerJson) {
    if (Buffer.byteLength(externalRunnerJson, "utf8") > 262144) throw new Error("Native Workforce profile configuration exceeds its limit.");
    let profiles;
    try { profiles = JSON.parse(externalRunnerJson); } catch { throw new Error("Native Workforce profiles must be a JSON array."); }
    if (!Array.isArray(profiles) || profiles.length > 16) throw new Error("At most sixteen native Workforce profiles may be configured.");
    workforceExternalRunnerProfiles = profiles.map(profile => { freezeWorkforceExternalRunnerProfile(profile); return profile; });
  }
  let workforceCodeDeliveryProfiles = [];
  const codeDeliveryJson = String(env.AI_GATEWAY_WORKFORCE_CODE_DELIVERY_PROFILES_JSON ?? "").trim();
  if (codeDeliveryJson) {
    if (Buffer.byteLength(codeDeliveryJson, "utf8") > 262144) throw new Error("Workforce code profile configuration exceeds its limit.");
    let profiles;
    try { profiles = JSON.parse(codeDeliveryJson); } catch { throw new Error("Workforce code profiles must be a JSON array."); }
    if (!Array.isArray(profiles) || profiles.length > 16) throw new Error("At most sixteen Workforce code profiles may be configured.");
    workforceCodeDeliveryProfiles = profiles.map(profile => { freezeWorkforceCodeDeliveryProfile(profile); return profile; });
  }
  let workforceRoleExecutionProfile = null;
  let workforceRoleSelectionConfiguration = null;
  const selectionJson = String(env.AI_GATEWAY_WORKFORCE_ROLE_SELECTION_JSON ?? "").trim();
  if (selectionJson) {
    if (String(env.AI_GATEWAY_WORKFORCE_ROLE_EXECUTION_PROFILE_JSON ?? "").trim() || Buffer.byteLength(selectionJson, "utf8") > 65_536) {
      throw new Error("Configure one bounded Workforce role selection or manual profile, not both.");
    }
    try { workforceRoleSelectionConfiguration = JSON.parse(selectionJson); }
    catch { throw new Error("AI_GATEWAY_WORKFORCE_ROLE_SELECTION_JSON must contain a valid server selection configuration."); }
  }
  if (String(env.AI_GATEWAY_WORKFORCE_ROLE_EXECUTION_PROFILE_JSON ?? "").trim()) {
    let profileInput;
    try { profileInput = JSON.parse(env.AI_GATEWAY_WORKFORCE_ROLE_EXECUTION_PROFILE_JSON); }
    catch { throw new Error("AI_GATEWAY_WORKFORCE_ROLE_EXECUTION_PROFILE_JSON must contain a valid execution profile."); }
    workforceRoleExecutionProfile = freezeWorkforceRoleExecutionProfile(profileInput);
  }
  const agentExecWorkingDirectory = resolveAgentExecWorkingDirectory(env);
  const localClientFixtureReceiptClosure =
    fixtureCapability === LOCAL_CLIENT_FIXTURE_RECEIPT_CLOSURE_CAPABILITY;
  const parsedLocalClientOnboardingConfiguration = resolveLocalClientOnboardingConfiguration(env);
  const imConnectorConfiguration = readImConnectorConfiguration(env);
  const taijiRuntimeEnabled = readStrictBoolean(env.TAIJI_BEIDOU_AUTO_RUNTIME_ENABLED, false, "TAIJI_BEIDOU_AUTO_RUNTIME_ENABLED");
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
  if (taijiRuntimeEnabled && localClientMultiInstanceRequested) {
    throw Object.assign(new Error("Taiji capability state currently requires a single gateway process."), { code: "TAIJI_STORAGE_PROFILE_UNSUPPORTED" });
  }
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
  const {
    config,
    providerExecutionConfig,
    runtimeCredentialStore,
    credentialPool,
    healthScorer,
    providerRegistry,
    modelImportService,
    responseSessionStore,
    modelLibraryStore,
    providerKeyConfigStore,
    providerConfigRoutes,
    requestLogger,
    providerDispatchGate,
  } = createGatewayProviderRuntime(env);
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
    lifecycleHooks: workforceLifecycleHooks,
    knowledgeService,
    outputDir: env.WORKFLOW_OUTPUT_DIR,
  });
  const workforceService = createWorkforceService({
    env,
    lifecycleHooks: workforceLifecycleHooks,
  });
  const workforceExecutor = createControlledExecutor({
    env,
    repoRoot,
    executionDir: env.WORKFORCE_EXECUTION_DIR,
    workflowHandoffRuntime: createWorkflowRunHandoff({ workflowService }),
    externalRunnerProfiles: workforceExternalRunnerProfiles,
    externalRunnerFactory: externalRunnerSetting === "true" ? createWorkforceExternalRunnerFactory({ repoRoot,
      enginePath: env.AI_GATEWAY_WORKFORCE_EXTERNAL_RUNNER_ENGINE_PATH,
      windowsHost: { path: env.AI_GATEWAY_WORKFORCE_EXTERNAL_RUNNER_HOST_PATH, sha256: env.AI_GATEWAY_WORKFORCE_EXTERNAL_RUNNER_HOST_SHA256 },
      ...(env.AI_GATEWAY_WORKFORCE_EXTERNAL_RUNNER_SCRATCH_ROOT ? { scratchRoot: env.AI_GATEWAY_WORKFORCE_EXTERNAL_RUNNER_SCRATCH_ROOT } : {}) }) : null,
    codeDeliveryProfiles: workforceCodeDeliveryProfiles,
    codeDeliveryFactory: env.AI_GATEWAY_WORKFORCE_CODE_DELIVERY_ENABLED === "true"
      ? createWorkforceCodeDeliveryFactory({ repoRoot,
          enginePath: env.AI_GATEWAY_WORKFORCE_CODE_DELIVERY_ENGINE_PATH,
          ...(env.AI_GATEWAY_WORKFORCE_CODE_DELIVERY_SCRATCH_ROOT
            ? { scratchRoot: env.AI_GATEWAY_WORKFORCE_CODE_DELIVERY_SCRATCH_ROOT } : {}) }) : null,
    roleProviderFactory: workforceRoleExecutionProfile ? createWorkforceRoleProviderFactory({
      gatewayService, providerRegistry, profile: workforceRoleExecutionProfile,
    }) : null,
    roleSelection: selectionJson ? createConfiguredWorkforceRoleSelection({
      gatewayService, providerRegistry, configuration: workforceRoleSelectionConfiguration,
    }) : null,
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
  if (agentLongTaskConfiguration && !agentGovernanceEnabled) throw agentLongTaskConfigurationError("GOVERNANCE_REQUIRED");
  let agentGovernance = null;
  let taijiCapabilityService = null;
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
    if (agentLongTaskConfiguration && registryConfiguration.mode === "postgres") throw agentLongTaskConfigurationError("LOCAL_STORAGE_REQUIRED");
    if (taijiRuntimeEnabled && registryConfiguration.mode === "postgres") {
      throw Object.assign(new Error("Taiji capability state currently requires the local governance profile."), { code: "TAIJI_STORAGE_PROFILE_UNSUPPORTED" });
    }
    // Establish the no-link/private-ACL governance root before a database can
    // create its authority/checkpoint files in that directory.
    const governanceSecret = resolveGovernanceSecret({ env, dataDir: agentGovernanceDataDir });
    const agentRegistryStore = createConfiguredAgentGovernanceRegistryStore({
      configuration: registryConfiguration,
      dataDir: agentGovernanceDataDir,
      secret: governanceSecret,
    });
    let agentGovernanceService;
    try {
      agentGovernanceService = createAgentGovernanceService({
        env,
        dataDir: agentGovernanceDataDir,
        modelProposer,
        ...(agentRegistryStore
          ? { stores: { registry: agentRegistryStore } }
          : { registryAuthority: registryConfiguration.authorityBinding }),
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
    if (agentLongTaskConfiguration) {
      initializeAgentLongTask = async () => {
        const queueFile = join(agentGovernanceDataDir, "agent-long-tasks.json");
        agentLongTaskQueue = new TaskQueueManager({ queueFile, retainedTasks: true,
          env: { AI_GATEWAY_WORKFORCE_CLAIM_STORE_MODE: "memory" },
          retainedStateBinding: createGovernanceStateFileBinding({ filePath: queueFile, secret: governanceSecret, kind: "json",
            validateLegacy() { throw agentLongTaskConfigurationError("UNSIGNED_STATE_REJECTED"); } }) });
        await agentLongTaskQueue.init();
        const registry = new Map(), rawRuntimes = new Map();
        for (const project of agentLongTaskConfiguration.projects) {
          const workspace = createGovernedAgentTaskWorkspace(project);
          const runtime = createGovernedAgentTaskRuntime({ queue: agentLongTaskQueue, workspace,
            governance: agentGovernance.service, toolProxy: agentGovernance.toolProxy, gatewayService, providerRegistry });
          rawRuntimes.set(runtime.profile.profileHash, runtime);
          const wrapped = { profile: runtime.profile };
          for (const name of ["prepare", "read", "plan", "confirm", "run", "control", "reconcile", "scheduleInPool"]) {
          wrapped[name] = (...args) => {
            if (agentLongTaskClosing) return Promise.reject(agentLongTaskConfigurationError("SHUTDOWN"));
            const identityIndex = name === "prepare" ? 0 : 1, identity = args[identityIndex];
            const execution = { ...identity.execution, signal: AbortSignal.any([identity.execution.signal, agentLongTaskAbort.signal]) };
            inheritVirtualKeyRequestAccounting(identity.execution, execution);
            inheritResidentExecution(identity.execution, execution);
            args[identityIndex] = { ...identity, execution };
            const pending = Promise.resolve().then(async () => {
              if (name === "scheduleInPool") {
                if (!agentLongTaskPool) throw agentLongTaskConfigurationError("POOL_NOT_CONFIGURED");
                return agentLongTaskPool.schedule(runtime, ...args);
              }
              if (name === "control" && agentLongTaskPool) return agentLongTaskPool.control(runtime, ...args);
              return runtime[name](...args);
            });
            agentLongTaskInFlight.add(pending);
            void pending.finally(() => agentLongTaskInFlight.delete(pending)).catch(() => {});
            return pending;
          };
          }
          registry.set(runtime.profile.profileHash, Object.freeze(wrapped));
        }
        if (agentLongTaskConfiguration.pool) {
          agentLongTaskPool = createGovernedAgentTaskPool({ queue: agentLongTaskQueue, runtimes: rawRuntimes,
            config: agentLongTaskConfiguration.pool, enterprise: enterpriseGovernanceService, signal: agentLongTaskAbort.signal });
          await agentLongTaskPool.recover();
        }
        return registry;
      };
    }
  }
  if (agentGovernance) {
    taijiCapabilityService = createTaijiCapabilityService({
      dataDir: agentGovernance.dataDir,
      secret: resolveGovernanceSecret({ env, dataDir: agentGovernance.dataDir }),
      enabled: () => taijiRuntimeEnabled,
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
      workforceService,
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
      workforceService,
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
      workforceService,
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
      workforceService,
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
      workforceService,
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
    get configured() { return localClientAdapterConfiguration.popAuthorityRegistry?.nativeReplayProtection !== null
      && localClientAdapterConfiguration.popAuthorityRegistry?.nativeReplayProtection !== undefined; },
    get ready() { return localClientAdapterConfiguration.popAuthorityRegistry?.nativeReplayProtection?.ready === true; },
    get snapshotRollbackProtected() { return this.ready; },
    get nativeDeploymentVerified() { return this.ready; },
    get blockers() { return this.configured ? this.ready ? Object.freeze([]) : Object.freeze(["native_pop_replay_runtime_unavailable"])
      : LOCAL_CLIENT_POP_SNAPSHOT_ROLLBACK_NATIVE_DEPLOYMENT_BLOCKERS; },
    get boundaries() { return this.configured ? Object.freeze({ ...LOCAL_CLIENT_POP_SNAPSHOT_ROLLBACK_BOUNDARIES,
      mutatesOperatingSystem: true, nativeWindowsAdapterImplemented: true, sqliteCheckpointCoordinatorImplemented: true })
      : LOCAL_CLIENT_POP_SNAPSHOT_ROLLBACK_BOUNDARIES; },
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
    taijiCapabilityService,
  });

  return {
    agentGovernance,
    getAgentLongTaskRuntime,
    startAgentLongTaskRuntime,
    closeAgentLongTaskRuntime,
    taijiCapabilityService,
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
    imConnectorRuntime: createImConnectorRuntime({ env, gate: externalEffectGate, configuration: imConnectorConfiguration }),
    runtimeEnv: env,
    runtimeCredentialStore,
    credentialPool,
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
    || env.FEISHU_CONNECTOR_MODE === "api"
    || Boolean(String(env.FEISHU_WEBHOOK_URL ?? "").trim())
    || Boolean(String(env.WECOM_WEBHOOK_URL ?? "").trim())
    || hasConfiguredMcpUpstreams(env.MCP_UPSTREAM_SERVERS_JSON);
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
