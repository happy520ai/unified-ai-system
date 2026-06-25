import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const readmePath = resolve(repoRoot, "README.md");
const agentsPath = resolve(repoRoot, "AGENTS.md");
import { readmeBlock } from "./syncReadmeBlockData.js";
import { agentsBlock } from "./syncAgentsBlockData.js";

const readmePreamble = [
  "# unified-ai-system / AI Gateway Workbench",
  "",
  "Public repo preflight status: dry-run / local preview / governance demo. Default: no real Provider calls. Users bringing their own API key remains a future controlled path, not the default clone path. This README makes no general availability claim and no deployment promise.",
  "",
  "Start with local dry-run checks only:",
  "",
  "```powershell",
  "cmd /c pnpm install",
  "cmd /c pnpm verify:phase606r-open-source-minimum-readiness-lock",
  "cmd /c pnpm verify:phase607r-public-repo-hygiene-preflight",
  "```",
  "",
  "Do not commit secrets, do not run real providers, and do not treat this repository as deployed production software.",
  "",
].join("\n");

const summary = [];

await ensureReadmePreamble(readmePath);
await updateManagedBlock(readmePath, "UNIFIED_AI_SYSTEM_CURRENT_STATE", readmeBlock, "## Layout\n");
summary.push("README.md managed block refreshed");

await updateManagedBlock(agentsPath, "UNIFIED_AI_SYSTEM_AGENT_RULES", agentsBlock, "## Current Local Operation Rules\n");
summary.push("AGENTS.md managed block refreshed");

console.log(JSON.stringify({
  status: "pass",
  updatedFiles: ["README.md", "AGENTS.md"],
  summary,
}, null, 2));

async function updateManagedBlock(filePath, blockName, blockContent, anchor) {
  const startMarker = `<!-- BEGIN ${blockName} -->`;
  const endMarker = `<!-- END ${blockName} -->`;
  const original = String(await readFile(filePath, "utf8")).replace(/\r\n/g, "\n");

  let next = original;
  const existingStart = original.indexOf(startMarker);
  const existingEnd = original.indexOf(endMarker);
  if (existingStart !== -1 && existingEnd !== -1 && existingEnd > existingStart) {
    next = `${original.slice(0, existingStart)}${blockContent}\n${original.slice(existingEnd + endMarker.length)}`;
  } else {
    const anchorIndex = original.indexOf(anchor);
    if (anchorIndex !== -1) {
      next = `${original.slice(0, anchorIndex)}${blockContent}\n\n${original.slice(anchorIndex)}`;
    } else {
      next = `${original}\n\n${blockContent}\n`;
    }
  }

  if (next !== original) {
    await writeFile(filePath, `${next.replace(/\n{3,}/g, "\n\n")}\n`, "utf8");
  }
}

async function ensureReadmePreamble(filePath) {
  const original = String(await readFile(filePath, "utf8")).replace(/\r\n/g, "\n");
  if (original.startsWith(readmePreamble)) {
    return;
  }

  const marker = "<!-- BEGIN UNIFIED_AI_SYSTEM_CURRENT_STATE -->";
  const markerIndex = original.indexOf(marker);
  const body = markerIndex === -1 ? original : original.slice(markerIndex);
  await writeFile(filePath, `${readmePreamble}\n${body.trimStart()}`, "utf8");
}
