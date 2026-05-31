import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2089A-Controlled-Codex-Patch-Proposal";
const runnerPath = "tools/phase2089/run-controlled-codex-patch-proposal.mjs";
const docsPath = "docs/phase2089-controlled-codex-patch-proposal.md";
const approvalExamplePath = "docs/phase2089-controlled-codex-patch-proposal-approval.example.json";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2089-controlled-codex-patch-proposal";
const resultPath = `${evidenceDir}/result.json`;
const resultMdPath = `${evidenceDir}/result.md`;
const smokeResultPath = `${evidenceDir}/codex-patch-proposal-smoke-result.json`;
const proposalPath = `${evidenceDir}/codex-patch-proposal.md`;
const targetPath = "docs/phase2089-codex-generated-patch-proposal-target.md";
const packageScriptName = "verify:phase2089-controlled-codex-patch-proposal";
const runScriptName = "run:phase2089-controlled-codex-patch-proposal";
const smokeScriptName = "smoke:phase2089-controlled-codex-patch-proposal";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632Preflight = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2088 = readJson("apps/ai-gateway-service/evidence/phase2088-controlled-codex-prompt-execution/result.json") || {};

check("runner_exists", existsSync(resolve(runnerPath)));
check("docs_exists", existsSync(resolve(docsPath)));
check("approval_example_exists", existsSync(resolve(approvalExamplePath)));
check(
  "package_verify_script_registered",
  packageJson.scripts?.[packageScriptName] === "node tools/phase2089/validate-controlled-codex-patch-proposal.mjs",
);
check(
  "package_run_script_registered",
  packageJson.scripts?.[runScriptName] === "node tools/phase2089/run-controlled-codex-patch-proposal.mjs",
);
check(
  "package_smoke_script_registered",
  packageJson.scripts?.[smokeScriptName] ===
    "node tools/phase2089/run-controlled-codex-patch-proposal.mjs --plan docs/phase2089-controlled-codex-patch-proposal-approval.example.json",
);
check("phase632_preflight_passed", phase632Preflight.preflightPassed === true && phase632Preflight.staleFalse === true);
check("phase2088_sealed", phase2088.recommendedSealed === true && phase2088.codexExecExecuted === true);

const smoke = readJson(smokeResultPath);
check("controlled_codex_patch_smoke_result_exists", smoke !== null, "run smoke:phase2089-controlled-codex-patch-proposal first");
check("verifier_does_not_execute_codex", true);

const proposal = existsSync(resolve(proposalPath)) ? readText(proposalPath) : "";
if (smoke) {
  check("codex_exec_executed", smoke.codexExecExecuted === true);
  check("max_one_invocation", smoke.codexExecInvocationCount === 1);
  check("max_requests_one", smoke.maxRequests === 1);
  check("external_tool_kind_codex_cli", smoke.externalToolKind === "codex-cli");
  check("proposal_file_exists", smoke.proposalFileExists === true && proposal.length > 0);
  check("expected_marker_present", proposal.includes("PHASE2089_CODEX_PATCH_PROPOSAL_OK"));
  check("proposal_contains_unified_diff", proposal.includes("diff --git") && proposal.includes("--- /dev/null") && proposal.includes("+++ b/docs/phase2089-codex-generated-patch-proposal-target.md"));
  check("proposal_targets_allowed_file", smoke.proposedTargetPath === targetPath && proposal.includes(targetPath));
  check("proposal_not_applied", smoke.patchProposalApplied === false && smoke.targetFileCreated === false && !existsSync(resolve(targetPath)));
  check("credential_env_allowlist_scoped", Array.isArray(smoke.credentialEnvAllowlist) && smoke.credentialEnvAllowlist.join(",") === "CRS_OAI_KEY");
  check("credential_env_presence_boolean_only", smoke.credentialEnvPresence?.CRS_OAI_KEY === true);
  check("output_tail_redacted", smoke.outputTailRedacted === true);
  check("stdout_tail_no_url_or_secret", !hasUnsafeEvidenceText(smoke.stdoutTail));
  check("stderr_tail_no_url_or_secret", !hasUnsafeEvidenceText(smoke.stderrTail));
  check("proposal_no_url_or_secret", !hasUnsafeEvidenceText(proposal));
  check("project_provider_false", smoke.projectProviderCallsMade === false);
  check("secret_false", smoke.secretRead === false && smoke.envRead === false && smoke.authJsonReadByRunner === false);
  check("auth_content_not_exposed", smoke.authJsonContentExposed === false);
  check("codex_config_false", smoke.codexConfigModified === false && smoke.codexBaseUrlModified === false);
  check("chat_false", smoke.chatModified === false && smoke.chatGatewayExecuteModified === false);
  check("deploy_release_false", smoke.deployExecuted === false && smoke.releaseExecuted === false);
  check("push_commit_false", smoke.pushExecuted === false && smoke.commitCreated === false);
  check("workspace_clean_not_claimed", smoke.workspaceCleanClaimed === false);
  check("isolated_workspace_used", smoke.isolatedWorkspaceUsed === true);
}

