import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2594A-2626A-Controlled-Twenty-Eight-Tool-Mutation";
const runnerPath = "tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2594-2626-controlled-twenty-eight-tool-mutation.md";
const approvalPath = "docs/phase2594-2626-controlled-twenty-eight-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2599-twenty-eight-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2600-twenty-eight-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2601-twenty-eight-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2602-twenty-eight-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2603-twenty-eight-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2604-twenty-eight-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2605-twenty-eight-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2606-twenty-eight-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2607-twenty-eight-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2608-twenty-eight-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2609-twenty-eight-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2610-twenty-eight-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2611-twenty-eight-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2612-twenty-eight-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2613-twenty-eight-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2614-twenty-eight-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase2615-twenty-eight-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase2616-twenty-eight-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase2617-twenty-eight-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase2618-twenty-eight-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase2619-twenty-eight-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase2620-twenty-eight-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase2621-twenty-eight-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase2622-twenty-eight-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase2623-twenty-eight-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase2624-twenty-eight-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase2625-twenty-eight-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase2626-twenty-eight-tool-mutation-target-twenty-eight.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase2594-2626-controlled-twenty-eight-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2594-2626-controlled-twenty-eight-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2594-2626-controlled-twenty-eight-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2594-2626-controlled-twenty-eight-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2594-2626-controlled-twenty-eight-tool-mutation/twenty-eight-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2593 = readJson("apps/ai-gateway-service/evidence/phase2562-2593-controlled-twenty-seven-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2594-2626-controlled-twenty-eight-tool-mutation"] === "node tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs --plan docs/phase2594-2626-controlled-twenty-eight-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2594-2626-controlled-twenty-eight-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2604TwentyEightMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2605TwentyEightMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2606TwentyEightMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2607TwentyEightMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2608TwentyEightMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2609TwentyEightMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2610TwentyEightMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2611TwentyEightMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2612TwentyEightMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2613TwentyEightMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2614TwentyEightMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2615TwentyEightMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2616TwentyEightMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2617TwentyEightMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2618TwentyEightMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2619TwentyEightMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2620TwentyEightMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2621TwentyEightMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2622TwentyEightMutationTargetTwentyFourStatus())))\" && node -e \"import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2623TwentyEightMutationTargetTwentyFiveStatus())))\" && node -e \"import('./tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2624TwentyEightMutationTargetTwentySixStatus())))\" && node -e \"import('./tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2625TwentyEightMutationTargetTwentySevenStatus())))\" && node -e \"import('./tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2626TwentyEightMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2594-2626-controlled-twenty-eight-tool-mutation"] === "node tools/phase2594_2626/validate-controlled-twenty-eight-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2593_sealed", phase2593.recommendedSealed === true && phase2593.twentySevenMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2594-2626-controlled-twenty-eight-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("twenty_eight_mutation_applied", result.twentyEightMutationApplied === true);
  check("changed_file_count_twenty_eight", result.changedFileCount === 28);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localTwentyEightSmokePassed === true);
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
  check("rollback_restore_twenty_eight", rollback.rollbackAction === "restore-previous-content-twenty-eight");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_twenty_eight_entries", Array.isArray(rollback.files) && rollback.files.length === 28);
}

