import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { stripJsonComments } from "./opencodeToolingReadinessCore.js";
import {
  readPair,
  compareKeys,
  checkFormatter,
  inspectMcp,
  inspectPlugin,
  inspectPermission,
  buildGlobalOpenCodeConfig,
  buildOpenCodeActiveConfigReadinessMarkdown,
} from "./opencodeActiveConfigReadinessHelpers.js";

export const PHASE3994A_ID = "Phase3994A";
export const PHASE3994A_SLUG = "phase3994a-opencode-active-config-repair";

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

export function activeConfigPaths({ repoRoot, homeDir = safeHomeDir() }) {
  const root = resolve(repoRoot);
  const globalDir = join(homeDir, ".config", "opencode");
  const projectDir = join(root, ".opencode");

  return {
    root,
    globalDir,
    projectDir,
    rootJson: join(root, "opencode.json"),
    rootJsonc: join(root, "opencode.jsonc"),
    globalJson: join(globalDir, "opencode.json"),
    globalJsonc: join(globalDir, "opencode.jsonc"),
    projectJson: join(projectDir, "opencode.json"),
    projectJsonc: join(projectDir, "opencode.jsonc"),
    evidenceDir: join(root, "apps", "ai-gateway-service", "evidence", PHASE3994A_SLUG),
    evidenceJson: join(root, "apps", "ai-gateway-service", "evidence", PHASE3994A_SLUG, "latest-active-config.json"),
    evidenceMarkdown: join(root, "apps", "ai-gateway-service", "evidence", PHASE3994A_SLUG, "latest-active-config.md"),
    docs: join(root, "docs", `${PHASE3994A_SLUG}.md`),
    launcher: join(root, "tools", "phase3993a", "start-opencode-with-lsp.cmd"),
  };
}

function inspectLauncher(path) {
  const text = existsSync(path) ? readFileSync(path, "utf8") : "";
  return {
    path,
    exists: Boolean(text),
    setsLspTool: text.includes("set \"OPENCODE_EXPERIMENTAL_LSP_TOOL=true\""),
    setsExperimental: text.includes("set \"OPENCODE_EXPERIMENTAL=true\""),
    setsConfigDir: text.includes("set \"OPENCODE_CONFIG_DIR=%USERPROFILE%\\.config\\opencode\""),
    setsExplicitConfig: text.includes("set \"OPENCODE_CONFIG=%PROJECT_ROOT%\\.opencode\\opencode.json\""),
    checksExplicitConfig: text.includes("if not exist \"%OPENCODE_CONFIG%\""),
    checksGlobalConfig: text.includes("if not exist \"%OPENCODE_CONFIG_DIR%\\opencode.json\""),
    passesProjectRoot: text.includes("\"%OPENCODE_EXE%\" \"%PROJECT_ROOT%\""),
  };
}

function buildCheck(checks, id, pass, detail, severity = "error") {
  checks.push({ id, pass: Boolean(pass), severity, detail });
}

function serializeConfig(config) {
  return `${JSON.stringify(config, null, 2)}\n`;
}

function backupIfChanged(path, nextText, stamp, backups) {
  if (!existsSync(path)) return;
  const current = readFileSync(path, "utf8");
  if (stripBom(current) === nextText) return;
  const backupPath = `${path}.bak-${PHASE3994A_SLUG}-${stamp}`;
  copyFileSync(path, backupPath);
  backups.push({ source: path, backup: backupPath });
}

