import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { mkdir, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { readText, writeJson, writeText } from "./phase373-common.mjs";

export const missionControlUrl = "http://127.0.0.1:3100/ui";
export const browserScreenshots = {
  desktop: "apps/ai-gateway-service/evidence/phase377a/screenshots/desktop.png",
  narrow: "apps/ai-gateway-service/evidence/phase377a/screenshots/narrow.png",
  onboarding: "apps/ai-gateway-service/evidence/phase377b/screenshots/onboarding-tour.png",
  drilldown: "apps/ai-gateway-service/evidence/phase377c/screenshots/agent-drilldown.png",
  comparison: "apps/ai-gateway-service/evidence/phase377d/screenshots/tianshu-comparison.png",
  scenario: "apps/ai-gateway-service/evidence/phase377e/screenshots/red-team-library.png",
  exportPkg: "apps/ai-gateway-service/evidence/phase377f/screenshots/evidence-export.png",
};
export const safeBoundaryPattern = /no provider call|dry-run only|credentialRef-only|no secret|blocked|requires approval|no-deploy|internal-test/i;
export const dangerousActionPattern = /Deploy Now|Release Now|Execute Production|Read Secret|Show API Key|Force Provider Call|Bypass Approval|Create Invoice|Upload Artifact|Create Tag/i;

export function findBrowserExecutable() {
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ];
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

export async function captureScreenshot({ url, outputPath, viewport = "1600,2600" }) {
  const browserPath = findBrowserExecutable();
  if (!browserPath) return { ok: false, browserPath: null, error: "No Chrome or Edge executable found." };
  await mkdir(dirname(resolve(outputPath)), { recursive: true });
  const args = ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--window-size=${viewport}`, `--screenshot=${resolve(outputPath)}`, url];
  const result = await runProcess(browserPath, args);
  const exists = existsSync(resolve(outputPath));
  const size = exists ? statSync(resolve(outputPath)).size : 0;
  return { ok: result.code === 0 && exists && size > 0, browserPath, screenshotSizeBytes: size, stdout: result.stdout.trim(), stderr: result.stderr.trim(), error: result.code === 0 ? null : `browser exited with code ${result.code}` };
}

export async function copyScreenshot(source, target) {
  await mkdir(dirname(resolve(target)), { recursive: true });
  await copyFile(resolve(source), resolve(target));
}

export async function cropScreenshot(source, target, box) {
  const python = process.env.PYTHON || "python";
  await mkdir(dirname(resolve(target)), { recursive: true });
  const script = [
    "from PIL import Image",
    `src = r'''${resolve(source)}'''`,
    `dst = r'''${resolve(target)}'''`,
    `left, top, width, height = map(int, ${JSON.stringify([box.left, box.top, box.width, box.height])})`,
    "img = Image.open(src)",
    "cropped = img.crop((left, top, left + width, top + height))",
    "cropped.save(dst)",
  ].join("\n");
  return runProcess(python, ["-c", script]);
}

export function sourceChecks(source) {
  return {
    responsiveLayoutVisible: source.includes("mission-control") && source.includes("mission-card-grid"),
    onboardingVisible: source.includes("guided-onboarding-panel"),
    agentArenaVisible: source.includes("agent-arena-drilldown-panel"),
    tianshuComparisonVisible: source.includes("tianshu-plan-comparison-panel"),
    redTeamScenarioVisible: source.includes("red-team-scenario-library-panel"),
    evidenceExportVisible: source.includes("evidence-export-panel"),
    securityBoundaryVisible: source.includes("credentialRef-only") || source.includes("dry-run only"),
    dangerousActionButtonDetected: dangerousActionPattern.test(source),
    noProviderCallVisible: source.includes("no provider call") || source.includes("no provider call visible"),
    noSecretVisible: source.includes("no secret") || source.includes("secretValueExposed=false"),
  };
}

export function commonSafetyFlags() {
  return {
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    externalUploadPerformed: false,
    approvalForged: false,
    billingExecuted: false,
    invoiceGenerated: false,
    productionGaClaimed: false,
    dangerousActionButtonDetected: false,
    workspaceCleanClaimed: false,
  };
}

export async function writePhaseArtifacts({ reportPath, reportLines, resultPath, result }) {
  if (reportPath) await writeText(reportPath, reportLines.join("\n"));
  await writeJson(resultPath, result);
}

export async function readMissionControlSource() {
  return await readText("apps/ai-gateway-service/src/ui/consolePage.js")
    + await readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js");
}

function runProcess(command, args) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => resolveRun({ code: 1, stdout, stderr: stderr + error.message }));
    child.on("close", (code) => resolveRun({ code, stdout, stderr }));
  });
}
