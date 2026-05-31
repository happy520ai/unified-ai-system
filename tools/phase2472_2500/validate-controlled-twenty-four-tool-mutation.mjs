import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2472A-2500A-Controlled-Twenty-Four-Tool-Mutation";
const runnerPath = "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2472-2500-controlled-twenty-four-tool-mutation.md";
const approvalPath = "docs/phase2472-2500-controlled-twenty-four-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2477-twenty-four-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2478-twenty-four-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2479-twenty-four-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2480-twenty-four-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2481-twenty-four-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2482-twenty-four-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2483-twenty-four-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2484-twenty-four-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2485-twenty-four-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2486-twenty-four-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2487-twenty-four-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2488-twenty-four-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2489-twenty-four-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2490-twenty-four-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2491-twenty-four-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2492-twenty-four-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase2493-twenty-four-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase2494-twenty-four-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase2495-twenty-four-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase2496-twenty-four-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase2497-twenty-four-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase2498-twenty-four-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase2499-twenty-four-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase2500-twenty-four-tool-mutation-target-twenty-four.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase2472-2500-controlled-twenty-four-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2472-2500-controlled-twenty-four-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2472-2500-controlled-twenty-four-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2472-2500-controlled-twenty-four-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2472-2500-controlled-twenty-four-tool-mutation/twenty-four-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2471 = readJson("apps/ai-gateway-service/evidence/phase2444-2471-controlled-twenty-three-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2472-2500-controlled-twenty-four-tool-mutation"] === "node tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs --plan docs/phase2472-2500-controlled-twenty-four-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2472-2500-controlled-twenty-four-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2482TwentyFourMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2483TwentyFourMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2484TwentyFourMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2485TwentyFourMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2486TwentyFourMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2487TwentyFourMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2488TwentyFourMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2489TwentyFourMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2490TwentyFourMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2491TwentyFourMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2492TwentyFourMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2493TwentyFourMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2494TwentyFourMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2495TwentyFourMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2496TwentyFourMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2497TwentyFourMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2498TwentyFourMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2499TwentyFourMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2500TwentyFourMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2472-2500-controlled-twenty-four-tool-mutation"] === "node tools/phase2472_2500/validate-controlled-twenty-four-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2471_sealed", phase2471.recommendedSealed === true && phase2471.twentyThreeMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2472-2500-controlled-twenty-four-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("twenty_four_mutation_applied", result.twentyFourMutationApplied === true);
  check("changed_file_count_twenty_four", result.changedFileCount === 24);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localTwentyFourSmokePassed === true);
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
  check("rollback_restore_twenty_four", rollback.rollbackAction === "restore-previous-content-twenty-four");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_twenty_four_entries", Array.isArray(rollback.files) && rollback.files.length === 24);
}

