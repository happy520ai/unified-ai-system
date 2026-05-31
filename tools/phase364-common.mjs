import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";

export const repoRoot = resolve(".");
export const goNoGoDecisionRecordPath = "docs/approvals/phase364/go-no-go-decision-record.json";

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
  if (!(await exists(relativePath))) return null;
  return readJson(relativePath);
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
      /api[_-]?key\s*[:=]/i,
      /\.env\s*[:=]/i,
      /sk-[A-Za-z0-9]{12,}/i,
      /secret\s*[:=]/i,
      /token\s*[:=]/i,
    ].some((pattern) => pattern.test(text)),
  );
}

export function collectStringValues(value, acc = []) {
  if (typeof value === "string") {
    acc.push(value);
    return acc;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringValues(item, acc);
    return acc;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStringValues(item, acc);
  }
  return acc;
}
