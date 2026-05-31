import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase3836A-3895A-Controlled-Fifty-Five-Tool-Mutation";
const runnerPath = "tools/phase3836_3895/apply-controlled-fifty-five-tool-mutation.mjs";
const smokeRunnerPath = "tools/phase3836_3895/smoke-controlled-fifty-five-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase3836-3895-controlled-fifty-five-tool-mutation.md";
const approvalPath = "docs/phase3836-3895-controlled-fifty-five-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase3841-fifty-five-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase3842-fifty-five-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase3843-fifty-five-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase3844-fifty-five-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase3845-fifty-five-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase3846-fifty-five-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase3847-fifty-five-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase3848-fifty-five-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase3849-fifty-five-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase3850-fifty-five-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase3851-fifty-five-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase3852-fifty-five-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase3853-fifty-five-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase3854-fifty-five-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase3855-fifty-five-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase3856-fifty-five-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase3857-fifty-five-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase3858-fifty-five-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase3859-fifty-five-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase3860-fifty-five-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase3861-fifty-five-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase3862-fifty-five-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase3863-fifty-five-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase3864-fifty-five-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase3865-fifty-five-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase3866-fifty-five-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase3867-fifty-five-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase3868-fifty-five-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase3869-fifty-five-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase3870-fifty-five-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase3871-fifty-five-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase3872-fifty-five-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase3873-fifty-five-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase3874-fifty-five-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase3875-fifty-five-tool-mutation-target-thirty-five.proposal.diff";
const proposalThirtySixPath = "docs/phase3876-fifty-five-tool-mutation-target-thirty-six.proposal.diff";
const proposalThirtySevenPath = "docs/phase3877-fifty-five-tool-mutation-target-thirty-seven.proposal.diff";
const proposalThirtyEightPath = "docs/phase3878-fifty-five-tool-mutation-target-thirty-eight.proposal.diff";
const proposalThirtyNinePath = "docs/phase3879-fifty-five-tool-mutation-target-thirty-nine.proposal.diff";
const proposalFortyPath = "docs/phase3880-fifty-five-tool-mutation-target-forty.proposal.diff";
const proposalFortyOnePath = "docs/phase3881-fifty-five-tool-mutation-target-forty-one.proposal.diff";
const proposalFortyTwoPath = "docs/phase3882-fifty-five-tool-mutation-target-forty-two.proposal.diff";
const proposalFortyThreePath = "docs/phase3883-fifty-five-tool-mutation-target-forty-three.proposal.diff";
const proposalFortyFourPath = "docs/phase3884-fifty-five-tool-mutation-target-forty-four.proposal.diff";
const proposalFortyFivePath = "docs/phase3885-fifty-five-tool-mutation-target-forty-five.proposal.diff";
const proposalFortySixPath = "docs/phase3886-fifty-five-tool-mutation-target-forty-six.proposal.diff";
const proposalFortySevenPath = "docs/phase3887-fifty-five-tool-mutation-target-forty-seven.proposal.diff";
const proposalFortyEightPath = "docs/phase3888-fifty-five-tool-mutation-target-forty-eight.proposal.diff";
const proposalFortyNinePath = "docs/phase3889-fifty-five-tool-mutation-target-forty-nine.proposal.diff";
const proposalFiftyPath = "docs/phase3890-fifty-five-tool-mutation-target-fifty.proposal.diff";
const proposalFiftyOnePath = "docs/phase3891-fifty-five-tool-mutation-target-fifty-one.proposal.diff";
const proposalFiftyTwoPath = "docs/phase3892-fifty-five-tool-mutation-target-fifty-two.proposal.diff";
const proposalFiftyThreePath = "docs/phase3893-fifty-five-tool-mutation-target-fifty-three.proposal.diff";
const proposalFiftyFourPath = "docs/phase3894-fifty-five-tool-mutation-target-fifty-four.proposal.diff";
const proposalFiftyFivePath = "docs/phase3895-fifty-five-tool-mutation-target-fifty-five.proposal.diff";
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
const targetFiftyFivePath = "tools/phase3777_3835/apply-controlled-fifty-four-tool-mutation.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase3836-3895-controlled-fifty-five-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase3836-3895-controlled-fifty-five-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase3836-3895-controlled-fifty-five-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase3836-3895-controlled-fifty-five-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase3836-3895-controlled-fifty-five-tool-mutation/fifty-five-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase3835 = readJson("apps/ai-gateway-service/evidence/phase3777-3835-controlled-fifty-four-tool-mutation/result.json") || {};
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
const targetFiftyFive = existsSync(resolve(targetFiftyFivePath)) ? readText(targetFiftyFivePath) : "";
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
check("proposal_fifty-five_exists", existsSync(resolve(proposalFiftyFivePath)));
check("package_apply_script_registered", packageJson.scripts?.["apply:phase3836-3895-controlled-fifty-five-tool-mutation"] === "node tools/phase3836_3895/apply-controlled-fifty-five-tool-mutation.mjs --plan docs/phase3836-3895-controlled-fifty-five-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase3836-3895-controlled-fifty-five-tool-mutation"] ===
    "node tools/phase3836_3895/smoke-controlled-fifty-five-tool-mutation.mjs",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase3836-3895-controlled-fifty-five-tool-mutation"] === "node tools/phase3836_3895/validate-controlled-fifty-five-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase3835_sealed", phase3835.recommendedSealed === true && phase3835.fiftyFourMutationApplied === true);
