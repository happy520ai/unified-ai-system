import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2627A-2660A-Controlled-Twenty-Nine-Tool-Mutation";
const runnerPath = "tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2627-2660-controlled-twenty-nine-tool-mutation.md";
const approvalPath = "docs/phase2627-2660-controlled-twenty-nine-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2632-twenty-nine-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2633-twenty-nine-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2634-twenty-nine-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2635-twenty-nine-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2636-twenty-nine-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2637-twenty-nine-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2638-twenty-nine-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2639-twenty-nine-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2640-twenty-nine-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2641-twenty-nine-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2642-twenty-nine-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2643-twenty-nine-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2644-twenty-nine-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2645-twenty-nine-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2646-twenty-nine-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2647-twenty-nine-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase2648-twenty-nine-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase2649-twenty-nine-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase2650-twenty-nine-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase2651-twenty-nine-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase2652-twenty-nine-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase2653-twenty-nine-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase2654-twenty-nine-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase2655-twenty-nine-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase2656-twenty-nine-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase2657-twenty-nine-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase2658-twenty-nine-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase2659-twenty-nine-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase2660-twenty-nine-tool-mutation-target-twenty-nine.proposal.diff";
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
const targetTwentyThreePath = "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs";
const targetTwentyFourPath = "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs";
const targetTwentyFivePath = "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs";
const targetTwentySixPath = "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs";
const targetTwentySevenPath = "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs";
const targetTwentyEightPath = "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs";
const targetTwentyNinePath = "tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2627-2660-controlled-twenty-nine-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2627-2660-controlled-twenty-nine-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2627-2660-controlled-twenty-nine-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2627-2660-controlled-twenty-nine-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2627-2660-controlled-twenty-nine-tool-mutation/twenty-nine-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2626 = readJson("apps/ai-gateway-service/evidence/phase2594-2626-controlled-twenty-eight-tool-mutation/result.json") || {};
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
const targetTwentyThree = existsSync(resolve(targetTwentyThreePath)) ? readText(targetTwentyThreePath) : "";
const targetTwentyFour = existsSync(resolve(targetTwentyFourPath)) ? readText(targetTwentyFourPath) : "";
const targetTwentyFive = existsSync(resolve(targetTwentyFivePath)) ? readText(targetTwentyFivePath) : "";
const targetTwentySix = existsSync(resolve(targetTwentySixPath)) ? readText(targetTwentySixPath) : "";
const targetTwentySeven = existsSync(resolve(targetTwentySevenPath)) ? readText(targetTwentySevenPath) : "";
const targetTwentyEight = existsSync(resolve(targetTwentyEightPath)) ? readText(targetTwentyEightPath) : "";
const targetTwentyNine = existsSync(resolve(targetTwentyNinePath)) ? readText(targetTwentyNinePath) : "";
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
check("proposal_twenty-three_exists", existsSync(resolve(proposalTwentyThreePath)));
check("proposal_twenty-four_exists", existsSync(resolve(proposalTwentyFourPath)));
check("proposal_twenty-five_exists", existsSync(resolve(proposalTwentyFivePath)));
check("proposal_twenty-six_exists", existsSync(resolve(proposalTwentySixPath)));
check("proposal_twenty-seven_exists", existsSync(resolve(proposalTwentySevenPath)));
check("proposal_twenty-eight_exists", existsSync(resolve(proposalTwentyEightPath)));
check("proposal_twenty-nine_exists", existsSync(resolve(proposalTwentyNinePath)));
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2627-2660-controlled-twenty-nine-tool-mutation"] === "node tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs --plan docs/phase2627-2660-controlled-twenty-nine-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2627-2660-controlled-twenty-nine-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2637TwentyNineMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2638TwentyNineMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2639TwentyNineMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2640TwentyNineMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2641TwentyNineMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2642TwentyNineMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2643TwentyNineMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2644TwentyNineMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2645TwentyNineMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2646TwentyNineMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2647TwentyNineMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2648TwentyNineMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2649TwentyNineMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2650TwentyNineMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2651TwentyNineMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2652TwentyNineMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2653TwentyNineMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2654TwentyNineMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2655TwentyNineMutationTargetTwentyFourStatus())))\" && node -e \"import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2656TwentyNineMutationTargetTwentyFiveStatus())))\" && node -e \"import('./tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2657TwentyNineMutationTargetTwentySixStatus())))\" && node -e \"import('./tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2658TwentyNineMutationTargetTwentySevenStatus())))\" && node -e \"import('./tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2659TwentyNineMutationTargetTwentyEightStatus())))\" && node -e \"import('./tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2660TwentyNineMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2627-2660-controlled-twenty-nine-tool-mutation"] === "node tools/phase2627_2660/validate-controlled-twenty-nine-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2626_sealed", phase2626.recommendedSealed === true && phase2626.twentyEightMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2627-2660-controlled-twenty-nine-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("twenty_nine_mutation_applied", result.twentyNineMutationApplied === true);
  check("changed_file_count_twenty_nine", result.changedFileCount === 29);
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
    && result.changedFiles.includes(targetTwentyThreePath)
    && result.changedFiles.includes(targetTwentyFourPath)
    && result.changedFiles.includes(targetTwentyFivePath)
    && result.changedFiles.includes(targetTwentySixPath)
    && result.changedFiles.includes(targetTwentySevenPath)
    && result.changedFiles.includes(targetTwentyEightPath)
    && result.changedFiles.includes(targetTwentyNinePath)
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localTwentyNineSmokePassed === true);
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
  check("rollback_restore_twenty_nine", rollback.rollbackAction === "restore-previous-content-twenty-nine");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_twenty_nine_entries", Array.isArray(rollback.files) && rollback.files.length === 29);
}

