import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const paths = {
  approval: "docs/approvals/gvc-low-risk-autonomous-mutation-approval.json",
  executor: "tools/gvc/low-risk-autonomous-executor.mjs",
  docs: "docs/phase2031-2032-gvc-low-risk-autonomous-mutation.md",
  evidenceJson: "apps/ai-gateway-service/evidence/phase2031-2032-gvc-low-risk-autonomous-mutation/low-risk-autonomous-mutation-result.json",
  evidenceMd: "apps/ai-gateway-service/evidence/phase2031-2032-gvc-low-risk-autonomous-mutation/low-risk-autonomous-mutation-result.md",
};

const checks = [];

function check(id, condition, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const packageJson = readJson("package.json") ?? {};
const approval = readJson(paths.approval);
const docs = readText(paths.docs);

check("approval_file_exists", existsSync(resolve(paths.approval)), paths.approval);
check("approval_approved_true", approval?.approved === true);
check("approval_scope_low_risk_only", approval?.scope === "low_risk_only");
check("approval_allow_docs", approval?.allowDocs === true);
check("approval_allow_evidence", approval?.allowEvidence === true);
check("approval_allow_verifier", approval?.allowVerifier === true);
check("approval_allow_non_core_ui", approval?.allowNonCoreUi === true);
check("approval_allow_package_scripts", approval?.allowPackageScripts === true);
check("approval_max_mutations", approval?.maxMutationsPerLoop === 3);
check("approval_daily_limit", approval?.dailyRealExecutionLoopLimit === 100);
check("approval_rollback_required", approval?.rollbackRequired === true);
check("approval_provider_blocked", approval?.providerAllowed === false);
check("approval_secret_blocked", approval?.secretReadAllowed === false);
check("approval_deploy_blocked", approval?.deployAllowed === false);
check("approval_chat_route_blocked", approval?.chatRouteModificationAllowed === false);
check("approval_legacy_blocked", approval?.legacyModificationAllowed === false);
check("approval_project_context_blocked", approval?.projectContextModificationAllowed === false);

check("executor_exists", existsSync(resolve(paths.executor)), paths.executor);

let executorModule = null;
if (existsSync(resolve(paths.executor))) {
  try {
    executorModule = await import(`file:///${resolve(paths.executor).replaceAll("\\", "/")}?v=${Date.now()}`);
  } catch (error) {
    check("executor_imports", false, error.message);
  }
}
if (executorModule) {
  check("executor_imports", true);
  check("executor_exports_execute", typeof executorModule.executeLowRiskMutationPlan === "function");
  check("executor_exports_validate", typeof executorModule.validateLowRiskMutationPlan === "function");
}

let allowedRun = null;
let rollbackRun = null;
let forbiddenRun = null;
let riskRun = null;
if (executorModule?.executeLowRiskMutationPlan) {
  const fixtureRoot = path.join(repoRoot, ".codex-temp", "phase2031-2032-low-risk-fixture");
  rmSync(fixtureRoot, { recursive: true, force: true });
  mkdirSync(path.join(fixtureRoot, "docs"), { recursive: true });
  mkdirSync(path.join(fixtureRoot, "apps/ai-gateway-service/evidence/test"), { recursive: true });
  mkdirSync(path.join(fixtureRoot, "tools/gvc"), { recursive: true });
  mkdirSync(path.join(fixtureRoot, "legacy"), { recursive: true });
  writeFileSync(path.join(fixtureRoot, "docs/phase-test.md"), "before\n", "utf8");
  writeFileSync(path.join(fixtureRoot, "docs/phase-rollback.md"), "before\n", "utf8");
  writeFileSync(path.join(fixtureRoot, "legacy/blocked.txt"), "before\n", "utf8");
  writeFileSync(path.join(fixtureRoot, "PROJECT_CONTEXT.md"), "before\n", "utf8");

  allowedRun = await executorModule.executeLowRiskMutationPlan({
    repoRoot: fixtureRoot,
    approval,
    plan: {
      planId: "phase2031-allowed-doc-evidence-verifier",
      mutations: [
        { type: "write_file", path: "docs/phase-test.md", content: "after\n" },
        { type: "write_file", path: "apps/ai-gateway-service/evidence/test/mutation.json", content: "{\n  \"ok\": true\n}\n" },
        { type: "write_file", path: "tools/gvc/fixture-verifier.mjs", content: "console.log('ok');\n" },
      ],
      verifierCommands: [
        {
          command: process.execPath,
          args: ["-e", "process.exit(0)"],
        },
      ],
    },
    evidenceDir: "apps/ai-gateway-service/evidence/test",
  });

  rollbackRun = await executorModule.executeLowRiskMutationPlan({
    repoRoot: fixtureRoot,
    approval,
    plan: {
      planId: "phase2031-rollback-doc",
      mutations: [{ type: "write_file", path: "docs/phase-rollback.md", content: "broken\n" }],
      verifierCommands: [
        {
          command: process.execPath,
          args: ["-e", "process.exit(7)"],
        },
      ],
    },
    evidenceDir: "apps/ai-gateway-service/evidence/test",
  });

  forbiddenRun = await executorModule.executeLowRiskMutationPlan({
    repoRoot: fixtureRoot,
    approval,
    plan: {
      planId: "phase2031-forbidden-legacy",
      mutations: [{ type: "write_file", path: "legacy/blocked.txt", content: "after\n" }],
      verifierCommands: [],
    },
    evidenceDir: "apps/ai-gateway-service/evidence/test",
  });

  riskRun = await executorModule.executeLowRiskMutationPlan({
    repoRoot: fixtureRoot,
    approval,
    plan: {
      planId: "phase2031-provider-risk",
      mutations: [{ type: "write_file", path: "docs/phase-provider-risk.md", content: "after\n" }],
      operations: ["provider_call", "secret_read", "deploy", "chat_modify", "chat_gateway_execute_modify"],
      verifierCommands: [],
    },
    evidenceDir: "apps/ai-gateway-service/evidence/test",
  });

  check("allowed_mutation_test_passed", allowedRun.status === "passed");
  check("allowed_mutation_count_limited", allowedRun.mutationCount === 3);
  check("allowed_plan_written", existsSync(path.join(fixtureRoot, allowedRun.planEvidencePath || "")));
  check("allowed_evidence_written", existsSync(path.join(fixtureRoot, allowedRun.mutationEvidencePath || "")));
  check("allowed_real_write_performed", allowedRun.realWritePerformed === true);
  check("rollback_simulation_blocked", rollbackRun.status === "rolled_back");
  check("rollback_restored_file", readFileSync(path.join(fixtureRoot, "docs/phase-rollback.md"), "utf8") === "before\n");
  check("rollback_evidence_written", existsSync(path.join(fixtureRoot, rollbackRun.mutationEvidencePath || "")));
  check("forbidden_path_blocked", forbiddenRun.status === "blocked");
  check("forbidden_path_not_modified", readFileSync(path.join(fixtureRoot, "legacy/blocked.txt"), "utf8") === "before\n");
  check("risk_operations_blocked", riskRun.status === "blocked");
  check("provider_secret_deploy_chat_blocked", riskRun.blocker === "forbidden_operation_detected");
}

check("docs_exists", existsSync(resolve(paths.docs)), paths.docs);
check("docs_title", docs.includes("Phase2031-2032-GVC-Low-Risk-Autonomous-Mutation"));
check("docs_real_scope", docs.includes("low-risk autonomous mutation"));
check("docs_rollback", docs.includes("rollback"));
check("docs_forbidden_paths", docs.includes("legacy/") && docs.includes("PROJECT_CONTEXT.md"));
check("docs_no_provider", docs.includes("Provider") && docs.includes("blocked"));

check(
  "root_verify_script",
  packageJson.scripts?.["verify:phase2031-2032-gvc-low-risk-autonomous-mutation"] ===
    "node tools/gvc/verify-phase2031-2032-low-risk-autonomous-mutation.mjs",
);

const failedChecks = checks.filter((entry) => !entry.pass);
const result = {
  phaseId: "Phase2031-2032-GVC-Low-Risk-Autonomous-Mutation",
  status: failedChecks.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  approvalPresent: approval?.approved === true,
  autonomousMutationEnabled: failedChecks.length === 0,
  realMutationScope: ["docs", "evidence", "verifier", "tools/gvc", "tools/phase*", "package scripts", "non-core read-only UI"],
  testMutationFiles: allowedRun?.mutatedFiles ?? [],
  mutationPlanGenerated: Boolean(allowedRun?.planEvidencePath),
  mutationEvidenceGenerated: Boolean(allowedRun?.mutationEvidencePath),
  rollbackSimulationPassed: rollbackRun?.status === "rolled_back",
  forbiddenPathBlockingPassed: forbiddenRun?.status === "blocked",
  providerSecretDeployChatRouteBlocked: riskRun?.status === "blocked",
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  commitCreated: false,
  pushExecuted: false,
  workspaceCleanClaimed: false,
  productionReadyClaimed: false,
  recommendedSealed: failedChecks.length === 0,
  blocker: failedChecks.length === 0 ? "none" : failedChecks.map((entry) => entry.id).join(", "),
  evidenceRefs: paths,
  checks,
};

mkdirSync(path.dirname(resolve(paths.evidenceJson)), { recursive: true });
writeFileSync(resolve(paths.evidenceJson), `${JSON.stringify(result, null, 2)}\n`, "utf8");
writeFileSync(resolve(paths.evidenceMd), renderMarkdown(result), "utf8");

console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  approvalPresent: result.approvalPresent,
  autonomousMutationEnabled: result.autonomousMutationEnabled,
  rollbackSimulationPassed: result.rollbackSimulationPassed,
  providerSecretDeployChatRouteBlocked: result.providerSecretDeployChatRouteBlocked,
}, null, 2));

