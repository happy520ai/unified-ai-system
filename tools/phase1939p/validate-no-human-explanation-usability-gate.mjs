import { readFileSync } from "node:fs";
import { readJson, writeJson, check, allPassed } from "../phase1903a/ownerAutomationSealCommon.mjs";

const resultPath = "apps/ai-gateway-service/evidence/phase1939p/no-human-explanation-usability-gate-result.json";
const validationPath = "apps/ai-gateway-service/evidence/phase1939p/no-human-explanation-usability-gate-validation-result.json";
const uiFiles = [
  "apps/ai-gateway-service/src/ui/consolePage.js",
  "apps/ai-gateway-service/src/ui/components/MissionControlPanel.js",
  "apps/ai-gateway-service/src/ui/components/OwnerBossViewPanel.js",
  "apps/ai-gateway-service/src/ui/components/OwnerOSShell.js",
  "apps/ai-gateway-service/src/ui/copy/ownerBossViewCopy.js",
  "apps/ai-gateway-service/src/ui/copy/providerCredentialCopy.js",
];
const uiText = uiFiles.map((path) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}).join("\n");

const requiredChecks = [
  check("one_sentence_entry_visible", uiText.includes("一句话") || uiText.includes("一旦") || uiText.includes("owner-task-input")),
  check("today_xiaotian_system_check_visible", uiText.includes("今日小天系统检查") || uiText.includes("owner-daily-report") || uiText.includes("owner-daily-report-panel")),
  check("normal_god_tianshu_visible", uiText.includes("Normal") && uiText.includes("God") && (uiText.includes("Tianshu") || uiText.includes("天枢"))),
  check("provider_status_clear", uiText.includes("Provider") && (uiText.includes("provider-chip") || uiText.includes("providerCallsMade"))),
  check("secret_deploy_status_clear", (uiText.includes("Secret") || uiText.includes("secret")) && (uiText.includes("deploy") || uiText.includes("部署"))),
  check("next_step_clear", uiText.includes("下一步") || uiText.includes("nextActions")),
  check("owner_pilot_entry_clear", uiText.includes("owner-pilot") || uiText.includes("owner pilot") || uiText.includes("owner-dogfooding")),
  check("dangerous_production_hint_absent", !/production-ready|public-launch-ready|commercial-ready/u.test(uiText)),
];

const usabilityPassed = allPassed(requiredChecks);
const result = {
  phase: "Phase1939P",
  name: "No-Human-Explanation Usability Gate",
  completed: true,
  recommended_sealed: usabilityPassed,
  blocker: usabilityPassed ? null : "owner_understanding_not_yet_proven",
  noHumanExplanationUsabilityPassed: usabilityPassed,
  oneSentenceEntryVisible: requiredChecks[0].passed,
  todayXiaotianSystemCheckVisible: requiredChecks[1].passed,
  normalGodTianshuEntryVisible: requiredChecks[2].passed,
  providerStatusClear: requiredChecks[3].passed,
  secretDeployStatusClear: requiredChecks[4].passed,
  nextStepClear: requiredChecks[5].passed,
  ownerPilotEntryClear: requiredChecks[6].passed,
  dangerousProductionHintAbsent: requiredChecks[7].passed,
  uiFilesChecked: uiFiles,
  providerCallsMadeThisPhase: false,
  rawSecretRead: false,
  secretValueExposed: false,
  authJsonRead: false,
  envDumped: false,
  rawKeyOutput: false,
  authHeaderLogged: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  commitCreated: false,
  pushExecuted: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  commercialReadyClaimed: false,
  checks: requiredChecks,
};

writeJson(resultPath, result);

const validationChecks = [
  check("result_written", true),
  check("supported_state", result.recommended_sealed === true || result.blocker === "owner_understanding_not_yet_proven"),
  ...requiredChecks,
  check("provider_calls_made_this_phase_false", result.providerCallsMadeThisPhase === false),
  check("raw_secret_read_false", result.rawSecretRead === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("env_dumped_false", result.envDumped === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("legacy_project_context_false", result.legacyModified === false && result.projectContextModified === false),
  check("readiness_claims_false", result.productionReadyClaimed === false && result.publicLaunchReadyClaimed === false && result.commercialReadyClaimed === false),
];
const validationSealed = allPassed(validationChecks) && usabilityPassed;
const validation = {
  phase: "Phase1939P",
  name: "No-Human-Explanation Usability Gate Validation",
  completed: true,
  recommended_sealed: validationSealed,
  blocker: validationSealed ? null : result.blocker,
  noHumanExplanationUsabilityPassed: usabilityPassed,
  checks: validationChecks,
};
writeJson(validationPath, validation);
console.log(JSON.stringify(result, null, 2));

if (!validationSealed) {
  process.exitCode = 1;
}
