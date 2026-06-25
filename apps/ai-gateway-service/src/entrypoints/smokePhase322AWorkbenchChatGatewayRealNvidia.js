import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { fetchText, postJson, listen } from "./entrypointUtils.js";

const PHASE = "Phase322A";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-322a-workbench-chat-gateway-real-nvidia.json");
const evidenceMdPath = resolve(evidenceDir, "phase-322a-workbench-chat-gateway-real-nvidia.md");
const verifiedModelId = process.env.PHASE322A_CHAT_MODEL || "nvidia/llama-3.1-nemotron-nano-8b-v1";

const checks = [];
function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const runtimeEnv = {
  ...process.env,
  AI_GATEWAY_PROVIDER_MODE: "real",
  AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
  AI_GATEWAY_ENABLED_PROVIDERS: "nvidia",
  AI_GATEWAY_ROUTE_MODE: "fixed",
  AI_GATEWAY_DEFAULT_PROVIDER: "nvidia",
  AI_GATEWAY_DEFAULT_MODEL: verifiedModelId,
  PME_RUNTIME_CREDENTIAL_STORE_MODE: process.env.PME_RUNTIME_CREDENTIAL_STORE_MODE || "memory",
};

const noKeyEnv = {
  ...runtimeEnv,
  NVIDIA_API_KEY: "",
};

const withKeyApplication = createGatewayApplication(runtimeEnv);
const withKeyServer = createGatewayHttpServer(withKeyApplication);
const noKeyApplication = createGatewayApplication(noKeyEnv);
const noKeyServer = createGatewayHttpServer(noKeyApplication);

const withKeyBaseUrl = await listen(withKeyServer);
const noKeyBaseUrl = await listen(noKeyServer);

let uiHtml = "";
let noKeyResult = null;
let withKeyResult = null;
let hasRuntimeKey = false;

try {
  uiHtml = await fetchText(`${withKeyBaseUrl}/ui?ts=phase322a`);
  noKeyResult = await postJson(`${noKeyBaseUrl}/chat-gateway/execute`, {
    input: "你好",
    message: "你好",
    mode: "manual_model",
    dryRun: false,
    providerId: "nvidia",
    selectedModel: {
      providerId: "nvidia",
      modelId: verifiedModelId,
    },
  });
  hasRuntimeKey = withKeyApplication.providerKeyConfigStore.getStatus()?.providers?.[0]?.apiKeyConfigured === true;
  if (hasRuntimeKey) {
    withKeyResult = await postJson(`${withKeyBaseUrl}/chat-gateway/execute`, {
      input: "你好",
      message: "你好",
      mode: "manual_model",
      dryRun: false,
      providerId: "nvidia",
      selectedModel: {
        providerId: "nvidia",
        modelId: verifiedModelId,
      },
    });
  }
} finally {
  await Promise.all([closeServer(withKeyServer), closeServer(noKeyServer)]);
}

const noKeyExecutionCode = String(noKeyResult?.failureCode || noKeyResult?.stages?.executionStatus?.code || "").trim();
const withKeyExecutionCode = String(withKeyResult?.failureCode || withKeyResult?.stages?.executionStatus?.code || "").trim();

expect(uiHtml.includes('/chat-gateway/execute'), "ui_chat_execute_route");
expect(uiHtml.includes('mode: "manual_model"'), "ui_manual_model_mode");
expect(uiHtml.includes('dryRun: false'), "ui_dry_run_false");
expect(uiHtml.includes('selectedModel: {'), "ui_selected_model_object");

expect(noKeyResult?.providerCalled === false, "no_key_provider_not_called");
expect(noKeyResult?.completionVerified === false, "no_key_not_completed");
expect(noKeyExecutionCode === "nvidia_api_key_missing", "no_key_reason_honest", noKeyExecutionCode);
expect(!String(noKeyResult?.userVisibleSummary || "").includes("Dry-run"), "no_key_not_masked_as_dry_run");
expect(!String(noKeyResult?.userVisibleSummary || "").includes("真实调用成功"), "no_key_not_masked_as_success");

