import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2219A-2236A-Controlled-Thirteen-Tool-Mutation";
const runnerPath = "tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2219-2236-controlled-thirteen-tool-mutation.md";
const approvalPath = "docs/phase2219-2236-controlled-thirteen-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2224-thirteen-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2225-thirteen-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2226-thirteen-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2227-thirteen-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2228-thirteen-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2229-thirteen-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2230-thirteen-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2231-thirteen-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2232-thirteen-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2233-thirteen-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2234-thirteen-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2235-thirteen-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2236-thirteen-tool-mutation-target-thirteen.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase2219-2236-controlled-thirteen-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2219-2236-controlled-thirteen-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2219-2236-controlled-thirteen-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2219-2236-controlled-thirteen-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2219-2236-controlled-thirteen-tool-mutation/thirteen-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2218 = readJson("apps/ai-gateway-service/evidence/phase2202-2218-controlled-twelve-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2219-2236-controlled-thirteen-tool-mutation"] === "node tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs --plan docs/phase2219-2236-controlled-thirteen-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2219-2236-controlled-thirteen-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2229ThirteenMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2230ThirteenMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2231ThirteenMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2232ThirteenMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2233ThirteenMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2234ThirteenMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2235ThirteenMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2236ThirteenMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2219-2236-controlled-thirteen-tool-mutation"] === "node tools/phase2219_2236/validate-controlled-thirteen-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2218_sealed", phase2218.recommendedSealed === true && phase2218.twelveMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2219-2236-controlled-thirteen-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("thirteen_mutation_applied", result.thirteenMutationApplied === true);
  check("changed_file_count_thirteen", result.changedFileCount === 13);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localThirteenSmokePassed === true);
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
  check("rollback_restore_thirteen", rollback.rollbackAction === "restore-previous-content-thirteen");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_thirteen_entries", Array.isArray(rollback.files) && rollback.files.length === 13);
}

if (smoke) {
  check("smoke_phase2224Marker", smoke.phase2224Marker === "PHASE2224_THIRTEEN_TOOL_TARGET_ONE_OK");
  check("smoke_phase2225Marker", smoke.phase2225Marker === "PHASE2225_THIRTEEN_TOOL_TARGET_TWO_OK");
  check("smoke_phase2226Marker", smoke.phase2226Marker === "PHASE2226_THIRTEEN_TOOL_TARGET_THREE_OK");
  check("smoke_phase2227Marker", smoke.phase2227Marker === "PHASE2227_THIRTEEN_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2228Marker", smoke.phase2228Marker === "PHASE2228_THIRTEEN_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2229Marker", smoke.phase2229Marker === "PHASE2229_THIRTEEN_TOOL_TARGET_SIX_OK");
  check("smoke_phase2230Marker", smoke.phase2230Marker === "PHASE2230_THIRTEEN_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2231Marker", smoke.phase2231Marker === "PHASE2231_THIRTEEN_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2232Marker", smoke.phase2232Marker === "PHASE2232_THIRTEEN_TOOL_TARGET_NINE_OK");
  check("smoke_phase2233Marker", smoke.phase2233Marker === "PHASE2233_THIRTEEN_TOOL_TARGET_TEN_OK");
  check("smoke_phase2234Marker", smoke.phase2234Marker === "PHASE2234_THIRTEEN_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2235Marker", smoke.phase2235Marker === "PHASE2235_THIRTEEN_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2236Marker", smoke.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2224ThirteenMutationTargetOneStatus") || targetOne.includes("export function buildPhase2224ThirteenMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2224_THIRTEEN_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2225ThirteenMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2225ThirteenMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2225_THIRTEEN_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2226ThirteenMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2226ThirteenMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2226_THIRTEEN_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2227ThirteenMutationTargetFourStatus") || targetFour.includes("export function buildPhase2227ThirteenMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2227_THIRTEEN_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2228ThirteenMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2228ThirteenMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2228_THIRTEEN_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2229ThirteenMutationTargetSixStatus") || targetSix.includes("export function buildPhase2229ThirteenMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2229_THIRTEEN_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2230ThirteenMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2230ThirteenMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2230_THIRTEEN_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2231ThirteenMutationTargetEightStatus") || targetEight.includes("export function buildPhase2231ThirteenMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2231_THIRTEEN_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2232ThirteenMutationTargetNineStatus") || targetNine.includes("export function buildPhase2232ThirteenMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2232_THIRTEEN_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2233ThirteenMutationTargetTenStatus") || targetTen.includes("export function buildPhase2233ThirteenMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2233_THIRTEEN_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2234ThirteenMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2234ThirteenMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2234_THIRTEEN_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2235ThirteenMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2235ThirteenMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2235_THIRTEEN_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2236ThirteenMutationRuntimeStatus") || targetThirteen.includes("export function buildPhase2236ThirteenMutationRuntimeStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_thirteen", docs.includes("controlled thirteen tool mutation"));
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
  phase2218Sealed: phase2218.recommendedSealed === true,
  thirteenMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 13,
  thirteenMutationApplied: result?.thirteenMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localThirteenSmokePassed: result?.localThirteenSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, thirteenMutationApplied: verifierResult.thirteenMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localThirteenSmokePassed: verifierResult.localThirteenSmokePassed }, null, 2));
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
    "# Phase2219A-2236A Controlled Thirteen Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- thirteenMutationApplied: ${Boolean(result.thirteenMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localThirteenSmokePassed: ${Boolean(result.localThirteenSmokePassed)}`,
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
