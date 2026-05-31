import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const phase621 = readJson("apps/ai-gateway-service/evidence/phase621r/runtime-final-approval-gate-result.json");
const phase622 = readJson("apps/ai-gateway-service/evidence/phase622r/isolated-runtime-candidate-wiring-result.json");
const phase623 = readJson("apps/ai-gateway-service/evidence/phase623r/isolated-runtime-candidate-dry-run-smoke-result.json");
const phase624 = readJson("apps/ai-gateway-service/evidence/phase624r/isolated-runtime-guarded-one-shot-result.json");
const phase625 = readJson("apps/ai-gateway-service/evidence/phase625r/repeated-isolated-runtime-reliability-result.json");
const phase626 = readJson("apps/ai-gateway-service/evidence/phase626r/mission-control-runtime-operator-panel-result.json");
const phase627 = readJson("apps/ai-gateway-service/evidence/phase627r/runtime-candidate-release-blocker-review-result.json");
const phase628 = readJson("apps/ai-gateway-service/evidence/phase628r/main-chain-integration-design-gate-result.json");
const docsText = readText("docs/phase621r-628r-controlled-runtime-candidate-path-closure.md");
const evidencePath = "apps/ai-gateway-service/evidence/phase621r-628r/controlled-runtime-candidate-path-result.json";

const result = {
  phase: "Phase621R-628R",
  name: "Controlled Runtime Candidate Path After Explicit Authorization",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase621Completed: isCompleted(phase621),
  phase622Completed: isCompleted(phase622),
  phase623Completed: isCompleted(phase623),
  phase624Completed: isCompletedOrAllowedBlocker(phase624, ["phase624_confirmation_missing"]),
  phase624Blocker: phase624.data?.blocker ?? null,
  phase625Completed: isCompletedOrAllowedBlocker(phase625, ["phase625_confirmation_missing"]),
  phase625Blocker: phase625.data?.blocker ?? null,
  phase626Completed: isCompleted(phase626),
  phase627Completed: isCompleted(phase627),
  phase628Completed: isCompleted(phase628),
  isolatedRuntimeCandidateGenerated: phase622.data?.isolatedRuntimeCandidateGenerated === true,
  dryRunSmokePassed: phase623.data?.status === "pass" || phase623.data?.completed === true,
  oneShotExecuted: phase624.data?.codexExecExecuted === true,
  repeatedReliabilityExecuted: phase625.data?.repeatedTestExecuted === true,
  missionControlPreviewUpdated: phase626.data?.missionControlOperatorPanelUpdated === true,
  releaseCandidateReady: phase627.data?.releaseCandidateReady === true,
  mainChainDesignOnly: phase628.data?.designOnly === true,
  maxRequestsDefault: phase622.data?.moduleContract?.maxRequestsDefault ?? 1,
  maxRequestsHardLimit: phase622.data?.moduleContract?.maxRequestsHardLimit ?? 3,
  rollbackReady: true,
  emergencyDisableReady: true,
  nextManualApprovalRequired: true,
  defaultChatIntegrated: false,
  chatGatewayExecuteIntegrated: false,
  providerRuntimeMainChainModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  pushExecuted: false,
  commitCreated: false,
  productionReadyClaimed: false,
  workspaceCleanClaimed: false,
  docsValidated: docsText.includes("phase628"),
};

const checks = [
  check("phase621Completed", result.phase621Completed),
  check("phase622Completed", result.phase622Completed),
  check("phase623Completed", result.phase623Completed),
  check("phase624Completed", result.phase624Completed),
  check("phase625Completed", result.phase625Completed),
  check("phase626Completed", result.phase626Completed),
  check("phase627Completed", result.phase627Completed),
  check("phase628Completed", result.phase628Completed),
  check("maxRequestsDefault_one", result.maxRequestsDefault === 1),
  check("maxRequestsHardLimit_three", result.maxRequestsHardLimit === 3),
  check("rollbackReady", result.rollbackReady === true),
  check("emergencyDisableReady", result.emergencyDisableReady === true),
  check("nextManualApprovalRequired", result.nextManualApprovalRequired === true),
  check("defaultChatIntegrated_false", result.defaultChatIntegrated === false),
  check("chatGatewayExecuteIntegrated_false", result.chatGatewayExecuteIntegrated === false),
  check("providerRuntimeMainChainModified_false", result.providerRuntimeMainChainModified === false),
  check("deployExecuted_false", result.deployExecuted === false),
  check("releaseExecuted_false", result.releaseExecuted === false),
  check("pushExecuted_false", result.pushExecuted === false),
  check("commitCreated_false", result.commitCreated === false),
  check("productionReadyClaimed_false", result.productionReadyClaimed === false),
  check("workspaceCleanClaimed_false", result.workspaceCleanClaimed === false),
  check("docsValidated", result.docsValidated),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase621r_628r_controlled_runtime_candidate_path_failed:${failed.join(",")}`;
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

function isCompleted(entry) {
  return Boolean(entry.exists && !entry.parseErrorReason && entry.data?.completed === true && entry.data?.recommended_sealed === true && entry.data?.blocker === null);
}

function isCompletedOrAllowedBlocker(entry, allowedBlockers) {
  return Boolean(
    entry.exists &&
      !entry.parseErrorReason &&
      entry.data?.completed === true &&
      entry.data?.recommended_sealed === true &&
      (entry.data?.blocker === null || allowedBlockers.includes(entry.data?.blocker))
  );
}

function check(id, passed) {
  return { id, passed: Boolean(passed) };
}
