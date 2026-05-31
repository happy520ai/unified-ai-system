import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  renderFullCodebaseAuditMarkdown,
  runFullCodebaseAudit,
} from "../audit/fullCodebaseAudit.js";
import {
  FULL_CODEBASE_AUDIT_JSON,
  FULL_CODEBASE_AUDIT_MD,
} from "../audit/codebaseAuditPolicy.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

async function main() {
  const evidence = runFullCodebaseAudit();
  const jsonPath = resolve(repoRoot, FULL_CODEBASE_AUDIT_JSON);
  const mdPath = resolve(repoRoot, FULL_CODEBASE_AUDIT_MD);

  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(mdPath, renderFullCodebaseAuditMarkdown(evidence), "utf8");

  console.log(JSON.stringify({
    phase: evidence.phase,
    status: evidence.status,
    conclusion: evidence.conclusion,
    mode: evidence.mode,
    filesScanned: evidence.summary.filesScanned,
    jsFilesChecked: evidence.summary.jsFilesChecked,
    packageScriptsChecked: evidence.summary.packageScriptsChecked,
    phaseEvidenceChecked: evidence.summary.phaseEvidenceChecked,
    docsChecked: evidence.summary.docsChecked,
    uiPanelsChecked: evidence.summary.uiPanelsChecked,
    httpEndpointsChecked: evidence.summary.httpEndpointsChecked,
    issuesFoundCount: evidence.summary.issuesFoundCount,
    criticalIssues: evidence.summary.criticalIssues,
    highIssues: evidence.summary.highIssues,
    infoFindings: evidence.summary.infoFindings,
    repairsAppliedCount: evidence.summary.repairsAppliedCount,
    verifiersPassedCount: evidence.summary.verifiersPassedCount,
    verifiersFailedCount: evidence.summary.verifiersFailedCount,
    nodeCheckPassedCount: evidence.summary.nodeCheckPassedCount,
    nodeCheckFailedCount: evidence.summary.nodeCheckFailedCount,
    paidApiCallCount: evidence.paidApiCallCount,
    externalApiCalled: evidence.externalApiCalled,
    mimoApiCalled: evidence.mimoApiCalled,
    embeddingApiCalled: evidence.embeddingApiCalled,
    evidenceJsonPath: FULL_CODEBASE_AUDIT_JSON,
    evidenceMdPath: FULL_CODEBASE_AUDIT_MD,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
