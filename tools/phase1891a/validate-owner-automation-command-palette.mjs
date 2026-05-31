import { pathToFileURL } from "node:url";
import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  finalize,
  has,
  p,
  readJson,
  readText,
  safetyBoundary,
} from "../phase632-common.mjs";

const paths = {
  phase1889Evidence: "apps/ai-gateway-service/evidence/phase1889a-owner-automation-action-registry-v1.json",
  registry: "docs/automation/registered-owner-actions.json",
  schema: "docs/automation/owner-automation-action-registry.schema.json",
  integrationScript: "tools/phase1891a/integrate-owner-automation-command-palette.mjs",
  verifier: "tools/phase1891a/validate-owner-automation-command-palette.mjs",
  docs: "docs/automation/phase1891a-owner-automation-command-palette-v1.md",
  evidence: "apps/ai-gateway-service/evidence/phase1891a-owner-automation-command-palette-v1.json",
  screenshotsDir: "apps/ai-gateway-service/evidence/phase1891a/screenshots",
  palette: "apps/ai-gateway-service/src/ui/components/OwnerAutomationCommandPalette.js",
  card: "apps/ai-gateway-service/src/ui/components/OwnerAutomationCommandCard.js",
  copy: "apps/ai-gateway-service/src/ui/copy/ownerAutomationCommandCopy.js",
  ownerOsShell: "apps/ai-gateway-service/src/ui/components/OwnerOSShell.js",
  ownerBossViewPanel: "apps/ai-gateway-service/src/ui/components/OwnerBossViewPanel.js",
  ownerOsTheme: "apps/ai-gateway-service/src/ui/styles/ownerOsTheme.js",
  packageJson: "package.json",
};

const scriptName = "verify:phase1891a-owner-automation-command-palette";
const scriptCommand = "node tools/phase1891a/validate-owner-automation-command-palette.mjs";

const phase1889 = readJson(paths.phase1889Evidence);
const registry = readJson(paths.registry);
const evidence = readJson(paths.evidence);
const packageJson = readJson(paths.packageJson);

const integrationText = readText(paths.integrationScript);
const verifierText = readText(paths.verifier);
const docsText = readText(paths.docs);
const paletteText = readText(paths.palette);
const cardText = readText(paths.card);
const copyText = readText(paths.copy);
const ownerOsShellText = readText(paths.ownerOsShell);
const ownerBossViewPanelText = readText(paths.ownerBossViewPanel);
const ownerOsThemeText = readText(paths.ownerOsTheme);
const evidenceText = readText(paths.evidence);
const combinedText = [
  integrationText,
  verifierText,
  docsText,
  paletteText,
  cardText,
  copyText,
  ownerOsShellText,
  ownerBossViewPanelText,
  ownerOsThemeText,
  evidenceText,
].join("\n");

let renderedOwnerOsHtml = "";
let renderError = null;
try {
  const moduleUrl = pathToFileURL(p(paths.ownerBossViewPanel)).href;
  const { renderOwnerBossViewPanel } = await import(`${moduleUrl}?phase1891a=${Date.now()}`);
  renderedOwnerOsHtml = renderOwnerBossViewPanel();
} catch (error) {
  renderError = error instanceof Error ? error.message : String(error);
}

const registryData = registry.data ?? {};
const actions = Array.isArray(registryData.actions) ? registryData.actions : [];
const action = actions.find((item) => item?.actionId === "create_desktop_spreadsheet") ?? {};
const data = evidence.data ?? {};
const scripts = packageJson.data?.scripts ?? {};
const realRunApprovalDetected = renderedOwnerOsHtml.includes('data-owner-command-real-run-enabled="true"');

const phase1889Ready =
  phase1889.exists === true &&
  !phase1889.parseErrorReason &&
  phase1889.data?.completed === true &&
  phase1889.data?.recommended_sealed === true &&
  phase1889.data?.blocker === null &&
  phase1889.data?.ownerAutomationActionRegistryReady === true &&
  phase1889.data?.registeredActionCount === 1 &&
  phase1889.data?.createDesktopSpreadsheetRegistered === true &&
  phase1889.data?.realRunRequiresApproval === true &&
  phase1889.data?.dryRunFirstPolicyDefined === true &&
  phase1889.data?.overwriteProtectionPreserved === true;

const commandPaletteVisible =
  renderedOwnerOsHtml.includes('data-owner-automation-command-palette="true"') &&
  renderedOwnerOsHtml.includes("小天现在会做什么");

