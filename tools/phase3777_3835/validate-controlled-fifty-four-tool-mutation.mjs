import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase3777A-3835A-Controlled-Fifty-Four-Tool-Mutation";
const runnerPath = "tools/phase3777_3835/apply-controlled-fifty-four-tool-mutation.mjs";
const smokeRunnerPath = "tools/phase3777_3835/smoke-controlled-fifty-four-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase3777-3835-controlled-fifty-four-tool-mutation.md";
const approvalPath = "docs/phase3777-3835-controlled-fifty-four-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase3782-fifty-four-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase3783-fifty-four-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase3784-fifty-four-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase3785-fifty-four-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase3786-fifty-four-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase3787-fifty-four-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase3788-fifty-four-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase3789-fifty-four-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase3790-fifty-four-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase3791-fifty-four-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase3792-fifty-four-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase3793-fifty-four-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase3794-fifty-four-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase3795-fifty-four-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase3796-fifty-four-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase3797-fifty-four-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase3798-fifty-four-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase3799-fifty-four-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase3800-fifty-four-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase3801-fifty-four-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase3802-fifty-four-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase3803-fifty-four-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase3804-fifty-four-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase3805-fifty-four-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase3806-fifty-four-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase3807-fifty-four-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase3808-fifty-four-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase3809-fifty-four-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase3810-fifty-four-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase3811-fifty-four-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase3812-fifty-four-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase3813-fifty-four-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase3814-fifty-four-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase3815-fifty-four-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase3816-fifty-four-tool-mutation-target-thirty-five.proposal.diff";
const proposalThirtySixPath = "docs/phase3817-fifty-four-tool-mutation-target-thirty-six.proposal.diff";
const proposalThirtySevenPath = "docs/phase3818-fifty-four-tool-mutation-target-thirty-seven.proposal.diff";
const proposalThirtyEightPath = "docs/phase3819-fifty-four-tool-mutation-target-thirty-eight.proposal.diff";
const proposalThirtyNinePath = "docs/phase3820-fifty-four-tool-mutation-target-thirty-nine.proposal.diff";
const proposalFortyPath = "docs/phase3821-fifty-four-tool-mutation-target-forty.proposal.diff";
const proposalFortyOnePath = "docs/phase3822-fifty-four-tool-mutation-target-forty-one.proposal.diff";
const proposalFortyTwoPath = "docs/phase3823-fifty-four-tool-mutation-target-forty-two.proposal.diff";
const proposalFortyThreePath = "docs/phase3824-fifty-four-tool-mutation-target-forty-three.proposal.diff";
const proposalFortyFourPath = "docs/phase3825-fifty-four-tool-mutation-target-forty-four.proposal.diff";
const proposalFortyFivePath = "docs/phase3826-fifty-four-tool-mutation-target-forty-five.proposal.diff";
const proposalFortySixPath = "docs/phase3827-fifty-four-tool-mutation-target-forty-six.proposal.diff";
const proposalFortySevenPath = "docs/phase3828-fifty-four-tool-mutation-target-forty-seven.proposal.diff";
const proposalFortyEightPath = "docs/phase3829-fifty-four-tool-mutation-target-forty-eight.proposal.diff";
const proposalFortyNinePath = "docs/phase3830-fifty-four-tool-mutation-target-forty-nine.proposal.diff";
const proposalFiftyPath = "docs/phase3831-fifty-four-tool-mutation-target-fifty.proposal.diff";
const proposalFiftyOnePath = "docs/phase3832-fifty-four-tool-mutation-target-fifty-one.proposal.diff";
const proposalFiftyTwoPath = "docs/phase3833-fifty-four-tool-mutation-target-fifty-two.proposal.diff";
const proposalFiftyThreePath = "docs/phase3834-fifty-four-tool-mutation-target-fifty-three.proposal.diff";
const proposalFiftyFourPath = "docs/phase3835-fifty-four-tool-mutation-target-fifty-four.proposal.diff";
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
const targetFortySixPath = "tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs";
const targetFortySevenPath = "tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs";
const targetFortyEightPath = "tools/phase3392_3443/apply-controlled-forty-seven-tool-mutation.mjs";
const targetFortyNinePath = "tools/phase3444_3496/apply-controlled-forty-eight-tool-mutation.mjs";
const targetFiftyPath = "tools/phase3497_3550/apply-controlled-forty-nine-tool-mutation.mjs";
const targetFiftyOnePath = "tools/phase3551_3605/apply-controlled-fifty-tool-mutation.mjs";
const targetFiftyTwoPath = "tools/phase3606_3661/apply-controlled-fifty-one-tool-mutation.mjs";
const targetFiftyThreePath = "tools/phase3662_3718/apply-controlled-fifty-two-tool-mutation.mjs";
const targetFiftyFourPath = "tools/phase3719_3776/apply-controlled-fifty-three-tool-mutation.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase3777-3835-controlled-fifty-four-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase3777-3835-controlled-fifty-four-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase3777-3835-controlled-fifty-four-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase3777-3835-controlled-fifty-four-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase3777-3835-controlled-fifty-four-tool-mutation/fifty-four-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase3776 = readJson("apps/ai-gateway-service/evidence/phase3719-3776-controlled-fifty-three-tool-mutation/result.json") || {};
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
const targetFortySix = existsSync(resolve(targetFortySixPath)) ? readText(targetFortySixPath) : "";
const targetFortySeven = existsSync(resolve(targetFortySevenPath)) ? readText(targetFortySevenPath) : "";
const targetFortyEight = existsSync(resolve(targetFortyEightPath)) ? readText(targetFortyEightPath) : "";
const targetFortyNine = existsSync(resolve(targetFortyNinePath)) ? readText(targetFortyNinePath) : "";
const targetFifty = existsSync(resolve(targetFiftyPath)) ? readText(targetFiftyPath) : "";
const targetFiftyOne = existsSync(resolve(targetFiftyOnePath)) ? readText(targetFiftyOnePath) : "";
const targetFiftyTwo = existsSync(resolve(targetFiftyTwoPath)) ? readText(targetFiftyTwoPath) : "";
const targetFiftyThree = existsSync(resolve(targetFiftyThreePath)) ? readText(targetFiftyThreePath) : "";
const targetFiftyFour = existsSync(resolve(targetFiftyFourPath)) ? readText(targetFiftyFourPath) : "";
const docs = existsSync(resolve(docsPath)) ? readText(docsPath) : "";
const substrate = existsSync(resolve(substratePath)) ? readText(substratePath) : "";

