import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2531A-2561A-Controlled-Twenty-Six-Tool-Mutation";
const runnerPath = "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2531-2561-controlled-twenty-six-tool-mutation.md";
const approvalPath = "docs/phase2531-2561-controlled-twenty-six-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2536-twenty-six-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2537-twenty-six-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2538-twenty-six-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2539-twenty-six-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2540-twenty-six-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2541-twenty-six-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2542-twenty-six-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2543-twenty-six-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2544-twenty-six-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2545-twenty-six-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2546-twenty-six-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2547-twenty-six-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2548-twenty-six-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2549-twenty-six-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2550-twenty-six-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2551-twenty-six-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase2552-twenty-six-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase2553-twenty-six-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase2554-twenty-six-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase2555-twenty-six-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase2556-twenty-six-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase2557-twenty-six-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase2558-twenty-six-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase2559-twenty-six-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase2560-twenty-six-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase2561-twenty-six-tool-mutation-target-twenty-six.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase2531-2561-controlled-twenty-six-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2531-2561-controlled-twenty-six-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2531-2561-controlled-twenty-six-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2531-2561-controlled-twenty-six-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2531-2561-controlled-twenty-six-tool-mutation/twenty-six-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2530 = readJson("apps/ai-gateway-service/evidence/phase2501-2530-controlled-twenty-five-tool-mutation/result.json") || {};
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
const docs = existsSync(resolve(docsPath)) ? readText(docsPath) : "";
const substrate = existsSync(resolve(substratePath)) ? readText(substratePath) : "";

check("runner_exists", existsSync(resolve(runnerPath)));
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2531-2561-controlled-twenty-six-tool-mutation"] === "node tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs --plan docs/phase2531-2561-controlled-twenty-six-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2531-2561-controlled-twenty-six-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2541TwentySixMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2542TwentySixMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2543TwentySixMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2544TwentySixMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2545TwentySixMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2546TwentySixMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2547TwentySixMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2548TwentySixMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2549TwentySixMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2550TwentySixMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2551TwentySixMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2552TwentySixMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2553TwentySixMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2554TwentySixMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2555TwentySixMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2556TwentySixMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2557TwentySixMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2558TwentySixMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2559TwentySixMutationTargetTwentyFourStatus())))\" && node -e \"import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2560TwentySixMutationTargetTwentyFiveStatus())))\" && node -e \"import('./tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2561TwentySixMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2531-2561-controlled-twenty-six-tool-mutation"] === "node tools/phase2531_2561/validate-controlled-twenty-six-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2530_sealed", phase2530.recommendedSealed === true && phase2530.twentyFiveMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2531-2561-controlled-twenty-six-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("twenty_six_mutation_applied", result.twentySixMutationApplied === true);
  check("changed_file_count_twenty_six", result.changedFileCount === 26);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localTwentySixSmokePassed === true);
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
  check("rollback_restore_twenty_six", rollback.rollbackAction === "restore-previous-content-twenty-six");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_twenty_six_entries", Array.isArray(rollback.files) && rollback.files.length === 26);
}

