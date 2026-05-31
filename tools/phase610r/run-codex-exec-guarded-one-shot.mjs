import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const evidencePath =
  "apps/ai-gateway-service/evidence/phase610r/codex-exec-guarded-one-shot-result.json";
const prompt =
  "Read .codex-context/current-context-pack.md. Check .codex-context/context-freshness-report.json and confirm stale=false. Read .codex-context/relevant-files.json. Do not edit files. Do not scan the full repository. Do not read secrets. Reply with one line only: CONTEXT_GATEWAY_MODEL_PROVIDER_OK.";
const startedAt = new Date();
const timeoutMs = 10 * 60 * 1000;

const child = spawn("codex", ["exec", "-c", "model_provider=crs", prompt], {
  cwd: root,
  shell: false,
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";
let timedOut = false;

child.stdout?.on("data", (chunk) => {
  stdout += chunk.toString("utf8");
});
child.stderr?.on("data", (chunk) => {
  stderr += chunk.toString("utf8");
});

const timer = setTimeout(() => {
  timedOut = true;
  child.kill("SIGTERM");
}, timeoutMs);

const exitCode = await new Promise((resolve) => {
  child.on("error", (error) => {
    stderr += error instanceof Error ? error.message : String(error);
    resolve(127);
  });
  child.on("close", (code) => resolve(code ?? 1));
});
clearTimeout(timer);

const endedAt = new Date();
const stdoutSanitized = sanitize(stdout);
const stderrSanitized = sanitize(stderr);
const responseClassification = classify(exitCode, stdoutSanitized, stderrSanitized, timedOut);
const testStatus = statusFromClassification(responseClassification);
const blocker = blockerFromClassification(responseClassification);
const result = {
  phase: "Phase610R-Fix",
  name: "Codex Exec Custom Model Provider Guarded One-Shot",
  completed: true,
  recommended_sealed: responseClassification === "pass",
  blocker,
  userConfirmed: true,
  executionMode: "codex_exec_non_interactive",
  selectedProviderId: "crs",
  maxRequests: 1,
  retryLimit: 0,
  requestAttemptCount: 1,
  retryAttemptCount: 0,
  startedAt: startedAt.toISOString(),
  endedAt: endedAt.toISOString(),
  durationMs: endedAt.getTime() - startedAt.getTime(),
  exitCode,
  timedOut,
  stdoutSanitized,
  stderrSanitized,
  testStatus,
  responseClassification,
  ackExpected: "CONTEXT_GATEWAY_MODEL_PROVIDER_OK",
  ackObserved: stdoutSanitized.includes("CONTEXT_GATEWAY_MODEL_PROVIDER_OK"),
  codexOneShotExecutedByThisPhase: true,
  providerCallsMadeByThisPhase: true,
  authJsonRead: false,
  authJsonAccessed: false,
  codexConfigModified: false,
  projectCodexConfigModified: false,
  persistentConfigWritePerformed: false,
  secretValueExposed: containsSecretLikeValue(`${stdoutSanitized}\n${stderrSanitized}`),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(`${stdoutSanitized}\n${stderrSanitized}`),
  webhookValueExposed: containsWebhookLikeValue(`${stdoutSanitized}\n${stderrSanitized}`),
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  characterModuleRestored: false,
  workspaceCleanClaimed: false,
  docs: [
    "docs/phase610r-codex-exec-guarded-one-shot-execution.md",
    "docs/phase610r-codex-exec-result-classification.md",
    "docs/phase610r-codex-exec-execution-report.md",
  ],
  evidenceJson: evidencePath,
};

writeJson(evidencePath, result);
console.log(JSON.stringify(result, null, 2));

function classify(code, out, err, isTimeout) {
  if (isTimeout) return "timeout";
  if (err.includes("stdin is not a terminal")) return "failed_tty";
  if (code === 0 && out.includes("CONTEXT_GATEWAY_MODEL_PROVIDER_OK")) return "pass";
  if (code === 0) return "invalid_response";
  return "failed_provider_route";
}

function statusFromClassification(classification) {
  if (classification === "pass") return "pass";
  if (classification === "timeout") return "timeout";
  return "failed";
}

function blockerFromClassification(classification) {
  if (classification === "pass") return null;
  if (classification === "timeout") return "codex_exec_one_shot_timeout";
  if (classification === "failed_tty") return "codex_exec_tty_failed";
  return "codex_exec_one_shot_failed";
}

function sanitize(value) {
  const sanitized = String(value ?? "")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "<redacted:secret>")
    .replace(/xox[baprs]-[A-Za-z0-9-]+/g, "<redacted:webhook-or-token>")
    .replace(/ghp_[A-Za-z0-9_]{20,}/g, "<redacted:token>")
    .replace(/AKIA[0-9A-Z]{16}/g, "<redacted:secret>")
    .replace(/https?:\/\/[^\s"')<>]+/gi, "<redacted:url>")
    .replace(/(__cf_chl[a-zA-Z_]*=)[^&\s"']+/g, "$1<redacted:challenge-token>")
    .replace(/\b(cH|cRay|md|mdrd):\s*'[^']{24,}'/g, "$1: '<redacted:challenge-data>'");

  if (sanitized.length <= 4000) return sanitized;
  return `${sanitized.slice(0, 3500)}\n<redacted:truncated-stderr ${sanitized.length - 3500} chars>\n`;
}

function containsSecretLikeValue(text) {
  return /(sk-[A-Za-z0-9_-]{20,}|xox[baprs]-|ghp_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9_-]{12,})/i.test(text);
}

function containsWebhookLikeValue(text) {
  return /https:\/\/hooks\.(slack|discord|teams)\.com\/[^\s"']+/i.test(text);
}

function containsRawBaseUrlValue(text) {
  return /https?:\/\/[^\s"']+/i.test(text);
}

function writeJson(relativePath, value) {
  fs.mkdirSync(path.dirname(p(relativePath)), { recursive: true });
  fs.writeFileSync(p(relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function p(relativePath) {
  return path.join(root, relativePath);
}
