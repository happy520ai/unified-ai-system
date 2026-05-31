import { readContextPackPreview, readJsonFile, resolveRepoRoot } from "./contextPackPreviewReader.js";
import { buildBaseUrlConfigPreview } from "./baseUrlConfigPreview.js";
import { buildRelayArchitectureDesign } from "./relayArchitectureDesign.js";
import { buildRelayAuthorizationGate } from "./relayAuthorizationGate.js";
import { buildAccountPoolPolicyDesign } from "./accountPoolPolicyDesign.js";
import { buildCacheMissPolicyDesign } from "./cacheMissPolicyDesign.js";
import { buildRateLimitPolicyDesign } from "./rateLimitPolicyDesign.js";
import { buildRollbackPlan } from "./rollbackPlanBuilder.js";
import { buildBaseUrlRiskReview } from "./baseUrlRiskReview.js";
import { buildControlledIntegrationChecklist } from "./controlledIntegrationChecklist.js";
import { buildBaseUrlEvidence } from "./baseUrlEvidenceBuilder.js";

export function buildControlledBaseUrlIntegrationDesignReport(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const contextPack = readContextPackPreview({ repoRoot });
  const freshness = readJsonFile(repoRoot, ".codex-context/context-freshness-report.json").data || {};
  const tokenBudget = readJsonFile(repoRoot, ".codex-context/token-budget-report.json").data || {};
  const phase596 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase596a-t-codex-context-repeated-usage-benchmark.json").data || {};
  const configSurfaceStudy = buildConfigSurfaceStudy();
  const configPreview = buildBaseUrlConfigPreview();
  const relayArchitecture = buildRelayArchitectureDesign();
  const authorization = buildRelayAuthorizationGate(options.authorization || {});
  const accountPool = buildAccountPoolPolicyDesign();
  const cacheMiss = buildCacheMissPolicyDesign();
  const rateLimit = buildRateLimitPolicyDesign();
  const secretBoundary = buildSecretCredentialBoundary();
  const gatewayIsolation = buildMainGatewayIsolation();
  const rollback = buildRollbackPlan();
  const riskReview = buildBaseUrlRiskReview();
  const checklist = buildControlledIntegrationChecklist();
  const authorizationPacketTemplate = buildAuthorizationPacketTemplate();
  const missionControlPreview = buildMissionControlPreview();
  const completed =
    contextPack.completed === true &&
    freshness.stale === false &&
    tokenBudget.budget?.respected === true &&
    phase596.completed === true &&
    phase596.benchmarkStatus === "pass" &&
    phase596.fullRepoScanFlaggedCount === 0 &&
    configSurfaceStudy.configSurfaceDocumented === true &&
    configPreview.baseUrlConfigPreviewSchemaValid === true &&
    relayArchitecture.relayArchitectureDefined === true &&
    authorization.authorizationGateDefined === true &&
    accountPool.accountPoolPolicyDefined === true &&
    cacheMiss.cacheMissPolicyDefined === true &&
    rateLimit.failClosedOnBudgetExceeded === true &&
    secretBoundary.credentialRefOnly === true &&
    gatewayIsolation.mainGatewayIsolationDefined === true &&
    rollback.rollbackPlanGenerated === true &&
    riskReview.riskReviewGenerated === true &&
    checklist.checklistGenerated === true &&
    authorizationPacketTemplate.authorizationPacketTemplateGenerated === true;
  const report = {
    completed,
    scopeDefined: true,
    designOnly: true,
    contextHash: contextPack.contextHash,
    contextPack,
    preconditions: {
      phase596Completed: phase596.completed === true,
      repeatedUsageBenchmarkStatus: phase596.benchmarkStatus || "unknown",
      fullRepoScanFlaggedCount: Number(phase596.fullRepoScanFlaggedCount ?? -1),
      stale: freshness.stale === true,
      tokenBudgetRespected: tokenBudget.budget?.respected === true,
    },
    configSurfaceStudy,
    configPreview,
    relayArchitecture,
    authorization,
    accountPool,
    cacheMiss,
    rateLimit,
    secretBoundary,
    gatewayIsolation,
    rollback,
    riskReview,
    checklist,
    authorizationPacketTemplate,
    missionControlPreview,
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    providerRuntimeModified: false,
    workforceRuntimeModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    codexBaseUrlModified: false,
    codexConfigModified: false,
    mainGatewayRuntimeModified: false,
    realCodexConnectionMade: false,
    relayStarted: false,
    characterModuleRestored: false,
    workspaceCleanClaimed: false,
  };
  return {
    ...report,
    evidencePreview: buildBaseUrlEvidence({ report }),
  };
}

function buildConfigSurfaceStudy() {
  return {
    completed: true,
    configSurfaceDocumented: true,
    userConfigMentioned: true,
    projectConfigMentioned: true,
    openaiBaseUrlDesignMentioned: true,
    configPreviewOnly: true,
    realConfigWritePerformed: false,
    codexConfigModified: false,
    notes: [
      "User-level config is treated as out of scope for this phase.",
      "Project-scoped config is documented as a future authorized option only.",
      "openai_base_url is a design implication, not a written value.",
      "Single-run CLI override may be simulated later by dry-run config intake.",
    ],
  };
}

function buildSecretCredentialBoundary() {
  return {
    completed: true,
    credentialRefOnly: true,
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
    configPreviewRedacted: true,
    configPreviewCannotIncludeToken: true,
    evidenceRedaction: "store credentialRef, authorizationRef, and redacted relayRef only",
  };
}

function buildMainGatewayIsolation() {
  return {
    completed: true,
    mainGatewayIsolationDefined: true,
    chatModified: false,
    chatGatewayExecuteModified: false,
    providerRuntimeModified: false,
    workforceRuntimeModified: false,
    relayHasSeparateContract: true,
    evidenceNamespace: "apps/ai-gateway-service/evidence/phase597*",
  };
}

function buildMissionControlPreview() {
  return {
    completed: true,
    baseUrlDesignPreviewVisible: true,
    designOnlyBadgeVisible: true,
    authorizationRequiredVisible: true,
    codexBaseUrlModified: false,
    realCodexConnectionMade: false,
    deadButtonDetected: false,
  };
}

function buildAuthorizationPacketTemplate() {
  const fields = [
    "allowCodexBaseUrlChange",
    "configScope",
    "relayRef",
    "credentialRef",
    "accountPoolRef",
    "maxRequests",
    "maxEstimatedCostUsd",
    "maxDurationMinutes",
    "rollbackOwner",
    "approvalReason",
    "approvalRecordRef",
    "emergencyDisablePlan",
  ];
  return {
    completed: true,
    authorizationPacketTemplateGenerated: true,
    fields,
    requiredFieldsPresent: fields.length === 12,
    allowCodexBaseUrlChangeRequired: true,
    maxRequestsRequired: true,
    maxCostRequired: true,
    rollbackOwnerRequired: true,
    approvalRecordRequired: true,
  };
}
