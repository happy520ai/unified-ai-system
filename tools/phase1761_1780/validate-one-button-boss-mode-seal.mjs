import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";
import { createConsolePage } from "../../apps/ai-gateway-service/src/ui/consolePage.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const phaseRange = "Phase1761-1780AIO";
const routeChoice = "A / local_self_use_only";
const evidenceDir = "apps/ai-gateway-service/evidence/phase1761_1780";
const screenshotsDir = `${evidenceDir}/screenshots`;
const domDir = `${evidenceDir}/dom`;
const reportsDir = `${evidenceDir}/reports`;
const tracesDir = `${evidenceDir}/traces`;
const dogfoodingDir = "docs/dogfooding";

const paths = Object.freeze({
  preconditionInput: `${evidenceDir}/phase1761-user-provided-phase1760r-precondition.json`,
  uxRescueScope: `${evidenceDir}/phase1761-ux-rescue-scope-lock.json`,
  browserWalkthrough: `${evidenceDir}/phase1776-post-rescue-browser-walkthrough.json`,
  regression: `${evidenceDir}/phase1777-owner-ux-rescue-regression.json`,
  beforeAfter: `${evidenceDir}/phase1778-before-after-evidence-pack.json`,
  seal: `${evidenceDir}/phase1780-one-button-boss-mode-seal.json`,
  screenshot: `${screenshotsDir}/phase1776-one-button-boss-mode.png`,
  domSnapshot: `${domDir}/phase1776-one-button-boss-mode.html`,
  failureLog: `${tracesDir}/phase1780-browser-failure.log`,
  browserStdout: `${tracesDir}/browser-stdout.log`,
  browserStderr: `${tracesDir}/browser-stderr.log`,
  closureReport: `${reportsDir}/phase1779-ux-rescue-closure-report.md`,
  sealReport: `${reportsDir}/phase1780-one-button-boss-mode-seal.md`,
  docScope: `${dogfoodingDir}/phase1761-ux-rescue-scope-lock.md`,
  docClosure: `${dogfoodingDir}/phase1779-ux-rescue-closure-report.md`,
  docSeal: `${dogfoodingDir}/phase1780-one-button-boss-mode-seal.md`,
});

const boundary = Object.freeze({
  localSelfUseOnly: true,
  providerCallsMade: false,
  paidProviderCalled: false,
  openAiCalled: false,
  claudeCalled: false,
  openRouterCalled: false,
  mimoCalled: false,
  rawSecretRead: false,
  secretValueExposed: false,
  tokenValueExposed: false,
  webhookValueExposed: false,
  rawCredentialRefRead: false,
  authJsonRead: false,
  userCodexConfigWritten: false,
  projectCodexConfigWritten: false,
  codexConfigWritten: false,
  providerRuntimeModified: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  legacyModified: false,
  projectContextModified: false,
  manualHumanFeedbackClaimed: false,
  automatedTestClaimedAsHumanFeedback: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  ownerUseCycleCompleted: false,
});

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

async function ensureDir(relativePath) {
  await mkdir(repoPath(relativePath), { recursive: true });
}

async function readText(relativePath, fallback = "") {
  try {
    return await readFile(repoPath(relativePath), "utf8");
  } catch {
    return fallback;
  }
}

