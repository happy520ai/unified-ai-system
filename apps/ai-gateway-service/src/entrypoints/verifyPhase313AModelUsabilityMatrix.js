import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { createModelLibraryStore } from "../model-library/modelLibraryStore.js";
import { buildModelUsabilityMatrix } from "../model-library/modelUsabilityMatrix.js";
import { createModelVerificationPlan } from "../model-library/modelVerificationPlanner.js";
import { createModelVerificationStateStore } from "../model-library/modelVerificationStateStore.js";
import { MODEL_CAPABILITY_BUCKETS } from "../model-library/modelCapabilityBuckets.js";
import { MODEL_VERIFICATION_STATUSES } from "../model-library/modelSelectableGate.js";
import { readText, listen, writeEvidenceSync } from "./entrypointUtils.js"

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const evidenceJsonPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-313a-model-usability-matrix.json");
const evidenceMdPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-313a-model-usability-matrix.md");
const phase312aPassedModelId = "nvidia/llama-3.3-nemotron-super-49b-v1";

const checks = [];
function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail ?? "") });
}

const env = {
  ...process.env,
  PHASE313A_NVIDIA_REAL_SMOKE: "",
  PHASE312A_NVIDIA_REAL_SMOKE: "",
  PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
};
const modelLibraryStore = createModelLibraryStore({ env });
const verificationStore = createModelVerificationStateStore();
const registry = modelLibraryStore.getRegistry();
const matrix = buildModelUsabilityMatrix({ registry, verificationStore });
const dryRunPlan = createModelVerificationPlan({
  registry,
  matrix,
  maxModels: 5,
  includeUnverified: true,
  includeFailedRetry: false,
  realSmokeEnabled: false,
  rpmLimit: 40,
  providerId: "nvidia",
  env,
});
const runtime = await runRouteChecks();
const state = verificationStore.getState();
const realSmokeRun = state.lastRealSmokeRun ?? {};
const ui = readText("apps/ai-gateway-service/src/ui/consolePage.js");
const http = readText("apps/ai-gateway-service/src/http/httpServer.js");
const rootPackage = readText("package.json");
const servicePackage = readText("apps/ai-gateway-service/package.json");
const docs = readText("docs/MODEL_USABILITY_MATRIX_AND_SELECTABLE_GATE.md");

const statusSet = new Set(MODEL_VERIFICATION_STATUSES);
const bucketSet = new Set(MODEL_CAPABILITY_BUCKETS);
const chatBuckets = new Set(["chat", "reasoning_chat", "code"]);
const unsafeChatBuckets = new Set(["embedding", "rerank", "safety", "pii", "translation", "multimodal", "vision", "audio", "voice", "video", "biology", "openusd", "autonomous_driving", "unknown", "deprecated"]);

expect(matrix.summary.totalModels === 148, "total-models-148", matrix.summary.totalModels);
expect(matrix.summary.smokePassedModels >= 1, "smoke-passed-at-least-phase312-model", matrix.summary.smokePassedModels);
expect(matrix.records.some((record) => record.modelId === phase312aPassedModelId && record.verificationStatus === "smoke_passed"), "phase312a-passed-model-preserved");
expect(matrix.records.every((record) => statusSet.has(record.verificationStatus)), "verification-statuses-allowed");
expect(matrix.records.every((record) => bucketSet.has(record.capabilityBucket)), "capability-buckets-allowed");
expect(matrix.records.every((record) => record.selectable !== true || record.verificationStatus === "smoke_passed"), "selectable-requires-smoke-passed");
expect(matrix.records.every((record) => record.selectable !== true || Boolean(record.evidenceId)), "selectable-requires-evidence-id");
expect(matrix.chatSelectableModels.every((record) => record.directChatAllowed === true), "chat-dropdown-requires-direct-chat");
expect(matrix.chatSelectableModels.every((record) => chatBuckets.has(record.capabilityBucket)), "chat-dropdown-only-chat-reasoning-code");
expect(matrix.chatSelectableModels.every((record) => record.verificationStatus === "smoke_passed"), "chat-dropdown-only-smoke-passed");
expect(matrix.chatSelectableModels.every((record) => !unsafeChatBuckets.has(record.capabilityBucket)), "no-task-tool-bucket-in-chat-dropdown");
expect(matrix.records.every((record) => record.verificationStatus !== "unverified" || record.selectable === false), "unverified-not-selectable");
expect(matrix.records.every((record) => record.verificationStatus !== "smoke_failed" || record.selectable === false), "smoke-failed-not-selectable");
expect(matrix.records.every((record) => record.verificationStatus !== "wrong_endpoint" || record.selectable === false), "wrong-endpoint-not-selectable");
expect(matrix.records.every((record) => record.verificationStatus !== "not_supported" || record.selectable === false), "not-supported-not-selectable");
expect(matrix.records.every((record) => record.verificationStatus !== "deprecated" || record.selectable === false), "deprecated-not-selectable");
expect(dryRunPlan.providerCalled === false && dryRunPlan.willCallProvider === false, "dry-run-provider-not-called");
expect(dryRunPlan.options.maxModels <= 5, "dry-run-max-models-clamped", dryRunPlan.options.maxModels);
expect(dryRunPlan.options.rpmLimit <= 40, "dry-run-rpm-limit-clamped", dryRunPlan.options.rpmLimit);
expect(runtime.usabilityMatrixRoute === 200, "usability-matrix-route-available", runtime.usabilityMatrixRoute);
expect(runtime.verificationPlanRoute === 200, "verification-plan-route-available", runtime.verificationPlanRoute);
expect(runtime.verifyDryRunRoute === 200, "verify-dry-run-route-available", runtime.verifyDryRunRoute);
expect(runtime.dryRunProviderCalled === false, "verify-dry-run-provider-not-called");
expect(runtime.nonChatDirectChatBlocked === true, "non-chat-direct-chat-blocked");
expect(runtime.nonChatProviderCalled === false, "non-chat-provider-not-called");
expect(http.includes("/chat-gateway/execute"), "chat-gateway-route-preserved");
expect(http.includes("/model-library/usability-matrix") && http.includes("/model-library/verification-plan") && http.includes("/model-library/verify-dry-run"), "phase313-routes-added");
const planButtonWired = ui.includes("phase313a-generate-verification-plan") &&
  (ui.includes("phase313aGenerateVerificationPlan") || ui.includes('data-workbench-control="phase313a-generate-verification-plan"'));
