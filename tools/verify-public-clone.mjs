import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import {
  mkdir,
  mkdtemp,
  lstat,
  open,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serviceRoot = resolve(repoRoot, "apps/ai-gateway-service");
const serviceEntrypoint = resolve(serviceRoot, "src/index.js");
const mcpSmokeEntrypoint = resolve(repoRoot, "tools/mcp-smoke.mjs");
const localClientSmokeEntrypoint = resolve(repoRoot, "tools/local-client-control-plane-smoke.mjs");
const vitestEntrypoint = resolve(repoRoot, "node_modules/vitest/vitest.mjs");
const circuitRecoveryDrillEntrypoint = resolve(repoRoot, "tools/circuit-recovery-drill.mjs");
const javascriptExampleEntrypoint = resolve(
  repoRoot,
  "docs/examples/javascript-chat.mjs",
);
const sharedSdkExampleEntrypoint = resolve(
  repoRoot,
  "docs/examples/shared-sdk-prompt-enhancement.mjs",
);
const openAiSdkExampleEntrypoint = resolve(
  repoRoot,
  "docs/examples/openai-sdk-chat.mjs",
);
const anthropicSdkExampleEntrypoint = resolve(
  repoRoot,
  "docs/examples/anthropic-sdk-messages.mjs",
);
const a2aSdkExampleEntrypoint = resolve(
  repoRoot,
  "docs/examples/a2a-sdk-client.mjs",
);
const ISSUE_SOURCE = "verify-public-clone";
const INTERNAL_CLEAN_CLONE_ARGUMENT = "--internal-clean-clone";
const INTERNAL_MANIFEST_ENV = "AI_GATEWAY_PUBLIC_CLONE_INTERNAL_MANIFEST";
const INTERNAL_TOKEN_ENV = "AI_GATEWAY_PUBLIC_CLONE_INTERNAL_TOKEN";

async function runCaptured(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const code = await waitForChildExitCode(
    child,
    options.timeoutMs ?? 60_000,
    `${command} ${args.join(" ")}`,
  );
  return { code, stdout, stderr };
}

async function runInherited(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    windowsHide: true,
    stdio: "inherit",
    shell: options.shell === true,
  });
  return waitForChildExitCode(
    child,
    options.timeoutMs ?? 15 * 60_000,
    `${command} ${args.join(" ")}`,
  );
}

async function waitForChildExitCode(child, timeoutMs, label) {
  const completion = new Promise((resolveCompletion, rejectCompletion) => {
    child.once("error", rejectCompletion);
    child.once("close", (code) => resolveCompletion({ code: Number(code ?? 1) }));
  });
  let timeoutHandle;
  const timeout = new Promise((resolveTimeout) => {
    timeoutHandle = setTimeout(() => resolveTimeout({ timeout: true }), timeoutMs);
    timeoutHandle.unref?.();
  });
  let outcome;
  try {
    outcome = await Promise.race([completion, timeout]);
  } finally {
    clearTimeout(timeoutHandle);
  }
  if (outcome?.timeout !== true) return outcome.code;
  await terminateChildTree(child);
  const error = new Error(`Child process exceeded its deadline: ${label}`);
  error.code = "PUBLIC_CLONE_CHILD_DEADLINE_EXCEEDED";
  throw error;
}

