import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase3392A-3443A-Controlled-Forty-Seven-Tool-Mutation";
const runnerPath = "tools/phase3392_3443/apply-controlled-forty-seven-tool-mutation.mjs";
const smokeRunnerPath = "tools/phase3392_3443/smoke-controlled-forty-seven-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase3392-3443-controlled-forty-seven-tool-mutation.md";
const approvalPath = "docs/phase3392-3443-controlled-forty-seven-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase3397-forty-seven-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase3398-forty-seven-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase3399-forty-seven-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase3400-forty-seven-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase3401-forty-seven-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase3402-forty-seven-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase3403-forty-seven-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase3404-forty-seven-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase3405-forty-seven-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase3406-forty-seven-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase3407-forty-seven-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase3408-forty-seven-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase3409-forty-seven-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase3410-forty-seven-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase3411-forty-seven-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase3412-forty-seven-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase3413-forty-seven-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase3414-forty-seven-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase3415-forty-seven-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase3416-forty-seven-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase3417-forty-seven-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase3418-forty-seven-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase3419-forty-seven-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase3420-forty-seven-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase3421-forty-seven-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase3422-forty-seven-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase3423-forty-seven-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase3424-forty-seven-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase3425-forty-seven-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase3426-forty-seven-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase3427-forty-seven-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase3428-forty-seven-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase3429-forty-seven-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase3430-forty-seven-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase3431-forty-seven-tool-mutation-target-thirty-five.proposal.diff";
const proposalThirtySixPath = "docs/phase3432-forty-seven-tool-mutation-target-thirty-six.proposal.diff";
const proposalThirtySevenPath = "docs/phase3433-forty-seven-tool-mutation-target-thirty-seven.proposal.diff";
const proposalThirtyEightPath = "docs/phase3434-forty-seven-tool-mutation-target-thirty-eight.proposal.diff";
const proposalThirtyNinePath = "docs/phase3435-forty-seven-tool-mutation-target-thirty-nine.proposal.diff";
const proposalFortyPath = "docs/phase3436-forty-seven-tool-mutation-target-forty.proposal.diff";
const proposalFortyOnePath = "docs/phase3437-forty-seven-tool-mutation-target-forty-one.proposal.diff";
const proposalFortyTwoPath = "docs/phase3438-forty-seven-tool-mutation-target-forty-two.proposal.diff";
const proposalFortyThreePath = "docs/phase3439-forty-seven-tool-mutation-target-forty-three.proposal.diff";
const proposalFortyFourPath = "docs/phase3440-forty-seven-tool-mutation-target-forty-four.proposal.diff";
const proposalFortyFivePath = "docs/phase3441-forty-seven-tool-mutation-target-forty-five.proposal.diff";
const proposalFortySixPath = "docs/phase3442-forty-seven-tool-mutation-target-forty-six.proposal.diff";
const proposalFortySevenPath = "docs/phase3443-forty-seven-tool-mutation-target-forty-seven.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase3392-3443-controlled-forty-seven-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase3392-3443-controlled-forty-seven-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase3392-3443-controlled-forty-seven-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase3392-3443-controlled-forty-seven-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase3392-3443-controlled-forty-seven-tool-mutation/forty-seven-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase3391 = readJson("apps/ai-gateway-service/evidence/phase3341-3391-controlled-forty-six-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase3392-3443-controlled-forty-seven-tool-mutation"] === "node tools/phase3392_3443/apply-controlled-forty-seven-tool-mutation.mjs --plan docs/phase3392-3443-controlled-forty-seven-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase3392-3443-controlled-forty-seven-tool-mutation"] ===
    "node tools/phase3392_3443/smoke-controlled-forty-seven-tool-mutation.mjs",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase3392-3443-controlled-forty-seven-tool-mutation"] === "node tools/phase3392_3443/validate-controlled-forty-seven-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase3391_sealed", phase3391.recommendedSealed === true && phase3391.fortySixMutationApplied === true);
