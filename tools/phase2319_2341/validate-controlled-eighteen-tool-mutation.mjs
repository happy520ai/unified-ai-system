import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2319A-2341A-Controlled-Eighteen-Tool-Mutation";
const runnerPath = "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2319-2341-controlled-eighteen-tool-mutation.md";
const approvalPath = "docs/phase2319-2341-controlled-eighteen-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2324-eighteen-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2325-eighteen-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2326-eighteen-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2327-eighteen-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2328-eighteen-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2329-eighteen-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2330-eighteen-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2331-eighteen-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2332-eighteen-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2333-eighteen-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2334-eighteen-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2335-eighteen-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2336-eighteen-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2337-eighteen-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2338-eighteen-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2339-eighteen-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase2340-eighteen-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase2341-eighteen-tool-mutation-target-eighteen.proposal.diff";
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
const targetThirteenPath = "tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs";
const targetFourteenPath = "tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs";
const targetFifteenPath = "tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs";
const targetSixteenPath = "tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs";
const targetSeventeenPath = "tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs";
const targetEighteenPath = "tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2319-2341-controlled-eighteen-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2319-2341-controlled-eighteen-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2319-2341-controlled-eighteen-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2319-2341-controlled-eighteen-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2319-2341-controlled-eighteen-tool-mutation/eighteen-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2318 = readJson("apps/ai-gateway-service/evidence/phase2297-2318-controlled-seventeen-tool-mutation/result.json") || {};
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
const targetThirteen = existsSync(resolve(targetThirteenPath)) ? readText(targetThirteenPath) : "";
const targetFourteen = existsSync(resolve(targetFourteenPath)) ? readText(targetFourteenPath) : "";
const targetFifteen = existsSync(resolve(targetFifteenPath)) ? readText(targetFifteenPath) : "";
const targetSixteen = existsSync(resolve(targetSixteenPath)) ? readText(targetSixteenPath) : "";
const targetSeventeen = existsSync(resolve(targetSeventeenPath)) ? readText(targetSeventeenPath) : "";
const targetEighteen = existsSync(resolve(targetEighteenPath)) ? readText(targetEighteenPath) : "";
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
check("proposal_thirteen_exists", existsSync(resolve(proposalThirteenPath)));
check("proposal_fourteen_exists", existsSync(resolve(proposalFourteenPath)));
check("proposal_fifteen_exists", existsSync(resolve(proposalFifteenPath)));
check("proposal_sixteen_exists", existsSync(resolve(proposalSixteenPath)));
check("proposal_seventeen_exists", existsSync(resolve(proposalSeventeenPath)));
check("proposal_eighteen_exists", existsSync(resolve(proposalEighteenPath)));
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2319-2341-controlled-eighteen-tool-mutation"] === "node tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs --plan docs/phase2319-2341-controlled-eighteen-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2319-2341-controlled-eighteen-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2329EighteenMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2330EighteenMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2331EighteenMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2332EighteenMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2333EighteenMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2334EighteenMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2335EighteenMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2336EighteenMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2337EighteenMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2338EighteenMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2339EighteenMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2340EighteenMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2341EighteenMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2319-2341-controlled-eighteen-tool-mutation"] === "node tools/phase2319_2341/validate-controlled-eighteen-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2318_sealed", phase2318.recommendedSealed === true && phase2318.seventeenMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2319-2341-controlled-eighteen-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("eighteen_mutation_applied", result.eighteenMutationApplied === true);
  check("changed_file_count_eighteen", result.changedFileCount === 18);
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
    && result.changedFiles.includes(targetThirteenPath)
    && result.changedFiles.includes(targetFourteenPath)
    && result.changedFiles.includes(targetFifteenPath)
    && result.changedFiles.includes(targetSixteenPath)
    && result.changedFiles.includes(targetSeventeenPath)
    && result.changedFiles.includes(targetEighteenPath)
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localEighteenSmokePassed === true);
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
  check("rollback_restore_eighteen", rollback.rollbackAction === "restore-previous-content-eighteen");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_eighteen_entries", Array.isArray(rollback.files) && rollback.files.length === 18);
}

