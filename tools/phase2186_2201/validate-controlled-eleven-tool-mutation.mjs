import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2186A-2201A-Controlled-Eleven-Tool-Mutation";
const runnerPath = "tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2186-2201-controlled-eleven-tool-mutation.md";
const approvalPath = "docs/phase2186-2201-controlled-eleven-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2191-eleven-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2192-eleven-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2193-eleven-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2194-eleven-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2195-eleven-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2196-eleven-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2197-eleven-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2198-eleven-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2199-eleven-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2200-eleven-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2201-eleven-tool-mutation-target-eleven.proposal.diff";
const targetOnePath = "tools/phase2091/generated-source-patch-target.mjs";
const targetTwoPath = "tools/phase2092/apply-controlled-existing-tool-mutation.mjs";
const targetThreePath = "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs";
const targetFourPath = "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs";
const targetFivePath = "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs";
const targetSixPath = "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs";
const targetSevenPath = "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs";
const targetEightPath = "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs";
const targetNinePath = "tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs";
const targetTenPath = "tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs";
const targetElevenPath = "tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2186-2201-controlled-eleven-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2186-2201-controlled-eleven-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2186-2201-controlled-eleven-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2186-2201-controlled-eleven-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2186-2201-controlled-eleven-tool-mutation/eleven-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2185 = readJson("apps/ai-gateway-service/evidence/phase2171-2185-controlled-deca-tool-mutation/result.json") || {};
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
const targetNine = existsSync(resolve(targetNinePath)) ? readText(targetNinePath) : "";
const targetTen = existsSync(resolve(targetTenPath)) ? readText(targetTenPath) : "";
const targetEleven = existsSync(resolve(targetElevenPath)) ? readText(targetElevenPath) : "";
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
check("proposal_nine_exists", existsSync(resolve(proposalNinePath)));
check("proposal_ten_exists", existsSync(resolve(proposalTenPath)));
check("proposal_eleven_exists", existsSync(resolve(proposalElevenPath)));
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2186-2201-controlled-eleven-tool-mutation"] === "node tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs --plan docs/phase2186-2201-controlled-eleven-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2186-2201-controlled-eleven-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2196ElevenMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2197ElevenMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2198ElevenMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2199ElevenMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2200ElevenMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2201ElevenMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2186-2201-controlled-eleven-tool-mutation"] === "node tools/phase2186_2201/validate-controlled-eleven-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2185_sealed", phase2185.recommendedSealed === true && phase2185.decaMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2186-2201-controlled-eleven-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("eleven_mutation_applied", result.elevenMutationApplied === true);
  check("changed_file_count_eleven", result.changedFileCount === 11);
  check("changed_files_expected", Array.isArray(result.changedFiles)
    && result.changedFiles.includes(targetOnePath)
    && result.changedFiles.includes(targetTwoPath)
    && result.changedFiles.includes(targetThreePath)
    && result.changedFiles.includes(targetFourPath)
    && result.changedFiles.includes(targetFivePath)
    && result.changedFiles.includes(targetSixPath)
    && result.changedFiles.includes(targetSevenPath)
    && result.changedFiles.includes(targetEightPath)
    && result.changedFiles.includes(targetNinePath)
    && result.changedFiles.includes(targetTenPath)
    && result.changedFiles.includes(targetElevenPath)
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localElevenSmokePassed === true);
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
  check("rollback_restore_eleven", rollback.rollbackAction === "restore-previous-content-eleven");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_eleven_entries", Array.isArray(rollback.files) && rollback.files.length === 11);
}

