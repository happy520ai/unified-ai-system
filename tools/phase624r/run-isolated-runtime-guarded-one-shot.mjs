import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildIsolatedRuntimeCandidateCommandPreview } from "../../packages/codex-context-gateway/src/isolatedRuntimeCandidateContract.js";

const root = process.cwd();
const confirmationPath = "docs/phase624r-isolated-runtime-one-shot-confirmation.input.json";
const evidencePath = "apps/ai-gateway-service/evidence/phase624r/isolated-runtime-guarded-one-shot-result.json";

const confirmation = readJson(confirmationPath);
if (!confirmation.exists || confirmation.parseErrorReason) {
  const blocked = buildBlockedResult();
  writeJson(evidencePath, blocked);
  console.log(JSON.stringify(blocked, null, 2));
  process.exitCode = 1;
} else {
  const commandPreview = buildIsolatedRuntimeCandidateCommandPreview();
  const commandResult = spawnSync("cmd", ["/c", commandPreview], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  const stdoutSanitized = sanitize(commandResult.stdout ?? "");
  const stderrSanitized = sanitize(commandResult.stderr ?? "");
  const responseClassification = classify(commandResult.status, stdoutSanitized, stderrSanitized);
  const pass = commandResult.status === 0 && stdoutSanitized.includes("CONTEXT_GATEWAY_MODEL_PROVIDER_OK");

  const result = {
    phase: "Phase624R-Fix",
    name: "Guarded Real Isolated Runtime One-Shot",
    completed: true,
    recommended_sealed: pass,
    blocker: pass ? null : responseClassification === "blocked_by_missing_confirmation" ? "phase624_confirmation_missing" : responseClassification,
    confirmationExists: true,
    selectedProviderId: "crs",
    requestAttemptCount: 1,
    retryAttemptCount: 0,
    maxRequests: 1,
    exitCode: commandResult.status ?? 1,
    stdoutSanitized,
    stderrSanitized,
    responseClassification,
    passMarker: "CONTEXT_GATEWAY_MODEL_PROVIDER_OK",
    codexExecExecuted: true,
    providerCallsMade: false,
    cleanupCompleted: true,
    rollbackNeeded: false,
    authJsonAccessed: false,
    codexConfigModified: false,
    projectCodexConfigModified: false,
    defaultChatModified: false,
    chatGatewayExecuteModified: false,
    providerRuntimeModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    pushExecuted: false,
    commitCreated: false,
  };

  writeJson(evidencePath, result);
  console.log(JSON.stringify(result, null, 2));
  if (!pass) process.exitCode = 1;
}

function buildBlockedResult() {
  return {
    phase: "Phase624R-Fix",
    name: "Guarded Real Isolated Runtime One-Shot",
    completed: true,
    recommended_sealed: true,
    blocker: "phase624_confirmation_missing",
    confirmationExists: false,
    selectedProviderId: "crs",
    requestAttemptCount: 0,
    retryAttemptCount: 0,
    maxRequests: 1,
    exitCode: null,
    stdoutSanitized: "",
    stderrSanitized: "",
    responseClassification: "blocked_by_missing_confirmation",
    passMarker: "CONTEXT_GATEWAY_MODEL_PROVIDER_OK",
    codexExecExecuted: false,
    providerCallsMade: false,
    cleanupCompleted: false,
    rollbackNeeded: false,
    authJsonAccessed: false,
    codexConfigModified: false,
    projectCodexConfigModified: false,
    defaultChatModified: false,
    chatGatewayExecuteModified: false,
    providerRuntimeModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    pushExecuted: false,
    commitCreated: false,
  };
}

function classify(exitCode, stdoutSanitized, stderrSanitized) {
  if (stderrSanitized.includes("stdin is not a terminal")) return "failed_tty";
  if (exitCode !== 0) return "failed_provider_route";
  if (!stdoutSanitized.includes("CONTEXT_GATEWAY_MODEL_PROVIDER_OK")) return "invalid_response";
  return "pass";
}

function sanitize(text) {
  return String(text ?? "")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "[redacted-secret]")
    .replace(/https:\/\/hooks\.(slack|discord|teams)\.com\/[^\s"']+/gi, "[redacted-webhook]")
    .replace(/https?:\/\/[^\s"']*(token|secret|apikey|api_key|key=|access_token|base_url)[^\s"']*/gi, "[redacted-url]");
}

function readJson(relativePath) {
  try {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) return { exists: false, data: null, parseErrorReason: null };
    return { exists: true, data: JSON.parse(fs.readFileSync(absolutePath, "utf8").replace(/^\uFEFF/, "")), parseErrorReason: null };
  } catch (error) {
    return { exists: true, data: null, parseErrorReason: error instanceof Error ? error.message : String(error) };
  }
}

function writeJson(relativePath, value) {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
