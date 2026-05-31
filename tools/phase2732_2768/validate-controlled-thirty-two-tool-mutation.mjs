import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2732A-2768A-Controlled-Thirty-Two-Tool-Mutation";
const runnerPath = "tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2732-2768-controlled-thirty-two-tool-mutation.md";
const approvalPath = "docs/phase2732-2768-controlled-thirty-two-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2737-thirty-two-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2738-thirty-two-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2739-thirty-two-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2740-thirty-two-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2741-thirty-two-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2742-thirty-two-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2743-thirty-two-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2744-thirty-two-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2745-thirty-two-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2746-thirty-two-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2747-thirty-two-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2748-thirty-two-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2749-thirty-two-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2750-thirty-two-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2751-thirty-two-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2752-thirty-two-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase2753-thirty-two-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase2754-thirty-two-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase2755-thirty-two-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase2756-thirty-two-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase2757-thirty-two-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase2758-thirty-two-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase2759-thirty-two-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase2760-thirty-two-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase2761-thirty-two-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase2762-thirty-two-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase2763-thirty-two-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase2764-thirty-two-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase2765-thirty-two-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase2766-thirty-two-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase2767-thirty-two-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase2768-thirty-two-tool-mutation-target-thirty-two.proposal.diff";
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
const targetThirtyTwoPath = "tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2732-2768-controlled-thirty-two-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2732-2768-controlled-thirty-two-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2732-2768-controlled-thirty-two-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2732-2768-controlled-thirty-two-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2732-2768-controlled-thirty-two-tool-mutation/thirty-two-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2731 = readJson("apps/ai-gateway-service/evidence/phase2696-2731-controlled-thirty-one-tool-mutation/result.json") || {};
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
const targetThirtyTwo = existsSync(resolve(targetThirtyTwoPath)) ? readText(targetThirtyTwoPath) : "";
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
check("proposal_thirty-two_exists", existsSync(resolve(proposalThirtyTwoPath)));
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2732-2768-controlled-thirty-two-tool-mutation"] === "node tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs --plan docs/phase2732-2768-controlled-thirty-two-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2732-2768-controlled-thirty-two-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2742ThirtyTwoMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2743ThirtyTwoMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2744ThirtyTwoMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2745ThirtyTwoMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2746ThirtyTwoMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2747ThirtyTwoMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2748ThirtyTwoMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2749ThirtyTwoMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2750ThirtyTwoMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2751ThirtyTwoMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2752ThirtyTwoMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2753ThirtyTwoMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2754ThirtyTwoMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2755ThirtyTwoMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2756ThirtyTwoMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2757ThirtyTwoMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2758ThirtyTwoMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2759ThirtyTwoMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2760ThirtyTwoMutationTargetTwentyFourStatus())))\" && node -e \"import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2761ThirtyTwoMutationTargetTwentyFiveStatus())))\" && node -e \"import('./tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2762ThirtyTwoMutationTargetTwentySixStatus())))\" && node -e \"import('./tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2763ThirtyTwoMutationTargetTwentySevenStatus())))\" && node -e \"import('./tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2764ThirtyTwoMutationTargetTwentyEightStatus())))\" && node -e \"import('./tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2765ThirtyTwoMutationTargetTwentyNineStatus())))\" && node -e \"import('./tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2766ThirtyTwoMutationTargetThirtyStatus())))\" && node -e \"import('./tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2767ThirtyTwoMutationTargetThirtyOneStatus())))\" && node -e \"import('./tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2768ThirtyTwoMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2732-2768-controlled-thirty-two-tool-mutation"] === "node tools/phase2732_2768/validate-controlled-thirty-two-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2731_sealed", phase2731.recommendedSealed === true && phase2731.thirtyOneMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2732-2768-controlled-thirty-two-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("thirty_two_mutation_applied", result.thirtyTwoMutationApplied === true);
  check("changed_file_count_thirty_two", result.changedFileCount === 32);
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
    && result.changedFiles.includes(targetThirtyTwoPath)
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localThirtyTwoSmokePassed === true);
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
  check("rollback_restore_thirty_two", rollback.rollbackAction === "restore-previous-content-thirty-two");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_thirty_two_entries", Array.isArray(rollback.files) && rollback.files.length === 32);
}