async function terminateChildTree(child) {
  if (hasChildExited(child)) return;
  if (process.platform === "win32") {
    const pid = Number(child.pid);
    if (!Number.isSafeInteger(pid) || pid <= 0) throw childCleanupError();
    const killer = spawn("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    let killerTimeout;
    let killerCompleted = false;
    try {
      killerCompleted = await Promise.race([
        once(killer, "close").then(() => true, () => false),
        new Promise((resolveTimeout) => {
          killerTimeout = setTimeout(() => resolveTimeout(false), 5_000);
          killerTimeout.unref?.();
        }),
      ]);
    } finally {
      clearTimeout(killerTimeout);
    }
    if (!killerCompleted && !hasChildExited(killer)) {
      killer.kill("SIGKILL");
      await waitForChildExit(killer, 2_000);
    }
  } else {
    child.kill("SIGTERM");
    await waitForChildExit(child, 3_000);
    if (!hasChildExited(child)) child.kill("SIGKILL");
  }
  await waitForChildExit(child, 5_000);
  if (!hasChildExited(child)) throw childCleanupError();
}

function childCleanupError() {
  const error = new Error("A public-clone child process could not be terminated safely.");
  error.code = "PUBLIC_CLONE_CHILD_CLEANUP_FAILED";
  return error;
}

function credentialFreeCloneEnv(isolatedHome, isolatedTemp, extra = {}) {
  const env = {};
  for (const name of [
    "PATH",
    "SystemRoot",
    "WINDIR",
    "ComSpec",
    "PATHEXT",
    "LANG",
    "LC_ALL",
  ]) {
    if (typeof process.env[name] === "string") env[name] = process.env[name];
  }
  return {
    ...env,
    HOME: isolatedHome,
    USERPROFILE: isolatedHome,
    APPDATA: join(isolatedHome, "appdata"),
    LOCALAPPDATA: join(isolatedHome, "localappdata"),
    TEMP: isolatedTemp,
    TMP: isolatedTemp,
    TMPDIR: isolatedTemp,
    COREPACK_HOME: join(isolatedHome, "corepack"),
    NPM_CONFIG_USERCONFIG: join(isolatedHome, "npmrc-disabled"),
    NPM_CONFIG_GLOBALCONFIG: join(isolatedHome, "npmrc-global-disabled"),
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: join(isolatedHome, "gitconfig-disabled"),
    CI: "1",
    NODE_ENV: "test",
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    ...extra,
  };
}

async function runInActualPublicClone() {
  const status = await runCaptured(
    "git",
    [
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
      "--",
      ".",
      ":(top,literal,exclude).mcp.json",
    ],
    { cwd: repoRoot },
  );
  if (status.code !== 0) throw new Error(`git status failed: ${status.stderr.trim()}`);
  const dirtyRecords = status.stdout.split("\0").filter(Boolean);
  if (dirtyRecords.length > 0) {
    const error = new Error(
      `Public clone verification requires a tracked clean candidate; ${dirtyRecords.length} worktree entries remain.`,
    );
    error.code = "PUBLIC_CLONE_WORKTREE_NOT_CLEAN";
    throw error;
  }

  const sourceHead = await runCaptured("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
  if (sourceHead.code !== 0) throw new Error(`git rev-parse failed: ${sourceHead.stderr.trim()}`);
  const pnpmInstall = await resolvePnpmInstallInvocation();
  const temporaryRoot = await mkdtemp(join(tmpdir(), "unified-ai-public-clone-"));
  const cloneRoot = join(temporaryRoot, "checkout");
  const isolatedHome = join(temporaryRoot, "home");
  const isolatedTemp = join(temporaryRoot, "tmp");
  try {
    await Promise.all([
      mkdir(isolatedHome, { recursive: true }),
      mkdir(isolatedTemp, { recursive: true }),
      mkdir(join(isolatedHome, "appdata"), { recursive: true }),
      mkdir(join(isolatedHome, "localappdata"), { recursive: true }),
    ]);
    const cloneEnv = credentialFreeCloneEnv(isolatedHome, isolatedTemp);
    const cloned = await runInherited(
      "git",
      ["clone", "--quiet", "--no-local", "--no-hardlinks", repoRoot, cloneRoot],
      { cwd: repoRoot, env: cloneEnv },
    );
    if (cloned !== 0) throw new Error("git clone failed for the public verification candidate.");
    const cloneHead = await runCaptured("git", ["rev-parse", "HEAD"], { cwd: cloneRoot });
    if (cloneHead.code !== 0 || cloneHead.stdout.trim() !== sourceHead.stdout.trim()) {
      throw new Error("The public clone did not resolve to the exact source HEAD commit.");
    }
    const installed = await runInherited(
      pnpmInstall.command,
      pnpmInstall.args,
      {
        cwd: cloneRoot,
        env: cloneEnv,
        shell: pnpmInstall.shell,
      },
    );
    if (installed !== 0) throw new Error("Credential-free dependency installation failed in the public clone.");
    const sourceRealPath = await realpath(repoRoot);
    const cloneRealPath = await realpath(cloneRoot);
    const internalToken = randomBytes(32).toString("hex");
    const manifestPath = join(temporaryRoot, "inner-manifest.json");
    const manifest = {
      version: 1,
      token: internalToken,
      expectedHead: sourceHead.stdout.trim(),
      sourceRootFingerprint: pathFingerprint(sourceRealPath),
      cloneRootFingerprint: pathFingerprint(cloneRealPath),
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    const innerEnv = credentialFreeCloneEnv(isolatedHome, isolatedTemp, {
      [INTERNAL_MANIFEST_ENV]: manifestPath,
      [INTERNAL_TOKEN_ENV]: internalToken,
    });
    const verified = await runInherited(
      process.execPath,
      [
        join(cloneRoot, "tools", "verify-public-clone.mjs"),
        INTERNAL_CLEAN_CLONE_ARGUMENT,
      ],
      { cwd: cloneRoot, env: innerEnv },
    );
    if (verified !== 0) throw new Error("Public clone runtime verification failed.");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

async function resolvePnpmInstallInvocation() {
  if (process.platform !== "win32") {
    return Object.freeze({
      command: "pnpm",
      args: Object.freeze(["install", "--frozen-lockfile"]),
      shell: false,
    });
  }
  const located = await runCaptured("where.exe", ["pnpm.cmd"], {
    cwd: repoRoot,
    env: process.env,
    timeoutMs: 10_000,
  });
  const candidate = located.stdout.split(/\r?\n/u).map((value) => value.trim()).find(Boolean);
  if (
    located.code !== 0
    || typeof candidate !== "string"
    || !isAbsolute(candidate)
    || !/\.cmd$/iu.test(candidate)
    || /["&|<>^\r\n]/u.test(candidate)
  ) {
    const error = new Error("A safe absolute pnpm.cmd executable could not be resolved.");
    error.code = "PUBLIC_CLONE_PNPM_RESOLUTION_FAILED";
    throw error;
  }
  let canonical;
  try {
    canonical = await realpath(candidate);
    const info = await stat(canonical);
    if (!info.isFile() || /["&|<>^\r\n]/u.test(canonical)) throw new Error("not a safe file");
  } catch {
    const error = new Error("The resolved pnpm.cmd executable is not a regular file.");
    error.code = "PUBLIC_CLONE_PNPM_RESOLUTION_FAILED";
    throw error;
  }
  return Object.freeze({
    command: `"${canonical}" install --frozen-lockfile`,
    args: Object.freeze([]),
    shell: true,
  });
}

async function assertInternalCleanClone() {
  const status = await runCaptured(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    { cwd: repoRoot },
  );
  if (status.code !== 0 || status.stdout.length !== 0) {
    const error = new Error(
      "Internal public-clone verification requires an entirely clean checkout.",
    );
    error.code = "PUBLIC_CLONE_INTERNAL_CHECKOUT_NOT_CLEAN";
    throw error;
  }
  const manifestPath = process.env[INTERNAL_MANIFEST_ENV];
  const suppliedToken = process.env[INTERNAL_TOKEN_ENV];
  if (
    typeof manifestPath !== "string"
    || !isAbsolute(manifestPath)
    || typeof suppliedToken !== "string"
    || !/^[a-f0-9]{64}$/u.test(suppliedToken)
    || !isPathOutsideRoot(repoRoot, manifestPath)
  ) throw internalContextError();
  let manifest;
  let manifestHandle;
  try {
    const linkInfo = await lstat(manifestPath);
    if (linkInfo.isSymbolicLink()) throw internalContextError();
    const canonicalManifestPath = await realpath(manifestPath);
    if (!isPathOutsideRoot(repoRoot, canonicalManifestPath)) throw internalContextError();
    manifestHandle = await open(manifestPath, "r");
    const info = await manifestHandle.stat();
    if (!info.isFile() || info.size < 2 || info.size > 4_096) throw internalContextError();
    manifest = JSON.parse(await manifestHandle.readFile({ encoding: "utf8" }));
  } catch {
    throw internalContextError();
  } finally {
    await manifestHandle?.close().catch(() => undefined);
  }
  if (
    !manifest
    || typeof manifest !== "object"
    || Array.isArray(manifest)
    || Object.keys(manifest).sort().join(",") !== [
      "cloneRootFingerprint",
      "expectedHead",
      "sourceRootFingerprint",
      "token",
      "version",
    ].sort().join(",")
    || manifest.version !== 1
    || manifest.token !== suppliedToken
    || !/^[a-f0-9]{40,64}$/u.test(String(manifest.expectedHead ?? ""))
    || !/^[a-f0-9]{64}$/u.test(String(manifest.sourceRootFingerprint ?? ""))
    || !/^[a-f0-9]{64}$/u.test(String(manifest.cloneRootFingerprint ?? ""))
  ) throw internalContextError();
  const [head, topLevel, origin] = await Promise.all([
    runCaptured("git", ["rev-parse", "HEAD"], { cwd: repoRoot }),
    runCaptured("git", ["rev-parse", "--show-toplevel"], { cwd: repoRoot }),
    runCaptured("git", ["remote", "get-url", "origin"], { cwd: repoRoot }),
  ]);
  if (head.code !== 0 || topLevel.code !== 0 || origin.code !== 0) throw internalContextError();
  let currentRoot;
  let originRoot;
  try {
    currentRoot = await realpath(topLevel.stdout.trim());
    originRoot = await realpath(resolve(repoRoot, origin.stdout.trim()));
  } catch {
    throw internalContextError();
  }
  if (
    head.stdout.trim() !== manifest.expectedHead
    || pathFingerprint(currentRoot) !== manifest.cloneRootFingerprint
    || pathFingerprint(originRoot) !== manifest.sourceRootFingerprint
    || manifest.cloneRootFingerprint === manifest.sourceRootFingerprint
  ) throw internalContextError();
}

function pathFingerprint(path) {
  const normalized = process.platform === "win32" ? path.toLowerCase() : path;
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function isPathOutsideRoot(root, candidate) {
  const relation = relative(resolve(root), resolve(candidate));
  return relation === ".."
    || relation.startsWith(`..${sep}`)
    || isAbsolute(relation);
}

function internalContextError() {
  const error = new Error("Internal public-clone verification context is invalid.");
  error.code = "PUBLIC_CLONE_INTERNAL_CONTEXT_INVALID";
  return error;
}

function normalizeIssueCode(raw) {
  const slug = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug.length === 0 ? "unknown_issue" : slug;
}

function normalizeSeverity(raw) {
  const normalized = String(raw ?? "").toLowerCase();
  if (["high", "medium", "low", "info", "unknown"].includes(normalized)) {
    return normalized;
  }
  return "unknown";
}

function summarizeIssueCodes(issueCodes) {
  const summary = {
    total: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    unknown: 0,
    blocking: false,
  };
  if (!Array.isArray(issueCodes)) return summary;
  for (const issue of issueCodes) {
    const severity = normalizeSeverity(issue?.severity);
    if (severity === "high") summary.high += 1;
    else if (severity === "medium") summary.medium += 1;
    else if (severity === "low") summary.low += 1;
    else if (severity === "info") summary.info += 1;
    else summary.unknown += 1;
    summary.total += 1;
  }
  summary.blocking = summary.high > 0;
  return summary;
}

function createIssueCode(code, message, severity = "high", artifactPath = null) {
  return {
    code: normalizeIssueCode(code),
    severity: normalizeSeverity(severity),
    message,
    artifactPath,
    source: ISSUE_SOURCE,
  };
}

const CHECK_ISSUE_CATALOG = {
  healthReady: {
    code: "public_clone_health_not_ready",
    severity: "high",
    message: "Gateway health check endpoint did not return ready status.",
    artifactPath: "/health/check",
  },
  circuitRecoveryReady: {
    code: "public_clone_circuit_recovery_invalid",
    severity: "high",
    message: "Managed credential-free circuit recovery drill did not prove live recovery.",
    artifactPath: "tools/circuit-recovery-drill.mjs",
  },
  openTelemetryReady: {
    code: "public_clone_opentelemetry_invalid",
    severity: "high",
    message: "Gateway did not export privacy-safe W3C-linked spans to the local OTLP collector.",
    artifactPath: "local OTLP /v1/traces collector",
  },
  setupReady: {
    code: "public_clone_setup_readiness_failed",
    severity: "high",
    message: "Gateway readiness setup probe did not return ready status.",
    artifactPath: "/setup/readiness",
  },
  terminalFirstSurface: {
    code: "public_clone_terminal_first_surface_not_gated",
    severity: "medium",
    message: "Terminal-first surfaces were unexpectedly available.",
    artifactPath: "terminal-first pages",
  },
  fakeProviderDefault: {
    code: "public_clone_fake_provider_default_missing",
    severity: "high",
    message: "Gateway did not start with fake-provider default mode.",
    artifactPath: "/health/check",
  },
  promptEnhancementReady: {
    code: "public_clone_prompt_enhancement_invalid",
    severity: "high",
    message: "Prompt-enhancement endpoint did not return expected deterministic result.",
    artifactPath: "/prompts/enhance",
  },
  chatReady: {
    code: "public_clone_chat_invalid",
    severity: "high",
    message: "Chat endpoint did not return a valid success envelope.",
    artifactPath: "/chat",
  },
  chatDefaultEnhancementOff: {
    code: "public_clone_chat_default_enhancement_enabled",
    severity: "low",
    message: "Chat default request unexpectedly had promptEnhancement in response.",
    artifactPath: "/chat",
  },
  chatUsesFakeProvider: {
    code: "public_clone_chat_non_fake_provider",
    severity: "high",
    message: "Chat endpoint did not route to local fake provider.",
    artifactPath: "/chat",
  },
  enhancedChatReady: {
    code: "public_clone_enhanced_chat_failed",
    severity: "high",
    message: "Enhanced chat request did not apply prompt enhancement as expected.",
    artifactPath: "/chat",
  },
  enhancedChatStreamReady: {
    code: "public_clone_enhanced_chat_stream_invalid",
    severity: "high",
    message: "Enhanced streaming chat response did not include expected SSE body.",
    artifactPath: "/chat/stream",
  },
  streamingChatReady: {
    code: "public_clone_stream_chat_invalid",
    severity: "high",
    message: "Streaming chat endpoint did not emit the expected SSE events.",
    artifactPath: "/chat/stream",
  },
  openAiModelsReady: {
    code: "public_clone_openai_models_invalid",
    severity: "high",
    message: "OpenAI-compatible models endpoint missing local fake model.",
    artifactPath: "/v1/models",
  },
  openAiChatReady: {
    code: "public_clone_openai_chat_invalid",
    severity: "high",
    message: "OpenAI-compatible chat endpoint did not return expected success response.",
    artifactPath: "/v1/chat/completions",
  },
  openAiChatUsesFakeProvider: {
    code: "public_clone_openai_chat_non_fake_provider",
    severity: "high",
    message: "OpenAI-compatible chat response did not indicate fake provider execution.",
    artifactPath: "/v1/chat/completions",
  },
  enhancedOpenAiChatReady: {
    code: "public_clone_openai_enhanced_chat_invalid",
    severity: "high",
    message: "Enhanced OpenAI-compatible chat did not apply prompt enhancement.",
    artifactPath: "/v1/chat/completions",
  },
  openAiChatStreamReady: {
    code: "public_clone_openai_stream_invalid",
    severity: "high",
    message: "OpenAI-compatible streaming chat endpoint did not return expected chunked format.",
    artifactPath: "/v1/chat/completions",
  },
  javascriptExampleReady: {
    code: "public_clone_javascript_example_exit_nonzero",
    severity: "medium",
    message: "JavaScript smoke example exited non-zero.",
    artifactPath: "docs/examples/javascript-chat.mjs",
  },
  javascriptExampleUsesFakeProvider: {
    code: "public_clone_javascript_example_non_fake_provider",
    severity: "high",
    message: "JavaScript smoke example did not prove fake provider path.",
    artifactPath: "docs/examples/javascript-chat.mjs",
  },
  sharedSdkExampleReady: {
    code: "public_clone_shared_sdk_invalid",
    severity: "high",
    message: "Shared SDK example did not return expected deterministic fake metadata.",
    artifactPath: "docs/examples/shared-sdk-prompt-enhancement.mjs",
  },
  officialOpenAiSdkReady: {
    code: "public_clone_openai_sdk_invalid",
    severity: "high",
    message: "Official OpenAI SDK compatibility example did not pass all checks.",
    artifactPath: "docs/examples/openai-sdk-chat.mjs",
  },
  officialAnthropicSdkReady: {
    code: "public_clone_anthropic_sdk_invalid",
    severity: "high",
    message: "Official Anthropic SDK compatibility example did not pass all checks.",
    artifactPath: "docs/examples/anthropic-sdk-messages.mjs",
  },
  officialA2ASdkReady: {
    code: "public_clone_a2a_sdk_invalid",
    severity: "high",
    message: "A2A SDK compatibility example did not pass all checks.",
    artifactPath: "docs/examples/a2a-sdk-client.mjs",
  },
  mcpStdioReady: {
    code: "public_clone_mcp_smoke_invalid",
    severity: "high",
    message: "MCP smoke validation failed.",
    artifactPath: "tools/mcp-smoke.mjs",
  },
  localClientControlPlaneReady: {
    code: "public_clone_local_client_control_plane_invalid",
    severity: "high",
    message: "Credential-free local-client control-plane smoke did not remain tenant-scoped, redacted, fake, and preview-only.",
    artifactPath: "tools/local-client-control-plane-smoke.mjs",
  },
  localClientContractsReady: {
    code: "public_clone_local_client_contracts_invalid",
    severity: "high",
    message: "Local-client control, verification, durable execution, or trusted provider-routing contract tests failed.",
    artifactPath: "apps/ai-gateway-service/src/capabilities/localClientLoopbackAdapter.test.ts",
  },
};

function buildIssueCodesFromChecks(checks) {
  if (!checks || typeof checks !== "object") return [];
  const issueCodes = [];
  const seen = new Set();
  for (const [check, passed] of Object.entries(checks)) {
    if (passed) continue;
    const rule = CHECK_ISSUE_CATALOG[check];
    if (!rule) continue;
    const code = normalizeIssueCode(rule.code);
    const key = `${code}:${rule.severity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issueCodes.push(
      createIssueCode(code, `${rule.message} (${check}=${String(passed)})`, rule.severity, rule.artifactPath),
    );
  }
  return issueCodes;
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function findFreePort() {
  const server = createNetServer();
  server.unref();
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolvePromise) => server.close(resolvePromise));
  if (!port) throw new Error("Unable to allocate a local test port.");
  return port;
}

async function startOtlpCollector() {
  const payloads = [];
  const server = createHttpServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/v1/traces") {
      response.writeHead(404, { connection: "close" });
      response.end();
      return;
    }

    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 2_000_000) {
        response.writeHead(413, { connection: "close" });
        response.end();
        return;
      }
      chunks.push(chunk);
    }

    try {
      payloads.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      response.writeHead(200, {
        "content-type": "application/json",
        connection: "close",
      });
      response.end("{}");
    } catch {
      response.writeHead(400, { connection: "close" });
      response.end();
    }
  });
  server.unref();
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  if (!port) throw new Error("Unable to start the local OTLP collector.");

  return {
    endpoint: `http://127.0.0.1:${port}/v1/traces`,
    payloads,
    async close() {
      server.closeIdleConnections?.();
      await new Promise((resolvePromise) => server.close(resolvePromise));
    },
  };
}

function flattenOtlpSpans(payloads) {
  return payloads.flatMap((payload) =>
    (payload?.resourceSpans ?? []).flatMap((resourceSpan) =>
      (resourceSpan.scopeSpans ?? resourceSpan.instrumentationLibrarySpans ?? []).flatMap(
        (scopeSpan) => scopeSpan.spans ?? [],
      ),
    ),
  );
}

function otlpIdToHex(value) {
  if (typeof value !== "string" || value.length === 0) return "";
  if (/^[0-9a-f]+$/iu.test(value)) return value.toLowerCase();
  try {
    return Buffer.from(value, "base64").toString("hex");
  } catch {
    return "";
  }
}

function readOtlpAttribute(span, key) {
  const value = span?.attributes?.find((attribute) => attribute.key === key)?.value;
  if (!value) return undefined;
  return value.stringValue
    ?? value.intValue
    ?? value.doubleValue
    ?? value.boolValue
    ?? value.arrayValue
    ?? value.kvlistValue;
}

async function waitForTraceEvidence(collector, traceId) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const spans = flattenOtlpSpans(collector.payloads);
    const traceSpans = spans.filter((span) => otlpIdToHex(span.traceId) === traceId);
    const hasServerSpan = traceSpans.some(
      (span) => span.kind === 2 || span.kind === "SPAN_KIND_SERVER",
    );
    const hasGenAiSpan = traceSpans.some(
      (span) => readOtlpAttribute(span, "gen_ai.operation.name") !== undefined,
    );
    if (hasServerSpan && hasGenAiSpan) return spans;
    await delay(100);
  }
  throw new Error("Gateway did not export linked HTTP and GenAI spans within 10 seconds.");
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return { status: response.status, body };
}

async function waitForReady(baseUrl, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (hasChildExited(child)) {
      throw new Error(
        `Gateway exited before becoming ready with code ${child.exitCode ?? child.signalCode}.`,
      );
    }
    try {
      const health = await fetchJson(`${baseUrl}/health/check`);
      if (health.status === 200) return health;
    } catch {
      // Startup can briefly refuse connections.
    }
    await delay(300);
  }
  throw new Error("Gateway did not become ready within 30 seconds.");
}

async function stopChild(child) {
  if (hasChildExited(child)) return;
  if (process.platform === "win32") {
    await terminateChildTree(child);
    return;
  }
  child.kill("SIGTERM");
  await waitForChildExit(child, 3_000);
  if (!hasChildExited(child)) {
    child.kill("SIGKILL");
    await waitForChildExit(child, 5_000);
  }
  if (!hasChildExited(child)) {
    const error = new Error("Gateway child process did not terminate after forced cleanup.");
    error.code = "PUBLIC_CLONE_CHILD_CLEANUP_FAILED";
    throw error;
  }
}

function waitForChildExit(child, timeoutMs) {
  if (hasChildExited(child)) return Promise.resolve(true);
  return new Promise((resolvePromise) => {
    let timer;
    let settled = false;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("exit", onExit);
      resolvePromise(exited);
    };
    const onExit = () => finish(true);
    child.once("exit", onExit);
    timer = setTimeout(() => finish(hasChildExited(child)), timeoutMs);
    if (hasChildExited(child)) finish(true);
  });
}

function hasChildExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

async function runMcpSmoke() {
  let stdout = "";
  let stderr = "";
  const child = spawn(process.execPath, [mcpSmokeEntrypoint, "--json"], {
    cwd: repoRoot,
    windowsHide: true,
    env: {
      ...process.env,
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      PME_ENTERPRISE_AUTH_ENABLED: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout = `${stdout}${chunk}`.slice(-16_000);
  });
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-8_000);
  });
  const exitCode = await waitForChildExitCode(child, 5 * 60_000, "MCP smoke");
  let body;
  try {
    body = JSON.parse(stdout);
  } catch {
    body = {
      ok: false,
      error: "MCP smoke output was not valid JSON.",
      outputTail: `${stdout}\n${stderr}`.trim().slice(-4_000),
    };
  }
  return { exitCode, body };
}

async function runLocalClientControlPlaneSmoke() {
  let stdout = "";
  let stderr = "";
  const child = spawn(process.execPath, [localClientSmokeEntrypoint], {
    cwd: repoRoot,
    windowsHide: true,
    env: {
      ...process.env,
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout = `${stdout}${chunk}`.slice(-16_000);
  });
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-8_000);
  });
  const exitCode = await waitForChildExitCode(child, 2 * 60_000, "local-client smoke");
  let body = null;
  try {
    body = JSON.parse(stdout);
  } catch {
    body = null;
  }
  return {
    exitCode,
    body,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

async function runLocalClientContractTests() {
  let stdout = "";
  let stderr = "";
  const child = spawn(process.execPath, [
    vitestEntrypoint,
    "run",
    "apps/ai-gateway-service/src/capabilities/localClientAdapterRegistry.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientConfigTransaction.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientExecutionIdempotencyCoordinator.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientExecutionOrchestrator.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientExecutionReceiptReconciliation.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientExecutionReceiptJournalRegistry.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientExecutionReceiptRecoveryService.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientExecutionFeedbackDispatcher.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientExecutionPreview.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientExecutionReadiness.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientGovernedExecutionApi.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientGovernedOnboardingApi.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientGovernedOnboardingRuntime.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientRoutePlanStore.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientSqliteRoutePlanStore.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientSqliteExecutionClaimStore.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientSqliteFeedbackDedupStore.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientSqliteExecutionFeedbackOutbox.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientSqliteOnboardingReceiptAuthorityStore.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientSqliteVerificationAuthorityEpochStore.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientLoopbackAdapter.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientLoopbackAdapterConfig.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientLoopbackVerificationProbe.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientManagementService.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientOnboardingConfig.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientOnboardingRegistry.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientPopIdentityAuthority.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientPopHttpAuth.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientSqlitePopReplayGuard.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientPopSnapshotRollbackProtection.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientProtocolPrincipalConfig.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientSmartManagementScheduler.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientSmartManagementSchedulerConfig.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientVerificationService.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientVerificationOwnership.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientVerifiedExecutionFence.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientWindowsProtectedAuthorityAnchor.test.ts",
    "apps/ai-gateway-service/src/capabilities/localClientWindowsAuthorityBrokerService.test.ts",
    "apps/ai-gateway-service/src/application/createGatewayApplication.test.js",
    "apps/ai-gateway-service/src/http/gatewayShutdown.test.ts",
    "apps/ai-gateway-service/src/http/httpRequestExecution.test.ts",
    "apps/ai-gateway-service/src/http/httpServer.providerDispatch.test.ts",
    "apps/ai-gateway-service/src/http/openAiChatCompletionResponseCache.test.ts",
    "apps/ai-gateway-service/src/http/utils/healthUtils.usageLedger.test.ts",
    "apps/ai-gateway-service/src/http/utils/responseUtils.test.js",
    "apps/ai-gateway-service/src/http/localClientGovernedExecution.e2e.test.ts",
    "apps/ai-gateway-service/src/http/localClientManagementRoutes.test.ts",
    "apps/ai-gateway-service/src/routing/localClientProviderPolicy.test.ts",
    "apps/ai-gateway-service/src/routing/localClientProviderPolicyConfig.test.ts",
    "apps/ai-gateway-service/src/routing/localClientProviderRuntimeRouter.test.ts",
    "apps/ai-gateway-service/src/routing/localClientProviderDispatchBinding.test.ts",
    "apps/ai-gateway-service/src/core/gatewayService.providerDispatch.test.ts",
    "apps/ai-gateway-service/src/core/gatewayService.providerOperation.test.ts",
  ], {
    cwd: repoRoot,
    windowsHide: true,
    env: {
      ...process.env,
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout = `${stdout}${chunk}`.slice(-16_000);
  });
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-8_000);
  });
  const exitCode = await waitForChildExitCode(child, 10 * 60_000, "local-client contract tests");
  return {
    exitCode,
    passed: exitCode === 0,
    outputTail: `${stdout}\n${stderr}`.trim().slice(-4_000),
  };
}

async function runManagedLocalClientSdkTests() {
  let stdout = "";
  let stderr = "";
  const child = spawn(process.execPath, [
    "--test",
    "packages/shared-sdk/src/index.test.js",
  ], {
    cwd: repoRoot,
    windowsHide: true,
    env: {
      ...process.env,
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout = `${stdout}${chunk}`.slice(-16_000);
  });
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-8_000);
  });
  const exitCode = await waitForChildExitCode(
    child,
    2 * 60_000,
    "managed local-client SDK tests",
  );
  return {
    exitCode,
    passed: exitCode === 0,
    outputTail: `${stdout}\n${stderr}`.trim().slice(-4_000),
  };
}

