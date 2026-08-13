#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_ALLOWED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".d.ts",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".toml",
  ".txt",
]);

const DEFAULT_DENIED_JS_EXTENSIONS = new Set([".js", ".cjs", ".mjs"]);
const DEFAULT_LANGUAGE_POLICY_ALLOWLIST = resolve(repoRoot, "tools/language-policy-allowlist.json");
const DEFAULT_LANGUAGE_POLICY_EXCEPTION_TYPES = new Set(["file", "pathPrefix", "pathPattern"]);
const REQUIRED_EXCEPTION_FIELDS = ["type", "value", "justification", "owner", "removalBy"];

function parseArgs() {
  const args = process.argv.slice(2);
  const values = {
    baseRef: null,
    headRef: "HEAD",
    allowlistPath: DEFAULT_LANGUAGE_POLICY_ALLOWLIST,
    allowJsInLegacyPaths: false,
    outputJson: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--base") {
      values.baseRef = args[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--head") {
      values.headRef = args[index + 1] ?? "HEAD";
      index += 1;
      continue;
    }
    if (arg === "--json") {
      values.outputJson = true;
      continue;
    }
    if (arg === "--allowlist") {
      values.allowlistPath = args[index + 1] ?? values.allowlistPath;
      index += 1;
      continue;
    }
    if (arg === "--allow-legacy-js") {
      values.allowJsInLegacyPaths = true;
      continue;
    }
  }

  return values;
}

function discoverBaseRefFromEnvironment() {
  if (process.env.LANGUAGE_POLICY_BASE_REF) {
    return process.env.LANGUAGE_POLICY_BASE_REF;
  }

  const githubEventPath = process.env.GITHUB_EVENT_PATH;
  if (githubEventPath && existsSync(githubEventPath)) {
    try {
      const event = JSON.parse(readFileSync(githubEventPath, "utf8"));
      const baseSha = event?.pull_request?.base?.sha;
      if (typeof baseSha === "string" && baseSha.length > 0) {
        return baseSha;
      }
    } catch {
      // ignore malformed event files
    }
  }

  if (process.env.GITHUB_BASE_REF) {
    return `origin/${process.env.GITHUB_BASE_REF}`;
  }

  return null;
}

