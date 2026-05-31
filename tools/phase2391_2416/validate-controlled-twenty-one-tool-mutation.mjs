import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2391A-2416A-Controlled-Twenty-One-Tool-Mutation";
const runnerPath = "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2391-2416-controlled-twenty-one-tool-mutation.md";
const approvalPath = "docs/phase2391-2416-controlled-twenty-one-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2396-twenty-one-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2397-twenty-one-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2398-twenty-one-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2399-twenty-one-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2400-twenty-one-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2401-twenty-one-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2402-twenty-one-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2403-twenty-one-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2404-twenty-one-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2405-twenty-one-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2406-twenty-one-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2407-twenty-one-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2408-twenty-one-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2409-twenty-one-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2410-twenty-one-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2411-twenty-one-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase2412-twenty-one-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase2413-twenty-one-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase2414-twenty-one-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase2415-twenty-one-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase2416-twenty-one-tool-mutation-target-twenty-one.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase2391-2416-controlled-twenty-one-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2391-2416-controlled-twenty-one-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2391-2416-controlled-twenty-one-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2391-2416-controlled-twenty-one-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2391-2416-controlled-twenty-one-tool-mutation/twenty-one-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2390 = readJson("apps/ai-gateway-service/evidence/phase2366-2390-controlled-twenty-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2391-2416-controlled-twenty-one-tool-mutation"] === "node tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs --plan docs/phase2391-2416-controlled-twenty-one-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2391-2416-controlled-twenty-one-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2401TwentyOneMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2402TwentyOneMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2403TwentyOneMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2404TwentyOneMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2405TwentyOneMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2406TwentyOneMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2407TwentyOneMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2408TwentyOneMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2409TwentyOneMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2410TwentyOneMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2411TwentyOneMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2412TwentyOneMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2413TwentyOneMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2414TwentyOneMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2415TwentyOneMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2416TwentyOneMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2391-2416-controlled-twenty-one-tool-mutation"] === "node tools/phase2391_2416/validate-controlled-twenty-one-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2390_sealed", phase2390.recommendedSealed === true && phase2390.twentyMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2391-2416-controlled-twenty-one-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("twenty_one_mutation_applied", result.twentyOneMutationApplied === true);
  check("changed_file_count_twenty_one", result.changedFileCount === 21);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localTwentyOneSmokePassed === true);
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
  check("rollback_restore_twenty_one", rollback.rollbackAction === "restore-previous-content-twenty-one");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_twenty_one_entries", Array.isArray(rollback.files) && rollback.files.length === 21);
}

