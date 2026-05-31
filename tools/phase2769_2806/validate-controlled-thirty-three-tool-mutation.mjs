import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2769A-2806A-Controlled-Thirty-Three-Tool-Mutation";
const runnerPath = "tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2769-2806-controlled-thirty-three-tool-mutation.md";
const approvalPath = "docs/phase2769-2806-controlled-thirty-three-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2774-thirty-three-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2775-thirty-three-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2776-thirty-three-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2777-thirty-three-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2778-thirty-three-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2779-thirty-three-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2780-thirty-three-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2781-thirty-three-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2782-thirty-three-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2783-thirty-three-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2784-thirty-three-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2785-thirty-three-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2786-thirty-three-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2787-thirty-three-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2788-thirty-three-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2789-thirty-three-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase2790-thirty-three-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase2791-thirty-three-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase2792-thirty-three-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase2793-thirty-three-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase2794-thirty-three-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase2795-thirty-three-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase2796-thirty-three-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase2797-thirty-three-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase2798-thirty-three-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase2799-thirty-three-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase2800-thirty-three-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase2801-thirty-three-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase2802-thirty-three-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase2803-thirty-three-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase2804-thirty-three-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase2805-thirty-three-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase2806-thirty-three-tool-mutation-target-thirty-three.proposal.diff";
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
const targetThirtyThreePath = "tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2769-2806-controlled-thirty-three-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2769-2806-controlled-thirty-three-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2769-2806-controlled-thirty-three-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2769-2806-controlled-thirty-three-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2769-2806-controlled-thirty-three-tool-mutation/thirty-three-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2768 = readJson("apps/ai-gateway-service/evidence/phase2732-2768-controlled-thirty-two-tool-mutation/result.json") || {};
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
const targetThirtyThree = existsSync(resolve(targetThirtyThreePath)) ? readText(targetThirtyThreePath) : "";
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
check("proposal_thirty-three_exists", existsSync(resolve(proposalThirtyThreePath)));
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2769-2806-controlled-thirty-three-tool-mutation"] === "node tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs --plan docs/phase2769-2806-controlled-thirty-three-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2769-2806-controlled-thirty-three-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2779ThirtyThreeMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2780ThirtyThreeMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2781ThirtyThreeMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2782ThirtyThreeMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2783ThirtyThreeMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2784ThirtyThreeMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2785ThirtyThreeMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2786ThirtyThreeMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2787ThirtyThreeMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2788ThirtyThreeMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2789ThirtyThreeMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2790ThirtyThreeMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2791ThirtyThreeMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2792ThirtyThreeMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2793ThirtyThreeMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2794ThirtyThreeMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2795ThirtyThreeMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2796ThirtyThreeMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2797ThirtyThreeMutationTargetTwentyFourStatus())))\" && node -e \"import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2798ThirtyThreeMutationTargetTwentyFiveStatus())))\" && node -e \"import('./tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2799ThirtyThreeMutationTargetTwentySixStatus())))\" && node -e \"import('./tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2800ThirtyThreeMutationTargetTwentySevenStatus())))\" && node -e \"import('./tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2801ThirtyThreeMutationTargetTwentyEightStatus())))\" && node -e \"import('./tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2802ThirtyThreeMutationTargetTwentyNineStatus())))\" && node -e \"import('./tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2803ThirtyThreeMutationTargetThirtyStatus())))\" && node -e \"import('./tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2804ThirtyThreeMutationTargetThirtyOneStatus())))\" && node -e \"import('./tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2805ThirtyThreeMutationTargetThirtyTwoStatus())))\" && node -e \"import('./tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2806ThirtyThreeMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2769-2806-controlled-thirty-three-tool-mutation"] === "node tools/phase2769_2806/validate-controlled-thirty-three-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2768_sealed", phase2768.recommendedSealed === true && phase2768.thirtyTwoMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2769-2806-controlled-thirty-three-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("thirty_three_mutation_applied", result.thirtyThreeMutationApplied === true);
  check("changed_file_count_thirty_three", result.changedFileCount === 33);
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
    && result.changedFiles.includes(targetThirtyThreePath)
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localThirtyThreeSmokePassed === true);
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
  check("rollback_restore_thirty_three", rollback.rollbackAction === "restore-previous-content-thirty-three");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_thirty_three_entries", Array.isArray(rollback.files) && rollback.files.length === 33);
}

