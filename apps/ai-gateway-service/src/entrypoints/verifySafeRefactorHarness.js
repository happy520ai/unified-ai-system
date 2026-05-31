import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const serviceRoot = resolve(repoRoot, "apps/ai-gateway-service");

const scriptName = "verify:phase294a-safe-refactor-harness";
const docsPath = resolve(repoRoot, "docs/SAFE_REFACTOR_HARNESS.md");
const evidenceJsonPath = resolve(serviceRoot, "evidence/phase-294a-safe-refactor-harness.json");
const evidenceMdPath = resolve(serviceRoot, "evidence/phase-294a-safe-refactor-harness.md");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(serviceRoot, "package.json");
const phase292VerifierPath = resolve(serviceRoot, "src/entrypoints/verifyArchitectureRefactorReadinessPlan.js");
const phase293VerifierPath = resolve(serviceRoot, "src/entrypoints/verifyModuleBoundaryMap.js");
const projectContextPath = resolve(repoRoot, "PROJECT_CONTEXT.md");

const requiredMarkers = [
  "## A. Phase294A 目标和边界",
  "## B. 上游 Phase285A-293A 依赖",
  "## C. 当前允许的依赖方向规则",
  "## D. 当前禁止的依赖方向规则",
  "## E. Provider 边界保护规则",
  "## F. legacy/ 与 PROJECT_CONTEXT.md 边界规则",
  "## G. 外部调用禁止规则",
  "## H. 文件移动 / 真实重构禁止规则",
  "## I. Harness 检查项清单",
  "## J. 失败等级定义：fatal / warning / informational",
  "## K. Phase295A 启动前必须满足的条件",
  "## L. 不可声称能力说明",
];

const requiredZeroFalseContract = {
  paidApiCallCount: 0,
  externalApiCalled: false,
  mimoApiCalled: false,
  embeddingCalled: false,
  realRefactorPerformed: false,
  filesMoved: false,
  providerPathChanged: false,
  defaultNvidiaChatChanged: false,
  legacyModified: false,
  projectContextCreated: false,
  releaseOrDeployCalled: false,
  workflowRunnerCalled: false,
  worktreeCreated: false,
  workspaceCleanClaimed: false,
};

function fail(message) {
  console.error("[Phase294A verifier] FAIL: " + message);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function scriptExists(packageJson, name) {
  return Boolean(packageJson?.scripts?.[name]);
}

for (const requiredPath of [
  docsPath,
  evidenceJsonPath,
  evidenceMdPath,
  rootPackagePath,
  servicePackagePath,
  phase292VerifierPath,
  phase293VerifierPath,
]) {
  if (!existsSync(requiredPath)) {
    fail("Missing required file: " + requiredPath);
  }
}

if (existsSync(projectContextPath)) {
  fail("PROJECT_CONTEXT.md must not exist for Phase294A.");
}

const docsText = readFileSync(docsPath, "utf8");
for (const marker of requiredMarkers) {
  if (!docsText.includes(marker)) {
    fail("Document missing marker: " + marker);
  }
}

const rootPackageJson = readJson(rootPackagePath);
const servicePackageJson = readJson(servicePackagePath);
const evidence = readJson(evidenceJsonPath);

if (!scriptExists(rootPackageJson, scriptName)) {
  fail("Root package.json missing script: " + scriptName);
}

if (!scriptExists(servicePackageJson, scriptName)) {
  fail("Service package.json missing script: " + scriptName);
}

if (!scriptExists(rootPackageJson, "verify:phase292a-architecture-refactor-readiness-plan")) {
  fail("Root package.json missing Phase292A script.");
}

if (!scriptExists(servicePackageJson, "verify:phase292a-architecture-refactor-readiness-plan")) {
  fail("Service package.json missing Phase292A script.");
}

if (!scriptExists(rootPackageJson, "verify:phase293a-module-boundary-map")) {
  fail("Root package.json missing Phase293A script.");
}

if (!scriptExists(servicePackageJson, "verify:phase293a-module-boundary-map")) {
  fail("Service package.json missing Phase293A script.");
}

if (evidence.phase !== "294A") {
  fail("Evidence phase must be 294A.");
}

if (evidence.name !== "Safe Refactor Harness") {
  fail("Evidence name must be Safe Refactor Harness.");
}

if (evidence.status !== "pass") {
  fail("Evidence status must be pass.");
}

if (evidence.mode !== "local-static-guardrail-only") {
  fail("Evidence mode must be local-static-guardrail-only.");
}

for (const [key, value] of Object.entries(requiredZeroFalseContract)) {
  if (evidence[key] !== value) {
    fail("Evidence field must match contract: " + key);
  }
}

const fatalFindings = Array.isArray(evidence.fatalFindings) ? evidence.fatalFindings : [];
const warningFindings = Array.isArray(evidence.warningFindings) ? evidence.warningFindings : [];
const informationalFindings = Array.isArray(evidence.informationalFindings) ? evidence.informationalFindings : [];

console.log("[Phase294A verifier] PASS");
console.log(JSON.stringify({
  phase: "294A",
  status: "pass",
  checkedFiles: [
    "docs/SAFE_REFACTOR_HARNESS.md",
    "apps/ai-gateway-service/src/entrypoints/verifySafeRefactorHarness.js",
    "apps/ai-gateway-service/evidence/phase-294a-safe-refactor-harness.json",
    "apps/ai-gateway-service/evidence/phase-294a-safe-refactor-harness.md",
  ],
  scriptName,
  phase292VerifierExists: true,
  phase293VerifierExists: true,
  projectContextExists: false,
  paidApiCallCount: evidence.paidApiCallCount,
  warningCount: warningFindings.length,
  informationalCount: informationalFindings.length,
  fatalCount: fatalFindings.length,
}, null, 2));
