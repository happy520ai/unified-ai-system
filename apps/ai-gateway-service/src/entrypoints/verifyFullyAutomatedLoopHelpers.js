import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { repoRoot } from "./verifyAgentWorkforceClosureSupport.js";

/**
 * Write a small sample Codex result into the handoff inbox so that
 * wait-and-import / manual-bridge-loop verifiers have something to consume.
 */
export async function prepareSampleCodexResult() {
  const inboxDir = resolve(repoRoot, ".codex-handoff/inbox");
  await mkdir(inboxDir, { recursive: true });
  const text = `# Codex Result

## Summary
Sample/manual bridge result for verification.

## Changed Files
- none

## Commands Run
- none

## Tests Passed
- passed

## Evidence Paths
- .codex-handoff/inbox/latest-codex-result.md

## Known Issues
- none

## Boundary Check
- legacy/ modified: no
- PROJECT_CONTEXT.md created: no
- oh-my-codex / OMX called: no
- worktree created: no
- workflow run hookup: no
- default NVIDIA /chat lane changed: no
- secret exposed: no
- failed verification: no

## Next Steps
- Import and review feedback.
`;
  await writeFile(resolve(inboxDir, "latest-codex-result.md"), text, "utf8");
}

/**
 * Scan stdout for the first JSON object.  PowerShell commands may print
 * status / progress lines before the actual JSON payload, so we walk
 * forward character-by-character until we find a parseable `{…}` block.
 */
export function parseJsonOutput(text) {
  const trimmed = String(text || "").trim();
  for (let start = 0; start < trimmed.length; start += 1) {
    if (trimmed[start] !== "{") continue;
    try {
      return JSON.parse(trimmed.slice(start).trim());
    } catch {
      // Keep scanning: PowerShell commands may print status lines before JSON.
    }
  }
  return {};
}
