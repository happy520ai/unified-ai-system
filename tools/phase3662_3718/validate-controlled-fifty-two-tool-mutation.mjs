import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase3662A-3718A-Controlled-Fifty-Two-Tool-Mutation";
const runnerPath = "tools/phase3662_3718/apply-controlled-fifty-two-tool-mutation.mjs";
const smokeRunnerPath = "tools/phase3662_3718/smoke-controlled-fifty-two-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase3662-3718-controlled-fifty-two-tool-mutation.md";
const approvalPath = "docs/phase3662-3718-controlled-fifty-two-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase3667-fifty-two-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase3668-fifty-two-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase3669-fifty-two-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase3670-fifty-two-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase3671-fifty-two-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase3672-fifty-two-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase3673-fifty-two-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase3674-fifty-two-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase3675-fifty-two-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase3676-fifty-two-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase3677-fifty-two-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase3678-fifty-two-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase3679-fifty-two-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase3680-fifty-two-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase3681-fifty-two-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase3682-fifty-two-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase3683-fifty-two-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase3684-fifty-two-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase3685-fifty-two-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase3686-fifty-two-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase3687-fifty-two-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase3688-fifty-two-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase3689-fifty-two-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase3690-fifty-two-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase3691-fifty-two-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase3692-fifty-two-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase3693-fifty-two-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase3694-fifty-two-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase3695-fifty-two-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase3696-fifty-two-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase3697-fifty-two-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase3698-fifty-two-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase3699-fifty-two-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase3700-fifty-two-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase3701-fifty-two-tool-mutation-target-thirty-five.proposal.diff";
const proposalThirtySixPath = "docs/phase3702-fifty-two-tool-mutation-target-thirty-six.proposal.diff";
const proposalThirtySevenPath = "docs/phase3703-fifty-two-tool-mutation-target-thirty-seven.proposal.diff";
const proposalThirtyEightPath = "docs/phase3704-fifty-two-tool-mutation-target-thirty-eight.proposal.diff";
const proposalThirtyNinePath = "docs/phase3705-fifty-two-tool-mutation-target-thirty-nine.proposal.diff";
const proposalFortyPath = "docs/phase3706-fifty-two-tool-mutation-target-forty.proposal.diff";
const proposalFortyOnePath = "docs/phase3707-fifty-two-tool-mutation-target-forty-one.proposal.diff";
const proposalFortyTwoPath = "docs/phase3708-fifty-two-tool-mutation-target-forty-two.proposal.diff";
const proposalFortyThreePath = "docs/phase3709-fifty-two-tool-mutation-target-forty-three.proposal.diff";
const proposalFortyFourPath = "docs/phase3710-fifty-two-tool-mutation-target-forty-four.proposal.diff";
const proposalFortyFivePath = "docs/phase3711-fifty-two-tool-mutation-target-forty-five.proposal.diff";
const proposalFortySixPath = "docs/phase3712-fifty-two-tool-mutation-target-forty-six.proposal.diff";
const proposalFortySevenPath = "docs/phase3713-fifty-two-tool-mutation-target-forty-seven.proposal.diff";
const proposalFortyEightPath = "docs/phase3714-fifty-two-tool-mutation-target-forty-eight.proposal.diff";
const proposalFortyNinePath = "docs/phase3715-fifty-two-tool-mutation-target-forty-nine.proposal.diff";
const proposalFiftyPath = "docs/phase3716-fifty-two-tool-mutation-target-fifty.proposal.diff";
const proposalFiftyOnePath = "docs/phase3717-fifty-two-tool-mutation-target-fifty-one.proposal.diff";
const proposalFiftyTwoPath = "docs/phase3718-fifty-two-tool-mutation-target-fifty-two.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase3662-3718-controlled-fifty-two-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase3662-3718-controlled-fifty-two-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase3662-3718-controlled-fifty-two-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase3662-3718-controlled-fifty-two-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase3662-3718-controlled-fifty-two-tool-mutation/fifty-two-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase3661 = readJson("apps/ai-gateway-service/evidence/phase3606-3661-controlled-fifty-one-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase3662-3718-controlled-fifty-two-tool-mutation"] === "node tools/phase3662_3718/apply-controlled-fifty-two-tool-mutation.mjs --plan docs/phase3662-3718-controlled-fifty-two-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase3662-3718-controlled-fifty-two-tool-mutation"] ===
    "node tools/phase3662_3718/smoke-controlled-fifty-two-tool-mutation.mjs",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase3662-3718-controlled-fifty-two-tool-mutation"] === "node tools/phase3662_3718/validate-controlled-fifty-two-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase3661_sealed", phase3661.recommendedSealed === true && phase3661.fiftyOneMutationApplied === true);