check("result_exists", result !== null, "run apply:phase3836-3895-controlled-fifty-five-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("fifty_five_mutation_applied", result.fiftyFiveMutationApplied === true);
  check("changed_file_count_fifty_five", result.changedFileCount === 55);
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
    && result.changedFiles.includes(targetFiftyFivePath)
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localFiftyFiveSmokePassed === true);
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
  check("rollback_restore_fifty_five", rollback.rollbackAction === "restore-previous-content-fifty-five");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_fifty_five_entries", Array.isArray(rollback.files) && rollback.files.length === 55);
}

if (smoke) {
  check("smoke_phase3841Marker", smoke.phase3841Marker === "PHASE3841_FIFTY_FIVE_TOOL_TARGET_ONE_OK");
  check("smoke_phase3842Marker", smoke.phase3842Marker === "PHASE3842_FIFTY_FIVE_TOOL_TARGET_TWO_OK");
  check("smoke_phase3843Marker", smoke.phase3843Marker === "PHASE3843_FIFTY_FIVE_TOOL_TARGET_THREE_OK");
  check("smoke_phase3844Marker", smoke.phase3844Marker === "PHASE3844_FIFTY_FIVE_TOOL_TARGET_FOUR_OK");
  check("smoke_phase3845Marker", smoke.phase3845Marker === "PHASE3845_FIFTY_FIVE_TOOL_TARGET_FIVE_OK");
  check("smoke_phase3846Marker", smoke.phase3846Marker === "PHASE3846_FIFTY_FIVE_TOOL_TARGET_SIX_OK");
  check("smoke_phase3847Marker", smoke.phase3847Marker === "PHASE3847_FIFTY_FIVE_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase3848Marker", smoke.phase3848Marker === "PHASE3848_FIFTY_FIVE_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase3849Marker", smoke.phase3849Marker === "PHASE3849_FIFTY_FIVE_TOOL_TARGET_NINE_OK");
  check("smoke_phase3850Marker", smoke.phase3850Marker === "PHASE3850_FIFTY_FIVE_TOOL_TARGET_TEN_OK");
  check("smoke_phase3851Marker", smoke.phase3851Marker === "PHASE3851_FIFTY_FIVE_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase3852Marker", smoke.phase3852Marker === "PHASE3852_FIFTY_FIVE_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase3853Marker", smoke.phase3853Marker === "PHASE3853_FIFTY_FIVE_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase3854Marker", smoke.phase3854Marker === "PHASE3854_FIFTY_FIVE_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase3855Marker", smoke.phase3855Marker === "PHASE3855_FIFTY_FIVE_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase3856Marker", smoke.phase3856Marker === "PHASE3856_FIFTY_FIVE_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase3857Marker", smoke.phase3857Marker === "PHASE3857_FIFTY_FIVE_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase3858Marker", smoke.phase3858Marker === "PHASE3858_FIFTY_FIVE_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase3859Marker", smoke.phase3859Marker === "PHASE3859_FIFTY_FIVE_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase3860Marker", smoke.phase3860Marker === "PHASE3860_FIFTY_FIVE_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase3861Marker", smoke.phase3861Marker === "PHASE3861_FIFTY_FIVE_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase3862Marker", smoke.phase3862Marker === "PHASE3862_FIFTY_FIVE_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase3863Marker", smoke.phase3863Marker === "PHASE3863_FIFTY_FIVE_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase3864Marker", smoke.phase3864Marker === "PHASE3864_FIFTY_FIVE_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase3865Marker", smoke.phase3865Marker === "PHASE3865_FIFTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase3866Marker", smoke.phase3866Marker === "PHASE3866_FIFTY_FIVE_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase3867Marker", smoke.phase3867Marker === "PHASE3867_FIFTY_FIVE_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase3868Marker", smoke.phase3868Marker === "PHASE3868_FIFTY_FIVE_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase3869Marker", smoke.phase3869Marker === "PHASE3869_FIFTY_FIVE_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase3870Marker", smoke.phase3870Marker === "PHASE3870_FIFTY_FIVE_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase3871Marker", smoke.phase3871Marker === "PHASE3871_FIFTY_FIVE_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase3872Marker", smoke.phase3872Marker === "PHASE3872_FIFTY_FIVE_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase3873Marker", smoke.phase3873Marker === "PHASE3873_FIFTY_FIVE_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase3874Marker", smoke.phase3874Marker === "PHASE3874_FIFTY_FIVE_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase3875Marker", smoke.phase3875Marker === "PHASE3875_FIFTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_phase3876Marker", smoke.phase3876Marker === "PHASE3876_FIFTY_FIVE_TOOL_TARGET_THIRTY_SIX_OK");
  check("smoke_phase3877Marker", smoke.phase3877Marker === "PHASE3877_FIFTY_FIVE_TOOL_TARGET_THIRTY_SEVEN_OK");
  check("smoke_phase3878Marker", smoke.phase3878Marker === "PHASE3878_FIFTY_FIVE_TOOL_TARGET_THIRTY_EIGHT_OK");
  check("smoke_phase3879Marker", smoke.phase3879Marker === "PHASE3879_FIFTY_FIVE_TOOL_TARGET_THIRTY_NINE_OK");
  check("smoke_phase3880Marker", smoke.phase3880Marker === "PHASE3880_FIFTY_FIVE_TOOL_TARGET_FORTY_OK");
  check("smoke_phase3881Marker", smoke.phase3881Marker === "PHASE3881_FIFTY_FIVE_TOOL_TARGET_FORTY_ONE_OK");
  check("smoke_phase3882Marker", smoke.phase3882Marker === "PHASE3882_FIFTY_FIVE_TOOL_TARGET_FORTY_TWO_OK");
  check("smoke_phase3883Marker", smoke.phase3883Marker === "PHASE3883_FIFTY_FIVE_TOOL_TARGET_FORTY_THREE_OK");
  check("smoke_phase3884Marker", smoke.phase3884Marker === "PHASE3884_FIFTY_FIVE_TOOL_TARGET_FORTY_FOUR_OK");
  check("smoke_phase3885Marker", smoke.phase3885Marker === "PHASE3885_FIFTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK");
  check("smoke_phase3886Marker", smoke.phase3886Marker === "PHASE3886_FIFTY_FIVE_TOOL_TARGET_FORTY_SIX_OK");
  check("smoke_phase3887Marker", smoke.phase3887Marker === "PHASE3887_FIFTY_FIVE_TOOL_TARGET_FORTY_SEVEN_OK");
  check("smoke_phase3888Marker", smoke.phase3888Marker === "PHASE3888_FIFTY_FIVE_TOOL_TARGET_FORTY_EIGHT_OK");
  check("smoke_phase3889Marker", smoke.phase3889Marker === "PHASE3889_FIFTY_FIVE_TOOL_TARGET_FORTY_NINE_OK");
  check("smoke_phase3890Marker", smoke.phase3890Marker === "PHASE3890_FIFTY_FIVE_TOOL_TARGET_FIFTY_OK");
  check("smoke_phase3891Marker", smoke.phase3891Marker === "PHASE3891_FIFTY_FIVE_TOOL_TARGET_FIFTY_ONE_OK");
  check("smoke_phase3892Marker", smoke.phase3892Marker === "PHASE3892_FIFTY_FIVE_TOOL_TARGET_FIFTY_TWO_OK");
  check("smoke_phase3893Marker", smoke.phase3893Marker === "PHASE3893_FIFTY_FIVE_TOOL_TARGET_FIFTY_THREE_OK");
  check("smoke_phase3894Marker", smoke.phase3894Marker === "PHASE3894_FIFTY_FIVE_TOOL_TARGET_FIFTY_FOUR_OK");
  check("smoke_phase3895Marker", smoke.phase3895Marker === "PHASE3895_FIFTY_FIVE_TOOL_TARGET_FIFTY_FIVE_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase3841FiftyFiveMutationTargetOneStatus") || targetOne.includes("export function buildPhase3841FiftyFiveMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE3841_FIFTY_FIVE_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase3842FiftyFiveMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase3842FiftyFiveMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE3842_FIFTY_FIVE_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase3843FiftyFiveMutationTargetThreeStatus") || targetThree.includes("export function buildPhase3843FiftyFiveMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE3843_FIFTY_FIVE_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase3844FiftyFiveMutationTargetFourStatus") || targetFour.includes("export function buildPhase3844FiftyFiveMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE3844_FIFTY_FIVE_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase3845FiftyFiveMutationTargetFiveStatus") || targetFive.includes("export function buildPhase3845FiftyFiveMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE3845_FIFTY_FIVE_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase3846FiftyFiveMutationTargetSixStatus") || targetSix.includes("export function buildPhase3846FiftyFiveMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE3846_FIFTY_FIVE_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase3847FiftyFiveMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase3847FiftyFiveMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE3847_FIFTY_FIVE_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase3848FiftyFiveMutationTargetEightStatus") || targetEight.includes("export function buildPhase3848FiftyFiveMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE3848_FIFTY_FIVE_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase3849FiftyFiveMutationTargetNineStatus") || targetNine.includes("export function buildPhase3849FiftyFiveMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE3849_FIFTY_FIVE_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase3850FiftyFiveMutationTargetTenStatus") || targetTen.includes("export function buildPhase3850FiftyFiveMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE3850_FIFTY_FIVE_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase3851FiftyFiveMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase3851FiftyFiveMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE3851_FIFTY_FIVE_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase3852FiftyFiveMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase3852FiftyFiveMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE3852_FIFTY_FIVE_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase3853FiftyFiveMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase3853FiftyFiveMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE3853_FIFTY_FIVE_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase3854FiftyFiveMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase3854FiftyFiveMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE3854_FIFTY_FIVE_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase3855FiftyFiveMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase3855FiftyFiveMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE3855_FIFTY_FIVE_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase3856FiftyFiveMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase3856FiftyFiveMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE3856_FIFTY_FIVE_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase3857FiftyFiveMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase3857FiftyFiveMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE3857_FIFTY_FIVE_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase3858FiftyFiveMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase3858FiftyFiveMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE3858_FIFTY_FIVE_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase3859FiftyFiveMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase3859FiftyFiveMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE3859_FIFTY_FIVE_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase3860FiftyFiveMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase3860FiftyFiveMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE3860_FIFTY_FIVE_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase3861FiftyFiveMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase3861FiftyFiveMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE3861_FIFTY_FIVE_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase3862FiftyFiveMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase3862FiftyFiveMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE3862_FIFTY_FIVE_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase3863FiftyFiveMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase3863FiftyFiveMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE3863_FIFTY_FIVE_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase3864FiftyFiveMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase3864FiftyFiveMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE3864_FIFTY_FIVE_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase3865FiftyFiveMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase3865FiftyFiveMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE3865_FIFTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase3866FiftyFiveMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase3866FiftyFiveMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE3866_FIFTY_FIVE_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase3867FiftyFiveMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase3867FiftyFiveMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE3867_FIFTY_FIVE_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase3868FiftyFiveMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase3868FiftyFiveMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE3868_FIFTY_FIVE_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase3869FiftyFiveMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase3869FiftyFiveMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE3869_FIFTY_FIVE_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase3870FiftyFiveMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase3870FiftyFiveMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE3870_FIFTY_FIVE_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase3871FiftyFiveMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase3871FiftyFiveMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE3871_FIFTY_FIVE_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase3872FiftyFiveMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase3872FiftyFiveMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE3872_FIFTY_FIVE_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase3873FiftyFiveMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase3873FiftyFiveMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE3873_FIFTY_FIVE_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase3874FiftyFiveMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase3874FiftyFiveMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE3874_FIFTY_FIVE_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase3875FiftyFiveMutationTargetThirtyFiveStatus") || targetThirtyFive.includes("export function buildPhase3875FiftyFiveMutationTargetThirtyFiveStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE3875_FIFTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK"));
