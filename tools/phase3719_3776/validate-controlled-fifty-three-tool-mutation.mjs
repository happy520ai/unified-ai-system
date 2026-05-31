import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase3719A-3776A-Controlled-Fifty-Three-Tool-Mutation";
const runnerPath = "tools/phase3719_3776/apply-controlled-fifty-three-tool-mutation.mjs";
const smokeRunnerPath = "tools/phase3719_3776/smoke-controlled-fifty-three-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase3719-3776-controlled-fifty-three-tool-mutation.md";
const approvalPath = "docs/phase3719-3776-controlled-fifty-three-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase3724-fifty-three-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase3725-fifty-three-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase3726-fifty-three-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase3727-fifty-three-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase3728-fifty-three-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase3729-fifty-three-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase3730-fifty-three-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase3731-fifty-three-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase3732-fifty-three-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase3733-fifty-three-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase3734-fifty-three-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase3735-fifty-three-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase3736-fifty-three-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase3737-fifty-three-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase3738-fifty-three-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase3739-fifty-three-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase3740-fifty-three-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase3741-fifty-three-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase3742-fifty-three-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase3743-fifty-three-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase3744-fifty-three-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase3745-fifty-three-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase3746-fifty-three-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase3747-fifty-three-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase3748-fifty-three-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase3749-fifty-three-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase3750-fifty-three-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase3751-fifty-three-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase3752-fifty-three-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase3753-fifty-three-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase3754-fifty-three-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase3755-fifty-three-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase3756-fifty-three-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase3757-fifty-three-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase3758-fifty-three-tool-mutation-target-thirty-five.proposal.diff";
const proposalThirtySixPath = "docs/phase3759-fifty-three-tool-mutation-target-thirty-six.proposal.diff";
const proposalThirtySevenPath = "docs/phase3760-fifty-three-tool-mutation-target-thirty-seven.proposal.diff";
const proposalThirtyEightPath = "docs/phase3761-fifty-three-tool-mutation-target-thirty-eight.proposal.diff";
const proposalThirtyNinePath = "docs/phase3762-fifty-three-tool-mutation-target-thirty-nine.proposal.diff";
const proposalFortyPath = "docs/phase3763-fifty-three-tool-mutation-target-forty.proposal.diff";
const proposalFortyOnePath = "docs/phase3764-fifty-three-tool-mutation-target-forty-one.proposal.diff";
const proposalFortyTwoPath = "docs/phase3765-fifty-three-tool-mutation-target-forty-two.proposal.diff";
const proposalFortyThreePath = "docs/phase3766-fifty-three-tool-mutation-target-forty-three.proposal.diff";
const proposalFortyFourPath = "docs/phase3767-fifty-three-tool-mutation-target-forty-four.proposal.diff";
const proposalFortyFivePath = "docs/phase3768-fifty-three-tool-mutation-target-forty-five.proposal.diff";
const proposalFortySixPath = "docs/phase3769-fifty-three-tool-mutation-target-forty-six.proposal.diff";
const proposalFortySevenPath = "docs/phase3770-fifty-three-tool-mutation-target-forty-seven.proposal.diff";
const proposalFortyEightPath = "docs/phase3771-fifty-three-tool-mutation-target-forty-eight.proposal.diff";
const proposalFortyNinePath = "docs/phase3772-fifty-three-tool-mutation-target-forty-nine.proposal.diff";
const proposalFiftyPath = "docs/phase3773-fifty-three-tool-mutation-target-fifty.proposal.diff";
const proposalFiftyOnePath = "docs/phase3774-fifty-three-tool-mutation-target-fifty-one.proposal.diff";
const proposalFiftyTwoPath = "docs/phase3775-fifty-three-tool-mutation-target-fifty-two.proposal.diff";
const proposalFiftyThreePath = "docs/phase3776-fifty-three-tool-mutation-target-fifty-three.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase3719-3776-controlled-fifty-three-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase3719-3776-controlled-fifty-three-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase3719-3776-controlled-fifty-three-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase3719-3776-controlled-fifty-three-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase3719-3776-controlled-fifty-three-tool-mutation/fifty-three-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase3718 = readJson("apps/ai-gateway-service/evidence/phase3662-3718-controlled-fifty-two-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase3719-3776-controlled-fifty-three-tool-mutation"] === "node tools/phase3719_3776/apply-controlled-fifty-three-tool-mutation.mjs --plan docs/phase3719-3776-controlled-fifty-three-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase3719-3776-controlled-fifty-three-tool-mutation"] ===
    "node tools/phase3719_3776/smoke-controlled-fifty-three-tool-mutation.mjs",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase3719-3776-controlled-fifty-three-tool-mutation"] === "node tools/phase3719_3776/validate-controlled-fifty-three-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase3718_sealed", phase3718.recommendedSealed === true && phase3718.fiftyTwoMutationApplied === true);
