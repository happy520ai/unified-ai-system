import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase3242A-3290A-Controlled-Forty-Four-Tool-Mutation";
const runnerPath = "tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase3242-3290-controlled-forty-four-tool-mutation.md";
const approvalPath = "docs/phase3242-3290-controlled-forty-four-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase3247-forty-four-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase3248-forty-four-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase3249-forty-four-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase3250-forty-four-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase3251-forty-four-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase3252-forty-four-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase3253-forty-four-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase3254-forty-four-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase3255-forty-four-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase3256-forty-four-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase3257-forty-four-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase3258-forty-four-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase3259-forty-four-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase3260-forty-four-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase3261-forty-four-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase3262-forty-four-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase3263-forty-four-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase3264-forty-four-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase3265-forty-four-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase3266-forty-four-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase3267-forty-four-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase3268-forty-four-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase3269-forty-four-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase3270-forty-four-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase3271-forty-four-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase3272-forty-four-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase3273-forty-four-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase3274-forty-four-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase3275-forty-four-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase3276-forty-four-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase3277-forty-four-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase3278-forty-four-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase3279-forty-four-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase3280-forty-four-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase3281-forty-four-tool-mutation-target-thirty-five.proposal.diff";
const proposalThirtySixPath = "docs/phase3282-forty-four-tool-mutation-target-thirty-six.proposal.diff";
const proposalThirtySevenPath = "docs/phase3283-forty-four-tool-mutation-target-thirty-seven.proposal.diff";
const proposalThirtyEightPath = "docs/phase3284-forty-four-tool-mutation-target-thirty-eight.proposal.diff";
const proposalThirtyNinePath = "docs/phase3285-forty-four-tool-mutation-target-thirty-nine.proposal.diff";
const proposalFortyPath = "docs/phase3286-forty-four-tool-mutation-target-forty.proposal.diff";
const proposalFortyOnePath = "docs/phase3287-forty-four-tool-mutation-target-forty-one.proposal.diff";
const proposalFortyTwoPath = "docs/phase3288-forty-four-tool-mutation-target-forty-two.proposal.diff";
const proposalFortyThreePath = "docs/phase3289-forty-four-tool-mutation-target-forty-three.proposal.diff";
const proposalFortyFourPath = "docs/phase3290-forty-four-tool-mutation-target-forty-four.proposal.diff";
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
const targetFortyFourPath = "tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase3242-3290-controlled-forty-four-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase3242-3290-controlled-forty-four-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase3242-3290-controlled-forty-four-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase3242-3290-controlled-forty-four-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase3242-3290-controlled-forty-four-tool-mutation/forty-four-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase3241 = readJson("apps/ai-gateway-service/evidence/phase3194-3241-controlled-forty-three-tool-mutation/result.json") || {};
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
const targetFortyFour = existsSync(resolve(targetFortyFourPath)) ? readText(targetFortyFourPath) : "";
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
check("proposal_forty-four_exists", existsSync(resolve(proposalFortyFourPath)));
check("package_apply_script_registered", packageJson.scripts?.["apply:phase3242-3290-controlled-forty-four-tool-mutation"] === "node tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs --plan docs/phase3242-3290-controlled-forty-four-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase3242-3290-controlled-forty-four-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3252FortyFourMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3253FortyFourMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3254FortyFourMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3255FortyFourMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3256FortyFourMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3257FortyFourMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3258FortyFourMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3259FortyFourMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3260FortyFourMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3261FortyFourMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3262FortyFourMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3263FortyFourMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3264FortyFourMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3265FortyFourMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3266FortyFourMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3267FortyFourMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3268FortyFourMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3269FortyFourMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3270FortyFourMutationTargetTwentyFourStatus())))\" && node -e \"import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3271FortyFourMutationTargetTwentyFiveStatus())))\" && node -e \"import('./tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3272FortyFourMutationTargetTwentySixStatus())))\" && node -e \"import('./tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3273FortyFourMutationTargetTwentySevenStatus())))\" && node -e \"import('./tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3274FortyFourMutationTargetTwentyEightStatus())))\" && node -e \"import('./tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3275FortyFourMutationTargetTwentyNineStatus())))\" && node -e \"import('./tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3276FortyFourMutationTargetThirtyStatus())))\" && node -e \"import('./tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3277FortyFourMutationTargetThirtyOneStatus())))\" && node -e \"import('./tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3278FortyFourMutationTargetThirtyTwoStatus())))\" && node -e \"import('./tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3279FortyFourMutationTargetThirtyThreeStatus())))\" && node -e \"import('./tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3280FortyFourMutationTargetThirtyFourStatus())))\" && node -e \"import('./tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3281FortyFourMutationTargetThirtyFiveStatus())))\" && node -e \"import('./tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3282FortyFourMutationTargetThirtySixStatus())))\" && node -e \"import('./tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3283FortyFourMutationTargetThirtySevenStatus())))\" && node -e \"import('./tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3284FortyFourMutationTargetThirtyEightStatus())))\" && node -e \"import('./tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3285FortyFourMutationTargetThirtyNineStatus())))\" && node -e \"import('./tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3286FortyFourMutationTargetFortyStatus())))\" && node -e \"import('./tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3287FortyFourMutationTargetFortyOneStatus())))\" && node -e \"import('./tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3288FortyFourMutationTargetFortyTwoStatus())))\" && node -e \"import('./tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3289FortyFourMutationTargetFortyThreeStatus())))\" && node -e \"import('./tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3290FortyFourMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase3242-3290-controlled-forty-four-tool-mutation"] === "node tools/phase3242_3290/validate-controlled-forty-four-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase3241_sealed", phase3241.recommendedSealed === true && phase3241.fortyThreeMutationApplied === true);
check("result_exists", result !== null, "run apply:phase3242-3290-controlled-forty-four-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("forty_four_mutation_applied", result.fortyFourMutationApplied === true);
  check("changed_file_count_forty_four", result.changedFileCount === 44);
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
    && result.changedFiles.includes(targetFortyFourPath)
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localFortyFourSmokePassed === true);
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
  check("rollback_restore_forty_four", rollback.rollbackAction === "restore-previous-content-forty-four");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_forty_four_entries", Array.isArray(rollback.files) && rollback.files.length === 44);
}

