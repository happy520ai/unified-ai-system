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
  assert(packageJson.scripts["run:phase2004-gvc-safety-matrix-snapshot"], "missing Phase2004 run script");
  assert(packageJson.scripts["verify:phase2004-gvc-safety-matrix-snapshot"], "missing Phase2004 verify script");
  assert(existsSync(path.join(repoRoot, "docs/phase2004-gvc-safety-matrix-snapshot.md")), "missing Phase2004 docs");

  const { buildSafetyMatrixSnapshot } = await import("./build-safety-matrix-snapshot.mjs");
  const result = buildSafetyMatrixSnapshot({ repoRoot });
  assert(result.phaseId === "Phase2004-GVC-Safety-Matrix-Snapshot", "phaseId mismatch");
  assert(result.sourceCount >= 4, "expected at least four GVC evidence sources");
  assert(result.violations.length === 0, "safety matrix found violations");
  assert(result.recommendedSealed === true, "Phase2004 should recommend sealed");
  assert(result.providerCallsMade === false, "providerCallsMade must be false");
  assert(result.secretRead === false, "secretRead must be false");
  assert(result.chatGatewayExecuteModified === false, "chatGatewayExecuteModified must be false");
  console.log("Phase2004 GVC safety matrix snapshot verifier passed");
}

main().catch((error) => {
  console.error(`Phase2004 GVC safety matrix snapshot verifier failed: ${error.message}`);
  process.exit(1);
});
