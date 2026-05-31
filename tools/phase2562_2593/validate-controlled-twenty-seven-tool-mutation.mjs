import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2562A-2593A-Controlled-Twenty-Seven-Tool-Mutation";
const runnerPath = "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2562-2593-controlled-twenty-seven-tool-mutation.md";
const approvalPath = "docs/phase2562-2593-controlled-twenty-seven-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2567-twenty-seven-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2568-twenty-seven-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2569-twenty-seven-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2570-twenty-seven-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2571-twenty-seven-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2572-twenty-seven-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2573-twenty-seven-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2574-twenty-seven-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2575-twenty-seven-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2576-twenty-seven-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2577-twenty-seven-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2578-twenty-seven-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2579-twenty-seven-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2580-twenty-seven-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2581-twenty-seven-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2582-twenty-seven-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase2583-twenty-seven-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase2584-twenty-seven-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase2585-twenty-seven-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase2586-twenty-seven-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase2587-twenty-seven-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase2588-twenty-seven-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase2589-twenty-seven-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase2590-twenty-seven-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase2591-twenty-seven-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase2592-twenty-seven-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase2593-twenty-seven-tool-mutation-target-twenty-seven.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase2562-2593-controlled-twenty-seven-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2562-2593-controlled-twenty-seven-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2562-2593-controlled-twenty-seven-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2562-2593-controlled-twenty-seven-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2562-2593-controlled-twenty-seven-tool-mutation/twenty-seven-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2561 = readJson("apps/ai-gateway-service/evidence/phase2531-2561-controlled-twenty-six-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2562-2593-controlled-twenty-seven-tool-mutation"] === "node tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs --plan docs/phase2562-2593-controlled-twenty-seven-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2562-2593-controlled-twenty-seven-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2572TwentySevenMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2573TwentySevenMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2574TwentySevenMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2575TwentySevenMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2576TwentySevenMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2577TwentySevenMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2578TwentySevenMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2579TwentySevenMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2580TwentySevenMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2581TwentySevenMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2582TwentySevenMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2583TwentySevenMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2584TwentySevenMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2585TwentySevenMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2586TwentySevenMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2587TwentySevenMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2588TwentySevenMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2589TwentySevenMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2590TwentySevenMutationTargetTwentyFourStatus())))\" && node -e \"import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2591TwentySevenMutationTargetTwentyFiveStatus())))\" && node -e \"import('./tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2592TwentySevenMutationTargetTwentySixStatus())))\" && node -e \"import('./tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2593TwentySevenMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2562-2593-controlled-twenty-seven-tool-mutation"] === "node tools/phase2562_2593/validate-controlled-twenty-seven-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2561_sealed", phase2561.recommendedSealed === true && phase2561.twentySixMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2562-2593-controlled-twenty-seven-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("twenty_seven_mutation_applied", result.twentySevenMutationApplied === true);
  check("changed_file_count_twenty_seven", result.changedFileCount === 27);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localTwentySevenSmokePassed === true);
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
  check("rollback_restore_twenty_seven", rollback.rollbackAction === "restore-previous-content-twenty-seven");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_twenty_seven_entries", Array.isArray(rollback.files) && rollback.files.length === 27);
}

