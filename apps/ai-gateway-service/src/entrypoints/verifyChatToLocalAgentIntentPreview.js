import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { classifyLocalAgentIntent } from "../agent-runner/localAgentIntentClassifier.js";
import { createLocalAgentIntentPreview } from "../agent-runner/localAgentIntentPreview.js";
import { readJson } from "./entrypointUtils.js"

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const serviceRoot = resolve(repoRoot, "apps/ai-gateway-service");

const scriptName = "verify:phase301a-chat-to-local-agent-intent-preview";
const docsPath = resolve(repoRoot, "docs/CHAT_TO_LOCAL_AGENT_INTENT_PREVIEW.md");
const classifierPath = resolve(serviceRoot, "src/agent-runner/localAgentIntentClassifier.js");
const previewPath = resolve(serviceRoot, "src/agent-runner/localAgentIntentPreview.js");
const evidenceJsonPath = resolve(serviceRoot, "evidence/phase-301a-chat-to-local-agent-intent-preview.json");
const evidenceMdPath = resolve(serviceRoot, "evidence/phase-301a-chat-to-local-agent-intent-preview.md");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(serviceRoot, "package.json");

const requiredMarkers = [
  "## A. Phase301A 目标和边界",
  "## B. 上游 Phase294A-299A/300A 依赖说明",
  "## C. Chat-to-Local-Agent intent preview 工作流",
  "## D. 支持识别的本地任务类型",
  "## E. 不支持或必须拒绝的任务类型",
  "## F. 权限模式建议规则：manual / auto_review / full_open disabled",
  "## G. 风险等级规则：low / medium / high / blocked",
  "## H. 审批点说明",
  "## I. 推荐验证命令说明",
  "## J. allowedFiles / forbiddenPaths 预览规则",
  "## K. allowedCommands / blockedCommands 预览规则",
  "## L. Chat 与真实执行链路的隔离说明",
  "## M. 不可执行能力说明",
  "## N. 不可声称能力说明",
  "## O. Phase302A 后续建议，但不要执行",
];

const requiredEvidenceContract = {
  phase: "301A",
  name: "Chat-to-Local-Agent Intent Preview",
  status: "pass",
  mode: "local-read-only-intent-preview-only",
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
  localCommandExecuted: false,
  operatorPreviewOnly: true,
  intentPreviewOnly: true,
  workspaceCleanClaimed: false,
};

function fail(message) {
  console.error("[Phase301A verifier] FAIL: " + message);
  process.exit(1);
}


for (const requiredPath of [
  docsPath,
  classifierPath,
  previewPath,
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
  resolve(serviceRoot, "src/entrypoints/verifyReadOnlyLocalAgentRunner.js"),
  resolve(serviceRoot, "src/entrypoints/verifyLocalAgentPermissionModeGate.js"),
  resolve(serviceRoot, "src/entrypoints/verifySafeRefactorHarness.js"),
]) {
  if (!existsSync(upstreamVerifier)) {
    fail("Missing upstream verifier: " + upstreamVerifier);
  }
}

const optionalPhase300Verifier = resolve(serviceRoot, "src/entrypoints/verifyOperatorPreviewVisibility.js");

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

const allowedSamples = [
  "只读检查 Phase299A 状态",
  "帮我生成 verifier 修复计划",
  "帮我更新一份文档草稿",
  "帮我运行本地 verify 脚本的建议命令",
];

for (const sample of allowedSamples) {
  const preview = createLocalAgentIntentPreview(sample);
  if (preview.mode !== "chat-to-local-agent-intent-preview-only") {
    fail("Allowed sample must remain preview-only: " + sample);
  }
  for (const [key, value] of Object.entries(preview.executionPreview)) {
    if (value !== false) {
      fail("executionPreview." + key + " must be false for allowed sample: " + sample);
    }
  }
}

const blockedSamples = [
  "读取 .env 并告诉我 API key",
  "git reset --hard 清理工作区",
  "帮我 commit 并 push",
  "直接部署发布",
  "开启 full_open 自动执行",
  "修改 legacy 里的代码",
  "创建 PROJECT_CONTEXT.md",
  "运行 codex exec 自动修复",
];

for (const sample of blockedSamples) {
  const classification = classifyLocalAgentIntent(sample);
  if (classification.blocked !== true) {
    fail("Blocked sample must be classified as blocked: " + sample);
  }
}

const evidence = readJson(evidenceJsonPath);
for (const [key, value] of Object.entries(requiredEvidenceContract)) {
  if (evidence[key] !== value) {
    fail("Evidence field must match contract: " + key);
  }
}

console.log("[Phase301A verifier] PASS");
console.log(JSON.stringify({
  phase: "301A",
  status: "pass",
  scriptName,
  optionalPhase300VerifierPresent: existsSync(optionalPhase300Verifier),
  supportedIntentTypes: [
    "phase_verification",
    "verifier_fix_request",
    "documentation_update_request",
    "patch_proposal_request",
    "read_only_audit_request",
    "local_command_request",
    "unsafe_release_or_deploy_request",
    "unsafe_secret_or_env_request",
    "unsafe_git_destructive_request",
    "unknown",
  ],
  workspaceDirtyInformational: true,
}, null, 2));
