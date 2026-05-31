import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase3012A-3055A-Controlled-Thirty-Nine-Tool-Mutation";
const runnerPath = "tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase3012-3055-controlled-thirty-nine-tool-mutation.md";
const approvalPath = "docs/phase3012-3055-controlled-thirty-nine-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase3017-thirty-nine-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase3018-thirty-nine-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase3019-thirty-nine-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase3020-thirty-nine-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase3021-thirty-nine-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase3022-thirty-nine-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase3023-thirty-nine-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase3024-thirty-nine-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase3025-thirty-nine-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase3026-thirty-nine-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase3027-thirty-nine-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase3028-thirty-nine-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase3029-thirty-nine-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase3030-thirty-nine-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase3031-thirty-nine-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase3032-thirty-nine-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase3033-thirty-nine-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase3034-thirty-nine-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase3035-thirty-nine-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase3036-thirty-nine-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase3037-thirty-nine-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase3038-thirty-nine-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase3039-thirty-nine-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase3040-thirty-nine-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase3041-thirty-nine-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase3042-thirty-nine-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase3043-thirty-nine-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase3044-thirty-nine-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase3045-thirty-nine-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase3046-thirty-nine-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase3047-thirty-nine-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase3048-thirty-nine-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase3049-thirty-nine-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase3050-thirty-nine-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase3051-thirty-nine-tool-mutation-target-thirty-five.proposal.diff";
const proposalThirtySixPath = "docs/phase3052-thirty-nine-tool-mutation-target-thirty-six.proposal.diff";
const proposalThirtySevenPath = "docs/phase3053-thirty-nine-tool-mutation-target-thirty-seven.proposal.diff";
const proposalThirtyEightPath = "docs/phase3054-thirty-nine-tool-mutation-target-thirty-eight.proposal.diff";
const proposalThirtyNinePath = "docs/phase3055-thirty-nine-tool-mutation-target-thirty-nine.proposal.diff";
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
const targetThirtyNinePath = "tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase3012-3055-controlled-thirty-nine-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase3012-3055-controlled-thirty-nine-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase3012-3055-controlled-thirty-nine-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase3012-3055-controlled-thirty-nine-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase3012-3055-controlled-thirty-nine-tool-mutation/thirty-nine-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase3011 = readJson("apps/ai-gateway-service/evidence/phase2969-3011-controlled-thirty-eight-tool-mutation/result.json") || {};
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
const targetThirtyNine = existsSync(resolve(targetThirtyNinePath)) ? readText(targetThirtyNinePath) : "";
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
check("proposal_thirty-nine_exists", existsSync(resolve(proposalThirtyNinePath)));
check("package_apply_script_registered", packageJson.scripts?.["apply:phase3012-3055-controlled-thirty-nine-tool-mutation"] === "node tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs --plan docs/phase3012-3055-controlled-thirty-nine-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase3012-3055-controlled-thirty-nine-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3022ThirtyNineMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3023ThirtyNineMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3024ThirtyNineMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3025ThirtyNineMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3026ThirtyNineMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3027ThirtyNineMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3028ThirtyNineMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3029ThirtyNineMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3030ThirtyNineMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3031ThirtyNineMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3032ThirtyNineMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3033ThirtyNineMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3034ThirtyNineMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3035ThirtyNineMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3036ThirtyNineMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3037ThirtyNineMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3038ThirtyNineMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3039ThirtyNineMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3040ThirtyNineMutationTargetTwentyFourStatus())))\" && node -e \"import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3041ThirtyNineMutationTargetTwentyFiveStatus())))\" && node -e \"import('./tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3042ThirtyNineMutationTargetTwentySixStatus())))\" && node -e \"import('./tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3043ThirtyNineMutationTargetTwentySevenStatus())))\" && node -e \"import('./tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3044ThirtyNineMutationTargetTwentyEightStatus())))\" && node -e \"import('./tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3045ThirtyNineMutationTargetTwentyNineStatus())))\" && node -e \"import('./tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3046ThirtyNineMutationTargetThirtyStatus())))\" && node -e \"import('./tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3047ThirtyNineMutationTargetThirtyOneStatus())))\" && node -e \"import('./tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3048ThirtyNineMutationTargetThirtyTwoStatus())))\" && node -e \"import('./tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3049ThirtyNineMutationTargetThirtyThreeStatus())))\" && node -e \"import('./tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3050ThirtyNineMutationTargetThirtyFourStatus())))\" && node -e \"import('./tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3051ThirtyNineMutationTargetThirtyFiveStatus())))\" && node -e \"import('./tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3052ThirtyNineMutationTargetThirtySixStatus())))\" && node -e \"import('./tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3053ThirtyNineMutationTargetThirtySevenStatus())))\" && node -e \"import('./tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3054ThirtyNineMutationTargetThirtyEightStatus())))\" && node -e \"import('./tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3055ThirtyNineMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase3012-3055-controlled-thirty-nine-tool-mutation"] === "node tools/phase3012_3055/validate-controlled-thirty-nine-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase3011_sealed", phase3011.recommendedSealed === true && phase3011.thirtyEightMutationApplied === true);
check("result_exists", result !== null, "run apply:phase3012-3055-controlled-thirty-nine-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("thirty_nine_mutation_applied", result.thirtyNineMutationApplied === true);
  check("changed_file_count_thirty_nine", result.changedFileCount === 39);
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
    && result.changedFiles.includes(targetThirtyNinePath)
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localThirtyNineSmokePassed === true);
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
  check("rollback_restore_thirty_nine", rollback.rollbackAction === "restore-previous-content-thirty-nine");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_thirty_nine_entries", Array.isArray(rollback.files) && rollback.files.length === 39);
}

