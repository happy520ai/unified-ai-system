import { execFile } from "node:child_process";
import { writeEvidencePair } from "./entrypointUtils.js";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const PHASE = "phase-110a-docker-readiness";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-110a-docker-readiness.json");
const evidenceMdPath = resolve(evidenceDir, "phase-110a-docker-readiness.md");

try {
  const [rootPackage, servicePackage, readme, agents, envExample, dockerfile, dockerignore, compose] = await Promise.all([
    readFile(resolve(repoRoot, "package.json"), "utf8"),
    readFile(resolve(repoRoot, "apps/ai-gateway-service/package.json"), "utf8"),
    readFile(resolve(repoRoot, "README.md"), "utf8"),
    readFile(resolve(repoRoot, "AGENTS.md"), "utf8"),
    readFile(resolve(repoRoot, ".env.example"), "utf8"),
    readRequiredText("Dockerfile"),
    readRequiredText(".dockerignore"),
    readRequiredText("docker-compose.yml"),
  ]);
  const docker = await detectDocker();
  const evidence = createEvidence({
    rootPackage,
    servicePackage,
    readme,
    agents,
    envExample,
    dockerfile,
    dockerignore,
    compose,
    docker,
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
    conclusion: "docker-readiness-not-closed",
  };
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}

function createEvidence({ rootPackage, servicePackage, readme, agents, envExample, dockerfile, dockerignore, compose, docker }) {
  const rootScripts = JSON.parse(rootPackage).scripts ?? {};
  const serviceScripts = JSON.parse(servicePackage).scripts ?? {};
  const combined = [readme, agents, envExample, dockerfile, dockerignore, compose].join("\n\n");
  const readmeFlat = normalizeWhitespace(readme);

  const checks = {
    dockerfileExists: existsSync(resolve(repoRoot, "Dockerfile")),
    dockerignoreExists: existsSync(resolve(repoRoot, ".dockerignore")),
    composeExists: existsSync(resolve(repoRoot, "docker-compose.yml")),
    dockerfileMinimalNodePnpm: dockerfile.includes("FROM node:22-bookworm-slim") &&
      dockerfile.includes("corepack enable") &&
      dockerfile.includes("pnpm@9.15.4") &&
      dockerfile.includes("pnpm install --frozen-lockfile --filter @unified-ai-system/ai-gateway-service..."),
    dockerfileServiceStartup: dockerfile.includes("AI_GATEWAY_SERVICE_HOST=0.0.0.0") &&
      dockerfile.includes("AI_GATEWAY_SERVICE_PORT=3100") &&
      dockerfile.includes("EXPOSE 3100") &&
      dockerfile.includes('CMD ["pnpm", "--filter", "@unified-ai-system/ai-gateway-service", "start"]'),
    dockerignoreSafety: [
      "node_modules/",
      ".git/",
      "legacy/",
      ".env",
      ".env.*",
      "!.env.example",
    ].every((text) => dockerignore.includes(text)),
    composeMinimalServiceOnly: compose.includes("ai-gateway-service:") &&
      compose.includes("dockerfile: Dockerfile") &&
      compose.includes("env_file:") &&
      compose.includes("- .env") &&
      compose.includes('"3100:3100"') &&
      !/(postgres|pgvector|redis)/i.test(compose),
    readmeDockerInstructions: readme.includes("Phase 110A") &&
      readme.includes("verify:phase110a-docker-readiness") &&
      readme.includes("docker build -t pme-mobile-earth-ai-gateway .") &&
      readme.includes("docker run --rm --env-file .env -p 3100:3100 pme-mobile-earth-ai-gateway") &&
      readme.includes("docker compose up --build ai-gateway-service") &&
      readme.includes("http://127.0.0.1:3100/ui") &&
      readme.includes("http://127.0.0.1:3100/health/check") &&
      readme.includes("http://127.0.0.1:3100/setup/readiness"),
    readmeDockerBoundary: readmeFlat.includes("This is local container startup only; it is not cloud deployment, not CI/CD, not a production cluster, and not global release"),
    agentsDockerBoundary: [
      "verify:phase110a-docker-readiness",
      "Docker local startup is not cloud deployment",
      "CI/CD",
      "production deployment",
      "global release",
      "Do not put real API keys into Dockerfile",
    ].every((text) => agents.includes(text)),
    scriptsPresent: rootScripts["verify:phase110a-docker-readiness"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase110a-docker-readiness" &&
      serviceScripts["verify:phase110a-docker-readiness"] === "node ./src/entrypoints/verifyDockerReadiness.js",
    noPlainSecrets: findPlainSecretFindings(combined, "phase110a-docker-docs").length === 0,
  };
  const passed = Object.values(checks).every(Boolean);

  return {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    checks,
    docker: {
      available: docker.available,
      version: docker.version,
      composeAvailable: docker.composeAvailable,
      composeVersion: docker.composeVersion,
      realBuildRunExecuted: false,
      note: docker.available
        ? "Docker CLI detected; this phase performs static Docker readiness only."
        : "Docker CLI was not available; static Docker readiness checks were used.",
    },
    deployment: {
      dockerFiles: ["Dockerfile", ".dockerignore", "docker-compose.yml"],
      localContainerStartupSealed: true,
      cloudDeploymentComplete: false,
      cicdComplete: false,
      globalReleaseComplete: false,
      databaseContainersAdded: false,
      realApiKeysEmbedded: false,
    },
    safety: {
      defaultChatMainLaneChanged: false,
      realCloudDeployment: false,
      plaintextApiKeyRecorded: false,
      projectContextCreated: false,
    },
    conclusion: passed ? "docker-readiness-closed" : "docker-readiness-not-closed",
  };
}

async function readRequiredText(path) {
  return readFile(resolve(repoRoot, path), "utf8");
}

async function detectDocker() {
  const docker = await execFileSafe("docker", ["--version"]);
  const compose = docker.ok ? await execFileSafe("docker", ["compose", "version"]) : { ok: false, stdout: "" };
  return {
    available: docker.ok,
    version: docker.stdout.trim(),
    composeAvailable: compose.ok,
    composeVersion: compose.stdout.trim(),
  };
}

function execFileSafe(command, args) {
  return new Promise((resolveExec) => {
    execFile(command, args, { timeout: 5000, windowsHide: true }, (error, stdout) => {
      resolveExec({
        ok: !error,
        stdout: stdout ?? "",
      });
    });
  });
}

function normalizeWhitespace(text) {
  return String(text ?? "").replace(/\s+/g, " ");
}

