import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2969A-3011A-Controlled-Thirty-Eight-Tool-Mutation";
const runnerPath = "tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2969-3011-controlled-thirty-eight-tool-mutation.md";
const approvalPath = "docs/phase2969-3011-controlled-thirty-eight-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2974-thirty-eight-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2975-thirty-eight-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2976-thirty-eight-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2977-thirty-eight-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2978-thirty-eight-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2979-thirty-eight-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2980-thirty-eight-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2981-thirty-eight-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2982-thirty-eight-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2983-thirty-eight-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2984-thirty-eight-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2985-thirty-eight-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2986-thirty-eight-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2987-thirty-eight-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2988-thirty-eight-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2989-thirty-eight-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase2990-thirty-eight-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase2991-thirty-eight-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase2992-thirty-eight-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase2993-thirty-eight-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase2994-thirty-eight-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase2995-thirty-eight-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase2996-thirty-eight-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase2997-thirty-eight-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase2998-thirty-eight-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase2999-thirty-eight-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase3000-thirty-eight-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase3001-thirty-eight-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase3002-thirty-eight-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase3003-thirty-eight-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase3004-thirty-eight-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase3005-thirty-eight-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase3006-thirty-eight-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase3007-thirty-eight-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase3008-thirty-eight-tool-mutation-target-thirty-five.proposal.diff";
const proposalThirtySixPath = "docs/phase3009-thirty-eight-tool-mutation-target-thirty-six.proposal.diff";
const proposalThirtySevenPath = "docs/phase3010-thirty-eight-tool-mutation-target-thirty-seven.proposal.diff";
const proposalThirtyEightPath = "docs/phase3011-thirty-eight-tool-mutation-target-thirty-eight.proposal.diff";
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
const targetThirtyEightPath = "tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2969-3011-controlled-thirty-eight-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2969-3011-controlled-thirty-eight-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2969-3011-controlled-thirty-eight-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2969-3011-controlled-thirty-eight-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2969-3011-controlled-thirty-eight-tool-mutation/thirty-eight-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2968 = readJson("apps/ai-gateway-service/evidence/phase2927-2968-controlled-thirty-seven-tool-mutation/result.json") || {};
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
const targetThirtyEight = existsSync(resolve(targetThirtyEightPath)) ? readText(targetThirtyEightPath) : "";
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
check("proposal_thirty-eight_exists", existsSync(resolve(proposalThirtyEightPath)));
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2969-3011-controlled-thirty-eight-tool-mutation"] === "node tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs --plan docs/phase2969-3011-controlled-thirty-eight-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2969-3011-controlled-thirty-eight-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2979ThirtyEightMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2980ThirtyEightMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2981ThirtyEightMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2982ThirtyEightMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2983ThirtyEightMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2984ThirtyEightMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2985ThirtyEightMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2986ThirtyEightMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2987ThirtyEightMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2988ThirtyEightMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2989ThirtyEightMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2990ThirtyEightMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2991ThirtyEightMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2992ThirtyEightMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2993ThirtyEightMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2994ThirtyEightMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2995ThirtyEightMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2996ThirtyEightMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2997ThirtyEightMutationTargetTwentyFourStatus())))\" && node -e \"import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2998ThirtyEightMutationTargetTwentyFiveStatus())))\" && node -e \"import('./tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2999ThirtyEightMutationTargetTwentySixStatus())))\" && node -e \"import('./tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3000ThirtyEightMutationTargetTwentySevenStatus())))\" && node -e \"import('./tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3001ThirtyEightMutationTargetTwentyEightStatus())))\" && node -e \"import('./tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3002ThirtyEightMutationTargetTwentyNineStatus())))\" && node -e \"import('./tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3003ThirtyEightMutationTargetThirtyStatus())))\" && node -e \"import('./tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3004ThirtyEightMutationTargetThirtyOneStatus())))\" && node -e \"import('./tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3005ThirtyEightMutationTargetThirtyTwoStatus())))\" && node -e \"import('./tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3006ThirtyEightMutationTargetThirtyThreeStatus())))\" && node -e \"import('./tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3007ThirtyEightMutationTargetThirtyFourStatus())))\" && node -e \"import('./tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3008ThirtyEightMutationTargetThirtyFiveStatus())))\" && node -e \"import('./tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3009ThirtyEightMutationTargetThirtySixStatus())))\" && node -e \"import('./tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3010ThirtyEightMutationTargetThirtySevenStatus())))\" && node -e \"import('./tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3011ThirtyEightMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2969-3011-controlled-thirty-eight-tool-mutation"] === "node tools/phase2969_3011/validate-controlled-thirty-eight-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2968_sealed", phase2968.recommendedSealed === true && phase2968.thirtySevenMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2969-3011-controlled-thirty-eight-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("thirty_eight_mutation_applied", result.thirtyEightMutationApplied === true);
  check("changed_file_count_thirty_eight", result.changedFileCount === 38);
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
    && result.changedFiles.includes(targetThirtyEightPath)
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localThirtyEightSmokePassed === true);
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
  check("rollback_restore_thirty_eight", rollback.rollbackAction === "restore-previous-content-thirty-eight");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_thirty_eight_entries", Array.isArray(rollback.files) && rollback.files.length === 38);
}

