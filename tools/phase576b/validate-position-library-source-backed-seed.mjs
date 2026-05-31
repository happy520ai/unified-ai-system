import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validatePositionShape } from "../../packages/workforce-contracts/src/index.js";
import {
  allWorldJobsClaimed,
  buildPositionLibraryPreview,
  escoSeedManifest,
  occupationSources,
  onetSeedManifest,
  searchPositions,
  socMajorGroupsSeed,
  sourceBackedPositionLibrary,
  iscoMajorGroupsSeed,
} from "../../packages/position-library/src/index.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase576b");
const resultPath = resolve(evidenceDir, "position-library-source-backed-seed-result.json");

const files = {
  packageJson: "packages/position-library/package.json",
  sources: "packages/position-library/src/occupationSources.js",
  soc: "packages/position-library/src/socMajorGroupsSeed.js",
  isco: "packages/position-library/src/iscoMajorGroupsSeed.js",
  onet: "packages/position-library/src/onetSeedManifest.js",
  esco: "packages/position-library/src/escoSeedManifest.js",
  normalizer: "packages/position-library/src/positionNormalizer.js",
  search: "packages/position-library/src/positionSearchIndex.js",
  preview: "packages/position-library/src/positionLibraryPreview.js",
  doc: "docs/phase576b-position-library-source-backed-seed.md",
  report: "docs/phase576b-execution-report.md",
};

const preview = buildPositionLibraryPreview();
const sampleValidation = preview.samplePositions.map(validatePositionShape);
const docsText = await readDocs([files.doc, files.report]);
const result = {
  phase: "Phase576B",
  name: "Position Library Source-Backed Seed Expansion",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  positionLibraryPackageExists: exists(files.packageJson),
  occupationSourcesDefined: Array.isArray(occupationSources) && occupationSources.length >= 4,
  socSeedExists: exists(files.soc) && socMajorGroupsSeed.length >= 10,
  iscoSeedExists: exists(files.isco) && iscoMajorGroupsSeed.length >= 10,
  onetManifestExists: exists(files.onet) && onetSeedManifest.importStatus === "manifest_only",
  escoManifestExists: exists(files.esco) && escoSeedManifest.importStatus === "manifest_only",
  positionNormalizerExists: exists(files.normalizer),
  positionPreviewWorks: preview.samplePositionsCount >= 20 && searchPositions("AI Gateway").length >= 1,
  samplePositionsCount: preview.samplePositionsCount,
  samplePositionsSchemaValid: sampleValidation.every((item) => item.valid),
  allWorldJobsClaimed: allWorldJobsClaimed || /all world jobs complete|世界所有职位已完整|全球完整覆盖/i.test(docsText),
  sourceBackedPositionLibrary,
  providerCallsMade: false,
  secretValueExposed: false,
  safetyBoundary: {
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    deployExecuted: false,
    billingExecuted: false,
    invoiceGenerated: false,
    workspaceCleanClaimed: false,
  },
};

const checksPassed =
  result.positionLibraryPackageExists &&
  result.occupationSourcesDefined &&
  result.socSeedExists &&
  result.iscoSeedExists &&
  result.onetManifestExists &&
  result.escoManifestExists &&
  result.positionNormalizerExists &&
  result.positionPreviewWorks &&
  result.samplePositionsCount >= 20 &&
  result.samplePositionsSchemaValid &&
  result.allWorldJobsClaimed === false &&
  result.sourceBackedPositionLibrary === true &&
  result.providerCallsMade === false &&
  result.secretValueExposed === false;

result.completed = checksPassed;
result.recommended_sealed = checksPassed;
result.blocker = checksPassed ? null : "phase576b_position_library_seed_incomplete";

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!result.completed) process.exitCode = 1;

function exists(path) {
  return existsSync(resolve(repoRoot, path));
}

async function readDocs(paths) {
  const chunks = [];
  for (const path of paths) {
    if (exists(path)) chunks.push(await readFile(resolve(repoRoot, path), "utf8"));
  }
  return chunks.join("\n");
}
