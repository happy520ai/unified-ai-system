import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2144A-2156A-Controlled-Oct-Tool-Mutation";
const runnerPath = "tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2144-2156-controlled-oct-tool-mutation.md";
const approvalPath = "docs/phase2144-2156-controlled-oct-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2149-oct-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2150-oct-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2151-oct-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2152-oct-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2153-oct-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2154-oct-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2155-oct-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2156-oct-tool-mutation-target-eight.proposal.diff";
const targetOnePath = "tools/phase2091/generated-source-patch-target.mjs";
const targetTwoPath = "tools/phase2092/apply-controlled-existing-tool-mutation.mjs";
const targetThreePath = "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs";
const targetFourPath = "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs";
const targetFivePath = "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs";
const targetSixPath = "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs";
const targetSevenPath = "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs";
const targetEightPath = "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2144-2156-controlled-oct-tool-mutation";
const resultPath = `${evidenceDir}/result.json`;
const resultMdPath = `${evidenceDir}/result.md`;
const rollbackPath = `${evidenceDir}/rollback.json`;
const smokePath = `${evidenceDir}/oct-smoke.json`;
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2143 = readJson("apps/ai-gateway-service/evidence/phase2132-2143-controlled-sept-tool-mutation/result.json") || {};
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
const targetEight = existsSync(resolve(targetEightPath)) ? readText(targetEightPath) : "";
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
check("proposal_eight_exists", existsSync(resolve(proposalEightPath)));
check(
  "package_apply_script_registered",
  packageJson.scripts?.["apply:phase2144-2156-controlled-oct-tool-mutation"] ===
    "node tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs --plan docs/phase2144-2156-controlled-oct-tool-mutation-approval.example.json",
);
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2144-2156-controlled-oct-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2154OctMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2155OctMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2156OctMutationRuntimeStatus())))\"",
);
check(
  "package_verify_script_registered",
  packageJson.scripts?.["verify:phase2144-2156-controlled-oct-tool-mutation"] ===
    "node tools/phase2144_2156/validate-controlled-oct-tool-mutation.mjs",
);
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2143_sealed", phase2143.recommendedSealed === true && phase2143.septMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2144-2156-controlled-oct-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("oct_mutation_applied", result.octMutationApplied === true);
  check("changed_file_count_eight", result.changedFileCount === 8);
  check(
    "changed_files_expected",
    Array.isArray(result.changedFiles) &&
      result.changedFiles.includes(targetOnePath) &&
      result.changedFiles.includes(targetTwoPath) &&
      result.changedFiles.includes(targetThreePath) &&
      result.changedFiles.includes(targetFourPath) &&
      result.changedFiles.includes(targetFivePath) &&
      result.changedFiles.includes(targetSixPath) &&
      result.changedFiles.includes(targetSevenPath) &&
      result.changedFiles.includes(targetEightPath),
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localOctSmokePassed === true);
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
  check("rollback_restore_oct", rollback.rollbackAction === "restore-previous-content-oct");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_eight_entries", Array.isArray(rollback.files) && rollback.files.length === 8);
}

