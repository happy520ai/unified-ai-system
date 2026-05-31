import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(repoRoot, "apps/ai-gateway-service/package.json");
const entrypointsDir = resolve(repoRoot, "apps/ai-gateway-service/src/entrypoints");
const outputJsonPath = resolve(repoRoot, "docs/phase323c-script-entrypoint-inventory.json");
const outputMdPath = resolve(repoRoot, "docs/phase323c-script-entrypoint-inventory.md");

const coreKeepScripts = new Set([
  "health:phase12a",
  "doctor:phase13a",
  "verify:phase322a-workbench-chat-gateway-real-nvidia",
  "verify:phase321a-workbench-product-recovery",
  "verify:phase319a-functional-landing",
  "verify:phase314a-chat-gateway-task-closure",
  "verify:phase313a-model-usability-matrix",
  "verify:phase312a-unified-model-library",
  "verify:phase107a-secret-safety",
  "check",
]);

const forbiddenTouchScriptHints = [
  "legacy",
  "project_context",
  "commit",
  "push",
  "deploy",
  "release",
];

const historicalCompatibleHints = [
  "workforce",
  "handoff",
  "codex",
  "enterprise",
  "docker",
  "github",
  "cicd",
  "knowledge",
  "workflow",
  "routing",
  "cache",
  "cost",
  "benchmark",
  "preview",
  "personal",
];

const archiveCandidateHints = [
  "phase1",
  "phase2",
  "phase3",
  "browser",
  "screenshot",
  "real-ui",
  "ui-",
  "webchat",
];

const forbiddenTouchEntryPoints = new Set([
  "verifyPhase322AWorkbenchChatGatewayRealNvidia.js",
  "verifyPhase321AWorkbenchProductRecovery.js",
  "verifyPhase314AChatGatewayTaskClosure.js",
  "verifyPhase313AModelUsabilityMatrix.js",
  "verifyPhase312AUnifiedModelLibrary.js",
  "verifySecretSafety.js",
]);

const inventory = await buildInventory();
await mkdir(resolve(repoRoot, "docs"), { recursive: true });
await writeFile(outputJsonPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
await writeFile(outputMdPath, renderMarkdown(inventory), "utf8");

console.log(
  JSON.stringify(
    {
      status: "pass",
      outputJsonPath,
      outputMdPath,
      rootScriptCount: inventory.summary.rootScriptCount,
      serviceScriptCount: inventory.summary.serviceScriptCount,
      entrypointCount: inventory.summary.entrypointCount,
    },
    null,
    2,
  ),
);

async function buildInventory() {
  const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));
  const servicePackage = JSON.parse(await readFile(servicePackagePath, "utf8"));
  const rootScripts = rootPackage.scripts ?? {};
  const serviceScripts = servicePackage.scripts ?? {};
  const entrypoints = existsSync(entrypointsDir)
    ? (await readdir(entrypointsDir)).filter((name) => name.endsWith(".js")).sort()
    : [];

  const rootScriptList = Object.keys(rootScripts).sort();
  const serviceScriptList = Object.keys(serviceScripts).sort();

  return {
    phase: "Phase323C-1",
    generatedAt: new Date().toISOString(),
    inputs: {
      rootPackagePath,
      servicePackagePath,
      entrypointsDir,
    },
    summary: {
      rootScriptCount: rootScriptList.length,
      rootVerifyCount: rootScriptList.filter((name) => name.startsWith("verify:")).length,
      serviceScriptCount: serviceScriptList.length,
      serviceVerifyCount: serviceScriptList.filter((name) => name.startsWith("verify:")).length,
      entrypointCount: entrypoints.length,
      verifyEntrypointCount: entrypoints.filter((name) => name.startsWith("verify")).length,
      smokeEntrypointCount: entrypoints.filter((name) => name.startsWith("smoke")).length,
      runEntrypointCount: entrypoints.filter((name) => name.startsWith("run")).length,
    },
    scriptInventory: {
      root: classifyScripts(rootScriptList),
      service: classifyScripts(serviceScriptList),
    },
    entrypointInventory: classifyEntrypoints(entrypoints),
  };
}

