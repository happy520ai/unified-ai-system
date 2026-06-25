import { existsSync } from "node:fs";
import { writeEvidencePair } from "./entrypointUtils.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "phase-81a-first-run-browser-open";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-81a-first-run-browser-open.json");
const evidenceMdPath = resolve(evidenceDir, "phase-81a-first-run-browser-open.md");
const firstRunPath = resolve(repoRoot, "tools/phase79a/first-run.mjs");

let evidence;

try {
  const rootPackage = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"));
  const servicePackage = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/package.json"), "utf8"));
  const firstRunText = await readFile(firstRunPath, "utf8");
  const requiredText = [
    "openWebConsole(evidence.urls.webConsole)",
    "function openWebConsole",
    "function shouldAutoOpenBrowser",
    "PME_SKIP_BROWSER_OPEN",
    "PME_AUTO_OPEN_BROWSER",
    "createOpenBrowserCommand",
    "http://127.0.0.1:3100",
  ];
  const missingText = requiredText.filter((text) => !firstRunText.includes(text));
  const missingScripts = [
    rootPackage.scripts?.["start:pme"] ? null : "start:pme",
    rootPackage.scripts?.["verify:phase81a"] ? null : "verify:phase81a",
    servicePackage.scripts?.["verify:phase81a"] ? null : "@unified-ai-system/ai-gateway-service verify:phase81a",
  ].filter(Boolean);
  const browserCommands = {
    windows: firstRunText.includes('command: "cmd"') && firstRunText.includes('"start"'),
    darwin: firstRunText.includes('command: "open"'),
    linux: firstRunText.includes('command: "xdg-open"'),
  };
  const verifyDoesNotOpenBrowser =
    rootPackage.scripts?.["verify:phase81a"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase81a" &&
    servicePackage.scripts?.["verify:phase81a"] === "node ./src/entrypoints/verifyFirstRunBrowserOpen.js";
  const passed =
    existsSync(firstRunPath) &&
    missingText.length === 0 &&
    missingScripts.length === 0 &&
    Object.values(browserCommands).every(Boolean) &&
    verifyDoesNotOpenBrowser;

  evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    firstRun: {
      path: "tools/phase79a/first-run.mjs",
      exists: existsSync(firstRunPath),
      missingText,
      autoOpenAfterManagedStart: firstRunText.includes("openWebConsole(evidence.urls.webConsole)"),
      optOutEnv: ["PME_SKIP_BROWSER_OPEN=1", "PME_AUTO_OPEN_BROWSER=0"],
      browserCommands,
    },
    scripts: {
      rootStart: rootPackage.scripts?.["start:pme"] ?? null,
      rootVerify: rootPackage.scripts?.["verify:phase81a"] ?? null,
      serviceVerify: servicePackage.scripts?.["verify:phase81a"] ?? null,
      missingScripts,
      verifyDoesNotOpenBrowser,
    },
    safety: {
      readOnlyVerify: true,
      browserOpenedDuringVerify: false,
      serviceStartedDuringVerify: false,
      providerCalls: false,
      runtimeMutation: false,
      defaultChatMainLaneChanged: false,
      releaseAutomation: false,
    },
    conclusion: passed ? "first-run-browser-open-connected" : "first-run-browser-open-not-connected",
  };
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "first-run-browser-open-not-connected",
  };
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}

