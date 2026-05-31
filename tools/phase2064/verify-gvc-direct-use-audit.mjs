import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2064-GVC-Direct-Use-Audit";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2064-gvc-direct-use-audit";
const resultPath = `${evidenceDir}/result.json`;
const docsPath = "docs/phase2064-gvc-direct-use-audit.md";
const phase2063ResultPath = "apps/ai-gateway-service/evidence/phase2063-gvc-controlled-direct-use-run/result.json";
const packageScriptName = "verify:phase2064-gvc-direct-use-audit";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const directUseResult = readJson(phase2063ResultPath);
const loopEvidence = collectPhase2063Loops(directUseResult);
const realMutationLoops = loopEvidence.filter((loop) => loop.realExecutionPerformed === true);
const blockedLoops = loopEvidence.filter((loop) => ["blocked", "stopped"].includes(loop.status));
const mutatedFiles = Array.from(new Set(realMutationLoops.flatMap((loop) => loop.mutationResult?.mutatedFiles || [])));
const forbiddenMutatedFiles = mutatedFiles.filter((file) => isForbiddenMutationPath(file));
const blockedTargetsWritten = blockedLoops.some((loop) => loop.realExecutionPerformed === true);

check("package_script_registered", packageJson.scripts?.[packageScriptName] === "node tools/phase2064/verify-gvc-direct-use-audit.mjs");
check("docs_file_exists", existsSync(resolve(docsPath)));
check("direct_use_result_exists", directUseResult !== null);
check("direct_use_run_executed", directUseResult?.directUseRunStarted === true && directUseResult?.directUseRunCompleted === true);
check("runner_did_not_overreach", directUseResult?.realMutationAuthorityExpanded === false);
check("allowed_mutation_paths_only", forbiddenMutatedFiles.length === 0, forbiddenMutatedFiles.join(", "));
check("blocked_task_did_not_write_target", blockedTargetsWritten === false);
check("rollback_failed_count_zero", directUseResult?.rollbackFailedCount === 0, String(directUseResult?.rollbackFailedCount));
check("provider_false", directUseResult?.providerCallsMade === false);
check("secret_false", directUseResult?.secretRead === false);
check("deploy_false", directUseResult?.deployExecuted === false);
check("chat_gateway_false", directUseResult?.chatGatewayExecuteModified === false);
check("legacy_false", directUseResult?.legacyModified === false);
check("project_context_false", directUseResult?.projectContextModified === false);
check("permission_engine_participated", directUseResult?.permissionEngineParticipated === true);
check("real_low_risk_mutation_executed", Number(directUseResult?.realMutationLoopCount || 0) >= 1);

const failed = checks.filter((entry) => !entry.pass);
const result = {
  phaseId,
  completed: failed.length === 0,
  status: failed.length === 0 ? "passed" : "failed",
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((entry) => entry.id).join(", "),
  generatedAt: new Date().toISOString(),
  runnerNoOverreach: directUseResult?.realMutationAuthorityExpanded === false,
  mutationAllowedScopeOnly: forbiddenMutatedFiles.length === 0,
  blockedTaskTargetWriteCount: blockedTargetsWritten ? 1 : 0,
  loopCount: directUseResult?.loopCount || 0,
  realMutationLoopCount: directUseResult?.realMutationLoopCount || 0,
  blockedLoopCount: directUseResult?.blockedLoopCount || 0,
  skippedApprovalRequiredCount: directUseResult?.skippedApprovalRequiredCount || 0,
  rollbackCount: directUseResult?.rollbackCount || 0,
  rollbackFailedCount: directUseResult?.rollbackFailedCount ?? null,
  mutatedFiles,
  forbiddenMutatedFiles,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  checks,
};

writeJson(resultPath, result);
console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  realMutationLoopCount: result.realMutationLoopCount,
  rollbackFailedCount: result.rollbackFailedCount,
}, null, 2));
if (failed.length > 0) process.exit(1);

function collectPhase2063Loops(result) {
  const refs = Array.isArray(result?.copiedLoopEvidenceRefs) && result.copiedLoopEvidenceRefs.length > 0
    ? result.copiedLoopEvidenceRefs
    : result?.loopEvidenceRefs;
  if (Array.isArray(refs) && refs.length > 0) {
    return refs.map((ref) => readJson(ref)).filter(Boolean);
  }
  if (!result?.stateDate) return [];
  const dir = resolve("apps/ai-gateway-service/evidence/phase2019-gvc-timed-local-runner");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.startsWith(`loop-${result.stateDate}-`) && name.endsWith(".json"))
    .map((name) => readJson(path.relative(repoRoot, path.join(dir, name))))
    .filter((loop) => loop?.phase2063RunId === result.runId || loop?.generatedAt >= result.startedAt)
    .filter(Boolean);
}

function isForbiddenMutationPath(relativePath) {
  const normalized = String(relativePath || "").replaceAll("\\", "/").toLowerCase();
  return (
    normalized === "project_context.md" ||
    normalized.startsWith("legacy/") ||
    normalized.includes("/chat-gateway/execute") ||
    normalized.includes("credential") ||
    normalized.includes("provider-runtime") ||
    normalized.includes("billing") ||
    normalized.includes("payment") ||
    normalized.endsWith("/auth.json") ||
    normalized === "auth.json" ||
    normalized.endsWith("/.env") ||
    normalized === ".env"
  );
}

function resolve(relativePath) {
  return path.join(repoRoot, relativePath);
}

function readJson(relativePath) {
  const filePath = path.isAbsolute(relativePath) ? relativePath : resolve(relativePath);
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(relativePath, value) {
  const filePath = resolve(relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
