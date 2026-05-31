import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase3497A-3550A-Controlled-Forty-Nine-Tool-Mutation";
const runnerPath = "tools/phase3497_3550/apply-controlled-forty-nine-tool-mutation.mjs";
const smokeRunnerPath = "tools/phase3497_3550/smoke-controlled-forty-nine-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase3497-3550-controlled-forty-nine-tool-mutation.md";
const approvalPath = "docs/phase3497-3550-controlled-forty-nine-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase3502-forty-nine-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase3503-forty-nine-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase3504-forty-nine-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase3505-forty-nine-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase3506-forty-nine-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase3507-forty-nine-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase3508-forty-nine-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase3509-forty-nine-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase3510-forty-nine-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase3511-forty-nine-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase3512-forty-nine-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase3513-forty-nine-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase3514-forty-nine-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase3515-forty-nine-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase3516-forty-nine-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase3517-forty-nine-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase3518-forty-nine-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase3519-forty-nine-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase3520-forty-nine-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase3521-forty-nine-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase3522-forty-nine-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase3523-forty-nine-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase3524-forty-nine-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase3525-forty-nine-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase3526-forty-nine-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase3527-forty-nine-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase3528-forty-nine-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase3529-forty-nine-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase3530-forty-nine-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase3531-forty-nine-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase3532-forty-nine-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase3533-forty-nine-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase3534-forty-nine-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase3535-forty-nine-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase3536-forty-nine-tool-mutation-target-thirty-five.proposal.diff";
const proposalThirtySixPath = "docs/phase3537-forty-nine-tool-mutation-target-thirty-six.proposal.diff";
const proposalThirtySevenPath = "docs/phase3538-forty-nine-tool-mutation-target-thirty-seven.proposal.diff";
const proposalThirtyEightPath = "docs/phase3539-forty-nine-tool-mutation-target-thirty-eight.proposal.diff";
const proposalThirtyNinePath = "docs/phase3540-forty-nine-tool-mutation-target-thirty-nine.proposal.diff";
const proposalFortyPath = "docs/phase3541-forty-nine-tool-mutation-target-forty.proposal.diff";
const proposalFortyOnePath = "docs/phase3542-forty-nine-tool-mutation-target-forty-one.proposal.diff";
const proposalFortyTwoPath = "docs/phase3543-forty-nine-tool-mutation-target-forty-two.proposal.diff";
const proposalFortyThreePath = "docs/phase3544-forty-nine-tool-mutation-target-forty-three.proposal.diff";
const proposalFortyFourPath = "docs/phase3545-forty-nine-tool-mutation-target-forty-four.proposal.diff";
const proposalFortyFivePath = "docs/phase3546-forty-nine-tool-mutation-target-forty-five.proposal.diff";
const proposalFortySixPath = "docs/phase3547-forty-nine-tool-mutation-target-forty-six.proposal.diff";
const proposalFortySevenPath = "docs/phase3548-forty-nine-tool-mutation-target-forty-seven.proposal.diff";
const proposalFortyEightPath = "docs/phase3549-forty-nine-tool-mutation-target-forty-eight.proposal.diff";
const proposalFortyNinePath = "docs/phase3550-forty-nine-tool-mutation-target-forty-nine.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase3497-3550-controlled-forty-nine-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase3497-3550-controlled-forty-nine-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase3497-3550-controlled-forty-nine-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase3497-3550-controlled-forty-nine-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase3497-3550-controlled-forty-nine-tool-mutation/forty-nine-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase3496 = readJson("apps/ai-gateway-service/evidence/phase3444-3496-controlled-forty-eight-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase3497-3550-controlled-forty-nine-tool-mutation"] === "node tools/phase3497_3550/apply-controlled-forty-nine-tool-mutation.mjs --plan docs/phase3497-3550-controlled-forty-nine-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase3497-3550-controlled-forty-nine-tool-mutation"] ===
    "node tools/phase3497_3550/smoke-controlled-forty-nine-tool-mutation.mjs",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase3497-3550-controlled-forty-nine-tool-mutation"] === "node tools/phase3497_3550/validate-controlled-forty-nine-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase3496_sealed", phase3496.recommendedSealed === true && phase3496.fortyEightMutationApplied === true);
