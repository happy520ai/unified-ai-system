import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase3444A-3496A-Controlled-Forty-Eight-Tool-Mutation";
const runnerPath = "tools/phase3444_3496/apply-controlled-forty-eight-tool-mutation.mjs";
const smokeRunnerPath = "tools/phase3444_3496/smoke-controlled-forty-eight-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase3444-3496-controlled-forty-eight-tool-mutation.md";
const approvalPath = "docs/phase3444-3496-controlled-forty-eight-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase3449-forty-eight-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase3450-forty-eight-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase3451-forty-eight-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase3452-forty-eight-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase3453-forty-eight-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase3454-forty-eight-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase3455-forty-eight-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase3456-forty-eight-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase3457-forty-eight-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase3458-forty-eight-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase3459-forty-eight-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase3460-forty-eight-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase3461-forty-eight-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase3462-forty-eight-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase3463-forty-eight-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase3464-forty-eight-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase3465-forty-eight-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase3466-forty-eight-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase3467-forty-eight-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase3468-forty-eight-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase3469-forty-eight-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase3470-forty-eight-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase3471-forty-eight-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase3472-forty-eight-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase3473-forty-eight-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase3474-forty-eight-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase3475-forty-eight-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase3476-forty-eight-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase3477-forty-eight-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase3478-forty-eight-tool-mutation-target-thirty.proposal.diff";
const proposalThirtyOnePath = "docs/phase3479-forty-eight-tool-mutation-target-thirty-one.proposal.diff";
const proposalThirtyTwoPath = "docs/phase3480-forty-eight-tool-mutation-target-thirty-two.proposal.diff";
const proposalThirtyThreePath = "docs/phase3481-forty-eight-tool-mutation-target-thirty-three.proposal.diff";
const proposalThirtyFourPath = "docs/phase3482-forty-eight-tool-mutation-target-thirty-four.proposal.diff";
const proposalThirtyFivePath = "docs/phase3483-forty-eight-tool-mutation-target-thirty-five.proposal.diff";
const proposalThirtySixPath = "docs/phase3484-forty-eight-tool-mutation-target-thirty-six.proposal.diff";
const proposalThirtySevenPath = "docs/phase3485-forty-eight-tool-mutation-target-thirty-seven.proposal.diff";
const proposalThirtyEightPath = "docs/phase3486-forty-eight-tool-mutation-target-thirty-eight.proposal.diff";
const proposalThirtyNinePath = "docs/phase3487-forty-eight-tool-mutation-target-thirty-nine.proposal.diff";
const proposalFortyPath = "docs/phase3488-forty-eight-tool-mutation-target-forty.proposal.diff";
const proposalFortyOnePath = "docs/phase3489-forty-eight-tool-mutation-target-forty-one.proposal.diff";
const proposalFortyTwoPath = "docs/phase3490-forty-eight-tool-mutation-target-forty-two.proposal.diff";
const proposalFortyThreePath = "docs/phase3491-forty-eight-tool-mutation-target-forty-three.proposal.diff";
const proposalFortyFourPath = "docs/phase3492-forty-eight-tool-mutation-target-forty-four.proposal.diff";
const proposalFortyFivePath = "docs/phase3493-forty-eight-tool-mutation-target-forty-five.proposal.diff";
const proposalFortySixPath = "docs/phase3494-forty-eight-tool-mutation-target-forty-six.proposal.diff";
const proposalFortySevenPath = "docs/phase3495-forty-eight-tool-mutation-target-forty-seven.proposal.diff";
const proposalFortyEightPath = "docs/phase3496-forty-eight-tool-mutation-target-forty-eight.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase3444-3496-controlled-forty-eight-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase3444-3496-controlled-forty-eight-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase3444-3496-controlled-forty-eight-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase3444-3496-controlled-forty-eight-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase3444-3496-controlled-forty-eight-tool-mutation/forty-eight-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase3443 = readJson("apps/ai-gateway-service/evidence/phase3392-3443-controlled-forty-seven-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase3444-3496-controlled-forty-eight-tool-mutation"] === "node tools/phase3444_3496/apply-controlled-forty-eight-tool-mutation.mjs --plan docs/phase3444-3496-controlled-forty-eight-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase3444-3496-controlled-forty-eight-tool-mutation"] ===
    "node tools/phase3444_3496/smoke-controlled-forty-eight-tool-mutation.mjs",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase3444-3496-controlled-forty-eight-tool-mutation"] === "node tools/phase3444_3496/validate-controlled-forty-eight-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase3443_sealed", phase3443.recommendedSealed === true && phase3443.fortySevenMutationApplied === true);
