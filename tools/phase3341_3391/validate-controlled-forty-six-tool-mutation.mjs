import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase3341A-3391A-Controlled-Forty-Six-Tool-Mutation";
const runnerPath = "tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs";
const smokeRunnerPath = "tools/phase3341_3391/smoke-controlled-forty-six-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase3341-3391-controlled-forty-six-tool-mutation.md";
const approvalPath = "docs/phase3341-3391-controlled-forty-six-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase3346-forty-six-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase3347-forty-six-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase3348-forty-six-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase3349-forty-six-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase3350-forty-six-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase3351-forty-six-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase3352-forty-six-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase3353-forty-six-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase3354-forty-six-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase3355-forty-six-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase3356-forty-six-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase3357-forty-six-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase3358-forty-six-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase3359-forty-six-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase3360-forty-six-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase3361-forty-six-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase3362-forty-six-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase3363-forty-six-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase3364-forty-six-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase3365-forty-six-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase3366-forty-six-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase3367-forty-six-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase3368-forty-six-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase3369-forty-six-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase3370-forty-six-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase3371-forty-six-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase3372-forty-six-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase3373-forty-six-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase3374-forty-six-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase3375-forty-six-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase3376-forty-six-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase3377-forty-six-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase3378-forty-six-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase3379-forty-six-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase3380-forty-six-tool-mutation-target-thirty-five.proposal.diff";
const proposalThirtySixPath = "docs/phase3381-forty-six-tool-mutation-target-thirty-six.proposal.diff";
const proposalThirtySevenPath = "docs/phase3382-forty-six-tool-mutation-target-thirty-seven.proposal.diff";
const proposalThirtyEightPath = "docs/phase3383-forty-six-tool-mutation-target-thirty-eight.proposal.diff";
const proposalThirtyNinePath = "docs/phase3384-forty-six-tool-mutation-target-thirty-nine.proposal.diff";
const proposalFortyPath = "docs/phase3385-forty-six-tool-mutation-target-forty.proposal.diff";
const proposalFortyOnePath = "docs/phase3386-forty-six-tool-mutation-target-forty-one.proposal.diff";
const proposalFortyTwoPath = "docs/phase3387-forty-six-tool-mutation-target-forty-two.proposal.diff";
const proposalFortyThreePath = "docs/phase3388-forty-six-tool-mutation-target-forty-three.proposal.diff";
const proposalFortyFourPath = "docs/phase3389-forty-six-tool-mutation-target-forty-four.proposal.diff";
const proposalFortyFivePath = "docs/phase3390-forty-six-tool-mutation-target-forty-five.proposal.diff";
const proposalFortySixPath = "docs/phase3391-forty-six-tool-mutation-target-forty-six.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase3341-3391-controlled-forty-six-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase3341-3391-controlled-forty-six-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase3341-3391-controlled-forty-six-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase3341-3391-controlled-forty-six-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase3341-3391-controlled-forty-six-tool-mutation/forty-six-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase3340 = readJson("apps/ai-gateway-service/evidence/phase3291-3340-controlled-forty-five-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase3341-3391-controlled-forty-six-tool-mutation"] === "node tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs --plan docs/phase3341-3391-controlled-forty-six-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase3341-3391-controlled-forty-six-tool-mutation"] ===
    "node tools/phase3341_3391/smoke-controlled-forty-six-tool-mutation.mjs",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase3341-3391-controlled-forty-six-tool-mutation"] === "node tools/phase3341_3391/validate-controlled-forty-six-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase3340_sealed", phase3340.recommendedSealed === true && phase3340.fortyFiveMutationApplied === true);
check("result_exists", result !== null, "run apply:phase3341-3391-controlled-forty-six-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("forty_six_mutation_applied", result.fortySixMutationApplied === true);
  check("changed_file_count_forty_six", result.changedFileCount === 46);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localFortySixSmokePassed === true);
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
  check("rollback_restore_forty_six", rollback.rollbackAction === "restore-previous-content-forty-six");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_forty_six_entries", Array.isArray(rollback.files) && rollback.files.length === 46);
}

