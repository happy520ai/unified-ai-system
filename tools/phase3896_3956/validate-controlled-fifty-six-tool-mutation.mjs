import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase3896A-3956A-Controlled-Fifty-Six-Tool-Mutation";
const runnerPath = "tools/phase3896_3956/apply-controlled-fifty-six-tool-mutation.mjs";
const smokeRunnerPath = "tools/phase3896_3956/smoke-controlled-fifty-six-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase3896-3956-controlled-fifty-six-tool-mutation.md";
const approvalPath = "docs/phase3896-3956-controlled-fifty-six-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase3901-fifty-six-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase3902-fifty-six-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase3903-fifty-six-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase3904-fifty-six-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase3905-fifty-six-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase3906-fifty-six-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase3907-fifty-six-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase3908-fifty-six-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase3909-fifty-six-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase3910-fifty-six-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase3911-fifty-six-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase3912-fifty-six-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase3913-fifty-six-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase3914-fifty-six-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase3915-fifty-six-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase3916-fifty-six-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase3917-fifty-six-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase3918-fifty-six-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase3919-fifty-six-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase3920-fifty-six-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase3921-fifty-six-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase3922-fifty-six-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase3923-fifty-six-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase3924-fifty-six-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase3925-fifty-six-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase3926-fifty-six-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase3927-fifty-six-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase3928-fifty-six-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase3929-fifty-six-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase3930-fifty-six-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase3931-fifty-six-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase3932-fifty-six-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase3933-fifty-six-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase3934-fifty-six-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase3935-fifty-six-tool-mutation-target-thirty-five.proposal.diff";
const proposalThirtySixPath = "docs/phase3936-fifty-six-tool-mutation-target-thirty-six.proposal.diff";
const proposalThirtySevenPath = "docs/phase3937-fifty-six-tool-mutation-target-thirty-seven.proposal.diff";
const proposalThirtyEightPath = "docs/phase3938-fifty-six-tool-mutation-target-thirty-eight.proposal.diff";
const proposalThirtyNinePath = "docs/phase3939-fifty-six-tool-mutation-target-thirty-nine.proposal.diff";
const proposalFortyPath = "docs/phase3940-fifty-six-tool-mutation-target-forty.proposal.diff";
const proposalFortyOnePath = "docs/phase3941-fifty-six-tool-mutation-target-forty-one.proposal.diff";
const proposalFortyTwoPath = "docs/phase3942-fifty-six-tool-mutation-target-forty-two.proposal.diff";
const proposalFortyThreePath = "docs/phase3943-fifty-six-tool-mutation-target-forty-three.proposal.diff";
const proposalFortyFourPath = "docs/phase3944-fifty-six-tool-mutation-target-forty-four.proposal.diff";
const proposalFortyFivePath = "docs/phase3945-fifty-six-tool-mutation-target-forty-five.proposal.diff";
const proposalFortySixPath = "docs/phase3946-fifty-six-tool-mutation-target-forty-six.proposal.diff";
const proposalFortySevenPath = "docs/phase3947-fifty-six-tool-mutation-target-forty-seven.proposal.diff";
const proposalFortyEightPath = "docs/phase3948-fifty-six-tool-mutation-target-forty-eight.proposal.diff";
const proposalFortyNinePath = "docs/phase3949-fifty-six-tool-mutation-target-forty-nine.proposal.diff";
const proposalFiftyPath = "docs/phase3950-fifty-six-tool-mutation-target-fifty.proposal.diff";
const proposalFiftyOnePath = "docs/phase3951-fifty-six-tool-mutation-target-fifty-one.proposal.diff";
const proposalFiftyTwoPath = "docs/phase3952-fifty-six-tool-mutation-target-fifty-two.proposal.diff";
const proposalFiftyThreePath = "docs/phase3953-fifty-six-tool-mutation-target-fifty-three.proposal.diff";
const proposalFiftyFourPath = "docs/phase3954-fifty-six-tool-mutation-target-fifty-four.proposal.diff";
const proposalFiftyFivePath = "docs/phase3955-fifty-six-tool-mutation-target-fifty-five.proposal.diff";
const proposalFiftySixPath = "docs/phase3956-fifty-six-tool-mutation-target-fifty-six.proposal.diff";
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
const targetFiftySixPath = "tools/phase3836_3895/apply-controlled-fifty-five-tool-mutation.mjs";
const evidenceDir = "apps/ai-gateway-service/evidence/phase3896-3956-controlled-fifty-six-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase3896-3956-controlled-fifty-six-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase3896-3956-controlled-fifty-six-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase3896-3956-controlled-fifty-six-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase3896-3956-controlled-fifty-six-tool-mutation/fifty-six-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase3895 = readJson("apps/ai-gateway-service/evidence/phase3836-3895-controlled-fifty-five-tool-mutation/result.json") || {};
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
const targetFiftySix = existsSync(resolve(targetFiftySixPath)) ? readText(targetFiftySixPath) : "";
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
check("proposal_fifty-six_exists", existsSync(resolve(proposalFiftySixPath)));
check("package_apply_script_registered", packageJson.scripts?.["apply:phase3896-3956-controlled-fifty-six-tool-mutation"] === "node tools/phase3896_3956/apply-controlled-fifty-six-tool-mutation.mjs --plan docs/phase3896-3956-controlled-fifty-six-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase3896-3956-controlled-fifty-six-tool-mutation"] ===
    "node tools/phase3896_3956/smoke-controlled-fifty-six-tool-mutation.mjs",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase3896-3956-controlled-fifty-six-tool-mutation"] === "node tools/phase3896_3956/validate-controlled-fifty-six-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase3895_sealed", phase3895.recommendedSealed === true && phase3895.fiftyFiveMutationApplied === true);
