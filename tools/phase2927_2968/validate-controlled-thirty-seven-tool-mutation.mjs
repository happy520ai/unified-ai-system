import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2927A-2968A-Controlled-Thirty-Seven-Tool-Mutation";
const runnerPath = "tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2927-2968-controlled-thirty-seven-tool-mutation.md";
const approvalPath = "docs/phase2927-2968-controlled-thirty-seven-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2932-thirty-seven-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2933-thirty-seven-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2934-thirty-seven-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2935-thirty-seven-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2936-thirty-seven-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2937-thirty-seven-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2938-thirty-seven-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2939-thirty-seven-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2940-thirty-seven-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2941-thirty-seven-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2942-thirty-seven-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2943-thirty-seven-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2944-thirty-seven-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2945-thirty-seven-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2946-thirty-seven-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2947-thirty-seven-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase2948-thirty-seven-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase2949-thirty-seven-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase2950-thirty-seven-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase2951-thirty-seven-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase2952-thirty-seven-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase2953-thirty-seven-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase2954-thirty-seven-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase2955-thirty-seven-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase2956-thirty-seven-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase2957-thirty-seven-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase2958-thirty-seven-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase2959-thirty-seven-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase2960-thirty-seven-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase2961-thirty-seven-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase2962-thirty-seven-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase2963-thirty-seven-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase2964-thirty-seven-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase2965-thirty-seven-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase2966-thirty-seven-tool-mutation-target-thirty-five.proposal.diff";
const proposalThirtySixPath = "docs/phase2967-thirty-seven-tool-mutation-target-thirty-six.proposal.diff";
const proposalThirtySevenPath = "docs/phase2968-thirty-seven-tool-mutation-target-thirty-seven.proposal.diff";
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
const targetThirtySevenPath = "tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2927-2968-controlled-thirty-seven-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2927-2968-controlled-thirty-seven-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2927-2968-controlled-thirty-seven-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2927-2968-controlled-thirty-seven-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2927-2968-controlled-thirty-seven-tool-mutation/thirty-seven-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2926 = readJson("apps/ai-gateway-service/evidence/phase2886-2926-controlled-thirty-six-tool-mutation/result.json") || {};
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
const targetThirtySeven = existsSync(resolve(targetThirtySevenPath)) ? readText(targetThirtySevenPath) : "";
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
check("proposal_thirty-seven_exists", existsSync(resolve(proposalThirtySevenPath)));
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2927-2968-controlled-thirty-seven-tool-mutation"] === "node tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs --plan docs/phase2927-2968-controlled-thirty-seven-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2927-2968-controlled-thirty-seven-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2937ThirtySevenMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2938ThirtySevenMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2939ThirtySevenMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2940ThirtySevenMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2941ThirtySevenMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2942ThirtySevenMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2943ThirtySevenMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2944ThirtySevenMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2945ThirtySevenMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2946ThirtySevenMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2947ThirtySevenMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2948ThirtySevenMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2949ThirtySevenMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2950ThirtySevenMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2951ThirtySevenMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2952ThirtySevenMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2953ThirtySevenMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2954ThirtySevenMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2955ThirtySevenMutationTargetTwentyFourStatus())))\" && node -e \"import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2956ThirtySevenMutationTargetTwentyFiveStatus())))\" && node -e \"import('./tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2957ThirtySevenMutationTargetTwentySixStatus())))\" && node -e \"import('./tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2958ThirtySevenMutationTargetTwentySevenStatus())))\" && node -e \"import('./tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2959ThirtySevenMutationTargetTwentyEightStatus())))\" && node -e \"import('./tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2960ThirtySevenMutationTargetTwentyNineStatus())))\" && node -e \"import('./tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2961ThirtySevenMutationTargetThirtyStatus())))\" && node -e \"import('./tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2962ThirtySevenMutationTargetThirtyOneStatus())))\" && node -e \"import('./tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2963ThirtySevenMutationTargetThirtyTwoStatus())))\" && node -e \"import('./tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2964ThirtySevenMutationTargetThirtyThreeStatus())))\" && node -e \"import('./tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2965ThirtySevenMutationTargetThirtyFourStatus())))\" && node -e \"import('./tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2966ThirtySevenMutationTargetThirtyFiveStatus())))\" && node -e \"import('./tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2967ThirtySevenMutationTargetThirtySixStatus())))\" && node -e \"import('./tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2968ThirtySevenMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2927-2968-controlled-thirty-seven-tool-mutation"] === "node tools/phase2927_2968/validate-controlled-thirty-seven-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2926_sealed", phase2926.recommendedSealed === true && phase2926.thirtySixMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2927-2968-controlled-thirty-seven-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("thirty_seven_mutation_applied", result.thirtySevenMutationApplied === true);
  check("changed_file_count_thirty_seven", result.changedFileCount === 37);
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
    && result.changedFiles.includes(targetThirtySevenPath)
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localThirtySevenSmokePassed === true);
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
  check("rollback_restore_thirty_seven", rollback.rollbackAction === "restore-previous-content-thirty-seven");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_thirty_seven_entries", Array.isArray(rollback.files) && rollback.files.length === 37);
}

