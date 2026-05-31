import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2096A-2100A-Controlled-Triple-Tool-Mutation";
const runnerPath = "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs";
const docsPath = "docs/phase2096-2100-controlled-triple-tool-mutation.md";
const approvalPath = "docs/phase2096-2100-controlled-triple-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2096-triple-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2097-triple-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2100-triple-tool-mutation-target-three.proposal.diff";
const targetOnePath = "tools/phase2091/generated-source-patch-target.mjs";
const targetTwoPath = "tools/phase2092/apply-controlled-existing-tool-mutation.mjs";
const targetThreePath = "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2096-2100-controlled-triple-tool-mutation";
const resultPath = `${evidenceDir}/result.json`;
const resultMdPath = `${evidenceDir}/result.md`;
const rollbackPath = `${evidenceDir}/rollback.json`;
const smokePath = `${evidenceDir}/triple-smoke.json`;
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2095 = readJson("apps/ai-gateway-service/evidence/phase2093-2095-controlled-batch-tool-mutation/result.json") || {};
const result = readJson(resultPath);
const rollback = readJson(rollbackPath);
const smoke = readJson(smokePath);
const targetOne = existsSync(resolve(targetOnePath)) ? readText(targetOnePath) : "";
const targetTwo = existsSync(resolve(targetTwoPath)) ? readText(targetTwoPath) : "";
const targetThree = existsSync(resolve(targetThreePath)) ? readText(targetThreePath) : "";
const docs = existsSync(resolve(docsPath)) ? readText(docsPath) : "";

check("runner_exists", existsSync(resolve(runnerPath)));
check("docs_exists", existsSync(resolve(docsPath)));
check("approval_exists", existsSync(resolve(approvalPath)));
check("proposal_one_exists", existsSync(resolve(proposalOnePath)));
check("proposal_two_exists", existsSync(resolve(proposalTwoPath)));
check("proposal_three_exists", existsSync(resolve(proposalThreePath)));
check(
  "package_apply_script_registered",
  packageJson.scripts?.["apply:phase2096-2100-controlled-triple-tool-mutation"] ===
    "node tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs --plan docs/phase2096-2100-controlled-triple-tool-mutation-approval.example.json",
);
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2096-2100-controlled-triple-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\"",
);
check(
  "package_verify_script_registered",
  packageJson.scripts?.["verify:phase2096-2100-controlled-triple-tool-mutation"] ===
    "node tools/phase2096_2100/validate-controlled-triple-tool-mutation.mjs",
);
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2095_sealed", phase2095.recommendedSealed === true && phase2095.batchMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2096-2100-controlled-triple-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("triple_mutation_applied", result.tripleMutationApplied === true);
  check("changed_file_count_three", result.changedFileCount === 3);
  check(
    "changed_files_expected",
    Array.isArray(result.changedFiles) &&
      result.changedFiles.includes(targetOnePath) &&
      result.changedFiles.includes(targetTwoPath) &&
      result.changedFiles.includes(targetThreePath),
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localTripleSmokePassed === true);
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
  check("rollback_restore_triple", rollback.rollbackAction === "restore-previous-content-triple");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_three_entries", Array.isArray(rollback.files) && rollback.files.length === 3);
}

if (smoke) {
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_phase2091_marker", smoke.phase2091Marker === "PHASE2091_SOURCE_PATCH_OK");
  check("smoke_phase2092_marker", smoke.phase2092Marker === "PHASE2092_EXISTING_TOOL_MUTATION_OK");
  check("smoke_phase2093_marker", smoke.phase2093Marker === "PHASE2093_BATCH_TOOL_TARGET_ONE_OK");
  check("smoke_phase2096_marker", smoke.phase2096Marker === "PHASE2096_TRIPLE_TOOL_TARGET_ONE_OK");
  check("smoke_phase2094_marker", smoke.phase2094Marker === "PHASE2094_BATCH_TOOL_TARGET_TWO_OK");
  check("smoke_phase2097_marker", smoke.phase2097Marker === "PHASE2097_TRIPLE_TOOL_TARGET_TWO_OK");
  check("smoke_phase2100_marker", smoke.phase2100Marker === "PHASE2100_TRIPLE_TOOL_TARGET_THREE_OK");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target_one_phase2096_export", targetOne.includes("export function buildPhase2096TripleMutationTargetOneStatus"));
check("target_one_phase2096_marker", targetOne.includes("PHASE2096_TRIPLE_TOOL_TARGET_ONE_OK"));
check("target_two_phase2097_export", targetTwo.includes("export function buildPhase2097TripleMutationTargetTwoStatus"));
check("target_two_phase2097_marker", targetTwo.includes("PHASE2097_TRIPLE_TOOL_TARGET_TWO_OK"));
check("target_three_phase2100_export", targetThree.includes("export function buildPhase2100TripleMutationRuntimeStatus"));
check("target_three_phase2100_marker", targetThree.includes("PHASE2100_TRIPLE_TOOL_TARGET_THREE_OK"));
check("target_three_main_guarded", targetThree.includes("pathToFileURL(process.argv[1]).href") && targetThree.includes("export function main()"));
check("targets_no_plain_secret_value", !hasPlainSecretValue(targetOne) && !hasPlainSecretValue(targetTwo) && !hasPlainSecretValue(targetThree));
check("docs_mentions_triple", docs.includes("controlled triple tool mutation"));
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
  phase2095Sealed: phase2095.recommendedSealed === true,
  tripleMutationReady: completed,
  changedFiles: [targetOnePath, targetTwoPath, targetThreePath],
  tripleMutationApplied: result?.tripleMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localTripleSmokePassed: result?.localTripleSmokePassed === true,
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
  },
  checks,
};

writeJson(resultPath, result ? { ...result, verifier: verifierResult } : verifierResult);
writeText(resultMdPath, renderMarkdown(verifierResult));
console.log(JSON.stringify({
  status: verifierResult.status,
  blocker: verifierResult.blocker,
  tripleMutationApplied: verifierResult.tripleMutationApplied,
  nodeCheckPassed: verifierResult.nodeCheckPassed,
  localTripleSmokePassed: verifierResult.localTripleSmokePassed,
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
    "# Phase2096A-2100A Controlled Triple Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${result.recommendedSealed}`,
    `- blocker: ${result.blocker}`,
    `- tripleMutationApplied: ${result.tripleMutationApplied}`,
    `- nodeCheckPassed: ${result.nodeCheckPassed}`,
    `- localTripleSmokePassed: ${result.localTripleSmokePassed}`,
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

function hasPlainSecretValue(value) {
  return /\bsk-[A-Za-z0-9]{20,}|CRS_OAI_KEY\s*=\s*\S+|api[_-]?key\s*[:=]\s*[A-Za-z0-9_-]{16,}|secret\s*[:=]\s*[A-Za-z0-9_-]{16,}|token\s*[:=]\s*[A-Za-z0-9_-]{16,}|session id:\s*[0-9a-f-]{12,}/i.test(
    String(value || ""),
  );
}