if (smoke) {
  check("smoke_phase2324Marker", smoke.phase2324Marker === "PHASE2324_EIGHTEEN_TOOL_TARGET_ONE_OK");
  check("smoke_phase2325Marker", smoke.phase2325Marker === "PHASE2325_EIGHTEEN_TOOL_TARGET_TWO_OK");
  check("smoke_phase2326Marker", smoke.phase2326Marker === "PHASE2326_EIGHTEEN_TOOL_TARGET_THREE_OK");
  check("smoke_phase2327Marker", smoke.phase2327Marker === "PHASE2327_EIGHTEEN_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2328Marker", smoke.phase2328Marker === "PHASE2328_EIGHTEEN_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2329Marker", smoke.phase2329Marker === "PHASE2329_EIGHTEEN_TOOL_TARGET_SIX_OK");
  check("smoke_phase2330Marker", smoke.phase2330Marker === "PHASE2330_EIGHTEEN_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2331Marker", smoke.phase2331Marker === "PHASE2331_EIGHTEEN_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2332Marker", smoke.phase2332Marker === "PHASE2332_EIGHTEEN_TOOL_TARGET_NINE_OK");
  check("smoke_phase2333Marker", smoke.phase2333Marker === "PHASE2333_EIGHTEEN_TOOL_TARGET_TEN_OK");
  check("smoke_phase2334Marker", smoke.phase2334Marker === "PHASE2334_EIGHTEEN_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2335Marker", smoke.phase2335Marker === "PHASE2335_EIGHTEEN_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2336Marker", smoke.phase2336Marker === "PHASE2336_EIGHTEEN_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2337Marker", smoke.phase2337Marker === "PHASE2337_EIGHTEEN_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2338Marker", smoke.phase2338Marker === "PHASE2338_EIGHTEEN_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2339Marker", smoke.phase2339Marker === "PHASE2339_EIGHTEEN_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase2340Marker", smoke.phase2340Marker === "PHASE2340_EIGHTEEN_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase2341Marker", smoke.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2324EighteenMutationTargetOneStatus") || targetOne.includes("export function buildPhase2324EighteenMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2324_EIGHTEEN_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2325EighteenMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2325EighteenMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2325_EIGHTEEN_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2326EighteenMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2326EighteenMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2326_EIGHTEEN_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2327EighteenMutationTargetFourStatus") || targetFour.includes("export function buildPhase2327EighteenMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2327_EIGHTEEN_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2328EighteenMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2328EighteenMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2328_EIGHTEEN_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2329EighteenMutationTargetSixStatus") || targetSix.includes("export function buildPhase2329EighteenMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2329_EIGHTEEN_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2330EighteenMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2330EighteenMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2330_EIGHTEEN_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2331EighteenMutationTargetEightStatus") || targetEight.includes("export function buildPhase2331EighteenMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2331_EIGHTEEN_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2332EighteenMutationTargetNineStatus") || targetNine.includes("export function buildPhase2332EighteenMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2332_EIGHTEEN_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2333EighteenMutationTargetTenStatus") || targetTen.includes("export function buildPhase2333EighteenMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2333_EIGHTEEN_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2334EighteenMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2334EighteenMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2334_EIGHTEEN_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2335EighteenMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2335EighteenMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2335_EIGHTEEN_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2336EighteenMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2336EighteenMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2336_EIGHTEEN_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2337EighteenMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2337EighteenMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2337_EIGHTEEN_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2338EighteenMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2338EighteenMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2338_EIGHTEEN_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2339EighteenMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase2339EighteenMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2339_EIGHTEEN_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase2340EighteenMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase2340EighteenMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE2340_EIGHTEEN_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase2341EighteenMutationRuntimeStatus") || targetEighteen.includes("export function buildPhase2341EighteenMutationRuntimeStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_eighteen", docs.includes("controlled eighteen tool mutation"));
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
  phase2318Sealed: phase2318.recommendedSealed === true,
  eighteenMutationReady: completed,
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
    targetThirteenPath,
    targetFourteenPath,
    targetFifteenPath,
    targetSixteenPath,
    targetSeventeenPath,
    targetEighteenPath,
  ],
  changedFileCount: result?.changedFileCount ?? 18,
  eighteenMutationApplied: result?.eighteenMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localEighteenSmokePassed: result?.localEighteenSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, eighteenMutationApplied: verifierResult.eighteenMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localEighteenSmokePassed: verifierResult.localEighteenSmokePassed }, null, 2));
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
    "# Phase2319A-2341A Controlled Eighteen Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- eighteenMutationApplied: ${Boolean(result.eighteenMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localEighteenSmokePassed: ${Boolean(result.localEighteenSmokePassed)}`,
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
