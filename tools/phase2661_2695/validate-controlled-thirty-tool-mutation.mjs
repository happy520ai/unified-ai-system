import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2661A-2695A-Controlled-Thirty-Tool-Mutation";
const runnerPath = "tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2661-2695-controlled-thirty-tool-mutation.md";
const approvalPath = "docs/phase2661-2695-controlled-thirty-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2666-thirty-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2667-thirty-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2668-thirty-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2669-thirty-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2670-thirty-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2671-thirty-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2672-thirty-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2673-thirty-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2674-thirty-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2675-thirty-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2676-thirty-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2677-thirty-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2678-thirty-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2679-thirty-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2680-thirty-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2681-thirty-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase2682-thirty-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase2683-thirty-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase2684-thirty-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase2685-thirty-tool-mutation-target-twenty.proposal.diff";
const proposalTwentyOnePath = "docs/phase2686-thirty-tool-mutation-target-twenty-one.proposal.diff";
const proposalTwentyTwoPath = "docs/phase2687-thirty-tool-mutation-target-twenty-two.proposal.diff";
const proposalTwentyThreePath = "docs/phase2688-thirty-tool-mutation-target-twenty-three.proposal.diff";
const proposalTwentyFourPath = "docs/phase2689-thirty-tool-mutation-target-twenty-four.proposal.diff";
const proposalTwentyFivePath = "docs/phase2690-thirty-tool-mutation-target-twenty-five.proposal.diff";
const proposalTwentySixPath = "docs/phase2691-thirty-tool-mutation-target-twenty-six.proposal.diff";
const proposalTwentySevenPath = "docs/phase2692-thirty-tool-mutation-target-twenty-seven.proposal.diff";
const proposalTwentyEightPath = "docs/phase2693-thirty-tool-mutation-target-twenty-eight.proposal.diff";
const proposalTwentyNinePath = "docs/phase2694-thirty-tool-mutation-target-twenty-nine.proposal.diff";
const proposalThirtyPath = "docs/phase2695-thirty-tool-mutation-target-thirty.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase2661-2695-controlled-thirty-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2661-2695-controlled-thirty-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2661-2695-controlled-thirty-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2661-2695-controlled-thirty-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2661-2695-controlled-thirty-tool-mutation/thirty-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2660 = readJson("apps/ai-gateway-service/evidence/phase2627-2660-controlled-twenty-nine-tool-mutation/result.json") || {};
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
check("proposal_twenty-seven_exists", existsSync(resolve(proposalTwentySevenPath)));
check("proposal_twenty-eight_exists", existsSync(resolve(proposalTwentyEightPath)));
check("proposal_twenty-nine_exists", existsSync(resolve(proposalTwentyNinePath)));
check("proposal_thirty_exists", existsSync(resolve(proposalThirtyPath)));
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2661-2695-controlled-thirty-tool-mutation"] === "node tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs --plan docs/phase2661-2695-controlled-thirty-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2661-2695-controlled-thirty-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2671ThirtyMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2672ThirtyMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2673ThirtyMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2674ThirtyMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2675ThirtyMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2676ThirtyMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2677ThirtyMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2678ThirtyMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2679ThirtyMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2680ThirtyMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2681ThirtyMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2682ThirtyMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2683ThirtyMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2684ThirtyMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2685ThirtyMutationTargetTwentyStatus())))\" && node -e \"import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2686ThirtyMutationTargetTwentyOneStatus())))\" && node -e \"import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2687ThirtyMutationTargetTwentyTwoStatus())))\" && node -e \"import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2688ThirtyMutationTargetTwentyThreeStatus())))\" && node -e \"import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2689ThirtyMutationTargetTwentyFourStatus())))\" && node -e \"import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2690ThirtyMutationTargetTwentyFiveStatus())))\" && node -e \"import('./tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2691ThirtyMutationTargetTwentySixStatus())))\" && node -e \"import('./tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2692ThirtyMutationTargetTwentySevenStatus())))\" && node -e \"import('./tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2693ThirtyMutationTargetTwentyEightStatus())))\" && node -e \"import('./tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2694ThirtyMutationTargetTwentyNineStatus())))\" && node -e \"import('./tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2695ThirtyMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2661-2695-controlled-thirty-tool-mutation"] === "node tools/phase2661_2695/validate-controlled-thirty-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2660_sealed", phase2660.recommendedSealed === true && phase2660.twentyNineMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2661-2695-controlled-thirty-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("thirty_mutation_applied", result.thirtyMutationApplied === true);
  check("changed_file_count_thirty", result.changedFileCount === 30);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localThirtySmokePassed === true);
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
  check("rollback_restore_thirty", rollback.rollbackAction === "restore-previous-content-thirty");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_thirty_entries", Array.isArray(rollback.files) && rollback.files.length === 30);
}

