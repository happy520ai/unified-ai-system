import { existsSync, statSync } from "node:fs";
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
  phase1889: "apps/ai-gateway-service/evidence/phase1889a-owner-automation-action-registry-v1.json",
  phase1891: "apps/ai-gateway-service/evidence/phase1891a-owner-automation-command-palette-v1.json",
  phase1899: "apps/ai-gateway-service/evidence/phase1899a-command-palette-visual-smoke.json",
  registry: "docs/automation/registered-owner-actions.json",
  schema: "docs/automation/owner-automation-action-registry.schema.json",
  visualScreenshot: "apps/ai-gateway-service/evidence/phase1899a/screenshots/command-palette-visual-smoke.png",
  visualDomSnapshot: "apps/ai-gateway-service/evidence/phase1899a/command-palette-visual-smoke.html",
  builder: "tools/phase1900a/build-command-palette-v1-seal.mjs",
  verifier: "tools/phase1900a/validate-command-palette-v1-seal.mjs",
  docs: "docs/automation/phase1900a-command-palette-v1-seal.md",
  evidence: "apps/ai-gateway-service/evidence/phase1900a-command-palette-v1-seal.json",
  packageJson: "package.json",
};

const scriptName = "verify:phase1900a-command-palette-v1-seal";
const scriptCommand = "node tools/phase1900a/build-command-palette-v1-seal.mjs && node tools/phase1900a/validate-command-palette-v1-seal.mjs";

const phase1889 = readJson(paths.phase1889);
const phase1891 = readJson(paths.phase1891);
const phase1899 = readJson(paths.phase1899);
const registry = readJson(paths.registry);
const evidence = readJson(paths.evidence);
const packageJson = readJson(paths.packageJson);
const builderText = readText(paths.builder);
const verifierText = readText(paths.verifier);
const docsText = readText(paths.docs);
const evidenceText = readText(paths.evidence);
const domText = readText(paths.visualDomSnapshot);
const combinedText = [builderText, verifierText, docsText, evidenceText, domText].join("\n");

const registryActions = Array.isArray(registry.data?.actions) ? registry.data.actions : [];
const registeredAction = registryActions.find((item) => item?.actionId === "create_desktop_spreadsheet") ?? {};
const data = evidence.data ?? {};
const scripts = packageJson.data?.scripts ?? {};

function fileExists(relativePath) {
  return existsSync(p(relativePath));
}

function fileSize(relativePath) {
  return fileExists(relativePath) ? statSync(p(relativePath)).size : 0;
}

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

const phase1891Ready =
  phase1891.exists === true &&
  !phase1891.parseErrorReason &&
  phase1891.data?.completed === true &&
  phase1891.data?.recommended_sealed === true &&
  phase1891.data?.blocker === null &&
  phase1891.data?.commandPaletteVisible === true &&
  phase1891.data?.registeredActionCount === 1 &&
  phase1891.data?.createDesktopSpreadsheetCommandVisible === true &&
  phase1891.data?.dryRunPreviewEntryVisible === true &&
  phase1891.data?.realRunApprovalRequiredVisible === true &&
  phase1891.data?.realRunButtonEnabled === false;

const phase1899Ready =
  phase1899.exists === true &&
  !phase1899.parseErrorReason &&
  phase1899.data?.completed === true &&
  phase1899.data?.recommended_sealed === true &&
  phase1899.data?.blocker === null &&
  phase1899.data?.ownerOsOpened === true &&
  phase1899.data?.uiOpened === true &&
  phase1899.data?.commandPaletteVisible === true &&
  phase1899.data?.registeredActionCount === 1 &&
  phase1899.data?.createDesktopSpreadsheetCommandVisible === true &&
  phase1899.data?.dryRunPreviewEntryVisible === true &&
  phase1899.data?.realRunApprovalRequiredVisible === true &&
  phase1899.data?.realRunButtonEnabled === false &&
  phase1899.data?.desktopFileListVisible === false &&
  phase1899.data?.bulkFileActionVisible === false &&
  phase1899.data?.newFileCreated === false &&
  phase1899.data?.desktopScanPerformed === false &&
  phase1899.data?.desktopOtherFilesRead === false;

const registryLocked =
  registry.exists === true &&
  !registry.parseErrorReason &&
  registryActions.length === 1 &&
  registeredAction.actionId === "create_desktop_spreadsheet" &&
  registeredAction.requiresOwnerApprovalForRealRun === true &&
  registeredAction.supportsDryRun === true &&
  registeredAction.supportsRealRun === true &&
  registeredAction.defaultDryRunFirst === true &&
  registeredAction.overwritePolicy === "never_overwrite_append_timestamp";

const visualArtifactsReady =
  fileExists(paths.visualScreenshot) &&
  fileSize(paths.visualScreenshot) > 0 &&
  fileExists(paths.visualDomSnapshot) &&
  fileSize(paths.visualDomSnapshot) > 0 &&
  domText.includes('data-owner-automation-command-palette="true"') &&
  domText.includes('data-owner-automation-action-id="create_desktop_spreadsheet"') &&
  domText.includes('data-owner-command-real-run-gated="true"');

const sealEvidenceReady =
  evidence.exists === true &&
  !evidence.parseErrorReason &&
  data.completed === true &&
  data.recommended_sealed === true &&
  data.blocker === null &&
  data.commandPaletteV1Sealed === true &&
  data.evidenceBundleComplete === true &&
  data.registeredActionCount === 1 &&
  data.createDesktopSpreadsheetCommandVisible === true &&
  data.realRunButtonEnabled === false &&
  data.realExecutionCapabilityExpanded === false &&
  data.newFileCreated === false &&
  data.desktopScanPerformed === false &&
  data.desktopOtherFilesRead === false &&
  data.providerCallsMade === false &&
  data.chatModified === false &&
  data.chatGatewayExecuteModified === false;

