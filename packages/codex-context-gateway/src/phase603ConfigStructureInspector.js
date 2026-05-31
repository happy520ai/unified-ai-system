import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const providerTablePattern = /^\s*\[model_providers\.([A-Za-z0-9_-]+)]\s*$/;
const tablePattern = /^\s*\[([^\]]+)]\s*$/;
const assignmentPattern = /^\s*([A-Za-z0-9_-]+)\s*=\s*(.+?)\s*$/;

export function inspectPhase603CodexConfigStructure(options = {}) {
  const configPath = options.configPath || join(homedir(), ".codex", "config.toml");
  const authJsonRead = false;
  if (!existsSync(configPath)) {
    return {
      completed: false,
      configTomlStructureInspected: false,
      configTomlExists: false,
      authJsonRead,
      rawBaseUrlValueExposed: false,
      providerNamesDetected: false,
      secretValueExposed: false,
      defaultModelProvider: null,
      providers: [],
      tableKeys: [],
      tableCount: 0,
      warnings: ["codex_config_toml_missing"],
    };
  }

  const text = readFileSync(configPath, "utf8");
  const parsed = parseConfigStructure(text);
  const providers = parsed.providers.map((provider) => ({
    providerId: provider.providerId,
    tableKey: `model_providers.${provider.providerId}`,
    hasBaseUrl: provider.hasBaseUrl,
    baseUrlRedacted: provider.hasBaseUrl,
    wire_api: provider.wire_api || null,
    requires_openai_auth: provider.requires_openai_auth,
    namePresent: provider.namePresent,
  }));

  return {
    completed: true,
    configTomlStructureInspected: true,
    configTomlExists: true,
    authJsonRead,
    rawBaseUrlValueExposed: false,
    providerNamesDetected: providers.length > 0,
    secretValueExposed: false,
    defaultModelProvider: parsed.defaultModelProvider,
    providers,
    tableKeys: parsed.tableKeys,
    tableCount: parsed.tableKeys.length,
    duplicateProviderTables: parsed.duplicateProviderTables,
    crsProvider: providers.find((provider) => provider.providerId === "crs") || null,
    warnings: [],
  };
}

export function parsePhase603ConfigStructureText(text) {
  return parseConfigStructure(String(text || ""));
}

function parseConfigStructure(text) {
  const tableKeys = [];
  const providerEntries = new Map();
  const providerTableCounts = new Map();
  let currentTable = "";
  let defaultModelProvider = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripInlineComment(rawLine);
    const tableMatch = line.match(tablePattern);
    if (tableMatch) {
      currentTable = tableMatch[1].trim();
      tableKeys.push(currentTable);
      const providerMatch = line.match(providerTablePattern);
      if (providerMatch) {
        const providerId = providerMatch[1];
        providerTableCounts.set(providerId, (providerTableCounts.get(providerId) || 0) + 1);
        if (!providerEntries.has(providerId)) {
          providerEntries.set(providerId, {
            providerId,
            hasBaseUrl: false,
            wire_api: null,
            requires_openai_auth: null,
            namePresent: false,
          });
        }
      }
      continue;
    }

    const assignmentMatch = line.match(assignmentPattern);
    if (!assignmentMatch) continue;
    const [, key, rawValue] = assignmentMatch;
    const value = sanitizeScalar(rawValue);
    if (!currentTable && key === "model_provider") {
      defaultModelProvider = value;
      continue;
    }
    const providerId = currentTable.match(/^model_providers\.([A-Za-z0-9_-]+)$/)?.[1];
    if (!providerId || !providerEntries.has(providerId)) continue;
    const provider = providerEntries.get(providerId);
    if (key === "base_url") provider.hasBaseUrl = true;
    if (key === "wire_api") provider.wire_api = value;
    if (key === "requires_openai_auth") provider.requires_openai_auth = value === true || value === "true";
    if (key === "name") provider.namePresent = Boolean(value);
  }

  const duplicateProviderTables = [...providerTableCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([providerId, count]) => ({ providerId, count }));

  return {
    defaultModelProvider,
    providers: [...providerEntries.values()],
    tableKeys,
    duplicateProviderTables,
  };
}

function stripInlineComment(line) {
  const text = String(line || "");
  let inQuote = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && text[index - 1] !== "\\") inQuote = !inQuote;
    if (char === "#" && !inQuote) return text.slice(0, index);
  }
  return text;
}

function sanitizeScalar(rawValue) {
  const trimmed = String(rawValue || "").trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  return trimmed.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
}
