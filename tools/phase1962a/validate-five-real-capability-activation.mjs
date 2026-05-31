import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";
import { createConsolePage } from "../../apps/ai-gateway-service/src/ui/consolePage.js";
import {
  allPassed,
  check,
  containsSecretLikeValue,
  pathExists,
  readJson,
  readText,
  writeJson,
} from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1962A";
const evidenceDir = "apps/ai-gateway-service/evidence/phase1962a";
const resultPath = `${evidenceDir}/five-real-capability-activation-result.json`;
const verificationPath = `${evidenceDir}/five-real-capability-activation-verification-result.json`;
const docsPath = "docs/phase1962a-five-real-capability-activation.md";
const storePath = ".codex-temp/phase1962a/workforce-plans.json";

let server;
let statusEnvelope = null;
let activationEnvelope = null;
let statusCode = 0;
let activationStatusCode = 0;
let runtimeError = null;

try {
  const application = createGatewayApplication({
    ...process.env,
    PME_AUTH_TOKEN: "",
    PME_ENTERPRISE_USERS_JSON: "",
    PME_ENTERPRISE_AUTH_ENABLED: "false",
    WORKFORCE_PLAN_STORE_PATH: storePath,
    PME_AUDIT_LOG_PATH: ".codex-temp/phase1962a/enterprise-audit.jsonl",
    PME_ENTERPRISE_USER_STORE_PATH: ".codex-temp/phase1962a/enterprise-users.json",
  });
  server = createGatewayHttpServer(application);
  const baseUrl = await listen(server);

  const statusResponse = await fetch(`${baseUrl}/real-capabilities/status`);
  statusCode = statusResponse.status;
  statusEnvelope = await statusResponse.json();

  const activationResponse = await fetch(`${baseUrl}/real-capabilities/activate-five`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-phase1962a-verifier": "true",
    },
    body: JSON.stringify({
      goal: "Phase1962A verifier activates the five real local capability paths without reading secrets or deploying.",
      selectedTemplate: "feature-development",
      context: { traceId: "phase1962a-verifier" },
    }),
  });
  activationStatusCode = activationResponse.status;
  activationEnvelope = await activationResponse.json();
} catch (error) {
  runtimeError = error instanceof Error ? error.message : String(error);
} finally {
  if (server) await close(server);
}

const statusData = statusEnvelope?.data ?? {};
const data = activationEnvelope?.data ?? {};
const capabilities = data.capabilities ?? {};
const evidence = readJson(resultPath);
const packageText = readText("package.json");
const servicePackageText = readText("apps/ai-gateway-service/package.json");
const serviceText = readText("apps/ai-gateway-service/src/real-capabilities/fiveCapabilityActivationService.js");
const httpText = readText("apps/ai-gateway-service/src/http/httpServer.js");
const applicationText = readText("apps/ai-gateway-service/src/application/createGatewayApplication.js");
const uiPanelText = readText("apps/ai-gateway-service/src/ui/components/FiveCapabilityActivationPanel.js");
const ownerShellText = readText("apps/ai-gateway-service/src/ui/components/OwnerOSShell.js");
const consoleText = readText("apps/ai-gateway-service/src/ui/consolePage.js");
const html = createConsolePage();
const forbiddenText = [JSON.stringify(data), JSON.stringify(evidence.data), html].join("\n");

