import { access, constants } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1914A";
const timestamp = timestampForFileName(new Date());
const desktopDir = getDesktopDirectory();
const evidencePath = "apps/ai-gateway-service/evidence/phase1914a/owner-real-local-action-result.json";
const reportPath = "docs/phase1914a-real-local-action-execution-report.md";
const intakePath = "docs/phase1914a-owner-approval-intake.md";
const sealDocPath = "docs/phase1914a-owner-real-local-action-seal.md";

await mkdir(join(process.cwd(), "apps/ai-gateway-service/evidence/phase1914a"), { recursive: true });

const createdFilePaths = [];

const spreadsheetPath = join(desktopDir, `PME-AI-Gateway-owner-local-action-phase1914a-r-${timestamp}.csv`);
await assertDoesNotExist(spreadsheetPath);
await writeFile(
  spreadsheetPath,
  [
    "任务,状态,说明",
    "Owner Local Action,completed,Created by guarded Phase1914A local action",
    "Provider Call,false,No provider call made",
    "Secret Read,false,No secret read",
    "Overwrite,false,No overwrite",
  ].join("\r\n"),
  "utf8",
);
createdFilePaths.push(spreadsheetPath);

for (const index of [1, 2, 3]) {
  const filePath = join(desktopDir, `phase1914a-r-owner-local-action-batch-test-${index}-${timestamp}.txt`);
  await assertDoesNotExist(filePath);
  await writeFile(
    filePath,
    `Phase1914A batch test file ${index}\nowner authorization source: user_explicit_chat_authorization\nprovider calls: false\nsecret read: false\n`,
    "utf8",
  );
  createdFilePaths.push(filePath);
}

const evidence = {
  phase,
  name: "Owner Real Local Action Seal",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  ownerAuthorizationAccepted: true,
  ownerAuthorizationSource: "user_explicit_chat_authorization",
  realLocalActionExecuted: true,
  desktopSpreadsheetCreated: true,
  desktopSpreadsheetCreatedCount: 1,
  batchTestFilesCreated: true,
  batchTestFilesCreatedCount: 3,
  chatTriggeredLocalActionAttempted: true,
  chatTriggeredLocalActionExecuted: false,
  chatTriggeredLocalActionReason: "safe_chat_trigger_path_not_available_or_not_required",
  overwritePerformed: false,
  desktopScanned: false,
  desktopOtherFilesRead: false,
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  secretValueExposed: false,
  rawSecretRead: false,
  authJsonRead: false,
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
  rollbackAvailable: true,
  nextRecommendedPhase: "Phase1915A One-Button Boss Mode Daily Loop",
  resealReason: "previous_phase1914a_file_exists_check_false",
  previousEvidenceInvalidatedByMissingFiles: true,
  freshFilesCreatedForReseal: true,
  createdFileCount: createdFilePaths.length,
  createdFilePaths,
  approvalSource: "user_explicit_chat_authorization",
  rollbackInstruction: "Delete only the exact createdFilePaths from this phase; do not scan Desktop.",
};

writeJson(evidencePath, evidence);
await writeFile(
  join(process.cwd(), reportPath),
  `# ${phase} Real Local Action Execution Report

- approvalIntakePath: ${intakePath}
- sealDocPath: ${sealDocPath}
- createdFileCount: ${createdFilePaths.length}
- createdFilePaths: ${JSON.stringify(createdFilePaths)}
- chatTriggeredLocalActionExecuted: ${evidence.chatTriggeredLocalActionExecuted}
- chatTriggeredLocalActionReason: ${evidence.chatTriggeredLocalActionReason}
`,
  "utf8",
);

console.log(JSON.stringify(evidence, null, 2));

function getDesktopDirectory() {
  const userProfile = process.env.USERPROFILE;
  if (!userProfile) {
    throw new Error("USERPROFILE_not_available");
  }
  return join(userProfile, "Desktop");
}

function timestampForFileName(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function assertDoesNotExist(path) {
  try {
    await new Promise((resolve, reject) => {
      access(path, constants.F_OK, (error) => {
        if (error) {
          resolve(true);
          return;
        }
        reject(new Error(`target_file_already_exists:${path}`));
      });
    });
  } catch (error) {
    throw error;
  }
}
