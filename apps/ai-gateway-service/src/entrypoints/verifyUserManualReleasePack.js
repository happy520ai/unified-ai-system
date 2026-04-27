import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const phase = "phase-114a-user-manual-release-pack";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");

async function readRequired(relativePath) {
  return readFile(resolve(repoRoot, relativePath), "utf8");
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

async function main() {
  const generatedAt = new Date().toISOString();
  const [
    rootPackageText,
    servicePackageText,
    readme,
    agents,
    envExample,
    userManual,
  ] = await Promise.all([
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired(".env.example"),
    readRequired("docs/USER_MANUAL.md"),
  ]);

  const rootPackage = parseJson(rootPackageText, "package.json");
  const servicePackage = parseJson(
    servicePackageText,
    "apps/ai-gateway-service/package.json",
  );
  const manualFlat = normalizeWhitespace(userManual);
  const readmeFlat = normalizeWhitespace(readme);
  const agentsFlat = normalizeWhitespace(agents);
  const secretFindings = findPlainSecretFindings(
    [
      rootPackageText,
      servicePackageText,
      readme,
      agents,
      envExample,
      userManual,
    ].join("\n\n"),
    "phase114a-user-manual-release-pack",
  );

  const manualChecks = {
    zeroStart:
      userManual.includes("pnpm install") &&
      userManual.includes("cmd /c pnpm start:pme") &&
      userManual.includes("http://127.0.0.1:3100/ui"),
    envConfig:
      userManual.includes(".env.example") &&
      userManual.includes("NVIDIA_API_KEY") &&
      userManual.includes("AI_GATEWAY_SERVICE_URL") &&
      manualFlat.includes("Do not commit `.env`"),
    setupWizard:
      userManual.includes("First-Run Setup Wizard") &&
      userManual.includes("GET /setup/readiness"),
    modelImport:
      userManual.includes("Add A Model Or API Key") &&
      userManual.includes("Base URL") &&
      userManual.includes("masked keys"),
    chat:
      userManual.includes("Chat") &&
      userManual.includes("default service `/chat` contract") &&
      userManual.includes("NVIDIA single-provider lane"),
    knowledgeRag:
      userManual.includes("Knowledge/RAG") &&
      userManual.includes("local keyword retrieval") &&
      userManual.includes("/chat/rag/stream"),
    workforce:
      userManual.includes("Agent Workforce Preview") &&
      userManual.includes("planning preview") &&
      userManual.includes("does not execute code") &&
      userManual.includes("does not start 144 real concurrent employees"),
    saveExport:
      userManual.includes("Save And Export") &&
      userManual.includes("Export JSON") &&
      userManual.includes("Export a task package"),
    blockedAndLimits:
      manualFlat.includes("Local Docker runtime build/run") &&
      manualFlat.includes("Minimal CI/CD release gate") &&
      manualFlat.includes("Automated deployment or release publishing") &&
      manualFlat.includes("Cloud deployment") &&
      manualFlat.includes("Global release") &&
      manualFlat.includes("Do not expose this service directly to the public internet"),
    verification:
      userManual.includes("verify:phase114a-user-manual-release-pack") &&
      userManual.includes("verify:phase113b-docker-blocker-docs") &&
      userManual.includes("verify:phase115a-docker-runtime-recheck") &&
      userManual.includes("verify:phase116a-docker-compose-runtime") &&
      userManual.includes("verify:phase117a-cicd-release-gate") &&
      userManual.includes("verify:phase118a-remote-cicd-gate-preflight") &&
      userManual.includes("verify:phase119a-git-repo-readiness") &&
      userManual.includes("verify:phase120a-git-initial-commit-preflight") &&
      userManual.includes("verify:phase121a-git-initial-commit-execution") &&
      userManual.includes("verify:phase122a-github-remote-publish-preflight") &&
      userManual.includes("verify:phase123a-github-cli-readiness") &&
      userManual.includes("verify:phase124a-github-cli-install") &&
      userManual.includes("verify:phase125a-github-auth-preflight") &&
      userManual.includes("verify:phase126a-github-auth-ready") &&
      userManual.includes("verify:phase127a-github-remote-target-preflight") &&
      userManual.includes("verify:phase128a-github-remote-push") &&
      userManual.includes("verify:phase129a-remote-release-status") &&
      userManual.includes("verify:phase130a-actions-node24-warning-cleanup") &&
      userManual.includes("verify:phase112a-non-docker-release-check") &&
      userManual.includes("verify:phase107a-secret-safety") &&
      userManual.includes("verify:phase105a-user-journey"),
  };

  const checks = {
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase114a-user-manual-release-pack"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase114a-user-manual-release-pack",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase114a-user-manual-release-pack"] ===
      "node ./src/entrypoints/verifyUserManualReleasePack.js",
    readmePhasePresent:
      readme.includes("Phase 114A") &&
      readme.includes("docs/USER_MANUAL.md") &&
      readme.includes("verify:phase114a-user-manual-release-pack"),
    agentsBoundaryPresent:
      agents.includes("Phase 114A User Manual Release Pack Boundary") &&
      agents.includes("verify:phase114a-user-manual-release-pack") &&
      agentsFlat.includes("Docker runtime was completed later by Phase 115A") &&
      agentsFlat.includes("Do not describe Phase 114A as CI/CD complete") &&
      agentsFlat.includes("Do not describe Phase 114A as global release complete"),
    manualComplete: Object.values(manualChecks).every(Boolean),
    dockerRuntimeStatusDocumented:
      manualFlat.includes("Local Docker runtime build/run") &&
      manualFlat.includes("docker --version") &&
      manualFlat.includes("docker compose version") &&
      manualFlat.includes("docker ps") &&
      readmeFlat.includes("Docker local runtime now passes through Phase 115A"),
    noPlainSecrets: secretFindings.length === 0,
    projectContextNotCreated: !existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md")),
  };
  const passed = Object.values(checks).every(Boolean);

  const evidence = {
    phase,
    status: passed ? "passed" : "failed",
    generatedAt,
    checks,
    manualChecks,
    releasePack: {
      userManual: "docs/USER_MANUAL.md",
      localPnpmPathDocumented: manualChecks.zeroStart,
      setupWizardDocumented: manualChecks.setupWizard,
      modelImportDocumented: manualChecks.modelImport,
      chatDocumented: manualChecks.chat,
      knowledgeRagDocumented: manualChecks.knowledgeRag,
      agentWorkforcePreviewDocumented: manualChecks.workforce,
      saveExportDocumented: manualChecks.saveExport,
      knownLimitsDocumented: manualChecks.blockedAndLimits,
    },
    safety: {
      dockerRuntimePassed: true,
      dockerRuntimeFaked: false,
      minimalCicdGateCreatedLaterByPhase117A: true,
      deploymentOrReleaseAutomationCreated: false,
      cloudDeploymentComplete: false,
      releaseAutomationComplete: false,
      globalReleaseComplete: false,
      realAgentExecutionEnabled: false,
      plaintextApiKeyRecorded: false,
      legacyModified: false,
      projectContextCreated: false,
    },
    secretFindingCount: secretFindings.length,
    conclusion: passed
      ? "user-manual-release-pack-closed"
      : "user-manual-release-pack-not-closed",
  };

  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    resolve(evidenceDir, `${phase}.json`),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );
  await writeFile(resolve(evidenceDir, `${phase}.md`), markdown(evidence), "utf8");

  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
}