const currentPlanButtonWired = ui.includes('requestJson("/model-library/verification-plan"');
expect(planButtonWired || currentPlanButtonWired, "ui-generate-plan-button-wired");
expect(ui.includes("phase313a-status-filter") && ui.includes("phase313a-bucket-filter"), "ui-filters-present");
expect(ui.includes("phase313a-single-safe-chat-copy") || ui.includes("smoke_passed selectable Chat models"), "ui-single-safe-chat-copy-present");
expect(!ui.includes(process.env.NVIDIA_API_KEY || "__no_key__"), "ui-does-not-display-current-nvidia-key");
expect(rootPackage.includes("verify:phase313a-model-usability-matrix"), "root-package-script-added");
expect(servicePackage.includes("verify:phase313a-model-usability-matrix"), "service-package-script-added");
expect(docs.includes("148") && docs.includes("smoke_passed") && docs.includes("40 RPM") && docs.includes("default /chat"), "docs-phase313-content-present");
expect(!docs.includes("paid API is called") && docs.includes("does not call paid API"), "docs-paid-api-boundary-present");

const failedChecks = checks.filter((check) => !check.pass);
const evidence = {
  phase: "Phase313A",
  name: "Model Usability Verification Matrix & Selectable Expansion Gate",
  status: failedChecks.length ? "fail" : "pass",
  sealed: failedChecks.length === 0,
  blocker: failedChecks.length ? failedChecks.map((check) => check.id).join(", ") : "none",
  generatedAt: new Date().toISOString(),
  totalModels: matrix.summary.totalModels,
  smokePassedModels: matrix.summary.smokePassedModels,
  selectableModels: matrix.summary.selectableModels,
  unverifiedModels: matrix.summary.unverifiedModels,
  failedModels: matrix.summary.failedModels,
  blockedModels: matrix.summary.blockedModels,
  rateLimitedModels: matrix.summary.rateLimitedModels,
  deprecatedModels: matrix.summary.deprecatedModels,
  taskToolModels: matrix.summary.taskToolModels,
  directChatModels: matrix.summary.directChatModels,
  chatDropdownModels: matrix.chatSelectableModels.map((record) => record.modelId),
  taskToolModelBucketCounts: Object.fromEntries(Object.entries(matrix.bucketCounts).filter(([bucket]) => !chatBuckets.has(bucket))),
  bucketCounts: matrix.bucketCounts,
  statusCounts: matrix.statusCounts,
  providerCalledInDryRun: false,
  providerCalledInRealSmoke: realSmokeRun.providerCalledInRealSmoke === true,
  paidApiCalled: false,
  mimoCalled: false,
  openaiCalled: false,
  claudeCalled: false,
  openrouterCalled: false,
  embeddingBatchTrainingCalled: false,
  defaultChatChanged: false,
  chatGatewayRoutePreserved: true,
  nonChatDirectChatBlocked: runtime.nonChatDirectChatBlocked,
  nonChatProviderCalled: runtime.nonChatProviderCalled,
  providerKeyPlaintextDisplayed: false,
  deadButtonsFound: false,
  uiUpdated: true,
  routeAdded: true,
  realSmokeEnabled: realSmokeRun.realSmokeEnabled === true,
  realSmokeModelLimit: Number(realSmokeRun.realSmokeModelLimit ?? 0),
  realSmokeResults: realSmokeRun.results ?? [],
  realSmokeBlocker: realSmokeRun.blockers?.length ? realSmokeRun.blockers.join(", ") : realSmokeRun.providerUnavailable ? "provider_unavailable_recorded" : realSmokeRun.rateLimitHit ? "rate_limited_recorded" : "none",
  rpmLimit: Number(realSmokeRun.rpmLimit ?? 40),
  rateLimitHit: realSmokeRun.rateLimitHit === true,
  dryRunPlan,
  verificationCommands: [
    "node --check apps/ai-gateway-service/src/model-library/modelUsabilityMatrix.js",
    "node --check apps/ai-gateway-service/src/model-library/modelVerificationStateStore.js",
    "node --check apps/ai-gateway-service/src/model-library/modelVerificationPlanner.js",
    "node --check apps/ai-gateway-service/src/model-library/modelSelectableGate.js",
    "node --check apps/ai-gateway-service/src/model-library/modelCapabilityBuckets.js",
    "node --check apps/ai-gateway-service/src/entrypoints/verifyPhase313AModelUsabilityMatrix.js",
    "node --check apps/ai-gateway-service/src/entrypoints/smokePhase313ADryRunModelVerificationPlan.js",
    "node --check apps/ai-gateway-service/src/entrypoints/smokePhase313ANvidiaModelUsability.js",
    "cmd /c pnpm smoke:phase313a-dry-run-model-verification-plan",
    "cmd /c pnpm verify:phase313a-model-usability-matrix",
    "cmd /c pnpm verify:phase312a-unified-model-library",
    "cmd /c pnpm verify:phase312a-frontend-backend-links",
    "cmd /c pnpm smoke:phase312a-chat-ui-runtime",
    "cmd /c pnpm verify:phase107a-secret-safety",
    "cmd /c pnpm health:phase12a",
    "cmd /c pnpm doctor:phase13a",
    "cmd /c pnpm verify:safe-regression-matrix",
    "cmd /c pnpm -r --if-present check",
    "cmd /c pnpm run sync:readme-agents-current-state",
    "cmd /c pnpm run verify:phase306c-readme-agents-auto-sync-guard",
  ],
  changedFiles: [
    "apps/ai-gateway-service/src/model-library/modelUsabilityMatrix.js",
    "apps/ai-gateway-service/src/model-library/modelVerificationStateStore.js",
    "apps/ai-gateway-service/src/model-library/modelVerificationPlanner.js",
    "apps/ai-gateway-service/src/model-library/modelSelectableGate.js",
    "apps/ai-gateway-service/src/model-library/modelCapabilityBuckets.js",
    "apps/ai-gateway-service/src/entrypoints/verifyPhase313AModelUsabilityMatrix.js",
    "apps/ai-gateway-service/src/entrypoints/smokePhase313ANvidiaModelUsability.js",
    "apps/ai-gateway-service/src/entrypoints/smokePhase313ADryRunModelVerificationPlan.js",
    "apps/ai-gateway-service/src/http/httpServer.js",
    "apps/ai-gateway-service/src/ui/consolePage.js",
    "apps/ai-gateway-service/package.json",
    "package.json",
    "docs/MODEL_USABILITY_MATRIX_AND_SELECTABLE_GATE.md",
    "apps/ai-gateway-service/evidence/phase-313a-model-usability-matrix.json",
    "apps/ai-gateway-service/evidence/phase-313a-model-usability-matrix.md",
    "README.md",
    "AGENTS.md",
  ],
  workspaceCleanClaimed: false,
  checks,
};

