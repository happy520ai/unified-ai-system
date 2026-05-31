import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2202A-2218A-Controlled-Twelve-Tool-Mutation";
const runnerPath = "tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2202-2218-controlled-twelve-tool-mutation.md";
const approvalPath = "docs/phase2202-2218-controlled-twelve-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2207-twelve-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2208-twelve-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2209-twelve-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2210-twelve-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2211-twelve-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2212-twelve-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2213-twelve-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2214-twelve-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2215-twelve-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2216-twelve-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2217-twelve-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2218-twelve-tool-mutation-target-twelve.proposal.diff";
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
const targetTwelvePath = "tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2202-2218-controlled-twelve-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2202-2218-controlled-twelve-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2202-2218-controlled-twelve-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2202-2218-controlled-twelve-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2202-2218-controlled-twelve-tool-mutation/twelve-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2201 = readJson("apps/ai-gateway-service/evidence/phase2186-2201-controlled-eleven-tool-mutation/result.json") || {};
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
const targetTwelve = existsSync(resolve(targetTwelvePath)) ? readText(targetTwelvePath) : "";
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
check("proposal_twelve_exists", existsSync(resolve(proposalTwelvePath)));
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2202-2218-controlled-twelve-tool-mutation"] === "node tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs --plan docs/phase2202-2218-controlled-twelve-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2202-2218-controlled-twelve-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2212TwelveMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2213TwelveMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2214TwelveMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2215TwelveMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2216TwelveMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2217TwelveMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2218TwelveMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2202-2218-controlled-twelve-tool-mutation"] === "node tools/phase2202_2218/validate-controlled-twelve-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2201_sealed", phase2201.recommendedSealed === true && phase2201.elevenMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2202-2218-controlled-twelve-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("twelve_mutation_applied", result.twelveMutationApplied === true);
  check("changed_file_count_twelve", result.changedFileCount === 12);
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
    && result.changedFiles.includes(targetTwelvePath)
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localTwelveSmokePassed === true);
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
  check("rollback_restore_twelve", rollback.rollbackAction === "restore-previous-content-twelve");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_twelve_entries", Array.isArray(rollback.files) && rollback.files.length === 12);
}

if (smoke) {
  check("smoke_phase2207Marker", smoke.phase2207Marker === "PHASE2207_TWELVE_TOOL_TARGET_ONE_OK");
  check("smoke_phase2208Marker", smoke.phase2208Marker === "PHASE2208_TWELVE_TOOL_TARGET_TWO_OK");
  check("smoke_phase2209Marker", smoke.phase2209Marker === "PHASE2209_TWELVE_TOOL_TARGET_THREE_OK");
  check("smoke_phase2210Marker", smoke.phase2210Marker === "PHASE2210_TWELVE_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2211Marker", smoke.phase2211Marker === "PHASE2211_TWELVE_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2212Marker", smoke.phase2212Marker === "PHASE2212_TWELVE_TOOL_TARGET_SIX_OK");
  check("smoke_phase2213Marker", smoke.phase2213Marker === "PHASE2213_TWELVE_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2214Marker", smoke.phase2214Marker === "PHASE2214_TWELVE_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2215Marker", smoke.phase2215Marker === "PHASE2215_TWELVE_TOOL_TARGET_NINE_OK");
  check("smoke_phase2216Marker", smoke.phase2216Marker === "PHASE2216_TWELVE_TOOL_TARGET_TEN_OK");
  check("smoke_phase2217Marker", smoke.phase2217Marker === "PHASE2217_TWELVE_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2218Marker", smoke.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2207TwelveMutationTargetOneStatus") || targetOne.includes("export function buildPhase2207TwelveMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2207_TWELVE_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2208TwelveMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2208TwelveMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2208_TWELVE_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2209TwelveMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2209TwelveMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2209_TWELVE_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2210TwelveMutationTargetFourStatus") || targetFour.includes("export function buildPhase2210TwelveMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2210_TWELVE_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2211TwelveMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2211TwelveMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2211_TWELVE_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2212TwelveMutationTargetSixStatus") || targetSix.includes("export function buildPhase2212TwelveMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2212_TWELVE_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2213TwelveMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2213TwelveMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2213_TWELVE_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2214TwelveMutationTargetEightStatus") || targetEight.includes("export function buildPhase2214TwelveMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2214_TWELVE_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2215TwelveMutationTargetNineStatus") || targetNine.includes("export function buildPhase2215TwelveMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2215_TWELVE_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2216TwelveMutationTargetTenStatus") || targetTen.includes("export function buildPhase2216TwelveMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2216_TWELVE_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2217TwelveMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2217TwelveMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2217_TWELVE_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2218TwelveMutationRuntimeStatus") || targetTwelve.includes("export function buildPhase2218TwelveMutationRuntimeStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_twelve", docs.includes("controlled twelve tool mutation"));
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
  phase2201Sealed: phase2201.recommendedSealed === true,
  twelveMutationReady: completed,
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
    targetTwelvePath,
  ],
  changedFileCount: result?.changedFileCount ?? 12,
  twelveMutationApplied: result?.twelveMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localTwelveSmokePassed: result?.localTwelveSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, twelveMutationApplied: verifierResult.twelveMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localTwelveSmokePassed: verifierResult.localTwelveSmokePassed }, null, 2));
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
    "# Phase2202A-2218A Controlled Twelve Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- twelveMutationApplied: ${Boolean(result.twelveMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localTwelveSmokePassed: ${Boolean(result.localTwelveSmokePassed)}`,
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
