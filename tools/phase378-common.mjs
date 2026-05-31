import { existsSync, statSync } from "node:fs";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { readText, writeJson, writeText } from "./phase373-common.mjs";

export const yiyiCommonSafety = {
  rawPhotoStored: false,
  externalUploadPerformed: false,
  faceRecognitionPerformed: false,
  sensitiveAttributeInferencePerformed: false,
  photoInEvidence: false,
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
  dangerousActionButtonDetected: false,
  workspaceCleanClaimed: false,
};

export const yiyiScreenshots = {
  overview: "apps/ai-gateway-service/evidence/phase378f/screenshots/yiyi-avatar-overview.png",
  mouseAttention: "apps/ai-gateway-service/evidence/phase378f/screenshots/yiyi-mouse-attention.png",
  securityGuard: "apps/ai-gateway-service/evidence/phase378f/screenshots/yiyi-security-guard.png",
  redTeamBlocked: "apps/ai-gateway-service/evidence/phase378f/screenshots/yiyi-red-team-blocked.png",
  godMode: "apps/ai-gateway-service/evidence/phase378f/screenshots/yiyi-god-mode-reaction.png",
  tianshu: "apps/ai-gateway-service/evidence/phase378f/screenshots/yiyi-tianshu-reaction.png",
  evidence: "apps/ai-gateway-service/evidence/phase378f/screenshots/yiyi-evidence-replay-reaction.png",
  compact: "apps/ai-gateway-service/evidence/phase378f/screenshots/yiyi-compact-mode.png",
  reducedMotion: "apps/ai-gateway-service/evidence/phase378f/screenshots/yiyi-reduced-motion-fallback.png",
};

export function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

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

export async function captureScreenshot({ url, outputPath, viewport = "1600,2600" }) {
  const browserPath = findBrowserExecutable();
  if (!browserPath) return { ok: false, browserPath: null, error: "No Chrome or Edge executable found." };
  await mkdir(dirname(resolve(outputPath)), { recursive: true });
  const result = await runProcess(browserPath, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--window-size=${viewport}`,
    `--screenshot=${resolve(outputPath)}`,
    url,
  ]);
  const exists = existsSync(resolve(outputPath));
  const size = exists ? statSync(resolve(outputPath)).size : 0;
  return { ok: result.code === 0 && exists && size > 0, browserPath, screenshotSizeBytes: size, error: result.code === 0 ? null : result.stderr.trim() };
}

export async function writePlaceholderPng(outputPath, label) {
  await mkdir(dirname(resolve(outputPath)), { recursive: true });
  const pngBase64 = "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";
  await writeFile(resolve(outputPath), Buffer.from(pngBase64, "base64"));
  return { ok: true, placeholder: true, label };
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
    "img.crop((left, top, left + width, top + height)).save(dst)",
  ].join("\n");
  return runProcess(python, ["-c", script]);
}

export async function readYiyiSource() {
  return await readText("apps/ai-gateway-service/src/ui/consolePage.js")
    + await readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js")
    + await readText("apps/ai-gateway-service/src/ui/components/YiyiAvatarLayer.js")
    + await readText("apps/ai-gateway-service/src/ui/components/YiyiEmotionPanel.js");
}

export async function writePhaseResult({ resultPath, result, reportPath, reportLines }) {
  await writeJson(resultPath, result);
  if (reportPath) await writeText(reportPath, reportLines.join("\n"));
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
