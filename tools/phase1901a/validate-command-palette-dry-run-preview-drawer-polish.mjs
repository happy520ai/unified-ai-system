import { pathToFileURL } from "node:url";
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
  p,
} from "../phase632-common.mjs";

const paths = {
  phase1900: "apps/ai-gateway-service/evidence/phase1900a-command-palette-v1-seal.json",
  phase1883: "apps/ai-gateway-service/evidence/phase1883a-create-desktop-spreadsheet-dry-run.json",
  palette: "apps/ai-gateway-service/src/ui/components/OwnerAutomationCommandPalette.js",
  card: "apps/ai-gateway-service/src/ui/components/OwnerAutomationCommandCard.js",
  copy: "apps/ai-gateway-service/src/ui/copy/ownerAutomationCommandCopy.js",
  theme: "apps/ai-gateway-service/src/ui/styles/ownerOsTheme.js",
  docs: "docs/automation/phase1901a-command-palette-dry-run-preview-drawer-polish.md",
  evidence: "apps/ai-gateway-service/evidence/phase1901a-command-palette-dry-run-preview-drawer-polish.json",
  packageJson: "package.json",
};

const scriptName = "verify:phase1901a-command-palette-dry-run-preview-drawer-polish";
const scriptCommand = "node tools/phase1901a/validate-command-palette-dry-run-preview-drawer-polish.mjs";

const phase1900 = readJson(paths.phase1900);
const phase1883 = readJson(paths.phase1883);
const packageJson = readJson(paths.packageJson);
const paletteText = readText(paths.palette);
const cardText = readText(paths.card);
const copyText = readText(paths.copy);
const themeText = readText(paths.theme);
const docsText = readText(paths.docs);
const evidence = readJson(paths.evidence);
const evidenceText = readText(paths.evidence);
const scripts = packageJson.data?.scripts ?? {};

let renderedOwnerOsHtml = "";
let renderError = null;
try {
  const moduleUrl = pathToFileURL(p("apps/ai-gateway-service/src/ui/components/OwnerBossViewPanel.js")).href;
  const { renderOwnerBossViewPanel } = await import(`${moduleUrl}?phase1901a=${Date.now()}`);
  renderedOwnerOsHtml = renderOwnerBossViewPanel();
} catch (error) {
  renderError = error instanceof Error ? error.message : String(error);
}

function extractElementHtml(text, marker, closingTag) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return "";
  const openIndex = text.lastIndexOf("<", markerIndex);
  if (openIndex < 0) return "";
  const closeIndex = text.indexOf(closingTag, markerIndex);
  if (closeIndex < 0) return text.slice(openIndex);
  return text.slice(openIndex, closeIndex + closingTag.length);
}

const previewDrawerHtml = extractElementHtml(
  renderedOwnerOsHtml,
  'data-owner-command-dry-run-preview-drawer="true"',
  "</details>",
);
const evidenceDrawerHtml = extractElementHtml(
  renderedOwnerOsHtml,
  'data-owner-command-evidence-drawer="true"',
  "</details>",
);
const combinedText = [
  paletteText,
  cardText,
  copyText,
  themeText,
  docsText,
  evidenceText,
  renderedOwnerOsHtml,
].join("\n");

const phase1900Ready =
  phase1900.exists === true &&
  !phase1900.parseErrorReason &&
  phase1900.data?.completed === true &&
  phase1900.data?.recommended_sealed === true &&
  phase1900.data?.blocker === null &&
  phase1900.data?.commandPaletteV1Sealed === true &&
  phase1900.data?.registeredActionCount === 1 &&
  phase1900.data?.realRunButtonEnabled === false &&
  phase1900.data?.realExecutionCapabilityExpanded === false;

const phase1883DryRunReady =
  phase1883.exists === true &&
  !phase1883.parseErrorReason &&
  phase1883.data?.completed === true &&
  phase1883.data?.recommended_sealed === true &&
  phase1883.data?.blocker === null &&
  phase1883.data?.csvDryRunImplemented === true &&
  phase1883.data?.realFileCreated === false &&
  phase1883.data?.csvPreviewGenerated === true;

const previewDrawerPolished =
  renderedOwnerOsHtml.includes('data-owner-command-dry-run-preview-drawer="true"') &&
  renderedOwnerOsHtml.includes("预览会展示将要创建的表格内容，但不会写入桌面。") &&
  renderedOwnerOsHtml.includes("预览字段") &&
  renderedOwnerOsHtml.includes("任务、状态、备注") &&
  renderedOwnerOsHtml.includes("不会创建文件") &&
  renderedOwnerOsHtml.includes("不会打开 Excel / WPS") &&
  renderedOwnerOsHtml.includes("不会扫描桌面");

const previewDrawerHierarchyClear =
  previewDrawerHtml.includes("owner-command-preview-drawer-body") &&
  previewDrawerHtml.includes("owner-command-preview-primary") &&
  previewDrawerHtml.includes("owner-command-preview-grid") &&
  previewDrawerHtml.includes("owner-command-preview-muted");

const dryRunEvidenceRefsVisible =
  previewDrawerHtml.includes(paths.phase1883) &&
  previewDrawerHtml.includes(paths.phase1900) &&
  previewDrawerHtml.includes("docs/automation/create-desktop-spreadsheet-action-contract.json");

const evidenceDrawerKeepsRefs =
  evidenceDrawerHtml.includes(paths.phase1883) &&
  evidenceDrawerHtml.includes(paths.phase1900) &&
  evidenceDrawerHtml.includes(paths.evidence);

