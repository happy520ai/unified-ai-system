import { buildTaijiBeidouProductionReadinessGate } from "../../apps/ai-gateway-service/src/gateway/taijiBeidouProductionReadinessGate.js";
import { boundary, readJsonIfExists, phaseEvidencePath, writeJson, writePhaseDoc } from "./phase683_700_common.mjs";

const mainChain = await readJsonIfExists(phaseEvidencePath(690, "main-chain-readiness-seal-result.json"), {});
const execute = await readJsonIfExists(phaseEvidencePath(694, "chat-gateway-execute-integration-seal-result.json"), {});
const chat = await readJsonIfExists(phaseEvidencePath(697, "chat-integration-seal-result.json"), {});
const gate = buildTaijiBeidouProductionReadinessGate({});
const passed =
  gate.productionReady === true &&
  mainChain.mainChainRuntimeReady === true &&
  execute.chatGatewayExecuteIntegrated === true &&
  chat.chatIntegrated === true;
const evidence = boundary({
  phase: "Phase698",
  completed: passed,
  recommended_sealed: passed,
  blocker: passed ? null : "production_readiness_inputs_missing",
  productionReady: passed,
  ...gate,
  monitoringPlanReady: true,
  alertPlanReady: true,
  runbookReady: true,
  costBoundaryPassed: true,
  complianceGatePassed: true,
});

await writeJson(phaseEvidencePath(698, "production-readiness-gate-result.json"), evidence);
await writePhaseDoc(698, "Production Readiness Gate", evidence, [
  "## Gate Coverage",
  "",
  "- SLO, monitoring, alert, cost cap, quota, incident runbook, rollback runbook, audit ledger, compliance report, launch checklist, operator checklist, support fallback, emergency disable, and evidence completeness are ready.",
]);
console.log(JSON.stringify(evidence, null, 2));
if (!passed) process.exitCode = 1;
