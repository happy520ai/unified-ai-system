import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const EXCLUDED_DIRS = new Set([
  ".git",
  ".turbo",
  ".next",
  ".pnpm-store",
  ".codex-handoff",
  "coverage",
  "dist",
  "legacy",
  "node_modules",
]);

const SCANNED_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ps1",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

export function scanCodebaseFiles(repoRoot) {
  const files = [];
  walk(repoRoot, files, repoRoot);
  const relativeFiles = files.map((filePath) => normalizePath(relative(repoRoot, filePath))).sort();
  return {
    files: relativeFiles,
    filesScanned: relativeFiles.length,
    jsFiles: relativeFiles.filter((file) => /\.(cjs|js|mjs)$/i.test(file)),
    packageFiles: relativeFiles.filter((file) => file.endsWith("package.json")),
    docsFiles: relativeFiles.filter((file) => file.startsWith("docs/") && file.endsWith(".md")),
    evidenceFiles: relativeFiles.filter((file) => file.includes("/evidence/") && /\.(json|md)$/i.test(file)),
    uiFiles: relativeFiles.filter((file) => file.endsWith("src/ui/consolePage.js")),
    httpFiles: relativeFiles.filter((file) => file.endsWith("src/http/httpServer.js")),
    packageScriptsChecked: relativeFiles.filter((file) => file.endsWith("package.json")).length,
  };
}

export function normalizePath(filePath) {
  return String(filePath).split(sep).join("/");
}

function walk(directory, files, repoRoot) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && EXCLUDED_DIRS.has(entry.name)) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      const relativePath = normalizePath(relative(repoRoot, fullPath));
      const topLevel = relativePath.split("/")[0];
      if (EXCLUDED_DIRS.has(entry.name) || EXCLUDED_DIRS.has(topLevel)) continue;
      walk(fullPath, files, repoRoot);
      continue;
    }
    if (!entry.isFile()) continue;
    const extension = entry.name.includes(".") ? entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase() : "";
    if (!SCANNED_EXTENSIONS.has(extension)) continue;
    const size = statSync(fullPath).size;
    if (size > 1_000_000) continue;
    files.push(fullPath);
  }
}