check("result_exists", result !== null, "run apply:phase3896-3956-controlled-fifty-six-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("fifty_six_mutation_applied", result.fiftySixMutationApplied === true);
  check("changed_file_count_fifty_six", result.changedFileCount === 56);
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
    && result.changedFiles.includes(targetFiftySixPath)
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localFiftySixSmokePassed === true);
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
  check("rollback_restore_fifty_six", rollback.rollbackAction === "restore-previous-content-fifty-six");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_fifty_six_entries", Array.isArray(rollback.files) && rollback.files.length === 56);
}

if (smoke) {
  check("smoke_phase3901Marker", smoke.phase3901Marker === "PHASE3901_FIFTY_SIX_TOOL_TARGET_ONE_OK");
  check("smoke_phase3902Marker", smoke.phase3902Marker === "PHASE3902_FIFTY_SIX_TOOL_TARGET_TWO_OK");
  check("smoke_phase3903Marker", smoke.phase3903Marker === "PHASE3903_FIFTY_SIX_TOOL_TARGET_THREE_OK");
  check("smoke_phase3904Marker", smoke.phase3904Marker === "PHASE3904_FIFTY_SIX_TOOL_TARGET_FOUR_OK");
  check("smoke_phase3905Marker", smoke.phase3905Marker === "PHASE3905_FIFTY_SIX_TOOL_TARGET_FIVE_OK");
  check("smoke_phase3906Marker", smoke.phase3906Marker === "PHASE3906_FIFTY_SIX_TOOL_TARGET_SIX_OK");
  check("smoke_phase3907Marker", smoke.phase3907Marker === "PHASE3907_FIFTY_SIX_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase3908Marker", smoke.phase3908Marker === "PHASE3908_FIFTY_SIX_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase3909Marker", smoke.phase3909Marker === "PHASE3909_FIFTY_SIX_TOOL_TARGET_NINE_OK");
  check("smoke_phase3910Marker", smoke.phase3910Marker === "PHASE3910_FIFTY_SIX_TOOL_TARGET_TEN_OK");
  check("smoke_phase3911Marker", smoke.phase3911Marker === "PHASE3911_FIFTY_SIX_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase3912Marker", smoke.phase3912Marker === "PHASE3912_FIFTY_SIX_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase3913Marker", smoke.phase3913Marker === "PHASE3913_FIFTY_SIX_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase3914Marker", smoke.phase3914Marker === "PHASE3914_FIFTY_SIX_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase3915Marker", smoke.phase3915Marker === "PHASE3915_FIFTY_SIX_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase3916Marker", smoke.phase3916Marker === "PHASE3916_FIFTY_SIX_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase3917Marker", smoke.phase3917Marker === "PHASE3917_FIFTY_SIX_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase3918Marker", smoke.phase3918Marker === "PHASE3918_FIFTY_SIX_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase3919Marker", smoke.phase3919Marker === "PHASE3919_FIFTY_SIX_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase3920Marker", smoke.phase3920Marker === "PHASE3920_FIFTY_SIX_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase3921Marker", smoke.phase3921Marker === "PHASE3921_FIFTY_SIX_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase3922Marker", smoke.phase3922Marker === "PHASE3922_FIFTY_SIX_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase3923Marker", smoke.phase3923Marker === "PHASE3923_FIFTY_SIX_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase3924Marker", smoke.phase3924Marker === "PHASE3924_FIFTY_SIX_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase3925Marker", smoke.phase3925Marker === "PHASE3925_FIFTY_SIX_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase3926Marker", smoke.phase3926Marker === "PHASE3926_FIFTY_SIX_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase3927Marker", smoke.phase3927Marker === "PHASE3927_FIFTY_SIX_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase3928Marker", smoke.phase3928Marker === "PHASE3928_FIFTY_SIX_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase3929Marker", smoke.phase3929Marker === "PHASE3929_FIFTY_SIX_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase3930Marker", smoke.phase3930Marker === "PHASE3930_FIFTY_SIX_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase3931Marker", smoke.phase3931Marker === "PHASE3931_FIFTY_SIX_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase3932Marker", smoke.phase3932Marker === "PHASE3932_FIFTY_SIX_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase3933Marker", smoke.phase3933Marker === "PHASE3933_FIFTY_SIX_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase3934Marker", smoke.phase3934Marker === "PHASE3934_FIFTY_SIX_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase3935Marker", smoke.phase3935Marker === "PHASE3935_FIFTY_SIX_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_phase3936Marker", smoke.phase3936Marker === "PHASE3936_FIFTY_SIX_TOOL_TARGET_THIRTY_SIX_OK");
  check("smoke_phase3937Marker", smoke.phase3937Marker === "PHASE3937_FIFTY_SIX_TOOL_TARGET_THIRTY_SEVEN_OK");
  check("smoke_phase3938Marker", smoke.phase3938Marker === "PHASE3938_FIFTY_SIX_TOOL_TARGET_THIRTY_EIGHT_OK");
  check("smoke_phase3939Marker", smoke.phase3939Marker === "PHASE3939_FIFTY_SIX_TOOL_TARGET_THIRTY_NINE_OK");
  check("smoke_phase3940Marker", smoke.phase3940Marker === "PHASE3940_FIFTY_SIX_TOOL_TARGET_FORTY_OK");
  check("smoke_phase3941Marker", smoke.phase3941Marker === "PHASE3941_FIFTY_SIX_TOOL_TARGET_FORTY_ONE_OK");
  check("smoke_phase3942Marker", smoke.phase3942Marker === "PHASE3942_FIFTY_SIX_TOOL_TARGET_FORTY_TWO_OK");
  check("smoke_phase3943Marker", smoke.phase3943Marker === "PHASE3943_FIFTY_SIX_TOOL_TARGET_FORTY_THREE_OK");
  check("smoke_phase3944Marker", smoke.phase3944Marker === "PHASE3944_FIFTY_SIX_TOOL_TARGET_FORTY_FOUR_OK");
  check("smoke_phase3945Marker", smoke.phase3945Marker === "PHASE3945_FIFTY_SIX_TOOL_TARGET_FORTY_FIVE_OK");
  check("smoke_phase3946Marker", smoke.phase3946Marker === "PHASE3946_FIFTY_SIX_TOOL_TARGET_FORTY_SIX_OK");
  check("smoke_phase3947Marker", smoke.phase3947Marker === "PHASE3947_FIFTY_SIX_TOOL_TARGET_FORTY_SEVEN_OK");
  check("smoke_phase3948Marker", smoke.phase3948Marker === "PHASE3948_FIFTY_SIX_TOOL_TARGET_FORTY_EIGHT_OK");
  check("smoke_phase3949Marker", smoke.phase3949Marker === "PHASE3949_FIFTY_SIX_TOOL_TARGET_FORTY_NINE_OK");
  check("smoke_phase3950Marker", smoke.phase3950Marker === "PHASE3950_FIFTY_SIX_TOOL_TARGET_FIFTY_OK");
  check("smoke_phase3951Marker", smoke.phase3951Marker === "PHASE3951_FIFTY_SIX_TOOL_TARGET_FIFTY_ONE_OK");
  check("smoke_phase3952Marker", smoke.phase3952Marker === "PHASE3952_FIFTY_SIX_TOOL_TARGET_FIFTY_TWO_OK");
  check("smoke_phase3953Marker", smoke.phase3953Marker === "PHASE3953_FIFTY_SIX_TOOL_TARGET_FIFTY_THREE_OK");
  check("smoke_phase3954Marker", smoke.phase3954Marker === "PHASE3954_FIFTY_SIX_TOOL_TARGET_FIFTY_FOUR_OK");
  check("smoke_phase3955Marker", smoke.phase3955Marker === "PHASE3955_FIFTY_SIX_TOOL_TARGET_FIFTY_FIVE_OK");
  check("smoke_phase3956Marker", smoke.phase3956Marker === "PHASE3956_FIFTY_SIX_TOOL_TARGET_FIFTY_SIX_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase3901FiftySixMutationTargetOneStatus") || targetOne.includes("export function buildPhase3901FiftySixMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE3901_FIFTY_SIX_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase3902FiftySixMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase3902FiftySixMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE3902_FIFTY_SIX_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase3903FiftySixMutationTargetThreeStatus") || targetThree.includes("export function buildPhase3903FiftySixMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE3903_FIFTY_SIX_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase3904FiftySixMutationTargetFourStatus") || targetFour.includes("export function buildPhase3904FiftySixMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE3904_FIFTY_SIX_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase3905FiftySixMutationTargetFiveStatus") || targetFive.includes("export function buildPhase3905FiftySixMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE3905_FIFTY_SIX_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase3906FiftySixMutationTargetSixStatus") || targetSix.includes("export function buildPhase3906FiftySixMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE3906_FIFTY_SIX_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase3907FiftySixMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase3907FiftySixMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE3907_FIFTY_SIX_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase3908FiftySixMutationTargetEightStatus") || targetEight.includes("export function buildPhase3908FiftySixMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE3908_FIFTY_SIX_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase3909FiftySixMutationTargetNineStatus") || targetNine.includes("export function buildPhase3909FiftySixMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE3909_FIFTY_SIX_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase3910FiftySixMutationTargetTenStatus") || targetTen.includes("export function buildPhase3910FiftySixMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE3910_FIFTY_SIX_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase3911FiftySixMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase3911FiftySixMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE3911_FIFTY_SIX_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase3912FiftySixMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase3912FiftySixMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE3912_FIFTY_SIX_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase3913FiftySixMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase3913FiftySixMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE3913_FIFTY_SIX_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase3914FiftySixMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase3914FiftySixMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE3914_FIFTY_SIX_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase3915FiftySixMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase3915FiftySixMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE3915_FIFTY_SIX_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase3916FiftySixMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase3916FiftySixMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE3916_FIFTY_SIX_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase3917FiftySixMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase3917FiftySixMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE3917_FIFTY_SIX_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase3918FiftySixMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase3918FiftySixMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE3918_FIFTY_SIX_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase3919FiftySixMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase3919FiftySixMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE3919_FIFTY_SIX_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase3920FiftySixMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase3920FiftySixMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE3920_FIFTY_SIX_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase3921FiftySixMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase3921FiftySixMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE3921_FIFTY_SIX_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase3922FiftySixMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase3922FiftySixMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE3922_FIFTY_SIX_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase3923FiftySixMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase3923FiftySixMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE3923_FIFTY_SIX_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase3924FiftySixMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase3924FiftySixMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE3924_FIFTY_SIX_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase3925FiftySixMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase3925FiftySixMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE3925_FIFTY_SIX_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase3926FiftySixMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase3926FiftySixMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE3926_FIFTY_SIX_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase3927FiftySixMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase3927FiftySixMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE3927_FIFTY_SIX_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase3928FiftySixMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase3928FiftySixMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE3928_FIFTY_SIX_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase3929FiftySixMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase3929FiftySixMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE3929_FIFTY_SIX_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase3930FiftySixMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase3930FiftySixMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE3930_FIFTY_SIX_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase3931FiftySixMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase3931FiftySixMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE3931_FIFTY_SIX_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase3932FiftySixMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase3932FiftySixMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE3932_FIFTY_SIX_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase3933FiftySixMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase3933FiftySixMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE3933_FIFTY_SIX_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase3934FiftySixMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase3934FiftySixMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE3934_FIFTY_SIX_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase3935FiftySixMutationTargetThirtyFiveStatus") || targetThirtyFive.includes("export function buildPhase3935FiftySixMutationTargetThirtyFiveStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE3935_FIFTY_SIX_TOOL_TARGET_THIRTY_FIVE_OK"));