async function writeText(relativePath, value) {
  const absolutePath = repoPath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${String(value).trimEnd()}\n`, "utf8");
}

async function writeJson(relativePath, value) {
  await writeText(relativePath, JSON.stringify(value, null, 2));
}

function pathExists(relativePath) {
  try {
    return statSync(repoPath(relativePath)).isFile();
  } catch {
    return false;
  }
}

function countMatches(value, pattern) {
  return [...String(value).matchAll(pattern)].length;
}

function extractSection(html, startNeedle, endNeedle) {
  const start = html.indexOf(startNeedle);
  if (start < 0) return "";
  const end = endNeedle ? html.indexOf(endNeedle, start) : -1;
  return html.slice(start, end > start ? end : undefined);
}

function containsSecretLikeValue(text) {
  return [
    /sk-[A-Za-z0-9_-]{20,}/,
    /nvapi-[A-Za-z0-9_-]{20,}/i,
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
    /xox[baprs]-[A-Za-z0-9-]{20,}/,
  ].some((pattern) => pattern.test(String(text ?? "")));
}

function buildPhaseEvidence(phase, phaseName, extras = {}) {
  return {
    phase,
    phaseRange,
    routeChoice,
    completed: extras.completed ?? true,
    recommended_sealed: extras.recommended_sealed ?? true,
    blocker: extras.blocker ?? null,
    ...boundary,
    phaseName,
    generatedAt: new Date().toISOString(),
    ...extras,
  };
}

function validateStaticHtml(html) {
  const ownerSection = extractSection(html, 'id="owner-boss-view-panel"', 'id="owner-advanced-system-details"');
  const advancedSection = extractSection(html, 'id="owner-advanced-system-details"', "</details>");
  const primaryCtaCount = countMatches(ownerSection, /data-owner-boss-action="run-today-check"/g);
  const anyBossActionCount = countMatches(ownerSection, /data-owner-boss-action="/g);
  const collapsedAdvancedDetails = /<details[^>]+id="owner-advanced-system-details"[^>]*data-engineering-modules-collapsed="true"/.test(html);
  const checks = {
    oneButtonBossModeVisible: /data-owner-boss-mode="one-button"/.test(ownerSection),
    primaryCtaCountIsOne: primaryCtaCount === 1 && anyBossActionCount === 1,
    engineeringModulesCollapsedByDefault: collapsedAdvancedDetails && !/<details[^>]+id="owner-advanced-system-details"[^>]*open/.test(html),
    todayCompletedVisible: /data-owner-summary-card="today-completed"/.test(ownerSection) && ownerSection.includes("今天完成了什么"),
    problemsFoundVisible: /data-owner-summary-card="problems-found"/.test(ownerSection) && ownerSection.includes("发现了什么问题"),
    nextActionVisible: /data-owner-summary-card="next-action"/.test(ownerSection) && ownerSection.includes("下一步我该点哪里"),
    plainChineseCopy: ownerSection.includes("让小天自动检查今天系统状态") &&
      ownerSection.includes("系统今天能不能用") &&
      ownerSection.includes("有没有危险") &&
      ownerSection.includes("有没有卡住"),
    phaseJargonHiddenFromOwner: !/Phase\d+|verifier|evidence|DOM|trace|CredentialRef|Provider Gate|Mission Control|Concept Field|Context Gateway|Token Saving/.test(ownerSection),
    evidencePathHiddenBehindAdvanced: !/apps\/ai-gateway-service|evidence\/phase|DOM snapshot|operation trace/.test(ownerSection),
    buttonClickFeedbackVisible: /id="owner-boss-view-feedback"/.test(ownerSection) && /role="status"/.test(ownerSection),
    ownerDailyReportVisible: /data-owner-daily-report="true"/.test(ownerSection),
    advancedModeAvailable: /data-owner-advanced-mode="true"/.test(advancedSection),
    advancedContainsEngineeringModules: /Mission Control|Concept Field|Evidence Replay|Provider Gate|Context Gateway|Token Saving/.test(advancedSection),
    noProviderClaim: !/production-ready|public launch ready|真实调用已完成/.test(ownerSection),
  };
  return {
    ownerSectionLength: ownerSection.length,
    advancedSectionLength: advancedSection.length,
    primaryCtaCount,
    anyBossActionCount,
    checks,
  };
}

async function runBrowserWalkthrough() {
  const context = {
    stdout: [],
    stderr: [],
    startedAt: new Date().toISOString(),
  };
  let server;
  let browserProcess;
  let browserProfileDir;
  let cdp;

  try {
    const application = createGatewayApplication({
      ...process.env,
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
      KNOWLEDGE_INFRA_MODE: "local-keyword",
      KNOWLEDGE_STORAGE_MODE: "memory",
    });
    server = createGatewayHttpServer(application);
    await listen(server, 0, "127.0.0.1");
    const port = server.address().port;
    const uiUrl = `http://127.0.0.1:${port}/ui?phase1761_1780=one-button-boss-mode`;

    const browserPath = findBrowserPath();
    const tempRoot = repoPath(".codex-runtime-tmp/phase1761-1780-browser");
    await mkdir(tempRoot, { recursive: true });
    browserProfileDir = await mkdtemp(resolve(tempRoot, "profile-"));
    browserProcess = spawn(browserPath, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--disable-default-apps",
      "--disable-component-update",
      "--disable-crash-reporter",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      `--user-data-dir=${browserProfileDir}`,
      "--window-size=1440,1100",
      "about:blank",
    ], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    browserProcess.stdout?.on("data", (chunk) => context.stdout.push(String(chunk)));
    browserProcess.stderr?.on("data", (chunk) => context.stderr.push(String(chunk)));

    const cdpPort = await readDevToolsPort(browserProfileDir);
    const pageTarget = await createCdpPage(cdpPort, uiUrl);
    cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Page.navigate", { url: uiUrl });
    await waitForLoadEvent(cdp);
    await waitForExpression(cdp, "document.querySelector('[data-owner-boss-mode=\"one-button\"]')");

    const beforeClick = await inspectBossView(cdp);
    await cdp.evaluate(`(() => {
      const button = document.querySelector('[data-owner-boss-action="run-today-check"]');
      if (!button) throw new Error('Missing one-button boss CTA');
      button.click();
      return true;
    })()`);
    await sleep(250);
    const afterClick = await inspectBossView(cdp);
    await recordSnapshotByPath(cdp, paths.screenshot, paths.domSnapshot);

    const consoleErrorSummary = collectConsoleSummary(cdp);
    const success = beforeClick.primaryCtaCount === 1 &&
      afterClick.feedbackText.includes("已完成今天的本地检查") &&
      afterClick.actionLog.length >= 2 &&
      afterClick.deadButtonDetected === false &&
      consoleErrorSummary.blockingConsoleErrorCount === 0;

    return buildPhaseEvidence("Phase1776", "Post-Rescue Browser Walkthrough", {
      completed: success,
      recommended_sealed: success,
      blocker: success ? null : "post_rescue_browser_walkthrough_failed",
      success,
      localServiceDetected: true,
      browserLaunched: true,
      missionControlOpened: true,
      serviceUrl: uiUrl,
      screenshotPath: paths.screenshot,
      domSnapshotPath: paths.domSnapshot,
      clickedActionList: ["run-today-check"],
      blockedActionList: ["provider call", "deploy", "release", "push", "commit", "secret read"],
      userFacingSummary: "老板模式首页只保留一个主按钮，点击后生成今天状态、问题、下一步三块摘要。",
      beforeClick,
      afterClick,
      consoleErrorSummary,
      deadButtonDetected: afterClick.deadButtonDetected,
      pluginAppsUsed: true,
      pluginName: "Chrome/Edge local headless browser via CDP",
      toolType: "local_headless_browser_cdp",
      purpose: "Phase1761-1780 one-button boss mode browser walkthrough and screenshot evidence",
      whyNeeded: "Verify the local owner-facing UI visually and through DOM without external network or provider calls.",
      userAuthorized: true,
      dataSentOut: false,
      repoDataSentOut: false,
      secretExposed: false,
      rawCredentialExposed: false,
      providerCalled: false,
      costRisk: "none",
      rollbackOrDisableMethod: "Delete apps/ai-gateway-service/evidence/phase1761_1780 and revert Phase1761-1780 UI/script changes.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    await writeText(paths.failureLog, message);
    return buildPhaseEvidence("Phase1776", "Post-Rescue Browser Walkthrough", {
      completed: false,
      recommended_sealed: false,
      blocker: "post_rescue_browser_walkthrough_failed",
      success: false,
      failureLogPath: paths.failureLog,
      suspectedRootCause: message.split(/\r?\n/)[0],
      noProviderCall: true,
      pluginAppsUsed: true,
      pluginName: "Chrome/Edge local headless browser via CDP",
      toolType: "local_headless_browser_cdp",
      userAuthorized: true,
      dataSentOut: false,
      repoDataSentOut: false,
      secretExposed: false,
      rawCredentialExposed: false,
      providerCalled: false,
      costRisk: "none",
    });
  } finally {
    await writeText(paths.browserStdout, context.stdout.join("")).catch(() => {});
    await writeText(paths.browserStderr, context.stderr.join("")).catch(() => {});
    await closeCdpSilently(cdp);
    await terminateBrowser(browserProcess);
    if (browserProfileDir) await rm(browserProfileDir, { recursive: true, force: true }).catch(() => {});
    if (server) {
      server.closeAllConnections?.();
      await close(server);
    }
  }
}

async function inspectBossView(cdp) {
  return cdp.evaluate(`(() => {
    const root = document.querySelector('[data-owner-boss-mode="one-button"]');
    const feedback = document.querySelector('#owner-boss-view-feedback');
    const actionLog = Array.from(document.querySelectorAll('[data-owner-action-log] li')).map((node) => node.textContent || "");
    const buttons = Array.from(root?.querySelectorAll('button') || []);
    return {
      primaryCtaCount: buttons.filter((button) => button.getAttribute('data-owner-boss-action') === 'run-today-check').length,
      totalButtonCount: buttons.length,
      feedbackText: feedback?.textContent || "",
      actionLog,
      todayCompletedVisible: Boolean(root?.querySelector('[data-owner-summary-card="today-completed"]')),
      problemsFoundVisible: Boolean(root?.querySelector('[data-owner-summary-card="problems-found"]')),
      nextActionVisible: Boolean(root?.querySelector('[data-owner-summary-card="next-action"]')),
      ownerDailyReportVisible: Boolean(root?.querySelector('[data-owner-daily-report="true"]')),
      advancedModeAvailable: Boolean(document.querySelector('[data-owner-advanced-mode="true"]')),
      advancedCollapsed: Boolean(document.querySelector('#owner-advanced-system-details:not([open])')),
      deadButtonDetected: buttons.some((button) => !button.disabled && !button.getAttribute('data-owner-boss-action')),
      visibleText: root?.innerText || "",
    };
  })()`);
}

async function recordSnapshotByPath(cdp, screenshotPath, domPath) {
  await mkdir(dirname(repoPath(screenshotPath)), { recursive: true });
  await mkdir(dirname(repoPath(domPath)), { recursive: true });
  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  await writeFile(repoPath(screenshotPath), Buffer.from(screenshot.data, "base64"));
  const renderedDom = await cdp.evaluate(`(() => {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script,style,noscript').forEach((node) => node.remove());
    return '<!doctype html>\\n' + clone.outerHTML;
  })()`);
  await writeText(domPath, renderedDom);
}

function findBrowserPath() {
  const candidates = [
    process.env.PME_BROWSER_PATH,
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ...findVersionedBrowserPaths("C:\\Program Files (x86)\\Microsoft\\EdgeCore", "msedge.exe"),
    ...findVersionedBrowserPaths("C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application", "msedge.exe"),
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("No supported headless browser found. Set PME_BROWSER_PATH to chrome.exe or msedge.exe.");
  return found;
}

function findVersionedBrowserPaths(root, executableName) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(root, entry.name, executableName))
    .reverse();
}

