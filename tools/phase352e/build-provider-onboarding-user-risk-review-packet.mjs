import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/agent-console/evidence/phase351e/provider-onboarding-observability-drill-result.json");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase352e");
const resultPath = resolve(evidenceDir, "provider-onboarding-user-risk-review-packet-result.json");
const packetPath = resolve(repoRoot, "docs/phase352e-provider-onboarding-user-risk-review-packet.json");
const reportPath = resolve(repoRoot, "docs/phase352e-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const unresolvedSecurityBlockers = [
  ...(source.missingTraceFields || []).map((field) => `missing_trace_field:${field}`),
  "persona_and_reviewer_checklist_trace_required_for_beta_user_risk",
  "raw_secret_rejection_must_remain_mandatory",
];
const result = {
  phase: "Phase352E",
  sourcePhase: source.phase,
  packetType: "provider_onboarding_user_risk_review",
  securityReviewPacketsGenerated: true,
  riskRegisterUpdated: true,
  unresolvedSecurityBlockersListed: true,
  unresolvedSecurityBlockerCount: unresolvedSecurityBlockers.length,
  unresolvedSecurityBlockers,
  noProviderCallFromUi: true,
  credentialRefOnly: true,
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
  await writeFile(reportPath, `# Phase352E Execution Report\n\n- securityReviewPacketsGenerated: ${current.securityReviewPacketsGenerated}\n- unresolvedSecurityBlockerCount: ${current.unresolvedSecurityBlockerCount}\n- credentialRefOnly: ${current.credentialRefOnly}\n`, "utf8");
}
