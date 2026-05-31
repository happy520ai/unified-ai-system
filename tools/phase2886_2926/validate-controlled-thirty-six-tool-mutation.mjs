import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2886A-2926A-Controlled-Thirty-Six-Tool-Mutation";
const runnerPath = "tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2886-2926-controlled-thirty-six-tool-mutation.md";
const approvalPath = "docs/phase2886-2926-controlled-thirty-six-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2891-thirty-six-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2892-thirty-six-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2893-thirty-six-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2894-thirty-six-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2895-thirty-six-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2896-thirty-six-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2897-thirty-six-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2898-thirty-six-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2899-thirty-six-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2900-thirty-six-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2901-thirty-six-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2902-thirty-six-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2903-thirty-six-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2904-thirty-six-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2905-thirty-six-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2906-thirty-six-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase2907-thirty-six-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase2908-thirty-six-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase2909-thirty-six-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase2910-thirty-six-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase2911-thirty-six-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase2912-thirty-six-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase2913-thirty-six-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase2914-thirty-six-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase2915-thirty-six-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase2916-thirty-six-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase2917-thirty-six-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase2918-thirty-six-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase2919-thirty-six-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase2920-thirty-six-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase2921-thirty-six-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase2922-thirty-six-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase2923-thirty-six-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase2924-thirty-six-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase2925-thirty-six-tool-mutation-target-thirty-five.proposal.diff";
const proposalThirtySixPath = "docs/phase2926-thirty-six-tool-mutation-target-thirty-six.proposal.diff";
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
const targetThirtyFourPath = "tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs";
const targetThirtyFivePath = "tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs";
const targetThirtySixPath = "tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2886-2926-controlled-thirty-six-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2886-2926-controlled-thirty-six-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2886-2926-controlled-thirty-six-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2886-2926-controlled-thirty-six-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2886-2926-controlled-thirty-six-tool-mutation/thirty-six-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2885 = readJson("apps/ai-gateway-service/evidence/phase2846-2885-controlled-thirty-five-tool-mutation/result.json") || {};
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
const targetThirtyFour = existsSync(resolve(targetThirtyFourPath)) ? readText(targetThirtyFourPath) : "";
const targetThirtyFive = existsSync(resolve(targetThirtyFivePath)) ? readText(targetThirtyFivePath) : "";
const targetThirtySix = existsSync(resolve(targetThirtySixPath)) ? readText(targetThirtySixPath) : "";
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
check("proposal_thirty-four_exists", existsSync(resolve(proposalThirtyFourPath)));
check("proposal_thirty-five_exists", existsSync(resolve(proposalThirtyFivePath)));
check("proposal_thirty-six_exists", existsSync(resolve(proposalThirtySixPath)));
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2886-2926-controlled-thirty-six-tool-mutation"] === "node tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs --plan docs/phase2886-2926-controlled-thirty-six-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2886-2926-controlled-thirty-six-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2896ThirtySixMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2897ThirtySixMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2898ThirtySixMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2899ThirtySixMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2900ThirtySixMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2901ThirtySixMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2902ThirtySixMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2903ThirtySixMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2904ThirtySixMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2905ThirtySixMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2906ThirtySixMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2907ThirtySixMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2908ThirtySixMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2909ThirtySixMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2910ThirtySixMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2911ThirtySixMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2912ThirtySixMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2913ThirtySixMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2914ThirtySixMutationTargetTwentyFourStatus())))\" && node -e \"import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2915ThirtySixMutationTargetTwentyFiveStatus())))\" && node -e \"import('./tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2916ThirtySixMutationTargetTwentySixStatus())))\" && node -e \"import('./tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2917ThirtySixMutationTargetTwentySevenStatus())))\" && node -e \"import('./tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2918ThirtySixMutationTargetTwentyEightStatus())))\" && node -e \"import('./tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2919ThirtySixMutationTargetTwentyNineStatus())))\" && node -e \"import('./tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2920ThirtySixMutationTargetThirtyStatus())))\" && node -e \"import('./tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2921ThirtySixMutationTargetThirtyOneStatus())))\" && node -e \"import('./tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2922ThirtySixMutationTargetThirtyTwoStatus())))\" && node -e \"import('./tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2923ThirtySixMutationTargetThirtyThreeStatus())))\" && node -e \"import('./tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2924ThirtySixMutationTargetThirtyFourStatus())))\" && node -e \"import('./tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2925ThirtySixMutationTargetThirtyFiveStatus())))\" && node -e \"import('./tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2926ThirtySixMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2886-2926-controlled-thirty-six-tool-mutation"] === "node tools/phase2886_2926/validate-controlled-thirty-six-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2885_sealed", phase2885.recommendedSealed === true && phase2885.thirtyFiveMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2886-2926-controlled-thirty-six-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("thirty_six_mutation_applied", result.thirtySixMutationApplied === true);
  check("changed_file_count_thirty_six", result.changedFileCount === 36);
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
    && result.changedFiles.includes(targetThirtyFourPath)
    && result.changedFiles.includes(targetThirtyFivePath)
    && result.changedFiles.includes(targetThirtySixPath)
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localThirtySixSmokePassed === true);
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
  check("rollback_restore_thirty_six", rollback.rollbackAction === "restore-previous-content-thirty-six");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_thirty_six_entries", Array.isArray(rollback.files) && rollback.files.length === 36);
}