if (smoke) {
  check("smoke_phase3346Marker", smoke.phase3346Marker === "PHASE3346_FORTY_SIX_TOOL_TARGET_ONE_OK");
  check("smoke_phase3347Marker", smoke.phase3347Marker === "PHASE3347_FORTY_SIX_TOOL_TARGET_TWO_OK");
  check("smoke_phase3348Marker", smoke.phase3348Marker === "PHASE3348_FORTY_SIX_TOOL_TARGET_THREE_OK");
  check("smoke_phase3349Marker", smoke.phase3349Marker === "PHASE3349_FORTY_SIX_TOOL_TARGET_FOUR_OK");
  check("smoke_phase3350Marker", smoke.phase3350Marker === "PHASE3350_FORTY_SIX_TOOL_TARGET_FIVE_OK");
  check("smoke_phase3351Marker", smoke.phase3351Marker === "PHASE3351_FORTY_SIX_TOOL_TARGET_SIX_OK");
  check("smoke_phase3352Marker", smoke.phase3352Marker === "PHASE3352_FORTY_SIX_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase3353Marker", smoke.phase3353Marker === "PHASE3353_FORTY_SIX_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase3354Marker", smoke.phase3354Marker === "PHASE3354_FORTY_SIX_TOOL_TARGET_NINE_OK");
  check("smoke_phase3355Marker", smoke.phase3355Marker === "PHASE3355_FORTY_SIX_TOOL_TARGET_TEN_OK");
  check("smoke_phase3356Marker", smoke.phase3356Marker === "PHASE3356_FORTY_SIX_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase3357Marker", smoke.phase3357Marker === "PHASE3357_FORTY_SIX_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase3358Marker", smoke.phase3358Marker === "PHASE3358_FORTY_SIX_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase3359Marker", smoke.phase3359Marker === "PHASE3359_FORTY_SIX_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase3360Marker", smoke.phase3360Marker === "PHASE3360_FORTY_SIX_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase3361Marker", smoke.phase3361Marker === "PHASE3361_FORTY_SIX_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase3362Marker", smoke.phase3362Marker === "PHASE3362_FORTY_SIX_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase3363Marker", smoke.phase3363Marker === "PHASE3363_FORTY_SIX_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase3364Marker", smoke.phase3364Marker === "PHASE3364_FORTY_SIX_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase3365Marker", smoke.phase3365Marker === "PHASE3365_FORTY_SIX_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase3366Marker", smoke.phase3366Marker === "PHASE3366_FORTY_SIX_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase3367Marker", smoke.phase3367Marker === "PHASE3367_FORTY_SIX_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase3368Marker", smoke.phase3368Marker === "PHASE3368_FORTY_SIX_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase3369Marker", smoke.phase3369Marker === "PHASE3369_FORTY_SIX_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase3370Marker", smoke.phase3370Marker === "PHASE3370_FORTY_SIX_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase3371Marker", smoke.phase3371Marker === "PHASE3371_FORTY_SIX_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase3372Marker", smoke.phase3372Marker === "PHASE3372_FORTY_SIX_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase3373Marker", smoke.phase3373Marker === "PHASE3373_FORTY_SIX_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase3374Marker", smoke.phase3374Marker === "PHASE3374_FORTY_SIX_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase3375Marker", smoke.phase3375Marker === "PHASE3375_FORTY_SIX_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase3376Marker", smoke.phase3376Marker === "PHASE3376_FORTY_SIX_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase3377Marker", smoke.phase3377Marker === "PHASE3377_FORTY_SIX_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase3378Marker", smoke.phase3378Marker === "PHASE3378_FORTY_SIX_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase3379Marker", smoke.phase3379Marker === "PHASE3379_FORTY_SIX_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase3380Marker", smoke.phase3380Marker === "PHASE3380_FORTY_SIX_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_phase3381Marker", smoke.phase3381Marker === "PHASE3381_FORTY_SIX_TOOL_TARGET_THIRTY_SIX_OK");
  check("smoke_phase3382Marker", smoke.phase3382Marker === "PHASE3382_FORTY_SIX_TOOL_TARGET_THIRTY_SEVEN_OK");
  check("smoke_phase3383Marker", smoke.phase3383Marker === "PHASE3383_FORTY_SIX_TOOL_TARGET_THIRTY_EIGHT_OK");
  check("smoke_phase3384Marker", smoke.phase3384Marker === "PHASE3384_FORTY_SIX_TOOL_TARGET_THIRTY_NINE_OK");
  check("smoke_phase3385Marker", smoke.phase3385Marker === "PHASE3385_FORTY_SIX_TOOL_TARGET_FORTY_OK");
  check("smoke_phase3386Marker", smoke.phase3386Marker === "PHASE3386_FORTY_SIX_TOOL_TARGET_FORTY_ONE_OK");
  check("smoke_phase3387Marker", smoke.phase3387Marker === "PHASE3387_FORTY_SIX_TOOL_TARGET_FORTY_TWO_OK");
  check("smoke_phase3388Marker", smoke.phase3388Marker === "PHASE3388_FORTY_SIX_TOOL_TARGET_FORTY_THREE_OK");
  check("smoke_phase3389Marker", smoke.phase3389Marker === "PHASE3389_FORTY_SIX_TOOL_TARGET_FORTY_FOUR_OK");
  check("smoke_phase3390Marker", smoke.phase3390Marker === "PHASE3390_FORTY_SIX_TOOL_TARGET_FORTY_FIVE_OK");
  check("smoke_phase3391Marker", smoke.phase3391Marker === "PHASE3391_FORTY_SIX_TOOL_TARGET_FORTY_SIX_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase3346FortySixMutationTargetOneStatus") || targetOne.includes("export function buildPhase3346FortySixMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE3346_FORTY_SIX_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase3347FortySixMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase3347FortySixMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE3347_FORTY_SIX_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase3348FortySixMutationTargetThreeStatus") || targetThree.includes("export function buildPhase3348FortySixMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE3348_FORTY_SIX_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase3349FortySixMutationTargetFourStatus") || targetFour.includes("export function buildPhase3349FortySixMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE3349_FORTY_SIX_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase3350FortySixMutationTargetFiveStatus") || targetFive.includes("export function buildPhase3350FortySixMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE3350_FORTY_SIX_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase3351FortySixMutationTargetSixStatus") || targetSix.includes("export function buildPhase3351FortySixMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE3351_FORTY_SIX_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase3352FortySixMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase3352FortySixMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE3352_FORTY_SIX_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase3353FortySixMutationTargetEightStatus") || targetEight.includes("export function buildPhase3353FortySixMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE3353_FORTY_SIX_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase3354FortySixMutationTargetNineStatus") || targetNine.includes("export function buildPhase3354FortySixMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE3354_FORTY_SIX_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase3355FortySixMutationTargetTenStatus") || targetTen.includes("export function buildPhase3355FortySixMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE3355_FORTY_SIX_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase3356FortySixMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase3356FortySixMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE3356_FORTY_SIX_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase3357FortySixMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase3357FortySixMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE3357_FORTY_SIX_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase3358FortySixMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase3358FortySixMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE3358_FORTY_SIX_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase3359FortySixMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase3359FortySixMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE3359_FORTY_SIX_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase3360FortySixMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase3360FortySixMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE3360_FORTY_SIX_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase3361FortySixMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase3361FortySixMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE3361_FORTY_SIX_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase3362FortySixMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase3362FortySixMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE3362_FORTY_SIX_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase3363FortySixMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase3363FortySixMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE3363_FORTY_SIX_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase3364FortySixMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase3364FortySixMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE3364_FORTY_SIX_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase3365FortySixMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase3365FortySixMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE3365_FORTY_SIX_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase3366FortySixMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase3366FortySixMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE3366_FORTY_SIX_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase3367FortySixMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase3367FortySixMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE3367_FORTY_SIX_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase3368FortySixMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase3368FortySixMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE3368_FORTY_SIX_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase3369FortySixMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase3369FortySixMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE3369_FORTY_SIX_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase3370FortySixMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase3370FortySixMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE3370_FORTY_SIX_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase3371FortySixMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase3371FortySixMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE3371_FORTY_SIX_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase3372FortySixMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase3372FortySixMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE3372_FORTY_SIX_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase3373FortySixMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase3373FortySixMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE3373_FORTY_SIX_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase3374FortySixMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase3374FortySixMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE3374_FORTY_SIX_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase3375FortySixMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase3375FortySixMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE3375_FORTY_SIX_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase3376FortySixMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase3376FortySixMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE3376_FORTY_SIX_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase3377FortySixMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase3377FortySixMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE3377_FORTY_SIX_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase3378FortySixMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase3378FortySixMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE3378_FORTY_SIX_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase3379FortySixMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase3379FortySixMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE3379_FORTY_SIX_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase3380FortySixMutationTargetThirtyFiveStatus") || targetThirtyFive.includes("export function buildPhase3380FortySixMutationTargetThirtyFiveStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE3380_FORTY_SIX_TOOL_TARGET_THIRTY_FIVE_OK"));
