/**
 * evidenceWriter.mjs — Shared evidence file writer.
 *
 * Consolidates 20+ duplicate writeEvidence() definitions across tools/ and apps/.
 * All variants write JSON with mkdir -p to a path relative to repoRoot.
 *
 * @module evidenceWriter
 */

import { mkdirSync, writeFileSync, mkdir, writeFile } from "fs";
import { dirname, join, resolve } from "path";

/**
 * Synchronous evidence file writer.
 *
 * @param {string} relativePath - Path relative to repoRoot (or absolute).
 * @param {*} value - Data to serialize as JSON.
 * @param {string} [repoRoot=process.cwd()] - Repository root directory.
 * @returns {string} The absolute file path written to.
 */
export function writeEvidenceFile(relativePath, value, repoRoot = process.cwd()) {
  const filePath = resolve(repoRoot, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

/**
 * Async evidence file writer.
 *
 * @param {string} relativePath - Path relative to repoRoot (or absolute).
 * @param {*} value - Data to serialize as JSON.
 * @param {string} [repoRoot=process.cwd()] - Repository root directory.
 * @returns {Promise<string>} The absolute file path written to.
 */
export async function writeEvidenceFileAsync(relativePath, value, repoRoot = process.cwd()) {
  const filePath = resolve(repoRoot, relativePath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}
