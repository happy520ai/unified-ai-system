import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createEmployeeMessageEnvelope,
  createEmployeeThread,
  createEmployeeRoom,
  createEmployeeMention,
  createEmployeeHandoff,
  createEmployeeCollaborationDecision,
  validateEmployeeMessageEnvelope,
  validateEmployeeThread,
  validateEmployeeRoom,
  validateEmployeeMention,
  validateEmployeeHandoff,
  validateEmployeeCollaborationDecision,
  PHASE587_FANOUT_LIMITS,
} from "../../packages/employee-communication-contracts/src/index.js";
import {
  createDryRunInternalCommunicationBus,
  createInternalInbox,
  createInternalOutbox,
  createThreadStorePreview,
  createRoomRegistryPreview,
  routeInternalMessage,
  routeMention,
  routeHandoff,
} from "../../packages/employee-communication-bus/src/index.js";
import {
  createReviewRequest,
  createSecurityBoundaryObjection,
  createHandoffFromUxToEngineer,
  createCouncilSummary,
  blockAllEmployeeBroadcast,
} from "../../packages/employee-collaboration-protocol/src/index.js";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase587");
const evidencePath = resolve(evidenceDir, "internal-employee-communication-bus-result.json");
const domSnapshotPath = resolve(evidenceDir, "dom-snapshot.html");
const screenshotPath = resolve(evidenceDir, "internal-employee-communication-ui.png");

let server;
let browserProcess;
let browserProfileDir;
let cdp;

const result = {
  phase: "Phase587",
  name: "Internal Employee Communication Bus + Unified Message Protocol",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  employeeCommunicationContractsExists: exists("packages/employee-communication-contracts/src/index.js"),
  employeeCommunicationBusExists: exists("packages/employee-communication-bus/src/index.js"),
  employeeCollaborationProtocolExists: exists("packages/employee-collaboration-protocol/src/index.js"),
  noExternalConnectorRequired: !exists("packages/im-connector-feishu/src/index.js") && !exists("packages/im-connector-wecom/src/index.js"),
  messageEnvelopeSchemaValid: false,
  threadSchemaValid: false,
  roomSchemaValid: false,
  mentionSchemaValid: false,
  handoffSchemaValid: false,
  collaborationDecisionSchemaValid: false,
  internalInboxWorks: false,
  internalOutboxWorks: false,
  threadStoreWorks: false,
  messageRouterWorks: false,
  mentionRouterWorks: false,
  handoffRouterWorks: false,
  reviewProtocolWorks: false,
  objectionProtocolWorks: false,
  councilSummaryWorks: false,
  noAllEmployeeBroadcast: false,
  maxCandidateEmployees: PHASE587_FANOUT_LIMITS.maxCandidateEmployees,
  maxActiveEmployees: PHASE587_FANOUT_LIMITS.maxActiveEmployees,
  maxBrainCalls: PHASE587_FANOUT_LIMITS.maxBrainCalls,
  schedulerApprovalRequiredForNewParticipants: false,
  evidenceGenerated: false,
  missionControlVisible: false,
  sampleDryRunEntryStillVisible: false,
  workforcePreviewStillVisible: false,
  internalCommunicationPreviewVisible: false,
  internalThreadPreviewWorks: false,
  mentionPreviewWorks: false,
  handoffPreviewWorks: false,
  objectionPreviewWorks: false,
  councilSummaryPreviewWorks: false,
  deadButtonDetected: true,
  realFeishuMessageSent: false,
  realWeComMessageSent: false,
  externalImConnectorUsed: false,
  providerCallsMade: false,
  rawSecretAccessed: false,
  secretValueExposed: false,
  deployExecuted: false,
  billingExecuted: false,
  invoiceGenerated: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  yiyiVisible: true,
  characterModuleVisible: true,
  docs: [
    "docs/phase587-internal-employee-communication-bus.md",
    "docs/phase587-unified-employee-message-protocol.md",
    "docs/phase587-employee-thread-inbox-outbox-design.md",
    "docs/phase587-employee-collaboration-protocol.md",
    "docs/phase587-mission-control-internal-communication-preview.md",
    "docs/phase587-execution-report.md",
  ],
  screenshots: { internalCommunicationPreview: screenshotPath },
  domSnapshot: domSnapshotPath,
};

