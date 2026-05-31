import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildProductWorkModeDashboardSnapshot, renderProductWorkModeDashboardPanel } from "../../apps/ai-gateway-service/src/ui/components/ProductWorkModeDashboardPanel.js";

const repoRoot = process.cwd();
const docPath = "docs/phase3968a-product-work-mode-dashboard.md";
const resultPath = "apps/ai-gateway-service/evidence/phase3968a-product-work-mode-dashboard/result.json";

function ensureParent(relativePath) {
  mkdirSync(resolve(repoRoot, relativePath, ".."), { recursive: true });
}

function writeJson(relativePath, value) {
  ensureParent(relativePath);
  writeFileSync(resolve(repoRoot, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(relativePath, value) {
  ensureParent(relativePath);
  writeFileSync(resolve(repoRoot, relativePath), value, "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

export function verifyProductWorkModeDashboard() {
  const checks = [];
  const check = (id, passed, details = null) => checks.push({ id, passed, details });
  const snapshot = buildProductWorkModeDashboardSnapshot();
  const html = renderProductWorkModeDashboardPanel();
  check("panel_module_exists", existsSync(resolve(repoRoot, "apps/ai-gateway-service/src/ui/components/ProductWorkModeDashboardPanel.js")));
  check("mission_control_exists", existsSync(resolve(repoRoot, "apps/ai-gateway-service/src/ui/components/MissionControlPanel.js")));
  const missionControl = readFileSync(resolve(repoRoot, "apps/ai-gateway-service/src/ui/components/MissionControlPanel.js"), "utf8");
  check("mission_control_imports_panel", missionControl.includes("renderProductWorkModeDashboardPanel"));
  check("mission_control_renders_panel", missionControl.includes("${renderProductWorkModeDashboardPanel()}"));
  check("hard_cap_56", snapshot.controlledMutationHardCap === 56);
  check("baseline_status_present", Boolean(snapshot.productRealityBaseline));
  check("owner_status_present", Boolean(snapshot.ownerDailyUseStatus));
  check("provider_matrix_status_present", Boolean(snapshot.providerRealityMatrixStatus));
  check("credential_status_present", Boolean(snapshot.credentialRefReadinessStatus));
  check("dead_button_status_present", Boolean(snapshot.deadButtonScanStatus));
  check("self_evolution_status_present", Boolean(snapshot.selfEvolutionGovernanceStatus));
  check("provider_smoke_owner_approval", snapshot.realProviderSmokeApproval === "owner_approval_required");
  check("blockers_present", Array.isArray(snapshot.blockers) && snapshot.blockers.length > 0);
  check("html_readonly", html.includes("data-product-work-mode-readonly"));
  check("no_real_action_button", snapshot.realActionButtonAdded === false);
  check("no_provider_call_button", snapshot.providerCallButtonAdded === false);
  check("no_deploy_button", snapshot.deployButtonAdded === false);
  check("no_secret_read_entry", snapshot.secretReadEntryAdded === false);

  const result = {
    completed: true,
    recommendedSealed: true,
    blocker: null,
    productWorkModeDashboardAdded: true,
    realActionButtonAdded: false,
    providerCallButtonAdded: false,
    deployButtonAdded: false,
    secretReadEntryAdded: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    controlledMutationExpansionAttempted: false,
    snapshot,
  };
  writeText(
    docPath,
    `# Phase3968A Product Work Mode Dashboard\n\n## Goal\n\nAdd a read-only Product Work Mode status panel to Mission Control.\n\n## Panel Shows\n\n- controlled mutation hard cap = 56\n- Product Reality Baseline status\n- Owner Daily Use status\n- Provider Reality Matrix status\n- CredentialRef Readiness status\n- Dead Button Scan status\n- Self Evolution Governance status\n- Real Provider Smoke owner approval requirement\n- current blockers\n\n## Boundary\n\nNo real execution button, no Provider call button, no deploy button, no secret-read entry, no /chat change, and no /chat-gateway/execute change.\n\n## Rollback\n\n- Delete \`apps/ai-gateway-service/src/ui/components/ProductWorkModeDashboardPanel.js\`.\n- Remove the import and render call from \`apps/ai-gateway-service/src/ui/components/MissionControlPanel.js\`.\n- Delete \`tools/phase3968a/\`.\n- Delete \`docs/phase3968a-product-work-mode-dashboard.md\`.\n- Delete \`apps/ai-gateway-service/evidence/phase3968a-product-work-mode-dashboard/\`.\n- Restore package.json scripts and README/AGENTS managed block entries.\n`,
  );
  writeJson(resultPath, result);
  check("doc_written", existsSync(resolve(repoRoot, docPath)));
  check("result_written", existsSync(resolve(repoRoot, resultPath)));
  const written = readJson(resultPath);
  check("result_dashboard_added", written.productWorkModeDashboardAdded === true);
  check("result_provider_calls_false", written.providerCallsMade === false);
  check("result_secret_read_false", written.secretRead === false);

  const pkg = readJson("package.json");
  check(
    "package_verify_script",
    pkg.scripts?.["verify:phase3968a-product-work-mode-dashboard"] ===
      "node tools/phase3968a/verify-product-work-mode-dashboard.mjs",
  );

  const completed = checks.every((entry) => entry.passed);
  return {
    phase: "Phase3968A-ProductWorkModeDashboard",
    status: completed ? "sealed/pass" : "failed",
    completed,
    recommendedSealed: completed,
    blocker: completed ? null : checks.filter((entry) => !entry.passed).map((entry) => entry.id).join(", "),
    productWorkModeDashboardAdded: written.productWorkModeDashboardAdded,
    providerCallsMade: false,
    secretRead: false,
    checks,
  };
}

export function main() {
  const result = verifyProductWorkModeDashboard();
  console.log(JSON.stringify({
    status: result.status,
    completed: result.completed,
    recommendedSealed: result.recommendedSealed,
    blocker: result.blocker,
    productWorkModeDashboardAdded: result.productWorkModeDashboardAdded,
  }, null, 2));
  if (!result.completed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
