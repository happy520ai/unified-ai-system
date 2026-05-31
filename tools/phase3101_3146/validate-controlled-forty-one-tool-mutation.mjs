import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase3101A-3146A-Controlled-Forty-One-Tool-Mutation";
const runnerPath = "tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase3101-3146-controlled-forty-one-tool-mutation.md";
const approvalPath = "docs/phase3101-3146-controlled-forty-one-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase3106-forty-one-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase3107-forty-one-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase3108-forty-one-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase3109-forty-one-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase3110-forty-one-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase3111-forty-one-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase3112-forty-one-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase3113-forty-one-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase3114-forty-one-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase3115-forty-one-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase3116-forty-one-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase3117-forty-one-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase3118-forty-one-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase3119-forty-one-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase3120-forty-one-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase3121-forty-one-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase3122-forty-one-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase3123-forty-one-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase3124-forty-one-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase3125-forty-one-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase3126-forty-one-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase3127-forty-one-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase3128-forty-one-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase3129-forty-one-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase3130-forty-one-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase3131-forty-one-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase3132-forty-one-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase3133-forty-one-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase3134-forty-one-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase3135-forty-one-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase3136-forty-one-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase3137-forty-one-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase3138-forty-one-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase3139-forty-one-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase3140-forty-one-tool-mutation-target-thirty-five.proposal.diff";
const proposalThirtySixPath = "docs/phase3141-forty-one-tool-mutation-target-thirty-six.proposal.diff";
const proposalThirtySevenPath = "docs/phase3142-forty-one-tool-mutation-target-thirty-seven.proposal.diff";
const proposalThirtyEightPath = "docs/phase3143-forty-one-tool-mutation-target-thirty-eight.proposal.diff";
const proposalThirtyNinePath = "docs/phase3144-forty-one-tool-mutation-target-thirty-nine.proposal.diff";
const proposalFortyPath = "docs/phase3145-forty-one-tool-mutation-target-forty.proposal.diff";
const proposalFortyOnePath = "docs/phase3146-forty-one-tool-mutation-target-forty-one.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase3101-3146-controlled-forty-one-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase3101-3146-controlled-forty-one-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase3101-3146-controlled-forty-one-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase3101-3146-controlled-forty-one-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase3101-3146-controlled-forty-one-tool-mutation/forty-one-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase3100 = readJson("apps/ai-gateway-service/evidence/phase3056-3100-controlled-forty-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase3101-3146-controlled-forty-one-tool-mutation"] === "node tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs --plan docs/phase3101-3146-controlled-forty-one-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase3101-3146-controlled-forty-one-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3111FortyOneMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3112FortyOneMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3113FortyOneMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3114FortyOneMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3115FortyOneMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3116FortyOneMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3117FortyOneMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3118FortyOneMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3119FortyOneMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3120FortyOneMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3121FortyOneMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3122FortyOneMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3123FortyOneMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3124FortyOneMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3125FortyOneMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3126FortyOneMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3127FortyOneMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3128FortyOneMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3129FortyOneMutationTargetTwentyFourStatus())))\" && node -e \"import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3130FortyOneMutationTargetTwentyFiveStatus())))\" && node -e \"import('./tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3131FortyOneMutationTargetTwentySixStatus())))\" && node -e \"import('./tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3132FortyOneMutationTargetTwentySevenStatus())))\" && node -e \"import('./tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3133FortyOneMutationTargetTwentyEightStatus())))\" && node -e \"import('./tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3134FortyOneMutationTargetTwentyNineStatus())))\" && node -e \"import('./tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3135FortyOneMutationTargetThirtyStatus())))\" && node -e \"import('./tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3136FortyOneMutationTargetThirtyOneStatus())))\" && node -e \"import('./tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3137FortyOneMutationTargetThirtyTwoStatus())))\" && node -e \"import('./tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3138FortyOneMutationTargetThirtyThreeStatus())))\" && node -e \"import('./tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3139FortyOneMutationTargetThirtyFourStatus())))\" && node -e \"import('./tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3140FortyOneMutationTargetThirtyFiveStatus())))\" && node -e \"import('./tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3141FortyOneMutationTargetThirtySixStatus())))\" && node -e \"import('./tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3142FortyOneMutationTargetThirtySevenStatus())))\" && node -e \"import('./tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3143FortyOneMutationTargetThirtyEightStatus())))\" && node -e \"import('./tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3144FortyOneMutationTargetThirtyNineStatus())))\" && node -e \"import('./tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3145FortyOneMutationTargetFortyStatus())))\" && node -e \"import('./tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3146FortyOneMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase3101-3146-controlled-forty-one-tool-mutation"] === "node tools/phase3101_3146/validate-controlled-forty-one-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase3100_sealed", phase3100.recommendedSealed === true && phase3100.fortyMutationApplied === true);
check("result_exists", result !== null, "run apply:phase3101-3146-controlled-forty-one-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("forty_mutation_applied", result.fortyOneMutationApplied === true);
  check("changed_file_count_forty_one", result.changedFileCount === 41);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localFortyOneSmokePassed === true);
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
  check("rollback_restore_forty_one", rollback.rollbackAction === "restore-previous-content-forty-one");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_forty_one_entries", Array.isArray(rollback.files) && rollback.files.length === 41);
}

