import { readJson, check } from "../phase1903a/ownerAutomationSealCommon.mjs";

const result =
  readJson("apps/ai-gateway-service/evidence/phase1930a/world-class-hardening-final-gate-result.json").data ?? {};
const phaseFlags = [
  "phase1920aCompleted",
  "phase1921aCompleted",
  "phase1922aCompleted",
  "phase1923aCompleted",
  "phase1924aCompleted",
  "phase1925aCompleted",
  "phase1926aCompleted",
  "phase1927aCompleted",
  "phase1928aCompleted",
  "phase1929aCompleted",
];
const checks = [
  check("completed", result.completed === true),
  check("sealed", result.recommended_sealed === true),
  check("blocker", result.blocker === "owner_pilot_and_real_provider_authorization_still_required"),
  check("phase_flags", phaseFlags.every((flag) => result[flag] === true)),
  check("owner_pilot_required", result.ownerPilotRequired === true),
  check("provider_auth_required", result.realProviderAuthorizationRequired === true),
  check("non_claims", result.productionReadyClaimed === false && result.publicLaunchReadyClaimed === false && result.commercialReadyClaimed === false),
  check("provider_false", result.providerCallsMade === false),
  check("secret_false", result.secretValueExposed === false && result.rawSecretRead === false && result.authJsonRead === false),
  check("deploy_release_false", result.deployExecuted === false && result.releaseExecuted === false && result.tagCreated === false && result.artifactUploaded === false),
  check("chat_gateway_execute_false", result.chatGatewayExecuteModified === false),
  check("legacy_project_context_false", result.legacyModified === false && result.projectContextModified === false),
  check("workspace_clean_false", result.workspaceCleanClaimed === false),
];
const passed = checks.every((item) => item.passed);
console.log(JSON.stringify({ ...result, completed: passed, recommended_sealed: passed, checks }, null, 2));
if (!passed) process.exitCode = 1;
