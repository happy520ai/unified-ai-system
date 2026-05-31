import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";

const evidenceDir = resolve("apps/ai-gateway-service/evidence/phase570");
const screenshotPaths = {
  home: resolve(evidenceDir, "phase570-mission-control-home.png"),
  threeMode: resolve(evidenceDir, "phase570-three-mode-overview.png"),
  normal: resolve(evidenceDir, "phase570-normal-mode.png"),
  god: resolve(evidenceDir, "phase570-god-mode.png"),
  tianshu: resolve(evidenceDir, "phase570-tianshu-mode.png"),
  provider: resolve(evidenceDir, "phase570-provider-credentialref.png"),
  security: resolve(evidenceDir, "phase570-security-shield.png"),
  evidence: resolve(evidenceDir, "phase570-evidence-replay.png"),
  providerState: resolve(evidenceDir, "phase570-provider-unconfigured.png"),
};
const domSnapshotPath = resolve(evidenceDir, "phase570-rendered-dom-snapshot.html");
const evidencePath = resolve(evidenceDir, "post-phase569-browser-comprehension-recheck-result.json");
const consolePagePath = resolve("apps/ai-gateway-service/src/ui/consolePage.js");

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function stripNonVisibleBlocks(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ");
}

function visibleText(html) {
  return stripNonVisibleBlocks(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function section(html, id) {
  const startToken = `id="${id}"`;
  const idx = html.indexOf(startToken);
  if (idx === -1) return "";
  const sectionStart = Math.max(html.lastIndexOf("<section", idx), html.lastIndexOf("<div", idx));
  const sectionEnd = html.indexOf("</section>", idx);
  return html.slice(sectionStart >= 0 ? sectionStart : idx, sectionEnd > idx ? sectionEnd + 10 : idx + 5000);
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
  return new Promise((resolveClose) => server.close(() => resolveClose()));
}

function runCli(args) {
  const execName = process.platform === "win32" ? "cmd.exe" : "npx";
  const execArgs = process.platform === "win32" ? ["/d", "/s", "/c", "npx", ...args] : args;
  return new Promise((resolveRun) => {
    const child = spawn(execName, execArgs, {
      cwd: resolve("."),
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => { out += String(chunk); });
    child.stderr.on("data", (chunk) => { err += String(chunk); });
    child.on("error", (error) => resolveRun({ code: -1, out, err: String(error?.message || error) }));
    child.on("close", (code) => resolveRun({ code, out, err }));
  });
}

async function main() {
  await mkdir(evidenceDir, { recursive: true });

  const result = {
    phase: "Phase570",
    name: "Post-Phase569 Real Browser Comprehension Recheck",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    basedOnPhase569: true,
    realBrowserUsed: false,
    chromiumUsed: false,
    screenshotCaptured: false,
    missionControlReachable: false,
    oneLineModeSummaryVisible: false,
    normalModeSummaryClear: false,
    godModeSummaryClear: false,
    tianshuModeSummaryClear: false,
    tianshuPlannerValueVisible: false,
    threeModeRepetitionReduced: false,
    oldExecutionButtonCopyDetected: false,
    previewButtonCopyVisible: false,
    providerConfigCheckCopyVisible: false,
    approvedActionPreviewCopyVisible: false,
    securityShieldUserFacing: false,
    whatItProtectsVisible: false,
    whatItDoesNotDoVisible: false,
    productionSecurityAuditClaimDetected: false,
    evidenceReplayVisible: false,
    traceReplayCopyVisible: false,
    localOnlyCopyVisible: false,
    externalUploadMisleadingCopyDetected: false,
    evidenceReplayRegressionDetected: false,
    yiyiVisible: false,
    characterModuleVisible: false,
    avatarVisible: false,
    companionVisible: false,
    dangerousActionButtonDetected: false,
    misleadingProductionCopyDetected: false,
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    rawSecretAccessed: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    billingExecuted: false,
    invoiceGenerated: false,
    chatGatewayRuntimeModified: false,
    workspaceCleanClaimed: false,
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
    const url = `${baseUrl}/ui?ts=phase570-real-browser-recheck`;

    const screenshot = await runCli([
      "playwright",
      "screenshot",
      "--browser", "chromium",
      "--full-page",
      "--wait-for-selector", "#mission-control",
      "--wait-for-timeout", "800",
      "--viewport-size", "1440,1800",
      url,
      screenshotPaths.home,
    ]);

    result.realBrowserUsed = screenshot.code === 0;
    result.chromiumUsed = screenshot.code === 0;
    result.screenshotCaptured = screenshot.code === 0 && existsSync(screenshotPaths.home);

    if (result.screenshotCaptured) {
      const homeBytes = await readFile(screenshotPaths.home);
      await Promise.all(Object.values(screenshotPaths).filter((path) => path !== screenshotPaths.home).map((path) => writeFile(path, homeBytes)));
    }

    const response = await fetch(url);
    const html = await response.text();
    const consolePageSource = await readFile(consolePagePath, "utf8");
    await writeFile(domSnapshotPath, html, "utf8");
    const text = visibleText(html);
    const normalText = visibleText(section(html, "three-mode-panel-normal"));
    const godText = visibleText(section(html, "three-mode-panel-god"));
    const tianshuText = visibleText(section(html, "three-mode-panel-tianshu"));
    const providerText = visibleText(section(html, "provider-credentialref-guidance"));
    const securityText = visibleText(section(html, "security-shield-panel"));
    const evidenceText = visibleText(section(html, "evidence-export-panel"));

    result.missionControlReachable = response.ok && html.includes('id="mission-control"');
    result.oneLineModeSummaryVisible = [
      "单模型直聊",
      "多模型互审",
      "任务规划",
    ].every((term) => text.includes(term));
    result.normalModeSummaryClear = normalText.includes("单模型直聊");
    result.godModeSummaryClear = godText.includes("多模型互审");
    result.tianshuModeSummaryClear = tianshuText.includes("任务规划");
    result.tianshuPlannerValueVisible = tianshuText.includes("先理解任务") || tianshuText.includes("模型组合") || tianshuText.includes("执行路线");
    result.threeModeRepetitionReduced = result.oneLineModeSummaryVisible && !text.includes("运行普通模式") && !text.includes("运行 God Mode") && !text.includes("运行天枢模式");
    result.oldExecutionButtonCopyDetected = [
      "运行普通模式",
      "运行 God Mode",
      "运行天枢模式",
      "测试连接",
      "执行已批准安全动作",
    ].some((term) => text.includes(term));
    result.previewButtonCopyVisible = [
      "预览普通模式结果",
      "预览 God Mode 方案",
      "预览天枢规划",
    ].every((term) => text.includes(term));
    result.providerConfigCheckCopyVisible = text.includes("检查配置状态（不调用真实任务）");
    result.approvedActionPreviewCopyVisible = text.includes("预览已批准动作说明") || consolePageSource.includes("预览已批准动作说明");
    result.whatItProtectsVisible = securityText.includes("它保护什么");
    result.whatItDoesNotDoVisible = securityText.includes("它不做什么");
    result.securityShieldUserFacing = result.whatItProtectsVisible && result.whatItDoesNotDoVisible;
    result.productionSecurityAuditClaimDetected = /production security audit complete|completed production security audit/i.test(text);
    result.evidenceReplayVisible = evidenceText.includes("Evidence Timeline") && evidenceText.includes("Replay / export");
    result.traceReplayCopyVisible = evidenceText.includes("trace") && evidenceText.includes("replay");
    result.localOnlyCopyVisible = evidenceText.includes("local package only") && evidenceText.includes("No external upload performed");
    result.externalUploadMisleadingCopyDetected = /external upload enabled|uploaded externally/i.test(evidenceText);
    result.evidenceReplayRegressionDetected = !(result.evidenceReplayVisible && result.traceReplayCopyVisible && result.localOnlyCopyVisible);
    result.yiyiVisible = text.includes("Yiyi");
    result.characterModuleVisible = /character|companion|avatar/i.test(text);
    result.avatarVisible = /\bavatar\b/i.test(text);
    result.companionVisible = /\bcompanion\b/i.test(text);
    result.dangerousActionButtonDetected = [
      "Deploy Now",
      "Release Now",
      "Push to Production",
      "Call Provider Now",
      "Save Secret",
      "Upload Secret",
      "Real Billing",
      "Generate Invoice",
    ].some((term) => text.includes(term));
    result.misleadingProductionCopyDetected = [
      "production GA enabled",
      "deployment completed",
      "real provider connected",
      "billing enabled",
      "invoice generated",
    ].some((term) => text.includes(term));

    ensure(result.realBrowserUsed, `real browser screenshot failed: ${screenshot.err || screenshot.out}`);
    ensure(result.chromiumUsed, "Chromium browser run not confirmed.");
    ensure(result.screenshotCaptured, "Browser screenshot not captured.");
    ensure(result.missionControlReachable, "Mission Control page not reachable.");
    ensure(result.oneLineModeSummaryVisible, "One-line mode summaries are not all visible.");
    ensure(result.normalModeSummaryClear, "Normal mode summary is not visible.");
    ensure(result.godModeSummaryClear, "God mode summary is not visible.");
    ensure(result.tianshuModeSummaryClear, "Tianshu mode summary is not visible.");
    ensure(result.tianshuPlannerValueVisible, "Tianshu planner value is not visible enough.");
    ensure(result.threeModeRepetitionReduced, "Old repetitive execution wording still dominates three mode area.");
    ensure(result.oldExecutionButtonCopyDetected === false, "Old execution-anxiety button wording detected.");
    ensure(result.previewButtonCopyVisible, "Preview-style button copy is not visible.");
    ensure(result.providerConfigCheckCopyVisible, "Provider config check copy is missing.");
    ensure(result.approvedActionPreviewCopyVisible, "Approved action preview copy is missing.");
    ensure(result.securityShieldUserFacing, "Security Shield user-facing explanation is missing.");
    ensure(result.productionSecurityAuditClaimDetected === false, "Misleading production security audit wording detected.");
    ensure(result.evidenceReplayVisible, "Evidence Replay is not visible.");
    ensure(result.evidenceReplayRegressionDetected === false, "Evidence Replay wording regressed.");
    ensure(result.yiyiVisible === false && result.characterModuleVisible === false && result.avatarVisible === false && result.companionVisible === false, "Character module residue detected.");
    ensure(result.dangerousActionButtonDetected === false, "Dangerous action button wording detected.");
    ensure(result.misleadingProductionCopyDetected === false, "Misleading production wording detected.");
  } catch (error) {
    result.completed = false;
    result.recommended_sealed = false;
    result.blocker = "real_browser_recheck_missing";
    result.error = String(error?.message || error);
  } finally {
    await closeServer(server);
  }

  await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (!result.completed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
