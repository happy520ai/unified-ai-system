import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase3551A-3605A-Controlled-Fifty-Tool-Mutation";
const runnerPath = "tools/phase3551_3605/apply-controlled-fifty-tool-mutation.mjs";
const smokeRunnerPath = "tools/phase3551_3605/smoke-controlled-fifty-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase3551-3605-controlled-fifty-tool-mutation.md";
const approvalPath = "docs/phase3551-3605-controlled-fifty-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase3556-fifty-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase3557-fifty-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase3558-fifty-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase3559-fifty-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase3560-fifty-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase3561-fifty-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase3562-fifty-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase3563-fifty-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase3564-fifty-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase3565-fifty-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase3566-fifty-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase3567-fifty-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase3568-fifty-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase3569-fifty-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase3570-fifty-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase3571-fifty-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase3572-fifty-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase3573-fifty-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase3574-fifty-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase3575-fifty-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase3576-fifty-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase3577-fifty-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase3578-fifty-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase3579-fifty-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase3580-fifty-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase3581-fifty-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase3582-fifty-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase3583-fifty-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase3584-fifty-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase3585-fifty-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase3586-fifty-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase3587-fifty-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase3588-fifty-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase3589-fifty-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase3590-fifty-tool-mutation-target-thirty-five.proposal.diff";
const proposalThirtySixPath = "docs/phase3591-fifty-tool-mutation-target-thirty-six.proposal.diff";
const proposalThirtySevenPath = "docs/phase3592-fifty-tool-mutation-target-thirty-seven.proposal.diff";
const proposalThirtyEightPath = "docs/phase3593-fifty-tool-mutation-target-thirty-eight.proposal.diff";
const proposalThirtyNinePath = "docs/phase3594-fifty-tool-mutation-target-thirty-nine.proposal.diff";
const proposalFortyPath = "docs/phase3595-fifty-tool-mutation-target-forty.proposal.diff";
const proposalFortyOnePath = "docs/phase3596-fifty-tool-mutation-target-forty-one.proposal.diff";
const proposalFortyTwoPath = "docs/phase3597-fifty-tool-mutation-target-forty-two.proposal.diff";
const proposalFortyThreePath = "docs/phase3598-fifty-tool-mutation-target-forty-three.proposal.diff";
const proposalFortyFourPath = "docs/phase3599-fifty-tool-mutation-target-forty-four.proposal.diff";
const proposalFortyFivePath = "docs/phase3600-fifty-tool-mutation-target-forty-five.proposal.diff";
const proposalFortySixPath = "docs/phase3601-fifty-tool-mutation-target-forty-six.proposal.diff";
const proposalFortySevenPath = "docs/phase3602-fifty-tool-mutation-target-forty-seven.proposal.diff";
const proposalFortyEightPath = "docs/phase3603-fifty-tool-mutation-target-forty-eight.proposal.diff";
const proposalFortyNinePath = "docs/phase3604-fifty-tool-mutation-target-forty-nine.proposal.diff";
const proposalFiftyPath = "docs/phase3605-fifty-tool-mutation-target-fifty.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase3551-3605-controlled-fifty-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase3551-3605-controlled-fifty-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase3551-3605-controlled-fifty-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase3551-3605-controlled-fifty-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase3551-3605-controlled-fifty-tool-mutation/fifty-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase3550 = readJson("apps/ai-gateway-service/evidence/phase3497-3550-controlled-forty-nine-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase3551-3605-controlled-fifty-tool-mutation"] === "node tools/phase3551_3605/apply-controlled-fifty-tool-mutation.mjs --plan docs/phase3551-3605-controlled-fifty-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase3551-3605-controlled-fifty-tool-mutation"] ===
    "node tools/phase3551_3605/smoke-controlled-fifty-tool-mutation.mjs",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase3551-3605-controlled-fifty-tool-mutation"] === "node tools/phase3551_3605/validate-controlled-fifty-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase3550_sealed", phase3550.recommendedSealed === true && phase3550.fortyNineMutationApplied === true);
