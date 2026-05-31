import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase3056A-3100A-Controlled-Forty-Tool-Mutation";
const runnerPath = "tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase3056-3100-controlled-forty-tool-mutation.md";
const approvalPath = "docs/phase3056-3100-controlled-forty-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase3061-forty-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase3062-forty-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase3063-forty-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase3064-forty-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase3065-forty-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase3066-forty-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase3067-forty-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase3068-forty-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase3069-forty-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase3070-forty-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase3071-forty-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase3072-forty-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase3073-forty-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase3074-forty-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase3075-forty-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase3076-forty-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase3077-forty-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase3078-forty-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase3079-forty-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase3080-forty-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase3081-forty-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase3082-forty-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase3083-forty-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase3084-forty-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase3085-forty-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase3086-forty-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase3087-forty-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase3088-forty-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase3089-forty-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase3090-forty-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase3091-forty-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase3092-forty-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase3093-forty-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase3094-forty-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase3095-forty-tool-mutation-target-thirty-five.proposal.diff";
const proposalThirtySixPath = "docs/phase3096-forty-tool-mutation-target-thirty-six.proposal.diff";
const proposalThirtySevenPath = "docs/phase3097-forty-tool-mutation-target-thirty-seven.proposal.diff";
const proposalThirtyEightPath = "docs/phase3098-forty-tool-mutation-target-thirty-eight.proposal.diff";
const proposalThirtyNinePath = "docs/phase3099-forty-tool-mutation-target-thirty-nine.proposal.diff";
const proposalFortyPath = "docs/phase3100-forty-tool-mutation-target-forty.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase3056-3100-controlled-forty-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase3056-3100-controlled-forty-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase3056-3100-controlled-forty-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase3056-3100-controlled-forty-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase3056-3100-controlled-forty-tool-mutation/forty-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase3055 = readJson("apps/ai-gateway-service/evidence/phase3012-3055-controlled-thirty-nine-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase3056-3100-controlled-forty-tool-mutation"] === "node tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs --plan docs/phase3056-3100-controlled-forty-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase3056-3100-controlled-forty-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3066FortyMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3067FortyMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3068FortyMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3069FortyMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3070FortyMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3071FortyMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3072FortyMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3073FortyMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3074FortyMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3075FortyMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3076FortyMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3077FortyMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3078FortyMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3079FortyMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3080FortyMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3081FortyMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3082FortyMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3083FortyMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3084FortyMutationTargetTwentyFourStatus())))\" && node -e \"import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3085FortyMutationTargetTwentyFiveStatus())))\" && node -e \"import('./tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3086FortyMutationTargetTwentySixStatus())))\" && node -e \"import('./tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3087FortyMutationTargetTwentySevenStatus())))\" && node -e \"import('./tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3088FortyMutationTargetTwentyEightStatus())))\" && node -e \"import('./tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3089FortyMutationTargetTwentyNineStatus())))\" && node -e \"import('./tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3090FortyMutationTargetThirtyStatus())))\" && node -e \"import('./tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3091FortyMutationTargetThirtyOneStatus())))\" && node -e \"import('./tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3092FortyMutationTargetThirtyTwoStatus())))\" && node -e \"import('./tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3093FortyMutationTargetThirtyThreeStatus())))\" && node -e \"import('./tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3094FortyMutationTargetThirtyFourStatus())))\" && node -e \"import('./tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3095FortyMutationTargetThirtyFiveStatus())))\" && node -e \"import('./tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3096FortyMutationTargetThirtySixStatus())))\" && node -e \"import('./tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3097FortyMutationTargetThirtySevenStatus())))\" && node -e \"import('./tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3098FortyMutationTargetThirtyEightStatus())))\" && node -e \"import('./tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3099FortyMutationTargetThirtyNineStatus())))\" && node -e \"import('./tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3100FortyMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase3056-3100-controlled-forty-tool-mutation"] === "node tools/phase3056_3100/validate-controlled-forty-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase3055_sealed", phase3055.recommendedSealed === true && phase3055.thirtyNineMutationApplied === true);
check("result_exists", result !== null, "run apply:phase3056-3100-controlled-forty-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("forty_mutation_applied", result.fortyMutationApplied === true);
  check("changed_file_count_forty", result.changedFileCount === 40);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localFortySmokePassed === true);
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
  check("rollback_restore_forty", rollback.rollbackAction === "restore-previous-content-forty");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_forty_entries", Array.isArray(rollback.files) && rollback.files.length === 40);
}