check("runner_exists", existsSync(resolve(runnerPath)));
check("smoke_runner_exists", existsSync(resolve(smokeRunnerPath)));
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
check("proposal_forty-six_exists", existsSync(resolve(proposalFortySixPath)));
check("proposal_forty-seven_exists", existsSync(resolve(proposalFortySevenPath)));
check("proposal_forty-eight_exists", existsSync(resolve(proposalFortyEightPath)));
check("proposal_forty-nine_exists", existsSync(resolve(proposalFortyNinePath)));
check("proposal_fifty_exists", existsSync(resolve(proposalFiftyPath)));
check("proposal_fifty-one_exists", existsSync(resolve(proposalFiftyOnePath)));
check("proposal_fifty-two_exists", existsSync(resolve(proposalFiftyTwoPath)));
check("proposal_fifty-three_exists", existsSync(resolve(proposalFiftyThreePath)));
check("proposal_fifty-four_exists", existsSync(resolve(proposalFiftyFourPath)));
check("package_apply_script_registered", packageJson.scripts?.["apply:phase3777-3835-controlled-fifty-four-tool-mutation"] === "node tools/phase3777_3835/apply-controlled-fifty-four-tool-mutation.mjs --plan docs/phase3777-3835-controlled-fifty-four-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase3777-3835-controlled-fifty-four-tool-mutation"] ===
    "node tools/phase3777_3835/smoke-controlled-fifty-four-tool-mutation.mjs",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase3777-3835-controlled-fifty-four-tool-mutation"] === "node tools/phase3777_3835/validate-controlled-fifty-four-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase3776_sealed", phase3776.recommendedSealed === true && phase3776.fiftyThreeMutationApplied === true);