check("target-thirty-six_export", targetThirtySix.includes("buildPhase3936FiftySixMutationTargetThirtySixStatus") || targetThirtySix.includes("export function buildPhase3936FiftySixMutationTargetThirtySixStatus"));
check("target-thirty-six_marker", targetThirtySix.includes("PHASE3936_FIFTY_SIX_TOOL_TARGET_THIRTY_SIX_OK"));
check("target-thirty-seven_export", targetThirtySeven.includes("buildPhase3937FiftySixMutationTargetThirtySevenStatus") || targetThirtySeven.includes("export function buildPhase3937FiftySixMutationTargetThirtySevenStatus"));
check("target-thirty-seven_marker", targetThirtySeven.includes("PHASE3937_FIFTY_SIX_TOOL_TARGET_THIRTY_SEVEN_OK"));
check("target-thirty-eight_export", targetThirtyEight.includes("buildPhase3938FiftySixMutationTargetThirtyEightStatus") || targetThirtyEight.includes("export function buildPhase3938FiftySixMutationTargetThirtyEightStatus"));
check("target-thirty-eight_marker", targetThirtyEight.includes("PHASE3938_FIFTY_SIX_TOOL_TARGET_THIRTY_EIGHT_OK"));
check("target-thirty-nine_export", targetThirtyNine.includes("buildPhase3939FiftySixMutationTargetThirtyNineStatus") || targetThirtyNine.includes("export function buildPhase3939FiftySixMutationTargetThirtyNineStatus"));
check("target-thirty-nine_marker", targetThirtyNine.includes("PHASE3939_FIFTY_SIX_TOOL_TARGET_THIRTY_NINE_OK"));
check("target-forty_export", targetForty.includes("buildPhase3940FiftySixMutationTargetFortyStatus") || targetForty.includes("export function buildPhase3940FiftySixMutationTargetFortyStatus"));
check("target-forty_marker", targetForty.includes("PHASE3940_FIFTY_SIX_TOOL_TARGET_FORTY_OK"));
check("target-forty-one_export", targetFortyOne.includes("buildPhase3941FiftySixMutationTargetFortyOneStatus") || targetFortyOne.includes("export function buildPhase3941FiftySixMutationTargetFortyOneStatus"));
check("target-forty-one_marker", targetFortyOne.includes("PHASE3941_FIFTY_SIX_TOOL_TARGET_FORTY_ONE_OK"));
check("target-forty-two_export", targetFortyTwo.includes("buildPhase3942FiftySixMutationTargetFortyTwoStatus") || targetFortyTwo.includes("export function buildPhase3942FiftySixMutationTargetFortyTwoStatus"));
check("target-forty-two_marker", targetFortyTwo.includes("PHASE3942_FIFTY_SIX_TOOL_TARGET_FORTY_TWO_OK"));
check("target-forty-three_export", targetFortyThree.includes("buildPhase3943FiftySixMutationTargetFortyThreeStatus") || targetFortyThree.includes("export function buildPhase3943FiftySixMutationTargetFortyThreeStatus"));
check("target-forty-three_marker", targetFortyThree.includes("PHASE3943_FIFTY_SIX_TOOL_TARGET_FORTY_THREE_OK"));
check("target-forty-four_export", targetFortyFour.includes("buildPhase3944FiftySixMutationTargetFortyFourStatus") || targetFortyFour.includes("export function buildPhase3944FiftySixMutationTargetFortyFourStatus"));
check("target-forty-four_marker", targetFortyFour.includes("PHASE3944_FIFTY_SIX_TOOL_TARGET_FORTY_FOUR_OK"));
check("target-forty-five_export", targetFortyFive.includes("buildPhase3945FiftySixMutationTargetFortyFiveStatus") || targetFortyFive.includes("export function buildPhase3945FiftySixMutationTargetFortyFiveStatus"));
check("target-forty-five_marker", targetFortyFive.includes("PHASE3945_FIFTY_SIX_TOOL_TARGET_FORTY_FIVE_OK"));
check("target-forty-six_export", targetFortySix.includes("buildPhase3946FiftySixMutationTargetFortySixStatus") || targetFortySix.includes("export function buildPhase3946FiftySixMutationTargetFortySixStatus"));
check("target-forty-six_marker", targetFortySix.includes("PHASE3946_FIFTY_SIX_TOOL_TARGET_FORTY_SIX_OK"));
check("target-forty-seven_export", targetFortySeven.includes("buildPhase3947FiftySixMutationTargetFortySevenStatus") || targetFortySeven.includes("export function buildPhase3947FiftySixMutationTargetFortySevenStatus"));
check("target-forty-seven_marker", targetFortySeven.includes("PHASE3947_FIFTY_SIX_TOOL_TARGET_FORTY_SEVEN_OK"));
check("target-forty-eight_export", targetFortyEight.includes("buildPhase3948FiftySixMutationTargetFortyEightStatus") || targetFortyEight.includes("export function buildPhase3948FiftySixMutationTargetFortyEightStatus"));
check("target-forty-eight_marker", targetFortyEight.includes("PHASE3948_FIFTY_SIX_TOOL_TARGET_FORTY_EIGHT_OK"));
check("target-forty-nine_export", targetFortyNine.includes("buildPhase3949FiftySixMutationTargetFortyNineStatus") || targetFortyNine.includes("export function buildPhase3949FiftySixMutationTargetFortyNineStatus"));
check("target-forty-nine_marker", targetFortyNine.includes("PHASE3949_FIFTY_SIX_TOOL_TARGET_FORTY_NINE_OK"));
check("target-fifty_export", targetFifty.includes("buildPhase3950FiftySixMutationTargetFiftyStatus") || targetFifty.includes("export function buildPhase3950FiftySixMutationTargetFiftyStatus"));
check("target-fifty_marker", targetFifty.includes("PHASE3950_FIFTY_SIX_TOOL_TARGET_FIFTY_OK"));
check("target-fifty-one_export", targetFiftyOne.includes("buildPhase3951FiftySixMutationTargetFiftyOneStatus") || targetFiftyOne.includes("export function buildPhase3951FiftySixMutationTargetFiftyOneStatus"));
check("target-fifty-one_marker", targetFiftyOne.includes("PHASE3951_FIFTY_SIX_TOOL_TARGET_FIFTY_ONE_OK"));
check("target-fifty-two_export", targetFiftyTwo.includes("buildPhase3952FiftySixMutationTargetFiftyTwoStatus") || targetFiftyTwo.includes("export function buildPhase3952FiftySixMutationTargetFiftyTwoStatus"));
check("target-fifty-two_marker", targetFiftyTwo.includes("PHASE3952_FIFTY_SIX_TOOL_TARGET_FIFTY_TWO_OK"));
check("target-fifty-three_export", targetFiftyThree.includes("buildPhase3953FiftySixMutationTargetFiftyThreeStatus") || targetFiftyThree.includes("export function buildPhase3953FiftySixMutationTargetFiftyThreeStatus"));
check("target-fifty-three_marker", targetFiftyThree.includes("PHASE3953_FIFTY_SIX_TOOL_TARGET_FIFTY_THREE_OK"));
check("target-fifty-four_export", targetFiftyFour.includes("buildPhase3954FiftySixMutationTargetFiftyFourStatus") || targetFiftyFour.includes("export function buildPhase3954FiftySixMutationTargetFiftyFourStatus"));
check("target-fifty-four_marker", targetFiftyFour.includes("PHASE3954_FIFTY_SIX_TOOL_TARGET_FIFTY_FOUR_OK"));
check("target-fifty-five_export", targetFiftyFive.includes("buildPhase3955FiftySixMutationTargetFiftyFiveStatus") || targetFiftyFive.includes("export function buildPhase3955FiftySixMutationTargetFiftyFiveStatus"));
check("target-fifty-five_marker", targetFiftyFive.includes("PHASE3955_FIFTY_SIX_TOOL_TARGET_FIFTY_FIVE_OK"));
check("target-fifty-six_export", targetFiftySix.includes("buildPhase3956FiftySixMutationRuntimeStatus") || targetFiftySix.includes("export function buildPhase3956FiftySixMutationRuntimeStatus"));
check("target-fifty-six_marker", targetFiftySix.includes("PHASE3956_FIFTY_SIX_TOOL_TARGET_FIFTY_SIX_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_fifty_six", docs.includes("controlled fifty-six tool mutation"));
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
  phase3895Sealed: phase3895.recommendedSealed === true,
  fiftySixMutationReady: completed,
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
    targetFiftySixPath,
  ],
  changedFileCount: result?.changedFileCount ?? 56,
  fiftySixMutationApplied: result?.fiftySixMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localFiftySixSmokePassed: result?.localFiftySixSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, fiftySixMutationApplied: verifierResult.fiftySixMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localFiftySixSmokePassed: verifierResult.localFiftySixSmokePassed }, null, 2));
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
    "# Phase3896A-3956A Controlled Fifty-Six Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- fiftySixMutationApplied: ${Boolean(result.fiftySixMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localFiftySixSmokePassed: ${Boolean(result.localFiftySixSmokePassed)}`,
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
