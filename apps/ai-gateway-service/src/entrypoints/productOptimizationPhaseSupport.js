import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(__dirname, "../../../..");
export const serviceRoot = resolve(repoRoot, "apps/ai-gateway-service");
export const evidenceDir = resolve(serviceRoot, "evidence");
export const rootPackagePath = resolve(repoRoot, "package.json");
export const servicePackagePath = resolve(serviceRoot, "package.json");
export const consolePagePath = resolve(serviceRoot, "src/ui/consolePage.js");
export const projectContextPath = resolve(repoRoot, "PROJECT_CONTEXT.md");

export function phasePaths({ docName, evidenceName, runnerName, verifierName }) {
  return {
    docsPath: resolve(repoRoot, "docs", docName),
    evidenceJsonPath: resolve(evidenceDir, `${evidenceName}.json`),
    evidenceMdPath: resolve(evidenceDir, `${evidenceName}.md`),
    runnerPath: resolve(serviceRoot, "src/entrypoints", runnerName),
    verifierPath: resolve(serviceRoot, "src/entrypoints", verifierName),
  };
}

export function readText(filePath) {
  return readFileSync(filePath, "utf8");
}

export function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

export function packageScriptExists(filePath, scriptName) {
  return existsSync(filePath) && Boolean(readJson(filePath).scripts?.[scriptName]);
}

export function baseSafetyEvidence() {
  return {
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
    embeddingCalled: false,
    legacyModified: false,
    projectContextCreated: existsSync(projectContextPath),
    commitPerformed: false,
    pushPerformed: false,
    realReleasePerformed: false,
    remoteDeployPerformed: false,
    workspaceCleanClaimed: false,
    productionReadyClaimed: false,
  };
}

export function writeEvidencePair({ evidence, evidenceJsonPath, evidenceMdPath, title }) {
  mkdirSync(dirname(evidenceJsonPath), { recursive: true });
  writeFileSync(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  writeFileSync(evidenceMdPath, renderEvidenceMarkdown({ title, evidence }), "utf8");
}

export function renderEvidenceMarkdown({ title, evidence }) {
  const lines = [
    `# ${title}`,
    "",
    `Status: ${evidence.status}`,
    "",
    "## Boundary",
    "",
    `- Paid API called: ${evidence.paidApiCallCount}`,
    `- External provider called: ${evidence.externalApiCalled}`,
    `- MiMo called: ${evidence.mimoApiCalled}`,
    `- Embedding called: ${evidence.embeddingCalled}`,
    `- legacy/ modified: ${evidence.legacyModified}`,
    `- PROJECT_CONTEXT.md created: ${evidence.projectContextCreated}`,
    `- Commit performed: ${evidence.commitPerformed}`,
    `- Push performed: ${evidence.pushPerformed}`,
    `- Real release performed: ${evidence.realReleasePerformed}`,
    `- Remote deploy performed: ${evidence.remoteDeployPerformed}`,
    `- Workspace clean claimed: ${evidence.workspaceCleanClaimed}`,
    `- Production ready claimed: ${evidence.productionReadyClaimed}`,
    "",
    "## Evidence",
    "",
  ];

  for (const [key, value] of Object.entries(evidence)) {
    const rendered = typeof value === "object" ? JSON.stringify(value) : String(value);
    lines.push(`- ${key}: ${rendered}`);
  }

  lines.push("", "## Final Conclusion", "", evidence.finalConclusion || "Completed as local static evidence.");
  return `${lines.join("\n")}\n`;
}

export function assertCheck(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

export function requireFiles(paths, failures) {
  for (const filePath of paths) {
    assertCheck(existsSync(filePath), `missing required file: ${filePath}`, failures);
  }
}

export function requireMarkers(text, markers, failures, label = "text") {
  for (const marker of markers) {
    assertCheck(text.includes(marker), `${label} missing marker: ${marker}`, failures);
  }
}

export function verifySafetyEvidence(evidence, failures) {
  assertCheck(evidence.paidApiCallCount === 0, "paidApiCallCount must be 0", failures);
  assertCheck(evidence.externalApiCalled === false, "externalApiCalled must be false", failures);
  assertCheck(evidence.mimoApiCalled === false, "mimoApiCalled must be false", failures);
  assertCheck(evidence.embeddingCalled === false, "embeddingCalled must be false", failures);
  assertCheck(evidence.legacyModified === false, "legacyModified must be false", failures);
  assertCheck(evidence.projectContextCreated === false, "projectContextCreated must be false", failures);
  assertCheck(evidence.commitPerformed === false, "commitPerformed must be false", failures);
  assertCheck(evidence.pushPerformed === false, "pushPerformed must be false", failures);
  assertCheck(evidence.productionReadyClaimed === false, "productionReadyClaimed must be false", failures);
}

export function verifyCommonPhase({
  evidence,
  phase,
  rootRunScript,
  rootVerifyScript,
  serviceRunScript,
  serviceVerifyScript,
  failures,
}) {
  assertCheck(evidence.phase === phase, `phase must be ${phase}`, failures);
  assertCheck(evidence.status === "pass", "status must be pass", failures);
  verifySafetyEvidence(evidence, failures);
  assertCheck(packageScriptExists(rootPackagePath, rootRunScript), `root run script missing: ${rootRunScript}`, failures);
  assertCheck(packageScriptExists(rootPackagePath, rootVerifyScript), `root verify script missing: ${rootVerifyScript}`, failures);
  assertCheck(packageScriptExists(servicePackagePath, serviceRunScript), `service run script missing: ${serviceRunScript}`, failures);
  assertCheck(packageScriptExists(servicePackagePath, serviceVerifyScript), `service verify script missing: ${serviceVerifyScript}`, failures);
}

export function printVerifierResult({ ok, failures, phase, verifier }) {
  if (!ok) {
    console.error(JSON.stringify({ ok, failures, phase, verifier }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ status: "passed", phase, verifier }, null, 2));
}
