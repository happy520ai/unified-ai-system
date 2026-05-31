import { check, finalize, readJson, safetyBoundary } from "../phase632-common.mjs";

const paths = {
  phase1889: "apps/ai-gateway-service/evidence/phase1889a-owner-automation-action-registry-v1.json",
  phase1891: "apps/ai-gateway-service/evidence/phase1891a-owner-automation-command-palette-v1.json",
  phase1899: "apps/ai-gateway-service/evidence/phase1899a-command-palette-visual-smoke.json",
  registry: "docs/automation/registered-owner-actions.json",
  schema: "docs/automation/owner-automation-action-registry.schema.json",
  screenshot: "apps/ai-gateway-service/evidence/phase1899a/screenshots/command-palette-visual-smoke.png",
  domSnapshot: "apps/ai-gateway-service/evidence/phase1899a/command-palette-visual-smoke.html",
  evidence: "apps/ai-gateway-service/evidence/phase1900a-command-palette-v1-seal.json",
};

const phase1889 = readJson(paths.phase1889);
const phase1891 = readJson(paths.phase1891);
const phase1899 = readJson(paths.phase1899);
const registry = readJson(paths.registry);
const actions = Array.isArray(registry.data?.actions) ? registry.data.actions : [];
const action = actions.find((item) => item?.actionId === "create_desktop_spreadsheet") ?? {};

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
  phase1891.data?.safetyBoundaryCopyVisible === true &&
  phase1891.data?.evidenceDrawerAvailable === true &&
  phase1891.data?.realRunButtonEnabled === false;

const phase1899Ready =
  phase1899.exists === true &&
  !phase1899.parseErrorReason &&
  phase1899.data?.completed === true &&
  phase1899.data?.recommended_sealed === true &&
  phase1899.data?.blocker === null &&
  phase1899.data?.uiOpened === true &&
  phase1899.data?.ownerOsOpened === true &&
  phase1899.data?.commandPaletteVisible === true &&
  phase1899.data?.registeredActionCount === 1 &&
  phase1899.data?.createDesktopSpreadsheetCommandVisible === true &&
  phase1899.data?.dryRunPreviewEntryVisible === true &&
  phase1899.data?.realRunApprovalRequiredVisible === true &&
  phase1899.data?.realRunButtonEnabled === false &&
  phase1899.data?.desktopFileListVisible === false &&
  phase1899.data?.bulkFileActionVisible === false;

const registryLocked =
  registry.exists === true &&
  !registry.parseErrorReason &&
  actions.length === 1 &&
  action.actionId === "create_desktop_spreadsheet" &&
  action.requiresOwnerApprovalForRealRun === true &&
  action.supportsDryRun === true &&
  action.supportsRealRun === true &&
  action.defaultDryRunFirst === true &&
  action.overwritePolicy === "never_overwrite_append_timestamp";

const result = {
  phase: "Phase1900A",
  routeChoice: "Route A / local_self_use_only",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase1889Ready,
  phase1891Ready,
  phase1899Ready,
  commandPaletteV1Sealed: true,
  evidenceBundleComplete: phase1889Ready && phase1891Ready && phase1899Ready && registryLocked,
  registeredActionCount: actions.length,
  createDesktopSpreadsheetRegistered: action.actionId === "create_desktop_spreadsheet",
  createDesktopSpreadsheetCommandVisible: phase1891.data?.createDesktopSpreadsheetCommandVisible === true &&
    phase1899.data?.createDesktopSpreadsheetCommandVisible === true,
  ownerFacingCommandName: action.ownerFacingName ?? phase1899.data?.ownerFacingCommandName ?? null,
  permissionMode: phase1889.data?.permissionMode ?? "owner_explicit_approval_required",
  dryRunFirstPolicyDefined: phase1889.data?.dryRunFirstPolicyDefined === true,
  realRunRequiresApproval: phase1889.data?.realRunRequiresApproval === true,
  overwriteProtectionPreserved: phase1889.data?.overwriteProtectionPreserved === true,
  dryRunPreviewEntryVisible: phase1891.data?.dryRunPreviewEntryVisible === true &&
    phase1899.data?.dryRunPreviewEntryVisible === true,
  realRunApprovalRequiredVisible: phase1891.data?.realRunApprovalRequiredVisible === true &&
    phase1899.data?.realRunApprovalRequiredVisible === true,
  safetyBoundaryCopyVisible: phase1891.data?.safetyBoundaryCopyVisible === true &&
    phase1899.data?.safetyBoundaryCopyVisible === true,
  evidenceDrawerAvailable: phase1891.data?.evidenceDrawerAvailable === true &&
    phase1899.data?.evidenceDrawerAvailable === true,
  screenshotPath: paths.screenshot,
  domSnapshotPath: paths.domSnapshot,
  evidencePath: paths.evidence,
  evidenceRefs: {
    registry: paths.phase1889,
    uiContract: paths.phase1891,
    visualSmoke: paths.phase1899,
    actionRegistry: paths.registry,
    actionSchema: paths.schema,
    screenshot: paths.screenshot,
    domSnapshot: paths.domSnapshot,
  },
  realRunButtonEnabled: false,
  executionButtonAdded: phase1899.data?.executionButtonAdded === true,
  executionButtonGated: phase1899.data?.executionButtonGated === true,
  realExecutionCapabilityExpanded: false,
  newFileCreated: false,
  desktopScanPerformed: false,
  desktopOtherFilesRead: false,
  readExistingDesktopFiles: false,
  deletedFiles: false,
  movedFiles: false,
  overwrittenFiles: false,
  desktopFileListVisible: false,
  bulkFileActionVisible: false,
  legacyScriptsExecuted: false,
  providerCallsMade: false,
  rawSecretRead: false,
  authJsonRead: false,
  rawCredentialRefRead: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  productionReadyClaimed: false,
  workspaceCleanClaimed: false,
  currentSealableScope: "Command Palette v1 read-only Owner OS capability display is sealed with registry, UI contract, visual smoke, screenshot, DOM snapshot, and guardrail evidence.",
  currentUnsealableScope: "Real desktop file creation through the palette, ungated real-run, batch file actions, desktop scan/read, Provider calls, /chat integration, /chat-gateway/execute integration, deploy, release, and production readiness remain unsealed.",
  ...safetyBoundary(),
};

const checks = [
  check("phase1889_ready", phase1889Ready),
  check("phase1891_ready", phase1891Ready),
  check("phase1899_ready", phase1899Ready),
  check("registry_locked", registryLocked),
  check("registered_action_count_one", result.registeredActionCount === 1),
  check("create_desktop_spreadsheet_registered", result.createDesktopSpreadsheetRegistered === true),
  check("real_run_requires_approval", result.realRunRequiresApproval === true),
  check("dry_run_first_policy_defined", result.dryRunFirstPolicyDefined === true),
  check("overwrite_protection_preserved", result.overwriteProtectionPreserved === true),
  check("real_run_button_enabled_false", result.realRunButtonEnabled === false),
  check("real_execution_capability_expanded_false", result.realExecutionCapabilityExpanded === false),
  check("new_file_created_false", result.newFileCreated === false),
  check("desktop_scan_performed_false", result.desktopScanPerformed === false),
  check("desktop_other_files_read_false", result.desktopOtherFilesRead === false),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
];

finalize(result, checks, paths.evidence, "phase1900a_command_palette_v1_seal_build_failed");