function writeUtf8NoBom(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

function safeStamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

export function repairOpenCodeActiveConfig({ repoRoot, homeDir = safeHomeDir() }) {
  const paths = activeConfigPaths({ repoRoot, homeDir });
  const rootJsoncText = readFileSync(paths.rootJsonc, "utf8");
  const rootConfig = parseConfigText(rootJsoncText, true);
  const rootJsonText = serializeConfig(rootConfig);
  const globalConfig = buildGlobalOpenCodeConfig({ repoRoot: paths.root, homeDir });
  const globalText = serializeConfig(globalConfig);
  const backups = [];
  const stamp = safeStamp();

  mkdirSync(paths.projectDir, { recursive: true });
  mkdirSync(paths.globalDir, { recursive: true });

  for (const target of [paths.rootJson, paths.projectJson, paths.projectJsonc, paths.globalJson, paths.globalJsonc]) {
    const nextText =
      target === paths.projectJsonc
        ? rootJsoncText
        : target === paths.globalJson || target === paths.globalJsonc
          ? globalText
          : rootJsonText;
    backupIfChanged(target, nextText, stamp, backups);
    writeUtf8NoBom(target, nextText);
  }

  return { paths, backups };
}

export async function buildOpenCodeActiveConfigReadinessReport({ repoRoot, homeDir = safeHomeDir() }) {
  const paths = activeConfigPaths({ repoRoot, homeDir });
  const rootPair = readPair(paths.rootJson, paths.rootJsonc);
  const globalPair = readPair(paths.globalJson, paths.globalJsonc);
  const projectPair = readPair(paths.projectJson, paths.projectJsonc);
  const rootConfig = rootPair.jsonc.config;
  const globalConfig = globalPair.jsonc.config;
  const projectConfig = projectPair.jsonc.config;
  const checks = [];

  const rootMirror = compareKeys(rootPair.json.config, rootConfig);
  const globalMirror = compareKeys(globalPair.json.config, globalConfig, ["formatter", "mcp", "plugin", "permission", "lsp"]);
  const projectRootMirror = compareKeys(projectConfig, rootConfig);

  for (const [scope, pair] of [
    ["root", rootPair],
    ["global", globalPair],
    ["project", projectPair],
  ]) {
    buildCheck(checks, `${scope}_json_exists`, pair.json.exists, pair.json.path);
    buildCheck(checks, `${scope}_jsonc_exists`, pair.jsonc.exists, pair.jsonc.path);
    buildCheck(checks, `${scope}_json_no_bom`, pair.json.hasBom === false, pair.json.path);
    buildCheck(checks, `${scope}_jsonc_no_bom`, pair.jsonc.hasBom === false, pair.jsonc.path);
    buildCheck(checks, `${scope}_json_parseable`, pair.json.parseable, pair.json.error);
    buildCheck(checks, `${scope}_jsonc_parseable`, pair.jsonc.parseable, pair.jsonc.error);
  }

  for (const [key, pass] of Object.entries(rootMirror)) {
    buildCheck(checks, `root_json_mirrors_jsonc_${key}`, pass, key);
  }
  for (const [key, pass] of Object.entries(globalMirror)) {
    buildCheck(checks, `global_json_mirrors_jsonc_${key}`, pass, key);
  }
  for (const [key, pass] of Object.entries(projectRootMirror)) {
    buildCheck(checks, `project_active_config_mirrors_root_${key}`, pass, key);
  }

  const rootFormatter = checkFormatter(rootConfig);
  const globalFormatter = checkFormatter(globalConfig);
  const projectFormatter = checkFormatter(projectConfig);
  buildCheck(checks, "root_formatter_has_file_placeholder", rootFormatter.hasFilePlaceholder, rootFormatter.command);
  buildCheck(checks, "global_formatter_has_file_placeholder", globalFormatter.hasFilePlaceholder, globalFormatter.command);
  buildCheck(checks, "project_formatter_has_file_placeholder", projectFormatter.hasFilePlaceholder, projectFormatter.command);

  const rootMcp = inspectMcp(rootConfig, paths.root);
  const globalMcp = inspectMcp(globalConfig, paths.root);
  const projectMcp = inspectMcp(projectConfig, paths.root);
  for (const [scope, mcp] of [
    ["root", rootMcp],
    ["global", globalMcp],
    ["project", projectMcp],
  ]) {
    buildCheck(checks, `${scope}_required_mcp_present`, mcp.requiredPresent, mcp.serverNames);
    buildCheck(checks, `${scope}_local_mcp_ready`, mcp.localReady, mcp.localServers);
    buildCheck(checks, `${scope}_remote_mcp_ready`, mcp.remoteReady, mcp.remoteServers);
  }

  const rootPlugin = inspectPlugin(rootConfig, homeDir);
  const globalPlugin = inspectPlugin(globalConfig, homeDir);
  const projectPlugin = inspectPlugin(projectConfig, homeDir);
  for (const [scope, plugin] of [
    ["root", rootPlugin],
    ["global", globalPlugin],
    ["project", projectPlugin],
  ]) {
    buildCheck(checks, `${scope}_cost_guard_configured`, plugin.hasCostGuard, plugin);
    buildCheck(checks, `${scope}_tool_search_configured`, plugin.hasToolSearch, plugin);
    buildCheck(checks, `${scope}_tool_search_loads_task`, plugin.toolSearchLoadsTask, plugin.toolSearchAlwaysLoad);
    buildCheck(checks, `${scope}_tool_search_loads_skill`, plugin.toolSearchLoadsSkill, plugin.toolSearchAlwaysLoad);
    buildCheck(checks, `${scope}_cost_guard_installed`, plugin.costGuardInstalled, plugin);
    buildCheck(checks, `${scope}_tool_search_installed`, plugin.toolSearchInstalled, plugin);
  }

  const rootPermission = inspectPermission(rootConfig);
  const globalPermission = inspectPermission(globalConfig);
  const projectPermission = inspectPermission(projectConfig);
  for (const [scope, permission] of [
    ["root", rootPermission],
    ["global", globalPermission],
    ["project", projectPermission],
  ]) {
    buildCheck(checks, `${scope}_lsp_permission_allow`, permission.lsp === "allow", permission);
    buildCheck(checks, `${scope}_external_directory_denied`, permission.externalDirectory === "deny", permission);
    buildCheck(checks, `${scope}_filesystem_mcp_not_denied`, permission.filesystem === "ask" || permission.filesystem === "allow", permission);
    buildCheck(checks, `${scope}_playwright_mcp_ask`, permission.playwright === "ask" || permission.playwright === "allow", permission);
    buildCheck(checks, `${scope}_git_mcp_denied`, permission.git === "deny", permission);
    buildCheck(checks, `${scope}_github_mcp_denied`, permission.github === "deny", permission);
    buildCheck(checks, `${scope}_destructive_git_denied`, permission.bashGitPush === "deny" && permission.bashGitCommit === "deny" && permission.bashGitReset === "deny" && permission.bashGitClean === "deny", permission);
  }

  const launcher = inspectLauncher(paths.launcher);
  buildCheck(checks, "launcher_exists", launcher.exists, launcher.path);
  buildCheck(checks, "launcher_enables_lsp_tool", launcher.setsLspTool, launcher);
  buildCheck(checks, "launcher_sets_opencode_config_dir", launcher.setsConfigDir, launcher);
  buildCheck(checks, "launcher_sets_explicit_opencode_config", launcher.setsExplicitConfig, launcher);
  buildCheck(checks, "launcher_checks_explicit_config", launcher.checksExplicitConfig, launcher);
  buildCheck(checks, "launcher_checks_global_config", launcher.checksGlobalConfig, launcher);
  buildCheck(checks, "launcher_passes_project_root", launcher.passesProjectRoot, launcher);

  const failedChecks = checks.filter((check) => check.severity === "error" && !check.pass);

  return {
    phaseId: PHASE3994A_ID,
    slug: PHASE3994A_SLUG,
    generatedAt: new Date().toISOString(),
    status: failedChecks.length === 0 ? "passed" : "blocked",
    blocker: failedChecks.length === 0 ? null : "opencode_active_config_not_ready",
    repoRoot: paths.root,
    configPaths: {
      rootJson: paths.rootJson,
      rootJsonc: paths.rootJsonc,
      globalJson: paths.globalJson,
      globalJsonc: paths.globalJsonc,
      projectJson: paths.projectJson,
      projectJsonc: paths.projectJsonc,
    },
    mirrors: {
      root: rootMirror,
      global: globalMirror,
      projectRoot: projectRootMirror,
    },
    formatter: {
      root: rootFormatter,
      global: globalFormatter,
      project: projectFormatter,
    },
    mcp: {
      root: rootMcp,
      global: globalMcp,
      project: projectMcp,
    },
    plugin: {
      root: rootPlugin,
      global: globalPlugin,
      project: projectPlugin,
    },
    permission: {
      root: rootPermission,
      global: globalPermission,
      project: projectPermission,
    },
    launcher,
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
      evidenceId: PHASE3994A_SLUG,
      guiRestartRequired: true,
      activeConfigScope: "global and project .opencode",
    },
  };
}

export function writeOpenCodeActiveConfigEvidence(report, repoRoot) {
  const paths = activeConfigPaths({ repoRoot });
  mkdirSync(paths.evidenceDir, { recursive: true });
  writeFileSync(paths.evidenceJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(paths.evidenceMarkdown, buildOpenCodeActiveConfigReadinessMarkdown(report), "utf8");
  return paths;
}