function classifyScripts(scriptNames) {
  const classified = {
    "core-keep": [],
    "historical-compatible": [],
    "archive-candidate": [],
    "forbidden-touch": [],
    "unknown-review-required": [],
  };

  for (const script of scriptNames) {
    const lower = script.toLowerCase();
    if (coreKeepScripts.has(script)) {
      classified["core-keep"].push(script);
      continue;
    }
    if (forbiddenTouchScriptHints.some((hint) => lower.includes(hint))) {
      classified["forbidden-touch"].push(script);
      continue;
    }
    if (historicalCompatibleHints.some((hint) => lower.includes(hint))) {
      classified["historical-compatible"].push(script);
      continue;
    }
    if (
      archiveCandidateHints.some((hint) => lower.includes(hint)) &&
      (script.startsWith("verify:") || script.startsWith("smoke:"))
    ) {
      classified["archive-candidate"].push(script);
      continue;
    }
    classified["unknown-review-required"].push(script);
  }

  return summarizeClassifiedMap(classified);
}

function classifyEntrypoints(entrypoints) {
  const classified = {
    "core-keep": [],
    "historical-compatible": [],
    "archive-candidate": [],
    "forbidden-touch": [],
    "unknown-review-required": [],
  };

  for (const name of entrypoints) {
    const lower = name.toLowerCase();
    if (
      forbiddenTouchEntryPoints.has(name) ||
      name === "checkSyntax.js"
    ) {
      classified["core-keep"].push(name);
      continue;
    }
    if (lower.includes("legacy") || lower.includes("secret")) {
      classified["forbidden-touch"].push(name);
      continue;
    }
    if (historicalCompatibleHints.some((hint) => lower.includes(hint))) {
      classified["historical-compatible"].push(name);
      continue;
    }
    if (archiveCandidateHints.some((hint) => lower.includes(hint))) {
      classified["archive-candidate"].push(name);
      continue;
    }
    classified["unknown-review-required"].push(name);
  }

  return summarizeClassifiedMap(classified);
}

function summarizeClassifiedMap(classified) {
  return Object.fromEntries(
    Object.entries(classified).map(([category, items]) => [
      category,
      {
        count: items.length,
        items,
      },
    ]),
  );
}

function renderMarkdown(inventory) {
  const { summary } = inventory;
  return [
    "# Phase323C Script / Entrypoint Inventory",
    "",
    `- generatedAt: ${inventory.generatedAt}`,
    `- root package scripts: ${summary.rootScriptCount}`,
    `- root verify:*: ${summary.rootVerifyCount}`,
    `- service package scripts: ${summary.serviceScriptCount}`,
    `- service verify:*: ${summary.serviceVerifyCount}`,
    `- entrypoints: ${summary.entrypointCount}`,
    `- verify*.js: ${summary.verifyEntrypointCount}`,
    `- smoke*.js: ${summary.smokeEntrypointCount}`,
    `- run*.js: ${summary.runEntrypointCount}`,
    "",
    "## Root Scripts",
    ...renderCategoryBlock(inventory.scriptInventory.root),
    "",
    "## Service Scripts",
    ...renderCategoryBlock(inventory.scriptInventory.service),
    "",
    "## Entrypoints",
    ...renderCategoryBlock(inventory.entrypointInventory),
    "",
  ].join("\n");
}

function renderCategoryBlock(classified) {
  const lines = [];
  for (const [category, info] of Object.entries(classified)) {
    lines.push(`### ${category}`);
    lines.push(`- count: ${info.count}`);
    if (info.items.length === 0) {
      lines.push("- items: none");
      continue;
    }
    for (const item of info.items.slice(0, 80)) {
      lines.push(`- ${item}`);
    }
    if (info.items.length > 80) {
      lines.push(`- ... and ${info.items.length - 80} more`);
    }
    lines.push("");
  }
  return lines;
}
