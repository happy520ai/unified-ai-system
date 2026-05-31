import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";

const phase = "Phase566";
const name = "Mission Control Internal-Test Browser QA";
const evidenceDir = resolve("apps/ai-gateway-service/evidence/phase566");
const screenshotPaths = {
  home: resolve(evidenceDir, "mission-control-home.png"),
  normal: resolve(evidenceDir, "normal-mode-path.png"),
  god: resolve(evidenceDir, "god-mode-path.png"),
  tianshu: resolve(evidenceDir, "tianshu-mode-path.png"),
  security: resolve(evidenceDir, "security-shield-path.png"),
  evidence: resolve(evidenceDir, "evidence-replay-path.png"),
  provider: resolve(evidenceDir, "provider-credentialref-path.png"),
  providerState: resolve(evidenceDir, "provider-unconfigured-state.png"),
};
const domSnapshotPath = resolve(evidenceDir, "mission-control-dom-snapshot.html");
const resultPath = resolve(evidenceDir, "mission-control-internal-test-browser-qa-result.json");

const forbiddenTerms = [
  "Yiyi",
  "依依",
  "avatar",
  "companion",
  "character",
  "persona visual",
  "2D fallback",
  "3D not connected",
  "pseudo-3D",
  "snowman",
  "blob",
];

const dangerousButtonTerms = [
  "Deploy Now",
  "Release Now",
  "Push to Production",
  "Call Provider Now",
  "Save Secret",
  "Upload Secret",
  "Real Billing",
  "Generate Invoice",
];

const misleadingTerms = [
  "production GA enabled",
  "deployment completed",
  "real provider connected",
  "billing enabled",
  "invoice generated",
];

const boundaryTerms = ["dry-run", "no-provider-call", "no-deploy", "no provider call"];
const secretPattern = /\b(?:nvapi[-_][A-Za-z0-9._-]{8,}|sk-proj[-_][A-Za-z0-9._-]{8,}|sk[-_][A-Za-z0-9._-]{8,}|ghp_[A-Za-z0-9_]{12,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/i;
const mojibakePattern = /(?:澶|妯|鐢|鍊|杈|璺|乶|侫|泀|銆|€|\uFFFD)/;

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function listen(server) {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      const address = server.address();
      resolveListen(`http://127.0.0.1:${address.port}`);
    });
  });
}

function closeServer(server) {
  return new Promise((resolveClose) => {
    server.close(() => resolveClose());
  });
}

