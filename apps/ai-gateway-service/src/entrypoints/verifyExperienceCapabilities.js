import { mkdir, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { fetchJson, fetchText, listen, close } from "./entrypointUtils.js";

const PHASE = "phase-31a-experience-capabilities";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-31a-experience-capabilities.json");
const evidenceMdPath = resolve(evidenceDir, "phase-31a-experience-capabilities.md");

let server;
let evidence;

try {
  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_ROUTE_MODE: "registry-default",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    AI_GATEWAY_FALLBACK_ENABLED: "true",
    AI_GATEWAY_FAKE_PRIMARY_FAIL: "true",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "memory",
  });
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");
  const serviceUrl = `http://127.0.0.1:${server.address().port}`;

  const ui = await fetchText(`${serviceUrl}/ui`);
  const dashboard = await fetchJson(`${serviceUrl}/dashboard/status`);
  const providers = await fetchJson(`${serviceUrl}/providers`);
  const auth = await fetchJson(`${serviceUrl}/auth/status`);
  const load = await fetchJson(`${serviceUrl}/knowledge/load`, {
    method: "POST",
    body: {
      sourceId: "phase-31a-capability-source",
      sourceTitle: "Phase 31A Capability Source",
      metadata: { phase: PHASE },
      documents: [
        {
          documentId: "phase-31a-capability-document",
          title: "Phase 31A Capability Document",
          content:
            "phase31a streaming fallback dashboard evaluation memory connector auth tenant graphrag workflow proves the user can experience the feature suite.",
          metadata: { expectedTopHit: true },
        },
      ],
    },
  });
  const streamEvents = await collectSse(`${serviceUrl}/chat/rag/stream`, {
    prompt: "phase31a streaming fallback dashboard evaluation memory connector auth tenant graphrag workflow",
    knowledge: { sourceIds: ["phase-31a-capability-source"], topK: 2 },
  });
  const memorySave = await fetchJson(`${serviceUrl}/memory/save`, {
    method: "POST",
    headers: { "x-pme-tenant-id": "phase31a" },
    body: {
      title: "Phase 31A Memory",
      text: "phase31a long term memory stores user preferences for PME Moving Earth.",
    },
  });
  const memoryList = await fetchJson(`${serviceUrl}/memory/list`, {
    headers: { "x-pme-tenant-id": "phase31a" },
  });
  const connector = await fetchJson(`${serviceUrl}/connectors/import/text`, {
    method: "POST",
    body: {
      connectorId: "phase31a-explicit-text",
      title: "Phase 31A Explicit Connector",
      content: "phase31a explicit text connector imports external business text by user paste only.",
    },
  });
  const graph = await fetchJson(`${serviceUrl}/knowledge/graph/retrieve`, {
    method: "POST",
    body: {
      query: "phase31a graphrag workflow",
      topK: 3,
    },
  });
  const score = await fetchJson(`${serviceUrl}/evaluation/score`, {
    method: "POST",
    body: {
      answer: streamEvents.outputText,
      citations: streamEvents.knowledge?.citations ?? [],
      expectedTerms: ["phase31a", "fallback", "workflow"],
      threshold: 0.5,
    },
  });
  const workflow = await fetchJson(`${serviceUrl}/workflow/run`, {
    method: "POST",
    body: {
      goal: "Create a phase31a safe workflow report.",
      query: "phase31a workflow",
      topK: 2,
      sourceIds: ["phase-31a-capability-source"],
      artifactName: "phase-31a-workflow-report.md",
    },
  });

  const passed = isExperienceConnected({
    ui,
    dashboard,
    providers,
    auth,
    load,
    streamEvents,
    memorySave,
    memoryList,
    connector,
    graph,
    score,
    workflow,
  });

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    ui,
    dashboard,
    providers,
    auth,
    load,
    streamEvents,
    memorySave,
    memoryList,
    connector,
    graph,
    score,
    workflow,
    conclusion: passed ? "experience-capabilities-connected" : "experience-capabilities-not-connected",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl: null,
    error: error instanceof Error ? error.message : String(error),
    conclusion: "experience-capabilities-not-connected",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function isExperienceConnected({ ui, dashboard, providers, auth, load, streamEvents, memorySave, memoryList, connector, graph, score, workflow }) {
  return (
    ui?.httpStatus === 200 &&
    ui.text.includes("/chat/rag/stream") &&
    ui.text.includes("/dashboard/status") &&
    ui.text.includes("/memory/save") &&
    ui.text.includes("/connectors/import/text") &&
    ui.text.includes("/evaluation/score") &&
    ui.text.includes("/knowledge/graph/retrieve") &&
    dashboard?.httpStatus === 200 &&
    dashboard.body?.data?.capabilities?.streamingChat === true &&
    dashboard.body?.data?.capabilities?.fallbackExecution === true &&
    providers?.body?.data?.length === 2 &&
    auth?.body?.data?.enabled === false &&
    load?.body?.data?.loadedCount === 1 &&
    streamEvents.done === true &&
    streamEvents.outputText.includes("backup-fake-provider") &&
    streamEvents.knowledge?.retrieved === true &&
    memorySave?.body?.data?.status === "saved" &&
    memoryList?.body?.data?.documentCount >= 1 &&
    connector?.body?.data?.status === "imported" &&
    graph?.body?.data?.graph?.nodes?.length > 0 &&
    graph?.body?.data?.graph?.edges?.length > 0 &&
    score?.body?.data?.status === "scored" &&
    score?.body?.data?.passed === true &&
    workflow?.body?.data?.status === "completed"
  );
}

