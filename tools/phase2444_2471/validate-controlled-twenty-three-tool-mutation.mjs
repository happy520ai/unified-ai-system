import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2444A-2471A-Controlled-Twenty-Three-Tool-Mutation";
const runnerPath = "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2444-2471-controlled-twenty-three-tool-mutation.md";
const approvalPath = "docs/phase2444-2471-controlled-twenty-three-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2449-twenty-three-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2450-twenty-three-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2451-twenty-three-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2452-twenty-three-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2453-twenty-three-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2454-twenty-three-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2455-twenty-three-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2456-twenty-three-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2457-twenty-three-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2458-twenty-three-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2459-twenty-three-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2460-twenty-three-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2461-twenty-three-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2462-twenty-three-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2463-twenty-three-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2464-twenty-three-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase2465-twenty-three-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase2466-twenty-three-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase2467-twenty-three-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase2468-twenty-three-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase2469-twenty-three-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase2470-twenty-three-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase2471-twenty-three-tool-mutation-target-twenty-three.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase2444-2471-controlled-twenty-three-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2444-2471-controlled-twenty-three-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2444-2471-controlled-twenty-three-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2444-2471-controlled-twenty-three-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2444-2471-controlled-twenty-three-tool-mutation/twenty-three-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2443 = readJson("apps/ai-gateway-service/evidence/phase2417-2443-controlled-twenty-two-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2444-2471-controlled-twenty-three-tool-mutation"] === "node tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs --plan docs/phase2444-2471-controlled-twenty-three-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2444-2471-controlled-twenty-three-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2454TwentyThreeMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2455TwentyThreeMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2456TwentyThreeMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2457TwentyThreeMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2458TwentyThreeMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2459TwentyThreeMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2460TwentyThreeMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2461TwentyThreeMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2462TwentyThreeMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2463TwentyThreeMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2464TwentyThreeMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2465TwentyThreeMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2466TwentyThreeMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2467TwentyThreeMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2468TwentyThreeMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2469TwentyThreeMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2470TwentyThreeMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2471TwentyThreeMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2444-2471-controlled-twenty-three-tool-mutation"] === "node tools/phase2444_2471/validate-controlled-twenty-three-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2443_sealed", phase2443.recommendedSealed === true && phase2443.twentyTwoMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2444-2471-controlled-twenty-three-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("twenty_three_mutation_applied", result.twentyThreeMutationApplied === true);
  check("changed_file_count_twenty_three", result.changedFileCount === 23);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localTwentyThreeSmokePassed === true);
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
  check("rollback_restore_twenty_three", rollback.rollbackAction === "restore-previous-content-twenty-three");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_twenty_three_entries", Array.isArray(rollback.files) && rollback.files.length === 23);
}

