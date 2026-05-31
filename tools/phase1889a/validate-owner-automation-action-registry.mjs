import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  finalize,
  has,
  readJson,
  readText,
  safetyBoundary,
} from "../phase632-common.mjs";

const paths = {
  phase1883Evidence: "apps/ai-gateway-service/evidence/phase1883a-create-desktop-spreadsheet-dry-run.json",
  phase1884Evidence: "apps/ai-gateway-service/evidence/phase1884a-create-desktop-spreadsheet-real-action.json",
  phase1885Evidence: "apps/ai-gateway-service/evidence/phase1885a-owner-os-file-action-result-integration.json",
  phase1886Evidence: "apps/ai-gateway-service/evidence/phase1886a-owner-os-file-action-visual-smoke.json",
  phase1887Evidence: "apps/ai-gateway-service/evidence/phase1887a-file-action-copy-polish.json",
  schema: "docs/automation/owner-automation-action-registry.schema.json",
  registryDocs: "docs/automation/owner-automation-action-registry-v1.md",
  registeredActions: "docs/automation/registered-owner-actions.json",
  kernelRegistry: "tools/owner-automation-kernel/action-registry.json",
  kernelRegistryModule: "tools/owner-automation-kernel/action-registry.mjs",
  builder: "tools/phase1889a/build-owner-automation-action-registry.mjs",
  verifier: "tools/phase1889a/validate-owner-automation-action-registry.mjs",
  evidence: "apps/ai-gateway-service/evidence/phase1889a-owner-automation-action-registry-v1.json",
  packageJson: "package.json",
};

const evidenceRefs = {
  contract: "docs/automation/create-desktop-spreadsheet-action-contract.json",
  dryRun: paths.phase1883Evidence,
  realRun: paths.phase1884Evidence,
  ownerOsIntegration: paths.phase1885Evidence,
  visualSmoke: paths.phase1886Evidence,
  copyPolish: paths.phase1887Evidence,
};

const requiredForbiddenCapabilities = [
  "delete_file",
  "move_file",
  "overwrite_file",
  "desktop_scan",
  "read_desktop_other_files",
  "provider_call",
  "secret_read",
  "legacy_script_execution",
  "deploy",
  "chat_route_modification",
];

const requiredForbiddenTargets = [
  "legacy",
  "PROJECT_CONTEXT.md",
  ".env",
  ".git",
  "node_modules",
  "auth.json",
  "rawCredentialRef",
  "providerRuntime",
  "/chat",
  "/chat-gateway/execute",
];

const phase1883 = readJson(paths.phase1883Evidence);
const phase1884 = readJson(paths.phase1884Evidence);
const phase1885 = readJson(paths.phase1885Evidence);
const phase1886 = readJson(paths.phase1886Evidence);
const phase1887 = readJson(paths.phase1887Evidence);
const schema = readJson(paths.schema);
const registeredActions = readJson(paths.registeredActions);
const kernelRegistry = readJson(paths.kernelRegistry);
const phaseEvidence = readJson(paths.evidence);
const packageJson = readJson(paths.packageJson);
const docsText = readText(paths.registryDocs);
const builderText = readText(paths.builder);
const verifierText = readText(paths.verifier);
const kernelRegistryModuleText = readText(paths.kernelRegistryModule);
const schemaText = readText(paths.schema);
const registeredActionsText = readText(paths.registeredActions);
const evidenceText = readText(paths.evidence);
const combinedText = [
  docsText,
  builderText,
  verifierText,
  kernelRegistryModuleText,
  schemaText,
  registeredActionsText,
  evidenceText,
].join("\n");

const registry = registeredActions.data ?? {};
const kernel = kernelRegistry.data ?? {};
const actions = Array.isArray(registry.actions) ? registry.actions : [];
const action = actions.find((item) => item?.actionId === "create_desktop_spreadsheet") ?? {};
const metadata = action.metadata ?? {};
const phase = phaseEvidence.data ?? {};
const scripts = packageJson.data?.scripts ?? {};

function arrayIncludesEvery(value, expectedItems) {
  return Array.isArray(value) && expectedItems.every((item) => value.includes(item));
}

function evidenceReady(json, predicate) {
  return json.exists === true && !json.parseErrorReason && predicate(json.data ?? {});
}