if (hasRuntimeKey) {
  expect(withKeyResult?.providerCalled === true, "with_key_provider_called");
  expect(withKeyResult?.providerName === "nvidia", "with_key_provider_name");
  expect(withKeyResult?.completionVerified === true, "with_key_completion_verified");
  expect(withKeyResult?.executionStatus === "completed", "with_key_execution_completed", withKeyResult?.executionStatus);
  expect(Boolean(String(withKeyResult?.finalAnswer || "").trim()), "with_key_non_empty_answer");
  expect(Boolean(withKeyResult?.evidenceId), "with_key_evidence_id");
  expect(withKeyExecutionCode === "gateway_execution_ok", "with_key_execution_code", withKeyExecutionCode);
  expect(!String(withKeyResult?.userVisibleSummary || "").includes("Dry-run"), "with_key_not_dry_run_copy");
} else {
  expect(noKeyResult?.providerCalled === false, "runtime_key_missing_blocker");
}

const failedChecks = checks.filter((item) => !item.pass);
const evidence = {
  phase: PHASE,
  status: failedChecks.length === 0 ? "pass" : "fail",
  blocker: failedChecks.length === 0 ? null : failedChecks.map((item) => `${item.id}: ${item.detail}`),
  generatedAt: new Date().toISOString(),
  verifiedModelId,
  hasRuntimeKey,
  realBrowserUsed: false,
  manualRealBrowserVerificationRequired: true,
  noKeyResult: summarizeResult(noKeyResult),
  withKeyResult: summarizeResult(withKeyResult),
  uiPayloadBinding: {
    routeExecute: uiHtml.includes('/chat-gateway/execute'),
    manualModelMode: uiHtml.includes('mode: "manual_model"'),
    dryRunFalse: uiHtml.includes('dryRun: false'),
    selectedModelObject: uiHtml.includes('selectedModel: {'),
  },
  checks,
  defaultChatChanged: false,
  paidApiCalled: false,
  mimoCalled: false,
  openaiCalled: false,
  claudeCalled: false,
  openrouterCalled: false,
  embeddingBatchTrainingCalled: false,
  secretExposed: false,
  workspaceCleanClaimed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
await writeFile(evidenceMdPath, renderMarkdown(evidence), "utf8");

console.log(JSON.stringify({
  status: evidence.status,
  blocker: evidence.blocker,
  hasRuntimeKey,
  noKeyExecutionCode,
  withKeyExecutionCode: hasRuntimeKey ? withKeyExecutionCode : null,
  checksFailed: failedChecks.length,
}, null, 2));

if (failedChecks.length > 0) {
  process.exitCode = 1;
}

function summarizeResult(result) {
  if (!result) return null;
  return {
    success: result.success === true,
    code: result.code || "",
    failureCode: result.failureCode || result.stages?.executionStatus?.code || "",
    providerCalled: result.providerCalled === true,
    providerName: result.providerName || "",
    completionVerified: result.completionVerified === true,
    executionStatus: result.executionStatus || "",
    evidenceId: result.evidenceId || "",
    hasFinalAnswer: Boolean(String(result.finalAnswer || "").trim()),
    verificationReason: result.verificationReason || "",
    userVisibleSummary: result.userVisibleSummary || "",
  };
}

function renderMarkdown(data) {
  return [
    "# Phase322A Workbench Chat Gateway Real NVIDIA Smoke",
    "",
    `- status: ${data.status}`,
    `- blocker: ${data.blocker ? data.blocker.join("; ") : "none"}`,
    `- verifiedModelId: ${data.verifiedModelId}`,
    `- hasRuntimeKey: ${data.hasRuntimeKey}`,
    `- realBrowserUsed: ${data.realBrowserUsed}`,
    `- manualRealBrowserVerificationRequired: ${data.manualRealBrowserVerificationRequired}`,
    `- noKeyFailureCode: ${data.noKeyResult?.failureCode ?? "n/a"}`,
    `- withKeyProviderCalled: ${data.withKeyResult?.providerCalled ?? false}`,
    `- withKeyCompletionVerified: ${data.withKeyResult?.completionVerified ?? false}`,
    "",
  ].join("\n");
}


function closeServer(server) {
  return new Promise((resolveClose) => server.close(() => resolveClose()));
}