if (smoke) {
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_phase2091_marker", smoke.phase2091Marker === "PHASE2091_SOURCE_PATCH_OK");
  check("smoke_phase2126_marker", smoke.phase2126Marker === "PHASE2126_SEXT_TOOL_TARGET_ONE_OK");
  check("smoke_phase2137_marker", smoke.phase2137Marker === "PHASE2137_SEPT_TOOL_TARGET_ONE_OK");
  check("smoke_phase2149_marker", smoke.phase2149Marker === "PHASE2149_OCT_TOOL_TARGET_ONE_OK");
  check("smoke_phase2094_marker", smoke.phase2094Marker === "PHASE2094_BATCH_TOOL_TARGET_TWO_OK");
  check("smoke_phase2127_marker", smoke.phase2127Marker === "PHASE2127_SEXT_TOOL_TARGET_TWO_OK");
  check("smoke_phase2138_marker", smoke.phase2138Marker === "PHASE2138_SEPT_TOOL_TARGET_TWO_OK");
  check("smoke_phase2150_marker", smoke.phase2150Marker === "PHASE2150_OCT_TOOL_TARGET_TWO_OK");
  check("smoke_phase2100_marker", smoke.phase2100Marker === "PHASE2100_TRIPLE_TOOL_TARGET_THREE_OK");
  check("smoke_phase2128_marker", smoke.phase2128Marker === "PHASE2128_SEXT_TOOL_TARGET_THREE_OK");
  check("smoke_phase2139_marker", smoke.phase2139Marker === "PHASE2139_SEPT_TOOL_TARGET_THREE_OK");
  check("smoke_phase2151_marker", smoke.phase2151Marker === "PHASE2151_OCT_TOOL_TARGET_THREE_OK");
  check("smoke_phase2109_marker", smoke.phase2109Marker === "PHASE2109_QUAD_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2129_marker", smoke.phase2129Marker === "PHASE2129_SEXT_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2140_marker", smoke.phase2140Marker === "PHASE2140_SEPT_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2152_marker", smoke.phase2152Marker === "PHASE2152_OCT_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2120_marker", smoke.phase2120Marker === "PHASE2120_QUINT_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2130_marker", smoke.phase2130Marker === "PHASE2130_SEXT_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2141_marker", smoke.phase2141Marker === "PHASE2141_SEPT_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2153_marker", smoke.phase2153Marker === "PHASE2153_OCT_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2142_marker", smoke.phase2142Marker === "PHASE2142_SEPT_TOOL_TARGET_SIX_OK");
  check("smoke_phase2154_marker", smoke.phase2154Marker === "PHASE2154_OCT_TOOL_TARGET_SIX_OK");
  check("smoke_phase2143_marker", smoke.phase2143Marker === "PHASE2143_SEPT_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2155_marker", smoke.phase2155Marker === "PHASE2155_OCT_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2156_marker", smoke.phase2156Marker === "PHASE2156_OCT_TOOL_TARGET_EIGHT_OK");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target_one_phase2149_export", targetOne.includes("export function buildPhase2149OctMutationTargetOneStatus"));
check("target_one_phase2149_marker", targetOne.includes("PHASE2149_OCT_TOOL_TARGET_ONE_OK"));
check("target_two_phase2150_export", targetTwo.includes("export function buildPhase2150OctMutationTargetTwoStatus"));
check("target_two_phase2150_marker", targetTwo.includes("PHASE2150_OCT_TOOL_TARGET_TWO_OK"));
check("target_three_phase2151_export", targetThree.includes("export function buildPhase2151OctMutationTargetThreeStatus"));
check("target_three_phase2151_marker", targetThree.includes("PHASE2151_OCT_TOOL_TARGET_THREE_OK"));
check("target_four_phase2152_export", targetFour.includes("export function buildPhase2152OctMutationTargetFourStatus"));
check("target_four_phase2152_marker", targetFour.includes("PHASE2152_OCT_TOOL_TARGET_FOUR_OK"));
check("target_five_phase2153_export", targetFive.includes("export function buildPhase2153OctMutationTargetFiveStatus"));
check("target_five_phase2153_marker", targetFive.includes("PHASE2153_OCT_TOOL_TARGET_FIVE_OK"));
check("target_six_phase2154_export", targetSix.includes("export function buildPhase2154OctMutationTargetSixStatus"));
check("target_six_phase2154_marker", targetSix.includes("PHASE2154_OCT_TOOL_TARGET_SIX_OK"));
check("target_seven_phase2155_export", targetSeven.includes("export function buildPhase2155OctMutationTargetSevenStatus"));
check("target_seven_phase2155_marker", targetSeven.includes("PHASE2155_OCT_TOOL_TARGET_SEVEN_OK"));
check("target_eight_phase2156_export", targetEight.includes("export function buildPhase2156OctMutationRuntimeStatus"));
check("target_eight_phase2156_marker", targetEight.includes("PHASE2156_OCT_TOOL_TARGET_EIGHT_OK"));
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
    !hasPlainSecretValue(targetSeven) &&
    !hasPlainSecretValue(targetEight),
);
check("docs_mentions_oct", docs.includes("controlled oct tool mutation"));
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
  phase2143Sealed: phase2143.recommendedSealed === true,
  octMutationReady: completed,
  changedFiles: [targetOnePath, targetTwoPath, targetThreePath, targetFourPath, targetFivePath, targetSixPath, targetSevenPath, targetEightPath],
  octMutationApplied: result?.octMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localOctSmokePassed: result?.localOctSmokePassed === true,
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
  octMutationApplied: verifierResult.octMutationApplied,
  nodeCheckPassed: verifierResult.nodeCheckPassed,
  localOctSmokePassed: verifierResult.localOctSmokePassed,
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
    "# Phase2144A-2156A Controlled Oct Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${result.recommendedSealed}`,
    `- blocker: ${result.blocker}`,
    `- octMutationApplied: ${result.octMutationApplied}`,
    `- nodeCheckPassed: ${result.nodeCheckPassed}`,
    `- localOctSmokePassed: ${result.localOctSmokePassed}`,
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
