#!/usr/bin/env node

import { createRequire } from "node:module";
import { execFile, spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, parse, resolve } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);

const baseUrl = (
  process.env.AI_GATEWAY_SERVICE_URL
  ?? process.env.AI_GATEWAY_BASE_URL
  ?? "http://127.0.0.1:3100"
).replace(/\/$/, "");
const requested = process.argv
  .find((argument) => argument.startsWith("--client="))
  ?.slice("--client=".length)
  ?? process.argv[process.argv.indexOf("--client") + 1]
  ?? "axios";
const moduleRoot = process.env.CLIENT_RUNTIME_NODE_MODULES
  ? join(process.env.CLIENT_RUNTIME_NODE_MODULES, "..")
  : null;
const moduleRequire = moduleRoot
  ? createRequire(join(moduleRoot, "package.json"))
  : createRequire(import.meta.url);
const sensitiveEnvironmentNamePattern = /(?:^|_)(?:api_?key|token|secret|password|credentials?|authorization)(?:$|_)/i;
const expectedGatewayTools = [
  "gateway_chat",
  "gateway_health",
  "gateway_prompt_enhance",
  "gateway_readiness",
  "knowledge_readiness",
  "workflow_actions",
  "workflow_health",
  "workforce_agents",
  "workforce_health",
];

function loadCommonJs(packageName) {
  return moduleRequire(packageName);
}

function createCredentialFreeEnvironment(baseEnvironment = {}, overrides = {}) {
  const environment = { ...baseEnvironment, ...overrides };
  for (const key of Object.keys(environment)) {
    if (sensitiveEnvironmentNamePattern.test(key)) delete environment[key];
  }
  return environment;
}

function installedPackageVersion(packageName) {
  let directory = dirname(moduleRequire.resolve(packageName));
  const root = parse(directory).root;
  while (directory !== root) {
    try {
      const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
      if (manifest.name === packageName && manifest.version) return String(manifest.version);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    directory = dirname(directory);
  }
  throw new Error(`Could not resolve installed package version: ${packageName}`);
}

async function loadModule(packageName, subpath) {
  const resolved = moduleRequire.resolve(`${packageName}${subpath ?? ""}`);
  return import(pathToFileURL(resolved).href);
}

function inspectorToolPayload(response) {
  if (response?.result?.structuredContent) return response.result.structuredContent;
  const text = response?.result?.content?.find((item) => item?.type === "text")?.text;
  if (typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function waitForClosed(baseUrl, timeoutMs = 5_000) {
  if (typeof baseUrl !== "string" || !baseUrl.startsWith("http://127.0.0.1:")) {
    return false;
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(`${baseUrl}/health/check`, {
        signal: AbortSignal.timeout(500),
      });
    } catch {
      return true;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  return false;
}

function createJsonLineRpc(child) {
  let buffer = "";
  let nextId = 1;
  const pending = new Map();
  const notifications = [];

  const rejectPending = (error) => {
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
  };
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      if (message.id !== undefined && pending.has(message.id)) {
        const entry = pending.get(message.id);
        pending.delete(message.id);
        clearTimeout(entry.timer);
        if (message.error) {
          entry.reject(new Error(`${entry.method}: ${message.error.message ?? JSON.stringify(message.error)}`));
        } else {
          entry.resolve(message.result);
        }
      } else if (message.method) {
        notifications.push(message);
      }
    }
  });
  child.once("error", rejectPending);
  child.once("exit", (code, signal) => {
    rejectPending(new Error(`Codex app-server exited before completing requests (${code ?? signal ?? "unknown"}).`));
  });

  const send = (message) => {
    child.stdin.write(`${JSON.stringify(message)}\n`);
  };
  const request = (method, params, timeoutMs = 45_000) => new Promise((resolvePromise, rejectPromise) => {
    const id = nextId;
    nextId += 1;
    const timer = setTimeout(() => {
      pending.delete(id);
      rejectPromise(new Error(`Codex app-server request timed out: ${method}`));
    }, timeoutMs);
    pending.set(id, {
      method,
      resolve: resolvePromise,
      reject: rejectPromise,
      timer,
    });
    send({ method, id, params });
  });
  return {
    notifications,
    notify(method, params) {
      send({ method, params });
    },
    request,
  };
}

async function stopChild(child, timeoutMs = 8_000) {
  if (child.exitCode !== null) return child.exitCode;
  child.stdin?.end();
  const graceful = await new Promise((resolvePromise) => {
    const timer = setTimeout(() => resolvePromise(false), timeoutMs);
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolvePromise(code ?? 0);
    });
  });
  if (graceful !== false) return graceful;
  child.kill();
  return new Promise((resolvePromise) => {
    child.once("exit", (code) => resolvePromise(code ?? 0));
    setTimeout(() => resolvePromise(null), 2_000);
  });
}

async function waitForFile(path, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(path)) return true;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  return false;
}

async function waitForJsonEvidence(path, predicate, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(path)) {
      try {
        const value = JSON.parse(readFileSync(path, "utf8"));
        if (predicate(value)) return value;
      } catch {
        // The transcript writer may be between its truncate and write operations.
      }
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  return null;
}

function stripAnsi(value) {
  return String(value ?? "").replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "");
}

function packagePath(root, packageName, ...segments) {
  return join(root, "node_modules", ...packageName.split("/"), ...segments);
}