if (smoke) {
  check("smoke_phase2449Marker", smoke.phase2449Marker === "PHASE2449_TWENTY_THREE_TOOL_TARGET_ONE_OK");
  check("smoke_phase2450Marker", smoke.phase2450Marker === "PHASE2450_TWENTY_THREE_TOOL_TARGET_TWO_OK");
  check("smoke_phase2451Marker", smoke.phase2451Marker === "PHASE2451_TWENTY_THREE_TOOL_TARGET_THREE_OK");
  check("smoke_phase2452Marker", smoke.phase2452Marker === "PHASE2452_TWENTY_THREE_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2453Marker", smoke.phase2453Marker === "PHASE2453_TWENTY_THREE_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2454Marker", smoke.phase2454Marker === "PHASE2454_TWENTY_THREE_TOOL_TARGET_SIX_OK");
  check("smoke_phase2455Marker", smoke.phase2455Marker === "PHASE2455_TWENTY_THREE_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2456Marker", smoke.phase2456Marker === "PHASE2456_TWENTY_THREE_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2457Marker", smoke.phase2457Marker === "PHASE2457_TWENTY_THREE_TOOL_TARGET_NINE_OK");
  check("smoke_phase2458Marker", smoke.phase2458Marker === "PHASE2458_TWENTY_THREE_TOOL_TARGET_TEN_OK");
  check("smoke_phase2459Marker", smoke.phase2459Marker === "PHASE2459_TWENTY_THREE_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2460Marker", smoke.phase2460Marker === "PHASE2460_TWENTY_THREE_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2461Marker", smoke.phase2461Marker === "PHASE2461_TWENTY_THREE_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2462Marker", smoke.phase2462Marker === "PHASE2462_TWENTY_THREE_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2463Marker", smoke.phase2463Marker === "PHASE2463_TWENTY_THREE_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2464Marker", smoke.phase2464Marker === "PHASE2464_TWENTY_THREE_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase2465Marker", smoke.phase2465Marker === "PHASE2465_TWENTY_THREE_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase2466Marker", smoke.phase2466Marker === "PHASE2466_TWENTY_THREE_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase2467Marker", smoke.phase2467Marker === "PHASE2467_TWENTY_THREE_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase2468Marker", smoke.phase2468Marker === "PHASE2468_TWENTY_THREE_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase2469Marker", smoke.phase2469Marker === "PHASE2469_TWENTY_THREE_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase2470Marker", smoke.phase2470Marker === "PHASE2470_TWENTY_THREE_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase2471Marker", smoke.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2449TwentyThreeMutationTargetOneStatus") || targetOne.includes("export function buildPhase2449TwentyThreeMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2449_TWENTY_THREE_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2450TwentyThreeMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2450TwentyThreeMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2450_TWENTY_THREE_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2451TwentyThreeMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2451TwentyThreeMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2451_TWENTY_THREE_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2452TwentyThreeMutationTargetFourStatus") || targetFour.includes("export function buildPhase2452TwentyThreeMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2452_TWENTY_THREE_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2453TwentyThreeMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2453TwentyThreeMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2453_TWENTY_THREE_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2454TwentyThreeMutationTargetSixStatus") || targetSix.includes("export function buildPhase2454TwentyThreeMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2454_TWENTY_THREE_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2455TwentyThreeMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2455TwentyThreeMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2455_TWENTY_THREE_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2456TwentyThreeMutationTargetEightStatus") || targetEight.includes("export function buildPhase2456TwentyThreeMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2456_TWENTY_THREE_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2457TwentyThreeMutationTargetNineStatus") || targetNine.includes("export function buildPhase2457TwentyThreeMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2457_TWENTY_THREE_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2458TwentyThreeMutationTargetTenStatus") || targetTen.includes("export function buildPhase2458TwentyThreeMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2458_TWENTY_THREE_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2459TwentyThreeMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2459TwentyThreeMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2459_TWENTY_THREE_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2460TwentyThreeMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2460TwentyThreeMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2460_TWENTY_THREE_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2461TwentyThreeMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2461TwentyThreeMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2461_TWENTY_THREE_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2462TwentyThreeMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2462TwentyThreeMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2462_TWENTY_THREE_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2463TwentyThreeMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2463TwentyThreeMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2463_TWENTY_THREE_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2464TwentyThreeMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase2464TwentyThreeMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2464_TWENTY_THREE_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase2465TwentyThreeMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase2465TwentyThreeMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE2465_TWENTY_THREE_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase2466TwentyThreeMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase2466TwentyThreeMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE2466_TWENTY_THREE_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase2467TwentyThreeMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase2467TwentyThreeMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE2467_TWENTY_THREE_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase2468TwentyThreeMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase2468TwentyThreeMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE2468_TWENTY_THREE_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase2469TwentyThreeMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase2469TwentyThreeMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE2469_TWENTY_THREE_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase2470TwentyThreeMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase2470TwentyThreeMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE2470_TWENTY_THREE_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase2471TwentyThreeMutationRuntimeStatus") || targetTwentyThree.includes("export function buildPhase2471TwentyThreeMutationRuntimeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_twenty_three", docs.includes("controlled twenty-three tool mutation"));
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
  phase2443Sealed: phase2443.recommendedSealed === true,
  twentyThreeMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 23,
  twentyThreeMutationApplied: result?.twentyThreeMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localTwentyThreeSmokePassed: result?.localTwentyThreeSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, twentyThreeMutationApplied: verifierResult.twentyThreeMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localTwentyThreeSmokePassed: verifierResult.localTwentyThreeSmokePassed }, null, 2));
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
    "# Phase2444A-2471A Controlled Twenty-Three Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- twentyThreeMutationApplied: ${Boolean(result.twentyThreeMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localTwentyThreeSmokePassed: ${Boolean(result.localTwentyThreeSmokePassed)}`,
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
