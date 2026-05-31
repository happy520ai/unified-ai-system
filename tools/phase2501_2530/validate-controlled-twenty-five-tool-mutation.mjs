import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2501A-2530A-Controlled-Twenty-Five-Tool-Mutation";
const runnerPath = "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2501-2530-controlled-twenty-five-tool-mutation.md";
const approvalPath = "docs/phase2501-2530-controlled-twenty-five-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2506-twenty-five-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2507-twenty-five-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2508-twenty-five-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2509-twenty-five-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2510-twenty-five-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2511-twenty-five-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2512-twenty-five-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2513-twenty-five-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2514-twenty-five-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2515-twenty-five-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2516-twenty-five-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2517-twenty-five-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2518-twenty-five-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2519-twenty-five-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2520-twenty-five-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2521-twenty-five-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase2522-twenty-five-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase2523-twenty-five-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase2524-twenty-five-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase2525-twenty-five-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase2526-twenty-five-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase2527-twenty-five-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase2528-twenty-five-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase2529-twenty-five-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase2530-twenty-five-tool-mutation-target-twenty-five.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase2501-2530-controlled-twenty-five-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2501-2530-controlled-twenty-five-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2501-2530-controlled-twenty-five-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2501-2530-controlled-twenty-five-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2501-2530-controlled-twenty-five-tool-mutation/twenty-five-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2500 = readJson("apps/ai-gateway-service/evidence/phase2472-2500-controlled-twenty-four-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2501-2530-controlled-twenty-five-tool-mutation"] === "node tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs --plan docs/phase2501-2530-controlled-twenty-five-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2501-2530-controlled-twenty-five-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2511TwentyFiveMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2512TwentyFiveMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2513TwentyFiveMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2514TwentyFiveMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2515TwentyFiveMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2516TwentyFiveMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2517TwentyFiveMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2518TwentyFiveMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2519TwentyFiveMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2520TwentyFiveMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2521TwentyFiveMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2522TwentyFiveMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2523TwentyFiveMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2524TwentyFiveMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2525TwentyFiveMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2526TwentyFiveMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2527TwentyFiveMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2528TwentyFiveMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2529TwentyFiveMutationTargetTwentyFourStatus())))\" && node -e \"import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2530TwentyFiveMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2501-2530-controlled-twenty-five-tool-mutation"] === "node tools/phase2501_2530/validate-controlled-twenty-five-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2500_sealed", phase2500.recommendedSealed === true && phase2500.twentyFourMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2501-2530-controlled-twenty-five-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("twenty_five_mutation_applied", result.twentyFiveMutationApplied === true);
  check("changed_file_count_twenty_five", result.changedFileCount === 25);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localTwentyFiveSmokePassed === true);
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
  check("rollback_restore_twenty_five", rollback.rollbackAction === "restore-previous-content-twenty-five");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_twenty_five_entries", Array.isArray(rollback.files) && rollback.files.length === 25);
}

