import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase3291A-3340A-Controlled-Forty-Five-Tool-Mutation";
const runnerPath = "tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase3291-3340-controlled-forty-five-tool-mutation.md";
const approvalPath = "docs/phase3291-3340-controlled-forty-five-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase3296-forty-five-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase3297-forty-five-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase3298-forty-five-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase3299-forty-five-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase3300-forty-five-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase3301-forty-five-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase3302-forty-five-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase3303-forty-five-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase3304-forty-five-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase3305-forty-five-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase3306-forty-five-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase3307-forty-five-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase3308-forty-five-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase3309-forty-five-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase3310-forty-five-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase3311-forty-five-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase3312-forty-five-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase3313-forty-five-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase3314-forty-five-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase3315-forty-five-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase3316-forty-five-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase3317-forty-five-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase3318-forty-five-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase3319-forty-five-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase3320-forty-five-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase3321-forty-five-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase3322-forty-five-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase3323-forty-five-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase3324-forty-five-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase3325-forty-five-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase3326-forty-five-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase3327-forty-five-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase3328-forty-five-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase3329-forty-five-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase3330-forty-five-tool-mutation-target-thirty-five.proposal.diff";
const proposalThirtySixPath = "docs/phase3331-forty-five-tool-mutation-target-thirty-six.proposal.diff";
const proposalThirtySevenPath = "docs/phase3332-forty-five-tool-mutation-target-thirty-seven.proposal.diff";
const proposalThirtyEightPath = "docs/phase3333-forty-five-tool-mutation-target-thirty-eight.proposal.diff";
const proposalThirtyNinePath = "docs/phase3334-forty-five-tool-mutation-target-thirty-nine.proposal.diff";
const proposalFortyPath = "docs/phase3335-forty-five-tool-mutation-target-forty.proposal.diff";
const proposalFortyOnePath = "docs/phase3336-forty-five-tool-mutation-target-forty-one.proposal.diff";
const proposalFortyTwoPath = "docs/phase3337-forty-five-tool-mutation-target-forty-two.proposal.diff";
const proposalFortyThreePath = "docs/phase3338-forty-five-tool-mutation-target-forty-three.proposal.diff";
const proposalFortyFourPath = "docs/phase3339-forty-five-tool-mutation-target-forty-four.proposal.diff";
const proposalFortyFivePath = "docs/phase3340-forty-five-tool-mutation-target-forty-five.proposal.diff";
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
const targetFortyFivePath = "tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase3291-3340-controlled-forty-five-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase3291-3340-controlled-forty-five-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase3291-3340-controlled-forty-five-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase3291-3340-controlled-forty-five-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase3291-3340-controlled-forty-five-tool-mutation/forty-five-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase3290 = readJson("apps/ai-gateway-service/evidence/phase3242-3290-controlled-forty-four-tool-mutation/result.json") || {};
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
const targetFortyFive = existsSync(resolve(targetFortyFivePath)) ? readText(targetFortyFivePath) : "";
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
check("proposal_forty-five_exists", existsSync(resolve(proposalFortyFivePath)));
check("package_apply_script_registered", packageJson.scripts?.["apply:phase3291-3340-controlled-forty-five-tool-mutation"] === "node tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs --plan docs/phase3291-3340-controlled-forty-five-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase3291-3340-controlled-forty-five-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3301FortyFiveMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3302FortyFiveMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3303FortyFiveMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3304FortyFiveMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3305FortyFiveMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3306FortyFiveMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3307FortyFiveMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3308FortyFiveMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3309FortyFiveMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3310FortyFiveMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3311FortyFiveMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3312FortyFiveMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3313FortyFiveMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3314FortyFiveMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3315FortyFiveMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3316FortyFiveMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3317FortyFiveMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3318FortyFiveMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3319FortyFiveMutationTargetTwentyFourStatus())))\" && node -e \"import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3320FortyFiveMutationTargetTwentyFiveStatus())))\" && node -e \"import('./tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3321FortyFiveMutationTargetTwentySixStatus())))\" && node -e \"import('./tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3322FortyFiveMutationTargetTwentySevenStatus())))\" && node -e \"import('./tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3323FortyFiveMutationTargetTwentyEightStatus())))\" && node -e \"import('./tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3324FortyFiveMutationTargetTwentyNineStatus())))\" && node -e \"import('./tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3325FortyFiveMutationTargetThirtyStatus())))\" && node -e \"import('./tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3326FortyFiveMutationTargetThirtyOneStatus())))\" && node -e \"import('./tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3327FortyFiveMutationTargetThirtyTwoStatus())))\" && node -e \"import('./tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3328FortyFiveMutationTargetThirtyThreeStatus())))\" && node -e \"import('./tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3329FortyFiveMutationTargetThirtyFourStatus())))\" && node -e \"import('./tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3330FortyFiveMutationTargetThirtyFiveStatus())))\" && node -e \"import('./tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3331FortyFiveMutationTargetThirtySixStatus())))\" && node -e \"import('./tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3332FortyFiveMutationTargetThirtySevenStatus())))\" && node -e \"import('./tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3333FortyFiveMutationTargetThirtyEightStatus())))\" && node -e \"import('./tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3334FortyFiveMutationTargetThirtyNineStatus())))\" && node -e \"import('./tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3335FortyFiveMutationTargetFortyStatus())))\" && node -e \"import('./tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3336FortyFiveMutationTargetFortyOneStatus())))\" && node -e \"import('./tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3337FortyFiveMutationTargetFortyTwoStatus())))\" && node -e \"import('./tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3338FortyFiveMutationTargetFortyThreeStatus())))\" && node -e \"import('./tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3339FortyFiveMutationTargetFortyFourStatus())))\" && node -e \"import('./tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3340FortyFiveMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase3291-3340-controlled-forty-five-tool-mutation"] === "node tools/phase3291_3340/validate-controlled-forty-five-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase3290_sealed", phase3290.recommendedSealed === true && phase3290.fortyFourMutationApplied === true);
check("result_exists", result !== null, "run apply:phase3291-3340-controlled-forty-five-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("forty_five_mutation_applied", result.fortyFiveMutationApplied === true);
  check("changed_file_count_forty_five", result.changedFileCount === 45);
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
    && result.changedFiles.includes(targetFortyFivePath)
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localFortyFiveSmokePassed === true);
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
  check("rollback_restore_forty_five", rollback.rollbackAction === "restore-previous-content-forty-five");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_forty_five_entries", Array.isArray(rollback.files) && rollback.files.length === 45);
}

