#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";

const repoRoot = process.cwd();
const syncScript = resolve(repoRoot, "tools", "sync-mcp-registry-client-catalog.mjs");
const verifyScript = resolve(repoRoot, "tools", "verify-client-runtimes.mjs");
const verifySerialScript = resolve(repoRoot, "tools", "verify-client-runtimes-serial.mjs");

const DEFAULT_OUTPUT = resolve(repoRoot, ".tmp", "client-runtime-catalog.mcp-registry.json");
const DEFAULT_SOURCE_MANIFEST_DIR = resolve(repoRoot, "docs", "source-manifests.d");
const DEFAULT_SOURCE_MANIFEST = resolve(
  repoRoot,
  "docs",
  "client-runtime-catalog-sources-worldwide.json",
);
const FALLBACK_SOURCE_MANIFEST = resolve(
  repoRoot,
  "docs",
  "client-runtime-catalog-sources.json",
);
const DEFAULT_LIMIT = 100;
const DEFAULT_MAX = 10000;
const KNOWN_SOURCE_TYPES = new Set(["catalog", "catalog-dir", "catalog-url", "mcp-registry"]);

function getArgValue(argv, key) {
  const exact = `--${key}=`;
  const token = argv.find((item) => item.startsWith(exact));
  if (token) return token.substring(exact.length);
  const index = argv.indexOf(`--${key}`);
  if (index >= 0) {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) return null;
    return value;
  }
  return null;
}

function getArgValues(argv, key) {
  const keyWithEquals = `--${key}=`;
  const values = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === `--${key}`) {
      const value = argv[index + 1];
      if (value && !value.startsWith("--")) {
        values.push(value);
      }
      continue;
    }
    if (arg.startsWith(keyWithEquals)) {
      values.push(arg.substring(keyWithEquals.length));
    }
  }
  return values;
}

function hasFlag(argv, key) {
  return argv.includes(`--${key}`);
}

function hasFlagWithAssignment(argv, key) {
  const exact = `--${key}=`;
  return argv.some((arg) => arg === `--${key}` || arg.startsWith(exact));
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseMaxInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  if (parsed < 0) return fallback;
  if (parsed === 0) return Number.POSITIVE_INFINITY;
  return parsed;
}

