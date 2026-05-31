import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase3194A-3241A-Controlled-Forty-Three-Tool-Mutation";
const runnerPath = "tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase3194-3241-controlled-forty-three-tool-mutation.md";
const approvalPath = "docs/phase3194-3241-controlled-forty-three-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase3199-forty-three-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase3200-forty-three-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase3201-forty-three-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase3202-forty-three-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase3203-forty-three-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase3204-forty-three-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase3205-forty-three-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase3206-forty-three-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase3207-forty-three-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase3208-forty-three-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase3209-forty-three-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase3210-forty-three-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase3211-forty-three-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase3212-forty-three-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase3213-forty-three-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase3214-forty-three-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase3215-forty-three-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase3216-forty-three-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase3217-forty-three-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase3218-forty-three-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase3219-forty-three-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase3220-forty-three-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase3221-forty-three-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase3222-forty-three-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase3223-forty-three-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase3224-forty-three-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase3225-forty-three-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase3226-forty-three-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase3227-forty-three-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase3228-forty-three-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase3229-forty-three-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase3230-forty-three-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase3231-forty-three-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase3232-forty-three-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase3233-forty-three-tool-mutation-target-thirty-five.proposal.diff";
const proposalThirtySixPath = "docs/phase3234-forty-three-tool-mutation-target-thirty-six.proposal.diff";
const proposalThirtySevenPath = "docs/phase3235-forty-three-tool-mutation-target-thirty-seven.proposal.diff";
const proposalThirtyEightPath = "docs/phase3236-forty-three-tool-mutation-target-thirty-eight.proposal.diff";
const proposalThirtyNinePath = "docs/phase3237-forty-three-tool-mutation-target-thirty-nine.proposal.diff";
const proposalFortyPath = "docs/phase3238-forty-three-tool-mutation-target-forty.proposal.diff";
const proposalFortyOnePath = "docs/phase3239-forty-three-tool-mutation-target-forty-one.proposal.diff";
const proposalFortyTwoPath = "docs/phase3240-forty-three-tool-mutation-target-forty-two.proposal.diff";
const proposalFortyThreePath = "docs/phase3241-forty-three-tool-mutation-target-forty-three.proposal.diff";
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
const targetFortyPath = "tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs";
const targetFortyOnePath = "tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs";
const targetFortyTwoPath = "tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs";
const targetFortyThreePath = "tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase3194-3241-controlled-forty-three-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase3194-3241-controlled-forty-three-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase3194-3241-controlled-forty-three-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase3194-3241-controlled-forty-three-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase3194-3241-controlled-forty-three-tool-mutation/forty-three-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase3193 = readJson("apps/ai-gateway-service/evidence/phase3147-3193-controlled-forty-two-tool-mutation/result.json") || {};
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
const targetForty = existsSync(resolve(targetFortyPath)) ? readText(targetFortyPath) : "";
const targetFortyOne = existsSync(resolve(targetFortyOnePath)) ? readText(targetFortyOnePath) : "";
const targetFortyTwo = existsSync(resolve(targetFortyTwoPath)) ? readText(targetFortyTwoPath) : "";
const targetFortyThree = existsSync(resolve(targetFortyThreePath)) ? readText(targetFortyThreePath) : "";
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
check("proposal_forty_exists", existsSync(resolve(proposalFortyPath)));
check("proposal_forty-one_exists", existsSync(resolve(proposalFortyOnePath)));
check("proposal_forty-two_exists", existsSync(resolve(proposalFortyTwoPath)));
check("proposal_forty-three_exists", existsSync(resolve(proposalFortyThreePath)));
check("package_apply_script_registered", packageJson.scripts?.["apply:phase3194-3241-controlled-forty-three-tool-mutation"] === "node tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs --plan docs/phase3194-3241-controlled-forty-three-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase3194-3241-controlled-forty-three-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3204FortyThreeMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3205FortyThreeMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3206FortyThreeMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3207FortyThreeMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3208FortyThreeMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3209FortyThreeMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3210FortyThreeMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3211FortyThreeMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3212FortyThreeMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3213FortyThreeMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3214FortyThreeMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3215FortyThreeMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3216FortyThreeMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3217FortyThreeMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3218FortyThreeMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3219FortyThreeMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3220FortyThreeMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3221FortyThreeMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3222FortyThreeMutationTargetTwentyFourStatus())))\" && node -e \"import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3223FortyThreeMutationTargetTwentyFiveStatus())))\" && node -e \"import('./tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3224FortyThreeMutationTargetTwentySixStatus())))\" && node -e \"import('./tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3225FortyThreeMutationTargetTwentySevenStatus())))\" && node -e \"import('./tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3226FortyThreeMutationTargetTwentyEightStatus())))\" && node -e \"import('./tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3227FortyThreeMutationTargetTwentyNineStatus())))\" && node -e \"import('./tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3228FortyThreeMutationTargetThirtyStatus())))\" && node -e \"import('./tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3229FortyThreeMutationTargetThirtyOneStatus())))\" && node -e \"import('./tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3230FortyThreeMutationTargetThirtyTwoStatus())))\" && node -e \"import('./tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3231FortyThreeMutationTargetThirtyThreeStatus())))\" && node -e \"import('./tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3232FortyThreeMutationTargetThirtyFourStatus())))\" && node -e \"import('./tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3233FortyThreeMutationTargetThirtyFiveStatus())))\" && node -e \"import('./tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3234FortyThreeMutationTargetThirtySixStatus())))\" && node -e \"import('./tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3235FortyThreeMutationTargetThirtySevenStatus())))\" && node -e \"import('./tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3236FortyThreeMutationTargetThirtyEightStatus())))\" && node -e \"import('./tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3237FortyThreeMutationTargetThirtyNineStatus())))\" && node -e \"import('./tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3238FortyThreeMutationTargetFortyStatus())))\" && node -e \"import('./tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3239FortyThreeMutationTargetFortyOneStatus())))\" && node -e \"import('./tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3240FortyThreeMutationTargetFortyTwoStatus())))\" && node -e \"import('./tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3241FortyThreeMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase3194-3241-controlled-forty-three-tool-mutation"] === "node tools/phase3194_3241/validate-controlled-forty-three-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase3193_sealed", phase3193.recommendedSealed === true && phase3193.fortyTwoMutationApplied === true);
check("result_exists", result !== null, "run apply:phase3194-3241-controlled-forty-three-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("forty_three_mutation_applied", result.fortyThreeMutationApplied === true);
  check("changed_file_count_forty_three", result.changedFileCount === 43);
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
    && result.changedFiles.includes(targetFortyPath)
    && result.changedFiles.includes(targetFortyOnePath)
    && result.changedFiles.includes(targetFortyTwoPath)
    && result.changedFiles.includes(targetFortyThreePath)
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localFortyThreeSmokePassed === true);
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
  check("rollback_restore_forty_three", rollback.rollbackAction === "restore-previous-content-forty-three");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_forty_three_entries", Array.isArray(rollback.files) && rollback.files.length === 43);
}

