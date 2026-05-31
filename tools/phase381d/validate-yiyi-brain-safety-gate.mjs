import { evaluateYiyiBrainSafety } from "../../apps/ai-gateway-service/src/ui/yiyi/brain/yiyiBrainSafetyGate.js";
import { ensure, phase381Safety, readJson, writeJson, writeText } from "../phase381-common.mjs";

const cases = await readJson("docs/phase381d-yiyi-brain-unsafe-output-cases.json");
const caseResults = cases.map((item) => {
  const result = evaluateYiyiBrainSafety(item.draftBrainResponse);
  return {
    caseId: item.caseId,
    decision: result.decision,
    blockedReason: result.blockedReason,
    blockedFields: result.blockedFields,
    safeResponse: result.safeResponse,
    pass: result.decision === item.expectedDecision && result.blockedReason === item.expectedBlockedReason,
  };
});

ensure(caseResults.every((item) => item.pass), "Not all unsafe output cases were blocked.");
ensure(caseResults.every((item) => item.safeResponse.actionExecuted === false), "Safe response must not execute actions.");
ensure(caseResults.every((item) => item.safeResponse.providerCallsMade === false), "Safe response must not call providers.");

const result = {
  phase: "Phase381D",
  brainSafetyGateCreated: true,
  unsafeCasesCreated: true,
  forbiddenOutputsBlocked: true,
  unsafeBrainOutputRewritten: true,
  actionEscalationBlocked: true,
  secretAccessBlocked: true,
  providerBypassBlocked: true,
  deployBlocked: true,
  evidenceApprovalRiskBlocked: true,
  caseResults,
  validationPassed: true,
  ...phase381Safety,
};

await writeJson("apps/ai-gateway-service/evidence/phase381d/yiyi-brain-safety-gate-result.json", result);
await writeText("docs/phase381d-yiyi-brain-safety-gate.md", [
  "# Phase381D Yiyi Brain Safety Gate",
  "",
  "- Blocks action escalation, secret access, provider bypass, deploy/release/tag/artifact, evidence/approval tampering, billing/invoice, hidden prompt leakage, medical/therapy claims, and sensitive attribute inference.",
  "- Rewrites unsafe drafts into safe presentation-only responses.",
  "- The safety gate does not execute any real action.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