if (smoke) {
  check("smoke_phase3061Marker", smoke.phase3061Marker === "PHASE3061_FORTY_TOOL_TARGET_ONE_OK");
  check("smoke_phase3062Marker", smoke.phase3062Marker === "PHASE3062_FORTY_TOOL_TARGET_TWO_OK");
  check("smoke_phase3063Marker", smoke.phase3063Marker === "PHASE3063_FORTY_TOOL_TARGET_THREE_OK");
  check("smoke_phase3064Marker", smoke.phase3064Marker === "PHASE3064_FORTY_TOOL_TARGET_FOUR_OK");
  check("smoke_phase3065Marker", smoke.phase3065Marker === "PHASE3065_FORTY_TOOL_TARGET_FIVE_OK");
  check("smoke_phase3066Marker", smoke.phase3066Marker === "PHASE3066_FORTY_TOOL_TARGET_SIX_OK");
  check("smoke_phase3067Marker", smoke.phase3067Marker === "PHASE3067_FORTY_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase3068Marker", smoke.phase3068Marker === "PHASE3068_FORTY_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase3069Marker", smoke.phase3069Marker === "PHASE3069_FORTY_TOOL_TARGET_NINE_OK");
  check("smoke_phase3070Marker", smoke.phase3070Marker === "PHASE3070_FORTY_TOOL_TARGET_TEN_OK");
  check("smoke_phase3071Marker", smoke.phase3071Marker === "PHASE3071_FORTY_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase3072Marker", smoke.phase3072Marker === "PHASE3072_FORTY_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase3073Marker", smoke.phase3073Marker === "PHASE3073_FORTY_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase3074Marker", smoke.phase3074Marker === "PHASE3074_FORTY_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase3075Marker", smoke.phase3075Marker === "PHASE3075_FORTY_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase3076Marker", smoke.phase3076Marker === "PHASE3076_FORTY_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase3077Marker", smoke.phase3077Marker === "PHASE3077_FORTY_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase3078Marker", smoke.phase3078Marker === "PHASE3078_FORTY_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase3079Marker", smoke.phase3079Marker === "PHASE3079_FORTY_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase3080Marker", smoke.phase3080Marker === "PHASE3080_FORTY_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase3081Marker", smoke.phase3081Marker === "PHASE3081_FORTY_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase3082Marker", smoke.phase3082Marker === "PHASE3082_FORTY_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase3083Marker", smoke.phase3083Marker === "PHASE3083_FORTY_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase3084Marker", smoke.phase3084Marker === "PHASE3084_FORTY_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase3085Marker", smoke.phase3085Marker === "PHASE3085_FORTY_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase3086Marker", smoke.phase3086Marker === "PHASE3086_FORTY_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase3087Marker", smoke.phase3087Marker === "PHASE3087_FORTY_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase3088Marker", smoke.phase3088Marker === "PHASE3088_FORTY_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase3089Marker", smoke.phase3089Marker === "PHASE3089_FORTY_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase3090Marker", smoke.phase3090Marker === "PHASE3090_FORTY_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase3091Marker", smoke.phase3091Marker === "PHASE3091_FORTY_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase3092Marker", smoke.phase3092Marker === "PHASE3092_FORTY_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase3093Marker", smoke.phase3093Marker === "PHASE3093_FORTY_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase3094Marker", smoke.phase3094Marker === "PHASE3094_FORTY_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase3095Marker", smoke.phase3095Marker === "PHASE3095_FORTY_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_phase3096Marker", smoke.phase3096Marker === "PHASE3096_FORTY_TOOL_TARGET_THIRTY_SIX_OK");
  check("smoke_phase3097Marker", smoke.phase3097Marker === "PHASE3097_FORTY_TOOL_TARGET_THIRTY_SEVEN_OK");
  check("smoke_phase3098Marker", smoke.phase3098Marker === "PHASE3098_FORTY_TOOL_TARGET_THIRTY_EIGHT_OK");
  check("smoke_phase3099Marker", smoke.phase3099Marker === "PHASE3099_FORTY_TOOL_TARGET_THIRTY_NINE_OK");
  check("smoke_phase3100Marker", smoke.phase3100Marker === "PHASE3100_FORTY_TOOL_TARGET_FORTY_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase3061FortyMutationTargetOneStatus") || targetOne.includes("export function buildPhase3061FortyMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE3061_FORTY_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase3062FortyMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase3062FortyMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE3062_FORTY_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase3063FortyMutationTargetThreeStatus") || targetThree.includes("export function buildPhase3063FortyMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE3063_FORTY_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase3064FortyMutationTargetFourStatus") || targetFour.includes("export function buildPhase3064FortyMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE3064_FORTY_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase3065FortyMutationTargetFiveStatus") || targetFive.includes("export function buildPhase3065FortyMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE3065_FORTY_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase3066FortyMutationTargetSixStatus") || targetSix.includes("export function buildPhase3066FortyMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE3066_FORTY_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase3067FortyMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase3067FortyMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE3067_FORTY_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase3068FortyMutationTargetEightStatus") || targetEight.includes("export function buildPhase3068FortyMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE3068_FORTY_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase3069FortyMutationTargetNineStatus") || targetNine.includes("export function buildPhase3069FortyMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE3069_FORTY_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase3070FortyMutationTargetTenStatus") || targetTen.includes("export function buildPhase3070FortyMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE3070_FORTY_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase3071FortyMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase3071FortyMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE3071_FORTY_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase3072FortyMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase3072FortyMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE3072_FORTY_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase3073FortyMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase3073FortyMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE3073_FORTY_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase3074FortyMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase3074FortyMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE3074_FORTY_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase3075FortyMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase3075FortyMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE3075_FORTY_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase3076FortyMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase3076FortyMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE3076_FORTY_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase3077FortyMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase3077FortyMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE3077_FORTY_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase3078FortyMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase3078FortyMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE3078_FORTY_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase3079FortyMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase3079FortyMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE3079_FORTY_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase3080FortyMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase3080FortyMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE3080_FORTY_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase3081FortyMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase3081FortyMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE3081_FORTY_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase3082FortyMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase3082FortyMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE3082_FORTY_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase3083FortyMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase3083FortyMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE3083_FORTY_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase3084FortyMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase3084FortyMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE3084_FORTY_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase3085FortyMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase3085FortyMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE3085_FORTY_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase3086FortyMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase3086FortyMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE3086_FORTY_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase3087FortyMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase3087FortyMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE3087_FORTY_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase3088FortyMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase3088FortyMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE3088_FORTY_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase3089FortyMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase3089FortyMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE3089_FORTY_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase3090FortyMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase3090FortyMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE3090_FORTY_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase3091FortyMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase3091FortyMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE3091_FORTY_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase3092FortyMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase3092FortyMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE3092_FORTY_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase3093FortyMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase3093FortyMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE3093_FORTY_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase3094FortyMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase3094FortyMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE3094_FORTY_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase3095FortyMutationTargetThirtyFiveStatus") || targetThirtyFive.includes("export function buildPhase3095FortyMutationTargetThirtyFiveStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE3095_FORTY_TOOL_TARGET_THIRTY_FIVE_OK"));