async function runCircuitRecoveryDrill() {
  let stdout = "";
  let stderr = "";
  const child = spawn(
    process.execPath,
    [circuitRecoveryDrillEntrypoint, "--managed-gateway", "--json"],
    {
      cwd: repoRoot,
      windowsHide: true,
      env: {
        ...process.env,
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const exitCode = await waitForChildExitCode(child, 5 * 60_000, "circuit recovery drill");
  let body = null;
  try {
    body = JSON.parse(stdout);
  } catch {
    body = null;
  }
  return { exitCode, body, stdout: stdout.trim(), stderr: stderr.trim() };
}

async function runJavaScriptExample(baseUrl) {
  let stdout = "";
  let stderr = "";
  const child = spawn(
    process.execPath,
    [javascriptExampleEntrypoint, "Public clone JavaScript example"],
    {
      cwd: repoRoot,
      windowsHide: true,
      env: {
        ...process.env,
        AI_GATEWAY_SERVICE_URL: baseUrl,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout = `${stdout}${chunk}`.slice(-4_000);
  });
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-4_000);
  });
  const exitCode = await waitForChildExitCode(child, 2 * 60_000, "JavaScript example");
  return {
    exitCode,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

async function runSharedSdkExample(baseUrl) {
  let stdout = "";
  let stderr = "";
  const child = spawn(
    process.execPath,
    [
      sharedSdkExampleEntrypoint,
      "Build a Node API with tests",
      "--profile",
      "coding",
      "--language",
      "en",
    ],
    {
      cwd: repoRoot,
      windowsHide: true,
      env: {
        ...process.env,
        AI_GATEWAY_BASE_URL: baseUrl,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout = `${stdout}${chunk}`.slice(-8_000);
  });
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-4_000);
  });
  const exitCode = await waitForChildExitCode(child, 2 * 60_000, "shared SDK example");
  let body = null;
  try {
    body = JSON.parse(stdout);
  } catch {
    // The checks below report the captured output when the example is invalid.
  }
  return {
    exitCode,
    body,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

async function runOpenAiSdkExample(baseUrl) {
  let stdout = "";
  let stderr = "";
  const child = spawn(process.execPath, [openAiSdkExampleEntrypoint], {
    cwd: repoRoot,
    windowsHide: true,
    env: {
      ...process.env,
      AI_GATEWAY_SERVICE_URL: baseUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout = `${stdout}${chunk}`.slice(-16_000);
  });
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-8_000);
  });
  const exitCode = await waitForChildExitCode(child, 2 * 60_000, "OpenAI SDK example");
  let body = null;
  try {
    body = JSON.parse(stdout);
  } catch {
    // The checks below report the captured output when the example is invalid.
  }
  return {
    exitCode,
    body,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

async function runAnthropicSdkExample(baseUrl) {
  let stdout = "";
  let stderr = "";
  const child = spawn(process.execPath, [anthropicSdkExampleEntrypoint], {
    cwd: repoRoot,
    windowsHide: true,
    env: {
      ...process.env,
      AI_GATEWAY_SERVICE_URL: baseUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout = `${stdout}${chunk}`.slice(-16_000);
  });
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-8_000);
  });
  const exitCode = await waitForChildExitCode(child, 2 * 60_000, "Anthropic SDK example");
  let body = null;
  try {
    body = JSON.parse(stdout);
  } catch {
    // The checks below report the captured output when the example is invalid.
  }
  return {
    exitCode,
    body,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

async function runA2ASdkExample(baseUrl) {
  let stdout = "";
  let stderr = "";
  const child = spawn(process.execPath, [a2aSdkExampleEntrypoint], {
    cwd: repoRoot,
    windowsHide: true,
    env: {
      ...process.env,
      AI_GATEWAY_SERVICE_URL: baseUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout = `${stdout}${chunk}`.slice(-16_000);
  });
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-8_000);
  });
  const exitCode = await waitForChildExitCode(child, 2 * 60_000, "A2A SDK example");
  let body = null;
  try {
    body = JSON.parse(stdout);
  } catch {
    // The checks below report the captured output when the example is invalid.
  }
  return {
    exitCode,
    body,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

const internalCleanCloneRun = process.argv.length === 3
  && process.argv[2] === INTERNAL_CLEAN_CLONE_ARGUMENT;
if (!internalCleanCloneRun) {
  if (process.argv.length !== 2) {
    const issueCodes = [createIssueCode(
      "public_clone_argument_invalid",
      "Public clone verification does not accept caller-supplied mode arguments.",
      "high",
      "tools/verify-public-clone.mjs",
    )];
    process.stdout.write(`${JSON.stringify({
      ok: false,
      phase: "outer-clean-clone",
      issueCodes,
      issueCodeSummary: summarizeIssueCodes(issueCodes),
      realProviderCallsMade: false,
    }, null, 2)}\n`);
    process.exit(1);
  }
  try {
    await runInActualPublicClone();
  } catch (error) {
    const issueCodes = [
      createIssueCode(
        error?.code ?? "public_clone_outer_failure",
        error instanceof Error ? error.message : String(error),
        "high",
        "tools/verify-public-clone.mjs",
      ),
    ];
    process.stdout.write(`${JSON.stringify({
      ok: false,
      phase: "outer-clean-clone",
      issueCodes,
      issueCodeSummary: summarizeIssueCodes(issueCodes),
      realProviderCallsMade: false,
    }, null, 2)}\n`);
    process.exitCode = 1;
  }
  if (process.exitCode) process.exit(process.exitCode);
  process.exit(0);
}

try {
  await assertInternalCleanClone();
} catch (error) {
  const issueCodes = [createIssueCode(
    error?.code ?? "public_clone_internal_context_invalid",
    error instanceof Error ? error.message : String(error),
    "high",
    "tools/verify-public-clone.mjs",
  )];
  process.stdout.write(`${JSON.stringify({
    ok: false,
    phase: "internal-clean-clone-bootstrap",
    issueCodes,
    issueCodeSummary: summarizeIssueCodes(issueCodes),
    realProviderCallsMade: false,
  }, null, 2)}\n`);
  process.exit(1);
}
const mcpSmoke = await runMcpSmoke();
const localClientControlPlaneSmoke = await runLocalClientControlPlaneSmoke();
const localClientContractTests = await runLocalClientContractTests();
const managedLocalClientSdkTests = await runManagedLocalClientSdkTests();
const circuitRecoveryDrill = await runCircuitRecoveryDrill();

const port = await findFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const otlpCollector = await startOtlpCollector();
let stdout = "";
let stderr = "";
const child = spawn(process.execPath, [serviceEntrypoint], {
  cwd: serviceRoot,
  windowsHide: true,
  env: {
    ...process.env,
    AI_GATEWAY_SERVICE_HOST: "127.0.0.1",
    AI_GATEWAY_SERVICE_PORT: String(port),
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ROUTE_MODE: "registry-default",
    AI_GATEWAY_DEFAULT_PROVIDER: "local-fake-provider",
    AI_GATEWAY_DEFAULT_MODEL: "local-fake-model",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    AI_GATEWAY_OTEL_ENABLED: "true",
    AI_GATEWAY_OTEL_EXPORTER_MODE: "simple",
    AI_GATEWAY_OTEL_SAMPLE_RATIO: "1",
    AI_GATEWAY_OTEL_SERVICE_NAME: "public-clone-ai-gateway",
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: otlpCollector.endpoint,
    OTEL_EXPORTER_OTLP_HEADERS: "",
    OTEL_EXPORTER_OTLP_TRACES_HEADERS: "",
    PME_ENTERPRISE_AUTH_ENABLED: "false",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  stdout = `${stdout}${chunk}`.slice(-8_000);
});
child.stderr.on("data", (chunk) => {
  stderr = `${stderr}${chunk}`.slice(-8_000);
});

let result;
let gatewayCleanedUp = false;
try {
  const health = await waitForReady(baseUrl, child);
  const setup = await fetchJson(`${baseUrl}/setup/readiness`);
  const uiResponse = await fetch(`${baseUrl}/ui`);
  const consoleResponse = await fetch(`${baseUrl}/console`);
  const javascriptExample = await runJavaScriptExample(baseUrl);
  const sharedSdkExample = await runSharedSdkExample(baseUrl);
  const openAiSdkExample = await runOpenAiSdkExample(baseUrl);
  const anthropicSdkExample = await runAnthropicSdkExample(baseUrl);
  const a2aSdkExample = await runA2ASdkExample(baseUrl);
  const promptEnhancement = await fetchJson(`${baseUrl}/prompts/enhance`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input: "Build a Node API with tests",
      profile: "coding",
    }),
  });
  const chat = await fetchJson(`${baseUrl}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "Public clone smoke test" }),
  });
  const enhancedChat = await fetchJson(`${baseUrl}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt: "Build a Node API with tests",
      promptEnhancement: {
        enabled: true,
        profile: "coding",
      },
    }),
  });
  const enhancedChatStreamResponse = await fetch(`${baseUrl}/chat/stream`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt: "Build a Node API with tests",
      promptEnhancement: {
        enabled: true,
        profile: "coding",
      },
    }),
  });
  const enhancedChatStreamText = await enhancedChatStreamResponse.text();
  const streamingChatResponse = await fetch(`${baseUrl}/chat/stream`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt: "Say hello in one short sentence",
      providerId: "local-fake-provider",
      model: "local-fake-model",
    }),
  });
  const streamingChatText = await streamingChatResponse.text();
  const openAiModels = await fetchJson(`${baseUrl}/v1/models`);
  const openAiChat = await fetchJson(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "local-fake-model",
      messages: [{ role: "user", content: "OpenAI-compatible public clone test" }],
    }),
  });
  const enhancedOpenAiChat = await fetchJson(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "local-fake-model",
      messages: [{ role: "user", content: "Build a Node API with tests" }],
      unified_ai: {
        prompt_enhancement: { enabled: true, profile: "coding", language: "en" },
      },
    }),
  });
  const openAiStreamResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "local-fake-model",
      messages: [{ role: "user", content: "Stream through the compatibility API" }],
      stream: true,
    }),
  });
  const openAiStreamText = await openAiStreamResponse.text();

  const propagatedTraceId = "4bf92f3577b34da6a3ce929d0e0e4736";
  const propagatedParentSpanId = "00f067aa0ba902b7";
  const privacyProbe = "OTEL_PRIVATE_PROBE_7a1f5c92";
  const tracedResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      traceparent: `00-${propagatedTraceId}-${propagatedParentSpanId}-01`,
    },
    body: JSON.stringify({
      model: "local-fake-model",
      messages: [{ role: "user", content: privacyProbe }],
    }),
  });
  const tracedResponseTraceparent = tracedResponse.headers.get("traceparent") ?? "";
  const tracedResponseTraceId = tracedResponse.headers.get("x-trace-id") ?? "";
  await tracedResponse.text();

  const invalidTraceResponse = await fetch(`${baseUrl}/health/check`, {
    headers: {
      traceparent: "00-00000000000000000000000000000000-0000000000000000-01",
    },
  });
  const invalidResponseTraceparent = invalidTraceResponse.headers.get("traceparent") ?? "";
  await invalidTraceResponse.text();

  const exportedSpans = await waitForTraceEvidence(otlpCollector, propagatedTraceId);
  const propagatedSpans = exportedSpans.filter(
    (span) => otlpIdToHex(span.traceId) === propagatedTraceId,
  );
  const serverSpan = propagatedSpans.find(
    (span) => span.kind === 2 || span.kind === "SPAN_KIND_SERVER",
  );
  const genAiSpan = propagatedSpans.find(
    (span) => readOtlpAttribute(span, "gen_ai.operation.name") !== undefined,
  );
  const invalidResponseTraceId = invalidResponseTraceparent.split("-")[1] ?? "";
  const openTelemetry = {
    collectorRequestCount: otlpCollector.payloads.length,
    exportedSpanCount: exportedSpans.length,
    status: tracedResponse.status,
    traceIdPropagated:
      tracedResponseTraceparent.split("-")[1] === propagatedTraceId
      && tracedResponseTraceId === propagatedTraceId,
    invalidTraceRegenerated:
      /^[0-9a-f]{32}$/u.test(invalidResponseTraceId)
      && invalidResponseTraceId !== "00000000000000000000000000000000",
    serverParentPreserved:
      otlpIdToHex(serverSpan?.parentSpanId) === propagatedParentSpanId,
    genAiChildLinked:
      otlpIdToHex(genAiSpan?.parentSpanId) === otlpIdToHex(serverSpan?.spanId),
    genAiAttributes:
      typeof readOtlpAttribute(genAiSpan, "gen_ai.operation.name") === "string"
      && readOtlpAttribute(genAiSpan, "gen_ai.request.model") === "local-fake-model"
      && readOtlpAttribute(genAiSpan, "gen_ai.provider.name") === "local-fake-provider"
      && readOtlpAttribute(genAiSpan, "gen_ai.usage.input_tokens") !== undefined
      && readOtlpAttribute(genAiSpan, "gen_ai.usage.output_tokens") !== undefined,
    contentPrivacyPreserved:
      !JSON.stringify(otlpCollector.payloads).includes(privacyProbe),
    realProviderCallsMade: false,
  };

  const checks = {
    healthReady: health.status === 200 && health.body?.data?.status === "ready",
    circuitRecoveryReady:
      circuitRecoveryDrill.exitCode === 0
      && circuitRecoveryDrill.body?.status === "recovered"
      && Object.values(circuitRecoveryDrill.body?.checks ?? {}).every(Boolean)
      && circuitRecoveryDrill.body?.managedGateway?.cleanedUp === true
      && circuitRecoveryDrill.body?.realProviderCallsMade === false,
    openTelemetryReady:
      openTelemetry.status === 200
      && openTelemetry.collectorRequestCount > 0
      && openTelemetry.exportedSpanCount > 0
      && [
        openTelemetry.traceIdPropagated,
        openTelemetry.invalidTraceRegenerated,
        openTelemetry.serverParentPreserved,
        openTelemetry.genAiChildLinked,
        openTelemetry.genAiAttributes,
        openTelemetry.contentPrivacyPreserved,
      ].every(Boolean)
      && openTelemetry.realProviderCallsMade === false,
    setupReady: setup.status === 200 && setup.body?.data?.status === "ready",
    terminalFirstSurface:
      uiResponse.status === 404
      && consoleResponse.status === 404,
    fakeProviderDefault: health.body?.data?.realProviderEnabled === false,
    promptEnhancementReady:
      promptEnhancement.status === 200
      && promptEnhancement.body?.status === "ok"
      && promptEnhancement.body?.data?.original === "Build a Node API with tests"
      && promptEnhancement.body?.data?.profile === "coding"
      && promptEnhancement.body?.data?.enhancedPrompt?.includes("Build a Node API with tests")
      && promptEnhancement.body?.data?.metadata?.providerCalled === false,
    chatReady: chat.status === 200 && chat.body?.success === true && chat.body?.code === "ROUTE_OK",
    chatDefaultEnhancementOff: chat.body?.data?.promptEnhancement === undefined,
    chatUsesFakeProvider:
      chat.body?.data?.executionMode === "fake"
      && chat.body?.data?.selectedProvider === "local-fake-provider",
    enhancedChatReady:
      enhancedChat.status === 200
      && enhancedChat.body?.success === true
      && enhancedChat.body?.data?.promptEnhancement?.applied === true
      && enhancedChat.body?.data?.promptEnhancement?.profile === "coding"
      && enhancedChat.body?.data?.executionMode === "fake"
      && enhancedChat.body?.data?.outputText?.includes("# Execution requirements"),
    enhancedChatStreamReady:
      enhancedChatStreamResponse.status === 200
      && enhancedChatStreamText.includes('"promptEnhancement":{"applied":true')
      && enhancedChatStreamText.includes("# Execution requirements"),
    streamingChatReady:
      streamingChatResponse.status === 200
      && streamingChatText.includes("event: start")
      && streamingChatText.includes("event: chunk")
      && streamingChatText.includes("event: done")
      && streamingChatText.includes('"selectedProvider":"local-fake-provider"')
      && streamingChatText.includes('"executionMode":"fake"')
      && streamingChatText.includes('"executionStatus":"success"')
      && streamingChatText.includes("Say hello in one short sentence"),
    openAiModelsReady:
      openAiModels.status === 200
      && openAiModels.body?.object === "list"
      && openAiModels.body?.data?.some((model) =>
        model.id === "local-fake-model"
        && model.owned_by === "local-fake-provider"
        && model.unified_ai?.execution_mode === "fake"
      ),
    openAiChatReady:
      openAiChat.status === 200
      && openAiChat.body?.object === "chat.completion"
      && openAiChat.body?.model === "local-fake-model"
      && openAiChat.body?.choices?.[0]?.message?.role === "assistant"
      && openAiChat.body?.choices?.[0]?.message?.content?.includes("OpenAI-compatible public clone test")
      && openAiChat.body?.choices?.[0]?.finish_reason === "stop",
    openAiChatUsesFakeProvider:
      openAiChat.body?.unified_ai?.selected_provider === "local-fake-provider"
      && openAiChat.body?.unified_ai?.execution_mode === "fake"
      && openAiChat.body?.unified_ai?.execution_status === "success",
    enhancedOpenAiChatReady:
      enhancedOpenAiChat.status === 200
      && enhancedOpenAiChat.body?.unified_ai?.prompt_enhancement?.applied === true
      && enhancedOpenAiChat.body?.unified_ai?.prompt_enhancement?.profile === "coding"
      && enhancedOpenAiChat.body?.choices?.[0]?.message?.content?.includes("# Execution requirements"),
    openAiChatStreamReady:
      openAiStreamResponse.status === 200
      && openAiStreamText.includes('"object":"chat.completion.chunk"')
      && openAiStreamText.includes('"delta":{"role":"assistant","content":""}')
      && openAiStreamText.includes('"selected_provider":"local-fake-provider"')
      && openAiStreamText.includes('"execution_mode":"fake"')
      && openAiStreamText.includes('"finish_reason":"stop"')
      && openAiStreamText.endsWith("data: [DONE]\n\n")
      && !openAiStreamText.includes("event:"),
    javascriptExampleReady: javascriptExample.exitCode === 0,
    javascriptExampleUsesFakeProvider:
      javascriptExample.stdout.includes("provider: local-fake-provider")
      && javascriptExample.stdout.includes("mode: fake"),
    sharedSdkExampleReady:
      sharedSdkExample.exitCode === 0
      && sharedSdkExample.body?.client === "@unified-ai-system/shared-sdk"
      && sharedSdkExample.body?.original === "Build a Node API with tests"
      && sharedSdkExample.body?.metadata?.providerCalled === false
      && sharedSdkExample.body?.metadata?.credentialRequired === false
      && sharedSdkExample.body?.metadata?.deterministic === true,
    officialOpenAiSdkReady:
      openAiSdkExample.exitCode === 0
      && openAiSdkExample.body?.ok === true
      && openAiSdkExample.body?.client === "openai"
      && openAiSdkExample.body?.sdkVersion === "7.4.0"
      && openAiSdkExample.body?.model === "local-fake-model"
      && openAiSdkExample.body?.executionMode === "fake"
      && Object.values(openAiSdkExample.body?.checks ?? {}).every(Boolean)
      && openAiSdkExample.body?.invalidRequest?.status === 400
      && openAiSdkExample.body?.realProviderCallsMade === false,
    officialAnthropicSdkReady:
      anthropicSdkExample.exitCode === 0
      && anthropicSdkExample.body?.ok === true
      && anthropicSdkExample.body?.client === "@anthropic-ai/sdk"
      && anthropicSdkExample.body?.sdkVersion === "0.116.0"
      && anthropicSdkExample.body?.model === "local-fake-model"
      && anthropicSdkExample.body?.executionMode === "fake"
      && Object.values(anthropicSdkExample.body?.checks ?? {}).every(Boolean)
      && anthropicSdkExample.body?.invalidRequest?.status === 400
      && anthropicSdkExample.body?.realProviderCallsMade === false,
    officialA2ASdkReady:
      a2aSdkExample.exitCode === 0
      && a2aSdkExample.body?.ok === true
      && a2aSdkExample.body?.client === "@a2a-js/sdk"
      && a2aSdkExample.body?.sdkVersion === "1.0.1"
      && a2aSdkExample.body?.protocolVersion === "1.0"
      && a2aSdkExample.body?.transport === "JSONRPC"
      && Object.values(a2aSdkExample.body?.checks ?? {}).every(Boolean)
      && a2aSdkExample.body?.realProviderCallsMade === false,
    mcpStdioReady:
      mcpSmoke.exitCode === 0
      && mcpSmoke.body?.ok === true
      && mcpSmoke.body?.toolCount === 12
      && mcpSmoke.body?.executionMode === "fake"
      && mcpSmoke.body?.managedGatewayCleanedUp === true,
    localClientControlPlaneReady:
      localClientControlPlaneSmoke.exitCode === 0
      && localClientControlPlaneSmoke.body?.ok === true
      && Object.values(localClientControlPlaneSmoke.body?.checks ?? {}).every(Boolean)
      && localClientControlPlaneSmoke.body?.executionMode === "fake-and-preview-only"
      && localClientControlPlaneSmoke.body?.realProviderCallsMade === false
      && localClientControlPlaneSmoke.body?.localApplicationEffectPerformed === false,
    localClientContractsReady:
      localClientContractTests.exitCode === 0
      && localClientContractTests.passed === true,
    managedLocalClientSdkReady:
      managedLocalClientSdkTests.exitCode === 0
      && managedLocalClientSdkTests.passed === true,
  };
  const issueCodes = buildIssueCodesFromChecks(checks);

  result = {
    ok: Object.values(checks).every(Boolean),
    issueCodes,
    issueCodeSummary: summarizeIssueCodes(issueCodes),
    port,
    checks,
    realProviderCallsMade: false,
    realProviderEnabled: health.body?.data?.realProviderEnabled ?? null,
    circuitRecovery: circuitRecoveryDrill.body,
    openTelemetry,
    javascriptExample,
    sharedSdkExample,
    openAiSdkExample,
    anthropicSdkExample,
    a2aSdkExample,
    mcp: mcpSmoke.body,
    localClientControlPlane: localClientControlPlaneSmoke.body,
    localClientContractTests,
    managedLocalClientSdkTests,
  };
  if (!result.ok) process.exitCode = 1;
} catch (error) {
  const issueCodes = [
    createIssueCode(
      "public_clone_fatal_failure",
      error instanceof Error ? error.message : String(error),
      "high",
      "tools/verify-public-clone.mjs",
    ),
  ];
  result = {
    ok: false,
    issueCodes,
    issueCodeSummary: summarizeIssueCodes(issueCodes),
    port,
    error: error instanceof Error ? error.message : String(error),
    realProviderCallsMade: false,
    outputTail: `${stdout}\n${stderr}`.trim().slice(-4_000),
  };
  process.exitCode = 1;
} finally {
  const cleanupResults = await Promise.allSettled([
    stopChild(child),
    otlpCollector.close(),
  ]);
  const cleanupFailures = cleanupResults.filter((entry) => entry.status === "rejected");
  gatewayCleanedUp = cleanupFailures.length === 0 && await isPortReleased(port);
  if (!gatewayCleanedUp) {
    const cleanupIssue = createIssueCode(
      "public_clone_gateway_cleanup_failed",
      "The public-clone gateway process or listening port was not cleaned up.",
      "high",
      "tools/verify-public-clone.mjs",
    );
    const issueCodes = [...(result?.issueCodes ?? []), cleanupIssue];
    result = {
      ...(result ?? {}),
      ok: false,
      issueCodes,
      issueCodeSummary: summarizeIssueCodes(issueCodes),
      gatewayCleanedUp: false,
      realProviderCallsMade: false,
    };
    process.exitCode = 1;
  }
}

if (result && gatewayCleanedUp) result.gatewayCleanedUp = true;
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

async function isPortReleased(port) {
  return new Promise((resolvePort) => {
    const probe = createNetServer();
    let settled = false;
    const finish = (released) => {
      if (settled) return;
      settled = true;
      probe.removeAllListeners();
      if (probe.listening) {
        probe.close(() => resolvePort(released));
      } else {
        resolvePort(released);
      }
    };
    probe.once("error", () => finish(false));
    probe.listen(port, "127.0.0.1", () => finish(true));
  });
}
