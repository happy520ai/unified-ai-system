import fs from "node:fs";
import path from "node:path";

export const root = process.cwd();

export const phase631EvidencePath =
  "apps/ai-gateway-service/evidence/phase631r/token-saving-enforcement-gate-result.json";

export function p(relativePath) {
  return path.join(root, relativePath);
}

export function exists(relativePath) {
  return fs.existsSync(p(relativePath));
}

export function readText(relativePath) {
  try {
    return fs.readFileSync(p(relativePath), "utf8").replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
}

export function readJson(relativePath) {
  try {
    if (!exists(relativePath)) return { exists: false, data: null, parseErrorReason: null };
    const text = readText(relativePath);
    return { exists: true, data: JSON.parse(text), parseErrorReason: null };
  } catch (error) {
    return {
      exists: true,
      data: null,
      parseErrorReason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function writeJson(relativePath, value) {
  fs.mkdirSync(path.dirname(p(relativePath)), { recursive: true });
  fs.writeFileSync(p(relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function has(text, pattern) {
  return text.includes(pattern);
}

export function extractNumber(text, key) {
  const match = text.match(new RegExp(`${key}\\s*=\\s*(\\d+)`));
  return match ? Number(match[1]) : null;
}

export function check(id, passed) {
  return { id, passed: Boolean(passed) };
}

export function loadPhase631Evidence() {
  const phase631 = readJson(phase631EvidencePath);
  return {
    raw: phase631,
    imported:
      phase631.exists === true &&
      !phase631.parseErrorReason &&
      phase631.data?.completed === true &&
      phase631.data?.recommended_sealed === true &&
      phase631.data?.blocker === null &&
      phase631.data?.contextPackRequired === true &&
      phase631.data?.relevantFilesRequired === true &&
      phase631.data?.staleFalseRequired === true &&
      phase631.data?.tokenBudgetRequired === true &&
      phase631.data?.fullRepoScanForbidden === true &&
      phase631.data?.outputBudgetRequired === true,
  };
}

export function loadContextState() {
  const contextPackPath = ".codex-context/current-context-pack.md";
  const relevantFilesPath = ".codex-context/relevant-files.json";
  const freshnessReportPath = ".codex-context/context-freshness-report.json";
  const contextPack = readText(contextPackPath);
  const relevantFiles = readJson(relevantFilesPath);
  const freshnessReport = readJson(freshnessReportPath);
  const files = Array.isArray(relevantFiles.data?.files) ? relevantFiles.data.files : [];

  return {
    contextPackPath,
    relevantFilesPath,
    freshnessReportPath,
    contextPack,
    relevantFiles,
    freshnessReport,
    contextPackExists: exists(contextPackPath),
    relevantFilesExists: relevantFiles.exists === true && !relevantFiles.parseErrorReason,
    freshnessReportExists: freshnessReport.exists === true && !freshnessReport.parseErrorReason,
    relevantFilesCount: files.length,
    relevantFilesSelectionMode: relevantFiles.data?.selectionMode ?? null,
    staleFalse: freshnessReport.data?.stale === false,
    contextPackHasHash: /hash:\s*[a-f0-9]{16,}/i.test(contextPack),
    tokenBudgetPresent: /tokenBudget:\s*\S+/i.test(contextPack),
    tokenBudgetRespected: /tokenBudgetRespected:\s*true/i.test(contextPack),
  };
}

export function safetyBoundary() {
  return {
    codexExecExecutedByThisPhase: false,
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

export function containsSecretLikeValue(text) {
  return /(sk-[A-Za-z0-9_-]{20,}|xox[baprs]-|ghp_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9_-]{12,})/i.test(text);
}

export function containsWebhookLikeValue(text) {
  return /https:\/\/hooks\.(slack|discord|teams)\.com\/[^\s"']+/i.test(text);
}

export function containsRawBaseUrlValue(text) {
  return /https?:\/\/[^\s"']*(token|secret|apikey|api_key|key=|access_token|base_url)[^\s"']*/i.test(text);
}

export function finalize(result, checks, evidencePath, failedBlockerPrefix) {
  const failed = checks.filter((item) => !item.passed).map((item) => item.id);
  if (failed.length > 0) {
    result.completed = false;
    result.recommended_sealed = false;
    result.blocker = `${failedBlockerPrefix}:${failed.join(",")}`;
  }
  result.checks = checks;
  writeJson(evidencePath, result);
  console.log(JSON.stringify(result, null, 2));
  if (result.completed !== true || result.recommended_sealed !== true || result.blocker) {
    process.exitCode = 1;
  }
}
