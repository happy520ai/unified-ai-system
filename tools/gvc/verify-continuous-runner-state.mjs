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
  assert(packageJson.scripts["run:phase2005-gvc-continuous-runner-state"], "missing Phase2005 run script");
  assert(packageJson.scripts["verify:phase2005-gvc-continuous-runner-state"], "missing Phase2005 verify script");
  assert(existsSync(path.join(repoRoot, "docs/phase2005-gvc-continuous-runner-state.md")), "missing Phase2005 docs");

  const { buildContinuousRunnerState } = await import("./build-continuous-runner-state.mjs");
  const result = buildContinuousRunnerState({ repoRoot });
  assert(result.phaseId === "Phase2005-GVC-Continuous-Runner-State", "phaseId mismatch");
  assert(result.actuallyExecutedTasks.length >= 3, "expected at least three executed dry-run tasks");
  assert(result.skippedApprovalRequiredTasks.length >= 1, "expected at least one skipped approval-required task");
  assert(result.providerCallsMade === false, "providerCallsMade must be false");
  assert(result.secretRead === false, "secretRead must be false");
  assert(result.deployReleasePerformed === false, "deployReleasePerformed must be false");
  assert(result.chatGatewayExecuteModified === false, "chatGatewayExecuteModified must be false");
  assert(result.recommendedSealed === true, "Phase2005 should recommend sealed");
  console.log("Phase2005 GVC continuous runner state verifier passed");
}

main().catch((error) => {
  console.error(`Phase2005 GVC continuous runner state verifier failed: ${error.message}`);
  process.exit(1);
});