if (failedChecks.length > 0) {
  process.exit(1);
}

function resolve(relativePath) {
  return path.join(repoRoot, relativePath);
}

function readJson(relativePath) {
  const filePath = resolve(relativePath);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

function readText(relativePath) {
  const filePath = resolve(relativePath);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function renderMarkdown(data) {
  return [
    "# Phase2031-2032 GVC Low-Risk Autonomous Mutation",
    "",
    `- status: ${data.status}`,
    `- blocker: ${data.blocker}`,
    `- approvalPresent: ${data.approvalPresent}`,
    `- autonomousMutationEnabled: ${data.autonomousMutationEnabled}`,
    `- mutationPlanGenerated: ${data.mutationPlanGenerated}`,
    `- mutationEvidenceGenerated: ${data.mutationEvidenceGenerated}`,
    `- rollbackSimulationPassed: ${data.rollbackSimulationPassed}`,
    `- forbiddenPathBlockingPassed: ${data.forbiddenPathBlockingPassed}`,
    `- providerSecretDeployChatRouteBlocked: ${data.providerSecretDeployChatRouteBlocked}`,
    `- providerCallsMade: ${data.providerCallsMade}`,
    `- secretRead: ${data.secretRead}`,
    `- deployExecuted: ${data.deployExecuted}`,
    `- chatGatewayExecuteModified: ${data.chatGatewayExecuteModified}`,
    `- recommendedSealed: ${data.recommendedSealed}`,
    "",
  ].join("\n");
}