if (smoke) {
  check("smoke_phase2666Marker", smoke.phase2666Marker === "PHASE2666_THIRTY_TOOL_TARGET_ONE_OK");
  check("smoke_phase2667Marker", smoke.phase2667Marker === "PHASE2667_THIRTY_TOOL_TARGET_TWO_OK");
  check("smoke_phase2668Marker", smoke.phase2668Marker === "PHASE2668_THIRTY_TOOL_TARGET_THREE_OK");
  check("smoke_phase2669Marker", smoke.phase2669Marker === "PHASE2669_THIRTY_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2670Marker", smoke.phase2670Marker === "PHASE2670_THIRTY_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2671Marker", smoke.phase2671Marker === "PHASE2671_THIRTY_TOOL_TARGET_SIX_OK");
  check("smoke_phase2672Marker", smoke.phase2672Marker === "PHASE2672_THIRTY_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2673Marker", smoke.phase2673Marker === "PHASE2673_THIRTY_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2674Marker", smoke.phase2674Marker === "PHASE2674_THIRTY_TOOL_TARGET_NINE_OK");
  check("smoke_phase2675Marker", smoke.phase2675Marker === "PHASE2675_THIRTY_TOOL_TARGET_TEN_OK");
  check("smoke_phase2676Marker", smoke.phase2676Marker === "PHASE2676_THIRTY_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2677Marker", smoke.phase2677Marker === "PHASE2677_THIRTY_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2678Marker", smoke.phase2678Marker === "PHASE2678_THIRTY_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2679Marker", smoke.phase2679Marker === "PHASE2679_THIRTY_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2680Marker", smoke.phase2680Marker === "PHASE2680_THIRTY_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2681Marker", smoke.phase2681Marker === "PHASE2681_THIRTY_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase2682Marker", smoke.phase2682Marker === "PHASE2682_THIRTY_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase2683Marker", smoke.phase2683Marker === "PHASE2683_THIRTY_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase2684Marker", smoke.phase2684Marker === "PHASE2684_THIRTY_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase2685Marker", smoke.phase2685Marker === "PHASE2685_THIRTY_TOOL_TARGET_TWENTY_OK");
  check("smoke_phase2686Marker", smoke.phase2686Marker === "PHASE2686_THIRTY_TOOL_TARGET_TWENTY_ONE_OK");
  check("smoke_phase2687Marker", smoke.phase2687Marker === "PHASE2687_THIRTY_TOOL_TARGET_TWENTY_TWO_OK");
  check("smoke_phase2688Marker", smoke.phase2688Marker === "PHASE2688_THIRTY_TOOL_TARGET_TWENTY_THREE_OK");
  check("smoke_phase2689Marker", smoke.phase2689Marker === "PHASE2689_THIRTY_TOOL_TARGET_TWENTY_FOUR_OK");
  check("smoke_phase2690Marker", smoke.phase2690Marker === "PHASE2690_THIRTY_TOOL_TARGET_TWENTY_FIVE_OK");
  check("smoke_phase2691Marker", smoke.phase2691Marker === "PHASE2691_THIRTY_TOOL_TARGET_TWENTY_SIX_OK");
  check("smoke_phase2692Marker", smoke.phase2692Marker === "PHASE2692_THIRTY_TOOL_TARGET_TWENTY_SEVEN_OK");
  check("smoke_phase2693Marker", smoke.phase2693Marker === "PHASE2693_THIRTY_TOOL_TARGET_TWENTY_EIGHT_OK");
  check("smoke_phase2694Marker", smoke.phase2694Marker === "PHASE2694_THIRTY_TOOL_TARGET_TWENTY_NINE_OK");
  check("smoke_phase2695Marker", smoke.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2666ThirtyMutationTargetOneStatus") || targetOne.includes("export function buildPhase2666ThirtyMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2666_THIRTY_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2667ThirtyMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2667ThirtyMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2667_THIRTY_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2668ThirtyMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2668ThirtyMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2668_THIRTY_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2669ThirtyMutationTargetFourStatus") || targetFour.includes("export function buildPhase2669ThirtyMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2669_THIRTY_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2670ThirtyMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2670ThirtyMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2670_THIRTY_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2671ThirtyMutationTargetSixStatus") || targetSix.includes("export function buildPhase2671ThirtyMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2671_THIRTY_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2672ThirtyMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2672ThirtyMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2672_THIRTY_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2673ThirtyMutationTargetEightStatus") || targetEight.includes("export function buildPhase2673ThirtyMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2673_THIRTY_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2674ThirtyMutationTargetNineStatus") || targetNine.includes("export function buildPhase2674ThirtyMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2674_THIRTY_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2675ThirtyMutationTargetTenStatus") || targetTen.includes("export function buildPhase2675ThirtyMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2675_THIRTY_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2676ThirtyMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2676ThirtyMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2676_THIRTY_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2677ThirtyMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2677ThirtyMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2677_THIRTY_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2678ThirtyMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2678ThirtyMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2678_THIRTY_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2679ThirtyMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2679ThirtyMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2679_THIRTY_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2680ThirtyMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2680ThirtyMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2680_THIRTY_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2681ThirtyMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase2681ThirtyMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2681_THIRTY_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase2682ThirtyMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase2682ThirtyMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE2682_THIRTY_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase2683ThirtyMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase2683ThirtyMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE2683_THIRTY_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase2684ThirtyMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase2684ThirtyMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE2684_THIRTY_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase2685ThirtyMutationTargetTwentyStatus") || targetTwenty.includes("export function buildPhase2685ThirtyMutationTargetTwentyStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE2685_THIRTY_TOOL_TARGET_TWENTY_OK"));
check("target-twenty-one_export", targetTwentyOne.includes("buildPhase2686ThirtyMutationTargetTwentyOneStatus") || targetTwentyOne.includes("export function buildPhase2686ThirtyMutationTargetTwentyOneStatus"));
check("target-twenty-one_marker", targetTwentyOne.includes("PHASE2686_THIRTY_TOOL_TARGET_TWENTY_ONE_OK"));
check("target-twenty-two_export", targetTwentyTwo.includes("buildPhase2687ThirtyMutationTargetTwentyTwoStatus") || targetTwentyTwo.includes("export function buildPhase2687ThirtyMutationTargetTwentyTwoStatus"));
check("target-twenty-two_marker", targetTwentyTwo.includes("PHASE2687_THIRTY_TOOL_TARGET_TWENTY_TWO_OK"));
check("target-twenty-three_export", targetTwentyThree.includes("buildPhase2688ThirtyMutationTargetTwentyThreeStatus") || targetTwentyThree.includes("export function buildPhase2688ThirtyMutationTargetTwentyThreeStatus"));
check("target-twenty-three_marker", targetTwentyThree.includes("PHASE2688_THIRTY_TOOL_TARGET_TWENTY_THREE_OK"));
check("target-twenty-four_export", targetTwentyFour.includes("buildPhase2689ThirtyMutationTargetTwentyFourStatus") || targetTwentyFour.includes("export function buildPhase2689ThirtyMutationTargetTwentyFourStatus"));
check("target-twenty-four_marker", targetTwentyFour.includes("PHASE2689_THIRTY_TOOL_TARGET_TWENTY_FOUR_OK"));
check("target-twenty-five_export", targetTwentyFive.includes("buildPhase2690ThirtyMutationTargetTwentyFiveStatus") || targetTwentyFive.includes("export function buildPhase2690ThirtyMutationTargetTwentyFiveStatus"));
check("target-twenty-five_marker", targetTwentyFive.includes("PHASE2690_THIRTY_TOOL_TARGET_TWENTY_FIVE_OK"));
check("target-twenty-six_export", targetTwentySix.includes("buildPhase2691ThirtyMutationTargetTwentySixStatus") || targetTwentySix.includes("export function buildPhase2691ThirtyMutationTargetTwentySixStatus"));
check("target-twenty-six_marker", targetTwentySix.includes("PHASE2691_THIRTY_TOOL_TARGET_TWENTY_SIX_OK"));
check("target-twenty-seven_export", targetTwentySeven.includes("buildPhase2692ThirtyMutationTargetTwentySevenStatus") || targetTwentySeven.includes("export function buildPhase2692ThirtyMutationTargetTwentySevenStatus"));
check("target-twenty-seven_marker", targetTwentySeven.includes("PHASE2692_THIRTY_TOOL_TARGET_TWENTY_SEVEN_OK"));
check("target-twenty-eight_export", targetTwentyEight.includes("buildPhase2693ThirtyMutationTargetTwentyEightStatus") || targetTwentyEight.includes("export function buildPhase2693ThirtyMutationTargetTwentyEightStatus"));
check("target-twenty-eight_marker", targetTwentyEight.includes("PHASE2693_THIRTY_TOOL_TARGET_TWENTY_EIGHT_OK"));
check("target-twenty-nine_export", targetTwentyNine.includes("buildPhase2694ThirtyMutationTargetTwentyNineStatus") || targetTwentyNine.includes("export function buildPhase2694ThirtyMutationTargetTwentyNineStatus"));
check("target-twenty-nine_marker", targetTwentyNine.includes("PHASE2694_THIRTY_TOOL_TARGET_TWENTY_NINE_OK"));
check("target-thirty_export", targetThirty.includes("buildPhase2695ThirtyMutationRuntimeStatus") || targetThirty.includes("export function buildPhase2695ThirtyMutationRuntimeStatus"));
check("target-thirty_marker", targetThirty.includes("PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_thirty", docs.includes("controlled thirty tool mutation"));
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
  phase2660Sealed: phase2660.recommendedSealed === true,
  thirtyMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 30,
  thirtyMutationApplied: result?.thirtyMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localThirtySmokePassed: result?.localThirtySmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, thirtyMutationApplied: verifierResult.thirtyMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localThirtySmokePassed: verifierResult.localThirtySmokePassed }, null, 2));
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
    "# Phase2661A-2695A Controlled Thirty Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- thirtyMutationApplied: ${Boolean(result.thirtyMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localThirtySmokePassed: ${Boolean(result.localThirtySmokePassed)}`,
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