check("result_exists", result !== null, "run apply:phase3392-3443-controlled-forty-seven-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("forty_seven_mutation_applied", result.fortySevenMutationApplied === true);
  check("changed_file_count_forty_seven", result.changedFileCount === 47);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localFortySevenSmokePassed === true);
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
  check("rollback_restore_forty_seven", rollback.rollbackAction === "restore-previous-content-forty-seven");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_forty_seven_entries", Array.isArray(rollback.files) && rollback.files.length === 47);
}

if (smoke) {
  check("smoke_phase3397Marker", smoke.phase3397Marker === "PHASE3397_FORTY_SEVEN_TOOL_TARGET_ONE_OK");
  check("smoke_phase3398Marker", smoke.phase3398Marker === "PHASE3398_FORTY_SEVEN_TOOL_TARGET_TWO_OK");
  check("smoke_phase3399Marker", smoke.phase3399Marker === "PHASE3399_FORTY_SEVEN_TOOL_TARGET_THREE_OK");
  check("smoke_phase3400Marker", smoke.phase3400Marker === "PHASE3400_FORTY_SEVEN_TOOL_TARGET_FOUR_OK");
  check("smoke_phase3401Marker", smoke.phase3401Marker === "PHASE3401_FORTY_SEVEN_TOOL_TARGET_FIVE_OK");
  check("smoke_phase3402Marker", smoke.phase3402Marker === "PHASE3402_FORTY_SEVEN_TOOL_TARGET_SIX_OK");
  check("smoke_phase3403Marker", smoke.phase3403Marker === "PHASE3403_FORTY_SEVEN_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase3404Marker", smoke.phase3404Marker === "PHASE3404_FORTY_SEVEN_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase3405Marker", smoke.phase3405Marker === "PHASE3405_FORTY_SEVEN_TOOL_TARGET_NINE_OK");
  check("smoke_phase3406Marker", smoke.phase3406Marker === "PHASE3406_FORTY_SEVEN_TOOL_TARGET_TEN_OK");
  check("smoke_phase3407Marker", smoke.phase3407Marker === "PHASE3407_FORTY_SEVEN_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase3408Marker", smoke.phase3408Marker === "PHASE3408_FORTY_SEVEN_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase3409Marker", smoke.phase3409Marker === "PHASE3409_FORTY_SEVEN_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase3410Marker", smoke.phase3410Marker === "PHASE3410_FORTY_SEVEN_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase3411Marker", smoke.phase3411Marker === "PHASE3411_FORTY_SEVEN_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase3412Marker", smoke.phase3412Marker === "PHASE3412_FORTY_SEVEN_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase3413Marker", smoke.phase3413Marker === "PHASE3413_FORTY_SEVEN_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase3414Marker", smoke.phase3414Marker === "PHASE3414_FORTY_SEVEN_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase3415Marker", smoke.phase3415Marker === "PHASE3415_FORTY_SEVEN_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase3416Marker", smoke.phase3416Marker === "PHASE3416_FORTY_SEVEN_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase3417Marker", smoke.phase3417Marker === "PHASE3417_FORTY_SEVEN_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase3418Marker", smoke.phase3418Marker === "PHASE3418_FORTY_SEVEN_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase3419Marker", smoke.phase3419Marker === "PHASE3419_FORTY_SEVEN_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase3420Marker", smoke.phase3420Marker === "PHASE3420_FORTY_SEVEN_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase3421Marker", smoke.phase3421Marker === "PHASE3421_FORTY_SEVEN_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase3422Marker", smoke.phase3422Marker === "PHASE3422_FORTY_SEVEN_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase3423Marker", smoke.phase3423Marker === "PHASE3423_FORTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase3424Marker", smoke.phase3424Marker === "PHASE3424_FORTY_SEVEN_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase3425Marker", smoke.phase3425Marker === "PHASE3425_FORTY_SEVEN_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase3426Marker", smoke.phase3426Marker === "PHASE3426_FORTY_SEVEN_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase3427Marker", smoke.phase3427Marker === "PHASE3427_FORTY_SEVEN_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase3428Marker", smoke.phase3428Marker === "PHASE3428_FORTY_SEVEN_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase3429Marker", smoke.phase3429Marker === "PHASE3429_FORTY_SEVEN_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase3430Marker", smoke.phase3430Marker === "PHASE3430_FORTY_SEVEN_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase3431Marker", smoke.phase3431Marker === "PHASE3431_FORTY_SEVEN_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_phase3432Marker", smoke.phase3432Marker === "PHASE3432_FORTY_SEVEN_TOOL_TARGET_THIRTY_SIX_OK");
  check("smoke_phase3433Marker", smoke.phase3433Marker === "PHASE3433_FORTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK");
  check("smoke_phase3434Marker", smoke.phase3434Marker === "PHASE3434_FORTY_SEVEN_TOOL_TARGET_THIRTY_EIGHT_OK");
  check("smoke_phase3435Marker", smoke.phase3435Marker === "PHASE3435_FORTY_SEVEN_TOOL_TARGET_THIRTY_NINE_OK");
  check("smoke_phase3436Marker", smoke.phase3436Marker === "PHASE3436_FORTY_SEVEN_TOOL_TARGET_FORTY_OK");
  check("smoke_phase3437Marker", smoke.phase3437Marker === "PHASE3437_FORTY_SEVEN_TOOL_TARGET_FORTY_ONE_OK");
  check("smoke_phase3438Marker", smoke.phase3438Marker === "PHASE3438_FORTY_SEVEN_TOOL_TARGET_FORTY_TWO_OK");
  check("smoke_phase3439Marker", smoke.phase3439Marker === "PHASE3439_FORTY_SEVEN_TOOL_TARGET_FORTY_THREE_OK");
  check("smoke_phase3440Marker", smoke.phase3440Marker === "PHASE3440_FORTY_SEVEN_TOOL_TARGET_FORTY_FOUR_OK");
  check("smoke_phase3441Marker", smoke.phase3441Marker === "PHASE3441_FORTY_SEVEN_TOOL_TARGET_FORTY_FIVE_OK");
  check("smoke_phase3442Marker", smoke.phase3442Marker === "PHASE3442_FORTY_SEVEN_TOOL_TARGET_FORTY_SIX_OK");
  check("smoke_phase3443Marker", smoke.phase3443Marker === "PHASE3443_FORTY_SEVEN_TOOL_TARGET_FORTY_SEVEN_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase3397FortySevenMutationTargetOneStatus") || targetOne.includes("export function buildPhase3397FortySevenMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE3397_FORTY_SEVEN_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase3398FortySevenMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase3398FortySevenMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE3398_FORTY_SEVEN_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase3399FortySevenMutationTargetThreeStatus") || targetThree.includes("export function buildPhase3399FortySevenMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE3399_FORTY_SEVEN_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase3400FortySevenMutationTargetFourStatus") || targetFour.includes("export function buildPhase3400FortySevenMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE3400_FORTY_SEVEN_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase3401FortySevenMutationTargetFiveStatus") || targetFive.includes("export function buildPhase3401FortySevenMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE3401_FORTY_SEVEN_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase3402FortySevenMutationTargetSixStatus") || targetSix.includes("export function buildPhase3402FortySevenMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE3402_FORTY_SEVEN_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase3403FortySevenMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase3403FortySevenMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE3403_FORTY_SEVEN_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase3404FortySevenMutationTargetEightStatus") || targetEight.includes("export function buildPhase3404FortySevenMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE3404_FORTY_SEVEN_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase3405FortySevenMutationTargetNineStatus") || targetNine.includes("export function buildPhase3405FortySevenMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE3405_FORTY_SEVEN_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase3406FortySevenMutationTargetTenStatus") || targetTen.includes("export function buildPhase3406FortySevenMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE3406_FORTY_SEVEN_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase3407FortySevenMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase3407FortySevenMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE3407_FORTY_SEVEN_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase3408FortySevenMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase3408FortySevenMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE3408_FORTY_SEVEN_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase3409FortySevenMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase3409FortySevenMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE3409_FORTY_SEVEN_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase3410FortySevenMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase3410FortySevenMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE3410_FORTY_SEVEN_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase3411FortySevenMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase3411FortySevenMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE3411_FORTY_SEVEN_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase3412FortySevenMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase3412FortySevenMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE3412_FORTY_SEVEN_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase3413FortySevenMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase3413FortySevenMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE3413_FORTY_SEVEN_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase3414FortySevenMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase3414FortySevenMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE3414_FORTY_SEVEN_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase3415FortySevenMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase3415FortySevenMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE3415_FORTY_SEVEN_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase3416FortySevenMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase3416FortySevenMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE3416_FORTY_SEVEN_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase3417FortySevenMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase3417FortySevenMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE3417_FORTY_SEVEN_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase3418FortySevenMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase3418FortySevenMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE3418_FORTY_SEVEN_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase3419FortySevenMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase3419FortySevenMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE3419_FORTY_SEVEN_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase3420FortySevenMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase3420FortySevenMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE3420_FORTY_SEVEN_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase3421FortySevenMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase3421FortySevenMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE3421_FORTY_SEVEN_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase3422FortySevenMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase3422FortySevenMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE3422_FORTY_SEVEN_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase3423FortySevenMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase3423FortySevenMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE3423_FORTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase3424FortySevenMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase3424FortySevenMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE3424_FORTY_SEVEN_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase3425FortySevenMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase3425FortySevenMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE3425_FORTY_SEVEN_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase3426FortySevenMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase3426FortySevenMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE3426_FORTY_SEVEN_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase3427FortySevenMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase3427FortySevenMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE3427_FORTY_SEVEN_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase3428FortySevenMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase3428FortySevenMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE3428_FORTY_SEVEN_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase3429FortySevenMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase3429FortySevenMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE3429_FORTY_SEVEN_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase3430FortySevenMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase3430FortySevenMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE3430_FORTY_SEVEN_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase3431FortySevenMutationTargetThirtyFiveStatus") || targetThirtyFive.includes("export function buildPhase3431FortySevenMutationTargetThirtyFiveStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE3431_FORTY_SEVEN_TOOL_TARGET_THIRTY_FIVE_OK"));
