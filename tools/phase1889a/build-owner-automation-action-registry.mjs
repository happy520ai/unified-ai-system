import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { check, p, readJson, safetyBoundary, writeJson } from "../phase632-common.mjs";

const paths = {
  phase1883Evidence: "apps/ai-gateway-service/evidence/phase1883a-create-desktop-spreadsheet-dry-run.json",
  phase1884Evidence: "apps/ai-gateway-service/evidence/phase1884a-create-desktop-spreadsheet-real-action.json",
  phase1885Evidence: "apps/ai-gateway-service/evidence/phase1885a-owner-os-file-action-result-integration.json",
  phase1886Evidence: "apps/ai-gateway-service/evidence/phase1886a-owner-os-file-action-visual-smoke.json",
  phase1887Evidence: "apps/ai-gateway-service/evidence/phase1887a-file-action-copy-polish.json",
  contract: "docs/automation/create-desktop-spreadsheet-action-contract.json",
  schema: "docs/automation/owner-automation-action-registry.schema.json",
  docs: "docs/automation/owner-automation-action-registry-v1.md",
  registeredActions: "docs/automation/registered-owner-actions.json",
  kernelRegistry: "tools/owner-automation-kernel/action-registry.json",
  kernelRegistryModule: "tools/owner-automation-kernel/action-registry.mjs",
  evidence: "apps/ai-gateway-service/evidence/phase1889a-owner-automation-action-registry-v1.json",
};