check("result_exists", result !== null, "run apply:phase3777-3835-controlled-fifty-four-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("fifty_four_mutation_applied", result.fiftyFourMutationApplied === true);
  check("changed_file_count_fifty_four", result.changedFileCount === 54);
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
    && result.changedFiles.includes(targetFortySixPath)
    && result.changedFiles.includes(targetFortySevenPath)
    && result.changedFiles.includes(targetFortyEightPath)
    && result.changedFiles.includes(targetFortyNinePath)
    && result.changedFiles.includes(targetFiftyPath)
    && result.changedFiles.includes(targetFiftyOnePath)
    && result.changedFiles.includes(targetFiftyTwoPath)
    && result.changedFiles.includes(targetFiftyThreePath)
    && result.changedFiles.includes(targetFiftyFourPath)
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localFiftyFourSmokePassed === true);
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
  check("rollback_restore_fifty_four", rollback.rollbackAction === "restore-previous-content-fifty-four");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_fifty_four_entries", Array.isArray(rollback.files) && rollback.files.length === 54);
}

if (smoke) {
  check("smoke_phase3782Marker", smoke.phase3782Marker === "PHASE3782_FIFTY_FOUR_TOOL_TARGET_ONE_OK");
  check("smoke_phase3783Marker", smoke.phase3783Marker === "PHASE3783_FIFTY_FOUR_TOOL_TARGET_TWO_OK");
  check("smoke_phase3784Marker", smoke.phase3784Marker === "PHASE3784_FIFTY_FOUR_TOOL_TARGET_THREE_OK");
  check("smoke_phase3785Marker", smoke.phase3785Marker === "PHASE3785_FIFTY_FOUR_TOOL_TARGET_FOUR_OK");
  check("smoke_phase3786Marker", smoke.phase3786Marker === "PHASE3786_FIFTY_FOUR_TOOL_TARGET_FIVE_OK");
  check("smoke_phase3787Marker", smoke.phase3787Marker === "PHASE3787_FIFTY_FOUR_TOOL_TARGET_SIX_OK");
  check("smoke_phase3788Marker", smoke.phase3788Marker === "PHASE3788_FIFTY_FOUR_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase3789Marker", smoke.phase3789Marker === "PHASE3789_FIFTY_FOUR_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase3790Marker", smoke.phase3790Marker === "PHASE3790_FIFTY_FOUR_TOOL_TARGET_NINE_OK");
  check("smoke_phase3791Marker", smoke.phase3791Marker === "PHASE3791_FIFTY_FOUR_TOOL_TARGET_TEN_OK");
  check("smoke_phase3792Marker", smoke.phase3792Marker === "PHASE3792_FIFTY_FOUR_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase3793Marker", smoke.phase3793Marker === "PHASE3793_FIFTY_FOUR_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase3794Marker", smoke.phase3794Marker === "PHASE3794_FIFTY_FOUR_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase3795Marker", smoke.phase3795Marker === "PHASE3795_FIFTY_FOUR_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase3796Marker", smoke.phase3796Marker === "PHASE3796_FIFTY_FOUR_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase3797Marker", smoke.phase3797Marker === "PHASE3797_FIFTY_FOUR_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase3798Marker", smoke.phase3798Marker === "PHASE3798_FIFTY_FOUR_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase3799Marker", smoke.phase3799Marker === "PHASE3799_FIFTY_FOUR_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase3800Marker", smoke.phase3800Marker === "PHASE3800_FIFTY_FOUR_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase3801Marker", smoke.phase3801Marker === "PHASE3801_FIFTY_FOUR_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase3802Marker", smoke.phase3802Marker === "PHASE3802_FIFTY_FOUR_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase3803Marker", smoke.phase3803Marker === "PHASE3803_FIFTY_FOUR_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase3804Marker", smoke.phase3804Marker === "PHASE3804_FIFTY_FOUR_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase3805Marker", smoke.phase3805Marker === "PHASE3805_FIFTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase3806Marker", smoke.phase3806Marker === "PHASE3806_FIFTY_FOUR_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase3807Marker", smoke.phase3807Marker === "PHASE3807_FIFTY_FOUR_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase3808Marker", smoke.phase3808Marker === "PHASE3808_FIFTY_FOUR_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase3809Marker", smoke.phase3809Marker === "PHASE3809_FIFTY_FOUR_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase3810Marker", smoke.phase3810Marker === "PHASE3810_FIFTY_FOUR_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase3811Marker", smoke.phase3811Marker === "PHASE3811_FIFTY_FOUR_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase3812Marker", smoke.phase3812Marker === "PHASE3812_FIFTY_FOUR_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase3813Marker", smoke.phase3813Marker === "PHASE3813_FIFTY_FOUR_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase3814Marker", smoke.phase3814Marker === "PHASE3814_FIFTY_FOUR_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase3815Marker", smoke.phase3815Marker === "PHASE3815_FIFTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase3816Marker", smoke.phase3816Marker === "PHASE3816_FIFTY_FOUR_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_phase3817Marker", smoke.phase3817Marker === "PHASE3817_FIFTY_FOUR_TOOL_TARGET_THIRTY_SIX_OK");
  check("smoke_phase3818Marker", smoke.phase3818Marker === "PHASE3818_FIFTY_FOUR_TOOL_TARGET_THIRTY_SEVEN_OK");
  check("smoke_phase3819Marker", smoke.phase3819Marker === "PHASE3819_FIFTY_FOUR_TOOL_TARGET_THIRTY_EIGHT_OK");
  check("smoke_phase3820Marker", smoke.phase3820Marker === "PHASE3820_FIFTY_FOUR_TOOL_TARGET_THIRTY_NINE_OK");
  check("smoke_phase3821Marker", smoke.phase3821Marker === "PHASE3821_FIFTY_FOUR_TOOL_TARGET_FORTY_OK");
  check("smoke_phase3822Marker", smoke.phase3822Marker === "PHASE3822_FIFTY_FOUR_TOOL_TARGET_FORTY_ONE_OK");
  check("smoke_phase3823Marker", smoke.phase3823Marker === "PHASE3823_FIFTY_FOUR_TOOL_TARGET_FORTY_TWO_OK");
  check("smoke_phase3824Marker", smoke.phase3824Marker === "PHASE3824_FIFTY_FOUR_TOOL_TARGET_FORTY_THREE_OK");
  check("smoke_phase3825Marker", smoke.phase3825Marker === "PHASE3825_FIFTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK");
  check("smoke_phase3826Marker", smoke.phase3826Marker === "PHASE3826_FIFTY_FOUR_TOOL_TARGET_FORTY_FIVE_OK");
  check("smoke_phase3827Marker", smoke.phase3827Marker === "PHASE3827_FIFTY_FOUR_TOOL_TARGET_FORTY_SIX_OK");
  check("smoke_phase3828Marker", smoke.phase3828Marker === "PHASE3828_FIFTY_FOUR_TOOL_TARGET_FORTY_SEVEN_OK");
  check("smoke_phase3829Marker", smoke.phase3829Marker === "PHASE3829_FIFTY_FOUR_TOOL_TARGET_FORTY_EIGHT_OK");
  check("smoke_phase3830Marker", smoke.phase3830Marker === "PHASE3830_FIFTY_FOUR_TOOL_TARGET_FORTY_NINE_OK");
  check("smoke_phase3831Marker", smoke.phase3831Marker === "PHASE3831_FIFTY_FOUR_TOOL_TARGET_FIFTY_OK");
  check("smoke_phase3832Marker", smoke.phase3832Marker === "PHASE3832_FIFTY_FOUR_TOOL_TARGET_FIFTY_ONE_OK");
  check("smoke_phase3833Marker", smoke.phase3833Marker === "PHASE3833_FIFTY_FOUR_TOOL_TARGET_FIFTY_TWO_OK");
  check("smoke_phase3834Marker", smoke.phase3834Marker === "PHASE3834_FIFTY_FOUR_TOOL_TARGET_FIFTY_THREE_OK");
  check("smoke_phase3835Marker", smoke.phase3835Marker === "PHASE3835_FIFTY_FOUR_TOOL_TARGET_FIFTY_FOUR_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase3782FiftyFourMutationTargetOneStatus") || targetOne.includes("export function buildPhase3782FiftyFourMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE3782_FIFTY_FOUR_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase3783FiftyFourMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase3783FiftyFourMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE3783_FIFTY_FOUR_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase3784FiftyFourMutationTargetThreeStatus") || targetThree.includes("export function buildPhase3784FiftyFourMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE3784_FIFTY_FOUR_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase3785FiftyFourMutationTargetFourStatus") || targetFour.includes("export function buildPhase3785FiftyFourMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE3785_FIFTY_FOUR_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase3786FiftyFourMutationTargetFiveStatus") || targetFive.includes("export function buildPhase3786FiftyFourMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE3786_FIFTY_FOUR_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase3787FiftyFourMutationTargetSixStatus") || targetSix.includes("export function buildPhase3787FiftyFourMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE3787_FIFTY_FOUR_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase3788FiftyFourMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase3788FiftyFourMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE3788_FIFTY_FOUR_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase3789FiftyFourMutationTargetEightStatus") || targetEight.includes("export function buildPhase3789FiftyFourMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE3789_FIFTY_FOUR_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase3790FiftyFourMutationTargetNineStatus") || targetNine.includes("export function buildPhase3790FiftyFourMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE3790_FIFTY_FOUR_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase3791FiftyFourMutationTargetTenStatus") || targetTen.includes("export function buildPhase3791FiftyFourMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE3791_FIFTY_FOUR_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase3792FiftyFourMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase3792FiftyFourMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE3792_FIFTY_FOUR_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase3793FiftyFourMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase3793FiftyFourMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE3793_FIFTY_FOUR_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase3794FiftyFourMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase3794FiftyFourMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE3794_FIFTY_FOUR_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase3795FiftyFourMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase3795FiftyFourMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE3795_FIFTY_FOUR_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase3796FiftyFourMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase3796FiftyFourMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE3796_FIFTY_FOUR_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase3797FiftyFourMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase3797FiftyFourMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE3797_FIFTY_FOUR_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase3798FiftyFourMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase3798FiftyFourMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE3798_FIFTY_FOUR_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase3799FiftyFourMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase3799FiftyFourMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE3799_FIFTY_FOUR_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase3800FiftyFourMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase3800FiftyFourMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE3800_FIFTY_FOUR_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase3801FiftyFourMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase3801FiftyFourMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE3801_FIFTY_FOUR_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase3802FiftyFourMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase3802FiftyFourMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE3802_FIFTY_FOUR_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase3803FiftyFourMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase3803FiftyFourMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE3803_FIFTY_FOUR_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase3804FiftyFourMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase3804FiftyFourMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE3804_FIFTY_FOUR_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase3805FiftyFourMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase3805FiftyFourMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE3805_FIFTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase3806FiftyFourMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase3806FiftyFourMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE3806_FIFTY_FOUR_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase3807FiftyFourMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase3807FiftyFourMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE3807_FIFTY_FOUR_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase3808FiftyFourMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase3808FiftyFourMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE3808_FIFTY_FOUR_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase3809FiftyFourMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase3809FiftyFourMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE3809_FIFTY_FOUR_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase3810FiftyFourMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase3810FiftyFourMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE3810_FIFTY_FOUR_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase3811FiftyFourMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase3811FiftyFourMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE3811_FIFTY_FOUR_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase3812FiftyFourMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase3812FiftyFourMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE3812_FIFTY_FOUR_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase3813FiftyFourMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase3813FiftyFourMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE3813_FIFTY_FOUR_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase3814FiftyFourMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase3814FiftyFourMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE3814_FIFTY_FOUR_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase3815FiftyFourMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase3815FiftyFourMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE3815_FIFTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase3816FiftyFourMutationTargetThirtyFiveStatus") || targetThirtyFive.includes("export function buildPhase3816FiftyFourMutationTargetThirtyFiveStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE3816_FIFTY_FOUR_TOOL_TARGET_THIRTY_FIVE_OK"));
