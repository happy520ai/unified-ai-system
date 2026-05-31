import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2846A-2885A-Controlled-Thirty-Five-Tool-Mutation";
const runnerPath = "tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2846-2885-controlled-thirty-five-tool-mutation.md";
const approvalPath = "docs/phase2846-2885-controlled-thirty-five-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2851-thirty-five-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2852-thirty-five-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2853-thirty-five-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2854-thirty-five-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2855-thirty-five-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2856-thirty-five-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2857-thirty-five-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2858-thirty-five-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2859-thirty-five-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2860-thirty-five-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2861-thirty-five-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2862-thirty-five-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2863-thirty-five-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2864-thirty-five-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2865-thirty-five-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2866-thirty-five-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase2867-thirty-five-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase2868-thirty-five-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase2869-thirty-five-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase2870-thirty-five-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase2871-thirty-five-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase2872-thirty-five-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase2873-thirty-five-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase2874-thirty-five-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase2875-thirty-five-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase2876-thirty-five-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase2877-thirty-five-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase2878-thirty-five-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase2879-thirty-five-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase2880-thirty-five-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase2881-thirty-five-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase2882-thirty-five-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase2883-thirty-five-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase2884-thirty-five-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase2885-thirty-five-tool-mutation-target-thirty-five.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase2846-2885-controlled-thirty-five-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2846-2885-controlled-thirty-five-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2846-2885-controlled-thirty-five-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2846-2885-controlled-thirty-five-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2846-2885-controlled-thirty-five-tool-mutation/thirty-five-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2845 = readJson("apps/ai-gateway-service/evidence/phase2807-2845-controlled-thirty-four-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2846-2885-controlled-thirty-five-tool-mutation"] === "node tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs --plan docs/phase2846-2885-controlled-thirty-five-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2846-2885-controlled-thirty-five-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2856ThirtyFiveMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2857ThirtyFiveMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2858ThirtyFiveMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2859ThirtyFiveMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2860ThirtyFiveMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2861ThirtyFiveMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2862ThirtyFiveMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2863ThirtyFiveMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2864ThirtyFiveMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2865ThirtyFiveMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2866ThirtyFiveMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2867ThirtyFiveMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2868ThirtyFiveMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2869ThirtyFiveMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2870ThirtyFiveMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2871ThirtyFiveMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2872ThirtyFiveMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2873ThirtyFiveMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2874ThirtyFiveMutationTargetTwentyFourStatus())))\" && node -e \"import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2875ThirtyFiveMutationTargetTwentyFiveStatus())))\" && node -e \"import('./tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2876ThirtyFiveMutationTargetTwentySixStatus())))\" && node -e \"import('./tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2877ThirtyFiveMutationTargetTwentySevenStatus())))\" && node -e \"import('./tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2878ThirtyFiveMutationTargetTwentyEightStatus())))\" && node -e \"import('./tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2879ThirtyFiveMutationTargetTwentyNineStatus())))\" && node -e \"import('./tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2880ThirtyFiveMutationTargetThirtyStatus())))\" && node -e \"import('./tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2881ThirtyFiveMutationTargetThirtyOneStatus())))\" && node -e \"import('./tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2882ThirtyFiveMutationTargetThirtyTwoStatus())))\" && node -e \"import('./tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2883ThirtyFiveMutationTargetThirtyThreeStatus())))\" && node -e \"import('./tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2884ThirtyFiveMutationTargetThirtyFourStatus())))\" && node -e \"import('./tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2885ThirtyFiveMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2846-2885-controlled-thirty-five-tool-mutation"] === "node tools/phase2846_2885/validate-controlled-thirty-five-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2845_sealed", phase2845.recommendedSealed === true && phase2845.thirtyFourMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2846-2885-controlled-thirty-five-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("thirty_five_mutation_applied", result.thirtyFiveMutationApplied === true);
  check("changed_file_count_thirty_five", result.changedFileCount === 35);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localThirtyFiveSmokePassed === true);
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
  check("rollback_restore_thirty_five", rollback.rollbackAction === "restore-previous-content-thirty-five");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_thirty_five_entries", Array.isArray(rollback.files) && rollback.files.length === 35);
}