if (smoke) {
  check("smoke_phase2932Marker", smoke.phase2932Marker === "PHASE2932_THIRTY_SEVEN_TOOL_TARGET_ONE_OK");
  check("smoke_phase2933Marker", smoke.phase2933Marker === "PHASE2933_THIRTY_SEVEN_TOOL_TARGET_TWO_OK");
  check("smoke_phase2934Marker", smoke.phase2934Marker === "PHASE2934_THIRTY_SEVEN_TOOL_TARGET_THREE_OK");
  check("smoke_phase2935Marker", smoke.phase2935Marker === "PHASE2935_THIRTY_SEVEN_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2936Marker", smoke.phase2936Marker === "PHASE2936_THIRTY_SEVEN_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2937Marker", smoke.phase2937Marker === "PHASE2937_THIRTY_SEVEN_TOOL_TARGET_SIX_OK");
  check("smoke_phase2938Marker", smoke.phase2938Marker === "PHASE2938_THIRTY_SEVEN_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2939Marker", smoke.phase2939Marker === "PHASE2939_THIRTY_SEVEN_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2940Marker", smoke.phase2940Marker === "PHASE2940_THIRTY_SEVEN_TOOL_TARGET_NINE_OK");
  check("smoke_phase2941Marker", smoke.phase2941Marker === "PHASE2941_THIRTY_SEVEN_TOOL_TARGET_TEN_OK");
  check("smoke_phase2942Marker", smoke.phase2942Marker === "PHASE2942_THIRTY_SEVEN_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2943Marker", smoke.phase2943Marker === "PHASE2943_THIRTY_SEVEN_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2944Marker", smoke.phase2944Marker === "PHASE2944_THIRTY_SEVEN_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2945Marker", smoke.phase2945Marker === "PHASE2945_THIRTY_SEVEN_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2946Marker", smoke.phase2946Marker === "PHASE2946_THIRTY_SEVEN_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2947Marker", smoke.phase2947Marker === "PHASE2947_THIRTY_SEVEN_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase2948Marker", smoke.phase2948Marker === "PHASE2948_THIRTY_SEVEN_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase2949Marker", smoke.phase2949Marker === "PHASE2949_THIRTY_SEVEN_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase2950Marker", smoke.phase2950Marker === "PHASE2950_THIRTY_SEVEN_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase2951Marker", smoke.phase2951Marker === "PHASE2951_THIRTY_SEVEN_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase2952Marker", smoke.phase2952Marker === "PHASE2952_THIRTY_SEVEN_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase2953Marker", smoke.phase2953Marker === "PHASE2953_THIRTY_SEVEN_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase2954Marker", smoke.phase2954Marker === "PHASE2954_THIRTY_SEVEN_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase2955Marker", smoke.phase2955Marker === "PHASE2955_THIRTY_SEVEN_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase2956Marker", smoke.phase2956Marker === "PHASE2956_THIRTY_SEVEN_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase2957Marker", smoke.phase2957Marker === "PHASE2957_THIRTY_SEVEN_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase2958Marker", smoke.phase2958Marker === "PHASE2958_THIRTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase2959Marker", smoke.phase2959Marker === "PHASE2959_THIRTY_SEVEN_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase2960Marker", smoke.phase2960Marker === "PHASE2960_THIRTY_SEVEN_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase2961Marker", smoke.phase2961Marker === "PHASE2961_THIRTY_SEVEN_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase2962Marker", smoke.phase2962Marker === "PHASE2962_THIRTY_SEVEN_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase2963Marker", smoke.phase2963Marker === "PHASE2963_THIRTY_SEVEN_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase2964Marker", smoke.phase2964Marker === "PHASE2964_THIRTY_SEVEN_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase2965Marker", smoke.phase2965Marker === "PHASE2965_THIRTY_SEVEN_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase2966Marker", smoke.phase2966Marker === "PHASE2966_THIRTY_SEVEN_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_phase2967Marker", smoke.phase2967Marker === "PHASE2967_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SIX_OK");
  check("smoke_phase2968Marker", smoke.phase2968Marker === "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2932ThirtySevenMutationTargetOneStatus") || targetOne.includes("export function buildPhase2932ThirtySevenMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2932_THIRTY_SEVEN_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2933ThirtySevenMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2933ThirtySevenMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2933_THIRTY_SEVEN_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2934ThirtySevenMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2934ThirtySevenMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2934_THIRTY_SEVEN_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2935ThirtySevenMutationTargetFourStatus") || targetFour.includes("export function buildPhase2935ThirtySevenMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2935_THIRTY_SEVEN_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2936ThirtySevenMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2936ThirtySevenMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2936_THIRTY_SEVEN_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2937ThirtySevenMutationTargetSixStatus") || targetSix.includes("export function buildPhase2937ThirtySevenMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2937_THIRTY_SEVEN_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2938ThirtySevenMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2938ThirtySevenMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2938_THIRTY_SEVEN_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2939ThirtySevenMutationTargetEightStatus") || targetEight.includes("export function buildPhase2939ThirtySevenMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2939_THIRTY_SEVEN_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2940ThirtySevenMutationTargetNineStatus") || targetNine.includes("export function buildPhase2940ThirtySevenMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2940_THIRTY_SEVEN_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2941ThirtySevenMutationTargetTenStatus") || targetTen.includes("export function buildPhase2941ThirtySevenMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2941_THIRTY_SEVEN_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2942ThirtySevenMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2942ThirtySevenMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2942_THIRTY_SEVEN_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2943ThirtySevenMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2943ThirtySevenMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2943_THIRTY_SEVEN_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2944ThirtySevenMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2944ThirtySevenMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2944_THIRTY_SEVEN_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2945ThirtySevenMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2945ThirtySevenMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2945_THIRTY_SEVEN_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2946ThirtySevenMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2946ThirtySevenMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2946_THIRTY_SEVEN_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2947ThirtySevenMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase2947ThirtySevenMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2947_THIRTY_SEVEN_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase2948ThirtySevenMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase2948ThirtySevenMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE2948_THIRTY_SEVEN_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase2949ThirtySevenMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase2949ThirtySevenMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE2949_THIRTY_SEVEN_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase2950ThirtySevenMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase2950ThirtySevenMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE2950_THIRTY_SEVEN_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase2951ThirtySevenMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase2951ThirtySevenMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE2951_THIRTY_SEVEN_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase2952ThirtySevenMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase2952ThirtySevenMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE2952_THIRTY_SEVEN_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase2953ThirtySevenMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase2953ThirtySevenMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE2953_THIRTY_SEVEN_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase2954ThirtySevenMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase2954ThirtySevenMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE2954_THIRTY_SEVEN_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase2955ThirtySevenMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase2955ThirtySevenMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE2955_THIRTY_SEVEN_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase2956ThirtySevenMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase2956ThirtySevenMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE2956_THIRTY_SEVEN_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase2957ThirtySevenMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase2957ThirtySevenMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE2957_THIRTY_SEVEN_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase2958ThirtySevenMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase2958ThirtySevenMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE2958_THIRTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase2959ThirtySevenMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase2959ThirtySevenMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE2959_THIRTY_SEVEN_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase2960ThirtySevenMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase2960ThirtySevenMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE2960_THIRTY_SEVEN_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase2961ThirtySevenMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase2961ThirtySevenMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE2961_THIRTY_SEVEN_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase2962ThirtySevenMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase2962ThirtySevenMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE2962_THIRTY_SEVEN_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase2963ThirtySevenMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase2963ThirtySevenMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE2963_THIRTY_SEVEN_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase2964ThirtySevenMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase2964ThirtySevenMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE2964_THIRTY_SEVEN_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase2965ThirtySevenMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase2965ThirtySevenMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE2965_THIRTY_SEVEN_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase2966ThirtySevenMutationTargetThirtyFiveStatus") || targetThirtyFive.includes("export function buildPhase2966ThirtySevenMutationTargetThirtyFiveStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE2966_THIRTY_SEVEN_TOOL_TARGET_THIRTY_FIVE_OK"));
