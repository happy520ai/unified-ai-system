import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase3147A-3193A-Controlled-Forty-Two-Tool-Mutation";
const runnerPath = "tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase3147-3193-controlled-forty-two-tool-mutation.md";
const approvalPath = "docs/phase3147-3193-controlled-forty-two-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase3152-forty-two-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase3153-forty-two-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase3154-forty-two-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase3155-forty-two-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase3156-forty-two-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase3157-forty-two-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase3158-forty-two-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase3159-forty-two-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase3160-forty-two-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase3161-forty-two-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase3162-forty-two-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase3163-forty-two-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase3164-forty-two-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase3165-forty-two-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase3166-forty-two-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase3167-forty-two-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase3168-forty-two-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase3169-forty-two-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase3170-forty-two-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase3171-forty-two-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase3172-forty-two-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase3173-forty-two-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase3174-forty-two-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase3175-forty-two-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase3176-forty-two-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase3177-forty-two-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase3178-forty-two-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase3179-forty-two-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase3180-forty-two-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase3181-forty-two-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase3182-forty-two-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase3183-forty-two-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase3184-forty-two-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase3185-forty-two-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase3186-forty-two-tool-mutation-target-thirty-five.proposal.diff";
const proposalThirtySixPath = "docs/phase3187-forty-two-tool-mutation-target-thirty-six.proposal.diff";
const proposalThirtySevenPath = "docs/phase3188-forty-two-tool-mutation-target-thirty-seven.proposal.diff";
const proposalThirtyEightPath = "docs/phase3189-forty-two-tool-mutation-target-thirty-eight.proposal.diff";
const proposalThirtyNinePath = "docs/phase3190-forty-two-tool-mutation-target-thirty-nine.proposal.diff";
const proposalFortyPath = "docs/phase3191-forty-two-tool-mutation-target-forty.proposal.diff";
const proposalFortyOnePath = "docs/phase3192-forty-two-tool-mutation-target-forty-one.proposal.diff";
const proposalFortyTwoPath = "docs/phase3193-forty-two-tool-mutation-target-forty-two.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase3147-3193-controlled-forty-two-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase3147-3193-controlled-forty-two-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase3147-3193-controlled-forty-two-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase3147-3193-controlled-forty-two-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase3147-3193-controlled-forty-two-tool-mutation/forty-two-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase3146 = readJson("apps/ai-gateway-service/evidence/phase3101-3146-controlled-forty-one-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase3147-3193-controlled-forty-two-tool-mutation"] === "node tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs --plan docs/phase3147-3193-controlled-forty-two-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase3147-3193-controlled-forty-two-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3157FortyTwoMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3158FortyTwoMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3159FortyTwoMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3160FortyTwoMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3161FortyTwoMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3162FortyTwoMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3163FortyTwoMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3164FortyTwoMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3165FortyTwoMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3166FortyTwoMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3167FortyTwoMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3168FortyTwoMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3169FortyTwoMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3170FortyTwoMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3171FortyTwoMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3172FortyTwoMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3173FortyTwoMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3174FortyTwoMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3175FortyTwoMutationTargetTwentyFourStatus())))\" && node -e \"import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3176FortyTwoMutationTargetTwentyFiveStatus())))\" && node -e \"import('./tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3177FortyTwoMutationTargetTwentySixStatus())))\" && node -e \"import('./tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3178FortyTwoMutationTargetTwentySevenStatus())))\" && node -e \"import('./tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3179FortyTwoMutationTargetTwentyEightStatus())))\" && node -e \"import('./tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3180FortyTwoMutationTargetTwentyNineStatus())))\" && node -e \"import('./tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3181FortyTwoMutationTargetThirtyStatus())))\" && node -e \"import('./tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3182FortyTwoMutationTargetThirtyOneStatus())))\" && node -e \"import('./tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3183FortyTwoMutationTargetThirtyTwoStatus())))\" && node -e \"import('./tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3184FortyTwoMutationTargetThirtyThreeStatus())))\" && node -e \"import('./tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3185FortyTwoMutationTargetThirtyFourStatus())))\" && node -e \"import('./tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3186FortyTwoMutationTargetThirtyFiveStatus())))\" && node -e \"import('./tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3187FortyTwoMutationTargetThirtySixStatus())))\" && node -e \"import('./tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3188FortyTwoMutationTargetThirtySevenStatus())))\" && node -e \"import('./tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3189FortyTwoMutationTargetThirtyEightStatus())))\" && node -e \"import('./tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3190FortyTwoMutationTargetThirtyNineStatus())))\" && node -e \"import('./tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3191FortyTwoMutationTargetFortyStatus())))\" && node -e \"import('./tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3192FortyTwoMutationTargetFortyOneStatus())))\" && node -e \"import('./tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3193FortyTwoMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase3147-3193-controlled-forty-two-tool-mutation"] === "node tools/phase3147_3193/validate-controlled-forty-two-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase3146_sealed", phase3146.recommendedSealed === true && phase3146.fortyOneMutationApplied === true);
check("result_exists", result !== null, "run apply:phase3147-3193-controlled-forty-two-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("forty_two_mutation_applied", result.fortyTwoMutationApplied === true);
  check("changed_file_count_forty_two", result.changedFileCount === 42);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localFortyTwoSmokePassed === true);
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
  check("rollback_restore_forty_two", rollback.rollbackAction === "restore-previous-content-forty-two");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_forty_two_entries", Array.isArray(rollback.files) && rollback.files.length === 42);
}