check("target-thirty-six_export", targetThirtySix.includes("buildPhase3817FiftyFourMutationTargetThirtySixStatus") || targetThirtySix.includes("export function buildPhase3817FiftyFourMutationTargetThirtySixStatus"));
check("target-thirty-six_marker", targetThirtySix.includes("PHASE3817_FIFTY_FOUR_TOOL_TARGET_THIRTY_SIX_OK"));
check("target-thirty-seven_export", targetThirtySeven.includes("buildPhase3818FiftyFourMutationTargetThirtySevenStatus") || targetThirtySeven.includes("export function buildPhase3818FiftyFourMutationTargetThirtySevenStatus"));
check("target-thirty-seven_marker", targetThirtySeven.includes("PHASE3818_FIFTY_FOUR_TOOL_TARGET_THIRTY_SEVEN_OK"));
check("target-thirty-eight_export", targetThirtyEight.includes("buildPhase3819FiftyFourMutationTargetThirtyEightStatus") || targetThirtyEight.includes("export function buildPhase3819FiftyFourMutationTargetThirtyEightStatus"));
check("target-thirty-eight_marker", targetThirtyEight.includes("PHASE3819_FIFTY_FOUR_TOOL_TARGET_THIRTY_EIGHT_OK"));
check("target-thirty-nine_export", targetThirtyNine.includes("buildPhase3820FiftyFourMutationTargetThirtyNineStatus") || targetThirtyNine.includes("export function buildPhase3820FiftyFourMutationTargetThirtyNineStatus"));
check("target-thirty-nine_marker", targetThirtyNine.includes("PHASE3820_FIFTY_FOUR_TOOL_TARGET_THIRTY_NINE_OK"));
check("target-forty_export", targetForty.includes("buildPhase3821FiftyFourMutationTargetFortyStatus") || targetForty.includes("export function buildPhase3821FiftyFourMutationTargetFortyStatus"));
check("target-forty_marker", targetForty.includes("PHASE3821_FIFTY_FOUR_TOOL_TARGET_FORTY_OK"));
check("target-forty-one_export", targetFortyOne.includes("buildPhase3822FiftyFourMutationTargetFortyOneStatus") || targetFortyOne.includes("export function buildPhase3822FiftyFourMutationTargetFortyOneStatus"));
check("target-forty-one_marker", targetFortyOne.includes("PHASE3822_FIFTY_FOUR_TOOL_TARGET_FORTY_ONE_OK"));
check("target-forty-two_export", targetFortyTwo.includes("buildPhase3823FiftyFourMutationTargetFortyTwoStatus") || targetFortyTwo.includes("export function buildPhase3823FiftyFourMutationTargetFortyTwoStatus"));
check("target-forty-two_marker", targetFortyTwo.includes("PHASE3823_FIFTY_FOUR_TOOL_TARGET_FORTY_TWO_OK"));
check("target-forty-three_export", targetFortyThree.includes("buildPhase3824FiftyFourMutationTargetFortyThreeStatus") || targetFortyThree.includes("export function buildPhase3824FiftyFourMutationTargetFortyThreeStatus"));
check("target-forty-three_marker", targetFortyThree.includes("PHASE3824_FIFTY_FOUR_TOOL_TARGET_FORTY_THREE_OK"));
check("target-forty-four_export", targetFortyFour.includes("buildPhase3825FiftyFourMutationTargetFortyFourStatus") || targetFortyFour.includes("export function buildPhase3825FiftyFourMutationTargetFortyFourStatus"));
check("target-forty-four_marker", targetFortyFour.includes("PHASE3825_FIFTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK"));
check("target-forty-five_export", targetFortyFive.includes("buildPhase3826FiftyFourMutationTargetFortyFiveStatus") || targetFortyFive.includes("export function buildPhase3826FiftyFourMutationTargetFortyFiveStatus"));
check("target-forty-five_marker", targetFortyFive.includes("PHASE3826_FIFTY_FOUR_TOOL_TARGET_FORTY_FIVE_OK"));
check("target-forty-six_export", targetFortySix.includes("buildPhase3827FiftyFourMutationTargetFortySixStatus") || targetFortySix.includes("export function buildPhase3827FiftyFourMutationTargetFortySixStatus"));
check("target-forty-six_marker", targetFortySix.includes("PHASE3827_FIFTY_FOUR_TOOL_TARGET_FORTY_SIX_OK"));
check("target-forty-seven_export", targetFortySeven.includes("buildPhase3828FiftyFourMutationTargetFortySevenStatus") || targetFortySeven.includes("export function buildPhase3828FiftyFourMutationTargetFortySevenStatus"));
check("target-forty-seven_marker", targetFortySeven.includes("PHASE3828_FIFTY_FOUR_TOOL_TARGET_FORTY_SEVEN_OK"));
check("target-forty-eight_export", targetFortyEight.includes("buildPhase3829FiftyFourMutationTargetFortyEightStatus") || targetFortyEight.includes("export function buildPhase3829FiftyFourMutationTargetFortyEightStatus"));
check("target-forty-eight_marker", targetFortyEight.includes("PHASE3829_FIFTY_FOUR_TOOL_TARGET_FORTY_EIGHT_OK"));
check("target-forty-nine_export", targetFortyNine.includes("buildPhase3830FiftyFourMutationTargetFortyNineStatus") || targetFortyNine.includes("export function buildPhase3830FiftyFourMutationTargetFortyNineStatus"));
check("target-forty-nine_marker", targetFortyNine.includes("PHASE3830_FIFTY_FOUR_TOOL_TARGET_FORTY_NINE_OK"));
check("target-fifty_export", targetFifty.includes("buildPhase3831FiftyFourMutationTargetFiftyStatus") || targetFifty.includes("export function buildPhase3831FiftyFourMutationTargetFiftyStatus"));
check("target-fifty_marker", targetFifty.includes("PHASE3831_FIFTY_FOUR_TOOL_TARGET_FIFTY_OK"));
check("target-fifty-one_export", targetFiftyOne.includes("buildPhase3832FiftyFourMutationTargetFiftyOneStatus") || targetFiftyOne.includes("export function buildPhase3832FiftyFourMutationTargetFiftyOneStatus"));
check("target-fifty-one_marker", targetFiftyOne.includes("PHASE3832_FIFTY_FOUR_TOOL_TARGET_FIFTY_ONE_OK"));
check("target-fifty-two_export", targetFiftyTwo.includes("buildPhase3833FiftyFourMutationTargetFiftyTwoStatus") || targetFiftyTwo.includes("export function buildPhase3833FiftyFourMutationTargetFiftyTwoStatus"));
check("target-fifty-two_marker", targetFiftyTwo.includes("PHASE3833_FIFTY_FOUR_TOOL_TARGET_FIFTY_TWO_OK"));
check("target-fifty-three_export", targetFiftyThree.includes("buildPhase3834FiftyFourMutationTargetFiftyThreeStatus") || targetFiftyThree.includes("export function buildPhase3834FiftyFourMutationTargetFiftyThreeStatus"));
check("target-fifty-three_marker", targetFiftyThree.includes("PHASE3834_FIFTY_FOUR_TOOL_TARGET_FIFTY_THREE_OK"));
check("target-fifty-four_export", targetFiftyFour.includes("buildPhase3835FiftyFourMutationRuntimeStatus") || targetFiftyFour.includes("export function buildPhase3835FiftyFourMutationRuntimeStatus"));
check("target-fifty-four_marker", targetFiftyFour.includes("PHASE3835_FIFTY_FOUR_TOOL_TARGET_FIFTY_FOUR_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_fifty_four", docs.includes("controlled fifty-four tool mutation"));
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
  phase3776Sealed: phase3776.recommendedSealed === true,
  fiftyFourMutationReady: completed,
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
    targetFortySixPath,
    targetFortySevenPath,
    targetFortyEightPath,
    targetFortyNinePath,
    targetFiftyPath,
    targetFiftyOnePath,
    targetFiftyTwoPath,
    targetFiftyThreePath,
    targetFiftyFourPath,
  ],
  changedFileCount: result?.changedFileCount ?? 54,
  fiftyFourMutationApplied: result?.fiftyFourMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localFiftyFourSmokePassed: result?.localFiftyFourSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, fiftyFourMutationApplied: verifierResult.fiftyFourMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localFiftyFourSmokePassed: verifierResult.localFiftyFourSmokePassed }, null, 2));
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
    "# Phase3777A-3835A Controlled Fifty-Four Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- fiftyFourMutationApplied: ${Boolean(result.fiftyFourMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localFiftyFourSmokePassed: ${Boolean(result.localFiftyFourSmokePassed)}`,
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
