import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2087A-Real-Local-Operation-Bridge";
const runnerPath = "tools/phase2087/run-real-local-operation-bridge.mjs";
const docsPath = "docs/phase2087-real-local-operation-bridge.md";
const approvalExamplePath = "docs/phase2087-real-local-operation-approval.example.json";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2087-real-local-operation-bridge";
const resultPath = `${evidenceDir}/result.json`;
const resultMdPath = `${evidenceDir}/result.md`;
const packageScriptName = "verify:phase2087-real-local-operation-bridge";
const runScriptName = "run:phase2087-real-local-operation-bridge";
const smokeScriptName = "smoke:phase2087-real-local-operation-bridge-real-local";
const realSmokeOutputPath = `${evidenceDir}/real-local-smoke-output.json`;
const realSmokeResultPath = `${evidenceDir}/real-local-smoke-result.json`;
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632Preflight = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};

check("runner_exists", existsSync(resolve(runnerPath)));
check("docs_exists", existsSync(resolve(docsPath)));
check("approval_example_exists", existsSync(resolve(approvalExamplePath)));
check(
  "package_verify_script_registered",
  packageJson.scripts?.[packageScriptName] === "node tools/phase2087/validate-real-local-operation-bridge.mjs",
);
check(
  "package_run_script_registered",
  packageJson.scripts?.[runScriptName] === "node tools/phase2087/run-real-local-operation-bridge.mjs",
);
check(
  "package_smoke_script_registered",
  packageJson.scripts?.[smokeScriptName] ===
    "node tools/phase2087/run-real-local-operation-bridge.mjs --plan docs/phase2087-real-local-operation-approval.example.json",
);
check("phase632_preflight_passed", phase632Preflight.preflightPassed === true && phase632Preflight.staleFalse === true);

let smoke = null;
if (existsSync(resolve(runnerPath)) && existsSync(resolve(approvalExamplePath))) {
  const smokeResult = spawnSync(
    process.execPath,
    [runnerPath, "--plan", approvalExamplePath],
    {
      cwd: repoRoot,
      encoding: "utf8",
      shell: false,
      timeout: 120000,
    },
  );
  check("real_local_smoke_command_exit_zero", smokeResult.status === 0, smokeResult.stderr || smokeResult.stdout);
  smoke = readJson(realSmokeResultPath);
  check("real_local_smoke_result_exists", smoke !== null);
} else {
  check("real_local_smoke_command_exit_zero", false, "runner or approval example missing");
  check("real_local_smoke_result_exists", false, "runner or approval example missing");
}

const output = readJson(realSmokeOutputPath);
if (smoke) {
  check("bridge_ready", smoke.realLocalOperationBridgeReady === true);
  check("real_execution_performed", smoke.realExecutionPerformed === true);
  check("external_tool_invoked", smoke.externalToolInvoked === true);
  check("external_tool_kind_local_node", smoke.externalToolKind === "local-node");
  check("opencode_detected_field_present", typeof smoke.opencodeDetected === "boolean");
  check("codex_detected_field_present", typeof smoke.codexDetected === "boolean");
  check("workspace_clean_not_claimed", smoke.workspaceCleanClaimed === false);
  check("provider_false", smoke.providerCallsMade === false && smoke.paidProviderCallsMade === false);
  check("secret_false", smoke.secretRead === false && smoke.authJsonRead === false && smoke.envRead === false);
  check("codex_config_false", smoke.codexConfigModified === false && smoke.codexBaseUrlModified === false);
  check("chat_false", smoke.chatModified === false && smoke.chatGatewayExecuteModified === false);
  check("deploy_release_false", smoke.deployExecuted === false && smoke.releaseExecuted === false);
  check("push_commit_false", smoke.pushExecuted === false && smoke.commitCreated === false);
  check("allowed_file_written", Array.isArray(smoke.writtenFiles) && smoke.writtenFiles.includes(realSmokeOutputPath));
}
if (output) {
  check("real_smoke_output_written", output.phaseId === phaseId && output.realLocalSmoke === true);
  check("real_smoke_output_not_dry_run", output.dryRun === false);
}

