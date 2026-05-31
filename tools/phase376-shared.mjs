import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { mkdir, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { writeJson, writeText } from "./phase373-common.mjs";

export const missionControlUrl = "http://127.0.0.1:3100/ui";
export const dangerousActionPattern = /<button[^>]*>\s*(Deploy Now|Release Now|Execute Production|Read Secret|Show API Key|Force Provider Call|Bypass Approval|Create Invoice|Upload Artifact|Create Tag)\s*<\/button>/i;
export const productionClaimPattern = /production ready|production GA|正式生产可用|已生产发布/i;
export const secretPattern = /\b(?:nvapi[-_][A-Za-z0-9._-]{8,}|sk-proj[-_][A-Za-z0-9._-]{8,}|sk[-_][A-Za-z0-9._-]{8,}|pk[-_][A-Za-z0-9._-]{8,})\b/i;

export function findBrowserExecutable() {
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    `${process.env.LOCALAPPDATA || ""}/ms-playwright/chromium-1217/chrome-win64/chrome.exe`,
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate)) || null;
}

export async function captureWithHeadlessBrowser({ url, outputPath, viewport = "1600,2600" }) {
  const browserPath = findBrowserExecutable();
  if (!browserPath) {
    return { ok: false, browserPath: null, error: "No Chrome or Edge executable found." };
  }
  await mkdir(dirname(resolve(outputPath)), { recursive: true });
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--window-size=${viewport}`,
    `--screenshot=${resolve(outputPath)}`,
    url,
  ];
  const result = await runProcess(browserPath, args);
  const exists = existsSync(resolve(outputPath));
  const size = exists ? statSync(resolve(outputPath)).size : 0;
  return {
    ok: result.code === 0 && exists && size > 0,
    browserPath,
    outputPath,
    screenshotSizeBytes: size,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    error: result.code === 0 ? null : `browser exited with code ${result.code}`,
  };
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
    "import sys",
    `src = r'''${resolve(source)}'''`,
    `dst = r'''${resolve(target)}'''`,
    `left, top, width, height = map(int, ${JSON.stringify([box.left, box.top, box.width, box.height])})`,
    "img = Image.open(src)",
    "cropped = img.crop((left, top, left + width, top + height))",
    "cropped.save(dst)",
  ].join("; ");
  const result = await runProcess(python, ["-c", script]);
  return { ok: result.code === 0, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

export function sourceChecks(source) {
  return {
    missionControlVisible: source.includes("Mission Control") && source.includes("data-mission-control-root"),
    topSystemRadarVisible: source.includes("top-system-radar"),
    normalModeVisible: source.includes("mission-normal-mode-card"),
    godModeArenaVisible: source.includes("god-mode-arena"),
    tianshuFlightPathVisible: source.includes("tianshu-flight-path"),
    securityShieldVisible: source.includes("security-shield-panel"),
    redTeamPlaygroundVisible: source.includes("red-team-playground-panel"),
    evidenceTimelineVisible: source.includes("evidence-timeline-panel"),
    credentialRefOnlyVisible: source.includes("credentialRef-only") || source.includes("credentialRef"),
    dryRunBoundaryVisible: source.includes("dry-run only"),
    noProviderCallVisible: source.includes("no provider call"),
    secretValueVisible: secretPattern.test(source),
    dangerousActionButtonDetected: dangerousActionPattern.test(source),
    productionDeployClaimDetected: productionClaimPattern.test(source),
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
    approvalForged: false,
    billingExecuted: false,
    invoiceGenerated: false,
    productionGaClaimed: false,
    workspaceCleanClaimed: false,
  };
}

export async function writePhaseDocs({ resultPath, result, reportPath, reportLines }) {
  await writeJson(resultPath, result);
  if (reportPath) {
    await writeText(reportPath, reportLines.join("\n"));
  }
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
