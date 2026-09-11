#!/usr/bin/env node

import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MCP_SMOKE_SOURCE = "mcp-smoke";
const MODERN_MCP_PROTOCOL_VERSION = "2026-07-28";
const serverEntrypoint = resolve(
  repoRoot,
  "packages/mcp-server/src/index.js",
);
function normalizeIssueCode(raw) {
  const slug = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug.length === 0 ? "unknown_issue" : slug;
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
    const severity = issue?.severity === "high"
      ? "high"
      : issue?.severity === "medium"
        ? "medium"
        : issue?.severity === "low"
          ? "low"
          : issue?.severity === "info"
            ? "info"
            : "unknown";
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
    severity,
    message,
    artifactPath,
    source: MCP_SMOKE_SOURCE,
  };
}
const expectedTools = [
  "gateway_health",
  "gateway_readiness",
  "agent_governance_status",
  "agent_governance_list",
  "agent_governance_describe",
  "gateway_prompt_enhance",
  "gateway_prompt_enhance_llm",
  "gateway_chat",
  "knowledge_readiness",
  "knowledge_retrieve",
  "workflow_health",
  "workflow_actions",
  "workflow_run",
  "workforce_health",
  "workforce_agents",
].sort();
const jsonOutput = process.argv.includes("--json");
const dockerImageArgument = process.argv.find((argument) =>
  argument.startsWith("--docker-image="));
const dockerImage = dockerImageArgument
  ? dockerImageArgument.slice("--docker-image=".length).trim()
  : null;

if (dockerImageArgument && !dockerImage) {
  throw new Error("--docker-image requires a non-empty image reference.");
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}

async function waitForClosed(baseUrl) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    try {
      await fetch(`${baseUrl}/health/check`, {
        signal: AbortSignal.timeout(500),
      });
    } catch {
      return true;
    }
    await delay(200);
  }
  return false;
}

function createRpcSession(child) {
  let nextId = 1;
  let buffer = "";
  const pending = new Map();

  function rejectPending(error) {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    pending.clear();
  }

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    while (buffer.includes("\n")) {
      const newlineIndex = buffer.indexOf("\n");
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;

      let message;
      try {
        message = JSON.parse(line);
      } catch (error) {
        rejectPending(
          new Error(`MCP stdout contained non-JSON data: ${error.message}`),
        );
        continue;
      }

      if (message.id !== undefined && pending.has(message.id)) {
        const request = pending.get(message.id);
        pending.delete(message.id);
        clearTimeout(request.timer);
        if (message.error) {
          request.reject(
            new Error(
              `MCP ${request.method} failed: ${JSON.stringify(message.error)}`,
            ),
          );
        } else {
          request.resolve(message.result);
        }
      }
    }
  });
  child.once("error", (error) => {
    rejectPending(new Error(`MCP process failed to start: ${error.message}`));
  });

  function send(message) {
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  function request(method, params = {}) {
    const id = nextId;
    nextId += 1;
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`MCP ${method} timed out.`));
      }, 30_000);
      pending.set(id, {
        method,
        resolve: resolvePromise,
        reject,
        timer,
      });
      send({ jsonrpc: "2.0", id, method, params });
    });
  }

  return {
    request,
    notify(method, params = {}) {
      send({ jsonrpc: "2.0", method, params });
    },
  };
}

function runDockerCommand(args) {
  return new Promise((resolvePromise) => {
    execFile(
      "docker",
      args,
      { windowsHide: true },
      (error, stdout, stderr) => {
        resolvePromise({
          ok: !error,
          stdout: stdout?.trim() ?? "",
          stderr: stderr?.trim() ?? "",
        });
      },
    );
  });
}

async function ensureContainerRemoved(containerName) {
  if (!containerName) return true;
  const inspected = await runDockerCommand(["inspect", containerName]);
  if (!inspected.ok) return true;
  await runDockerCommand(["rm", "--force", containerName]);
  const finalInspection = await runDockerCommand(["inspect", containerName]);
  return !finalInspection.ok;
}

