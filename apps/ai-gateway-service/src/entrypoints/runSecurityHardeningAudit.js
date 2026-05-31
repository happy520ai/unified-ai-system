import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runSecurityVulnerabilityAudit, renderSecurityAuditMarkdown } from "../security/securityVulnerabilityScanner.js";
import { SECURITY_AUDIT_JSON, SECURITY_AUDIT_MD } from "../security/securityAuditPolicy.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

const evidence = runSecurityVulnerabilityAudit();
const jsonPath = resolve(repoRoot, SECURITY_AUDIT_JSON);
const mdPath = resolve(repoRoot, SECURITY_AUDIT_MD);

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
writeFileSync(mdPath, `${renderSecurityAuditMarkdown(evidence)}\n`, "utf8");

console.log(JSON.stringify({
  phase: evidence.phase,
  status: evidence.status,
  conclusion: evidence.conclusion,
  mode: evidence.mode,
  filesScanned: evidence.summary.filesScanned,
  securityFindingsCount: evidence.summary.securityFindingsCount,
  criticalFindings: evidence.summary.criticalFindings,
  highFindings: evidence.summary.highFindings,
  repairsAppliedCount: evidence.summary.repairsAppliedCount,
  verifiersPassedCount: evidence.summary.verifiersPassedCount,
  verifiersFailedCount: evidence.summary.verifiersFailedCount,
  nodeCheckPassedCount: evidence.summary.nodeCheckPassedCount,
  nodeCheckFailedCount: evidence.summary.nodeCheckFailedCount,
  paidApiCallCount: evidence.paidApiCallCount,
  externalApiCalled: evidence.externalApiCalled,
  mimoApiCalled: evidence.mimoApiCalled,
  embeddingApiCalled: evidence.embeddingApiCalled,
  evidenceJsonPath: SECURITY_AUDIT_JSON,
  evidenceMdPath: SECURITY_AUDIT_MD,
}, null, 2));

if (evidence.status !== "passed") {
  process.exitCode = 1;
}