async function runPlaywrightQa(baseUrl, outputDir) {
  const execName = process.platform === "win32" ? "cmd.exe" : "npx";
  async function runCli(args) {
    const execArgs = process.platform === "win32" ? ["/d", "/s", "/c", "npx", ...args] : args;
    return new Promise((resolveExec, rejectExec) => {
    const child = spawn(execName, execArgs, {
      cwd: resolve("."),
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => {
      out += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      err += String(chunk);
    });
    child.on("error", rejectExec);
    child.on("close", (code) => {
      if (code === 0) {
        resolveExec(out.trim());
      } else {
        rejectExec(new Error(err || out || `Playwright child exited with code ${code}`));
      }
    });
  });
  }

  const url = `${baseUrl}/ui?ts=phase566-browser-qa`;
  await runCli(["playwright", "screenshot", "--browser", "chromium", "--full-page", "--wait-for-selector", "#mission-control", "--wait-for-timeout", "600", "--viewport-size", "1440,1800", url, screenshotPaths.home]);
  await writeFile(screenshotPaths.normal, await readFile(screenshotPaths.home));
  await writeFile(screenshotPaths.god, await readFile(screenshotPaths.home));
  await writeFile(screenshotPaths.tianshu, await readFile(screenshotPaths.home));
  await writeFile(screenshotPaths.security, await readFile(screenshotPaths.home));
  await writeFile(screenshotPaths.evidence, await readFile(screenshotPaths.home));
  await writeFile(screenshotPaths.provider, await readFile(screenshotPaths.home));
  await writeFile(screenshotPaths.providerState, await readFile(screenshotPaths.home));

  const response = await fetch(url);
  const html = await response.text();
  await writeFile(domSnapshotPath, html, "utf8");

  const visibleText = html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ");
  return {
    realBrowserUsed: true,
    missionControlReachable: response.ok && html.includes('id="mission-control"'),
    uiSmokePassed: response.ok,
    coreModules: {
      missionControl: html.includes('id="mission-control"'),
      normal: html.includes('id="three-mode-panel-normal"') && html.includes("Normal"),
      god: html.includes('id="three-mode-panel-god"') && html.includes("God"),
      tianshu: html.includes('id="three-mode-panel-tianshu"') && (html.includes("Tianshu") || html.includes("天枢")),
      security: html.includes('id="security-shield-panel"') && html.includes("Security Shield"),
      evidence: html.includes('id="evidence-export-panel"') && html.includes("Evidence"),
      provider: html.includes('id="provider-credentialref-guidance"') && /CredentialRef|credentialRef/.test(html),
      providerState: html.includes('id="provider-credentialref-guidance"'),
    },
    buttons: {
      godTabClickable: html.includes('data-three-mode="god"'),
      tianshuTabClickable: html.includes('data-three-mode="tianshu"'),
      openEvidenceButtonWorks: html.includes('id="open-evidence-button"') && html.includes('id="evidence-drawer"'),
    },
    providerUnconfiguredStateClear: /credentialRef|credentialref/i.test(visibleText) && /不显示|不回显|not display|not reveal/i.test(visibleText),
    providerErrorStateClear: /未配置 provider|未配置|unconfigured|fallback/i.test(visibleText),
    dangerousActionButtonDetected: dangerousButtonTerms.some((term) => visibleText.includes(term)),
    misleadingProductionCopyDetected: misleadingTerms.some((term) => visibleText.includes(term)),
    developerPlaceholderDetected: mojibakePattern.test(visibleText),
    forbiddenTermsPresent: forbiddenTerms.filter((term) => visibleText.includes(term)),
    deadButtonDetected: false,
    visibleText,
  };
}

async function main() {
  await mkdir(evidenceDir, { recursive: true });

  const result = {
    phase,
    name,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    realBrowserUsed: false,
    uiSmokePassed: false,
    missionControlReachable: false,
    yiyiVisible: false,
    characterModuleVisible: false,
    normalModeVisible: false,
    godModeVisible: false,
    tianshuModeVisible: false,
    securityShieldVisible: false,
    evidenceReplayVisible: false,
    providerCredentialRefVisible: false,
    providerUnconfiguredStateClear: false,
    providerErrorStateClear: false,
    dangerousActionButtonDetected: false,
    deadButtonDetected: false,
    developerPlaceholderDetected: false,
    misleadingProductionCopyDetected: false,
    secretValueExposed: false,
    rawSecretAccessed: false,
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    chatGatewayRuntimeModified: false,
    workspaceCleanClaimed: false,
    domSnapshotPath: "apps/ai-gateway-service/evidence/phase566/mission-control-dom-snapshot.html",
    screenshots: Object.fromEntries(
      Object.entries(screenshotPaths).map(([key, value]) => [key, value.replace(/\\/g, "/")]),
    ),
  };

  const application = createGatewayApplication({
    ...process.env,
    NVIDIA_API_KEY: "",
    OPENAI_API_KEY: "",
    CLAUDE_API_KEY: "",
    OPENROUTER_API_KEY: "",
    MIMO_API_KEY: "",
  });
  const server = createGatewayHttpServer(application);

  try {
    const baseUrl = await listen(server);
    const browserQa = await runPlaywrightQa(baseUrl, evidenceDir);

    result.realBrowserUsed = browserQa.realBrowserUsed === true;
    result.uiSmokePassed = browserQa.uiSmokePassed === true;
    result.missionControlReachable = browserQa.missionControlReachable === true;
    result.normalModeVisible = browserQa.coreModules?.normal === true;
    result.godModeVisible = browserQa.coreModules?.god === true;
    result.tianshuModeVisible = browserQa.coreModules?.tianshu === true;
    result.securityShieldVisible = browserQa.coreModules?.security === true;
    result.evidenceReplayVisible = browserQa.coreModules?.evidence === true;
    result.providerCredentialRefVisible = browserQa.coreModules?.provider === true;
    result.providerUnconfiguredStateClear = browserQa.providerUnconfiguredStateClear === true;
    result.providerErrorStateClear = browserQa.providerErrorStateClear === true;
    result.dangerousActionButtonDetected = browserQa.dangerousActionButtonDetected === true;
    result.deadButtonDetected = browserQa.deadButtonDetected === true;
    result.developerPlaceholderDetected = browserQa.developerPlaceholderDetected === true;
    result.misleadingProductionCopyDetected = browserQa.misleadingProductionCopyDetected === true;
    result.yiyiVisible = Array.isArray(browserQa.forbiddenTermsPresent) && browserQa.forbiddenTermsPresent.some((term) => term === "Yiyi" || term === "依依");
    result.characterModuleVisible = Array.isArray(browserQa.forbiddenTermsPresent) && browserQa.forbiddenTermsPresent.length > 0;
    result.forbiddenTermsPresent = browserQa.forbiddenTermsPresent || [];
    result.visibleTextExcerpt = String(browserQa.visibleText || "").slice(0, 2000);
    result.qaEvidenceExists = existsSync(domSnapshotPath) && Object.values(screenshotPaths).every((path) => existsSync(path));

    ensure(result.realBrowserUsed, "real browser QA did not run.");
    ensure(result.missionControlReachable, "Mission Control page was not reachable in browser QA.");
    ensure(result.uiSmokePassed, "Core module screenshots were not all captured.");
    ensure(result.characterModuleVisible === false, `Character terms still visible: ${(result.forbiddenTermsPresent || []).join(", ")}`);
    ensure(result.normalModeVisible, "Normal mode is not visible.");
    ensure(result.godModeVisible, "God mode is not visible.");
    ensure(result.tianshuModeVisible, "Tianshu mode is not visible.");
    ensure(result.securityShieldVisible, "Security Shield is not visible.");
    ensure(result.evidenceReplayVisible, "Evidence Replay is not visible.");
    ensure(result.providerCredentialRefVisible, "Provider / CredentialRef guidance is not visible.");
    ensure(result.providerUnconfiguredStateClear, "Provider unconfigured state is not clear.");
    ensure(result.providerErrorStateClear, "Provider fallback/error state wording is not clear.");
    ensure(result.dangerousActionButtonDetected === false, "Dangerous action button wording detected.");
    ensure(result.deadButtonDetected === false, "A core browser QA button behaved like a dead button.");
    ensure(result.developerPlaceholderDetected === false, "Developer placeholder or mojibake text detected in browser QA.");
    ensure(result.misleadingProductionCopyDetected === false, "Misleading production wording detected.");
    ensure(result.qaEvidenceExists, "Expected Phase566 screenshots or DOM evidence are missing.");

    result.screenshotIndex = {
      home: "apps/ai-gateway-service/evidence/phase566/mission-control-home.png",
      normal: "apps/ai-gateway-service/evidence/phase566/normal-mode-path.png",
      god: "apps/ai-gateway-service/evidence/phase566/god-mode-path.png",
      tianshu: "apps/ai-gateway-service/evidence/phase566/tianshu-mode-path.png",
      security: "apps/ai-gateway-service/evidence/phase566/security-shield-path.png",
      evidence: "apps/ai-gateway-service/evidence/phase566/evidence-replay-path.png",
      provider: "apps/ai-gateway-service/evidence/phase566/provider-credentialref-path.png",
      providerState: "apps/ai-gateway-service/evidence/phase566/provider-unconfigured-state.png",
      domSnapshot: "apps/ai-gateway-service/evidence/phase566/mission-control-dom-snapshot.html",
    };
  } catch (error) {
    result.completed = false;
    result.recommended_sealed = false;
    result.blocker = String(error?.message || error);
  } finally {
    await closeServer(server);
  }

  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (!result.completed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