function readHostPackage(root, packageName) {
  const manifestPath = packagePath(root, packageName, "package.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Client runtime host is not installed: ${packageName}. Set CLIENT_RUNTIME_HOST_ROOT.`);
  }
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

function resolvePnpmPlatformBinary(root, packageName, version, ...segments) {
  const store = join(root, "node_modules", ".pnpm");
  const encodedName = packageName.replaceAll("/", "+");
  const directory = readdirSync(store, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name.startsWith(`${encodedName}@${version}`));
  if (!directory) {
    throw new Error(`Client runtime host platform package is not installed: ${packageName}@${version}.`);
  }
  const executable = join(store, directory.name, "node_modules", ...packageName.split("/"), ...segments);
  if (!existsSync(executable)) {
    throw new Error(`Client runtime host executable is not installed: ${executable}.`);
  }
  return executable;
}

function resolveMcpCliHost(clientId) {
  const root = process.env.CLIENT_RUNTIME_HOST_ROOT;
  if (!root || !existsSync(root)) {
    throw new Error("Client runtime hosts are not installed. Set CLIENT_RUNTIME_HOST_ROOT.");
  }

  if (clientId === "mcp-claude-code") {
    const manifest = readHostPackage(root, "@anthropic-ai/claude-code");
    const platformName = process.platform;
    const packageName = `@anthropic-ai/claude-code-${platformName}-${process.arch}`;
    return {
      command: resolvePnpmPlatformBinary(
        root,
        packageName,
        manifest.version,
        process.platform === "win32" ? "claude.exe" : "claude",
      ),
      args: [],
      name: "Claude Code",
      packageName: "@anthropic-ai/claude-code",
      version: String(manifest.version),
    };
  }

  if (clientId === "mcp-gemini-cli") {
    const manifest = readHostPackage(root, "@google/gemini-cli");
    return {
      command: process.execPath,
      args: [packagePath(root, "@google/gemini-cli", "bundle", "gemini.js")],
      name: "Gemini CLI",
      packageName: "@google/gemini-cli",
      version: String(manifest.version),
    };
  }

  if (clientId === "mcp-opencode-cli") {
    const manifest = readHostPackage(root, "opencode-ai");
    const platformName = process.platform === "win32" ? "windows" : process.platform;
    const packageName = `opencode-${platformName}-${process.arch}`;
    return {
      command: resolvePnpmPlatformBinary(
        root,
        packageName,
        manifest.version,
        "bin",
        process.platform === "win32" ? "opencode.exe" : "opencode",
      ),
      args: [],
      name: "OpenCode CLI",
      packageName: "opencode-ai",
      version: String(manifest.version),
    };
  }

  if (clientId === "cline-mcp") {
    const manifest = readHostPackage(root, "cline");
    const platformName = process.platform === "win32" ? "windows" : process.platform;
    const packageName = `@cline/cli-${platformName}-${process.arch}`;
    return {
      command: resolvePnpmPlatformBinary(
        root,
        packageName,
        manifest.version,
        "bin",
        process.platform === "win32" ? "cline.exe" : "cline",
      ),
      args: [],
      name: "Cline CLI",
      packageName: "cline",
      version: String(manifest.version),
    };
  }

  if (clientId === "mcp-continue") {
    const manifest = readHostPackage(root, "@continuedev/cli");
    return {
      command: process.execPath,
      args: [packagePath(root, "@continuedev/cli", "dist", "cn.js")],
      name: "Continue CLI",
      packageName: "@continuedev/cli",
      version: String(manifest.version),
    };
  }

  if (clientId === "cursor-mcp") {
    const runtimeRoot = join(root, "cursor-agent-package", "dist-package");
    const executable = join(runtimeRoot, process.platform === "win32" ? "node.exe" : "node");
    const entrypoint = join(runtimeRoot, "index.js");
    if (!existsSync(executable) || !existsSync(entrypoint)) {
      throw new Error(
        "Cursor Agent CLI runtime is not installed under CLIENT_RUNTIME_HOST_ROOT/cursor-agent-package/dist-package.",
      );
    }
    return {
      command: executable,
      args: [entrypoint],
      name: "Cursor Agent CLI",
      packageName: "@anysphere/agent-cli-runtime",
      version: null,
    };
  }

  throw new Error(`Unknown MCP CLI host: ${clientId}`);
}

async function runHostCommand(host, args, { cwd, env, label, timeout = 120_000 }) {
  try {
    return await execFileAsync(host.command, [...host.args, ...args], {
      cwd,
      env,
      timeout,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    });
  } catch (error) {
    const stdout = stripAnsi(error?.stdout).slice(-4_000);
    const stderr = stripAnsi(error?.stderr).slice(-4_000);
    throw new Error(`${label} failed: ${error?.message ?? error}; stdout: ${stdout}; stderr: ${stderr}`);
  }
}

async function runHostUntilEvidence(host, args, {
  cwd,
  env,
  evidencePath,
  evidencePredicate,
  initialMessages = [],
  label,
  timeout = 120_000,
}) {
  const child = spawn(host.command, [...host.args, ...args], {
    cwd,
    env,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  let stdout = "";
  let stderr = "";
  const append = (current, chunk) => `${current}${chunk.toString("utf8")}`.slice(-8_000);
  child.stdout.on("data", (chunk) => {
    stdout = append(stdout, chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr = append(stderr, chunk);
  });
  child.stdin.on("error", () => {});
  for (const message of initialMessages) {
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  let evidence = await waitForJsonEvidence(
    evidencePath,
    evidencePredicate,
    timeout,
  );
  await stopChild(child, 20_000);
  const hostProcessCleanedUp = await waitForProcessClosed(child.pid, 5_000);
  if (!evidence && existsSync(evidencePath)) {
    try {
      const finalEvidence = JSON.parse(readFileSync(evidencePath, "utf8"));
      if (evidencePredicate(finalEvidence)) evidence = finalEvidence;
    } catch {
      // The final validation below reports an incomplete transcript.
    }
  }
  if (!evidence) {
    throw new Error(
      `${label} did not complete MCP tool discovery; stdout: ${stripAnsi(stdout)}; stderr: ${stripAnsi(stderr)}`,
    );
  }
  if (!hostProcessCleanedUp) {
    throw new Error(`${label} left its host process running (${child.pid}).`);
  }
  return { evidence, hostProcessCleanedUp };
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForProcessClosed(pid, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!processIsAlive(pid)) return true;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  return !processIsAlive(pid);
}

function isolatedHostEnvironment(runtimeRoot, clientId) {
  const home = join(runtimeRoot, "home");
  const environment = createCredentialFreeEnvironment(process.env, {
    HOME: home,
    USERPROFILE: home,
    APPDATA: join(home, "appdata"),
    LOCALAPPDATA: join(home, "localappdata"),
    XDG_CONFIG_HOME: join(home, "xdg-config"),
    XDG_DATA_HOME: join(home, "xdg-data"),
    XDG_CACHE_HOME: join(home, "xdg-cache"),
    NO_COLOR: "1",
    FORCE_COLOR: "0",
    DO_NOT_TRACK: "1",
    OTEL_SDK_DISABLED: "true",
    AI_GATEWAY_AUTO_START: "false",
    AI_GATEWAY_MCP_URL: baseUrl,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_DEFAULT_PROVIDER: "local-fake-provider",
    AI_GATEWAY_DEFAULT_MODEL: "local-fake-model",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    MCP_AUTO_OPEN_ENABLED: "false",
    PME_ENTERPRISE_AUTH_ENABLED: "false",
  });

  if (process.platform === "win32") {
    const drive = parse(home).root.replace(/[\\/]$/, "");
    environment.HOMEDRIVE = drive;
    environment.HOMEPATH = home.slice(drive.length);
  }

  if (clientId === "mcp-claude-code") {
    environment.CLAUDE_CONFIG_DIR = join(home, "claude-config");
    environment.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1";
    environment.DISABLE_AUTOUPDATER = "1";
    environment.DISABLE_TELEMETRY = "1";
  } else if (clientId === "mcp-gemini-cli") {
    environment.GEMINI_CLI_HOME = home;
    environment.GEMINI_CLI_NO_RELAUNCH = "1";
    environment.GEMINI_CLI_TRUST_WORKSPACE = "true";
    environment.GEMINI_CLI_TRUSTED_FOLDERS_PATH = join(home, "trusted-folders.json");
    environment.GEMINI_TELEMETRY_ENABLED = "false";
  } else if (clientId === "mcp-opencode-cli") {
    environment.OPENCODE_CONFIG_DIR = join(home, "opencode-config");
    environment.OPENCODE_AUTO_SHARE = "false";
    environment.OPENCODE_DISABLE_AUTOUPDATE = "true";
    environment.OPENCODE_DISABLE_PRUNE = "true";
  } else if (clientId === "cline-mcp") {
    environment.CLINE_DATA_DIR = join(home, "cline-data");
    environment.CLINE_SANDBOX = "1";
    environment.CLINE_SANDBOX_DATA_DIR = environment.CLINE_DATA_DIR;
  } else if (clientId === "mcp-continue") {
    environment.CONTINUE_GLOBAL_DIR = join(home, "continue-global");
    environment.CONTINUE_CLI_ENABLE_TELEMETRY = "false";
    environment.CONTINUE_METRICS_ENABLED = "false";
  } else if (clientId === "cursor-mcp") {
    environment.CURSOR_CONFIG_DIR = join(home, "cursor-config");
    environment.CURSOR_DATA_DIR = join(home, "cursor-data");
    environment.CURSOR_AGENT_STORE = join(home, "cursor-agent-store");
    environment.CURSOR_AGENT_DISABLE_DEBUG_LOG = "1";
  }

  return environment;
}

async function runMcpCliHost(clientId) {
  const host = resolveMcpCliHost(clientId);
  const repoRoot = process.env.UNIFIED_AI_SYSTEM_REPO_ROOT ?? process.cwd();
  const server = join(repoRoot, "packages", "mcp-server", "src", "index.js");
  const proxy = join(repoRoot, "docs", "examples", "mcp-stdio-transcript-proxy.mjs");
  const runtimeRoot = await mkdtemp(join(tmpdir(), `unified-ai-${clientId}-`));
  const workspace = join(runtimeRoot, "workspace");
  const evidencePath = join(runtimeRoot, "mcp-transcript.json");
  const environment = isolatedHostEnvironment(runtimeRoot, clientId);
  const proxyCommand = process.execPath;
  const proxyArguments = [
    proxy,
    "--evidence", evidencePath,
    "--",
    process.execPath,
    server,
  ];
  let transcript = null;
  let hostProcessCleanedUp = true;
  let continueConfigPath = null;
  let cursorConfigPath = null;

  try {
    await Promise.all([
      mkdir(workspace, { recursive: true }),
      mkdir(join(runtimeRoot, "home", "appdata"), { recursive: true }),
      mkdir(join(runtimeRoot, "home", "localappdata"), { recursive: true }),
      mkdir(join(runtimeRoot, "home", "xdg-config"), { recursive: true }),
      mkdir(join(runtimeRoot, "home", "xdg-data"), { recursive: true }),
      mkdir(join(runtimeRoot, "home", "xdg-cache"), { recursive: true }),
      mkdir(join(runtimeRoot, "home", "claude-config"), { recursive: true }),
      mkdir(join(runtimeRoot, "home", "opencode-config"), { recursive: true }),
      mkdir(join(runtimeRoot, "home", "cline-data", "settings"), { recursive: true }),
      mkdir(join(runtimeRoot, "home", "continue-global"), { recursive: true }),
      mkdir(join(runtimeRoot, "home", "cursor-config"), { recursive: true }),
      mkdir(join(runtimeRoot, "home", "cursor-data"), { recursive: true }),
      mkdir(join(runtimeRoot, "home", "cursor-agent-store"), { recursive: true }),
      mkdir(join(workspace, ".cursor"), { recursive: true }),
    ]);

    const versionResult = await runHostCommand(host, ["--version"], {
      cwd: workspace,
      env: environment,
      label: `${host.name} version`,
    });
    let listArguments;
    let listResult;

    if (clientId === "mcp-claude-code") {
      await runHostCommand(host, [
        "mcp", "add",
        "--scope", "user",
        "--transport", "stdio",
        "unified-ai-system",
        "--",
        proxyCommand,
        ...proxyArguments,
      ], {
        cwd: workspace,
        env: environment,
        label: "Claude Code MCP add",
      });
      listArguments = ["mcp", "list"];
    } else if (clientId === "mcp-gemini-cli") {
      await runHostCommand(host, [
        "mcp", "add",
        "--scope", "user",
        "--transport", "stdio",
        "--trust",
        "unified-ai-system",
        proxyCommand,
        ...proxyArguments,
      ], {
        cwd: workspace,
        env: environment,
        label: "Gemini CLI MCP add",
      });
      listArguments = ["mcp", "list"];
    } else if (clientId === "mcp-opencode-cli") {
      environment.OPENCODE_CONFIG_CONTENT = JSON.stringify({
        mcp: {
          "unified-ai-system": {
            type: "local",
            command: [proxyCommand, ...proxyArguments],
            enabled: true,
          },
        },
        plugin: [],
      });
      listArguments = ["--pure", "mcp", "list"];
    } else if (clientId === "cline-mcp") {
      await runHostCommand(host, [
        "--data-dir", environment.CLINE_DATA_DIR,
        "auth",
        "--provider", "openai",
        "--apikey", "local-placeholder-not-a-key",
        "--modelid", "local-fake-model",
        "--baseurl", `${baseUrl}/v1`,
      ], {
        cwd: workspace,
        env: environment,
        label: "Cline CLI local fake-provider configuration",
      });
      listResult = await runHostCommand(host, [
        "--data-dir", environment.CLINE_DATA_DIR,
        "mcp", "install",
        "unified-ai-system",
        "--yes",
        "--json",
        "--",
        proxyCommand,
        ...proxyArguments,
      ], {
        cwd: workspace,
        env: environment,
        label: "Cline CLI MCP install",
      });
    } else if (clientId === "mcp-continue") {
      continueConfigPath = join(runtimeRoot, "continue-config.yaml");
      await writeFile(continueConfigPath, `${JSON.stringify({
        name: "Unified AI System certification",
        version: "1.0.0",
        schema: "v1",
        models: [{
          name: "Local fake model",
          provider: "openai",
          model: "local-fake-model",
          apiBase: `${baseUrl}/v1`,
          apiKey: "local-placeholder-not-a-key",
          roles: ["chat"],
          capabilities: ["tool_use"],
          useResponsesApi: false,
        }],
        mcpServers: [{
          name: "unified-ai-system",
          command: proxyCommand,
          args: proxyArguments,
        }],
      }, null, 2)}\n`, "utf8");
      listResult = { stdout: "", stderr: "" };
    } else if (clientId === "cursor-mcp") {
      cursorConfigPath = join(workspace, ".cursor", "mcp.json");
      await writeFile(cursorConfigPath, `${JSON.stringify({
        mcpServers: {
          "unified-ai-system": {
            command: proxyCommand,
            args: proxyArguments,
          },
        },
      }, null, 2)}\n`, "utf8");
      await runHostCommand(host, ["mcp", "enable", "unified-ai-system"], {
        cwd: workspace,
        env: environment,
        label: "Cursor Agent CLI MCP approval",
      });
      listArguments = ["mcp", "list-tools", "unified-ai-system"];
    } else {
      throw new Error(`Unsupported MCP CLI host workflow: ${clientId}`);
    }

    if (!listResult) {
      listResult = await runHostCommand(host, listArguments, {
        cwd: workspace,
        env: environment,
        label: `${host.name} MCP list`,
        timeout: 180_000,
      });
    }
    const output = stripAnsi(`${listResult.stdout ?? ""}\n${listResult.stderr ?? ""}`);
    if (clientId === "mcp-gemini-cli") {
      const settingsPath = join(environment.GEMINI_CLI_HOME, ".gemini", "settings.json");
      if (!existsSync(settingsPath)) {
        throw new Error(`Gemini CLI did not write its isolated settings file: ${settingsPath}`);
      }
      const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
      settings.security = {
        ...(settings.security ?? {}),
        auth: {
          ...(settings.security?.auth ?? {}),
          useExternal: true,
        },
      };
      await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
      await rm(evidencePath, { force: true });
      const discovery = await runHostUntilEvidence(host, ["--acp", "--skip-trust"], {
        cwd: workspace,
        env: environment,
        evidencePath,
        evidencePredicate: (value) => value.toolsListRequested === true
          && expectedGatewayTools.every((name) => value.toolNames?.includes(name)),
        initialMessages: [{
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: 1 },
        }],
        label: "Gemini CLI ACP startup",
      });
      hostProcessCleanedUp = discovery.hostProcessCleanedUp;
    } else if (clientId === "cline-mcp") {
      await rm(evidencePath, { force: true });
      const discovery = await runHostUntilEvidence(host, [
        "--data-dir", environment.CLINE_DATA_DIR,
        "--json",
        "--auto-approve", "true",
        "--timeout", "120",
        "--cwd", workspace,
        "Call gateway_health through unified-ai-system, then stop.",
      ], {
        cwd: workspace,
        env: environment,
        evidencePath,
        evidencePredicate: (value) => value.toolsListRequested === true
          && expectedGatewayTools.every((name) => value.toolNames?.includes(name)),
        label: "Cline CLI one-shot startup",
        timeout: 30_000,
      });
      hostProcessCleanedUp = discovery.hostProcessCleanedUp;
    } else if (clientId === "mcp-continue") {
      await rm(evidencePath, { force: true });
      const discovery = await runHostUntilEvidence(host, [
        "--config", continueConfigPath,
        "--auto",
        "--format", "json",
        "-p",
        "Call gateway_health through unified-ai-system, then stop.",
      ], {
        cwd: workspace,
        env: environment,
        evidencePath,
        evidencePredicate: (value) => value.toolsListRequested === true
          && expectedGatewayTools.every((name) => value.toolNames?.includes(name))
          && value.toolCallNames?.length === 1
          && value.toolCallNames[0] === "gateway_health",
        label: "Continue CLI one-shot startup",
        timeout: 120_000,
      });
      hostProcessCleanedUp = discovery.hostProcessCleanedUp;
    }
    const evidenceWritten = await waitForFile(evidencePath, 10_000);
    if (!evidenceWritten) {
      throw new Error(
        `${host.name} did not produce an MCP protocol transcript; host output: ${output.slice(-4_000)}`,
      );
    }
    transcript = JSON.parse(readFileSync(evidencePath, "utf8"));
    const serverProcessCleanedUp = await waitForProcessClosed(transcript.serverPid, 10_000);
    const methods = new Set(transcript.hostMethods ?? []);
    const toolNames = new Set(transcript.toolNames ?? []);
    const toolCallNames = transcript.toolCallNames ?? [];
    const versionOutput = stripAnsi(`${versionResult.stdout ?? ""}\n${versionResult.stderr ?? ""}`);
    const reportedVersion = versionOutput.trim().split(/\r?\n/).find(Boolean) ?? null;
    const clineSettingsPath = environment.CLINE_DATA_DIR
      ? join(environment.CLINE_DATA_DIR, "settings", "cline_mcp_settings.json")
      : null;
    const isolatedConfiguration = clientId === "cline-mcp"
      ? Boolean(clineSettingsPath && existsSync(clineSettingsPath) && /"status":"installed"/.test(output))
      : clientId === "mcp-continue"
        ? Boolean(continueConfigPath && existsSync(continueConfigPath))
        : clientId === "cursor-mcp"
          ? Boolean(cursorConfigPath && existsSync(cursorConfigPath))
        : output.includes("unified-ai-system") && !output.includes("No MCP servers configured");
    const connected = ["cline-mcp", "mcp-continue", "cursor-mcp"].includes(clientId)
      ? methods.has("initialize") && methods.has("tools/list") && Boolean(transcript.serverInfo?.name)
      : /connected/i.test(output) && !/failed/i.test(output);

    return {
      client: clientId,
      sdk: host.name,
      sdkVersion: host.version ?? reportedVersion,
      checks: {
        cliVersion: host.version ? versionOutput.includes(host.version) : Boolean(reportedVersion),
        isolatedConfiguration,
        connected,
        initialize: methods.has("initialize") && Boolean(transcript.clientInfo?.name),
        initialized: methods.has("notifications/initialized") && transcript.initialized === true,
        toolsList: methods.has("tools/list") && transcript.toolsListRequested === true,
        tools: toolNames.size === expectedGatewayTools.length
          && expectedGatewayTools.every((name) => toolNames.has(name)),
        protocol: typeof transcript.negotiatedProtocolVersion === "string",
        mcpCallScope: clientId === "cline-mcp" || clientId === "mcp-continue"
          ? methods.has("tools/call")
            && toolCallNames.length === 1
            && toolCallNames[0] === "gateway_health"
          : !methods.has("tools/call") && toolCallNames.length === 0,
        transcript: transcript.parseErrors === 0,
        hostProcessCleanedUp,
        serverProcessCleanedUp,
      },
      hostClientInfo: transcript.clientInfo,
      mcpServerInfo: transcript.serverInfo,
      mcpProtocolVersion: transcript.negotiatedProtocolVersion,
      mcpHostMethods: transcript.hostMethods,
      mcpToolNames: transcript.toolNames,
      mcpToolCallNames: toolCallNames,
      realProviderCallsMade: false,
    };
  } finally {
    if (transcript?.serverPid) await waitForProcessClosed(transcript.serverPid, 5_000).catch(() => {});
    await rm(runtimeRoot, {
      recursive: true,
      force: true,
      maxRetries: 20,
      retryDelay: 250,
    });
  }
}

function resolveVsCodeExecutable() {
  const configured = process.env.VSCODE_EXECUTABLE;
  const candidates = [
    configured,
    process.platform === "win32" ? "E:/Apps/Microsoft VS Code/Code.exe" : null,
    process.platform === "win32" && process.env.LOCALAPPDATA
      ? join(process.env.LOCALAPPDATA, "Programs", "Microsoft VS Code", "Code.exe")
      : null,
    process.platform === "win32" && process.env.ProgramFiles
      ? join(process.env.ProgramFiles, "Microsoft VS Code", "Code.exe")
      : null,
    process.platform === "darwin" ? "/Applications/Visual Studio Code.app/Contents/MacOS/Electron" : null,
    process.platform === "linux" ? "/usr/share/code/code" : null,
  ].filter(Boolean);
  const executable = candidates.find((candidate) => existsSync(candidate));
  if (!executable) {
    throw new Error("VS Code executable not found; set VSCODE_EXECUTABLE to the desktop executable.");
  }
  return resolve(executable);
}

function responseText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => item?.text ?? item?.content ?? "")
      .filter(Boolean)
      .join(" ");
  }
  return String(value ?? "");
}

function unifiedMetadata(value) {
  return value?.response_metadata?.unified_ai
    ?? value?.additional_kwargs?.unified_ai
    ?? value?.unified_ai
    ?? null;
}

async function runAxios() {
  const axios = loadCommonJs("axios");
  const models = await axios.get(`${baseUrl}/v1/models`);
  const chat = await axios.post(`${baseUrl}/v1/chat/completions`, {
    model: "local-fake-model",
    messages: [{ role: "user", content: "Axios OpenAI-compatible runtime test" }],
  });
  const model = models.data?.data?.find((item) => item.id === "local-fake-model");
  return {
    client: "http-axios",
    sdk: "axios",
    checks: {
      models: models.status === 200 && Boolean(model),
      chat: chat.status === 200 && chat.data?.object === "chat.completion",
      fakeProvider: chat.data?.unified_ai?.execution_mode === "fake",
      content: chat.data?.choices?.[0]?.message?.content?.includes("Axios OpenAI-compatible runtime test") === true,
    },
  };
}

async function fetchProfile() {
  const modelsResponse = await fetch(`${baseUrl}/v1/models`);
  const models = await modelsResponse.json();
  const chatResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "local-fake-model",
      messages: [{ role: "user", content: "Node fetch OpenAI-compatible runtime test" }],
    }),
  });
  const chat = await chatResponse.json();
  return {
    client: "http-node-fetch",
    sdk: "node fetch",
    checks: {
      models: modelsResponse.status === 200
        && models.data?.some((item) => item.id === "local-fake-model"),
      chat: chatResponse.status === 200 && chat.object === "chat.completion",
      fakeProvider: chat.unified_ai?.execution_mode === "fake",
      content: chat.choices?.[0]?.message?.content?.includes("Node fetch OpenAI-compatible runtime test") === true,
    },
  };
}

