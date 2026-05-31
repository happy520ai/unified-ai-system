import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const evidencePath = "apps/ai-gateway-service/evidence/phase623r/isolated-runtime-candidate-dry-run-smoke-result.json";
const docPath = "docs/phase623r-isolated-runtime-candidate-dry-run-smoke.md";

const evidence = readJson(evidencePath);
const data = evidence.data ?? {};
const docsText = readText(docPath);

const result = {
  phase: "Phase623R-Fix",
  name: "Isolated Runtime Candidate Dry-Run Smoke",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  isolatedRouteContractLoadable: data.isolatedRouteContractLoadable === true,
  guardedPromptLoadable: data.guardedPromptLoadable === true,
  maxRequestsPolicyApplied: data.maxRequestsPolicyApplied === true,
  rollbackPolicyReferenced: data.rollbackPolicyReferenced === true,
  emergencyDisablePolicyReferenced: data.emergencyDisablePolicyReferenced === true,
  realCodexExecExecuted: data.realCodexExecExecuted === true,
  providerCallMade: data.providerCallMade === true,
  defaultChatModified: data.defaultChatModified === true,
  chatGatewayExecuteModified: data.chatGatewayExecuteModified === true,
  docsMentionedDryRunOnly: /dry-run only/i.test(docsText),
  codexExecExecutedByThisPhase: false,
  providerCallsMadeByThisPhase: false,
  authJsonRead: false,
  codexConfigModified: false,
  projectCodexConfigModified: false,
  workspaceCleanClaimed: false,
};

const checks = [
  check("isolatedRouteContractLoadable", result.isolatedRouteContractLoadable),
  check("guardedPromptLoadable", result.guardedPromptLoadable),
  check("maxRequestsPolicyApplied", result.maxRequestsPolicyApplied),
  check("rollbackPolicyReferenced", result.rollbackPolicyReferenced),
  check("emergencyDisablePolicyReferenced", result.emergencyDisablePolicyReferenced),
  check("realCodexExecExecuted_false", result.realCodexExecExecuted === false),
  check("providerCallMade_false", result.providerCallMade === false),
  check("defaultChatModified_false", result.defaultChatModified === false),
  check("chatGatewayExecuteModified_false", result.chatGatewayExecuteModified === false),
  check("docsMentionedDryRunOnly", result.docsMentionedDryRunOnly),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase623r_isolated_runtime_candidate_dry_run_smoke_failed:${failed.join(",")}`;
}
result.checks = checks;
writeJson(evidencePath, result);
console.log(JSON.stringify(result, null, 2));
if (!result.completed || !result.recommended_sealed || result.blocker) process.exitCode = 1;

function readJson(relativePath) {
  try {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) return { exists: false, data: null };
    return { exists: true, data: JSON.parse(fs.readFileSync(absolutePath, "utf8").replace(/^\uFEFF/, "")) };
  } catch {
    return { exists: true, data: null };
  }
}

function readText(relativePath) {
  try {
    return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, "");
  } catch {
    return "";
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
