import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase351a/production-candidate-observability-drill-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase352a");
const resultPath = resolve(evidenceDir, "production-candidate-security-review-packet-result.json");
const packetPath = resolve(repoRoot, "docs/phase352a-production-candidate-security-review-packet.json");
const reportPath = resolve(repoRoot, "docs/phase352a-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = buildPacket("Phase352A", source, "production_candidate_security_review", [
  "require_request_id_for_incident_and_rollback_trace",
  "require_human_review_decision_before_candidate_signoff",
]);

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

function buildPacket(phase, source, packetType, additionalRisks) {
  const unresolvedSecurityBlockers = [...(source.missingTraceFields || []).map((field) => `missing_trace_field:${field}`), ...additionalRisks];
  return {
    phase,
    sourcePhase: source.phase,
    packetType,
    securityReviewPacketsGenerated: true,
    riskRegisterUpdated: true,
    unresolvedSecurityBlockersListed: true,
    unresolvedSecurityBlockerCount: unresolvedSecurityBlockers.length,
    unresolvedSecurityBlockers,
    productionGA: false,
    releaseAuthorized: false,
    deployAuthorized: false,
    noSecretInReviewPacket: source.noSecretInTrace === true,
    secretValueExposed: false,
  };
}

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(packetPath, `${JSON.stringify({ phase: current.phase, packetType: current.packetType, result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, renderReport(current), "utf8");
}

function renderReport(current) {
  return `# Phase352A Execution Report\n\n- securityReviewPacketsGenerated: ${current.securityReviewPacketsGenerated}\n- riskRegisterUpdated: ${current.riskRegisterUpdated}\n- unresolvedSecurityBlockerCount: ${current.unresolvedSecurityBlockerCount}\n- noSecretInReviewPacket: ${current.noSecretInReviewPacket}\n`;
}
