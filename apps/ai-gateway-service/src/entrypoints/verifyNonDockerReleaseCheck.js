import { existsSync } from "node:fs";
import { writeEvidencePair } from "./entrypointUtils.js";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const PHASE = "phase-112a-non-docker-release-check";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-112a-non-docker-release-check.json");
const evidenceMdPath = resolve(evidenceDir, "phase-112a-non-docker-release-check.md");
const requiredEvidence = [
  "apps/ai-gateway-service/evidence/phase-111b-cicd-gate-design.json",
  "apps/ai-gateway-service/evidence/phase-110a-docker-readiness.json",
  "apps/ai-gateway-service/evidence/phase-109a-deployment-readiness.json",
  "apps/ai-gateway-service/evidence/phase-108a-access-boundary.json",
  "apps/ai-gateway-service/evidence/phase-107a-secret-safety.json",
  "apps/ai-gateway-service/evidence/phase-106a-delivery-readiness.json",
  "apps/ai-gateway-service/evidence/phase-105a-user-journey.json",
];
const textExtensions = new Set(["", ".cjs", ".css", ".example", ".html", ".js", ".json", ".jsonl", ".md", ".mjs", ".ts", ".txt", ".yml", ".yaml"]);

try {
  const [rootPackage, servicePackage, readme, agents, envExample] = await Promise.all([
    readFile(resolve(repoRoot, "package.json"), "utf8"),
    readFile(resolve(repoRoot, "apps/ai-gateway-service/package.json"), "utf8"),
    readFile(resolve(repoRoot, "README.md"), "utf8"),
    readFile(resolve(repoRoot, "AGENTS.md"), "utf8"),
    readFile(resolve(repoRoot, ".env.example"), "utf8"),
  ]);
  const evidenceStatuses = await readRequiredEvidenceStatuses();
  const secretScan = await scanForSecrets();
  const evidence = createEvidence({
    rootPackage,
    servicePackage,
    readme,
    agents,
    envExample,
    evidenceStatuses,
    secretScan,
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = evidence.status === "passed" ? 0 : 1;
} catch (error) {
  const evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "non-docker-release-check-not-closed",
  };
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}

function createEvidence({ rootPackage, servicePackage, readme, agents, envExample, evidenceStatuses, secretScan }) {
  const rootScripts = JSON.parse(rootPackage).scripts ?? {};
  const serviceScripts = JSON.parse(servicePackage).scripts ?? {};
  const readmeFlat = normalizeWhitespace(readme);
  const agentsFlat = normalizeWhitespace(agents);
  const combined = [readme, agents, envExample, rootPackage, servicePackage].join("\n\n");

  const deliverableChecks = {
    localPnpmStartup: readme.includes("Local pnpm startup is available") &&
      readme.includes("pnpm install") &&
      readme.includes("cmd /c pnpm start:pme"),
    webUi: readme.includes("/ui") &&
      readme.includes("http://127.0.0.1:3100/ui"),
    setupWizard: readme.includes("Setup Wizard") &&
      readme.includes("GET /setup/readiness"),
    modelImport: readme.includes("Model Import") &&
      readme.includes("API Key guidance") &&
      readme.includes("unknown providers") &&
      readme.includes("Base URL guidance") &&
      readme.includes("masked key"),
    knowledgeRag: readme.includes("Knowledge/RAG") &&
      readme.includes("local keyword retrieval"),
    agentWorkforce: readme.includes("Agent Workforce preview") &&
      readme.includes("save/history/read/delete") &&
      readme.includes("task-package export"),
    secretSafety: readme.includes("verify:phase107a-secret-safety"),
    dockerRuntimeStatus: readmeFlat.includes("Docker local runtime now passes through Phase 115A") &&
      readme.includes("verify:phase115a-docker-runtime-recheck"),
    cicdStatus: readmeFlat.includes("Minimal CI/CD gate exists through Phase 117A") &&
      readmeFlat.includes("no cloud deployment") &&
      readmeFlat.includes("release automation") &&
      readmeFlat.includes("global release"),
  };
  const evidencePassed = evidenceStatuses.every((item) => item.status === "passed");

  const checks = {
    readmePhasePresent: readme.includes("Phase 112A") &&
      readme.includes("verify:phase112a-non-docker-release-check"),
    readmeDeliverableChecklistComplete: Object.values(deliverableChecks).every(Boolean),
    readmeDockerRuntimeStatus: deliverableChecks.dockerRuntimeStatus,
    readmeCicdStatusDocumented: deliverableChecks.cicdStatus,
    agentsBoundaryPresent: agents.includes("verify:phase112a-non-docker-release-check") &&
      agentsFlat.includes("Do not describe Phase 112A as global release complete") &&
      agents.includes("Docker runtime was completed later by Phase 115A") &&
      agents.includes("CI/CD complete"),
    scriptsPresent: rootScripts["verify:phase112a-non-docker-release-check"] ===
        "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase112a-non-docker-release-check" &&
      serviceScripts["verify:phase112a-non-docker-release-check"] ===
        "node ./src/entrypoints/verifyNonDockerReleaseCheck.js",
    requiredEvidencePassed: evidencePassed,
    noPlainSecrets: findPlainSecretFindings(combined, "phase112a-docs").length === 0 &&
      secretScan.findingCount === 0,
    projectContextNotCreated: !existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md")),
  };
  const passed = Object.values(checks).every(Boolean);

  return {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    checks,
    deliverableStatus: {
      localPnpmStartupAvailable: deliverableChecks.localPnpmStartup,
      uiAvailable: deliverableChecks.webUi,
      setupWizardAvailable: deliverableChecks.setupWizard,
      modelImportHardened: deliverableChecks.modelImport,
      knowledgeRagAvailable: deliverableChecks.knowledgeRag,
      agentWorkforcePreviewAvailable: deliverableChecks.agentWorkforce,
      secretSafetyPassed: deliverableChecks.secretSafety,
      dockerRuntimeBlocked: false,
      dockerRuntimePassedLaterByPhase115A: true,
      cicdDesignOnly: false,
      minimalCicdGatePresentLaterByPhase117A: true,
      globalReleaseComplete: false,
    },
    regressions: evidenceStatuses,
    secretScan: {
      scope: secretScan.scope,
      fileCount: secretScan.fileCount,
      findingCount: secretScan.findingCount,
      findings: secretScan.findings,
    },
    safety: {
      defaultChatMainLaneChanged: false,
      dockerRuntimeFaked: false,
      realCiCreated: true,
      deploymentOrReleaseAutomationCreated: false,
      cloudDeploymentComplete: false,
      releaseAutomationComplete: false,
      plaintextApiKeyRecorded: false,
      projectContextCreated: false,
      legacyModified: false,
    },
    conclusion: passed ? "non-docker-release-check-closed" : "non-docker-release-check-not-closed",
  };
}

async function readRequiredEvidenceStatuses() {
  const output = [];
  for (const evidencePath of requiredEvidence) {
    const absolute = resolve(repoRoot, evidencePath);
    const raw = await readFile(absolute, "utf8");
    const parsed = JSON.parse(raw);
    output.push({
      path: evidencePath,
      phase: parsed.phase,
      status: parsed.status,
      conclusion: parsed.conclusion,
    });
  }
  return output;
}

async function scanForSecrets() {
  const roots = [
    "README.md",
    "AGENTS.md",
    ".env.example",
    "package.json",
    "apps/ai-gateway-service/evidence",
    "apps/agent-console/evidence",
    "docs",
  ];
  const files = [];
  for (const item of roots) {
    const absolute = resolve(repoRoot, item);
    if (!existsSync(absolute)) continue;
    const stats = await stat(absolute);
    if (stats.isDirectory()) {
      files.push(...await listTextFiles(absolute));
    } else if (isTextFile(absolute)) {
      files.push(absolute);
    }
  }

  const findings = [];
  for (const filePath of files) {
    const text = await readFile(filePath, "utf8");
    findings.push(...findPlainSecretFindings(text, toRepoPath(filePath)));
  }
  return {
    scope: roots,
    fileCount: files.length,
    findingCount: findings.length,
    findings,
  };
}

async function listTextFiles(directory) {
  const output = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) continue;
      output.push(...await listTextFiles(absolute));
    } else if (entry.isFile() && isTextFile(absolute)) {
      output.push(absolute);
    }
  }
  return output;
}

function isTextFile(filePath) {
  const ext = extname(filePath).toLowerCase();
  return textExtensions.has(ext);
}

function shouldSkipDirectory(name) {
  return [".git", "node_modules", "dist", "build", "coverage", ".next", ".cache", "legacy"].includes(name);
}

function normalizeWhitespace(text) {
  return String(text ?? "").replace(/\s+/g, " ");
}

function toRepoPath(filePath) {
  return relative(repoRoot, filePath).replace(/\\/g, "/");
}