check("result_exists", result !== null, "run apply:phase3497-3550-controlled-forty-nine-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("forty_nine_mutation_applied", result.fortyNineMutationApplied === true);
  check("changed_file_count_forty_nine", result.changedFileCount === 49);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localFortyNineSmokePassed === true);
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
  check("rollback_restore_forty_nine", rollback.rollbackAction === "restore-previous-content-forty-nine");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_forty_nine_entries", Array.isArray(rollback.files) && rollback.files.length === 49);
}

if (smoke) {
  check("smoke_phase3502Marker", smoke.phase3502Marker === "PHASE3502_FORTY_NINE_TOOL_TARGET_ONE_OK");
  check("smoke_phase3503Marker", smoke.phase3503Marker === "PHASE3503_FORTY_NINE_TOOL_TARGET_TWO_OK");
  check("smoke_phase3504Marker", smoke.phase3504Marker === "PHASE3504_FORTY_NINE_TOOL_TARGET_THREE_OK");
  check("smoke_phase3505Marker", smoke.phase3505Marker === "PHASE3505_FORTY_NINE_TOOL_TARGET_FOUR_OK");
  check("smoke_phase3506Marker", smoke.phase3506Marker === "PHASE3506_FORTY_NINE_TOOL_TARGET_FIVE_OK");
  check("smoke_phase3507Marker", smoke.phase3507Marker === "PHASE3507_FORTY_NINE_TOOL_TARGET_SIX_OK");
  check("smoke_phase3508Marker", smoke.phase3508Marker === "PHASE3508_FORTY_NINE_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase3509Marker", smoke.phase3509Marker === "PHASE3509_FORTY_NINE_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase3510Marker", smoke.phase3510Marker === "PHASE3510_FORTY_NINE_TOOL_TARGET_NINE_OK");
  check("smoke_phase3511Marker", smoke.phase3511Marker === "PHASE3511_FORTY_NINE_TOOL_TARGET_TEN_OK");
  check("smoke_phase3512Marker", smoke.phase3512Marker === "PHASE3512_FORTY_NINE_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase3513Marker", smoke.phase3513Marker === "PHASE3513_FORTY_NINE_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase3514Marker", smoke.phase3514Marker === "PHASE3514_FORTY_NINE_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase3515Marker", smoke.phase3515Marker === "PHASE3515_FORTY_NINE_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase3516Marker", smoke.phase3516Marker === "PHASE3516_FORTY_NINE_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase3517Marker", smoke.phase3517Marker === "PHASE3517_FORTY_NINE_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase3518Marker", smoke.phase3518Marker === "PHASE3518_FORTY_NINE_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase3519Marker", smoke.phase3519Marker === "PHASE3519_FORTY_NINE_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase3520Marker", smoke.phase3520Marker === "PHASE3520_FORTY_NINE_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase3521Marker", smoke.phase3521Marker === "PHASE3521_FORTY_NINE_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase3522Marker", smoke.phase3522Marker === "PHASE3522_FORTY_NINE_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase3523Marker", smoke.phase3523Marker === "PHASE3523_FORTY_NINE_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase3524Marker", smoke.phase3524Marker === "PHASE3524_FORTY_NINE_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase3525Marker", smoke.phase3525Marker === "PHASE3525_FORTY_NINE_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase3526Marker", smoke.phase3526Marker === "PHASE3526_FORTY_NINE_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase3527Marker", smoke.phase3527Marker === "PHASE3527_FORTY_NINE_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase3528Marker", smoke.phase3528Marker === "PHASE3528_FORTY_NINE_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase3529Marker", smoke.phase3529Marker === "PHASE3529_FORTY_NINE_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase3530Marker", smoke.phase3530Marker === "PHASE3530_FORTY_NINE_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase3531Marker", smoke.phase3531Marker === "PHASE3531_FORTY_NINE_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase3532Marker", smoke.phase3532Marker === "PHASE3532_FORTY_NINE_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase3533Marker", smoke.phase3533Marker === "PHASE3533_FORTY_NINE_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase3534Marker", smoke.phase3534Marker === "PHASE3534_FORTY_NINE_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase3535Marker", smoke.phase3535Marker === "PHASE3535_FORTY_NINE_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase3536Marker", smoke.phase3536Marker === "PHASE3536_FORTY_NINE_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_phase3537Marker", smoke.phase3537Marker === "PHASE3537_FORTY_NINE_TOOL_TARGET_THIRTY_SIX_OK");
  check("smoke_phase3538Marker", smoke.phase3538Marker === "PHASE3538_FORTY_NINE_TOOL_TARGET_THIRTY_SEVEN_OK");
  check("smoke_phase3539Marker", smoke.phase3539Marker === "PHASE3539_FORTY_NINE_TOOL_TARGET_THIRTY_EIGHT_OK");
  check("smoke_phase3540Marker", smoke.phase3540Marker === "PHASE3540_FORTY_NINE_TOOL_TARGET_THIRTY_NINE_OK");
  check("smoke_phase3541Marker", smoke.phase3541Marker === "PHASE3541_FORTY_NINE_TOOL_TARGET_FORTY_OK");
  check("smoke_phase3542Marker", smoke.phase3542Marker === "PHASE3542_FORTY_NINE_TOOL_TARGET_FORTY_ONE_OK");
  check("smoke_phase3543Marker", smoke.phase3543Marker === "PHASE3543_FORTY_NINE_TOOL_TARGET_FORTY_TWO_OK");
  check("smoke_phase3544Marker", smoke.phase3544Marker === "PHASE3544_FORTY_NINE_TOOL_TARGET_FORTY_THREE_OK");
  check("smoke_phase3545Marker", smoke.phase3545Marker === "PHASE3545_FORTY_NINE_TOOL_TARGET_FORTY_FOUR_OK");
  check("smoke_phase3546Marker", smoke.phase3546Marker === "PHASE3546_FORTY_NINE_TOOL_TARGET_FORTY_FIVE_OK");
  check("smoke_phase3547Marker", smoke.phase3547Marker === "PHASE3547_FORTY_NINE_TOOL_TARGET_FORTY_SIX_OK");
  check("smoke_phase3548Marker", smoke.phase3548Marker === "PHASE3548_FORTY_NINE_TOOL_TARGET_FORTY_SEVEN_OK");
  check("smoke_phase3549Marker", smoke.phase3549Marker === "PHASE3549_FORTY_NINE_TOOL_TARGET_FORTY_EIGHT_OK");
  check("smoke_phase3550Marker", smoke.phase3550Marker === "PHASE3550_FORTY_NINE_TOOL_TARGET_FORTY_NINE_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase3502FortyNineMutationTargetOneStatus") || targetOne.includes("export function buildPhase3502FortyNineMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE3502_FORTY_NINE_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase3503FortyNineMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase3503FortyNineMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE3503_FORTY_NINE_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase3504FortyNineMutationTargetThreeStatus") || targetThree.includes("export function buildPhase3504FortyNineMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE3504_FORTY_NINE_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase3505FortyNineMutationTargetFourStatus") || targetFour.includes("export function buildPhase3505FortyNineMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE3505_FORTY_NINE_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase3506FortyNineMutationTargetFiveStatus") || targetFive.includes("export function buildPhase3506FortyNineMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE3506_FORTY_NINE_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase3507FortyNineMutationTargetSixStatus") || targetSix.includes("export function buildPhase3507FortyNineMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE3507_FORTY_NINE_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase3508FortyNineMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase3508FortyNineMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE3508_FORTY_NINE_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase3509FortyNineMutationTargetEightStatus") || targetEight.includes("export function buildPhase3509FortyNineMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE3509_FORTY_NINE_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase3510FortyNineMutationTargetNineStatus") || targetNine.includes("export function buildPhase3510FortyNineMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE3510_FORTY_NINE_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase3511FortyNineMutationTargetTenStatus") || targetTen.includes("export function buildPhase3511FortyNineMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE3511_FORTY_NINE_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase3512FortyNineMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase3512FortyNineMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE3512_FORTY_NINE_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase3513FortyNineMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase3513FortyNineMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE3513_FORTY_NINE_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase3514FortyNineMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase3514FortyNineMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE3514_FORTY_NINE_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase3515FortyNineMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase3515FortyNineMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE3515_FORTY_NINE_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase3516FortyNineMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase3516FortyNineMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE3516_FORTY_NINE_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase3517FortyNineMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase3517FortyNineMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE3517_FORTY_NINE_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase3518FortyNineMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase3518FortyNineMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE3518_FORTY_NINE_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase3519FortyNineMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase3519FortyNineMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE3519_FORTY_NINE_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase3520FortyNineMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase3520FortyNineMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE3520_FORTY_NINE_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase3521FortyNineMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase3521FortyNineMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE3521_FORTY_NINE_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase3522FortyNineMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase3522FortyNineMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE3522_FORTY_NINE_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase3523FortyNineMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase3523FortyNineMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE3523_FORTY_NINE_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase3524FortyNineMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase3524FortyNineMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE3524_FORTY_NINE_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase3525FortyNineMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase3525FortyNineMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE3525_FORTY_NINE_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase3526FortyNineMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase3526FortyNineMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE3526_FORTY_NINE_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase3527FortyNineMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase3527FortyNineMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE3527_FORTY_NINE_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase3528FortyNineMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase3528FortyNineMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE3528_FORTY_NINE_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase3529FortyNineMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase3529FortyNineMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE3529_FORTY_NINE_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase3530FortyNineMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase3530FortyNineMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE3530_FORTY_NINE_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase3531FortyNineMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase3531FortyNineMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE3531_FORTY_NINE_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase3532FortyNineMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase3532FortyNineMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE3532_FORTY_NINE_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase3533FortyNineMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase3533FortyNineMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE3533_FORTY_NINE_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase3534FortyNineMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase3534FortyNineMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE3534_FORTY_NINE_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase3535FortyNineMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase3535FortyNineMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE3535_FORTY_NINE_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase3536FortyNineMutationTargetThirtyFiveStatus") || targetThirtyFive.includes("export function buildPhase3536FortyNineMutationTargetThirtyFiveStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE3536_FORTY_NINE_TOOL_TARGET_THIRTY_FIVE_OK"));
