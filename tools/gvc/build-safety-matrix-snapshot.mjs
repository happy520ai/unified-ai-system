import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "../..");

const sourceRefs = [
  "apps/ai-gateway-service/evidence/phase2000-gvc-os/gvc-os-result.json",
  "apps/ai-gateway-service/evidence/phase2001-gvc-task-queue-runner/task-queue-runner-result.json",
  "apps/ai-gateway-service/evidence/phase2002-gvc-execution-history-index/execution-history-index-result.json",
  "apps/ai-gateway-service/evidence/phase2003-gvc-approval-queue-index/approval-queue-index-result.json",
];

function readJsonIfExists(repoRoot, ref) {
  const filePath = path.join(repoRoot, ref);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function flag(evidence, key) {
  return evidence?.[key] === true;
}

export function buildSafetyMatrixSnapshot(options = {}) {
  const repoRoot = options.repoRoot || defaultRepoRoot;
  const rows = sourceRefs
    .map((evidenceRef) => {
      const evidence = readJsonIfExists(repoRoot, evidenceRef);
      if (!evidence) return null;
      return {
        phaseId: evidence.phaseId,
        evidenceRef,
        providerCallsMade: flag(evidence, "providerCallsMade"),
        secretRead: flag(evidence, "secretRead"),
        deployReleasePerformed: flag(evidence, "deployReleasePerformed"),
        chatModified: flag(evidence, "chatModified"),
        chatGatewayExecuteModified: flag(evidence, "chatGatewayExecuteModified"),
        legacyModified: flag(evidence, "legacyModified"),
        projectContextModified: flag(evidence, "projectContextModified"),
        commitPerformed: flag(evidence, "commitPerformed"),
        pushPerformed: flag(evidence, "pushPerformed"),
        workspaceCleanClaimed: flag(evidence, "workspaceCleanClaimed"),
      };
    })
    .filter(Boolean);

  const violations = rows.flatMap((row) =>
    Object.entries(row)
      .filter(([key, value]) => key !== "phaseId" && key !== "evidenceRef" && value === true)
      .map(([key]) => ({ phaseId: row.phaseId, evidenceRef: row.evidenceRef, violation: key })),
  );

  const result = {
    phaseId: "Phase2004-GVC-Safety-Matrix-Snapshot",
    status: violations.length === 0 ? "passed" : "blocked",
    generatedAt: new Date().toISOString(),
    sourceCount: rows.length,
    rows,
    violations,
    recommendedSealed: rows.length >= 4 && violations.length === 0,
    blocker: violations.length === 0 ? "none" : "gvc_safety_violation_detected",
    providerCallsMade: false,
    secretRead: false,
    deployReleasePerformed: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    commitPerformed: false,
    pushPerformed: false,
    workspaceCleanClaimed: false,
  };

  const phaseDir = path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2004-gvc-safety-matrix-snapshot");
  const phaseEvidencePath = path.join(phaseDir, "safety-matrix-snapshot-result.json");
  const indexPath = path.join(repoRoot, "apps/ai-gateway-service/evidence/gvc-safety-matrix-snapshot.json");
  mkdirSync(phaseDir, { recursive: true });
  writeFileSync(phaseEvidencePath, `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(indexPath, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  console.log(JSON.stringify(buildSafetyMatrixSnapshot(), null, 2));
}