if (smoke) {
  check("smoke_phase2891Marker", smoke.phase2891Marker === "PHASE2891_THIRTY_SIX_TOOL_TARGET_ONE_OK");
  check("smoke_phase2892Marker", smoke.phase2892Marker === "PHASE2892_THIRTY_SIX_TOOL_TARGET_TWO_OK");
  check("smoke_phase2893Marker", smoke.phase2893Marker === "PHASE2893_THIRTY_SIX_TOOL_TARGET_THREE_OK");
  check("smoke_phase2894Marker", smoke.phase2894Marker === "PHASE2894_THIRTY_SIX_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2895Marker", smoke.phase2895Marker === "PHASE2895_THIRTY_SIX_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2896Marker", smoke.phase2896Marker === "PHASE2896_THIRTY_SIX_TOOL_TARGET_SIX_OK");
  check("smoke_phase2897Marker", smoke.phase2897Marker === "PHASE2897_THIRTY_SIX_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2898Marker", smoke.phase2898Marker === "PHASE2898_THIRTY_SIX_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2899Marker", smoke.phase2899Marker === "PHASE2899_THIRTY_SIX_TOOL_TARGET_NINE_OK");
  check("smoke_phase2900Marker", smoke.phase2900Marker === "PHASE2900_THIRTY_SIX_TOOL_TARGET_TEN_OK");
  check("smoke_phase2901Marker", smoke.phase2901Marker === "PHASE2901_THIRTY_SIX_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2902Marker", smoke.phase2902Marker === "PHASE2902_THIRTY_SIX_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2903Marker", smoke.phase2903Marker === "PHASE2903_THIRTY_SIX_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2904Marker", smoke.phase2904Marker === "PHASE2904_THIRTY_SIX_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2905Marker", smoke.phase2905Marker === "PHASE2905_THIRTY_SIX_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2906Marker", smoke.phase2906Marker === "PHASE2906_THIRTY_SIX_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase2907Marker", smoke.phase2907Marker === "PHASE2907_THIRTY_SIX_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase2908Marker", smoke.phase2908Marker === "PHASE2908_THIRTY_SIX_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase2909Marker", smoke.phase2909Marker === "PHASE2909_THIRTY_SIX_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase2910Marker", smoke.phase2910Marker === "PHASE2910_THIRTY_SIX_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase2911Marker", smoke.phase2911Marker === "PHASE2911_THIRTY_SIX_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase2912Marker", smoke.phase2912Marker === "PHASE2912_THIRTY_SIX_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase2913Marker", smoke.phase2913Marker === "PHASE2913_THIRTY_SIX_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase2914Marker", smoke.phase2914Marker === "PHASE2914_THIRTY_SIX_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase2915Marker", smoke.phase2915Marker === "PHASE2915_THIRTY_SIX_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase2916Marker", smoke.phase2916Marker === "PHASE2916_THIRTY_SIX_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase2917Marker", smoke.phase2917Marker === "PHASE2917_THIRTY_SIX_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase2918Marker", smoke.phase2918Marker === "PHASE2918_THIRTY_SIX_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase2919Marker", smoke.phase2919Marker === "PHASE2919_THIRTY_SIX_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase2920Marker", smoke.phase2920Marker === "PHASE2920_THIRTY_SIX_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase2921Marker", smoke.phase2921Marker === "PHASE2921_THIRTY_SIX_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase2922Marker", smoke.phase2922Marker === "PHASE2922_THIRTY_SIX_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase2923Marker", smoke.phase2923Marker === "PHASE2923_THIRTY_SIX_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase2924Marker", smoke.phase2924Marker === "PHASE2924_THIRTY_SIX_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase2925Marker", smoke.phase2925Marker === "PHASE2925_THIRTY_SIX_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_phase2926Marker", smoke.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2891ThirtySixMutationTargetOneStatus") || targetOne.includes("export function buildPhase2891ThirtySixMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2891_THIRTY_SIX_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2892ThirtySixMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2892ThirtySixMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2892_THIRTY_SIX_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2893ThirtySixMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2893ThirtySixMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2893_THIRTY_SIX_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2894ThirtySixMutationTargetFourStatus") || targetFour.includes("export function buildPhase2894ThirtySixMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2894_THIRTY_SIX_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2895ThirtySixMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2895ThirtySixMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2895_THIRTY_SIX_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2896ThirtySixMutationTargetSixStatus") || targetSix.includes("export function buildPhase2896ThirtySixMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2896_THIRTY_SIX_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2897ThirtySixMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2897ThirtySixMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2897_THIRTY_SIX_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2898ThirtySixMutationTargetEightStatus") || targetEight.includes("export function buildPhase2898ThirtySixMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2898_THIRTY_SIX_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2899ThirtySixMutationTargetNineStatus") || targetNine.includes("export function buildPhase2899ThirtySixMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2899_THIRTY_SIX_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2900ThirtySixMutationTargetTenStatus") || targetTen.includes("export function buildPhase2900ThirtySixMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2900_THIRTY_SIX_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2901ThirtySixMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2901ThirtySixMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2901_THIRTY_SIX_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2902ThirtySixMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2902ThirtySixMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2902_THIRTY_SIX_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2903ThirtySixMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2903ThirtySixMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2903_THIRTY_SIX_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2904ThirtySixMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2904ThirtySixMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2904_THIRTY_SIX_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2905ThirtySixMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2905ThirtySixMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2905_THIRTY_SIX_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2906ThirtySixMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase2906ThirtySixMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2906_THIRTY_SIX_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase2907ThirtySixMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase2907ThirtySixMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE2907_THIRTY_SIX_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase2908ThirtySixMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase2908ThirtySixMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE2908_THIRTY_SIX_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase2909ThirtySixMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase2909ThirtySixMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE2909_THIRTY_SIX_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase2910ThirtySixMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase2910ThirtySixMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE2910_THIRTY_SIX_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase2911ThirtySixMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase2911ThirtySixMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE2911_THIRTY_SIX_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase2912ThirtySixMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase2912ThirtySixMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE2912_THIRTY_SIX_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase2913ThirtySixMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase2913ThirtySixMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE2913_THIRTY_SIX_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase2914ThirtySixMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase2914ThirtySixMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE2914_THIRTY_SIX_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase2915ThirtySixMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase2915ThirtySixMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE2915_THIRTY_SIX_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase2916ThirtySixMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase2916ThirtySixMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE2916_THIRTY_SIX_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase2917ThirtySixMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase2917ThirtySixMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE2917_THIRTY_SIX_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase2918ThirtySixMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase2918ThirtySixMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE2918_THIRTY_SIX_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase2919ThirtySixMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase2919ThirtySixMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE2919_THIRTY_SIX_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase2920ThirtySixMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase2920ThirtySixMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE2920_THIRTY_SIX_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase2921ThirtySixMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase2921ThirtySixMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE2921_THIRTY_SIX_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase2922ThirtySixMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase2922ThirtySixMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE2922_THIRTY_SIX_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase2923ThirtySixMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase2923ThirtySixMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE2923_THIRTY_SIX_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase2924ThirtySixMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase2924ThirtySixMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE2924_THIRTY_SIX_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase2925ThirtySixMutationTargetThirtyFiveStatus") || targetThirtyFive.includes("export function buildPhase2925ThirtySixMutationTargetThirtyFiveStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE2925_THIRTY_SIX_TOOL_TARGET_THIRTY_FIVE_OK"));
check("target-thirty-six_export", targetThirtySix.includes("buildPhase2926ThirtySixMutationRuntimeStatus") || targetThirtySix.includes("export function buildPhase2926ThirtySixMutationRuntimeStatus"));
check("target-thirty-six_marker", targetThirtySix.includes("PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_thirty_six", docs.includes("controlled thirty-six tool mutation"));
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
  phase2885Sealed: phase2885.recommendedSealed === true,
  thirtySixMutationReady: completed,
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
    targetThirtyFourPath,
    targetThirtyFivePath,
    targetThirtySixPath,
  ],
  changedFileCount: result?.changedFileCount ?? 36,
  thirtySixMutationApplied: result?.thirtySixMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localThirtySixSmokePassed: result?.localThirtySixSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, thirtySixMutationApplied: verifierResult.thirtySixMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localThirtySixSmokePassed: verifierResult.localThirtySixSmokePassed }, null, 2));
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
    "# Phase2886A-2926A Controlled Thirty-Six Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- thirtySixMutationApplied: ${Boolean(result.thirtySixMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localThirtySixSmokePassed: ${Boolean(result.localThirtySixSmokePassed)}`,
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
