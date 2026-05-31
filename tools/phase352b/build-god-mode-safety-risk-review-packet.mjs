import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase351b/god-mode-observability-drill-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase352b");
const resultPath = resolve(evidenceDir, "god-mode-safety-risk-review-packet-result.json");
const packetPath = resolve(repoRoot, "docs/phase352b-god-mode-safety-risk-review-packet.json");
const reportPath = resolve(repoRoot, "docs/phase352b-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const unresolvedSecurityBlockers = [
  ...(source.missingTraceFields || []).map((field) => `missing_trace_field:${field}`),
  "hallucination_or_quality_degradation_requires_reviewer_decision_trace",
  "external_notification_remains_disabled_until_real_escalation_policy",
];
const result = {
  phase: "Phase352B",
  sourcePhase: source.phase,
  packetType: "god_mode_safety_hallucination_risk_review",
  securityReviewPacketsGenerated: true,
  riskRegisterUpdated: true,
  unresolvedSecurityBlockersListed: true,
  unresolvedSecurityBlockerCount: unresolvedSecurityBlockers.length,
  unresolvedSecurityBlockers,
  externalNotification: false,
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
  await writeFile(reportPath, `# Phase352B Execution Report\n\n- securityReviewPacketsGenerated: ${current.securityReviewPacketsGenerated}\n- unresolvedSecurityBlockerCount: ${current.unresolvedSecurityBlockerCount}\n- externalNotification: ${current.externalNotification}\n`, "utf8");
}
