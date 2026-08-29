import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createErrorEnvelope } from "@unified-ai-system/shared-utils";
import { isPublicRoute } from "../routeAccessPolicy.js";
import { resolveRuntimeRoutePermissionOverride } from "../runtimeRouteAccessManifest.ts";
import { readJson, writeJson } from "./responseUtils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../../..");
const enterpriseAcceptanceReportPath = resolve(repoRoot, "docs/ENTERPRISE_ACCEPTANCE_REPORT.md");
const enterpriseAcceptanceEvidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-43a-enterprise-acceptance-report.json");
const enterpriseReleaseCandidateEvidencePath = resolve(
  repoRoot,
  "apps/ai-gateway-service/evidence/phase-45a-enterprise-release-candidate-dry-run.json",
);

export function readAuditFilters(url) {
  return {
    outcome: url.searchParams.get("outcome"),
    code: url.searchParams.get("code"),
    path: url.searchParams.get("path"),
    userId: url.searchParams.get("userId"),
    tenantId: url.searchParams.get("tenantId"),
    since: url.searchParams.get("since"),
    until: url.searchParams.get("until"),
  };
}

export async function readEnterpriseAcceptanceReport() {
  const [reportMarkdown, evidenceText] = await Promise.all([
    readFile(enterpriseAcceptanceReportPath, "utf8"),
    readFile(enterpriseAcceptanceEvidencePath, "utf8"),
  ]);
  const evidence = JSON.parse(evidenceText);

  return {
    phase: "phase-44a-enterprise-acceptance-ui",
    mode: "read-only-existing-artifacts",
    reportPath: "docs/ENTERPRISE_ACCEPTANCE_REPORT.md",
    evidencePath: "apps/ai-gateway-service/evidence/phase-43a-enterprise-acceptance-report.json",
    reportMarkdown,
    evidence: {
      phase: evidence.phase,
      status: evidence.status,
      generatedAt: evidence.generatedAt,
      conclusion: evidence.conclusion,
      requiredCount: evidence.evidence?.requiredCount ?? 0,
      passedCount: evidence.evidence?.passedCount ?? 0,
      missingCount: evidence.evidence?.missingCount ?? 0,
      failedCount: evidence.evidence?.failedCount ?? 0,
      commandStatus: evidence.commands?.status ?? "unknown",
      boundaryStatus: evidence.boundaries?.status ?? "unknown",
      docsPresent: evidence.docs?.present ?? [],
      safety: {
        readOnlySummary: Boolean(evidence.safety?.readOnlySummary),
        providerCalls: Boolean(evidence.safety?.providerCalls),
        releaseAutomation: Boolean(evidence.safety?.releaseAutomation),
        infrastructureProvisioning: Boolean(evidence.safety?.infrastructureProvisioning),
        secretValuesRecorded: Boolean(evidence.safety?.secretValuesRecorded),
      },
    },
  };
}

export async function readEnterpriseReleaseCandidateDryRun() {
  const evidence = JSON.parse(await readFile(enterpriseReleaseCandidateEvidencePath, "utf8"));
  return {
    phase: "phase-46a-enterprise-release-candidate-ui",
    mode: "read-only-existing-artifacts",
    evidencePath: "apps/ai-gateway-service/evidence/phase-45a-enterprise-release-candidate-dry-run.json",
    releaseCandidate: {
      sourcePhase: evidence.phase,
      status: evidence.status,
      generatedAt: evidence.generatedAt,
      conclusion: evidence.conclusion,
      mode: evidence.releaseCandidate?.mode ?? null,
      packageCreated: Boolean(evidence.releaseCandidate?.packageCreated),
      releaseCreated: Boolean(evidence.releaseCandidate?.releaseCreated),
      artifactPublished: Boolean(evidence.releaseCandidate?.artifactPublished),
    },
    checks: {
      docsStatus: evidence.result?.docs?.status ?? "unknown",
      docsPresent: evidence.result?.docs?.present ?? [],
      scriptsStatus: evidence.result?.scripts?.status ?? "unknown",
      evidenceStatus: evidence.result?.evidence?.status ?? "unknown",
      evidenceRequiredCount: evidence.result?.evidence?.requiredCount ?? 0,
      evidencePassedCount: evidence.result?.evidence?.passedCount ?? 0,
      evidenceMissingCount: evidence.result?.evidence?.missing?.length ?? 0,
      evidenceFailedCount: evidence.result?.evidence?.failed?.length ?? 0,
      uiStatus: evidence.result?.ui?.status ?? "unknown",
      boundaryStatus: evidence.result?.boundaries?.status ?? "unknown",
      envTemplateStatus: evidence.result?.envTemplate?.status ?? "unknown",
      secretScanStatus: evidence.result?.secretScan?.status ?? "unknown",
    },
    safety: {
      readOnlyDryRun: Boolean(evidence.safety?.readOnlyDryRun),
      providerCalls: Boolean(evidence.safety?.providerCalls),
      runtimeMutation: Boolean(evidence.safety?.runtimeMutation),
      releaseAutomation: Boolean(evidence.safety?.releaseAutomation),
      infrastructureProvisioning: Boolean(evidence.safety?.infrastructureProvisioning),
      secretValuesRecorded: Boolean(evidence.safety?.secretValuesRecorded),
    },
  };
}