check("result_exists", result !== null, "run apply:phase3551-3605-controlled-fifty-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("fifty_mutation_applied", result.fiftyMutationApplied === true);
  check("changed_file_count_fifty", result.changedFileCount === 50);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localFiftySmokePassed === true);
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
  check("rollback_restore_fifty", rollback.rollbackAction === "restore-previous-content-fifty");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_fifty_entries", Array.isArray(rollback.files) && rollback.files.length === 50);
}

if (smoke) {
  check("smoke_phase3556Marker", smoke.phase3556Marker === "PHASE3556_FIFTY_TOOL_TARGET_ONE_OK");
  check("smoke_phase3557Marker", smoke.phase3557Marker === "PHASE3557_FIFTY_TOOL_TARGET_TWO_OK");
  check("smoke_phase3558Marker", smoke.phase3558Marker === "PHASE3558_FIFTY_TOOL_TARGET_THREE_OK");
  check("smoke_phase3559Marker", smoke.phase3559Marker === "PHASE3559_FIFTY_TOOL_TARGET_FOUR_OK");
  check("smoke_phase3560Marker", smoke.phase3560Marker === "PHASE3560_FIFTY_TOOL_TARGET_FIVE_OK");
  check("smoke_phase3561Marker", smoke.phase3561Marker === "PHASE3561_FIFTY_TOOL_TARGET_SIX_OK");
  check("smoke_phase3562Marker", smoke.phase3562Marker === "PHASE3562_FIFTY_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase3563Marker", smoke.phase3563Marker === "PHASE3563_FIFTY_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase3564Marker", smoke.phase3564Marker === "PHASE3564_FIFTY_TOOL_TARGET_NINE_OK");
  check("smoke_phase3565Marker", smoke.phase3565Marker === "PHASE3565_FIFTY_TOOL_TARGET_TEN_OK");
  check("smoke_phase3566Marker", smoke.phase3566Marker === "PHASE3566_FIFTY_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase3567Marker", smoke.phase3567Marker === "PHASE3567_FIFTY_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase3568Marker", smoke.phase3568Marker === "PHASE3568_FIFTY_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase3569Marker", smoke.phase3569Marker === "PHASE3569_FIFTY_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase3570Marker", smoke.phase3570Marker === "PHASE3570_FIFTY_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase3571Marker", smoke.phase3571Marker === "PHASE3571_FIFTY_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase3572Marker", smoke.phase3572Marker === "PHASE3572_FIFTY_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase3573Marker", smoke.phase3573Marker === "PHASE3573_FIFTY_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase3574Marker", smoke.phase3574Marker === "PHASE3574_FIFTY_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase3575Marker", smoke.phase3575Marker === "PHASE3575_FIFTY_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase3576Marker", smoke.phase3576Marker === "PHASE3576_FIFTY_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase3577Marker", smoke.phase3577Marker === "PHASE3577_FIFTY_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase3578Marker", smoke.phase3578Marker === "PHASE3578_FIFTY_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase3579Marker", smoke.phase3579Marker === "PHASE3579_FIFTY_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase3580Marker", smoke.phase3580Marker === "PHASE3580_FIFTY_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase3581Marker", smoke.phase3581Marker === "PHASE3581_FIFTY_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase3582Marker", smoke.phase3582Marker === "PHASE3582_FIFTY_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase3583Marker", smoke.phase3583Marker === "PHASE3583_FIFTY_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase3584Marker", smoke.phase3584Marker === "PHASE3584_FIFTY_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase3585Marker", smoke.phase3585Marker === "PHASE3585_FIFTY_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase3586Marker", smoke.phase3586Marker === "PHASE3586_FIFTY_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase3587Marker", smoke.phase3587Marker === "PHASE3587_FIFTY_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase3588Marker", smoke.phase3588Marker === "PHASE3588_FIFTY_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase3589Marker", smoke.phase3589Marker === "PHASE3589_FIFTY_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase3590Marker", smoke.phase3590Marker === "PHASE3590_FIFTY_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_phase3591Marker", smoke.phase3591Marker === "PHASE3591_FIFTY_TOOL_TARGET_THIRTY_SIX_OK");
  check("smoke_phase3592Marker", smoke.phase3592Marker === "PHASE3592_FIFTY_TOOL_TARGET_THIRTY_SEVEN_OK");
  check("smoke_phase3593Marker", smoke.phase3593Marker === "PHASE3593_FIFTY_TOOL_TARGET_THIRTY_EIGHT_OK");
  check("smoke_phase3594Marker", smoke.phase3594Marker === "PHASE3594_FIFTY_TOOL_TARGET_THIRTY_NINE_OK");
  check("smoke_phase3595Marker", smoke.phase3595Marker === "PHASE3595_FIFTY_TOOL_TARGET_FORTY_OK");
  check("smoke_phase3596Marker", smoke.phase3596Marker === "PHASE3596_FIFTY_TOOL_TARGET_FORTY_ONE_OK");
  check("smoke_phase3597Marker", smoke.phase3597Marker === "PHASE3597_FIFTY_TOOL_TARGET_FORTY_TWO_OK");
  check("smoke_phase3598Marker", smoke.phase3598Marker === "PHASE3598_FIFTY_TOOL_TARGET_FORTY_THREE_OK");
  check("smoke_phase3599Marker", smoke.phase3599Marker === "PHASE3599_FIFTY_TOOL_TARGET_FORTY_FOUR_OK");
  check("smoke_phase3600Marker", smoke.phase3600Marker === "PHASE3600_FIFTY_TOOL_TARGET_FORTY_FIVE_OK");
  check("smoke_phase3601Marker", smoke.phase3601Marker === "PHASE3601_FIFTY_TOOL_TARGET_FORTY_SIX_OK");
  check("smoke_phase3602Marker", smoke.phase3602Marker === "PHASE3602_FIFTY_TOOL_TARGET_FORTY_SEVEN_OK");
  check("smoke_phase3603Marker", smoke.phase3603Marker === "PHASE3603_FIFTY_TOOL_TARGET_FORTY_EIGHT_OK");
  check("smoke_phase3604Marker", smoke.phase3604Marker === "PHASE3604_FIFTY_TOOL_TARGET_FORTY_NINE_OK");
  check("smoke_phase3605Marker", smoke.phase3605Marker === "PHASE3605_FIFTY_TOOL_TARGET_FIFTY_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase3556FiftyMutationTargetOneStatus") || targetOne.includes("export function buildPhase3556FiftyMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE3556_FIFTY_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase3557FiftyMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase3557FiftyMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE3557_FIFTY_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase3558FiftyMutationTargetThreeStatus") || targetThree.includes("export function buildPhase3558FiftyMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE3558_FIFTY_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase3559FiftyMutationTargetFourStatus") || targetFour.includes("export function buildPhase3559FiftyMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE3559_FIFTY_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase3560FiftyMutationTargetFiveStatus") || targetFive.includes("export function buildPhase3560FiftyMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE3560_FIFTY_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase3561FiftyMutationTargetSixStatus") || targetSix.includes("export function buildPhase3561FiftyMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE3561_FIFTY_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase3562FiftyMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase3562FiftyMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE3562_FIFTY_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase3563FiftyMutationTargetEightStatus") || targetEight.includes("export function buildPhase3563FiftyMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE3563_FIFTY_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase3564FiftyMutationTargetNineStatus") || targetNine.includes("export function buildPhase3564FiftyMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE3564_FIFTY_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase3565FiftyMutationTargetTenStatus") || targetTen.includes("export function buildPhase3565FiftyMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE3565_FIFTY_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase3566FiftyMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase3566FiftyMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE3566_FIFTY_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase3567FiftyMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase3567FiftyMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE3567_FIFTY_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase3568FiftyMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase3568FiftyMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE3568_FIFTY_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase3569FiftyMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase3569FiftyMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE3569_FIFTY_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase3570FiftyMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase3570FiftyMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE3570_FIFTY_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase3571FiftyMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase3571FiftyMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE3571_FIFTY_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase3572FiftyMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase3572FiftyMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE3572_FIFTY_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase3573FiftyMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase3573FiftyMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE3573_FIFTY_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase3574FiftyMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase3574FiftyMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE3574_FIFTY_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase3575FiftyMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase3575FiftyMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE3575_FIFTY_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase3576FiftyMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase3576FiftyMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE3576_FIFTY_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase3577FiftyMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase3577FiftyMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE3577_FIFTY_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase3578FiftyMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase3578FiftyMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE3578_FIFTY_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase3579FiftyMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase3579FiftyMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE3579_FIFTY_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase3580FiftyMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase3580FiftyMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE3580_FIFTY_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase3581FiftyMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase3581FiftyMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE3581_FIFTY_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase3582FiftyMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase3582FiftyMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE3582_FIFTY_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase3583FiftyMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase3583FiftyMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE3583_FIFTY_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase3584FiftyMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase3584FiftyMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE3584_FIFTY_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase3585FiftyMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase3585FiftyMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE3585_FIFTY_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase3586FiftyMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase3586FiftyMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE3586_FIFTY_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase3587FiftyMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase3587FiftyMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE3587_FIFTY_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase3588FiftyMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase3588FiftyMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE3588_FIFTY_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase3589FiftyMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase3589FiftyMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE3589_FIFTY_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase3590FiftyMutationTargetThirtyFiveStatus") || targetThirtyFive.includes("export function buildPhase3590FiftyMutationTargetThirtyFiveStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE3590_FIFTY_TOOL_TARGET_THIRTY_FIVE_OK"));
