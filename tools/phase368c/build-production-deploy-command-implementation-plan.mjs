import { writeJson, writeText } from "../phase368-common.mjs";

const requirements = {
  phase: "Phase368C",
  requirements: [
    "explicit deployment target",
    "executable command",
    "no secret inline",
    "no .env dump",
    "no git reset --hard",
    "no git clean",
    "no destructive cleanup",
    "no unapproved provider call",
    "no real billing / invoice command",
    "rollback path",
    "post-deploy smoke",
    "monitoring hook",
    "logs redacted",
    "evidence written",
    "exit code captured",
    "timeout",
    "idempotency notes",
    "operator instructions",
  ],
};

const paths = [
  {
    path: "local_runtime_activation_only",
    productionDeploy: false,
    candidateCommands: ["pnpm start:pme", "pnpm dev:phase7b"],
    notes: "Suitable for local demonstration or internal runtime activation only.",
  },
  {
    path: "windows_service_deploy",
    productionDeploy: true,
    candidateCommands: ["service wrapper selection required", "NSSM / scheduled task / Windows service wrapper design only"],
    notes: "Requires human selection of service wrapper and install/update strategy.",
  },
  {
    path: "docker_compose_deploy",
    productionDeploy: true,
    candidateCommands: ["docker compose build", "docker compose up -d"],
    notes: "Files exist, but no approved production operator path is locked yet.",
  },
  {
    path: "vps_node_process_deploy",
    productionDeploy: true,
    candidateCommands: ["remote `pnpm install`", "remote `pnpm start:ai-gateway-service` or process manager wrapper"],
    notes: "Requires remote host, process supervisor, and remote operator instructions.",
  },
  {
    path: "github_actions_cicd",
    productionDeploy: true,
    candidateCommands: ["workflow-driven deploy adapter to be defined after target selection"],
    notes: "Requires remote repo, secrets, workflow selection, and human approval.",
  },
];

const result = {
  phase: "Phase368C",
  implementationPlanGenerated: true,
  deployCommandRequirementsGenerated: true,
  candidateImplementationPaths: paths.map((item) => item.path),
  selectedImplementationPath: null,
  requiresHumanTargetSelection: true,
  deployScriptImplemented: false,
  deployExecuted: false,
  secretValueExposed: false,
};

await writeText(
  "docs/phase368c-production-deploy-command-implementation-plan.md",
  [
    "# Phase368C Production Deploy Command Implementation Plan",
    "",
    "No implementation path is selected in this phase.",
    "",
    "Candidate paths:",
    ...paths.map((item) => `- ${item.path}: ${item.notes}`),
  ].join("\n"),
);
await writeJson("docs/phase368c-deploy-command-requirements.json", requirements);
await writeText(
  "docs/phase368c-deploy-script-acceptance-criteria.md",
  [
    "# Phase368C Deploy Script Acceptance Criteria",
    "",
    "- Must bind to one explicit deployment target.",
    "- Must produce redacted evidence and capture exit code.",
    "- Must define rollback path and post-deploy smoke path.",
    "- Must not inline secrets or dump environment values.",
    "- Must remain gated by final manual deploy execution confirmation.",
  ].join("\n"),
);
await writeText(
  "docs/phase368c-execution-report.md",
  [
    "# Phase368C Execution Report",
    "",
    "- implementation plan generated",
    "- deployScriptImplemented: false",
  ].join("\n"),
);
await writeJson(
  "apps/ai-gateway-service/evidence/phase368c/production-deploy-command-implementation-plan-result.json",
  result,
);

console.log(JSON.stringify(result, null, 2));