function toSafeStamp(date = new Date()) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function runNode(scriptPath, args) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    env: process.env,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) {
    throw new Error(`Failed to start ${scriptPath}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const message = result.signal
      ? `${scriptPath} terminated with signal ${result.signal}`
      : `${scriptPath} exited with code ${result.status}`;
    throw new Error(message);
  }
}

function normalizeSourceType(value) {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  const aliases = {
    catalog: "catalog",
    file: "catalog",
    path: "catalog",
    "catalog-dir": "catalog-dir",
    "catalog_dir": "catalog-dir",
    dir: "catalog-dir",
    directory: "catalog-dir",
    "catalog-url": "catalog-url",
    "catalog_url": "catalog-url",
    url: "catalog-url",
    "mcp-registry": "mcp-registry",
    "mcp_registry": "mcp-registry",
    "mcp registry": "mcp-registry",
    registry: "mcp-registry",
  };
  return aliases[normalized] || (KNOWN_SOURCE_TYPES.has(normalized) ? normalized : null);
}

function parseSourceManifest(rawPath, options = {}) {
  if (!rawPath) return [];
  const manifestPath = resolve(repoRoot, String(rawPath));
  if (!existsSync(manifestPath)) {
    if (options.strict) {
      throw new Error(`Source manifest not found: ${manifestPath}`);
    }
    return [];
  }
  const raw = readFileSync(manifestPath, "utf8");
  const parsed = JSON.parse(raw);
  const sourceList = Array.isArray(parsed) ? parsed : parsed?.sources;
  if (!Array.isArray(sourceList)) {
    if (options.strict) {
      throw new Error(`Source manifest malformed: expected an array or { sources: [...] } at ${manifestPath}`);
    }
    return [];
  }
  const normalized = [];
  for (let index = 0; index < sourceList.length; index += 1) {
    const source = sourceList[index];
    if (!source || source.enabled === false) continue;
    const sourceType = normalizeSourceType(source.type);
    if (!sourceType) {
      throw new Error(`Invalid source type at index ${index + 1} in ${manifestPath}`);
    }
    const sourceId = source.id || `source-${index + 1}`;
    normalized.push({ id: String(sourceId), type: sourceType, source });
  }
  return normalized;
}

function loadSourceManifest(rawPath) {
  return parseSourceManifest(rawPath, { strict: true });
}

function tryLoadSourceManifest(rawPath) {
  return parseSourceManifest(rawPath, { strict: false });
}

function safeSourceId(value) {
  const raw = String(value || "").trim().toLowerCase();
  return raw.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "source";
}

function normalizeCatalogPath(rawPath) {
  if (!rawPath || !String(rawPath).trim()) {
    throw new Error("Catalog source requires a non-empty path");
  }
  return resolve(repoRoot, String(rawPath).trim());
}

function normalizeCatalogUrl(rawUrl) {
  if (!rawUrl || !String(rawUrl).trim()) {
    throw new Error("Catalog URL source requires a non-empty URL");
  }
  const value = String(rawUrl).trim();
  try {
    new URL(value);
  } catch {
    throw new Error(`Invalid catalog URL source: ${value}`);
  }
  return value;
}

function normalizeListInput(rawInput) {
  return String(rawInput || "")
    .split(/[;,]/)
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

function resolveOutputPath(rawPath) {
  if (!rawPath || !String(rawPath).trim()) return DEFAULT_OUTPUT;
  return resolve(process.cwd(), String(rawPath).trim());
}

function printUsage() {
  process.stdout.write(`Usage:
node tools/run-global-client-discovery.mjs [options]

This command refreshes MCP registry catalog source(s) and runs either:
1) a global onboarding runbook (default), or
2) a full/global verification run (--execute).

Options:
  --output <path>             MCP catalog output path for built-in fallback sync.
                             default: .tmp/client-runtime-catalog.mcp-registry.json
  --registry-url <url>        MCP registry endpoint.
  --version <version>         Registry version (default: latest).
  --limit <n>                 Page size per request (default: 100).
  --max <n>                   Stop after n entries; set 0 for no cap (default: 10000).
  --search <term>             Registry search term filter.
  --skip-sync                 Skip registry sync and reuse existing catalog output file(s).
  --sync-only                 Only sync registry sources to catalog output(s) and stop.
  --runbook-output <path>     Runbook output file (default: .tmp/<stamp>-global-client-runbook.md).
  --runbook-format <md|json>  Runbook format (default: md).
  --execute                   Execute full verification instead of runbook.
  --serial                    Execute each client serially (recommended for large scopes).
  --client <id>[,<id>...]     Pass client selector(s) into verification.
                             Example: --client mainstream,global,tag:mainstream,protocol:mcp
                             Alias: --clients
                             Default: all known clients.
  --client-catalog <path>     Extra catalog path(s) to merge (repeatable, comma/semicolon separated).
  --client-catalog-dir <path> Extra catalog directory path(s) to merge (repeatable).
  --client-catalog-url <url>  Extra remote catalog URL(s) to merge (repeatable, semi-colon/comma accepted).
  --source-manifest <path>    JSON source manifest for federated catalogs (repeatable, default: docs/client-runtime-catalog-sources-worldwide.json when present, then fallback to docs/client-runtime-catalog-sources.json).
  --source-manifest-dir <path> Directory containing JSON source manifests (repeatable, recursive scan).
                             default: docs/source-manifests.d when present.
  --require-manual-evidence    Fail on unverified manual clients.
  --manual-evidence <path>    Manual evidence file for strict execution.
  --help, -h                  Show this help text.