check("target-thirty-six_export", targetThirtySix.includes("buildPhase3432FortySevenMutationTargetThirtySixStatus") || targetThirtySix.includes("export function buildPhase3432FortySevenMutationTargetThirtySixStatus"));
check("target-thirty-six_marker", targetThirtySix.includes("PHASE3432_FORTY_SEVEN_TOOL_TARGET_THIRTY_SIX_OK"));
check("target-thirty-seven_export", targetThirtySeven.includes("buildPhase3433FortySevenMutationTargetThirtySevenStatus") || targetThirtySeven.includes("export function buildPhase3433FortySevenMutationTargetThirtySevenStatus"));
check("target-thirty-seven_marker", targetThirtySeven.includes("PHASE3433_FORTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK"));
check("target-thirty-eight_export", targetThirtyEight.includes("buildPhase3434FortySevenMutationTargetThirtyEightStatus") || targetThirtyEight.includes("export function buildPhase3434FortySevenMutationTargetThirtyEightStatus"));
check("target-thirty-eight_marker", targetThirtyEight.includes("PHASE3434_FORTY_SEVEN_TOOL_TARGET_THIRTY_EIGHT_OK"));
check("target-thirty-nine_export", targetThirtyNine.includes("buildPhase3435FortySevenMutationTargetThirtyNineStatus") || targetThirtyNine.includes("export function buildPhase3435FortySevenMutationTargetThirtyNineStatus"));
check("target-thirty-nine_marker", targetThirtyNine.includes("PHASE3435_FORTY_SEVEN_TOOL_TARGET_THIRTY_NINE_OK"));
check("target-forty_export", targetForty.includes("buildPhase3436FortySevenMutationTargetFortyStatus") || targetForty.includes("export function buildPhase3436FortySevenMutationTargetFortyStatus"));
check("target-forty_marker", targetForty.includes("PHASE3436_FORTY_SEVEN_TOOL_TARGET_FORTY_OK"));
check("target-forty-one_export", targetFortyOne.includes("buildPhase3437FortySevenMutationTargetFortyOneStatus") || targetFortyOne.includes("export function buildPhase3437FortySevenMutationTargetFortyOneStatus"));
check("target-forty-one_marker", targetFortyOne.includes("PHASE3437_FORTY_SEVEN_TOOL_TARGET_FORTY_ONE_OK"));
check("target-forty-two_export", targetFortyTwo.includes("buildPhase3438FortySevenMutationTargetFortyTwoStatus") || targetFortyTwo.includes("export function buildPhase3438FortySevenMutationTargetFortyTwoStatus"));
check("target-forty-two_marker", targetFortyTwo.includes("PHASE3438_FORTY_SEVEN_TOOL_TARGET_FORTY_TWO_OK"));
check("target-forty-three_export", targetFortyThree.includes("buildPhase3439FortySevenMutationTargetFortyThreeStatus") || targetFortyThree.includes("export function buildPhase3439FortySevenMutationTargetFortyThreeStatus"));
check("target-forty-three_marker", targetFortyThree.includes("PHASE3439_FORTY_SEVEN_TOOL_TARGET_FORTY_THREE_OK"));
check("target-forty-four_export", targetFortyFour.includes("buildPhase3440FortySevenMutationTargetFortyFourStatus") || targetFortyFour.includes("export function buildPhase3440FortySevenMutationTargetFortyFourStatus"));
check("target-forty-four_marker", targetFortyFour.includes("PHASE3440_FORTY_SEVEN_TOOL_TARGET_FORTY_FOUR_OK"));
check("target-forty-five_export", targetFortyFive.includes("buildPhase3441FortySevenMutationTargetFortyFiveStatus") || targetFortyFive.includes("export function buildPhase3441FortySevenMutationTargetFortyFiveStatus"));
check("target-forty-five_marker", targetFortyFive.includes("PHASE3441_FORTY_SEVEN_TOOL_TARGET_FORTY_FIVE_OK"));
check("target-forty-six_export", targetFortySix.includes("buildPhase3442FortySevenMutationTargetFortySixStatus") || targetFortySix.includes("export function buildPhase3442FortySevenMutationTargetFortySixStatus"));
check("target-forty-six_marker", targetFortySix.includes("PHASE3442_FORTY_SEVEN_TOOL_TARGET_FORTY_SIX_OK"));
check("target-forty-seven_export", targetFortySeven.includes("buildPhase3443FortySevenMutationRuntimeStatus") || targetFortySeven.includes("export function buildPhase3443FortySevenMutationRuntimeStatus"));
check("target-forty-seven_marker", targetFortySeven.includes("PHASE3443_FORTY_SEVEN_TOOL_TARGET_FORTY_SEVEN_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_forty_seven", docs.includes("controlled forty-seven tool mutation"));
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
  phase3391Sealed: phase3391.recommendedSealed === true,
  fortySevenMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 47,
  fortySevenMutationApplied: result?.fortySevenMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localFortySevenSmokePassed: result?.localFortySevenSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, fortySevenMutationApplied: verifierResult.fortySevenMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localFortySevenSmokePassed: verifierResult.localFortySevenSmokePassed }, null, 2));
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
    "# Phase3392A-3443A Controlled Forty-Seven Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- fortySevenMutationApplied: ${Boolean(result.fortySevenMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localFortySevenSmokePassed: ${Boolean(result.localFortySevenSmokePassed)}`,
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
