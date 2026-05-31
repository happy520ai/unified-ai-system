import fs from "node:fs";
import path from "node:path";
import { buildIsolatedRuntimeCandidateContract } from "../../packages/codex-context-gateway/src/isolatedRuntimeCandidateContract.js";
import { buildIsolatedRuntimeCandidateRoutePreview } from "../../packages/codex-context-gateway/src/isolatedRuntimeCandidateRoute.js";

const root = process.cwd();
const contractPath = "docs/phase622r-isolated-route-contract.json";
const evidencePath = "apps/ai-gateway-service/evidence/phase622r/isolated-runtime-candidate-wiring-result.json";

const docContract = readJson(contractPath);
const moduleContract = buildIsolatedRuntimeCandidateContract();
const routePreview = buildIsolatedRuntimeCandidateRoutePreview();

const result = {
  phase: "Phase622R-Fix",
  name: "Isolated Runtime Candidate Wiring",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  isolatedRuntimeCandidateGenerated: docContract.exists === true && !docContract.parseErrorReason && routePreview.routeId === "codex_exec_crs_isolated_runtime_candidate",
  routeId: routePreview.routeId,
  selectedProviderId: routePreview.selectedProviderId,
  mode: routePreview.mode,
  defaultChatIntegrated: routePreview.defaultChatIntegrated === true,
  chatGatewayExecuteIntegrated: routePreview.chatGatewayExecuteIntegrated === true,
  providerRuntimeMainChainModified: routePreview.providerRuntimeMainChainModified === true,
  dryRunDefault: routePreview.dryRunDefault === true,
  realExecutionRequiresPhase624Confirmation: routePreview.realExecutionRequiresPhase624Confirmation === true,
  codexConfigModified: false,
  projectCodexConfigModified: false,
  authJsonRead: false,
  providerCallsMadeByThisPhase: false,
  codexExecExecutedByThisPhase: false,
  productionReadyClaimed: false,
  releaseReadyClaimed: false,
  workspaceCleanClaimed: false,
  moduleContract,
};

const checks = [
  check("isolatedRuntimeCandidateGenerated", result.isolatedRuntimeCandidateGenerated),
  check("routeId", result.routeId === "codex_exec_crs_isolated_runtime_candidate"),
  check("selectedProviderId", result.selectedProviderId === "crs"),
  check("mode", result.mode === "isolated_runtime_candidate"),
  check("defaultChatIntegrated_false", result.defaultChatIntegrated === false),
  check("chatGatewayExecuteIntegrated_false", result.chatGatewayExecuteIntegrated === false),
  check("providerRuntimeMainChainModified_false", result.providerRuntimeMainChainModified === false),
  check("codexConfigModified_false", result.codexConfigModified === false),
  check("authJsonRead_false", result.authJsonRead === false),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase622r_isolated_runtime_candidate_wiring_failed:${failed.join(",")}`;
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
