import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2366A-2390A-Controlled-Twenty-Tool-Mutation";
const runnerPath = "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2366-2390-controlled-twenty-tool-mutation.md";
const approvalPath = "docs/phase2366-2390-controlled-twenty-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2371-twenty-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2372-twenty-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2373-twenty-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2374-twenty-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2375-twenty-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2376-twenty-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2377-twenty-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2378-twenty-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2379-twenty-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2380-twenty-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2381-twenty-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2382-twenty-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2383-twenty-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2384-twenty-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2385-twenty-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2386-twenty-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase2387-twenty-tool-mutation-target-seventeen.proposal.diff";
const proposalEighteenPath = "docs/phase2388-twenty-tool-mutation-target-eighteen.proposal.diff";
const proposalNineteenPath = "docs/phase2389-twenty-tool-mutation-target-nineteen.proposal.diff";
const proposalTwentyPath = "docs/phase2390-twenty-tool-mutation-target-twenty.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase2366-2390-controlled-twenty-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2366-2390-controlled-twenty-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2366-2390-controlled-twenty-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2366-2390-controlled-twenty-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2366-2390-controlled-twenty-tool-mutation/twenty-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2365 = readJson("apps/ai-gateway-service/evidence/phase2342-2365-controlled-nineteen-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2366-2390-controlled-twenty-tool-mutation"] === "node tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs --plan docs/phase2366-2390-controlled-twenty-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2366-2390-controlled-twenty-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2376TwentyMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2377TwentyMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2378TwentyMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2379TwentyMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2380TwentyMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2381TwentyMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2382TwentyMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2383TwentyMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2384TwentyMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2385TwentyMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2386TwentyMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2387TwentyMutationTargetSeventeenStatus())))\" && node -e \"import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2388TwentyMutationTargetEighteenStatus())))\" && node -e \"import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2389TwentyMutationTargetNineteenStatus())))\" && node -e \"import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2390TwentyMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2366-2390-controlled-twenty-tool-mutation"] === "node tools/phase2366_2390/validate-controlled-twenty-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2365_sealed", phase2365.recommendedSealed === true && phase2365.nineteenMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2366-2390-controlled-twenty-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("twenty_mutation_applied", result.twentyMutationApplied === true);
  check("changed_file_count_twenty", result.changedFileCount === 20);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localTwentySmokePassed === true);
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
  check("rollback_restore_twenty", rollback.rollbackAction === "restore-previous-content-twenty");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_twenty_entries", Array.isArray(rollback.files) && rollback.files.length === 20);
}

