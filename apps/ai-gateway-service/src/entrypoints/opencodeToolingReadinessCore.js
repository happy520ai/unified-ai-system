import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PHASE3993A_ID = "Phase3993A";
export const PHASE3993A_SLUG = "phase3993a-opencode-mcp-lsp-plugin-readiness";

function stripBom(text) {
  return text.replace(/^\uFEFF/, "");
}

function hasUtf8Bom(path) {
  if (!existsSync(path)) return false;
  const bytes = readFileSync(path);
  return bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

export function stripJsonComments(text) {
  let output = "";
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      output += char;
      continue;
    }

    if (char === "/" && next === "/") {
      while (index < text.length && text[index] !== "\n") index += 1;
      output += "\n";
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;
      while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) {
        index += 1;
      }
      index += 1;
      continue;
    }

    output += char;
  }

  return output;
}

function parseJsonFile(path) {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(stripBom(raw));
}

function parseJsoncFile(path) {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(stripJsonComments(stripBom(raw)));
}

export function loadOpenCodeConfigPair({ repoRoot }) {
  const root = resolve(repoRoot);
  const jsonPath = join(root, "opencode.json");
  const jsoncPath = join(root, "opencode.jsonc");

  return {
    json: {
      path: jsonPath,
      exists: existsSync(jsonPath),
      hasBom: hasUtf8Bom(jsonPath),
      config: parseJsonFile(jsonPath),
    },
    jsonc: {
      path: jsoncPath,
      exists: existsSync(jsoncPath),
      hasBom: hasUtf8Bom(jsoncPath),
      config: parseJsoncFile(jsoncPath),
    },
  };
}

function normalizePath(value) {
  return resolve(String(value || ""));
}

function safeHomeDir() {
  return process.env.USERPROFILE || process.env.HOME || "C:\\Users\\Administrator";
}

function buildCheck(checks, id, pass, detail, severity = "error") {
  checks.push({ id, pass: Boolean(pass), severity, detail });
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function configuredPluginName(entry) {
  if (typeof entry === "string") return entry;
  if (Array.isArray(entry) && typeof entry[0] === "string") return entry[0];
  return null;
}

function pluginModuleLooksUsable(module) {
  if (typeof module.default === "function") return true;
  if (module.default && typeof module.default.server === "function") return true;
  return Object.values(module).some((value) => typeof value === "function");
}

async function importPlugin(specifier) {
  const module = await import(`${specifier}?phase3993a=${Date.now()}-${Math.random()}`);
  return pluginModuleLooksUsable(module);
}

async function checkConfiguredPlugins({ repoRoot, config, homeDir }) {
  const configured = Array.isArray(config.plugin) ? config.plugin : [];
  const opencodeNodeModules = join(homeDir, ".config", "opencode", "node_modules");
  const plugins = [];

  for (const entry of configured) {
    const name = configuredPluginName(entry);
    const result = {
      name,
      configured: Boolean(name),
      installed: false,
      importable: false,
      hasConfig: Array.isArray(entry) && typeof entry[1] === "object",
      error: null,
    };

    if (!name) {
      result.error = "invalid_plugin_entry";
      plugins.push(result);
      continue;
    }

    try {
      let specifier;
      if (name.startsWith("file://")) {
        specifier = name;
        result.installed = true;
      } else {
        const packageDir = join(opencodeNodeModules, name);
        const packageJsonPath = join(packageDir, "package.json");
        result.installed = existsSync(packageJsonPath);
        if (result.installed) {
          const packageJson = parseJsonFile(packageJsonPath);
          const main = packageJson.module || packageJson.main || "index.js";
          specifier = pathToFileURL(join(packageDir, main)).href;
        }
      }

      result.importable = specifier ? await importPlugin(specifier) : false;
    } catch (error) {
      result.error = error.message;
    }

    plugins.push(result);
  }

  const localPluginDir = join(repoRoot, ".opencode", "plugins");
  const local = existsSync(localPluginDir)
    ? await Promise.all(
        readdirSync(localPluginDir)
          .filter((file) => [".js", ".mjs"].includes(extname(file)))
          .map(async (file) => {
            const filePath = join(localPluginDir, file);
            const result = { name: file, path: filePath, importable: false, error: null };
            try {
              result.importable = await importPlugin(pathToFileURL(filePath).href);
            } catch (error) {
              result.error = error.message;
            }
            return result;
          }),
      )
    : [];

  return {
    configured,
    configuredPlugins: plugins,
    configuredPluginsReady:
      plugins.length > 0 && plugins.every((plugin) => plugin.configured && plugin.installed && plugin.importable),
    localPluginDir,
    localPlugins: local,
    localPluginsReady: local.length > 0 && local.every((plugin) => plugin.importable),
  };
}

function checkMcp({ repoRoot, config }) {
  const servers = config.mcp || {};
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
          name !== "filesystem_project" ||
          command.some((part) => normalizePath(part) === normalizePath(repoRoot)),
        playwrightOutputScoped:
          name !== "playwright" ||
          command.some((part) => normalizePath(part).startsWith(join(normalizePath(repoRoot), ".opencode"))),
      });
    } else if (server.type === "remote") {
      remoteServers.push({
        name,
        enabled: server.enabled !== false,
        timeout: server.timeout,
        url: server.url,
        https: isHttpsUrl(server.url),
        hasHeaders: Boolean(server.headers),
      });
    }
  }

  return {
    serverNames: Object.keys(servers),
    localServers,
    remoteServers,
    localServersReady:
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
    remoteServersConfigured:
      remoteServers.length >= 2 &&
      remoteServers.every(
        (server) => server.enabled && server.https && !server.hasHeaders && Number.isInteger(server.timeout),
      ),
  };
}

