import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase3606A-3661A-Controlled-Fifty-One-Tool-Mutation";
const runnerPath = "tools/phase3606_3661/apply-controlled-fifty-one-tool-mutation.mjs";
const smokeRunnerPath = "tools/phase3606_3661/smoke-controlled-fifty-one-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase3606-3661-controlled-fifty-one-tool-mutation.md";
const approvalPath = "docs/phase3606-3661-controlled-fifty-one-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase3611-fifty-one-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase3612-fifty-one-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase3613-fifty-one-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase3614-fifty-one-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase3615-fifty-one-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase3616-fifty-one-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase3617-fifty-one-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase3618-fifty-one-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase3619-fifty-one-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase3620-fifty-one-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase3621-fifty-one-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase3622-fifty-one-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase3623-fifty-one-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase3624-fifty-one-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase3625-fifty-one-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase3626-fifty-one-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase3627-fifty-one-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase3628-fifty-one-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase3629-fifty-one-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase3630-fifty-one-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase3631-fifty-one-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase3632-fifty-one-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase3633-fifty-one-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase3634-fifty-one-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase3635-fifty-one-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase3636-fifty-one-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase3637-fifty-one-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase3638-fifty-one-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase3639-fifty-one-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase3640-fifty-one-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase3641-fifty-one-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase3642-fifty-one-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase3643-fifty-one-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase3644-fifty-one-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase3645-fifty-one-tool-mutation-target-thirty-five.proposal.diff";
const proposalThirtySixPath = "docs/phase3646-fifty-one-tool-mutation-target-thirty-six.proposal.diff";
const proposalThirtySevenPath = "docs/phase3647-fifty-one-tool-mutation-target-thirty-seven.proposal.diff";
const proposalThirtyEightPath = "docs/phase3648-fifty-one-tool-mutation-target-thirty-eight.proposal.diff";
const proposalThirtyNinePath = "docs/phase3649-fifty-one-tool-mutation-target-thirty-nine.proposal.diff";
const proposalFortyPath = "docs/phase3650-fifty-one-tool-mutation-target-forty.proposal.diff";
const proposalFortyOnePath = "docs/phase3651-fifty-one-tool-mutation-target-forty-one.proposal.diff";
const proposalFortyTwoPath = "docs/phase3652-fifty-one-tool-mutation-target-forty-two.proposal.diff";
const proposalFortyThreePath = "docs/phase3653-fifty-one-tool-mutation-target-forty-three.proposal.diff";
const proposalFortyFourPath = "docs/phase3654-fifty-one-tool-mutation-target-forty-four.proposal.diff";
const proposalFortyFivePath = "docs/phase3655-fifty-one-tool-mutation-target-forty-five.proposal.diff";
const proposalFortySixPath = "docs/phase3656-fifty-one-tool-mutation-target-forty-six.proposal.diff";
const proposalFortySevenPath = "docs/phase3657-fifty-one-tool-mutation-target-forty-seven.proposal.diff";
const proposalFortyEightPath = "docs/phase3658-fifty-one-tool-mutation-target-forty-eight.proposal.diff";
const proposalFortyNinePath = "docs/phase3659-fifty-one-tool-mutation-target-forty-nine.proposal.diff";
const proposalFiftyPath = "docs/phase3660-fifty-one-tool-mutation-target-fifty.proposal.diff";
const proposalFiftyOnePath = "docs/phase3661-fifty-one-tool-mutation-target-fifty-one.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase3606-3661-controlled-fifty-one-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase3606-3661-controlled-fifty-one-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase3606-3661-controlled-fifty-one-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase3606-3661-controlled-fifty-one-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase3606-3661-controlled-fifty-one-tool-mutation/fifty-one-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase3605 = readJson("apps/ai-gateway-service/evidence/phase3551-3605-controlled-fifty-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase3606-3661-controlled-fifty-one-tool-mutation"] === "node tools/phase3606_3661/apply-controlled-fifty-one-tool-mutation.mjs --plan docs/phase3606-3661-controlled-fifty-one-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase3606-3661-controlled-fifty-one-tool-mutation"] ===
    "node tools/phase3606_3661/smoke-controlled-fifty-one-tool-mutation.mjs",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase3606-3661-controlled-fifty-one-tool-mutation"] === "node tools/phase3606_3661/validate-controlled-fifty-one-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase3605_sealed", phase3605.recommendedSealed === true && phase3605.fiftyMutationApplied === true);