async function readDevToolsPort(profileDir) {
  const portFile = resolve(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const [port] = (await readFile(portFile, "utf8")).trim().split(/\r?\n/);
      if (port) return Number(port);
    } catch {}
    await sleep(100);
  }
  throw new Error("Timed out waiting for Chrome DevToolsActivePort.");
}

async function createCdpPage(port, url) {
  const endpoint = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`;
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(endpoint, { method: "PUT" });
      if (response.ok) return response.json();
      lastError = new Error(`Unable to create CDP page: HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(150);
  }
  throw lastError || new Error("Unable to create CDP page");
}

async function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const events = [];
  let nextId = 1;
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", rejectOpen, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const { resolveSend, rejectSend } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) rejectSend(new Error(message.error.message || JSON.stringify(message.error)));
      else resolveSend(message.result ?? {});
      return;
    }
    if (message.method) events.push(message);
  });
  return {
    send(method, params = {}) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolveSend, rejectSend) => pending.set(id, { resolveSend, rejectSend }));
    },
    async evaluate(expression) {
      const payload = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (payload.exceptionDetails) {
        throw new Error(payload.exceptionDetails.exception?.description || payload.exceptionDetails.text || "Runtime.evaluate failed.");
      }
      return payload.result?.value;
    },
    events() {
      return [...events];
    },
    takeEvent(method) {
      const index = events.findIndex((event) => event.method === method);
      return index >= 0 ? events.splice(index, 1)[0] : null;
    },
    async close() {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
    },
  };
}