if (smoke) {
  check("smoke_phase3106Marker", smoke.phase3106Marker === "PHASE3106_FORTY_ONE_TOOL_TARGET_ONE_OK");
  check("smoke_phase3107Marker", smoke.phase3107Marker === "PHASE3107_FORTY_ONE_TOOL_TARGET_TWO_OK");
  check("smoke_phase3108Marker", smoke.phase3108Marker === "PHASE3108_FORTY_ONE_TOOL_TARGET_THREE_OK");
  check("smoke_phase3109Marker", smoke.phase3109Marker === "PHASE3109_FORTY_ONE_TOOL_TARGET_FOUR_OK");
  check("smoke_phase3110Marker", smoke.phase3110Marker === "PHASE3110_FORTY_ONE_TOOL_TARGET_FIVE_OK");
  check("smoke_phase3111Marker", smoke.phase3111Marker === "PHASE3111_FORTY_ONE_TOOL_TARGET_SIX_OK");
  check("smoke_phase3112Marker", smoke.phase3112Marker === "PHASE3112_FORTY_ONE_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase3113Marker", smoke.phase3113Marker === "PHASE3113_FORTY_ONE_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase3114Marker", smoke.phase3114Marker === "PHASE3114_FORTY_ONE_TOOL_TARGET_NINE_OK");
  check("smoke_phase3115Marker", smoke.phase3115Marker === "PHASE3115_FORTY_ONE_TOOL_TARGET_TEN_OK");
  check("smoke_phase3116Marker", smoke.phase3116Marker === "PHASE3116_FORTY_ONE_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase3117Marker", smoke.phase3117Marker === "PHASE3117_FORTY_ONE_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase3118Marker", smoke.phase3118Marker === "PHASE3118_FORTY_ONE_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase3119Marker", smoke.phase3119Marker === "PHASE3119_FORTY_ONE_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase3120Marker", smoke.phase3120Marker === "PHASE3120_FORTY_ONE_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase3121Marker", smoke.phase3121Marker === "PHASE3121_FORTY_ONE_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase3122Marker", smoke.phase3122Marker === "PHASE3122_FORTY_ONE_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase3123Marker", smoke.phase3123Marker === "PHASE3123_FORTY_ONE_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase3124Marker", smoke.phase3124Marker === "PHASE3124_FORTY_ONE_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase3125Marker", smoke.phase3125Marker === "PHASE3125_FORTY_ONE_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase3126Marker", smoke.phase3126Marker === "PHASE3126_FORTY_ONE_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase3127Marker", smoke.phase3127Marker === "PHASE3127_FORTY_ONE_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase3128Marker", smoke.phase3128Marker === "PHASE3128_FORTY_ONE_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase3129Marker", smoke.phase3129Marker === "PHASE3129_FORTY_ONE_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase3130Marker", smoke.phase3130Marker === "PHASE3130_FORTY_ONE_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase3131Marker", smoke.phase3131Marker === "PHASE3131_FORTY_ONE_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase3132Marker", smoke.phase3132Marker === "PHASE3132_FORTY_ONE_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase3133Marker", smoke.phase3133Marker === "PHASE3133_FORTY_ONE_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase3134Marker", smoke.phase3134Marker === "PHASE3134_FORTY_ONE_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase3135Marker", smoke.phase3135Marker === "PHASE3135_FORTY_ONE_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase3136Marker", smoke.phase3136Marker === "PHASE3136_FORTY_ONE_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase3137Marker", smoke.phase3137Marker === "PHASE3137_FORTY_ONE_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase3138Marker", smoke.phase3138Marker === "PHASE3138_FORTY_ONE_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase3139Marker", smoke.phase3139Marker === "PHASE3139_FORTY_ONE_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase3140Marker", smoke.phase3140Marker === "PHASE3140_FORTY_ONE_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_phase3141Marker", smoke.phase3141Marker === "PHASE3141_FORTY_ONE_TOOL_TARGET_THIRTY_SIX_OK");
  check("smoke_phase3142Marker", smoke.phase3142Marker === "PHASE3142_FORTY_ONE_TOOL_TARGET_THIRTY_SEVEN_OK");
  check("smoke_phase3143Marker", smoke.phase3143Marker === "PHASE3143_FORTY_ONE_TOOL_TARGET_THIRTY_EIGHT_OK");
  check("smoke_phase3144Marker", smoke.phase3144Marker === "PHASE3144_FORTY_ONE_TOOL_TARGET_THIRTY_NINE_OK");
  check("smoke_phase3145Marker", smoke.phase3145Marker === "PHASE3145_FORTY_ONE_TOOL_TARGET_FORTY_OK");
  check("smoke_phase3146Marker", smoke.phase3146Marker === "PHASE3146_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase3106FortyOneMutationTargetOneStatus") || targetOne.includes("export function buildPhase3106FortyOneMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE3106_FORTY_ONE_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase3107FortyOneMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase3107FortyOneMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE3107_FORTY_ONE_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase3108FortyOneMutationTargetThreeStatus") || targetThree.includes("export function buildPhase3108FortyOneMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE3108_FORTY_ONE_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase3109FortyOneMutationTargetFourStatus") || targetFour.includes("export function buildPhase3109FortyOneMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE3109_FORTY_ONE_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase3110FortyOneMutationTargetFiveStatus") || targetFive.includes("export function buildPhase3110FortyOneMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE3110_FORTY_ONE_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase3111FortyOneMutationTargetSixStatus") || targetSix.includes("export function buildPhase3111FortyOneMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE3111_FORTY_ONE_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase3112FortyOneMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase3112FortyOneMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE3112_FORTY_ONE_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase3113FortyOneMutationTargetEightStatus") || targetEight.includes("export function buildPhase3113FortyOneMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE3113_FORTY_ONE_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase3114FortyOneMutationTargetNineStatus") || targetNine.includes("export function buildPhase3114FortyOneMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE3114_FORTY_ONE_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase3115FortyOneMutationTargetTenStatus") || targetTen.includes("export function buildPhase3115FortyOneMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE3115_FORTY_ONE_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase3116FortyOneMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase3116FortyOneMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE3116_FORTY_ONE_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase3117FortyOneMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase3117FortyOneMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE3117_FORTY_ONE_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase3118FortyOneMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase3118FortyOneMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE3118_FORTY_ONE_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase3119FortyOneMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase3119FortyOneMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE3119_FORTY_ONE_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase3120FortyOneMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase3120FortyOneMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE3120_FORTY_ONE_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase3121FortyOneMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase3121FortyOneMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE3121_FORTY_ONE_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase3122FortyOneMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase3122FortyOneMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE3122_FORTY_ONE_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase3123FortyOneMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase3123FortyOneMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE3123_FORTY_ONE_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase3124FortyOneMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase3124FortyOneMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE3124_FORTY_ONE_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase3125FortyOneMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase3125FortyOneMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE3125_FORTY_ONE_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase3126FortyOneMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase3126FortyOneMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE3126_FORTY_ONE_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase3127FortyOneMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase3127FortyOneMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE3127_FORTY_ONE_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase3128FortyOneMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase3128FortyOneMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE3128_FORTY_ONE_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase3129FortyOneMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase3129FortyOneMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE3129_FORTY_ONE_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase3130FortyOneMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase3130FortyOneMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE3130_FORTY_ONE_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase3131FortyOneMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase3131FortyOneMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE3131_FORTY_ONE_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase3132FortyOneMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase3132FortyOneMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE3132_FORTY_ONE_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase3133FortyOneMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase3133FortyOneMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE3133_FORTY_ONE_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase3134FortyOneMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase3134FortyOneMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE3134_FORTY_ONE_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase3135FortyOneMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase3135FortyOneMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE3135_FORTY_ONE_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase3136FortyOneMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase3136FortyOneMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE3136_FORTY_ONE_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase3137FortyOneMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase3137FortyOneMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE3137_FORTY_ONE_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase3138FortyOneMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase3138FortyOneMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE3138_FORTY_ONE_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase3139FortyOneMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase3139FortyOneMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE3139_FORTY_ONE_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase3140FortyOneMutationTargetThirtyFiveStatus") || targetThirtyFive.includes("export function buildPhase3140FortyOneMutationTargetThirtyFiveStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE3140_FORTY_ONE_TOOL_TARGET_THIRTY_FIVE_OK"));
