import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sanitizePath, sanitizeText } from "./safetyBoundaryChecker.js";

export async function indexPhaseEvidence({ repoRoot, limit = 700 }) {
  const evidenceRoot = resolve(repoRoot, "apps/ai-gateway-service/evidence");
  if (!existsSync(evidenceRoot)) {
    return { completed: true, evidenceRoot: "apps/ai-gateway-service/evidence", indexedCount: 0, phases: {} };
  }

  const files = await collectJsonFiles(evidenceRoot, limit);
  const phases = {};
  for (const absolutePath of files) {
    const relativePath = sanitizePath(absolutePath.replace(repoRoot, "").replace(/^[/\\]+/, ""));
    const ref = await summarizeEvidenceFile(absolutePath, relativePath);
    const phaseId = ref.phaseId;
    if (!phases[phaseId]) phases[phaseId] = [];
    phases[phaseId].push(ref);
  }

  return {
    completed: true,
    evidenceRoot: "apps/ai-gateway-service/evidence",
    indexedCount: files.length,
    phaseCount: Object.keys(phases).length,
    phases,
    latestRefs: Object.values(phases)
      .flat()
      .sort((a, b) => a.path.localeCompare(b.path))
      .slice(-40),
    rawSecretAccessed: false,
  };
}

async function collectJsonFiles(root, limit) {
  const pending = [root];
  const files = [];
  while (pending.length > 0 && files.length < limit) {
    const current = pending.shift();
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolutePath);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        files.push(absolutePath);
        if (files.length >= limit) break;
      }
    }
  }
  return files;
}

async function summarizeEvidenceFile(absolutePath, relativePath) {
  const info = await stat(absolutePath);
  let parsed = {};
  try {
    parsed = JSON.parse(await readFile(absolutePath, "utf8"));
  } catch {
    parsed = {};
  }
  const phaseId = String(parsed.phaseKey || parsed.phase || relativePath.match(/phase\d+[a-z]?/i)?.[0] || "unknown").toLowerCase();
  return {
    phaseId,
    path: relativePath,
    bytes: info.size,
    completed: parsed.completed === true || parsed.status === "pass",
    recommended_sealed: parsed.recommended_sealed === true,
    blocker: parsed.blocker === undefined ? null : sanitizeText(String(parsed.blocker)),
    evidenceId: sanitizeText(String(parsed.evidenceId || parsed.phase || phaseId)),
  };
}
