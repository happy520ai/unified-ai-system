import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2090A-Controlled-Patch-Apply-Gate";
const runnerPath = "tools/phase2090/apply-controlled-patch-proposal.mjs";
const docsPath = "docs/phase2090-controlled-patch-apply-gate.md";
const approvalExamplePath = "docs/phase2090-controlled-patch-apply-approval.example.json";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2090-controlled-patch-apply-gate";
const resultPath = `${evidenceDir}/result.json`;
const resultMdPath = `${evidenceDir}/result.md`;
const rollbackPath = `${evidenceDir}/rollback.json`;
const sourceProposalPath = "apps/ai-gateway-service/evidence/phase2089-controlled-codex-patch-proposal/codex-patch-proposal.md";
const targetPath = "docs/phase2089-codex-generated-patch-proposal-target.md";
const packageApplyScriptName = "apply:phase2090-controlled-patch-apply-gate";
const packageVerifyScriptName = "verify:phase2090-controlled-patch-apply-gate";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632Preflight = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2089 = readJson("apps/ai-gateway-service/evidence/phase2089-controlled-codex-patch-proposal/result.json") || {};
const result = readJson(resultPath);
const rollback = readJson(rollbackPath);
const targetContent = existsSync(resolve(targetPath)) ? readText(targetPath) : "";
const docs = existsSync(resolve(docsPath)) ? readText(docsPath) : "";

check("runner_exists", existsSync(resolve(runnerPath)));
check("docs_exists", existsSync(resolve(docsPath)));
check("approval_example_exists", existsSync(resolve(approvalExamplePath)));
check(
  "package_apply_script_registered",
  packageJson.scripts?.[packageApplyScriptName] ===
    "node tools/phase2090/apply-controlled-patch-proposal.mjs --plan docs/phase2090-controlled-patch-apply-approval.example.json",
);
check(
  "package_verify_script_registered",
  packageJson.scripts?.[packageVerifyScriptName] === "node tools/phase2090/validate-controlled-patch-apply-gate.mjs",
);
check("phase632_preflight_passed", phase632Preflight.preflightPassed === true && phase632Preflight.staleFalse === true);
check("phase2089_sealed", phase2089.recommendedSealed === true && phase2089.proposalFileExists === true);
check("source_proposal_exists", existsSync(resolve(sourceProposalPath)));
check("result_exists", result !== null, "run apply:phase2090-controlled-patch-apply-gate first");
check("rollback_exists", rollback !== null, "rollback evidence must be generated");

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("patch_applied_true", result.patchApplied === true);
  check("target_file_created_true", result.targetFileCreated === true && existsSync(resolve(targetPath)));
  check("target_path_scoped", result.targetPath === targetPath);
  check("source_proposal_path_scoped", result.sourceProposalPath === sourceProposalPath);
  check("rollback_available", result.rollbackAvailable === true && result.rollbackPath === rollbackPath);
  check("single_file_docs_only", result.changedFileCount === 1 && Array.isArray(result.changedFiles) && result.changedFiles[0] === targetPath);
  check("codex_exec_false", result.codexExecExecuted === false);
  check("provider_calls_false", result.providerCallsMade === false && result.projectProviderCallsMade === false);
  check("secret_false", result.secretRead === false && result.envRead === false && result.authJsonRead === false);
  check("codex_config_false", result.codexConfigModified === false && result.codexBaseUrlModified === false);
  check("chat_false", result.chatModified === false && result.chatGatewayExecuteModified === false);
  check("deploy_release_false", result.deployExecuted === false && result.releaseExecuted === false);
  check("push_commit_false", result.pushExecuted === false && result.commitCreated === false);
  check("legacy_false", result.legacyModified === false);
  check("project_context_false", result.projectContextCreated === false);
  check("workspace_clean_not_claimed", result.workspaceCleanClaimed === false);
}

if (rollback) {
  check("rollback_phase_matches", rollback.phaseId === phaseId);
  check("rollback_target_path_scoped", rollback.targetPath === targetPath);
  check("rollback_action_delete_created_file", rollback.rollbackAction === "delete-created-file");
  check("rollback_has_content_sha256", typeof rollback.createdFileSha256 === "string" && rollback.createdFileSha256.length === 64);
  check("rollback_not_executed", rollback.rollbackExecuted === false);
}