if (smoke) {
  check("smoke_phase3199Marker", smoke.phase3199Marker === "PHASE3199_FORTY_THREE_TOOL_TARGET_ONE_OK");
  check("smoke_phase3200Marker", smoke.phase3200Marker === "PHASE3200_FORTY_THREE_TOOL_TARGET_TWO_OK");
  check("smoke_phase3201Marker", smoke.phase3201Marker === "PHASE3201_FORTY_THREE_TOOL_TARGET_THREE_OK");
  check("smoke_phase3202Marker", smoke.phase3202Marker === "PHASE3202_FORTY_THREE_TOOL_TARGET_FOUR_OK");
  check("smoke_phase3203Marker", smoke.phase3203Marker === "PHASE3203_FORTY_THREE_TOOL_TARGET_FIVE_OK");
  check("smoke_phase3204Marker", smoke.phase3204Marker === "PHASE3204_FORTY_THREE_TOOL_TARGET_SIX_OK");
  check("smoke_phase3205Marker", smoke.phase3205Marker === "PHASE3205_FORTY_THREE_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase3206Marker", smoke.phase3206Marker === "PHASE3206_FORTY_THREE_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase3207Marker", smoke.phase3207Marker === "PHASE3207_FORTY_THREE_TOOL_TARGET_NINE_OK");
  check("smoke_phase3208Marker", smoke.phase3208Marker === "PHASE3208_FORTY_THREE_TOOL_TARGET_TEN_OK");
  check("smoke_phase3209Marker", smoke.phase3209Marker === "PHASE3209_FORTY_THREE_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase3210Marker", smoke.phase3210Marker === "PHASE3210_FORTY_THREE_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase3211Marker", smoke.phase3211Marker === "PHASE3211_FORTY_THREE_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase3212Marker", smoke.phase3212Marker === "PHASE3212_FORTY_THREE_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase3213Marker", smoke.phase3213Marker === "PHASE3213_FORTY_THREE_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase3214Marker", smoke.phase3214Marker === "PHASE3214_FORTY_THREE_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase3215Marker", smoke.phase3215Marker === "PHASE3215_FORTY_THREE_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase3216Marker", smoke.phase3216Marker === "PHASE3216_FORTY_THREE_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase3217Marker", smoke.phase3217Marker === "PHASE3217_FORTY_THREE_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase3218Marker", smoke.phase3218Marker === "PHASE3218_FORTY_THREE_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase3219Marker", smoke.phase3219Marker === "PHASE3219_FORTY_THREE_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase3220Marker", smoke.phase3220Marker === "PHASE3220_FORTY_THREE_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase3221Marker", smoke.phase3221Marker === "PHASE3221_FORTY_THREE_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase3222Marker", smoke.phase3222Marker === "PHASE3222_FORTY_THREE_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase3223Marker", smoke.phase3223Marker === "PHASE3223_FORTY_THREE_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase3224Marker", smoke.phase3224Marker === "PHASE3224_FORTY_THREE_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase3225Marker", smoke.phase3225Marker === "PHASE3225_FORTY_THREE_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase3226Marker", smoke.phase3226Marker === "PHASE3226_FORTY_THREE_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase3227Marker", smoke.phase3227Marker === "PHASE3227_FORTY_THREE_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase3228Marker", smoke.phase3228Marker === "PHASE3228_FORTY_THREE_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase3229Marker", smoke.phase3229Marker === "PHASE3229_FORTY_THREE_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase3230Marker", smoke.phase3230Marker === "PHASE3230_FORTY_THREE_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase3231Marker", smoke.phase3231Marker === "PHASE3231_FORTY_THREE_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase3232Marker", smoke.phase3232Marker === "PHASE3232_FORTY_THREE_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase3233Marker", smoke.phase3233Marker === "PHASE3233_FORTY_THREE_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_phase3234Marker", smoke.phase3234Marker === "PHASE3234_FORTY_THREE_TOOL_TARGET_THIRTY_SIX_OK");
  check("smoke_phase3235Marker", smoke.phase3235Marker === "PHASE3235_FORTY_THREE_TOOL_TARGET_THIRTY_SEVEN_OK");
  check("smoke_phase3236Marker", smoke.phase3236Marker === "PHASE3236_FORTY_THREE_TOOL_TARGET_THIRTY_EIGHT_OK");
  check("smoke_phase3237Marker", smoke.phase3237Marker === "PHASE3237_FORTY_THREE_TOOL_TARGET_THIRTY_NINE_OK");
  check("smoke_phase3238Marker", smoke.phase3238Marker === "PHASE3238_FORTY_THREE_TOOL_TARGET_FORTY_OK");
  check("smoke_phase3239Marker", smoke.phase3239Marker === "PHASE3239_FORTY_THREE_TOOL_TARGET_FORTY_ONE_OK");
  check("smoke_phase3240Marker", smoke.phase3240Marker === "PHASE3240_FORTY_THREE_TOOL_TARGET_FORTY_TWO_OK");
  check("smoke_phase3241Marker", smoke.phase3241Marker === "PHASE3241_FORTY_THREE_TOOL_TARGET_FORTY_THREE_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase3199FortyThreeMutationTargetOneStatus") || targetOne.includes("export function buildPhase3199FortyThreeMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE3199_FORTY_THREE_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase3200FortyThreeMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase3200FortyThreeMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE3200_FORTY_THREE_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase3201FortyThreeMutationTargetThreeStatus") || targetThree.includes("export function buildPhase3201FortyThreeMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE3201_FORTY_THREE_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase3202FortyThreeMutationTargetFourStatus") || targetFour.includes("export function buildPhase3202FortyThreeMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE3202_FORTY_THREE_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase3203FortyThreeMutationTargetFiveStatus") || targetFive.includes("export function buildPhase3203FortyThreeMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE3203_FORTY_THREE_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase3204FortyThreeMutationTargetSixStatus") || targetSix.includes("export function buildPhase3204FortyThreeMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE3204_FORTY_THREE_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase3205FortyThreeMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase3205FortyThreeMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE3205_FORTY_THREE_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase3206FortyThreeMutationTargetEightStatus") || targetEight.includes("export function buildPhase3206FortyThreeMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE3206_FORTY_THREE_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase3207FortyThreeMutationTargetNineStatus") || targetNine.includes("export function buildPhase3207FortyThreeMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE3207_FORTY_THREE_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase3208FortyThreeMutationTargetTenStatus") || targetTen.includes("export function buildPhase3208FortyThreeMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE3208_FORTY_THREE_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase3209FortyThreeMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase3209FortyThreeMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE3209_FORTY_THREE_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase3210FortyThreeMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase3210FortyThreeMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE3210_FORTY_THREE_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase3211FortyThreeMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase3211FortyThreeMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE3211_FORTY_THREE_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase3212FortyThreeMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase3212FortyThreeMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE3212_FORTY_THREE_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase3213FortyThreeMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase3213FortyThreeMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE3213_FORTY_THREE_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase3214FortyThreeMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase3214FortyThreeMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE3214_FORTY_THREE_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase3215FortyThreeMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase3215FortyThreeMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE3215_FORTY_THREE_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase3216FortyThreeMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase3216FortyThreeMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE3216_FORTY_THREE_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase3217FortyThreeMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase3217FortyThreeMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE3217_FORTY_THREE_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase3218FortyThreeMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase3218FortyThreeMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE3218_FORTY_THREE_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase3219FortyThreeMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase3219FortyThreeMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE3219_FORTY_THREE_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase3220FortyThreeMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase3220FortyThreeMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE3220_FORTY_THREE_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase3221FortyThreeMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase3221FortyThreeMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE3221_FORTY_THREE_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase3222FortyThreeMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase3222FortyThreeMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE3222_FORTY_THREE_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase3223FortyThreeMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase3223FortyThreeMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE3223_FORTY_THREE_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase3224FortyThreeMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase3224FortyThreeMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE3224_FORTY_THREE_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase3225FortyThreeMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase3225FortyThreeMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE3225_FORTY_THREE_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase3226FortyThreeMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase3226FortyThreeMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE3226_FORTY_THREE_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase3227FortyThreeMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase3227FortyThreeMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE3227_FORTY_THREE_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase3228FortyThreeMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase3228FortyThreeMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE3228_FORTY_THREE_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase3229FortyThreeMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase3229FortyThreeMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE3229_FORTY_THREE_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase3230FortyThreeMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase3230FortyThreeMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE3230_FORTY_THREE_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase3231FortyThreeMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase3231FortyThreeMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE3231_FORTY_THREE_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase3232FortyThreeMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase3232FortyThreeMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE3232_FORTY_THREE_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase3233FortyThreeMutationTargetThirtyFiveStatus") || targetThirtyFive.includes("export function buildPhase3233FortyThreeMutationTargetThirtyFiveStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE3233_FORTY_THREE_TOOL_TARGET_THIRTY_FIVE_OK"));