if (smoke) {
  check("smoke_phase2737Marker", smoke.phase2737Marker === "PHASE2737_THIRTY_TWO_TOOL_TARGET_ONE_OK");
  check("smoke_phase2738Marker", smoke.phase2738Marker === "PHASE2738_THIRTY_TWO_TOOL_TARGET_TWO_OK");
  check("smoke_phase2739Marker", smoke.phase2739Marker === "PHASE2739_THIRTY_TWO_TOOL_TARGET_THREE_OK");
  check("smoke_phase2740Marker", smoke.phase2740Marker === "PHASE2740_THIRTY_TWO_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2741Marker", smoke.phase2741Marker === "PHASE2741_THIRTY_TWO_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2742Marker", smoke.phase2742Marker === "PHASE2742_THIRTY_TWO_TOOL_TARGET_SIX_OK");
  check("smoke_phase2743Marker", smoke.phase2743Marker === "PHASE2743_THIRTY_TWO_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2744Marker", smoke.phase2744Marker === "PHASE2744_THIRTY_TWO_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2745Marker", smoke.phase2745Marker === "PHASE2745_THIRTY_TWO_TOOL_TARGET_NINE_OK");
  check("smoke_phase2746Marker", smoke.phase2746Marker === "PHASE2746_THIRTY_TWO_TOOL_TARGET_TEN_OK");
  check("smoke_phase2747Marker", smoke.phase2747Marker === "PHASE2747_THIRTY_TWO_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2748Marker", smoke.phase2748Marker === "PHASE2748_THIRTY_TWO_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2749Marker", smoke.phase2749Marker === "PHASE2749_THIRTY_TWO_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2750Marker", smoke.phase2750Marker === "PHASE2750_THIRTY_TWO_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2751Marker", smoke.phase2751Marker === "PHASE2751_THIRTY_TWO_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2752Marker", smoke.phase2752Marker === "PHASE2752_THIRTY_TWO_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase2753Marker", smoke.phase2753Marker === "PHASE2753_THIRTY_TWO_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase2754Marker", smoke.phase2754Marker === "PHASE2754_THIRTY_TWO_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase2755Marker", smoke.phase2755Marker === "PHASE2755_THIRTY_TWO_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase2756Marker", smoke.phase2756Marker === "PHASE2756_THIRTY_TWO_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase2757Marker", smoke.phase2757Marker === "PHASE2757_THIRTY_TWO_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase2758Marker", smoke.phase2758Marker === "PHASE2758_THIRTY_TWO_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase2759Marker", smoke.phase2759Marker === "PHASE2759_THIRTY_TWO_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase2760Marker", smoke.phase2760Marker === "PHASE2760_THIRTY_TWO_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase2761Marker", smoke.phase2761Marker === "PHASE2761_THIRTY_TWO_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase2762Marker", smoke.phase2762Marker === "PHASE2762_THIRTY_TWO_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase2763Marker", smoke.phase2763Marker === "PHASE2763_THIRTY_TWO_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase2764Marker", smoke.phase2764Marker === "PHASE2764_THIRTY_TWO_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase2765Marker", smoke.phase2765Marker === "PHASE2765_THIRTY_TWO_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase2766Marker", smoke.phase2766Marker === "PHASE2766_THIRTY_TWO_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase2767Marker", smoke.phase2767Marker === "PHASE2767_THIRTY_TWO_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase2768Marker", smoke.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2737ThirtyTwoMutationTargetOneStatus") || targetOne.includes("export function buildPhase2737ThirtyTwoMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2737_THIRTY_TWO_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2738ThirtyTwoMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2738ThirtyTwoMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2738_THIRTY_TWO_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2739ThirtyTwoMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2739ThirtyTwoMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2739_THIRTY_TWO_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2740ThirtyTwoMutationTargetFourStatus") || targetFour.includes("export function buildPhase2740ThirtyTwoMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2740_THIRTY_TWO_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2741ThirtyTwoMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2741ThirtyTwoMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2741_THIRTY_TWO_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2742ThirtyTwoMutationTargetSixStatus") || targetSix.includes("export function buildPhase2742ThirtyTwoMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2742_THIRTY_TWO_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2743ThirtyTwoMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2743ThirtyTwoMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2743_THIRTY_TWO_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2744ThirtyTwoMutationTargetEightStatus") || targetEight.includes("export function buildPhase2744ThirtyTwoMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2744_THIRTY_TWO_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2745ThirtyTwoMutationTargetNineStatus") || targetNine.includes("export function buildPhase2745ThirtyTwoMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2745_THIRTY_TWO_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2746ThirtyTwoMutationTargetTenStatus") || targetTen.includes("export function buildPhase2746ThirtyTwoMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2746_THIRTY_TWO_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2747ThirtyTwoMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2747ThirtyTwoMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2747_THIRTY_TWO_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2748ThirtyTwoMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2748ThirtyTwoMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2748_THIRTY_TWO_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2749ThirtyTwoMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2749ThirtyTwoMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2749_THIRTY_TWO_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2750ThirtyTwoMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2750ThirtyTwoMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2750_THIRTY_TWO_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2751ThirtyTwoMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2751ThirtyTwoMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2751_THIRTY_TWO_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2752ThirtyTwoMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase2752ThirtyTwoMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2752_THIRTY_TWO_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase2753ThirtyTwoMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase2753ThirtyTwoMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE2753_THIRTY_TWO_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase2754ThirtyTwoMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase2754ThirtyTwoMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE2754_THIRTY_TWO_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase2755ThirtyTwoMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase2755ThirtyTwoMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE2755_THIRTY_TWO_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase2756ThirtyTwoMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase2756ThirtyTwoMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE2756_THIRTY_TWO_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase2757ThirtyTwoMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase2757ThirtyTwoMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE2757_THIRTY_TWO_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase2758ThirtyTwoMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase2758ThirtyTwoMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE2758_THIRTY_TWO_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase2759ThirtyTwoMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase2759ThirtyTwoMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE2759_THIRTY_TWO_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase2760ThirtyTwoMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase2760ThirtyTwoMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE2760_THIRTY_TWO_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase2761ThirtyTwoMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase2761ThirtyTwoMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE2761_THIRTY_TWO_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase2762ThirtyTwoMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase2762ThirtyTwoMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE2762_THIRTY_TWO_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase2763ThirtyTwoMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase2763ThirtyTwoMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE2763_THIRTY_TWO_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase2764ThirtyTwoMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase2764ThirtyTwoMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE2764_THIRTY_TWO_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase2765ThirtyTwoMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase2765ThirtyTwoMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE2765_THIRTY_TWO_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase2766ThirtyTwoMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase2766ThirtyTwoMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE2766_THIRTY_TWO_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase2767ThirtyTwoMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase2767ThirtyTwoMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE2767_THIRTY_TWO_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase2768ThirtyTwoMutationRuntimeStatus") || targetThirtyTwo.includes("export function buildPhase2768ThirtyTwoMutationRuntimeStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_thirty_two", docs.includes("controlled thirty-two tool mutation"));
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
  phase2731Sealed: phase2731.recommendedSealed === true,
  thirtyTwoMutationReady: completed,
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
    targetThirtyTwoPath,
  ],
  changedFileCount: result?.changedFileCount ?? 32,
  thirtyTwoMutationApplied: result?.thirtyTwoMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localThirtyTwoSmokePassed: result?.localThirtyTwoSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, thirtyTwoMutationApplied: verifierResult.thirtyTwoMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localThirtyTwoSmokePassed: verifierResult.localThirtyTwoSmokePassed }, null, 2));
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
    "# Phase2732A-2768A Controlled Thirty-Two Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- thirtyTwoMutationApplied: ${Boolean(result.thirtyTwoMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localThirtyTwoSmokePassed: ${Boolean(result.localThirtyTwoSmokePassed)}`,
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
