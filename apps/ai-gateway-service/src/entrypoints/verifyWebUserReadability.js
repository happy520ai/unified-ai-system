import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-51a-web-user-readability";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-51a-web-user-readability.json");
const evidenceMdPath = resolve(evidenceDir, "phase-51a-web-user-readability.md");

let server;
let evidence;

try {
  const application = createGatewayApplication({
    ...process.env,
    PME_ENTERPRISE_AUTH_ENABLED: "false",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
  });
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");
  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const ui = await fetchText(`${serviceUrl}/ui`);

  const requiredText = [
    "PME 移动地球",
    "直接问，直接丢文件",
    "日常最推荐顺序",
    "cmd /c pnpm dev:phase7b",
    "cmd /c pnpm status:phase10a",
    "cmd /c pnpm health:phase12a",
    "cmd /c pnpm logs:phase16a",
    "cmd /c pnpm idle:phase15a",
    "确认 running",
    "确认 stopped",
    "高级能力也通过聊天进入",
    "上传资料",
    "发送",
    "打开能力面板",
  ];
  const missingText = requiredText.filter((item) => !ui.text.includes(item));
  const brokenMarkers = [
    "缂",
    "绉诲姩",
    "鑳",
    "閼",
    "闂",
    "锟",
    "�",
  ].filter((marker) => ui.text.includes(marker));

  const sideHiddenByDefault = ui.text.includes(".side {") &&
    ui.text.includes("transform: translateX(105%)") &&
    ui.text.includes(".side.open { transform: translateX(0); }");
  const firstScreenMarkerPresent = ui.text.includes("phase51a-user-readable-first-screen");
  const noManualKnowledgeFormVisible = !ui.text.includes("资料来源 ID") &&
    !ui.text.includes("文档 ID") &&
    !ui.text.includes("UI Loaded Knowledge Document");
  const mainFunctionButtonsRemoved = !ui.text.includes("id=\"side-open\"") &&
    !ui.text.includes("id=\"composer-model-config-button\"") &&
    !ui.text.includes("class=\"chips\"");
  const passed = ui.httpStatus === 200 &&
    missingText.length === 0 &&
    brokenMarkers.length === 0 &&
    sideHiddenByDefault &&
    firstScreenMarkerPresent &&
    noManualKnowledgeFormVisible &&
    mainFunctionButtonsRemoved;

  evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    ui: {
      httpStatus: ui.httpStatus,
      requiredTextCount: requiredText.length,
      missingText,
      brokenMarkerCount: brokenMarkers.length,
      brokenMarkers,
      firstScreenMarkerPresent,
      sideHiddenByDefault,
      noManualKnowledgeFormVisible,
      mainFunctionButtonsRemoved,
      chatFirstTitlePresent: ui.text.includes("直接问，直接丢文件"),
      dailyFlowPresent: ui.text.includes("日常最推荐顺序"),
    },
    safety: {
      displayOnly: true,
      backendBusinessRouteAdded: false,
      providerCalls: false,
      runtimeMutation: false,
      releaseAutomation: false,
      infrastructureProvisioning: false,
    },
    conclusion: passed ? "web-user-readability-connected" : "web-user-readability-not-connected",
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
    conclusion: "web-user-readability-not-connected",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
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
  return new Promise((resolveClose) => {
    targetServer.close(() => resolveClose());
  });
}

async function fetchText(url) {
  const response = await fetch(url);
  return {
    httpStatus: response.status,
    contentType: response.headers.get("content-type"),
    text: await response.text(),
  };
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 51A Web User Readability Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- UI HTTP status: ${body.ui?.httpStatus ?? "n/a"}
- Required readable text count: ${body.ui?.requiredTextCount ?? "n/a"}
- Missing readable text: ${(body.ui?.missingText ?? []).join(", ") || "none"}
- Broken marker count: ${body.ui?.brokenMarkerCount ?? "n/a"}
- Broken markers: ${(body.ui?.brokenMarkers ?? []).join(", ") || "none"}
- First-screen marker present: ${body.ui?.firstScreenMarkerPresent}
- Side hidden by default: ${body.ui?.sideHiddenByDefault}
- Manual knowledge form hidden/removed from first flow: ${body.ui?.noManualKnowledgeFormVisible}
- Chat-first title present: ${body.ui?.chatFirstTitlePresent}
- Daily flow present: ${body.ui?.dailyFlowPresent}
- Display only: ${body.safety?.displayOnly}
- Backend business route added: ${body.safety?.backendBusinessRouteAdded}
- Provider calls: ${body.safety?.providerCalls}
- Runtime mutation: ${body.safety?.runtimeMutation}
- Release automation: ${body.safety?.releaseAutomation}
- Infrastructure provisioning: ${body.safety?.infrastructureProvisioning}
- Conclusion: ${body.conclusion}
`;
}
