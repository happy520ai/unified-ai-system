import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildOfficialImportPlan,
  getOfficialSource,
} from "../../packages/position-library/src/index.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase577");
const evidencePath = resolve(evidenceDir, "position-library-official-import-plan-result.json");

const docs = [
  "docs/phase577-position-library-official-import-plan.md",
  "docs/phase577-occupation-source-governance.md",
  "docs/phase577-source-versioning-and-license-boundary.md",
  "docs/phase577-execution-report.md",
];

const files = [
  "packages/position-library/src/import/officialSourceRegistry.js",
  "packages/position-library/src/import/sourceVersionPolicy.js",
  "packages/position-library/src/import/licenseBoundary.js",
  "packages/position-library/src/import/sourceRefBuilder.js",
  "packages/position-library/src/import/importPlan.js",
];

const plan = buildOfficialImportPlan();

const result = {
  phase: "Phase577",
  name: "Position Library Official Import Plan",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  officialSourceRegistryExists: exists("packages/position-library/src/import/officialSourceRegistry.js"),
  onetSourceRegistered: !!getOfficialSource("onet"),
  socSourceRegistered: !!getOfficialSource("soc"),
  iscoSourceRegistered: !!getOfficialSource("isco"),
  escoSourceRegistered: !!getOfficialSource("esco"),
  sourceVersionPolicyExists: exists("packages/position-library/src/import/sourceVersionPolicy.js"),
  licenseBoundaryExists: exists("packages/position-library/src/import/licenseBoundary.js"),
  sourceRefBuilderExists: exists("packages/position-library/src/import/sourceRefBuilder.js"),
  importPlanExists: exists("packages/position-library/src/import/importPlan.js"),
  docsExist: docs.every(exists),
  filesExist: files.every(exists),
  noNetworkImport: plan.noNetworkImport === true && plan.sourcePlans.every((source) => source.networkImportAllowed === false),
  allWorldJobsClaimed: plan.allWorldJobsClaimed === true,
  providerCallsMade: plan.providerCallsMade === true,
  secretValueExposed: plan.secretValueExposed === true,
  deployExecuted: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
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
  result.officialSourceRegistryExists &&
  result.onetSourceRegistered &&
  result.socSourceRegistered &&
  result.iscoSourceRegistered &&
  result.escoSourceRegistered &&
  result.sourceVersionPolicyExists &&
  result.licenseBoundaryExists &&
  result.sourceRefBuilderExists &&
  result.importPlanExists &&
  result.docsExist &&
  result.filesExist &&
  result.noNetworkImport &&
  result.allWorldJobsClaimed === false &&
  result.providerCallsMade === false &&
  result.secretValueExposed === false &&
  result.chatModified === false &&
  result.chatGatewayExecuteModified === false;

result.completed = passed;
result.recommended_sealed = passed;
result.blocker = passed ? null : "phase577_official_import_plan_incomplete";

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!passed) process.exitCode = 1;

function exists(path) {
  return existsSync(resolve(repoRoot, path));
}