if (smoke) {
  check("smoke_phase2567Marker", smoke.phase2567Marker === "PHASE2567_TWENTY_SEVEN_TOOL_TARGET_ONE_OK");
  check("smoke_phase2568Marker", smoke.phase2568Marker === "PHASE2568_TWENTY_SEVEN_TOOL_TARGET_TWO_OK");
  check("smoke_phase2569Marker", smoke.phase2569Marker === "PHASE2569_TWENTY_SEVEN_TOOL_TARGET_THREE_OK");
  check("smoke_phase2570Marker", smoke.phase2570Marker === "PHASE2570_TWENTY_SEVEN_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2571Marker", smoke.phase2571Marker === "PHASE2571_TWENTY_SEVEN_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2572Marker", smoke.phase2572Marker === "PHASE2572_TWENTY_SEVEN_TOOL_TARGET_SIX_OK");
  check("smoke_phase2573Marker", smoke.phase2573Marker === "PHASE2573_TWENTY_SEVEN_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2574Marker", smoke.phase2574Marker === "PHASE2574_TWENTY_SEVEN_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2575Marker", smoke.phase2575Marker === "PHASE2575_TWENTY_SEVEN_TOOL_TARGET_NINE_OK");
  check("smoke_phase2576Marker", smoke.phase2576Marker === "PHASE2576_TWENTY_SEVEN_TOOL_TARGET_TEN_OK");
  check("smoke_phase2577Marker", smoke.phase2577Marker === "PHASE2577_TWENTY_SEVEN_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2578Marker", smoke.phase2578Marker === "PHASE2578_TWENTY_SEVEN_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2579Marker", smoke.phase2579Marker === "PHASE2579_TWENTY_SEVEN_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2580Marker", smoke.phase2580Marker === "PHASE2580_TWENTY_SEVEN_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2581Marker", smoke.phase2581Marker === "PHASE2581_TWENTY_SEVEN_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2582Marker", smoke.phase2582Marker === "PHASE2582_TWENTY_SEVEN_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase2583Marker", smoke.phase2583Marker === "PHASE2583_TWENTY_SEVEN_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase2584Marker", smoke.phase2584Marker === "PHASE2584_TWENTY_SEVEN_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase2585Marker", smoke.phase2585Marker === "PHASE2585_TWENTY_SEVEN_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase2586Marker", smoke.phase2586Marker === "PHASE2586_TWENTY_SEVEN_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase2587Marker", smoke.phase2587Marker === "PHASE2587_TWENTY_SEVEN_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase2588Marker", smoke.phase2588Marker === "PHASE2588_TWENTY_SEVEN_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase2589Marker", smoke.phase2589Marker === "PHASE2589_TWENTY_SEVEN_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase2590Marker", smoke.phase2590Marker === "PHASE2590_TWENTY_SEVEN_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase2591Marker", smoke.phase2591Marker === "PHASE2591_TWENTY_SEVEN_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase2592Marker", smoke.phase2592Marker === "PHASE2592_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase2593Marker", smoke.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2567TwentySevenMutationTargetOneStatus") || targetOne.includes("export function buildPhase2567TwentySevenMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2567_TWENTY_SEVEN_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2568TwentySevenMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2568TwentySevenMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2568_TWENTY_SEVEN_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2569TwentySevenMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2569TwentySevenMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2569_TWENTY_SEVEN_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2570TwentySevenMutationTargetFourStatus") || targetFour.includes("export function buildPhase2570TwentySevenMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2570_TWENTY_SEVEN_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2571TwentySevenMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2571TwentySevenMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2571_TWENTY_SEVEN_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2572TwentySevenMutationTargetSixStatus") || targetSix.includes("export function buildPhase2572TwentySevenMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2572_TWENTY_SEVEN_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2573TwentySevenMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2573TwentySevenMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2573_TWENTY_SEVEN_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2574TwentySevenMutationTargetEightStatus") || targetEight.includes("export function buildPhase2574TwentySevenMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2574_TWENTY_SEVEN_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2575TwentySevenMutationTargetNineStatus") || targetNine.includes("export function buildPhase2575TwentySevenMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2575_TWENTY_SEVEN_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2576TwentySevenMutationTargetTenStatus") || targetTen.includes("export function buildPhase2576TwentySevenMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2576_TWENTY_SEVEN_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2577TwentySevenMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2577TwentySevenMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2577_TWENTY_SEVEN_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2578TwentySevenMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2578TwentySevenMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2578_TWENTY_SEVEN_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2579TwentySevenMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2579TwentySevenMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2579_TWENTY_SEVEN_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2580TwentySevenMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2580TwentySevenMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2580_TWENTY_SEVEN_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2581TwentySevenMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2581TwentySevenMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2581_TWENTY_SEVEN_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2582TwentySevenMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase2582TwentySevenMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2582_TWENTY_SEVEN_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase2583TwentySevenMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase2583TwentySevenMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE2583_TWENTY_SEVEN_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase2584TwentySevenMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase2584TwentySevenMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE2584_TWENTY_SEVEN_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase2585TwentySevenMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase2585TwentySevenMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE2585_TWENTY_SEVEN_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase2586TwentySevenMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase2586TwentySevenMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE2586_TWENTY_SEVEN_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase2587TwentySevenMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase2587TwentySevenMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE2587_TWENTY_SEVEN_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase2588TwentySevenMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase2588TwentySevenMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE2588_TWENTY_SEVEN_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase2589TwentySevenMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase2589TwentySevenMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE2589_TWENTY_SEVEN_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase2590TwentySevenMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase2590TwentySevenMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE2590_TWENTY_SEVEN_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase2591TwentySevenMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase2591TwentySevenMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE2591_TWENTY_SEVEN_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase2592TwentySevenMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase2592TwentySevenMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE2592_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase2593TwentySevenMutationRuntimeStatus") || targetTwentySeven.includes("export function buildPhase2593TwentySevenMutationRuntimeStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_twenty_seven", docs.includes("controlled twenty-seven tool mutation"));
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
  phase2561Sealed: phase2561.recommendedSealed === true,
  twentySevenMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 27,
  twentySevenMutationApplied: result?.twentySevenMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localTwentySevenSmokePassed: result?.localTwentySevenSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, twentySevenMutationApplied: verifierResult.twentySevenMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localTwentySevenSmokePassed: verifierResult.localTwentySevenSmokePassed }, null, 2));
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
    "# Phase2562A-2593A Controlled Twenty-Seven Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- twentySevenMutationApplied: ${Boolean(result.twentySevenMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localTwentySevenSmokePassed: ${Boolean(result.localTwentySevenSmokePassed)}`,
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