if (smoke) {
  check("smoke_phase2191_marker", smoke.phase2191Marker === "PHASE2191_ELEVEN_TOOL_TARGET_ONE_OK");
  check("smoke_phase2192_marker", smoke.phase2192Marker === "PHASE2192_ELEVEN_TOOL_TARGET_TWO_OK");
  check("smoke_phase2193_marker", smoke.phase2193Marker === "PHASE2193_ELEVEN_TOOL_TARGET_THREE_OK");
  check("smoke_phase2194_marker", smoke.phase2194Marker === "PHASE2194_ELEVEN_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2195_marker", smoke.phase2195Marker === "PHASE2195_ELEVEN_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2196_marker", smoke.phase2196Marker === "PHASE2196_ELEVEN_TOOL_TARGET_SIX_OK");
  check("smoke_phase2197_marker", smoke.phase2197Marker === "PHASE2197_ELEVEN_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2198_marker", smoke.phase2198Marker === "PHASE2198_ELEVEN_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2199_marker", smoke.phase2199Marker === "PHASE2199_ELEVEN_TOOL_TARGET_NINE_OK");
  check("smoke_phase2200_marker", smoke.phase2200Marker === "PHASE2200_ELEVEN_TOOL_TARGET_TEN_OK");
  check("smoke_phase2201_marker", smoke.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target_one_export", targetOne.includes("buildPhase2191ElevenMutationTargetOneStatus") || targetOne.includes("export function buildPhase2191ElevenMutationTargetOneStatus"));
check("target_one_marker", targetOne.includes("PHASE2191_ELEVEN_TOOL_TARGET_ONE_OK"));
check("target_two_export", targetTwo.includes("buildPhase2192ElevenMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2192ElevenMutationTargetTwoStatus"));
check("target_two_marker", targetTwo.includes("PHASE2192_ELEVEN_TOOL_TARGET_TWO_OK"));
check("target_three_export", targetThree.includes("buildPhase2193ElevenMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2193ElevenMutationTargetThreeStatus"));
check("target_three_marker", targetThree.includes("PHASE2193_ELEVEN_TOOL_TARGET_THREE_OK"));
check("target_four_export", targetFour.includes("buildPhase2194ElevenMutationTargetFourStatus") || targetFour.includes("export function buildPhase2194ElevenMutationTargetFourStatus"));
check("target_four_marker", targetFour.includes("PHASE2194_ELEVEN_TOOL_TARGET_FOUR_OK"));
check("target_five_export", targetFive.includes("buildPhase2195ElevenMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2195ElevenMutationTargetFiveStatus"));
check("target_five_marker", targetFive.includes("PHASE2195_ELEVEN_TOOL_TARGET_FIVE_OK"));
check("target_six_export", targetSix.includes("buildPhase2196ElevenMutationTargetSixStatus") || targetSix.includes("export function buildPhase2196ElevenMutationTargetSixStatus"));
check("target_six_marker", targetSix.includes("PHASE2196_ELEVEN_TOOL_TARGET_SIX_OK"));
check("target_seven_export", targetSeven.includes("buildPhase2197ElevenMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2197ElevenMutationTargetSevenStatus"));
check("target_seven_marker", targetSeven.includes("PHASE2197_ELEVEN_TOOL_TARGET_SEVEN_OK"));
check("target_eight_export", targetEight.includes("buildPhase2198ElevenMutationTargetEightStatus") || targetEight.includes("export function buildPhase2198ElevenMutationTargetEightStatus"));
check("target_eight_marker", targetEight.includes("PHASE2198_ELEVEN_TOOL_TARGET_EIGHT_OK"));
check("target_nine_export", targetNine.includes("buildPhase2199ElevenMutationTargetNineStatus") || targetNine.includes("export function buildPhase2199ElevenMutationTargetNineStatus"));
check("target_nine_marker", targetNine.includes("PHASE2199_ELEVEN_TOOL_TARGET_NINE_OK"));
check("target_ten_export", targetTen.includes("buildPhase2200ElevenMutationTargetTenStatus") || targetTen.includes("export function buildPhase2200ElevenMutationTargetTenStatus"));
check("target_ten_marker", targetTen.includes("PHASE2200_ELEVEN_TOOL_TARGET_TEN_OK"));
check("target_eleven_export", targetEleven.includes("buildPhase2201ElevenMutationRuntimeStatus") || targetEleven.includes("export function buildPhase2201ElevenMutationRuntimeStatus"));
check("target_eleven_marker", targetEleven.includes("PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_eleven", docs.includes("controlled eleven tool mutation"));
check("docs_mentions_smoke_helper", docs.includes("JSON smoke helper"));
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
  phase2185Sealed: phase2185.recommendedSealed === true,
  elevenMutationReady: completed,
  changedFiles: [
    targetOnePath,
    targetTwoPath,
    targetThreePath,
    targetFourPath,
    targetFivePath,
    targetSixPath,
    targetSevenPath,
    targetEightPath,
    targetNinePath,
    targetTenPath,
    targetElevenPath,
  ],
  changedFileCount: result?.changedFileCount ?? 11,
  elevenMutationApplied: result?.elevenMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localElevenSmokePassed: result?.localElevenSmokePassed === true,
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
  evidenceRefs: { result: resultPath, rollback: rollbackPath, smoke: smokePath },
  checks,
};

writeJson(resultPath, result ? { ...result, verifier: verifierResult } : verifierResult);
writeText(resultMdPath, renderMarkdown(verifierResult));
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, elevenMutationApplied: verifierResult.elevenMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localElevenSmokePassed: verifierResult.localElevenSmokePassed }, null, 2));
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
    "# Phase2186A-2201A Controlled Eleven Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- elevenMutationApplied: ${Boolean(result.elevenMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localElevenSmokePassed: ${Boolean(result.localElevenSmokePassed)}`,
    `- rollbackAvailable: ${Boolean(result.rollbackAvailable)}`,
    `- codexExecExecuted: ${Boolean(result.codexExecExecuted)}`,
    `- providerCallsMade: ${Boolean(result.providerCallsMade)}`,
    `- chatModified: ${Boolean(result.chatModified)}`,
    `- chatGatewayExecuteModified: ${Boolean(result.chatGatewayExecuteModified)}`,
    `- commitCreated: ${Boolean(result.commitCreated)}`,
    `- pushExecuted: ${Boolean(result.pushExecuted)}`,
    `- workspaceCleanClaimed: ${Boolean(result.workspaceCleanClaimed)}`,
    "",
  ].join("\n");
}
