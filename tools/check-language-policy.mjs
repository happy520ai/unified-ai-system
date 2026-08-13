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
        allowedFiles: [],
        allowedPathPrefixes: [],
        allowedPathPatterns: [],
      },
      issues: [],
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    const allowedFiles = Array.isArray(parsed?.allowedFiles)
      ? parsed.allowedFiles.map((entry) => `${entry}`.replaceAll("\\", "/"))
      : [];
    const allowedPathPrefixes = Array.isArray(parsed?.allowedPathPrefixes)
      ? parsed.allowedPathPrefixes.map((entry) => `${entry}`.replaceAll("\\", "/"))
      : [];
    const allowedPathPatterns = Array.isArray(parsed?.allowedPathPatterns)
      ? parsed.allowedPathPatterns.map((entry) => `${entry}`.replaceAll("\\", "/"))
      : [];

    return {
      ok: true,
      allowlist: {
        allowedFiles,
        allowedPathPrefixes,
        allowedPathPatterns,
      },
      issues: [],
    };
  } catch (error) {
    return {
      ok: false,
      allowlist: {
        allowedFiles: [],
        allowedPathPrefixes: [],
        allowedPathPatterns: [],
      },
      issues: [`failed to parse allowlist: ${String(error.message)}`],
    };
  }
}

function isAllowedByPolicy(path, allowlist) {
  if (!allowlist) {
    return false;
  }

  const normalized = path.replaceAll("\\", "/");
  if (Array.isArray(allowlist.allowedFiles) && allowlist.allowedFiles.includes(normalized)) {
    return true;
  }

  if (Array.isArray(allowlist.allowedPathPrefixes)) {
    for (const prefix of allowlist.allowedPathPrefixes) {
      if (prefix && normalized.startsWith(prefix)) {
        return true;
      }
    }
  }

  if (Array.isArray(allowlist.allowedPathPatterns)) {
    for (const rawPattern of allowlist.allowedPathPatterns) {
      if (!rawPattern || typeof rawPattern !== "string") {
        continue;
      }
      const matcher = toGlobRegex(rawPattern);
      if (matcher.test(normalized)) {
        return true;
      }
    }
  }

  return false;
}

function main() {
  const args = parseArgs();
  const resolvedBaseRef = args.baseRef ?? discoverBaseRefFromEnvironment() ?? "HEAD~1";
  const allowlistResult = parseAllowlistFile(args.allowlistPath);
  const commandLine = process.argv.slice(2);
  let output = {
    ok: true,
    violations: [],
    allowed: [],
    allowlistPath: args.allowlistPath,
    allowlistIssues: allowlistResult.issues,
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
      const isAllowedByException = isAllowedByPolicy(path, allowlistResult.allowlist);
      if (!isAllowedLegacyPath && !isAllowedByException) {
        output.violations.push({
          file: path,
          boundary,
          reason: "runtime path uses JS; apps/packages default should be TypeScript",
          extension,
          remedy: "convert to .ts/.tsx or provide explicit migration justification in PR language section",
        });
      } else if (isAllowedByException) {
        output.allowed.push({
          file: path,
          boundary,
          reason: "allowed by language-policy allowlist",
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
    process.stdout.write(`language policy check passed: no blocking js artifacts added to apps/packages.\n`);
    if (output.allowed.length > 0) {
      process.stdout.write("allowed-by-config exceptions used:\n");
      for (const item of output.allowed) {
        process.stdout.write(`- ${item.boundary}: ${item.file}\n`);
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