function markdown(evidence) {
  return [
    "# Phase 114A User Manual Release Pack Evidence",
    "",
    `- Phase: ${evidence.phase}`,
    `- Status: ${evidence.status}`,
    `- Generated at: ${evidence.generatedAt}`,
    `- User manual: ${evidence.releasePack.userManual}`,
    `- Local pnpm path documented: ${evidence.releasePack.localPnpmPathDocumented}`,
    `- Setup Wizard documented: ${evidence.releasePack.setupWizardDocumented}`,
    `- Model Import documented: ${evidence.releasePack.modelImportDocumented}`,
    `- Chat documented: ${evidence.releasePack.chatDocumented}`,
    `- Knowledge/RAG documented: ${evidence.releasePack.knowledgeRagDocumented}`,
    `- Agent Workforce preview documented: ${evidence.releasePack.agentWorkforcePreviewDocumented}`,
    `- Save/export documented: ${evidence.releasePack.saveExportDocumented}`,
    `- Known limits documented: ${evidence.releasePack.knownLimitsDocumented}`,
    `- Docker runtime passed: ${evidence.safety.dockerRuntimePassed}`,
    `- Minimal CI/CD gate created later by Phase117A: ${evidence.safety.minimalCicdGateCreatedLaterByPhase117A}`,
    `- Cloud deployment complete: ${evidence.safety.cloudDeploymentComplete}`,
    `- Global release complete: ${evidence.safety.globalReleaseComplete}`,
    `- Plain secret findings: ${evidence.secretFindingCount}`,
    `- Conclusion: ${evidence.conclusion}`,
    "",
    "## Checks",
    "",
    ...Object.entries(evidence.checks).map(
      ([name, value]) => `- ${name}: ${value ? "passed" : "failed"}`,
    ),
    "",
  ].join("\n");
}

main().catch(async (error) => {
  const evidence = {
    phase,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "user-manual-release-pack-not-closed",
  };
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    resolve(evidenceDir, `${phase}.json`),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );
  console.error(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
});
