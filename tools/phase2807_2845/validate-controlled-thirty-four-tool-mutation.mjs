import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2807A-2845A-Controlled-Thirty-Four-Tool-Mutation";
const runnerPath = "tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2807-2845-controlled-thirty-four-tool-mutation.md";
const approvalPath = "docs/phase2807-2845-controlled-thirty-four-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2812-thirty-four-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2813-thirty-four-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2814-thirty-four-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2815-thirty-four-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2816-thirty-four-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2817-thirty-four-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2818-thirty-four-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2819-thirty-four-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2820-thirty-four-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2821-thirty-four-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2822-thirty-four-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2823-thirty-four-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2824-thirty-four-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2825-thirty-four-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2826-thirty-four-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2827-thirty-four-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase2828-thirty-four-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase2829-thirty-four-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase2830-thirty-four-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase2831-thirty-four-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase2832-thirty-four-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase2833-thirty-four-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase2834-thirty-four-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase2835-thirty-four-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase2836-thirty-four-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase2837-thirty-four-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase2838-thirty-four-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase2839-thirty-four-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase2840-thirty-four-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase2841-thirty-four-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase2842-thirty-four-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase2843-thirty-four-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase2844-thirty-four-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase2845-thirty-four-tool-mutation-target-thirty-four.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase2807-2845-controlled-thirty-four-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2807-2845-controlled-thirty-four-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2807-2845-controlled-thirty-four-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2807-2845-controlled-thirty-four-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2807-2845-controlled-thirty-four-tool-mutation/thirty-four-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2806 = readJson("apps/ai-gateway-service/evidence/phase2769-2806-controlled-thirty-three-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2807-2845-controlled-thirty-four-tool-mutation"] === "node tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs --plan docs/phase2807-2845-controlled-thirty-four-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2807-2845-controlled-thirty-four-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2817ThirtyFourMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2818ThirtyFourMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2819ThirtyFourMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2820ThirtyFourMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2821ThirtyFourMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2822ThirtyFourMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2823ThirtyFourMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2824ThirtyFourMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2825ThirtyFourMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2826ThirtyFourMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2827ThirtyFourMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2828ThirtyFourMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2829ThirtyFourMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2830ThirtyFourMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2831ThirtyFourMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2832ThirtyFourMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2833ThirtyFourMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2834ThirtyFourMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2835ThirtyFourMutationTargetTwentyFourStatus())))\" && node -e \"import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2836ThirtyFourMutationTargetTwentyFiveStatus())))\" && node -e \"import('./tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2837ThirtyFourMutationTargetTwentySixStatus())))\" && node -e \"import('./tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2838ThirtyFourMutationTargetTwentySevenStatus())))\" && node -e \"import('./tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2839ThirtyFourMutationTargetTwentyEightStatus())))\" && node -e \"import('./tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2840ThirtyFourMutationTargetTwentyNineStatus())))\" && node -e \"import('./tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2841ThirtyFourMutationTargetThirtyStatus())))\" && node -e \"import('./tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2842ThirtyFourMutationTargetThirtyOneStatus())))\" && node -e \"import('./tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2843ThirtyFourMutationTargetThirtyTwoStatus())))\" && node -e \"import('./tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2844ThirtyFourMutationTargetThirtyThreeStatus())))\" && node -e \"import('./tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2845ThirtyFourMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2807-2845-controlled-thirty-four-tool-mutation"] === "node tools/phase2807_2845/validate-controlled-thirty-four-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2806_sealed", phase2806.recommendedSealed === true && phase2806.thirtyThreeMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2807-2845-controlled-thirty-four-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("thirty_four_mutation_applied", result.thirtyFourMutationApplied === true);
  check("changed_file_count_thirty_four", result.changedFileCount === 34);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localThirtyFourSmokePassed === true);
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
  check("rollback_restore_thirty_four", rollback.rollbackAction === "restore-previous-content-thirty-four");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_thirty_four_entries", Array.isArray(rollback.files) && rollback.files.length === 34);
}

