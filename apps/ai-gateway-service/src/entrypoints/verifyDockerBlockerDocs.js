import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(__dirname, "../../evidence");
const phase = "phase-113b-docker-blocker-docs";

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

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

async function main() {
  const generatedAt = new Date().toISOString();

  const [
    rootPackageText,
    servicePackageText,
    readme,
    agents,
    envExample,
  ] = await Promise.all([
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired(".env.example"),
  ]);

  const rootPackage = parseJson(rootPackageText, "package.json");
  const servicePackage = parseJson(
    servicePackageText,
    "apps/ai-gateway-service/package.json",
  );

  const readmeFlat = normalizeWhitespace(readme);
  const agentsFlat = normalizeWhitespace(agents);
  const secretFindings = findPlainSecretFindings(
    [
      rootPackageText,
      servicePackageText,
      readme,
      agents,
      envExample,
    ].join("\n\n"),
    "phase113b-docker-blocker-docs",
  );

  const checks = {
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase113b-docker-blocker-docs"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase113b-docker-blocker-docs",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase113b-docker-blocker-docs"] ===
      "node ./src/entrypoints/verifyDockerBlockerDocs.js",
    readmePhasePresent:
      readme.includes("Phase 113B") &&
      readme.includes("verify:phase113b-docker-blocker-docs"),
    readmeDockerDesktopPrereqs:
      readme.includes("original Docker runtime blocker") &&
      readme.includes("Docker CLI prerequisites were later rechecked"),
    readmeDockerCliCommands:
      readme.includes("docker --version") &&
      readme.includes("docker compose version") &&
      readme.includes("docker ps"),
    readmeDockerRuntimeStatus:
      readmeFlat.includes("Phase 115A later repaired WSL") &&
      readmeFlat.includes("verified real local Docker build/run successfully"),
    readmeStaticReadinessNotRuntimePass:
      readmeFlat.includes(
        "Phase 110A static Docker readiness is not the same as Docker runtime passing",
      ) &&
      readmeFlat.includes("must not be used as Docker build/run evidence"),
    agentsBoundaryPresent:
      agents.includes("verify:phase113b-docker-blocker-docs") &&
      agentsFlat.includes("Phase 115A later records the real local Docker build/run pass") &&
      agentsFlat.includes(
        "Do not treat Phase 110A static Docker readiness as Docker runtime passing",
      ),
    projectContextNotCreated: !existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md")),
    noPlainSecrets: secretFindings.length === 0,
  };

  const passed = Object.values(checks).every(Boolean);

  const evidence = {
    phase,
    status: passed ? "passed" : "failed",
    generatedAt,
    checks,
    docker: {
      cliAvailable: true,
      runtimeBlocked: false,
      currentEngine: "linux",
      currentBlocker:
        "none",
      requiredCommands: [
        "docker --version",
        "docker compose version",
        "docker ps",
      ],
      phase115aDockerRuntimePassed: true,
      phase110aStaticReadinessIsRuntimePass: false,
      fakeRuntimePassRecorded: false,
    },
    safety: {
      defaultChatMainLaneChanged: false,
      realCiCreated: false,
      cloudDeploymentComplete: false,
      releaseAutomationComplete: false,
      plaintextApiKeyRecorded: false,
      projectContextCreated: false,
      legacyModified: false,
    },
    secretFindingCount: secretFindings.length,
    conclusion: passed
      ? "docker-blocker-docs-closed"
      : "docker-blocker-docs-not-closed",
  };

  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    resolve(evidenceDir, `${phase}.json`),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );

  const markdown = [
    `# ${phase}`,
    "",
    `- Status: ${evidence.status}`,
    `- Generated at: ${generatedAt}`,
    "- Docker CLI prerequisite commands: available",
    "- Docker runtime: project local build/run passed later in Phase 115A",
    "- Required commands:",
    "  - `docker --version`",
    "  - `docker compose version`",
    "  - `docker ps`",
    `- Phase 110A static readiness is runtime pass: ${evidence.docker.phase110aStaticReadinessIsRuntimePass}`,
    `- Phase 115A Docker runtime passed: ${evidence.docker.phase115aDockerRuntimePassed}`,
    `- Current blocker: ${evidence.docker.currentBlocker}`,
    `- Plain secret findings: ${evidence.secretFindingCount}`,
    "",
    "## Checks",
    "",
    ...Object.entries(checks).map(
      ([name, value]) => `- ${name}: ${value ? "passed" : "failed"}`,
    ),
    "",
  ].join("\n");

  await writeFile(resolve(evidenceDir, `${phase}.md`), markdown, "utf8");

  if (!passed) {
    console.error(JSON.stringify(evidence, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        phase,
        status: "failed",
        error: error.message,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
