import { createHash } from "node:crypto";

export function createAnswerContract(input = {}) {
  const query = String(input.query ?? "");
  const answerContract = {
    taskType: input.taskType ?? inferTaskType(query),
    outputFormat: input.outputFormat ?? "concise_markdown",
    requiredSections: Array.isArray(input.requiredSections) ? input.requiredSections : [],
    language: input.language ?? inferLanguage(query),
    detailLevel: input.detailLevel ?? "normal",
    citationRequired: Boolean(input.citationRequired),
    commandTemplateRequired: Boolean(input.commandTemplateRequired),
    codeRequired: Boolean(input.codeRequired),
    tableRequired: Boolean(input.tableRequired),
    finalFormat: input.finalFormat ?? "plain_answer",
  };

  return {
    answerContract,
    answerContractHash: createStableHash(answerContract),
    outputSchemaVersion: input.outputSchemaVersion ?? "preview-answer-v1",
  };
}

export function createStableHash(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function inferTaskType(query) {
  const text = query.toLowerCase();
  if (text.includes("codex") || text.includes("命令")) return "codex_task";
  if (text.includes("production") || text.includes("企业级")) return "readiness_status";
  return "status_answer";
}

function inferLanguage(query) {
  if (/[\u3400-\u9fff]/.test(query)) return "zh";
  if (/[\u3040-\u30ff]/.test(query)) return "ja";
  if (/[a-z]/i.test(query)) return "en";
  return "unknown";
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
