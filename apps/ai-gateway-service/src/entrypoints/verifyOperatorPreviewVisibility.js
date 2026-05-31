import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  OPERATOR_PREVIEW_EXPLAINER,
  createOperatorPreviewExplainer,
} from "../agent-runner/operatorPreviewExplainer.js";
import {
  OPERATOR_PREVIEW_STATE,
  createOperatorPreviewState,
  isFullOpenEnabledInOperatorPreview,
} from "../agent-runner/operatorPreviewState.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const serviceRoot = resolve(repoRoot, "apps/ai-gateway-service");

const scriptName = "verify:phase300a-operator-preview-visibility";
const docsPath = resolve(repoRoot, "docs/OPERATOR_PREVIEW_VISIBILITY_AND_APPROVAL_EVIDENCE_LINKAGE.md");
const explainerPath = resolve(serviceRoot, "src/agent-runner/operatorPreviewExplainer.js");
const previewStatePath = resolve(serviceRoot, "src/agent-runner/operatorPreviewState.js");
const evidenceJsonPath = resolve(serviceRoot, "evidence/phase-300a-operator-preview-visibility.json");
const evidenceMdPath = resolve(serviceRoot, "evidence/phase-300a-operator-preview-visibility.md");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(serviceRoot, "package.json");

const requiredMarkers = [
  "## A. Phase300A 目标和边界",
  "## B. 上游 Phase294A/295A/296A/297A-298A/299A 依赖",
  "## C. Permission Mode 可见性增强",
  "## D. Approval Record 可见性增强",
  "## E. Dry-run / Apply-ready 可见性增强",
  "## F. Go / No-go / Review-required 可见性增强",
  "## G. Rollback Manifest 摘要可见性增强",
  "## H. Evidence Linkage 规则",
  "## I. Blocker / Warning / Informational 解释规则",
  "## J. 不可执行能力说明",
  "## K. 不可声称能力说明",
  "## L. Phase301A 后续建议，但不要执行",
];

const requiredEvidenceContract = {
  phase: "300A",
  name: "Operator Preview Visibility & Approval Evidence Linkage",
  status: "pass",
  mode: "local-read-only-visibility-only",
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
  patchRunnerExecuted: false,
  autoReviewLoopExecuted: false,
  operatorPreviewOnly: true,
  visibilityOnly: true,
  workspaceCleanClaimed: false,
};

function fail(message) {
  console.error("[Phase300A verifier] FAIL: " + message);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

for (const requiredPath of [
  docsPath,
  explainerPath,
  previewStatePath,
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
  resolve(serviceRoot, "src/entrypoints/verifyLocalAgentOperatorPreviewPanel.js"),
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

const previewState = createOperatorPreviewState();
const explainer = createOperatorPreviewExplainer();

if (isFullOpenEnabledInOperatorPreview() !== false) {
  fail("full_open must remain disabled.");
}
if (previewState.patchRunner?.realPatchAppliedByDefault !== false) {
  fail("realPatchAppliedByDefault must remain false.");
}
if (previewState.safety?.autoCommitEnabled !== false) {
  fail("autoCommitEnabled must remain false.");
}
if (previewState.safety?.autoPushEnabled !== false) {
  fail("autoPushEnabled must remain false.");
}

for (const key of [
  "permissionModeExplanation",
  "approvalRecordExplanation",
  "dryRunExplanation",
  "applyReadyExplanation",
  "goNoGoExplanation",
  "rollbackManifestExplanation",
  "evidenceLinkageExplanation",
  "blockerExplanation",
  "warningExplanation",
  "informationalExplanation",
]) {
  if (!Array.isArray(explainer[key]) || explainer[key].length === 0) {
    fail("Explainer must include non-empty array: " + key);
  }
}

if (!previewState.explanations) {
  fail("operatorPreviewState must include explanations.");
}
if (previewState.runtimeStatus?.patchRunnerExecuted !== false) {
  fail("patchRunnerExecuted must remain false.");
}
if (previewState.runtimeStatus?.autoReviewLoopExecuted !== false) {
  fail("autoReviewLoopExecuted must remain false.");
}
if (previewState.runtimeStatus?.releaseOrDeployCalled !== false) {
  fail("releaseOrDeployCalled must remain false.");
}

const evidence = readJson(evidenceJsonPath);
for (const [key, value] of Object.entries(requiredEvidenceContract)) {
  if (evidence[key] !== value) {
    fail("Evidence field must match contract: " + key);
  }
}

console.log("[Phase300A verifier] PASS");
console.log(JSON.stringify({
  phase: "300A",
  status: "pass",
  scriptName,
  fullOpenEnabled: previewState.permissionModes.full_open.enabled,
  patchRunnerExecuted: previewState.runtimeStatus.patchRunnerExecuted,
  autoReviewLoopExecuted: previewState.runtimeStatus.autoReviewLoopExecuted,
  explanationKeys: Object.keys(OPERATOR_PREVIEW_EXPLAINER),
  workspaceDirtyInformational: true,
}, null, 2));
