#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadClientRuntimeCatalog } from "./client-runtime-registry.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const verifyScriptPath = resolve(repoRoot, "tools", "verify-client-runtimes.mjs");

function getArgValues(argv, key) {
  const keyWithEquals = `${key}=`;
  const values = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === key) {
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

function splitSelectorValue(value) {
  return String(value ?? "")
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getArgValue(argv, key) {
  const keyWithEquals = `${key}=`;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === key) {
      const value = argv[index + 1];
      if (value && !value.startsWith("--")) return value;
      return null;
    }
    if (arg.startsWith(keyWithEquals)) {
      return arg.substring(keyWithEquals.length);
    }
  }
  return null;
}

function parseSummaryOutputArgs(argv) {
  const summaryPath = getArgValue(argv, "--client-report-output");
  const summaryFormat = getArgValue(argv, "--client-report-format");
  const normalizedFormat = (summaryFormat || "md").toLowerCase() === "json" ? "json" : "md";
  return {
    summaryPath,
    summaryFormat: normalizedFormat,
  };
}

function normalizeEvidencePrefix(rawValue) {
  const candidate = String(rawValue || "").trim().toLowerCase();
  if (!candidate) return "";
  const slug = candidate
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "";
}

function extractEvidencePath(outputText) {
  const match = String(outputText || "").match(
    /Saved automated client certification evidence to:\s*\r?\n([^\r\n]+)\r?\n([^\r\n]+)/,
  );
  if (match) {
    const firstMatch = match[1]?.trim();
    if (firstMatch) return firstMatch;
  }
  const fallbackMatch = String(outputText || "").match(/([^\s\r\n]+client-runtimes\.json)/);
  if (fallbackMatch) return fallbackMatch[1];
  return null;
}

function resolveClientStatusFromEvidence(responseCode, summary, evidenceRecord) {
  if (responseCode !== 0) return "failed";
  if (!summary || typeof summary !== "object" || !evidenceRecord) return "failed";
  if ((summary.failed || 0) > 0) return "failed";
  if (evidenceRecord.status === "failed" || evidenceRecord.status === "manual-failed") {
    return "failed";
  }
  if ((summary.manual || 0) > (summary.manualVerified || 0)) return "manual";
  if ((summary.manual || 0) > 0) return "manual";
  return (summary.verified || 0) > 0 && evidenceRecord.status === "verified"
    ? "verified"
    : "failed";
}

function renderSummaryMarkdown(serialSummary, clientReports) {
  const failedClients = clientReports
    .filter((item) => item.status === "failed")
    .map((item) => item.clientId);
  return [
    "# Client Runtime Serial Certification Summary",
    "",
    `Generated at: ${serialSummary.generatedAt}`,
    `Total: ${serialSummary.totalClients}`,
    `Verified: ${serialSummary.verified}`,
    `Manual: ${serialSummary.manual}`,
    `Failed: ${serialSummary.failed}`,
    "",
    ...clientReports.map((item) => {
      const checks = item.failedChecks?.length
        ? `; failed checks: ${item.failedChecks.join(", ")}`
        : "";
      const command = item.command ? `; command: \`${item.command}\`` : "";
      const evidence = item.evidencePath ? `; evidence: ${item.evidencePath}` : "";
      return `- ${item.clientId}: ${item.status}${command}${evidence}${checks}`;
    }),
    "",
    failedClients.length > 0
      ? `Failed clients: ${failedClients.join(", ")}`
      : serialSummary.manual > 0
        ? "Automated clients completed; manual evidence remains pending."
        : "All clients completed successfully.",
    "",
  ].join("\n");
}

function toCompactTimestamp(date = new Date()) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function safeJsonOrNull(rawEvidencePath) {
  if (!rawEvidencePath || !existsSync(rawEvidencePath)) return null;
  try {
    return JSON.parse(readFileSync(rawEvidencePath, "utf8"));
  } catch {
    return null;
  }
}