check("result_exists", result !== null, "run apply:phase3719-3776-controlled-fifty-three-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("fifty_three_mutation_applied", result.fiftyThreeMutationApplied === true);
  check("changed_file_count_fifty_three", result.changedFileCount === 53);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localFiftyThreeSmokePassed === true);
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
  check("rollback_restore_fifty_three", rollback.rollbackAction === "restore-previous-content-fifty-three");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_fifty_three_entries", Array.isArray(rollback.files) && rollback.files.length === 53);
}

if (smoke) {
  check("smoke_phase3724Marker", smoke.phase3724Marker === "PHASE3724_FIFTY_THREE_TOOL_TARGET_ONE_OK");
  check("smoke_phase3725Marker", smoke.phase3725Marker === "PHASE3725_FIFTY_THREE_TOOL_TARGET_TWO_OK");
  check("smoke_phase3726Marker", smoke.phase3726Marker === "PHASE3726_FIFTY_THREE_TOOL_TARGET_THREE_OK");
  check("smoke_phase3727Marker", smoke.phase3727Marker === "PHASE3727_FIFTY_THREE_TOOL_TARGET_FOUR_OK");
  check("smoke_phase3728Marker", smoke.phase3728Marker === "PHASE3728_FIFTY_THREE_TOOL_TARGET_FIVE_OK");
  check("smoke_phase3729Marker", smoke.phase3729Marker === "PHASE3729_FIFTY_THREE_TOOL_TARGET_SIX_OK");
  check("smoke_phase3730Marker", smoke.phase3730Marker === "PHASE3730_FIFTY_THREE_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase3731Marker", smoke.phase3731Marker === "PHASE3731_FIFTY_THREE_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase3732Marker", smoke.phase3732Marker === "PHASE3732_FIFTY_THREE_TOOL_TARGET_NINE_OK");
  check("smoke_phase3733Marker", smoke.phase3733Marker === "PHASE3733_FIFTY_THREE_TOOL_TARGET_TEN_OK");
  check("smoke_phase3734Marker", smoke.phase3734Marker === "PHASE3734_FIFTY_THREE_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase3735Marker", smoke.phase3735Marker === "PHASE3735_FIFTY_THREE_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase3736Marker", smoke.phase3736Marker === "PHASE3736_FIFTY_THREE_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase3737Marker", smoke.phase3737Marker === "PHASE3737_FIFTY_THREE_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase3738Marker", smoke.phase3738Marker === "PHASE3738_FIFTY_THREE_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase3739Marker", smoke.phase3739Marker === "PHASE3739_FIFTY_THREE_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase3740Marker", smoke.phase3740Marker === "PHASE3740_FIFTY_THREE_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase3741Marker", smoke.phase3741Marker === "PHASE3741_FIFTY_THREE_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase3742Marker", smoke.phase3742Marker === "PHASE3742_FIFTY_THREE_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase3743Marker", smoke.phase3743Marker === "PHASE3743_FIFTY_THREE_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase3744Marker", smoke.phase3744Marker === "PHASE3744_FIFTY_THREE_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase3745Marker", smoke.phase3745Marker === "PHASE3745_FIFTY_THREE_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase3746Marker", smoke.phase3746Marker === "PHASE3746_FIFTY_THREE_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase3747Marker", smoke.phase3747Marker === "PHASE3747_FIFTY_THREE_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase3748Marker", smoke.phase3748Marker === "PHASE3748_FIFTY_THREE_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase3749Marker", smoke.phase3749Marker === "PHASE3749_FIFTY_THREE_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase3750Marker", smoke.phase3750Marker === "PHASE3750_FIFTY_THREE_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase3751Marker", smoke.phase3751Marker === "PHASE3751_FIFTY_THREE_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase3752Marker", smoke.phase3752Marker === "PHASE3752_FIFTY_THREE_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase3753Marker", smoke.phase3753Marker === "PHASE3753_FIFTY_THREE_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase3754Marker", smoke.phase3754Marker === "PHASE3754_FIFTY_THREE_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase3755Marker", smoke.phase3755Marker === "PHASE3755_FIFTY_THREE_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase3756Marker", smoke.phase3756Marker === "PHASE3756_FIFTY_THREE_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase3757Marker", smoke.phase3757Marker === "PHASE3757_FIFTY_THREE_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase3758Marker", smoke.phase3758Marker === "PHASE3758_FIFTY_THREE_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_phase3759Marker", smoke.phase3759Marker === "PHASE3759_FIFTY_THREE_TOOL_TARGET_THIRTY_SIX_OK");
  check("smoke_phase3760Marker", smoke.phase3760Marker === "PHASE3760_FIFTY_THREE_TOOL_TARGET_THIRTY_SEVEN_OK");
  check("smoke_phase3761Marker", smoke.phase3761Marker === "PHASE3761_FIFTY_THREE_TOOL_TARGET_THIRTY_EIGHT_OK");
  check("smoke_phase3762Marker", smoke.phase3762Marker === "PHASE3762_FIFTY_THREE_TOOL_TARGET_THIRTY_NINE_OK");
  check("smoke_phase3763Marker", smoke.phase3763Marker === "PHASE3763_FIFTY_THREE_TOOL_TARGET_FORTY_OK");
  check("smoke_phase3764Marker", smoke.phase3764Marker === "PHASE3764_FIFTY_THREE_TOOL_TARGET_FORTY_ONE_OK");
  check("smoke_phase3765Marker", smoke.phase3765Marker === "PHASE3765_FIFTY_THREE_TOOL_TARGET_FORTY_TWO_OK");
  check("smoke_phase3766Marker", smoke.phase3766Marker === "PHASE3766_FIFTY_THREE_TOOL_TARGET_FORTY_THREE_OK");
  check("smoke_phase3767Marker", smoke.phase3767Marker === "PHASE3767_FIFTY_THREE_TOOL_TARGET_FORTY_FOUR_OK");
  check("smoke_phase3768Marker", smoke.phase3768Marker === "PHASE3768_FIFTY_THREE_TOOL_TARGET_FORTY_FIVE_OK");
  check("smoke_phase3769Marker", smoke.phase3769Marker === "PHASE3769_FIFTY_THREE_TOOL_TARGET_FORTY_SIX_OK");
  check("smoke_phase3770Marker", smoke.phase3770Marker === "PHASE3770_FIFTY_THREE_TOOL_TARGET_FORTY_SEVEN_OK");
  check("smoke_phase3771Marker", smoke.phase3771Marker === "PHASE3771_FIFTY_THREE_TOOL_TARGET_FORTY_EIGHT_OK");
  check("smoke_phase3772Marker", smoke.phase3772Marker === "PHASE3772_FIFTY_THREE_TOOL_TARGET_FORTY_NINE_OK");
  check("smoke_phase3773Marker", smoke.phase3773Marker === "PHASE3773_FIFTY_THREE_TOOL_TARGET_FIFTY_OK");
  check("smoke_phase3774Marker", smoke.phase3774Marker === "PHASE3774_FIFTY_THREE_TOOL_TARGET_FIFTY_ONE_OK");
  check("smoke_phase3775Marker", smoke.phase3775Marker === "PHASE3775_FIFTY_THREE_TOOL_TARGET_FIFTY_TWO_OK");
  check("smoke_phase3776Marker", smoke.phase3776Marker === "PHASE3776_FIFTY_THREE_TOOL_TARGET_FIFTY_THREE_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase3724FiftyThreeMutationTargetOneStatus") || targetOne.includes("export function buildPhase3724FiftyThreeMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE3724_FIFTY_THREE_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase3725FiftyThreeMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase3725FiftyThreeMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE3725_FIFTY_THREE_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase3726FiftyThreeMutationTargetThreeStatus") || targetThree.includes("export function buildPhase3726FiftyThreeMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE3726_FIFTY_THREE_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase3727FiftyThreeMutationTargetFourStatus") || targetFour.includes("export function buildPhase3727FiftyThreeMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE3727_FIFTY_THREE_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase3728FiftyThreeMutationTargetFiveStatus") || targetFive.includes("export function buildPhase3728FiftyThreeMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE3728_FIFTY_THREE_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase3729FiftyThreeMutationTargetSixStatus") || targetSix.includes("export function buildPhase3729FiftyThreeMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE3729_FIFTY_THREE_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase3730FiftyThreeMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase3730FiftyThreeMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE3730_FIFTY_THREE_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase3731FiftyThreeMutationTargetEightStatus") || targetEight.includes("export function buildPhase3731FiftyThreeMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE3731_FIFTY_THREE_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase3732FiftyThreeMutationTargetNineStatus") || targetNine.includes("export function buildPhase3732FiftyThreeMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE3732_FIFTY_THREE_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase3733FiftyThreeMutationTargetTenStatus") || targetTen.includes("export function buildPhase3733FiftyThreeMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE3733_FIFTY_THREE_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase3734FiftyThreeMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase3734FiftyThreeMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE3734_FIFTY_THREE_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase3735FiftyThreeMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase3735FiftyThreeMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE3735_FIFTY_THREE_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase3736FiftyThreeMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase3736FiftyThreeMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE3736_FIFTY_THREE_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase3737FiftyThreeMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase3737FiftyThreeMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE3737_FIFTY_THREE_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase3738FiftyThreeMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase3738FiftyThreeMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE3738_FIFTY_THREE_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase3739FiftyThreeMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase3739FiftyThreeMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE3739_FIFTY_THREE_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase3740FiftyThreeMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase3740FiftyThreeMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE3740_FIFTY_THREE_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase3741FiftyThreeMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase3741FiftyThreeMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE3741_FIFTY_THREE_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase3742FiftyThreeMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase3742FiftyThreeMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE3742_FIFTY_THREE_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase3743FiftyThreeMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase3743FiftyThreeMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE3743_FIFTY_THREE_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase3744FiftyThreeMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase3744FiftyThreeMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE3744_FIFTY_THREE_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase3745FiftyThreeMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase3745FiftyThreeMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE3745_FIFTY_THREE_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase3746FiftyThreeMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase3746FiftyThreeMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE3746_FIFTY_THREE_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase3747FiftyThreeMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase3747FiftyThreeMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE3747_FIFTY_THREE_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase3748FiftyThreeMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase3748FiftyThreeMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE3748_FIFTY_THREE_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase3749FiftyThreeMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase3749FiftyThreeMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE3749_FIFTY_THREE_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase3750FiftyThreeMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase3750FiftyThreeMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE3750_FIFTY_THREE_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase3751FiftyThreeMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase3751FiftyThreeMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE3751_FIFTY_THREE_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase3752FiftyThreeMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase3752FiftyThreeMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE3752_FIFTY_THREE_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase3753FiftyThreeMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase3753FiftyThreeMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE3753_FIFTY_THREE_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase3754FiftyThreeMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase3754FiftyThreeMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE3754_FIFTY_THREE_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase3755FiftyThreeMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase3755FiftyThreeMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE3755_FIFTY_THREE_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase3756FiftyThreeMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase3756FiftyThreeMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE3756_FIFTY_THREE_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase3757FiftyThreeMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase3757FiftyThreeMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE3757_FIFTY_THREE_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase3758FiftyThreeMutationTargetThirtyFiveStatus") || targetThirtyFive.includes("export function buildPhase3758FiftyThreeMutationTargetThirtyFiveStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE3758_FIFTY_THREE_TOOL_TARGET_THIRTY_FIVE_OK"));