if (smoke) {
  check("smoke_phase2632Marker", smoke.phase2632Marker === "PHASE2632_TWENTY_NINE_TOOL_TARGET_ONE_OK");
  check("smoke_phase2633Marker", smoke.phase2633Marker === "PHASE2633_TWENTY_NINE_TOOL_TARGET_TWO_OK");
  check("smoke_phase2634Marker", smoke.phase2634Marker === "PHASE2634_TWENTY_NINE_TOOL_TARGET_THREE_OK");
  check("smoke_phase2635Marker", smoke.phase2635Marker === "PHASE2635_TWENTY_NINE_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2636Marker", smoke.phase2636Marker === "PHASE2636_TWENTY_NINE_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2637Marker", smoke.phase2637Marker === "PHASE2637_TWENTY_NINE_TOOL_TARGET_SIX_OK");
  check("smoke_phase2638Marker", smoke.phase2638Marker === "PHASE2638_TWENTY_NINE_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2639Marker", smoke.phase2639Marker === "PHASE2639_TWENTY_NINE_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2640Marker", smoke.phase2640Marker === "PHASE2640_TWENTY_NINE_TOOL_TARGET_NINE_OK");
  check("smoke_phase2641Marker", smoke.phase2641Marker === "PHASE2641_TWENTY_NINE_TOOL_TARGET_TEN_OK");
  check("smoke_phase2642Marker", smoke.phase2642Marker === "PHASE2642_TWENTY_NINE_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2643Marker", smoke.phase2643Marker === "PHASE2643_TWENTY_NINE_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2644Marker", smoke.phase2644Marker === "PHASE2644_TWENTY_NINE_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2645Marker", smoke.phase2645Marker === "PHASE2645_TWENTY_NINE_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2646Marker", smoke.phase2646Marker === "PHASE2646_TWENTY_NINE_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2647Marker", smoke.phase2647Marker === "PHASE2647_TWENTY_NINE_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase2648Marker", smoke.phase2648Marker === "PHASE2648_TWENTY_NINE_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase2649Marker", smoke.phase2649Marker === "PHASE2649_TWENTY_NINE_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase2650Marker", smoke.phase2650Marker === "PHASE2650_TWENTY_NINE_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase2651Marker", smoke.phase2651Marker === "PHASE2651_TWENTY_NINE_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase2652Marker", smoke.phase2652Marker === "PHASE2652_TWENTY_NINE_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase2653Marker", smoke.phase2653Marker === "PHASE2653_TWENTY_NINE_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase2654Marker", smoke.phase2654Marker === "PHASE2654_TWENTY_NINE_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase2655Marker", smoke.phase2655Marker === "PHASE2655_TWENTY_NINE_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase2656Marker", smoke.phase2656Marker === "PHASE2656_TWENTY_NINE_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase2657Marker", smoke.phase2657Marker === "PHASE2657_TWENTY_NINE_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase2658Marker", smoke.phase2658Marker === "PHASE2658_TWENTY_NINE_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase2659Marker", smoke.phase2659Marker === "PHASE2659_TWENTY_NINE_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase2660Marker", smoke.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2632TwentyNineMutationTargetOneStatus") || targetOne.includes("export function buildPhase2632TwentyNineMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2632_TWENTY_NINE_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2633TwentyNineMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2633TwentyNineMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2633_TWENTY_NINE_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2634TwentyNineMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2634TwentyNineMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2634_TWENTY_NINE_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2635TwentyNineMutationTargetFourStatus") || targetFour.includes("export function buildPhase2635TwentyNineMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2635_TWENTY_NINE_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2636TwentyNineMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2636TwentyNineMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2636_TWENTY_NINE_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2637TwentyNineMutationTargetSixStatus") || targetSix.includes("export function buildPhase2637TwentyNineMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2637_TWENTY_NINE_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2638TwentyNineMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2638TwentyNineMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2638_TWENTY_NINE_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2639TwentyNineMutationTargetEightStatus") || targetEight.includes("export function buildPhase2639TwentyNineMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2639_TWENTY_NINE_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2640TwentyNineMutationTargetNineStatus") || targetNine.includes("export function buildPhase2640TwentyNineMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2640_TWENTY_NINE_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2641TwentyNineMutationTargetTenStatus") || targetTen.includes("export function buildPhase2641TwentyNineMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2641_TWENTY_NINE_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2642TwentyNineMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2642TwentyNineMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2642_TWENTY_NINE_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2643TwentyNineMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2643TwentyNineMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2643_TWENTY_NINE_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2644TwentyNineMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2644TwentyNineMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2644_TWENTY_NINE_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2645TwentyNineMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2645TwentyNineMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2645_TWENTY_NINE_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2646TwentyNineMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2646TwentyNineMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2646_TWENTY_NINE_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2647TwentyNineMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase2647TwentyNineMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2647_TWENTY_NINE_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase2648TwentyNineMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase2648TwentyNineMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE2648_TWENTY_NINE_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase2649TwentyNineMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase2649TwentyNineMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE2649_TWENTY_NINE_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase2650TwentyNineMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase2650TwentyNineMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE2650_TWENTY_NINE_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase2651TwentyNineMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase2651TwentyNineMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE2651_TWENTY_NINE_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase2652TwentyNineMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase2652TwentyNineMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE2652_TWENTY_NINE_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase2653TwentyNineMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase2653TwentyNineMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE2653_TWENTY_NINE_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase2654TwentyNineMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase2654TwentyNineMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE2654_TWENTY_NINE_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase2655TwentyNineMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase2655TwentyNineMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE2655_TWENTY_NINE_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase2656TwentyNineMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase2656TwentyNineMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE2656_TWENTY_NINE_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase2657TwentyNineMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase2657TwentyNineMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE2657_TWENTY_NINE_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase2658TwentyNineMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase2658TwentyNineMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE2658_TWENTY_NINE_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase2659TwentyNineMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase2659TwentyNineMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE2659_TWENTY_NINE_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase2660TwentyNineMutationRuntimeStatus") || targetTwentyNine.includes("export function buildPhase2660TwentyNineMutationRuntimeStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_twenty_nine", docs.includes("controlled twenty-nine tool mutation"));
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
  phase2626Sealed: phase2626.recommendedSealed === true,
  twentyNineMutationReady: completed,
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
    targetTwentyThreePath,
    targetTwentyFourPath,
    targetTwentyFivePath,
    targetTwentySixPath,
    targetTwentySevenPath,
    targetTwentyEightPath,
    targetTwentyNinePath,
  ],
  changedFileCount: result?.changedFileCount ?? 29,
  twentyNineMutationApplied: result?.twentyNineMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localTwentyNineSmokePassed: result?.localTwentyNineSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, twentyNineMutationApplied: verifierResult.twentyNineMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localTwentyNineSmokePassed: verifierResult.localTwentyNineSmokePassed }, null, 2));
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
    "# Phase2627A-2660A Controlled Twenty-Nine Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- twentyNineMutationApplied: ${Boolean(result.twentyNineMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localTwentyNineSmokePassed: ${Boolean(result.localTwentyNineSmokePassed)}`,
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