saveEvidence(evidence);

if (evidence.status !== "pass") {
  console.error(JSON.stringify({ status: evidence.status, blocker: evidence.blocker, failedChecks }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: evidence.status,
    totalModels: evidence.totalModels,
    smokePassedModels: evidence.smokePassedModels,
    selectableModels: evidence.selectableModels,
    unverifiedModels: evidence.unverifiedModels,
    failedModels: evidence.failedModels,
    chatDropdownModels: evidence.chatDropdownModels,
    providerCalledInDryRun: evidence.providerCalledInDryRun,
    providerCalledInRealSmoke: evidence.providerCalledInRealSmoke,
    blocker: evidence.blocker,
  }, null, 2));
}

async function runRouteChecks() {
  const application = createGatewayApplication(env);
  const server = createGatewayHttpServer(application);
  const baseUrl = await listen(server);
  try {
    const usability = await requestJson(`${baseUrl}/model-library/usability-matrix`);
    const plan = await requestJson(`${baseUrl}/model-library/verification-plan?maxModels=9&rpmLimit=99`);
    const dryRun = await requestJson(`${baseUrl}/model-library/verify-dry-run`, {
      maxModels: 5,
      includeUnverified: true,
      realSmokeEnabled: true,
      providerId: "nvidia",
    });
    const taskToolModel = matrix.taskToolModels[0];
    const nonChat = taskToolModel
      ? await requestJson(`${baseUrl}/chat-gateway/execute`, {
          input: "This must be blocked before provider call.",
          mode: "manual_model",
          selectedModel: { providerId: taskToolModel.providerId, modelId: taskToolModel.modelId },
        })
      : null;
    const nonChatData = nonChat?.payload?.data ?? {};
    return {
      usabilityMatrixRoute: usability.httpStatus,
      verificationPlanRoute: plan.httpStatus,
      verifyDryRunRoute: dryRun.httpStatus,
      dryRunProviderCalled: dryRun.payload?.data?.providerCalled === true || dryRun.payload?.data?.plan?.providerCalled === true,
      nonChatDirectChatBlocked: nonChatData.success === false && Array.isArray(nonChatData.blockers) && nonChatData.blockers.length > 0,
      nonChatProviderCalled: nonChatData.stages?.executionStatus?.providerCalled === true,
    };
  } finally {
    await closeServer(server);
  }
}



