import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isForbiddenPath, sanitizeText } from "./safetyBoundaryChecker.js";

const allowedStateFiles = ["package.json", "README.md", "AGENTS.md", "pnpm-workspace.yaml"];

export async function readProjectState({ repoRoot }) {
  const files = [];
  for (const relativePath of allowedStateFiles) {
    if (isForbiddenPath(relativePath) || !existsSync(resolve(repoRoot, relativePath))) continue;
    const content = await readFile(resolve(repoRoot, relativePath), "utf8");
    files.push(summarizeStateFile(relativePath, content));
  }

  const phaseDocs = await listPhaseDocs(repoRoot);
  const rootPackage = files.find((item) => item.path === "package.json")?.json || {};
  return {
    completed: true,
    mode: "read-only-project-state-summary",
    files,
    packageName: rootPackage.name || "unknown",
    packageVersion: rootPackage.version || "unknown",
    packageScriptCount: Object.keys(rootPackage.scripts || {}).length,
    readmeManagedBlockFound: files.some((item) => item.path === "README.md" && item.markers.includes("UNIFIED_AI_SYSTEM_CURRENT_STATE")),
    agentsManagedBlockFound: files.some((item) => item.path === "AGENTS.md" && item.markers.includes("UNIFIED_AI_SYSTEM_AGENT_RULES")),
    phaseDocs,
    projectStateSummaryPath: ".codex-context/phase-state-summary.md",
    rawSecretAccessed: false,
  };
}

function summarizeStateFile(relativePath, content) {
  const normalized = content.replace(/\r\n/g, "\n");
  const markers = [...normalized.matchAll(/UNIFIED_AI_SYSTEM_[A-Z_]+/g)].map((match) => match[0]);
  const firstHeadings = normalized
    .split("\n")
    .filter((line) => /^#{1,3}\s+/.test(line))
    .slice(0, 12)
    .map((line) => sanitizeText(line.trim()));
  let json = null;
  if (relativePath.endsWith(".json")) {
    try {
      json = JSON.parse(normalized);
    } catch {
      json = null;
    }
  }
  return {
    path: relativePath,
    bytes: Buffer.byteLength(content),
    lineCount: normalized.split("\n").length,
    markers: [...new Set(markers)],
    firstHeadings,
    json,
  };
}

async function listPhaseDocs(repoRoot) {
  const docsDir = resolve(repoRoot, "docs");
  if (!existsSync(docsDir)) return [];
  const names = await readdir(docsDir);
  return names
    .filter((name) => /^phase\d/i.test(name) && name.endsWith(".md"))
    .sort()
    .slice(-80)
    .map((name) => ({ path: `docs/${name}`, phaseId: phaseIdFromName(name) }));
}

function phaseIdFromName(name) {
  return (name.match(/phase\d+[a-z]?/i)?.[0] || "unknown").toLowerCase();
}
