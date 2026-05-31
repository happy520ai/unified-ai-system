import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2091A-Controlled-Source-Patch-Apply";
const runnerPath = "tools/phase2091/apply-controlled-source-patch.mjs";
const docsPath = "docs/phase2091-controlled-source-patch-apply.md";
const approvalPath = "docs/phase2091-controlled-source-patch-approval.example.json";
const proposalPath = "docs/phase2091-controlled-source-patch.proposal.diff";
const targetPath = "tools/phase2091/generated-source-patch-target.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2091-controlled-source-patch-apply";
const resultPath = `${evidenceDir}/result.json`;
const resultMdPath = `${evidenceDir}/result.md`;
const rollbackPath = `${evidenceDir}/rollback.json`;
const smokePath = `${evidenceDir}/source-smoke.json`;
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2090 = readJson("apps/ai-gateway-service/evidence/phase2090-controlled-patch-apply-gate/result.json") || {};
const result = readJson(resultPath);
const rollback = readJson(rollbackPath);
const smoke = readJson(smokePath);
const targetContent = existsSync(resolve(targetPath)) ? readText(targetPath) : "";
const docs = existsSync(resolve(docsPath)) ? readText(docsPath) : "";

check("runner_exists", existsSync(resolve(runnerPath)));
check("docs_exists", existsSync(resolve(docsPath)));
check("approval_exists", existsSync(resolve(approvalPath)));
check("proposal_exists", existsSync(resolve(proposalPath)));
check(
  "package_apply_script_registered",
  packageJson.scripts?.["apply:phase2091-controlled-source-patch-apply"] ===
    "node tools/phase2091/apply-controlled-source-patch.mjs --plan docs/phase2091-controlled-source-patch-approval.example.json",
);
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2091-controlled-source-patch-apply"] ===
    "node tools/phase2091/generated-source-patch-target.mjs",
);
check(
  "package_verify_script_registered",
  packageJson.scripts?.["verify:phase2091-controlled-source-patch-apply"] ===
    "node tools/phase2091/validate-controlled-source-patch-apply.mjs",
);
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2090_sealed", phase2090.recommendedSealed === true && phase2090.patchApplied === true);
check("result_exists", result !== null, "run apply:phase2091-controlled-source-patch-apply first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("source_patch_applied", result.sourcePatchApplied === true);
  check("target_file_created", result.targetFileCreated === true && existsSync(resolve(targetPath)));
  check("single_source_file", result.changedFileCount === 1 && result.changedFiles?.[0] === targetPath);
  check("node_check_passed", result.nodeCheckPassed === true);
  check("local_source_smoke_passed", result.localSourceSmokePassed === true);
  check("rollback_available", result.rollbackAvailable === true && result.rollbackPath === rollbackPath);
  check("codex_exec_false", result.codexExecExecuted === false);
  check("provider_false", result.providerCallsMade === false && result.projectProviderCallsMade === false);
  check("secret_false", result.secretRead === false && result.envRead === false && result.authJsonRead === false);
  check("chat_false", result.chatModified === false && result.chatGatewayExecuteModified === false);
  check("deploy_release_false", result.deployExecuted === false && result.releaseExecuted === false);
  check("push_commit_false", result.pushExecuted === false && result.commitCreated === false);
  check("workspace_clean_not_claimed", result.workspaceCleanClaimed === false);
}

if (rollback) {
  check("rollback_phase_matches", rollback.phaseId === phaseId);
  check("rollback_delete_created_file", rollback.rollbackAction === "delete-created-file");
  check("rollback_target_scoped", rollback.targetPath === targetPath);
  check("rollback_not_executed", rollback.rollbackExecuted === false);
}

if (smoke) {
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_marker_ok", smoke.marker === "PHASE2091_SOURCE_PATCH_OK");
  check("smoke_phase_id", smoke.phaseId === phaseId);
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target_exports_function", targetContent.includes("export function buildPhase2091SourcePatchStatus"));
check("target_marker_present", targetContent.includes("PHASE2091_SOURCE_PATCH_OK"));
check("target_has_cli_smoke", targetContent.includes("import.meta.url") && targetContent.includes("console.log"));
check("target_no_secret_like_text", !hasUnsafeText(targetContent));
check("docs_mentions_no_codex", docs.includes("codexExecExecuted=false"));
check("docs_mentions_no_provider", docs.includes("providerCallsMade=false"));
check("docs_mentions_no_chat", docs.includes("default `/chat` unchanged") && docs.includes("`/chat-gateway/execute` unchanged"));
check("docs_mentions_real_source_patch", docs.includes("real source patch"));

const failed = checks.filter((entry) => !entry.pass);
const completed = failed.length === 0;
const verifierResult = {
  phaseId,
  completed,
  status: completed ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  phase632PreflightPassed: phase632.preflightPassed === true,
  phase2090Sealed: phase2090.recommendedSealed === true,
  sourcePatchApplyReady: completed,
  targetPath,
  sourcePatchApplied: result?.sourcePatchApplied === true,
  targetFileCreated: existsSync(resolve(targetPath)),
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localSourceSmokePassed: result?.localSourceSmokePassed === true,
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
    smoke: smokePath,
    target: targetPath,
  },
  checks,
};

writeJson(resultPath, result ? { ...result, verifier: verifierResult } : verifierResult);
writeText(resultMdPath, renderMarkdown(verifierResult));
console.log(JSON.stringify({
  status: verifierResult.status,
  blocker: verifierResult.blocker,
  sourcePatchApplied: verifierResult.sourcePatchApplied,
  nodeCheckPassed: verifierResult.nodeCheckPassed,
  localSourceSmokePassed: verifierResult.localSourceSmokePassed,
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
    "# Phase2091A Controlled Source Patch Apply Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${result.recommendedSealed}`,
    `- blocker: ${result.blocker}`,
    `- sourcePatchApplied: ${result.sourcePatchApplied}`,
    `- targetFileCreated: ${result.targetFileCreated}`,
    `- nodeCheckPassed: ${result.nodeCheckPassed}`,
    `- localSourceSmokePassed: ${result.localSourceSmokePassed}`,
    `- rollbackAvailable: ${result.rollbackAvailable}`,
    `- codexExecExecuted: ${result.codexExecExecuted}`,
    `- providerCallsMade: ${result.providerCallsMade}`,
    `- chatModified: ${result.chatModified}`,
    `- chatGatewayExecuteModified: ${result.chatGatewayExecuteModified}`,
    `- commitCreated: ${result.commitCreated}`,
    `- pushExecuted: ${result.pushExecuted}`,
    `- deployExecuted: ${result.deployExecuted}`,
    `- releaseExecuted: ${result.releaseExecuted}`,
    `- workspaceCleanClaimed: ${result.workspaceCleanClaimed}`,
    "",
  ].join("\n");
}

function hasUnsafeText(value) {
  return /https?:\/\/|CRS_OAI_KEY\s*=|\bsk-[A-Za-z0-9]{20,}|api[_-]?key\s*[:=]|secret\s*[:=]|token\s*[:=]|session id:\s*[0-9a-f-]{12,}|[A-Za-z]:\\/.test(
    String(value || ""),
  );
}