check("target-thirty-six_export", targetThirtySix.includes("buildPhase3591FiftyMutationTargetThirtySixStatus") || targetThirtySix.includes("export function buildPhase3591FiftyMutationTargetThirtySixStatus"));
check("target-thirty-six_marker", targetThirtySix.includes("PHASE3591_FIFTY_TOOL_TARGET_THIRTY_SIX_OK"));
check("target-thirty-seven_export", targetThirtySeven.includes("buildPhase3592FiftyMutationTargetThirtySevenStatus") || targetThirtySeven.includes("export function buildPhase3592FiftyMutationTargetThirtySevenStatus"));
check("target-thirty-seven_marker", targetThirtySeven.includes("PHASE3592_FIFTY_TOOL_TARGET_THIRTY_SEVEN_OK"));
check("target-thirty-eight_export", targetThirtyEight.includes("buildPhase3593FiftyMutationTargetThirtyEightStatus") || targetThirtyEight.includes("export function buildPhase3593FiftyMutationTargetThirtyEightStatus"));
check("target-thirty-eight_marker", targetThirtyEight.includes("PHASE3593_FIFTY_TOOL_TARGET_THIRTY_EIGHT_OK"));
check("target-thirty-nine_export", targetThirtyNine.includes("buildPhase3594FiftyMutationTargetThirtyNineStatus") || targetThirtyNine.includes("export function buildPhase3594FiftyMutationTargetThirtyNineStatus"));
check("target-thirty-nine_marker", targetThirtyNine.includes("PHASE3594_FIFTY_TOOL_TARGET_THIRTY_NINE_OK"));
check("target-forty_export", targetForty.includes("buildPhase3595FiftyMutationTargetFortyStatus") || targetForty.includes("export function buildPhase3595FiftyMutationTargetFortyStatus"));
check("target-forty_marker", targetForty.includes("PHASE3595_FIFTY_TOOL_TARGET_FORTY_OK"));
check("target-forty-one_export", targetFortyOne.includes("buildPhase3596FiftyMutationTargetFortyOneStatus") || targetFortyOne.includes("export function buildPhase3596FiftyMutationTargetFortyOneStatus"));
check("target-forty-one_marker", targetFortyOne.includes("PHASE3596_FIFTY_TOOL_TARGET_FORTY_ONE_OK"));
check("target-forty-two_export", targetFortyTwo.includes("buildPhase3597FiftyMutationTargetFortyTwoStatus") || targetFortyTwo.includes("export function buildPhase3597FiftyMutationTargetFortyTwoStatus"));
check("target-forty-two_marker", targetFortyTwo.includes("PHASE3597_FIFTY_TOOL_TARGET_FORTY_TWO_OK"));
check("target-forty-three_export", targetFortyThree.includes("buildPhase3598FiftyMutationTargetFortyThreeStatus") || targetFortyThree.includes("export function buildPhase3598FiftyMutationTargetFortyThreeStatus"));
check("target-forty-three_marker", targetFortyThree.includes("PHASE3598_FIFTY_TOOL_TARGET_FORTY_THREE_OK"));
check("target-forty-four_export", targetFortyFour.includes("buildPhase3599FiftyMutationTargetFortyFourStatus") || targetFortyFour.includes("export function buildPhase3599FiftyMutationTargetFortyFourStatus"));
check("target-forty-four_marker", targetFortyFour.includes("PHASE3599_FIFTY_TOOL_TARGET_FORTY_FOUR_OK"));
check("target-forty-five_export", targetFortyFive.includes("buildPhase3600FiftyMutationTargetFortyFiveStatus") || targetFortyFive.includes("export function buildPhase3600FiftyMutationTargetFortyFiveStatus"));
check("target-forty-five_marker", targetFortyFive.includes("PHASE3600_FIFTY_TOOL_TARGET_FORTY_FIVE_OK"));
check("target-forty-six_export", targetFortySix.includes("buildPhase3601FiftyMutationTargetFortySixStatus") || targetFortySix.includes("export function buildPhase3601FiftyMutationTargetFortySixStatus"));
check("target-forty-six_marker", targetFortySix.includes("PHASE3601_FIFTY_TOOL_TARGET_FORTY_SIX_OK"));
check("target-forty-seven_export", targetFortySeven.includes("buildPhase3602FiftyMutationTargetFortySevenStatus") || targetFortySeven.includes("export function buildPhase3602FiftyMutationTargetFortySevenStatus"));
check("target-forty-seven_marker", targetFortySeven.includes("PHASE3602_FIFTY_TOOL_TARGET_FORTY_SEVEN_OK"));
check("target-forty-eight_export", targetFortyEight.includes("buildPhase3603FiftyMutationTargetFortyEightStatus") || targetFortyEight.includes("export function buildPhase3603FiftyMutationTargetFortyEightStatus"));
check("target-forty-eight_marker", targetFortyEight.includes("PHASE3603_FIFTY_TOOL_TARGET_FORTY_EIGHT_OK"));
check("target-forty-nine_export", targetFortyNine.includes("buildPhase3604FiftyMutationTargetFortyNineStatus") || targetFortyNine.includes("export function buildPhase3604FiftyMutationTargetFortyNineStatus"));
check("target-forty-nine_marker", targetFortyNine.includes("PHASE3604_FIFTY_TOOL_TARGET_FORTY_NINE_OK"));
check("target-fifty_export", targetFifty.includes("buildPhase3605FiftyMutationRuntimeStatus") || targetFifty.includes("export function buildPhase3605FiftyMutationRuntimeStatus"));
check("target-fifty_marker", targetFifty.includes("PHASE3605_FIFTY_TOOL_TARGET_FIFTY_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_fifty", docs.includes("controlled fifty tool mutation"));
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
  phase3550Sealed: phase3550.recommendedSealed === true,
  fiftyMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 50,
  fiftyMutationApplied: result?.fiftyMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localFiftySmokePassed: result?.localFiftySmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, fiftyMutationApplied: verifierResult.fiftyMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localFiftySmokePassed: verifierResult.localFiftySmokePassed }, null, 2));
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
    "# Phase3551A-3605A Controlled Fifty Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- fiftyMutationApplied: ${Boolean(result.fiftyMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localFiftySmokePassed: ${Boolean(result.localFiftySmokePassed)}`,
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