if (smoke) {
  check("smoke_phase3296Marker", smoke.phase3296Marker === "PHASE3296_FORTY_FIVE_TOOL_TARGET_ONE_OK");
  check("smoke_phase3297Marker", smoke.phase3297Marker === "PHASE3297_FORTY_FIVE_TOOL_TARGET_TWO_OK");
  check("smoke_phase3298Marker", smoke.phase3298Marker === "PHASE3298_FORTY_FIVE_TOOL_TARGET_THREE_OK");
  check("smoke_phase3299Marker", smoke.phase3299Marker === "PHASE3299_FORTY_FIVE_TOOL_TARGET_FOUR_OK");
  check("smoke_phase3300Marker", smoke.phase3300Marker === "PHASE3300_FORTY_FIVE_TOOL_TARGET_FIVE_OK");
  check("smoke_phase3301Marker", smoke.phase3301Marker === "PHASE3301_FORTY_FIVE_TOOL_TARGET_SIX_OK");
  check("smoke_phase3302Marker", smoke.phase3302Marker === "PHASE3302_FORTY_FIVE_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase3303Marker", smoke.phase3303Marker === "PHASE3303_FORTY_FIVE_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase3304Marker", smoke.phase3304Marker === "PHASE3304_FORTY_FIVE_TOOL_TARGET_NINE_OK");
  check("smoke_phase3305Marker", smoke.phase3305Marker === "PHASE3305_FORTY_FIVE_TOOL_TARGET_TEN_OK");
  check("smoke_phase3306Marker", smoke.phase3306Marker === "PHASE3306_FORTY_FIVE_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase3307Marker", smoke.phase3307Marker === "PHASE3307_FORTY_FIVE_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase3308Marker", smoke.phase3308Marker === "PHASE3308_FORTY_FIVE_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase3309Marker", smoke.phase3309Marker === "PHASE3309_FORTY_FIVE_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase3310Marker", smoke.phase3310Marker === "PHASE3310_FORTY_FIVE_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase3311Marker", smoke.phase3311Marker === "PHASE3311_FORTY_FIVE_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase3312Marker", smoke.phase3312Marker === "PHASE3312_FORTY_FIVE_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase3313Marker", smoke.phase3313Marker === "PHASE3313_FORTY_FIVE_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase3314Marker", smoke.phase3314Marker === "PHASE3314_FORTY_FIVE_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase3315Marker", smoke.phase3315Marker === "PHASE3315_FORTY_FIVE_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase3316Marker", smoke.phase3316Marker === "PHASE3316_FORTY_FIVE_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase3317Marker", smoke.phase3317Marker === "PHASE3317_FORTY_FIVE_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase3318Marker", smoke.phase3318Marker === "PHASE3318_FORTY_FIVE_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase3319Marker", smoke.phase3319Marker === "PHASE3319_FORTY_FIVE_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase3320Marker", smoke.phase3320Marker === "PHASE3320_FORTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase3321Marker", smoke.phase3321Marker === "PHASE3321_FORTY_FIVE_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase3322Marker", smoke.phase3322Marker === "PHASE3322_FORTY_FIVE_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase3323Marker", smoke.phase3323Marker === "PHASE3323_FORTY_FIVE_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase3324Marker", smoke.phase3324Marker === "PHASE3324_FORTY_FIVE_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase3325Marker", smoke.phase3325Marker === "PHASE3325_FORTY_FIVE_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase3326Marker", smoke.phase3326Marker === "PHASE3326_FORTY_FIVE_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase3327Marker", smoke.phase3327Marker === "PHASE3327_FORTY_FIVE_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase3328Marker", smoke.phase3328Marker === "PHASE3328_FORTY_FIVE_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase3329Marker", smoke.phase3329Marker === "PHASE3329_FORTY_FIVE_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase3330Marker", smoke.phase3330Marker === "PHASE3330_FORTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_phase3331Marker", smoke.phase3331Marker === "PHASE3331_FORTY_FIVE_TOOL_TARGET_THIRTY_SIX_OK");
  check("smoke_phase3332Marker", smoke.phase3332Marker === "PHASE3332_FORTY_FIVE_TOOL_TARGET_THIRTY_SEVEN_OK");
  check("smoke_phase3333Marker", smoke.phase3333Marker === "PHASE3333_FORTY_FIVE_TOOL_TARGET_THIRTY_EIGHT_OK");
  check("smoke_phase3334Marker", smoke.phase3334Marker === "PHASE3334_FORTY_FIVE_TOOL_TARGET_THIRTY_NINE_OK");
  check("smoke_phase3335Marker", smoke.phase3335Marker === "PHASE3335_FORTY_FIVE_TOOL_TARGET_FORTY_OK");
  check("smoke_phase3336Marker", smoke.phase3336Marker === "PHASE3336_FORTY_FIVE_TOOL_TARGET_FORTY_ONE_OK");
  check("smoke_phase3337Marker", smoke.phase3337Marker === "PHASE3337_FORTY_FIVE_TOOL_TARGET_FORTY_TWO_OK");
  check("smoke_phase3338Marker", smoke.phase3338Marker === "PHASE3338_FORTY_FIVE_TOOL_TARGET_FORTY_THREE_OK");
  check("smoke_phase3339Marker", smoke.phase3339Marker === "PHASE3339_FORTY_FIVE_TOOL_TARGET_FORTY_FOUR_OK");
  check("smoke_phase3340Marker", smoke.phase3340Marker === "PHASE3340_FORTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase3296FortyFiveMutationTargetOneStatus") || targetOne.includes("export function buildPhase3296FortyFiveMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE3296_FORTY_FIVE_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase3297FortyFiveMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase3297FortyFiveMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE3297_FORTY_FIVE_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase3298FortyFiveMutationTargetThreeStatus") || targetThree.includes("export function buildPhase3298FortyFiveMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE3298_FORTY_FIVE_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase3299FortyFiveMutationTargetFourStatus") || targetFour.includes("export function buildPhase3299FortyFiveMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE3299_FORTY_FIVE_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase3300FortyFiveMutationTargetFiveStatus") || targetFive.includes("export function buildPhase3300FortyFiveMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE3300_FORTY_FIVE_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase3301FortyFiveMutationTargetSixStatus") || targetSix.includes("export function buildPhase3301FortyFiveMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE3301_FORTY_FIVE_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase3302FortyFiveMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase3302FortyFiveMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE3302_FORTY_FIVE_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase3303FortyFiveMutationTargetEightStatus") || targetEight.includes("export function buildPhase3303FortyFiveMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE3303_FORTY_FIVE_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase3304FortyFiveMutationTargetNineStatus") || targetNine.includes("export function buildPhase3304FortyFiveMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE3304_FORTY_FIVE_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase3305FortyFiveMutationTargetTenStatus") || targetTen.includes("export function buildPhase3305FortyFiveMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE3305_FORTY_FIVE_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase3306FortyFiveMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase3306FortyFiveMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE3306_FORTY_FIVE_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase3307FortyFiveMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase3307FortyFiveMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE3307_FORTY_FIVE_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase3308FortyFiveMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase3308FortyFiveMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE3308_FORTY_FIVE_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase3309FortyFiveMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase3309FortyFiveMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE3309_FORTY_FIVE_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase3310FortyFiveMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase3310FortyFiveMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE3310_FORTY_FIVE_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase3311FortyFiveMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase3311FortyFiveMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE3311_FORTY_FIVE_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase3312FortyFiveMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase3312FortyFiveMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE3312_FORTY_FIVE_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase3313FortyFiveMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase3313FortyFiveMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE3313_FORTY_FIVE_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase3314FortyFiveMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase3314FortyFiveMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE3314_FORTY_FIVE_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase3315FortyFiveMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase3315FortyFiveMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE3315_FORTY_FIVE_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase3316FortyFiveMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase3316FortyFiveMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE3316_FORTY_FIVE_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase3317FortyFiveMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase3317FortyFiveMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE3317_FORTY_FIVE_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase3318FortyFiveMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase3318FortyFiveMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE3318_FORTY_FIVE_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase3319FortyFiveMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase3319FortyFiveMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE3319_FORTY_FIVE_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase3320FortyFiveMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase3320FortyFiveMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE3320_FORTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase3321FortyFiveMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase3321FortyFiveMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE3321_FORTY_FIVE_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase3322FortyFiveMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase3322FortyFiveMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE3322_FORTY_FIVE_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase3323FortyFiveMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase3323FortyFiveMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE3323_FORTY_FIVE_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase3324FortyFiveMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase3324FortyFiveMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE3324_FORTY_FIVE_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase3325FortyFiveMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase3325FortyFiveMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE3325_FORTY_FIVE_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase3326FortyFiveMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase3326FortyFiveMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE3326_FORTY_FIVE_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase3327FortyFiveMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase3327FortyFiveMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE3327_FORTY_FIVE_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase3328FortyFiveMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase3328FortyFiveMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE3328_FORTY_FIVE_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase3329FortyFiveMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase3329FortyFiveMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE3329_FORTY_FIVE_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase3330FortyFiveMutationTargetThirtyFiveStatus") || targetThirtyFive.includes("export function buildPhase3330FortyFiveMutationTargetThirtyFiveStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE3330_FORTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK"));
