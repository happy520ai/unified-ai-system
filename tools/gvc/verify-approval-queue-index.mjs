import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

async function main() {
  const packageJson = readJson(path.join(repoRoot, "package.json"));
  assert(packageJson.scripts["run:phase2003-gvc-approval-queue-index"], "missing Phase2003 run script");
  assert(packageJson.scripts["verify:phase2003-gvc-approval-queue-index"], "missing Phase2003 verify script");
  assert(existsSync(path.join(repoRoot, "docs/phase2003-gvc-approval-queue-index.md")), "missing Phase2003 docs");

  const { buildApprovalQueueIndex } = await import("./build-approval-queue-index.mjs");
  const result = buildApprovalQueueIndex({ repoRoot });
  assert(result.phaseId === "Phase2003-GVC-Approval-Queue-Index", "phaseId mismatch");
  assert(result.approvalQueueCount >= 1, "expected at least one GVC approval packet");
  assert(result.approvals.every((approval) => approval.status === "approval_required"), "approval queue must only include approval_required packets");
  assert(result.providerCallsMade === false, "providerCallsMade must be false");
  assert(result.secretRead === false, "secretRead must be false");
  assert(result.workspaceCleanClaimed === false, "workspaceCleanClaimed must be false");
  assert(result.recommendedSealed === true, "Phase2003 should recommend sealed");
  console.log("Phase2003 GVC approval queue index verifier passed");
}

main().catch((error) => {
  console.error(`Phase2003 GVC approval queue index verifier failed: ${error.message}`);
  process.exit(1);
});
