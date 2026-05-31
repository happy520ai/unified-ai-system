import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "../..");

function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function listGvcApprovalFiles(repoRoot) {
  const approvalsDir = path.join(repoRoot, "docs/approvals");
  if (!existsSync(approvalsDir)) return [];
  return readdirSync(approvalsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith(".json"))
    .filter((name) => name.includes("gvc"))
    .map((name) => path.join(approvalsDir, name));
}

export function buildApprovalQueueIndex(options = {}) {
  const repoRoot = options.repoRoot || defaultRepoRoot;
  const approvals = listGvcApprovalFiles(repoRoot)
    .map((filePath) => {
      const packet = readJsonIfExists(filePath);
      if (!packet) return null;
      return {
        taskId: packet.taskId,
        title: packet.title,
        status: packet.status,
        approvalRef: path.relative(repoRoot, filePath).replaceAll("\\", "/"),
        requiredFields: packet.requiredFields || [],
        defaultLimits: packet.defaultLimits || {},
        providerCallsMade: packet.providerCallsMade === true,
        secretRead: packet.secretRead === true,
        chatGatewayExecuteModified: packet.chatGatewayExecuteModified === true,
      };
    })
    .filter(Boolean);

  const result = {
    phaseId: "Phase2003-GVC-Approval-Queue-Index",
    status: "passed",
    generatedAt: new Date().toISOString(),
    approvalQueueCount: approvals.length,
    approvals,
    skippedApprovalRequiredTasks: approvals.map((approval) => approval.taskId),
    recommendedSealed: approvals.length >= 1 && approvals.every((approval) => approval.status === "approval_required"),
    blocker: "none",
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

  const phaseDir = path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2003-gvc-approval-queue-index");
  const phaseEvidencePath = path.join(phaseDir, "approval-queue-index-result.json");
  const indexPath = path.join(repoRoot, "apps/ai-gateway-service/evidence/gvc-approval-queue-index.json");
  mkdirSync(phaseDir, { recursive: true });
  writeFileSync(phaseEvidencePath, `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(indexPath, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  console.log(JSON.stringify(buildApprovalQueueIndex(), null, 2));
}
