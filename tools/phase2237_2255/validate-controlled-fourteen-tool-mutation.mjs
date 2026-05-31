import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2237A-2255A-Controlled-Fourteen-Tool-Mutation";
const runnerPath = "tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2237-2255-controlled-fourteen-tool-mutation.md";
const approvalPath = "docs/phase2237-2255-controlled-fourteen-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2242-fourteen-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2243-fourteen-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2244-fourteen-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2245-fourteen-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2246-fourteen-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2247-fourteen-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2248-fourteen-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2249-fourteen-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2250-fourteen-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2251-fourteen-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2252-fourteen-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2253-fourteen-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2254-fourteen-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2255-fourteen-tool-mutation-target-fourteen.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase2237-2255-controlled-fourteen-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2237-2255-controlled-fourteen-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2237-2255-controlled-fourteen-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2237-2255-controlled-fourteen-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2237-2255-controlled-fourteen-tool-mutation/fourteen-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2236 = readJson("apps/ai-gateway-service/evidence/phase2219-2236-controlled-thirteen-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2237-2255-controlled-fourteen-tool-mutation"] === "node tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs --plan docs/phase2237-2255-controlled-fourteen-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2237-2255-controlled-fourteen-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2247FourteenMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2248FourteenMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2249FourteenMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2250FourteenMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2251FourteenMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2252FourteenMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2253FourteenMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2254FourteenMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2255FourteenMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2237-2255-controlled-fourteen-tool-mutation"] === "node tools/phase2237_2255/validate-controlled-fourteen-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2236_sealed", phase2236.recommendedSealed === true && phase2236.thirteenMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2237-2255-controlled-fourteen-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("fourteen_mutation_applied", result.fourteenMutationApplied === true);
  check("changed_file_count_fourteen", result.changedFileCount === 14);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localFourteenSmokePassed === true);
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
  check("rollback_restore_thirteen", rollback.rollbackAction === "restore-previous-content-fourteen");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_fourteen_entries", Array.isArray(rollback.files) && rollback.files.length === 14);
}

if (smoke) {
  check("smoke_phase2242Marker", smoke.phase2242Marker === "PHASE2242_FOURTEEN_TOOL_TARGET_ONE_OK");
  check("smoke_phase2243Marker", smoke.phase2243Marker === "PHASE2243_FOURTEEN_TOOL_TARGET_TWO_OK");
  check("smoke_phase2244Marker", smoke.phase2244Marker === "PHASE2244_FOURTEEN_TOOL_TARGET_THREE_OK");
  check("smoke_phase2245Marker", smoke.phase2245Marker === "PHASE2245_FOURTEEN_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2246Marker", smoke.phase2246Marker === "PHASE2246_FOURTEEN_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2247Marker", smoke.phase2247Marker === "PHASE2247_FOURTEEN_TOOL_TARGET_SIX_OK");
  check("smoke_phase2248Marker", smoke.phase2248Marker === "PHASE2248_FOURTEEN_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2249Marker", smoke.phase2249Marker === "PHASE2249_FOURTEEN_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2250Marker", smoke.phase2250Marker === "PHASE2250_FOURTEEN_TOOL_TARGET_NINE_OK");
  check("smoke_phase2251Marker", smoke.phase2251Marker === "PHASE2251_FOURTEEN_TOOL_TARGET_TEN_OK");
  check("smoke_phase2252Marker", smoke.phase2252Marker === "PHASE2252_FOURTEEN_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2253Marker", smoke.phase2253Marker === "PHASE2253_FOURTEEN_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2254Marker", smoke.phase2254Marker === "PHASE2254_FOURTEEN_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2255Marker", smoke.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2242FourteenMutationTargetOneStatus") || targetOne.includes("export function buildPhase2242FourteenMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2242_FOURTEEN_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2243FourteenMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2243FourteenMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2243_FOURTEEN_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2244FourteenMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2244FourteenMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2244_FOURTEEN_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2245FourteenMutationTargetFourStatus") || targetFour.includes("export function buildPhase2245FourteenMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2245_FOURTEEN_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2246FourteenMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2246FourteenMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2246_FOURTEEN_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2247FourteenMutationTargetSixStatus") || targetSix.includes("export function buildPhase2247FourteenMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2247_FOURTEEN_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2248FourteenMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2248FourteenMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2248_FOURTEEN_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2249FourteenMutationTargetEightStatus") || targetEight.includes("export function buildPhase2249FourteenMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2249_FOURTEEN_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2250FourteenMutationTargetNineStatus") || targetNine.includes("export function buildPhase2250FourteenMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2250_FOURTEEN_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2251FourteenMutationTargetTenStatus") || targetTen.includes("export function buildPhase2251FourteenMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2251_FOURTEEN_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2252FourteenMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2252FourteenMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2252_FOURTEEN_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2253FourteenMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2253FourteenMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2253_FOURTEEN_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2254FourteenMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2254FourteenMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2254_FOURTEEN_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2255FourteenMutationRuntimeStatus") || targetFourteen.includes("export function buildPhase2255FourteenMutationRuntimeStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_thirteen", docs.includes("controlled fourteen tool mutation"));
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
  phase2236Sealed: phase2236.recommendedSealed === true,
  fourteenMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 14,
  fourteenMutationApplied: result?.fourteenMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localFourteenSmokePassed: result?.localFourteenSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, fourteenMutationApplied: verifierResult.fourteenMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localFourteenSmokePassed: verifierResult.localFourteenSmokePassed }, null, 2));
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
    "# Phase2237A-2255A Controlled Fourteen Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- fourteenMutationApplied: ${Boolean(result.fourteenMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localFourteenSmokePassed: ${Boolean(result.localFourteenSmokePassed)}`,
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