const realRunStillGated =
  renderedOwnerOsHtml.includes('data-owner-command-real-run-gated="true"') &&
  /data-owner-command-real-run-gated="true"[^>]*disabled/.test(renderedOwnerOsHtml) &&
  renderedOwnerOsHtml.includes("真实创建需要单独确认，本阶段不会执行。");

const realRunButtonEnabled = /data-owner-command-real-run-gated="true"(?![^>]*disabled)/.test(renderedOwnerOsHtml);
const executionButtonAdded = /data-owner-command-real-run="true"|立即真实创建/.test(renderedOwnerOsHtml);
const desktopFileListVisible = /data-owner-desktop-file-list|data-desktop-file-list|桌面文件列表|desktop file list/i.test(renderedOwnerOsHtml);
const bulkFileActionVisible = /data-owner-bulk-file-action|data-bulk-file-action|批量创建|批量文件|bulk file/i.test(renderedOwnerOsHtml);

const data = evidence.data ?? {};

const checks = [
  check("phase1900_ready", phase1900Ready),
  check("phase1883_dry_run_ready", phase1883DryRunReady),
  check("render_owner_os_html_success", renderError === null && renderedOwnerOsHtml.length > 0),
  check("card_component_has_preview_drawer_marker", has(cardText, "data-owner-command-dry-run-preview-drawer")),
  check("copy_has_preview_drawer_copy", has(copyText, "预览会展示将要创建的表格内容，但不会写入桌面。")),
  check("theme_has_preview_drawer_styles", has(themeText, "owner-command-preview-drawer-body")),
  check("preview_drawer_polished", previewDrawerPolished),
  check("preview_drawer_hierarchy_clear", previewDrawerHierarchyClear),
  check("dry_run_evidence_refs_visible", dryRunEvidenceRefsVisible),
  check("evidence_drawer_keeps_refs", evidenceDrawerKeepsRefs),
  check("real_run_still_gated", realRunStillGated),
  check("real_run_button_enabled_false", realRunButtonEnabled === false),
  check("execution_button_not_added", executionButtonAdded === false),
  check("desktop_file_list_visible_false", desktopFileListVisible === false),
  check("bulk_file_action_visible_false", bulkFileActionVisible === false),
  check("docs_exists", has(docsText, "Phase1901A") && has(docsText, "dry-run preview drawer polish")),
  check("evidence_exists", evidence.exists === true && !evidence.parseErrorReason),
  check("evidence_completed_true", data.completed === true),
  check("evidence_recommended_sealed_true", data.recommended_sealed === true),
  check("evidence_blocker_null", data.blocker === null),
  check("evidence_preview_drawer_polished_true", data.previewDrawerPolished === true),
  check("evidence_preview_evidence_refs_visible_true", data.previewEvidenceRefsVisible === true),
  check("evidence_real_execution_capability_expanded_false", data.realExecutionCapabilityExpanded === false),
  check("evidence_new_file_created_false", data.newFileCreated === false),
  check("evidence_desktop_scan_performed_false", data.desktopScanPerformed === false),
  check("evidence_desktop_other_files_read_false", data.desktopOtherFilesRead === false),
  check("evidence_provider_calls_made_false", data.providerCallsMade === false),
  check("evidence_chat_modified_false", data.chatModified === false),
  check("evidence_chat_gateway_execute_modified_false", data.chatGatewayExecuteModified === false),
  check("package_script_present", scripts[scriptName] === scriptCommand),
  check("secret_value_exposed_false", containsSecretLikeValue(combinedText) === false),
  check("raw_base_url_value_exposed_false", containsRawBaseUrlValue(combinedText) === false),
  check("webhook_value_exposed_false", containsWebhookLikeValue(combinedText) === false),
];

const result = {
  phase: "Phase1901A",
  routeChoice: "Route A / local_self_use_only",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase1900Ready,
  phase1883DryRunReady,
  commandPaletteVisible: renderedOwnerOsHtml.includes('data-owner-automation-command-palette="true"'),
  previewDrawerPolished,
  previewDrawerHierarchyClear,
  previewEvidenceRefsVisible: dryRunEvidenceRefsVisible,
  evidenceDrawerKeepsRefs,
  dryRunPreviewEntryVisible: previewDrawerHtml.length > 0,
  realRunApprovalRequiredVisible: realRunStillGated,
  realRunButtonEnabled,
  executionButtonAdded,
  realExecutionCapabilityExpanded: false,
  desktopFileListVisible,
  bulkFileActionVisible,
  newFileCreated: false,
  desktopScanPerformed: false,
  desktopOtherFilesRead: false,
  providerCallsMade: false,
  legacyScriptsExecuted: false,
  rawSecretRead: false,
  authJsonRead: false,
  rawCredentialRefRead: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  productionReadyClaimed: false,
  evidencePath: paths.evidence,
  previewDrawerEvidenceRefs: {
    dryRun: paths.phase1883,
    phase1900Seal: paths.phase1900,
    contract: "docs/automation/create-desktop-spreadsheet-action-contract.json",
  },
  currentSealableScope:
    "Command Palette v1 dry-run preview drawer copy, hierarchy, and evidence references only.",
  currentUnsealableScope:
    "Real desktop file creation from the palette, ungated execution, batch file actions, desktop scan/read, Provider calls, /chat integration, /chat-gateway/execute integration, deploy, release, and production readiness.",
  renderError,
  ...safetyBoundary(),
};

finalize(result, checks, paths.evidence, "phase1901a_command_palette_dry_run_preview_drawer_polish_failed");
