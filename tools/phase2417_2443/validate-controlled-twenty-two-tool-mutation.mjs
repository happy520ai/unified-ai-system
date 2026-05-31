import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2417A-2443A-Controlled-Twenty-Two-Tool-Mutation";
const runnerPath = "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2417-2443-controlled-twenty-two-tool-mutation.md";
const approvalPath = "docs/phase2417-2443-controlled-twenty-two-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2422-twenty-two-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2423-twenty-two-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2424-twenty-two-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2425-twenty-two-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2426-twenty-two-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2427-twenty-two-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2428-twenty-two-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2429-twenty-two-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2430-twenty-two-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2431-twenty-two-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2432-twenty-two-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2433-twenty-two-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2434-twenty-two-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2435-twenty-two-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2436-twenty-two-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2437-twenty-two-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase2438-twenty-two-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase2439-twenty-two-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase2440-twenty-two-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase2441-twenty-two-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase2442-twenty-two-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase2443-twenty-two-tool-mutation-target-twenty-two.proposal.diff";
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
const targetNineteenPath = "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs";
const targetTwentyPath = "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs";
const targetTwentyOnePath = "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs";
const targetTwentyTwoPath = "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2417-2443-controlled-twenty-two-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2417-2443-controlled-twenty-two-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2417-2443-controlled-twenty-two-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2417-2443-controlled-twenty-two-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2417-2443-controlled-twenty-two-tool-mutation/twenty-two-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2416 = readJson("apps/ai-gateway-service/evidence/phase2391-2416-controlled-twenty-one-tool-mutation/result.json") || {};
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
const targetNineteen = existsSync(resolve(targetNineteenPath)) ? readText(targetNineteenPath) : "";
const targetTwenty = existsSync(resolve(targetTwentyPath)) ? readText(targetTwentyPath) : "";
const targetTwentyOne = existsSync(resolve(targetTwentyOnePath)) ? readText(targetTwentyOnePath) : "";
const targetTwentyTwo = existsSync(resolve(targetTwentyTwoPath)) ? readText(targetTwentyTwoPath) : "";
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
check("proposal_nineteen_exists", existsSync(resolve(proposalNineteenPath)));
check("proposal_twenty_exists", existsSync(resolve(proposalTwentyPath)));
check("proposal_twenty-one_exists", existsSync(resolve(proposalTwentyOnePath)));
check("proposal_twenty-two_exists", existsSync(resolve(proposalTwentyTwoPath)));
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2417-2443-controlled-twenty-two-tool-mutation"] === "node tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs --plan docs/phase2417-2443-controlled-twenty-two-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2417-2443-controlled-twenty-two-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2427TwentyTwoMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2428TwentyTwoMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2429TwentyTwoMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2430TwentyTwoMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2431TwentyTwoMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2432TwentyTwoMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2433TwentyTwoMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2434TwentyTwoMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2435TwentyTwoMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2436TwentyTwoMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2437TwentyTwoMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2438TwentyTwoMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2439TwentyTwoMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2440TwentyTwoMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2441TwentyTwoMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2442TwentyTwoMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2443TwentyTwoMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2417-2443-controlled-twenty-two-tool-mutation"] === "node tools/phase2417_2443/validate-controlled-twenty-two-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2416_sealed", phase2416.recommendedSealed === true && phase2416.twentyOneMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2417-2443-controlled-twenty-two-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("twenty_two_mutation_applied", result.twentyTwoMutationApplied === true);
  check("changed_file_count_twenty_two", result.changedFileCount === 22);
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
    && result.changedFiles.includes(targetNineteenPath)
    && result.changedFiles.includes(targetTwentyPath)
    && result.changedFiles.includes(targetTwentyOnePath)
    && result.changedFiles.includes(targetTwentyTwoPath)
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localTwentyTwoSmokePassed === true);
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
  check("rollback_restore_twenty_two", rollback.rollbackAction === "restore-previous-content-twenty-two");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_twenty_two_entries", Array.isArray(rollback.files) && rollback.files.length === 22);
}

