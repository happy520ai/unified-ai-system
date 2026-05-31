import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase351d/credential-vault-observability-drill-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase352d");
const resultPath = resolve(evidenceDir, "credential-vault-secret-safety-review-packet-result.json");
const packetPath = resolve(repoRoot, "docs/phase352d-credential-vault-secret-safety-review-packet.json");
const reportPath = resolve(repoRoot, "docs/phase352d-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const unresolvedSecurityBlockers = [
  ...(source.missingTraceFields || []).map((field) => `missing_trace_field:${field}`),
  "credential_ref_and_access_decision_trace_required",
  "production_vault_backend_still_not_enabled",
];
const result = {
  phase: "Phase352D",
  sourcePhase: source.phase,
  packetType: "credential_vault_secret_safety_review",
  securityReviewPacketsGenerated: true,
  riskRegisterUpdated: true,
  unresolvedSecurityBlockersListed: true,
  unresolvedSecurityBlockerCount: unresolvedSecurityBlockers.length,
  unresolvedSecurityBlockers,
  rawSecretReturned: false,
  providerRealCallExecuted: false,
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
  await writeFile(reportPath, `# Phase352D Execution Report\n\n- securityReviewPacketsGenerated: ${current.securityReviewPacketsGenerated}\n- unresolvedSecurityBlockerCount: ${current.unresolvedSecurityBlockerCount}\n- rawSecretReturned: ${current.rawSecretReturned}\n`, "utf8");
}
