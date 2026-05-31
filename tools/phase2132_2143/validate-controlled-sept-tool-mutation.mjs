import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2132A-2143A-Controlled-Sept-Tool-Mutation";
const runnerPath = "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2132-2143-controlled-sept-tool-mutation.md";
const approvalPath = "docs/phase2132-2143-controlled-sept-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2137-sept-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2138-sept-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2139-sept-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2140-sept-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2141-sept-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2142-sept-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2143-sept-tool-mutation-target-seven.proposal.diff";
const targetOnePath = "tools/phase2091/generated-source-patch-target.mjs";
const targetTwoPath = "tools/phase2092/apply-controlled-existing-tool-mutation.mjs";
const targetThreePath = "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs";
const targetFourPath = "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs";
const targetFivePath = "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs";
const targetSixPath = "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs";
const targetSevenPath = "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2132-2143-controlled-sept-tool-mutation";
const resultPath = `${evidenceDir}/result.json`;
const resultMdPath = `${evidenceDir}/result.md`;
const rollbackPath = `${evidenceDir}/rollback.json`;
const smokePath = `${evidenceDir}/sept-smoke.json`;
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2131 = readJson("apps/ai-gateway-service/evidence/phase2121-2131-controlled-sext-tool-mutation/result.json") || {};
const result = readJson(resultPath);
const rollback = readJson(rollbackPath);
const smoke = readJson(smokePath);
const targetOne = existsSync(resolve(targetOnePath)) ? readText(targetOnePath) : "";
const targetTwo = existsSync(resolve(targetTwoPath)) ? readText(targetTwoPath) : "";
const targetThree = existsSync(resolve(targetThreePath)) ? readText(targetThreePath) : "";
const targetFour = existsSync(resolve(targetFourPath)) ? readText(targetFourPath) : "";
const targetFive = existsSync(resolve(targetFivePath)) ? readText(targetFivePath) : "";
const targetSix = existsSync(resolve(targetSixPath)) ? readText(targetSixPath) : "";
const targetSeven = existsSync(resolve(targetSevenPath)) ? readText(targetSevenPath) : "";
const docs = existsSync(resolve(docsPath)) ? readText(docsPath) : "";
const substrate = existsSync(resolve(substratePath)) ? readText(substratePath) : "";

check("runner_exists", existsSync(resolve(runnerPath)));
check("substrate_exists", existsSync(resolve(substratePath)));
check("docs_exists", existsSync(resolve(docsPath)));
check("approval_exists", existsSync(resolve(approvalPath)));
check("proposal_one_exists", existsSync(resolve(proposalOnePath)));
check("proposal_two_exists", existsSync(resolve(proposalTwoPath)));
check("proposal_three_exists", existsSync(resolve(proposalThreePath)));
check("proposal_four_exists", existsSync(resolve(proposalFourPath)));
check("proposal_five_exists", existsSync(resolve(proposalFivePath)));
check("proposal_six_exists", existsSync(resolve(proposalSixPath)));
check("proposal_seven_exists", existsSync(resolve(proposalSevenPath)));
check(
  "package_apply_script_registered",
  packageJson.scripts?.["apply:phase2132-2143-controlled-sept-tool-mutation"] ===
    "node tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs --plan docs/phase2132-2143-controlled-sept-tool-mutation-approval.example.json",
);
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2132-2143-controlled-sept-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2142SeptMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2143SeptMutationRuntimeStatus())))\"",
);
check(
  "package_verify_script_registered",
  packageJson.scripts?.["verify:phase2132-2143-controlled-sept-tool-mutation"] ===
    "node tools/phase2132_2143/validate-controlled-sept-tool-mutation.mjs",
);
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2131_sealed", phase2131.recommendedSealed === true && phase2131.sextMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2132-2143-controlled-sept-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("sept_mutation_applied", result.septMutationApplied === true);
  check("changed_file_count_seven", result.changedFileCount === 7);
  check(
    "changed_files_expected",
    Array.isArray(result.changedFiles) &&
      result.changedFiles.includes(targetOnePath) &&
      result.changedFiles.includes(targetTwoPath) &&
      result.changedFiles.includes(targetThreePath) &&
      result.changedFiles.includes(targetFourPath) &&
      result.changedFiles.includes(targetFivePath) &&
      result.changedFiles.includes(targetSixPath) &&
      result.changedFiles.includes(targetSevenPath),
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localSeptSmokePassed === true);
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
  check("rollback_restore_sept", rollback.rollbackAction === "restore-previous-content-sept");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_seven_entries", Array.isArray(rollback.files) && rollback.files.length === 7);
}

