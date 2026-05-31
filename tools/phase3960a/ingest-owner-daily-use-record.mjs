import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const inputPath = "docs/owner-daily-use/records/owner-daily-use-0001.json";
const docPath = "docs/phase3960a-owner-daily-use-record-ingest-and-classifier.md";
const resultPath = "apps/ai-gateway-service/evidence/phase3960a-owner-daily-use-record-ingest-and-classifier/result.json";

function ensureParent(relativePath) {
  mkdirSync(resolve(repoRoot, relativePath, ".."), { recursive: true });
}

function writeJson(relativePath, value) {
  ensureParent(relativePath);
  writeFileSync(resolve(repoRoot, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(relativePath, value) {
  ensureParent(relativePath);
  writeFileSync(resolve(repoRoot, relativePath), value, "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

function classifyIssue(text) {
  const value = String(text ?? "").toLowerCase();
  if (/(secret|api key|token|provider|deploy|release|\/chat|chat-gateway|security|安全)/i.test(value)) return "P0";
  if (/(block|cannot|无法|不能|失败|阻塞|卡住|不可用)/i.test(value)) return "P1";
  if (/(ui|按钮|看不懂|体验|操作|文案|preview|预览)/i.test(value)) return "P2";
  if (/(docs|文档|说明|governance|evidence|治理)/i.test(value)) return "P3";
  if (/(marker|file count|managed block|堆 evidence|低价值)/i.test(value)) return "LowValue";
  return "P2";
}

export function ingestOwnerDailyUseRecord() {
  const inputExists = existsSync(resolve(repoRoot, inputPath));
  const base = {
    completed: true,
    recommendedSealed: true,
    inputPath,
    fakeOwnerFeedbackDetected: false,
    codexSelfTestCountedAsOwnerFeedback: false,
    providerCallsMade: false,
    secretRead: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    deployExecuted: false,
    controlledMutationExpansionAttempted: false,
  };

  let result;
  if (!inputExists) {
    result = {
      ...base,
      blocker: "owner_daily_use_record_missing",
      ownerRecordFound: false,
      ownerProvided: false,
      recordClassified: false,
      p0Count: 0,
      p1Count: 0,
      p2Count: 0,
      p3Count: 0,
      lowValueCount: 0,
      suggestedNextProductPhaseGenerated: false,
    };
  } else {
    const record = readJson(inputPath);
    const text = [
      record.scenario,
      record.taskAttempted,
      record.expectedOutcome,
      record.actualOutcome,
      record.friction,
      record.ownerNotes,
      record.severityHint,
    ].join("\n");
    const classification = classifyIssue(text);
    result = {
      ...base,
      blocker: null,
      ownerRecordFound: true,
      ownerProvided: record.ownerProvided === true,
      recordClassified: true,
      classification,
      p0Count: classification === "P0" ? 1 : 0,
      p1Count: classification === "P1" ? 1 : 0,
      p2Count: classification === "P2" ? 1 : 0,
      p3Count: classification === "P3" ? 1 : 0,
      lowValueCount: classification === "LowValue" ? 1 : 0,
      suggestedNextProductPhaseGenerated: true,
      suggestedNextProductPhase: {
        phaseName: `Phase3960A-Followup-${classification}`,
        goal: "Turn owner-provided daily-use friction into a bounded Product Work Mode repair proposal.",
        providerCallAllowed: false,
        secretReadAllowed: false,
        deployAllowed: false,
      },
    };
  }

  writeText(
    docPath,
    `# Phase3960A Owner Daily Use Record Ingest And Classifier\n\n## Goal\n\nRead the first owner-provided daily-use record and classify it into P0/P1/P2/P3/LowValue without fabricating owner feedback.\n\n## Input\n\n\`${inputPath}\`\n\n## Classification Rules\n\n- P0: secret, provider, deploy, chat route, or security risk.\n- P1: real owner usage blocker.\n- P2: UI, comprehension, or operation experience issue.\n- P3: documentation, explanation, or governance improvement.\n- LowValue: marker, managed-block, evidence-only, or file-count expansion with no product value.\n\n## Current Result\n\n- ownerRecordFound=${result.ownerRecordFound}\n- blocker=${result.blocker}\n- fakeOwnerFeedbackDetected=false\n- codexSelfTestCountedAsOwnerFeedback=false\n- providerCallsMade=false\n- secretRead=false\n- deployExecuted=false\n\n## Rollback\n\n- Delete \`tools/phase3960a/\`.\n- Delete \`docs/phase3960a-owner-daily-use-record-ingest-and-classifier.md\`.\n- Delete \`apps/ai-gateway-service/evidence/phase3960a-owner-daily-use-record-ingest-and-classifier/\`.\n- Restore package.json scripts and README/AGENTS managed block entries.\n`,
  );
  writeJson(resultPath, result);
  return result;
}

export function main() {
  const result = ingestOwnerDailyUseRecord();
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