function createMcpProcess() {
  if (!dockerImage) {
    return {
      child: spawn(process.execPath, [serverEntrypoint], {
        cwd: repoRoot,
        windowsHide: true,
        env: {
          ...process.env,
          AI_GATEWAY_MCP_URL: "",
          AI_GATEWAY_PROVIDER_MODE: "fake",
          AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
          PME_ENTERPRISE_AUTH_ENABLED: "false",
          PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
        },
        stdio: ["pipe", "pipe", "pipe"],
      }),
      containerName: null,
    };
  }

  const containerName =
    `unified-ai-system-mcp-smoke-${process.pid}-${Date.now()}`;
  return {
    child: spawn(
      "docker",
      [
        "run",
        "--rm",
        "--name",
        containerName,
        "-i",
        "--pull",
        "never",
        "--network",
        "none",
        "--read-only",
        "--tmpfs",
        "/tmp:rw,noexec,nosuid,size=64m",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--env",
        "AI_GATEWAY_MCP_URL=",
        "--env",
        "AI_GATEWAY_PROVIDER_MODE=fake",
        "--env",
        "AI_GATEWAY_REAL_PROVIDER_ENABLED=false",
        "--env",
        "PME_ENTERPRISE_AUTH_ENABLED=false",
        "--env",
        "PME_RUNTIME_CREDENTIAL_STORE_MODE=memory",
        dockerImage,
      ],
      {
        cwd: repoRoot,
        windowsHide: true,
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
      },
    ),
    containerName,
  };
}

function parseToolPayload(result) {
  const text = result?.content?.find((item) => item.type === "text")?.text;
  if (typeof text !== "string") {
    throw new Error("MCP tool result did not contain text content.");
  }
  return JSON.parse(text);
}

async function stopChild(child) {
  if (child.exitCode !== null) return child.exitCode;
  child.stdin.end();
  const result = await Promise.race([
    once(child, "exit").then(([code]) => ({ exited: true, code })),
    delay(10_000).then(() => ({ exited: false, code: null })),
  ]);
  if (!result.exited && child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), delay(3_000)]);
  }
  if (child.exitCode === null) child.kill("SIGKILL");
  return child.exitCode;
}

