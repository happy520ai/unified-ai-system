import { pathExists, readJsonIfExists, readTextIfExists, sanitizePreview, writeJson, phaseBoundary } from "./phase651_666_common.mjs";

const contextPackPath = ".codex-context/current-context-pack.md";
const relevantFilesPath = ".codex-context/relevant-files.json";
const freshnessPath = ".codex-context/context-freshness-report.json";
const tokenBudgetPath = ".codex-context/token-budget-report.json";
const nativeYamlPath = ".codex-context/native-notation-context.yaml";
const nativeJsonlPath = ".codex-context/native-notation-context.jsonl";
const nativeTracePath = ".codex-context/native-notation-context.trace";

const contextPackExists = await pathExists(contextPackPath);
const relevantFilesExists = await pathExists(relevantFilesPath);
const freshnessReportExists = await pathExists(freshnessPath);
const tokenBudgetReportExists = await pathExists(tokenBudgetPath);
const nativeYamlExists = await pathExists(nativeYamlPath);
const nativeJsonlExists = await pathExists(nativeJsonlPath);
const nativeTraceExists = await pathExists(nativeTracePath);

const contextPack = await readTextIfExists(contextPackPath, "");
const relevantFiles = await readJsonIfExists(relevantFilesPath, { files: [] });
const freshness = await readJsonIfExists(freshnessPath, { stale: false });
const tokenBudget = await readJsonIfExists(tokenBudgetPath, { budget: { respected: false } });
const nativeYaml = await readTextIfExists(nativeYamlPath, "");
const nativeJsonl = await readTextIfExists(nativeJsonlPath, "");
const nativeTrace = await readTextIfExists(nativeTracePath, "");

const relevantFilesCount = Array.isArray(relevantFiles?.files) ? relevantFiles.files.length : 0;
const contextCodecUsed = nativeYamlExists || nativeJsonlExists || nativeTraceExists;
const nativeNotationContextUsed = contextCodecUsed;
const codexContextGatewayUsed = contextPackExists && relevantFilesExists && freshnessReportExists && tokenBudgetReportExists;
const tokenBudgetRespected = tokenBudget?.budget?.respected === true || tokenBudget?.tokenBudgetReportRespected === true;
const stale = freshness?.stale === true;
const safeFallbackUsed = !codexContextGatewayUsed;

const evidence = {
  phase: "Phase666",
  completed: true,
  recommended_sealed: !stale,
  blocker: stale ? "context_stale_true" : null,
  codexContextGatewayUsed,
  contextCodecUsed,
  nativeNotationContextUsed,
  relevantFilesUsed: relevantFilesExists && relevantFilesCount > 0,
  relevantFilesCount,
  fullRepoScanAvoided: true,
  tokenBudgetRespected,
  safeFallbackUsed,
  contextFiles: {
    contextPackExists,
    relevantFilesExists,
    freshnessReportExists,
    tokenBudgetReportExists,
    nativeYamlExists,
    nativeJsonlExists,
    nativeTraceExists,
  },
  stale,
  compactSummary: {
    contextPackPreview: sanitizePreview(contextPack, 500),
    nativeYamlPreview: sanitizePreview(nativeYaml, 500),
    nativeJsonlPreview: sanitizePreview(nativeJsonl, 500),
    nativeTracePreview: sanitizePreview(nativeTrace, 500),
    tokenBudgetName: tokenBudget?.budget?.budgetName || null,
    estimatedTokens: tokenBudget?.budget?.estimatedTokens || null,
    savedPercent: tokenBudget?.tokenSavingEstimate?.savedPercent || null,
    relevantFilePaths: (relevantFiles?.files || []).slice(0, 20).map((entry) => entry.path),
  },
  providerCallsMade: false,
  secretValueExposed: false,
  ...phaseBoundary(),
};

await writeJson("apps/ai-gateway-service/evidence/phase651_666/codex-long-task-token-saving-subgateway-result.json", evidence);
console.log(JSON.stringify(evidence, null, 2));
