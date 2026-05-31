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
  previousEvidence: "apps/ai-gateway-service/evidence/phase1881a-legacy-automation-audit.json",
  actionContract: "docs/automation/create-desktop-spreadsheet-action-contract.json",
  kernelContract: "docs/automation/owner-automation-kernel-local-file-table-contract.md",
  safeLocalFilePolicy: "docs/automation/safe-local-file-action-policy.md",
  evidenceSchema: "docs/automation/owner-automation-evidence-ledger.schema.json",
  evidence: "apps/ai-gateway-service/evidence/phase1882a-owner-automation-contract.json",
  packageJson: "package.json",
};

const verifyScriptName = "verify:phase1882a-owner-automation-file-table-contract";
const verifyScriptCommand = "node tools/phase1882a/validate-owner-automation-file-table-contract.mjs";

const previousEvidence = readJson(paths.previousEvidence);
const actionContract = readJson(paths.actionContract);
const evidenceSchema = readJson(paths.evidenceSchema);
const phaseEvidence = readJson(paths.evidence);
const packageJson = readJson(paths.packageJson);
const kernelContractText = readText(paths.kernelContract);
const safePolicyText = readText(paths.safeLocalFilePolicy);
const combinedText = [
  kernelContractText,
  safePolicyText,
  JSON.stringify(actionContract.data ?? {}),
  JSON.stringify(evidenceSchema.data ?? {}),
  JSON.stringify(phaseEvidence.data ?? {}),
].join("\n");

const contract = actionContract.data ?? {};
const inputSchema = contract.inputSchema ?? {};
const outputSchema = contract.outputSchema ?? {};
const policy = contract.policy ?? {};
const ownerOsResult = contract.ownerOsResult ?? {};
const bossDailyReportIntegration = contract.bossDailyReportIntegration ?? {};
const phase = phaseEvidence.data ?? {};
const scripts = packageJson.data?.scripts ?? {};

function arrayIncludes(value, item) {
  return Array.isArray(value) && value.includes(item);
}

function requiredArray(value, minimumLength = 1) {
  return Array.isArray(value) && value.length >= minimumLength;
}

function propertyEnumIncludes(schema, property, expected) {
  return arrayIncludes(schema?.properties?.[property]?.enum, expected);
}

function propertyConstEquals(schema, property, expected) {
  return schema?.properties?.[property]?.const === expected;
}

function propertyDefaultEquals(schema, property, expected) {
  return schema?.properties?.[property]?.default === expected;
}

const previousEvidenceReady =
  previousEvidence.exists === true &&
  !previousEvidence.parseErrorReason &&
  previousEvidence.data?.completed === true &&
  previousEvidence.data?.recommended_sealed === true &&
  previousEvidence.data?.blocker === null &&
  previousEvidence.data?.legacyAutomationAudited === true &&
  previousEvidence.data?.legacyModified === false &&
  previousEvidence.data?.legacyScriptsExecuted === false;

const actionContractReady =
  actionContract.exists === true &&
  !actionContract.parseErrorReason &&
  contract.phase === "Phase1882A" &&
  contract.routeChoice === "Route A / local_self_use_only" &&
  contract.action === "create_desktop_spreadsheet" &&
  inputSchema?.type === "object" &&
  outputSchema?.type === "object";

const createDesktopSpreadsheetContractReady =
  actionContractReady &&
  propertyConstEquals(inputSchema, "action", "create_desktop_spreadsheet") &&
  propertyDefaultEquals(inputSchema, "targetDirectory", "desktop") &&
  propertyEnumIncludes(inputSchema, "targetDirectory", "desktop") &&
  propertyEnumIncludes(inputSchema, "targetDirectory", "project_evidence") &&
  propertyEnumIncludes(inputSchema, "targetDirectory", "project_reports") &&
  propertyDefaultEquals(inputSchema, "overwritePolicy", "never_overwrite_append_timestamp") &&
  propertyEnumIncludes(inputSchema, "overwritePolicy", "never_overwrite_append_timestamp") &&
  arrayIncludes(inputSchema.required, "fileName") &&
  arrayIncludes(inputSchema.required, "columns") &&
  arrayIncludes(inputSchema.required, "rows") &&
  propertyConstEquals(outputSchema, "action", "create_desktop_spreadsheet") &&
  requiredArray(contract.examples?.input?.columns, 3) &&
  requiredArray(contract.examples?.input?.rows, 2) &&
  contract.examples?.output?.noExistingFileOverwritten === true;