if (smoke) {
  check("smoke_phase2396Marker", smoke.phase2396Marker === "PHASE2396_TWENTY_ONE_TOOL_TARGET_ONE_OK");
  check("smoke_phase2397Marker", smoke.phase2397Marker === "PHASE2397_TWENTY_ONE_TOOL_TARGET_TWO_OK");
  check("smoke_phase2398Marker", smoke.phase2398Marker === "PHASE2398_TWENTY_ONE_TOOL_TARGET_THREE_OK");
  check("smoke_phase2399Marker", smoke.phase2399Marker === "PHASE2399_TWENTY_ONE_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2400Marker", smoke.phase2400Marker === "PHASE2400_TWENTY_ONE_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2401Marker", smoke.phase2401Marker === "PHASE2401_TWENTY_ONE_TOOL_TARGET_SIX_OK");
  check("smoke_phase2402Marker", smoke.phase2402Marker === "PHASE2402_TWENTY_ONE_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2403Marker", smoke.phase2403Marker === "PHASE2403_TWENTY_ONE_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2404Marker", smoke.phase2404Marker === "PHASE2404_TWENTY_ONE_TOOL_TARGET_NINE_OK");
  check("smoke_phase2405Marker", smoke.phase2405Marker === "PHASE2405_TWENTY_ONE_TOOL_TARGET_TEN_OK");
  check("smoke_phase2406Marker", smoke.phase2406Marker === "PHASE2406_TWENTY_ONE_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2407Marker", smoke.phase2407Marker === "PHASE2407_TWENTY_ONE_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2408Marker", smoke.phase2408Marker === "PHASE2408_TWENTY_ONE_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2409Marker", smoke.phase2409Marker === "PHASE2409_TWENTY_ONE_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2410Marker", smoke.phase2410Marker === "PHASE2410_TWENTY_ONE_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2411Marker", smoke.phase2411Marker === "PHASE2411_TWENTY_ONE_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase2412Marker", smoke.phase2412Marker === "PHASE2412_TWENTY_ONE_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase2413Marker", smoke.phase2413Marker === "PHASE2413_TWENTY_ONE_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase2414Marker", smoke.phase2414Marker === "PHASE2414_TWENTY_ONE_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase2415Marker", smoke.phase2415Marker === "PHASE2415_TWENTY_ONE_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase2416Marker", smoke.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2396TwentyOneMutationTargetOneStatus") || targetOne.includes("export function buildPhase2396TwentyOneMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2396_TWENTY_ONE_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2397TwentyOneMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2397TwentyOneMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2397_TWENTY_ONE_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2398TwentyOneMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2398TwentyOneMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2398_TWENTY_ONE_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2399TwentyOneMutationTargetFourStatus") || targetFour.includes("export function buildPhase2399TwentyOneMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2399_TWENTY_ONE_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2400TwentyOneMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2400TwentyOneMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2400_TWENTY_ONE_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2401TwentyOneMutationTargetSixStatus") || targetSix.includes("export function buildPhase2401TwentyOneMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2401_TWENTY_ONE_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2402TwentyOneMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2402TwentyOneMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2402_TWENTY_ONE_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2403TwentyOneMutationTargetEightStatus") || targetEight.includes("export function buildPhase2403TwentyOneMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2403_TWENTY_ONE_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2404TwentyOneMutationTargetNineStatus") || targetNine.includes("export function buildPhase2404TwentyOneMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2404_TWENTY_ONE_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2405TwentyOneMutationTargetTenStatus") || targetTen.includes("export function buildPhase2405TwentyOneMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2405_TWENTY_ONE_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2406TwentyOneMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2406TwentyOneMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2406_TWENTY_ONE_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2407TwentyOneMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2407TwentyOneMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2407_TWENTY_ONE_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2408TwentyOneMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2408TwentyOneMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2408_TWENTY_ONE_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2409TwentyOneMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2409TwentyOneMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2409_TWENTY_ONE_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2410TwentyOneMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2410TwentyOneMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2410_TWENTY_ONE_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2411TwentyOneMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase2411TwentyOneMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2411_TWENTY_ONE_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase2412TwentyOneMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase2412TwentyOneMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE2412_TWENTY_ONE_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase2413TwentyOneMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase2413TwentyOneMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE2413_TWENTY_ONE_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase2414TwentyOneMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase2414TwentyOneMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE2414_TWENTY_ONE_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase2415TwentyOneMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase2415TwentyOneMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE2415_TWENTY_ONE_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase2416TwentyOneMutationRuntimeStatus") || targetTwentyOne.includes("export function buildPhase2416TwentyOneMutationRuntimeStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_twenty_one", docs.includes("controlled twenty-one tool mutation"));
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
  phase2390Sealed: phase2390.recommendedSealed === true,
  twentyOneMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 21,
  twentyOneMutationApplied: result?.twentyOneMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localTwentyOneSmokePassed: result?.localTwentyOneSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, twentyOneMutationApplied: verifierResult.twentyOneMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localTwentyOneSmokePassed: verifierResult.localTwentyOneSmokePassed }, null, 2));
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
    "# Phase2391A-2416A Controlled Twenty-One Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- twentyOneMutationApplied: ${Boolean(result.twentyOneMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localTwentyOneSmokePassed: ${Boolean(result.localTwentyOneSmokePassed)}`,
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