if (smoke) {
  check("smoke_phase2599Marker", smoke.phase2599Marker === "PHASE2599_TWENTY_EIGHT_TOOL_TARGET_ONE_OK");
  check("smoke_phase2600Marker", smoke.phase2600Marker === "PHASE2600_TWENTY_EIGHT_TOOL_TARGET_TWO_OK");
  check("smoke_phase2601Marker", smoke.phase2601Marker === "PHASE2601_TWENTY_EIGHT_TOOL_TARGET_THREE_OK");
  check("smoke_phase2602Marker", smoke.phase2602Marker === "PHASE2602_TWENTY_EIGHT_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2603Marker", smoke.phase2603Marker === "PHASE2603_TWENTY_EIGHT_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2604Marker", smoke.phase2604Marker === "PHASE2604_TWENTY_EIGHT_TOOL_TARGET_SIX_OK");
  check("smoke_phase2605Marker", smoke.phase2605Marker === "PHASE2605_TWENTY_EIGHT_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2606Marker", smoke.phase2606Marker === "PHASE2606_TWENTY_EIGHT_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2607Marker", smoke.phase2607Marker === "PHASE2607_TWENTY_EIGHT_TOOL_TARGET_NINE_OK");
  check("smoke_phase2608Marker", smoke.phase2608Marker === "PHASE2608_TWENTY_EIGHT_TOOL_TARGET_TEN_OK");
  check("smoke_phase2609Marker", smoke.phase2609Marker === "PHASE2609_TWENTY_EIGHT_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2610Marker", smoke.phase2610Marker === "PHASE2610_TWENTY_EIGHT_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2611Marker", smoke.phase2611Marker === "PHASE2611_TWENTY_EIGHT_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2612Marker", smoke.phase2612Marker === "PHASE2612_TWENTY_EIGHT_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2613Marker", smoke.phase2613Marker === "PHASE2613_TWENTY_EIGHT_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2614Marker", smoke.phase2614Marker === "PHASE2614_TWENTY_EIGHT_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase2615Marker", smoke.phase2615Marker === "PHASE2615_TWENTY_EIGHT_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase2616Marker", smoke.phase2616Marker === "PHASE2616_TWENTY_EIGHT_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase2617Marker", smoke.phase2617Marker === "PHASE2617_TWENTY_EIGHT_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase2618Marker", smoke.phase2618Marker === "PHASE2618_TWENTY_EIGHT_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase2619Marker", smoke.phase2619Marker === "PHASE2619_TWENTY_EIGHT_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase2620Marker", smoke.phase2620Marker === "PHASE2620_TWENTY_EIGHT_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase2621Marker", smoke.phase2621Marker === "PHASE2621_TWENTY_EIGHT_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase2622Marker", smoke.phase2622Marker === "PHASE2622_TWENTY_EIGHT_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase2623Marker", smoke.phase2623Marker === "PHASE2623_TWENTY_EIGHT_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase2624Marker", smoke.phase2624Marker === "PHASE2624_TWENTY_EIGHT_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase2625Marker", smoke.phase2625Marker === "PHASE2625_TWENTY_EIGHT_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase2626Marker", smoke.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2599TwentyEightMutationTargetOneStatus") || targetOne.includes("export function buildPhase2599TwentyEightMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2599_TWENTY_EIGHT_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2600TwentyEightMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2600TwentyEightMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2600_TWENTY_EIGHT_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2601TwentyEightMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2601TwentyEightMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2601_TWENTY_EIGHT_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2602TwentyEightMutationTargetFourStatus") || targetFour.includes("export function buildPhase2602TwentyEightMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2602_TWENTY_EIGHT_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2603TwentyEightMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2603TwentyEightMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2603_TWENTY_EIGHT_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2604TwentyEightMutationTargetSixStatus") || targetSix.includes("export function buildPhase2604TwentyEightMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2604_TWENTY_EIGHT_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2605TwentyEightMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2605TwentyEightMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2605_TWENTY_EIGHT_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2606TwentyEightMutationTargetEightStatus") || targetEight.includes("export function buildPhase2606TwentyEightMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2606_TWENTY_EIGHT_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2607TwentyEightMutationTargetNineStatus") || targetNine.includes("export function buildPhase2607TwentyEightMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2607_TWENTY_EIGHT_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2608TwentyEightMutationTargetTenStatus") || targetTen.includes("export function buildPhase2608TwentyEightMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2608_TWENTY_EIGHT_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2609TwentyEightMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2609TwentyEightMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2609_TWENTY_EIGHT_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2610TwentyEightMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2610TwentyEightMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2610_TWENTY_EIGHT_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2611TwentyEightMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2611TwentyEightMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2611_TWENTY_EIGHT_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2612TwentyEightMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2612TwentyEightMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2612_TWENTY_EIGHT_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2613TwentyEightMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2613TwentyEightMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2613_TWENTY_EIGHT_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2614TwentyEightMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase2614TwentyEightMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2614_TWENTY_EIGHT_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase2615TwentyEightMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase2615TwentyEightMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE2615_TWENTY_EIGHT_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase2616TwentyEightMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase2616TwentyEightMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE2616_TWENTY_EIGHT_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase2617TwentyEightMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase2617TwentyEightMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE2617_TWENTY_EIGHT_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase2618TwentyEightMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase2618TwentyEightMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE2618_TWENTY_EIGHT_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase2619TwentyEightMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase2619TwentyEightMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE2619_TWENTY_EIGHT_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase2620TwentyEightMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase2620TwentyEightMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE2620_TWENTY_EIGHT_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase2621TwentyEightMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase2621TwentyEightMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE2621_TWENTY_EIGHT_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase2622TwentyEightMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase2622TwentyEightMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE2622_TWENTY_EIGHT_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase2623TwentyEightMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase2623TwentyEightMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE2623_TWENTY_EIGHT_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase2624TwentyEightMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase2624TwentyEightMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE2624_TWENTY_EIGHT_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase2625TwentyEightMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase2625TwentyEightMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE2625_TWENTY_EIGHT_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase2626TwentyEightMutationRuntimeStatus") || targetTwentyEight.includes("export function buildPhase2626TwentyEightMutationRuntimeStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_twenty_eight", docs.includes("controlled twenty-eight tool mutation"));
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
  phase2593Sealed: phase2593.recommendedSealed === true,
  twentyEightMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 28,
  twentyEightMutationApplied: result?.twentyEightMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localTwentyEightSmokePassed: result?.localTwentyEightSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, twentyEightMutationApplied: verifierResult.twentyEightMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localTwentyEightSmokePassed: verifierResult.localTwentyEightSmokePassed }, null, 2));
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
    "# Phase2594A-2626A Controlled Twenty-Eight Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- twentyEightMutationApplied: ${Boolean(result.twentyEightMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localTwentyEightSmokePassed: ${Boolean(result.localTwentyEightSmokePassed)}`,
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
