import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const approvalPath = "docs/phase621r-runtime-final-approval.input.json";
const evidencePath = "apps/ai-gateway-service/evidence/phase621r/runtime-final-approval-gate-result.json";

const approval = readJson(approvalPath);
const data = approval.data ?? {};

const result = {
  phase: "Phase621R-Fix",
  name: "Runtime Integration Final Approval Gate",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  finalApprovalExists: approval.exists === true && !approval.parseErrorReason,
  selectedProviderId: data.selectedProviderId ?? null,
  allowIsolatedRuntimeCandidateWiring: data.allowIsolatedRuntimeCandidateWiring === true,
  allowCodexExecForGuardedOneShot: data.allowCodexExecForGuardedOneShot === true,
  maxRequestsPerAttempt: Number(data.maxRequestsPerAttempt ?? 0),
  maxRequestsTotal: Number(data.maxRequestsTotal ?? 0),
  retryLimit: Number(data.retryLimit ?? -1),
  stopOnFirstFailure: data.stopOnFirstFailure === true,
  defaultChatIntegrationAllowed: data.allowDefaultChatIntegration === true,
  chatGatewayExecuteMainChainAllowed: data.allowChatGatewayExecuteMainChainIntegration === true,
  providerRuntimeMainChainModificationAllowed: data.allowProviderRuntimeMainChainModification === true,
  deployAllowed: data.allowDeploy === true,
  releaseAllowed: data.allowRelease === true,
  pushAllowed: data.allowPush === true,
  commitAllowed: data.allowCommit === true,
  authJsonRead: false,
  codexConfigModified: false,
  projectCodexConfigModified: false,
  providerCallsMadeByThisPhase: false,
  codexExecExecutedByThisPhase: false,
  productionReadyClaimed: false,
  releaseReadyClaimed: false,
  workspaceCleanClaimed: false,
};

const checks = [
  check("finalApprovalExists", result.finalApprovalExists),
  check("selectedProviderId_crs", result.selectedProviderId === "crs"),
  check("isolatedRuntimeCandidateAllowed", result.allowIsolatedRuntimeCandidateWiring),
  check("maxRequestsPerAttempt_one", result.maxRequestsPerAttempt === 1),
  check("maxRequestsTotal_three", result.maxRequestsTotal === 3),
  check("retryLimit_zero", result.retryLimit === 0),
  check("stopOnFirstFailure_true", result.stopOnFirstFailure),
  check("defaultChatIntegrationAllowed_false", result.defaultChatIntegrationAllowed === false),
  check("chatGatewayExecuteMainChainAllowed_false", result.chatGatewayExecuteMainChainAllowed === false),
  check("providerRuntimeMainChainModificationAllowed_false", result.providerRuntimeMainChainModificationAllowed === false),
  check("deployAllowed_false", result.deployAllowed === false),
  check("releaseAllowed_false", result.releaseAllowed === false),
  check("pushAllowed_false", result.pushAllowed === false),
  check("commitAllowed_false", result.commitAllowed === false),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase621r_final_approval_gate_failed:${failed.join(",")}`;
}
result.checks = checks;

writeJson(evidencePath, result);
console.log(JSON.stringify(result, null, 2));
if (!result.completed || !result.recommended_sealed || result.blocker) process.exitCode = 1;

function readJson(relativePath) {
  try {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) return { exists: false, data: null, parseErrorReason: null };
    return { exists: true, data: JSON.parse(fs.readFileSync(absolutePath, "utf8").replace(/^\uFEFF/, "")), parseErrorReason: null };
  } catch (error) {
    return { exists: true, data: null, parseErrorReason: error instanceof Error ? error.message : String(error) };
  }
}

function writeJson(relativePath, value) {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function check(id, passed) {
  return { id, passed: Boolean(passed) };
}