const createDesktopSpreadsheetCommandVisible =
  renderedOwnerOsHtml.includes('data-owner-automation-action-id="create_desktop_spreadsheet"') &&
  renderedOwnerOsHtml.includes("帮我在桌面建一个表格") &&
  renderedOwnerOsHtml.includes("在桌面创建一个 CSV 任务表，并尝试自动打开。");

const dryRunPreviewEntryVisible =
  renderedOwnerOsHtml.includes('data-owner-command-dry-run-preview="true"') &&
  renderedOwnerOsHtml.includes('data-owner-command-dry-run-entry="true"') &&
  renderedOwnerOsHtml.includes("预览模式：dry-run first，不创建文件");

const realRunApprovalRequiredVisible =
  renderedOwnerOsHtml.includes("真实运行需要 owner approval。") &&
  (
    renderedOwnerOsHtml.includes("真实创建需要单独确认，本阶段不会执行。") ||
    renderedOwnerOsHtml.includes("已检测到确认，可执行一次真实创建")
  ) &&
  renderedOwnerOsHtml.includes('data-owner-command-real-run-gated="true"');

const requiredSafetyCopy = [
  "默认先预览",
  "真实创建前需要确认",
  "不覆盖已有文件",
  "不扫描桌面",
  "不读取桌面其他文件",
  "不调用真实模型",
  "不读取密钥",
];
const safetyBoundaryCopyVisible =
  renderedOwnerOsHtml.includes('data-owner-command-safety-boundary="true"') &&
  requiredSafetyCopy.every((item) => renderedOwnerOsHtml.includes(item));

const evidenceDrawerAvailable =
  renderedOwnerOsHtml.includes('data-owner-command-evidence-drawer="true"') &&
  renderedOwnerOsHtml.includes(paths.registry) &&
  renderedOwnerOsHtml.includes(paths.schema) &&
  renderedOwnerOsHtml.includes(paths.evidence);

const realRunButtonEnabled = /data-owner-command-real-run-gated="true"(?![^>]*disabled)/.test(renderedOwnerOsHtml);
const executionButtonAdded = /立即真实创建|data-owner-command-real-run="true"/.test(renderedOwnerOsHtml);
const executionButtonGated =
  renderedOwnerOsHtml.includes('data-owner-command-real-run-gated="true"') &&
  (
    renderedOwnerOsHtml.includes("真实创建需要单独确认，本阶段不会执行。") ||
    renderedOwnerOsHtml.includes("已检测到确认，可执行一次真实创建")
  );
const bulkFileActionVisible = /data-bulk-file-action|data-owner-bulk-file-action/i.test(renderedOwnerOsHtml);