if (smoke) {
  check("smoke_phase3017Marker", smoke.phase3017Marker === "PHASE3017_THIRTY_NINE_TOOL_TARGET_ONE_OK");
  check("smoke_phase3018Marker", smoke.phase3018Marker === "PHASE3018_THIRTY_NINE_TOOL_TARGET_TWO_OK");
  check("smoke_phase3019Marker", smoke.phase3019Marker === "PHASE3019_THIRTY_NINE_TOOL_TARGET_THREE_OK");
  check("smoke_phase3020Marker", smoke.phase3020Marker === "PHASE3020_THIRTY_NINE_TOOL_TARGET_FOUR_OK");
  check("smoke_phase3021Marker", smoke.phase3021Marker === "PHASE3021_THIRTY_NINE_TOOL_TARGET_FIVE_OK");
  check("smoke_phase3022Marker", smoke.phase3022Marker === "PHASE3022_THIRTY_NINE_TOOL_TARGET_SIX_OK");
  check("smoke_phase3023Marker", smoke.phase3023Marker === "PHASE3023_THIRTY_NINE_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase3024Marker", smoke.phase3024Marker === "PHASE3024_THIRTY_NINE_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase3025Marker", smoke.phase3025Marker === "PHASE3025_THIRTY_NINE_TOOL_TARGET_NINE_OK");
  check("smoke_phase3026Marker", smoke.phase3026Marker === "PHASE3026_THIRTY_NINE_TOOL_TARGET_TEN_OK");
  check("smoke_phase3027Marker", smoke.phase3027Marker === "PHASE3027_THIRTY_NINE_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase3028Marker", smoke.phase3028Marker === "PHASE3028_THIRTY_NINE_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase3029Marker", smoke.phase3029Marker === "PHASE3029_THIRTY_NINE_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase3030Marker", smoke.phase3030Marker === "PHASE3030_THIRTY_NINE_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase3031Marker", smoke.phase3031Marker === "PHASE3031_THIRTY_NINE_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase3032Marker", smoke.phase3032Marker === "PHASE3032_THIRTY_NINE_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase3033Marker", smoke.phase3033Marker === "PHASE3033_THIRTY_NINE_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase3034Marker", smoke.phase3034Marker === "PHASE3034_THIRTY_NINE_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase3035Marker", smoke.phase3035Marker === "PHASE3035_THIRTY_NINE_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase3036Marker", smoke.phase3036Marker === "PHASE3036_THIRTY_NINE_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase3037Marker", smoke.phase3037Marker === "PHASE3037_THIRTY_NINE_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase3038Marker", smoke.phase3038Marker === "PHASE3038_THIRTY_NINE_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase3039Marker", smoke.phase3039Marker === "PHASE3039_THIRTY_NINE_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase3040Marker", smoke.phase3040Marker === "PHASE3040_THIRTY_NINE_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase3041Marker", smoke.phase3041Marker === "PHASE3041_THIRTY_NINE_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase3042Marker", smoke.phase3042Marker === "PHASE3042_THIRTY_NINE_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase3043Marker", smoke.phase3043Marker === "PHASE3043_THIRTY_NINE_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase3044Marker", smoke.phase3044Marker === "PHASE3044_THIRTY_NINE_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase3045Marker", smoke.phase3045Marker === "PHASE3045_THIRTY_NINE_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase3046Marker", smoke.phase3046Marker === "PHASE3046_THIRTY_NINE_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase3047Marker", smoke.phase3047Marker === "PHASE3047_THIRTY_NINE_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase3048Marker", smoke.phase3048Marker === "PHASE3048_THIRTY_NINE_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase3049Marker", smoke.phase3049Marker === "PHASE3049_THIRTY_NINE_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase3050Marker", smoke.phase3050Marker === "PHASE3050_THIRTY_NINE_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase3051Marker", smoke.phase3051Marker === "PHASE3051_THIRTY_NINE_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_phase3052Marker", smoke.phase3052Marker === "PHASE3052_THIRTY_NINE_TOOL_TARGET_THIRTY_SIX_OK");
  check("smoke_phase3053Marker", smoke.phase3053Marker === "PHASE3053_THIRTY_NINE_TOOL_TARGET_THIRTY_SEVEN_OK");
  check("smoke_phase3054Marker", smoke.phase3054Marker === "PHASE3054_THIRTY_NINE_TOOL_TARGET_THIRTY_EIGHT_OK");
  check("smoke_phase3055Marker", smoke.phase3055Marker === "PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase3017ThirtyNineMutationTargetOneStatus") || targetOne.includes("export function buildPhase3017ThirtyNineMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE3017_THIRTY_NINE_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase3018ThirtyNineMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase3018ThirtyNineMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE3018_THIRTY_NINE_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase3019ThirtyNineMutationTargetThreeStatus") || targetThree.includes("export function buildPhase3019ThirtyNineMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE3019_THIRTY_NINE_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase3020ThirtyNineMutationTargetFourStatus") || targetFour.includes("export function buildPhase3020ThirtyNineMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE3020_THIRTY_NINE_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase3021ThirtyNineMutationTargetFiveStatus") || targetFive.includes("export function buildPhase3021ThirtyNineMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE3021_THIRTY_NINE_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase3022ThirtyNineMutationTargetSixStatus") || targetSix.includes("export function buildPhase3022ThirtyNineMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE3022_THIRTY_NINE_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase3023ThirtyNineMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase3023ThirtyNineMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE3023_THIRTY_NINE_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase3024ThirtyNineMutationTargetEightStatus") || targetEight.includes("export function buildPhase3024ThirtyNineMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE3024_THIRTY_NINE_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase3025ThirtyNineMutationTargetNineStatus") || targetNine.includes("export function buildPhase3025ThirtyNineMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE3025_THIRTY_NINE_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase3026ThirtyNineMutationTargetTenStatus") || targetTen.includes("export function buildPhase3026ThirtyNineMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE3026_THIRTY_NINE_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase3027ThirtyNineMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase3027ThirtyNineMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE3027_THIRTY_NINE_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase3028ThirtyNineMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase3028ThirtyNineMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE3028_THIRTY_NINE_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase3029ThirtyNineMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase3029ThirtyNineMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE3029_THIRTY_NINE_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase3030ThirtyNineMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase3030ThirtyNineMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE3030_THIRTY_NINE_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase3031ThirtyNineMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase3031ThirtyNineMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE3031_THIRTY_NINE_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase3032ThirtyNineMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase3032ThirtyNineMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE3032_THIRTY_NINE_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase3033ThirtyNineMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase3033ThirtyNineMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE3033_THIRTY_NINE_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase3034ThirtyNineMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase3034ThirtyNineMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE3034_THIRTY_NINE_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase3035ThirtyNineMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase3035ThirtyNineMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE3035_THIRTY_NINE_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase3036ThirtyNineMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase3036ThirtyNineMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE3036_THIRTY_NINE_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase3037ThirtyNineMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase3037ThirtyNineMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE3037_THIRTY_NINE_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase3038ThirtyNineMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase3038ThirtyNineMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE3038_THIRTY_NINE_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase3039ThirtyNineMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase3039ThirtyNineMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE3039_THIRTY_NINE_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase3040ThirtyNineMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase3040ThirtyNineMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE3040_THIRTY_NINE_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase3041ThirtyNineMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase3041ThirtyNineMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE3041_THIRTY_NINE_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase3042ThirtyNineMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase3042ThirtyNineMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE3042_THIRTY_NINE_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase3043ThirtyNineMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase3043ThirtyNineMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE3043_THIRTY_NINE_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase3044ThirtyNineMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase3044ThirtyNineMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE3044_THIRTY_NINE_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase3045ThirtyNineMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase3045ThirtyNineMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE3045_THIRTY_NINE_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase3046ThirtyNineMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase3046ThirtyNineMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE3046_THIRTY_NINE_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase3047ThirtyNineMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase3047ThirtyNineMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE3047_THIRTY_NINE_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase3048ThirtyNineMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase3048ThirtyNineMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE3048_THIRTY_NINE_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase3049ThirtyNineMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase3049ThirtyNineMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE3049_THIRTY_NINE_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase3050ThirtyNineMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase3050ThirtyNineMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE3050_THIRTY_NINE_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase3051ThirtyNineMutationTargetThirtyFiveStatus") || targetThirtyFive.includes("export function buildPhase3051ThirtyNineMutationTargetThirtyFiveStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE3051_THIRTY_NINE_TOOL_TARGET_THIRTY_FIVE_OK"));