if (smoke) {
  check("smoke_phase3152Marker", smoke.phase3152Marker === "PHASE3152_FORTY_TWO_TOOL_TARGET_ONE_OK");
  check("smoke_phase3153Marker", smoke.phase3153Marker === "PHASE3153_FORTY_TWO_TOOL_TARGET_TWO_OK");
  check("smoke_phase3154Marker", smoke.phase3154Marker === "PHASE3154_FORTY_TWO_TOOL_TARGET_THREE_OK");
  check("smoke_phase3155Marker", smoke.phase3155Marker === "PHASE3155_FORTY_TWO_TOOL_TARGET_FOUR_OK");
  check("smoke_phase3156Marker", smoke.phase3156Marker === "PHASE3156_FORTY_TWO_TOOL_TARGET_FIVE_OK");
  check("smoke_phase3157Marker", smoke.phase3157Marker === "PHASE3157_FORTY_TWO_TOOL_TARGET_SIX_OK");
  check("smoke_phase3158Marker", smoke.phase3158Marker === "PHASE3158_FORTY_TWO_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase3159Marker", smoke.phase3159Marker === "PHASE3159_FORTY_TWO_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase3160Marker", smoke.phase3160Marker === "PHASE3160_FORTY_TWO_TOOL_TARGET_NINE_OK");
  check("smoke_phase3161Marker", smoke.phase3161Marker === "PHASE3161_FORTY_TWO_TOOL_TARGET_TEN_OK");
  check("smoke_phase3162Marker", smoke.phase3162Marker === "PHASE3162_FORTY_TWO_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase3163Marker", smoke.phase3163Marker === "PHASE3163_FORTY_TWO_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase3164Marker", smoke.phase3164Marker === "PHASE3164_FORTY_TWO_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase3165Marker", smoke.phase3165Marker === "PHASE3165_FORTY_TWO_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase3166Marker", smoke.phase3166Marker === "PHASE3166_FORTY_TWO_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase3167Marker", smoke.phase3167Marker === "PHASE3167_FORTY_TWO_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase3168Marker", smoke.phase3168Marker === "PHASE3168_FORTY_TWO_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase3169Marker", smoke.phase3169Marker === "PHASE3169_FORTY_TWO_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase3170Marker", smoke.phase3170Marker === "PHASE3170_FORTY_TWO_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase3171Marker", smoke.phase3171Marker === "PHASE3171_FORTY_TWO_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase3172Marker", smoke.phase3172Marker === "PHASE3172_FORTY_TWO_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase3173Marker", smoke.phase3173Marker === "PHASE3173_FORTY_TWO_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase3174Marker", smoke.phase3174Marker === "PHASE3174_FORTY_TWO_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase3175Marker", smoke.phase3175Marker === "PHASE3175_FORTY_TWO_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase3176Marker", smoke.phase3176Marker === "PHASE3176_FORTY_TWO_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase3177Marker", smoke.phase3177Marker === "PHASE3177_FORTY_TWO_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase3178Marker", smoke.phase3178Marker === "PHASE3178_FORTY_TWO_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase3179Marker", smoke.phase3179Marker === "PHASE3179_FORTY_TWO_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase3180Marker", smoke.phase3180Marker === "PHASE3180_FORTY_TWO_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase3181Marker", smoke.phase3181Marker === "PHASE3181_FORTY_TWO_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase3182Marker", smoke.phase3182Marker === "PHASE3182_FORTY_TWO_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase3183Marker", smoke.phase3183Marker === "PHASE3183_FORTY_TWO_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase3184Marker", smoke.phase3184Marker === "PHASE3184_FORTY_TWO_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase3185Marker", smoke.phase3185Marker === "PHASE3185_FORTY_TWO_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase3186Marker", smoke.phase3186Marker === "PHASE3186_FORTY_TWO_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_phase3187Marker", smoke.phase3187Marker === "PHASE3187_FORTY_TWO_TOOL_TARGET_THIRTY_SIX_OK");
  check("smoke_phase3188Marker", smoke.phase3188Marker === "PHASE3188_FORTY_TWO_TOOL_TARGET_THIRTY_SEVEN_OK");
  check("smoke_phase3189Marker", smoke.phase3189Marker === "PHASE3189_FORTY_TWO_TOOL_TARGET_THIRTY_EIGHT_OK");
  check("smoke_phase3190Marker", smoke.phase3190Marker === "PHASE3190_FORTY_TWO_TOOL_TARGET_THIRTY_NINE_OK");
  check("smoke_phase3191Marker", smoke.phase3191Marker === "PHASE3191_FORTY_TWO_TOOL_TARGET_FORTY_OK");
  check("smoke_phase3192Marker", smoke.phase3192Marker === "PHASE3192_FORTY_TWO_TOOL_TARGET_FORTY_ONE_OK");
  check("smoke_phase3193Marker", smoke.phase3193Marker === "PHASE3193_FORTY_TWO_TOOL_TARGET_FORTY_TWO_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase3152FortyTwoMutationTargetOneStatus") || targetOne.includes("export function buildPhase3152FortyTwoMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE3152_FORTY_TWO_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase3153FortyTwoMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase3153FortyTwoMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE3153_FORTY_TWO_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase3154FortyTwoMutationTargetThreeStatus") || targetThree.includes("export function buildPhase3154FortyTwoMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE3154_FORTY_TWO_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase3155FortyTwoMutationTargetFourStatus") || targetFour.includes("export function buildPhase3155FortyTwoMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE3155_FORTY_TWO_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase3156FortyTwoMutationTargetFiveStatus") || targetFive.includes("export function buildPhase3156FortyTwoMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE3156_FORTY_TWO_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase3157FortyTwoMutationTargetSixStatus") || targetSix.includes("export function buildPhase3157FortyTwoMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE3157_FORTY_TWO_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase3158FortyTwoMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase3158FortyTwoMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE3158_FORTY_TWO_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase3159FortyTwoMutationTargetEightStatus") || targetEight.includes("export function buildPhase3159FortyTwoMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE3159_FORTY_TWO_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase3160FortyTwoMutationTargetNineStatus") || targetNine.includes("export function buildPhase3160FortyTwoMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE3160_FORTY_TWO_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase3161FortyTwoMutationTargetTenStatus") || targetTen.includes("export function buildPhase3161FortyTwoMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE3161_FORTY_TWO_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase3162FortyTwoMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase3162FortyTwoMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE3162_FORTY_TWO_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase3163FortyTwoMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase3163FortyTwoMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE3163_FORTY_TWO_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase3164FortyTwoMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase3164FortyTwoMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE3164_FORTY_TWO_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase3165FortyTwoMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase3165FortyTwoMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE3165_FORTY_TWO_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase3166FortyTwoMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase3166FortyTwoMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE3166_FORTY_TWO_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase3167FortyTwoMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase3167FortyTwoMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE3167_FORTY_TWO_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase3168FortyTwoMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase3168FortyTwoMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE3168_FORTY_TWO_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase3169FortyTwoMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase3169FortyTwoMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE3169_FORTY_TWO_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase3170FortyTwoMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase3170FortyTwoMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE3170_FORTY_TWO_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase3171FortyTwoMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase3171FortyTwoMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE3171_FORTY_TWO_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase3172FortyTwoMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase3172FortyTwoMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE3172_FORTY_TWO_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase3173FortyTwoMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase3173FortyTwoMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE3173_FORTY_TWO_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase3174FortyTwoMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase3174FortyTwoMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE3174_FORTY_TWO_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase3175FortyTwoMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase3175FortyTwoMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE3175_FORTY_TWO_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase3176FortyTwoMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase3176FortyTwoMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE3176_FORTY_TWO_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase3177FortyTwoMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase3177FortyTwoMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE3177_FORTY_TWO_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase3178FortyTwoMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase3178FortyTwoMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE3178_FORTY_TWO_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase3179FortyTwoMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase3179FortyTwoMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE3179_FORTY_TWO_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase3180FortyTwoMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase3180FortyTwoMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE3180_FORTY_TWO_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase3181FortyTwoMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase3181FortyTwoMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE3181_FORTY_TWO_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase3182FortyTwoMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase3182FortyTwoMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE3182_FORTY_TWO_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase3183FortyTwoMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase3183FortyTwoMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE3183_FORTY_TWO_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase3184FortyTwoMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase3184FortyTwoMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE3184_FORTY_TWO_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase3185FortyTwoMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase3185FortyTwoMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE3185_FORTY_TWO_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase3186FortyTwoMutationTargetThirtyFiveStatus") || targetThirtyFive.includes("export function buildPhase3186FortyTwoMutationTargetThirtyFiveStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE3186_FORTY_TWO_TOOL_TARGET_THIRTY_FIVE_OK"));