if (smoke) {
  check("smoke_phase2774Marker", smoke.phase2774Marker === "PHASE2774_THIRTY_THREE_TOOL_TARGET_ONE_OK");
  check("smoke_phase2775Marker", smoke.phase2775Marker === "PHASE2775_THIRTY_THREE_TOOL_TARGET_TWO_OK");
  check("smoke_phase2776Marker", smoke.phase2776Marker === "PHASE2776_THIRTY_THREE_TOOL_TARGET_THREE_OK");
  check("smoke_phase2777Marker", smoke.phase2777Marker === "PHASE2777_THIRTY_THREE_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2778Marker", smoke.phase2778Marker === "PHASE2778_THIRTY_THREE_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2779Marker", smoke.phase2779Marker === "PHASE2779_THIRTY_THREE_TOOL_TARGET_SIX_OK");
  check("smoke_phase2780Marker", smoke.phase2780Marker === "PHASE2780_THIRTY_THREE_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2781Marker", smoke.phase2781Marker === "PHASE2781_THIRTY_THREE_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2782Marker", smoke.phase2782Marker === "PHASE2782_THIRTY_THREE_TOOL_TARGET_NINE_OK");
  check("smoke_phase2783Marker", smoke.phase2783Marker === "PHASE2783_THIRTY_THREE_TOOL_TARGET_TEN_OK");
  check("smoke_phase2784Marker", smoke.phase2784Marker === "PHASE2784_THIRTY_THREE_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2785Marker", smoke.phase2785Marker === "PHASE2785_THIRTY_THREE_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2786Marker", smoke.phase2786Marker === "PHASE2786_THIRTY_THREE_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2787Marker", smoke.phase2787Marker === "PHASE2787_THIRTY_THREE_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2788Marker", smoke.phase2788Marker === "PHASE2788_THIRTY_THREE_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2789Marker", smoke.phase2789Marker === "PHASE2789_THIRTY_THREE_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase2790Marker", smoke.phase2790Marker === "PHASE2790_THIRTY_THREE_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase2791Marker", smoke.phase2791Marker === "PHASE2791_THIRTY_THREE_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase2792Marker", smoke.phase2792Marker === "PHASE2792_THIRTY_THREE_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase2793Marker", smoke.phase2793Marker === "PHASE2793_THIRTY_THREE_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase2794Marker", smoke.phase2794Marker === "PHASE2794_THIRTY_THREE_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase2795Marker", smoke.phase2795Marker === "PHASE2795_THIRTY_THREE_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase2796Marker", smoke.phase2796Marker === "PHASE2796_THIRTY_THREE_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase2797Marker", smoke.phase2797Marker === "PHASE2797_THIRTY_THREE_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase2798Marker", smoke.phase2798Marker === "PHASE2798_THIRTY_THREE_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase2799Marker", smoke.phase2799Marker === "PHASE2799_THIRTY_THREE_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase2800Marker", smoke.phase2800Marker === "PHASE2800_THIRTY_THREE_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase2801Marker", smoke.phase2801Marker === "PHASE2801_THIRTY_THREE_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase2802Marker", smoke.phase2802Marker === "PHASE2802_THIRTY_THREE_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase2803Marker", smoke.phase2803Marker === "PHASE2803_THIRTY_THREE_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase2804Marker", smoke.phase2804Marker === "PHASE2804_THIRTY_THREE_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase2805Marker", smoke.phase2805Marker === "PHASE2805_THIRTY_THREE_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase2806Marker", smoke.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2774ThirtyThreeMutationTargetOneStatus") || targetOne.includes("export function buildPhase2774ThirtyThreeMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2774_THIRTY_THREE_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2775ThirtyThreeMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2775ThirtyThreeMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2775_THIRTY_THREE_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2776ThirtyThreeMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2776ThirtyThreeMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2776_THIRTY_THREE_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2777ThirtyThreeMutationTargetFourStatus") || targetFour.includes("export function buildPhase2777ThirtyThreeMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2777_THIRTY_THREE_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2778ThirtyThreeMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2778ThirtyThreeMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2778_THIRTY_THREE_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2779ThirtyThreeMutationTargetSixStatus") || targetSix.includes("export function buildPhase2779ThirtyThreeMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2779_THIRTY_THREE_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2780ThirtyThreeMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2780ThirtyThreeMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2780_THIRTY_THREE_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2781ThirtyThreeMutationTargetEightStatus") || targetEight.includes("export function buildPhase2781ThirtyThreeMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2781_THIRTY_THREE_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2782ThirtyThreeMutationTargetNineStatus") || targetNine.includes("export function buildPhase2782ThirtyThreeMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2782_THIRTY_THREE_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2783ThirtyThreeMutationTargetTenStatus") || targetTen.includes("export function buildPhase2783ThirtyThreeMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2783_THIRTY_THREE_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2784ThirtyThreeMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2784ThirtyThreeMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2784_THIRTY_THREE_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2785ThirtyThreeMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2785ThirtyThreeMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2785_THIRTY_THREE_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2786ThirtyThreeMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2786ThirtyThreeMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2786_THIRTY_THREE_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2787ThirtyThreeMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2787ThirtyThreeMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2787_THIRTY_THREE_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2788ThirtyThreeMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2788ThirtyThreeMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2788_THIRTY_THREE_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2789ThirtyThreeMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase2789ThirtyThreeMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2789_THIRTY_THREE_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase2790ThirtyThreeMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase2790ThirtyThreeMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE2790_THIRTY_THREE_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase2791ThirtyThreeMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase2791ThirtyThreeMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE2791_THIRTY_THREE_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase2792ThirtyThreeMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase2792ThirtyThreeMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE2792_THIRTY_THREE_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase2793ThirtyThreeMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase2793ThirtyThreeMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE2793_THIRTY_THREE_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase2794ThirtyThreeMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase2794ThirtyThreeMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE2794_THIRTY_THREE_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase2795ThirtyThreeMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase2795ThirtyThreeMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE2795_THIRTY_THREE_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase2796ThirtyThreeMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase2796ThirtyThreeMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE2796_THIRTY_THREE_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase2797ThirtyThreeMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase2797ThirtyThreeMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE2797_THIRTY_THREE_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase2798ThirtyThreeMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase2798ThirtyThreeMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE2798_THIRTY_THREE_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase2799ThirtyThreeMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase2799ThirtyThreeMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE2799_THIRTY_THREE_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase2800ThirtyThreeMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase2800ThirtyThreeMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE2800_THIRTY_THREE_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase2801ThirtyThreeMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase2801ThirtyThreeMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE2801_THIRTY_THREE_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase2802ThirtyThreeMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase2802ThirtyThreeMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE2802_THIRTY_THREE_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase2803ThirtyThreeMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase2803ThirtyThreeMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE2803_THIRTY_THREE_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase2804ThirtyThreeMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase2804ThirtyThreeMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE2804_THIRTY_THREE_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase2805ThirtyThreeMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase2805ThirtyThreeMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE2805_THIRTY_THREE_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase2806ThirtyThreeMutationRuntimeStatus") || targetThirtyThree.includes("export function buildPhase2806ThirtyThreeMutationRuntimeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_thirty_three", docs.includes("controlled thirty-three tool mutation"));
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
  phase2768Sealed: phase2768.recommendedSealed === true,
  thirtyThreeMutationReady: completed,
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
    targetThirtyThreePath,
  ],
  changedFileCount: result?.changedFileCount ?? 33,
  thirtyThreeMutationApplied: result?.thirtyThreeMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localThirtyThreeSmokePassed: result?.localThirtyThreeSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, thirtyThreeMutationApplied: verifierResult.thirtyThreeMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localThirtyThreeSmokePassed: verifierResult.localThirtyThreeSmokePassed }, null, 2));
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
    "# Phase2769A-2806A Controlled Thirty-Three Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- thirtyThreeMutationApplied: ${Boolean(result.thirtyThreeMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localThirtyThreeSmokePassed: ${Boolean(result.localThirtyThreeSmokePassed)}`,
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