async function runRest() {
  const response = await fetch(`${baseUrl}/v1/models`);
  const payload = await response.json();
  return {
    client: "http-node-graphql-or-rest",
    sdk: "node native REST",
    checks: {
      status: response.status === 200,
      modelList: payload.data?.some((item) => item.id === "local-fake-model") === true,
      fakeProvider: payload.data?.some(
        (item) => item.id === "local-fake-model" && item.unified_ai?.execution_mode === "fake",
      ) === true,
    },
  };
}

async function runCurl() {
  const curl = process.platform === "win32" ? "curl.exe" : "curl";
  const payload = JSON.stringify({
    model: "local-fake-model",
    messages: [{ role: "user", content: "curl OpenAI-compatible runtime test" }],
  });
  const response = await execFileAsync(curl, [
    "--fail-with-body",
    "--silent",
    "--show-error",
    "--request",
    "POST",
    `${baseUrl}/v1/chat/completions`,
    "--header",
    "content-type: application/json",
    "--data",
    payload,
  ], { windowsHide: true, maxBuffer: 2_000_000 });
  const body = JSON.parse(response.stdout);
  return {
    client: "http-curl",
    sdk: "curl",
    checks: {
      chat: body.object === "chat.completion",
      fakeProvider: body.unified_ai?.execution_mode === "fake",
      content: body.choices?.[0]?.message?.content?.includes("curl OpenAI-compatible runtime test") === true,
    },
  };
}

