import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const phase = "phase-117a-cicd-release-gate";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const workflowPath = ".github/workflows/release-gate.yml";

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
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
    workflow,
    readme,
    agents,
    userManual,
  ] = await Promise.all([
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired(workflowPath),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
  ]);

  const rootPackage = parseJson(rootPackageText, "package.json");
  const servicePackage = parseJson(
    servicePackageText,
    "apps/ai-gateway-service/package.json",
  );
  const workflowFlat = normalizeWhitespace(workflow);
  const readmeFlat = normalizeWhitespace(readme);
  const agentsFlat = normalizeWhitespace(agents);
  const manualFlat = normalizeWhitespace(userManual);

  const gateCommands = {
    install: workflow.includes("pnpm install --frozen-lockfile"),
    workspaceCheck: workflow.includes("pnpm -r --if-present check"),
    secretSafety: workflow.includes("pnpm verify:phase107a-secret-safety"),
    userJourney: workflow.includes("pnpm verify:phase105a-user-journey"),
    setupReadiness: workflow.includes("pnpm verify:phase104a-first-run-setup"),
    dockerRuntime: workflow.includes("pnpm verify:phase115a-docker-runtime-recheck"),
    prepareDockerComposeEnv: workflow.includes("cp .env.example .env"),
    dockerComposeRuntime: workflow.includes("pnpm verify:phase116a-docker-compose-runtime"),
  };
  const forbiddenReleaseMarkers = [
    "docker push",
    "npm publish",
    "pnpm publish",
    "gh release",
    "actions/create-release",
    "softprops/action-gh-release",
    "azure/login",
    "aws-actions/configure-aws-credentials",
    "google-github-actions/auth",
    "kubectl",
    "helm upgrade",
    "scp ",
    "rsync ",
  ];
  const forbiddenHits = forbiddenReleaseMarkers.filter((marker) =>
    workflowFlat.toLowerCase().includes(marker.toLowerCase()),
  );
  const secretFindings = findPlainSecretFindings(
    [
      rootPackageText,
      servicePackageText,
      workflow,
      readme,
      agents,
      userManual,
    ].join("\n\n"),
    "phase117a-cicd-release-gate",
  );

  const checks = {
    workflowPresent: existsSync(resolve(repoRoot, workflowPath)),
    workflowNamePresent: workflow.includes("Phase117A Release Gate"),
    workflowTriggersPresent:
      workflow.includes("pull_request:") &&
      workflow.includes("workflow_dispatch:"),
    workflowReadOnlyPermissions: workflow.includes("contents: read"),
    workflowUsesNode22: workflow.includes('node-version: "22"'),
    workflowUsesPinnedPnpm: workflow.includes("corepack prepare pnpm@9.15.4 --activate"),
    gateCommandsComplete: Object.values(gateCommands).every(Boolean),
    noDeployOrPublishSteps: forbiddenHits.length === 0,
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase117a-cicd-release-gate"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase117a-cicd-release-gate",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase117a-cicd-release-gate"] ===
      "node ./src/entrypoints/verifyCicdReleaseGate.js",
    readmePhasePresent:
      readme.includes("Phase 117A") &&
      readme.includes("verify:phase117a-cicd-release-gate") &&
      readme.includes(workflowPath),
    agentsBoundaryPresent:
      agents.includes("Phase 117A CI/CD Release Gate Boundary") &&
      agents.includes("verify:phase117a-cicd-release-gate") &&
      agentsFlat.includes("does not deploy") &&
      agentsFlat.includes("does not publish"),
    userManualPresent:
      manualFlat.includes("Minimal CI/CD release gate") &&
      userManual.includes("verify:phase117a-cicd-release-gate"),
    noPlainSecrets: secretFindings.length === 0,
    projectContextNotCreated: !existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md")),
  };
  const passed = Object.values(checks).every(Boolean);
  const evidence = {
    phase,
    status: passed ? "passed" : "failed",
    generatedAt,
    checks,
    workflow: {
      path: workflowPath,
      triggers: ["pull_request", "push main/master", "workflow_dispatch"],
      gateCommands,
      forbiddenHits,
    },
    safety: {
      realCiFileCreated: true,
      deploysInfrastructure: false,
      publishesRelease: false,
      pushesImage: false,
      callsRealProviders: false,
      plaintextApiKeyRecorded: false,
      cloudDeploymentComplete: false,
      globalReleaseComplete: false,
    },
    secretFindingCount: secretFindings.length,
    conclusion: passed ? "cicd-release-gate-closed" : "cicd-release-gate-not-closed",
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
    "# Phase 117A CI/CD Release Gate Evidence",
    "",
    `- Phase: ${evidence.phase}`,
    `- Status: ${evidence.status}`,
    `- Generated at: ${evidence.generatedAt}`,
    `- Workflow: ${evidence.workflow.path}`,
    `- Forbidden deploy/publish hits: ${evidence.workflow.forbiddenHits.length}`,
    `- Plain secret findings: ${evidence.secretFindingCount}`,
    `- Conclusion: ${evidence.conclusion}`,
    "",
    "## Gate Commands",
    "",
    ...Object.entries(evidence.workflow.gateCommands).map(
      ([name, value]) => `- ${name}: ${value ? "present" : "missing"}`,
    ),
    "",
    "## Checks",
    "",
    ...Object.entries(evidence.checks).map(
      ([name, value]) => `- ${name}: ${value ? "passed" : "failed"}`,
    ),
    "",
    "## Boundaries",
    "",
    "- This is a GitHub Actions release-readiness gate only.",
    "- It does not deploy infrastructure, publish releases, push container images, or complete global release.",
    "- It must not record plaintext API keys.",
    "",
  ].join("\n");
}

await main();
