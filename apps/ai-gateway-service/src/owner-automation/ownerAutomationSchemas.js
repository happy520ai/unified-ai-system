export const ownerAutomationActionRuntimeSchema = Object.freeze({
  version: "phase1903.ownerAutomationActionRuntime.v1",
  whitelistedActionIds: ["create_desktop_spreadsheet", "batch_create_desktop_spreadsheets"],
  defaultOutputDirectory: "Desktop",
  neverOverwrite: true,
  appendTimestamp: true,
  desktopScanAllowed: false,
  readOtherDesktopFilesAllowed: false,
  deleteMoveOverwriteAllowed: false,
  providerCallsAllowed: false,
});

export const ownerAutomationApprovalInputSchema = Object.freeze({
  version: "phase1903.ownerAutomationApprovalInput.v1",
  requiredBooleansForRealRun: [
    "ownerApproved",
    "allowRealDesktopFileCreation",
    "allowOverwrite:false",
    "allowDesktopScan:false",
    "allowReadOtherDesktopFiles:false",
  ],
  requiredOutputDirectory: "Desktop",
  maxRealFileCreateCountDefault: 1,
  batchMaxCount: 3,
  batchHardMaxCount: 5,
});

export const ownerAutomationEvidenceSchema = Object.freeze({
  version: "phase1903.ownerAutomationEvidence.v1",
  requiredFields: [
    "phase",
    "actionId",
    "dryRun",
    "approvalRequired",
    "desktopFileCreated",
    "desktopFileCreatedCount",
    "overwriteDetected",
    "desktopScanPerformed",
    "desktopOtherFilesRead",
    "providerCallsMade",
    "secretValueExposed",
  ],
  secretFieldsForbidden: true,
});

export const ownerAutomationRouteMatrix = Object.freeze([
  {
    route: "Command Palette -> dry-run",
    execution: "dry-run preview only",
    providerCallsMade: false,
  },
  {
    route: "Command Palette -> approval-bound real-run",
    execution: "real file creation only after owner approval input",
    providerCallsMade: false,
  },
  {
    route: "/chat -> action proposal",
    execution: "proposal only when shadow flag is enabled",
    providerCallsMade: false,
  },
  {
    route: "/chat -> approval-bound execution only",
    execution: "local action only after feature flags and owner approval input",
    providerCallsMade: false,
  },
  {
    route: "/chat-gateway/execute untouched by default",
    execution: "provider chain remains unchanged",
    providerCallsMade: "unchanged",
  },
]);
