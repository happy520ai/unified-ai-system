import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2696A-2731A-Controlled-Thirty-One-Tool-Mutation";
const runnerPath = "tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2696-2731-controlled-thirty-one-tool-mutation.md";
const approvalPath = "docs/phase2696-2731-controlled-thirty-one-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2701-thirty-one-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2702-thirty-one-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2703-thirty-one-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2704-thirty-one-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2705-thirty-one-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2706-thirty-one-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2707-thirty-one-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2708-thirty-one-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2709-thirty-one-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2710-thirty-one-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2711-thirty-one-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2712-thirty-one-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2713-thirty-one-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2714-thirty-one-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2715-thirty-one-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2716-thirty-one-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase2717-thirty-one-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase2718-thirty-one-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase2719-thirty-one-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase2720-thirty-one-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase2721-thirty-one-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase2722-thirty-one-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase2723-thirty-one-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase2724-thirty-one-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase2725-thirty-one-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase2726-thirty-one-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase2727-thirty-one-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase2728-thirty-one-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase2729-thirty-one-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase2730-thirty-one-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase2731-thirty-one-tool-mutation-target-thirty-one.proposal.diff";
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
const targetThirtyPath = "tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs";
const targetThirtyOnePath = "tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2696-2731-controlled-thirty-one-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2696-2731-controlled-thirty-one-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2696-2731-controlled-thirty-one-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2696-2731-controlled-thirty-one-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2696-2731-controlled-thirty-one-tool-mutation/thirty-one-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2695 = readJson("apps/ai-gateway-service/evidence/phase2661-2695-controlled-thirty-tool-mutation/result.json") || {};
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
const targetThirty = existsSync(resolve(targetThirtyPath)) ? readText(targetThirtyPath) : "";
const targetThirtyOne = existsSync(resolve(targetThirtyOnePath)) ? readText(targetThirtyOnePath) : "";
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
check("proposal_thirty_exists", existsSync(resolve(proposalThirtyPath)));
check("proposal_thirty-one_exists", existsSync(resolve(proposalThirtyOnePath)));
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2696-2731-controlled-thirty-one-tool-mutation"] === "node tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs --plan docs/phase2696-2731-controlled-thirty-one-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2696-2731-controlled-thirty-one-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2706ThirtyOneMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2707ThirtyOneMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2708ThirtyOneMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2709ThirtyOneMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2710ThirtyOneMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2711ThirtyOneMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2712ThirtyOneMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2713ThirtyOneMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2714ThirtyOneMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2715ThirtyOneMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2716ThirtyOneMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2717ThirtyOneMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2718ThirtyOneMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2719ThirtyOneMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2720ThirtyOneMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2721ThirtyOneMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2722ThirtyOneMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2723ThirtyOneMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2724ThirtyOneMutationTargetTwentyFourStatus())))\" && node -e \"import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2725ThirtyOneMutationTargetTwentyFiveStatus())))\" && node -e \"import('./tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2726ThirtyOneMutationTargetTwentySixStatus())))\" && node -e \"import('./tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2727ThirtyOneMutationTargetTwentySevenStatus())))\" && node -e \"import('./tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2728ThirtyOneMutationTargetTwentyEightStatus())))\" && node -e \"import('./tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2729ThirtyOneMutationTargetTwentyNineStatus())))\" && node -e \"import('./tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2730ThirtyOneMutationTargetThirtyStatus())))\" && node -e \"import('./tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2731ThirtyOneMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2696-2731-controlled-thirty-one-tool-mutation"] === "node tools/phase2696_2731/validate-controlled-thirty-one-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2695_sealed", phase2695.recommendedSealed === true && phase2695.thirtyMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2696-2731-controlled-thirty-one-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("thirty_one_mutation_applied", result.thirtyOneMutationApplied === true);
  check("changed_file_count_thirty_one", result.changedFileCount === 31);
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
    && result.changedFiles.includes(targetThirtyPath)
    && result.changedFiles.includes(targetThirtyOnePath)
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localThirtyOneSmokePassed === true);
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
  check("rollback_restore_thirty_one", rollback.rollbackAction === "restore-previous-content-thirty-one");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_thirty_one_entries", Array.isArray(rollback.files) && rollback.files.length === 31);
}