check("target-thirty-six_export", targetThirtySix.includes("buildPhase3234FortyThreeMutationTargetThirtySixStatus") || targetThirtySix.includes("export function buildPhase3234FortyThreeMutationTargetThirtySixStatus"));
check("target-thirty-six_marker", targetThirtySix.includes("PHASE3234_FORTY_THREE_TOOL_TARGET_THIRTY_SIX_OK"));
check("target-thirty-seven_export", targetThirtySeven.includes("buildPhase3235FortyThreeMutationTargetThirtySevenStatus") || targetThirtySeven.includes("export function buildPhase3235FortyThreeMutationTargetThirtySevenStatus"));
check("target-thirty-seven_marker", targetThirtySeven.includes("PHASE3235_FORTY_THREE_TOOL_TARGET_THIRTY_SEVEN_OK"));
check("target-thirty-eight_export", targetThirtyEight.includes("buildPhase3236FortyThreeMutationTargetThirtyEightStatus") || targetThirtyEight.includes("export function buildPhase3236FortyThreeMutationTargetThirtyEightStatus"));
check("target-thirty-eight_marker", targetThirtyEight.includes("PHASE3236_FORTY_THREE_TOOL_TARGET_THIRTY_EIGHT_OK"));
check("target-thirty-nine_export", targetThirtyNine.includes("buildPhase3237FortyThreeMutationTargetThirtyNineStatus") || targetThirtyNine.includes("export function buildPhase3237FortyThreeMutationTargetThirtyNineStatus"));
check("target-thirty-nine_marker", targetThirtyNine.includes("PHASE3237_FORTY_THREE_TOOL_TARGET_THIRTY_NINE_OK"));
check("target-forty_export", targetForty.includes("buildPhase3238FortyThreeMutationTargetFortyStatus") || targetForty.includes("export function buildPhase3238FortyThreeMutationTargetFortyStatus"));
check("target-forty_marker", targetForty.includes("PHASE3238_FORTY_THREE_TOOL_TARGET_FORTY_OK"));
check("target-forty-one_export", targetFortyOne.includes("buildPhase3239FortyThreeMutationTargetFortyOneStatus") || targetFortyOne.includes("export function buildPhase3239FortyThreeMutationTargetFortyOneStatus"));
check("target-forty-one_marker", targetFortyOne.includes("PHASE3239_FORTY_THREE_TOOL_TARGET_FORTY_ONE_OK"));
check("target-forty-two_export", targetFortyTwo.includes("buildPhase3240FortyThreeMutationTargetFortyTwoStatus") || targetFortyTwo.includes("export function buildPhase3240FortyThreeMutationTargetFortyTwoStatus"));
check("target-forty-two_marker", targetFortyTwo.includes("PHASE3240_FORTY_THREE_TOOL_TARGET_FORTY_TWO_OK"));
check("target-forty-three_export", targetFortyThree.includes("buildPhase3241FortyThreeMutationRuntimeStatus") || targetFortyThree.includes("export function buildPhase3241FortyThreeMutationRuntimeStatus"));
check("target-forty-three_marker", targetFortyThree.includes("PHASE3241_FORTY_THREE_TOOL_TARGET_FORTY_THREE_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_forty_three", docs.includes("controlled forty-three tool mutation"));
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
  phase3193Sealed: phase3193.recommendedSealed === true,
  fortyThreeMutationReady: completed,
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
    targetFortyPath,
    targetFortyOnePath,
    targetFortyTwoPath,
    targetFortyThreePath,
  ],
  changedFileCount: result?.changedFileCount ?? 43,
  fortyThreeMutationApplied: result?.fortyThreeMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localFortyThreeSmokePassed: result?.localFortyThreeSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, fortyThreeMutationApplied: verifierResult.fortyThreeMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localFortyThreeSmokePassed: verifierResult.localFortyThreeSmokePassed }, null, 2));
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
    "# Phase3194A-3241A Controlled Forty-Three Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- fortyThreeMutationApplied: ${Boolean(result.fortyThreeMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localFortyThreeSmokePassed: ${Boolean(result.localFortyThreeSmokePassed)}`,
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