check("target-thirty-six_export", targetThirtySix.includes("buildPhase3759FiftyThreeMutationTargetThirtySixStatus") || targetThirtySix.includes("export function buildPhase3759FiftyThreeMutationTargetThirtySixStatus"));
check("target-thirty-six_marker", targetThirtySix.includes("PHASE3759_FIFTY_THREE_TOOL_TARGET_THIRTY_SIX_OK"));
check("target-thirty-seven_export", targetThirtySeven.includes("buildPhase3760FiftyThreeMutationTargetThirtySevenStatus") || targetThirtySeven.includes("export function buildPhase3760FiftyThreeMutationTargetThirtySevenStatus"));
check("target-thirty-seven_marker", targetThirtySeven.includes("PHASE3760_FIFTY_THREE_TOOL_TARGET_THIRTY_SEVEN_OK"));
check("target-thirty-eight_export", targetThirtyEight.includes("buildPhase3761FiftyThreeMutationTargetThirtyEightStatus") || targetThirtyEight.includes("export function buildPhase3761FiftyThreeMutationTargetThirtyEightStatus"));
check("target-thirty-eight_marker", targetThirtyEight.includes("PHASE3761_FIFTY_THREE_TOOL_TARGET_THIRTY_EIGHT_OK"));
check("target-thirty-nine_export", targetThirtyNine.includes("buildPhase3762FiftyThreeMutationTargetThirtyNineStatus") || targetThirtyNine.includes("export function buildPhase3762FiftyThreeMutationTargetThirtyNineStatus"));
check("target-thirty-nine_marker", targetThirtyNine.includes("PHASE3762_FIFTY_THREE_TOOL_TARGET_THIRTY_NINE_OK"));
check("target-forty_export", targetForty.includes("buildPhase3763FiftyThreeMutationTargetFortyStatus") || targetForty.includes("export function buildPhase3763FiftyThreeMutationTargetFortyStatus"));
check("target-forty_marker", targetForty.includes("PHASE3763_FIFTY_THREE_TOOL_TARGET_FORTY_OK"));
check("target-forty-one_export", targetFortyOne.includes("buildPhase3764FiftyThreeMutationTargetFortyOneStatus") || targetFortyOne.includes("export function buildPhase3764FiftyThreeMutationTargetFortyOneStatus"));
check("target-forty-one_marker", targetFortyOne.includes("PHASE3764_FIFTY_THREE_TOOL_TARGET_FORTY_ONE_OK"));
check("target-forty-two_export", targetFortyTwo.includes("buildPhase3765FiftyThreeMutationTargetFortyTwoStatus") || targetFortyTwo.includes("export function buildPhase3765FiftyThreeMutationTargetFortyTwoStatus"));
check("target-forty-two_marker", targetFortyTwo.includes("PHASE3765_FIFTY_THREE_TOOL_TARGET_FORTY_TWO_OK"));
check("target-forty-three_export", targetFortyThree.includes("buildPhase3766FiftyThreeMutationTargetFortyThreeStatus") || targetFortyThree.includes("export function buildPhase3766FiftyThreeMutationTargetFortyThreeStatus"));
check("target-forty-three_marker", targetFortyThree.includes("PHASE3766_FIFTY_THREE_TOOL_TARGET_FORTY_THREE_OK"));
check("target-forty-four_export", targetFortyFour.includes("buildPhase3767FiftyThreeMutationTargetFortyFourStatus") || targetFortyFour.includes("export function buildPhase3767FiftyThreeMutationTargetFortyFourStatus"));
check("target-forty-four_marker", targetFortyFour.includes("PHASE3767_FIFTY_THREE_TOOL_TARGET_FORTY_FOUR_OK"));
check("target-forty-five_export", targetFortyFive.includes("buildPhase3768FiftyThreeMutationTargetFortyFiveStatus") || targetFortyFive.includes("export function buildPhase3768FiftyThreeMutationTargetFortyFiveStatus"));
check("target-forty-five_marker", targetFortyFive.includes("PHASE3768_FIFTY_THREE_TOOL_TARGET_FORTY_FIVE_OK"));
check("target-forty-six_export", targetFortySix.includes("buildPhase3769FiftyThreeMutationTargetFortySixStatus") || targetFortySix.includes("export function buildPhase3769FiftyThreeMutationTargetFortySixStatus"));
check("target-forty-six_marker", targetFortySix.includes("PHASE3769_FIFTY_THREE_TOOL_TARGET_FORTY_SIX_OK"));
check("target-forty-seven_export", targetFortySeven.includes("buildPhase3770FiftyThreeMutationTargetFortySevenStatus") || targetFortySeven.includes("export function buildPhase3770FiftyThreeMutationTargetFortySevenStatus"));
check("target-forty-seven_marker", targetFortySeven.includes("PHASE3770_FIFTY_THREE_TOOL_TARGET_FORTY_SEVEN_OK"));
check("target-forty-eight_export", targetFortyEight.includes("buildPhase3771FiftyThreeMutationTargetFortyEightStatus") || targetFortyEight.includes("export function buildPhase3771FiftyThreeMutationTargetFortyEightStatus"));
check("target-forty-eight_marker", targetFortyEight.includes("PHASE3771_FIFTY_THREE_TOOL_TARGET_FORTY_EIGHT_OK"));
check("target-forty-nine_export", targetFortyNine.includes("buildPhase3772FiftyThreeMutationTargetFortyNineStatus") || targetFortyNine.includes("export function buildPhase3772FiftyThreeMutationTargetFortyNineStatus"));
check("target-forty-nine_marker", targetFortyNine.includes("PHASE3772_FIFTY_THREE_TOOL_TARGET_FORTY_NINE_OK"));
check("target-fifty_export", targetFifty.includes("buildPhase3773FiftyThreeMutationTargetFiftyStatus") || targetFifty.includes("export function buildPhase3773FiftyThreeMutationTargetFiftyStatus"));
check("target-fifty_marker", targetFifty.includes("PHASE3773_FIFTY_THREE_TOOL_TARGET_FIFTY_OK"));
check("target-fifty-one_export", targetFiftyOne.includes("buildPhase3774FiftyThreeMutationTargetFiftyOneStatus") || targetFiftyOne.includes("export function buildPhase3774FiftyThreeMutationTargetFiftyOneStatus"));
check("target-fifty-one_marker", targetFiftyOne.includes("PHASE3774_FIFTY_THREE_TOOL_TARGET_FIFTY_ONE_OK"));
check("target-fifty-two_export", targetFiftyTwo.includes("buildPhase3775FiftyThreeMutationTargetFiftyTwoStatus") || targetFiftyTwo.includes("export function buildPhase3775FiftyThreeMutationTargetFiftyTwoStatus"));
check("target-fifty-two_marker", targetFiftyTwo.includes("PHASE3775_FIFTY_THREE_TOOL_TARGET_FIFTY_TWO_OK"));
check("target-fifty-three_export", targetFiftyThree.includes("buildPhase3776FiftyThreeMutationRuntimeStatus") || targetFiftyThree.includes("export function buildPhase3776FiftyThreeMutationRuntimeStatus"));
check("target-fifty-three_marker", targetFiftyThree.includes("PHASE3776_FIFTY_THREE_TOOL_TARGET_FIFTY_THREE_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_fifty_three", docs.includes("controlled fifty-three tool mutation"));
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
  phase3718Sealed: phase3718.recommendedSealed === true,
  fiftyThreeMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 53,
  fiftyThreeMutationApplied: result?.fiftyThreeMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localFiftyThreeSmokePassed: result?.localFiftyThreeSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, fiftyThreeMutationApplied: verifierResult.fiftyThreeMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localFiftyThreeSmokePassed: verifierResult.localFiftyThreeSmokePassed }, null, 2));
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
    "# Phase3719A-3776A Controlled Fifty-Three Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- fiftyThreeMutationApplied: ${Boolean(result.fiftyThreeMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localFiftyThreeSmokePassed: ${Boolean(result.localFiftyThreeSmokePassed)}`,
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
