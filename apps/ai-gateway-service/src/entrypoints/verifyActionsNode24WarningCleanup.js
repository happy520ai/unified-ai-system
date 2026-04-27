import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const phase = "phase-130a-actions-node24-warning-cleanup";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const workflowPath = ".github/workflows/release-gate.yml";
const statusDocPath = "docs/REMOTE_RELEASE_STATUS.md";

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

function includesActionsNode24OptIn(workflow) {
  return (
    workflow.includes('FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"') ||
    workflow.includes("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true")
  );
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
    statusDoc,
  ] = await Promise.all([
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired(workflowPath),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
    readRequired(statusDocPath),
  ]);

  const rootPackage = parseJson(rootPackageText, "package.json");
  const servicePackage = parseJson(
    servicePackageText,
    "apps/ai-gateway-service/package.json",
  );
  const workflowFlat = normalizeWhitespace(workflow);
  const statusDocFlat = normalizeWhitespace(statusDoc);

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
      statusDoc,
    ].join("\n\n"),
    "phase130a-actions-node24-warning-cleanup",
  );

  const checks = {
    workflowPresent: existsSync(resolve(repoRoot, workflowPath)),
    workflowForcesActionsNode24: includesActionsNode24OptIn(workflow),
    workflowDoesNotAllowUnsecureNode20:
      !workflow.includes("ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION"),
    workflowStillUsesReadOnlyPermissions: workflow.includes("contents: read"),
    workflowCheckoutStepPresent: workflow.includes("uses: actions/checkout@v4"),
    workflowSetupNodeStepPresent: workflow.includes("uses: actions/setup-node@v4"),
    workflowUsesNode22ForProject: workflow.includes('node-version: "22"'),
    gateCommandsPreserved: Object.values(gateCommands).every(Boolean),
    noDeployOrPublishSteps: forbiddenHits.length === 0,
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase130a-actions-node24-warning-cleanup"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase130a-actions-node24-warning-cleanup",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase130a-actions-node24-warning-cleanup"] ===
      "node ./src/entrypoints/verifyActionsNode24WarningCleanup.js",
    readmePhasePresent:
      readme.includes("Phase 130A") &&
      readme.includes("verify:phase130a-actions-node24-warning-cleanup"),
    agentsBoundaryPresent:
      agents.includes("Phase 130A GitHub Actions Node 24 Warning Cleanup Boundary") &&
      agents.includes("verify:phase130a-actions-node24-warning-cleanup"),
    userManualPresent:
      userManual.includes("verify:phase130a-actions-node24-warning-cleanup") &&
      userManual.includes("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24"),
    statusDocUpdated:
      statusDoc.includes("Phase 130A") &&
      statusDoc.includes("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24") &&
      statusDocFlat.includes("Node.js 20 deprecation warning cleanup"),
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
      actionsNode24OptIn: checks.workflowForcesActionsNode24,
      node20OptOutPresent: !checks.workflowDoesNotAllowUnsecureNode20,
      gateCommands,
      forbiddenHits,
    },
    safety: {
      warningCleanupOnly: true,
      deploysInfrastructure: false,
      publishesRelease: false,
      publishesPackage: false,
      pushesImage: false,
      callsRealProviders: false,
      plaintextApiKeyRecorded: false,
      cloudDeploymentComplete: false,
      globalReleaseComplete: false,
    },
    secretFindingCount: secretFindings.length,
    conclusion: passed
      ? "actions-node24-warning-cleanup-closed"
      : "actions-node24-warning-cleanup-not-closed",
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
    "# Phase 130A Actions Node 24 Warning Cleanup Evidence",
    "",
    `- Phase: ${evidence.phase}`,
    `- Status: ${evidence.status}`,
    `- Generated at: ${evidence.generatedAt}`,
    `- Workflow: ${evidence.workflow.path}`,
    `- Actions Node 24 opt-in: ${evidence.workflow.actionsNode24OptIn}`,
    `- Node 20 opt-out present: ${evidence.workflow.node20OptOutPresent}`,
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
    "- This phase only opts GitHub JavaScript actions into the Node 24 runtime.",
    "- It does not deploy infrastructure, publish releases, publish packages, push images, or complete global release.",
    "- It must not record plaintext API keys.",
    "",
  ].join("\n");
}

await main();