check("target-thirty-six_export", targetThirtySix.includes("buildPhase3331FortyFiveMutationTargetThirtySixStatus") || targetThirtySix.includes("export function buildPhase3331FortyFiveMutationTargetThirtySixStatus"));
check("target-thirty-six_marker", targetThirtySix.includes("PHASE3331_FORTY_FIVE_TOOL_TARGET_THIRTY_SIX_OK"));
check("target-thirty-seven_export", targetThirtySeven.includes("buildPhase3332FortyFiveMutationTargetThirtySevenStatus") || targetThirtySeven.includes("export function buildPhase3332FortyFiveMutationTargetThirtySevenStatus"));
check("target-thirty-seven_marker", targetThirtySeven.includes("PHASE3332_FORTY_FIVE_TOOL_TARGET_THIRTY_SEVEN_OK"));
check("target-thirty-eight_export", targetThirtyEight.includes("buildPhase3333FortyFiveMutationTargetThirtyEightStatus") || targetThirtyEight.includes("export function buildPhase3333FortyFiveMutationTargetThirtyEightStatus"));
check("target-thirty-eight_marker", targetThirtyEight.includes("PHASE3333_FORTY_FIVE_TOOL_TARGET_THIRTY_EIGHT_OK"));
check("target-thirty-nine_export", targetThirtyNine.includes("buildPhase3334FortyFiveMutationTargetThirtyNineStatus") || targetThirtyNine.includes("export function buildPhase3334FortyFiveMutationTargetThirtyNineStatus"));
check("target-thirty-nine_marker", targetThirtyNine.includes("PHASE3334_FORTY_FIVE_TOOL_TARGET_THIRTY_NINE_OK"));
check("target-forty_export", targetForty.includes("buildPhase3335FortyFiveMutationTargetFortyStatus") || targetForty.includes("export function buildPhase3335FortyFiveMutationTargetFortyStatus"));
check("target-forty_marker", targetForty.includes("PHASE3335_FORTY_FIVE_TOOL_TARGET_FORTY_OK"));
check("target-forty-one_export", targetFortyOne.includes("buildPhase3336FortyFiveMutationTargetFortyOneStatus") || targetFortyOne.includes("export function buildPhase3336FortyFiveMutationTargetFortyOneStatus"));
check("target-forty-one_marker", targetFortyOne.includes("PHASE3336_FORTY_FIVE_TOOL_TARGET_FORTY_ONE_OK"));
check("target-forty-two_export", targetFortyTwo.includes("buildPhase3337FortyFiveMutationTargetFortyTwoStatus") || targetFortyTwo.includes("export function buildPhase3337FortyFiveMutationTargetFortyTwoStatus"));
check("target-forty-two_marker", targetFortyTwo.includes("PHASE3337_FORTY_FIVE_TOOL_TARGET_FORTY_TWO_OK"));
check("target-forty-three_export", targetFortyThree.includes("buildPhase3338FortyFiveMutationTargetFortyThreeStatus") || targetFortyThree.includes("export function buildPhase3338FortyFiveMutationTargetFortyThreeStatus"));
check("target-forty-three_marker", targetFortyThree.includes("PHASE3338_FORTY_FIVE_TOOL_TARGET_FORTY_THREE_OK"));
check("target-forty-four_export", targetFortyFour.includes("buildPhase3339FortyFiveMutationTargetFortyFourStatus") || targetFortyFour.includes("export function buildPhase3339FortyFiveMutationTargetFortyFourStatus"));
check("target-forty-four_marker", targetFortyFour.includes("PHASE3339_FORTY_FIVE_TOOL_TARGET_FORTY_FOUR_OK"));
check("target-forty-five_export", targetFortyFive.includes("buildPhase3340FortyFiveMutationRuntimeStatus") || targetFortyFive.includes("export function buildPhase3340FortyFiveMutationRuntimeStatus"));
check("target-forty-five_marker", targetFortyFive.includes("PHASE3340_FORTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_forty_five", docs.includes("controlled forty-five tool mutation"));
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
  phase3290Sealed: phase3290.recommendedSealed === true,
  fortyFiveMutationReady: completed,
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
    targetFortyFivePath,
  ],
  changedFileCount: result?.changedFileCount ?? 45,
  fortyFiveMutationApplied: result?.fortyFiveMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localFortyFiveSmokePassed: result?.localFortyFiveSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, fortyFiveMutationApplied: verifierResult.fortyFiveMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localFortyFiveSmokePassed: verifierResult.localFortyFiveSmokePassed }, null, 2));
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
    "# Phase3291A-3340A Controlled Forty-Five Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- fortyFiveMutationApplied: ${Boolean(result.fortyFiveMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localFortyFiveSmokePassed: ${Boolean(result.localFortyFiveSmokePassed)}`,
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
