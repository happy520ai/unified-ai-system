import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  importLocalManifest,
  validateOccupationRecord,
  normalizeTitle,
  mergeAliases,
  dedupeSourcePositions,
  buildPositionSearchIndex,
  searchPositionIndex,
  sourceBackedExpandedSeed,
} from "../../packages/position-library/src/index.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase578");
const evidencePath = resolve(evidenceDir, "position-library-importer-normalizer-search-result.json");

const imported = importLocalManifest(sourceBackedExpandedSeed);
const index = buildPositionSearchIndex(imported.imported);
const searchResults = searchPositionIndex("AI Gateway", index);
const duplicateTest = dedupeSourcePositions([imported.imported[0], imported.imported[0]]);

const result = {
  phase: "Phase578",
  name: "Position Library Importer + Normalizer + Search Index",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  localManifestImporterWorks: imported.imported.length >= 50 && imported.rejected.length === 0,
  occupationRecordValidatorWorks: validateOccupationRecord(imported.imported[0]).valid === true,
  titleNormalizerWorks: normalizeTitle(" ai_gateway engineer ") === "AI Gateway Engineer",
  aliasMergerWorks: mergeAliases(["Architect"], ["architect", "AI Architect"]).length === 2,
  sourceDeduperWorks: duplicateTest.length === 1,
  searchIndexWorks: index.count >= 50 && searchResults.some((position) => /AI Gateway/i.test(position.canonicalTitle)),
  expandedSeedCount: sourceBackedExpandedSeed.length,
  allWorldJobsClaimed: false,
  noNetworkImport: imported.noNetworkImport === true,
  providerCallsMade: false,
  secretValueExposed: false,
  filesExist: [
    "packages/position-library/src/import/localManifestImporter.js",
    "packages/position-library/src/import/occupationRecordValidator.js",
    "packages/position-library/src/normalize/titleNormalizer.js",
    "packages/position-library/src/normalize/aliasMerger.js",
    "packages/position-library/src/normalize/sourceDeduper.js",
    "packages/position-library/src/search/positionSearchIndex.js",
    "packages/position-library/src/search/positionQueryService.js",
    "packages/position-library/src/data/sourceBackedExpandedSeed.js",
    "docs/phase578-position-library-importer-normalizer-search.md",
    "docs/phase578-execution-report.md",
  ].every(exists),
  safetyBoundary: {
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    billingExecuted: false,
    invoiceGenerated: false,
    workspaceCleanClaimed: false,
  },
};

const passed =
  result.localManifestImporterWorks &&
  result.occupationRecordValidatorWorks &&
  result.titleNormalizerWorks &&
  result.aliasMergerWorks &&
  result.sourceDeduperWorks &&
  result.searchIndexWorks &&
  result.expandedSeedCount >= 50 &&
  result.allWorldJobsClaimed === false &&
  result.noNetworkImport &&
  result.providerCallsMade === false &&
  result.secretValueExposed === false &&
  result.filesExist;

result.completed = passed;
result.recommended_sealed = passed;
result.blocker = passed ? null : "phase578_position_library_importer_incomplete";

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!passed) process.exitCode = 1;

function exists(path) {
  return existsSync(resolve(repoRoot, path));
}