if (smoke) {
  check("smoke_phase2974Marker", smoke.phase2974Marker === "PHASE2974_THIRTY_EIGHT_TOOL_TARGET_ONE_OK");
  check("smoke_phase2975Marker", smoke.phase2975Marker === "PHASE2975_THIRTY_EIGHT_TOOL_TARGET_TWO_OK");
  check("smoke_phase2976Marker", smoke.phase2976Marker === "PHASE2976_THIRTY_EIGHT_TOOL_TARGET_THREE_OK");
  check("smoke_phase2977Marker", smoke.phase2977Marker === "PHASE2977_THIRTY_EIGHT_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2978Marker", smoke.phase2978Marker === "PHASE2978_THIRTY_EIGHT_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2979Marker", smoke.phase2979Marker === "PHASE2979_THIRTY_EIGHT_TOOL_TARGET_SIX_OK");
  check("smoke_phase2980Marker", smoke.phase2980Marker === "PHASE2980_THIRTY_EIGHT_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2981Marker", smoke.phase2981Marker === "PHASE2981_THIRTY_EIGHT_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2982Marker", smoke.phase2982Marker === "PHASE2982_THIRTY_EIGHT_TOOL_TARGET_NINE_OK");
  check("smoke_phase2983Marker", smoke.phase2983Marker === "PHASE2983_THIRTY_EIGHT_TOOL_TARGET_TEN_OK");
  check("smoke_phase2984Marker", smoke.phase2984Marker === "PHASE2984_THIRTY_EIGHT_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2985Marker", smoke.phase2985Marker === "PHASE2985_THIRTY_EIGHT_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2986Marker", smoke.phase2986Marker === "PHASE2986_THIRTY_EIGHT_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2987Marker", smoke.phase2987Marker === "PHASE2987_THIRTY_EIGHT_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2988Marker", smoke.phase2988Marker === "PHASE2988_THIRTY_EIGHT_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2989Marker", smoke.phase2989Marker === "PHASE2989_THIRTY_EIGHT_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase2990Marker", smoke.phase2990Marker === "PHASE2990_THIRTY_EIGHT_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase2991Marker", smoke.phase2991Marker === "PHASE2991_THIRTY_EIGHT_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase2992Marker", smoke.phase2992Marker === "PHASE2992_THIRTY_EIGHT_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase2993Marker", smoke.phase2993Marker === "PHASE2993_THIRTY_EIGHT_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase2994Marker", smoke.phase2994Marker === "PHASE2994_THIRTY_EIGHT_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase2995Marker", smoke.phase2995Marker === "PHASE2995_THIRTY_EIGHT_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase2996Marker", smoke.phase2996Marker === "PHASE2996_THIRTY_EIGHT_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase2997Marker", smoke.phase2997Marker === "PHASE2997_THIRTY_EIGHT_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase2998Marker", smoke.phase2998Marker === "PHASE2998_THIRTY_EIGHT_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase2999Marker", smoke.phase2999Marker === "PHASE2999_THIRTY_EIGHT_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase3000Marker", smoke.phase3000Marker === "PHASE3000_THIRTY_EIGHT_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase3001Marker", smoke.phase3001Marker === "PHASE3001_THIRTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase3002Marker", smoke.phase3002Marker === "PHASE3002_THIRTY_EIGHT_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase3003Marker", smoke.phase3003Marker === "PHASE3003_THIRTY_EIGHT_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase3004Marker", smoke.phase3004Marker === "PHASE3004_THIRTY_EIGHT_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase3005Marker", smoke.phase3005Marker === "PHASE3005_THIRTY_EIGHT_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase3006Marker", smoke.phase3006Marker === "PHASE3006_THIRTY_EIGHT_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase3007Marker", smoke.phase3007Marker === "PHASE3007_THIRTY_EIGHT_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase3008Marker", smoke.phase3008Marker === "PHASE3008_THIRTY_EIGHT_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_phase3009Marker", smoke.phase3009Marker === "PHASE3009_THIRTY_EIGHT_TOOL_TARGET_THIRTY_SIX_OK");
  check("smoke_phase3010Marker", smoke.phase3010Marker === "PHASE3010_THIRTY_EIGHT_TOOL_TARGET_THIRTY_SEVEN_OK");
  check("smoke_phase3011Marker", smoke.phase3011Marker === "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2974ThirtyEightMutationTargetOneStatus") || targetOne.includes("export function buildPhase2974ThirtyEightMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2974_THIRTY_EIGHT_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2975ThirtyEightMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2975ThirtyEightMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2975_THIRTY_EIGHT_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2976ThirtyEightMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2976ThirtyEightMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2976_THIRTY_EIGHT_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2977ThirtyEightMutationTargetFourStatus") || targetFour.includes("export function buildPhase2977ThirtyEightMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2977_THIRTY_EIGHT_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2978ThirtyEightMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2978ThirtyEightMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2978_THIRTY_EIGHT_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2979ThirtyEightMutationTargetSixStatus") || targetSix.includes("export function buildPhase2979ThirtyEightMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2979_THIRTY_EIGHT_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2980ThirtyEightMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2980ThirtyEightMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2980_THIRTY_EIGHT_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2981ThirtyEightMutationTargetEightStatus") || targetEight.includes("export function buildPhase2981ThirtyEightMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2981_THIRTY_EIGHT_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2982ThirtyEightMutationTargetNineStatus") || targetNine.includes("export function buildPhase2982ThirtyEightMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2982_THIRTY_EIGHT_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2983ThirtyEightMutationTargetTenStatus") || targetTen.includes("export function buildPhase2983ThirtyEightMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2983_THIRTY_EIGHT_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2984ThirtyEightMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2984ThirtyEightMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2984_THIRTY_EIGHT_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2985ThirtyEightMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2985ThirtyEightMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2985_THIRTY_EIGHT_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2986ThirtyEightMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2986ThirtyEightMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2986_THIRTY_EIGHT_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2987ThirtyEightMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2987ThirtyEightMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2987_THIRTY_EIGHT_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2988ThirtyEightMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2988ThirtyEightMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2988_THIRTY_EIGHT_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2989ThirtyEightMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase2989ThirtyEightMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2989_THIRTY_EIGHT_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase2990ThirtyEightMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase2990ThirtyEightMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE2990_THIRTY_EIGHT_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase2991ThirtyEightMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase2991ThirtyEightMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE2991_THIRTY_EIGHT_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase2992ThirtyEightMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase2992ThirtyEightMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE2992_THIRTY_EIGHT_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase2993ThirtyEightMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase2993ThirtyEightMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE2993_THIRTY_EIGHT_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase2994ThirtyEightMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase2994ThirtyEightMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE2994_THIRTY_EIGHT_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase2995ThirtyEightMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase2995ThirtyEightMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE2995_THIRTY_EIGHT_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase2996ThirtyEightMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase2996ThirtyEightMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE2996_THIRTY_EIGHT_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase2997ThirtyEightMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase2997ThirtyEightMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE2997_THIRTY_EIGHT_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase2998ThirtyEightMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase2998ThirtyEightMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE2998_THIRTY_EIGHT_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase2999ThirtyEightMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase2999ThirtyEightMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE2999_THIRTY_EIGHT_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase3000ThirtyEightMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase3000ThirtyEightMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE3000_THIRTY_EIGHT_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase3001ThirtyEightMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase3001ThirtyEightMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE3001_THIRTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase3002ThirtyEightMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase3002ThirtyEightMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE3002_THIRTY_EIGHT_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase3003ThirtyEightMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase3003ThirtyEightMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE3003_THIRTY_EIGHT_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase3004ThirtyEightMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase3004ThirtyEightMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE3004_THIRTY_EIGHT_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase3005ThirtyEightMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase3005ThirtyEightMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE3005_THIRTY_EIGHT_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase3006ThirtyEightMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase3006ThirtyEightMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE3006_THIRTY_EIGHT_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase3007ThirtyEightMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase3007ThirtyEightMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE3007_THIRTY_EIGHT_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase3008ThirtyEightMutationTargetThirtyFiveStatus") || targetThirtyFive.includes("export function buildPhase3008ThirtyEightMutationTargetThirtyFiveStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE3008_THIRTY_EIGHT_TOOL_TARGET_THIRTY_FIVE_OK"));