check("result_exists", result !== null, "run apply:phase3444-3496-controlled-forty-eight-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("forty_eight_mutation_applied", result.fortyEightMutationApplied === true);
  check("changed_file_count_forty_eight", result.changedFileCount === 48);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localFortyEightSmokePassed === true);
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
  check("rollback_restore_forty_eight", rollback.rollbackAction === "restore-previous-content-forty-eight");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_forty_eight_entries", Array.isArray(rollback.files) && rollback.files.length === 48);
}

if (smoke) {
  check("smoke_phase3449Marker", smoke.phase3449Marker === "PHASE3449_FORTY_EIGHT_TOOL_TARGET_ONE_OK");
  check("smoke_phase3450Marker", smoke.phase3450Marker === "PHASE3450_FORTY_EIGHT_TOOL_TARGET_TWO_OK");
  check("smoke_phase3451Marker", smoke.phase3451Marker === "PHASE3451_FORTY_EIGHT_TOOL_TARGET_THREE_OK");
  check("smoke_phase3452Marker", smoke.phase3452Marker === "PHASE3452_FORTY_EIGHT_TOOL_TARGET_FOUR_OK");
  check("smoke_phase3453Marker", smoke.phase3453Marker === "PHASE3453_FORTY_EIGHT_TOOL_TARGET_FIVE_OK");
  check("smoke_phase3454Marker", smoke.phase3454Marker === "PHASE3454_FORTY_EIGHT_TOOL_TARGET_SIX_OK");
  check("smoke_phase3455Marker", smoke.phase3455Marker === "PHASE3455_FORTY_EIGHT_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase3456Marker", smoke.phase3456Marker === "PHASE3456_FORTY_EIGHT_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase3457Marker", smoke.phase3457Marker === "PHASE3457_FORTY_EIGHT_TOOL_TARGET_NINE_OK");
  check("smoke_phase3458Marker", smoke.phase3458Marker === "PHASE3458_FORTY_EIGHT_TOOL_TARGET_TEN_OK");
  check("smoke_phase3459Marker", smoke.phase3459Marker === "PHASE3459_FORTY_EIGHT_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase3460Marker", smoke.phase3460Marker === "PHASE3460_FORTY_EIGHT_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase3461Marker", smoke.phase3461Marker === "PHASE3461_FORTY_EIGHT_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase3462Marker", smoke.phase3462Marker === "PHASE3462_FORTY_EIGHT_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase3463Marker", smoke.phase3463Marker === "PHASE3463_FORTY_EIGHT_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase3464Marker", smoke.phase3464Marker === "PHASE3464_FORTY_EIGHT_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase3465Marker", smoke.phase3465Marker === "PHASE3465_FORTY_EIGHT_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase3466Marker", smoke.phase3466Marker === "PHASE3466_FORTY_EIGHT_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase3467Marker", smoke.phase3467Marker === "PHASE3467_FORTY_EIGHT_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase3468Marker", smoke.phase3468Marker === "PHASE3468_FORTY_EIGHT_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase3469Marker", smoke.phase3469Marker === "PHASE3469_FORTY_EIGHT_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase3470Marker", smoke.phase3470Marker === "PHASE3470_FORTY_EIGHT_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase3471Marker", smoke.phase3471Marker === "PHASE3471_FORTY_EIGHT_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase3472Marker", smoke.phase3472Marker === "PHASE3472_FORTY_EIGHT_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase3473Marker", smoke.phase3473Marker === "PHASE3473_FORTY_EIGHT_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase3474Marker", smoke.phase3474Marker === "PHASE3474_FORTY_EIGHT_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase3475Marker", smoke.phase3475Marker === "PHASE3475_FORTY_EIGHT_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase3476Marker", smoke.phase3476Marker === "PHASE3476_FORTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase3477Marker", smoke.phase3477Marker === "PHASE3477_FORTY_EIGHT_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase3478Marker", smoke.phase3478Marker === "PHASE3478_FORTY_EIGHT_TOOL_TARGET_THIRTY_OK");
  check("smoke_phase3479Marker", smoke.phase3479Marker === "PHASE3479_FORTY_EIGHT_TOOL_TARGET_THIRTY_ONE_OK");
  check("smoke_phase3480Marker", smoke.phase3480Marker === "PHASE3480_FORTY_EIGHT_TOOL_TARGET_THIRTY_TWO_OK");
  check("smoke_phase3481Marker", smoke.phase3481Marker === "PHASE3481_FORTY_EIGHT_TOOL_TARGET_THIRTY_THREE_OK");
  check("smoke_phase3482Marker", smoke.phase3482Marker === "PHASE3482_FORTY_EIGHT_TOOL_TARGET_THIRTY_FOUR_OK");
  check("smoke_phase3483Marker", smoke.phase3483Marker === "PHASE3483_FORTY_EIGHT_TOOL_TARGET_THIRTY_FIVE_OK");
  check("smoke_phase3484Marker", smoke.phase3484Marker === "PHASE3484_FORTY_EIGHT_TOOL_TARGET_THIRTY_SIX_OK");
  check("smoke_phase3485Marker", smoke.phase3485Marker === "PHASE3485_FORTY_EIGHT_TOOL_TARGET_THIRTY_SEVEN_OK");
  check("smoke_phase3486Marker", smoke.phase3486Marker === "PHASE3486_FORTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK");
  check("smoke_phase3487Marker", smoke.phase3487Marker === "PHASE3487_FORTY_EIGHT_TOOL_TARGET_THIRTY_NINE_OK");
  check("smoke_phase3488Marker", smoke.phase3488Marker === "PHASE3488_FORTY_EIGHT_TOOL_TARGET_FORTY_OK");
  check("smoke_phase3489Marker", smoke.phase3489Marker === "PHASE3489_FORTY_EIGHT_TOOL_TARGET_FORTY_ONE_OK");
  check("smoke_phase3490Marker", smoke.phase3490Marker === "PHASE3490_FORTY_EIGHT_TOOL_TARGET_FORTY_TWO_OK");
  check("smoke_phase3491Marker", smoke.phase3491Marker === "PHASE3491_FORTY_EIGHT_TOOL_TARGET_FORTY_THREE_OK");
  check("smoke_phase3492Marker", smoke.phase3492Marker === "PHASE3492_FORTY_EIGHT_TOOL_TARGET_FORTY_FOUR_OK");
  check("smoke_phase3493Marker", smoke.phase3493Marker === "PHASE3493_FORTY_EIGHT_TOOL_TARGET_FORTY_FIVE_OK");
  check("smoke_phase3494Marker", smoke.phase3494Marker === "PHASE3494_FORTY_EIGHT_TOOL_TARGET_FORTY_SIX_OK");
  check("smoke_phase3495Marker", smoke.phase3495Marker === "PHASE3495_FORTY_EIGHT_TOOL_TARGET_FORTY_SEVEN_OK");
  check("smoke_phase3496Marker", smoke.phase3496Marker === "PHASE3496_FORTY_EIGHT_TOOL_TARGET_FORTY_EIGHT_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase3449FortyEightMutationTargetOneStatus") || targetOne.includes("export function buildPhase3449FortyEightMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE3449_FORTY_EIGHT_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase3450FortyEightMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase3450FortyEightMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE3450_FORTY_EIGHT_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase3451FortyEightMutationTargetThreeStatus") || targetThree.includes("export function buildPhase3451FortyEightMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE3451_FORTY_EIGHT_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase3452FortyEightMutationTargetFourStatus") || targetFour.includes("export function buildPhase3452FortyEightMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE3452_FORTY_EIGHT_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase3453FortyEightMutationTargetFiveStatus") || targetFive.includes("export function buildPhase3453FortyEightMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE3453_FORTY_EIGHT_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase3454FortyEightMutationTargetSixStatus") || targetSix.includes("export function buildPhase3454FortyEightMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE3454_FORTY_EIGHT_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase3455FortyEightMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase3455FortyEightMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE3455_FORTY_EIGHT_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase3456FortyEightMutationTargetEightStatus") || targetEight.includes("export function buildPhase3456FortyEightMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE3456_FORTY_EIGHT_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase3457FortyEightMutationTargetNineStatus") || targetNine.includes("export function buildPhase3457FortyEightMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE3457_FORTY_EIGHT_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase3458FortyEightMutationTargetTenStatus") || targetTen.includes("export function buildPhase3458FortyEightMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE3458_FORTY_EIGHT_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase3459FortyEightMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase3459FortyEightMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE3459_FORTY_EIGHT_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase3460FortyEightMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase3460FortyEightMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE3460_FORTY_EIGHT_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase3461FortyEightMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase3461FortyEightMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE3461_FORTY_EIGHT_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase3462FortyEightMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase3462FortyEightMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE3462_FORTY_EIGHT_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase3463FortyEightMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase3463FortyEightMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE3463_FORTY_EIGHT_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase3464FortyEightMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase3464FortyEightMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE3464_FORTY_EIGHT_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase3465FortyEightMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase3465FortyEightMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE3465_FORTY_EIGHT_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase3466FortyEightMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase3466FortyEightMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE3466_FORTY_EIGHT_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase3467FortyEightMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase3467FortyEightMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE3467_FORTY_EIGHT_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase3468FortyEightMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase3468FortyEightMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE3468_FORTY_EIGHT_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase3469FortyEightMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase3469FortyEightMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE3469_FORTY_EIGHT_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase3470FortyEightMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase3470FortyEightMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE3470_FORTY_EIGHT_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase3471FortyEightMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase3471FortyEightMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE3471_FORTY_EIGHT_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase3472FortyEightMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase3472FortyEightMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE3472_FORTY_EIGHT_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase3473FortyEightMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase3473FortyEightMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE3473_FORTY_EIGHT_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase3474FortyEightMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase3474FortyEightMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE3474_FORTY_EIGHT_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase3475FortyEightMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase3475FortyEightMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE3475_FORTY_EIGHT_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase3476FortyEightMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase3476FortyEightMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE3476_FORTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase3477FortyEightMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase3477FortyEightMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE3477_FORTY_EIGHT_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase3478FortyEightMutationTargetThirtyStatus") || targetThirty.includes("export function buildPhase3478FortyEightMutationTargetThirtyStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE3478_FORTY_EIGHT_TOOL_TARGET_THIRTY_OK"));