const docs = existsSync(resolve(docsPath)) ? readText(docsPath) : "";
check("docs_boundary_mentions_opencode", docs.includes("OpenCode") && docs.includes("Codex"));
check("docs_boundary_mentions_no_chat", docs.includes("default /chat unchanged") || docs.includes("default `/chat` unchanged"));
check("docs_boundary_mentions_no_provider", docs.includes("providerCallsMade=false"));
check("docs_boundary_mentions_no_commit_push", docs.includes("commitCreated=false") && docs.includes("pushExecuted=false"));

const failed = checks.filter((entry) => !entry.pass);
const completed = failed.length === 0;
const result = {
  phaseId,
  completed,
  status: completed ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  realLocalOperationBridgeReady: smoke?.realLocalOperationBridgeReady === true,
  realLocalSmokeExecuted: smoke?.realExecutionPerformed === true,
  externalToolInvoked: smoke?.externalToolInvoked === true,
  externalToolKind: smoke?.externalToolKind || null,
  opencodeDetected: smoke?.opencodeDetected ?? null,
  codexDetected: smoke?.codexDetected ?? null,
  approvalRecordRequired: smoke?.approvalRecordRequired === true,
  allowedFilesRequired: smoke?.allowedFilesRequired === true,
  forbiddenPathsEnforced: smoke?.forbiddenPathsEnforced === true,
  phase632PreflightPassed: phase632Preflight.preflightPassed === true,
  providerCallsMade: false,
  paidProviderCallsMade: false,
  secretRead: false,
  authJsonRead: false,
  envRead: false,
  codexConfigModified: false,
  codexBaseUrlModified: false,
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
  evidenceRefs: {
    result: resultPath,
    realSmokeResult: realSmokeResultPath,
    realSmokeOutput: realSmokeOutputPath,
  },
  blocker: completed ? "none" : failed.map((entry) => entry.id).join(", "),
  recommendedSealed: completed,
  checks,
};

writeJson(resultPath, result);
writeText(resultMdPath, renderMarkdown(result));
console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  realLocalSmokeExecuted: result.realLocalSmokeExecuted,
  externalToolKind: result.externalToolKind,
}, null, 2));
if (!result.recommendedSealed) process.exit(1);

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
    "# Phase2087A Real Local Operation Bridge Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${result.recommendedSealed}`,
    `- blocker: ${result.blocker}`,
    `- realLocalSmokeExecuted: ${result.realLocalSmokeExecuted}`,
    `- externalToolInvoked: ${result.externalToolInvoked}`,
    `- externalToolKind: ${result.externalToolKind}`,
    `- opencodeDetected: ${result.opencodeDetected}`,
    `- codexDetected: ${result.codexDetected}`,
    `- approvalRecordRequired: ${result.approvalRecordRequired}`,
    `- allowedFilesRequired: ${result.allowedFilesRequired}`,
    `- forbiddenPathsEnforced: ${result.forbiddenPathsEnforced}`,
    `- phase632PreflightPassed: ${result.phase632PreflightPassed}`,
    `- providerCallsMade: ${result.providerCallsMade}`,
    `- paidProviderCallsMade: ${result.paidProviderCallsMade}`,
    `- secretRead: ${result.secretRead}`,
    `- authJsonRead: ${result.authJsonRead}`,
    `- envRead: ${result.envRead}`,
    `- codexConfigModified: ${result.codexConfigModified}`,
    `- codexBaseUrlModified: ${result.codexBaseUrlModified}`,
    `- chatModified: ${result.chatModified}`,
    `- chatGatewayExecuteModified: ${result.chatGatewayExecuteModified}`,
    `- deployExecuted: ${result.deployExecuted}`,
    `- releaseExecuted: ${result.releaseExecuted}`,
    `- pushExecuted: ${result.pushExecuted}`,
    `- commitCreated: ${result.commitCreated}`,
    `- workspaceCleanClaimed: ${result.workspaceCleanClaimed}`,
    "",
  ].join("\n");
}