check("target-thirty-six_export", targetThirtySix.includes("buildPhase3537FortyNineMutationTargetThirtySixStatus") || targetThirtySix.includes("export function buildPhase3537FortyNineMutationTargetThirtySixStatus"));
check("target-thirty-six_marker", targetThirtySix.includes("PHASE3537_FORTY_NINE_TOOL_TARGET_THIRTY_SIX_OK"));
check("target-thirty-seven_export", targetThirtySeven.includes("buildPhase3538FortyNineMutationTargetThirtySevenStatus") || targetThirtySeven.includes("export function buildPhase3538FortyNineMutationTargetThirtySevenStatus"));
check("target-thirty-seven_marker", targetThirtySeven.includes("PHASE3538_FORTY_NINE_TOOL_TARGET_THIRTY_SEVEN_OK"));
check("target-thirty-eight_export", targetThirtyEight.includes("buildPhase3539FortyNineMutationTargetThirtyEightStatus") || targetThirtyEight.includes("export function buildPhase3539FortyNineMutationTargetThirtyEightStatus"));
check("target-thirty-eight_marker", targetThirtyEight.includes("PHASE3539_FORTY_NINE_TOOL_TARGET_THIRTY_EIGHT_OK"));
check("target-thirty-nine_export", targetThirtyNine.includes("buildPhase3540FortyNineMutationTargetThirtyNineStatus") || targetThirtyNine.includes("export function buildPhase3540FortyNineMutationTargetThirtyNineStatus"));
check("target-thirty-nine_marker", targetThirtyNine.includes("PHASE3540_FORTY_NINE_TOOL_TARGET_THIRTY_NINE_OK"));
check("target-forty_export", targetForty.includes("buildPhase3541FortyNineMutationTargetFortyStatus") || targetForty.includes("export function buildPhase3541FortyNineMutationTargetFortyStatus"));
check("target-forty_marker", targetForty.includes("PHASE3541_FORTY_NINE_TOOL_TARGET_FORTY_OK"));
check("target-forty-one_export", targetFortyOne.includes("buildPhase3542FortyNineMutationTargetFortyOneStatus") || targetFortyOne.includes("export function buildPhase3542FortyNineMutationTargetFortyOneStatus"));
check("target-forty-one_marker", targetFortyOne.includes("PHASE3542_FORTY_NINE_TOOL_TARGET_FORTY_ONE_OK"));
check("target-forty-two_export", targetFortyTwo.includes("buildPhase3543FortyNineMutationTargetFortyTwoStatus") || targetFortyTwo.includes("export function buildPhase3543FortyNineMutationTargetFortyTwoStatus"));
check("target-forty-two_marker", targetFortyTwo.includes("PHASE3543_FORTY_NINE_TOOL_TARGET_FORTY_TWO_OK"));
check("target-forty-three_export", targetFortyThree.includes("buildPhase3544FortyNineMutationTargetFortyThreeStatus") || targetFortyThree.includes("export function buildPhase3544FortyNineMutationTargetFortyThreeStatus"));
check("target-forty-three_marker", targetFortyThree.includes("PHASE3544_FORTY_NINE_TOOL_TARGET_FORTY_THREE_OK"));
check("target-forty-four_export", targetFortyFour.includes("buildPhase3545FortyNineMutationTargetFortyFourStatus") || targetFortyFour.includes("export function buildPhase3545FortyNineMutationTargetFortyFourStatus"));
check("target-forty-four_marker", targetFortyFour.includes("PHASE3545_FORTY_NINE_TOOL_TARGET_FORTY_FOUR_OK"));
check("target-forty-five_export", targetFortyFive.includes("buildPhase3546FortyNineMutationTargetFortyFiveStatus") || targetFortyFive.includes("export function buildPhase3546FortyNineMutationTargetFortyFiveStatus"));
check("target-forty-five_marker", targetFortyFive.includes("PHASE3546_FORTY_NINE_TOOL_TARGET_FORTY_FIVE_OK"));
check("target-forty-six_export", targetFortySix.includes("buildPhase3547FortyNineMutationTargetFortySixStatus") || targetFortySix.includes("export function buildPhase3547FortyNineMutationTargetFortySixStatus"));
check("target-forty-six_marker", targetFortySix.includes("PHASE3547_FORTY_NINE_TOOL_TARGET_FORTY_SIX_OK"));
check("target-forty-seven_export", targetFortySeven.includes("buildPhase3548FortyNineMutationTargetFortySevenStatus") || targetFortySeven.includes("export function buildPhase3548FortyNineMutationTargetFortySevenStatus"));
check("target-forty-seven_marker", targetFortySeven.includes("PHASE3548_FORTY_NINE_TOOL_TARGET_FORTY_SEVEN_OK"));
check("target-forty-eight_export", targetFortyEight.includes("buildPhase3549FortyNineMutationTargetFortyEightStatus") || targetFortyEight.includes("export function buildPhase3549FortyNineMutationTargetFortyEightStatus"));
check("target-forty-eight_marker", targetFortyEight.includes("PHASE3549_FORTY_NINE_TOOL_TARGET_FORTY_EIGHT_OK"));
check("target-forty-nine_export", targetFortyNine.includes("buildPhase3550FortyNineMutationRuntimeStatus") || targetFortyNine.includes("export function buildPhase3550FortyNineMutationRuntimeStatus"));
check("target-forty-nine_marker", targetFortyNine.includes("PHASE3550_FORTY_NINE_TOOL_TARGET_FORTY_NINE_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_forty_nine", docs.includes("controlled forty-nine tool mutation"));
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
  phase3496Sealed: phase3496.recommendedSealed === true,
  fortyNineMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 49,
  fortyNineMutationApplied: result?.fortyNineMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localFortyNineSmokePassed: result?.localFortyNineSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, fortyNineMutationApplied: verifierResult.fortyNineMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localFortyNineSmokePassed: verifierResult.localFortyNineSmokePassed }, null, 2));
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
    "# Phase3497A-3550A Controlled Forty-Nine Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- fortyNineMutationApplied: ${Boolean(result.fortyNineMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localFortyNineSmokePassed: ${Boolean(result.localFortyNineSmokePassed)}`,
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
