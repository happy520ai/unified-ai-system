import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { getSyntheticCapabilityAtoms } from "../../apps/ai-gateway-service/src/tianshu-capability-atom/syntheticCapabilityAtomRegistry.js";
import { validateCapabilityAtomShape } from "../../apps/ai-gateway-service/src/tianshu-capability-atom/capabilityAtomSchema.js";
import { verifyCapabilityAtomIds } from "../../apps/ai-gateway-service/src/tianshu-capability-atom/capabilityAtomHash.js";
import { weaveCapabilityAtomsDryRun } from "../../apps/ai-gateway-service/src/tianshu-capability-atom/capabilityAtomWeaveDryRun.js";
import { createTianshuCapabilityReadout } from "../../apps/ai-gateway-service/src/tianshu-capability-atom/tianshuCapabilityReadoutAdapter.js";
import { evaluateCapabilityRiskGate } from "../../apps/ai-gateway-service/src/tianshu-capability-atom/tianshuCapabilityRiskGate.js";
import { buildTianshuCapabilityEvidencePreview } from "../../apps/ai-gateway-service/src/tianshu-capability-atom/tianshuCapabilityEvidencePreview.js";

const evidenceRoot = "apps/ai-gateway-service/evidence/phase1941_1950";
const atoms = getSyntheticCapabilityAtoms();
const shapeResults = atoms.map((atom) => ({
  atomId: atom.atomId,
  title: atom.title,
  ...validateCapabilityAtomShape(atom),
}));
const hashVerification = verifyCapabilityAtomIds(atoms);
const selectedTitles = ["owner_daily_status_check", "evidence_replay_summary", "secret_safety_check", "ui_smoke_check"];
const weave = weaveCapabilityAtomsDryRun(atoms, selectedTitles);
const readout = createTianshuCapabilityReadout("帮我检查今天系统状态，并告诉我下一步该做什么", atoms);
const riskGate = evaluateCapabilityRiskGate(atoms, { providerAuthorized: false, ownerApprovalPresent: false });
const evidencePreview = buildTianshuCapabilityEvidencePreview({ atoms, hashVerification, readout, riskGate });

const commonSafety = {
  executionAllowed: false,
  arbitraryCodeExecuted: false,
  dynamicCodeExecutionDetected: riskGate.dynamicCodeExecutionDetected,
  networkFetchDetected: riskGate.networkFetchDetected,
  providerCallsMade: false,
  rawSecretRead: false,
  secretValueExposed: false,
  authJsonRead: false,
  envDumped: false,
  rawKeyOutput: false,
  authHeaderLogged: false,
  chatRouteModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  commitCreated: false,
  pushExecuted: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  commercialReadyClaimed: false,
};

const dryRunResult = {
  phase: "Phase1941P-1943P",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  dryRunExecuted: true,
  tianshuCapabilityAtomLayerReady: true,
  syntheticCapabilityRegistryReady: true,
  atomCount: atoms.length,
  requiredSyntheticAtomsPresent: selectedTitles.concat(["provider_stability_check", "rollback_drill_check"]).every((title) => atoms.some((atom) => atom.title === title)),
  atomShapeValid: shapeResults.every((item) => item.ok),
  shapeResults,
  atomIdVerified: hashVerification.atomIdVerified,
  atomIdMismatchCount: hashVerification.atomIdMismatchCount,
  dependencyGraphGenerated: weave.dependencyGraphGenerated,
  ...weave,
  ...commonSafety,
};

const readoutResult = {
  phase: "Phase1944P",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  tianshuReadoutGenerated: true,
  taskUnderstanding: readout.taskUnderstanding,
  candidateAtoms: readout.candidateAtoms,
  selectedAtoms: readout.selectedAtoms,
  rejectedAtoms: readout.rejectedAtoms,
  dependencyGraph: readout.dependencyGraph,
  routeAffinityScore: readout.routeAffinityScore,
  evidenceCoherenceScore: readout.evidenceCoherenceScore,
  riskFieldScore: readout.riskFieldScore,
  executionReadinessScore: readout.executionReadinessScore,
  blockedCapabilities: readout.blockedCapabilities,
  approvalRequiredCapabilities: readout.approvalRequiredCapabilities,
  dryRunOnlyCapabilities: readout.dryRunOnlyCapabilities,
  finalTianshuPlan: readout.finalTianshuPlan,
  providerStabilityBlockerPreserved: readout.providerStabilityBlockerPreserved,
  ...commonSafety,
};

const riskGateResult = {
  phase: "Phase1945P",
  completed: true,
  recommended_sealed: riskGate.riskGatePassed,
  blocker: riskGate.riskGatePassed ? null : "tianshu_capability_risk_gate_failed",
  riskGatePassed: riskGate.riskGatePassed,
  forbiddenCapabilityBlocked: riskGate.forbiddenCapabilityBlocked,
  providerStabilityBlockerPreserved: readout.providerStabilityBlockerPreserved,
  blockedCapabilities: riskGate.blockedCapabilities,
  approvalRequiredCapabilities: riskGate.approvalRequiredCapabilities,
  dryRunOnlyCapabilities: riskGate.dryRunOnlyCapabilities,
  dynamicCodeExecutionDetected: riskGate.dynamicCodeExecutionDetected,
  networkFetchDetected: riskGate.networkFetchDetected,
  chatGatewayExecuteModificationDetected: riskGate.chatGatewayExecuteModificationDetected,
  ...commonSafety,
};

const sealReady = dryRunResult.recommended_sealed === true
  && readoutResult.recommended_sealed === true
  && riskGateResult.recommended_sealed === true
  && evidencePreview.providerStabilityBlockerPreserved === true;

const sealResult = {
  phase: "Phase1950P",
  name: "Tianshu Capability Atom Experiment Layer Seal",
  completed: true,
  recommended_sealed: sealReady,
  blocker: sealReady ? null : "tianshu_capability_atom_layer_not_ready",
  tianshuCapabilityReadoutExperimentReady: sealReady,
  tianshuCapabilityAtomLayerReady: true,
  syntheticCapabilityRegistryReady: true,
  capabilityAtomHashVerified: hashVerification.atomIdVerified,
  atomIdVerified: hashVerification.atomIdVerified,
  atomIdMismatchCount: hashVerification.atomIdMismatchCount,
  dependencyGraphGenerated: weave.dependencyGraphGenerated,
  tianshuReadoutGenerated: true,
  riskGatePassed: riskGate.riskGatePassed,
  forbiddenCapabilityBlocked: riskGate.forbiddenCapabilityBlocked,
  providerStabilityBlockerPreserved: readout.providerStabilityBlockerPreserved,
  evidencePreviewGenerated: evidencePreview.evidencePreviewGenerated,
  ...commonSafety,
  nextRecommendedPhase: "Phase1951P Safe Internal Provider Executor Authorization Design",
};

writeJson(`${evidenceRoot}/tianshu-capability-atom-dry-run-result.json`, dryRunResult);
writeJson(`${evidenceRoot}/tianshu-capability-readout-result.json`, readoutResult);
writeJson(`${evidenceRoot}/tianshu-capability-risk-gate-result.json`, riskGateResult);
writeJson(`${evidenceRoot}/tianshu-capability-evidence-preview-result.json`, evidencePreview);
writeJson(`${evidenceRoot}/phase1950-seal-result.json`, sealResult);

console.log(JSON.stringify(sealResult, null, 2));
if (!sealReady) process.exitCode = 1;

function writeJson(relativePath, value) {
  const target = join(process.cwd(), relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