function parseGitDiffNameStatus(baseRef, headRef) {
  const command = baseRef
    ? `git -C ${JSON.stringify(repoRoot)} diff --name-status ${JSON.stringify(baseRef)}...${JSON.stringify(headRef)}`
    : `git -C ${JSON.stringify(repoRoot)} diff --name-status --cached`;
  const output = execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getAddedPaths(lines) {
  const added = [];

  for (const line of lines) {
    const [statusWithExtra, left, right] = line.split(/\s+/);
    const status = statusWithExtra?.trim();
    if (status !== "A" && status !== "C" && !status?.startsWith("R")) {
      continue;
    }
    const rawPath = (statusWithExtra?.startsWith("R") ? right : left) ?? "";
    if (!rawPath) {
      continue;
    }
    added.push(rawPath);
  }

  return added;
}

function getLanguageBoundary(path) {
  if (path.startsWith("apps/")) {
    return "apps";
  }

  if (path.startsWith("packages/")) {
    return "packages";
  }

  return null;
}

function getExtension(path) {
  const lastDot = path.lastIndexOf(".");
  if (lastDot < 0) {
    return "";
  }
  const nextSlash = path.lastIndexOf("/", lastDot);
  if (nextSlash > -1) {
    return path.slice(lastDot);
  }
  return path.slice(lastDot);
}

function normalizePath(path) {
  return path.replaceAll("\\", "/");
}

function escapeRegexSegment(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toGlobRegex(pattern) {
  const normalized = pattern.replaceAll("\\", "/");
  const escaped = escapeRegexSegment(normalized)
    .replace(/\\\*/g, ".*")
    .replace(/\\\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

function parseAllowlistFile(allowlistPath) {
  const path = resolve(repoRoot, allowlistPath);
  if (!existsSync(path)) {
    return {
      ok: true,
      allowlist: {
        exceptions: [],
      },
      issues: [],
      warnings: [],
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    const allowlist = {
      exceptions: [],
    };
    const issues = [];
    const warnings = [];
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);

    const legacyFieldPairs = [
      { field: "allowedFiles", type: "file" },
      { field: "allowedPathPrefixes", type: "pathPrefix" },
      { field: "allowedPathPatterns", type: "pathPattern" },
    ];

    for (const pair of legacyFieldPairs) {
      const entries = parsed?.[pair.field];
      if (!Array.isArray(entries)) {
        continue;
      }
      if (entries.length > 0) {
        warnings.push(
          `${pair.field} is deprecated; migrate entries to exceptions[] with justification, owner, and removalBy`,
        );
      }
      entries.forEach((entry, index) => {
        if (typeof entry !== "string" || entry.trim().length === 0) {
          issues.push(`invalid ${pair.field}[${index}] type: expected non-empty string`);
          return;
        }
        allowlist.exceptions.push({
          type: pair.type,
          value: `${entry}`.replaceAll("\\", "/"),
          justification: "legacy allowance",
          owner: "unassigned",
          removalBy: "1970-01-01",
          fromLegacyField: pair.field,
          legacyIndex: index,
        });
      });
    }

    if (parsed?.exceptions != null) {
      if (!Array.isArray(parsed.exceptions)) {
        issues.push(`invalid exceptions type: expected an array`);
      } else {
        parsed.exceptions.forEach((entry, index) => {
          if (entry == null || typeof entry !== "object" || Array.isArray(entry)) {
            issues.push(`invalid exceptions[${index}] type: expected object`);
            return;
          }

          const normalizedEntry = {
            type: `${entry.type ?? ""}`.trim(),
            value: `${entry.value ?? ""}`.trim(),
            justification: `${entry.justification ?? ""}`.trim(),
            owner: `${entry.owner ?? ""}`.trim(),
            removalBy: `${entry.removalBy ?? ""}`.trim(),
          };

          if (!DEFAULT_LANGUAGE_POLICY_EXCEPTION_TYPES.has(normalizedEntry.type)) {
            issues.push(`exceptions[${index}].type invalid: "${normalizedEntry.type || "<empty>"}"`);
          }

          const missingFields = REQUIRED_EXCEPTION_FIELDS.filter((field) => {
            const rawValue = `${entry?.[field] ?? ""}`.trim();
            return rawValue.length === 0;
          });
          if (missingFields.length > 0) {
            issues.push(`exceptions[${index}] missing required field(s): ${missingFields.join(", ")}`);
            return;
          }

          const removalDate = new Date(`${normalizedEntry.removalBy}T00:00:00Z`);
          if (Number.isNaN(removalDate.getTime())) {
            issues.push(`exceptions[${index}].removalBy invalid date: "${normalizedEntry.removalBy}"`);
            return;
          }
          if (removalDate < todayUtc) {
            issues.push(`exceptions[${index}] expired on ${normalizedEntry.removalBy}; update or remove`);
            return;
          }

          allowlist.exceptions.push({
            ...normalizedEntry,
            pr: entry.pr ? `${entry.pr}` : "",
            issueId: entry.issueId ? `${entry.issueId}` : "",
            notes: entry.notes ? `${entry.notes}` : "",
          });
        });
      }
    }

    return {
      ok: issues.length === 0,
      allowlist,
      issues,
      warnings,
    };
  } catch (error) {
    return {
      ok: false,
      allowlist: {
        exceptions: [],
      },
      issues: [`failed to parse allowlist: ${String(error.message)}`],
      warnings: [],
    };
  }
}

function isAllowedByPolicy(path, allowlist) {
  if (!allowlist || !Array.isArray(allowlist.exceptions)) {
    return null;
  }

  const normalized = path.replaceAll("\\", "/");
  for (const exception of allowlist.exceptions) {
    if (!exception || typeof exception !== "object") {
      continue;
    }

    const type = `${exception.type ?? ""}`;
    const value = `${exception.value ?? ""}`.replaceAll("\\", "/");
    if (!value) {
      continue;
    }

    if (type === "file" || type === "pathPrefix") {
      if (normalized.startsWith(value)) {
        return exception;
      }
      continue;
    }

    if (type === "pathPattern") {
      const matcher = toGlobRegex(value);
      if (matcher.test(normalized)) {
        return exception;
      }
    }
  }

  return null;
}

function formatAllowedByException(item) {
  return `type=${item.type}, value=${item.value}, justification=${item.justification}, owner=${item.owner}, removalBy=${item.removalBy}`;
}

function main() {
  const args = parseArgs();
  const resolvedBaseRef = args.baseRef ?? discoverBaseRefFromEnvironment() ?? "HEAD~1";
  const allowlistResult = parseAllowlistFile(args.allowlistPath);
  const commandLine = process.argv.slice(2);
  const output = {
    ok: true,
    violations: [],
    allowed: [],
    allowlistPath: args.allowlistPath,
    allowlistIssues: [...allowlistResult.issues],
    allowlistWarnings: [...allowlistResult.warnings],
    inspected: {
      baseRef: resolvedBaseRef,
      headRef: args.headRef,
      commandLine,
    },
  };

  if (!allowlistResult.ok) {
    output.ok = false;
    if (allowlistResult.issues.length > 0) {
      process.stderr.write(`language policy check failed to parse allowlist: ${allowlistResult.issues.join(", ")}\n`);
    }
    process.exitCode = 1;
    if (args.outputJson) {
      process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
      return;
    }
    return;
  }

  if (allowlistResult.warnings.length > 0) {
    output.notice = `language policy allowlist warning(s): ${allowlistResult.warnings.join(", ")}`;
  }

  let lines = [];
  try {
    lines = parseGitDiffNameStatus(resolvedBaseRef, args.headRef);
  } catch (error) {
    output.ok = true;
    output.notice = `language policy diff unavailable; skipping check: ${String(error.message)}`;
    if (args.outputJson) {
      process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    } else {
      process.stderr.write(`${output.notice}\n`);
    }
    return;
  }

  const addedPaths = getAddedPaths(lines).map(normalizePath);
  output.inspected.added = addedPaths.length;

  for (const path of addedPaths) {
    const boundary = getLanguageBoundary(path);
    if (!boundary) {
      continue;
    }

    const extension = getExtension(path).toLowerCase();
    if (!DEFAULT_ALLOWED_EXTENSIONS.has(extension)) {
      output.violations.push({
        file: path,
        boundary,
        reason: "unsupported extension for runtime module",
        extension,
      });
      continue;
    }

    if (DEFAULT_DENIED_JS_EXTENSIONS.has(extension)) {
      const isAllowedLegacyPath = args.allowJsInLegacyPaths && path.startsWith(`${boundary}/`) && path.includes("/legacy/");
      const matchedException = isAllowedByPolicy(path, allowlistResult.allowlist);
      if (!isAllowedLegacyPath && !matchedException) {
        output.violations.push({
          file: path,
          boundary,
          reason: "runtime path uses JS; apps/packages default should be TypeScript",
          extension,
          remedy: "convert to .ts/.tsx or provide explicit migration justification in PR language section",
        });
      } else if (matchedException) {
        output.allowed.push({
          file: path,
          boundary,
          reason: "allowed by language-policy exception",
          exception: {
            type: matchedException.type,
            value: matchedException.value,
            justification: matchedException.justification,
            owner: matchedException.owner,
            removalBy: matchedException.removalBy,
            pr: matchedException.pr ?? "",
            issueId: matchedException.issueId ?? "",
          },
        });
      }
    }
  }

  output.ok = output.violations.length === 0;

  if (args.outputJson) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    process.exitCode = output.ok ? 0 : 1;
    return;
  }

  if (output.ok) {
    process.stdout.write("language policy check passed: no blocking js artifacts added to apps/packages.\n");
    if (output.allowed.length > 0) {
      process.stdout.write("allowed-by-config exceptions used:\n");
      for (const item of output.allowed) {
        process.stdout.write(`- ${item.boundary}: ${item.file} (${formatAllowedByException(item.exception)})\n`);
      }
    }
    return;
  }

  process.stderr.write("language policy check failed:\n");
  for (const violation of output.violations) {
    process.stderr.write(
      `- ${violation.boundary}: ${violation.file} (${violation.extension}) ${violation.reason}\n`,
    );
    if (violation.remedy) {
      process.stderr.write(`  remedy: ${violation.remedy}\n`);
    }
  }
  process.exitCode = 1;
}

main();