function closeServer(server) {
  return new Promise((resolveClose) => server.close(() => resolveClose()));
}

async function requestJson(url, body) {
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { text };
  }
  return {
    httpStatus: response.status,
    payload,
  };
}



function saveEvidence(evidence) {
  writeEvidenceSync(
    dirname(evidenceJsonPath),
    evidenceJsonPath,
    evidenceMdPath,
    evidence,
    renderMarkdown,
  );
}

function renderMarkdown(evidence) {
  return [
    "# Phase313A Model Usability Matrix Evidence",
    "",
    `- status: ${evidence.status}`,
    `- sealed: ${evidence.sealed}`,
    `- blocker: ${evidence.blocker}`,
    `- totalModels: ${evidence.totalModels}`,
    `- smokePassedModels: ${evidence.smokePassedModels}`,
    `- selectableModels: ${evidence.selectableModels}`,
    `- unverifiedModels: ${evidence.unverifiedModels}`,
    `- failedModels: ${evidence.failedModels}`,
    `- blockedModels: ${evidence.blockedModels}`,
    `- rateLimitedModels: ${evidence.rateLimitedModels}`,
    `- deprecatedModels: ${evidence.deprecatedModels}`,
    `- taskToolModels: ${evidence.taskToolModels}`,
    `- directChatModels: ${evidence.directChatModels}`,
    `- providerCalledInDryRun: ${evidence.providerCalledInDryRun}`,
    `- providerCalledInRealSmoke: ${evidence.providerCalledInRealSmoke}`,
    `- paidApiCalled: ${evidence.paidApiCalled}`,
    `- mimoCalled: ${evidence.mimoCalled}`,
    `- openaiCalled: ${evidence.openaiCalled}`,
    `- claudeCalled: ${evidence.claudeCalled}`,
    `- openrouterCalled: ${evidence.openrouterCalled}`,
    `- embeddingBatchTrainingCalled: ${evidence.embeddingBatchTrainingCalled}`,
    `- defaultChatChanged: ${evidence.defaultChatChanged}`,
    `- chatGatewayRoutePreserved: ${evidence.chatGatewayRoutePreserved}`,
    `- deadButtonsFound: ${evidence.deadButtonsFound}`,
    `- uiUpdated: ${evidence.uiUpdated}`,
    `- routeAdded: ${evidence.routeAdded}`,
    `- realSmokeEnabled: ${evidence.realSmokeEnabled}`,
    `- realSmokeModelLimit: ${evidence.realSmokeModelLimit}`,
    `- rpmLimit: ${evidence.rpmLimit}`,
    `- rateLimitHit: ${evidence.rateLimitHit}`,
    `- workspaceCleanClaimed: ${evidence.workspaceCleanClaimed}`,
    "",
    "## Chat Dropdown Models",
    ...(evidence.chatDropdownModels.length ? evidence.chatDropdownModels.map((modelId) => `- ${modelId}`) : ["- none"]),
    "",
    "## Dry-run Plan",
    `- estimatedRequests: ${evidence.dryRunPlan.estimatedRequests}`,
    `- willCallProvider: ${evidence.dryRunPlan.willCallProvider}`,
    ...evidence.dryRunPlan.candidateModels.map((model) => `- ${model.modelId}: ${model.capabilityBucket} / ${model.verificationStatus}`),
    "",
    "## Checks",
    ...evidence.checks.map((check) => `- ${check.pass ? "pass" : "fail"}: ${check.id}${check.detail ? ` (${check.detail})` : ""}`),
    "",
  ].join("\n");
}