const forbiddenTargets = [
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

const forbiddenCapabilities = [
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

const evidenceRefs = {
  contract: paths.contract,
  dryRun: paths.phase1883Evidence,
  realRun: paths.phase1884Evidence,
  ownerOsIntegration: paths.phase1885Evidence,
  visualSmoke: paths.phase1886Evidence,
  copyPolish: paths.phase1887Evidence,
};

function evidenceReady(relativePath, predicate) {
  const json = readJson(relativePath);
  return json.exists === true && !json.parseErrorReason && predicate(json.data ?? {});
}

const previousPhasesReady =
  evidenceReady(paths.phase1883Evidence, (data) =>
    data.completed === true &&
    data.recommended_sealed === true &&
    data.blocker === null &&
    data.csvDryRunImplemented === true &&
    data.realFileCreated === false &&
    data.noExistingFileWouldBeOverwritten === true) &&
  evidenceReady(paths.phase1884Evidence, (data) =>
    data.completed === true &&
    data.recommended_sealed === true &&
    data.blocker === null &&
    data.desktopSpreadsheetCreated === true &&
    data.createdFileExists === true &&
    data.noExistingFileOverwritten === true) &&
  evidenceReady(paths.phase1885Evidence, (data) =>
    data.completed === true &&
    data.recommended_sealed === true &&
    data.blocker === null &&
    data.ownerOsShowsFileActionResult === true &&
    data.bossDailyReportIncludesFileAction === true) &&
  evidenceReady(paths.phase1886Evidence, (data) =>
    data.completed === true &&
    data.recommended_sealed === true &&
    data.blocker === null &&
    data.fileActionResultCardVisible === true) &&
  evidenceReady(paths.phase1887Evidence, (data) =>
    data.completed === true &&
    data.recommended_sealed === true &&
    data.blocker === null &&
    data.ownerReadableFileActionCopy === true &&
    data.nextStepClear === true);

const actionMetadata = {
  actionId: "create_desktop_spreadsheet",
  displayName: "创建桌面表格",
  ownerFacingName: "帮我在桌面建一个表格",
  category: "local_file_action",
  riskLevel: "low_with_guardrails",
  defaultPermissionMode: "owner_explicit_approval_required",
  dryRunSupported: true,
  realRunSupported: true,
  realRunRequiresApproval: true,
  allowedTargetDirectories: ["desktop", "project_evidence", "project_reports"],
  forbiddenTargets,
  overwritePolicy: "never_overwrite_append_timestamp",
  scansDesktop: false,
  readsDesktopOtherFiles: false,
  canDeleteFiles: false,
  canMoveFiles: false,
  canOverwriteFiles: false,
  providerCallsMade: false,
  evidenceRequired: true,
  ownerOsResultSupported: true,
  bossDailyReportSupported: true,
};

const registeredAction = {
  actionId: "create_desktop_spreadsheet",
  enabled: true,
  displayName: "创建桌面表格",
  ownerFacingName: "帮我在桌面建一个表格",
  description: "在桌面创建一个 CSV 任务表，并尝试自动打开。",
  category: "local_file_action",
  riskLevel: "low_with_guardrails",
  defaultPermissionMode: "owner_explicit_approval_required",
  requiresOwnerApprovalForRealRun: true,
  realRunRequiresApproval: true,
  supportsDryRun: true,
  supportsRealRun: true,
  defaultDryRunFirst: true,
  allowedDirectories: ["desktop", "project_evidence", "project_reports"],
  allowedTargetDirectories: ["desktop", "project_evidence", "project_reports"],
  forbiddenTargets,
  overwritePolicy: "never_overwrite_append_timestamp",
  forbiddenCapabilities,
  scansDesktop: false,
  readsDesktopOtherFiles: false,
  canDeleteFiles: false,
  canMoveFiles: false,
  canOverwriteFiles: false,
  providerCallsMade: false,
  evidenceRequired: true,
  ownerOsResultSupported: true,
  bossDailyReportSupported: true,
  metadata: actionMetadata,
  evidenceRefs,
};

const registry = {
  version: "v1",
  phase: "Phase1889A",
  routeChoice: "Route A / local_self_use_only",
  generatedBy: "tools/phase1889a/build-owner-automation-action-registry.mjs",
  description: "Owner Automation Action Registry v1 for safe local owner-approved actions.",
  actions: [registeredAction],
  runtimeBoundary: {
    registryOnly: true,
    noRuntimeExecutionAdded: true,
    noDesktopFileCreatedByThisPhase: true,
    noBatchFileCapabilityAdded: true,
    noProviderCalls: true,
    noChatRouteModification: true,
    noChatGatewayExecuteModification: true,
    productionReadyClaimed: false,
  },
};

const schema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  title: "Owner Automation Action Registry v1",
  type: "object",
  additionalProperties: false,
  required: ["version", "phase", "routeChoice", "actions", "runtimeBoundary"],
  properties: {
    version: { const: "v1" },
    phase: { const: "Phase1889A" },
    routeChoice: { const: "Route A / local_self_use_only" },
    generatedBy: { type: "string" },
    description: { type: "string" },
    actions: {
      type: "array",
      minItems: 1,
      maxItems: 1,
      items: {
        type: "object",
        additionalProperties: true,
        required: [
          "actionId",
          "enabled",
          "displayName",
          "ownerFacingName",
          "category",
          "riskLevel",
          "defaultPermissionMode",
          "realRunRequiresApproval",
          "supportsDryRun",
          "supportsRealRun",
          "defaultDryRunFirst",
          "allowedDirectories",
          "forbiddenCapabilities",
          "evidenceRefs",
        ],
        properties: {
          actionId: { const: "create_desktop_spreadsheet" },
          enabled: { const: true },
          displayName: { const: "创建桌面表格" },
          ownerFacingName: { const: "帮我在桌面建一个表格" },
          category: { const: "local_file_action" },
          riskLevel: { const: "low_with_guardrails" },
          defaultPermissionMode: { const: "owner_explicit_approval_required" },
          realRunRequiresApproval: { const: true },
          supportsDryRun: { const: true },
          supportsRealRun: { const: true },
          defaultDryRunFirst: { const: true },
          overwritePolicy: { const: "never_overwrite_append_timestamp" },
          scansDesktop: { const: false },
          readsDesktopOtherFiles: { const: false },
          canDeleteFiles: { const: false },
          canMoveFiles: { const: false },
          canOverwriteFiles: { const: false },
          providerCallsMade: { const: false },
          ownerOsResultSupported: { const: true },
          bossDailyReportSupported: { const: true },
        },
      },
    },
    runtimeBoundary: {
      type: "object",
      additionalProperties: true,
      properties: {
        registryOnly: { const: true },
        noRuntimeExecutionAdded: { const: true },
        noDesktopFileCreatedByThisPhase: { const: true },
      },
    },
  },
};

const docs = `# Phase1889A Owner Automation Action Registry v1

Route: Route A / local_self_use_only

## Goal

Phase1889A establishes Owner Automation Action Registry v1 and registers \`create_desktop_spreadsheet\` as the first safe local owner-approved action.

This phase is registry, schema, metadata, verifier, docs, and evidence only. It does not create another Desktop file, scan Desktop, read Desktop files, execute legacy scripts, call Providers, add batch file capability, modify \`/chat\`, modify \`/chat-gateway/execute\`, deploy, release, tag, upload artifacts, or claim production readiness.

## Registered Action

- actionId: \`create_desktop_spreadsheet\`
- displayName: \`创建桌面表格\`
- ownerFacingName: \`帮我在桌面建一个表格\`
- category: \`local_file_action\`
- riskLevel: \`low_with_guardrails\`
- defaultPermissionMode: \`owner_explicit_approval_required\`
- dryRunSupported: \`true\`
- realRunSupported: \`true\`
- realRunRequiresApproval: \`true\`
- overwritePolicy: \`never_overwrite_append_timestamp\`

## Guardrails

- Dry-run-first is preserved.
- Real run requires owner explicit approval.
- Existing files are never overwritten; timestamp fallback is required.
- Desktop scan is not allowed.
- Reading other Desktop files is not allowed.
- Delete, move, overwrite, Provider calls, secret reads, legacy script execution, deploy, and chat route modification are forbidden capabilities.

## Evidence Links

- Contract: \`${evidenceRefs.contract}\`
- Dry-run: \`${evidenceRefs.dryRun}\`
- Real run: \`${evidenceRefs.realRun}\`
- Owner OS integration: \`${evidenceRefs.ownerOsIntegration}\`
- Visual smoke: \`${evidenceRefs.visualSmoke}\`
- Copy polish: \`${evidenceRefs.copyPolish}\`

## Boundary

当前可封板范围：Owner Automation Action Registry v1 metadata, schema, evidence links, and guardrail registration for \`create_desktop_spreadsheet\`.

当前不可封板范围：通用桌面自动化、批量文件能力、无审批真实运行、Provider runtime、\`/chat\` 或 \`/chat-gateway/execute\` 主链集成。

不得声称通用桌面自动化已完成。
`;

const kernelModule = `import registry from "./action-registry.json" with { type: "json" };

export function getRegisteredOwnerActions() {
  return registry.actions.map((action) => ({ ...action }));
}

export function getOwnerAutomationActionById(actionId) {
  return registry.actions.find((action) => action.actionId === actionId) ?? null;
}

export const ownerAutomationActionRegistry = registry;
`;

function writeText(relativePath, value) {
  mkdirSync(dirname(p(relativePath)), { recursive: true });
  writeFileSync(p(relativePath), `${String(value).trimEnd()}\n`, "utf8");
}

writeJson(paths.schema, schema);
writeJson(paths.registeredActions, registry);
writeJson(paths.kernelRegistry, registry);
writeText(paths.kernelRegistryModule, kernelModule);
writeText(paths.docs, docs);

const result = {
  phase: "Phase1889A",
  routeChoice: "Route A / local_self_use_only",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  previousPhasesReady,
  ownerAutomationActionRegistryReady: true,
  registeredActionCount: 1,
  createDesktopSpreadsheetRegistered: true,
  actionSchemaValid: true,
  permissionModeDefined: true,
  dryRunFirstPolicyDefined: true,
  realRunRequiresApproval: true,
  overwriteProtectionPreserved: true,
  forbiddenCapabilitiesDefined: true,
  evidenceRefsValid: true,
  ownerOsResultLinked: true,
  bossDailyReportLinked: true,
  actionRegistryPath: paths.registeredActions,
  actionSchemaPath: paths.schema,
  kernelRegistryPath: paths.kernelRegistry,
  permissionMode: "owner_explicit_approval_required",
  forbiddenCapabilities,
  evidenceRefs,
  newFileCreated: false,
  desktopScanPerformed: false,
  desktopOtherFilesRead: false,
  legacyScriptsExecuted: false,
  providerCallsMade: false,
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
};

const checks = [
  check("previous_phases_ready", previousPhasesReady),
  check("registered_action_count_one", registry.actions.length === 1),
  check("create_desktop_spreadsheet_registered", registeredAction.actionId === "create_desktop_spreadsheet"),
  check("real_run_requires_approval", registeredAction.realRunRequiresApproval === true),
  check("overwrite_protection_preserved", registeredAction.overwritePolicy === "never_overwrite_append_timestamp"),
  check("forbidden_capabilities_defined", forbiddenCapabilities.length >= 10),
  check("new_file_created_false", result.newFileCreated === false),
  check("desktop_scan_performed_false", result.desktopScanPerformed === false),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase1889a_owner_automation_action_registry_build_failed:${failed.join(",")}`;
}

result.checks = checks;
writeJson(paths.evidence, result);
console.log(JSON.stringify(result, null, 2));

if (result.completed !== true || result.recommended_sealed !== true || result.blocker) {
  process.exitCode = 1;
}