check("target-thirty-six_export", targetThirtySix.includes("buildPhase3052ThirtyNineMutationTargetThirtySixStatus") || targetThirtySix.includes("export function buildPhase3052ThirtyNineMutationTargetThirtySixStatus"));
check("target-thirty-six_marker", targetThirtySix.includes("PHASE3052_THIRTY_NINE_TOOL_TARGET_THIRTY_SIX_OK"));
check("target-thirty-seven_export", targetThirtySeven.includes("buildPhase3053ThirtyNineMutationTargetThirtySevenStatus") || targetThirtySeven.includes("export function buildPhase3053ThirtyNineMutationTargetThirtySevenStatus"));
check("target-thirty-seven_marker", targetThirtySeven.includes("PHASE3053_THIRTY_NINE_TOOL_TARGET_THIRTY_SEVEN_OK"));
check("target-thirty-eight_export", targetThirtyEight.includes("buildPhase3054ThirtyNineMutationTargetThirtyEightStatus") || targetThirtyEight.includes("export function buildPhase3054ThirtyNineMutationTargetThirtyEightStatus"));
check("target-thirty-eight_marker", targetThirtyEight.includes("PHASE3054_THIRTY_NINE_TOOL_TARGET_THIRTY_EIGHT_OK"));
check("target-thirty-nine_export", targetThirtyNine.includes("buildPhase3055ThirtyNineMutationRuntimeStatus") || targetThirtyNine.includes("export function buildPhase3055ThirtyNineMutationRuntimeStatus"));
check("target-thirty-nine_marker", targetThirtyNine.includes("PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_thirty_nine", docs.includes("controlled thirty-nine tool mutation"));
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
  phase3011Sealed: phase3011.recommendedSealed === true,
  thirtyNineMutationReady: completed,
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
    targetThirtyNinePath,
  ],
  changedFileCount: result?.changedFileCount ?? 39,
  thirtyNineMutationApplied: result?.thirtyNineMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localThirtyNineSmokePassed: result?.localThirtyNineSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, thirtyNineMutationApplied: verifierResult.thirtyNineMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localThirtyNineSmokePassed: verifierResult.localThirtyNineSmokePassed }, null, 2));
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
    "# Phase3012A-3055A Controlled Thirty-Nine Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- thirtyNineMutationApplied: ${Boolean(result.thirtyNineMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localThirtyNineSmokePassed: ${Boolean(result.localThirtyNineSmokePassed)}`,
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