check("result_exists", result !== null, "run apply:phase3662-3718-controlled-fifty-two-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("fifty_two_mutation_applied", result.fiftyTwoMutationApplied === true);
  check("changed_file_count_fifty_two", result.changedFileCount === 52);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localFiftyTwoSmokePassed === true);
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
  check("rollback_restore_fifty_two", rollback.rollbackAction === "restore-previous-content-fifty-two");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_fifty_two_entries", Array.isArray(rollback.files) && rollback.files.length === 52);
}

if (smoke) {
  check("smoke_phase3667Marker", smoke.phase3667Marker === "PHASE3667_FIFTY_TWO_TOOL_TARGET_ONE_OK");
  check("smoke_phase3668Marker", smoke.phase3668Marker === "PHASE3668_FIFTY_TWO_TOOL_TARGET_TWO_OK");
  check("smoke_phase3669Marker", smoke.phase3669Marker === "PHASE3669_FIFTY_TWO_TOOL_TARGET_THREE_OK");
  check("smoke_phase3670Marker", smoke.phase3670Marker === "PHASE3670_FIFTY_TWO_TOOL_TARGET_FOUR_OK");
  check("smoke_phase3671Marker", smoke.phase3671Marker === "PHASE3671_FIFTY_TWO_TOOL_TARGET_FIVE_OK");
  check("smoke_phase3672Marker", smoke.phase3672Marker === "PHASE3672_FIFTY_TWO_TOOL_TARGET_SIX_OK");
  check("smoke_phase3673Marker", smoke.phase3673Marker === "PHASE3673_FIFTY_TWO_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase3674Marker", smoke.phase3674Marker === "PHASE3674_FIFTY_TWO_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase3675Marker", smoke.phase3675Marker === "PHASE3675_FIFTY_TWO_TOOL_TARGET_NINE_OK");
  check("smoke_phase3676Marker", smoke.phase3676Marker === "PHASE3676_FIFTY_TWO_TOOL_TARGET_TEN_OK");
  check("smoke_phase3677Marker", smoke.phase3677Marker === "PHASE3677_FIFTY_TWO_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase3678Marker", smoke.phase3678Marker === "PHASE3678_FIFTY_TWO_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase3679Marker", smoke.phase3679Marker === "PHASE3679_FIFTY_TWO_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase3680Marker", smoke.phase3680Marker === "PHASE3680_FIFTY_TWO_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase3681Marker", smoke.phase3681Marker === "PHASE3681_FIFTY_TWO_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase3682Marker", smoke.phase3682Marker === "PHASE3682_FIFTY_TWO_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase3683Marker", smoke.phase3683Marker === "PHASE3683_FIFTY_TWO_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase3684Marker", smoke.phase3684Marker === "PHASE3684_FIFTY_TWO_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase3685Marker", smoke.phase3685Marker === "PHASE3685_FIFTY_TWO_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase3686Marker", smoke.phase3686Marker === "PHASE3686_FIFTY_TWO_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase3687Marker", smoke.phase3687Marker === "PHASE3687_FIFTY_TWO_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase3688Marker", smoke.phase3688Marker === "PHASE3688_FIFTY_TWO_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase3689Marker", smoke.phase3689Marker === "PHASE3689_FIFTY_TWO_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase3690Marker", smoke.phase3690Marker === "PHASE3690_FIFTY_TWO_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase3691Marker", smoke.phase3691Marker === "PHASE3691_FIFTY_TWO_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase3692Marker", smoke.phase3692Marker === "PHASE3692_FIFTY_TWO_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase3693Marker", smoke.phase3693Marker === "PHASE3693_FIFTY_TWO_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase3694Marker", smoke.phase3694Marker === "PHASE3694_FIFTY_TWO_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase3695Marker", smoke.phase3695Marker === "PHASE3695_FIFTY_TWO_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase3696Marker", smoke.phase3696Marker === "PHASE3696_FIFTY_TWO_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase3697Marker", smoke.phase3697Marker === "PHASE3697_FIFTY_TWO_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase3698Marker", smoke.phase3698Marker === "PHASE3698_FIFTY_TWO_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase3699Marker", smoke.phase3699Marker === "PHASE3699_FIFTY_TWO_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase3700Marker", smoke.phase3700Marker === "PHASE3700_FIFTY_TWO_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase3701Marker", smoke.phase3701Marker === "PHASE3701_FIFTY_TWO_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_phase3702Marker", smoke.phase3702Marker === "PHASE3702_FIFTY_TWO_TOOL_TARGET_THIRTY_SIX_OK");
  check("smoke_phase3703Marker", smoke.phase3703Marker === "PHASE3703_FIFTY_TWO_TOOL_TARGET_THIRTY_SEVEN_OK");
  check("smoke_phase3704Marker", smoke.phase3704Marker === "PHASE3704_FIFTY_TWO_TOOL_TARGET_THIRTY_EIGHT_OK");
  check("smoke_phase3705Marker", smoke.phase3705Marker === "PHASE3705_FIFTY_TWO_TOOL_TARGET_THIRTY_NINE_OK");
  check("smoke_phase3706Marker", smoke.phase3706Marker === "PHASE3706_FIFTY_TWO_TOOL_TARGET_FORTY_OK");
  check("smoke_phase3707Marker", smoke.phase3707Marker === "PHASE3707_FIFTY_TWO_TOOL_TARGET_FORTY_ONE_OK");
  check("smoke_phase3708Marker", smoke.phase3708Marker === "PHASE3708_FIFTY_TWO_TOOL_TARGET_FORTY_TWO_OK");
  check("smoke_phase3709Marker", smoke.phase3709Marker === "PHASE3709_FIFTY_TWO_TOOL_TARGET_FORTY_THREE_OK");
  check("smoke_phase3710Marker", smoke.phase3710Marker === "PHASE3710_FIFTY_TWO_TOOL_TARGET_FORTY_FOUR_OK");
  check("smoke_phase3711Marker", smoke.phase3711Marker === "PHASE3711_FIFTY_TWO_TOOL_TARGET_FORTY_FIVE_OK");
  check("smoke_phase3712Marker", smoke.phase3712Marker === "PHASE3712_FIFTY_TWO_TOOL_TARGET_FORTY_SIX_OK");
  check("smoke_phase3713Marker", smoke.phase3713Marker === "PHASE3713_FIFTY_TWO_TOOL_TARGET_FORTY_SEVEN_OK");
  check("smoke_phase3714Marker", smoke.phase3714Marker === "PHASE3714_FIFTY_TWO_TOOL_TARGET_FORTY_EIGHT_OK");
  check("smoke_phase3715Marker", smoke.phase3715Marker === "PHASE3715_FIFTY_TWO_TOOL_TARGET_FORTY_NINE_OK");
  check("smoke_phase3716Marker", smoke.phase3716Marker === "PHASE3716_FIFTY_TWO_TOOL_TARGET_FIFTY_OK");
  check("smoke_phase3717Marker", smoke.phase3717Marker === "PHASE3717_FIFTY_TWO_TOOL_TARGET_FIFTY_ONE_OK");
  check("smoke_phase3718Marker", smoke.phase3718Marker === "PHASE3718_FIFTY_TWO_TOOL_TARGET_FIFTY_TWO_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase3667FiftyTwoMutationTargetOneStatus") || targetOne.includes("export function buildPhase3667FiftyTwoMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE3667_FIFTY_TWO_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase3668FiftyTwoMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase3668FiftyTwoMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE3668_FIFTY_TWO_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase3669FiftyTwoMutationTargetThreeStatus") || targetThree.includes("export function buildPhase3669FiftyTwoMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE3669_FIFTY_TWO_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase3670FiftyTwoMutationTargetFourStatus") || targetFour.includes("export function buildPhase3670FiftyTwoMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE3670_FIFTY_TWO_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase3671FiftyTwoMutationTargetFiveStatus") || targetFive.includes("export function buildPhase3671FiftyTwoMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE3671_FIFTY_TWO_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase3672FiftyTwoMutationTargetSixStatus") || targetSix.includes("export function buildPhase3672FiftyTwoMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE3672_FIFTY_TWO_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase3673FiftyTwoMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase3673FiftyTwoMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE3673_FIFTY_TWO_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase3674FiftyTwoMutationTargetEightStatus") || targetEight.includes("export function buildPhase3674FiftyTwoMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE3674_FIFTY_TWO_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase3675FiftyTwoMutationTargetNineStatus") || targetNine.includes("export function buildPhase3675FiftyTwoMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE3675_FIFTY_TWO_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase3676FiftyTwoMutationTargetTenStatus") || targetTen.includes("export function buildPhase3676FiftyTwoMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE3676_FIFTY_TWO_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase3677FiftyTwoMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase3677FiftyTwoMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE3677_FIFTY_TWO_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase3678FiftyTwoMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase3678FiftyTwoMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE3678_FIFTY_TWO_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase3679FiftyTwoMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase3679FiftyTwoMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE3679_FIFTY_TWO_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase3680FiftyTwoMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase3680FiftyTwoMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE3680_FIFTY_TWO_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase3681FiftyTwoMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase3681FiftyTwoMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE3681_FIFTY_TWO_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase3682FiftyTwoMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase3682FiftyTwoMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE3682_FIFTY_TWO_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase3683FiftyTwoMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase3683FiftyTwoMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE3683_FIFTY_TWO_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase3684FiftyTwoMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase3684FiftyTwoMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE3684_FIFTY_TWO_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase3685FiftyTwoMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase3685FiftyTwoMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE3685_FIFTY_TWO_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase3686FiftyTwoMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase3686FiftyTwoMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE3686_FIFTY_TWO_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase3687FiftyTwoMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase3687FiftyTwoMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE3687_FIFTY_TWO_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase3688FiftyTwoMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase3688FiftyTwoMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE3688_FIFTY_TWO_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase3689FiftyTwoMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase3689FiftyTwoMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE3689_FIFTY_TWO_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase3690FiftyTwoMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase3690FiftyTwoMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE3690_FIFTY_TWO_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase3691FiftyTwoMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase3691FiftyTwoMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE3691_FIFTY_TWO_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase3692FiftyTwoMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase3692FiftyTwoMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE3692_FIFTY_TWO_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase3693FiftyTwoMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase3693FiftyTwoMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE3693_FIFTY_TWO_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase3694FiftyTwoMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase3694FiftyTwoMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE3694_FIFTY_TWO_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase3695FiftyTwoMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase3695FiftyTwoMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE3695_FIFTY_TWO_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase3696FiftyTwoMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase3696FiftyTwoMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE3696_FIFTY_TWO_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase3697FiftyTwoMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase3697FiftyTwoMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE3697_FIFTY_TWO_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase3698FiftyTwoMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase3698FiftyTwoMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE3698_FIFTY_TWO_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase3699FiftyTwoMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase3699FiftyTwoMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE3699_FIFTY_TWO_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase3700FiftyTwoMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase3700FiftyTwoMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE3700_FIFTY_TWO_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase3701FiftyTwoMutationTargetThirtyFiveStatus") || targetThirtyFive.includes("export function buildPhase3701FiftyTwoMutationTargetThirtyFiveStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE3701_FIFTY_TWO_TOOL_TARGET_THIRTY_FIVE_OK"));