if (smoke) {
  check("smoke_phase3247Marker", smoke.phase3247Marker === "PHASE3247_FORTY_FOUR_TOOL_TARGET_ONE_OK");
  check("smoke_phase3248Marker", smoke.phase3248Marker === "PHASE3248_FORTY_FOUR_TOOL_TARGET_TWO_OK");
  check("smoke_phase3249Marker", smoke.phase3249Marker === "PHASE3249_FORTY_FOUR_TOOL_TARGET_THREE_OK");
  check("smoke_phase3250Marker", smoke.phase3250Marker === "PHASE3250_FORTY_FOUR_TOOL_TARGET_FOUR_OK");
  check("smoke_phase3251Marker", smoke.phase3251Marker === "PHASE3251_FORTY_FOUR_TOOL_TARGET_FIVE_OK");
  check("smoke_phase3252Marker", smoke.phase3252Marker === "PHASE3252_FORTY_FOUR_TOOL_TARGET_SIX_OK");
  check("smoke_phase3253Marker", smoke.phase3253Marker === "PHASE3253_FORTY_FOUR_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase3254Marker", smoke.phase3254Marker === "PHASE3254_FORTY_FOUR_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase3255Marker", smoke.phase3255Marker === "PHASE3255_FORTY_FOUR_TOOL_TARGET_NINE_OK");
  check("smoke_phase3256Marker", smoke.phase3256Marker === "PHASE3256_FORTY_FOUR_TOOL_TARGET_TEN_OK");
  check("smoke_phase3257Marker", smoke.phase3257Marker === "PHASE3257_FORTY_FOUR_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase3258Marker", smoke.phase3258Marker === "PHASE3258_FORTY_FOUR_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase3259Marker", smoke.phase3259Marker === "PHASE3259_FORTY_FOUR_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase3260Marker", smoke.phase3260Marker === "PHASE3260_FORTY_FOUR_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase3261Marker", smoke.phase3261Marker === "PHASE3261_FORTY_FOUR_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase3262Marker", smoke.phase3262Marker === "PHASE3262_FORTY_FOUR_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase3263Marker", smoke.phase3263Marker === "PHASE3263_FORTY_FOUR_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase3264Marker", smoke.phase3264Marker === "PHASE3264_FORTY_FOUR_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase3265Marker", smoke.phase3265Marker === "PHASE3265_FORTY_FOUR_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase3266Marker", smoke.phase3266Marker === "PHASE3266_FORTY_FOUR_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase3267Marker", smoke.phase3267Marker === "PHASE3267_FORTY_FOUR_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase3268Marker", smoke.phase3268Marker === "PHASE3268_FORTY_FOUR_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase3269Marker", smoke.phase3269Marker === "PHASE3269_FORTY_FOUR_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase3270Marker", smoke.phase3270Marker === "PHASE3270_FORTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase3271Marker", smoke.phase3271Marker === "PHASE3271_FORTY_FOUR_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase3272Marker", smoke.phase3272Marker === "PHASE3272_FORTY_FOUR_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase3273Marker", smoke.phase3273Marker === "PHASE3273_FORTY_FOUR_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase3274Marker", smoke.phase3274Marker === "PHASE3274_FORTY_FOUR_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase3275Marker", smoke.phase3275Marker === "PHASE3275_FORTY_FOUR_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase3276Marker", smoke.phase3276Marker === "PHASE3276_FORTY_FOUR_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase3277Marker", smoke.phase3277Marker === "PHASE3277_FORTY_FOUR_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase3278Marker", smoke.phase3278Marker === "PHASE3278_FORTY_FOUR_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase3279Marker", smoke.phase3279Marker === "PHASE3279_FORTY_FOUR_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase3280Marker", smoke.phase3280Marker === "PHASE3280_FORTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase3281Marker", smoke.phase3281Marker === "PHASE3281_FORTY_FOUR_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_phase3282Marker", smoke.phase3282Marker === "PHASE3282_FORTY_FOUR_TOOL_TARGET_THIRTY_SIX_OK");
  check("smoke_phase3283Marker", smoke.phase3283Marker === "PHASE3283_FORTY_FOUR_TOOL_TARGET_THIRTY_SEVEN_OK");
  check("smoke_phase3284Marker", smoke.phase3284Marker === "PHASE3284_FORTY_FOUR_TOOL_TARGET_THIRTY_EIGHT_OK");
  check("smoke_phase3285Marker", smoke.phase3285Marker === "PHASE3285_FORTY_FOUR_TOOL_TARGET_THIRTY_NINE_OK");
  check("smoke_phase3286Marker", smoke.phase3286Marker === "PHASE3286_FORTY_FOUR_TOOL_TARGET_FORTY_OK");
  check("smoke_phase3287Marker", smoke.phase3287Marker === "PHASE3287_FORTY_FOUR_TOOL_TARGET_FORTY_ONE_OK");
  check("smoke_phase3288Marker", smoke.phase3288Marker === "PHASE3288_FORTY_FOUR_TOOL_TARGET_FORTY_TWO_OK");
  check("smoke_phase3289Marker", smoke.phase3289Marker === "PHASE3289_FORTY_FOUR_TOOL_TARGET_FORTY_THREE_OK");
  check("smoke_phase3290Marker", smoke.phase3290Marker === "PHASE3290_FORTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase3247FortyFourMutationTargetOneStatus") || targetOne.includes("export function buildPhase3247FortyFourMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE3247_FORTY_FOUR_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase3248FortyFourMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase3248FortyFourMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE3248_FORTY_FOUR_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase3249FortyFourMutationTargetThreeStatus") || targetThree.includes("export function buildPhase3249FortyFourMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE3249_FORTY_FOUR_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase3250FortyFourMutationTargetFourStatus") || targetFour.includes("export function buildPhase3250FortyFourMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE3250_FORTY_FOUR_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase3251FortyFourMutationTargetFiveStatus") || targetFive.includes("export function buildPhase3251FortyFourMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE3251_FORTY_FOUR_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase3252FortyFourMutationTargetSixStatus") || targetSix.includes("export function buildPhase3252FortyFourMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE3252_FORTY_FOUR_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase3253FortyFourMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase3253FortyFourMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE3253_FORTY_FOUR_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase3254FortyFourMutationTargetEightStatus") || targetEight.includes("export function buildPhase3254FortyFourMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE3254_FORTY_FOUR_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase3255FortyFourMutationTargetNineStatus") || targetNine.includes("export function buildPhase3255FortyFourMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE3255_FORTY_FOUR_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase3256FortyFourMutationTargetTenStatus") || targetTen.includes("export function buildPhase3256FortyFourMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE3256_FORTY_FOUR_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase3257FortyFourMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase3257FortyFourMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE3257_FORTY_FOUR_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase3258FortyFourMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase3258FortyFourMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE3258_FORTY_FOUR_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase3259FortyFourMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase3259FortyFourMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE3259_FORTY_FOUR_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase3260FortyFourMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase3260FortyFourMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE3260_FORTY_FOUR_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase3261FortyFourMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase3261FortyFourMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE3261_FORTY_FOUR_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase3262FortyFourMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase3262FortyFourMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE3262_FORTY_FOUR_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase3263FortyFourMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase3263FortyFourMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE3263_FORTY_FOUR_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase3264FortyFourMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase3264FortyFourMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE3264_FORTY_FOUR_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase3265FortyFourMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase3265FortyFourMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE3265_FORTY_FOUR_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase3266FortyFourMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase3266FortyFourMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE3266_FORTY_FOUR_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase3267FortyFourMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase3267FortyFourMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE3267_FORTY_FOUR_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase3268FortyFourMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase3268FortyFourMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE3268_FORTY_FOUR_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase3269FortyFourMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase3269FortyFourMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE3269_FORTY_FOUR_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase3270FortyFourMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase3270FortyFourMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE3270_FORTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase3271FortyFourMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase3271FortyFourMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE3271_FORTY_FOUR_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase3272FortyFourMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase3272FortyFourMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE3272_FORTY_FOUR_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase3273FortyFourMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase3273FortyFourMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE3273_FORTY_FOUR_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase3274FortyFourMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase3274FortyFourMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE3274_FORTY_FOUR_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase3275FortyFourMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase3275FortyFourMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE3275_FORTY_FOUR_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase3276FortyFourMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase3276FortyFourMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE3276_FORTY_FOUR_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase3277FortyFourMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase3277FortyFourMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE3277_FORTY_FOUR_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase3278FortyFourMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase3278FortyFourMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE3278_FORTY_FOUR_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase3279FortyFourMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase3279FortyFourMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE3279_FORTY_FOUR_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase3280FortyFourMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase3280FortyFourMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE3280_FORTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase3281FortyFourMutationTargetThirtyFiveStatus") || targetThirtyFive.includes("export function buildPhase3281FortyFourMutationTargetThirtyFiveStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE3281_FORTY_FOUR_TOOL_TARGET_THIRTY_FIVE_OK"));
