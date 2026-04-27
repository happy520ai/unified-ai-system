import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-49a-web-chinese-readability";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-49a-web-chinese-readability.json");
const evidenceMdPath = resolve(evidenceDir, "phase-49a-web-chinese-readability.md");

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
    "能力面板",
    "账号与租户",
    "查看登录状态",
    "企业治理",
    "企业总览",
    "查看企业总览",
    "上线前预检",
    "运行上线前预检",
    "企业配置向导",
    "本地检查配置",
    "企业验收报告",
    "查看验收报告",
    "交付候选只读预演",
    "查看交付候选预演",
    "治理健康度",
    "角色 / 权限",
    "安全准备度",
    "部署准备度",
    "启动准备度",
    "托管用户",
    "审计日志",
    "导出审计",
    "长期记忆",
    "外部连接器",
    "评估 / 打分",
    "图谱检索",
    "安全本地业务流程",
    "默认命令",
    "发送",
    "上传资料",
    "支持 PDF / Word .docx / Excel .xls/.xlsx / 文本，单文件 100MB。",
    "原始 JSON 保留在下方",
  ];
  const missingText = requiredText.filter((item) => !ui.text.includes(item));
  const stillHasBrokenMarkers = [
    "绉诲姩鍦扮悆",
    "鑳藉姏闈",
    "鏌ョ湅",
    "瀵煎叆",
    "榛樿",
    "鍙戦",
  ].filter((item) => ui.text.includes(item));

  const passed = ui.httpStatus === 200 && missingText.length === 0 && stillHasBrokenMarkers.length === 0;
  evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    ui: {
      httpStatus: ui.httpStatus,
      requiredTextCount: requiredText.length,
      missingText,
      brokenMarkerCount: stillHasBrokenMarkers.length,
      brokenMarkers: stillHasBrokenMarkers,
      chatFirstTitlePresent: ui.text.includes("直接问，直接丢文件"),
      enterprisePanelPresent: ui.text.includes("企业治理"),
      readableOverviewPresent: ui.text.includes("phase48a-enterprise-overview-readable-summary"),
    },
    safety: {
      backendBusinessRouteAdded: false,
      providerCalls: false,
      runtimeMutation: false,
      releaseAutomation: false,
      infrastructureProvisioning: false,
    },
    conclusion: passed ? "web-chinese-readability-connected" : "web-chinese-readability-not-connected",
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
    conclusion: "web-chinese-readability-not-connected",
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
  return `# Phase 49A Web Chinese Readability Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- UI HTTP status: ${body.ui?.httpStatus ?? "n/a"}
- Required readable text count: ${body.ui?.requiredTextCount ?? "n/a"}
- Missing readable text: ${(body.ui?.missingText ?? []).join(", ") || "none"}
- Broken marker count: ${body.ui?.brokenMarkerCount ?? "n/a"}
- Broken markers: ${(body.ui?.brokenMarkers ?? []).join(", ") || "none"}
- Chat-first title present: ${body.ui?.chatFirstTitlePresent}
- Enterprise panel present: ${body.ui?.enterprisePanelPresent}
- Readable overview present: ${body.ui?.readableOverviewPresent}
- Backend business route added: ${body.safety?.backendBusinessRouteAdded}
- Provider calls: ${body.safety?.providerCalls}
- Runtime mutation: ${body.safety?.runtimeMutation}
- Release automation: ${body.safety?.releaseAutomation}
- Infrastructure provisioning: ${body.safety?.infrastructureProvisioning}
- Conclusion: ${body.conclusion}
`;
}
