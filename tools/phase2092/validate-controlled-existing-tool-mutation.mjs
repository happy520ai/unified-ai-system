import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2092A-Controlled-Existing-Tool-Source-Mutation";
const runnerPath = "tools/phase2092/apply-controlled-existing-tool-mutation.mjs";
const docsPath = "docs/phase2092-controlled-existing-tool-mutation.md";
const approvalPath = "docs/phase2092-controlled-existing-tool-mutation-approval.example.json";
const proposalPath = "docs/phase2092-controlled-existing-tool-mutation.proposal.diff";
const targetPath = "tools/phase2091/generated-source-patch-target.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2092-controlled-existing-tool-mutation";
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
const phase2091 = readJson("apps/ai-gateway-service/evidence/phase2091-controlled-source-patch-apply/result.json") || {};
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
  packageJson.scripts?.["apply:phase2092-controlled-existing-tool-mutation"] ===
    "node tools/phase2092/apply-controlled-existing-tool-mutation.mjs --plan docs/phase2092-controlled-existing-tool-mutation-approval.example.json",
);
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2092-controlled-existing-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs",
);
check(
  "package_verify_script_registered",
  packageJson.scripts?.["verify:phase2092-controlled-existing-tool-mutation"] ===
    "node tools/phase2092/validate-controlled-existing-tool-mutation.mjs",
);
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2091_sealed", phase2091.recommendedSealed === true && phase2091.sourcePatchApplied === true);
check("result_exists", result !== null, "run apply:phase2092-controlled-existing-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("existing_tool_mutation_applied", result.existingToolMutationApplied === true);
  check("target_file_modified", result.targetFileModified === true && existsSync(resolve(targetPath)));
  check("single_existing_source_file", result.changedFileCount === 1 && result.changedFiles?.[0] === targetPath);
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
  check("rollback_replace_previous_content", rollback.rollbackAction === "restore-previous-content");
  check("rollback_target_scoped", rollback.targetPath === targetPath);
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_has_previous_sha", typeof rollback.previousFileSha256 === "string" && rollback.previousFileSha256.length === 64);
  check("rollback_has_mutated_sha", typeof rollback.mutatedFileSha256 === "string" && rollback.mutatedFileSha256.length === 64);
}

if (smoke) {
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_phase2091_marker_still_ok", smoke.phase2091Marker === "PHASE2091_SOURCE_PATCH_OK");
  check("smoke_phase2092_marker_ok", smoke.phase2092Marker === "PHASE2092_EXISTING_TOOL_MUTATION_OK");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target_preserves_phase2091_export", targetContent.includes("export function buildPhase2091SourcePatchStatus"));
check("target_preserves_phase2091_marker", targetContent.includes("PHASE2091_SOURCE_PATCH_OK"));
check("target_exports_phase2092_function", targetContent.includes("export function buildPhase2092ExistingToolMutationStatus"));
check("target_phase2092_marker_present", targetContent.includes("PHASE2092_EXISTING_TOOL_MUTATION_OK"));
check("target_has_cli_smoke", targetContent.includes("import.meta.url") && targetContent.includes("console.log"));
check("target_no_secret_like_text", !hasUnsafeText(targetContent));
check("docs_mentions_existing_tool_mutation", docs.includes("existing tool source mutation"));
check("docs_mentions_no_codex", docs.includes("codexExecExecuted=false"));
check("docs_mentions_no_provider", docs.includes("providerCallsMade=false"));
check("docs_mentions_no_chat", docs.includes("default `/chat` unchanged") && docs.includes("`/chat-gateway/execute` unchanged"));

const failed = checks.filter((entry) => !entry.pass);
const completed = failed.length === 0;
const verifierResult = {
  phaseId,
  completed,
  status: completed ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  phase632PreflightPassed: phase632.preflightPassed === true,
  phase2091Sealed: phase2091.recommendedSealed === true,
  existingToolMutationReady: completed,
  targetPath,
  existingToolMutationApplied: result?.existingToolMutationApplied === true,
  targetFileModified: result?.targetFileModified === true,
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
  existingToolMutationApplied: verifierResult.existingToolMutationApplied,
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
    "# Phase2092A Controlled Existing Tool Source Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${result.recommendedSealed}`,
    `- blocker: ${result.blocker}`,
    `- existingToolMutationApplied: ${result.existingToolMutationApplied}`,
    `- targetFileModified: ${result.targetFileModified}`,
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