check("target_contains_marker", targetContent.includes("PHASE2089_CODEX_PATCH_PROPOSAL_OK"));
check("target_contains_expected_heading", targetContent.includes("# Phase2089 Codex Generated Patch Proposal Target"));
check("target_no_secret_like_text", !hasUnsafeEvidenceText(targetContent));
check("docs_mentions_no_codex", docs.includes("codexExecExecuted=false"));
check("docs_mentions_no_provider", docs.includes("providerCallsMade=false"));
check("docs_mentions_no_chat", docs.includes("default `/chat` unchanged") && docs.includes("`/chat-gateway/execute` unchanged"));
check("docs_mentions_rollback", docs.includes("rollback"));

const failed = checks.filter((entry) => !entry.pass);
const completed = failed.length === 0;
const verifierResult = {
  phaseId,
  completed,
  status: completed ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  phase632PreflightPassed: phase632Preflight.preflightPassed === true,
  phase2089Sealed: phase2089.recommendedSealed === true,
  controlledPatchApplyReady: completed,
  sourceProposalPath,
  targetPath,
  patchApplied: result?.patchApplied === true,
  targetFileCreated: existsSync(resolve(targetPath)),
  rollbackAvailable: rollback !== null,
  codexExecExecuted: false,
  providerCallsMade: false,
  secretRead: false,
  envRead: false,
  authJsonRead: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  legacyModified: false,
  projectContextCreated: false,
  workspaceCleanClaimed: false,
  productionReadyClaimed: false,
  releaseReadyClaimed: false,
  blocker: completed ? "none" : failed.map((entry) => entry.id).join(", "),
  recommendedSealed: completed,
  evidenceRefs: {
    result: resultPath,
    rollback: rollbackPath,
    verifierMarkdown: resultMdPath,
    sourceProposal: sourceProposalPath,
    target: targetPath,
  },
  checks,
};

writeJson(resultPath, result ? { ...result, verifier: verifierResult } : verifierResult);
writeText(resultMdPath, renderMarkdown(verifierResult));
console.log(JSON.stringify({
  status: verifierResult.status,
  blocker: verifierResult.blocker,
  patchApplied: verifierResult.patchApplied,
  targetFileCreated: verifierResult.targetFileCreated,
  rollbackAvailable: verifierResult.rollbackAvailable,
}, null, 2));
if (!verifierResult.recommendedSealed) process.exit(1);

function resolve(relativePath) {
  return path.join(repoRoot, relativePath);
}

function readText(relativePath) {
  return readFileSync(resolve(relativePath), "utf8").replace(/^\uFEFF/, "");
}

function readJson(relativePath) {
  const filePath = resolve(relativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(relativePath, value) {
  const filePath = resolve(relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(relativePath, value) {
  const filePath = resolve(relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function renderMarkdown(result) {
  return [
    "# Phase2090A Controlled Patch Apply Gate Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${result.recommendedSealed}`,
    `- blocker: ${result.blocker}`,
    `- patchApplied: ${result.patchApplied}`,
    `- targetFileCreated: ${result.targetFileCreated}`,
    `- rollbackAvailable: ${result.rollbackAvailable}`,
    `- codexExecExecuted: ${result.codexExecExecuted}`,
    `- providerCallsMade: ${result.providerCallsMade}`,
    `- secretRead: ${result.secretRead}`,
    `- envRead: ${result.envRead}`,
    `- authJsonRead: ${result.authJsonRead}`,
    `- chatModified: ${result.chatModified}`,
    `- chatGatewayExecuteModified: ${result.chatGatewayExecuteModified}`,
    `- deployExecuted: ${result.deployExecuted}`,
    `- releaseExecuted: ${result.releaseExecuted}`,
    `- pushExecuted: ${result.pushExecuted}`,
    `- commitCreated: ${result.commitCreated}`,
    `- workspaceCleanClaimed: ${result.workspaceCleanClaimed}`,
    "",
  ].join("\n");
}

function hasUnsafeEvidenceText(value) {
  return /https?:\/\/|CRS_OAI_KEY\s*=|\bsk-[A-Za-z0-9]{20,}|api[_-]?key\s*[:=]|secret\s*[:=]|token\s*[:=]|session id:\s*[0-9a-f-]{12,}|[A-Za-z]:\\/.test(
    String(value || ""),
  );
}
