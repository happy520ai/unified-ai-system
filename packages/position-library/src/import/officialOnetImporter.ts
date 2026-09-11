import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ONET_31_0_SOURCE = Object.freeze({
  sourceId: "onet", sourceVersion: "31.0", dataset: "occupation_data",
  sourceUrl: "https://www.onetcenter.org/dl_files/database/db_31_0_json/occupation_data.json",
  dataDictionaryUrl: "https://www.onetcenter.org/dictionary/31.0/json/occupation_data.html",
  retrievedAt: "2026-09-08T16:40:43.936Z",
  sha256: "8eec5d2449c0b96a90fca0f67184b3bf76c15b3549c4f145adb48c3ae55f52f8",
  byteLength: 345874, occupationCount: 1016,
  license: "CC-BY-4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  licenseSourceUrl: "https://www.onetcenter.org/license_db.html",
  attribution: "O*NET® 31.0 Database, U.S. Department of Labor, Employment and Training Administration (USDOL/ETA).",
  sourceRef: "onet:31.0:occupation_data",
  licenseBoundary: "reviewed_pinned_occupation_data_only",
  modifications: "Original JSON bytes, codes, titles and descriptions unchanged; Unified AI System adds candidate IDs, provenance and inactive safety metadata. USDOL/ETA has not approved, endorsed or tested these additions.",
});

type OccupationRow = { onetsoc_code: string; title: string; description: string };
type OccupationDocument = { row: OccupationRow[] };
const assetPath = fileURLToPath(new URL("../data/onet-31.0-occupation-data.json", import.meta.url));

function reject(message: string): never {
  throw Object.assign(new Error(message), { code: "OFFICIAL_ONET_SOURCE_INVALID" });
}
function exactObject(value: unknown, keys: string[]): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
}
function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum
    && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value);
}

/** Pure schema check, not an import or permission to accept unpinned bytes. */
export function validateOnet31OccupationDocument(value: unknown): asserts value is OccupationDocument {
  if (!exactObject(value, ["table_id", "title", "description", "data_dictionary", "column", "row"])
    || value.table_id !== "occupation_data" || value.title !== "Occupation Data"
    || value.description !== "Provide O*NET-SOC codes, titles, and descriptions."
    || value.data_dictionary !== ONET_31_0_SOURCE.dataDictionaryUrl
    || !Array.isArray(value.column) || value.column.length !== 3
    || !Array.isArray(value.row) || value.row.length !== ONET_31_0_SOURCE.occupationCount) {
    reject("Unexpected O*NET occupation table, version or row count.");
  }
  const columns = [
    ["onetsoc_code", "O*NET-SOC Code", "O*NET-SOC Code", "Character(10)"],
    ["title", "Title", "O*NET-SOC Title", "Character Varying(150)"],
    ["description", "Description", "O*NET-SOC Description", "Character Varying(1000)"],
  ];
  for (const [index, column] of value.column.entries()) {
    const [id, title, description, format] = columns[index];
    if (!exactObject(column, ["column_id", "optional", "title", "description", "type", "format"])
      || column.column_id !== id || column.title !== title || column.description !== description
      || column.format !== format || column.type !== "Text" || column.optional !== false) {
      reject("Unexpected O*NET occupation column schema.");
    }
  }
  const codes = new Set<string>();
  for (const row of value.row) {
    if (!exactObject(row, ["onetsoc_code", "title", "description"])
      || typeof row.onetsoc_code !== "string" || row.onetsoc_code.length !== 10 || !/^\d{2}-\d{4}\.\d{2}$/u.test(row.onetsoc_code)
      || !boundedText(row.title, 150) || !boundedText(row.description, 1000)) {
      reject("Malformed O*NET occupation code, title or description.");
    }
    if (codes.has(row.onetsoc_code)) reject("Duplicate O*NET occupation code.");
    codes.add(row.onetsoc_code);
  }
}

