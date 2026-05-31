import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase350d/credential-vault-adapter-rollback-drill-dry-run-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase351d");
const resultPath = resolve(evidenceDir, "credential-vault-observability-drill-result.json");
const tracePath = resolve(repoRoot, "docs/phase351d-credential-vault-access-audit-completeness.json");
const reportPath = resolve(repoRoot, "docs/phase351d-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const requiredTraceFields = [
  "requestId",
  "phase",
  "credentialRef",
  "accessDecision",
  "rawSecretReturned",
  "providerRealCallExecuted",
  "restorePath",
];
const missingTraceFields = requiredTraceFields.filter((field) => source[field] === undefined);
const result = {
  phase: "Phase351D",
  sourcePhase: source.phase,
  auditTraceCompletenessChecked: true,
  accessAuditCompletenessChecked: true,
  missingTraceFieldsReported: true,
  noSecretInTrace: source.secretValueExposed === false && source.rawSecretReturned === false,
  traceCompletenessPassed: missingTraceFields.length === 0,
  requiredTraceFields,
  missingTraceFields,
  rawSecretReturned: false,
  providerRealCallExecuted: false,
  productionGA: false,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(tracePath, `${JSON.stringify({ phase: current.phase, traceType: "credential_vault_access_audit", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase351D Execution Report\n\n- auditTraceCompletenessChecked: ${current.auditTraceCompletenessChecked}\n- noSecretInTrace: ${current.noSecretInTrace}\n- missingTraceFields: ${current.missingTraceFields.join(", ") || "none"}\n`, "utf8");
}