function normalizePermissionPath(pathname) {
  const path = typeof pathname === "string" ? pathname : "";
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

export async function readEnterpriseOverview(application) {
  const [acceptanceReport, releaseCandidate] = await Promise.all([
    readEnterpriseAcceptanceReport(),
    readEnterpriseReleaseCandidateDryRun(),
  ]);
  const deploymentReadiness = application.enterpriseOpsService.getReadiness();
  const startupReadiness = application.enterpriseOpsService.getStartupReadiness();
  const securityReadiness = application.enterpriseGovernanceService.getSecurityReadiness();
  const vectorReadiness = application.knowledgeInfra.getReadiness();
  const governanceHealth = application.enterpriseGovernanceService.getHealth();

  const checks = [
    {
      id: "deployment_readiness",
      status: deploymentReadiness.status ?? "unknown",
      blockers: deploymentReadiness.blockers ?? [],
      warnings: deploymentReadiness.warnings ?? [],
    },
    {
      id: "startup_readiness",
      status: startupReadiness.status ?? "unknown",
      blockers: startupReadiness.blockers ?? [],
      warnings: startupReadiness.warnings ?? [],
    },
    {
      id: "security_readiness",
      status: securityReadiness.status ?? "unknown",
      blockers: securityReadiness.blockers ?? [],
      warnings: securityReadiness.warnings ?? [],
    },
    {
      id: "vector_readiness",
      status: vectorReadiness.status ?? "unknown",
      blockers: vectorReadiness.blockers ?? [],
      warnings: vectorReadiness.warnings ?? [],
      mode: vectorReadiness.mode ?? "unknown",
    },
    {
      id: "acceptance_report",
      status: acceptanceReport.evidence?.status ?? "unknown",
      blockers: acceptanceReport.evidence?.failedCount ? ["acceptance evidence failed"] : [],
      warnings: [],
      requiredCount: acceptanceReport.evidence?.requiredCount ?? 0,
      passedCount: acceptanceReport.evidence?.passedCount ?? 0,
    },
    {
      id: "release_candidate_dry_run",
      status: releaseCandidate.releaseCandidate?.status ?? "unknown",
      blockers: releaseCandidate.checks?.evidenceFailedCount ? ["release-candidate evidence failed"] : [],
      warnings: [],
      evidenceRequiredCount: releaseCandidate.checks?.evidenceRequiredCount ?? 0,
      evidencePassedCount: releaseCandidate.checks?.evidencePassedCount ?? 0,
    },
  ];

  const blockers = checks
    .filter((check) => check.status === "blocked")
    .flatMap((check) => (check.blockers ?? []).map((blocker) => `${check.id}: ${blocker}`));
  const warnings = checks
    .filter((check) => check.status === "warning" || check.status === "not-ready")
    .flatMap((check) => (check.warnings ?? []).map((warning) => `${check.id}: ${warning}`));

  return {
    phase: "phase-47a-enterprise-overview-ui",
    mode: "read-only-enterprise-overview",
    status: blockers.length ? "blocked" : "ready",
    blockers,
    warnings,
    governance: {
      authEnabled: Boolean(governanceHealth.authEnabled),
      roleCount: governanceHealth.roles?.length ?? 0,
      auditEnabled: Boolean(governanceHealth.audit),
    },
    readiness: {
      deployment: deploymentReadiness,
      startup: startupReadiness,
      security: securityReadiness,
      vector: vectorReadiness,
    },
    acceptance: {
      phase: acceptanceReport.evidence?.phase ?? null,
      status: acceptanceReport.evidence?.status ?? null,
      conclusion: acceptanceReport.evidence?.conclusion ?? null,
      requiredCount: acceptanceReport.evidence?.requiredCount ?? 0,
      passedCount: acceptanceReport.evidence?.passedCount ?? 0,
      missingCount: acceptanceReport.evidence?.missingCount ?? 0,
      failedCount: acceptanceReport.evidence?.failedCount ?? 0,
      reportPath: acceptanceReport.reportPath,
      evidencePath: acceptanceReport.evidencePath,
    },
    releaseCandidate: {
      phase: releaseCandidate.releaseCandidate?.sourcePhase ?? null,
      status: releaseCandidate.releaseCandidate?.status ?? null,
      conclusion: releaseCandidate.releaseCandidate?.conclusion ?? null,
      mode: releaseCandidate.releaseCandidate?.mode ?? null,
      evidencePath: releaseCandidate.evidencePath,
      packageCreated: Boolean(releaseCandidate.releaseCandidate?.packageCreated),
      releaseCreated: Boolean(releaseCandidate.releaseCandidate?.releaseCreated),
      artifactPublished: Boolean(releaseCandidate.releaseCandidate?.artifactPublished),
      evidenceRequiredCount: releaseCandidate.checks?.evidenceRequiredCount ?? 0,
      evidencePassedCount: releaseCandidate.checks?.evidencePassedCount ?? 0,
      evidenceMissingCount: releaseCandidate.checks?.evidenceMissingCount ?? 0,
      evidenceFailedCount: releaseCandidate.checks?.evidenceFailedCount ?? 0,
    },
    safety: {
      readOnlyRoute: true,
      providerCalls: false,
      runtimeMutation: false,
      releaseAutomation: false,
      infrastructureProvisioning: false,
      secretValuesRecorded: false,
    },
    checks,
  };
}

export function buildPhase319FeatureStatus() {
  const features = [
    { id: "new-chat", status: "real_enabled", reason: "清空当前消息、任务和 evidence 状态，不清空模型配置。" },
    { id: "model-config", status: "real_enabled", reason: "读取 Provider 状态和模型库，页面模型选择保存到 localStorage。" },
    { id: "chat-send", status: "real_enabled", reason: "调用 Chat Gateway dry-run/execute 既有链路并显示 evidenceId。" },
    { id: "quick-search", status: "real_enabled", reason: "本地搜索 Workbench 页面、功能入口和帮助文本。" },
    { id: "help", status: "real_enabled", reason: "展示真实使用说明和功能状态边界。" },
    { id: "diagnostics", status: "real_enabled", reason: "只读读取 health、doctor、模型库、Provider、Chat Gateway 状态。" },
    { id: "settings", status: "real_enabled", reason: "语言、主题、安全边界等本地 UI 状态保存到 localStorage。" },
    { id: "provider-config", status: "real_enabled", reason: "保存/测试接真实 route，不显示 API Key 明文。" },
    { id: "local-agent", status: "approval_required", reason: "生成 intent preview、operation plan、approval record 后才允许 approved apply。" },
    { id: "safe-repair", status: "approval_required", reason: "生成 dry-run patch proposal，审批后只允许 allowedFiles 内 apply。" },
    { id: "approvals", status: "approval_required", reason: "审批队列支持 create、approve、reject，rejected 不可执行。" },
    { id: "add-file", status: "approval_required", reason: "只记录用户明确选择的文件名和大小，不存敏感内容。" },
    { id: "plugins", status: "approval_required", reason: "插件注册表真实显示，默认 disabled，执行必须审批。" },
    { id: "full-open", status: "blocked_by_policy", reason: "当前阶段禁止 full-open 和无审批本地命令。" },
    { id: "read-env-secret", status: "blocked_by_policy", reason: "禁止读取 .env 明文、打印 API Key 或泄露 secret/token。" },
    { id: "commit-push-deploy-release", status: "blocked_by_policy", reason: "当前阶段禁止 commit、push、deploy、release。" },
    { id: "git-reset-clean", status: "blocked_by_policy", reason: "禁止破坏性 git reset / git clean。" },
    { id: "paid-api", status: "blocked_by_policy", reason: "禁止自动调用 paid API、MiMo、OpenAI、Claude、OpenRouter。" },
    { id: "embedding-batch-training", status: "blocked_by_policy", reason: "禁止 embedding batch training。" },
  ];
  const counts = features.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  return {
    phase: "Phase319A",
    status: "functional_landing",
    totalFeaturesScanned: features.length,
    realEnabledFeatures: counts.real_enabled || 0,
    approvalRequiredFeatures: counts.approval_required || 0,
    blockedByPolicyFeatures: counts.blocked_by_policy || 0,
    previewOnlyRemaining: 0,
    notImplementedRemaining: 0,
    features,
    providerCalledForBlockedAction: false,
    localExecutionTriggeredWithoutApproval: false,
    unauthorizedFileWriteAttempted: false,
    secretExposed: false,
    defaultChatChanged: false,
    paidApiCalled: false,
    embeddingBatchTrainingCalled: false,
  };
}

export function resolvePermission(method, pathname) {
  const normalizedPath = normalizePermissionPath(pathname);
  const normalizedMethod = (method || "").toUpperCase();

  if (isPublicRoute(normalizedPath)) {
    return "public:read";
  }

  const exactPermission = EXACT_ROUTE_PERMISSIONS[`${normalizedMethod} ${normalizedPath}`];
  if (exactPermission) return exactPermission;

  if (normalizedPath === "/enterprise/session") {
    return "session:read";
  }

  if (normalizedPath === "/enterprise/roles") {
    return "audit:read";
  }

  if (normalizedPath === "/enterprise/users" || normalizedPath === "/enterprise/users/revoke") {
    return "user:admin";
  }

  if (
    normalizedPath === "/enterprise/virtual-keys"
    || normalizedPath === "/enterprise/virtual-keys/revoke"
    || normalizedPath === "/enterprise/guardrails"
    || normalizedPath === "/enterprise/spend-report"
    || normalizedPath === "/enterprise/provider-statement-reconciliation"
  ) {
    return "user:admin";
  }

  if (normalizedPath === "/mcp/tools" || normalizedPath === "/mcp/call") {
    return "workflow:run";
  }

  if (normalizedPath === "/mcp/health") {
    return "dashboard:read";
  }

  if (normalizedPath === "/enterprise/security/readiness") {
    return "audit:read";
  }

  if (normalizedPath === "/enterprise/audit" || normalizedPath === "/enterprise/audit/export") {
    return "audit:read";
  }

  if (normalizedPath === "/enterprise/acceptance/report" || normalizedPath === "/enterprise/release-candidate/dry-run" || normalizedPath === "/enterprise/overview") {
    return "audit:read";
  }

  if (normalizedPath === "/enterprise/deployment/readiness" || normalizedPath === "/enterprise/startup/readiness") {
    return "audit:read";
  }

  if (normalizedPath === "/enterprise/backup" || normalizedPath === "/enterprise/restore/validate") {
    return "user:admin";
  }

  if (
    normalizedPath === "/dashboard/status" ||
    normalizedPath === "/metrics" ||
    normalizedPath === "/observability/status" ||
    normalizedPath === "/workflow/health" ||
    normalizedPath === "/workflow/actions" ||
    normalizedPath === "/workforce/health" ||
    normalizedPath === "/workforce/agents" ||
    (normalizedMethod === "GET" && (normalizedPath === "/workforce/plans" || /^\/workforce\/plans\/[^/]+(\/export|\/review-package)?$/.test(normalizedPath)))
  ) {
    return "dashboard:read";
  }

  if (
    normalizedMethod === "POST" && (
      normalizedPath === "/providers/runtime-credential/detect" ||
      normalizedPath === "/providers/runtime-credential" ||
      normalizedPath === "/provider-config/save" ||
      normalizedPath === "/provider-config/test" ||
      normalizedPath === "/models/import/preview" ||
      normalizedPath === "/models/import/confirm" ||
      normalizedPath === "/model-library/verify-dry-run" ||
      normalizedPath === "/model-library/refresh" ||
      normalizedPath === "/model-library/test-model" ||
      normalizedPath === "/model-library/task-default" ||
      normalizedPath === "/cache/write" ||
      normalizedPath === "/cache/invalidate"
    )
  ) {
    return "provider:write";
  }

  // Usage and cost summaries aggregate across users; treat them as audit
  // grade data instead of generic provider metadata.
  if (
    normalizedPath === "/cost/summary" ||
    normalizedPath === "/usage/summary" ||
    normalizedPath === "/usage/logs"
  ) {
    return "audit:read";
  }

  if (
    normalizedPath === "/providers" ||
    normalizedPath === "/config/runtime" ||
    normalizedPath === "/provider-config/status" ||
    normalizedPath === "/route/modes" ||
    normalizedPath === "/models/import/providers" ||
    normalizedPath === "/model-library" ||
    normalizedPath === "/model-library/usability-matrix" ||
    normalizedPath === "/model-library/verification-plan" ||
    normalizedPath === "/models/capability-router/status" ||
    normalizedPath === "/models/capability-router/preview" ||
    normalizedPath === "/cost/health" ||
    normalizedPath === "/cost/estimate" ||
    normalizedPath === "/cost/guard/check" ||
    normalizedPath === "/cache/health" ||
    normalizedPath === "/cache/lookup" ||
    normalizedPath === "/cache/summary" ||
    normalizedPath === "/cache/audit" ||
    normalizedPath === "/routing/answer-path/preview" ||
    normalizedPath === "/routing/quality-cost/preview" ||
    (normalizedMethod === "GET" && (normalizedPath === "/codex-handoff/next-task" || normalizedPath === "/codex-loop/status" || normalizedPath === "/v1/models" || normalizedPath === "/models" || normalizedPath === "/v1/engines" || normalizedPath === "/engines"))
    || (normalizedMethod === "GET" && /^\/v1\/models\/[^/]+$/.test(normalizedPath))
    || (normalizedMethod === "GET" && /^\/models\/[^/]+$/.test(normalizedPath))
    || (normalizedMethod === "GET" && /^\/v1\/engines\/[^/]+$/.test(normalizedPath))
    || (normalizedMethod === "GET" && /^\/engines\/[^/]+$/.test(normalizedPath))
    || (normalizedMethod === "GET" && normalizedPath === "/v1beta/models")
  ) {
    return "provider:read";
  }

  if (
    normalizedPath === "/forge/polish"
    || normalizedPath === "/forge/memory"
  ) {
    return "chat:use";
  }

  if (
    normalizedPath === "/taiji/compile"
    || normalizedPath === "/workforce/preview"
    || normalizedPath === "/forge/quality"
    || normalizedPath === "/forge/orchestrate"
    || normalizedPath === "/forge/runs"
  ) {
    return "workflow:run";
  }

  if (
    normalizedPath === "/forge/status"
    || normalizedPath === "/forge/consensus"
    || normalizedPath === "/forge/memory/stats"
  ) {
    return "dashboard:read";
  }

  if (normalizedPath.startsWith("/knowledge/") && normalizedMethod === "GET") {
    return "knowledge:read";
  }

  if (normalizedPath === "/knowledge/load" || normalizedPath === "/knowledge/load/file") {
    return "knowledge:write";
  }

  if (normalizedPath === "/knowledge/retrieve" || normalizedPath === "/knowledge/graph/retrieve") {
    return "knowledge:read";
  }

  if (normalizedPath === "/memory/save") {
    return "memory:write";
  }

  if (normalizedPath === "/memory/list" || normalizedPath === "/memory/retrieve") {
    return "knowledge:read";
  }

  if (normalizedPath === "/connectors" || normalizedPath === "/connectors/import/text") {
    return normalizedPath === "/connectors" ? "provider:read" : "connector:write";
  }

  if (normalizedPath === "/evaluation/score") {
    return "evaluation:run";
  }

  if (normalizedPath === "/workflow/plan" || normalizedPath === "/workflow/run") {
    return "workflow:run";
  }

  if (
    normalizedMethod === "POST"
    && (normalizedPath === "/workforce/execute/approve" || normalizedPath === "/workforce/execute/revoke")
  ) {
    return "workflow:approve";
  }

  if (normalizedMethod === "POST" && normalizedPath === "/workforce/execute/status") {
    return "dashboard:read";
  }

  if (normalizedMethod === "POST" && normalizedPath === "/codex-handoff/next-task") {
    return "workflow:run";
  }

  if (
    normalizedPath === "/workforce/plan" ||
    normalizedPath === "/workforce/execute" ||
    normalizedPath === "/workforce/execute/cancel" ||
    normalizedPath === "/workforce/run-local" ||
    normalizedPath === "/real-capabilities/activate-five" ||
    normalizedPath === "/workforce/plans/save" ||
    (normalizedMethod === "POST" && /^\/workforce\/plans\/[^/]+\/(clarifications|lifecycle|approval-gate)$/.test(normalizedPath)) ||
    (normalizedMethod === "DELETE" && /^\/workforce\/plans\/[^/]+$/.test(normalizedPath))
  ) {
    return "workflow:run";
  }

  if (
    normalizedPath === "/v1/images/generations" ||
    normalizedPath === "/images/generations" ||
    normalizedPath === "/v1/embeddings" ||
    normalizedPath === "/embeddings" ||
    normalizedPath === "/v1/audio/speech" ||
    normalizedPath === "/audio/speech" ||
    normalizedPath === "/v1/audio/transcriptions" ||
    normalizedPath === "/audio/transcriptions" ||
    /^\/openai\/deployments\/[^/]+\/(chat\/completions|completions|responses)(\/?)$/.test(normalizedPath) ||
    /^\/v1\/engines\/[^/]+\/(chat\/completions|completions)(\/?)$/.test(normalizedPath) ||
    /^\/v1\/responses\/resp_[A-Za-z0-9_-]{1,64}$/.test(normalizedPath) ||
    normalizedPath === "/chat/completions" ||
    normalizedPath === "/completions" ||
    normalizedPath === "/responses" ||
    normalizedPath === "/prompts/enhance"
    || normalizedPath === "/v1/chat/completions"
    || normalizedPath === "/v1/completions"
    || normalizedPath === "/v1/responses"
    || normalizedPath === "/v1/messages"
    || /^\/(?:v1beta|v1)\/models\/[^/:]+:(generateContent|streamGenerateContent|batchGenerateContent)$/.test(normalizedPath)
    || normalizedPath === "/a2a/jsonrpc"
    || normalizedPath === "/chat"
    || normalizedPath === "/chat/stream"
    || normalizedPath === "/chat/rag"
    || normalizedPath === "/chat/rag/stream"
    || normalizedPath === "/route"
    || normalizedPath === "/gateway/route"
    || normalizedPath === "/gateway/mock"
  ) {
    return "chat:use";
  }

  const runtimePermission = resolveRuntimeRoutePermissionOverride(method, normalizedPath);
  if (runtimePermission) return runtimePermission;

  return "route:unknown";
}

const EXACT_ROUTE_PERMISSIONS = Object.freeze({
  "GET /ws/info": "dashboard:read",
  "GET /api/overview": "dashboard:read",
  "POST /knowledge/delete": "knowledge:write",
  "POST /agent-runner/intent-approval-preview": "workflow:run",
  "POST /agent-runner/local-operation": "workflow:run",
  "POST /agent-exec/run": "workflow:run",
  "GET /usage/my-key": "chat:use",
  "POST /local-agent/intent-preview": "workflow:run",
  "POST /local-agent/operation-plan": "workflow:run",
  "POST /local-agent/patch-proposal": "workflow:run",
  "POST /chat/auto": "chat:use",
  "GET /forge/health": "dashboard:read",
  "GET /runtime-candidate/codex-exec-crs/status": "dashboard:read",
  "GET /capability-router/status": "dashboard:read",
  "GET /five-capability/status": "dashboard:read",
  "GET /user-experience/status": "dashboard:read",
  "GET /workforce/tier": "dashboard:read",
  "POST /workforce/tier": "workflow:run",
  "POST /workforce/tier/gate": "workflow:run",
  "POST /workforce/tier/fallback": "workflow:run",
  "GET /workforce/autonomy/usage": "dashboard:read",
  "GET /workforce/autonomy/trust": "dashboard:read",
  "POST /workforce/autonomy/token": "workflow:run",
  "POST /workforce/autonomy/token/revoke": "workflow:run",
  "POST /workforce/diagnostic/read": "audit:read",
  "GET /local-clients/status": "dashboard:read",
  "GET /local-clients/health": "dashboard:read",
  "GET /local-clients/registry": "audit:read",
  "GET /local-clients/intelligence": "dashboard:read",
  "POST /local-clients/discover": "workflow:approve",
  "POST /local-clients/discover/system": "workflow:approve",
  "POST /local-clients/maintenance": "workflow:approve",
  "POST /local-clients/smart-manage": "workflow:approve",
  "POST /local-clients/register": "workflow:approve",
  "POST /local-clients/disable": "workflow:approve",
  "POST /local-clients/revoke": "workflow:approve",
  "POST /local-clients/route": "workflow:run",
  "POST /local-clients/provider-route": "workflow:run",
  "POST /local-clients/verify": "workflow:approve",
  "POST /local-clients/executions/preview": "workflow:run",
  "POST /local-clients/executions/approve": "workflow:approve",
  "POST /local-clients/executions/execute": "workflow:approve",
  "POST /local-clients/execute": "workflow:approve",
  "POST /local-clients/heartbeat": "local-client:telemetry",
  "POST /local-clients/feedback": "local-client:telemetry",
});

export async function readCapabilityJson({ request, response, startedAt, code }) {
  try {
    const body = await readJson(request);
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Capability request body must be a JSON object.");
    }
    return body;
  } catch {
    writeJson(
      response,
      400,
      createErrorEnvelope(code, "Request body must be a valid JSON object.", {
        startedAt,
        category: "validation",
      }),
    );
    return null;
  }
}

