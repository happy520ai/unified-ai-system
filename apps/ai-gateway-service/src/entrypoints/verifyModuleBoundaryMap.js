import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

const docsPath = resolve(repoRoot, "docs/MODULE_BOUNDARY_MAP_AND_DEPENDENCY_DIRECTION_REVIEW.md");
const evidenceJsonPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-293a-module-boundary-map.json");
const evidenceMdPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-293a-module-boundary-map.md");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(repoRoot, "apps/ai-gateway-service/package.json");

const requiredMarkers = [
  "## A. Current Module Boundary Overview",
  "## B. apps/ai-gateway-service Internal Module Map",
  "## C. packages/* Shared Package Responsibilities",
  "## D. agent-console and ai-gateway-service Dependency Relation",
  "## E. Current Allowed Dependency Directions",
  "## F. Current Dangerous / Not Recommended Dependency Directions",
  "## G. High-Risk Coupling Points Found",
  "## H. Phase294A Safe Refactor Harness Suggestion",
  "## I. Phase295A First Low-Risk Module Extraction Candidate",
  "## J. Non-Claimable Capabilities and Boundary Notes",
];

function fail(message) {
  console.error("[Phase293A verifier] FAIL: " + message);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function scriptExists(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName]);
}

for (const requiredPath of [docsPath, evidenceJsonPath, evidenceMdPath]) {
  if (!existsSync(requiredPath)) {
    fail("Missing required file: " + requiredPath);
  }
}

const docsText = readFileSync(docsPath, "utf8");
for (const marker of requiredMarkers) {
  if (!docsText.includes(marker)) {
    fail("Document missing marker: " + marker);
  }
}

const evidence = readJson(evidenceJsonPath);
const rootPackageJson = readJson(rootPackagePath);
const servicePackageJson = readJson(servicePackagePath);
const expectedFalseKeys = [
  "paidApiCallCount",
  "externalApiCalled",
  "mimoApiCalled",
  "embeddingCalled",
  "realRefactorPerformed",
  "filesMoved",
  "providerPathChanged",
  "defaultNvidiaChatChanged",
  "legacyModified",
  "projectContextCreated",
  "releaseOrDeployCalled",
  "workspaceCleanClaimed",
];

if (evidence.phase !== "293A") {
  fail("phase must be 293A.");
}

if (evidence.status !== "pass") {
  fail("status must be pass.");
}

for (const key of expectedFalseKeys) {
  if (evidence[key] !== false && key !== "paidApiCallCount") {
    fail("Evidence flag must be false: " + key);
  }
}

if (evidence.paidApiCallCount !== 0) {
  fail("paidApiCallCount must be 0.");
}

if (!scriptExists(rootPackageJson, "verify:phase293a-module-boundary-map")) {
  fail("Root package.json missing script: verify:phase293a-module-boundary-map");
}

if (!scriptExists(servicePackageJson, "verify:phase293a-module-boundary-map")) {
  fail("Service package.json missing script: verify:phase293a-module-boundary-map");
}

if (existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md"))) {
  fail("PROJECT_CONTEXT.md must not exist for Phase293A.");
}

console.log("[Phase293A verifier] PASS");
console.log(JSON.stringify({
  phase: "293A",
  status: "pass",
  checkedFiles: [
    "docs/MODULE_BOUNDARY_MAP_AND_DEPENDENCY_DIRECTION_REVIEW.md",
    "apps/ai-gateway-service/evidence/phase-293a-module-boundary-map.json",
    "apps/ai-gateway-service/evidence/phase-293a-module-boundary-map.md",
  ],
  scriptName: "verify:phase293a-module-boundary-map",
  paidApiCallCount: evidence.paidApiCallCount,
  externalApiCalled: evidence.externalApiCalled,
  mimoApiCalled: evidence.mimoApiCalled,
  embeddingCalled: evidence.embeddingCalled,
  providerPathChanged: evidence.providerPathChanged,
  defaultNvidiaChatChanged: evidence.defaultNvidiaChatChanged,
}, null, 2));