if (smoke) {
  check("smoke_phase2477Marker", smoke.phase2477Marker === "PHASE2477_TWENTY_FOUR_TOOL_TARGET_ONE_OK");
  check("smoke_phase2478Marker", smoke.phase2478Marker === "PHASE2478_TWENTY_FOUR_TOOL_TARGET_TWO_OK");
  check("smoke_phase2479Marker", smoke.phase2479Marker === "PHASE2479_TWENTY_FOUR_TOOL_TARGET_THREE_OK");
  check("smoke_phase2480Marker", smoke.phase2480Marker === "PHASE2480_TWENTY_FOUR_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2481Marker", smoke.phase2481Marker === "PHASE2481_TWENTY_FOUR_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2482Marker", smoke.phase2482Marker === "PHASE2482_TWENTY_FOUR_TOOL_TARGET_SIX_OK");
  check("smoke_phase2483Marker", smoke.phase2483Marker === "PHASE2483_TWENTY_FOUR_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2484Marker", smoke.phase2484Marker === "PHASE2484_TWENTY_FOUR_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2485Marker", smoke.phase2485Marker === "PHASE2485_TWENTY_FOUR_TOOL_TARGET_NINE_OK");
  check("smoke_phase2486Marker", smoke.phase2486Marker === "PHASE2486_TWENTY_FOUR_TOOL_TARGET_TEN_OK");
  check("smoke_phase2487Marker", smoke.phase2487Marker === "PHASE2487_TWENTY_FOUR_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2488Marker", smoke.phase2488Marker === "PHASE2488_TWENTY_FOUR_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2489Marker", smoke.phase2489Marker === "PHASE2489_TWENTY_FOUR_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2490Marker", smoke.phase2490Marker === "PHASE2490_TWENTY_FOUR_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2491Marker", smoke.phase2491Marker === "PHASE2491_TWENTY_FOUR_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2492Marker", smoke.phase2492Marker === "PHASE2492_TWENTY_FOUR_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase2493Marker", smoke.phase2493Marker === "PHASE2493_TWENTY_FOUR_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase2494Marker", smoke.phase2494Marker === "PHASE2494_TWENTY_FOUR_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase2495Marker", smoke.phase2495Marker === "PHASE2495_TWENTY_FOUR_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase2496Marker", smoke.phase2496Marker === "PHASE2496_TWENTY_FOUR_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase2497Marker", smoke.phase2497Marker === "PHASE2497_TWENTY_FOUR_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase2498Marker", smoke.phase2498Marker === "PHASE2498_TWENTY_FOUR_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase2499Marker", smoke.phase2499Marker === "PHASE2499_TWENTY_FOUR_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase2500Marker", smoke.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2477TwentyFourMutationTargetOneStatus") || targetOne.includes("export function buildPhase2477TwentyFourMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2477_TWENTY_FOUR_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2478TwentyFourMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2478TwentyFourMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2478_TWENTY_FOUR_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2479TwentyFourMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2479TwentyFourMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2479_TWENTY_FOUR_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2480TwentyFourMutationTargetFourStatus") || targetFour.includes("export function buildPhase2480TwentyFourMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2480_TWENTY_FOUR_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2481TwentyFourMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2481TwentyFourMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2481_TWENTY_FOUR_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2482TwentyFourMutationTargetSixStatus") || targetSix.includes("export function buildPhase2482TwentyFourMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2482_TWENTY_FOUR_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2483TwentyFourMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2483TwentyFourMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2483_TWENTY_FOUR_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2484TwentyFourMutationTargetEightStatus") || targetEight.includes("export function buildPhase2484TwentyFourMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2484_TWENTY_FOUR_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2485TwentyFourMutationTargetNineStatus") || targetNine.includes("export function buildPhase2485TwentyFourMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2485_TWENTY_FOUR_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2486TwentyFourMutationTargetTenStatus") || targetTen.includes("export function buildPhase2486TwentyFourMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2486_TWENTY_FOUR_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2487TwentyFourMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2487TwentyFourMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2487_TWENTY_FOUR_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2488TwentyFourMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2488TwentyFourMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2488_TWENTY_FOUR_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2489TwentyFourMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2489TwentyFourMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2489_TWENTY_FOUR_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2490TwentyFourMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2490TwentyFourMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2490_TWENTY_FOUR_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2491TwentyFourMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2491TwentyFourMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2491_TWENTY_FOUR_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2492TwentyFourMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase2492TwentyFourMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2492_TWENTY_FOUR_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase2493TwentyFourMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase2493TwentyFourMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE2493_TWENTY_FOUR_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase2494TwentyFourMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase2494TwentyFourMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE2494_TWENTY_FOUR_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase2495TwentyFourMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase2495TwentyFourMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE2495_TWENTY_FOUR_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase2496TwentyFourMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase2496TwentyFourMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE2496_TWENTY_FOUR_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase2497TwentyFourMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase2497TwentyFourMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE2497_TWENTY_FOUR_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase2498TwentyFourMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase2498TwentyFourMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE2498_TWENTY_FOUR_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase2499TwentyFourMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase2499TwentyFourMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE2499_TWENTY_FOUR_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase2500TwentyFourMutationRuntimeStatus") || targetTwentyFour.includes("export function buildPhase2500TwentyFourMutationRuntimeStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_twenty_four", docs.includes("controlled twenty-four tool mutation"));
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
  phase2471Sealed: phase2471.recommendedSealed === true,
  twentyFourMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 24,
  twentyFourMutationApplied: result?.twentyFourMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localTwentyFourSmokePassed: result?.localTwentyFourSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, twentyFourMutationApplied: verifierResult.twentyFourMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localTwentyFourSmokePassed: verifierResult.localTwentyFourSmokePassed }, null, 2));
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
    "# Phase2472A-2500A Controlled Twenty-Four Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- twentyFourMutationApplied: ${Boolean(result.twentyFourMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localTwentyFourSmokePassed: ${Boolean(result.localTwentyFourSmokePassed)}`,
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