async function runPostman() {
  const newman = loadCommonJs("newman");
  const collection = {
    info: {
      name: "Unified AI System runtime certification",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: [{
      name: "OpenAI-compatible chat",
      event: [{
        listen: "test",
        script: {
          type: "text/javascript",
          exec: [
            "pm.test('status is 200', () => pm.response.to.have.status(200));",
            "const body = pm.response.json();",
            "pm.test('chat completion', () => pm.expect(body.object).to.eql('chat.completion'));",
            "pm.test('fake provider', () => pm.expect(body.unified_ai.execution_mode).to.eql('fake'));",
          ],
        },
      }],
      request: {
        method: "POST",
        header: [{ key: "content-type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify({
            model: "local-fake-model",
            messages: [{ role: "user", content: "Postman Newman runtime test" }],
          }),
        },
        url: "{{baseUrl}}/v1/chat/completions",
      },
    }],
  };
  const summary = await new Promise((resolvePromise, rejectPromise) => {
    newman.run({
      collection,
      envVar: [{ key: "baseUrl", value: baseUrl }],
      reporters: [],
    }, (error, value) => {
      if (error) rejectPromise(error);
      else resolvePromise(value);
    });
  });
  const execution = summary.run?.executions?.[0];
  const body = execution?.response?.json?.() ?? {};
  return {
    client: "http-postman",
    sdk: "newman",
    checks: {
      request: summary.run?.stats?.requests?.total === 1,
      assertions: summary.run?.stats?.assertions?.total === 3
        && summary.run?.stats?.assertions?.failed === 0,
      failures: summary.run?.failures?.length === 0,
      status: execution?.response?.code === 200,
      content: body.choices?.[0]?.message?.content?.includes("Postman Newman runtime test") === true,
    },
  };
}

