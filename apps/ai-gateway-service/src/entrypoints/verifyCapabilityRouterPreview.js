import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { createConsolePage } from "../ui/consolePage.js";

const PHASE = "phase-266a-capability-router-preview";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-266a-capability-router-preview.json");
const evidenceMdPath = resolve(evidenceDir, "phase-266a-capability-router-preview.md");
const docPath = resolve(repoRoot, "docs/CAPABILITY_ROUTER_PREVIEW.md");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(repoRoot, "apps/ai-gateway-service/package.json");

let server;
let evidence;

try {
  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ROUTE_MODE: "registry-default",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "memory",
    PME_ENTERPRISE_AUTH_ENABLED: "false",
  });

  application.providerRegistry.addRuntimeModels("local-fake-provider", [
    {
      id: "phase266-coding-reasoner",
      displayName: "Phase266 Coding Reasoner",
      capabilities: ["chat", "coding", "reasoning"],
      source: "phase266-verifier",
    },
    {
      id: "phase266-vision-model",
      displayName: "Phase266 Vision Model",
      capabilities: ["chat", "vision", "reasoning"],
      source: "phase266-verifier",
    },
    {
      id: "phase266-image-generator",
      displayName: "Phase266 Image Generator",
      capabilities: ["image"],
      source: "phase266-verifier",
    },
    {
      id: "phase266-video-generator",
      displayName: "Phase266 Video Generator",
      capabilities: ["video"],
      source: "phase266-verifier",
    },
  ]);

  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");
  const serviceUrl = `http://127.0.0.1:${server.address().port}`;

  const status = await getJson(`${serviceUrl}/models/capability-router/status`);
  const coding = await postJson(`${serviceUrl}/models/capability-router/preview`, {
    task: "Fix a JavaScript bug, update tests, and explain the code risk.",
  });
  const image = await postJson(`${serviceUrl}/models/capability-router/preview`, {
    task: "生成一张产品发布海报和 logo 方向图",
  });
  const video = await postJson(`${serviceUrl}/models/capability-router/preview`, {
    task: "制作一个 30 秒产品介绍视频和分镜",
  });
  const knowledge = await postJson(`${serviceUrl}/models/capability-router/preview`, {
    task: "查询项目 evidence 并说明当前 blocker",
  });

  const html = createConsolePage();
  verifyEmbeddedScriptSyntax(html);
  const doc = await readFile(docPath, "utf8");
  const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));
  const servicePackage = JSON.parse(await readFile(servicePackagePath, "utf8"));

  const checks = {
    statusEndpointOk: status.status === "ok" && status.data?.previewOnly === true,
    previewEndpointOk: coding.status === "ok" && image.status === "ok" && video.status === "ok",
    routerManagerRecorded: status.data?.routerManager?.analysisModelRequiredForAutoMode === true &&
      status.data?.routerManager?.managerModelInvoked === false,
    executionDisabled: [status.data, coding.data, image.data, video.data, knowledge.data].every((data) => {
      return data?.previewOnly === true &&
        data?.executionEnabled === false &&
        data?.autoInvokeSpecializedModels === false &&
        data?.defaultChatLaneChanged === false;
    }),
    codingRouted: coding.data?.task?.requiredCapabilities?.includes("coding") &&
      coding.data?.task?.requiredCapabilities?.includes("reasoning") &&
      coding.data?.recommendation?.selected?.modelId === "phase266-coding-reasoner",
    imageRouted: image.data?.task?.requiredCapabilities?.includes("image-generation") &&
      image.data?.recommendation?.selected?.modelId === "phase266-image-generator",
    videoRouted: video.data?.task?.requiredCapabilities?.includes("video-generation") &&
      video.data?.recommendation?.selected?.modelId === "phase266-video-generator",
    knowledgeDetected: knowledge.data?.task?.requiredCapabilities?.includes("rag") &&
      knowledge.data?.recommendation?.status !== "route-ready-preview",
    noProviderCalls: [status.data, coding.data, image.data, video.data, knowledge.data].every((data) => data?.boundaries?.providerCalls === false),
    uiMarkersPresent: [
      "phase266a-capability-router-preview",
      "Capability Router / 智能模型调度器",
      "Router Manager boundary",
      "managerModelInvoked=false",
      "executionEnabled=false",
      "autoInvokeSpecializedModels=false",
      "defaultChatLaneChanged=false",
      "/models/capability-router/status",
      "/models/capability-router/preview",
      "model-library-view",
      "Full model library / 全量模型库",
      "dataset.capabilityFilter",
      "Select for chat",
      "createFullModelLibrary",
    ].every((marker) => html.includes(marker)),
    docMarkersPresent: [
      "# Capability Router Preview",
      "routerManager.mode=heuristic-preview",
      "analysisModelRequiredForAutoMode=true",
      "executionEnabled=false",
      "autoInvokeSpecializedModels=false",
      "no provider call from the router",
      "no automatic specialized model invocation",
      "no default NVIDIA `/chat` lane change",
    ].every((marker) => doc.includes(marker)),
    scriptsPresent: rootPackage.scripts?.["verify:phase266a-capability-router-preview"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase266a-capability-router-preview" &&
      servicePackage.scripts?.["verify:phase266a-capability-router-preview"] === "node ./src/entrypoints/verifyCapabilityRouterPreview.js",
  };

  const passed = Object.values(checks).every(Boolean);
  evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    checks,
    samples: {
      status: status.data,
      coding: coding.data,
      image: image.data,
      video: video.data,
      knowledge: knowledge.data,
    },
    safety: {
      previewOnly: true,
      providerCalls: false,
      realSpecializedModelInvocation: false,
      defaultChatMainLaneChanged: false,
      codexExecInvoked: false,
      workflowRunnerConnected: false,
      worktreeCreated: false,
      autoCommitPushPr: false,
      apiKeyValueRecorded: false,
    },
    conclusion: passed ? "capability-router-preview-ready" : "capability-router-preview-incomplete",
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
    conclusion: "capability-router-preview-incomplete",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function verifyEmbeddedScriptSyntax(html) {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("Console page script not found.");
  new vm.Script(match[1], { filename: "consolePage-inline.js" });
}

async function getJson(url) {
  const response = await fetch(url);
  const body = await response.json();
  return {
    httpStatus: response.status,
    ...body,
  };
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return {
    httpStatus: response.status,
    ...payload,
  };
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

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 266A Capability Router Preview Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- Status endpoint ok: ${body.checks?.statusEndpointOk}
- Preview endpoint ok: ${body.checks?.previewEndpointOk}
- Router manager recorded: ${body.checks?.routerManagerRecorded}
- Execution disabled: ${body.checks?.executionDisabled}
- Coding routed: ${body.checks?.codingRouted}
- Image routed: ${body.checks?.imageRouted}
- Video routed: ${body.checks?.videoRouted}
- Knowledge detected: ${body.checks?.knowledgeDetected}
- No provider calls: ${body.checks?.noProviderCalls}
- UI markers present: ${body.checks?.uiMarkersPresent}
- Doc markers present: ${body.checks?.docMarkersPresent}
- Scripts present: ${body.checks?.scriptsPresent}
- Preview only: ${body.safety?.previewOnly}
- Real specialized model invocation: ${body.safety?.realSpecializedModelInvocation}
- Default chat main lane changed: ${body.safety?.defaultChatMainLaneChanged}
- Codex exec invoked: ${body.safety?.codexExecInvoked}
- Workflow runner connected: ${body.safety?.workflowRunnerConnected}
- Worktree created: ${body.safety?.worktreeCreated}
- Auto commit/push/PR: ${body.safety?.autoCommitPushPr}
- API key value recorded: ${body.safety?.apiKeyValueRecorded}
- Conclusion: ${body.conclusion}
`;
}