check("target-thirty-six_export", targetThirtySix.includes("buildPhase3282FortyFourMutationTargetThirtySixStatus") || targetThirtySix.includes("export function buildPhase3282FortyFourMutationTargetThirtySixStatus"));
check("target-thirty-six_marker", targetThirtySix.includes("PHASE3282_FORTY_FOUR_TOOL_TARGET_THIRTY_SIX_OK"));
check("target-thirty-seven_export", targetThirtySeven.includes("buildPhase3283FortyFourMutationTargetThirtySevenStatus") || targetThirtySeven.includes("export function buildPhase3283FortyFourMutationTargetThirtySevenStatus"));
check("target-thirty-seven_marker", targetThirtySeven.includes("PHASE3283_FORTY_FOUR_TOOL_TARGET_THIRTY_SEVEN_OK"));
check("target-thirty-eight_export", targetThirtyEight.includes("buildPhase3284FortyFourMutationTargetThirtyEightStatus") || targetThirtyEight.includes("export function buildPhase3284FortyFourMutationTargetThirtyEightStatus"));
check("target-thirty-eight_marker", targetThirtyEight.includes("PHASE3284_FORTY_FOUR_TOOL_TARGET_THIRTY_EIGHT_OK"));
check("target-thirty-nine_export", targetThirtyNine.includes("buildPhase3285FortyFourMutationTargetThirtyNineStatus") || targetThirtyNine.includes("export function buildPhase3285FortyFourMutationTargetThirtyNineStatus"));
check("target-thirty-nine_marker", targetThirtyNine.includes("PHASE3285_FORTY_FOUR_TOOL_TARGET_THIRTY_NINE_OK"));
check("target-forty_export", targetForty.includes("buildPhase3286FortyFourMutationTargetFortyStatus") || targetForty.includes("export function buildPhase3286FortyFourMutationTargetFortyStatus"));
check("target-forty_marker", targetForty.includes("PHASE3286_FORTY_FOUR_TOOL_TARGET_FORTY_OK"));
check("target-forty-one_export", targetFortyOne.includes("buildPhase3287FortyFourMutationTargetFortyOneStatus") || targetFortyOne.includes("export function buildPhase3287FortyFourMutationTargetFortyOneStatus"));
check("target-forty-one_marker", targetFortyOne.includes("PHASE3287_FORTY_FOUR_TOOL_TARGET_FORTY_ONE_OK"));
check("target-forty-two_export", targetFortyTwo.includes("buildPhase3288FortyFourMutationTargetFortyTwoStatus") || targetFortyTwo.includes("export function buildPhase3288FortyFourMutationTargetFortyTwoStatus"));
check("target-forty-two_marker", targetFortyTwo.includes("PHASE3288_FORTY_FOUR_TOOL_TARGET_FORTY_TWO_OK"));
check("target-forty-three_export", targetFortyThree.includes("buildPhase3289FortyFourMutationTargetFortyThreeStatus") || targetFortyThree.includes("export function buildPhase3289FortyFourMutationTargetFortyThreeStatus"));
check("target-forty-three_marker", targetFortyThree.includes("PHASE3289_FORTY_FOUR_TOOL_TARGET_FORTY_THREE_OK"));
check("target-forty-four_export", targetFortyFour.includes("buildPhase3290FortyFourMutationRuntimeStatus") || targetFortyFour.includes("export function buildPhase3290FortyFourMutationRuntimeStatus"));
check("target-forty-four_marker", targetFortyFour.includes("PHASE3290_FORTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_forty_four", docs.includes("controlled forty-four tool mutation"));
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
  phase3241Sealed: phase3241.recommendedSealed === true,
  fortyFourMutationReady: completed,
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
    targetFortyFourPath,
  ],
  changedFileCount: result?.changedFileCount ?? 44,
  fortyFourMutationApplied: result?.fortyFourMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localFortyFourSmokePassed: result?.localFortyFourSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, fortyFourMutationApplied: verifierResult.fortyFourMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localFortyFourSmokePassed: verifierResult.localFortyFourSmokePassed }, null, 2));
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
    "# Phase3242A-3290A Controlled Forty-Four Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- fortyFourMutationApplied: ${Boolean(result.fortyFourMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localFortyFourSmokePassed: ${Boolean(result.localFortyFourSmokePassed)}`,
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
