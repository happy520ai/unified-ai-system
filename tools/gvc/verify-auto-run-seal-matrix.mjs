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
  assert(packageJson.scripts["run:phase2006-gvc-auto-run-seal-matrix"], "missing Phase2006 run script");
  assert(packageJson.scripts["verify:phase2006-gvc-auto-run-seal-matrix"], "missing Phase2006 verify script");
  assert(existsSync(path.join(repoRoot, "docs/phase2006-gvc-auto-run-seal-matrix.md")), "missing Phase2006 docs");

  const { buildAutoRunSealMatrix } = await import("./build-auto-run-seal-matrix.mjs");
  const result = buildAutoRunSealMatrix({ repoRoot });
  assert(result.phaseId === "Phase2006-GVC-Auto-Run-Seal-Matrix", "phaseId mismatch");
  assert(result.actuallyExecutedTasks.length >= 4, "expected at least four executed dry-run phases");
  assert(result.skippedApprovalRequiredTasks.includes("gvc-l3-provider-one-shot-candidate"), "missing skipped L3 task");
  assert(result.providerCallsMade === false, "providerCallsMade must be false");
  assert(result.secretRead === false, "secretRead must be false");
  assert(result.deployExecuted === false, "deployExecuted must be false");
  assert(result.chatGatewayExecuteModified === false, "chatGatewayExecuteModified must be false");
  assert(result.recommendedSealed === true, "Phase2006 should recommend sealed");
  console.log("Phase2006 GVC auto-run seal matrix verifier passed");
}

main().catch((error) => {
  console.error(`Phase2006 GVC auto-run seal matrix verifier failed: ${error.message}`);
  process.exit(1);
});