const previousPhasesReady =
  evidenceReady(phase1883, (data) =>
    data.completed === true &&
    data.recommended_sealed === true &&
    data.blocker === null &&
    data.csvDryRunImplemented === true &&
    data.realFileCreated === false &&
    data.noExistingFileWouldBeOverwritten === true) &&
  evidenceReady(phase1884, (data) =>
    data.completed === true &&
    data.recommended_sealed === true &&
    data.blocker === null &&
    data.desktopSpreadsheetCreated === true &&
    data.createdFileExists === true &&
    data.noExistingFileOverwritten === true) &&
  evidenceReady(phase1885, (data) =>
    data.completed === true &&
    data.recommended_sealed === true &&
    data.blocker === null &&
    data.ownerOsShowsFileActionResult === true &&
    data.bossDailyReportIncludesFileAction === true) &&
  evidenceReady(phase1886, (data) =>
    data.completed === true &&
    data.recommended_sealed === true &&
    data.blocker === null &&
    data.fileActionResultCardVisible === true) &&
  evidenceReady(phase1887, (data) =>
    data.completed === true &&
    data.recommended_sealed === true &&
    data.blocker === null &&
    data.ownerReadableFileActionCopy === true &&
    data.nextStepClear === true);

const registryShapeReady =
  registeredActions.exists === true &&
  !registeredActions.parseErrorReason &&
  registry.version === "v1" &&
  registry.routeChoice === "Route A / local_self_use_only" &&
  Array.isArray(registry.actions);

const schemaReady =
  schema.exists === true &&
  !schema.parseErrorReason &&
  schema.data?.title === "Owner Automation Action Registry v1" &&
  schema.data?.type === "object" &&
  schema.data?.properties?.actions?.type === "array";

const createDesktopSpreadsheetRegistered =
  action.actionId === "create_desktop_spreadsheet" &&
  action.enabled === true &&
  action.displayName === "创建桌面表格" &&
  action.ownerFacingName === "帮我在桌面建一个表格" &&
  action.description === "在桌面创建一个 CSV 任务表，并尝试自动打开。" &&
  action.category === "local_file_action" &&
  action.riskLevel === "low_with_guardrails";

const permissionModeDefined =
  metadata.defaultPermissionMode === "owner_explicit_approval_required" &&
  action.requiresOwnerApprovalForRealRun === true &&
  action.realRunRequiresApproval === true &&
  metadata.realRunRequiresApproval === true;

const dryRunFirstPolicyDefined =
  action.supportsDryRun === true &&
  action.supportsRealRun === true &&
  action.defaultDryRunFirst === true &&
  metadata.dryRunSupported === true &&
  metadata.realRunSupported === true;

const overwriteProtectionPreserved =
  action.overwritePolicy === "never_overwrite_append_timestamp" &&
  metadata.overwritePolicy === "never_overwrite_append_timestamp" &&
  action.canOverwriteFiles === false &&
  metadata.canOverwriteFiles === false;

const allowedDirectoriesDefined =
  arrayIncludesEvery(action.allowedDirectories, ["desktop", "project_evidence", "project_reports"]) &&
  arrayIncludesEvery(metadata.allowedTargetDirectories, ["desktop", "project_evidence", "project_reports"]);

const forbiddenTargetsDefined =
  arrayIncludesEvery(action.forbiddenTargets, requiredForbiddenTargets) &&
  arrayIncludesEvery(metadata.forbiddenTargets, requiredForbiddenTargets);

const forbiddenCapabilitiesDefined =
  arrayIncludesEvery(action.forbiddenCapabilities, requiredForbiddenCapabilities) &&
  action.scansDesktop === false &&
  action.readsDesktopOtherFiles === false &&
  action.canDeleteFiles === false &&
  action.canMoveFiles === false &&
  action.providerCallsMade === false &&
  metadata.scansDesktop === false &&
  metadata.readsDesktopOtherFiles === false &&
  metadata.canDeleteFiles === false &&
  metadata.canMoveFiles === false &&
  metadata.providerCallsMade === false;

const evidenceRefsValid =
  Object.entries(evidenceRefs).every(([key, value]) => action.evidenceRefs?.[key] === value);

const ownerOsResultLinked =
  action.ownerOsResultSupported === true &&
  metadata.ownerOsResultSupported === true &&
  action.evidenceRefs?.ownerOsIntegration === paths.phase1885Evidence &&
  action.evidenceRefs?.visualSmoke === paths.phase1886Evidence &&
  action.evidenceRefs?.copyPolish === paths.phase1887Evidence;

const bossDailyReportLinked =
  action.bossDailyReportSupported === true &&
  metadata.bossDailyReportSupported === true &&
  action.evidenceRefs?.ownerOsIntegration === paths.phase1885Evidence;

const kernelRegistryMatchesDocs =
  kernel.version === registry.version &&
  JSON.stringify(kernel.actions ?? []) === JSON.stringify(registry.actions ?? []) &&
  has(kernelRegistryModuleText, "getRegisteredOwnerActions") &&
  has(kernelRegistryModuleText, "getOwnerAutomationActionById");

const docsReady =
  has(docsText, "Phase1889A") &&
  has(docsText, "Owner Automation Action Registry v1") &&
  has(docsText, "create_desktop_spreadsheet") &&
  has(docsText, "不得声称通用桌面自动化已完成");

