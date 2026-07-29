import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

export async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") return null;
    throw error;
  }
}

export function readJsonSync(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function readJsonFileSync(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function readJsonFileSyncOrNullWithBom(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

export function readRepoJsonSync(relativePath) {
  return readJsonFileSync(resolve(repoRoot, relativePath));
}

export function readRepoJsonSyncWithOptions(relativePath, options = {}) {
  const filePath = resolve(repoRoot, relativePath);
  if (!existsSync(filePath)) {
    if (options.optional) return null;
    throw new Error(`Missing JSON file: ${relativePath}`);
  }
  return readJsonFileSync(filePath);
}

export function readCheckedJsonFile(path, checkName, readRequiredText, assertCheck) {
  const text = readRequiredText(path, checkName);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    assertCheck(`${checkName}_valid_json`, false, error instanceof Error ? error.message : String(error));
    return {};
  }
}

export async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function readRepoJson(relativePath) {
  return readJsonFile(resolve(repoRoot, relativePath));
}

export async function readText(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export function readTextFileSync(filePath) {
  return readFileSync(filePath, "utf8");
}

export function readTextFileSyncOrEmpty(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

export function readRepoTextSync(relativePath) {
  return readTextFileSync(resolve(repoRoot, relativePath));
}

export function readRepoTextSyncOrEmpty(relativePath) {
  return readTextFileSyncOrEmpty(resolve(repoRoot, relativePath));
}

export async function readRepoText(relativePath) {
  return readFile(resolve(repoRoot, relativePath), "utf8");
}

export async function readRepoTextNormalized(relativePath) {
  return String(await readRepoText(relativePath)).replace(/\r\n/g, "\n");
}

export async function writeJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeRepoJsonSync(relativePath, value) {
  writeFileSync(resolve(repoRoot, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