check("result_exists", result !== null, "run apply:phase3606-3661-controlled-fifty-one-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("fifty_one_mutation_applied", result.fiftyOneMutationApplied === true);
  check("changed_file_count_fifty_one", result.changedFileCount === 51);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localFiftyOneSmokePassed === true);
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
  check("rollback_restore_fifty_one", rollback.rollbackAction === "restore-previous-content-fifty-one");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_fifty_one_entries", Array.isArray(rollback.files) && rollback.files.length === 51);
}

if (smoke) {
  check("smoke_phase3611Marker", smoke.phase3611Marker === "PHASE3611_FIFTY_ONE_TOOL_TARGET_ONE_OK");
  check("smoke_phase3612Marker", smoke.phase3612Marker === "PHASE3612_FIFTY_ONE_TOOL_TARGET_TWO_OK");
  check("smoke_phase3613Marker", smoke.phase3613Marker === "PHASE3613_FIFTY_ONE_TOOL_TARGET_THREE_OK");
  check("smoke_phase3614Marker", smoke.phase3614Marker === "PHASE3614_FIFTY_ONE_TOOL_TARGET_FOUR_OK");
  check("smoke_phase3615Marker", smoke.phase3615Marker === "PHASE3615_FIFTY_ONE_TOOL_TARGET_FIVE_OK");
  check("smoke_phase3616Marker", smoke.phase3616Marker === "PHASE3616_FIFTY_ONE_TOOL_TARGET_SIX_OK");
  check("smoke_phase3617Marker", smoke.phase3617Marker === "PHASE3617_FIFTY_ONE_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase3618Marker", smoke.phase3618Marker === "PHASE3618_FIFTY_ONE_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase3619Marker", smoke.phase3619Marker === "PHASE3619_FIFTY_ONE_TOOL_TARGET_NINE_OK");
  check("smoke_phase3620Marker", smoke.phase3620Marker === "PHASE3620_FIFTY_ONE_TOOL_TARGET_TEN_OK");
  check("smoke_phase3621Marker", smoke.phase3621Marker === "PHASE3621_FIFTY_ONE_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase3622Marker", smoke.phase3622Marker === "PHASE3622_FIFTY_ONE_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase3623Marker", smoke.phase3623Marker === "PHASE3623_FIFTY_ONE_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase3624Marker", smoke.phase3624Marker === "PHASE3624_FIFTY_ONE_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase3625Marker", smoke.phase3625Marker === "PHASE3625_FIFTY_ONE_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase3626Marker", smoke.phase3626Marker === "PHASE3626_FIFTY_ONE_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase3627Marker", smoke.phase3627Marker === "PHASE3627_FIFTY_ONE_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase3628Marker", smoke.phase3628Marker === "PHASE3628_FIFTY_ONE_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase3629Marker", smoke.phase3629Marker === "PHASE3629_FIFTY_ONE_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase3630Marker", smoke.phase3630Marker === "PHASE3630_FIFTY_ONE_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase3631Marker", smoke.phase3631Marker === "PHASE3631_FIFTY_ONE_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase3632Marker", smoke.phase3632Marker === "PHASE3632_FIFTY_ONE_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase3633Marker", smoke.phase3633Marker === "PHASE3633_FIFTY_ONE_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase3634Marker", smoke.phase3634Marker === "PHASE3634_FIFTY_ONE_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase3635Marker", smoke.phase3635Marker === "PHASE3635_FIFTY_ONE_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase3636Marker", smoke.phase3636Marker === "PHASE3636_FIFTY_ONE_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase3637Marker", smoke.phase3637Marker === "PHASE3637_FIFTY_ONE_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase3638Marker", smoke.phase3638Marker === "PHASE3638_FIFTY_ONE_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase3639Marker", smoke.phase3639Marker === "PHASE3639_FIFTY_ONE_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase3640Marker", smoke.phase3640Marker === "PHASE3640_FIFTY_ONE_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase3641Marker", smoke.phase3641Marker === "PHASE3641_FIFTY_ONE_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase3642Marker", smoke.phase3642Marker === "PHASE3642_FIFTY_ONE_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase3643Marker", smoke.phase3643Marker === "PHASE3643_FIFTY_ONE_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase3644Marker", smoke.phase3644Marker === "PHASE3644_FIFTY_ONE_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase3645Marker", smoke.phase3645Marker === "PHASE3645_FIFTY_ONE_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_phase3646Marker", smoke.phase3646Marker === "PHASE3646_FIFTY_ONE_TOOL_TARGET_THIRTY_SIX_OK");
  check("smoke_phase3647Marker", smoke.phase3647Marker === "PHASE3647_FIFTY_ONE_TOOL_TARGET_THIRTY_SEVEN_OK");
  check("smoke_phase3648Marker", smoke.phase3648Marker === "PHASE3648_FIFTY_ONE_TOOL_TARGET_THIRTY_EIGHT_OK");
  check("smoke_phase3649Marker", smoke.phase3649Marker === "PHASE3649_FIFTY_ONE_TOOL_TARGET_THIRTY_NINE_OK");
  check("smoke_phase3650Marker", smoke.phase3650Marker === "PHASE3650_FIFTY_ONE_TOOL_TARGET_FORTY_OK");
  check("smoke_phase3651Marker", smoke.phase3651Marker === "PHASE3651_FIFTY_ONE_TOOL_TARGET_FORTY_ONE_OK");
  check("smoke_phase3652Marker", smoke.phase3652Marker === "PHASE3652_FIFTY_ONE_TOOL_TARGET_FORTY_TWO_OK");
  check("smoke_phase3653Marker", smoke.phase3653Marker === "PHASE3653_FIFTY_ONE_TOOL_TARGET_FORTY_THREE_OK");
  check("smoke_phase3654Marker", smoke.phase3654Marker === "PHASE3654_FIFTY_ONE_TOOL_TARGET_FORTY_FOUR_OK");
  check("smoke_phase3655Marker", smoke.phase3655Marker === "PHASE3655_FIFTY_ONE_TOOL_TARGET_FORTY_FIVE_OK");
  check("smoke_phase3656Marker", smoke.phase3656Marker === "PHASE3656_FIFTY_ONE_TOOL_TARGET_FORTY_SIX_OK");
  check("smoke_phase3657Marker", smoke.phase3657Marker === "PHASE3657_FIFTY_ONE_TOOL_TARGET_FORTY_SEVEN_OK");
  check("smoke_phase3658Marker", smoke.phase3658Marker === "PHASE3658_FIFTY_ONE_TOOL_TARGET_FORTY_EIGHT_OK");
  check("smoke_phase3659Marker", smoke.phase3659Marker === "PHASE3659_FIFTY_ONE_TOOL_TARGET_FORTY_NINE_OK");
  check("smoke_phase3660Marker", smoke.phase3660Marker === "PHASE3660_FIFTY_ONE_TOOL_TARGET_FIFTY_OK");
  check("smoke_phase3661Marker", smoke.phase3661Marker === "PHASE3661_FIFTY_ONE_TOOL_TARGET_FIFTY_ONE_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase3611FiftyOneMutationTargetOneStatus") || targetOne.includes("export function buildPhase3611FiftyOneMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE3611_FIFTY_ONE_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase3612FiftyOneMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase3612FiftyOneMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE3612_FIFTY_ONE_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase3613FiftyOneMutationTargetThreeStatus") || targetThree.includes("export function buildPhase3613FiftyOneMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE3613_FIFTY_ONE_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase3614FiftyOneMutationTargetFourStatus") || targetFour.includes("export function buildPhase3614FiftyOneMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE3614_FIFTY_ONE_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase3615FiftyOneMutationTargetFiveStatus") || targetFive.includes("export function buildPhase3615FiftyOneMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE3615_FIFTY_ONE_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase3616FiftyOneMutationTargetSixStatus") || targetSix.includes("export function buildPhase3616FiftyOneMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE3616_FIFTY_ONE_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase3617FiftyOneMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase3617FiftyOneMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE3617_FIFTY_ONE_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase3618FiftyOneMutationTargetEightStatus") || targetEight.includes("export function buildPhase3618FiftyOneMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE3618_FIFTY_ONE_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase3619FiftyOneMutationTargetNineStatus") || targetNine.includes("export function buildPhase3619FiftyOneMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE3619_FIFTY_ONE_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase3620FiftyOneMutationTargetTenStatus") || targetTen.includes("export function buildPhase3620FiftyOneMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE3620_FIFTY_ONE_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase3621FiftyOneMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase3621FiftyOneMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE3621_FIFTY_ONE_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase3622FiftyOneMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase3622FiftyOneMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE3622_FIFTY_ONE_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase3623FiftyOneMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase3623FiftyOneMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE3623_FIFTY_ONE_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase3624FiftyOneMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase3624FiftyOneMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE3624_FIFTY_ONE_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase3625FiftyOneMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase3625FiftyOneMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE3625_FIFTY_ONE_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase3626FiftyOneMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase3626FiftyOneMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE3626_FIFTY_ONE_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase3627FiftyOneMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase3627FiftyOneMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE3627_FIFTY_ONE_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase3628FiftyOneMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase3628FiftyOneMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE3628_FIFTY_ONE_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase3629FiftyOneMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase3629FiftyOneMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE3629_FIFTY_ONE_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase3630FiftyOneMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase3630FiftyOneMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE3630_FIFTY_ONE_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase3631FiftyOneMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase3631FiftyOneMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE3631_FIFTY_ONE_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase3632FiftyOneMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase3632FiftyOneMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE3632_FIFTY_ONE_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase3633FiftyOneMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase3633FiftyOneMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE3633_FIFTY_ONE_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase3634FiftyOneMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase3634FiftyOneMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE3634_FIFTY_ONE_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase3635FiftyOneMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase3635FiftyOneMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE3635_FIFTY_ONE_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase3636FiftyOneMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase3636FiftyOneMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE3636_FIFTY_ONE_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase3637FiftyOneMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase3637FiftyOneMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE3637_FIFTY_ONE_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase3638FiftyOneMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase3638FiftyOneMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE3638_FIFTY_ONE_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase3639FiftyOneMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase3639FiftyOneMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE3639_FIFTY_ONE_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase3640FiftyOneMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase3640FiftyOneMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE3640_FIFTY_ONE_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase3641FiftyOneMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase3641FiftyOneMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE3641_FIFTY_ONE_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase3642FiftyOneMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase3642FiftyOneMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE3642_FIFTY_ONE_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase3643FiftyOneMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase3643FiftyOneMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE3643_FIFTY_ONE_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase3644FiftyOneMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase3644FiftyOneMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE3644_FIFTY_ONE_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase3645FiftyOneMutationTargetThirtyFiveStatus") || targetThirtyFive.includes("export function buildPhase3645FiftyOneMutationTargetThirtyFiveStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE3645_FIFTY_ONE_TOOL_TARGET_THIRTY_FIVE_OK"));
