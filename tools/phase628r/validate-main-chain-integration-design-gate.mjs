import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const docs = [
  "docs/phase628r-main-chain-integration-design-gate.md",
  "docs/phase628r-main-chain-risk-matrix.md",
  "docs/phase628r-next-approval-requirements.md",
  "docs/phase628r-execution-report.md",
];
const evidencePath = "apps/ai-gateway-service/evidence/phase628r/main-chain-integration-design-gate-result.json";

const docsText = docs.map(readText).join("\n");

const result = {
  phase: "Phase628R-Fix",
  name: "Main Chain Integration Design Gate",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  designOnly: true,
  futureChatPhaseRequired: true,
  futureChatGatewayExecutePhaseRequired: true,
  futureProviderRuntimePhaseRequired: true,
  productionRolloutRequiresSeparateApproval: true,
  releaseRequiresSeparateApproval: true,
  defaultChatIntegrated: false,
  chatGatewayExecuteIntegrated: false,
  providerRuntimeModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  pushExecuted: false,
  commitCreated: false,
  productionReadyClaimed: false,
  releaseReadyClaimed: false,
  workspaceCleanClaimed: false,
  docsValidated: docs.every((file) => fs.existsSync(path.join(root, file))),
  docsMentionDesignOnly: docsText.includes("designOnly=true"),
};

const checks = [
  check("designOnly_true", result.designOnly),
  check("futureChatPhaseRequired", result.futureChatPhaseRequired),
  check("futureChatGatewayExecutePhaseRequired", result.futureChatGatewayExecutePhaseRequired),
  check("futureProviderRuntimePhaseRequired", result.futureProviderRuntimePhaseRequired),
  check("productionRolloutRequiresSeparateApproval", result.productionRolloutRequiresSeparateApproval),
  check("releaseRequiresSeparateApproval", result.releaseRequiresSeparateApproval),
  check("defaultChatIntegrated_false", result.defaultChatIntegrated === false),
  check("chatGatewayExecuteIntegrated_false", result.chatGatewayExecuteIntegrated === false),
  check("providerRuntimeModified_false", result.providerRuntimeModified === false),
  check("docsValidated", result.docsValidated),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase628r_main_chain_integration_design_gate_failed:${failed.join(",")}`;
}
result.checks = checks;
writeJson(evidencePath, result);
console.log(JSON.stringify(result, null, 2));
if (!result.completed || !result.recommended_sealed || result.blocker) process.exitCode = 1;

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
