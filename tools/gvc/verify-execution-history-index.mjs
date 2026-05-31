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
  assert(packageJson.scripts["run:phase2002-gvc-execution-history-index"], "missing Phase2002 run script");
  assert(packageJson.scripts["verify:phase2002-gvc-execution-history-index"], "missing Phase2002 verify script");
  assert(existsSync(path.join(repoRoot, "docs/phase2002-gvc-execution-history-index.md")), "missing Phase2002 docs");

  const { buildExecutionHistoryIndex } = await import("./build-execution-history-index.mjs");
  const result = buildExecutionHistoryIndex({ repoRoot });
  const indexPath = path.join(repoRoot, "apps/ai-gateway-service/evidence/gvc-execution-history.json");
  const phasePath = path.join(
    repoRoot,
    "apps/ai-gateway-service/evidence/phase2002-gvc-execution-history-index/execution-history-index-result.json",
  );
  assert(existsSync(indexPath), "missing execution history index");
  assert(existsSync(phasePath), "missing Phase2002 evidence");
  assert(result.phaseId === "Phase2002-GVC-Execution-History-Index", "phaseId mismatch");
  assert(result.recordCount >= 2, "expected at least Phase2000 and Phase2001 records");
  assert(result.records.some((record) => record.phaseId === "Phase2000-GVC-OS"), "missing Phase2000 record");
  assert(result.records.some((record) => record.phaseId === "Phase2001-GVC-Task-Queue-Runner"), "missing Phase2001 record");
  assert(result.providerCallsMade === false, "providerCallsMade must be false");
  assert(result.secretRead === false, "secretRead must be false");
  assert(result.chatGatewayExecuteModified === false, "chatGatewayExecuteModified must be false");
  assert(result.workspaceCleanClaimed === false, "workspaceCleanClaimed must be false");
  assert(result.recommendedSealed === true, "Phase2002 should recommend sealed");
  console.log("Phase2002 GVC execution history index verifier passed");
}

main().catch((error) => {
  console.error(`Phase2002 GVC execution history index verifier failed: ${error.message}`);
  process.exit(1);
});