check("target-thirty-six_export", targetThirtySix.includes("buildPhase3646FiftyOneMutationTargetThirtySixStatus") || targetThirtySix.includes("export function buildPhase3646FiftyOneMutationTargetThirtySixStatus"));
check("target-thirty-six_marker", targetThirtySix.includes("PHASE3646_FIFTY_ONE_TOOL_TARGET_THIRTY_SIX_OK"));
check("target-thirty-seven_export", targetThirtySeven.includes("buildPhase3647FiftyOneMutationTargetThirtySevenStatus") || targetThirtySeven.includes("export function buildPhase3647FiftyOneMutationTargetThirtySevenStatus"));
check("target-thirty-seven_marker", targetThirtySeven.includes("PHASE3647_FIFTY_ONE_TOOL_TARGET_THIRTY_SEVEN_OK"));
check("target-thirty-eight_export", targetThirtyEight.includes("buildPhase3648FiftyOneMutationTargetThirtyEightStatus") || targetThirtyEight.includes("export function buildPhase3648FiftyOneMutationTargetThirtyEightStatus"));
check("target-thirty-eight_marker", targetThirtyEight.includes("PHASE3648_FIFTY_ONE_TOOL_TARGET_THIRTY_EIGHT_OK"));
check("target-thirty-nine_export", targetThirtyNine.includes("buildPhase3649FiftyOneMutationTargetThirtyNineStatus") || targetThirtyNine.includes("export function buildPhase3649FiftyOneMutationTargetThirtyNineStatus"));
check("target-thirty-nine_marker", targetThirtyNine.includes("PHASE3649_FIFTY_ONE_TOOL_TARGET_THIRTY_NINE_OK"));
check("target-forty_export", targetForty.includes("buildPhase3650FiftyOneMutationTargetFortyStatus") || targetForty.includes("export function buildPhase3650FiftyOneMutationTargetFortyStatus"));
check("target-forty_marker", targetForty.includes("PHASE3650_FIFTY_ONE_TOOL_TARGET_FORTY_OK"));
check("target-forty-one_export", targetFortyOne.includes("buildPhase3651FiftyOneMutationTargetFortyOneStatus") || targetFortyOne.includes("export function buildPhase3651FiftyOneMutationTargetFortyOneStatus"));
check("target-forty-one_marker", targetFortyOne.includes("PHASE3651_FIFTY_ONE_TOOL_TARGET_FORTY_ONE_OK"));
check("target-forty-two_export", targetFortyTwo.includes("buildPhase3652FiftyOneMutationTargetFortyTwoStatus") || targetFortyTwo.includes("export function buildPhase3652FiftyOneMutationTargetFortyTwoStatus"));
check("target-forty-two_marker", targetFortyTwo.includes("PHASE3652_FIFTY_ONE_TOOL_TARGET_FORTY_TWO_OK"));
check("target-forty-three_export", targetFortyThree.includes("buildPhase3653FiftyOneMutationTargetFortyThreeStatus") || targetFortyThree.includes("export function buildPhase3653FiftyOneMutationTargetFortyThreeStatus"));
check("target-forty-three_marker", targetFortyThree.includes("PHASE3653_FIFTY_ONE_TOOL_TARGET_FORTY_THREE_OK"));
check("target-forty-four_export", targetFortyFour.includes("buildPhase3654FiftyOneMutationTargetFortyFourStatus") || targetFortyFour.includes("export function buildPhase3654FiftyOneMutationTargetFortyFourStatus"));
check("target-forty-four_marker", targetFortyFour.includes("PHASE3654_FIFTY_ONE_TOOL_TARGET_FORTY_FOUR_OK"));
check("target-forty-five_export", targetFortyFive.includes("buildPhase3655FiftyOneMutationTargetFortyFiveStatus") || targetFortyFive.includes("export function buildPhase3655FiftyOneMutationTargetFortyFiveStatus"));
check("target-forty-five_marker", targetFortyFive.includes("PHASE3655_FIFTY_ONE_TOOL_TARGET_FORTY_FIVE_OK"));
check("target-forty-six_export", targetFortySix.includes("buildPhase3656FiftyOneMutationTargetFortySixStatus") || targetFortySix.includes("export function buildPhase3656FiftyOneMutationTargetFortySixStatus"));
check("target-forty-six_marker", targetFortySix.includes("PHASE3656_FIFTY_ONE_TOOL_TARGET_FORTY_SIX_OK"));
check("target-forty-seven_export", targetFortySeven.includes("buildPhase3657FiftyOneMutationTargetFortySevenStatus") || targetFortySeven.includes("export function buildPhase3657FiftyOneMutationTargetFortySevenStatus"));
check("target-forty-seven_marker", targetFortySeven.includes("PHASE3657_FIFTY_ONE_TOOL_TARGET_FORTY_SEVEN_OK"));
check("target-forty-eight_export", targetFortyEight.includes("buildPhase3658FiftyOneMutationTargetFortyEightStatus") || targetFortyEight.includes("export function buildPhase3658FiftyOneMutationTargetFortyEightStatus"));
check("target-forty-eight_marker", targetFortyEight.includes("PHASE3658_FIFTY_ONE_TOOL_TARGET_FORTY_EIGHT_OK"));
check("target-forty-nine_export", targetFortyNine.includes("buildPhase3659FiftyOneMutationTargetFortyNineStatus") || targetFortyNine.includes("export function buildPhase3659FiftyOneMutationTargetFortyNineStatus"));
check("target-forty-nine_marker", targetFortyNine.includes("PHASE3659_FIFTY_ONE_TOOL_TARGET_FORTY_NINE_OK"));
check("target-fifty_export", targetFifty.includes("buildPhase3660FiftyOneMutationTargetFiftyStatus") || targetFifty.includes("export function buildPhase3660FiftyOneMutationTargetFiftyStatus"));
check("target-fifty_marker", targetFifty.includes("PHASE3660_FIFTY_ONE_TOOL_TARGET_FIFTY_OK"));
check("target-fifty-one_export", targetFiftyOne.includes("buildPhase3661FiftyOneMutationRuntimeStatus") || targetFiftyOne.includes("export function buildPhase3661FiftyOneMutationRuntimeStatus"));
check("target-fifty-one_marker", targetFiftyOne.includes("PHASE3661_FIFTY_ONE_TOOL_TARGET_FIFTY_ONE_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_fifty_one", docs.includes("controlled fifty-one tool mutation"));
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
  phase3605Sealed: phase3605.recommendedSealed === true,
  fiftyOneMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 51,
  fiftyOneMutationApplied: result?.fiftyOneMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localFiftyOneSmokePassed: result?.localFiftyOneSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, fiftyOneMutationApplied: verifierResult.fiftyOneMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localFiftyOneSmokePassed: verifierResult.localFiftyOneSmokePassed }, null, 2));
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
    "# Phase3606A-3661A Controlled Fifty-One Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- fiftyOneMutationApplied: ${Boolean(result.fiftyOneMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localFiftyOneSmokePassed: ${Boolean(result.localFiftyOneSmokePassed)}`,
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