async function runPromptfoo() {
  process.env.PROMPTFOO_CONFIG_DIR ??= join(
    process.env.UNIFIED_AI_SYSTEM_REPO_ROOT ?? process.cwd(),
    ".tmp",
    "client-runtime-promptfoo",
  );
  process.env.PROMPTFOO_DISABLE_TELEMETRY = "true";
  process.env.PROMPTFOO_DISABLE_UPDATE = "true";
  process.env.PROMPTFOO_DISABLE_SHARING = "true";
  process.env.PROMPTFOO_DISABLE_REMOTE_GENERATION = "true";
  process.env.PROMPTFOO_DISABLE_REDTEAM_REMOTE_GENERATION = "true";

  const { evaluate } = loadCommonJs("promptfoo");
  const prompt = "Promptfoo OpenAI-compatible runtime test";
  const fakeMarker = "[fake:local-fake-provider/local-fake-model]";
  const evaluation = await evaluate({
    prompts: [prompt],
    providers: [{
      id: "openai:chat:local-fake-model",
      config: {
        apiBaseUrl: `${baseUrl}/v1`,
        apiKey: "local-development",
      },
    }],
    tests: [{
      assert: [
        { type: "contains", value: prompt },
        { type: "contains", value: fakeMarker },
      ],
    }],
    writeLatestResults: false,
  }, {
    cache: false,
    maxConcurrency: 1,
    showProgressBar: false,
    silent: true,
    timeoutMs: 60_000,
  });
  const summary = await evaluation.toEvaluateSummary();
  const evaluationResult = summary.results?.[0];
  const output = responseText(evaluationResult?.response?.output);
  return {
    client: "openai-promptfoo",
    sdk: "promptfoo",
    sdkVersion: installedPackageVersion("promptfoo"),
    checks: {
      singleCase: summary.results?.length === 1,
      passed: evaluationResult?.success === true
        && summary.stats?.successes === 1
        && summary.stats?.failures === 0
        && summary.stats?.errors === 0,
      provider: evaluationResult?.provider?.id?.includes("local-fake-model") === true,
      content: output.includes(prompt),
      fakeProvider: output.includes(fakeMarker),
    },
  };
}

async function runOpenAiAgentsJs() {
  const {
    Agent,
    OpenAIProvider,
    run,
    setTracingDisabled,
  } = loadCommonJs("@openai/agents");
  setTracingDisabled(true);
  const provider = new OpenAIProvider({
    apiKey: "local-development",
    baseURL: `${baseUrl}/v1`,
    useResponses: false,
  });
  const prompt = "OpenAI Agents JavaScript SDK runtime test";
  try {
    const model = await provider.getModel("local-fake-model");
    const agent = new Agent({
      name: "gateway-runtime",
      instructions: "Return the local model response without calling tools.",
      model,
    });
    const response = await run(agent, prompt, { maxTurns: 1 });
    const content = String(response.finalOutput ?? "");
    return {
      client: "openai-agents-js",
      sdk: "@openai/agents",
      sdkVersion: installedPackageVersion("@openai/agents"),
      checks: {
        content: content.includes(prompt),
        rawResponse: response.rawResponses?.length === 1,
        agent: response.lastAgent?.name === "gateway-runtime",
        fakeProvider: content.includes("[fake:local-fake-provider/local-fake-model]"),
      },
    };
  } finally {
    await provider.close();
  }
}

async function runAzureOpenAiJs() {
  const { AzureOpenAI } = loadCommonJs("openai");
  const prompt = "Azure OpenAI JavaScript SDK runtime test";
  const client = new AzureOpenAI({
    apiKey: "local-development",
    endpoint: baseUrl,
    apiVersion: "2024-10-21",
    deployment: "local-fake-model",
    maxRetries: 0,
  });
  const completion = await client.chat.completions.create({
    model: "local-fake-model",
    messages: [{ role: "user", content: prompt }],
  });
  const content = responseText(completion.choices?.[0]?.message?.content);
  return {
    client: "openai-azure-sdk-js-compat",
    sdk: "openai AzureOpenAI",
    sdkVersion: installedPackageVersion("openai"),
    checks: {
      responseType: completion.object === "chat.completion",
      model: completion.model === "local-fake-model",
      content: content.includes(prompt),
      fakeProvider: content.includes("[fake:local-fake-provider/local-fake-model]"),
    },
  };
}

async function runLangChain() {
  const { ChatOpenAI } = loadCommonJs("@langchain/openai");
  const model = new ChatOpenAI({
    apiKey: "local-development",
    model: "local-fake-model",
    maxRetries: 0,
    configuration: { baseURL: `${baseUrl}/v1` },
  });
  const response = await model.invoke("LangChain OpenAI-compatible runtime test");
  const content = responseText(response.content);
  const metadata = unifiedMetadata(response);
  return {
    client: "openai-langchain",
    sdk: "@langchain/openai",
    checks: {
      content: content.includes("LangChain OpenAI-compatible runtime test"),
      responseType: response?.constructor?.name === "AIMessage",
      fakeProvider: metadata?.execution_mode === "fake"
        || content.includes("[fake:local-fake-provider/local-fake-model]"),
    },
  };
}

async function runVercelAi() {
  const { generateText } = loadCommonJs("ai");
  const { createOpenAI } = loadCommonJs("@ai-sdk/openai");
  const provider = createOpenAI({
    apiKey: "local-development",
    baseURL: `${baseUrl}/v1`,
  });
  const result = await generateText({
    model: provider("local-fake-model"),
    prompt: "Vercel AI SDK OpenAI-compatible runtime test",
  });
  return {
    client: "openai-vercel-ai-sdk",
    sdk: "ai + @ai-sdk/openai",
    checks: {
      text: typeof result.text === "string" && result.text.includes("Vercel AI SDK OpenAI-compatible runtime test"),
      response: typeof result.response?.id === "string"
        && result.response?.modelId === "local-fake-model",
      finishReason: result.finishReason === "stop",
    },
  };
}