if (smoke) {
  check("smoke_phase2506Marker", smoke.phase2506Marker === "PHASE2506_TWENTY_FIVE_TOOL_TARGET_ONE_OK");
  check("smoke_phase2507Marker", smoke.phase2507Marker === "PHASE2507_TWENTY_FIVE_TOOL_TARGET_TWO_OK");
  check("smoke_phase2508Marker", smoke.phase2508Marker === "PHASE2508_TWENTY_FIVE_TOOL_TARGET_THREE_OK");
  check("smoke_phase2509Marker", smoke.phase2509Marker === "PHASE2509_TWENTY_FIVE_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2510Marker", smoke.phase2510Marker === "PHASE2510_TWENTY_FIVE_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2511Marker", smoke.phase2511Marker === "PHASE2511_TWENTY_FIVE_TOOL_TARGET_SIX_OK");
  check("smoke_phase2512Marker", smoke.phase2512Marker === "PHASE2512_TWENTY_FIVE_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2513Marker", smoke.phase2513Marker === "PHASE2513_TWENTY_FIVE_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2514Marker", smoke.phase2514Marker === "PHASE2514_TWENTY_FIVE_TOOL_TARGET_NINE_OK");
  check("smoke_phase2515Marker", smoke.phase2515Marker === "PHASE2515_TWENTY_FIVE_TOOL_TARGET_TEN_OK");
  check("smoke_phase2516Marker", smoke.phase2516Marker === "PHASE2516_TWENTY_FIVE_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2517Marker", smoke.phase2517Marker === "PHASE2517_TWENTY_FIVE_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2518Marker", smoke.phase2518Marker === "PHASE2518_TWENTY_FIVE_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2519Marker", smoke.phase2519Marker === "PHASE2519_TWENTY_FIVE_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2520Marker", smoke.phase2520Marker === "PHASE2520_TWENTY_FIVE_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2521Marker", smoke.phase2521Marker === "PHASE2521_TWENTY_FIVE_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase2522Marker", smoke.phase2522Marker === "PHASE2522_TWENTY_FIVE_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase2523Marker", smoke.phase2523Marker === "PHASE2523_TWENTY_FIVE_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase2524Marker", smoke.phase2524Marker === "PHASE2524_TWENTY_FIVE_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase2525Marker", smoke.phase2525Marker === "PHASE2525_TWENTY_FIVE_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase2526Marker", smoke.phase2526Marker === "PHASE2526_TWENTY_FIVE_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase2527Marker", smoke.phase2527Marker === "PHASE2527_TWENTY_FIVE_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase2528Marker", smoke.phase2528Marker === "PHASE2528_TWENTY_FIVE_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase2529Marker", smoke.phase2529Marker === "PHASE2529_TWENTY_FIVE_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase2530Marker", smoke.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2506TwentyFiveMutationTargetOneStatus") || targetOne.includes("export function buildPhase2506TwentyFiveMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2506_TWENTY_FIVE_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2507TwentyFiveMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2507TwentyFiveMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2507_TWENTY_FIVE_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2508TwentyFiveMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2508TwentyFiveMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2508_TWENTY_FIVE_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2509TwentyFiveMutationTargetFourStatus") || targetFour.includes("export function buildPhase2509TwentyFiveMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2509_TWENTY_FIVE_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2510TwentyFiveMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2510TwentyFiveMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2510_TWENTY_FIVE_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2511TwentyFiveMutationTargetSixStatus") || targetSix.includes("export function buildPhase2511TwentyFiveMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2511_TWENTY_FIVE_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2512TwentyFiveMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2512TwentyFiveMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2512_TWENTY_FIVE_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2513TwentyFiveMutationTargetEightStatus") || targetEight.includes("export function buildPhase2513TwentyFiveMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2513_TWENTY_FIVE_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2514TwentyFiveMutationTargetNineStatus") || targetNine.includes("export function buildPhase2514TwentyFiveMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2514_TWENTY_FIVE_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2515TwentyFiveMutationTargetTenStatus") || targetTen.includes("export function buildPhase2515TwentyFiveMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2515_TWENTY_FIVE_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2516TwentyFiveMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2516TwentyFiveMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2516_TWENTY_FIVE_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2517TwentyFiveMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2517TwentyFiveMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2517_TWENTY_FIVE_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2518TwentyFiveMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2518TwentyFiveMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2518_TWENTY_FIVE_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2519TwentyFiveMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2519TwentyFiveMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2519_TWENTY_FIVE_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2520TwentyFiveMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2520TwentyFiveMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2520_TWENTY_FIVE_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2521TwentyFiveMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase2521TwentyFiveMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2521_TWENTY_FIVE_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase2522TwentyFiveMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase2522TwentyFiveMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE2522_TWENTY_FIVE_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase2523TwentyFiveMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase2523TwentyFiveMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE2523_TWENTY_FIVE_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase2524TwentyFiveMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase2524TwentyFiveMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE2524_TWENTY_FIVE_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase2525TwentyFiveMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase2525TwentyFiveMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE2525_TWENTY_FIVE_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase2526TwentyFiveMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase2526TwentyFiveMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE2526_TWENTY_FIVE_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase2527TwentyFiveMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase2527TwentyFiveMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE2527_TWENTY_FIVE_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase2528TwentyFiveMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase2528TwentyFiveMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE2528_TWENTY_FIVE_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase2529TwentyFiveMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase2529TwentyFiveMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE2529_TWENTY_FIVE_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase2530TwentyFiveMutationRuntimeStatus") || targetTwentyFive.includes("export function buildPhase2530TwentyFiveMutationRuntimeStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_twenty_five", docs.includes("controlled twenty-five tool mutation"));
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
  phase2500Sealed: phase2500.recommendedSealed === true,
  twentyFiveMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 25,
  twentyFiveMutationApplied: result?.twentyFiveMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localTwentyFiveSmokePassed: result?.localTwentyFiveSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, twentyFiveMutationApplied: verifierResult.twentyFiveMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localTwentyFiveSmokePassed: verifierResult.localTwentyFiveSmokePassed }, null, 2));
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
    "# Phase2501A-2530A Controlled Twenty-Five Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- twentyFiveMutationApplied: ${Boolean(result.twentyFiveMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localTwentyFiveSmokePassed: ${Boolean(result.localTwentyFiveSmokePassed)}`,
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