check("target-thirty-six_export", targetThirtySix.includes("buildPhase3876FiftyFiveMutationTargetThirtySixStatus") || targetThirtySix.includes("export function buildPhase3876FiftyFiveMutationTargetThirtySixStatus"));
check("target-thirty-six_marker", targetThirtySix.includes("PHASE3876_FIFTY_FIVE_TOOL_TARGET_THIRTY_SIX_OK"));
check("target-thirty-seven_export", targetThirtySeven.includes("buildPhase3877FiftyFiveMutationTargetThirtySevenStatus") || targetThirtySeven.includes("export function buildPhase3877FiftyFiveMutationTargetThirtySevenStatus"));
check("target-thirty-seven_marker", targetThirtySeven.includes("PHASE3877_FIFTY_FIVE_TOOL_TARGET_THIRTY_SEVEN_OK"));
check("target-thirty-eight_export", targetThirtyEight.includes("buildPhase3878FiftyFiveMutationTargetThirtyEightStatus") || targetThirtyEight.includes("export function buildPhase3878FiftyFiveMutationTargetThirtyEightStatus"));
check("target-thirty-eight_marker", targetThirtyEight.includes("PHASE3878_FIFTY_FIVE_TOOL_TARGET_THIRTY_EIGHT_OK"));
check("target-thirty-nine_export", targetThirtyNine.includes("buildPhase3879FiftyFiveMutationTargetThirtyNineStatus") || targetThirtyNine.includes("export function buildPhase3879FiftyFiveMutationTargetThirtyNineStatus"));
check("target-thirty-nine_marker", targetThirtyNine.includes("PHASE3879_FIFTY_FIVE_TOOL_TARGET_THIRTY_NINE_OK"));
check("target-forty_export", targetForty.includes("buildPhase3880FiftyFiveMutationTargetFortyStatus") || targetForty.includes("export function buildPhase3880FiftyFiveMutationTargetFortyStatus"));
check("target-forty_marker", targetForty.includes("PHASE3880_FIFTY_FIVE_TOOL_TARGET_FORTY_OK"));
check("target-forty-one_export", targetFortyOne.includes("buildPhase3881FiftyFiveMutationTargetFortyOneStatus") || targetFortyOne.includes("export function buildPhase3881FiftyFiveMutationTargetFortyOneStatus"));
check("target-forty-one_marker", targetFortyOne.includes("PHASE3881_FIFTY_FIVE_TOOL_TARGET_FORTY_ONE_OK"));
check("target-forty-two_export", targetFortyTwo.includes("buildPhase3882FiftyFiveMutationTargetFortyTwoStatus") || targetFortyTwo.includes("export function buildPhase3882FiftyFiveMutationTargetFortyTwoStatus"));
check("target-forty-two_marker", targetFortyTwo.includes("PHASE3882_FIFTY_FIVE_TOOL_TARGET_FORTY_TWO_OK"));
check("target-forty-three_export", targetFortyThree.includes("buildPhase3883FiftyFiveMutationTargetFortyThreeStatus") || targetFortyThree.includes("export function buildPhase3883FiftyFiveMutationTargetFortyThreeStatus"));
check("target-forty-three_marker", targetFortyThree.includes("PHASE3883_FIFTY_FIVE_TOOL_TARGET_FORTY_THREE_OK"));
check("target-forty-four_export", targetFortyFour.includes("buildPhase3884FiftyFiveMutationTargetFortyFourStatus") || targetFortyFour.includes("export function buildPhase3884FiftyFiveMutationTargetFortyFourStatus"));
check("target-forty-four_marker", targetFortyFour.includes("PHASE3884_FIFTY_FIVE_TOOL_TARGET_FORTY_FOUR_OK"));
check("target-forty-five_export", targetFortyFive.includes("buildPhase3885FiftyFiveMutationTargetFortyFiveStatus") || targetFortyFive.includes("export function buildPhase3885FiftyFiveMutationTargetFortyFiveStatus"));
check("target-forty-five_marker", targetFortyFive.includes("PHASE3885_FIFTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK"));
check("target-forty-six_export", targetFortySix.includes("buildPhase3886FiftyFiveMutationTargetFortySixStatus") || targetFortySix.includes("export function buildPhase3886FiftyFiveMutationTargetFortySixStatus"));
check("target-forty-six_marker", targetFortySix.includes("PHASE3886_FIFTY_FIVE_TOOL_TARGET_FORTY_SIX_OK"));
check("target-forty-seven_export", targetFortySeven.includes("buildPhase3887FiftyFiveMutationTargetFortySevenStatus") || targetFortySeven.includes("export function buildPhase3887FiftyFiveMutationTargetFortySevenStatus"));
check("target-forty-seven_marker", targetFortySeven.includes("PHASE3887_FIFTY_FIVE_TOOL_TARGET_FORTY_SEVEN_OK"));
check("target-forty-eight_export", targetFortyEight.includes("buildPhase3888FiftyFiveMutationTargetFortyEightStatus") || targetFortyEight.includes("export function buildPhase3888FiftyFiveMutationTargetFortyEightStatus"));
check("target-forty-eight_marker", targetFortyEight.includes("PHASE3888_FIFTY_FIVE_TOOL_TARGET_FORTY_EIGHT_OK"));
check("target-forty-nine_export", targetFortyNine.includes("buildPhase3889FiftyFiveMutationTargetFortyNineStatus") || targetFortyNine.includes("export function buildPhase3889FiftyFiveMutationTargetFortyNineStatus"));
check("target-forty-nine_marker", targetFortyNine.includes("PHASE3889_FIFTY_FIVE_TOOL_TARGET_FORTY_NINE_OK"));
check("target-fifty_export", targetFifty.includes("buildPhase3890FiftyFiveMutationTargetFiftyStatus") || targetFifty.includes("export function buildPhase3890FiftyFiveMutationTargetFiftyStatus"));
check("target-fifty_marker", targetFifty.includes("PHASE3890_FIFTY_FIVE_TOOL_TARGET_FIFTY_OK"));
check("target-fifty-one_export", targetFiftyOne.includes("buildPhase3891FiftyFiveMutationTargetFiftyOneStatus") || targetFiftyOne.includes("export function buildPhase3891FiftyFiveMutationTargetFiftyOneStatus"));
check("target-fifty-one_marker", targetFiftyOne.includes("PHASE3891_FIFTY_FIVE_TOOL_TARGET_FIFTY_ONE_OK"));
check("target-fifty-two_export", targetFiftyTwo.includes("buildPhase3892FiftyFiveMutationTargetFiftyTwoStatus") || targetFiftyTwo.includes("export function buildPhase3892FiftyFiveMutationTargetFiftyTwoStatus"));
check("target-fifty-two_marker", targetFiftyTwo.includes("PHASE3892_FIFTY_FIVE_TOOL_TARGET_FIFTY_TWO_OK"));
check("target-fifty-three_export", targetFiftyThree.includes("buildPhase3893FiftyFiveMutationTargetFiftyThreeStatus") || targetFiftyThree.includes("export function buildPhase3893FiftyFiveMutationTargetFiftyThreeStatus"));
check("target-fifty-three_marker", targetFiftyThree.includes("PHASE3893_FIFTY_FIVE_TOOL_TARGET_FIFTY_THREE_OK"));
check("target-fifty-four_export", targetFiftyFour.includes("buildPhase3894FiftyFiveMutationTargetFiftyFourStatus") || targetFiftyFour.includes("export function buildPhase3894FiftyFiveMutationTargetFiftyFourStatus"));
check("target-fifty-four_marker", targetFiftyFour.includes("PHASE3894_FIFTY_FIVE_TOOL_TARGET_FIFTY_FOUR_OK"));
check("target-fifty-five_export", targetFiftyFive.includes("buildPhase3895FiftyFiveMutationRuntimeStatus") || targetFiftyFive.includes("export function buildPhase3895FiftyFiveMutationRuntimeStatus"));
check("target-fifty-five_marker", targetFiftyFive.includes("PHASE3895_FIFTY_FIVE_TOOL_TARGET_FIFTY_FIVE_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_fifty_five", docs.includes("controlled fifty-five tool mutation"));
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
  phase3835Sealed: phase3835.recommendedSealed === true,
  fiftyFiveMutationReady: completed,
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
    targetFiftyFivePath,
  ],
  changedFileCount: result?.changedFileCount ?? 55,
  fiftyFiveMutationApplied: result?.fiftyFiveMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localFiftyFiveSmokePassed: result?.localFiftyFiveSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, fiftyFiveMutationApplied: verifierResult.fiftyFiveMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localFiftyFiveSmokePassed: verifierResult.localFiftyFiveSmokePassed }, null, 2));
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
    "# Phase3836A-3895A Controlled Fifty-Five Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- fiftyFiveMutationApplied: ${Boolean(result.fiftyFiveMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localFiftyFiveSmokePassed: ${Boolean(result.localFiftyFiveSmokePassed)}`,
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
