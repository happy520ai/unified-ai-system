import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const PHASE = "phase-109a-deployment-readiness";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-109a-deployment-readiness.json");
const evidenceMdPath = resolve(evidenceDir, "phase-109a-deployment-readiness.md");

try {
  const [rootPackage, servicePackage, readme, agents, envExample] = await Promise.all([
    readFile(resolve(repoRoot, "package.json"), "utf8"),
    readFile(resolve(repoRoot, "apps/ai-gateway-service/package.json"), "utf8"),
    readFile(resolve(repoRoot, "README.md"), "utf8"),
    readFile(resolve(repoRoot, "AGENTS.md"), "utf8"),
    readFile(resolve(repoRoot, ".env.example"), "utf8"),
  ]);
  const dockerFiles = await listDockerFiles(repoRoot);
  const evidence = createEvidence({
    rootPackage,
    servicePackage,
    readme,
    agents,
    envExample,
    dockerFiles,
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
    conclusion: "deployment-readiness-not-closed",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}

function createEvidence({ rootPackage, servicePackage, readme, agents, envExample, dockerFiles }) {
  const rootScripts = JSON.parse(rootPackage).scripts ?? {};
  const serviceScripts = JSON.parse(servicePackage).scripts ?? {};
  const scanText = [readme, agents, envExample].join("\n\n");
  const readmeFlat = normalizeWhitespace(readme);
  const dockerSealed = dockerFiles.length > 0 && readme.includes("Docker") && !readme.includes("Dockerfile/docker-compose is not sealed");

  const checks = {
    readmePhasePresent: readme.includes("Phase 109A") &&
      readme.includes("verify:phase109a-deployment-readiness"),
    readmeLocalStartup: readme.includes("Local development startup") &&
      readme.includes("pnpm install") &&
      readme.includes("cmd /c pnpm start:pme") &&
      readme.includes("http://127.0.0.1:3100/ui"),
    readmeIntranetStartup: readme.includes("Intranet test startup") &&
      readme.includes(".env") &&
      readme.includes("trusted internal network"),
    readmeVerificationCommands: [
      "cmd /c pnpm verify:phase104a-first-run-setup",
      "cmd /c pnpm health:phase12a",
      "cmd /c pnpm doctor:phase13a",
      "cmd /c pnpm -r --if-present check",
    ].every((text) => readme.includes(text)),
    readmePublicBoundary: readmeFlat.includes("Do not expose this service directly to the public internet for multi-user access"),
    readmeProductionGaps: [
      "auth",
      "tenant isolation",
      "encrypted secret vault",
      "rate limit",
      "audit retention",
      "backup/restore policy",
      "TLS/reverse proxy hardening",
      "dedicated security review",
    ].every((text) => readmeFlat.includes(text)),
    dockerBoundaryAccurate: dockerFiles.length > 0 || readme.includes("Dockerfile/docker-compose is not sealed"),
    agentsBoundaryPresent: [
      "verify:phase109a-deployment-readiness",
      "production deployment complete",
      "Docker complete",
      "cloud deployment complete",
      "CI/CD complete",
      "global release complete",
    ].every((text) => agents.includes(text)),
    scriptsPresent: rootScripts["verify:phase109a-deployment-readiness"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase109a-deployment-readiness" &&
      serviceScripts["verify:phase109a-deployment-readiness"] === "node ./src/entrypoints/verifyDeploymentReadiness.js",
    envExampleStillPlaceholderOnly: findPlainSecretFindings(envExample, ".env.example").length === 0,
    docsNoPlainSecrets: findPlainSecretFindings(scanText, "phase109a-docs").length === 0,
  };
  const passed = Object.values(checks).every(Boolean);

  return {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    checks,
    deployment: {
      localDevelopmentStartup: "pnpm install -> cmd /c pnpm start:pme -> http://127.0.0.1:3100/ui",
      intranetTesting: "supported with private environment configuration on a trusted internal network",
      dockerFiles,
      dockerSealed,
      publicInternetMultiUserReady: false,
      cloudDeploymentComplete: false,
      cicdComplete: false,
      globalReleaseComplete: false,
      productionPrerequisites: [
        "auth",
        "tenant isolation",
        "encrypted secret vault",
        "rate limit",
        "audit retention",
        "backup/restore policy",
        "TLS/reverse proxy hardening",
        "dedicated security review",
      ],
    },
    safety: {
      defaultChatMainLaneChanged: false,
      realCloudDeployment: false,
      dockerClaimedCompleteWithoutVerification: false,
      plaintextApiKeyRecorded: false,
      projectContextCreated: false,
    },
    conclusion: passed ? "deployment-readiness-boundary-closed" : "deployment-readiness-not-closed",
  };
}

function normalizeWhitespace(text) {
  return String(text ?? "").replace(/\s+/g, " ");
}

async function listDockerFiles(directory) {
  const output = [];
  if (!existsSync(directory)) return output;
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldSkipDirectory(entry.name)) {
      continue;
    }
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      output.push(...await listDockerFiles(absolute));
    } else if (entry.isFile() && isDockerFile(entry.name)) {
      output.push(relative(repoRoot, absolute).replace(/\\/g, "/"));
    }
  }
  return output;
}

function isDockerFile(name) {
  return ["Dockerfile", "docker-compose.yml", "docker-compose.yaml", ".dockerignore"].includes(name);
}

function shouldSkipDirectory(name) {
  return [".git", "node_modules", "dist", "build", "coverage", ".next", ".cache", "legacy"].includes(name);
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 109A Deployment Readiness Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- README phase present: ${body.checks?.readmePhasePresent}
- README local startup: ${body.checks?.readmeLocalStartup}
- README intranet startup: ${body.checks?.readmeIntranetStartup}
- README verification commands: ${body.checks?.readmeVerificationCommands}
- README public boundary: ${body.checks?.readmePublicBoundary}
- README production gaps: ${body.checks?.readmeProductionGaps}
- Docker boundary accurate: ${body.checks?.dockerBoundaryAccurate}
- AGENTS boundary present: ${body.checks?.agentsBoundaryPresent}
- Scripts present: ${body.checks?.scriptsPresent}
- Env example placeholder only: ${body.checks?.envExampleStillPlaceholderOnly}
- Docs contain plaintext secrets: ${!body.checks?.docsNoPlainSecrets}
- Docker files: ${(body.deployment?.dockerFiles ?? []).join(", ") || "none"}
- Public internet multi-user ready: ${body.deployment?.publicInternetMultiUserReady}
- Cloud deployment complete: ${body.deployment?.cloudDeploymentComplete}
- CI/CD complete: ${body.deployment?.cicdComplete}
- Global release complete: ${body.deployment?.globalReleaseComplete}
- Conclusion: ${body.conclusion}
`;
}
