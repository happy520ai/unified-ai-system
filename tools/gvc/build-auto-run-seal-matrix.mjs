import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "../..");

const sourceRefs = [
  "apps/ai-gateway-service/evidence/phase2002-gvc-execution-history-index/execution-history-index-result.json",
  "apps/ai-gateway-service/evidence/phase2003-gvc-approval-queue-index/approval-queue-index-result.json",
  "apps/ai-gateway-service/evidence/phase2004-gvc-safety-matrix-snapshot/safety-matrix-snapshot-result.json",
  "apps/ai-gateway-service/evidence/phase2005-gvc-continuous-runner-state/continuous-runner-state-result.json",
];

function readJsonIfExists(repoRoot, ref) {
  const filePath = path.join(repoRoot, ref);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function buildAutoRunSealMatrix(options = {}) {
  const repoRoot = options.repoRoot || defaultRepoRoot;
  const rows = sourceRefs
    .map((evidenceRef) => {
      const evidence = readJsonIfExists(repoRoot, evidenceRef);
      if (!evidence) return null;
      return {
        phaseId: evidence.phaseId,
        status: evidence.status,
        evidenceRef,
        recommendedSealed: evidence.recommendedSealed === true,
        blocker: evidence.blocker || "none",
      };
    })
    .filter(Boolean);
  const missingSourceCount = sourceRefs.length - rows.length;
  const failedRows = rows.filter((row) => row.status !== "passed" || row.recommendedSealed !== true);

  const result = {
    phaseId: "Phase2006-GVC-Auto-Run-Seal-Matrix",
    status: missingSourceCount === 0 && failedRows.length === 0 ? "passed" : "blocked",
    generatedAt: new Date().toISOString(),
    maxAutoTasks: 5,
    actuallyExecutedTasks: rows.map((row) => row.phaseId),
    skippedApprovalRequiredTasks: ["gvc-l3-provider-one-shot-candidate"],
    skippedForbiddenTasks: [],
    lastSuccessfulPhase: rows[rows.length - 1]?.phaseId || null,
    currentBlocker: "approval_required_task_present",
    nextRecommendedTask: "Owner may fill docs/approvals/gvc-l3-provider-one-shot-candidate-approval-required.json, or continue L1 dry-run history hardening.",
    sourceCount: rows.length,
    missingSourceCount,
    failedRows,
    rows,
    recommendedSealed: rows.length === sourceRefs.length && failedRows.length === 0,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    deployReleasePerformed: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    commitPerformed: false,
    pushPerformed: false,
    workspaceCleanClaimed: false,
  };

  const phaseDir = path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2006-gvc-auto-run-seal-matrix");
  const phaseEvidencePath = path.join(phaseDir, "auto-run-seal-matrix-result.json");
  const indexPath = path.join(repoRoot, "apps/ai-gateway-service/evidence/gvc-auto-run-seal-matrix.json");
  mkdirSync(phaseDir, { recursive: true });
  writeFileSync(phaseEvidencePath, `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(indexPath, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  console.log(JSON.stringify(buildAutoRunSealMatrix(), null, 2));
}