check("target-thirty-six_export", targetThirtySix.includes("buildPhase3141FortyOneMutationTargetThirtySixStatus") || targetThirtySix.includes("export function buildPhase3141FortyOneMutationTargetThirtySixStatus"));
check("target-thirty-six_marker", targetThirtySix.includes("PHASE3141_FORTY_ONE_TOOL_TARGET_THIRTY_SIX_OK"));
check("target-thirty-seven_export", targetThirtySeven.includes("buildPhase3142FortyOneMutationTargetThirtySevenStatus") || targetThirtySeven.includes("export function buildPhase3142FortyOneMutationTargetThirtySevenStatus"));
check("target-thirty-seven_marker", targetThirtySeven.includes("PHASE3142_FORTY_ONE_TOOL_TARGET_THIRTY_SEVEN_OK"));
check("target-thirty-eight_export", targetThirtyEight.includes("buildPhase3143FortyOneMutationTargetThirtyEightStatus") || targetThirtyEight.includes("export function buildPhase3143FortyOneMutationTargetThirtyEightStatus"));
check("target-thirty-eight_marker", targetThirtyEight.includes("PHASE3143_FORTY_ONE_TOOL_TARGET_THIRTY_EIGHT_OK"));
check("target-thirty-nine_export", targetThirtyNine.includes("buildPhase3144FortyOneMutationTargetThirtyNineStatus") || targetThirtyNine.includes("export function buildPhase3144FortyOneMutationTargetThirtyNineStatus"));
check("target-thirty-nine_marker", targetThirtyNine.includes("PHASE3144_FORTY_ONE_TOOL_TARGET_THIRTY_NINE_OK"));
check("target-forty_export", targetForty.includes("buildPhase3145FortyOneMutationTargetFortyStatus") || targetForty.includes("export function buildPhase3145FortyOneMutationTargetFortyStatus"));
check("target-forty_marker", targetForty.includes("PHASE3145_FORTY_ONE_TOOL_TARGET_FORTY_OK"));
check("target-forty-one_export", targetFortyOne.includes("buildPhase3146FortyOneMutationRuntimeStatus") || targetFortyOne.includes("export function buildPhase3146FortyOneMutationRuntimeStatus"));
check("target-forty-one_marker", targetFortyOne.includes("PHASE3146_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_forty_one", docs.includes("controlled forty-one tool mutation"));
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
  phase3100Sealed: phase3100.recommendedSealed === true,
  fortyOneMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 41,
  fortyOneMutationApplied: result?.fortyOneMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localFortyOneSmokePassed: result?.localFortyOneSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, fortyOneMutationApplied: verifierResult.fortyOneMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localFortyOneSmokePassed: verifierResult.localFortyOneSmokePassed }, null, 2));
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
    "# Phase3101A-3146A Controlled Forty-One Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- fortyOneMutationApplied: ${Boolean(result.fortyOneMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localFortyOneSmokePassed: ${Boolean(result.localFortyOneSmokePassed)}`,
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