export async function readEnterpriseJson({ request, response, startedAt, code }) {
  try {
    return await readJson(request);
  } catch {
    writeJson(
      response,
      400,
      createErrorEnvelope(code, "Enterprise request body must be valid JSON.", {
        startedAt,
        category: "validation",
      }),
    );
    return null;
  }
}

export function writeEnterpriseError({ response, error, startedAt, fallbackCode }) {
  const explicitStatusCode = Number(error?.statusCode);
  const statusCode = Number.isInteger(explicitStatusCode) && explicitStatusCode >= 400 && explicitStatusCode <= 599
    ? explicitStatusCode
    : error?.category === "validation"
      ? 400
      : error?.category === "auth"
        ? 403
        : 422;
  writeJson(
    response,
    statusCode,
    createErrorEnvelope(error?.code ?? fallbackCode, error instanceof Error ? error.message : "Enterprise request failed.", {
      startedAt,
      category: error?.category ?? "enterprise",
      retryable: false,
      details: error?.details,
    }),
  );
}

export function writeCapabilityError({ response, error, startedAt, fallbackCode }) {
  const explicitStatusCode = Number(error?.statusCode);
  const statusCode = Number.isInteger(explicitStatusCode) && explicitStatusCode >= 400 && explicitStatusCode <= 599
    ? explicitStatusCode
    : error?.category === "validation"
      ? 400
      : error?.category === "auth"
        ? 403
        : 422;
  writeJson(
    response,
    statusCode,
    createErrorEnvelope(error?.code ?? fallbackCode, error instanceof Error ? error.message : "Capability request failed.", {
      startedAt,
      category: error?.category ?? "capability",
      retryable: error?.retryable === true,
      details: error?.details,
    }),
  );
}
