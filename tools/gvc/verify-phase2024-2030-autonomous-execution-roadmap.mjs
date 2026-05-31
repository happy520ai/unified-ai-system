import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const paths = {
  roadmap: "docs/project-brain/gvc-autonomous-execution-roadmap.json",
  docs: "docs/phase2024-2030-gvc-autonomous-execution-roadmap.md",
  controlWriterApproval: "docs/approvals/gvc-runner-control-writer-approval-required.json",
  lowRiskExecutionApproval: "docs/approvals/gvc-autonomous-low-risk-real-execution-approval-required.json",
  providerBridgeApproval: "docs/approvals/gvc-provider-approval-bridge-approval-required.json",
  evidenceJson: "apps/ai-gateway-service/evidence/phase2024-2030-gvc-autonomous-execution-roadmap/roadmap-result.json",
  evidenceMd: "apps/ai-gateway-service/evidence/phase2024-2030-gvc-autonomous-execution-roadmap/roadmap-result.md",
};

const checks = [];

function check(id, condition, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const packageJson = readJson("package.json") ?? {};
const roadmap = readJson(paths.roadmap);
const docs = readText(paths.docs);
const controlWriterApproval = readJson(paths.controlWriterApproval);
const lowRiskApproval = readJson(paths.lowRiskExecutionApproval);
const providerApproval = readJson(paths.providerBridgeApproval);

check("roadmap_json_exists", existsSync(resolve(paths.roadmap)), paths.roadmap);
check("roadmap_phase_id", roadmap?.phaseId === "Phase2024-2030-GVC-Autonomous-Execution-Roadmap");
check("roadmap_phase_count", Array.isArray(roadmap?.phases) && roadmap.phases.length === 7);

const phases = new Map((roadmap?.phases ?? []).map((phase) => [phase.phaseId, phase]));
for (const phaseId of ["Phase2024", "Phase2025", "Phase2026", "Phase2027", "Phase2028", "Phase2029", "Phase2030"]) {
  check(`roadmap_contains_${phaseId}`, phases.has(phaseId));
}

check("phase2024_dry_run_only", phases.get("Phase2024")?.mode === "dry-run-design");
check("phase2025_approval_gated_real_control", phases.get("Phase2025")?.mode === "approval-gated-real-control-writer");
check("phase2025_not_enabled", phases.get("Phase2025")?.defaultEnabled === false);
check("phase2025_no_process_signal", phases.get("Phase2025")?.hardLimits?.processSignalAllowed === false);
check("phase2026_low_risk_real_candidate", phases.get("Phase2026")?.mode === "approval-gated-low-risk-real-execution");
check("phase2026_not_enabled", phases.get("Phase2026")?.defaultEnabled === false);
check("phase2026_max_mutations", phases.get("Phase2026")?.hardLimits?.maxMutationsPerLoop === 3);
check("phase2026_daily_limit", phases.get("Phase2026")?.hardLimits?.maxRealExecutionLoopsPerDay === 100);
check("phase2026_forbids_provider", phases.get("Phase2026")?.forbiddenOperations?.includes("provider_call"));
check("phase2026_forbids_secret", phases.get("Phase2026")?.forbiddenOperations?.includes("secret_read"));
check("phase2026_forbids_chat", phases.get("Phase2026")?.forbiddenOperations?.includes("chat_modify"));
check("phase2026_forbids_chat_gateway_execute", phases.get("Phase2026")?.forbiddenOperations?.includes("chat_gateway_execute_modify"));
check("phase2027_self_repair_limited", phases.get("Phase2027")?.hardLimits?.maxRepairAttempts === 2);
check("phase2028_auto_planner_dry_run", phases.get("Phase2028")?.mode === "dry-run-next-action-planner");
check("phase2029_health_monitor_dry_run", phases.get("Phase2029")?.mode === "dry-run-health-monitor");
check("phase2030_provider_bridge_dry_run", phases.get("Phase2030")?.mode === "provider-approval-bridge-design");
check("phase2030_provider_default_disabled", phases.get("Phase2030")?.defaultEnabled === false);

check("auto_rules_interval", roadmap?.autoExecutionRules?.intervalMs === 30000);
check("auto_rules_daily_loop_limit", roadmap?.autoExecutionRules?.dailyLoopLimit === 500);
check("auto_rules_max_auto_tasks", roadmap?.autoExecutionRules?.maxAutoTasksPerRun === 10);
check("auto_rules_idle_without_allowed", roadmap?.autoExecutionRules?.noAllowedTaskBehavior === "idle");
check("auto_rules_skip_approval_required", roadmap?.autoExecutionRules?.approvalRequiredBehavior === "skip_and_record");
check("auto_rules_consecutive_fail_stop", roadmap?.autoExecutionRules?.consecutiveVerifierFailureStop === 2);
check("auto_rules_risk_escalation_stop", roadmap?.autoExecutionRules?.riskEscalationBehavior === "stop");

check("global_no_raw_secret", roadmap?.globalSafety?.rawSecretReadAllowed === false);
check("global_no_api_key_output", roadmap?.globalSafety?.apiKeyOutputAllowed === false);
check("global_no_deploy", roadmap?.globalSafety?.deployAllowed === false);
check("global_no_commit", roadmap?.globalSafety?.commitAllowed === false);
check("global_no_workspace_clean_claim", roadmap?.globalSafety?.workspaceCleanClaimAllowed === false);
check("global_no_production_claim", roadmap?.globalSafety?.productionReadyClaimAllowed === false);
check("provider_stays_gated", roadmap?.gates?.provider === "separate_approval_required");
check("deploy_stays_gated", roadmap?.gates?.deploy === "separate_approval_required");
check("chat_route_stays_gated", roadmap?.gates?.chatRoute === "separate_approval_required");

check("control_writer_approval_exists", existsSync(resolve(paths.controlWriterApproval)), paths.controlWriterApproval);
check("control_writer_approval_status", controlWriterApproval?.status === "approval_required");
check("control_writer_approval_not_approved", controlWriterApproval?.approved === false);

check("low_risk_approval_exists", existsSync(resolve(paths.lowRiskExecutionApproval)), paths.lowRiskExecutionApproval);
check("low_risk_approval_status", lowRiskApproval?.status === "approval_required");
check("low_risk_approval_not_approved", lowRiskApproval?.approved === false);
check("low_risk_max_mutations", lowRiskApproval?.constraints?.maxMutationsPerLoop === 3);
check("low_risk_daily_limit", lowRiskApproval?.constraints?.maxRealExecutionLoopsPerDay === 100);
check("low_risk_forbids_provider", lowRiskApproval?.safety?.providerCallsMade === false);
check("low_risk_forbids_secret", lowRiskApproval?.safety?.secretRead === false);

check("provider_bridge_approval_exists", existsSync(resolve(paths.providerBridgeApproval)), paths.providerBridgeApproval);
check("provider_bridge_approval_status", providerApproval?.status === "approval_required");
check("provider_bridge_not_approved", providerApproval?.approved === false);
check("provider_bridge_real_call_false", providerApproval?.safety?.providerCallsMade === false);
check("provider_bridge_requires_credential_ref", providerApproval?.requiredFields?.includes("credentialRef"));
check("provider_bridge_max_requests_one", providerApproval?.constraints?.maxRequestsMustBeAtMost === 1);

check("docs_exists", existsSync(resolve(paths.docs)), paths.docs);
check("docs_phase_title", docs.includes("Phase2024-2030-GVC-Autonomous-Execution-Roadmap"));
check("docs_no_production_claim", docs.includes("No production ready claim"));
check("docs_phase2026_bounds", docs.includes("maxMutations<=3") && docs.includes("maxRealExecutionLoops<=100"));
check("docs_provider_gated", docs.includes("Provider remains approval-gated"));

check(
  "root_verify_script",
  packageJson.scripts?.["verify:phase2024-2030-gvc-autonomous-execution-roadmap"] ===
    "node tools/gvc/verify-phase2024-2030-autonomous-execution-roadmap.mjs",
);

const failedChecks = checks.filter((entry) => !entry.pass);
const result = {
  phaseId: "Phase2024-2030-GVC-Autonomous-Execution-Roadmap",
  status: failedChecks.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  completedPhases: failedChecks.length === 0 ? ["Phase2024", "Phase2025", "Phase2026", "Phase2027", "Phase2028", "Phase2029", "Phase2030"] : [],
  dryRunPhases: ["Phase2024", "Phase2028", "Phase2029", "Phase2030"],
  approvalGatedRealExecutionPhases: ["Phase2025", "Phase2026", "Phase2027"],
  autonomousMutationEnabled: false,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  productionReadyClaimed: false,
  workspaceCleanClaimed: false,
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
  completedPhases: result.completedPhases,
  autonomousMutationEnabled: result.autonomousMutationEnabled,
  providerCallsMade: result.providerCallsMade,
  secretRead: result.secretRead,
  deployExecuted: result.deployExecuted,
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
    "# Phase2024-2030 GVC Autonomous Execution Roadmap",
    "",
    `- status: ${data.status}`,
    `- blocker: ${data.blocker}`,
    `- completedPhases: ${data.completedPhases.join(", ")}`,
    `- dryRunPhases: ${data.dryRunPhases.join(", ")}`,
    `- approvalGatedRealExecutionPhases: ${data.approvalGatedRealExecutionPhases.join(", ")}`,
    `- autonomousMutationEnabled: ${data.autonomousMutationEnabled}`,
    `- providerCallsMade: ${data.providerCallsMade}`,
    `- secretRead: ${data.secretRead}`,
    `- deployExecuted: ${data.deployExecuted}`,
    `- chatGatewayExecuteModified: ${data.chatGatewayExecuteModified}`,
    `- recommendedSealed: ${data.recommendedSealed}`,
    "",
  ].join("\n");
}