check("target-thirty-six_export", targetThirtySix.includes("buildPhase2967ThirtySevenMutationTargetThirtySixStatus") || targetThirtySix.includes("export function buildPhase2967ThirtySevenMutationTargetThirtySixStatus"));
check("target-thirty-six_marker", targetThirtySix.includes("PHASE2967_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SIX_OK"));
check("target-thirty-seven_export", targetThirtySeven.includes("buildPhase2968ThirtySevenMutationRuntimeStatus") || targetThirtySeven.includes("export function buildPhase2968ThirtySevenMutationRuntimeStatus"));
check("target-thirty-seven_marker", targetThirtySeven.includes("PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_thirty_seven", docs.includes("controlled thirty-seven tool mutation"));
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
  phase2926Sealed: phase2926.recommendedSealed === true,
  thirtySevenMutationReady: completed,
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
    targetThirtySevenPath,
  ],
  changedFileCount: result?.changedFileCount ?? 37,
  thirtySevenMutationApplied: result?.thirtySevenMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localThirtySevenSmokePassed: result?.localThirtySevenSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, thirtySevenMutationApplied: verifierResult.thirtySevenMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localThirtySevenSmokePassed: verifierResult.localThirtySevenSmokePassed }, null, 2));
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
    "# Phase2927A-2968A Controlled Thirty-Seven Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- thirtySevenMutationApplied: ${Boolean(result.thirtySevenMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localThirtySevenSmokePassed: ${Boolean(result.localThirtySevenSmokePassed)}`,
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
