import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const repoRoot = process.cwd();

export function resolvePath(relativePath) {
  return path.join(repoRoot, relativePath);
}

export function exists(relativePath) {
  return fs.existsSync(resolvePath(relativePath));
}

export function readText(relativePath) {
  try {
    return fs.readFileSync(resolvePath(relativePath), "utf8").replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
}

export function readJson(relativePath, fallback = null) {
  try {
    if (!exists(relativePath)) {
      return { exists: false, data: fallback, parseErrorReason: null };
    }
    return { exists: true, data: JSON.parse(readText(relativePath)), parseErrorReason: null };
  } catch (error) {
    return {
      exists: true,
      data: fallback,
      parseErrorReason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function writeJson(relativePath, value) {
  fs.mkdirSync(path.dirname(resolvePath(relativePath)), { recursive: true });
  fs.writeFileSync(resolvePath(relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function check(id, passed, details = undefined) {
  return { id, passed: passed === true, ...(details === undefined ? {} : { details }) };
}

export function safetyBoundary() {
  return {
    codexExecExecutedByThisPhase: false,
    codexExecExecutedByThisBundle: false,
    providerCallsMade: false,
    providerCallsMadeByThisPhase: false,
    authJsonRead: false,
    authJsonAccessed: false,
    codexConfigModified: false,
    projectCodexConfigModified: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    providerRuntimeModified: false,
    secretValueExposed: false,
    rawBaseUrlValueExposed: false,
    webhookValueExposed: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    pushExecuted: false,
    commitCreated: false,
    productionReadyClaimed: false,
    releaseReadyClaimed: false,
    workspaceCleanClaimed: false,
  };
}

export function loadPreflightEvidence() {
  return readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json", {});
}

export function runPhase632Preflight() {
  const result = spawnSync("cmd", ["/c", "pnpm run preflight:phase632-token-saving"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    status: result.status,
    passed: result.status === 0,
    stdoutTail: String(result.stdout || "").split(/\r?\n/).slice(-8).join("\n"),
    stderrTail: String(result.stderr || "").split(/\r?\n/).slice(-8).join("\n"),
  };
}

export function loadContextState() {
  const contextPackPath = ".codex-context/current-context-pack.md";
  const relevantFilesPath = ".codex-context/relevant-files.json";
  const freshnessReportPath = ".codex-context/context-freshness-report.json";
  const tokenBudgetReportPath = ".codex-context/token-budget-report.json";
  const relevantFiles = readJson(relevantFilesPath, {});
  const freshness = readJson(freshnessReportPath, {});
  const tokenBudget = readJson(tokenBudgetReportPath, {});
  const files = Array.isArray(relevantFiles.data?.files) ? relevantFiles.data.files : [];
  const tokenBudgetData = tokenBudget.data?.budget ?? {};

  return {
    contextPackPath,
    relevantFilesPath,
    freshnessReportPath,
    tokenBudgetReportPath,
    templatePath: "docs/phase632-codex-token-saving-task-template.md",
    templateExists: exists("docs/phase632-codex-token-saving-task-template.md"),
    contextPackExists: exists(contextPackPath),
    relevantFilesExists: relevantFiles.exists === true && !relevantFiles.parseErrorReason,
    relevantFilesCount: files.length,
    relevantFilesSelectionMode: relevantFiles.data?.selectionMode ?? null,
    tokenBudgetReportExists: tokenBudget.exists === true && !tokenBudget.parseErrorReason,
    tokenBudgetRespected: tokenBudgetData.respected === true,
    estimatedTokens: Number(tokenBudgetData.estimatedTokens ?? 0),
    rawEstimatedTokens: Number(tokenBudgetData.rawEstimatedTokens ?? 0),
    estimatedSavingPercent: Number(tokenBudget.data?.tokenSavingEstimate?.savedPercent ?? 0),
    freshnessReportExists: freshness.exists === true && !freshness.parseErrorReason,
    stale: freshness.data?.stale === true,
    staleFalse: freshness.data?.stale === false,
    staleReason: freshness.data?.staleReason ?? null,
  };
}

export function containsSecretLikeValue(text) {
  return /(sk-[A-Za-z0-9_-]{20,}|xox[baprs]-|ghp_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9_-]{12,})/i.test(text);
}

export function containsWebhookLikeValue(text) {
  return /https:\/\/hooks\.(slack|discord|teams)\.com\/[^\s"']+/i.test(text);
}

export function containsRawBaseUrlValue(text) {
  return /https?:\/\/[^\s"']*(token|secret|apikey|api_key|key=|access_token|base_url)[^\s"']*/i.test(text);
}

export function finalize(result, checks, evidencePath, failedBlocker) {
  const failed = checks.filter((item) => !item.passed);
  if (failed.length > 0) {
    result.completed = false;
    result.recommended_sealed = false;
    result.blocker = `${failedBlocker}:${failed.map((item) => item.id).join(",")}`;
    result.failed = failed.map((item) => item.id);
  }
  result.checks = checks;
  writeJson(evidencePath, result);
  console.log(JSON.stringify(result, null, 2));
  if (result.completed !== true || result.recommended_sealed !== true || result.blocker) {
    process.exitCode = 1;
  }
}
