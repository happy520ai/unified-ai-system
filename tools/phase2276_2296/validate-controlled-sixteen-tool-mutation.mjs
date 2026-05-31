import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2276A-2296A-Controlled-Sixteen-Tool-Mutation";
const runnerPath = "tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "docs/phase2276-2296-controlled-sixteen-tool-mutation.md";
const approvalPath = "docs/phase2276-2296-controlled-sixteen-tool-mutation-approval.example.json";
const proposalOnePath = "docs/phase2281-sixteen-tool-mutation-target-one.proposal.diff";
const proposalTwoPath = "docs/phase2282-sixteen-tool-mutation-target-two.proposal.diff";
const proposalThreePath = "docs/phase2283-sixteen-tool-mutation-target-three.proposal.diff";
const proposalFourPath = "docs/phase2284-sixteen-tool-mutation-target-four.proposal.diff";
const proposalFivePath = "docs/phase2285-sixteen-tool-mutation-target-five.proposal.diff";
const proposalSixPath = "docs/phase2286-sixteen-tool-mutation-target-six.proposal.diff";
const proposalSevenPath = "docs/phase2287-sixteen-tool-mutation-target-seven.proposal.diff";
const proposalEightPath = "docs/phase2288-sixteen-tool-mutation-target-eight.proposal.diff";
const proposalNinePath = "docs/phase2289-sixteen-tool-mutation-target-nine.proposal.diff";
const proposalTenPath = "docs/phase2290-sixteen-tool-mutation-target-ten.proposal.diff";
const proposalElevenPath = "docs/phase2291-sixteen-tool-mutation-target-eleven.proposal.diff";
const proposalTwelvePath = "docs/phase2292-sixteen-tool-mutation-target-twelve.proposal.diff";
const proposalThirteenPath = "docs/phase2293-sixteen-tool-mutation-target-thirteen.proposal.diff";
const proposalFourteenPath = "docs/phase2294-sixteen-tool-mutation-target-fourteen.proposal.diff";
const proposalFifteenPath = "docs/phase2295-sixteen-tool-mutation-target-fifteen.proposal.diff";
const proposalSixteenPath = "docs/phase2296-sixteen-tool-mutation-target-sixteen.proposal.diff";
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
const evidenceDir = "apps/ai-gateway-service/evidence/phase2276-2296-controlled-sixteen-tool-mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase2276-2296-controlled-sixteen-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2276-2296-controlled-sixteen-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2276-2296-controlled-sixteen-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2276-2296-controlled-sixteen-tool-mutation/sixteen-smoke.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2275 = readJson("apps/ai-gateway-service/evidence/phase2256-2275-controlled-fifteen-tool-mutation/result.json") || {};
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
check("package_apply_script_registered", packageJson.scripts?.["apply:phase2276-2296-controlled-sixteen-tool-mutation"] === "node tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs --plan docs/phase2276-2296-controlled-sixteen-tool-mutation-approval.example.json");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["smoke:phase2276-2296-controlled-sixteen-tool-mutation"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\" && node -e \"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2286SixteenMutationTargetSixStatus())))\" && node -e \"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2287SixteenMutationTargetSevenStatus())))\" && node -e \"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2288SixteenMutationTargetEightStatus())))\" && node -e \"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2289SixteenMutationTargetNineStatus())))\" && node -e \"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2290SixteenMutationTargetTenStatus())))\" && node -e \"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2291SixteenMutationTargetElevenStatus())))\" && node -e \"import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2292SixteenMutationTargetTwelveStatus())))\" && node -e \"import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2293SixteenMutationTargetThirteenStatus())))\" && node -e \"import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2294SixteenMutationTargetFourteenStatus())))\" && node -e \"import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2295SixteenMutationTargetFifteenStatus())))\" && node -e \"import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2296SixteenMutationRuntimeStatus())))\"",
);
check("package_verify_script_registered", packageJson.scripts?.["verify:phase2276-2296-controlled-sixteen-tool-mutation"] === "node tools/phase2276_2296/validate-controlled-sixteen-tool-mutation.mjs");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2275_sealed", phase2275.recommendedSealed === true && phase2275.fifteenMutationApplied === true);
check("result_exists", result !== null, "run apply:phase2276-2296-controlled-sixteen-tool-mutation first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("sixteen_mutation_applied", result.sixteenMutationApplied === true);
  check("changed_file_count_sixteen", result.changedFileCount === 16);
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
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localSixteenSmokePassed === true);
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
  check("rollback_restore_sixteen", rollback.rollbackAction === "restore-previous-content-sixteen");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_sixteen_entries", Array.isArray(rollback.files) && rollback.files.length === 16);
}