async function collectSse(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const events = parseSseEvents(text);
  const knowledge = events.find((event) => event.event === "knowledge")?.data;
  const done = events.find((event) => event.event === "done")?.data;
  const outputText = done?.outputText ?? events.filter((event) => event.event === "chunk").map((event) => event.data?.textDelta ?? "").join("");

  return {
    httpStatus: response.status,
    eventCount: events.length,
    eventTypes: events.map((event) => event.event),
    knowledge,
    done: Boolean(done),
    outputText,
    selectedProvider: done?.selectedProvider ?? null,
  };
}

function parseSseEvents(text) {
  return String(text)
    .split(/\r?\n\r?\n/)
    .map((frame) => {
      const lines = frame.split(/\r?\n/);
      const event = lines.find((line) => line.startsWith("event:"))?.slice("event:".length).trim();
      const data = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trim())
        .join("\n");

      if (!event || !data) {
        return null;
      }

      return {
        event,
        data: JSON.parse(data),
      };
    })
    .filter(Boolean);
}

function createEvidence({
  status,
  generatedAt,
  serviceUrl,
  ui,
  dashboard,
  providers,
  auth,
  load,
  streamEvents,
  memorySave,
  memoryList,
  connector,
  graph,
  score,
  workflow,
  conclusion,
  error,
}) {
  return {
    phase: PHASE,
    status,
    generatedAt,
    serviceUrl,
    ui: {
      httpStatus: ui?.httpStatus ?? null,
      streamingMarker: Boolean(ui?.text?.includes("/chat/rag/stream")),
      dashboardMarker: Boolean(ui?.text?.includes("/dashboard/status")),
      memoryMarker: Boolean(ui?.text?.includes("/memory/save")),
      connectorMarker: Boolean(ui?.text?.includes("/connectors/import/text")),
      evaluationMarker: Boolean(ui?.text?.includes("/evaluation/score")),
      graphMarker: Boolean(ui?.text?.includes("/knowledge/graph/retrieve")),
    },
    dashboard: {
      httpStatus: dashboard?.httpStatus ?? null,
      streamingChat: dashboard?.body?.data?.capabilities?.streamingChat ?? null,
      fallbackExecution: dashboard?.body?.data?.capabilities?.fallbackExecution ?? null,
      longTermMemory: dashboard?.body?.data?.capabilities?.longTermMemory ?? null,
      queryGraphRag: dashboard?.body?.data?.capabilities?.queryGraphRag ?? null,
    },
    providers: {
      count: providers?.body?.data?.length ?? null,
      fallbackEnabled: dashboard?.body?.data?.service?.fallbackEnabled ?? null,
    },
    auth: {
      enabled: auth?.body?.data?.enabled ?? null,
      tenantMode: auth?.body?.data?.tenantMode ?? null,
    },
    knowledge: {
      loadStatus: load?.body?.status ?? null,
      loadedCount: load?.body?.data?.loadedCount ?? null,
    },
    streaming: streamEvents ?? null,
    memory: {
      saveStatus: memorySave?.body?.data?.status ?? null,
      documentCount: memoryList?.body?.data?.documentCount ?? null,
    },
    connector: {
      status: connector?.body?.data?.status ?? null,
      sourceId: connector?.body?.data?.sourceId ?? null,
    },
    graph: {
      nodeCount: graph?.body?.data?.graph?.nodes?.length ?? null,
      edgeCount: graph?.body?.data?.graph?.edges?.length ?? null,
    },
    evaluation: {
      score: score?.body?.data?.score ?? null,
      passed: score?.body?.data?.passed ?? null,
    },
    workflow: {
      status: workflow?.body?.data?.status ?? null,
      artifact: workflow?.body?.data?.artifact?.relativePath ?? null,
    },
    error: error ?? null,
    conclusion,
  };
}

