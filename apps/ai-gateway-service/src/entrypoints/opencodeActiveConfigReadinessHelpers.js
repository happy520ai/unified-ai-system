import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { stripJsonComments } from "./opencodeToolingReadinessCore.js";

export const PHASE3994A_ID = "Phase3994A";
export const PHASE3994A_SLUG = "phase3994a-opencode-active-config-repair";

const MIRROR_KEYS = [
  "formatter",
  "mcp",
  "plugin",
  "permission",
  "lsp",
  "provider",
  "model",
  "small_model",
  "enabled_providers",
  "agent",
  "command",
  "default_agent",
];

const REQUIRED_MCP = [
  "context7",
  "gh_grep",
  "sequential_thinking",
  "filesystem_project",
  "memory",
  "playwright",
];

function safeHomeDir() {
  return process.env.USERPROFILE || process.env.HOME || "C:\\Users\\Administrator";
}

function hasUtf8Bom(path) {
  if (!existsSync(path)) return false;
  const bytes = readFileSync(path);
  return bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

function stripBom(text) {
  return text.replace(/^\uFEFF/, "");
}

function parseConfigText(text, jsonc) {
  return JSON.parse(jsonc ? stripJsonComments(stripBom(text)) : stripBom(text));
}

function readConfig(path, jsonc = false) {
  const result = {
    path,
    exists: existsSync(path),
    hasBom: hasUtf8Bom(path),
    parseable: false,
    config: null,
    error: null,
  };

  if (!result.exists) return result;

  try {
    result.config = parseConfigText(readFileSync(path, "utf8"), jsonc);
    result.parseable = true;
  } catch (error) {
    result.error = error.message;
  }

  return result;
}

export function readPair(jsonPath, jsoncPath) {
  return {
    json: readConfig(jsonPath, false),
    jsonc: readConfig(jsoncPath, true),
  };
}

function normalizePath(value) {
  return resolve(String(value || "")).toLowerCase();
}

export function compareKeys(leftConfig, rightConfig, keys = MIRROR_KEYS) {
  const result = {};
  for (const key of keys) {
    result[key] = JSON.stringify(leftConfig?.[key]) === JSON.stringify(rightConfig?.[key]);
  }
  return result;
}

function hasRequiredPlugin(config, name) {
  return Array.isArray(config?.plugin)
    ? config.plugin.some((entry) => entry === name || (Array.isArray(entry) && entry[0] === name))
    : false;
}

function toolSearchAlwaysLoad(config) {
  const entry = Array.isArray(config?.plugin)
    ? config.plugin.find((item) => Array.isArray(item) && item[0] === "opencode-tool-search")
    : null;
  const alwaysLoad = entry?.[1]?.alwaysLoad;
  return Array.isArray(alwaysLoad) ? alwaysLoad : [];
}

export function checkFormatter(config) {
  const command = config?.formatter?.prettier?.command || [];
  return {
    configured: Boolean(config?.formatter?.prettier),
    command,
    hasFilePlaceholder: command.includes("$FILE"),
  };
}

export function inspectMcp(config, repoRoot) {
  const servers = config?.mcp || {};
  const serverNames = Object.keys(servers);
  const localServers = [];
  const remoteServers = [];

  for (const [name, server] of Object.entries(servers)) {
    if (server.type === "local") {
      const command = Array.isArray(server.command) ? server.command : [];
      localServers.push({
        name,
        enabled: server.enabled !== false,
        timeout: server.timeout,
        command,
        commandExists: command.length > 0 && existsSync(command[0]),
        projectScoped:
          name !== "filesystem_project" || command.some((part) => normalizePath(part) === normalizePath(repoRoot)),
        playwrightOutputScoped:
          name !== "playwright" ||
          command.some((part) => normalizePath(part).startsWith(normalizePath(join(repoRoot, ".opencode")))),
      });
    } else if (server.type === "remote") {
      remoteServers.push({
        name,
        enabled: server.enabled !== false,
        timeout: server.timeout,
        url: server.url,
        https: String(server.url || "").startsWith("https://"),
        hasHeaders: Boolean(server.headers),
      });
    }
  }

  return {
    serverNames,
    requiredPresent: REQUIRED_MCP.every((name) => serverNames.includes(name)),
    localServers,
    remoteServers,
    localReady:
      localServers.length >= 4 &&
      localServers.every(
        (server) =>
          server.enabled &&
          server.commandExists &&
          server.projectScoped &&
          server.playwrightOutputScoped &&
          Number.isInteger(server.timeout) &&
          server.timeout >= 5000,
      ),
    remoteReady:
      remoteServers.length >= 2 &&
      remoteServers.every(
        (server) =>
          server.enabled &&
          server.https &&
          !server.hasHeaders &&
          Number.isInteger(server.timeout) &&
          server.timeout >= 5000,
      ),
  };
}

export function inspectPlugin(config, homeDir) {
  const nodeModules = join(homeDir, ".config", "opencode", "node_modules");
  const alwaysLoad = toolSearchAlwaysLoad(config);
  return {
    hasCostGuard: hasRequiredPlugin(config, "opencode-cost-guard"),
    hasToolSearch: hasRequiredPlugin(config, "opencode-tool-search"),
    toolSearchAlwaysLoad: alwaysLoad,
    toolSearchLoadsTask: alwaysLoad.includes("task"),
    toolSearchLoadsSkill: alwaysLoad.includes("skill"),
    costGuardInstalled: existsSync(join(nodeModules, "opencode-cost-guard", "package.json")),
    toolSearchInstalled: existsSync(join(nodeModules, "opencode-tool-search", "package.json")),
  };
}

export function inspectPermission(config) {
  return {
    lsp: config?.permission?.lsp,
    externalDirectory: config?.permission?.external_directory,
    filesystem: config?.permission?.["filesystem_*"],
    playwright: config?.permission?.["playwright_*"],
    memory: config?.permission?.["memory_*"],
    git: config?.permission?.["git_*"],
    github: config?.permission?.["github_*"],
    bashGitPush: config?.permission?.bash?.["git push*"],
    bashGitCommit: config?.permission?.bash?.["git commit*"],
    bashGitReset: config?.permission?.bash?.["git reset*"],
    bashGitClean: config?.permission?.bash?.["git clean*"],
  };
}

export function buildGlobalOpenCodeConfig({ repoRoot, homeDir = safeHomeDir() }) {
  const root = resolve(repoRoot);
  const binDir = join(homeDir, ".config", "opencode", "node_modules", ".bin");
  return {
    $schema: "https://opencode.ai/config.json",
    shell: "pwsh",
    share: "disabled",
    autoupdate: "notify",
    instructions: ["AGENTS.md"],
    lsp: true,
    formatter: {
      prettier: {
        command: [join(binDir, "prettier.cmd"), "--write", "$FILE"],
        extensions: [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".jsonc", ".css", ".scss", ".html", ".md"],
      },
    },
    watcher: {
      ignore: [
        ".git/**",
        "node_modules/**",
        "legacy/**",
        "dist/**",
        "build/**",
        "coverage/**",
        ".turbo/**",
        ".next/**",
        "evidence/**",
        "reports/**",
        "**/.env",
        "**/.env.*",
        "**/*secret*",
        "**/*token*",
      ],
    },
    permission: {
      external_directory: "deny",
      edit: "ask",
      lsp: "allow",
      bash: {
        "*": "ask",
        "git push*": "deny",
        "git commit*": "deny",
        "git tag*": "deny",
        "git reset*": "deny",
        "git clean*": "deny",
        "gh release*": "deny",
        "npm publish*": "deny",
        "pnpm publish*": "deny",
        "docker push*": "deny",
        "kubectl *": "deny",
        "terraform apply*": "deny",
        "rm -rf*": "deny",
        "del /s*": "deny",
        "Remove-Item -Recurse*": "deny",
        "git status*": "allow",
        "git diff*": "allow",
      },
      "filesystem_*": "ask",
      "git_*": "deny",
      "github_*": "deny",
      "postgres_*": "deny",
      "sqlite_*": "deny",
      "browser_*": "ask",
      "playwright_*": "ask",
      "memory_*": "ask",
      "sequential_thinking_*": "allow",
      "context7_*": "allow",
      "gh_grep_*": "allow",
      "ui_automation_*": "ask",
      "sentry_*": "ask",
    },
    mcp: {
      context7: {
        type: "remote",
        url: "https://mcp.context7.com/mcp",
        enabled: true,
        timeout: 10000,
      },
      gh_grep: {
        type: "remote",
        url: "https://mcp.grep.app",
        enabled: true,
        timeout: 10000,
      },
      sequential_thinking: {
        type: "local",
        command: [join(binDir, "mcp-server-sequential-thinking.cmd")],
        enabled: true,
        timeout: 10000,
      },
      filesystem_project: {
        type: "local",
        command: [join(binDir, "mcp-server-filesystem.cmd"), root],
        enabled: true,
        timeout: 10000,
      },
      memory: {
        type: "local",
        command: [join(binDir, "mcp-server-memory.cmd")],
        enabled: true,
        timeout: 10000,
      },
      playwright: {
        type: "local",
        command: [
          join(binDir, "playwright-mcp.cmd"),
          "--browser",
          "chrome",
          "--isolated",
          "--viewport-size",
          "1440x900",
          "--timeout-action",
          "8000",
          "--timeout-navigation",
          "60000",
          "--output-dir",
          join(root, ".opencode", "playwright-output"),
        ],
        enabled: true,
        timeout: 20000,
      },
    },
    plugin: [
      "opencode-cost-guard",
      [
        "opencode-tool-search",
        {
          alwaysLoad: ["bash", "grep", "glob", "read", "edit", "write", "apply_patch", "task", "skill"],
          searchLimit: 8,
        },
      ],
    ],
  };
}

export function buildOpenCodeActiveConfigReadinessMarkdown(report) {
  const failed = report.checks.filter((check) => !check.pass).map((check) => check.id);
  const lines = [
    `# ${report.phaseId} OpenCode Active Config Repair`,
    "",
    `- Status: ${report.status}`,
    `- Blocker: ${report.blocker || "none"}`,
    `- Evidence ID: ${report.summary.evidenceId}`,
    `- Provider called: ${report.summary.providerCalled}`,
    `- Paid API called: ${report.summary.paidApiCalled}`,
    `- Default /chat changed: ${report.summary.defaultChatChanged}`,
    `- GUI restart required: ${report.summary.guiRestartRequired}`,
    "",
    "## Active Config Paths",
    "",
    `- Root JSONC: ${report.configPaths.rootJsonc}`,
    `- Project JSONC: ${report.configPaths.projectJsonc}`,
    `- Global JSONC: ${report.configPaths.globalJsonc}`,
    "",
    "## Failed Checks",
    "",
    failed.length === 0 ? "- none" : failed.map((id) => `- ${id}`).join("\n"),
    "",
    "## MCP",
    "",
    `- Root servers: ${report.mcp.root.serverNames.join(", ")}`,
    `- Project servers: ${report.mcp.project.serverNames.join(", ")}`,
    `- Global servers: ${report.mcp.global.serverNames.join(", ")}`,
    "",
    "## Launcher",
    "",
    `- Path: ${report.launcher.path}`,
    `- Sets OPENCODE_CONFIG_DIR: ${report.launcher.setsConfigDir}`,
    `- Sets OPENCODE_CONFIG: ${report.launcher.setsExplicitConfig}`,
    `- Passes project root: ${report.launcher.passesProjectRoot}`,
    "",
    "## Plugin",
    "",
    `- Project tool-search loads task: ${report.plugin.project.toolSearchLoadsTask}`,
    `- Project tool-search loads skill: ${report.plugin.project.toolSearchLoadsSkill}`,
    `- Global tool-search loads task: ${report.plugin.global.toolSearchLoadsTask}`,
    `- Global tool-search loads skill: ${report.plugin.global.toolSearchLoadsSkill}`,
  ];

  return `${lines.join("\n")}\n`;
}