/** Identity follows the source code; a title change does not create a new occupation. */
export function officialOnetPositionId(sourceCode: string): string {
  if (typeof sourceCode !== "string" || sourceCode.length !== 10 || !/^\d{2}-\d{4}\.\d{2}$/u.test(sourceCode)) reject("Invalid O*NET occupation code.");
  return `onet-occupation-${sourceCode}`;
}

/** Only these exact licensed bytes can become imported occupation candidates. */
export function parsePinnedOnetOccupationBytes(bytes: Uint8Array) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== ONET_31_0_SOURCE.byteLength) reject("O*NET source byte length does not match the pinned artifact.");
  // Callers may own or share the input buffer. Hash and decode one private copy
  // so later caller writes cannot acquire the pinned source's provenance.
  const snapshot = Buffer.from(bytes);
  if (createHash("sha256").update(snapshot).digest("hex") !== ONET_31_0_SOURCE.sha256) reject("O*NET source digest does not match the pinned artifact.");
  let document: unknown;
  try { document = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(snapshot)); }
  catch { reject("O*NET source is not valid UTF-8 JSON."); }
  validateOnet31OccupationDocument(document);
  const imported = document.row.map((row) => Object.freeze({
    positionId: officialOnetPositionId(row.onetsoc_code), source: "O*NET® 31.0 Database",
    sourceCode: row.onetsoc_code, sourceTitle: row.title, canonicalTitle: row.title,
    sourceDescription: row.description, aliases: Object.freeze([]), occupationGroup: "unassessed",
    industryDomain: "unassessed", skillLevel: "unassessed", skillTags: Object.freeze([]),
    knowledgeTags: Object.freeze([]), taskTags: Object.freeze([]), seniorityApplicability: Object.freeze([]),
    sourceRef: `${ONET_31_0_SOURCE.sourceRef}:${row.onetsoc_code}`, sourceMetadata: ONET_31_0_SOURCE,
    importStatus: "official_local_imported", status: "occupation_candidate", confidence: 1,
    version: ONET_31_0_SOURCE.sourceVersion,
  }));
  return Object.freeze({ source: ONET_31_0_SOURCE, imported: Object.freeze(imported),
    noNetworkImport: true, providerCallsMade: false, allWorldJobsClaimed: false });
}

/** Fixed local asset only. No file access occurs when this module is imported. */
export function importOfficialOnetOccupations() {
  const parent = dirname(assetPath);
  const directory = lstatSync(parent);
  const before = lstatSync(assetPath, { bigint: true });
  if (!directory.isDirectory() || directory.isSymbolicLink() || realpathSync(parent) !== resolve(parent)
    || !before.isFile() || before.isSymbolicLink() || before.size !== BigInt(ONET_31_0_SOURCE.byteLength)) {
    reject("O*NET source must be the unchanged fixed regular file in the real data directory.");
  }
  const descriptor = openSync(assetPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    const unchanged = (current: typeof opened) => current.isFile() && !current.isSymbolicLink()
      && current.dev === before.dev && current.ino === before.ino && current.birthtimeNs === before.birthtimeNs
      && current.size === before.size && current.mtimeNs === before.mtimeNs;
    if (!unchanged(opened)) reject("O*NET source identity changed before reading.");
    const bytes = Buffer.alloc(ONET_31_0_SOURCE.byteLength + 1);
    let length = 0;
    while (length < bytes.length) {
      const count = readSync(descriptor, bytes, length, bytes.length - length, length);
      if (count === 0) break;
      length += count;
    }
    if (!unchanged(fstatSync(descriptor, { bigint: true })) || !unchanged(lstatSync(assetPath, { bigint: true }))
      || realpathSync(parent) !== resolve(parent)) reject("O*NET source identity changed while reading.");
    return parsePinnedOnetOccupationBytes(bytes.subarray(0, length));
  } finally { closeSync(descriptor); }
}
