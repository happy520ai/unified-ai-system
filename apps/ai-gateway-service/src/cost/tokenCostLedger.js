import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_COST_GUARD_LEDGER_PATH = resolve(__dirname, "../../evidence/token-cost-guard-ledger.jsonl");

export async function appendEstimateRecord(record = {}, options = {}) {
  const ledgerPath = options.ledgerPath ?? DEFAULT_COST_GUARD_LEDGER_PATH;
  const line = {
    timestamp: record.timestamp ?? new Date().toISOString(),
    requestType: record.requestType ?? "chat-preview",
    provider: record.provider ?? "preview-provider",
    model: record.model ?? "preview-model",
    modelTier: record.modelTier ?? record.estimate?.modelTier ?? "cheap",
    estimatedInputTokens: Number(record.estimatedInputTokens ?? record.estimate?.inputTokens ?? 0),
    estimatedOutputTokens: Number(record.estimatedOutputTokens ?? record.estimate?.outputTokens ?? 0),
    estimatedCostUsd: Number(record.estimatedCostUsd ?? record.estimate?.totalCostUsd ?? 0),
    estimatedTokensSaved: Number(record.estimatedTokensSaved ?? record.savings?.estimatedTokensSaved ?? 0),
    decision: record.decision ?? "allow",
    servedFromCache: Boolean(record.servedFromCache ?? record.cache?.servedFromCache),
    cacheEligible: Boolean(record.cacheEligible ?? record.cache?.cacheEligible),
    externalApiCalled: false,
    paidApiCalled: false,
  };

  await mkdir(dirname(ledgerPath), { recursive: true });
  await appendFile(ledgerPath, `${JSON.stringify(line)}\n`, "utf8");
  return line;
}

export async function readSummary(options = {}) {
  const ledgerPath = options.ledgerPath ?? DEFAULT_COST_GUARD_LEDGER_PATH;
  const records = await readRecords(ledgerPath);

  return {
    totalEstimateCount: records.length,
    allowedCount: records.filter((record) => record.decision === "allow").length,
    requireApprovalCount: records.filter((record) => record.decision === "require_approval").length,
    blockedCount: records.filter((record) => record.decision === "block").length,
    estimatedTotalCostUsd: round(records.reduce((sum, record) => sum + Number(record.estimatedCostUsd || 0), 0)),
    estimatedTokensSaved: records.reduce((sum, record) => sum + Number(record.estimatedTokensSaved || 0), 0),
    cacheEligibleCount: records.filter((record) => record.cacheEligible === true).length,
    servedFromCacheCount: records.filter((record) => record.servedFromCache === true).length,
    externalApiCalled: false,
    paidApiCalled: false,
    apiKeyRead: false,
    mode: "preview-only",
  };
}

async function readRecords(ledgerPath) {
  let text;
  try {
    text = await readFile(ledgerPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function round(value) {
  return Number((Number(value) || 0).toFixed(6));
}
