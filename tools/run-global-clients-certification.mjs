#!/usr/bin/env node

import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { argv as processArgv } from "node:process";

const DEFAULT_EVIDENCE_PATH = resolve(
  process.cwd(),
  ".tmp",
  "client-runtime-global-evidence.json",
);
const DEFAULT_SERIAL_REPORT_PATH = resolve(
  process.cwd(),
  ".tmp",
  "client-runtime-global-serial-summary.json",
);
const DEFAULT_SERIAL_REPORT_FORMAT = "json";
const DEFAULT_MAX = "10000";
const DEFAULT_SOURCE_MANIFEST = resolve(
  process.cwd(),
  "docs",
  "client-runtime-catalog-sources-worldwide.json",
);
const DEFAULT_SOURCE_MANIFEST_DIR = resolve(
  process.cwd(),
  "docs",
  "source-manifests.d",
);

function getArgValueRaw(rawArgs, key) {
  const exact = `--${key}=`;
  const token = rawArgs.find((item) => item.startsWith(exact));
  if (token) {
    return token.substring(exact.length);
  }
  const index = rawArgs.indexOf(`--${key}`);
  if (index >= 0) {
    const value = rawArgs[index + 1];
    if (value && !value.startsWith("--")) {
      return value;
    }
  }
  return null;
}

function getArgValues(rawArgs, key) {
  const keyWithEquals = `--${key}=`;
  const values = [];
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === `--${key}`) {
      const value = rawArgs[index + 1];
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

function getBooleanFlag(rawArgs, key) {
  return rawArgs.includes(`--${key}`);
}

function hasArgValue(rawArgs, key) {
  const exact = `--${key}=`;
  return rawArgs.some((arg) => arg.startsWith(exact) || arg === `--${key}`);
}

function normalizeArgList(rawInput) {
  return String(rawInput || "")
    .split(/[;,]/)
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

function mergeSourceManifestInputs(rawArgs, optionName, envName, fallbackPath) {
  const rawValues = getArgValues(rawArgs, optionName).flatMap((item) => normalizeArgList(item));
  const envValues = normalizeArgList(process.env[envName] || "");
  const values = [...rawValues, ...envValues];
  if (values.length === 0 && fallbackPath && existsSync(fallbackPath)) {
    values.push(fallbackPath);
  }
  return [...new Set(values)];
}

function getPassedArgs(rawArgs) {
  const known = new Set([
    "--evidence",
    "--manual-evidence",
    "--refresh-template",
    "--skip-template",
    "--help",
    "-h",
  ]);
  const passthrough = [];
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (known.has(arg)) {
      if (
        arg === "--evidence"
        || arg === "--manual-evidence"
      ) {
        const next = rawArgs[index + 1];
        if (next && !next.startsWith("--")) {
          index += 1;
        }
      }
      continue;
    }
    if (arg.startsWith("--")) {
      if (
        arg === "--client-catalog"
        || arg === "--client-catalog-dir"
        || arg === "--client-catalog-url"
      ) {
        passthrough.push(arg);
        const value = rawArgs[index + 1];
        if (value && !value.startsWith("--")) {
          passthrough.push(value);
          index += 1;
        }
        continue;
      }
      if (
        arg === "--client"
        || arg.startsWith("--client=")
        || arg === "--clients"
        || arg.startsWith("--clients=")
      ) {
        passthrough.push(arg);
        const next = rawArgs[index + 1];
        if (next && !next.startsWith("--")) {
          passthrough.push(next);
          index += 1;
        }
        continue;
      }
      if (
        arg.startsWith("--client-catalog=")
        || arg.startsWith("--client-catalog-dir=")
        || arg.startsWith("--client-catalog-url=")
        || arg === "--require-manual-evidence"
        || arg === "--skip-sync"
        || arg === "--source-manifest"
        || arg.startsWith("--source-manifest=")
        || arg === "--source-manifest-dir"
        || arg.startsWith("--source-manifest-dir=")
      ) {
        passthrough.push(arg);
        const value = rawArgs[index + 1];
        if (value && !value.startsWith("--") && !arg.includes("=")) {
          passthrough.push(value);
          index += 1;
        }
        continue;
      }
    }
    passthrough.push(arg);
  }
  return passthrough;
}

function resolveEvidencePath(rawPath) {
  if (typeof rawPath === "string" && rawPath.trim()) {
    return resolve(process.cwd(), rawPath.trim());
  }
  return DEFAULT_EVIDENCE_PATH;
}

function runCommand(command, args) {
  execFileSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });
}