if (smoke) {
  check("smoke_phase2701Marker", smoke.phase2701Marker === "PHASE2701_THIRTY_ONE_TOOL_TARGET_ONE_OK");
  check("smoke_phase2702Marker", smoke.phase2702Marker === "PHASE2702_THIRTY_ONE_TOOL_TARGET_TWO_OK");
  check("smoke_phase2703Marker", smoke.phase2703Marker === "PHASE2703_THIRTY_ONE_TOOL_TARGET_THREE_OK");
  check("smoke_phase2704Marker", smoke.phase2704Marker === "PHASE2704_THIRTY_ONE_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2705Marker", smoke.phase2705Marker === "PHASE2705_THIRTY_ONE_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2706Marker", smoke.phase2706Marker === "PHASE2706_THIRTY_ONE_TOOL_TARGET_SIX_OK");
  check("smoke_phase2707Marker", smoke.phase2707Marker === "PHASE2707_THIRTY_ONE_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2708Marker", smoke.phase2708Marker === "PHASE2708_THIRTY_ONE_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2709Marker", smoke.phase2709Marker === "PHASE2709_THIRTY_ONE_TOOL_TARGET_NINE_OK");
  check("smoke_phase2710Marker", smoke.phase2710Marker === "PHASE2710_THIRTY_ONE_TOOL_TARGET_TEN_OK");
  check("smoke_phase2711Marker", smoke.phase2711Marker === "PHASE2711_THIRTY_ONE_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2712Marker", smoke.phase2712Marker === "PHASE2712_THIRTY_ONE_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2713Marker", smoke.phase2713Marker === "PHASE2713_THIRTY_ONE_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2714Marker", smoke.phase2714Marker === "PHASE2714_THIRTY_ONE_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2715Marker", smoke.phase2715Marker === "PHASE2715_THIRTY_ONE_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2716Marker", smoke.phase2716Marker === "PHASE2716_THIRTY_ONE_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase2717Marker", smoke.phase2717Marker === "PHASE2717_THIRTY_ONE_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase2718Marker", smoke.phase2718Marker === "PHASE2718_THIRTY_ONE_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase2719Marker", smoke.phase2719Marker === "PHASE2719_THIRTY_ONE_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase2720Marker", smoke.phase2720Marker === "PHASE2720_THIRTY_ONE_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase2721Marker", smoke.phase2721Marker === "PHASE2721_THIRTY_ONE_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase2722Marker", smoke.phase2722Marker === "PHASE2722_THIRTY_ONE_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase2723Marker", smoke.phase2723Marker === "PHASE2723_THIRTY_ONE_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase2724Marker", smoke.phase2724Marker === "PHASE2724_THIRTY_ONE_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase2725Marker", smoke.phase2725Marker === "PHASE2725_THIRTY_ONE_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase2726Marker", smoke.phase2726Marker === "PHASE2726_THIRTY_ONE_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase2727Marker", smoke.phase2727Marker === "PHASE2727_THIRTY_ONE_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase2728Marker", smoke.phase2728Marker === "PHASE2728_THIRTY_ONE_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase2729Marker", smoke.phase2729Marker === "PHASE2729_THIRTY_ONE_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase2730Marker", smoke.phase2730Marker === "PHASE2730_THIRTY_ONE_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase2731Marker", smoke.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2701ThirtyOneMutationTargetOneStatus") || targetOne.includes("export function buildPhase2701ThirtyOneMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2701_THIRTY_ONE_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2702ThirtyOneMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2702ThirtyOneMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2702_THIRTY_ONE_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2703ThirtyOneMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2703ThirtyOneMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2703_THIRTY_ONE_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2704ThirtyOneMutationTargetFourStatus") || targetFour.includes("export function buildPhase2704ThirtyOneMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2704_THIRTY_ONE_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2705ThirtyOneMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2705ThirtyOneMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2705_THIRTY_ONE_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2706ThirtyOneMutationTargetSixStatus") || targetSix.includes("export function buildPhase2706ThirtyOneMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2706_THIRTY_ONE_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2707ThirtyOneMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2707ThirtyOneMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2707_THIRTY_ONE_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2708ThirtyOneMutationTargetEightStatus") || targetEight.includes("export function buildPhase2708ThirtyOneMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2708_THIRTY_ONE_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2709ThirtyOneMutationTargetNineStatus") || targetNine.includes("export function buildPhase2709ThirtyOneMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2709_THIRTY_ONE_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2710ThirtyOneMutationTargetTenStatus") || targetTen.includes("export function buildPhase2710ThirtyOneMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2710_THIRTY_ONE_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2711ThirtyOneMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2711ThirtyOneMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2711_THIRTY_ONE_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2712ThirtyOneMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2712ThirtyOneMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2712_THIRTY_ONE_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2713ThirtyOneMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2713ThirtyOneMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2713_THIRTY_ONE_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2714ThirtyOneMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2714ThirtyOneMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2714_THIRTY_ONE_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2715ThirtyOneMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2715ThirtyOneMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2715_THIRTY_ONE_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2716ThirtyOneMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase2716ThirtyOneMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2716_THIRTY_ONE_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase2717ThirtyOneMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase2717ThirtyOneMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE2717_THIRTY_ONE_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase2718ThirtyOneMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase2718ThirtyOneMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE2718_THIRTY_ONE_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase2719ThirtyOneMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase2719ThirtyOneMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE2719_THIRTY_ONE_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase2720ThirtyOneMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase2720ThirtyOneMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE2720_THIRTY_ONE_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase2721ThirtyOneMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase2721ThirtyOneMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE2721_THIRTY_ONE_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase2722ThirtyOneMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase2722ThirtyOneMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE2722_THIRTY_ONE_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase2723ThirtyOneMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase2723ThirtyOneMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE2723_THIRTY_ONE_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase2724ThirtyOneMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase2724ThirtyOneMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE2724_THIRTY_ONE_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase2725ThirtyOneMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase2725ThirtyOneMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE2725_THIRTY_ONE_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase2726ThirtyOneMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase2726ThirtyOneMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE2726_THIRTY_ONE_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase2727ThirtyOneMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase2727ThirtyOneMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE2727_THIRTY_ONE_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase2728ThirtyOneMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase2728ThirtyOneMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE2728_THIRTY_ONE_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase2729ThirtyOneMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase2729ThirtyOneMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE2729_THIRTY_ONE_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase2730ThirtyOneMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase2730ThirtyOneMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE2730_THIRTY_ONE_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase2731ThirtyOneMutationRuntimeStatus") || targetThirtyOne.includes("export function buildPhase2731ThirtyOneMutationRuntimeStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_thirty_one", docs.includes("controlled thirty-one tool mutation"));
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
  phase2695Sealed: phase2695.recommendedSealed === true,
  thirtyOneMutationReady: completed,
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
    targetThirtyPath,
    targetThirtyOnePath,
  ],
  changedFileCount: result?.changedFileCount ?? 31,
  thirtyOneMutationApplied: result?.thirtyOneMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localThirtyOneSmokePassed: result?.localThirtyOneSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, thirtyOneMutationApplied: verifierResult.thirtyOneMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localThirtyOneSmokePassed: verifierResult.localThirtyOneSmokePassed }, null, 2));
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
    "# Phase2696A-2731A Controlled Thirty-One Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- thirtyOneMutationApplied: ${Boolean(result.thirtyOneMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localThirtyOneSmokePassed: ${Boolean(result.localThirtyOneSmokePassed)}`,
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