check("target-thirty-six_export", targetThirtySix.includes("buildPhase3381FortySixMutationTargetThirtySixStatus") || targetThirtySix.includes("export function buildPhase3381FortySixMutationTargetThirtySixStatus"));
check("target-thirty-six_marker", targetThirtySix.includes("PHASE3381_FORTY_SIX_TOOL_TARGET_THIRTY_SIX_OK"));
check("target-thirty-seven_export", targetThirtySeven.includes("buildPhase3382FortySixMutationTargetThirtySevenStatus") || targetThirtySeven.includes("export function buildPhase3382FortySixMutationTargetThirtySevenStatus"));
check("target-thirty-seven_marker", targetThirtySeven.includes("PHASE3382_FORTY_SIX_TOOL_TARGET_THIRTY_SEVEN_OK"));
check("target-thirty-eight_export", targetThirtyEight.includes("buildPhase3383FortySixMutationTargetThirtyEightStatus") || targetThirtyEight.includes("export function buildPhase3383FortySixMutationTargetThirtyEightStatus"));
check("target-thirty-eight_marker", targetThirtyEight.includes("PHASE3383_FORTY_SIX_TOOL_TARGET_THIRTY_EIGHT_OK"));
check("target-thirty-nine_export", targetThirtyNine.includes("buildPhase3384FortySixMutationTargetThirtyNineStatus") || targetThirtyNine.includes("export function buildPhase3384FortySixMutationTargetThirtyNineStatus"));
check("target-thirty-nine_marker", targetThirtyNine.includes("PHASE3384_FORTY_SIX_TOOL_TARGET_THIRTY_NINE_OK"));
check("target-forty_export", targetForty.includes("buildPhase3385FortySixMutationTargetFortyStatus") || targetForty.includes("export function buildPhase3385FortySixMutationTargetFortyStatus"));
check("target-forty_marker", targetForty.includes("PHASE3385_FORTY_SIX_TOOL_TARGET_FORTY_OK"));
check("target-forty-one_export", targetFortyOne.includes("buildPhase3386FortySixMutationTargetFortyOneStatus") || targetFortyOne.includes("export function buildPhase3386FortySixMutationTargetFortyOneStatus"));
check("target-forty-one_marker", targetFortyOne.includes("PHASE3386_FORTY_SIX_TOOL_TARGET_FORTY_ONE_OK"));
check("target-forty-two_export", targetFortyTwo.includes("buildPhase3387FortySixMutationTargetFortyTwoStatus") || targetFortyTwo.includes("export function buildPhase3387FortySixMutationTargetFortyTwoStatus"));
check("target-forty-two_marker", targetFortyTwo.includes("PHASE3387_FORTY_SIX_TOOL_TARGET_FORTY_TWO_OK"));
check("target-forty-three_export", targetFortyThree.includes("buildPhase3388FortySixMutationTargetFortyThreeStatus") || targetFortyThree.includes("export function buildPhase3388FortySixMutationTargetFortyThreeStatus"));
check("target-forty-three_marker", targetFortyThree.includes("PHASE3388_FORTY_SIX_TOOL_TARGET_FORTY_THREE_OK"));
check("target-forty-four_export", targetFortyFour.includes("buildPhase3389FortySixMutationTargetFortyFourStatus") || targetFortyFour.includes("export function buildPhase3389FortySixMutationTargetFortyFourStatus"));
check("target-forty-four_marker", targetFortyFour.includes("PHASE3389_FORTY_SIX_TOOL_TARGET_FORTY_FOUR_OK"));
check("target-forty-five_export", targetFortyFive.includes("buildPhase3390FortySixMutationTargetFortyFiveStatus") || targetFortyFive.includes("export function buildPhase3390FortySixMutationTargetFortyFiveStatus"));
check("target-forty-five_marker", targetFortyFive.includes("PHASE3390_FORTY_SIX_TOOL_TARGET_FORTY_FIVE_OK"));
check("target-forty-six_export", targetFortySix.includes("buildPhase3391FortySixMutationRuntimeStatus") || targetFortySix.includes("export function buildPhase3391FortySixMutationRuntimeStatus"));
check("target-forty-six_marker", targetFortySix.includes("PHASE3391_FORTY_SIX_TOOL_TARGET_FORTY_SIX_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_forty_six", docs.includes("controlled forty-six tool mutation"));
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
  phase3340Sealed: phase3340.recommendedSealed === true,
  fortySixMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 46,
  fortySixMutationApplied: result?.fortySixMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localFortySixSmokePassed: result?.localFortySixSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, fortySixMutationApplied: verifierResult.fortySixMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localFortySixSmokePassed: verifierResult.localFortySixSmokePassed }, null, 2));
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
    "# Phase3341A-3391A Controlled Forty-Six Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- fortySixMutationApplied: ${Boolean(result.fortySixMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localFortySixSmokePassed: ${Boolean(result.localFortySixSmokePassed)}`,
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
