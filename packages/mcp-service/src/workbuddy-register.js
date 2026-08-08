// WorkBuddy MCP connector registration. Reads and writes
// ~/.workbuddy/mcp.json so WorkBuddy discovers the MCP service at startup.
//
// Why merge instead of overwrite? Because users frequently register several
// MCP servers (filesystem, browser, web search, etc.). Losing those on
// every install would be hostile. We only inject / update the
// `unified-ai-system` entry and leave the rest untouched.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import os from "node:os";

export const SERVICE_ID = "unified-ai-system";
export const SERVICE_TITLE = "Unified AI System";
export const SERVICE_VERSION = "0.4.0";
export const TOOL_NAMES = [
  "gateway_health",
  "gateway_readiness",
  "gateway_prompt_enhance",
  "gateway_chat",
  "knowledge_readiness",
  "workflow_health",
  "workflow_actions",
  "workforce_health",
  "workforce_agents",
];

export function defaultMcpJsonPath(env = process.env) {
  const override = env.WORKBUDDY_MCP_CONFIG;
  if (override) return override;
  return join(os.homedir(), ".workbuddy", "mcp.json");
}

export function buildMcpConfig({
  serverId = SERVICE_ID,
  command,
  args,
  cwd,
  env = {},
  capabilities = TOOL_NAMES,
  transport = "stdio",
  host = null,
  port = null,
  title = SERVICE_TITLE,
  version = SERVICE_VERSION,
} = {}) {
  if (!command) throw new Error("buildMcpConfig requires a `command` field.");
  const entry = {
    command,
    args: args ?? [],
    cwd: cwd ?? process.cwd(),
    env,
    metadata: {
      id: serverId,
      title,
      version,
      transport,
      tools: capabilities,
      runtime: "node",
      fakeProviderOnly: true,
      ...(host ? { host } : {}),
      ...(port ? { port } : {}),
    },
  };
  return entry;
}

export function deriveStdioCommand(repoRoot) {
  const resolvedRoot = resolve(repoRoot);
  const startScript = resolve(
    resolvedRoot,
    "packages/mcp-service/bin/start-service.js",
  );
  const nodeBinary = process.execPath;
  return {
    command: nodeBinary,
    args: [startScript, "--stdio", "--repo-root", resolvedRoot],
    cwd: resolvedRoot,
  };
}

export async function readMcpJson(path = defaultMcpJsonPath()) {
  if (!existsSync(path)) {
    return {};
  }
  const text = await readFile(path, "utf8");
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed;
    return {};
  } catch (error) {
    throw new Error(
      `WorkBuddy mcp.json at ${path} is not valid JSON: ${error.message}`,
    );
  }
}

async function atomicWriteJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const tmpPath = `${path}.tmp-${Date.now()}`;
  await writeFile(tmpPath, JSON.stringify(value, null, 2) + "\n", "utf8");
  await rename(tmpPath, path);
}

export async function registerService(options = {}) {
  const {
    serverId = SERVICE_ID,
    mcpJsonPath = defaultMcpJsonPath(),
    dryRun = false,
  } = options;
  const cfg = options.config ?? deriveStdioCommand(options.repoRoot);
  const enriched = buildMcpConfig({
    ...cfg,
    serverId,
    capabilities: options.capabilities ?? TOOL_NAMES,
    title: options.title ?? SERVICE_TITLE,
    version: options.version ?? SERVICE_VERSION,
  });

  const current = await readMcpJson(mcpJsonPath);
  const next = {
    ...current,
    mcpServers: {
      ...(current.mcpServers ?? {}),
      [serverId]: enriched,
    },
    metadata: {
      ...(current.metadata ?? {}),
      lastRegisteredAt: new Date().toISOString(),
      lastRegisteredServer: serverId,
    },
  };

  if (dryRun) {
    return { path: mcpJsonPath, config: next, applied: false };
  }
  await atomicWriteJson(mcpJsonPath, next);
  return { path: mcpJsonPath, config: next, applied: true };
}

export async function unregisterService(options = {}) {
  const { serverId = SERVICE_ID, mcpJsonPath = defaultMcpJsonPath() } = options;
  const current = await readMcpJson(mcpJsonPath);
  if (!current.mcpServers || !(serverId in current.mcpServers)) {
    return { path: mcpJsonPath, config: current, applied: false };
  }
  const nextMcpServers = { ...current.mcpServers };
  delete nextMcpServers[serverId];
  const next = {
    ...current,
    mcpServers: nextMcpServers,
    metadata: {
      ...(current.metadata ?? {}),
      lastUnregisteredAt: new Date().toISOString(),
      lastUnregisteredServer: serverId,
    },
  };
  await atomicWriteJson(mcpJsonPath, next);
  return { path: mcpJsonPath, config: next, applied: true };
}

export async function inspectRegistration(options = {}) {
  const { mcpJsonPath = defaultMcpJsonPath() } = options;
  const current = await readMcpJson(mcpJsonPath);
  const entry = current.mcpServers?.[SERVICE_ID] ?? null;
  return { path: mcpJsonPath, config: current, registered: !!entry, entry };
}

export const workbuddyRegisterInternals = {
  atomicWriteJson,
  buildMcpConfig,
  deriveStdioCommand,
  readMcpJson,
};