check("target-thirty-six_export", targetThirtySix.includes("buildPhase3009ThirtyEightMutationTargetThirtySixStatus") || targetThirtySix.includes("export function buildPhase3009ThirtyEightMutationTargetThirtySixStatus"));
check("target-thirty-six_marker", targetThirtySix.includes("PHASE3009_THIRTY_EIGHT_TOOL_TARGET_THIRTY_SIX_OK"));
check("target-thirty-seven_export", targetThirtySeven.includes("buildPhase3010ThirtyEightMutationTargetThirtySevenStatus") || targetThirtySeven.includes("export function buildPhase3010ThirtyEightMutationTargetThirtySevenStatus"));
check("target-thirty-seven_marker", targetThirtySeven.includes("PHASE3010_THIRTY_EIGHT_TOOL_TARGET_THIRTY_SEVEN_OK"));
check("target-thirty-eight_export", targetThirtyEight.includes("buildPhase3011ThirtyEightMutationRuntimeStatus") || targetThirtyEight.includes("export function buildPhase3011ThirtyEightMutationRuntimeStatus"));
check("target-thirty-eight_marker", targetThirtyEight.includes("PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_thirty_eight", docs.includes("controlled thirty-eight tool mutation"));
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
  phase2968Sealed: phase2968.recommendedSealed === true,
  thirtyEightMutationReady: completed,
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
    targetThirtyEightPath,
  ],
  changedFileCount: result?.changedFileCount ?? 38,
  thirtyEightMutationApplied: result?.thirtyEightMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localThirtyEightSmokePassed: result?.localThirtyEightSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, thirtyEightMutationApplied: verifierResult.thirtyEightMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localThirtyEightSmokePassed: verifierResult.localThirtyEightSmokePassed }, null, 2));
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
    "# Phase2969A-3011A Controlled Thirty-Eight Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- thirtyEightMutationApplied: ${Boolean(result.thirtyEightMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localThirtyEightSmokePassed: ${Boolean(result.localThirtyEightSmokePassed)}`,
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