async function runLlamaIndex() {
  const { OpenAI } = loadCommonJs("@llamaindex/openai");
  const model = new OpenAI({
    apiKey: "local-development",
    baseURL: `${baseUrl}/v1`,
    maxRetries: 0,
    model: "local-fake-model",
  });
  const response = await model.chat({
    messages: [{ role: "user", content: "LlamaIndex JS OpenAI-compatible runtime test" }],
  });
  const content = responseText(response.message?.content);
  return {
    client: "openai-llamaindex-js",
    sdk: "@llamaindex/openai",
    checks: {
      content: content.includes("LlamaIndex JS OpenAI-compatible runtime test"),
      role: response.message?.role === "assistant",
      fakeProvider: content.includes("[fake:local-fake-provider/local-fake-model]"),
    },
  };
}

async function runMcpSdk() {
  const { Client } = await loadModule("@modelcontextprotocol/sdk", "/client/index.js");
  const { StdioClientTransport } = await loadModule("@modelcontextprotocol/sdk", "/client/stdio.js");
  const repoRoot = process.env.UNIFIED_AI_SYSTEM_REPO_ROOT ?? process.cwd();
  const server = join(repoRoot, "packages", "mcp-server", "src", "index.js");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [server],
    env: {
      ...process.env,
      AI_GATEWAY_MCP_URL: "",
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      PME_ENTERPRISE_AUTH_ENABLED: "false",
    },
  });
  const client = new Client({ name: "unified-ai-system-runtime", version: "1.0.0" });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    const health = await client.callTool({ name: "gateway_health", arguments: {} });
    return {
      client: "mcp-node-sdk",
      sdk: "@modelcontextprotocol/sdk",
      checks: {
        tools: listed.tools?.length === 9,
        health: health.isError !== true,
        gatewayHealth: JSON.stringify(health).includes("local-fake-provider"),
      },
    };
  } finally {
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
  }
}

