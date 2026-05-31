import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const docPath = "docs/phase3959a-owner-daily-use-minimum-loop.md";
const templatePath = "docs/owner-daily-use/owner-daily-use-template.json";
const readmePath = "docs/owner-daily-use/owner-daily-use-readme.md";
const resultPath = "apps/ai-gateway-service/evidence/phase3959a-owner-daily-use-minimum-loop/result.json";

function ensureParent(relativePath) {
  mkdirSync(resolve(repoRoot, relativePath, ".."), { recursive: true });
}

function writeJson(relativePath, value) {
  ensureParent(relativePath);
  writeFileSync(resolve(repoRoot, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(relativePath, text) {
  ensureParent(relativePath);
  writeFileSync(resolve(repoRoot, relativePath), text, "utf8");
}

export function prepareOwnerDailyUseMinimumLoop() {
  const ownerDailyUseTemplate = {
    recordId: "owner-daily-use-0001",
    ownerProvided: true,
    createdAt: "YYYY-MM-DDTHH:mm:ss+08:00",
    scenario: "",
    taskAttempted: "",
    entryPointUsed: "",
    expectedOutcome: "",
    actualOutcome: "",
    completed: false,
    friction: "",
    severityHint: "P0 | P1 | P2 | P3 | LowValue",
    screenshotsOrEvidenceRefs: [],
    secretsIncluded: false,
    providerCallRequested: false,
    deployRequested: false,
    chatRouteChangeRequested: false,
    chatGatewayExecuteChangeRequested: false,
    ownerNotes: "",
  };

  const result = {
    completed: true,
    recommendedSealed: true,
    blocker: "owner_daily_use_record_missing",
    ownerDailyUseLoopPrepared: true,
    realOwnerDailyUseRecordCount: 0,
    ownerDailyUseCompleted: false,
    fakeOwnerFeedbackDetected: false,
    codexSelfTestCountedAsOwnerFeedback: false,
    productWorkModeReadyForManualOwnerInput: true,
    providerCallsMade: false,
    secretRead: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    deployExecuted: false,
    controlledMutationExpansionAttempted: false,
    docs: [docPath, templatePath, readmePath],
    rollbackPlan: [
      "Delete tools/phase3959a/",
      "Delete docs/phase3959a-owner-daily-use-minimum-loop.md",
      "Delete apps/ai-gateway-service/evidence/phase3959a-owner-daily-use-minimum-loop/",
      "Delete docs/owner-daily-use template/readme files only; keep records unless owner explicitly asks.",
      "Restore package.json scripts and README/AGENTS managed block lines.",
    ],
  };

  writeJson(templatePath, ownerDailyUseTemplate);
  writeText(
    readmePath,
    `# Owner Daily Use Records\n\nThis folder stores owner-provided daily-use records for Product Work Mode.\n\nManual input file for the first record:\n\n\`docs/owner-daily-use/records/owner-daily-use-0001.json\`\n\nRules:\n\n- Do not count Codex self-tests, automated screenshots, verifier output, or generated evidence as owner feedback.\n- Do not include API keys, tokens, .env content, auth.json content, or raw secrets.\n- Use the template fields from \`owner-daily-use-template.json\`.\n- If no owner record exists, downstream ingest must seal as blocked, not fabricated.\n`,
  );
  writeText(
    docPath,
    `# Phase3959A Owner Daily Use Minimum Loop\n\n## Goal\n\nPrepare the minimum owner daily-use loop for PME AI Gateway / unified-ai-system.\n\nThis phase creates the manual input template, readme, evidence, and verifier. It does not fabricate owner feedback and does not claim owner dogfooding completion.\n\n## Reality Boundary\n\n- Real owner daily-use record count: 0.\n- Owner daily-use completion: false.\n- Codex self-test is not counted as owner feedback.\n- Automated evidence is not counted as human feedback.\n- Provider calls made: false.\n- Secret read: false.\n- Deploy executed: false.\n- Default /chat and /chat-gateway/execute unchanged.\n- Controlled mutation expansion attempted: false.\n\n## Manual Owner Input\n\nThe owner may create:\n\n\`docs/owner-daily-use/records/owner-daily-use-0001.json\`\n\nusing the template:\n\n\`docs/owner-daily-use/owner-daily-use-template.json\`\n\n## Sealed Status\n\nThis phase may seal with blocker=\`owner_daily_use_record_missing\` because the loop is prepared but no real owner record has been provided yet.\n\n## Rollback\n\n- Delete \`tools/phase3959a/\`.\n- Delete \`docs/phase3959a-owner-daily-use-minimum-loop.md\`.\n- Delete \`apps/ai-gateway-service/evidence/phase3959a-owner-daily-use-minimum-loop/\`.\n- Delete generated owner daily-use template/readme files only; do not delete owner-provided records without explicit owner approval.\n- Restore package.json scripts and README/AGENTS managed block entries.\n`,
  );
  writeJson(resultPath, result);

  return result;
}

export function main() {
  const result = prepareOwnerDailyUseMinimumLoop();
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