check("target-thirty-one_export", targetThirtyOne.includes("buildPhase3479FortyEightMutationTargetThirtyOneStatus") || targetThirtyOne.includes("export function buildPhase3479FortyEightMutationTargetThirtyOneStatus"));
check("target-thirty-one_marker", targetThirtyOne.includes("PHASE3479_FORTY_EIGHT_TOOL_TARGET_THIRTY_ONE_OK"));
check("target-thirty-two_export", targetThirtyTwo.includes("buildPhase3480FortyEightMutationTargetThirtyTwoStatus") || targetThirtyTwo.includes("export function buildPhase3480FortyEightMutationTargetThirtyTwoStatus"));
check("target-thirty-two_marker", targetThirtyTwo.includes("PHASE3480_FORTY_EIGHT_TOOL_TARGET_THIRTY_TWO_OK"));
check("target-thirty-three_export", targetThirtyThree.includes("buildPhase3481FortyEightMutationTargetThirtyThreeStatus") || targetThirtyThree.includes("export function buildPhase3481FortyEightMutationTargetThirtyThreeStatus"));
check("target-thirty-three_marker", targetThirtyThree.includes("PHASE3481_FORTY_EIGHT_TOOL_TARGET_THIRTY_THREE_OK"));
check("target-thirty-four_export", targetThirtyFour.includes("buildPhase3482FortyEightMutationTargetThirtyFourStatus") || targetThirtyFour.includes("export function buildPhase3482FortyEightMutationTargetThirtyFourStatus"));
check("target-thirty-four_marker", targetThirtyFour.includes("PHASE3482_FORTY_EIGHT_TOOL_TARGET_THIRTY_FOUR_OK"));
check("target-thirty-five_export", targetThirtyFive.includes("buildPhase3483FortyEightMutationTargetThirtyFiveStatus") || targetThirtyFive.includes("export function buildPhase3483FortyEightMutationTargetThirtyFiveStatus"));
check("target-thirty-five_marker", targetThirtyFive.includes("PHASE3483_FORTY_EIGHT_TOOL_TARGET_THIRTY_FIVE_OK"));
check("target-thirty-six_export", targetThirtySix.includes("buildPhase3484FortyEightMutationTargetThirtySixStatus") || targetThirtySix.includes("export function buildPhase3484FortyEightMutationTargetThirtySixStatus"));
check("target-thirty-six_marker", targetThirtySix.includes("PHASE3484_FORTY_EIGHT_TOOL_TARGET_THIRTY_SIX_OK"));
check("target-thirty-seven_export", targetThirtySeven.includes("buildPhase3485FortyEightMutationTargetThirtySevenStatus") || targetThirtySeven.includes("export function buildPhase3485FortyEightMutationTargetThirtySevenStatus"));
check("target-thirty-seven_marker", targetThirtySeven.includes("PHASE3485_FORTY_EIGHT_TOOL_TARGET_THIRTY_SEVEN_OK"));
check("target-thirty-eight_export", targetThirtyEight.includes("buildPhase3486FortyEightMutationTargetThirtyEightStatus") || targetThirtyEight.includes("export function buildPhase3486FortyEightMutationTargetThirtyEightStatus"));
check("target-thirty-eight_marker", targetThirtyEight.includes("PHASE3486_FORTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK"));
check("target-thirty-nine_export", targetThirtyNine.includes("buildPhase3487FortyEightMutationTargetThirtyNineStatus") || targetThirtyNine.includes("export function buildPhase3487FortyEightMutationTargetThirtyNineStatus"));
check("target-thirty-nine_marker", targetThirtyNine.includes("PHASE3487_FORTY_EIGHT_TOOL_TARGET_THIRTY_NINE_OK"));
check("target-forty_export", targetForty.includes("buildPhase3488FortyEightMutationTargetFortyStatus") || targetForty.includes("export function buildPhase3488FortyEightMutationTargetFortyStatus"));
check("target-forty_marker", targetForty.includes("PHASE3488_FORTY_EIGHT_TOOL_TARGET_FORTY_OK"));
check("target-forty-one_export", targetFortyOne.includes("buildPhase3489FortyEightMutationTargetFortyOneStatus") || targetFortyOne.includes("export function buildPhase3489FortyEightMutationTargetFortyOneStatus"));
check("target-forty-one_marker", targetFortyOne.includes("PHASE3489_FORTY_EIGHT_TOOL_TARGET_FORTY_ONE_OK"));
check("target-forty-two_export", targetFortyTwo.includes("buildPhase3490FortyEightMutationTargetFortyTwoStatus") || targetFortyTwo.includes("export function buildPhase3490FortyEightMutationTargetFortyTwoStatus"));
check("target-forty-two_marker", targetFortyTwo.includes("PHASE3490_FORTY_EIGHT_TOOL_TARGET_FORTY_TWO_OK"));
check("target-forty-three_export", targetFortyThree.includes("buildPhase3491FortyEightMutationTargetFortyThreeStatus") || targetFortyThree.includes("export function buildPhase3491FortyEightMutationTargetFortyThreeStatus"));
check("target-forty-three_marker", targetFortyThree.includes("PHASE3491_FORTY_EIGHT_TOOL_TARGET_FORTY_THREE_OK"));
check("target-forty-four_export", targetFortyFour.includes("buildPhase3492FortyEightMutationTargetFortyFourStatus") || targetFortyFour.includes("export function buildPhase3492FortyEightMutationTargetFortyFourStatus"));
check("target-forty-four_marker", targetFortyFour.includes("PHASE3492_FORTY_EIGHT_TOOL_TARGET_FORTY_FOUR_OK"));
check("target-forty-five_export", targetFortyFive.includes("buildPhase3493FortyEightMutationTargetFortyFiveStatus") || targetFortyFive.includes("export function buildPhase3493FortyEightMutationTargetFortyFiveStatus"));
check("target-forty-five_marker", targetFortyFive.includes("PHASE3493_FORTY_EIGHT_TOOL_TARGET_FORTY_FIVE_OK"));
check("target-forty-six_export", targetFortySix.includes("buildPhase3494FortyEightMutationTargetFortySixStatus") || targetFortySix.includes("export function buildPhase3494FortyEightMutationTargetFortySixStatus"));
check("target-forty-six_marker", targetFortySix.includes("PHASE3494_FORTY_EIGHT_TOOL_TARGET_FORTY_SIX_OK"));
check("target-forty-seven_export", targetFortySeven.includes("buildPhase3495FortyEightMutationTargetFortySevenStatus") || targetFortySeven.includes("export function buildPhase3495FortyEightMutationTargetFortySevenStatus"));
check("target-forty-seven_marker", targetFortySeven.includes("PHASE3495_FORTY_EIGHT_TOOL_TARGET_FORTY_SEVEN_OK"));
check("target-forty-eight_export", targetFortyEight.includes("buildPhase3496FortyEightMutationRuntimeStatus") || targetFortyEight.includes("export function buildPhase3496FortyEightMutationRuntimeStatus"));
check("target-forty-eight_marker", targetFortyEight.includes("PHASE3496_FORTY_EIGHT_TOOL_TARGET_FORTY_EIGHT_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_forty_eight", docs.includes("controlled forty-eight tool mutation"));
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
  phase3443Sealed: phase3443.recommendedSealed === true,
  fortyEightMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 48,
  fortyEightMutationApplied: result?.fortyEightMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localFortyEightSmokePassed: result?.localFortyEightSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, fortyEightMutationApplied: verifierResult.fortyEightMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localFortyEightSmokePassed: verifierResult.localFortyEightSmokePassed }, null, 2));
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
    "# Phase3444A-3496A Controlled Forty-Eight Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- fortyEightMutationApplied: ${Boolean(result.fortyEightMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localFortyEightSmokePassed: ${Boolean(result.localFortyEightSmokePassed)}`,
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