function normalizeManualEvidenceStatus(value) {
  const normalized = String(value || "manual").trim().toLowerCase();
  if (["verified", "pass", "passed"].includes(normalized)) return "verified";
  if (["failed", "fail", "rejected", "blocked", "manual-failed"].includes(normalized)) {
    return "manual-failed";
  }
  return "manual";
}

function loadManualEvidenceMap(rawPath) {
  if (!rawPath) return new Map();
  const evidencePath = resolve(process.cwd(), rawPath);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(evidencePath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to load manual evidence file ${evidencePath}: ${error?.message ?? error}`);
  }

  const entries = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray(parsed.evidence)
      ? parsed.evidence
      : parsed && typeof parsed === "object" && typeof parsed.clientId === "string"
        ? [parsed]
        : parsed && typeof parsed === "object"
          ? Object.entries(parsed).map(([clientId, entry]) => ({
            ...(entry && typeof entry === "object" ? entry : {}),
            clientId: entry?.clientId || clientId,
          }))
          : [];

  return new Map(
    entries
      .filter((entry) => entry && typeof entry.clientId === "string")
      .map((entry) => [entry.clientId, entry]),
  );
}

function resolveEvidencePath(rawPath) {
  if (!rawPath || typeof rawPath !== "string") return null;
  const candidate = rawPath.trim();
  return candidate ? resolve(process.cwd(), candidate) : null;
}

function collectFailedChecks(checks) {
  if (!checks || typeof checks !== "object" || Array.isArray(checks)) return [];
  return Object.entries(checks)
    .filter(([, value]) => value === false)
    .map(([key]) => key);
}

function buildPendingManualReport(definition, evidence, requireManualEvidence) {
  const evidencePath = resolveEvidencePath(
    evidence?.evidencePath || evidence?.evidence || evidence?.outputPath,
  );
  const evidenceStatus = normalizeManualEvidenceStatus(evidence?.status);
  const failedChecks = collectFailedChecks(evidence?.checks);
  const hasReadableEvidence = Boolean(evidencePath && existsSync(evidencePath));
  const hasCommand = Boolean(evidence?.command && evidence.command !== "n/a");
  let status = evidenceStatus;
  let notes = evidence?.notes || definition.evidenceNotes || "Manual evidence report required.";

  if (evidenceStatus === "verified" && !hasReadableEvidence) {
    status = "manual-failed";
    notes = `${notes} A readable evidencePath is required for verified status.`;
  } else if (evidenceStatus === "verified" && !hasCommand) {
    status = "manual-failed";
    notes = `${notes} A non-placeholder command is required for verified status.`;
  } else if (failedChecks.length > 0) {
    status = "manual-failed";
    notes = `${notes} Failed checks: ${failedChecks.join(", ")}.`;
  } else if (!evidence) {
    status = "manual";
  }

  const reportStatus = status === "verified"
    ? "verified"
    : requireManualEvidence || status === "manual-failed"
      ? "failed"
      : "manual";

  return {
    clientId: definition.id,
    status: reportStatus,
    evidencePath,
    summary: {
      verified: reportStatus === "verified" ? 1 : 0,
      manual: 1,
      manualVerified: reportStatus === "verified" ? 1 : 0,
      manualPending: reportStatus === "verified" ? 0 : 1,
      failed: reportStatus === "failed" ? 1 : 0,
    },
    command: evidence?.command || definition.command || "n/a",
    failedChecks,
    outputTail: notes,
    runtimeExecuted: false,
    evidenceSource: evidence ? "manual-evidence" : "catalog-pending",
  };
}

function extractClientRecordFromEvidence(rawEvidence, clientId, definition = null) {
  if (!rawEvidence || typeof rawEvidence !== "object") {
    return null;
  }
  const entries = [
    ...(Array.isArray(rawEvidence.automated) ? rawEvidence.automated : []),
    ...(Array.isArray(rawEvidence.manual) ? rawEvidence.manual : []),
  ];
  return entries.find((entry) =>
    entry?.id === clientId
    || entry?.name === definition?.name
    || entry?.name === clientId,
  ) || null;
}

function summarizeFailedChecks(rawChecks) {
  if (!rawChecks || typeof rawChecks !== "object") return [];
  return Object.entries(rawChecks)
    .filter(([, value]) => value === false)
    .map(([key]) => key);
}

function removeClientSelectorArgs(argv) {
  const out = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (
      arg === "--client"
      || arg === "--clients"
      || arg === "--client-report-output"
      || arg === "--client-report-format"
      || arg === "--evidence-dir"
      || arg === "--evidence-prefix"
      || arg.startsWith("--client=")
      || arg.startsWith("--clients=")
      || arg.startsWith("--evidence-dir=")
      || arg.startsWith("--evidence-prefix=")
      || arg.startsWith("--client-report-output=")
      || arg.startsWith("--client-report-format=")
    ) {
      if (
        (arg === "--client" || arg === "--clients" || arg === "--evidence-dir" || arg === "--evidence-prefix")
        && argv[index + 1]
        && !argv[index + 1].startsWith("--")
      ) {
        index += 1;
      }
      continue;
    }
    out.push(arg);
  }
  return out;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePattern(pattern) {
  const candidate = String(pattern ?? "").trim().toLowerCase();
  if (!candidate) return null;
  if (!candidate.includes("*")) {
    return (value) => String(value ?? "").toLowerCase() === candidate;
  }
  const regexSource = candidate
    .split("*")
    .map(escapeRegex)
    .join(".*");
  const regex = new RegExp(`^${regexSource}$`, "i");
  return (value) => regex.test(String(value ?? ""));
}

function parseContainsPattern(pattern) {
  const candidate = String(pattern ?? "").trim().toLowerCase();
  if (!candidate) return null;
  if (!candidate.includes("*")) {
    return (value) => String(value ?? "").toLowerCase().includes(candidate);
  }
  const regexSource = candidate
    .split("*")
    .map(escapeRegex)
    .join(".*");
  const regex = new RegExp(regexSource, "i");
  return (value) => regex.test(String(value ?? ""));
}

function matchesPattern(valueList, pattern) {
  const matcher = parsePattern(pattern);
  if (!matcher) return false;
  return Array.isArray(valueList) && valueList.some((value) => matcher(value));
}

function resolveClientIdsForSelector(catalog, selector, result) {
  if (!selector || typeof selector !== "string") return;
  const token = selector.trim();
  if (!token) return;

  const lowered = token.toLowerCase();
  if (lowered === "all" || lowered === "global") {
    catalog.forEach((client) => {
      if (client?.id) result.add(client.id);
    });
    return;
  }

  if (lowered === "mainstream") {
    catalog.forEach((client) => {
      if (client.tags?.includes("mainstream")) result.add(client.id);
    });
    return;
  }

  if (lowered === "automated") {
    catalog.forEach((client) => {
      if (client.mode === "automated") result.add(client.id);
    });
    return;
  }

  if (lowered === "manual") {
    catalog.forEach((client) => {
      if (client.mode === "manual") result.add(client.id);
    });
    return;
  }

  if (
    lowered === "openai" ||
    lowered === "mcp" ||
    lowered === "a2a" ||
    lowered === "http" ||
    lowered === "shared"
  ) {
    catalog.forEach((client) => {
      if (client.tags?.includes(lowered)) result.add(client.id);
    });
    return;
  }

  if (lowered.startsWith("protocol:")) {
    const protocolPattern = token.substring("protocol:".length);
    const matcher = parsePattern(protocolPattern);
    if (!matcher) return;
    catalog.forEach((client) => {
      if (matcher(client.protocol)) result.add(client.id);
    });
    return;
  }

  if (lowered.startsWith("tag:")) {
    const tagPattern = token.substring("tag:".length);
    if (!tagPattern) return;
    catalog.forEach((client) => {
      if (matchesPattern(client.tags ?? [], tagPattern)) result.add(client.id);
    });
    return;
  }

  if (lowered.startsWith("transport:")) {
    const transportPattern = token.substring("transport:".length);
    const matcher = parseContainsPattern(transportPattern);
    if (!matcher) return;
    catalog.forEach((client) => {
      if (matcher(client.transport)) result.add(client.id);
    });
    return;
  }

  if (lowered.startsWith("name:")) {
    const namePattern = token.substring("name:".length);
    const matcher = parseContainsPattern(namePattern);
    if (!matcher) return;
    catalog.forEach((client) => {
      if (matcher(client.name)) result.add(client.id);
    });
    return;
  }

  const idMatcher = parsePattern(lowered);
  if (!idMatcher) return;
  catalog.forEach((client) => {
    if (idMatcher(client.id)) result.add(client.id);
  });
}

function resolveClientSelection(catalog, requestedClientSelectors) {
  const selected = new Set();

  const selectors = requestedClientSelectors.flatMap((value) => splitSelectorValue(value));
  if (selectors.length === 0) {
    catalog
      .filter((client) => client.tags?.includes("mainstream"))
      .forEach((client) => selected.add(client.id));
    return [...selected].sort();
  }

  selectors.forEach((selector) => resolveClientIdsForSelector(catalog, selector, selected));

  return [...selected].sort();
}

function printUsage() {
  process.stdout.write(`Usage:
node tools/verify-client-runtimes-serial.mjs [options]

Options:
  --client <selector>[,<selector>...]     Select one or more clients; accepts tags/protocol/transport/name/wildcard.
                                         Examples: mainstream, global, protocol:openai*, tag:mainstream, transport:v1*, name:openai, openai-*, tag:language:python.
  --clients <selector>[,<selector>...]    Alias for --client.
  --client-catalog <file>                Extend catalog from one or more local JSON catalogs.
  --client-catalog-dir <dir>             Extend catalog from one or more catalog directories.
  --client-catalog-url <url>              Extend catalog from one or more remote JSON catalogs.
                                         Supports repeated flag and env vars:
                                         CLIENT_RUNTIME_CATALOG_URL / CLIENT_RUNTIME_CATALOG_URLS.
  --manual-evidence <file>               JSON manual evidence map (shared with inner verifier).
  --require-manual-evidence               Fail if any selected manual client lacks verified manual evidence.
  --runbook                              Emit runbook (per client) instead of executing runtime checks.
  --runbook-format <md|json>             Runbook format (default: md).
  --runbook-output <path>                Write runbook output for the current client.
  --evidence-template <path>             Generate evidence template and exit.
  --client-report-output <path>           Write serial certification summary here.
  --client-report-format <md|json>        Summary format (default: md).
  --evidence-dir <path>                  Pass through to verifier for controlled evidence output.
  --evidence-prefix <text>                Prefix verifier output file names.
  --help, -h                             Show this help.

This command runs one selected client per invocation and streams each verifier
result in sequence (real runtime report path by default).

  'client-catalog', 'client-catalog-dir', and 'client-catalog-url' are optional
  and support the same merge semantics as 'tools/verify-client-runtimes.mjs'.
`);
}

function runVerifierForClient(clientId, args) {
  const commandArgs = ["--client", clientId, ...args];
  const child = spawnSync(process.execPath, [verifyScriptPath, ...commandArgs], {
    stdio: "pipe",
    env: process.env,
    shell: false,
  });
  if (child.error) {
    throw new Error(`Failed to start verifier for ${clientId}: ${child.error.message}`);
  }
  const stdout = child.stdout ? child.stdout.toString("utf8") : "";
  const stderr = child.stderr ? child.stderr.toString("utf8") : "";
  process.stdout.write(`${stdout}\n${stderr}`);
  return {
    code: child.status ?? 0,
    output: `${stdout}\n${stderr}`,
  };
}

async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const clientCatalogArguments = getArgValues(rawArgs, "--client-catalog");
  const clientCatalogDirs = getArgValues(rawArgs, "--client-catalog-dir");
  const clientCatalogArgument = clientCatalogArguments.length
    ? clientCatalogArguments.join(",")
    : null;
  const clientCatalogDirArgument = clientCatalogDirs.length
    ? clientCatalogDirs.join(",")
    : null;
  const clientCatalogUrls = getArgValues(rawArgs, "--client-catalog-url");
  const clientCatalogUrlArgument = clientCatalogUrls.length
    ? clientCatalogUrls.join(",")
    : null;

  const requestedClientSelectors = [
    ...getArgValues(rawArgs, "--client"),
    ...getArgValues(rawArgs, "--clients"),
  ];
  const verifyArgs = removeClientSelectorArgs(rawArgs);
  const evidenceDir = getArgValue(rawArgs, "--evidence-dir") || null;
  const evidencePrefix = normalizeEvidencePrefix(getArgValue(rawArgs, "--evidence-prefix"));
  const { summaryPath: summaryPathArgument, summaryFormat } = parseSummaryOutputArgs(rawArgs);
  const defaultEvidenceDir = evidenceDir || resolve(
    repoRoot,
    "apps",
    "ai-gateway-service",
    "evidence",
    "client-runtime-verifications",
  );
  const summaryPath = summaryPathArgument
    ? resolve(process.cwd(), summaryPathArgument)
    : resolve(defaultEvidenceDir, `${toCompactTimestamp()}-client-runtime-serial-summary.${summaryFormat}`);

  let catalog = [];
  try {
    catalog = await loadClientRuntimeCatalog(
      clientCatalogArgument,
      clientCatalogDirArgument,
      clientCatalogUrlArgument,
    );
  } catch (error) {
    process.stderr.write(`Failed to load client runtime catalog: ${error?.message ?? error}\n`);
    process.exit(1);
  }

  const manualEvidenceArgument = getArgValue(rawArgs, "--manual-evidence");
  let manualEvidence = new Map();
  try {
    manualEvidence = loadManualEvidenceMap(manualEvidenceArgument);
  } catch (error) {
    process.stderr.write(`${error?.message ?? error}\n`);
    process.exit(1);
  }

  const selectedClientIds = resolveClientSelection(catalog, requestedClientSelectors);
  if (selectedClientIds.length === 0) {
    process.stderr.write("No matching client IDs found in the catalog.\n");
    process.exit(1);
  }

  const buildSerialSummary = (completed = false) => {
    const verifiedCount = clientReports.filter((item) => item.status === "verified").length;
    const manualCount = clientReports.filter((item) => item.status === "manual").length;
    const failedCount = clientReports.filter((item) => item.status === "failed").length;
    return {
      generatedAt: new Date().toISOString(),
      generatedBy: "tools/verify-client-runtimes-serial.mjs",
      mode: "serial-client-runtime-verification",
      status: completed ? "complete" : "in_progress",
      totalClients: clientReports.length,
      selectedClients: selectedClientIds.length,
      verified: verifiedCount,
      manual: manualCount,
      failed: failedCount,
      clients: clientReports,
      failedClients: failed,
    };
  };

  const writeSerialSummary = (completed = false) => {
    const serialSummary = buildSerialSummary(completed);
    const summaryData = summaryFormat === "json"
      ? `${JSON.stringify(serialSummary, null, 2)}\n`
      : renderSummaryMarkdown(serialSummary, clientReports);
    try {
      mkdirSync(resolve(summaryPath, ".."), { recursive: true });
      writeFileSync(summaryPath, summaryData);
    } catch (error) {
      process.stderr.write(`Failed to write serial summary: ${error?.message ?? error}\n`);
    }
    return serialSummary;
  };

  // Large federated catalogs use batched checkpoints to avoid rewriting a multi-megabyte
  // summary for every pending manual entry while still retaining resumable progress.
  const checkpointInterval = selectedClientIds.length > 100 ? 25 : 1;
  const maybeWriteSerialCheckpoint = (index) => {
    const processed = index + 1;
    if (
      processed === selectedClientIds.length
      || processed % checkpointInterval === 0
    ) {
      writeSerialSummary(false);
    }
  };

  const tagName = requestedClientSelectors.length === 0 ? "mainstream" : "selected";
  process.stdout.write(`Running ${tagName} client runtime verification serially (${selectedClientIds.length} entries).\n`);
  process.stdout.write(`Client list: ${selectedClientIds.join(", ")}\n`);

  const failed = [];
  const clientReports = [];
  for (let index = 0; index < selectedClientIds.length; index += 1) {
    const clientId = selectedClientIds[index];
    process.stdout.write(`\n[${index + 1}/${selectedClientIds.length}] Verifying: ${clientId}\n`);
    const definition = catalog.find((client) => client.id === clientId);
    if (definition?.mode === "manual") {
      const manualReport = buildPendingManualReport(
        definition,
        manualEvidence.get(clientId),
        verifyArgs.includes("--require-manual-evidence"),
      );
      clientReports.push(manualReport);
      if (manualReport.status === "failed") {
        failed.push(clientId);
      }
      process.stdout.write(
        `Manual evidence state: ${manualReport.status}; runtimeExecuted=false; source=${manualReport.evidenceSource}\n`,
      );
      maybeWriteSerialCheckpoint(index);
      continue;
    }
    const perClientPrefix = evidencePrefix
      ? `${evidencePrefix}-${clientId}`
      : clientId;
    try {
      const response = runVerifierForClient(clientId, [
        "--evidence-dir",
        defaultEvidenceDir,
        "--evidence-prefix",
        perClientPrefix,
        ...verifyArgs,
      ]);
      const evidencePath = extractEvidencePath(response.output);
      const evidence = safeJsonOrNull(evidencePath);
      const evidenceRecord = extractClientRecordFromEvidence(evidence, clientId, definition);
      const mainStatus = resolveClientStatusFromEvidence(
        response.code,
        evidence?.summary,
        evidenceRecord,
      );
      clientReports.push({
        clientId,
        status: mainStatus,
        evidencePath,
        summary: evidence?.summary ?? null,
        command: evidenceRecord?.command || definition?.command || "n/a",
        failedChecks: evidenceRecord
          ? summarizeFailedChecks(evidenceRecord.checks)
          : ["runtimeRecordPresent"],
        outputTail: evidenceRecord
          ? (evidencePath ? String(evidencePath) : "")
          : `Verifier returned no runtime record for ${clientId}.`,
        runtimeExecuted: Boolean(evidenceRecord?.outcome),
      });
      if (mainStatus === "failed") {
        failed.push(clientId);
      }
    } catch (error) {
      failed.push(clientId);
      process.stderr.write(`${error?.message ?? error}\n`);
      clientReports.push({
        clientId,
        status: "failed",
        evidencePath: null,
        command: "n/a",
        failedChecks: [],
        summary: null,
        outputTail: String(error?.message || error),
      });
    }
    maybeWriteSerialCheckpoint(index);
  }

  const serialSummary = writeSerialSummary(true);
  const manualCount = serialSummary.manual;

  if (failed.length > 0) {
    process.stdout.write(`\nSerial summary: ${summaryPath}\n`);
    process.stdout.write(`\nSerial client certification completed with failures: ${failed.length}\n`);
    process.stdout.write(`Failed clients: ${failed.join(", ")}\n`);
    process.exit(1);
  }

  process.stdout.write(`\nSerial summary: ${summaryPath}\n`);
  if (manualCount > 0) {
    process.stdout.write("\nSerial client certification completed; manual evidence remains pending.\n");
  } else {
    process.stdout.write("\nSerial client certification completed with all clients passing.\n");
  }
  process.exit(0);
}

void main();
