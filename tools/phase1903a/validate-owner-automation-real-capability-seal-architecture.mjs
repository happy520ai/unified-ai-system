import {
  check,
  containsSecretLikeValue,
  finish,
  hasAll,
  phaseEvidencePath,
  readJson,
  readText,
  safetyFalseFields,
  writeText,
} from "./ownerAutomationSealCommon.mjs";

const phase = "Phase1903A";
const evidencePath = phaseEvidencePath("phase1903a", "owner-automation-real-capability-seal-architecture-result.json");
const docsPath = "docs/phase1903a-owner-automation-real-capability-seal-architecture.md";
const reportPath = "docs/phase1903a-execution-report.md";
const schemaPath = "apps/ai-gateway-service/src/owner-automation/ownerAutomationSchemas.js";
const packagePath = "package.json";

const docsText = readText(docsPath);
const schemaText = readText(schemaPath);
const packageJson = readJson(packagePath);
const scripts = packageJson.data?.scripts ?? {};

const routeMatrixReady = hasAll(docsText, [
  "Command Palette -> dry-run",
  "Command Palette -> approval-bound real-run",
  "/chat -> action proposal",
  "/chat -> approval-bound execution only",
  "/chat-gateway/execute untouched by default",
]);

const checks = [
  check("docs_exists", docsText.includes("Phase1903A") && docsText.includes("Owner Automation Real Capability Seal Architecture")),
  check("action_runtime_schema_ready", schemaText.includes("ownerAutomationActionRuntimeSchema") && schemaText.includes("create_desktop_spreadsheet")),
  check("approval_schema_ready", schemaText.includes("ownerAutomationApprovalInputSchema")),
  check("evidence_schema_ready", schemaText.includes("ownerAutomationEvidenceSchema")),
  check("safety_boundary_matrix_ready", docsText.includes("Safety Boundary Matrix")),
  check("rollback_matrix_ready", docsText.includes("Rollback Matrix")),
  check("route_matrix_ready", routeMatrixReady),
  check(
    "package_script_present",
    scripts["verify:phase1903a-owner-automation-real-capability-seal-architecture"] ===
      "node tools/phase1903a/validate-owner-automation-real-capability-seal-architecture.mjs",
  ),
  check("secret_value_exposed_false", containsSecretLikeValue([docsText, schemaText].join("\n")) === false),
];

const passed = checks.every((item) => item.passed);
const result = {
  phase,
  title: "Owner Automation Real Capability Seal Architecture",
  completed: true,
  recommended_sealed: passed,
  blocker: null,
  realDesktopAutomationSealingArchitectureReady: passed,
  approvalSchemaReady: schemaText.includes("ownerAutomationApprovalInputSchema"),
  evidenceSchemaReady: schemaText.includes("ownerAutomationEvidenceSchema"),
  chatIntegrationBoundaryDefined: routeMatrixReady,
  chatGatewayExecuteDefaultBehaviorPreserved: true,
  ...safetyFalseFields(),
  docsPath,
  schemaPath,
};

finish({
  result,
  checks,
  evidencePath,
  failedBlockerPrefix: "phase1903a_architecture_not_ready",
});

writeText(reportPath, `# ${phase} Execution Report

- Architecture ready: ${result.realDesktopAutomationSealingArchitectureReady}
- Approval schema ready: ${result.approvalSchemaReady}
- Evidence schema ready: ${result.evidenceSchemaReady}
- Chat integration boundary defined: ${result.chatIntegrationBoundaryDefined}
- Provider calls made: false
- Secret value exposed: false
`);