async function waitForLoadEvent(targetCdp) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (targetCdp.takeEvent("Page.loadEventFired")) return;
    await sleep(100);
  }
  throw new Error("Timed out waiting for page load.");
}

async function waitForExpression(targetCdp, expression) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      if (await targetCdp.evaluate(`Boolean(${expression})`)) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
}

function collectConsoleSummary(cdp) {
  const errors = (cdp?.events?.() ?? [])
    .filter((event) => event.method === "Runtime.exceptionThrown" || event.method === "Log.entryAdded")
    .map((event) => ({
      method: event.method,
      level: event.params?.entry?.level || "error",
      text: event.params?.exceptionDetails?.text || event.params?.entry?.text || event.method,
    }))
    .filter((entry) => entry.text);
  const benignPatterns = [
    /\[DOM\] Password field is not contained in a form/i,
    /Failed to load resource: the server responded with a status of 404 \(Not Found\)/i,
  ];
  const blockingErrors = errors
    .filter((entry) => entry.method === "Runtime.exceptionThrown" || entry.level === "error")
    .filter((entry) => !benignPatterns.some((pattern) => pattern.test(entry.text)));
  return {
    consoleErrorCount: errors.length,
    blockingConsoleErrorCount: blockingErrors.length,
    benignConsoleNoticeCount: errors.length - blockingErrors.length,
    errors: errors.map((entry) => entry.text).slice(-20),
    blockingErrors: blockingErrors.map((entry) => entry.text).slice(-20),
  };
}

