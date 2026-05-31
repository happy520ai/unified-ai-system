import { pathExists, readJson, check } from "../phase1903a/ownerAutomationSealCommon.mjs";

const result = readJson("apps/ai-gateway-service/evidence/phase1920a/owner-dogfooding-intake-result.json").data ?? {};
const precondition =
  readJson("apps/ai-gateway-service/evidence/phase1920_1930a/precondition-check-result.json").data ?? {};

const checks = [
  check("precondition_allow_execution", precondition.allowExecution === true),
  check("phase1914a_manifest_gate", precondition.phase1914aPersistentManifestCheck === true),
  check("docs_exist", pathExists("docs/phase1920a-owner-dogfooding-intake-hardening.md")),
  check("daily_template_exists", pathExists("local-self-use/v1/owner-dogfooding/owner-daily-dogfooding.input.json.template")),
  check("weekly_template_exists", pathExists("local-self-use/v1/owner-dogfooding/owner-weekly-review.input.json.template")),
  check("completed_true", result.completed === true),
  check("recommended_sealed_true", result.recommended_sealed === true),
  check("blocker_retained", result.blocker === "real_owner_dogfooding_records_not_yet_collected"),
  check("intake_ready", result.dogfoodingIntakeReady === true),
  check("no_owner_feedback_fabricated", result.realOwnerDogfoodingCollected === false && result.ownerFeedbackFabricated === false),
  check("provider_false", result.providerCallsMade === false),
  check("secret_false", result.secretValueExposed === false),
  check("deploy_false", result.deployExecuted === false),
  check("chat_gateway_execute_false", result.chatGatewayExecuteModified === false),
  check("legacy_project_context_false", result.legacyModified === false && result.projectContextModified === false),
  check("production_ready_false", result.productionReadyClaimed === false),
];

const passed = checks.every((item) => item.passed);
console.log(JSON.stringify({ ...result, completed: passed, recommended_sealed: passed, checks }, null, 2));
if (!passed) process.exitCode = 1;
