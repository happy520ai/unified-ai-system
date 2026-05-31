import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";

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

export async function readText(relativePath) {
  return readFile(resolve(repoRoot, relativePath), "utf8");
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

export function toChecklist(items) {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    pass: Boolean(item.pass),
    detail: item.detail || "",
  }));
}

export function hasSecretLikeValue(value) {
  return /\b(?:nvapi[-_][A-Za-z0-9._-]{8,}|sk-proj[-_][A-Za-z0-9._-]{8,}|sk[-_][A-Za-z0-9._-]{8,}|pk[-_][A-Za-z0-9._-]{8,}|ak[-_][A-Za-z0-9._-]{8,})\b/i.test(String(value ?? ""));
}