function checkLsp({ repoRoot, config }) {
  const homeDir = safeHomeDir();
  const launcherPath = join(repoRoot, "tools", "phase3993a", "start-opencode-with-lsp.cmd");
  const typescriptServerPath = join(
    homeDir,
    ".config",
    "opencode",
    "node_modules",
    ".bin",
    "typescript-language-server.cmd",
  );

  return {
    enabled: config.lsp === true || (config.lsp && typeof config.lsp === "object"),
    permission: config.permission?.lsp,
    experimentalEnvRequired: true,
    experimentalEnvPresent:
      process.env.OPENCODE_EXPERIMENTAL_LSP_TOOL === "true" || process.env.OPENCODE_EXPERIMENTAL === "true",
    launcherPath,
    launcherPresent: existsSync(launcherPath),
    typescriptServerPath,
    typescriptServerPresent: existsSync(typescriptServerPath),
  };
}

function checkFormatter(config) {
  const command = config.formatter?.prettier?.command || [];
  return {
    configured: Boolean(config.formatter?.prettier),
    command,
    extensions: config.formatter?.prettier?.extensions || [],
    prettierHasFilePlaceholder: command.includes("$FILE"),
  };
}

function compareMirrors(pair) {
  return {
    formatter: JSON.stringify(pair.json.config.formatter) === JSON.stringify(pair.jsonc.config.formatter),
    agent: JSON.stringify(pair.json.config.agent) === JSON.stringify(pair.jsonc.config.agent),
    command: JSON.stringify(pair.json.config.command) === JSON.stringify(pair.jsonc.config.command),
    mcp: JSON.stringify(pair.json.config.mcp) === JSON.stringify(pair.jsonc.config.mcp),
    plugin: JSON.stringify(pair.json.config.plugin) === JSON.stringify(pair.jsonc.config.plugin),
  };
}

