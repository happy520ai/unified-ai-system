import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  OPERATOR_PREVIEW_STATE,
  createOperatorPreviewState,
  isFullOpenEnabledInOperatorPreview,
} from "../agent-runner/operatorPreviewState.js";
import { readJson } from "./entrypointUtils.js"

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const serviceRoot = resolve(repoRoot, "apps/ai-gateway-service");

const scriptName = "verify:phase299a-local-agent-operator-preview-panel";
const docsPath = resolve(repoRoot, "docs/LOCAL_AGENT_OPERATOR_PREVIEW_PANEL.md");
const operatorPreviewStatePath = resolve(serviceRoot, "src/agent-runner/operatorPreviewState.js");
const evidenceJsonPath = resolve(serviceRoot, "evidence/phase-299a-local-agent-operator-preview-panel.json");
const evidenceMdPath = resolve(serviceRoot, "evidence/phase-299a-local-agent-operator-preview-panel.md");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(serviceRoot, "package.json");

const requiredMarkers = [
  "## A. Phase299A 目标和边界",
  "## B. 上游 Phase294A/295A/296A/297A-298A 依赖",
  "## C. Operator Preview 展示内容",
  "## D. Permission Mode 状态展示规则",
  "## E. Patch Approval 状态展示规则",
  "## F. Dry-run / Apply-ready 状态展示规则",
  "## G. Auto Review Loop 状态展示规则",
  "## H. allowedFiles / forbiddenPaths 展示规则",
  "## I. allowedCommands / blockedCommands 展示规则",
  "## J. maxRounds / stop rules 展示规则",
  "## K. rollback manifest 摘要展示规则",
  "## L. go / no-go / review-required 展示规则",
  "## M. 不可执行能力说明",
  "## N. 不可声称能力说明",
  "## O. Phase300A 后续建议，但不要执行",
];

const requiredEvidenceContract = {
  phase: "299A",
  name: "Local Agent Operator Preview Panel",
  status: "pass",
  mode: "local-read-only-operator-preview",
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
  realPatchAppliedByDefault: false,
  dryRunDefault: true,
  humanApprovalRequired: true,
  autoReviewLoopExecuted: false,
  patchRunnerExecuted: false,
  operatorPreviewOnly: true,
  maxRoundsLimit: 3,
  workspaceCleanClaimed: false,
};

function fail(message) {
  console.error("[Phase299A verifier] FAIL: " + message);
  process.exit(1);
}


for (const requiredPath of [
  docsPath,
  operatorPreviewStatePath,
  evidenceJsonPath,
  evidenceMdPath,
  rootPackagePath,
  servicePackagePath,
]) {
  if (!existsSync(requiredPath)) {
    fail("Missing required file: " + requiredPath);
  }
}

for (const upstreamVerifier of [
  resolve(serviceRoot, "src/entrypoints/verifySafeRefactorHarness.js"),
  resolve(serviceRoot, "src/entrypoints/verifyLocalAgentPermissionModeGate.js"),
  resolve(serviceRoot, "src/entrypoints/verifyReadOnlyLocalAgentRunner.js"),
  resolve(serviceRoot, "src/entrypoints/verifyApprovedPatchAndAutoReviewLoop.js"),
]) {
  if (!existsSync(upstreamVerifier)) {
    fail("Missing upstream verifier: " + upstreamVerifier);
  }
}

const docsText = readFileSync(docsPath, "utf8");
for (const marker of requiredMarkers) {
  if (!docsText.includes(marker)) {
    fail("Document missing marker: " + marker);
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

const preview = createOperatorPreviewState();
if (!preview || preview.phase !== "299A") {
  fail("Operator preview state phase must be 299A.");
}

if (isFullOpenEnabledInOperatorPreview() !== false) {
  fail("full_open must remain disabled.");
}

if (preview.permissionModes?.full_open?.enabled !== false) {
  fail("permissionModes.full_open.enabled must be false.");
}

if (preview.patchRunner?.dryRunDefault !== true) {
  fail("patchRunner.dryRunDefault must be true.");
}

if (preview.patchRunner?.humanApprovalRequired !== true) {
  fail("patchRunner.humanApprovalRequired must be true.");
}

if (preview.patchRunner?.realPatchAppliedByDefault !== false) {
  fail("patchRunner.realPatchAppliedByDefault must be false.");
}

if (preview.autoReviewLoop?.dryRunDefault !== true) {
  fail("autoReviewLoop.dryRunDefault must be true.");
}

if (preview.autoReviewLoop?.maxRoundsLimit !== 3) {
  fail("autoReviewLoop.maxRoundsLimit must be 3.");
}

if (preview.safety?.autoCommitEnabled !== false) {
  fail("autoCommitEnabled must be false.");
}

if (preview.safety?.autoPushEnabled !== false) {
  fail("autoPushEnabled must be false.");
}

if (preview.safety?.releaseOrDeployAllowed !== false) {
  fail("releaseOrDeployAllowed must be false.");
}

if (preview.operatorStatus?.mode !== "preview-only") {
  fail("operatorStatus.mode must be preview-only.");
}

if (!Array.isArray(OPERATOR_PREVIEW_STATE.goNoGo?.statuses) || OPERATOR_PREVIEW_STATE.goNoGo.statuses.length < 3) {
  fail("go/no-go statuses must be present.");
}

const evidence = readJson(evidenceJsonPath);
for (const [key, value] of Object.entries(requiredEvidenceContract)) {
  if (evidence[key] !== value) {
    fail("Evidence field must match contract: " + key);
  }
}

console.log("[Phase299A verifier] PASS");
console.log(JSON.stringify({
  phase: "299A",
  status: "pass",
  scriptName,
  fullOpenEnabled: preview.permissionModes.full_open.enabled,
  dryRunDefault: preview.patchRunner.dryRunDefault,
  humanApprovalRequired: preview.patchRunner.humanApprovalRequired,
  maxRoundsLimit: preview.autoReviewLoop.maxRoundsLimit,
  uiUpdated: evidence.uiUpdated,
  routeAdded: evidence.routeAdded,
  workspaceDirtyInformational: true,
}, null, 2));
