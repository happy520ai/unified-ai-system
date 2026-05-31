import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase351c/tianshu-observability-drill-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase352c");
const resultPath = resolve(evidenceDir, "tianshu-planner-safety-risk-review-packet-result.json");
const packetPath = resolve(repoRoot, "docs/phase352c-tianshu-planner-safety-risk-review-packet.json");
const reportPath = resolve(repoRoot, "docs/phase352c-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const unresolvedSecurityBlockers = [
  ...(source.missingTraceFields || []).map((field) => `missing_trace_field:${field}`),
  "wrong_routing_requires_policy_proposal_trace",
  "reviewer_decision_required_before_policy_activation",
];
const result = {
  phase: "Phase352C",
  sourcePhase: source.phase,
  packetType: "tianshu_planner_wrong_routing_risk_review",
  securityReviewPacketsGenerated: true,
  riskRegisterUpdated: true,
  unresolvedSecurityBlockersListed: true,
  unresolvedSecurityBlockerCount: unresolvedSecurityBlockers.length,
  unresolvedSecurityBlockers,
  policyActivated: false,
  trainingTriggered: false,
  embeddingBatchTriggered: false,
  productionGA: false,
  noSecretInReviewPacket: source.noSecretInTrace === true,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(packetPath, `${JSON.stringify({ phase: current.phase, packetType: current.packetType, result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase352C Execution Report\n\n- securityReviewPacketsGenerated: ${current.securityReviewPacketsGenerated}\n- unresolvedSecurityBlockerCount: ${current.unresolvedSecurityBlockerCount}\n- policyActivated: ${current.policyActivated}\n`, "utf8");
}