const rawArgs = processArgv.slice(2);
if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
  console.log(`Usage:
node tools/run-global-clients-certification.mjs [options]

Options:
  --evidence <path>       Manual evidence file path (alias: --manual-evidence)
  --manual-evidence <path> Alias for --evidence
  --source-manifest <path> Use one or more source manifest files (comma/semicolon-separated or repeatable).
  --source-manifest-dir <path> Use one or more source manifest directories (comma/semicolon-separated or repeatable).
  --refresh-template       Regenerate evidence template before running strict checks.
  --skip-template          Skip template generation and use existing evidence file.
  --skip-sync              Skip MCP registry sync and only use user-provided catalog inputs.
  --client-catalog <file>  Merge extra catalog file(s) into global selection.
  --client-catalog-dir <dir>  Merge local catalog directory(ies).
  --client-catalog-url <url>   Merge remote catalog URL(s).
  --max <n>                 Global onboarding scale ceiling (default: 10000).
  --client-report-output <path>   Write serial onboarding summary to this path (default: .tmp/client-runtime-global-serial-summary.json).
  --client-report-format <md|json> Client summary output format (default: json).
  --require-manual-evidence     (Backward-compatible flag). Manual clients are enforced in strict mode by default.
  --help, -h               Show this help message.

This helper runs:
1) evidence-template generation for global clients, then
2) strict per-client verification (tools/verify-client-runtimes-serial.mjs) over discovery source manifests.

Examples:
  pnpm exec node tools/run-global-clients-certification.mjs
  pnpm exec node tools/run-global-clients-certification.mjs --source-manifest docs/client-runtime-catalog-sources-worldwide.json --manual-evidence .tmp/global-evidence.json --require-manual-evidence
  pnpm exec node tools/run-global-clients-certification.mjs --source-manifest-dir docs/source-manifests.d`);
  process.exit(0);
}

const evidenceArg = getArgValueRaw(rawArgs, "evidence") || getArgValueRaw(rawArgs, "manual-evidence");
const evidencePath = resolveEvidencePath(evidenceArg);
const forceTemplate = getBooleanFlag(rawArgs, "refresh-template");
const skipTemplate = getBooleanFlag(rawArgs, "skip-template");
const sourceManifestInputs = mergeSourceManifestInputs(
  rawArgs,
  "source-manifest",
  "CLIENT_RUNTIME_SOURCE_MANIFEST",
  DEFAULT_SOURCE_MANIFEST,
);
const sourceManifestDirInputs = mergeSourceManifestInputs(
  rawArgs,
  "source-manifest-dir",
  "CLIENT_RUNTIME_SOURCE_MANIFEST_DIR",
  DEFAULT_SOURCE_MANIFEST_DIR,
);
const hasMax = hasArgValue(rawArgs, "max");
const defaultMaxArg = hasMax ? [] : ["--max", DEFAULT_MAX];
const userReportOutput = getArgValueRaw(rawArgs, "client-report-output");
const userReportFormat = getArgValueRaw(rawArgs, "client-report-format");
const normalizedReportOutput = userReportOutput
  ? resolve(process.cwd(), userReportOutput)
  : DEFAULT_SERIAL_REPORT_PATH;
const normalizedReportFormat = (userReportFormat || DEFAULT_SERIAL_REPORT_FORMAT).toLowerCase() === "md" ? "md" : "json";

const passThroughArgs = getPassedArgs(rawArgs);
const hasClientSelector = rawArgs.some(
  (arg) => arg === "--client" || arg === "--clients" || arg.startsWith("--client=") || arg.startsWith("--clients="),
);
const shouldForceGlobalScope = !hasClientSelector;

const sourceArgs = [];
if (sourceManifestInputs.length > 0) {
  for (const sourceManifest of sourceManifestInputs) {
    sourceArgs.push("--source-manifest", sourceManifest);
  }
}
if (sourceManifestDirInputs.length > 0) {
  for (const sourceManifestDir of sourceManifestDirInputs) {
    sourceArgs.push("--source-manifest-dir", sourceManifestDir);
  }
}

const nodeExecutable = process.execPath;
const scriptRoot = resolve(process.cwd(), "tools");
const discoverScript = resolve(scriptRoot, "run-global-client-discovery.mjs");

const discoveryTemplateScript = [
  discoverScript,
  ...(shouldForceGlobalScope ? ["--client", "global"] : []),
  ...sourceArgs,
  ...defaultMaxArg,
  "--runbook",
  "--evidence-template",
  evidencePath,
  ...passThroughArgs,
];

const discoveryRunScript = [
  discoverScript,
  ...(shouldForceGlobalScope ? ["--client", "global"] : []),
  "--execute",
  "--serial",
  "--manual-evidence",
  evidencePath,
  "--require-manual-evidence",
  "--client-report-output",
  normalizedReportOutput,
  "--client-report-format",
  normalizedReportFormat,
  ...defaultMaxArg,
  ...sourceArgs,
  ...passThroughArgs,
];

const main = () => {
  if (!skipTemplate) {
    if (forceTemplate || !existsSync(evidencePath)) {
      runCommand(nodeExecutable, discoveryTemplateScript);
    } else {
      console.log(`Using existing global evidence file: ${evidencePath}`);
    }
  }

  console.log("Running global client onboarding strictly with evidence:", evidencePath);
  runCommand(nodeExecutable, discoveryRunScript);
};

try {
  main();
  process.exit(0);
} catch (error) {
  process.stderr.write(`Global client onboarding certification failed: ${error?.message ?? error}\n`);
  process.exit(1);
}
