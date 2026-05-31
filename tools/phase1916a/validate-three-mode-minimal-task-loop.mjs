import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createConsolePage } from "../../apps/ai-gateway-service/src/ui/consolePage.js";

const repoRoot = process.cwd();

const paths = Object.freeze({
  result: "apps/ai-gateway-service/evidence/phase1916a/three-mode-minimal-task-loop-result.json",
  normal: "apps/ai-gateway-service/evidence/phase1916a/normal-mode-sample-result.json",
  god: "apps/ai-gateway-service/evidence/phase1916a/god-mode-sample-result.json",
  tianshu: "apps/ai-gateway-service/evidence/phase1916a/tianshu-mode-sample-result.json",
  doc: "docs/phase1916a-three-mode-minimal-real-task-loop.md",
  contract: "docs/phase1916a-three-mode-loop-contract.md",
  report: "docs/phase1916a-execution-report.md",
  rollback: "docs/phase1916a-rollback-guide.md",
  module: "packages/world-class-product-conversion/src/threeModeMinimalLoop.js",
  index: "packages/world-class-product-conversion/src/index.js",
  preconditionEvidence: "apps/ai-gateway-service/evidence/phase1916_1919a/precondition-check-result.json",
});

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(repoPath(relativePath), "utf8"));
  } catch {
    return null;
  }
}

function check(id, passed) {
  return { id, passed: Boolean(passed) };
}

const result = readJson(paths.result) ?? {};
const normal = readJson(paths.normal) ?? {};
const god = readJson(paths.god) ?? {};
const tianshu = readJson(paths.tianshu) ?? {};
const precondition = readJson(paths.preconditionEvidence) ?? {};
const html = createConsolePage();
const checks = [
  check("precondition_allows_execution", precondition.allowExecution === true),
  check("module_exists", existsSync(repoPath(paths.module)) && existsSync(repoPath(paths.index))),
  check("docs_exist", existsSync(repoPath(paths.doc)) && existsSync(repoPath(paths.contract)) && existsSync(repoPath(paths.rollback))),
  check("result_completed", result.completed === true),
  check("result_recommended_sealed", result.recommended_sealed === true),
  check("blocker_null", result.blocker === null),
  check("normal_ready", result.normalModeLoopReady === true && normal.mode === "normal" && normal.providerCallsMade === false),
  check("god_ready", result.godModeLoopReady === true && god.mode === "god" && Array.isArray(god.candidates) && god.candidates.length === 3),
  check("tianshu_ready", result.tianshuModeLoopReady === true && tianshu.mode === "tianshu" && typeof tianshu.recommendedMode === "string"),
  check("provider_false", result.providerCallsMade === false && result.realProviderCallExecuted === false),
  check("secret_false", result.secretValueExposed === false && result.rawSecretRead === false && result.authJsonRead === false),
  check("deploy_release_false", result.deployExecuted === false && result.releaseExecuted === false && result.tagCreated === false && result.artifactUploaded === false),
  check("chat_gateway_execute_false", result.chatGatewayExecuteModified === false),
  check("legacy_project_context_false", result.legacyModified === false && result.projectContextModified === false),
  check("workspace_clean_false", result.workspaceCleanClaimed === false),
  check("production_ready_false", result.productionReadyClaimed === false),
  check("ui_normal_text", html.includes("Normal Mode：最小任务闭环可预览")),
  check("ui_god_text", html.includes("God Mode：本地候选方案互评可预览")),
  check("ui_tianshu_text", html.includes("Tianshu Mode：任务模式推荐可预览")),
  check("ui_provider_false", html.includes("Provider 调用：未发生")),
  check("ui_secret_false", html.includes("Secret 读取：未发生")),
  check("ui_chat_gateway_false", html.includes("默认链路：/chat-gateway/execute 未修改")),
];

const passed = checks.every((item) => item.passed);
const validationResult = {
  phase: "Phase1916A",
  name: "Three-Mode Minimal Real Task Loop",
  completed: passed && result.completed === true,
  recommended_sealed: passed && result.recommended_sealed === true,
  blocker: passed ? null : checks.find((item) => !item.passed)?.id ?? "validation_failed",
  normalModeLoopReady: result.normalModeLoopReady === true,
  godModeLoopReady: result.godModeLoopReady === true,
  tianshuModeLoopReady: result.tianshuModeLoopReady === true,
  realProviderCallExecuted: false,
  providerCallsMade: false,
  secretValueExposed: false,
  rawSecretRead: false,
  authJsonRead: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  productionReadyClaimed: false,
  nextRecommendedPhase: "Phase1917A Guarded Real Provider Stability Authorization Packet",
  checks,
};

console.log(JSON.stringify(validationResult, null, 2));
if (!validationResult.completed || !validationResult.recommended_sealed || validationResult.blocker) {
  process.exitCode = 1;
}
