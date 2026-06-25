import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  APPROVED_PATCH_RUNNER_DEFAULTS,
  createApprovedPatchRunner,
} from "../agent-runner/approvedPatchRunner.js";
import {
  PATCH_APPROVAL_POLICIES,
  PATCH_FORBIDDEN_PATHS,
  isFullOpenDisabledForPatchRunner,
} from "../agent-runner/patchApprovalPolicy.js";
import { AUTO_REVIEW_LOOP_DEFAULTS } from "../agent-runner/autoReviewLoop.js";
import {
  AUTO_REVIEW_BLOCKED_COMMANDS,
  AUTO_REVIEW_DEFAULTS,
} from "../agent-runner/autoReviewPolicy.js";
import { GO_NO_GO_STATUSES, buildGoNoGoReview } from "../agent-runner/goNoGoReview.js";
import { readJson } from "./entrypointUtils.js"

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const serviceRoot = resolve(repoRoot, "apps/ai-gateway-service");

const scriptName = "verify:phase297a-298a-approved-patch-auto-review-loop";
const docsPath = resolve(repoRoot, "docs/APPROVED_PATCH_AND_AUTO_REVIEW_LOOP.md");
const approvedPatchRunnerPath = resolve(serviceRoot, "src/agent-runner/approvedPatchRunner.js");
const patchApprovalPolicyPath = resolve(serviceRoot, "src/agent-runner/patchApprovalPolicy.js");
const rollbackManifestPath = resolve(serviceRoot, "src/agent-runner/rollbackManifest.js");
const autoReviewLoopPath = resolve(serviceRoot, "src/agent-runner/autoReviewLoop.js");
const autoReviewPolicyPath = resolve(serviceRoot, "src/agent-runner/autoReviewPolicy.js");
const goNoGoReviewPath = resolve(serviceRoot, "src/agent-runner/goNoGoReview.js");
const evidenceJsonPath = resolve(serviceRoot, "evidence/phase-297a-298a-approved-patch-auto-review-loop.json");
const evidenceMdPath = resolve(serviceRoot, "evidence/phase-297a-298a-approved-patch-auto-review-loop.md");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(serviceRoot, "package.json");

const requiredMarkers = [
  "## A. Phase297A-298A 目标和边界",
  "## B. 上游 Phase294A/295A/296A 依赖",
  "## C. Approved Patch Runner 工作流",
  "## D. Auto Review Loop 工作流",
  "## E. Manual Approval Mode 行为",
  "## F. Auto Review Mode 行为",
  "## G. full-open 禁用说明",
  "## H. allowedFiles / forbiddenPaths 规则",
  "## I. allowedCommands / blockedCommands 规则",
  "## J. rollback manifest 规则",
  "## K. go / no-go / review-required 判定规则",
  "## L. maxRounds 和停止规则",
  "## M. 禁止 commit/push/deploy/release 说明",
  "## N. 不可声称能力说明",
  "## O. Phase299A 或后续阶段建议，但不要执行",
];

const requiredEvidenceContract = {
  phase: "297A-298A",
  name: "Approved Patch Runner + Auto Review Loop",
  status: "pass",
  mode: "local-approved-patch-and-auto-review-preview",
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
  maxRoundsLimit: 3,
  workspaceCleanClaimed: false,
};

function fail(message) {
  console.error("[Phase297A-298A verifier] FAIL: " + message);
  process.exit(1);
}


for (const requiredPath of [
  docsPath,
  approvedPatchRunnerPath,
  patchApprovalPolicyPath,
  rollbackManifestPath,
  autoReviewLoopPath,
  autoReviewPolicyPath,
  goNoGoReviewPath,
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

if (isFullOpenDisabledForPatchRunner() !== true) {
  fail("full_open must remain disabled for patch runner.");
}

if (PATCH_APPROVAL_POLICIES.manual.autoCommit !== false || PATCH_APPROVAL_POLICIES.auto_review.autoCommit !== false) {
  fail("Patch approval policy must keep autoCommit=false.");
}

if (PATCH_APPROVAL_POLICIES.manual.autoPush !== false || PATCH_APPROVAL_POLICIES.auto_review.autoPush !== false) {
  fail("Patch approval policy must keep autoPush=false.");
}

if (PATCH_APPROVAL_POLICIES.manual.releaseOrDeployAllowed !== false || PATCH_APPROVAL_POLICIES.auto_review.releaseOrDeployAllowed !== false) {
  fail("Patch approval policy must keep releaseOrDeployAllowed=false.");
}

for (const forbiddenPath of ["legacy/", "PROJECT_CONTEXT.md", ".env", ".git", "node_modules"]) {
  if (!PATCH_FORBIDDEN_PATHS.includes(forbiddenPath) && !PATCH_FORBIDDEN_PATHS.includes(forbiddenPath + "/")) {
    fail("forbiddenPaths missing required entry: " + forbiddenPath);
  }
}

for (const blockedCommand of ["git commit", "git push", "git reset", "git clean", "deploy", "release"]) {
  if (!AUTO_REVIEW_BLOCKED_COMMANDS.includes(blockedCommand)) {
    fail("auto review blocked commands missing: " + blockedCommand);
  }
}

if (AUTO_REVIEW_DEFAULTS.maxRoundsLimit > 3 || AUTO_REVIEW_LOOP_DEFAULTS.maxRoundsLimit > 3) {
  fail("maxRoundsLimit must stay <= 3.");
}

if (APPROVED_PATCH_RUNNER_DEFAULTS.dryRun !== true) {
  fail("Approved patch runner must default to dryRun=true.");
}

const runner = createApprovedPatchRunner({ mode: "manual" });
if (typeof runner.run !== "function") {
  fail("Approved patch runner must expose run().");
}

const sampleReview = buildGoNoGoReview({
  blockers: [],
  warnings: ["sample-warning"],
  commandsRun: [],
  commandsSkipped: [],
  evidencePaths: [],
  changedFiles: [],
  boundaryCheck: {},
  nextSteps: [],
  approvalRequired: true,
});

if (!GO_NO_GO_STATUSES.includes(sampleReview.status)) {
  fail("go/no-go review must return a supported status.");
}

const evidence = readJson(evidenceJsonPath);
for (const [key, value] of Object.entries(requiredEvidenceContract)) {
  if (evidence[key] !== value) {
    fail("Evidence field must match contract: " + key);
  }
}

let workspaceDirtyObserved = false;
try {
  const output = execFileSync("git", ["status", "--short"], {
    cwd: repoRoot,
    windowsHide: true,
    timeout: 5000,
    encoding: "utf8",
  }).trim();
  workspaceDirtyObserved = output.length > 0;
} catch {
  workspaceDirtyObserved = false;
}

console.log("[Phase297A-298A verifier] PASS");
console.log(JSON.stringify({
  phase: "297A-298A",
  status: "pass",
  scriptName,
  fullOpenDisabled: true,
  maxRoundsLimit: AUTO_REVIEW_DEFAULTS.maxRoundsLimit,
  blockedCommandCount: AUTO_REVIEW_BLOCKED_COMMANDS.length,
  forbiddenPathCount: PATCH_FORBIDDEN_PATHS.length,
  workspaceDirtyObserved,
}, null, 2));