export async function buildOpenCodeToolingReadinessReport({ repoRoot, homeDir = safeHomeDir() }) {
  const root = resolve(repoRoot);
  const pair = loadOpenCodeConfigPair({ repoRoot: root });
  const mirror = compareMirrors(pair);
  const config = pair.jsonc.config;
  const checks = [];

  buildCheck(checks, "opencode_json_no_bom", pair.json.hasBom === false, pair.json.path);
  buildCheck(checks, "opencode_jsonc_no_bom", pair.jsonc.hasBom === false, pair.jsonc.path);
  for (const [key, pass] of Object.entries(mirror)) {
    buildCheck(checks, `opencode_json_mirrors_jsonc_${key}`, pass, key);
  }

  const mcp = checkMcp({ repoRoot: root, config });
  buildCheck(checks, "mcp_local_servers_ready", mcp.localServersReady, mcp.localServers);
  buildCheck(checks, "mcp_remote_servers_configured", mcp.remoteServersConfigured, mcp.remoteServers);

  const lsp = checkLsp({ repoRoot: root, config });
  buildCheck(checks, "lsp_enabled", lsp.enabled, lsp);
  buildCheck(checks, "lsp_permission_allow", lsp.permission === "allow", lsp.permission);
  buildCheck(checks, "lsp_typescript_server_present", lsp.typescriptServerPresent, lsp.typescriptServerPath);
  buildCheck(checks, "lsp_launcher_present", lsp.launcherPresent, lsp.launcherPath);

  const formatter = checkFormatter(config);
  buildCheck(checks, "formatter_prettier_configured", formatter.configured, formatter);
  buildCheck(checks, "formatter_prettier_file_placeholder", formatter.prettierHasFilePlaceholder, formatter.command);

  const plugins = await checkConfiguredPlugins({ repoRoot: root, config, homeDir });
  buildCheck(checks, "plugins_configured_ready", plugins.configuredPluginsReady, plugins.configuredPlugins);
  buildCheck(checks, "plugins_local_ready", plugins.localPluginsReady, plugins.localPlugins);

  const failedChecks = checks.filter((check) => check.severity === "error" && !check.pass);

  return {
    phaseId: PHASE3993A_ID,
    slug: PHASE3993A_SLUG,
    generatedAt: new Date().toISOString(),
    status: failedChecks.length === 0 ? "passed" : "blocked",
    blocker: failedChecks.length === 0 ? null : "opencode_tooling_readiness_incomplete",
    repoRoot: root,
    configFiles: {
      json: { path: pair.json.path, exists: pair.json.exists, hasBom: pair.json.hasBom },
      jsonc: { path: pair.jsonc.path, exists: pair.jsonc.exists, hasBom: pair.jsonc.hasBom },
      mirror,
    },
    mcp,
    lsp,
    formatter,
    plugins,
    checks,
    summary: {
      providerCalled: false,
      paidApiCalled: false,
      mimoCalled: false,
      openAiCalled: false,
      claudeCalled: false,
      openRouterCalled: false,
      embeddingBatchTraining: false,
      secretsRead: false,
      defaultChatChanged: false,
      legacyModified: false,
      projectContextCreated: false,
      commitPushDeployRelease: false,
      workspaceCleanClaimed: false,
      routeChanged: "/opencode/tooling-readiness added as read-only readiness route",
      evidenceId: PHASE3993A_SLUG,
    },
  };
}

export function buildOpenCodeToolingReadinessMarkdown(report) {
  const lines = [
    `# ${report.phaseId} OpenCode MCP/LSP/Plugin Readiness`,
    "",
    `- Status: ${report.status}`,
    `- Blocker: ${report.blocker || "none"}`,
    `- Provider called: ${report.summary.providerCalled}`,
    `- Paid API called: ${report.summary.paidApiCalled}`,
    `- Default /chat changed: ${report.summary.defaultChatChanged}`,
    `- Legacy modified: ${report.summary.legacyModified}`,
    `- Evidence ID: ${report.summary.evidenceId}`,
    "",
    "## Checks",
    "",
    "| Check | Pass |",
    "| --- | --- |",
    ...report.checks.map((check) => `| ${check.id} | ${check.pass} |`),
    "",
    "## MCP",
    "",
    `- Local servers ready: ${report.mcp.localServersReady}`,
    `- Remote servers configured: ${report.mcp.remoteServersConfigured}`,
    `- Servers: ${report.mcp.serverNames.join(", ")}`,
    "",
    "## LSP",
    "",
    `- Enabled: ${report.lsp.enabled}`,
    `- Permission: ${report.lsp.permission}`,
    `- Launcher present: ${report.lsp.launcherPresent}`,
    `- TypeScript server present: ${report.lsp.typescriptServerPresent}`,
    "",
    "## Plugins",
    "",
    `- Configured plugins ready: ${report.plugins.configuredPluginsReady}`,
    `- Local plugins ready: ${report.plugins.localPluginsReady}`,
  ];

  return `${lines.join("\n")}\n`;
}

export function evidencePaths(repoRoot) {
  const dir = join(resolve(repoRoot), "apps", "ai-gateway-service", "evidence", PHASE3993A_SLUG);
  return {
    dir,
    json: join(dir, "latest-readiness.json"),
    md: join(dir, "latest-readiness.md"),
    docs: join(resolve(repoRoot), "docs", `${PHASE3993A_SLUG}.md`),
    launcher: join(resolve(repoRoot), "tools", "phase3993a", "start-opencode-with-lsp.cmd"),
  };
}

export function currentFileDir(importMetaUrl) {
  return dirname(new URL(importMetaUrl).pathname);
}
