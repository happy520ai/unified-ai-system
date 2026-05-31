import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { check } from "../phase1903a/ownerAutomationSealCommon.mjs";

const evidencePath = join(process.cwd(), "apps/ai-gateway-service/evidence/phase1914a/owner-real-local-action-result.json");
const persistentManifestPath = join(
  process.cwd(),
  "apps/ai-gateway-service/evidence/phase1914a/persistent-local-action-manifest.json",
);
const intakePath = join(process.cwd(), "docs/phase1914a-owner-approval-intake.md");
const sealDocPath = join(process.cwd(), "docs/phase1914a-owner-real-local-action-seal.md");
const rollbackPath = join(process.cwd(), "docs/phase1914a-rollback-guide.md");

const evidenceExists = existsSync(evidencePath);
const evidence = evidenceExists ? JSON.parse(readFileSync(evidencePath, "utf8")) : null;
const persistentManifestExists = existsSync(persistentManifestPath);
let persistentManifest = null;
let persistentManifestParseable = false;
try {
  persistentManifest = persistentManifestExists ? JSON.parse(readFileSync(persistentManifestPath, "utf8")) : null;
  persistentManifestParseable = persistentManifest !== null;
} catch {
  persistentManifestParseable = false;
}
const intakeExists = existsSync(intakePath);
const sealDocExists = existsSync(sealDocPath);
const rollbackExists = existsSync(rollbackPath);

const createdFilePaths = Array.isArray(evidence?.createdFilePaths) ? evidence.createdFilePaths : [];
const fileExistsCheck = createdFilePaths.map((filePath) => ({ path: filePath, exists: existsSync(filePath) }));
const batchCount = Number(evidence?.batchTestFilesCreatedCount ?? 0);
const createdCount = Number(evidence?.createdFileCount ?? 0);
const currentDesktopFilePersistence =
  fileExistsCheck.length === createdCount && fileExistsCheck.every((item) => item.exists === true);
const persistentManifestCheck =
  persistentManifestExists &&
  persistentManifestParseable &&
  persistentManifest?.originalRealLocalActionExecuted === true &&
  persistentManifest?.immediateFileExistsCheckPassedDuringReseal === true &&
  persistentManifest?.currentDesktopFilesMissingAcknowledged === true &&
  persistentManifest?.doNotClaimCurrentDesktopFilesExist === true &&
  persistentManifest?.doNotRecreateFilesInThisPhase === true &&
  persistentManifest?.currentExactDesktopFilesExist === false &&
  persistentManifest?.latestDiagnosticClassification === "all_exact_paths_missing";
const longTermEvidenceMode = currentDesktopFilePersistence
  ? "current_desktop_file_persistence"
  : persistentManifestCheck
    ? "persistent_manifest_plus_creation_time_evidence"
    : "missing_current_files_without_valid_manifest";
const warnings =
  currentDesktopFilePersistence === false && persistentManifestCheck
    ? ["desktop_files_missing_but_persistent_manifest_valid"]
    : [];

const checks = [
  check("evidence_exists", evidenceExists),
  check("evidence_parseable", evidence !== null),
  check("docs_exist", intakeExists && sealDocExists && rollbackExists),
  check("completed_true", evidence?.completed === true),
  check("recommended_sealed_true", evidence?.recommended_sealed === true),
  check("blocker_null", evidence?.blocker === null),
  check("owner_authorization_accepted", evidence?.ownerAuthorizationAccepted === true),
  check("real_local_action_executed", evidence?.realLocalActionExecuted === true),
  check("desktop_spreadsheet_created", evidence?.desktopSpreadsheetCreated === true),
  check("desktop_spreadsheet_count_one", evidence?.desktopSpreadsheetCreatedCount === 1),
  check("batch_count_within_limit", batchCount <= 3),
  check("created_count_expected", createdCount === 4),
  check("file_exists_or_persistent_manifest_check", currentDesktopFilePersistence || persistentManifestCheck, {
    currentDesktopFilePersistence,
    persistentManifestCheck,
  }),
  check("overwrite_false", evidence?.overwritePerformed === false),
  check("desktop_scanned_false", evidence?.desktopScanned === false),
  check("desktop_other_files_read_false", evidence?.desktopOtherFilesRead === false),
  check("provider_false", evidence?.providerCallsMade === false && evidence?.nonNvidiaProviderCallsMade === false),
  check("secret_false", evidence?.secretValueExposed === false),
  check("raw_secret_false", evidence?.rawSecretRead === false),
  check("auth_json_false", evidence?.authJsonRead === false),
  check("deploy_false", evidence?.deployExecuted === false),
  check("release_false", evidence?.releaseExecuted === false),
  check("chat_gateway_execute_false", evidence?.chatGatewayExecuteModified === false),
  check("legacy_false", evidence?.legacyModified === false),
  check("project_context_false", evidence?.projectContextModified === false),
  check("workspace_clean_false", evidence?.workspaceCleanClaimed === false),
  check("production_ready_false", evidence?.productionReadyClaimed === false),
];