const checks = [
  check("phase1889_ready", phase1889Ready),
  check("phase1891_ready", phase1891Ready),
  check("phase1899_ready", phase1899Ready),
  check("registry_locked", registryLocked),
  check("visual_artifacts_ready", visualArtifactsReady),
  check("builder_exists", has(builderText, "Phase1900A") && has(builderText, "commandPaletteV1Sealed")),
  check("verifier_exists", has(verifierText, "Phase1900A") && has(verifierText, "commandPaletteV1Sealed")),
  check("docs_exists", has(docsText, "Phase1900A") && has(docsText, "Command Palette v1 Seal")),
  check("phase_evidence_ready", sealEvidenceReady),
  check("evidence_refs_include_1889", data.evidenceRefs?.registry === paths.phase1889),
  check("evidence_refs_include_1891", data.evidenceRefs?.uiContract === paths.phase1891),
  check("evidence_refs_include_1899", data.evidenceRefs?.visualSmoke === paths.phase1899),
  check("screenshot_linked", data.screenshotPath === paths.visualScreenshot),
  check("dom_snapshot_linked", data.domSnapshotPath === paths.visualDomSnapshot),
  check("package_script_present", scripts[scriptName] === scriptCommand),
  check("real_run_button_enabled_false", data.realRunButtonEnabled === false),
  check("real_execution_capability_expanded_false", data.realExecutionCapabilityExpanded === false),
  check("new_file_created_false", data.newFileCreated === false),
  check("desktop_scan_performed_false", data.desktopScanPerformed === false),
  check("desktop_other_files_read_false", data.desktopOtherFilesRead === false),
  check("bulk_file_action_visible_false", data.bulkFileActionVisible === false),
  check("desktop_file_list_visible_false", data.desktopFileListVisible === false),
  check("legacy_scripts_executed_false", data.legacyScriptsExecuted === false),
  check("provider_calls_made_false", data.providerCallsMade === false),
  check("raw_secret_read_false", data.rawSecretRead === false),
  check("auth_json_read_false", data.authJsonRead === false),
  check("raw_credential_ref_read_false", data.rawCredentialRefRead === false),
  check("chat_modified_false", data.chatModified === false),
  check("chat_gateway_execute_modified_false", data.chatGatewayExecuteModified === false),
  check("deploy_executed_false", data.deployExecuted === false),
  check("production_ready_claimed_false", data.productionReadyClaimed === false),
  check("secret_value_exposed_false", containsSecretLikeValue(combinedText) === false),
  check("raw_base_url_value_exposed_false", containsRawBaseUrlValue(combinedText) === false),
  check("webhook_value_exposed_false", containsWebhookLikeValue(combinedText) === false),
];

const result = {
  phase: "Phase1900A",
  routeChoice: "Route A / local_self_use_only",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase1889Ready,
  phase1891Ready,
  phase1899Ready,
  registryLocked,
  visualArtifactsReady,
  commandPaletteV1Sealed: data.commandPaletteV1Sealed === true,
  evidenceBundleComplete: data.evidenceBundleComplete === true,
  registeredActionCount: data.registeredActionCount ?? null,
  createDesktopSpreadsheetRegistered: data.createDesktopSpreadsheetRegistered === true,
  createDesktopSpreadsheetCommandVisible: data.createDesktopSpreadsheetCommandVisible === true,
  dryRunPreviewEntryVisible: data.dryRunPreviewEntryVisible === true,
  realRunApprovalRequiredVisible: data.realRunApprovalRequiredVisible === true,
  realRunButtonEnabled: data.realRunButtonEnabled === true,
  realExecutionCapabilityExpanded: data.realExecutionCapabilityExpanded === true,
  desktopFileListVisible: data.desktopFileListVisible === true,
  bulkFileActionVisible: data.bulkFileActionVisible === true,
  newFileCreated: data.newFileCreated === true,
  desktopScanPerformed: data.desktopScanPerformed === true,
  desktopOtherFilesRead: data.desktopOtherFilesRead === true,
  screenshotPath: data.screenshotPath ?? paths.visualScreenshot,
  domSnapshotPath: data.domSnapshotPath ?? paths.visualDomSnapshot,
  evidencePath: paths.evidence,
  currentSealableScope: data.currentSealableScope ?? "Command Palette v1 seal evidence bundle.",
  currentUnsealableScope: data.currentUnsealableScope ?? "Real execution and generic desktop automation remain unsealed.",
  ...safetyBoundary(),
  providerCallsMade: data.providerCallsMade === false ? false : data.providerCallsMade,
  legacyScriptsExecuted: data.legacyScriptsExecuted === false ? false : data.legacyScriptsExecuted,
  rawSecretRead: data.rawSecretRead === false ? false : data.rawSecretRead,
  authJsonRead: data.authJsonRead === false ? false : data.authJsonRead,
  rawCredentialRefRead: data.rawCredentialRefRead === false ? false : data.rawCredentialRefRead,
  chatModified: data.chatModified === false ? false : data.chatModified,
  chatGatewayExecuteModified: data.chatGatewayExecuteModified === false ? false : data.chatGatewayExecuteModified,
  deployExecuted: data.deployExecuted === false ? false : data.deployExecuted,
  productionReadyClaimed: data.productionReadyClaimed === false ? false : data.productionReadyClaimed,
};

finalize(result, checks, paths.evidence, "phase1900a_command_palette_v1_seal_failed");