if (smoke) {
  check("smoke_phase2536Marker", smoke.phase2536Marker === "PHASE2536_TWENTY_SIX_TOOL_TARGET_ONE_OK");
  check("smoke_phase2537Marker", smoke.phase2537Marker === "PHASE2537_TWENTY_SIX_TOOL_TARGET_TWO_OK");
  check("smoke_phase2538Marker", smoke.phase2538Marker === "PHASE2538_TWENTY_SIX_TOOL_TARGET_THREE_OK");
  check("smoke_phase2539Marker", smoke.phase2539Marker === "PHASE2539_TWENTY_SIX_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2540Marker", smoke.phase2540Marker === "PHASE2540_TWENTY_SIX_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2541Marker", smoke.phase2541Marker === "PHASE2541_TWENTY_SIX_TOOL_TARGET_SIX_OK");
  check("smoke_phase2542Marker", smoke.phase2542Marker === "PHASE2542_TWENTY_SIX_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2543Marker", smoke.phase2543Marker === "PHASE2543_TWENTY_SIX_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2544Marker", smoke.phase2544Marker === "PHASE2544_TWENTY_SIX_TOOL_TARGET_NINE_OK");
  check("smoke_phase2545Marker", smoke.phase2545Marker === "PHASE2545_TWENTY_SIX_TOOL_TARGET_TEN_OK");
  check("smoke_phase2546Marker", smoke.phase2546Marker === "PHASE2546_TWENTY_SIX_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2547Marker", smoke.phase2547Marker === "PHASE2547_TWENTY_SIX_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2548Marker", smoke.phase2548Marker === "PHASE2548_TWENTY_SIX_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2549Marker", smoke.phase2549Marker === "PHASE2549_TWENTY_SIX_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2550Marker", smoke.phase2550Marker === "PHASE2550_TWENTY_SIX_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2551Marker", smoke.phase2551Marker === "PHASE2551_TWENTY_SIX_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase2552Marker", smoke.phase2552Marker === "PHASE2552_TWENTY_SIX_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase2553Marker", smoke.phase2553Marker === "PHASE2553_TWENTY_SIX_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase2554Marker", smoke.phase2554Marker === "PHASE2554_TWENTY_SIX_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase2555Marker", smoke.phase2555Marker === "PHASE2555_TWENTY_SIX_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase2556Marker", smoke.phase2556Marker === "PHASE2556_TWENTY_SIX_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase2557Marker", smoke.phase2557Marker === "PHASE2557_TWENTY_SIX_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase2558Marker", smoke.phase2558Marker === "PHASE2558_TWENTY_SIX_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase2559Marker", smoke.phase2559Marker === "PHASE2559_TWENTY_SIX_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase2560Marker", smoke.phase2560Marker === "PHASE2560_TWENTY_SIX_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase2561Marker", smoke.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2536TwentySixMutationTargetOneStatus") || targetOne.includes("export function buildPhase2536TwentySixMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2536_TWENTY_SIX_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2537TwentySixMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2537TwentySixMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2537_TWENTY_SIX_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2538TwentySixMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2538TwentySixMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2538_TWENTY_SIX_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2539TwentySixMutationTargetFourStatus") || targetFour.includes("export function buildPhase2539TwentySixMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2539_TWENTY_SIX_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2540TwentySixMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2540TwentySixMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2540_TWENTY_SIX_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2541TwentySixMutationTargetSixStatus") || targetSix.includes("export function buildPhase2541TwentySixMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2541_TWENTY_SIX_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2542TwentySixMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2542TwentySixMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2542_TWENTY_SIX_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2543TwentySixMutationTargetEightStatus") || targetEight.includes("export function buildPhase2543TwentySixMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2543_TWENTY_SIX_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2544TwentySixMutationTargetNineStatus") || targetNine.includes("export function buildPhase2544TwentySixMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2544_TWENTY_SIX_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2545TwentySixMutationTargetTenStatus") || targetTen.includes("export function buildPhase2545TwentySixMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2545_TWENTY_SIX_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2546TwentySixMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2546TwentySixMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2546_TWENTY_SIX_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2547TwentySixMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2547TwentySixMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2547_TWENTY_SIX_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2548TwentySixMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2548TwentySixMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2548_TWENTY_SIX_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2549TwentySixMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2549TwentySixMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2549_TWENTY_SIX_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2550TwentySixMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2550TwentySixMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2550_TWENTY_SIX_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2551TwentySixMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase2551TwentySixMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2551_TWENTY_SIX_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase2552TwentySixMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase2552TwentySixMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE2552_TWENTY_SIX_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase2553TwentySixMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase2553TwentySixMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE2553_TWENTY_SIX_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase2554TwentySixMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase2554TwentySixMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE2554_TWENTY_SIX_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase2555TwentySixMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase2555TwentySixMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE2555_TWENTY_SIX_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase2556TwentySixMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase2556TwentySixMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE2556_TWENTY_SIX_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase2557TwentySixMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase2557TwentySixMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE2557_TWENTY_SIX_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase2558TwentySixMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase2558TwentySixMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE2558_TWENTY_SIX_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase2559TwentySixMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase2559TwentySixMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE2559_TWENTY_SIX_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase2560TwentySixMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase2560TwentySixMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE2560_TWENTY_SIX_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase2561TwentySixMutationRuntimeStatus") || targetTwentySix.includes("export function buildPhase2561TwentySixMutationRuntimeStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_twenty_six", docs.includes("controlled twenty-six tool mutation"));
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
  phase2530Sealed: phase2530.recommendedSealed === true,
  twentySixMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 26,
  twentySixMutationApplied: result?.twentySixMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localTwentySixSmokePassed: result?.localTwentySixSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, twentySixMutationApplied: verifierResult.twentySixMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localTwentySixSmokePassed: verifierResult.localTwentySixSmokePassed }, null, 2));
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
    "# Phase2531A-2561A Controlled Twenty-Six Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- twentySixMutationApplied: ${Boolean(result.twentySixMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localTwentySixSmokePassed: ${Boolean(result.localTwentySixSmokePassed)}`,
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
