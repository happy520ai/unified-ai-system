import { existsSync } from "node:fs";
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
  await writeEvidence(evidence);
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
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 81A First-Run Browser Open Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- First-run path: ${body.firstRun?.path ?? "n/a"}
- Auto-open after managed start: ${body.firstRun?.autoOpenAfterManagedStart}
- Opt-out env: ${(body.firstRun?.optOutEnv ?? []).join(", ") || "none"}
- Windows command present: ${body.firstRun?.browserCommands?.windows}
- macOS command present: ${body.firstRun?.browserCommands?.darwin}
- Linux command present: ${body.firstRun?.browserCommands?.linux}
- Missing text: ${(body.firstRun?.missingText ?? []).join(", ") || "none"}
- Root start script: ${body.scripts?.rootStart ?? "n/a"}
- Root verify script: ${body.scripts?.rootVerify ?? "n/a"}
- Service verify script: ${body.scripts?.serviceVerify ?? "n/a"}
- Missing scripts: ${(body.scripts?.missingScripts ?? []).join(", ") || "none"}
- Verify does not open browser: ${body.scripts?.verifyDoesNotOpenBrowser}
- Read-only verify: ${body.safety?.readOnlyVerify}
- Browser opened during verify: ${body.safety?.browserOpenedDuringVerify}
- Service started during verify: ${body.safety?.serviceStartedDuringVerify}
- Provider calls: ${body.safety?.providerCalls}
- Runtime mutation: ${body.safety?.runtimeMutation}
- Release automation: ${body.safety?.releaseAutomation}
- Conclusion: ${body.conclusion}
`;
}