async function runMcpInspector() {
  const packageName = "@modelcontextprotocol/inspector";
  const manifestPath = moduleRequire.resolve(`${packageName}/package.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const inspectorRoot = dirname(manifestPath);
  const launcher = join(inspectorRoot, "clients", "launcher", "build", "index.js");
  const repoRoot = process.env.UNIFIED_AI_SYSTEM_REPO_ROOT ?? process.cwd();
  const server = join(repoRoot, "packages", "mcp-server", "src", "index.js");
  const environment = createCredentialFreeEnvironment(process.env, {
    AI_GATEWAY_AUTO_START: "true",
    AI_GATEWAY_MCP_URL: "",
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_DEFAULT_PROVIDER: "local-fake-provider",
    AI_GATEWAY_DEFAULT_MODEL: "local-fake-model",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    MCP_AUTO_OPEN_ENABLED: "false",
    PME_ENTERPRISE_AUTH_ENABLED: "false",
  });
  const runInspector = async (methodArguments) => {
    const response = await execFileAsync(process.execPath, [
      launcher,
      "--cli",
      process.execPath,
      server,
      ...methodArguments,
      "--format",
      "json",
      "--cwd",
      repoRoot,
    ], {
      cwd: repoRoot,
      env: environment,
      windowsHide: true,
      maxBuffer: 4_000_000,
      timeout: 90_000,
    });
    return JSON.parse(response.stdout.trim());
  };

  const listed = await runInspector(["--method", "tools/list"]);
  const tools = listed?.result?.tools ?? [];
  const called = await runInspector([
    "--method",
    "tools/call",
    "--tool-name",
    "gateway_prompt_enhance",
    "--tool-args-json",
    JSON.stringify({
      input: "Build a Node API with tests",
      profile: "coding",
      language: "en",
    }),
  ]);
  const enhancement = inspectorToolPayload(called);
  const managedGatewayCleanedUp = await waitForClosed(enhancement?.gateway?.baseUrl);
  const toolNames = tools.map((tool) => tool?.name).filter(Boolean);

  return {
    client: "mcp-inspector",
    sdk: packageName,
    sdkVersion: String(manifest.version ?? "unknown"),
    checks: {
      inspectorCli: Boolean(listed?.result && called?.result),
      tools: tools.length === 9
        && toolNames.includes("gateway_health")
        && toolNames.includes("gateway_prompt_enhance")
        && toolNames.includes("gateway_chat"),
      toolCall: enhancement?.ok === true
        && enhancement?.tool === "gateway_prompt_enhance",
      promptEnhancement: enhancement?.result?.data?.profile === "coding"
        && enhancement?.result?.data?.enhancedPrompt?.includes("Build a Node API with tests") === true,
      providerFree: enhancement?.gateway?.realProviderCallsAllowed === false
        && enhancement?.result?.data?.metadata?.providerCalled === false,
      managedGateway: enhancement?.gateway?.managed === true,
      managedGatewayCleanedUp,
    },
  };
}

async function runCodexMcp() {
  const packageName = "@openai/codex";
  const manifestPath = moduleRequire.resolve(`${packageName}/package.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const codexEntrypoint = join(dirname(manifestPath), "bin", "codex.js");
  const repoRoot = process.env.UNIFIED_AI_SYSTEM_REPO_ROOT ?? process.cwd();
  const server = join(repoRoot, "packages", "mcp-server", "src", "index.js");
  const codexHome = await mkdtemp(join(tmpdir(), "unified-ai-codex-mcp-"));
  const environment = createCredentialFreeEnvironment(process.env, {
    CODEX_HOME: codexHome,
    DO_NOT_TRACK: "1",
    OTEL_SDK_DISABLED: "true",
  });
  let appServer = null;
  let managedGatewayBaseUrl = null;
  let managedGatewayCleanedUp = false;
  let stderr = "";

  try {
    await execFileAsync(process.execPath, [
      codexEntrypoint,
      "mcp",
      "add",
      "unified-ai-system",
      "--env",
      "AI_GATEWAY_AUTO_START=true",
      "--env",
      "AI_GATEWAY_PROVIDER_MODE=fake",
      "--env",
      "AI_GATEWAY_REAL_PROVIDER_ENABLED=false",
      "--env",
      "AI_GATEWAY_DEFAULT_PROVIDER=local-fake-provider",
      "--env",
      "AI_GATEWAY_DEFAULT_MODEL=local-fake-model",
      "--env",
      "AI_GATEWAY_ENABLED_PROVIDERS=local-fake-provider,backup-fake-provider",
      "--env",
      "PME_ENTERPRISE_AUTH_ENABLED=false",
      "--",
      process.execPath,
      server,
    ], {
      cwd: repoRoot,
      env: environment,
      windowsHide: true,
      maxBuffer: 2_000_000,
      timeout: 30_000,
    });
    const configuredRaw = await execFileAsync(process.execPath, [
      codexEntrypoint,
      "mcp",
      "get",
      "unified-ai-system",
      "--json",
    ], {
      cwd: repoRoot,
      env: environment,
      windowsHide: true,
      maxBuffer: 2_000_000,
      timeout: 30_000,
    });
    const configured = JSON.parse(configuredRaw.stdout.trim());

    appServer = spawn(process.execPath, [
      codexEntrypoint,
      "app-server",
      "--listen",
      "stdio://",
      "-c",
      'model="local-fake-model"',
      "-c",
      'model_provider="unified_gateway"',
      "-c",
      `model_providers.unified_gateway.name="Unified AI System"`,
      "-c",
      `model_providers.unified_gateway.base_url="${baseUrl}/v1"`,
      "-c",
      'model_providers.unified_gateway.wire_api="responses"',
      "-c",
      "model_providers.unified_gateway.requires_openai_auth=false",
      "-c",
      "model_providers.unified_gateway.request_max_retries=0",
      "-c",
      "model_providers.unified_gateway.stream_max_retries=0",
    ], {
      cwd: repoRoot,
      env: environment,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    appServer.stderr.setEncoding("utf8");
    appServer.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-4_000);
    });
    const rpc = createJsonLineRpc(appServer);
    const initialized = await rpc.request("initialize", {
      clientInfo: {
        name: "unified_ai_system_certifier",
        title: "Unified AI System Codex MCP Certifier",
        version: "1.0.0",
      },
      capabilities: { experimentalApi: true },
    });
    rpc.notify("initialized", {});
    const started = await rpc.request("thread/start", {
      model: "local-fake-model",
      modelProvider: "unified_gateway",
      cwd: repoRoot,
      approvalPolicy: "never",
      sandbox: "read-only",
      ephemeral: true,
    });
    const threadId = started?.thread?.id;
    const statusResult = await rpc.request("mcpServerStatus/list", {
      cursor: null,
      limit: 100,
      detail: "toolsAndAuthOnly",
      threadId,
    });
    const serverStatus = statusResult?.data?.find((item) => item?.name === "unified-ai-system");
    const toolNames = Object.entries(serverStatus?.tools ?? {}).map(([key, tool]) => tool?.name ?? key);
    const called = await rpc.request("mcpServer/tool/call", {
      threadId,
      server: "unified-ai-system",
      tool: "gateway_prompt_enhance",
      arguments: {
        input: "Build a Node API with tests",
        profile: "coding",
        language: "en",
      },
    });
    const enhancement = called?.structuredContent
      ?? inspectorToolPayload({ result: called });
    managedGatewayBaseUrl = enhancement?.gateway?.baseUrl ?? null;
    const exitCode = await stopChild(appServer);
    appServer = null;
    managedGatewayCleanedUp = await waitForClosed(managedGatewayBaseUrl);
    const startupReady = rpc.notifications.some(
      (item) => item.method === "mcpServer/startupStatus/updated"
        && item.params?.threadId === threadId
        && item.params?.name === "unified-ai-system"
        && item.params?.status === "ready"
        && item.params?.error === null,
    );

    return {
      client: "codex-mcp",
      sdk: packageName,
      sdkVersion: String(manifest.version ?? "unknown"),
      checks: {
        codexCli: configured?.name === "unified-ai-system"
          && configured?.enabled === true
          && configured?.transport?.type === "stdio",
        appServerInitialized: typeof initialized?.userAgent === "string"
          || typeof initialized?.user_agent === "string",
        threadStarted: typeof threadId === "string" && threadId.length > 0,
        startupReady,
        serverDiscovered: Boolean(serverStatus?.serverInfo),
        tools: toolNames.length === 9
          && toolNames.includes("gateway_health")
          && toolNames.includes("gateway_prompt_enhance")
          && toolNames.includes("gateway_chat"),
        toolCall: called?.isError !== true
          && enhancement?.ok === true
          && enhancement?.tool === "gateway_prompt_enhance",
        promptEnhancement: enhancement?.result?.data?.profile === "coding"
          && enhancement?.result?.data?.enhancedPrompt?.includes("Build a Node API with tests") === true,
        providerFree: enhancement?.gateway?.realProviderCallsAllowed === false
          && enhancement?.result?.data?.metadata?.providerCalled === false,
        managedGateway: enhancement?.gateway?.managed === true,
        appServerExit: exitCode === 0,
        managedGatewayCleanedUp,
      },
      appServerNotifications: rpc.notifications
        .filter((item) => item.method === "mcpServer/startupStatus/updated")
        .map((item) => ({ method: item.method, params: item.params })),
      realProviderCallsMade: false,
    };
  } catch (error) {
    if (stderr && error instanceof Error) {
      error.message = `${error.message}; app-server stderr: ${stderr}`;
    }
    throw error;
  } finally {
    if (appServer) await stopChild(appServer).catch(() => {});
    if (!managedGatewayCleanedUp && managedGatewayBaseUrl) {
      await waitForClosed(managedGatewayBaseUrl).catch(() => {});
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    await rm(codexHome, {
      recursive: true,
      force: true,
      maxRetries: 20,
      retryDelay: 200,
    });
  }
}

async function runVsCodeMcp() {
  const vscodeExecutable = resolveVsCodeExecutable();
  const repoRoot = process.env.UNIFIED_AI_SYSTEM_REPO_ROOT ?? process.cwd();
  const server = join(repoRoot, "packages", "mcp-server", "src", "index.js");
  const runtimeRoot = await mkdtemp(join(tmpdir(), "unified-ai-vscode-mcp-"));
  const workspace = join(runtimeRoot, "workspace");
  const vscodeDirectory = join(workspace, ".vscode");
  const userDataDirectory = join(runtimeRoot, "user-data");
  const userConfigurationDirectory = join(userDataDirectory, "User");
  const extensionsDirectory = join(runtimeRoot, "extensions");
  const extensionDirectory = join(runtimeRoot, "certifier-extension");
  const evidencePath = join(runtimeRoot, "vscode-mcp-evidence.json");
  let vscodeProcess = null;
  let stdout = "";
  let stderr = "";
  let gatewayBaseUrl = null;
  let gatewayCleanedUp = false;

  const extensionSource = `
const vscode = require("vscode");
const { writeFile } = require("node:fs/promises");

const expectedGatewayTools = ${JSON.stringify(expectedGatewayTools)};
const delay = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function findGatewayPayload(value, seen = new Set()) {
  if (typeof value === "string") {
    try {
      return findGatewayPayload(JSON.parse(value), seen);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);
  if (value.ok === true && value.tool === "gateway_prompt_enhance") return value;
  for (const nested of Array.isArray(value) ? value : Object.values(value)) {
    const match = findGatewayPayload(nested, seen);
    if (match) return match;
  }
  return null;
}

function resultText(result) {
  return (result?.content ?? []).map((part) => {
    if (typeof part?.value === "string") return part.value;
    if (part?.value !== undefined) {
      try { return JSON.stringify(part.value); } catch { return String(part.value); }
    }
    try { return JSON.stringify(part); } catch { return String(part); }
  }).join("\\n");
}

async function activate() {
  const evidence = {
    client: "mcp-vscode",
    vscodeVersion: vscode.version,
    extensionHost: true,
    commandIds: [],
    toolNames: [],
    promptToolName: null,
    toolResultText: "",
    payload: null,
    startErrors: [],
    error: null,
  };
  try {
    const commands = await vscode.commands.getCommands(true);
    evidence.commandIds = commands.filter((command) => /mcp/i.test(command)).sort();
    await vscode.commands.executeCommand("workbench.action.chat.open");
    await vscode.commands.executeCommand("workbench.mcp.showInstalledServers").catch(() => {});
    await delay(1_500);
    const startServers = () => vscode.commands.executeCommand("workbench.mcp.startServer", "*", {
      autoTrustChanges: true,
      waitForLiveTools: true,
    }).catch((error) => {
      evidence.startErrors.push(error instanceof Error ? error.message : String(error));
    });
    void startServers();

    const deadline = Date.now() + 90_000;
    let gatewayTools = [];
    let lastStartAttempt = Date.now();
    while (Date.now() < deadline) {
      gatewayTools = vscode.lm.tools.filter((tool) => (
        expectedGatewayTools.some((expected) => tool.name.includes(expected))
      ));
      if (gatewayTools.some((tool) => tool.name.includes("gateway_prompt_enhance"))) break;
      if (Date.now() - lastStartAttempt > 5_000) {
        lastStartAttempt = Date.now();
        void startServers();
      }
      await delay(250);
    }
    evidence.toolNames = gatewayTools.map((tool) => tool.name).sort();
    const promptTool = gatewayTools.find((tool) => tool.name.includes("gateway_prompt_enhance"));
    if (!promptTool) throw new Error("VS Code did not expose gateway_prompt_enhance through vscode.lm.tools.");
    evidence.promptToolName = promptTool.name;

    const result = await vscode.lm.invokeTool(promptTool.name, {
      input: {
        input: "Build a Node API with tests",
        profile: "coding",
        language: "en",
      },
    });
    evidence.toolResultText = resultText(result);
    evidence.payload = findGatewayPayload(evidence.toolResultText)
      ?? findGatewayPayload(result);
  } catch (error) {
    evidence.error = error instanceof Error ? error.message : String(error);
  } finally {
    await writeFile(process.env.VSCODE_MCP_EVIDENCE_PATH, JSON.stringify(evidence, null, 2), "utf8");
    setTimeout(() => {
      void vscode.commands.executeCommand("workbench.action.quit");
    }, 500);
  }
}

function deactivate() {}
module.exports = { activate, deactivate };
`;

  try {
    await Promise.all([
      mkdir(vscodeDirectory, { recursive: true }),
      mkdir(userConfigurationDirectory, { recursive: true }),
      mkdir(extensionsDirectory, { recursive: true }),
      mkdir(extensionDirectory, { recursive: true }),
    ]);
    await Promise.all([
      writeFile(join(vscodeDirectory, "settings.json"), JSON.stringify({
        "chat.mcp.access": "all",
        "chat.mcp.autostart": "newAndOutdated",
        "security.workspace.trust.enabled": false,
        "telemetry.telemetryLevel": "off",
        "update.mode": "none",
        "workbench.startupEditor": "none",
      }, null, 2), "utf8"),
      writeFile(join(userConfigurationDirectory, "settings.json"), JSON.stringify({
        "chat.mcp.access": "all",
        "chat.mcp.autostart": "newAndOutdated",
        "security.workspace.trust.enabled": false,
        "telemetry.telemetryLevel": "off",
        "update.mode": "none",
        "workbench.startupEditor": "none",
      }, null, 2), "utf8"),
      writeFile(join(userConfigurationDirectory, "mcp.json"), JSON.stringify({
        servers: {
          "unified-ai-system": {
            type: "stdio",
            command: process.execPath,
            args: [server],
            env: {
              AI_GATEWAY_AUTO_START: "true",
              AI_GATEWAY_MCP_URL: "",
              AI_GATEWAY_PROVIDER_MODE: "fake",
              AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
              AI_GATEWAY_DEFAULT_PROVIDER: "local-fake-provider",
              AI_GATEWAY_DEFAULT_MODEL: "local-fake-model",
              AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
              MCP_AUTO_OPEN_ENABLED: "false",
              PME_ENTERPRISE_AUTH_ENABLED: "false",
            },
          },
        },
      }, null, 2), "utf8"),
      writeFile(join(extensionDirectory, "package.json"), JSON.stringify({
        name: "unified-ai-system-vscode-mcp-certifier",
        displayName: "Unified AI System VS Code MCP Certifier",
        publisher: "unified-ai-system",
        version: "1.0.0",
        engines: { vscode: "^1.118.0" },
        main: "./extension.js",
        activationEvents: ["onStartupFinished"],
      }, null, 2), "utf8"),
      writeFile(join(extensionDirectory, "extension.js"), extensionSource, "utf8"),
    ]);

    const environment = createCredentialFreeEnvironment(process.env, {
      VSCODE_MCP_EVIDENCE_PATH: evidencePath,
      VSCODE_DISABLE_CRASH_REPORTER: "1",
    });
    vscodeProcess = spawn(vscodeExecutable, [
      "--user-data-dir", userDataDirectory,
      "--extensions-dir", extensionsDirectory,
      `--extensionDevelopmentPath=${extensionDirectory}`,
      "--new-window",
      "--wait",
      "--disable-gpu",
      "--disable-updates",
      "--skip-release-notes",
      "--skip-welcome",
      "--log", "trace",
      workspace,
    ], {
      cwd: repoRoot,
      env: environment,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    vscodeProcess.stdout.setEncoding("utf8");
    vscodeProcess.stderr.setEncoding("utf8");
    vscodeProcess.stdout.on("data", (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-8_000);
    });
    vscodeProcess.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-8_000);
    });

    const evidenceWritten = await waitForFile(evidencePath, 120_000);
    if (!evidenceWritten) {
      throw new Error(`VS Code MCP evidence timed out; stdout: ${stdout}; stderr: ${stderr}`);
    }
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    const exitCode = await stopChild(vscodeProcess, 20_000);
    vscodeProcess = null;
    const payload = evidence.payload;
    gatewayBaseUrl = payload?.gateway?.baseUrl ?? null;
    gatewayCleanedUp = await waitForClosed(gatewayBaseUrl, 10_000);
    const observedTools = new Set(
      evidence.toolNames
        .flatMap((name) => expectedGatewayTools.filter((expected) => name.includes(expected))),
    );

    return {
      client: "mcp-vscode",
      sdk: "Visual Studio Code",
      sdkVersion: String(evidence.vscodeVersion ?? "unknown"),
      checks: {
        extensionHost: evidence.extensionHost === true,
        mcpCommands: evidence.commandIds?.includes("workbench.mcp.listServer") === true,
        tools: observedTools.size === expectedGatewayTools.length,
        toolCall: payload?.ok === true && payload?.tool === "gateway_prompt_enhance",
        promptEnhancement: payload?.result?.data?.profile === "coding"
          && payload?.result?.data?.enhancedPrompt?.includes("Build a Node API with tests") === true,
        providerFree: payload?.gateway?.realProviderCallsAllowed === false
          && payload?.result?.data?.metadata?.providerCalled === false,
        managedGateway: payload?.gateway?.managed === true,
        vscodeExit: exitCode === 0,
        managedGatewayCleanedUp: gatewayCleanedUp,
      },
      vscodeToolNames: evidence.toolNames,
      vscodeMcpCommands: evidence.commandIds,
      vscodeStartErrors: evidence.startErrors,
      realProviderCallsMade: false,
      error: evidence.error,
    };
  } finally {
    if (vscodeProcess) await stopChild(vscodeProcess).catch(() => {});
    if (!gatewayCleanedUp && gatewayBaseUrl) {
      await waitForClosed(gatewayBaseUrl, 10_000).catch(() => {});
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000));
    await rm(runtimeRoot, {
      recursive: true,
      force: true,
      maxRetries: 20,
      retryDelay: 250,
    });
  }
}