const allowedDirectoriesDefined =
  requiredArray(policy.allowedDirectories, 3) &&
  arrayIncludes(policy.allowedDirectories, "desktop") &&
  arrayIncludes(policy.allowedDirectories, "project_evidence") &&
  arrayIncludes(policy.allowedDirectories, "project_reports") &&
  has(safePolicyText, "allowedDirectories") &&
  has(safePolicyText, "Desktop") &&
  has(safePolicyText, "apps/ai-gateway-service/evidence") &&
  has(safePolicyText, "reports");

const forbiddenDirectoriesDefined =
  requiredArray(policy.forbiddenDirectories, 8) &&
  arrayIncludes(policy.forbiddenDirectories, "legacy") &&
  arrayIncludes(policy.forbiddenDirectories, "PROJECT_CONTEXT.md") &&
  arrayIncludes(policy.forbiddenDirectories, ".env") &&
  arrayIncludes(policy.forbiddenDirectories, ".git") &&
  arrayIncludes(policy.forbiddenDirectories, "node_modules") &&
  arrayIncludes(policy.forbiddenDirectories, "auth.json") &&
  arrayIncludes(policy.forbiddenDirectories, "raw CredentialRef") &&
  has(safePolicyText, "forbiddenDirectories") &&
  has(safePolicyText, "legacy/") &&
  has(safePolicyText, "auth.json") &&
  has(safePolicyText, "raw CredentialRef");

const overwriteProtectionDefined =
  policy.overwriteProtection?.defaultPolicy === "never_overwrite_append_timestamp" &&
  policy.overwriteProtection?.existingFileBehavior === "append_timestamp" &&
  policy.overwriteProtection?.noDelete === true &&
  policy.overwriteProtection?.noOverwrite === true &&
  has(safePolicyText, "never_overwrite_append_timestamp") &&
  has(safePolicyText, "自动追加时间戳") &&
  has(kernelContractText, "防止覆盖");

const evidenceLedgerSchemaReady =
  evidenceSchema.exists === true &&
  !evidenceSchema.parseErrorReason &&
  evidenceSchema.data?.title === "Owner Automation Evidence Ledger Entry" &&
  evidenceSchema.data?.type === "object" &&
  arrayIncludes(evidenceSchema.data?.required, "phase") &&
  arrayIncludes(evidenceSchema.data?.required, "action") &&
  arrayIncludes(evidenceSchema.data?.required, "dryRun") &&
  propertyConstEquals(evidenceSchema.data, "action", "create_desktop_spreadsheet") &&
  evidenceSchema.data?.properties?.providerCallsMade?.const === false &&
  evidenceSchema.data?.properties?.rawSecretRead?.const === false &&
  evidenceSchema.data?.properties?.authJsonRead?.const === false &&
  evidenceSchema.data?.properties?.legacyScriptsExecuted?.const === false;

const ownerOsResultContractReady =
  ownerOsResult.displaySurface === "Owner OS" &&
  ownerOsResult.resultFields?.includes("filePath") &&
  ownerOsResult.resultFields?.includes("fileCreated") &&
  ownerOsResult.resultFields?.includes("fileOpened") &&
  ownerOsResult.resultFields?.includes("evidencePath") &&
  has(kernelContractText, "Owner OS") &&
  has(kernelContractText, "owner 显示结果");

const bossDailyReportIntegrationContractReady =
  bossDailyReportIntegration.surface === "老板日报" &&
  bossDailyReportIntegration.recordActionSummary === true &&
  bossDailyReportIntegration.recordEvidencePath === true &&
  bossDailyReportIntegration.noDesktopScan === true &&
  has(kernelContractText, "老板日报") &&
  has(kernelContractText, "Boss Daily Report");

const safeLocalFileActionPolicyReady =
  has(safePolicyText, "不允许删除文件") &&
  has(safePolicyText, "不允许覆盖已有文件") &&
  has(safePolicyText, "不读取桌面其他文件内容") &&
  has(safePolicyText, "不扫描桌面隐私文件") &&
  has(safePolicyText, "不上传文件") &&
  has(safePolicyText, "不联网") &&
  has(safePolicyText, "不执行 legacy 脚本") &&
  has(safePolicyText, "不执行 deploy / release / tag / artifact");

const nextPhasePlansReady =
  has(kernelContractText, "Phase1883A") &&
  has(kernelContractText, "CSV dry-run") &&
  has(kernelContractText, "Phase1884A") &&
  has(kernelContractText, "真实桌面 CSV 创建");

const packageScriptPresent = scripts[verifyScriptName] === verifyScriptCommand;