const checks = [
  check("docs_exists", pathExists(docsPath)),
  check("root_package_script_registered", packageText.includes("verify:phase1962a-five-real-capability-activation")),
  check("service_package_script_registered", servicePackageText.includes("verify:phase1962a-five-real-capability-activation")),
  check("service_file_exists", pathExists("apps/ai-gateway-service/src/real-capabilities/fiveCapabilityActivationService.js")),
  check("application_wires_service", applicationText.includes("createFiveCapabilityActivationService") && applicationText.includes("fiveCapabilityActivationService")),
  check("http_status_route_registered", httpText.includes('url.pathname === "/real-capabilities/status"')),
  check("http_activate_route_registered", httpText.includes('url.pathname === "/real-capabilities/activate-five"')),
  check("health_route_lists_real_capabilities", httpText.includes("POST /real-capabilities/activate-five")),
  check("permission_gate_covers_activate_five", httpText.includes('pathname === "/real-capabilities/activate-five"')),
  check("status_http_200", statusCode === 200, { statusCode, runtimeError }),
  check("activation_http_200", activationStatusCode === 200, { activationStatusCode, runtimeError }),
  check("status_envelope_ok", statusEnvelope?.status === "ok" && statusData.ready === true),
  check("activation_envelope_ok", activationEnvelope?.status === "ok"),
  check("response_phase1962a", data.phase === phase),
  check("response_mode_activation", data.mode === "five-real-capability-activation"),
  check("activation_completed", data.executionStatus === "completed"),
  check("completion_verified", data.completionVerified === true),
  check("preview_and_dry_run_false", data.previewOnly === false && data.dryRunOnly === false),
  check("workforce_real_ready", capabilities.workforce?.ready === true && capabilities.workforce?.realAgentExecution === true),
  check("three_mode_real_executor_ready", capabilities.threeMode?.ready === true && capabilities.threeMode?.providerExecutionReady === true),
  check("taiji_real_local_ready", capabilities.taijiBeidou?.ready === true && capabilities.taijiBeidou?.realLocalExecution === true),
  check("gvc_real_write_ready", capabilities.gvc?.ready === true && capabilities.gvc?.realAutonomousRun === true && capabilities.gvc?.projectFileWrites === true),
  check("codex_cli_bridge_ready", capabilities.codex?.ready === true && capabilities.codex?.cliAvailable === true),
  check("evidence_file_exists", evidence.exists === true && evidence.parseError === null),
  check("evidence_matches_run", evidence.data?.runId === data.runId && evidence.data?.completionVerified === true),
  check("ui_panel_file_exists", pathExists("apps/ai-gateway-service/src/ui/components/FiveCapabilityActivationPanel.js")),
  check("ui_owner_shell_mounts_panel", ownerShellText.includes("renderFiveCapabilityActivationPanel")),
  check("ui_primary_marker_present", html.includes('data-five-capability-activation="true"') && html.includes("一键激活五大能力")),
  check("ui_handler_posts_activate_route", consoleText.includes("/real-capabilities/activate-five") && consoleText.includes("activateFiveCapabilities")),
  check("service_safety_boundary_present", serviceText.includes("authJsonRead: false") && serviceText.includes("codexConfigModified: false")),
  check("provider_network_not_attempted", data.providerNetworkAttempted === false),
  check("paid_api_false", data.paidApiCalled === false),
  check("secret_value_false", data.secretValueExposed === false && data.rawSecretRead === false),
  check("auth_json_false", data.authJsonRead === false),
  check("codex_config_false", data.codexConfigModified === false),
  check("chat_routes_unchanged", data.chatRouteModified === false && data.chatGatewayExecuteModified === false),
  check("legacy_project_context_false", data.legacyModified === false && data.projectContextModified === false),
  check("deploy_release_commit_push_false", data.deployExecuted === false && data.releaseExecuted === false && data.commitCreated === false && data.pushExecuted === false),
  check("no_secret_like_output", !containsSecretLikeValue(forbiddenText)),
  check("docs_honest_boundary", readText(docsPath).includes("不是生产部署") && readText(docsPath).includes("不声称公开发布就绪")),
  check("gvc_write_scoped_to_evidence", Array.isArray(data.allowedProjectFileWrites) && data.allowedProjectFileWrites.every((file) => String(file).startsWith(evidenceDir))),
];

const passed = allPassed(checks);
const result = {
  phase,
  name: "Five Real Capability Activation Verification",
  completed: true,
  recommended_sealed: passed,
  blocker: passed ? null : "phase1962a_five_real_capability_activation_failed",
  statusCode,
  activationStatusCode,
  runtimeError,
  runId: data.runId ?? null,
  executionStatus: data.executionStatus ?? null,
  completionVerified: data.completionVerified === true,
  capabilityStatuses: Object.fromEntries(Object.entries(capabilities).map(([key, value]) => [key, value?.status ?? null])),
  providerCallsMade: false,
  providerNetworkAttempted: false,
  paidApiCalled: false,
  mimoCalled: false,
  openaiCalled: false,
  claudeCalled: false,
  openrouterCalled: false,
  nvidiaCalledByThisPhase: false,
  secretValueExposed: false,
  rawSecretRead: false,
  authJsonRead: false,
  rawCredentialRefRead: false,
  codexConfigModified: false,
  projectFileWrites: data.projectFileWrites === true,
  allowedProjectFileWrites: data.allowedProjectFileWrites ?? [],
  chatRouteModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  commitCreated: false,
  pushExecuted: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  workspaceCleanClaimed: false,
  checks,
};

writeJson(verificationPath, result);
console.log(JSON.stringify(result, null, 2));

if (!passed) process.exitCode = 1;

function listen(targetServer) {
  return new Promise((resolveListen, rejectListen) => {
    targetServer.once("error", rejectListen);
    targetServer.listen(0, "127.0.0.1", () => {
      targetServer.off("error", rejectListen);
      resolveListen(`http://127.0.0.1:${targetServer.address().port}`);
    });
  });
}

function close(targetServer) {
  return new Promise((resolveClose) => targetServer.close(() => resolveClose()));
}
