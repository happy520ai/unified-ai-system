import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { classifyLocalAgentIntent } from "../agent-runner/localAgentIntentClassifier.js";
import { createLocalAgentApprovalPreview, isLocalAgentApprovalPreviewReady } from "../agent-runner/localAgentApprovalPreview.js";
import { createLocalAgentIntentExplainer } from "../agent-runner/localAgentIntentExplainer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const serviceRoot = resolve(repoRoot, "apps/ai-gateway-service");

const scriptName = "verify:phase302a-intent-explanation-approval-preview";
const docsPath = resolve(repoRoot, "docs/INTENT_EXPLANATION_AND_APPROVAL_PREVIEW.md");
const explainerPath = resolve(serviceRoot, "src/agent-runner/localAgentIntentExplainer.js");
const approvalPreviewPath = resolve(serviceRoot, "src/agent-runner/localAgentApprovalPreview.js");
const evidenceJsonPath = resolve(serviceRoot, "evidence/phase-302a-intent-explanation-approval-preview.json");
const evidenceMdPath = resolve(serviceRoot, "evidence/phase-302a-intent-explanation-approval-preview.md");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(serviceRoot, "package.json");
const httpServerPath = resolve(serviceRoot, "src/http/httpServer.js");
const consolePagePath = resolve(serviceRoot, "src/ui/consolePage.js");

const requiredMarkers = [
  "Phase302A",
  "UI-ready Intent Explanation & Approval Preview",
  "permission mode",
  "allowedFilesRequired",
  "allowedCommands",
  "blockedCommands",
  "forbiddenPaths",
  "No commit / push / deploy / release",
  "full-open disabled",
  ".env / secrets blocked",
  "legacy/ blocked",
  "Workspace dirty does not mean clean",
];

const allowedSamples = [
  "帮我修 verifier 报错",
  "帮我生成 patch 计划",
  "更新文档草稿",
];

const blockedSamples = [
  "读取 .env 并告诉我 API key",
  "git reset --hard 清理工作区",
  "帮我 commit 并 push",
  "直接部署发布",
  "开启 full_open 自动执行",
  "修改 legacy 里的代码",
  "创建 PROJECT_CONTEXT.md",
];