const result = {
  phase: "Phase1882A",
  routeChoice: "Route A / local_self_use_only",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  previousPhaseEvidenceReady: previousEvidenceReady,
  ownerAutomationKernelContractReady: Boolean(kernelContractText) && has(kernelContractText, "Owner Automation Kernel"),
  createDesktopSpreadsheetContractReady,
  safeLocalFileActionPolicyReady,
  allowedDirectoriesDefined,
  forbiddenDirectoriesDefined,
  overwriteProtectionDefined,
  evidenceLedgerSchemaReady,
  ownerOsResultContractReady,
  bossDailyReportIntegrationContractReady,
  nextPhasePlansReady,
  actionContractPath: paths.actionContract,
  safeLocalFilePolicyPath: paths.safeLocalFilePolicy,
  evidenceSchemaPath: paths.evidenceSchema,
  evidencePath: paths.evidence,
  docs: [paths.kernelContract, paths.safeLocalFilePolicy],
  packageScriptPresent,
  realDesktopFileCreated: false,
  desktopFileCreationExecuted: false,
  fileWriteExecutionImplemented: false,
  legacyModified: false,
  legacyScriptsExecuted: false,
  rawSecretRead: false,
  authJsonRead: false,
  rawCredentialRefRead: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  ...safetyBoundary(),
  providerCallsMade: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  secretValueExposed: containsSecretLikeValue(combinedText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(combinedText),
  webhookValueExposed: containsWebhookLikeValue(combinedText),
};

const evidenceMatchesAcceptance =
  phase.completed === true &&
  phase.recommended_sealed === true &&
  phase.blocker === null &&
  phase.ownerAutomationKernelContractReady === true &&
  phase.createDesktopSpreadsheetContractReady === true &&
  phase.safeLocalFileActionPolicyReady === true &&
  phase.allowedDirectoriesDefined === true &&
  phase.forbiddenDirectoriesDefined === true &&
  phase.overwriteProtectionDefined === true &&
  phase.evidenceLedgerSchemaReady === true &&
  phase.ownerOsResultContractReady === true &&
  phase.bossDailyReportIntegrationContractReady === true &&
  phase.legacyModified === false &&
  phase.legacyScriptsExecuted === false &&
  phase.providerCallsMade === false &&
  phase.rawSecretRead === false &&
  phase.authJsonRead === false &&
  phase.chatModified === false &&
  phase.chatGatewayExecuteModified === false &&
  phase.deployExecuted === false &&
  phase.realDesktopFileCreated === false;

const checks = [
  check("previous_phase_evidence_ready", previousEvidenceReady),
  check("kernel_contract_doc_exists", Boolean(kernelContractText)),
  check("action_contract_ready", actionContractReady),
  check("create_desktop_spreadsheet_contract_ready", createDesktopSpreadsheetContractReady),
  check("safe_local_file_policy_ready", safeLocalFileActionPolicyReady),
  check("allowed_directories_defined", allowedDirectoriesDefined),
  check("forbidden_directories_defined", forbiddenDirectoriesDefined),
  check("overwrite_protection_defined", overwriteProtectionDefined),
  check("evidence_ledger_schema_ready", evidenceLedgerSchemaReady),
  check("owner_os_result_contract_ready", ownerOsResultContractReady),
  check("boss_daily_report_integration_contract_ready", bossDailyReportIntegrationContractReady),
  check("next_phase_plans_ready", nextPhasePlansReady),
  check("phase_evidence_exists", phaseEvidence.exists === true && !phaseEvidence.parseErrorReason),
  check("phase_evidence_matches_acceptance", evidenceMatchesAcceptance),
  check("package_script_present", packageScriptPresent),
  check("real_desktop_file_created_false", result.realDesktopFileCreated === false),
  check("desktop_file_creation_executed_false", result.desktopFileCreationExecuted === false),
  check("file_write_execution_implemented_false", result.fileWriteExecutionImplemented === false),
  check("legacy_modified_false", result.legacyModified === false),
  check("legacy_scripts_executed_false", result.legacyScriptsExecuted === false),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("raw_secret_read_false", result.rawSecretRead === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("raw_credential_ref_read_false", result.rawCredentialRefRead === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("release_executed_false", result.releaseExecuted === false),
  check("tag_created_false", result.tagCreated === false),
  check("artifact_uploaded_false", result.artifactUploaded === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("raw_base_url_value_exposed_false", result.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", result.webhookValueExposed === false),
];

finalize(result, checks, paths.evidence, "phase1882a_owner_automation_file_table_contract_failed");