check("target-thirty-six_export", targetThirtySix.includes("buildPhase3187FortyTwoMutationTargetThirtySixStatus") || targetThirtySix.includes("export function buildPhase3187FortyTwoMutationTargetThirtySixStatus"));
check("target-thirty-six_marker", targetThirtySix.includes("PHASE3187_FORTY_TWO_TOOL_TARGET_THIRTY_SIX_OK"));
check("target-thirty-seven_export", targetThirtySeven.includes("buildPhase3188FortyTwoMutationTargetThirtySevenStatus") || targetThirtySeven.includes("export function buildPhase3188FortyTwoMutationTargetThirtySevenStatus"));
check("target-thirty-seven_marker", targetThirtySeven.includes("PHASE3188_FORTY_TWO_TOOL_TARGET_THIRTY_SEVEN_OK"));
check("target-thirty-eight_export", targetThirtyEight.includes("buildPhase3189FortyTwoMutationTargetThirtyEightStatus") || targetThirtyEight.includes("export function buildPhase3189FortyTwoMutationTargetThirtyEightStatus"));
check("target-thirty-eight_marker", targetThirtyEight.includes("PHASE3189_FORTY_TWO_TOOL_TARGET_THIRTY_EIGHT_OK"));
check("target-thirty-nine_export", targetThirtyNine.includes("buildPhase3190FortyTwoMutationTargetThirtyNineStatus") || targetThirtyNine.includes("export function buildPhase3190FortyTwoMutationTargetThirtyNineStatus"));
check("target-thirty-nine_marker", targetThirtyNine.includes("PHASE3190_FORTY_TWO_TOOL_TARGET_THIRTY_NINE_OK"));
check("target-forty_export", targetForty.includes("buildPhase3191FortyTwoMutationTargetFortyStatus") || targetForty.includes("export function buildPhase3191FortyTwoMutationTargetFortyStatus"));
check("target-forty_marker", targetForty.includes("PHASE3191_FORTY_TWO_TOOL_TARGET_FORTY_OK"));
check("target-forty-one_export", targetFortyOne.includes("buildPhase3192FortyTwoMutationTargetFortyOneStatus") || targetFortyOne.includes("export function buildPhase3192FortyTwoMutationTargetFortyOneStatus"));
check("target-forty-one_marker", targetFortyOne.includes("PHASE3192_FORTY_TWO_TOOL_TARGET_FORTY_ONE_OK"));
check("target-forty-two_export", targetFortyTwo.includes("buildPhase3193FortyTwoMutationRuntimeStatus") || targetFortyTwo.includes("export function buildPhase3193FortyTwoMutationRuntimeStatus"));
check("target-forty-two_marker", targetFortyTwo.includes("PHASE3193_FORTY_TWO_TOOL_TARGET_FORTY_TWO_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_forty_two", docs.includes("controlled forty-two tool mutation"));
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
  phase3146Sealed: phase3146.recommendedSealed === true,
  fortyTwoMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 42,
  fortyTwoMutationApplied: result?.fortyTwoMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localFortyTwoSmokePassed: result?.localFortyTwoSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, fortyTwoMutationApplied: verifierResult.fortyTwoMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localFortyTwoSmokePassed: verifierResult.localFortyTwoSmokePassed }, null, 2));
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
    "# Phase3147A-3193A Controlled Forty-Two Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- fortyTwoMutationApplied: ${Boolean(result.fortyTwoMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localFortyTwoSmokePassed: ${Boolean(result.localFortyTwoSmokePassed)}`,
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