if (smoke) {
  check("smoke_phase2422Marker", smoke.phase2422Marker === "PHASE2422_TWENTY_TWO_TOOL_TARGET_ONE_OK");
  check("smoke_phase2423Marker", smoke.phase2423Marker === "PHASE2423_TWENTY_TWO_TOOL_TARGET_TWO_OK");
  check("smoke_phase2424Marker", smoke.phase2424Marker === "PHASE2424_TWENTY_TWO_TOOL_TARGET_THREE_OK");
  check("smoke_phase2425Marker", smoke.phase2425Marker === "PHASE2425_TWENTY_TWO_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2426Marker", smoke.phase2426Marker === "PHASE2426_TWENTY_TWO_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2427Marker", smoke.phase2427Marker === "PHASE2427_TWENTY_TWO_TOOL_TARGET_SIX_OK");
  check("smoke_phase2428Marker", smoke.phase2428Marker === "PHASE2428_TWENTY_TWO_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2429Marker", smoke.phase2429Marker === "PHASE2429_TWENTY_TWO_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2430Marker", smoke.phase2430Marker === "PHASE2430_TWENTY_TWO_TOOL_TARGET_NINE_OK");
  check("smoke_phase2431Marker", smoke.phase2431Marker === "PHASE2431_TWENTY_TWO_TOOL_TARGET_TEN_OK");
  check("smoke_phase2432Marker", smoke.phase2432Marker === "PHASE2432_TWENTY_TWO_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2433Marker", smoke.phase2433Marker === "PHASE2433_TWENTY_TWO_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2434Marker", smoke.phase2434Marker === "PHASE2434_TWENTY_TWO_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2435Marker", smoke.phase2435Marker === "PHASE2435_TWENTY_TWO_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2436Marker", smoke.phase2436Marker === "PHASE2436_TWENTY_TWO_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2437Marker", smoke.phase2437Marker === "PHASE2437_TWENTY_TWO_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase2438Marker", smoke.phase2438Marker === "PHASE2438_TWENTY_TWO_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase2439Marker", smoke.phase2439Marker === "PHASE2439_TWENTY_TWO_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase2440Marker", smoke.phase2440Marker === "PHASE2440_TWENTY_TWO_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase2441Marker", smoke.phase2441Marker === "PHASE2441_TWENTY_TWO_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase2442Marker", smoke.phase2442Marker === "PHASE2442_TWENTY_TWO_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase2443Marker", smoke.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2422TwentyTwoMutationTargetOneStatus") || targetOne.includes("export function buildPhase2422TwentyTwoMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2422_TWENTY_TWO_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2423TwentyTwoMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2423TwentyTwoMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2423_TWENTY_TWO_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2424TwentyTwoMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2424TwentyTwoMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2424_TWENTY_TWO_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2425TwentyTwoMutationTargetFourStatus") || targetFour.includes("export function buildPhase2425TwentyTwoMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2425_TWENTY_TWO_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2426TwentyTwoMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2426TwentyTwoMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2426_TWENTY_TWO_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2427TwentyTwoMutationTargetSixStatus") || targetSix.includes("export function buildPhase2427TwentyTwoMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2427_TWENTY_TWO_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2428TwentyTwoMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2428TwentyTwoMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2428_TWENTY_TWO_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2429TwentyTwoMutationTargetEightStatus") || targetEight.includes("export function buildPhase2429TwentyTwoMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2429_TWENTY_TWO_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2430TwentyTwoMutationTargetNineStatus") || targetNine.includes("export function buildPhase2430TwentyTwoMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2430_TWENTY_TWO_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2431TwentyTwoMutationTargetTenStatus") || targetTen.includes("export function buildPhase2431TwentyTwoMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2431_TWENTY_TWO_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2432TwentyTwoMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2432TwentyTwoMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2432_TWENTY_TWO_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2433TwentyTwoMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2433TwentyTwoMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2433_TWENTY_TWO_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2434TwentyTwoMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2434TwentyTwoMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2434_TWENTY_TWO_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2435TwentyTwoMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2435TwentyTwoMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2435_TWENTY_TWO_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2436TwentyTwoMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2436TwentyTwoMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2436_TWENTY_TWO_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2437TwentyTwoMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase2437TwentyTwoMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2437_TWENTY_TWO_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase2438TwentyTwoMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase2438TwentyTwoMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE2438_TWENTY_TWO_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase2439TwentyTwoMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase2439TwentyTwoMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE2439_TWENTY_TWO_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase2440TwentyTwoMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase2440TwentyTwoMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE2440_TWENTY_TWO_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase2441TwentyTwoMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase2441TwentyTwoMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE2441_TWENTY_TWO_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase2442TwentyTwoMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase2442TwentyTwoMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE2442_TWENTY_TWO_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase2443TwentyTwoMutationRuntimeStatus") || targetTwentyTwo.includes("export function buildPhase2443TwentyTwoMutationRuntimeStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_twenty_two", docs.includes("controlled twenty-two tool mutation"));
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
  phase2416Sealed: phase2416.recommendedSealed === true,
  twentyTwoMutationReady: completed,
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
    targetNineteenPath,
    targetTwentyPath,
    targetTwentyOnePath,
    targetTwentyTwoPath,
  ],
  changedFileCount: result?.changedFileCount ?? 22,
  twentyTwoMutationApplied: result?.twentyTwoMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localTwentyTwoSmokePassed: result?.localTwentyTwoSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, twentyTwoMutationApplied: verifierResult.twentyTwoMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localTwentyTwoSmokePassed: verifierResult.localTwentyTwoSmokePassed }, null, 2));
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
    "# Phase2417A-2443A Controlled Twenty-Two Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- twentyTwoMutationApplied: ${Boolean(result.twentyTwoMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localTwentyTwoSmokePassed: ${Boolean(result.localTwentyTwoSmokePassed)}`,
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