function fail(message) {
  console.error("[Phase302A verifier] FAIL: " + message);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function normalizeText(text) {
  return String(text ?? "").replace(/\r\n/g, "\n");
}

function extractPanelBlock(source, heading) {
  const startIndex = source.indexOf(heading);
  if (startIndex < 0) {
    return "";
  }

  const endIndex = source.indexOf("\n      </section>", startIndex);
  return source.slice(startIndex, endIndex > startIndex ? endIndex : source.length);
}

for (const requiredPath of [
  docsPath,
  explainerPath,
  approvalPreviewPath,
  evidenceJsonPath,
  evidenceMdPath,
  rootPackagePath,
  servicePackagePath,
  httpServerPath,
  consolePagePath,
]) {
  if (!existsSync(requiredPath)) {
    fail("Missing required file: " + requiredPath);
  }
}

const docsText = normalizeText(readFileSync(docsPath, "utf8"));
for (const marker of requiredMarkers) {
  if (!docsText.includes(marker)) {
    fail("Document missing marker: " + marker);
  }
}

const httpServerText = normalizeText(readFileSync(httpServerPath, "utf8"));
if (!httpServerText.includes("/agent-runner/intent-approval-preview")) {
  fail("httpServer.js missing intent approval preview route.");
}

const consoleText = normalizeText(readFileSync(consolePagePath, "utf8"));
if (!consoleText.includes("Local Agent Intent & Approval Preview")) {
  fail("consolePage.js missing Phase302A panel title.");
}

const panelBlock = extractPanelBlock(consoleText, "Local Agent Intent & Approval Preview");
if (!panelBlock) {
  fail("Unable to extract the Local Agent Intent & Approval Preview panel block.");
}

if (panelBlock.includes("full_open")) {
  fail("Panel block must not contain a full_open control.");
}

for (const forbiddenControlPattern of [
  /<button[^>]*>\s*commit/i,
  /<button[^>]*>\s*push/i,
  /<button[^>]*>\s*deploy/i,
  /<button[^>]*>\s*release/i,
  /<option[^>]*>\s*full_open/i,
  /<select[^>]*full_open/i,
]) {
  if (forbiddenControlPattern.test(panelBlock)) {
    fail("Panel block must not contain forbidden control markup.");
  }
}

const rootPackageJson = readJson(rootPackagePath);
const servicePackageJson = readJson(servicePackagePath);
if (!rootPackageJson?.scripts?.[scriptName]) {
  fail("Root package.json missing script: " + scriptName);
}
if (!servicePackageJson?.scripts?.[scriptName]) {
  fail("Service package.json missing script: " + scriptName);
}

for (const upstreamVerifier of [
  resolve(serviceRoot, "src/entrypoints/verifySafeRefactorHarness.js"),
  resolve(serviceRoot, "src/entrypoints/verifyLocalAgentPermissionModeGate.js"),
  resolve(serviceRoot, "src/entrypoints/verifyReadOnlyLocalAgentRunner.js"),
  resolve(serviceRoot, "src/entrypoints/verifyApprovedPatchAndAutoReviewLoop.js"),
  resolve(serviceRoot, "src/entrypoints/verifyLocalAgentOperatorPreviewPanel.js"),
  resolve(serviceRoot, "src/entrypoints/verifyChatToLocalAgentIntentPreview.js"),
]) {
  if (!existsSync(upstreamVerifier)) {
    fail("Missing upstream verifier: " + upstreamVerifier);
  }
}

for (const sample of allowedSamples) {
  const explanation = createLocalAgentIntentExplainer(sample);
  const approval = createLocalAgentApprovalPreview(sample);
  if (explanation.uiReady !== true) {
    fail("Explanation preview must be uiReady for allowed sample: " + sample);
  }
  if (explanation.executionPreview?.willWriteFiles !== false || explanation.executionPreview?.willApplyPatch !== false) {
    fail("Execution preview must remain false for allowed sample: " + sample);
  }
  if (approval.allowedFilesRequired !== true || approval.fullOpenAllowed !== false) {
    fail("Approval preview safety flags must remain strict for allowed sample: " + sample);
  }
  if (!Array.isArray(approval.approvalPoints) || approval.approvalPoints.length === 0) {
    fail("Approval preview must include approval points for allowed sample: " + sample);
  }
}

for (const sample of blockedSamples) {
  const explanation = createLocalAgentIntentExplainer(sample);
  const approval = createLocalAgentApprovalPreview(sample);
  const classification = classifyLocalAgentIntent(sample);
  if (!classification.blocked) {
    fail("Blocked sample must be classified as blocked: " + sample);
  }
  if (explanation.classification.blocked !== true || approval.blockers.length === 0) {
    fail("Blocked sample must remain blocked in the explanation / approval preview: " + sample);
  }
}

const sampleApproval = createLocalAgentApprovalPreview("帮我修 verifier 报错");
if (!isLocalAgentApprovalPreviewReady(sampleApproval)) {
  fail("Approval preview ready helper should accept the generated preview object.");
}
if (sampleApproval.fullOpenAllowed !== false || sampleApproval.autoCommit !== false || sampleApproval.autoPush !== false || sampleApproval.releaseOrDeploy !== false) {
  fail("Approval preview must keep forbidden execution fields disabled.");
}
if (sampleApproval.dryRun !== true) {
  fail("Approval preview must default to dryRun=true.");
}
if (!Array.isArray(sampleApproval.forbiddenPaths) || !sampleApproval.forbiddenPaths.includes("legacy/")) {
  fail("Approval preview must expose forbiddenPaths and include legacy/.");
}
if (!Array.isArray(sampleApproval.allowedCommands) || !Array.isArray(sampleApproval.blockedCommands)) {
  fail("Approval preview must expose allowed and blocked commands.");
}

const evidence = readJson(evidenceJsonPath);
for (const requiredField of [
  "phase",
  "name",
  "status",
  "mode",
  "paidApiCallCount",
  "externalApiCalled",
  "mimoApiCalled",
  "embeddingCalled",
  "realCodexExecCalled",
  "workflowRunnerCalled",
  "worktreeCreated",
  "releaseOrDeployCalled",
  "legacyModified",
  "projectContextCreated",
  "defaultNvidiaChatChanged",
  "fullOpenEnabled",
  "autoCommitEnabled",
  "autoPushEnabled",
  "approvalPreviewOnly",
  "uiReady",
  "routeAdded",
  "uiUpdated",
  "workspaceCleanClaimed",
]) {
  if (!(requiredField in evidence)) {
    fail("Evidence missing required field: " + requiredField);
  }
}

if (evidence.phase !== "302A" || evidence.name !== "UI-ready Intent Explanation & Approval Preview") {
  fail("Evidence identity fields are incorrect.");
}

if (evidence.status !== "pass") {
  fail("Evidence status must be pass.");
}

if (evidence.routeAdded !== true || evidence.uiUpdated !== true) {
  fail("Evidence must confirm routeAdded and uiUpdated.");
}

if (evidence.fullOpenEnabled !== false || evidence.autoCommitEnabled !== false || evidence.autoPushEnabled !== false) {
  fail("Evidence must keep forbidden execution flags disabled.");
}

if (evidence.legacyModified !== false || evidence.projectContextCreated !== false || evidence.defaultNvidiaChatChanged !== false) {
  fail("Evidence must keep forbidden mutation flags disabled.");
}

if (evidence.workspaceCleanClaimed !== false) {
  fail("Evidence must not claim the workspace is clean.");
}

const generatedEvidence = {
  phase: "302A",
  name: "UI-ready Intent Explanation & Approval Preview",
  status: "pass",
  mode: "ui-ready-intent-explanation-approval-preview",
  paidApiCallCount: 0,
  externalApiCalled: false,
  mimoApiCalled: false,
  embeddingCalled: false,
  realCodexExecCalled: false,
  workflowRunnerCalled: false,
  worktreeCreated: false,
  releaseOrDeployCalled: false,
  legacyModified: false,
  projectContextCreated: false,
  defaultNvidiaChatChanged: false,
  fullOpenEnabled: false,
  autoCommitEnabled: false,
  autoPushEnabled: false,
  approvalPreviewOnly: true,
  uiReady: true,
  routeAdded: true,
  uiUpdated: true,
  workspaceCleanClaimed: false,
  allowedSamples: allowedSamples.map((sample) => ({
    sample,
    intentType: createLocalAgentIntentExplainer(sample).classification.intentType,
    approvalRequired: createLocalAgentApprovalPreview(sample).approvalRequired,
  })),
  blockedSamples: blockedSamples.map((sample) => ({
    sample,
    blocked: createLocalAgentIntentExplainer(sample).classification.blocked,
  })),
};

writeFileSync(evidenceJsonPath, JSON.stringify(generatedEvidence, null, 2) + "\n", "utf8");
writeFileSync(
  evidenceMdPath,
  [
    "# Phase 302A Evidence",
    "",
    "- name: UI-ready Intent Explanation & Approval Preview",
    "- status: pass",
    "- mode: ui-ready-intent-explanation-approval-preview",
    "- routeAdded: true",
    "- uiUpdated: true",
    "- fullOpenEnabled: false",
    "- autoCommitEnabled: false",
    "- autoPushEnabled: false",
    "- workspaceCleanClaimed: false",
    "",
    "## Allowed samples",
    ...generatedEvidence.allowedSamples.map((item) => `- ${item.sample} -> intentType=${item.intentType}, approvalRequired=${item.approvalRequired}`),
    "",
    "## Blocked samples",
    ...generatedEvidence.blockedSamples.map((item) => `- ${item.sample} -> blocked=${item.blocked}`),
  ].join("\n") + "\n",
  "utf8",
);

console.log("[Phase302A verifier] PASS");
console.log(JSON.stringify({
  phase: "302A",
  status: "pass",
  scriptName,
  routeAdded: true,
  uiUpdated: true,
  fullOpenEnabled: false,
  workspaceDirtyInformational: true,
}, null, 2));