if (smoke) {
  check("smoke_phase2281Marker", smoke.phase2281Marker === "PHASE2281_SIXTEEN_TOOL_TARGET_ONE_OK");
  check("smoke_phase2282Marker", smoke.phase2282Marker === "PHASE2282_SIXTEEN_TOOL_TARGET_TWO_OK");
  check("smoke_phase2283Marker", smoke.phase2283Marker === "PHASE2283_SIXTEEN_TOOL_TARGET_THREE_OK");
  check("smoke_phase2284Marker", smoke.phase2284Marker === "PHASE2284_SIXTEEN_TOOL_TARGET_FOUR_OK");
  check("smoke_phase2285Marker", smoke.phase2285Marker === "PHASE2285_SIXTEEN_TOOL_TARGET_FIVE_OK");
  check("smoke_phase2286Marker", smoke.phase2286Marker === "PHASE2286_SIXTEEN_TOOL_TARGET_SIX_OK");
  check("smoke_phase2287Marker", smoke.phase2287Marker === "PHASE2287_SIXTEEN_TOOL_TARGET_SEVEN_OK");
  check("smoke_phase2288Marker", smoke.phase2288Marker === "PHASE2288_SIXTEEN_TOOL_TARGET_EIGHT_OK");
  check("smoke_phase2289Marker", smoke.phase2289Marker === "PHASE2289_SIXTEEN_TOOL_TARGET_NINE_OK");
  check("smoke_phase2290Marker", smoke.phase2290Marker === "PHASE2290_SIXTEEN_TOOL_TARGET_TEN_OK");
  check("smoke_phase2291Marker", smoke.phase2291Marker === "PHASE2291_SIXTEEN_TOOL_TARGET_ELEVEN_OK");
  check("smoke_phase2292Marker", smoke.phase2292Marker === "PHASE2292_SIXTEEN_TOOL_TARGET_TWELVE_OK");
  check("smoke_phase2293Marker", smoke.phase2293Marker === "PHASE2293_SIXTEEN_TOOL_TARGET_THIRTEEN_OK");
  check("smoke_phase2294Marker", smoke.phase2294Marker === "PHASE2294_SIXTEEN_TOOL_TARGET_FOURTEEN_OK");
  check("smoke_phase2295Marker", smoke.phase2295Marker === "PHASE2295_SIXTEEN_TOOL_TARGET_FIFTEEN_OK");
  check("smoke_phase2296Marker", smoke.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK");
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

check("target-one_export", targetOne.includes("buildPhase2281SixteenMutationTargetOneStatus") || targetOne.includes("export function buildPhase2281SixteenMutationTargetOneStatus"));
check("target-one_marker", targetOne.includes("PHASE2281_SIXTEEN_TOOL_TARGET_ONE_OK"));
check("target-two_export", targetTwo.includes("buildPhase2282SixteenMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2282SixteenMutationTargetTwoStatus"));
check("target-two_marker", targetTwo.includes("PHASE2282_SIXTEEN_TOOL_TARGET_TWO_OK"));
check("target-three_export", targetThree.includes("buildPhase2283SixteenMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2283SixteenMutationTargetThreeStatus"));
check("target-three_marker", targetThree.includes("PHASE2283_SIXTEEN_TOOL_TARGET_THREE_OK"));
check("target-four_export", targetFour.includes("buildPhase2284SixteenMutationTargetFourStatus") || targetFour.includes("export function buildPhase2284SixteenMutationTargetFourStatus"));
check("target-four_marker", targetFour.includes("PHASE2284_SIXTEEN_TOOL_TARGET_FOUR_OK"));
check("target-five_export", targetFive.includes("buildPhase2285SixteenMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2285SixteenMutationTargetFiveStatus"));
check("target-five_marker", targetFive.includes("PHASE2285_SIXTEEN_TOOL_TARGET_FIVE_OK"));
check("target-six_export", targetSix.includes("buildPhase2286SixteenMutationTargetSixStatus") || targetSix.includes("export function buildPhase2286SixteenMutationTargetSixStatus"));
check("target-six_marker", targetSix.includes("PHASE2286_SIXTEEN_TOOL_TARGET_SIX_OK"));
check("target-seven_export", targetSeven.includes("buildPhase2287SixteenMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2287SixteenMutationTargetSevenStatus"));
check("target-seven_marker", targetSeven.includes("PHASE2287_SIXTEEN_TOOL_TARGET_SEVEN_OK"));
check("target-eight_export", targetEight.includes("buildPhase2288SixteenMutationTargetEightStatus") || targetEight.includes("export function buildPhase2288SixteenMutationTargetEightStatus"));
check("target-eight_marker", targetEight.includes("PHASE2288_SIXTEEN_TOOL_TARGET_EIGHT_OK"));
check("target-nine_export", targetNine.includes("buildPhase2289SixteenMutationTargetNineStatus") || targetNine.includes("export function buildPhase2289SixteenMutationTargetNineStatus"));
check("target-nine_marker", targetNine.includes("PHASE2289_SIXTEEN_TOOL_TARGET_NINE_OK"));
check("target-ten_export", targetTen.includes("buildPhase2290SixteenMutationTargetTenStatus") || targetTen.includes("export function buildPhase2290SixteenMutationTargetTenStatus"));
check("target-ten_marker", targetTen.includes("PHASE2290_SIXTEEN_TOOL_TARGET_TEN_OK"));
check("target-eleven_export", targetEleven.includes("buildPhase2291SixteenMutationTargetElevenStatus") || targetEleven.includes("export function buildPhase2291SixteenMutationTargetElevenStatus"));
check("target-eleven_marker", targetEleven.includes("PHASE2291_SIXTEEN_TOOL_TARGET_ELEVEN_OK"));
check("target-twelve_export", targetTwelve.includes("buildPhase2292SixteenMutationTargetTwelveStatus") || targetTwelve.includes("export function buildPhase2292SixteenMutationTargetTwelveStatus"));
check("target-twelve_marker", targetTwelve.includes("PHASE2292_SIXTEEN_TOOL_TARGET_TWELVE_OK"));
check("target-thirteen_export", targetThirteen.includes("buildPhase2293SixteenMutationTargetThirteenStatus") || targetThirteen.includes("export function buildPhase2293SixteenMutationTargetThirteenStatus"));
check("target-thirteen_marker", targetThirteen.includes("PHASE2293_SIXTEEN_TOOL_TARGET_THIRTEEN_OK"));
check("target-fourteen_export", targetFourteen.includes("buildPhase2294SixteenMutationTargetFourteenStatus") || targetFourteen.includes("export function buildPhase2294SixteenMutationTargetFourteenStatus"));
check("target-fourteen_marker", targetFourteen.includes("PHASE2294_SIXTEEN_TOOL_TARGET_FOURTEEN_OK"));
check("target-fifteen_export", targetFifteen.includes("buildPhase2295SixteenMutationTargetFifteenStatus") || targetFifteen.includes("export function buildPhase2295SixteenMutationTargetFifteenStatus"));
check("target-fifteen_marker", targetFifteen.includes("PHASE2295_SIXTEEN_TOOL_TARGET_FIFTEEN_OK"));
check("target-sixteen_export", targetSixteen.includes("buildPhase2296SixteenMutationRuntimeStatus") || targetSixteen.includes("export function buildPhase2296SixteenMutationRuntimeStatus"));
check("target-sixteen_marker", targetSixteen.includes("PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK"));
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_sixteen", docs.includes("controlled sixteen tool mutation"));
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
  phase2275Sealed: phase2275.recommendedSealed === true,
  sixteenMutationReady: completed,
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
  ],
  changedFileCount: result?.changedFileCount ?? 16,
  sixteenMutationApplied: result?.sixteenMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localSixteenSmokePassed: result?.localSixteenSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, sixteenMutationApplied: verifierResult.sixteenMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localSixteenSmokePassed: verifierResult.localSixteenSmokePassed }, null, 2));
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
    "# Phase2276A-2296A Controlled Sixteen Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- sixteenMutationApplied: ${Boolean(result.sixteenMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localSixteenSmokePassed: ${Boolean(result.localSixteenSmokePassed)}`,
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