const docs = existsSync(resolve(docsPath)) ? readText(docsPath) : "";
check("docs_mentions_real_codex", docs.includes("real `codex exec`"));
check("docs_mentions_phase2088", docs.includes("Phase2088A"));
check("docs_mentions_no_apply", docs.includes("patchProposalApplied=false"));
check("docs_mentions_no_chat", docs.includes("default `/chat` unchanged"));
check("docs_mentions_no_secret", docs.includes("authJsonReadByRunner=false") && docs.includes("secretRead=false"));

const failed = checks.filter((entry) => !entry.pass);
const completed = failed.length === 0;
const result = {
  phaseId,
  completed,
  status: completed ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  phase632PreflightPassed: phase632Preflight.preflightPassed === true,
  phase2088Sealed: phase2088.recommendedSealed === true,
  controlledCodexPatchProposalReady: completed,
  codexExecExecuted: smoke?.codexExecExecuted === true,
  codexExecInvocationCount: Number(smoke?.codexExecInvocationCount || 0),
  externalToolKind: smoke?.externalToolKind || null,
  proposalPath,
  proposalFileExists: proposal.length > 0,
  expectedMarkerPresent: proposal.includes("PHASE2089_CODEX_PATCH_PROPOSAL_OK"),
  proposalContainsUnifiedDiff: proposal.includes("diff --git"),
  patchProposalApplied: false,
  targetFileCreated: existsSync(resolve(targetPath)),
  projectProviderCallsMade: false,
  codexExternalModelMayHaveBeenCalled: smoke?.codexExternalModelMayHaveBeenCalled === true,
  paidProviderCallsMadeByProject: false,
  secretRead: false,
  envRead: false,
  authJsonReadByRunner: false,
  authJsonContentExposed: false,
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
  blocker: completed ? "none" : failed.map((entry) => entry.id).join(", "),
  recommendedSealed: completed,
  evidenceRefs: {
    result: resultPath,
    smokeResult: smokeResultPath,
    proposal: proposalPath,
  },
  checks,
};

writeJson(resultPath, result);
writeText(resultMdPath, renderMarkdown(result));
console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  codexExecExecuted: result.codexExecExecuted,
  expectedMarkerPresent: result.expectedMarkerPresent,
  proposalContainsUnifiedDiff: result.proposalContainsUnifiedDiff,
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
    "# Phase2089A Controlled Codex Patch Proposal Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${result.recommendedSealed}`,
    `- blocker: ${result.blocker}`,
    `- codexExecExecuted: ${result.codexExecExecuted}`,
    `- codexExecInvocationCount: ${result.codexExecInvocationCount}`,
    `- expectedMarkerPresent: ${result.expectedMarkerPresent}`,
    `- proposalContainsUnifiedDiff: ${result.proposalContainsUnifiedDiff}`,
    `- patchProposalApplied: ${result.patchProposalApplied}`,
    `- targetFileCreated: ${result.targetFileCreated}`,
    `- codexExternalModelMayHaveBeenCalled: ${result.codexExternalModelMayHaveBeenCalled}`,
    `- projectProviderCallsMade: ${result.projectProviderCallsMade}`,
    `- secretRead: ${result.secretRead}`,
    `- envRead: ${result.envRead}`,
    `- authJsonReadByRunner: ${result.authJsonReadByRunner}`,
    `- authJsonContentExposed: ${result.authJsonContentExposed}`,
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

function hasUnsafeEvidenceText(value) {
  return /https?:\/\/|CRS_OAI_KEY\s*=|\bsk-[A-Za-z0-9]{20,}|api[_-]?key\s*[:=]|secret\s*[:=]|token\s*[:=]|session id:\s*[0-9a-f-]{12,}|[A-Za-z]:\\/.test(
    String(value || ""),
  );
}
