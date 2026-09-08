import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { ONET_31_0_SOURCE, importOfficialOnetOccupations, officialOnetPositionId,
  parsePinnedOnetOccupationBytes, validateOnet31OccupationDocument } from "./import/officialOnetImporter.ts";
import { sourceBackedExpandedSeed, buildOfficialImportPlan, getOfficialSource, assertLicenseBoundary } from "./index.js";
import { buildEmployeeCatalog, buildOfficialEmployeeCatalog } from "../../workforce-scheduler/src/employee/employeeCatalogBuilder.js";
import { canScheduleEmployee } from "../../workforce-scheduler/src/loadPolicy.js";

const asset = new URL("./data/onet-31.0-occupation-data.json", import.meta.url);
const sourceBytes = readFileSync(asset);
const freshDocument = () => JSON.parse(sourceBytes.toString("utf8"));
const sourceError = { code: "OFFICIAL_ONET_SOURCE_INVALID" };

test("imports exactly the 1016 pinned official occupation rows without inventing skills", () => {
  const result = importOfficialOnetOccupations();
  assert.equal(sourceBytes.byteLength, 345874);
  assert.equal(createHash("sha256").update(sourceBytes).digest("hex"), ONET_31_0_SOURCE.sha256);
  assert.equal(result.imported.length, 1016);
  assert.equal(new Set(result.imported.map((row) => row.positionId)).size, 1016);
  assert.deepEqual(result.source, ONET_31_0_SOURCE);
  assert.equal(result.noNetworkImport, true);
  assert.equal(result.providerCallsMade, false);
  assert.equal(result.allWorldJobsClaimed, false);
  const originalRows = freshDocument().row;
  for (const [index, position] of result.imported.entries()) {
    const original = originalRows[index];
    assert.equal(position.sourceCode, original.onetsoc_code);
    assert.equal(position.sourceTitle, original.title);
    assert.equal(position.canonicalTitle, original.title);
    assert.equal(position.sourceDescription, original.description);
    assert.deepEqual(position.sourceMetadata, ONET_31_0_SOURCE);
    assert.equal(position.sourceRef, `onet:31.0:occupation_data:${original.onetsoc_code}`);
    assert.equal(position.status, "occupation_candidate");
    for (const field of ["skillTags", "knowledgeTags", "taskTags", "aliases", "seniorityApplicability"]) assert.deepEqual(position[field], []);
  }
});

test("rejects changed bytes before JSON parsing and rejects truncated/oversized sources", () => {
  const changed = Buffer.from(sourceBytes);
  changed[0] = "!".charCodeAt(0);
  assert.throws(() => parsePinnedOnetOccupationBytes(changed), /digest does not match/);
  assert.throws(() => parsePinnedOnetOccupationBytes(sourceBytes.subarray(1)), /byte length/);
  assert.throws(() => parsePinnedOnetOccupationBytes(Buffer.concat([sourceBytes, Buffer.from(" ")])), /byte length/);
});

test("decodes the same private byte snapshot that passed the source digest", () => {
  const bytes = Buffer.from(sourceBytes);
  const offset = bytes.indexOf(Buffer.from("Determine and formulate policies"));
  assert.ok(offset > 0);
  const NativeDecoder = globalThis.TextDecoder;
  // Deterministically mutate caller-owned storage between hashing and decoding,
  // the same integrity boundary exposed by a shared worker buffer.
  globalThis.TextDecoder = class extends NativeDecoder {
    constructor(...args) { super(...args); bytes[offset] = "X".charCodeAt(0); }
  };
  try {
    const result = parsePinnedOnetOccupationBytes(bytes);
    assert.equal(bytes[offset], "X".charCodeAt(0));
    assert.equal(result.imported[0].sourceDescription, freshDocument().row[0].description);
  } finally { globalThis.TextDecoder = NativeDecoder; }
});

test("rejects an unknown dictionary version, table and missing/extra fields", () => {
  for (const mutate of [
    (doc) => { doc.data_dictionary = doc.data_dictionary.replace("31.0", "32.0"); },
    (doc) => { doc.table_id = "skills"; },
    (doc) => { doc.additional = "unexpected"; },
    (doc) => { delete doc.row[0].description; },
    (doc) => { doc.row[0].skills = ["invented"]; },
    (doc) => { doc.column[0].optional = true; },
    (doc) => { doc.row.pop(); },
  ]) {
    const document = freshDocument(); mutate(document);
    assert.throws(() => validateOnet31OccupationDocument(document), sourceError);
  }
});

test("rejects duplicate codes and malformed or unbounded occupation text", () => {
  for (const mutate of [
    (doc) => { doc.row[1].onetsoc_code = doc.row[0].onetsoc_code; },
    (doc) => { doc.row[0].onetsoc_code = "11-1011.00\n"; },
    (doc) => { doc.row[0].title = "x".repeat(151); },
    (doc) => { doc.row[0].description = "x".repeat(1001); },
    (doc) => { doc.row[0].title = ""; },
    (doc) => { doc.row[0].description = "bad\u0000text"; },
  ]) {
    const document = freshDocument(); mutate(document);
    assert.throws(() => validateOnet31OccupationDocument(document), sourceError);
  }
});

