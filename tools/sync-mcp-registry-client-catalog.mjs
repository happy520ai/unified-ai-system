#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DEFAULT_REGISTRY_URL = "https://registry.modelcontextprotocol.io/v0.1/servers";
const DEFAULT_OUTPUT_PATH = resolve(process.cwd(), ".tmp", "client-runtime-catalog.mcp-registry.json");

function getArgValue(argv, key) {
  const exact = `--${key}=`;
  const token = argv.find((item) => item.startsWith(exact));
  if (token) {
    return token.substring(exact.length);
  }
  const keyIndex = argv.indexOf(`--${key}`);
  if (keyIndex >= 0) {
    const value = argv[keyIndex + 1];
    if (!value || value.startsWith("--")) {
      return null;
    }
    return value;
  }
  return null;
}

function parsePositiveInteger(rawValue, fallback) {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseNumber(rawValue, fallback) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  if (parsed === 0) {
    return Number.POSITIVE_INFINITY;
  }
  return parsed;
}

function sanitizeCatalogId(rawId, fallbackPrefix, used) {
  const base = String(rawId || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-+)|(-+$)/g, "");
  const normalizedBase = base || fallbackPrefix;
  let candidate = `mcp-registry-${normalizedBase}`;
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }

  let index = 2;
  while (true) {
    const suffixed = `${candidate}-${index}`;
    if (!used.has(suffixed)) {
      used.add(suffixed);
      return suffixed;
    }
    index += 1;
  }
}

function toIdSet(rawId, used) {
  const candidate = sanitizeCatalogId(rawId, "entry", used);
  return candidate;
}

function normalizeTransport(remoteEntries) {
  const transports = new Set();
  for (const remote of remoteEntries) {
    if (typeof remote?.type === "string" && remote.type.trim()) {
      transports.add(remote.type.trim());
    }
  }
  if (!transports.size) {
    return ["streamable-http"];
  }
  return [...transports];
}

function normalizePackageEntry(rawPackage, transportSet) {
  if (!rawPackage || typeof rawPackage !== "object") {
    return null;
  }

  const registryType = typeof rawPackage.registryType === "string"
    ? rawPackage.registryType.trim().toLowerCase()
    : "";
  if (!registryType) return null;

  const identifier = typeof rawPackage.identifier === "string" ? rawPackage.identifier.trim() : "";
  if (!identifier) return null;

  const version = typeof rawPackage.version === "string" ? rawPackage.version.trim() : "";
  const transportType = rawPackage.transport?.type
    ? String(rawPackage.transport.type).trim()
    : "";
  if (transportType) {
    transportSet.add(transportType);
  }

  const runtimeHint = typeof rawPackage.runtimeHint === "string"
    ? rawPackage.runtimeHint.trim()
    : registryType === "npm"
      ? "npx"
      : "";
  const command = runtimeHint && runtimeHint.length
    ? `${runtimeHint} ${identifier}${version ? `@${version}` : ""}`.trim()
    : `Install and run MCP package: ${identifier}${version ? `@${version}` : ""}`;

  const requiredHeaders = [];
  const envVars = Array.isArray(rawPackage.environmentVariables)
    ? rawPackage.environmentVariables
    : [];
  for (const variable of envVars) {
    if (
      variable?.name
      && typeof variable.isRequired === "boolean"
      && variable.isRequired
    ) {
      requiredHeaders.push(String(variable.name).trim());
    }
  }

  return { transportType, command, requiredHeaders, identifier, version, registryType };
}

function normalizeEntryTags(server, transportList, needsAuth, sourceMeta) {
  const tags = new Set(["mcp", "agent-host", "global", "protocol:mcp"]);
  const protocolTag = (sourceMeta?.protocol || "").toLowerCase().trim();
  if (protocolTag) {
    tags.add(`protocol:${protocolTag}`);
  }
  if (server?.title && server.title.includes("MCP")) {
    tags.add("mcp-server");
  }
  if (needsAuth) {
    tags.add("auth:required");
  }
  for (const transport of transportList) {
    tags.add(`transport:${String(transport).toLowerCase()}`);
  }
  if (server?.title) {
    tags.add("registry-source");
  }
  const source = server?.name ? server.name.split("/")[0] : "registry";
  if (source) {
    tags.add(`source:${source}`);
  }
  return [...tags].sort();
}

