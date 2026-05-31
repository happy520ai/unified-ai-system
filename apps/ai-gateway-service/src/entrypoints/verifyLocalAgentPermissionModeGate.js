import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ALLOWED_COMMAND_PREFIXES,
  BLOCKED_COMMAND_PATTERNS,
  BLOCKED_PATHS,
  DISABLED_MODES,
  FULL_OPEN_DISABLED,
  PERMISSION_MODES,
} from "../agent-runner/permissionModePolicy.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const serviceRoot = resolve(repoRoot, "apps/ai-gateway-service");

const scriptName = "verify:phase295a-local-agent-permission-mode-gate";
const docsPath = resolve(repoRoot, "docs/LOCAL_AGENT_PERMISSION_MODE_GATE.md");
const evidenceJsonPath = resolve(serviceRoot, "evidence/phase-295a-local-agent-permission-mode-gate.json");
const evidenceMdPath = resolve(serviceRoot, "evidence/phase-295a-local-agent-permission-mode-gate.md");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(serviceRoot, "package.json");

const requiredMarkers = [
  "## A. Phase295A 目标和边界",
  "## B. 上游 Phase294A 依赖",
  "## C. 模式总览",
  "## D. Manual Approval Mode 规则",
  "## E. Auto Review Mode 规则",
  "## F. full_open 禁用规则",
  "## G. 路径边界与 blockedPaths",
  "## H. 命令边界与 blockedCommandPatterns",
  "## I. 允许自动运行的本地验证边界",
  "## J. Harness / Verifier 检查项",
  "## K. Phase295A 不可声称能力",
  "## L. Phase296A 前置条件说明",
];

const requiredBlockedPaths = ["legacy/", "PROJECT_CONTEXT.md", ".env"];
const requiredBlockedCommands = [
  "git commit",
  "git push",
  "git reset",
  "git clean",
  "deploy",
  "release",
  "curl",
  "codex exec",
];

const requiredEvidenceContract = {
  paidApiCallCount: 0,
  externalApiCalled: false,
  mimoApiCalled: false,
  embeddingCalled: false,
  realPatchApplied: false,
  realLocalAgentRunnerStarted: false,
  fullOpenEnabled: false,
  unattendedExecutionEnabled: false,
  commitOrPushCalled: false,
  releaseOrDeployCalled: false,
  workflowRunnerCalled: false,
  worktreeCreated: false,
  legacyModified: false,
  projectContextCreated: false,
  defaultNvidiaChatChanged: false,
  envReadAttempted: false,
};

function fail(message) {
  console.error("[Phase295A verifier] FAIL: " + message);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

for (const requiredPath of [
  docsPath,
  evidenceJsonPath,
  evidenceMdPath,
  rootPackagePath,
  servicePackagePath,
]) {
  if (!existsSync(requiredPath)) {
    fail("Missing required file: " + requiredPath);
  }
}

const docsText = readFileSync(docsPath, "utf8");
for (const marker of requiredMarkers) {
  if (!docsText.includes(marker)) {
    fail("Document missing marker: " + marker);
  }
}

if (!PERMISSION_MODES.manual) {
  fail("manual mode export is missing.");
}

if (!PERMISSION_MODES.auto_review) {
  fail("auto_review mode export is missing.");
}

if (FULL_OPEN_DISABLED !== true) {
  fail("FULL_OPEN_DISABLED must be true.");
}

if (DISABLED_MODES.full_open?.enabled !== false) {
  fail("full_open must exist as disabled mode.");
}

for (const blockedPath of requiredBlockedPaths) {
  if (!BLOCKED_PATHS.includes(blockedPath)) {
    fail("blockedPaths missing required entry: " + blockedPath);
  }
}

for (const blockedPattern of requiredBlockedCommands) {
  if (!BLOCKED_COMMAND_PATTERNS.includes(blockedPattern)) {
    fail("blockedCommandPatterns missing required entry: " + blockedPattern);
  }
}

if (!ALLOWED_COMMAND_PREFIXES.includes("node --check")) {
  fail("allowedCommandPrefixes must include node --check.");
}

if (!ALLOWED_COMMAND_PREFIXES.includes("cmd /c pnpm run verify:")) {
  fail("allowedCommandPrefixes must include verifier command prefix.");
}

if (PERMISSION_MODES.manual.requireApprovalBeforeWrite !== true) {
  fail("manual mode must require approval before write.");
}

if (PERMISSION_MODES.manual.requireApprovalBeforePatchApply !== true) {
  fail("manual mode must require approval before patch apply.");
}

if (PERMISSION_MODES.manual.autoRunSafeVerifiers !== false) {
  fail("manual mode must not auto-run safe verifiers.");
}

if (PERMISSION_MODES.auto_review.autoRunSafeVerifiers !== true) {
  fail("auto_review mode must auto-run safe verifiers.");
}

if (PERMISSION_MODES.auto_review.requireApprovalBeforePatchApply !== true) {
  fail("auto_review mode must require approval before patch apply.");
}

for (const mode of [PERMISSION_MODES.manual, PERMISSION_MODES.auto_review]) {
  if (mode.autoCommit !== false) {
    fail(mode.id + " must keep autoCommit=false.");
  }
  if (mode.autoPush !== false) {
    fail(mode.id + " must keep autoPush=false.");
  }
  if (mode.releaseOrDeployAllowed !== false) {
    fail(mode.id + " must keep releaseOrDeployAllowed=false.");
  }
  if (mode.readEnvAllowed !== false) {
    fail(mode.id + " must keep readEnvAllowed=false.");
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

const evidence = readJson(evidenceJsonPath);

if (evidence.phase !== "295A") {
  fail("Evidence phase must be 295A.");
}

if (evidence.name !== "Local Agent Permission Mode Gate") {
  fail("Evidence name mismatch.");
}

if (evidence.status !== "pass") {
  fail("Evidence status must be pass.");
}

for (const [key, value] of Object.entries(requiredEvidenceContract)) {
  if (evidence[key] !== value) {
    fail("Evidence field must match contract: " + key);
  }
}

console.log("[Phase295A verifier] PASS");
console.log(JSON.stringify({
  phase: "295A",
  status: "pass",
  scriptName,
  modes: Object.keys(PERMISSION_MODES),
  fullOpenDisabled: FULL_OPEN_DISABLED,
  blockedPathCount: BLOCKED_PATHS.length,
  blockedCommandCount: BLOCKED_COMMAND_PATTERNS.length,
  autoRunSafeVerifiers: PERMISSION_MODES.auto_review.autoRunSafeVerifiers,
  requireApprovalBeforePatchApply: {
    manual: PERMISSION_MODES.manual.requireApprovalBeforePatchApply,
    auto_review: PERMISSION_MODES.auto_review.requireApprovalBeforePatchApply,
  },
}, null, 2));
