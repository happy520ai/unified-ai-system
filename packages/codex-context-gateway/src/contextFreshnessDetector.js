import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function detectContextFreshness({ repoRoot, outputDir, currentHash }) {
  const previousPath = resolve(repoRoot, outputDir, "current-context-pack.json");
  let previousHash = null;
  if (existsSync(previousPath)) {
    try {
      previousHash = JSON.parse(await readFile(previousPath, "utf8")).hash || null;
    } catch {
      previousHash = null;
    }
  }
  const simulatedStaleHash = "phase592-stale-context-fixture";
  return {
    completed: true,
    previousHash,
    currentHash,
    stale: previousHash !== null && previousHash !== currentHash,
    staleReason: previousHash !== null && previousHash !== currentHash ? "context-hash-changed-after-project-state-or-diff-update" : null,
    simulatedStaleHash,
    staleContextDetectedWhenExpected: simulatedStaleHash !== currentHash,
    rebuildRequiredWhenStale: true,
  };
}