Examples:
  node tools/run-global-client-discovery.mjs
  node tools/run-global-client-discovery.mjs --source-manifest docs/client-runtime-catalog-sources-worldwide.json --client tag:mainstream --execute --serial
  node tools/run-global-client-discovery.mjs --max 10000 --execute --serial --require-manual-evidence --manual-evidence docs/client-runtime-evidence.example.json
  node tools/run-global-client-discovery.mjs --search "Claude" --skip-sync --runbook
  node tools/run-global-client-discovery.mjs --source-manifest docs/client-runtime-catalog-sources.example.json --execute --serial
  node tools/run-global-client-discovery.mjs --source-manifest docs/client-runtime-catalog-sources.example.json --sync-only
`);
}

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  printUsage();
  process.exit(0);
}

const outputPath = resolveOutputPath(getArgValue(argv, "output"));
const registryUrl = getArgValue(argv, "registry-url");
const version = getArgValue(argv, "version") || "latest";
const limit = parsePositiveInt(getArgValue(argv, "limit"), DEFAULT_LIMIT);
const hasExplicitMax = hasFlagWithAssignment(argv, "max");
const max = parseMaxInt(getArgValue(argv, "max"), DEFAULT_MAX);
const search = getArgValue(argv, "search");
const execute = hasFlag(argv, "execute");
const serial = hasFlag(argv, "serial");
const runbookFormat = getArgValue(argv, "runbook-format") || "md";
const runbookOutput = getArgValue(argv, "runbook-output")
  || resolve(repoRoot, ".tmp", `${toSafeStamp()}-global-client-runbook.${runbookFormat}`);
const manualEvidence = getArgValue(argv, "manual-evidence");
const requireManualEvidence = hasFlag(argv, "require-manual-evidence");
const syncOnly = hasFlag(argv, "sync-only");
const skipSync = hasFlag(argv, "skip-sync");
const clientSelectors = [
  ...getArgValues(argv, "client"),
  ...getArgValues(argv, "clients"),
].flatMap((item) => item ? normalizeListInput(item) : [])
  .map((item) => item.trim())
  .filter(Boolean);
const clientCatalogPaths = getArgValues(argv, "client-catalog");
const clientCatalogDirs = getArgValues(argv, "client-catalog-dir");
const clientCatalogUrls = getArgValues(argv, "client-catalog-url");
const sourceManifestValues = getArgValues(argv, "source-manifest").flatMap((item) => normalizeListInput(item));
const sourceManifestPaths = (() => {
  const values = [...sourceManifestValues];
  const envManifest = process.env.CLIENT_RUNTIME_SOURCE_MANIFEST;
  if (envManifest) {
    values.push(...normalizeListInput(envManifest));
  }
  if (values.length === 0) {
    if (existsSync(DEFAULT_SOURCE_MANIFEST)) {
      values.push(DEFAULT_SOURCE_MANIFEST);
    } else if (existsSync(FALLBACK_SOURCE_MANIFEST)) {
      values.push(FALLBACK_SOURCE_MANIFEST);
    }
  }
  return [...new Set(values.map((value) => resolve(repoRoot, String(value).trim())))];
})();
const sourceManifestDirValues = (() => {
  const values = getArgValues(argv, "source-manifest-dir").flatMap((item) => normalizeListInput(item));
  const envManifestDir = process.env.CLIENT_RUNTIME_SOURCE_MANIFEST_DIR;
  if (envManifestDir) {
    values.push(...normalizeListInput(envManifestDir));
  }
  if (values.length === 0 && existsSync(DEFAULT_SOURCE_MANIFEST_DIR)) {
    values.push(DEFAULT_SOURCE_MANIFEST_DIR);
  }
  return [...new Set(values.map((value) => resolve(repoRoot, String(value).trim())))];
})();

function resolveManifestFiles(manifestDir) {
  const absolutePath = resolve(repoRoot, String(manifestDir).trim());
  if (!existsSync(absolutePath)) {
    throw new Error(`Source manifest directory not found: ${absolutePath}`);
  }
  const stat = statSync(absolutePath);
  if (!stat.isDirectory()) {
    return [absolutePath];
  }
  const entries = readdirSync(absolutePath, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const candidate = resolve(absolutePath, entry.name);
    if (entry.isDirectory()) {
      result.push(...resolveManifestFiles(candidate));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      result.push(candidate);
    }
  }
  return result;
}

let sourceManifestSources = [];
for (const sourceManifestPath of sourceManifestPaths) {
  sourceManifestSources = sourceManifestSources.concat(loadSourceManifest(sourceManifestPath));
}
for (const sourceManifestDir of sourceManifestDirValues) {
  const manifestPaths = resolveManifestFiles(sourceManifestDir);
  for (const manifestPath of manifestPaths) {
    const loadedSources = tryLoadSourceManifest(manifestPath);
    if (loadedSources.length === 0 && manifestPath) {
      const parsedSource = [];
      try {
        const rawSource = readFileSync(manifestPath, "utf8");
        const parsed = JSON.parse(rawSource);
        const sourceList = Array.isArray(parsed) ? parsed : parsed?.sources;
        if (!Array.isArray(sourceList)) {
          process.stdout.write(`Skipping non-manifest source file: ${manifestPath}\n`);
          continue;
        }
        parsedSource.push(...sourceList);
      } catch (error) {
        process.stdout.write(`Skipping invalid JSON source file: ${manifestPath}\n`);
        continue;
      }
      if (parsedSource.length === 0) {
        process.stdout.write(`Skipping empty source manifest file: ${manifestPath}\n`);
      }
      continue;
    }
    sourceManifestSources = sourceManifestSources.concat(loadedSources);
  }
}
const manifestMcpSources = sourceManifestSources.filter((source) => source.type === "mcp-registry");
const hasManifestMcpSource = manifestMcpSources.length > 0;
const manifestCatalogSources = sourceManifestSources.filter((source) => source.type === "catalog");
const manifestCatalogDirSources = sourceManifestSources.filter((source) => source.type === "catalog-dir");
const manifestCatalogUrlSources = sourceManifestSources.filter((source) => source.type === "catalog-url");

const syncCatalogPaths = new Set();

function pushSourcesFromManifest(set, sourceType, mapper) {
  for (const { source } of sourceType) {
    set.add(mapper(source));
  }
}

mkdirSync(dirname(outputPath), { recursive: true });

try {
  if (!hasManifestMcpSource) {
    if (skipSync && !existsSync(outputPath)) {
      throw new Error(`No catalog file found at --output path: ${outputPath}`);
    }
    if (!skipSync) {
      const syncArgs = ["--output", outputPath, "--version", version, "--limit", String(limit), "--max", String(max)];
      if (registryUrl) syncArgs.push("--registry-url", registryUrl);
      if (search) syncArgs.push("--search", search);
      runNode(syncScript, syncArgs);
    }
    syncCatalogPaths.add(outputPath);
  }

  for (const { source, id } of manifestMcpSources) {
    const sourceOutput = source.output
      ? resolve(repoRoot, String(source.output).trim())
      : resolve(repoRoot, ".tmp", `client-runtime-catalog.mcp-registry.${safeSourceId(id)}.json`);
    const sourceRegistryUrl = source.registryUrl || source.url || registryUrl;
    const sourceVersion = source.version || version;
    const sourceLimit = parsePositiveInt(source.limit, limit);
    const sourceMax = hasExplicitMax ? max : parseMaxInt(source.max, max);
    const sourceSearch = source.search || search || null;
    mkdirSync(dirname(sourceOutput), { recursive: true });
    if (skipSync && !existsSync(sourceOutput)) {
      throw new Error(`No MCP catalog file found for manifest source ${id}: ${sourceOutput}`);
    }
    if (!skipSync) {
      const syncArgs = ["--output", sourceOutput, "--version", String(sourceVersion), "--limit", String(sourceLimit), "--max", String(sourceMax)];
      if (sourceRegistryUrl) syncArgs.push("--registry-url", sourceRegistryUrl);
      if (sourceSearch) syncArgs.push("--search", sourceSearch);
      runNode(syncScript, syncArgs);
    }
    syncCatalogPaths.add(sourceOutput);
  }

  if (syncOnly) {
    if (hasManifestMcpSource && syncCatalogPaths.size > 0) {
      process.stdout.write(`MCP registry catalogs synced to:\n${[...syncCatalogPaths].map((catalog) => `- ${catalog}`).join("\n")}\n`);
    } else if (!hasManifestMcpSource) {
      process.stdout.write(`MCP registry catalog synced to: ${outputPath}\n`);
    } else {
      process.stdout.write("No registry source outputs configured for sync.\n");
    }
    process.exit(0);
  }

  const verifyArgs = [];
  if (clientSelectors.length > 0) {
    for (const selector of clientSelectors) {
      verifyArgs.push("--client", selector);
    }
  } else {
    verifyArgs.push("--client", "global");
  }

  const mergedCatalogPaths = new Set(
    clientCatalogPaths
      .flatMap(normalizeListInput)
      .map((catalogPath) => normalizeCatalogPath(catalogPath)),
  );
  const mergedCatalogDirs = new Set(
    clientCatalogDirs
      .flatMap(normalizeListInput)
      .map((catalogDir) => normalizeCatalogPath(catalogDir)),
  );
  const mergedCatalogUrls = new Set(
    clientCatalogUrls
      .flatMap(normalizeListInput)
      .map((catalogUrl) => normalizeCatalogUrl(catalogUrl)),
  );

  pushSourcesFromManifest(mergedCatalogPaths, manifestCatalogSources, (source) =>
    normalizeCatalogPath(source.path || source.file || source.catalogPath));
  pushSourcesFromManifest(mergedCatalogDirs, manifestCatalogDirSources, (source) =>
    normalizeCatalogPath(source.path || source.dir || source.catalogDir || source.directory));
  pushSourcesFromManifest(mergedCatalogUrls, manifestCatalogUrlSources, (source) =>
    normalizeCatalogUrl(source.url || source.endpoint || source.catalogUrl));

  if (!hasManifestMcpSource) {
    verifyArgs.push("--client-catalog", outputPath);
  }
  for (const catalogPath of syncCatalogPaths) {
    verifyArgs.push("--client-catalog", catalogPath);
  }
  for (const catalogPath of mergedCatalogPaths) {
    verifyArgs.push("--client-catalog", catalogPath);
  }
  mergedCatalogDirs.add(resolve(repoRoot, "docs", "client-runtime-catalog.d"));
  for (const catalogDir of mergedCatalogDirs) {
    verifyArgs.push("--client-catalog-dir", catalogDir);
  }
  for (const catalogUrl of mergedCatalogUrls) {
    verifyArgs.push("--client-catalog-url", catalogUrl);
  }

  if (execute) {
    if (requireManualEvidence) verifyArgs.push("--require-manual-evidence");
    if (manualEvidence) verifyArgs.push("--manual-evidence", manualEvidence);
    const script = serial ? verifySerialScript : verifyScript;
    runNode(script, verifyArgs);
  } else {
    verifyArgs.push("--runbook", "--runbook-format", runbookFormat, "--runbook-output", runbookOutput);
    runNode(verifyScript, verifyArgs);
    process.stdout.write(`Global onboarding runbook generated: ${runbookOutput}\n`);
  }

  process.exit(0);
} catch (error) {
  process.stderr.write(`Global discovery failed: ${error?.message ?? error}\n`);
  process.exit(1);
}