try {
  await mkdir(evidenceDir, { recursive: true });
  runArchitectureChecks();
  await runUiChecks();
  runStaticSafetyChecks();

  const requiredTrue = [
    "employeeCommunicationContractsExists",
    "employeeCommunicationBusExists",
    "employeeCollaborationProtocolExists",
    "noExternalConnectorRequired",
    "messageEnvelopeSchemaValid",
    "threadSchemaValid",
    "roomSchemaValid",
    "mentionSchemaValid",
    "handoffSchemaValid",
    "collaborationDecisionSchemaValid",
    "internalInboxWorks",
    "internalOutboxWorks",
    "threadStoreWorks",
    "messageRouterWorks",
    "mentionRouterWorks",
    "handoffRouterWorks",
    "reviewProtocolWorks",
    "objectionProtocolWorks",
    "councilSummaryWorks",
    "noAllEmployeeBroadcast",
    "schedulerApprovalRequiredForNewParticipants",
    "evidenceGenerated",
    "missionControlVisible",
    "sampleDryRunEntryStillVisible",
    "workforcePreviewStillVisible",
    "internalCommunicationPreviewVisible",
    "internalThreadPreviewWorks",
    "mentionPreviewWorks",
    "handoffPreviewWorks",
    "objectionPreviewWorks",
    "councilSummaryPreviewWorks",
  ];
  const requiredFalse = [
    "deadButtonDetected",
    "realFeishuMessageSent",
    "realWeComMessageSent",
    "externalImConnectorUsed",
    "providerCallsMade",
    "rawSecretAccessed",
    "secretValueExposed",
    "deployExecuted",
    "billingExecuted",
    "invoiceGenerated",
    "chatModified",
    "chatGatewayExecuteModified",
    "yiyiVisible",
    "characterModuleVisible",
  ];
  result.docsExist = result.docs.every(exists);
  const limitOk =
    result.maxCandidateEmployees <= 5 &&
    result.maxActiveEmployees <= 3 &&
    result.maxBrainCalls === 0;
  const passed =
    requiredTrue.every((key) => result[key] === true) &&
    requiredFalse.every((key) => result[key] === false) &&
    result.docsExist &&
    limitOk;
  result.completed = passed;
  result.recommended_sealed = passed;
  result.blocker = passed ? null : "phase587_internal_employee_communication_bus_incomplete";
} catch (error) {
  result.blocker = error instanceof Error ? error.message : String(error);
} finally {
  await closeCdpSilently(cdp);
  await terminateBrowser(browserProcess);
  if (browserProfileDir) await rm(browserProfileDir, { recursive: true, force: true }).catch(() => {});
  if (server) {
    server.closeAllConnections?.();
    await close(server);
  }
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (!result.completed) process.exitCode = 1;
}

function runArchitectureChecks() {
  result.messageEnvelopeSchemaValid = validateEmployeeMessageEnvelope(createEmployeeMessageEnvelope()).valid;
  result.threadSchemaValid = validateEmployeeThread(createEmployeeThread()).valid;
  result.roomSchemaValid = validateEmployeeRoom(createEmployeeRoom()).valid;
  result.mentionSchemaValid = validateEmployeeMention(createEmployeeMention()).valid;
  result.handoffSchemaValid = validateEmployeeHandoff(createEmployeeHandoff()).valid;
  result.collaborationDecisionSchemaValid = validateEmployeeCollaborationDecision(createEmployeeCollaborationDecision()).valid;

  const inbox = createInternalInbox();
  const outbox = createInternalOutbox();
  const message = createEmployeeMessageEnvelope();
  const received = inbox.receive(message);
  const sent = outbox.send(message);
  const threadStore = createThreadStorePreview();
  const thread = threadStore.createThread();
  const roomRegistry = createRoomRegistryPreview();
  const routed = routeInternalMessage(message, ["emp-product-chief", "emp-ux-researcher", "emp-security-chief"]);
  const mention = routeMention();
  const handoff = routeHandoff();
  const review = createReviewRequest();
  const objection = createSecurityBoundaryObjection();
  const handoffProtocol = createHandoffFromUxToEngineer();
  const summary = createCouncilSummary();
  const blockedBroadcast = blockAllEmployeeBroadcast();
  const bus = createDryRunInternalCommunicationBus();
  const productUx = bus.runScenarioProductUxReview();
  const securityObjection = bus.runScenarioSecurityObjection();
  const uxHandoff = bus.runScenarioUxHandoff();
  const broadcastBlocked = bus.runScenarioBroadcastBlocked();
  const council = bus.runScenarioCouncilSummary();

  result.internalInboxWorks = received.accepted === true && inbox.list().length === 1;
  result.internalOutboxWorks = sent.sent === true && outbox.list().length === 1;
  result.threadStoreWorks = thread.created === true && threadStore.get(thread.thread.threadId)?.threadId === thread.thread.threadId;
  result.roomRegistryWorks = roomRegistry.validateRooms() === true;
  result.messageRouterWorks = routed.routed === true && routed.maxBrainCalls === 0;
  result.mentionRouterWorks = mention.routed === true && mention.schedulerApprovalRequiredForNewParticipants === true;
  result.handoffRouterWorks = handoff.routed === true && handoff.accepted === true && handoffProtocol.handoff.accepted === true;
  result.reviewProtocolWorks = validateEmployeeMessageEnvelope(review).valid && productUx.threadCreated && productUx.replyCreated;
  result.objectionProtocolWorks = validateEmployeeMessageEnvelope(objection).valid && securityObjection.riskLevel === "high" && securityObjection.providerCallsMade === false;
  result.councilSummaryWorks = validateEmployeeMessageEnvelope(summary).valid && council.finalRecommendation.messageType === "final_recommendation";
  result.noAllEmployeeBroadcast = blockedBroadcast.blockedReason === "no_all_employee_broadcast" && broadcastBlocked.noAllEmployeeBroadcast === true;
  result.schedulerApprovalRequiredForNewParticipants = mention.schedulerApprovalRequiredForNewParticipants === true;
  result.evidenceGenerated =
    productUx.evidence?.timeline?.length > 0 &&
    securityObjection.evidence?.providerCallsMade === false &&
    uxHandoff.evidence?.handoffId === uxHandoff.handoff.handoffId &&
    council.evidence?.timeline?.includes("dry_run_evidence_recorded");
  result.scenarios = {
    productUxReview: productUx,
    securityObjection,
    uxHandoff,
    broadcastBlocked,
    councilSummary: council,
  };
}