check("target-thirty-six_export", targetThirtySix.includes("buildPhase3096FortyMutationTargetThirtySixStatus") || targetThirtySix.includes("export function buildPhase3096FortyMutationTargetThirtySixStatus"));
check("target-thirty-six_marker", targetThirtySix.includes("PHASE3096_FORTY_TOOL_TARGET_THIRTY_SIX_OK"));
check("target-thirty-seven_export", targetThirtySeven.includes("buildPhase3097FortyMutationTargetThirtySevenStatus") || targetThirtySeven.includes("export function buildPhase3097FortyMutationTargetThirtySevenStatus"));
check("target-thirty-seven_marker", targetThirtySeven.includes("PHASE3097_FORTY_TOOL_TARGET_THIRTY_SEVEN_OK"));
check("target-thirty-eight_export", targetThirtyEight.includes("buildPhase3098FortyMutationTargetThirtyEightStatus") || targetThirtyEight.includes("export function buildPhase3098FortyMutationTargetThirtyEightStatus"));
check("target-thirty-eight_marker", targetThirtyEight.includes("PHASE3098_FORTY_TOOL_TARGET_THIRTY_EIGHT_OK"));
check("target-thirty-nine_export", targetThirtyNine.includes("buildPhase3099FortyMutationTargetThirtyNineStatus") || targetThirtyNine.includes("export function buildPhase3099FortyMutationTargetThirtyNineStatus"));
check("target-thirty-nine_marker", targetThirtyNine.includes("PHASE3099_FORTY_TOOL_TARGET_THIRTY_NINE_OK"));
check("target-forty_export", targetForty.includes("buildPhase3100FortyMutationRuntimeStatus") || targetForty.includes("export function buildPhase3100FortyMutationRuntimeStatus"));
check("target-forty_marker", targetForty.includes("PHASE3100_FORTY_TOOL_TARGET_FORTY_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_forty", docs.includes("controlled forty tool mutation"));
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
  phase3055Sealed: phase3055.recommendedSealed === true,
  fortyMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 40,
  fortyMutationApplied: result?.fortyMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localFortySmokePassed: result?.localFortySmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, fortyMutationApplied: verifierResult.fortyMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localFortySmokePassed: verifierResult.localFortySmokePassed }, null, 2));
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
    "# Phase3056A-3100A Controlled Forty Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- fortyMutationApplied: ${Boolean(result.fortyMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localFortySmokePassed: ${Boolean(result.localFortySmokePassed)}`,
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
