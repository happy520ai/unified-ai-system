import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function readJson(path) {
  return JSON.parse(readFileSync(resolve(repoRoot, path), "utf8"));
}

function addError(code, path, details = "") {
  errors.push({ code, path, details });
}

const tracked = execFileSync("git", ["ls-files", "-z"], {
  cwd: repoRoot,
  encoding: "utf8",
  windowsHide: true,
})
  .split("\0")
  .filter(Boolean);

const trackedSet = new Set(tracked);
const requiredFiles = [
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "apps/ai-gateway-service/src/index.js",
  "apps/agent-console/evidence/README.md",
  "apps/ai-gateway-service/evidence/README.md",
  "docs/getting-started.md",
  "tools/verify-public-clone.mjs",
];

for (const path of requiredFiles) {
  if (!trackedSet.has(path) || !existsSync(resolve(repoRoot, path))) {
    addError("required_file_missing", path);
  }
}

const forbiddenTrackedPatterns = [
  [/^legacy\//i, "legacy_tree_tracked"],
  [/^docs\/phase/i, "phase_document_tracked"],
  [/^tools\/phase/i, "phase_tool_tracked"],
  [/^apps\/static-showcase\//i, "retired_showcase_tracked"],
  [/^apps\/[^/]+\/evidence\/(?!README\.md$)/i, "generated_evidence_tracked"],
  [/(^|\/)\.env(?:\.|$)/i, "environment_file_tracked"],
  [/\.input\.json$/i, "private_input_tracked"],
];

for (const path of tracked) {
  if (path === ".env.example" || path === ".env.enterprise.example") continue;
  for (const [pattern, code] of forbiddenTrackedPatterns) {
    if (pattern.test(path)) addError(code, path);
  }
}

const rootPackage = readJson("package.json");
const servicePackage = readJson("apps/ai-gateway-service/package.json");
const requiredScripts = [
  "start",
  "check",
  "test",
  "check:public",
  "verify:public-clone",
];

for (const script of requiredScripts) {
  if (typeof rootPackage.scripts?.[script] !== "string") {
    addError("required_script_missing", `package.json#scripts.${script}`);
  }
}

const rootScriptCount = Object.keys(rootPackage.scripts ?? {}).length;
const serviceScriptCount = Object.keys(servicePackage.scripts ?? {}).length;
if (rootScriptCount > 20) addError("root_script_surface_too_large", "package.json", String(rootScriptCount));
if (serviceScriptCount > 20) {
  addError("service_script_surface_too_large", "apps/ai-gateway-service/package.json", String(serviceScriptCount));
}

const readme = readFileSync(resolve(repoRoot, "README.md"), "utf8");
if (readme.includes("BEGIN UNIFIED_AI_SYSTEM_CURRENT_STATE")) {
  addError("generated_ledger_in_public_readme", "README.md");
}

const textExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const secretPatterns = [
  {
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]{80,}\r?\n-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    code: "private_key",
  },
  { pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g, code: "openai_style_key" },
  { pattern: /\bghp_[A-Za-z0-9]{30,}\b/g, code: "github_token" },
  { pattern: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g, code: "github_pat" },
  {
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    code: "aws_access_key",
    allowedMatches: new Set(["AKIAIOSFODNN7EXAMPLE"]),
  },
];
const machinePathPatterns = [
  { pattern: /[A-Za-z]:\\Users\\([^\\\s"'`]+)/g, code: "windows_user_path" },
  { pattern: /(?:^|[\s"'`=(])\/Users\/([^/\s"'`]+)/gm, code: "mac_user_path" },
  { pattern: /(?:^|[\s"'`=(])\/home\/([^/\s"'`]+)/gm, code: "linux_user_path" },
];
const genericUserNames = new Set([
  "example",
  "name",
  "parent",
  "root",
  "temp",
  "test",
  "tester",
  "tmp",
  "user",
  "username",
  "users",
  "xxx",
]);

function normalizeMachineUser(value) {
  return value.replace(/[),.;:\]}）】。，“”]+$/gu, "").toLowerCase();
}

let scannedTextFiles = 0;
for (const path of tracked) {
  const absolutePath = resolve(repoRoot, path);
  if (!existsSync(absolutePath) || statSync(absolutePath).size > 1_000_000) continue;
  if (!textExtensions.has(extname(path).toLowerCase()) && !path.startsWith(".env.")) continue;
  const text = readFileSync(absolutePath, "utf8");
  if (text.includes("\0")) continue;
  scannedTextFiles += 1;
  for (const { pattern, code, allowedMatches = new Set() } of secretPatterns) {
    const unexpectedMatch = [...text.matchAll(pattern)].find(
      (match) => !allowedMatches.has(match[0]),
    );
    if (unexpectedMatch) addError(code, path);
  }
  for (const { pattern, code } of machinePathPatterns) {
    const unexpectedMatch = [...text.matchAll(pattern)].find(
      (match) => !genericUserNames.has(normalizeMachineUser(match[1])),
    );
    if (unexpectedMatch) addError(code, path);
  }
}

const result = {
  ok: errors.length === 0,
  trackedFiles: tracked.length,
  scannedTextFiles,
  rootScriptCount,
  serviceScriptCount,
  errors,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) process.exitCode = 1;
