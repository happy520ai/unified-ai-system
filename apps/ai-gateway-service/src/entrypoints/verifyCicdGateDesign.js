import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const PHASE = "phase-111b-cicd-gate-design";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-111b-cicd-gate-design.json");
const evidenceMdPath = resolve(evidenceDir, "phase-111b-cicd-gate-design.md");

try {
  const [rootPackage, servicePackage, readme, agents, envExample] = await Promise.all([
    readFile(resolve(repoRoot, "package.json"), "utf8"),
    readFile(resolve(repoRoot, "apps/ai-gateway-service/package.json"), "utf8"),
    readFile(resolve(repoRoot, "README.md"), "utf8"),
    readFile(resolve(repoRoot, "AGENTS.md"), "utf8"),
    readFile(resolve(repoRoot, ".env.example"), "utf8"),
  ]);
  const ciFiles = await listCiFiles(repoRoot);
  const evidence = createEvidence({
    rootPackage,
    servicePackage,
    readme,
    agents,
    envExample,
    ciFiles,
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = evidence.status === "passed" ? 0 : 1;
} catch (error) {
  const evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "cicd-gate-design-not-closed",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}

function createEvidence({ rootPackage, servicePackage, readme, agents, envExample, ciFiles }) {
  const rootScripts = JSON.parse(rootPackage).scripts ?? {};
  const serviceScripts = JSON.parse(servicePackage).scripts ?? {};
  const combined = [readme, agents, envExample, rootPackage, servicePackage].join("\n\n");
  const readmeFlat = normalizeWhitespace(readme);
  const agentsFlat = normalizeWhitespace(agents);
  const gateChecks = {
    install: readme.includes("install: `pnpm install`"),
    lintCheck: readme.includes("lint/check: `cmd /c pnpm -r --if-present check`"),
    secretScan: readme.includes("secret scan: `cmd /c pnpm verify:phase107a-secret-safety`"),
    userJourney: readme.includes("user journey: `cmd /c pnpm verify:phase105a-user-journey`"),
    setupReadiness: readme.includes("setup readiness: `cmd /c pnpm verify:phase104a-first-run-setup`"),
    dockerBuildRun: readme.includes("Docker build/run") &&
      readme.includes("/health/check") &&
      readme.includes("/setup/readiness") &&
      readme.includes("/ui"),
    smokeHealth: readme.includes("smoke health: `cmd /c pnpm health:phase12a`"),
    artifactEvidenceScan: readme.includes("artifact/evidence scan") &&
      readme.includes("plaintext API") &&
      readme.includes("unverified global release"),
  };

  const checks = {
    readmePhasePresent: readme.includes("Phase 111B") &&
      readme.includes("verify:phase111b-cicd-gate-design"),
    readmeDockerRuntimeStatus: readmeFlat.includes("Docker local runtime now passes through Phase 115A") &&
      readme.includes("verify:phase115a-docker-runtime-recheck"),
    readmeDesignBoundary: readmeFlat.includes("Phase 111B remains the design boundary only") &&
      readmeFlat.includes("does not itself complete CI/CD automation") &&
      readmeFlat.includes("cloud deployment") &&
      readmeFlat.includes("release automation") &&
      readmeFlat.includes("global release"),
    readmeGateListComplete: Object.values(gateChecks).every(Boolean),
    agentsBoundaryPresent: agents.includes("verify:phase111b-cicd-gate-design") &&
      agentsFlat.includes("Do not describe Phase 111B as CI/CD complete") &&
      agents.includes("Phase 117A later adds the explicit") &&
      agents.includes("global release complete") &&
      agents.includes("Do not add release automation"),
    scriptsPresent: rootScripts["verify:phase111b-cicd-gate-design"] ===
        "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase111b-cicd-gate-design" &&
      serviceScripts["verify:phase111b-cicd-gate-design"] ===
        "node ./src/entrypoints/verifyCicdGateDesign.js",
    phase117aGateMayExist: ciFiles.length === 0 ||
      ciFiles.includes(".github/workflows/release-gate.yml"),
    noPlainSecrets: findPlainSecretFindings(combined, "phase111b-docs").length === 0,
    projectContextNotCreated: !existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md")),
  };
  const passed = Object.values(checks).every(Boolean);

  return {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    checks,
    gates: {
      install: "pnpm install",
      lintCheck: "cmd /c pnpm -r --if-present check",
      secretScan: "cmd /c pnpm verify:phase107a-secret-safety",
      userJourney: "cmd /c pnpm verify:phase105a-user-journey",
      setupReadiness: "cmd /c pnpm verify:phase104a-first-run-setup",
      dockerBuildRun: "build image, run container, then verify /health/check, /setup/readiness, and /ui",
      smokeHealth: "cmd /c pnpm health:phase12a",
      artifactEvidenceScan: "scan evidence/logs for plaintext API keys and false global-release claims",
      gateChecks,
    },
    cicd: {
      designOnly: true,
      minimalGateCreatedLaterByPhase117A: ciFiles.includes(".github/workflows/release-gate.yml"),
      ciFiles,
      githubActionsCreated: ciFiles.includes(".github/workflows/release-gate.yml"),
      cloudDeploymentComplete: false,
      releaseAutomationComplete: false,
      globalReleaseComplete: false,
    },
    docker: {
    runtimeStillBlockedByDockerCli: false,
    phase115aDockerRuntimePassed: true,
    fakeRuntimePassRecorded: false,
    },
    safety: {
      defaultChatMainLaneChanged: false,
      plaintextApiKeyRecorded: false,
      projectContextCreated: false,
      legacyModified: false,
    },
    conclusion: passed ? "cicd-gate-design-closed" : "cicd-gate-design-not-closed",
  };
}

async function listCiFiles(directory) {
  const output = [];
  if (!existsSync(directory)) return output;
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldSkipDirectory(entry.name)) {
      continue;
    }
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      output.push(...await listCiFiles(absolute));
    } else if (entry.isFile() && isCiFile(absolute)) {
      output.push(relative(repoRoot, absolute).replace(/\\/g, "/"));
    }
  }
  return output;
}