if (smoke) {
  check("smoke_phase2851Marker", smoke.phase2851Marker === "PHASE2851_THIRTY_FIVE_TOOL_TARGET_ONE_OK");
  check("smoke_phase2852Marker", smoke.phase2852Marker === "PHASE2852_THIRTY_FIVE_TOOL_TARGET_TWO_OK");
  check("smoke_phase2853Marker", smoke.phase2853Marker === "PHASE2853_THIRTY_FIVE_TOOL_TARGET_THREE_OK");
  check("smoke_phase2854Marker", smoke.phase2854Marker === "PHASE2854_THIRTY_FIVE_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2855Marker", smoke.phase2855Marker === "PHASE2855_THIRTY_FIVE_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2856Marker", smoke.phase2856Marker === "PHASE2856_THIRTY_FIVE_TOOL_TARGET_SIX_OK");
  check("smoke_phase2857Marker", smoke.phase2857Marker === "PHASE2857_THIRTY_FIVE_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2858Marker", smoke.phase2858Marker === "PHASE2858_THIRTY_FIVE_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2859Marker", smoke.phase2859Marker === "PHASE2859_THIRTY_FIVE_TOOL_TARGET_NINE_OK");
  check("smoke_phase2860Marker", smoke.phase2860Marker === "PHASE2860_THIRTY_FIVE_TOOL_TARGET_TEN_OK");
  check("smoke_phase2861Marker", smoke.phase2861Marker === "PHASE2861_THIRTY_FIVE_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2862Marker", smoke.phase2862Marker === "PHASE2862_THIRTY_FIVE_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2863Marker", smoke.phase2863Marker === "PHASE2863_THIRTY_FIVE_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2864Marker", smoke.phase2864Marker === "PHASE2864_THIRTY_FIVE_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2865Marker", smoke.phase2865Marker === "PHASE2865_THIRTY_FIVE_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2866Marker", smoke.phase2866Marker === "PHASE2866_THIRTY_FIVE_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase2867Marker", smoke.phase2867Marker === "PHASE2867_THIRTY_FIVE_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase2868Marker", smoke.phase2868Marker === "PHASE2868_THIRTY_FIVE_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase2869Marker", smoke.phase2869Marker === "PHASE2869_THIRTY_FIVE_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase2870Marker", smoke.phase2870Marker === "PHASE2870_THIRTY_FIVE_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase2871Marker", smoke.phase2871Marker === "PHASE2871_THIRTY_FIVE_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase2872Marker", smoke.phase2872Marker === "PHASE2872_THIRTY_FIVE_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase2873Marker", smoke.phase2873Marker === "PHASE2873_THIRTY_FIVE_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase2874Marker", smoke.phase2874Marker === "PHASE2874_THIRTY_FIVE_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase2875Marker", smoke.phase2875Marker === "PHASE2875_THIRTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase2876Marker", smoke.phase2876Marker === "PHASE2876_THIRTY_FIVE_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase2877Marker", smoke.phase2877Marker === "PHASE2877_THIRTY_FIVE_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase2878Marker", smoke.phase2878Marker === "PHASE2878_THIRTY_FIVE_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase2879Marker", smoke.phase2879Marker === "PHASE2879_THIRTY_FIVE_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase2880Marker", smoke.phase2880Marker === "PHASE2880_THIRTY_FIVE_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase2881Marker", smoke.phase2881Marker === "PHASE2881_THIRTY_FIVE_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase2882Marker", smoke.phase2882Marker === "PHASE2882_THIRTY_FIVE_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase2883Marker", smoke.phase2883Marker === "PHASE2883_THIRTY_FIVE_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase2884Marker", smoke.phase2884Marker === "PHASE2884_THIRTY_FIVE_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase2885Marker", smoke.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2851ThirtyFiveMutationTargetOneStatus") || targetOne.includes("export function buildPhase2851ThirtyFiveMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2851_THIRTY_FIVE_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2852ThirtyFiveMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2852ThirtyFiveMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2852_THIRTY_FIVE_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2853ThirtyFiveMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2853ThirtyFiveMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2853_THIRTY_FIVE_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2854ThirtyFiveMutationTargetFourStatus") || targetFour.includes("export function buildPhase2854ThirtyFiveMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2854_THIRTY_FIVE_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2855ThirtyFiveMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2855ThirtyFiveMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2855_THIRTY_FIVE_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2856ThirtyFiveMutationTargetSixStatus") || targetSix.includes("export function buildPhase2856ThirtyFiveMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2856_THIRTY_FIVE_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2857ThirtyFiveMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2857ThirtyFiveMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2857_THIRTY_FIVE_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2858ThirtyFiveMutationTargetEightStatus") || targetEight.includes("export function buildPhase2858ThirtyFiveMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2858_THIRTY_FIVE_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2859ThirtyFiveMutationTargetNineStatus") || targetNine.includes("export function buildPhase2859ThirtyFiveMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2859_THIRTY_FIVE_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2860ThirtyFiveMutationTargetTenStatus") || targetTen.includes("export function buildPhase2860ThirtyFiveMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2860_THIRTY_FIVE_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2861ThirtyFiveMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2861ThirtyFiveMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2861_THIRTY_FIVE_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2862ThirtyFiveMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2862ThirtyFiveMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2862_THIRTY_FIVE_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2863ThirtyFiveMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2863ThirtyFiveMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2863_THIRTY_FIVE_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2864ThirtyFiveMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2864ThirtyFiveMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2864_THIRTY_FIVE_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2865ThirtyFiveMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2865ThirtyFiveMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2865_THIRTY_FIVE_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2866ThirtyFiveMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase2866ThirtyFiveMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2866_THIRTY_FIVE_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase2867ThirtyFiveMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase2867ThirtyFiveMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE2867_THIRTY_FIVE_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase2868ThirtyFiveMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase2868ThirtyFiveMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE2868_THIRTY_FIVE_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase2869ThirtyFiveMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase2869ThirtyFiveMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE2869_THIRTY_FIVE_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase2870ThirtyFiveMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase2870ThirtyFiveMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE2870_THIRTY_FIVE_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase2871ThirtyFiveMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase2871ThirtyFiveMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE2871_THIRTY_FIVE_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase2872ThirtyFiveMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase2872ThirtyFiveMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE2872_THIRTY_FIVE_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase2873ThirtyFiveMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase2873ThirtyFiveMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE2873_THIRTY_FIVE_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase2874ThirtyFiveMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase2874ThirtyFiveMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE2874_THIRTY_FIVE_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase2875ThirtyFiveMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase2875ThirtyFiveMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE2875_THIRTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase2876ThirtyFiveMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase2876ThirtyFiveMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE2876_THIRTY_FIVE_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase2877ThirtyFiveMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase2877ThirtyFiveMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE2877_THIRTY_FIVE_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase2878ThirtyFiveMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase2878ThirtyFiveMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE2878_THIRTY_FIVE_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase2879ThirtyFiveMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase2879ThirtyFiveMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE2879_THIRTY_FIVE_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase2880ThirtyFiveMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase2880ThirtyFiveMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE2880_THIRTY_FIVE_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase2881ThirtyFiveMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase2881ThirtyFiveMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE2881_THIRTY_FIVE_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase2882ThirtyFiveMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase2882ThirtyFiveMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE2882_THIRTY_FIVE_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase2883ThirtyFiveMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase2883ThirtyFiveMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE2883_THIRTY_FIVE_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase2884ThirtyFiveMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase2884ThirtyFiveMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE2884_THIRTY_FIVE_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase2885ThirtyFiveMutationRuntimeStatus") || targetThirtyFive.includes("export function buildPhase2885ThirtyFiveMutationRuntimeStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_thirty_five", docs.includes("controlled thirty-five tool mutation"));
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
  phase2845Sealed: phase2845.recommendedSealed === true,
  thirtyFiveMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 35,
  thirtyFiveMutationApplied: result?.thirtyFiveMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localThirtyFiveSmokePassed: result?.localThirtyFiveSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, thirtyFiveMutationApplied: verifierResult.thirtyFiveMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localThirtyFiveSmokePassed: verifierResult.localThirtyFiveSmokePassed }, null, 2));
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
    "# Phase2846A-2885A Controlled Thirty-Five Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- thirtyFiveMutationApplied: ${Boolean(result.thirtyFiveMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localThirtyFiveSmokePassed: ${Boolean(result.localThirtyFiveSmokePassed)}`,
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