const packageScriptPresent =
  scripts["verify:phase1889a-owner-automation-action-registry"] ===
  "node tools/phase1889a/validate-owner-automation-action-registry.mjs";

const checks = [
  check("previous_phases_ready", previousPhasesReady),
  check("schema_ready", schemaReady),
  check("registry_shape_ready", registryShapeReady),
  check("registered_action_count_one", actions.length === 1),
  check("create_desktop_spreadsheet_registered", createDesktopSpreadsheetRegistered),
  check("permission_mode_defined", permissionModeDefined),
  check("dry_run_first_policy_defined", dryRunFirstPolicyDefined),
  check("real_run_requires_approval", action.realRunRequiresApproval === true),
  check("overwrite_protection_preserved", overwriteProtectionPreserved),
  check("allowed_directories_defined", allowedDirectoriesDefined),
  check("forbidden_targets_defined", forbiddenTargetsDefined),
  check("forbidden_capabilities_defined", forbiddenCapabilitiesDefined),
  check("evidence_refs_valid", evidenceRefsValid),
  check("owner_os_result_linked", ownerOsResultLinked),
  check("boss_daily_report_linked", bossDailyReportLinked),
  check("kernel_registry_matches_docs", kernelRegistryMatchesDocs),
  check("docs_ready", docsReady),
  check("builder_exists", has(builderText, "Phase1889A") && has(builderText, "create_desktop_spreadsheet")),
  check("verifier_exists", has(verifierText, "Phase1889A") && has(verifierText, "ownerAutomationActionRegistryReady")),
  check("package_script_present", packageScriptPresent),
  check("phase_evidence_exists", phaseEvidence.exists === true && !phaseEvidence.parseErrorReason),
  check("phase_evidence_completed_true", phase.completed === true),
  check("phase_evidence_sealed_true", phase.recommended_sealed === true),
  check("phase_evidence_blocker_null", phase.blocker === null),
  check("new_file_created_false", phase.newFileCreated === false),
  check("desktop_scan_performed_false", phase.desktopScanPerformed === false),
  check("desktop_other_files_read_false", phase.desktopOtherFilesRead === false),
  check("legacy_scripts_executed_false", phase.legacyScriptsExecuted === false),
  check("provider_calls_made_false", phase.providerCallsMade === false),
  check("raw_secret_read_false", phase.rawSecretRead === false),
  check("auth_json_read_false", phase.authJsonRead === false),
  check("raw_credential_ref_read_false", phase.rawCredentialRefRead === false),
  check("chat_modified_false", phase.chatModified === false),
  check("chat_gateway_execute_modified_false", phase.chatGatewayExecuteModified === false),
  check("deploy_executed_false", phase.deployExecuted === false),
  check("production_ready_claimed_false", phase.productionReadyClaimed === false),
  check("secret_value_exposed_false", containsSecretLikeValue(combinedText) === false),
  check("raw_base_url_value_exposed_false", containsRawBaseUrlValue(combinedText) === false),
  check("webhook_value_exposed_false", containsWebhookLikeValue(combinedText) === false),
];

const result = {
  phase: "Phase1889A",
  routeChoice: "Route A / local_self_use_only",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  previousPhasesReady,
  ownerAutomationActionRegistryReady: registryShapeReady && schemaReady,
  registeredActionCount: actions.length,
  createDesktopSpreadsheetRegistered,
  actionSchemaValid: schemaReady,
  permissionModeDefined,
  dryRunFirstPolicyDefined,
  realRunRequiresApproval: action.realRunRequiresApproval === true,
  overwriteProtectionPreserved,
  allowedDirectoriesDefined,
  forbiddenTargetsDefined,
  forbiddenCapabilitiesDefined,
  evidenceRefsValid,
  ownerOsResultLinked,
  bossDailyReportLinked,
  actionRegistryPath: paths.registeredActions,
  actionSchemaPath: paths.schema,
  kernelRegistryPath: paths.kernelRegistry,
  permissionMode: metadata.defaultPermissionMode ?? null,
  forbiddenCapabilities: action.forbiddenCapabilities ?? [],
  evidenceRefs: action.evidenceRefs ?? {},
  newFileCreated: false,
  desktopScanPerformed: false,
  desktopOtherFilesRead: false,
  legacyScriptsExecuted: false,
  rawSecretRead: false,
  authJsonRead: false,
  rawCredentialRefRead: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  productionReadyClaimed: false,
  currentSealableScope: "Owner Automation Action Registry v1 metadata, schema, evidence links, and guardrail registration for create_desktop_spreadsheet.",
  currentUnsealableScope: "通用桌面自动化、批量文件能力、无审批真实运行、Provider runtime、/chat 或 /chat-gateway/execute 主链集成。",
  ...safetyBoundary(),
  providerCallsMade: false,
};

finalize(result, checks, paths.evidence, "phase1889a_owner_automation_action_registry_failed");