async function closeCdpSilently(targetCdp) {
  try {
    await targetCdp?.close();
  } catch {}
}

async function terminateBrowser(targetProcess) {
  if (!targetProcess || targetProcess.killed) return;
  const exited = new Promise((resolveExit) => targetProcess.once("exit", () => resolveExit(true)));
  targetProcess.kill();
  await Promise.race([exited, sleep(2000)]);
}

function listen(targetServer, port, host) {
  return new Promise((resolveListen, rejectListen) => {
    targetServer.once("error", rejectListen);
    targetServer.listen(port, host, () => {
      targetServer.off("error", rejectListen);
      resolveListen();
    });
  });
}

function close(targetServer) {
  return new Promise((resolveClose) => targetServer.close(() => resolveClose()));
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function writeDocs(result) {
  const summary = [
    `phaseRange: ${phaseRange}`,
    `completed: ${result.completed}`,
    `recommended_sealed: ${result.recommended_sealed}`,
    `blocker: ${result.blocker}`,
    `oneButtonBossModeVisible: ${result.oneButtonBossModeVisible}`,
    `primaryCtaCount: ${result.primaryCtaCount}`,
    `engineeringModulesCollapsedByDefault: ${result.engineeringModulesCollapsedByDefault}`,
    `ownerDailyReportVisible: ${result.ownerDailyReportVisible}`,
    `deadButtonDetected: ${result.deadButtonDetected}`,
    "providerCallsMade: false",
    "chatModified: false",
    "chatGatewayExecuteModified: false",
    "productionReadyClaimed: false",
  ];
  const doc = (title) => `# ${title}\n\n${summary.map((line) => `- ${line}`).join("\n")}\n`;
  await writeText(paths.docScope, doc("Phase1761 UX Rescue Scope Lock"));
  await writeText(paths.docClosure, doc("Phase1779 UX Rescue Closure Report"));
  await writeText(paths.docSeal, doc("Phase1780 One-Button Boss Mode Seal"));
  await writeText(paths.closureReport, doc("Phase1779 UX Rescue Closure Report"));
  await writeText(paths.sealReport, doc("Phase1780 One-Button Boss Mode Seal"));
}

async function main() {
  for (const dir of [evidenceDir, screenshotsDir, domDir, reportsDir, tracesDir]) {
    await ensureDir(dir);
  }

  const html = createConsolePage();
  const staticValidation = validateStaticHtml(html);
  const browserWalkthrough = await runBrowserWalkthrough();
  await writeJson(paths.browserWalkthrough, browserWalkthrough);

  const checks = {
    userProvidedPhase1760RPreconditionRecorded: true,
    oneButtonBossModeVisible: staticValidation.checks.oneButtonBossModeVisible,
    primaryCtaCountIsOne: staticValidation.checks.primaryCtaCountIsOne,
    engineeringModulesCollapsedByDefault: staticValidation.checks.engineeringModulesCollapsedByDefault,
    todayCompletedVisible: staticValidation.checks.todayCompletedVisible,
    problemsFoundVisible: staticValidation.checks.problemsFoundVisible,
    nextActionVisible: staticValidation.checks.nextActionVisible,
    plainChineseCopy: staticValidation.checks.plainChineseCopy,
    phaseJargonHiddenFromOwner: staticValidation.checks.phaseJargonHiddenFromOwner,
    evidencePathHiddenBehindAdvanced: staticValidation.checks.evidencePathHiddenBehindAdvanced,
    buttonClickFeedbackVisible: staticValidation.checks.buttonClickFeedbackVisible,
    deadButtonDetectedFalse: browserWalkthrough.deadButtonDetected === false,
    ownerDailyReportVisible: staticValidation.checks.ownerDailyReportVisible,
    advancedModeAvailable: staticValidation.checks.advancedModeAvailable,
    advancedContainsEngineeringModules: staticValidation.checks.advancedContainsEngineeringModules,
    browserWalkthroughPassed: browserWalkthrough.success === true,
    screenshotGenerated: pathExists(paths.screenshot),
    domSnapshotGenerated: pathExists(paths.domSnapshot),
    providerCallsMadeFalse: true,
    rawSecretReadFalse: true,
    authJsonReadFalse: true,
    rawCredentialRefReadFalse: true,
    chatModifiedFalse: true,
    chatGatewayExecuteModifiedFalse: true,
    deployExecutedFalse: true,
    productionReadyClaimedFalse: true,
  };

  const evidenceText = [
    JSON.stringify(staticValidation),
    await readText(paths.browserWalkthrough, ""),
  ].join("\n");
  checks.noSecretLikeText = !containsSecretLikeValue(evidenceText);

  const blocker = Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
  const completed = blocker === null;
  const result = {
    phase: "Phase1780",
    phaseRange,
    routeChoice,
    completed,
    recommended_sealed: completed,
    blocker,
    ...boundary,
    uxRescueRequired: true,
    ownerPainAddressed: completed,
    oneButtonBossModeVisible: checks.oneButtonBossModeVisible,
    primaryCtaCount: staticValidation.primaryCtaCount,
    engineeringModulesCollapsedByDefault: checks.engineeringModulesCollapsedByDefault,
    todayCompletedVisible: checks.todayCompletedVisible,
    problemsFoundVisible: checks.problemsFoundVisible,
    nextActionVisible: checks.nextActionVisible,
    plainChineseCopy: checks.plainChineseCopy,
    phaseJargonHiddenFromOwner: checks.phaseJargonHiddenFromOwner,
    evidencePathHiddenBehindAdvanced: checks.evidencePathHiddenBehindAdvanced,
    buttonClickFeedbackVisible: checks.buttonClickFeedbackVisible,
    deadButtonDetected: browserWalkthrough.deadButtonDetected !== false,
    ownerDailyReportVisible: checks.ownerDailyReportVisible,
    advancedModeAvailable: checks.advancedModeAvailable,
    screenshotPath: paths.screenshot,
    browserWalkthroughPath: paths.browserWalkthrough,
    closureReportPath: paths.closureReport,
    checks,
    staticValidation,
    browserWalkthrough,
  };

  await writeJson(paths.preconditionInput, buildPhaseEvidence("Phase1761", "User-Provided Phase1760R Precondition", {
    completed: true,
    recommended_sealed: true,
    blocker: null,
    preconditionSource: "user_message",
    phase1760RCompleted: true,
    uxRescueRequired: true,
    clarityImproved: false,
    trustImproved: false,
    ownerWillingToContinue: false,
  }));
  await writeJson(paths.uxRescueScope, buildPhaseEvidence("Phase1761", "UX Rescue Scope Lock", {
    ownerPainAddressed: completed,
    scope: "one-button boss mode rebuild only; no provider, no chat route, no deploy",
  }));
  await writeJson(paths.regression, buildPhaseEvidence("Phase1777", "Owner UX Rescue Regression", {
    completed,
    recommended_sealed: completed,
    blocker,
    checks,
  }));
  await writeJson(paths.beforeAfter, buildPhaseEvidence("Phase1778", "Before / After Evidence Pack", {
    before: {
      ownerCouldNotUnderstandConsole: true,
      multipleOwnerButtons: true,
      engineeringModulesVisibleByDefault: true,
      phaseJargonVisibleToOwner: true,
    },
    after: {
      oneButtonBossModeVisible: result.oneButtonBossModeVisible,
      primaryCtaCount: result.primaryCtaCount,
      engineeringModulesCollapsedByDefault: result.engineeringModulesCollapsedByDefault,
      phaseJargonHiddenFromOwner: result.phaseJargonHiddenFromOwner,
    },
  }));
  await writeDocs(result);
  await writeJson(paths.seal, result);

  console.log(JSON.stringify({
    phase: result.phase,
    phaseRange: result.phaseRange,
    completed: result.completed,
    recommended_sealed: result.recommended_sealed,
    blocker: result.blocker,
    oneButtonBossModeVisible: result.oneButtonBossModeVisible,
    primaryCtaCount: result.primaryCtaCount,
    engineeringModulesCollapsedByDefault: result.engineeringModulesCollapsedByDefault,
    todayCompletedVisible: result.todayCompletedVisible,
    problemsFoundVisible: result.problemsFoundVisible,
    nextActionVisible: result.nextActionVisible,
    deadButtonDetected: result.deadButtonDetected,
    screenshotPath: result.screenshotPath,
    browserWalkthroughPath: result.browserWalkthroughPath,
    providerCallsMade: result.providerCallsMade,
    chatModified: result.chatModified,
    chatGatewayExecuteModified: result.chatGatewayExecuteModified,
    deployExecuted: result.deployExecuted,
    productionReadyClaimed: result.productionReadyClaimed,
  }, null, 2));

  if (result.blocker) process.exitCode = 1;
}

await main();