async function runSmoke() {
  const issueCodes = [];
  let stderr = "";
  const { child, containerName } = createMcpProcess();
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-8_000);
  });
  const rpc = createRpcSession(child);
  let baseUrl;

  try {
    const requestMeta = {
      "io.modelcontextprotocol/protocolVersion": MODERN_MCP_PROTOCOL_VERSION,
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        name: "unified-ai-system-mcp-smoke",
        version: "0.5.0",
      },
    };
    const discovery = await rpc.request("server/discover", { _meta: requestMeta });
    if (!discovery.supportedVersions?.includes(MODERN_MCP_PROTOCOL_VERSION)) {
      throw new Error(
        `MCP server did not advertise ${MODERN_MCP_PROTOCOL_VERSION}.`,
      );
    }

    const listed = await rpc.request("tools/list", { _meta: requestMeta });
    const toolNames = listed.tools.map((tool) => tool.name).sort();
    if (JSON.stringify(toolNames) !== JSON.stringify(expectedTools)) {
      issueCodes.push(
        createIssueCode(
          "mcp_tool_set_mismatch",
          `Unexpected MCP tools: ${JSON.stringify(toolNames)}.`,
          "high",
          "tools/mcp-smoke.mjs",
        ),
      );
      throw new Error(
        `Unexpected MCP tools: ${JSON.stringify(toolNames)}.`,
      );
    }

    const health = parseToolPayload(
      await rpc.request("tools/call", {
        name: "gateway_health",
        arguments: {},
        _meta: requestMeta,
      }),
    );
    baseUrl = health.gateway?.baseUrl;
    if (
      health.ok !== true
      || health.gateway?.managed !== true
      || health.gateway?.realProviderCallsAllowed !== false
      || health.result?.data?.status !== "ready"
      || health.result?.data?.realProviderEnabled !== false
    ) {
      issueCodes.push(
        createIssueCode(
          "mcp_gateway_health_invalid",
          "MCP gateway health did not prove a safe managed runtime.",
          "high",
          "gateway_health",
        ),
      );
      throw new Error("MCP gateway health did not prove a safe managed runtime.");
    }

    const enhancement = parseToolPayload(
      await rpc.request("tools/call", {
        name: "gateway_prompt_enhance",
        arguments: {
          input: "Build a Node API with tests",
          profile: "coding",
        },
        _meta: requestMeta,
      }),
    );
    if (
      enhancement.ok !== true
      || enhancement.result?.data?.profile !== "coding"
      || enhancement.result?.data?.metadata?.providerCalled !== false
      || !enhancement.result?.data?.enhancedPrompt?.includes("Build a Node API with tests")
    ) {
      issueCodes.push(
        createIssueCode(
          "mcp_prompt_enhance_invalid",
          "MCP prompt enhancement did not prove local deterministic transformation.",
          "high",
          "gateway_prompt_enhance",
        ),
      );
      throw new Error("MCP prompt enhancement did not prove local deterministic transformation.");
    }

    const chat = parseToolPayload(
      await rpc.request("tools/call", {
        name: "gateway_chat",
        arguments: { prompt: "Container MCP smoke test" },
        _meta: requestMeta,
      }),
    );
    if (
      chat.ok !== true
      || chat.result?.data?.executionMode !== "fake"
      || chat.result?.data?.selectedProvider !== "local-fake-provider"
    ) {
      issueCodes.push(
        createIssueCode(
          "mcp_chat_invalid",
          "MCP chat did not prove fake-provider execution.",
          "high",
          "gateway_chat",
        ),
      );
      throw new Error("MCP chat did not prove fake-provider execution.");
    }

    const exitCode = await stopChild(child);
    const managedGatewayCleanedUp = containerName
      ? exitCode === 0 && await ensureContainerRemoved(containerName)
      : typeof baseUrl === "string" && await waitForClosed(baseUrl);
    const result = {
      ok: exitCode === 0 && managedGatewayCleanedUp,
      runtime: containerName ? "container" : "source",
      protocolVersion: MODERN_MCP_PROTOCOL_VERSION,
      protocolEra: "modern",
      supportedProtocolVersions: discovery.supportedVersions,
      toolCount: toolNames.length,
      tools: toolNames,
      provider: chat.result.data.selectedProvider,
      executionMode: chat.result.data.executionMode,
      promptEnhancementProviderCalled: enhancement.result.data.metadata.providerCalled,
      realProviderCallsMade: false,
      managedGatewayCleanedUp,
      issueCodes,
      issueCodeSummary: summarizeIssueCodes(issueCodes),
    };
    if (!result.ok) {
      issueCodes.push(
        createIssueCode(
          "mcp_runtime_cleanup_failed",
          "MCP smoke did not finish with guaranteed cleanup/readiness-close conditions.",
          "medium",
          containerName ? containerName : "gateway_health",
        ),
      );
    }
    if (!result.ok) process.exitCode = 1;
    result.issueCodeSummary = summarizeIssueCodes(issueCodes);
    return result;
  } catch (error) {
    await stopChild(child);
    await ensureContainerRemoved(containerName);
    if (issueCodes.length === 0) {
      issueCodes.push(
        createIssueCode(
          "mcp_smoke_unknown_failure",
          error instanceof Error ? error.message : String(error),
          "high",
          "mcp-smoke",
        ),
      );
    }
    process.exitCode = 1;
    return {
      ok: false,
      runtime: containerName ? "container" : "source",
      issueCodes,
      issueCodeSummary: summarizeIssueCodes(issueCodes),
      error: error instanceof Error ? error.message : String(error),
      realProviderCallsMade: false,
      stderrTail: stderr.trim().slice(-4_000),
    };
  }
}

const result = await runSmoke();
const serialized = JSON.stringify(result, null, 2);
if (jsonOutput || result.ok) {
  process.stdout.write(`${serialized}\n`);
} else {
  process.stderr.write(`${serialized}\n`);
}
