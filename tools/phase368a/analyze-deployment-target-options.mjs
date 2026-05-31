import {
  containsSecretLikeText,
  exists,
  hasExplicitDeploySignal,
  loadPackageScripts,
  walkRelativeFiles,
  writeJson,
  writeText,
} from "../phase368-common.mjs";

const packageFiles = [
  "package.json",
  "apps/ai-gateway-service/package.json",
  "apps/agent-console/package.json",
  "packages/shared-config/package.json",
  "packages/shared-contracts/package.json",
  "packages/shared-sdk/package.json",
  "packages/shared-utils/package.json",
];

const packageScripts = [];
for (const file of packageFiles) {
  if (await exists(file)) {
    packageScripts.push(await loadPackageScripts(file));
  }
}

const windowsFiles = await walkRelativeFiles("tools/windows");
const workflowFiles = (await walkRelativeFiles(".github")).filter((file) => file.startsWith(".github/workflows/"));
const dockerFiles = (await walkRelativeFiles(".")).filter((file) => {
  const lowered = file.toLowerCase();
  return lowered === "dockerfile" || lowered.endsWith("/dockerfile") || lowered === "docker-compose.yml" || lowered === "docker-compose.yaml";
});
const deploymentDocs = (await walkRelativeFiles("docs")).filter((file) => {
  const lowered = file.toLowerCase();
  return lowered.includes("deploy") || lowered.includes("release") || lowered.includes("runtime");
});

const allScriptEntries = packageScripts.flatMap((pkg) =>
  Object.entries(pkg.scripts).map(([name, command]) => ({
    packagePath: pkg.packagePath,
    packageName: pkg.packageName,
    scriptName: name,
    command,
  })),
);

const explicitDeployScripts = allScriptEntries.filter(
  (entry) => hasExplicitDeploySignal(entry.scriptName) || hasExplicitDeploySignal(entry.command),
);
const explicitReleaseScripts = allScriptEntries.filter(
  (entry) => /\brelease\b/i.test(entry.scriptName) || /\brelease\b/i.test(entry.command),
);
const dockerDeploySignals = dockerFiles.length > 0;

const candidateTargets = [
  {
    target: "local_runtime_activation",
    available: true,
    evidence: ["pnpm start:pme", "pnpm dev:phase7b", "pnpm start:ai-gateway-service", "pnpm start:agent-console"],
    classification: "not_production_deploy",
  },
  {
    target: "windows_service",
    available: windowsFiles.length > 0,
    evidence: windowsFiles,
    classification: "design_only_until_service_wrapper_selected",
  },
  {
    target: "docker_compose",
    available: dockerFiles.some((file) => file.endsWith("docker-compose.yml") || file.endsWith("docker-compose.yaml")),
    evidence: dockerFiles,
    classification: "deploy_candidate_requires_human_target_selection",
  },
  {
    target: "vps_node_process",
    available: true,
    evidence: ["apps/ai-gateway-service/package.json:start", "apps/agent-console/package.json:start"],
    classification: "deploy_candidate_requires_remote_host_and_operator_plan",
  },
  {
    target: "github_actions_cicd",
    available: workflowFiles.length > 0,
    evidence: workflowFiles,
    classification: "cicd_candidate_requires_remote_secrets_and_workflow_selection",
  },
  {
    target: "internal_test_environment",
    available: true,
    evidence: ["docs/ENTERPRISE_DEPLOYMENT_RUNBOOK.md", "docs/DEPLOYMENT_AND_RUNTIME_STABILITY_HARDENING.md"],
    classification: "environment_candidate_requires_human_target_selection",
  },
  {
    target: "release_artifact_only",
    available: true,
    evidence: deploymentDocs.filter((file) => file.toLowerCase().includes("release")),
    classification: "not_runtime_deploy",
  },
];

const result = {
  phase: "Phase368A",
  deploymentTargetAnalysisExecuted: true,
  existingDeployScriptFound: explicitDeployScripts.length > 0,
  existingReleaseScriptFound: explicitReleaseScripts.length > 0,
  existingDockerDeployScriptFound: false,
  candidateTargets: candidateTargets.map((item) => item.target),
  recommendedTarget: null,
  requiresHumanTargetSelection: true,
  deployExecuted: false,
  secretValueExposed: false,
};

const optionsJson = {
  phase: "Phase368A",
  scannedPackageScripts: packageScripts,
  windowsFiles,
  workflowFiles,
  dockerFiles,
  deploymentDocs,
  explicitDeployScripts,
  explicitReleaseScripts,
  candidateTargets,
  safety: {
    secretValueIncluded: containsSecretLikeText({
      packageScripts,
      windowsFiles,
      workflowFiles,
      dockerFiles,
      deploymentDocs,
    }),
    deployExecuted: false,
  },
};

await writeJson("docs/phase368a-deployment-target-options.json", optionsJson);
await writeText(
  "docs/phase368a-deployment-target-decision-matrix.md",
  [
    "# Phase368A Deployment Target Decision Matrix",
    "",
    "| Target | Available | Notes |",
    "| --- | --- | --- |",
    ...candidateTargets.map(
      (item) =>
        `| ${item.target} | ${item.available} | ${item.classification} |`,
    ),
  ].join("\n"),
);
await writeText(
  "docs/phase368a-deploy-adapter-decision-report.md",
  [
    "# Phase368A Deploy Adapter Decision Report",
    "",
    `- existingDeployScriptFound: ${result.existingDeployScriptFound}`,
    `- existingReleaseScriptFound: ${result.existingReleaseScriptFound}`,
    `- existingDockerDeployScriptFound: ${result.existingDockerDeployScriptFound}`,
    "- recommendedTarget: none",
    "- requiresHumanTargetSelection: true",
    "",
    "Current conclusion: the repository has runtime start/build/verify surfaces and deployment-related files, but no approved executable production deploy commandRef for Phase365D.",
  ].join("\n"),
);
await writeText(
  "docs/phase368a-execution-report.md",
  [
    "# Phase368A Execution Report",
    "",
    "- deployment target analysis executed",
    "- no production deploy executed",
  ].join("\n"),
);
await writeJson(
  "apps/ai-gateway-service/evidence/phase368a/deployment-target-options-result.json",
  result,
);

console.log(JSON.stringify(result, null, 2));
