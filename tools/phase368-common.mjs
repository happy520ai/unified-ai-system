import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve, relative } from "node:path";

export const repoRoot = resolve(".");

export async function exists(relativePath) {
  try {
    await access(resolve(repoRoot, relativePath), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(relativePath) {
  return JSON.parse(await readFile(resolve(repoRoot, relativePath), "utf8"));
}

export async function readJsonIfExists(relativePath) {
  return (await exists(relativePath)) ? readJson(relativePath) : null;
}

export async function writeJson(relativePath, value) {
  const target = resolve(repoRoot, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(relativePath, value) {
  const target = resolve(repoRoot, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, value.endsWith("\n") ? value : `${value}\n`, "utf8");
}

export function containsSecretLikeText(value) {
  return collectStringValues(value).some((text) =>
    [
      /api[_-]?key/i,
      /\btoken\b/i,
      /\bsecret\b/i,
      /sk-[A-Za-z0-9]{12,}/i,
      /get-content\s+.*\.env/i,
      /\btype\s+.*\.env/i,
      /\bcat\s+.*\.env/i,
    ].some((pattern) => pattern.test(text)),
  );
}

export function collectStringValues(value, acc = []) {
  if (typeof value === "string") {
    acc.push(value);
    return acc;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringValues(item, acc);
    }
    return acc;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectStringValues(item, acc);
    }
  }
  return acc;
}

export async function walkRelativeFiles(startRelativePath) {
  const start = resolve(repoRoot, startRelativePath);
  const results = [];

  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "legacy") {
        continue;
      }
      const fullPath = resolve(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        results.push(relative(repoRoot, fullPath).replace(/\\/g, "/"));
      }
    }
  }

  if (await exists(startRelativePath)) {
    await walk(start);
  }

  return results.sort();
}

export async function loadPackageScripts(relativePath) {
  const json = await readJson(relativePath);
  return {
    packagePath: relativePath.replace(/\\/g, "/"),
    packageName: json.name ?? null,
    scripts: json.scripts ?? {},
  };
}

export function classifyCommand(command) {
  const normalized = String(command || "").trim();
  if (
    normalized === "pnpm start:pme" ||
    normalized === "pnpm dev:phase7b" ||
    normalized === "pnpm start:ai-gateway-service" ||
    normalized === "pnpm start:agent-console"
  ) {
    return "local_runtime_activation";
  }
  if (/^pnpm run verify:/i.test(normalized) || /^pnpm run smoke:/i.test(normalized) || normalized === "pnpm -r --if-present check") {
    return "verification_only";
  }
  if (normalized === "pnpm run build" || normalized === "pnpm build") {
    return "build_only";
  }
  return "not_deploy";
}

export function hasExplicitDeploySignal(command) {
  const normalized = String(command || "").toLowerCase();
  return /\bdeploy\b/.test(normalized) || /\brelease\b/.test(normalized) || /\bpublish\b/.test(normalized);
}