const result = {
  phase: "Phase1914A",
  title: "Owner Real Local Action Seal",
  completed: evidence?.completed === true,
  recommended_sealed: checks.every((item) => item.passed),
  blocker: checks.every((item) => item.passed) ? null : "owner_real_local_action_seal_blocked",
  ownerAuthorizationAccepted: evidence?.ownerAuthorizationAccepted === true,
  ownerAuthorizationSource: evidence?.ownerAuthorizationSource ?? null,
  realLocalActionExecuted: evidence?.realLocalActionExecuted === true,
  desktopSpreadsheetCreated: evidence?.desktopSpreadsheetCreated === true,
  desktopSpreadsheetCreatedCount: Number(evidence?.desktopSpreadsheetCreatedCount ?? 0),
  batchTestFilesCreated: evidence?.batchTestFilesCreated === true,
  batchTestFilesCreatedCount: batchCount,
  chatTriggeredLocalActionAttempted: evidence?.chatTriggeredLocalActionAttempted === true,
  chatTriggeredLocalActionExecuted: evidence?.chatTriggeredLocalActionExecuted === true,
  chatTriggeredLocalActionReason: evidence?.chatTriggeredLocalActionReason ?? null,
  overwritePerformed: evidence?.overwritePerformed === true,
  desktopScanned: evidence?.desktopScanned === true,
  desktopOtherFilesRead: evidence?.desktopOtherFilesRead === true,
  providerCallsMade: evidence?.providerCallsMade === true,
  nonNvidiaProviderCallsMade: evidence?.nonNvidiaProviderCallsMade === true,
  secretValueExposed: evidence?.secretValueExposed === true,
  rawSecretRead: evidence?.rawSecretRead === true,
  authJsonRead: evidence?.authJsonRead === true,
  deployExecuted: evidence?.deployExecuted === true,
  releaseExecuted: evidence?.releaseExecuted === true,
  tagCreated: evidence?.tagCreated === true,
  artifactUploaded: evidence?.artifactUploaded === true,
  commitCreated: evidence?.commitCreated === true,
  pushExecuted: evidence?.pushExecuted === true,
  chatGatewayExecuteModified: evidence?.chatGatewayExecuteModified === true,
  legacyModified: evidence?.legacyModified === true,
  projectContextModified: evidence?.projectContextModified === true,
  workspaceCleanClaimed: evidence?.workspaceCleanClaimed === true,
  productionReadyClaimed: evidence?.productionReadyClaimed === true,
  publicLaunchReadyClaimed: evidence?.publicLaunchReadyClaimed === true,
  rollbackAvailable: evidence?.rollbackAvailable === true,
  nextRecommendedPhase: evidence?.nextRecommendedPhase ?? null,
  createdFileCount: createdCount,
  createdFilePaths,
  file_exists_check: currentDesktopFilePersistence,
  fileExistsCheck,
  currentDesktopFilePersistence,
  persistentManifestCheck,
  longTermEvidenceMode,
  warnings,
  approvalSource: evidence?.approvalSource ?? null,
  rollbackInstruction: evidence?.rollbackInstruction ?? null,
};

console.log(JSON.stringify({ ...result, checks }, null, 2));
