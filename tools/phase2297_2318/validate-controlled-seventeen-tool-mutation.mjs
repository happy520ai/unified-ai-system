import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2297A-2318A-Controlled-Seventeen-Tool-Mutation";
const runnerPath = "tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2297-2318-controlled-seventeen-tool-mutation.md";
const approvalPath = "docs/phase2297-2318-controlled-seventeen-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2302-seventeen-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2303-seventeen-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2304-seventeen-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2305-seventeen-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2306-seventeen-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2307-seventeen-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2308-seventeen-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2309-seventeen-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2310-seventeen-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2311-seventeen-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2312-seventeen-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2313-seventeen-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2314-seventeen-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2315-seventeen-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2316-seventeen-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2317-seventeen-tool-mutation-target-sixteen.proposal.diff";
const proposalSeventeenPath = "docs/phase2318-seventeen-tool-mutation-target-seventeen.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase2297-2318-controlled-seventeen-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2297-2318-controlled-seventeen-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2297-2318-controlled-seventeen-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2297-2318-controlled-seventeen-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2297-2318-controlled-seventeen-tool-mutation/seventeen-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2296 = readJson("apps/ai-gateway-service/evidence/phase2276-2296-controlled-sixteen-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2297-2318-controlled-seventeen-tool-mutation"] === "node tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs --plan docs/phase2297-2318-controlled-seventeen-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2297-2318-controlled-seventeen-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2307SeventeenMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2308SeventeenMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2309SeventeenMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2310SeventeenMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2311SeventeenMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2312SeventeenMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2313SeventeenMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2314SeventeenMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2315SeventeenMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2316SeventeenMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2317SeventeenMutationTargetSixteenStatus())))\" && node -e \"import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2318SeventeenMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2297-2318-controlled-seventeen-tool-mutation"] === "node tools/phase2297_2318/validate-controlled-seventeen-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2296_sealed", phase2296.recommendedSealed === true && phase2296.sixteenMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2297-2318-controlled-seventeen-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("seventeen_mutation_applied", result.seventeenMutationApplied === true);
  check("changed_file_count_seventeen", result.changedFileCount === 17);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localSeventeenSmokePassed === true);
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
  check("rollback_restore_seventeen", rollback.rollbackAction === "restore-previous-content-seventeen");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_seventeen_entries", Array.isArray(rollback.files) && rollback.files.length === 17);
}

if (smoke) {
  check("smoke_phase2302Marker", smoke.phase2302Marker === "PHASE2302_SEVENTEEN_TOOL_TARGET_ONE_OK");
  check("smoke_phase2303Marker", smoke.phase2303Marker === "PHASE2303_SEVENTEEN_TOOL_TARGET_TWO_OK");
  check("smoke_phase2304Marker", smoke.phase2304Marker === "PHASE2304_SEVENTEEN_TOOL_TARGET_THREE_OK");
  check("smoke_phase2305Marker", smoke.phase2305Marker === "PHASE2305_SEVENTEEN_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2306Marker", smoke.phase2306Marker === "PHASE2306_SEVENTEEN_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2307Marker", smoke.phase2307Marker === "PHASE2307_SEVENTEEN_TOOL_TARGET_SIX_OK");
  check("smoke_phase2308Marker", smoke.phase2308Marker === "PHASE2308_SEVENTEEN_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2309Marker", smoke.phase2309Marker === "PHASE2309_SEVENTEEN_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2310Marker", smoke.phase2310Marker === "PHASE2310_SEVENTEEN_TOOL_TARGET_NINE_OK");
  check("smoke_phase2311Marker", smoke.phase2311Marker === "PHASE2311_SEVENTEEN_TOOL_TARGET_TEN_OK");
  check("smoke_phase2312Marker", smoke.phase2312Marker === "PHASE2312_SEVENTEEN_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2313Marker", smoke.phase2313Marker === "PHASE2313_SEVENTEEN_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2314Marker", smoke.phase2314Marker === "PHASE2314_SEVENTEEN_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2315Marker", smoke.phase2315Marker === "PHASE2315_SEVENTEEN_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2316Marker", smoke.phase2316Marker === "PHASE2316_SEVENTEEN_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2317Marker", smoke.phase2317Marker === "PHASE2317_SEVENTEEN_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_phase2318Marker", smoke.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2302SeventeenMutationTargetOneStatus") || targetOne.includes("export function buildPhase2302SeventeenMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2302_SEVENTEEN_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2303SeventeenMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2303SeventeenMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2303_SEVENTEEN_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2304SeventeenMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2304SeventeenMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2304_SEVENTEEN_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2305SeventeenMutationTargetFourStatus") || targetFour.includes("export function buildPhase2305SeventeenMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2305_SEVENTEEN_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2306SeventeenMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2306SeventeenMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2306_SEVENTEEN_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2307SeventeenMutationTargetSixStatus") || targetSix.includes("export function buildPhase2307SeventeenMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2307_SEVENTEEN_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2308SeventeenMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2308SeventeenMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2308_SEVENTEEN_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2309SeventeenMutationTargetEightStatus") || targetEight.includes("export function buildPhase2309SeventeenMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2309_SEVENTEEN_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2310SeventeenMutationTargetNineStatus") || targetNine.includes("export function buildPhase2310SeventeenMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2310_SEVENTEEN_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2311SeventeenMutationTargetTenStatus") || targetTen.includes("export function buildPhase2311SeventeenMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2311_SEVENTEEN_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2312SeventeenMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2312SeventeenMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2312_SEVENTEEN_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2313SeventeenMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2313SeventeenMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2313_SEVENTEEN_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2314SeventeenMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2314SeventeenMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2314_SEVENTEEN_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2315SeventeenMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2315SeventeenMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2315_SEVENTEEN_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2316SeventeenMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2316SeventeenMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2316_SEVENTEEN_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2317SeventeenMutationTargetSixteenStatus") || targetSixteen.includes("export function buildPhase2317SeventeenMutationTargetSixteenStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2317_SEVENTEEN_TOOL_TARGET_SIXTEEN_OK"));
check("target-seventeen_export", targetSeventeen.includes("buildPhase2318SeventeenMutationRuntimeStatus") || targetSeventeen.includes("export function buildPhase2318SeventeenMutationRuntimeStatus"));
check("target-seventeen_marker", targetSeventeen.includes("PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_seventeen", docs.includes("controlled seventeen tool mutation"));
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
  phase2296Sealed: phase2296.recommendedSealed === true,
  seventeenMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 17,
  seventeenMutationApplied: result?.seventeenMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localSeventeenSmokePassed: result?.localSeventeenSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, seventeenMutationApplied: verifierResult.seventeenMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localSeventeenSmokePassed: verifierResult.localSeventeenSmokePassed }, null, 2));
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
    "# Phase2297A-2318A Controlled Seventeen Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- seventeenMutationApplied: ${Boolean(result.seventeenMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localSeventeenSmokePassed: ${Boolean(result.localSeventeenSmokePassed)}`,
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
