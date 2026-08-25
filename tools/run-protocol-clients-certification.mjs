#!/usr/bin/env node

import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { argv as processArgv } from "node:process";

const PROTOCOL_CLIENT_SELECTORS = [
  "protocol:openai*",
  "protocol:mcp*",
  "protocol:a2a*",
  "protocol:public*",
  "protocol:unified*",
];

const DEFAULT_EVIDENCE_PATH = resolve(
  process.cwd(),
  ".tmp",
  "client-runtime-protocols-evidence.json",
);
const DEFAULT_SERIAL_REPORT_PATH = resolve(
  process.cwd(),
  ".tmp",
  "client-runtime-protocols-serial-summary.json",
);
const DEFAULT_SERIAL_REPORT_FORMAT = "json";

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

function getBooleanFlag(rawArgs, key) {
  return rawArgs.includes(`--${key}`);
}

function getPassedArgs(rawArgs) {
  const known = new Set(["--evidence", "--refresh-template", "--skip-template", "--help", "-h"]);
  const passthrough = [];
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (known.has(arg) || arg === "--manual-evidence") {
      if (arg === "--evidence" || arg === "--manual-evidence") {
        index += 1;
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
        arg.startsWith("--client-catalog=")
        || arg.startsWith("--client-catalog-dir=")
        || arg.startsWith("--client-catalog-url=")
        || arg === "--require-manual-evidence"
      ) {
        passthrough.push(arg);
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
const evidenceArg = getArgValueRaw(rawArgs, "evidence") || getArgValueRaw(rawArgs, "manual-evidence");
const evidencePath = resolveEvidencePath(evidenceArg);
const forceTemplate = getBooleanFlag(rawArgs, "refresh-template");
const skipTemplate = getBooleanFlag(rawArgs, "skip-template");
const userReportOutput = getArgValueRaw(rawArgs, "client-report-output");
const userReportFormat = getArgValueRaw(rawArgs, "client-report-format");
const passThroughArgs = getPassedArgs(rawArgs);
const nodeExecutable = process.execPath;

const scriptRoot = resolve(process.cwd(), "tools");
const verifyScript = resolve(scriptRoot, "verify-client-runtimes.mjs");
const verifySerialScript = resolve(scriptRoot, "verify-client-runtimes-serial.mjs");

const templateScript = [
  verifyScript,
  "--evidence-template",
  evidencePath,
  ...PROTOCOL_CLIENT_SELECTORS.flatMap((selector) => ["--client", selector]),
  ...passThroughArgs,
];

const runScript = [
  verifySerialScript,
  "--manual-evidence",
  evidencePath,
  "--require-manual-evidence",
  "--client-report-output",
  resolve(process.cwd(), userReportOutput || DEFAULT_SERIAL_REPORT_PATH),
  "--client-report-format",
  (userReportFormat && userReportFormat.toLowerCase() === "md") ? "md" : DEFAULT_SERIAL_REPORT_FORMAT,
  ...PROTOCOL_CLIENT_SELECTORS.flatMap((selector) => ["--client", selector]),
  ...passThroughArgs,
];

const main = () => {
  if (!skipTemplate) {
    if (forceTemplate || !existsSync(evidencePath)) {
      runCommand(nodeExecutable, templateScript);
    } else {
      console.log(`Using existing protocol client evidence file: ${evidencePath}`);
    }
  }

  console.log(`Running protocol-family clients strictly with evidence: ${evidencePath}`);
  runCommand(nodeExecutable, runScript);
};

try {
  main();
  process.exit(0);
} catch (error) {
  process.stderr.write(`Protocol-family client certification failed: ${error?.message ?? error}\n`);
  process.exit(1);
}