if (smoke) {
  check("smoke_phase2812Marker", smoke.phase2812Marker === "PHASE2812_THIRTY_FOUR_TOOL_TARGET_ONE_OK");
  check("smoke_phase2813Marker", smoke.phase2813Marker === "PHASE2813_THIRTY_FOUR_TOOL_TARGET_TWO_OK");
  check("smoke_phase2814Marker", smoke.phase2814Marker === "PHASE2814_THIRTY_FOUR_TOOL_TARGET_THREE_OK");
  check("smoke_phase2815Marker", smoke.phase2815Marker === "PHASE2815_THIRTY_FOUR_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2816Marker", smoke.phase2816Marker === "PHASE2816_THIRTY_FOUR_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2817Marker", smoke.phase2817Marker === "PHASE2817_THIRTY_FOUR_TOOL_TARGET_SIX_OK");
  check("smoke_phase2818Marker", smoke.phase2818Marker === "PHASE2818_THIRTY_FOUR_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2819Marker", smoke.phase2819Marker === "PHASE2819_THIRTY_FOUR_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2820Marker", smoke.phase2820Marker === "PHASE2820_THIRTY_FOUR_TOOL_TARGET_NINE_OK");
  check("smoke_phase2821Marker", smoke.phase2821Marker === "PHASE2821_THIRTY_FOUR_TOOL_TARGET_TEN_OK");
  check("smoke_phase2822Marker", smoke.phase2822Marker === "PHASE2822_THIRTY_FOUR_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2823Marker", smoke.phase2823Marker === "PHASE2823_THIRTY_FOUR_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2824Marker", smoke.phase2824Marker === "PHASE2824_THIRTY_FOUR_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2825Marker", smoke.phase2825Marker === "PHASE2825_THIRTY_FOUR_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2826Marker", smoke.phase2826Marker === "PHASE2826_THIRTY_FOUR_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2827Marker", smoke.phase2827Marker === "PHASE2827_THIRTY_FOUR_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase2828Marker", smoke.phase2828Marker === "PHASE2828_THIRTY_FOUR_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase2829Marker", smoke.phase2829Marker === "PHASE2829_THIRTY_FOUR_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase2830Marker", smoke.phase2830Marker === "PHASE2830_THIRTY_FOUR_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase2831Marker", smoke.phase2831Marker === "PHASE2831_THIRTY_FOUR_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase2832Marker", smoke.phase2832Marker === "PHASE2832_THIRTY_FOUR_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase2833Marker", smoke.phase2833Marker === "PHASE2833_THIRTY_FOUR_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase2834Marker", smoke.phase2834Marker === "PHASE2834_THIRTY_FOUR_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase2835Marker", smoke.phase2835Marker === "PHASE2835_THIRTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase2836Marker", smoke.phase2836Marker === "PHASE2836_THIRTY_FOUR_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase2837Marker", smoke.phase2837Marker === "PHASE2837_THIRTY_FOUR_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase2838Marker", smoke.phase2838Marker === "PHASE2838_THIRTY_FOUR_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase2839Marker", smoke.phase2839Marker === "PHASE2839_THIRTY_FOUR_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase2840Marker", smoke.phase2840Marker === "PHASE2840_THIRTY_FOUR_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase2841Marker", smoke.phase2841Marker === "PHASE2841_THIRTY_FOUR_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase2842Marker", smoke.phase2842Marker === "PHASE2842_THIRTY_FOUR_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase2843Marker", smoke.phase2843Marker === "PHASE2843_THIRTY_FOUR_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase2844Marker", smoke.phase2844Marker === "PHASE2844_THIRTY_FOUR_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase2845Marker", smoke.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2812ThirtyFourMutationTargetOneStatus") || targetOne.includes("export function buildPhase2812ThirtyFourMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2812_THIRTY_FOUR_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2813ThirtyFourMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2813ThirtyFourMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2813_THIRTY_FOUR_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2814ThirtyFourMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2814ThirtyFourMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2814_THIRTY_FOUR_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2815ThirtyFourMutationTargetFourStatus") || targetFour.includes("export function buildPhase2815ThirtyFourMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2815_THIRTY_FOUR_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2816ThirtyFourMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2816ThirtyFourMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2816_THIRTY_FOUR_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2817ThirtyFourMutationTargetSixStatus") || targetSix.includes("export function buildPhase2817ThirtyFourMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2817_THIRTY_FOUR_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2818ThirtyFourMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2818ThirtyFourMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2818_THIRTY_FOUR_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2819ThirtyFourMutationTargetEightStatus") || targetEight.includes("export function buildPhase2819ThirtyFourMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2819_THIRTY_FOUR_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2820ThirtyFourMutationTargetNineStatus") || targetNine.includes("export function buildPhase2820ThirtyFourMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2820_THIRTY_FOUR_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2821ThirtyFourMutationTargetTenStatus") || targetTen.includes("export function buildPhase2821ThirtyFourMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2821_THIRTY_FOUR_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2822ThirtyFourMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2822ThirtyFourMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2822_THIRTY_FOUR_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2823ThirtyFourMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2823ThirtyFourMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2823_THIRTY_FOUR_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2824ThirtyFourMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2824ThirtyFourMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2824_THIRTY_FOUR_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2825ThirtyFourMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2825ThirtyFourMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2825_THIRTY_FOUR_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2826ThirtyFourMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2826ThirtyFourMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2826_THIRTY_FOUR_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2827ThirtyFourMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase2827ThirtyFourMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2827_THIRTY_FOUR_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase2828ThirtyFourMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase2828ThirtyFourMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE2828_THIRTY_FOUR_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase2829ThirtyFourMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase2829ThirtyFourMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE2829_THIRTY_FOUR_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase2830ThirtyFourMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase2830ThirtyFourMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE2830_THIRTY_FOUR_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase2831ThirtyFourMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase2831ThirtyFourMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE2831_THIRTY_FOUR_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase2832ThirtyFourMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase2832ThirtyFourMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE2832_THIRTY_FOUR_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase2833ThirtyFourMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase2833ThirtyFourMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE2833_THIRTY_FOUR_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase2834ThirtyFourMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase2834ThirtyFourMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE2834_THIRTY_FOUR_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase2835ThirtyFourMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase2835ThirtyFourMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE2835_THIRTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase2836ThirtyFourMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase2836ThirtyFourMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE2836_THIRTY_FOUR_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase2837ThirtyFourMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase2837ThirtyFourMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE2837_THIRTY_FOUR_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase2838ThirtyFourMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase2838ThirtyFourMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE2838_THIRTY_FOUR_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase2839ThirtyFourMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase2839ThirtyFourMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE2839_THIRTY_FOUR_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase2840ThirtyFourMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase2840ThirtyFourMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE2840_THIRTY_FOUR_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase2841ThirtyFourMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase2841ThirtyFourMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE2841_THIRTY_FOUR_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase2842ThirtyFourMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase2842ThirtyFourMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE2842_THIRTY_FOUR_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase2843ThirtyFourMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase2843ThirtyFourMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE2843_THIRTY_FOUR_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase2844ThirtyFourMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase2844ThirtyFourMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE2844_THIRTY_FOUR_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase2845ThirtyFourMutationRuntimeStatus") || targetThirtyFour.includes("export function buildPhase2845ThirtyFourMutationRuntimeStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_thirty_four", docs.includes("controlled thirty-four tool mutation"));
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
  phase2806Sealed: phase2806.recommendedSealed === true,
  thirtyFourMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 34,
  thirtyFourMutationApplied: result?.thirtyFourMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localThirtyFourSmokePassed: result?.localThirtyFourSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, thirtyFourMutationApplied: verifierResult.thirtyFourMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localThirtyFourSmokePassed: verifierResult.localThirtyFourSmokePassed }, null, 2));
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
    "# Phase2807A-2845A Controlled Thirty-Four Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- thirtyFourMutationApplied: ${Boolean(result.thirtyFourMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localThirtyFourSmokePassed: ${Boolean(result.localThirtyFourSmokePassed)}`,
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