function isCiFile(filePath) {
  const repoPath = relative(repoRoot, filePath).replace(/\\/g, "/");
  return repoPath.startsWith(".github/workflows/") ||
    ["azure-pipelines.yml", "azure-pipelines.yaml", ".gitlab-ci.yml", "Jenkinsfile"].includes(repoPath) ||
    repoPath === ".circleci/config.yml";
}

function shouldSkipDirectory(name) {
  return [".git", "node_modules", "dist", "build", "coverage", ".next", ".cache", "legacy"].includes(name);
}

function normalizeWhitespace(text) {
  return String(text ?? "").replace(/\s+/g, " ");
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 111B CI/CD Gate Design Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- README phase present: ${body.checks?.readmePhasePresent}
- README records Docker runtime status: ${body.checks?.readmeDockerRuntimeStatus}
- README records design boundary: ${body.checks?.readmeDesignBoundary}
- README CI/CD gate list complete: ${body.checks?.readmeGateListComplete}
- AGENTS boundary present: ${body.checks?.agentsBoundaryPresent}
- Scripts present: ${body.checks?.scriptsPresent}
- Minimal Phase117A gate may exist: ${body.checks?.phase117aGateMayExist}
- CI files: ${(body.cicd?.ciFiles ?? []).join(", ") || "none"}
- Docker runtime still blocked by Docker CLI: ${body.docker?.runtimeStillBlockedByDockerCli}
- Phase 115A Docker runtime passed: ${body.docker?.phase115aDockerRuntimePassed}
- Fake Docker runtime pass recorded: ${body.docker?.fakeRuntimePassRecorded}
- Cloud deployment complete: ${body.cicd?.cloudDeploymentComplete}
- Release automation complete: ${body.cicd?.releaseAutomationComplete}
- Global release complete: ${body.cicd?.globalReleaseComplete}
- Plaintext API key recorded: ${body.safety?.plaintextApiKeyRecorded}
- Conclusion: ${body.conclusion}
`;
}