check("target-thirty-six_export", targetThirtySix.includes("buildPhase3702FiftyTwoMutationTargetThirtySixStatus") || targetThirtySix.includes("export function buildPhase3702FiftyTwoMutationTargetThirtySixStatus"));
check("target-thirty-six_marker", targetThirtySix.includes("PHASE3702_FIFTY_TWO_TOOL_TARGET_THIRTY_SIX_OK"));
check("target-thirty-seven_export", targetThirtySeven.includes("buildPhase3703FiftyTwoMutationTargetThirtySevenStatus") || targetThirtySeven.includes("export function buildPhase3703FiftyTwoMutationTargetThirtySevenStatus"));
check("target-thirty-seven_marker", targetThirtySeven.includes("PHASE3703_FIFTY_TWO_TOOL_TARGET_THIRTY_SEVEN_OK"));
check("target-thirty-eight_export", targetThirtyEight.includes("buildPhase3704FiftyTwoMutationTargetThirtyEightStatus") || targetThirtyEight.includes("export function buildPhase3704FiftyTwoMutationTargetThirtyEightStatus"));
check("target-thirty-eight_marker", targetThirtyEight.includes("PHASE3704_FIFTY_TWO_TOOL_TARGET_THIRTY_EIGHT_OK"));
check("target-thirty-nine_export", targetThirtyNine.includes("buildPhase3705FiftyTwoMutationTargetThirtyNineStatus") || targetThirtyNine.includes("export function buildPhase3705FiftyTwoMutationTargetThirtyNineStatus"));
check("target-thirty-nine_marker", targetThirtyNine.includes("PHASE3705_FIFTY_TWO_TOOL_TARGET_THIRTY_NINE_OK"));
check("target-forty_export", targetForty.includes("buildPhase3706FiftyTwoMutationTargetFortyStatus") || targetForty.includes("export function buildPhase3706FiftyTwoMutationTargetFortyStatus"));
check("target-forty_marker", targetForty.includes("PHASE3706_FIFTY_TWO_TOOL_TARGET_FORTY_OK"));
check("target-forty-one_export", targetFortyOne.includes("buildPhase3707FiftyTwoMutationTargetFortyOneStatus") || targetFortyOne.includes("export function buildPhase3707FiftyTwoMutationTargetFortyOneStatus"));
check("target-forty-one_marker", targetFortyOne.includes("PHASE3707_FIFTY_TWO_TOOL_TARGET_FORTY_ONE_OK"));
check("target-forty-two_export", targetFortyTwo.includes("buildPhase3708FiftyTwoMutationTargetFortyTwoStatus") || targetFortyTwo.includes("export function buildPhase3708FiftyTwoMutationTargetFortyTwoStatus"));
check("target-forty-two_marker", targetFortyTwo.includes("PHASE3708_FIFTY_TWO_TOOL_TARGET_FORTY_TWO_OK"));
check("target-forty-three_export", targetFortyThree.includes("buildPhase3709FiftyTwoMutationTargetFortyThreeStatus") || targetFortyThree.includes("export function buildPhase3709FiftyTwoMutationTargetFortyThreeStatus"));
check("target-forty-three_marker", targetFortyThree.includes("PHASE3709_FIFTY_TWO_TOOL_TARGET_FORTY_THREE_OK"));
check("target-forty-four_export", targetFortyFour.includes("buildPhase3710FiftyTwoMutationTargetFortyFourStatus") || targetFortyFour.includes("export function buildPhase3710FiftyTwoMutationTargetFortyFourStatus"));
check("target-forty-four_marker", targetFortyFour.includes("PHASE3710_FIFTY_TWO_TOOL_TARGET_FORTY_FOUR_OK"));
check("target-forty-five_export", targetFortyFive.includes("buildPhase3711FiftyTwoMutationTargetFortyFiveStatus") || targetFortyFive.includes("export function buildPhase3711FiftyTwoMutationTargetFortyFiveStatus"));
check("target-forty-five_marker", targetFortyFive.includes("PHASE3711_FIFTY_TWO_TOOL_TARGET_FORTY_FIVE_OK"));
check("target-forty-six_export", targetFortySix.includes("buildPhase3712FiftyTwoMutationTargetFortySixStatus") || targetFortySix.includes("export function buildPhase3712FiftyTwoMutationTargetFortySixStatus"));
check("target-forty-six_marker", targetFortySix.includes("PHASE3712_FIFTY_TWO_TOOL_TARGET_FORTY_SIX_OK"));
check("target-forty-seven_export", targetFortySeven.includes("buildPhase3713FiftyTwoMutationTargetFortySevenStatus") || targetFortySeven.includes("export function buildPhase3713FiftyTwoMutationTargetFortySevenStatus"));
check("target-forty-seven_marker", targetFortySeven.includes("PHASE3713_FIFTY_TWO_TOOL_TARGET_FORTY_SEVEN_OK"));
check("target-forty-eight_export", targetFortyEight.includes("buildPhase3714FiftyTwoMutationTargetFortyEightStatus") || targetFortyEight.includes("export function buildPhase3714FiftyTwoMutationTargetFortyEightStatus"));
check("target-forty-eight_marker", targetFortyEight.includes("PHASE3714_FIFTY_TWO_TOOL_TARGET_FORTY_EIGHT_OK"));
check("target-forty-nine_export", targetFortyNine.includes("buildPhase3715FiftyTwoMutationTargetFortyNineStatus") || targetFortyNine.includes("export function buildPhase3715FiftyTwoMutationTargetFortyNineStatus"));
check("target-forty-nine_marker", targetFortyNine.includes("PHASE3715_FIFTY_TWO_TOOL_TARGET_FORTY_NINE_OK"));
check("target-fifty_export", targetFifty.includes("buildPhase3716FiftyTwoMutationTargetFiftyStatus") || targetFifty.includes("export function buildPhase3716FiftyTwoMutationTargetFiftyStatus"));
check("target-fifty_marker", targetFifty.includes("PHASE3716_FIFTY_TWO_TOOL_TARGET_FIFTY_OK"));
check("target-fifty-one_export", targetFiftyOne.includes("buildPhase3717FiftyTwoMutationTargetFiftyOneStatus") || targetFiftyOne.includes("export function buildPhase3717FiftyTwoMutationTargetFiftyOneStatus"));
check("target-fifty-one_marker", targetFiftyOne.includes("PHASE3717_FIFTY_TWO_TOOL_TARGET_FIFTY_ONE_OK"));
check("target-fifty-two_export", targetFiftyTwo.includes("buildPhase3718FiftyTwoMutationRuntimeStatus") || targetFiftyTwo.includes("export function buildPhase3718FiftyTwoMutationRuntimeStatus"));
check("target-fifty-two_marker", targetFiftyTwo.includes("PHASE3718_FIFTY_TWO_TOOL_TARGET_FIFTY_TWO_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_fifty_two", docs.includes("controlled fifty-two tool mutation"));
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
  phase3661Sealed: phase3661.recommendedSealed === true,
  fiftyTwoMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 52,
  fiftyTwoMutationApplied: result?.fiftyTwoMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localFiftyTwoSmokePassed: result?.localFiftyTwoSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, fiftyTwoMutationApplied: verifierResult.fiftyTwoMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localFiftyTwoSmokePassed: verifierResult.localFiftyTwoSmokePassed }, null, 2));
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
    "# Phase3662A-3718A Controlled Fifty-Two Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- fiftyTwoMutationApplied: ${Boolean(result.fiftyTwoMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localFiftyTwoSmokePassed: ${Boolean(result.localFiftyTwoSmokePassed)}`,
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