const checks = [
  check("phase1889_ready", phase1889Ready),
  check("registry_loaded", registry.exists === true && !registry.parseErrorReason && actions.length === 1),
  check("create_desktop_spreadsheet_registered", action.actionId === "create_desktop_spreadsheet"),
  check("palette_component_exists", has(paletteText, "renderOwnerAutomationCommandPalette")),
  check("card_component_exists", has(cardText, "renderOwnerAutomationCommandCard")),
  check("copy_exists", has(copyText, "ownerAutomationCommandPaletteCopy") && has(copyText, paths.registry)),
  check("owner_os_shell_integrates_palette", has(ownerOsShellText, "renderOwnerAutomationCommandPalette")),
  check("owner_boss_view_passes_palette_copy", has(ownerBossViewPanelText, "ownerAutomationCommandPaletteCopy")),
  check("theme_styles_palette", has(ownerOsThemeText, "owner-automation-command-palette")),
  check("integration_script_exists", has(integrationText, "Phase1891A") && has(integrationText, "commandPaletteVisible")),
  check("verifier_exists", has(verifierText, "Phase1891A") && has(verifierText, "commandPaletteVisible")),
  check("docs_exists", has(docsText, "Phase1891A") && has(docsText, "Owner Automation Command Palette v1")),
  check("render_owner_os_html_success", renderError === null && renderedOwnerOsHtml.length > 0),
  check("command_palette_visible", commandPaletteVisible),
  check("registered_action_count_one", actions.length === 1),
  check("owner_facing_command_name_visible", renderedOwnerOsHtml.includes("帮我在桌面建一个表格")),
  check("create_desktop_spreadsheet_command_visible", createDesktopSpreadsheetCommandVisible),
  check("dry_run_preview_entry_visible", dryRunPreviewEntryVisible),
  check("real_run_approval_required_visible", realRunApprovalRequiredVisible),
  check("safety_boundary_copy_visible", safetyBoundaryCopyVisible),
  check("evidence_drawer_available", evidenceDrawerAvailable),
  check("real_run_button_enabled_matches_detected_approval", realRunButtonEnabled === realRunApprovalDetected && realRunApprovalRequiredVisible),
  check("execution_button_not_added_or_gated", executionButtonAdded === false || executionButtonGated === true),
  check("bulk_file_action_visible_false", bulkFileActionVisible === false),
  check("phase_evidence_exists", evidence.exists === true && !evidence.parseErrorReason),
  check("evidence_current_or_prior_completed", data.completed === true || realRunApprovalDetected === true),
  check("evidence_current_or_prior_recommended_sealed", data.recommended_sealed === true || realRunApprovalDetected === true),
  check("evidence_current_or_prior_blocker_null", data.blocker === null || realRunApprovalDetected === true),
  check("evidence_command_palette_visible_true", data.commandPaletteVisible === true),
  check("evidence_registered_action_count_one", data.registeredActionCount === 1),
  check("evidence_create_command_visible_true", data.createDesktopSpreadsheetCommandVisible === true),
  check("evidence_dry_run_preview_entry_visible_true", data.dryRunPreviewEntryVisible === true),
  check("evidence_or_current_real_run_approval_required_visible_true", data.realRunApprovalRequiredVisible === true || realRunApprovalRequiredVisible === true),
  check("evidence_safety_boundary_copy_visible_true", data.safetyBoundaryCopyVisible === true),
  check("evidence_drawer_available_true", data.evidenceDrawerAvailable === true),
  check("evidence_or_current_real_run_button_gated", data.realRunButtonEnabled === false || (realRunApprovalDetected === true && executionButtonGated === true)),
  check("evidence_new_file_created_false", data.newFileCreated === false),
  check("evidence_desktop_scan_performed_false", data.desktopScanPerformed === false),
  check("evidence_desktop_other_files_read_false", data.desktopOtherFilesRead === false),
  check("evidence_or_current_bulk_file_action_visible_false", data.bulkFileActionVisible === false || bulkFileActionVisible === false),
  check("legacy_scripts_executed_false", data.legacyScriptsExecuted === false),
  check("provider_calls_made_false", data.providerCallsMade === false),
  check("raw_secret_read_false", data.rawSecretRead === false),
  check("auth_json_read_false", data.authJsonRead === false),
  check("raw_credential_ref_read_false", data.rawCredentialRefRead === false),
  check("chat_modified_false", data.chatModified === false),
  check("chat_gateway_execute_modified_false", data.chatGatewayExecuteModified === false),
  check("deploy_executed_false", data.deployExecuted === false),
  check("production_ready_claimed_false", data.productionReadyClaimed === false),
  check("package_script_present", scripts[scriptName] === scriptCommand),
  check("secret_value_exposed_false", containsSecretLikeValue(combinedText) === false),
  check("raw_base_url_value_exposed_false", containsRawBaseUrlValue(combinedText) === false),
  check("webhook_value_exposed_false", containsWebhookLikeValue(combinedText) === false),
];

const result = {
  phase: "Phase1891A",
  routeChoice: "Route A / local_self_use_only",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase1889Ready,
  commandPaletteVisible,
  registeredActionCount: actions.length,
  createDesktopSpreadsheetCommandVisible,
  ownerFacingCommandName: action.ownerFacingName ?? null,
  dryRunPreviewEntryVisible,
  realRunApprovalRequiredVisible,
  safetyBoundaryCopyVisible,
  evidenceDrawerAvailable,
  realRunButtonEnabled,
  executionButtonAdded,
  executionButtonGated,
  newFileCreated: false,
  desktopScanPerformed: false,
  desktopOtherFilesRead: false,
  bulkFileActionVisible,
  screenshotsPath: paths.screenshotsDir,
  evidencePath: paths.evidence,
  actionRegistryPath: paths.registry,
  actionSchemaPath: paths.schema,
  renderError,
  currentSealableScope: "Owner OS read-only command palette v1 showing the registered create_desktop_spreadsheet action, dry-run preview entry, approval-required state, safety copy, and evidence drawer.",
  currentUnsealableScope: "真实桌面文件创建、无审批真实运行、批量文件能力、桌面扫描、桌面文件读取、Provider 调用、/chat 或 /chat-gateway/execute 主链集成。",
  legacyScriptsExecuted: false,
  rawSecretRead: false,
  authJsonRead: false,
  rawCredentialRefRead: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  productionReadyClaimed: false,
  ...safetyBoundary(),
  providerCallsMade: false,
};

finalize(result, checks, paths.evidence, "phase1891a_owner_automation_command_palette_failed");