const runners = {
  axios: runAxios,
  "http-axios": runAxios,
  fetch: fetchProfile,
  "http-node-fetch": fetchProfile,
  rest: runRest,
  "http-node-graphql-or-rest": runRest,
  curl: runCurl,
  "http-curl": runCurl,
  "http-postman": runPostman,
  "openai-promptfoo": runPromptfoo,
  "openai-agents-js": runOpenAiAgentsJs,
  "openai-azure-sdk-js-compat": runAzureOpenAiJs,
  langchain: runLangChain,
  "openai-langchain": runLangChain,
  "vercel-ai": runVercelAi,
  "openai-vercel-ai-sdk": runVercelAi,
  "openai-llamaindex-js": runLlamaIndex,
  "mcp-node-sdk": runMcpSdk,
  "mcp-inspector": runMcpInspector,
  "codex-mcp": runCodexMcp,
  "mcp-claude-code": () => runMcpCliHost("mcp-claude-code"),
  "mcp-gemini-cli": () => runMcpCliHost("mcp-gemini-cli"),
  "mcp-opencode-cli": () => runMcpCliHost("mcp-opencode-cli"),
  "cline-mcp": () => runMcpCliHost("cline-mcp"),
  "mcp-continue": () => runMcpCliHost("mcp-continue"),
  "cursor-mcp": () => runMcpCliHost("cursor-mcp"),
  "mcp-vscode": runVsCodeMcp,
};

if (!runners[requested]) {
  throw new Error(`Unknown client runtime profile: ${requested}`);
}

try {
  const result = await runners[requested]();
  result.baseUrl = baseUrl;
  result.ok = Object.values(result.checks).every(Boolean);
  result.realProviderCallsMade = false;
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 1;
} catch (error) {
  process.stdout.write(`${JSON.stringify({
    ok: false,
    client: requested,
    baseUrl,
    error: error?.message ?? String(error),
    realProviderCallsMade: false,
  }, null, 2)}\n`);
  process.exitCode = 1;
}