if (smoke) {
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_phase2091_marker", smoke.phase2091Marker === "PHASE2091_SOURCE_PATCH_OK");
  check("smoke_phase2126_marker", smoke.phase2126Marker === "PHASE2126_SEXT_TOOL_TARGET_ONE_OK");
  check("smoke_phase2137_marker", smoke.phase2137Marker === "PHASE2137_SEPT_TOOL_TARGET_ONE_OK");
  check("smoke_phase2094_marker", smoke.phase2094Marker === "PHASE2094_BATCH_TOOL_TARGET_TWO_OK");
  check("smoke_phase2127_marker", smoke.phase2127Marker === "PHASE2127_SEXT_TOOL_TARGET_TWO_OK");
  check("smoke_phase2138_marker", smoke.phase2138Marker === "PHASE2138_SEPT_TOOL_TARGET_TWO_OK");
  check("smoke_phase2100_marker", smoke.phase2100Marker === "PHASE2100_TRIPLE_TOOL_TARGET_THREE_OK");
  check("smoke_phase2128_marker", smoke.phase2128Marker === "PHASE2128_SEXT_TOOL_TARGET_THREE_OK");
  check("smoke_phase2139_marker", smoke.phase2139Marker === "PHASE2139_SEPT_TOOL_TARGET_THREE_OK");
  check("smoke_phase2109_marker", smoke.phase2109Marker === "PHASE2109_QUAD_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2129_marker", smoke.phase2129Marker === "PHASE2129_SEXT_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2140_marker", smoke.phase2140Marker === "PHASE2140_SEPT_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2120_marker", smoke.phase2120Marker === "PHASE2120_QUINT_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2130_marker", smoke.phase2130Marker === "PHASE2130_SEXT_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2141_marker", smoke.phase2141Marker === "PHASE2141_SEPT_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2142_marker", smoke.phase2142Marker === "PHASE2142_SEPT_TOOL_TARGET_SIX_OK");
  check("smoke_phase2143_marker", smoke.phase2143Marker === "PHASE2143_SEPT_TOOL_TARGET_SEVEN_OK");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target_one_phase2137_export", targetOne.includes("export function buildPhase2137SeptMutationTargetOneStatus"));
check("target_one_phase2137_marker", targetOne.includes("PHASE2137_SEPT_TOOL_TARGET_ONE_OK"));
check("target_two_phase2138_export", targetTwo.includes("export function buildPhase2138SeptMutationTargetTwoStatus"));
check("target_two_phase2138_marker", targetTwo.includes("PHASE2138_SEPT_TOOL_TARGET_TWO_OK"));
check("target_three_phase2139_export", targetThree.includes("export function buildPhase2139SeptMutationTargetThreeStatus"));
check("target_three_phase2139_marker", targetThree.includes("PHASE2139_SEPT_TOOL_TARGET_THREE_OK"));
check("target_four_phase2140_export", targetFour.includes("export function buildPhase2140SeptMutationTargetFourStatus"));
check("target_four_phase2140_marker", targetFour.includes("PHASE2140_SEPT_TOOL_TARGET_FOUR_OK"));
check("target_five_phase2141_export", targetFive.includes("export function buildPhase2141SeptMutationTargetFiveStatus"));
check("target_five_phase2141_marker", targetFive.includes("PHASE2141_SEPT_TOOL_TARGET_FIVE_OK"));
check("target_six_phase2142_export", targetSix.includes("export function buildPhase2142SeptMutationTargetSixStatus"));
check("target_six_phase2142_marker", targetSix.includes("PHASE2142_SEPT_TOOL_TARGET_SIX_OK"));
check("target_seven_phase2143_export", targetSeven.includes("export function buildPhase2143SeptMutationRuntimeStatus"));
check("target_seven_phase2143_marker", targetSeven.includes("PHASE2143_SEPT_TOOL_TARGET_SEVEN_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_apply_hunks", substrate.includes("export function applyUnifiedMutationHunks"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check(
  "targets_no_plain_secret_value",
  !hasPlainSecretValue(targetOne) &&
    !hasPlainSecretValue(targetTwo) &&
    !hasPlainSecretValue(targetThree) &&
    !hasPlainSecretValue(targetFour) &&
    !hasPlainSecretValue(targetFive) &&
    !hasPlainSecretValue(targetSix) &&
    !hasPlainSecretValue(targetSeven),
);
check("docs_mentions_sept", docs.includes("controlled sept tool mutation"));
check("docs_mentions_smoke_helper", docs.includes("JSON smoke helper"));
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
  phase2131Sealed: phase2131.recommendedSealed === true,
  septMutationReady: completed,
  changedFiles: [targetOnePath, targetTwoPath, targetThreePath, targetFourPath, targetFivePath, targetSixPath, targetSevenPath],
  septMutationApplied: result?.septMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localSeptSmokePassed: result?.localSeptSmokePassed === true,
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
  septMutationApplied: verifierResult.septMutationApplied,
  nodeCheckPassed: verifierResult.nodeCheckPassed,
  localSeptSmokePassed: verifierResult.localSeptSmokePassed,
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
    "# Phase2132A-2143A Controlled Sept Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${result.recommendedSealed}`,
    `- blocker: ${result.blocker}`,
    `- septMutationApplied: ${result.septMutationApplied}`,
    `- nodeCheckPassed: ${result.nodeCheckPassed}`,
    `- localSeptSmokePassed: ${result.localSeptSmokePassed}`,
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