test("occupation identity is source-code based and independent of title", () => {
  const document = freshDocument();
  const id = officialOnetPositionId(document.row[0].onetsoc_code);
  document.row[0].title = "A changed title in a hypothetical future release";
  validateOnet31OccupationDocument(document);
  assert.equal(officialOnetPositionId(document.row[0].onetsoc_code), id);
  assert.equal(id, "onet-occupation-11-1011.00");
  assert.throws(() => officialOnetPositionId("11-1011.00\n"), sourceError);
  // Schema validation does not turn hypothetical source changes into importable data.
  assert.throws(() => parsePinnedOnetOccupationBytes(Buffer.from(JSON.stringify(document))), sourceError);
});

test("official employees remain inactive candidates and preserve all source provenance", () => {
  const oldSeed = JSON.stringify(sourceBackedExpandedSeed);
  const defaultCatalog = buildEmployeeCatalog();
  const catalog = buildOfficialEmployeeCatalog();
  assert.equal(catalog.length, 1016);
  for (const employee of catalog) {
    assert.equal(employee.status, "occupation_candidate");
    assert.deepEqual(employee.capabilities, []);
    assert.deepEqual(employee.allowedTaskTypes, []);
    assert.equal(employee.requiresApproval, true);
    assert.equal(employee.pyramidLevel, null);
    assert.equal(employee.seniority, null);
    assert.equal(employee.brainBinding.mode, "dry_run");
    assert.equal(employee.brainBinding.maxRequestsPerTask, 0);
    assert.equal(employee.brainBinding.maxEstimatedCostUsd, 0);
    assert.equal(employee.maxConcurrency, 0);
    assert.equal(canScheduleEmployee(employee), false);
    assert.deepEqual(employee.sourceMetadata, ONET_31_0_SOURCE);
    assert.equal(employee.sourcePositionId, officialOnetPositionId(employee.sourceCode));
    assert.ok(employee.sourceDescription.length > 0);
  }
  assert.equal(sourceBackedExpandedSeed.length, 60);
  assert.equal(defaultCatalog.length, 69);
  assert.equal(JSON.stringify(sourceBackedExpandedSeed), oldSeed);
  assert.deepEqual(buildEmployeeCatalog(), defaultCatalog);
});

test("only the explicitly pinned O*NET occupation artifact passes the source license gate", () => {
  const plan = buildOfficialImportPlan();
  for (const source of plan.sourcePlans) {
    const expected = source.sourceId === "onet";
    assert.equal(source.licenseCheck.allowedToImportNow, expected);
    assert.equal(source.licenseCheck.noNetworkImport, true);
    if (expected) {
      assert.deepEqual(source.pinnedArtifact, ONET_31_0_SOURCE);
      assert.equal(source.sourceRefPreview.sourceVersion, "31.0");
      assert.equal(source.importGate, "explicit_pinned_local_import_only");
    }
  }
  assert.equal(assertLicenseBoundary({ ...getOfficialSource("onet"), pinnedArtifact: { ...ONET_31_0_SOURCE, sourceVersion: "32.0" } }).allowedToImportNow, false);
  assert.equal(assertLicenseBoundary({ sourceId: "onet" }).allowedToImportNow, false);
});

test("importing the module does not read the asset; explicit import refuses missing and changed files", async () => {
  const temporary = mkdtempSync(join(realpathSync(tmpdir()), "uai-onet-import-"));
  try {
    mkdirSync(join(temporary, "import")); mkdirSync(join(temporary, "data"));
    copyFileSync(new URL("./import/officialOnetImporter.ts", import.meta.url), join(temporary, "import/importer.ts"));
    const isolated = await import(pathToFileURL(join(temporary, "import/importer.ts")).href);
    const target = join(temporary, "data/onet-31.0-occupation-data.json");
    assert.equal(existsSync(target), false);
    assert.equal(isolated.ONET_31_0_SOURCE.sha256, ONET_31_0_SOURCE.sha256);
    assert.throws(() => isolated.importOfficialOnetOccupations(), { code: "ENOENT" });
    const changed = Buffer.from(sourceBytes); changed[0] = 33;
    writeFileSync(target, changed);
    assert.throws(() => isolated.importOfficialOnetOccupations(), /digest does not match/);
    writeFileSync(target, sourceBytes);
    assert.equal(isolated.importOfficialOnetOccupations().imported.length, 1016);
  } finally {
    const target = resolve(temporary);
    assert.equal(dirname(target), realpathSync(tmpdir()));
    assert.equal(realpathSync(target), target);
    assert.ok(basename(target).startsWith("uai-onet-import-") && !lstatSync(target).isSymbolicLink());
    rmSync(target, { recursive: true, force: true });
  }
});