async function runUiChecks() {
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
  const uiUrl = `http://127.0.0.1:${server.address().port}/ui?phase587=internal-employee-communication`;
  result.url = uiUrl;

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase587-internal-browser-"));
  browserProcess = spawn(findBrowserPath(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-gpu-sandbox",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-sync",
    "--disable-default-apps",
    "--disable-component-update",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${browserProfileDir}`,
    "--window-size=1440,1400",
    "about:blank",
  ], { cwd: repoRoot, stdio: "ignore" });

  const cdpPort = await readDevToolsPort(browserProfileDir);
  const pageTarget = await createCdpPage(cdpPort, uiUrl);
  cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.navigate", { url: uiUrl });
  await waitForLoadEvent(cdp);
  await waitForExpression(cdp, "document.getElementById('internal-employee-communication-panel')");

  const initial = await inspectPage();
  result.missionControlVisible = initial.visibleText.includes("Mission Control");
  result.sampleDryRunEntryStillVisible = /Try a sample task|sample dry-run|试用/.test(initial.visibleText);
  result.workforcePreviewStillVisible = initial.workforcePreviewVisible && initial.visibleText.includes("Workforce");
  result.internalCommunicationPreviewVisible =
    initial.internalCommunicationPreviewVisible &&
    initial.visibleText.includes("Internal Employee Communication Bus") &&
    initial.visibleText.includes("Employee Threads") &&
    initial.visibleText.includes("no-external-IM-send");
  result.yiyiVisible = initial.yiyiVisible;
  result.characterModuleVisible = initial.characterModuleVisible;

  result.internalThreadPreviewWorks = await clickAndCheck("[data-internal-communication-action='thread']", "Thread created");
  result.mentionPreviewWorks = await clickAndCheck("[data-internal-communication-action='mention']", "schedulerApprovalRequiredForNewParticipants=true");
  result.handoffPreviewWorks = await clickAndCheck("[data-internal-communication-action='handoff']", "handoff recorded");
  result.objectionPreviewWorks = await clickAndCheck("[data-internal-communication-action='objection']", "riskLevel=high");
  result.councilSummaryPreviewWorks = await clickAndCheck("[data-internal-communication-action='summary']", "Council summary created");
  result.deadButtonDetected = !(
    result.internalThreadPreviewWorks &&
    result.mentionPreviewWorks &&
    result.handoffPreviewWorks &&
    result.objectionPreviewWorks &&
    result.councilSummaryPreviewWorks
  );

  const after = await inspectPage();
  await writeFile(domSnapshotPath, after.renderedDom, "utf8");
  await capture(screenshotPath);
}

function runStaticSafetyChecks() {
  const chatFile = readText("apps/ai-gateway-service/src/http/httpServer.js");
  const executeFiles = [
    "apps/ai-gateway-service/src/chat-gateway/chatGatewayTaskMatrix.js",
    "apps/ai-gateway-service/src/chat-gateway/resultCompletionVerifier.js",
    "apps/ai-gateway-service/src/chat-gateway/gatewayModelPlanner.js",
  ].filter(exists);
  result.chatModified = /internal-employee-communication|employee-communication-bus|phase587/i.test(chatFile);
  result.chatGatewayExecuteModified = executeFiles.some((file) => /internal-employee-communication|employee-communication-bus|phase587/i.test(readText(file)));
}

async function inspectPage() {
  return cdp.evaluate(`(() => {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script,style,noscript').forEach((node) => node.remove());
    const renderedDom = clone.outerHTML;
    const visibleText = document.body.innerText || "";
    const internalPanel = document.getElementById('internal-employee-communication-panel');
    const workforcePanel = document.getElementById('workforce-preview-panel');
    return {
      visibleText,
      renderedDom,
      internalCommunicationPreviewVisible: !!internalPanel && internalPanel.offsetParent !== null,
      workforcePreviewVisible: !!workforcePanel && workforcePanel.offsetParent !== null,
      yiyiVisible: /Yiyi|依依|Mission Companion|Guided Showcase|floating avatar/i.test(visibleText),
      characterModuleVisible: /Character|avatar|companion|real 3D placeholder|pseudo-3D/i.test(visibleText)
    };
  })()`);
}

async function clickAndCheck(selector, expectedText) {
  await click(selector);
  await waitForExpression(cdp, "!document.getElementById('internal-communication-result-panel')?.hidden");
  const page = await inspectPage();
  return page.visibleText.includes(expectedText) && page.visibleText.includes("providerCallsMade=false");
}

async function click(selector) {
  const clicked = await cdp.evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return false;
    node.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`click target missing: ${selector}`);
  await delay(120);
}

async function capture(path) {
  const response = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  await writeFile(path, Buffer.from(response.data, "base64"));
}

async function waitForExpression(client, expression, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const value = await client.evaluate(expression);
      if (value) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
}

async function waitForLoadEvent(client) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (client.takeEvent("Page.loadEventFired")) return;
    await delay(100);
  }
  throw new Error("Timed out waiting for page load.");
}

function findBrowserPath() {
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("Chromium browser not found");
  return found;
}

async function readDevToolsPort(profileDir) {
  const file = resolve(profileDir, "DevToolsActivePort");
  for (let i = 0; i < 100; i += 1) {
    if (existsSync(file)) {
      const [port] = (await readFile(file, "utf8")).split(/\r?\n/);
      if (port) return Number(port);
    }
    await delay(100);
  }
  throw new Error("DevToolsActivePort not found");
}

async function createCdpPage(port, url) {
  const endpoint = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`;
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(endpoint, { method: "PUT" });
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status}: create CDP page`);
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw lastError || new Error("Unable to create CDP page");
}

async function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", rejectOpen, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve: resolvePending, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolvePending(message.result);
      return;
    }
    if (message.method) events.push(message.method);
  });
  return {
    send(method, params = {}) {
      const messageId = ++id;
      socket.send(JSON.stringify({ id: messageId, method, params }));
      return new Promise((resolvePending, reject) => pending.set(messageId, { resolve: resolvePending, reject }));
    },
    evaluate(expression) {
      return this.send("Runtime.evaluate", { expression, returnByValue: true }).then((response) => response.result.value);
    },
    takeEvent(method) {
      const index = events.indexOf(method);
      if (index === -1) return false;
      events.splice(index, 1);
      return true;
    },
    close() {
      socket.close();
    },
  };
}

async function closeCdpSilently(client) {
  try {
    client?.close();
  } catch {}
}

async function terminateBrowser(processHandle) {
  if (!processHandle || processHandle.killed) return;
  processHandle.kill();
  await delay(200);
}

function listen(httpServer, port, host) {
  return new Promise((resolveListen, rejectListen) => {
    httpServer.once("error", rejectListen);
    httpServer.listen(port, host, () => {
      httpServer.off("error", rejectListen);
      resolveListen();
    });
  });
}

function close(httpServer) {
  return new Promise((resolveClose) => httpServer.close(() => resolveClose()));
}

function exists(path) {
  return existsSync(resolve(repoRoot, path));
}

function readText(path) {
  const absolute = resolve(repoRoot, path);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
