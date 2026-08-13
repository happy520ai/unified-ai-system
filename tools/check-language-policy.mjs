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

function parseArgs() {
  const args = process.argv.slice(2);
  const values = {
    baseRef: null,
    headRef: "HEAD",
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

function main() {
  const args = parseArgs();
  const resolvedBaseRef = args.baseRef ?? discoverBaseRefFromEnvironment() ?? "HEAD~1";
  const commandLine = process.argv.slice(2);
  let output = {
    ok: true,
    violations: [],
    inspected: {
      baseRef: resolvedBaseRef,
      headRef: args.headRef,
      commandLine,
    },
  };

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
      if (!isAllowedLegacyPath) {
        output.violations.push({
          file: path,
          boundary,
          reason: "runtime path uses JS; apps/packages default should be TypeScript",
          extension,
          remedy: "convert to .ts/.tsx or provide explicit migration justification in PR language section",
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
    process.stdout.write(`language policy check passed: no new js artifacts added to apps/packages.\n`);
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