function buildCatalogEntry(server, usedIds, sourceMeta) {
  if (!server || typeof server !== "object") {
    return null;
  }
  const name = typeof server?.name === "string" ? server.name.trim() : "";
  if (!name) return null;

  const remotes = Array.isArray(server?.remotes) ? server.remotes : [];
  const packages = Array.isArray(server?.packages) ? server.packages : [];
  const transportSet = new Set();
  const packageCommandHints = [];

  const urls = [];
  const headers = [];
  for (const remote of remotes) {
    if (typeof remote?.url === "string") {
      urls.push(remote.url.trim());
    }
    if (Array.isArray(remote?.headers)) {
      for (const header of remote.headers) {
        if (header?.name && typeof header.isRequired === "boolean" && header.isRequired) {
          headers.push(String(header.name).trim());
        }
      }
    }
  }
  if (packages.length) {
    for (const rawPackage of packages) {
      const packageMeta = normalizePackageEntry(rawPackage, transportSet);
      if (!packageMeta) continue;
      if (packageMeta.command) packageCommandHints.push(packageMeta.command);
      for (const headerName of packageMeta.requiredHeaders) {
        headers.push(headerName);
      }
    }
  }
  for (const remote of remotes) {
    if (remote?.type && typeof remote.type === "string") {
      transportSet.add(remote.type.trim());
    }
  }
  if (!transportSet.size) {
    if (packages.length) {
      transportSet.add("stdio");
    } else {
      transportSet.add("streamable-http");
    }
  }
  const transportList = [...transportSet];

  const id = toIdSet(name, usedIds);
  const needsAuth = headers.length > 0;
  const publicName = typeof server?.title === "string" && server.title.trim()
    ? `${server.title.trim()} (${name})`
    : name;
  const hasExplicitEndpoint = urls.length > 0;
  const transportText = transportList.join(" + ");
  const firstUrl = urls[0];
  const commandHint = firstUrl
    ? `Use an MCP client to connect: ${firstUrl}`
    : packageCommandHints[0] || "Run MCP stdio client using package metadata";
  const transportLabel = normalizeTransport(transportList.map((transport) => ({ type: transport })));
  const notes = [
    `MCP registry source entry: ${name}.`,
    `Transport profile: ${transportText}`,
  ];
  if (firstUrl) {
    notes.push(`Endpoint: ${firstUrl}`);
  }
  if (packageCommandHints[0]) {
    notes.push(`Package command hint: ${packageCommandHints[0]}`);
  }
  if (needsAuth) {
    notes.push("Registry payload indicates required authentication headers.");
  }
  if (server?.description) {
    notes.push(`Description: ${server.description}`);
  }
  const evidenceTarget = hasExplicitEndpoint
    ? "this MCP endpoint"
    : "this MCP package/endpoint";
  const evidenceNotes = `Run a minimal client flow against ${evidenceTarget} and keep command/output proving tool discovery + call readiness. ${notes.join(" ")}`;

  return {
    id,
    name: publicName,
    protocol: "MCP",
    transport: `MCP ${transportText || transportLabel.join(" + ")}`,
    mode: "manual",
    tags: normalizeEntryTags(server, transportList, needsAuth, sourceMeta),
    command: commandHint,
    evidenceNotes,
  };
}

function printUsage() {
  process.stdout.write(`Usage:
node tools/sync-mcp-registry-client-catalog.mjs [options]

Options:
  --registry-url <url>    MCP registry endpoint (default: ${DEFAULT_REGISTRY_URL})
  --version <value>       Registry version filter (default: latest)
  --limit <n>            Page size (default: 100)
  --max <n>              Stop after n entries; set 0 for no cap (default: 2000)
  --search <term>        Optional server name filter
  --output <path>        Output file path (default: .tmp/client-runtime-catalog.mcp-registry.json)
  --help, -h             Show this help message.

This command materializes a catalog JSON file in the format used by verification tools.
Use it with:
  pnpm exec node tools/verify-client-runtimes.mjs --client-catalog <output> --client global\n`);
}

function getRegistryServersPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (!Array.isArray(payload.servers)) return null;
  return payload;
}

function getEndpoint(value) {
  try {
    return new URL(String(value || "").trim());
  } catch (error) {
    throw new Error(`Invalid MCP registry URL: ${value}`);
  }
}

async function fetchPage(baseUrl, query) {
  const pageUrl = new URL(baseUrl);
  pageUrl.searchParams.set("version", query.version);
  pageUrl.searchParams.set("limit", String(query.limit));
  if (query.search) pageUrl.searchParams.set("search", query.search);
  if (query.cursor) pageUrl.searchParams.set("cursor", query.cursor);

  const response = await fetch(pageUrl, {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${pageUrl}: ${response.status} ${response.statusText}`,
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(`Invalid MCP registry response: ${error?.message ?? error}`);
  }
  return payload;
}

async function buildCatalog(options) {
  const maxEntries = options.max;
  const endpoint = getEndpoint(options.registryUrl);
  const query = {
    version: options.version,
    limit: options.limit,
    search: options.search || null,
    cursor: null,
  };

  const seenIds = new Set();
  const entries = {};
  const seenCursors = new Set();
  let pageCount = 0;
  let totalServers = 0;

  for (;;) {
    const payload = getRegistryServersPayload(await fetchPage(endpoint, query));
    if (!payload) {
      throw new Error("Registry API payload is missing \"servers\".");
    }

    const servers = payload.servers || [];
    pageCount += 1;
    for (const row of servers) {
      if (typeof row !== "object") {
        continue;
      }
      const sourceServer = row && typeof row === "object" && row.server && typeof row.server === "object"
        ? row.server
        : row;
      const candidate = buildCatalogEntry(sourceServer, seenIds, {
        protocol: row.protocol || sourceServer?.protocol,
      });
      if (!candidate) continue;
      entries[candidate.id] = candidate;
      totalServers += 1;
    }

  if (typeof maxEntries === "number" && Number.isFinite(maxEntries) && totalServers >= maxEntries) {
    break;
  }

    const nextCursor = payload?.metadata?.nextCursor;
    if (!nextCursor) break;
    if (seenCursors.has(nextCursor)) break;
    seenCursors.add(nextCursor);
    query.cursor = nextCursor;
  }

  return { entries, pageCount, totalServers };
}

function sortEntries(entries) {
  return Object.entries(entries)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, entry]) => entry);
}

function getOutputPath(rawPath) {
  if (!rawPath || !String(rawPath).trim()) {
    return DEFAULT_OUTPUT_PATH;
  }
  return resolve(process.cwd(), String(rawPath).trim());
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return;
  }

  const rawRegistryUrl = getArgValue(argv, "registry-url")
    || process.env.UNIFIED_AI_MCP_REGISTRY_URL
    || DEFAULT_REGISTRY_URL;
  const outputArgument = getArgValue(argv, "output");
  const outputPath = getOutputPath(outputArgument);
  const limit = parsePositiveInteger(getArgValue(argv, "limit"), 100);
  const max = parseNumber(getArgValue(argv, "max"), 2000);
  const version = getArgValue(argv, "version") || "latest";
  const search = getArgValue(argv, "search");

  const { entries, pageCount, totalServers } = await buildCatalog({
    registryUrl: rawRegistryUrl,
    limit,
    max,
    version,
    search,
  });

  const sortedEntries = sortEntries(entries);
  const payload = {
    generatedAt: new Date().toISOString(),
    source: "mcp-registry-sync",
    sourceUrl: rawRegistryUrl,
    version,
    search: search || null,
    total: totalServers,
    clients: sortedEntries,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  process.stdout.write(`MCP registry sync complete.\n`);
  process.stdout.write(`Wrote ${totalServers} entries to: ${outputPath}\n`);
  process.stdout.write(`Pages queried: ${pageCount}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.message ?? error}\n`);
  process.exit(1);
});
