import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceRoot = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(serviceRoot, "../..");

const scriptName = "verify:phase292a-architecture-refactor-readiness-plan";

const requiredFiles = [
  path.join(repoRoot, "docs", "ARCHITECTURE_REFACTOR_READINESS_PLAN.md"),
  path.join(serviceRoot, "evidence", "phase-292a-architecture-refactor-readiness-plan.json"),
  path.join(serviceRoot, "evidence", "phase-292a-architecture-refactor-readiness-plan.md")
];

const requiredMarkers = [
  "# Architecture Refactor Readiness Plan",
  "## A. Current Architecture Layer Map",
  "## B. Safe Refactor Zones",
  "## C. Forbidden Refactor Zones",
  "## D. Module Boundary Risk Register",
  "## E. Follow-Up Small-Step Refactor Route",
  "## F. Required Verification Commands",
  "## G. Non-Claimable Capabilities",
  "## H. Rollback Strategy",
  "## I. Performance and Maintainability Improvement Directions"
];

function fail(message) {
  console.error("[Phase292A verifier] FAIL: " + message);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    fail("Missing required file: " + path.relative(repoRoot, file));
  }
}

const projectContextPath = path.join(repoRoot, "PROJECT_CONTEXT.md");
if (fs.existsSync(projectContextPath)) {
  fail("PROJECT_CONTEXT.md must not be created for Phase292A.");
}

const docPath = path.join(repoRoot, "docs", "ARCHITECTURE_REFACTOR_READINESS_PLAN.md");
const doc = fs.readFileSync(docPath, "utf8");

for (const marker of requiredMarkers) {
  if (!doc.includes(marker)) {
    fail("Document missing marker: " + marker);
  }
}

const rootPkg = readJson(path.join(repoRoot, "package.json"));
const servicePkg = readJson(path.join(serviceRoot, "package.json"));

if (!rootPkg.scripts || !rootPkg.scripts[scriptName]) {
  fail("Root package.json missing script: " + scriptName);
}

if (!servicePkg.scripts || !servicePkg.scripts[scriptName]) {
  fail("Service package.json missing script: " + scriptName);
}

const evidence = readJson(
  path.join(serviceRoot, "evidence", "phase-292a-architecture-refactor-readiness-plan.json")
);

if (evidence.paidApiCallCount !== 0) {
  fail("paidApiCallCount must be 0.");
}

const expectedFalse = [
  "externalApiCalled",
  "mimoApiCalled",
  "embeddingCalled",
  "realCodexExecCalled",
  "workflowRunnerCalled",
  "worktreeCreated",
  "releaseOrDeployCalled",
  "legacyModified",
  "projectContextCreated",
  "defaultNvidiaChatChanged",
  "productionReadyClaimed",
  "workspaceCleanClaimed"
];

for (const key of expectedFalse) {
  if (evidence[key] !== false) {
    fail("Evidence flag must be false: " + key);
  }
}

console.log("[Phase292A verifier] PASS");
console.log(JSON.stringify({
  phase: "292A",
  status: "pass",
  checkedFiles: requiredFiles.map((file) => path.relative(repoRoot, file)),
  scriptName,
  externalApiCalled: evidence.externalApiCalled,
  paidApiCallCount: evidence.paidApiCallCount,
  mimoApiCalled: evidence.mimoApiCalled,
  embeddingCalled: evidence.embeddingCalled
}, null, 2));
