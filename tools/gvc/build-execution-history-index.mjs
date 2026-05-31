import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readProjectBrain } from "./read-project-brain.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "../..");

const phaseEvidenceRefs = [
  "apps/ai-gateway-service/evidence/phase2000-gvc-os/gvc-os-result.json",
  "apps/ai-gateway-service/evidence/phase2001-gvc-task-queue-runner/task-queue-runner-result.json",
];

function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function pickSafety(evidence) {
  return {
    providerCallsMade: evidence?.providerCallsMade === true,
    secretRead: evidence?.secretRead === true,
    deployReleasePerformed: evidence?.deployReleasePerformed === true,
    chatModified: evidence?.chatModified === true,
    chatGatewayExecuteModified: evidence?.chatGatewayExecuteModified === true,
    legacyModified: evidence?.legacyModified === true,
    projectContextModified: evidence?.projectContextModified === true,
    commitPerformed: evidence?.commitPerformed === true,
    pushPerformed: evidence?.pushPerformed === true,
    workspaceCleanClaimed: evidence?.workspaceCleanClaimed === true,
  };
}

export function buildExecutionHistoryIndex(options = {}) {
  const repoRoot = options.repoRoot || defaultRepoRoot;
  const brain = readProjectBrain({ repoRoot });
  const records = phaseEvidenceRefs
    .map((evidenceRef) => {
      const evidence = readJsonIfExists(path.join(repoRoot, evidenceRef));
      if (!evidence) return null;
      return {
        phaseId: evidence.phaseId,
        status: evidence.status,
        recommendedSealed: evidence.recommendedSealed === true,
        blocker: evidence.blocker || "none",
        evidenceRef,
        generatedAt: evidence.generatedAt || null,
        safety: pickSafety(evidence),
      };
    })
    .filter(Boolean);

  const history = {
    phaseId: "Phase2002-GVC-Execution-History-Index",
    status: "passed",
    generatedAt: new Date().toISOString(),
    source: "local_gvc_evidence_only",
    currentProjectBrainPhase: brain.currentState.phaseId,
    recordCount: records.length,
    records,
    safetySummary: {
      providerCallsMade: records.some((record) => record.safety.providerCallsMade),
      secretRead: records.some((record) => record.safety.secretRead),
      deployReleasePerformed: records.some((record) => record.safety.deployReleasePerformed),
      chatGatewayExecuteModified: records.some((record) => record.safety.chatGatewayExecuteModified),
      legacyModified: records.some((record) => record.safety.legacyModified),
      projectContextModified: records.some((record) => record.safety.projectContextModified),
      workspaceCleanClaimed: records.some((record) => record.safety.workspaceCleanClaimed),
    },
    recommendedSealed: records.length >= 2 && records.every((record) => record.recommendedSealed),
    blocker: records.length >= 2 ? "none" : "gvc_history_source_evidence_missing",
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

  const phaseDir = path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2002-gvc-execution-history-index");
  const phaseEvidencePath = path.join(phaseDir, "execution-history-index-result.json");
  const indexPath = path.join(repoRoot, "apps/ai-gateway-service/evidence/gvc-execution-history.json");
  mkdirSync(phaseDir, { recursive: true });
  mkdirSync(path.dirname(indexPath), { recursive: true });
  writeFileSync(phaseEvidencePath, `${JSON.stringify(history, null, 2)}\n`);
  writeFileSync(indexPath, `${JSON.stringify(history, null, 2)}\n`);

  return history;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  console.log(JSON.stringify(buildExecutionHistoryIndex(), null, 2));
}