if (smoke) {
  check("smoke_phase2371Marker", smoke.phase2371Marker === "PHASE2371_TWENTY_TOOL_TARGET_ONE_OK");
  check("smoke_phase2372Marker", smoke.phase2372Marker === "PHASE2372_TWENTY_TOOL_TARGET_TWO_OK");
  check("smoke_phase2373Marker", smoke.phase2373Marker === "PHASE2373_TWENTY_TOOL_TARGET_THREE_OK");
  check("smoke_phase2374Marker", smoke.phase2374Marker === "PHASE2374_TWENTY_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2375Marker", smoke.phase2375Marker === "PHASE2375_TWENTY_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2376Marker", smoke.phase2376Marker === "PHASE2376_TWENTY_TOOL_TARGET_SIX_OK");
  check("smoke_phase2377Marker", smoke.phase2377Marker === "PHASE2377_TWENTY_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2378Marker", smoke.phase2378Marker === "PHASE2378_TWENTY_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2379Marker", smoke.phase2379Marker === "PHASE2379_TWENTY_TOOL_TARGET_NINE_OK");
  check("smoke_phase2380Marker", smoke.phase2380Marker === "PHASE2380_TWENTY_TOOL_TARGET_TEN_OK");
  check("smoke_phase2381Marker", smoke.phase2381Marker === "PHASE2381_TWENTY_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2382Marker", smoke.phase2382Marker === "PHASE2382_TWENTY_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2383Marker", smoke.phase2383Marker === "PHASE2383_TWENTY_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2384Marker", smoke.phase2384Marker === "PHASE2384_TWENTY_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2385Marker", smoke.phase2385Marker === "PHASE2385_TWENTY_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2386Marker", smoke.phase2386Marker === "PHASE2386_TWENTY_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase2387Marker", smoke.phase2387Marker === "PHASE2387_TWENTY_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_phase2388Marker", smoke.phase2388Marker === "PHASE2388_TWENTY_TOOL_TARGET_EIGHTEEN_OK");
  check("smoke_phase2389Marker", smoke.phase2389Marker === "PHASE2389_TWENTY_TOOL_TARGET_NINETEEN_OK");
  check("smoke_phase2390Marker", smoke.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2371TwentyMutationTargetOneStatus") || targetOne.includes("export function buildPhase2371TwentyMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2371_TWENTY_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2372TwentyMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2372TwentyMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2372_TWENTY_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2373TwentyMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2373TwentyMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2373_TWENTY_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2374TwentyMutationTargetFourStatus") || targetFour.includes("export function buildPhase2374TwentyMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2374_TWENTY_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2375TwentyMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2375TwentyMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2375_TWENTY_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2376TwentyMutationTargetSixStatus") || targetSix.includes("export function buildPhase2376TwentyMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2376_TWENTY_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2377TwentyMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2377TwentyMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2377_TWENTY_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2378TwentyMutationTargetEightStatus") || targetEight.includes("export function buildPhase2378TwentyMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2378_TWENTY_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2379TwentyMutationTargetNineStatus") || targetNine.includes("export function buildPhase2379TwentyMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2379_TWENTY_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2380TwentyMutationTargetTenStatus") || targetTen.includes("export function buildPhase2380TwentyMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2380_TWENTY_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2381TwentyMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2381TwentyMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2381_TWENTY_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2382TwentyMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2382TwentyMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2382_TWENTY_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2383TwentyMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2383TwentyMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2383_TWENTY_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2384TwentyMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2384TwentyMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2384_TWENTY_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2385TwentyMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2385TwentyMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2385_TWENTY_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2386TwentyMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase2386TwentyMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2386_TWENTY_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase2387TwentyMutationTargetSeventeenStatus") || targetSeventeen.includes("export function buildPhase2387TwentyMutationTargetSeventeenStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE2387_TWENTY_TOOL_TARGET_SEVENTEEN_OK"));
check("target-eighteen_export", targetEighteen.includes("buildPhase2388TwentyMutationTargetEighteenStatus") || targetEighteen.includes("export function buildPhase2388TwentyMutationTargetEighteenStatus"));
check("target-eighteen_marker", targetEighteen.includes("PHASE2388_TWENTY_TOOL_TARGET_EIGHTEEN_OK"));
check("target-nineteen_export", targetNineteen.includes("buildPhase2389TwentyMutationTargetNineteenStatus") || targetNineteen.includes("export function buildPhase2389TwentyMutationTargetNineteenStatus"));
check("target-nineteen_marker", targetNineteen.includes("PHASE2389_TWENTY_TOOL_TARGET_NINETEEN_OK"));
check("target-twenty_export", targetTwenty.includes("buildPhase2390TwentyMutationRuntimeStatus") || targetTwenty.includes("export function buildPhase2390TwentyMutationRuntimeStatus"));
check("target-twenty_marker", targetTwenty.includes("PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_twenty", docs.includes("controlled twenty tool mutation"));
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
  phase2365Sealed: phase2365.recommendedSealed === true,
  twentyMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 20,
  twentyMutationApplied: result?.twentyMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localTwentySmokePassed: result?.localTwentySmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, twentyMutationApplied: verifierResult.twentyMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localTwentySmokePassed: verifierResult.localTwentySmokePassed }, null, 2));
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
    "# Phase2366A-2390A Controlled Twenty Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- twentyMutationApplied: ${Boolean(result.twentyMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localTwentySmokePassed: ${Boolean(result.localTwentySmokePassed)}`,
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
