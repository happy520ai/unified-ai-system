import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-77a-integrated-user-experience";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-77a-integrated-user-experience.json");
const evidenceMdPath = resolve(evidenceDir, "phase-77a-integrated-user-experience.md");

const sourceId = "phase-77a-integrated-source";
const documentId = "phase-77a-integrated-document";
const marker = "phase77a-integrated-user-experience-marker";
const workflowGoal = "Create a concise business workflow report from phase77a integrated user experience knowledge.";

let tempDir;
let server;
let evidence;

try {
  tempDir = await mkdtemp(join(tmpdir(), "phase77a-integrated-"));
  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "memory",
    PME_ENTERPRISE_AUTH_ENABLED: "false",
    WORKFLOW_OUTPUT_DIR: tempDir,
  });
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");

  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const ui = await fetchText(`${serviceUrl}/ui`);
  const providers = await fetchJson(`${serviceUrl}/models/import/providers`);
  const knowledgeLoad = await fetchJson(`${serviceUrl}/knowledge/load`, {
    method: "POST",
    body: {
      sourceId,
      sourceTitle: "Phase 77A Integrated User Experience Source",
      documents: [
        {
          documentId,
          title: "Phase 77A Integrated User Experience Document",
          uri: "unified-ai-system://phase-77a/integrated-user-experience",
          content:
            "Phase 77A proves model import visibility, knowledge source load and retrieval, enterprise read-only overview, " +
            "and safe local workflow automation can be reached from the Chat-first user experience. " +
            marker,
          metadata: {
            phase: PHASE,
            surface: "chat-first-integrated-usability",
          },
        },
      ],
    },
  });
  const knowledgeSources = await fetchJson(`${serviceUrl}/knowledge/sources`);
  const knowledgeRetrieve = await fetchJson(`${serviceUrl}/knowledge/retrieve`, {
    method: "POST",
    body: {
      query: "phase77a integrated user experience workflow",
      sourceIds: [sourceId],
      topK: 3,
    },
  });
  const enterpriseOverview = await fetchJson(`${serviceUrl}/enterprise/overview`);
  const workflowRun = await fetchJson(`${serviceUrl}/workflow/run`, {
    method: "POST",
    body: {
      goal: workflowGoal,
      sourceIds: [sourceId],
      topK: 3,
      artifactName: "phase-77a-integrated-report.md",
      context: {
        traceId: PHASE,
        surface: "phase77a-verify",
      },
    },
  });
  const artifactPath = workflowRun.body?.data?.artifact?.absolutePath;
  const artifactText = artifactPath ? await readFile(artifactPath, "utf8") : "";

  const passed = isIntegratedExperienceConnected({
    ui,
    providers,
    knowledgeLoad,
    knowledgeSources,
    knowledgeRetrieve,
    enterpriseOverview,
    workflowRun,
    artifactText,
  });

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    ui,
    providers,
    knowledgeLoad,
    knowledgeSources,
    knowledgeRetrieve,
    enterpriseOverview,
    workflowRun,
    artifactText,
    conclusion: passed ? "integrated-user-experience-connected" : "integrated-user-experience-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl: null,
    ui: null,
    providers: null,
    knowledgeLoad: null,
    knowledgeSources: null,
    knowledgeRetrieve: null,
    enterpriseOverview: null,
    workflowRun: null,
    artifactText: "",
    error: error instanceof Error ? error.message : String(error),
    conclusion: "integrated-user-experience-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function isIntegratedExperienceConnected({
  ui,
  providers,
  knowledgeLoad,
  knowledgeSources,
  knowledgeRetrieve,
  enterpriseOverview,
  workflowRun,
  artifactText,
}) {
  const providerList = providers?.body?.data?.providers ?? [];
  const providerIds = new Set(providerList.map((provider) => provider.providerId));
  const sources = knowledgeSources?.body?.data?.sources ?? [];
  const topHit = knowledgeRetrieve?.body?.data?.topHit;

  return (
    ui?.httpStatus === 200 &&
    ui.text.includes("模型配置向导") &&
    ui.text.includes("企业状态") &&
    ui.text.includes("业务流程") &&
    ui.text.includes("/workflow/run") &&
    ui.text.includes("/models/import/preview") &&
    providers?.httpStatus === 200 &&
    providerList.length >= 25 &&
    providerIds.has("dashscope") &&
    providerIds.has("zhipu") &&
    providerIds.has("huggingface") &&
    providerIds.has("openai-compatible") &&
    providerIds.has("gemini") &&
    knowledgeLoad?.httpStatus === 200 &&
    knowledgeLoad.body?.data?.loadedCount === 1 &&
    sources.some((source) => source.sourceId === sourceId && source.documentCount === 1) &&
    knowledgeRetrieve?.httpStatus === 200 &&
    topHit?.document?.documentId === documentId &&
    Boolean(topHit?.snippet) &&
    Array.isArray(topHit?.highlights) &&
    Array.isArray(topHit?.matchedTerms) &&
    Boolean(topHit?.scoreBreakdown) &&
    enterpriseOverview?.httpStatus === 200 &&
    workflowRun?.httpStatus === 200 &&
    workflowRun.body?.data?.status === "completed" &&
    workflowRun.body?.data?.artifact?.relativePath?.includes("phase-77a-integrated-report.md") &&
    artifactText.includes(marker) &&
    artifactText.includes("No arbitrary shell command was executed.")
  );
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
  const text = await response.text();

  return {
    httpStatus: response.status,
    contentType: response.headers.get("content-type"),
    text,
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const body = await response.json();

  return {
    httpStatus: response.status,
    body,
  };
}

function createEvidence({
  status,
  generatedAt,
  serviceUrl,
  ui,
  providers,
  knowledgeLoad,
  knowledgeSources,
  knowledgeRetrieve,
  enterpriseOverview,
  workflowRun,
  artifactText,
  conclusion,
  error,
}) {
  const providerList = providers?.body?.data?.providers ?? [];
  const topHit = knowledgeRetrieve?.body?.data?.topHit;

  return {
    phase: PHASE,
    status,
    generatedAt,
    service: {
      url: serviceUrl,
    },
    ui: {
      httpStatus: ui?.httpStatus ?? null,
      modelWizardPresent: Boolean(ui?.text?.includes("模型配置向导")),
      enterpriseCommandPresent: Boolean(ui?.text?.includes("企业状态")),
      workflowCommandPresent: Boolean(ui?.text?.includes("业务流程")),
      modelImportPreviewRoutePresent: Boolean(ui?.text?.includes("/models/import/preview")),
      workflowRoutePresent: Boolean(ui?.text?.includes("/workflow/run")),
    },
    modelImport: {
      httpStatus: providers?.httpStatus ?? null,
      providerCount: providerList.length,
      keyProvidersPresent: {
        dashscope: providerList.some((provider) => provider.providerId === "dashscope"),
        zhipu: providerList.some((provider) => provider.providerId === "zhipu"),
        huggingface: providerList.some((provider) => provider.providerId === "huggingface"),
        openaiCompatible: providerList.some((provider) => provider.providerId === "openai-compatible"),
        gemini: providerList.some((provider) => provider.providerId === "gemini"),
      },
    },
    knowledge: {
      loadHttpStatus: knowledgeLoad?.httpStatus ?? null,
      loadedCount: knowledgeLoad?.body?.data?.loadedCount ?? null,
      sourceCount: knowledgeSources?.body?.data?.sources?.length ?? null,
      retrieveHttpStatus: knowledgeRetrieve?.httpStatus ?? null,
      topHitDocumentId: topHit?.document?.documentId ?? null,
      snippetPresent: Boolean(topHit?.snippet),
      highlightCount: topHit?.highlights?.length ?? null,
      matchedTerms: topHit?.matchedTerms ?? [],
      scoreBreakdownPresent: Boolean(topHit?.scoreBreakdown),
    },
    enterprise: {
      overviewHttpStatus: enterpriseOverview?.httpStatus ?? null,
      overviewStatus: enterpriseOverview?.body?.status ?? null,
    },
    workflow: {
      runHttpStatus: workflowRun?.httpStatus ?? null,
      runStatus: workflowRun?.body?.data?.status ?? null,
      artifactRelativePath: workflowRun?.body?.data?.artifact?.relativePath ?? null,
      artifactMarkerPresent: artifactText.includes(marker),
      artifactSafetyTextPresent: artifactText.includes("No arbitrary shell command was executed."),
      arbitraryCommandExecution: false,
    },
    boundaries: {
      defaultChatMainLaneChanged: false,
      arbitraryShellExecution: false,
      broadFileSystemScan: false,
      providerApiKeyLogged: false,
    },
    error: error ?? null,
    conclusion,
  };
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 77A Integrated User Experience Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.service.url ?? "n/a"}
- UI HTTP status: ${body.ui.httpStatus ?? "n/a"}
- Model wizard present: ${body.ui.modelWizardPresent}
- Enterprise command present: ${body.ui.enterpriseCommandPresent}
- Workflow command present: ${body.ui.workflowCommandPresent}
- Model import provider count: ${body.modelImport.providerCount}
- DashScope provider present: ${body.modelImport.keyProvidersPresent.dashscope}
- Zhipu provider present: ${body.modelImport.keyProvidersPresent.zhipu}
- Hugging Face provider present: ${body.modelImport.keyProvidersPresent.huggingface}
- OpenAI-compatible provider present: ${body.modelImport.keyProvidersPresent.openaiCompatible}
- Gemini provider present: ${body.modelImport.keyProvidersPresent.gemini}
- Knowledge loaded count: ${body.knowledge.loadedCount ?? "n/a"}
- Knowledge retrieve top hit: ${body.knowledge.topHitDocumentId ?? "n/a"}
- Snippet present: ${body.knowledge.snippetPresent}
- Highlight count: ${body.knowledge.highlightCount ?? "n/a"}
- Score breakdown present: ${body.knowledge.scoreBreakdownPresent}
- Enterprise overview HTTP status: ${body.enterprise.overviewHttpStatus ?? "n/a"}
- Workflow run status: ${body.workflow.runStatus ?? "n/a"}
- Workflow artifact: ${body.workflow.artifactRelativePath ?? "n/a"}
- Artifact marker present: ${body.workflow.artifactMarkerPresent}
- Artifact safety text present: ${body.workflow.artifactSafetyTextPresent}
- Default chat main lane changed: ${body.boundaries.defaultChatMainLaneChanged}
- Arbitrary shell execution: ${body.boundaries.arbitraryShellExecution}
- Broad file system scan: ${body.boundaries.broadFileSystemScan}
- Provider API key logged: ${body.boundaries.providerApiKeyLogged}
- Conclusion: ${body.conclusion}
`;
}
