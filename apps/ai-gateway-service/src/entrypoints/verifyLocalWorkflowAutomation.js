import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayClient } from "../../../../packages/shared-sdk/src/index.js";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-30a-local-workflow-automation";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-30a-local-workflow-automation.json");
const evidenceMdPath = resolve(evidenceDir, "phase-30a-local-workflow-automation.md");

const sourceId = "phase-30a-workflow-source";
const documentId = "phase-30a-workflow-document";
const marker = "phase30a-safe-workflow-marker";
const goal = "Create a safe local workflow automation report from the phase30a knowledge material.";

let tempDir;
let server;
let evidence;

try {
  tempDir = await mkdtemp(join(tmpdir(), "phase30a-workflow-"));
  const application = createGatewayApplication({
    ...process.env,
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "memory",
    WORKFLOW_OUTPUT_DIR: tempDir,
  });
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");

  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const client = createGatewayClient({
    baseUrl: serviceUrl,
    timeoutMs: 10_000,
  });

  const ui = await fetchText(`${serviceUrl}/ui`);
  const health = await client.health();
  const workflowHealth = await client.workflowHealth();
  const workflowActions = await client.workflowActions();
  const load = await client.knowledgeLoad({
    sourceId,
    sourceTitle: "Phase 30A Workflow Source",
    metadata: {
      phase: PHASE,
    },
    documents: [
      {
        documentId,
        title: "Phase 30A Safe Workflow Document",
        uri: "unified-ai-system://phase-30a/local-workflow",
        content:
          "This phase30a local business workflow document proves safe automation can retrieve knowledge, compose a report, and write only a controlled artifact. " +
          marker,
        metadata: {
          expectedTopHit: true,
          surface: "local-workflow",
        },
      },
    ],
  });
  const plan = await client.workflowPlan({
    goal,
    sourceIds: [sourceId],
    topK: 2,
    context: {
      requestId: "phase-30a-workflow-plan",
      traceId: PHASE,
    },
  });
  const run = await client.workflowRun({
    goal,
    sourceIds: [sourceId],
    topK: 2,
    artifactName: "phase-30a-workflow-report.md",
    context: {
      requestId: "phase-30a-workflow-run",
      traceId: PHASE,
    },
  });
  const artifactText = run?.data?.artifact?.absolutePath ? await readFile(run.data.artifact.absolutePath, "utf8") : "";
  const passed = isWorkflowAutomationConnected({
    ui,
    health,
    workflowHealth,
    workflowActions,
    load,
    plan,
    run,
    artifactText,
  });

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    ui,
    health,
    workflowHealth,
    workflowActions,
    load,
    plan,
    run,
    artifactText,
    conclusion: passed ? "local-workflow-automation-connected" : "local-workflow-automation-not-connected",
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
    health: null,
    workflowHealth: null,
    workflowActions: null,
    load: null,
    plan: null,
    run: null,
    artifactText: "",
    error: error instanceof Error ? error.message : String(error),
    conclusion: "local-workflow-automation-not-connected",
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

function isWorkflowAutomationConnected({ ui, health, workflowHealth, workflowActions, load, plan, run, artifactText }) {
  const allowedActions = workflowHealth?.data?.safety?.allowedActions ?? [];

  return (
    ui?.httpStatus === 200 &&
    ui.text.includes("/workflow/run") &&
    health?.status === "ok" &&
    health?.data?.routes?.includes("GET /workflow/health") &&
    health?.data?.routes?.includes("POST /workflow/run") &&
    workflowHealth?.status === "ok" &&
    workflowHealth?.data?.mode === "local-safe" &&
    workflowHealth?.data?.safety?.arbitraryCommandExecution === false &&
    workflowHealth?.data?.safety?.broadFileSystemScan === false &&
    allowedActions.includes("knowledge.retrieve") &&
    allowedActions.includes("report.compose") &&
    allowedActions.includes("artifact.write") &&
    workflowActions?.status === "ok" &&
    workflowActions?.data?.actions?.length === 3 &&
    load?.status === "ok" &&
    load?.data?.loadedCount === 1 &&
    plan?.status === "ok" &&
    plan?.data?.steps?.length === 3 &&
    run?.status === "ok" &&
    run?.data?.status === "completed" &&
    run?.data?.knowledge?.retrieved === true &&
    run?.data?.knowledge?.topHit?.document?.documentId === documentId &&
    run?.data?.artifact?.relativePath?.includes("phase-30a-workflow-report.md") &&
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

function createEvidence({
  status,
  generatedAt,
  serviceUrl,
  ui,
  health,
  workflowHealth,
  workflowActions,
  load,
  plan,
  run,
  artifactText,
  conclusion,
  error,
}) {
  return {
    phase: PHASE,
    status,
    generatedAt,
    service: {
      url: serviceUrl,
      healthStatus: health?.status ?? null,
      workflowHealthRoutePresent: Boolean(health?.data?.routes?.includes("GET /workflow/health")),
      workflowRunRoutePresent: Boolean(health?.data?.routes?.includes("POST /workflow/run")),
    },
    ui: {
      url: serviceUrl ? `${serviceUrl}/ui` : null,
      httpStatus: ui?.httpStatus ?? null,
      workflowPanelPresent: Boolean(ui?.text?.includes("/workflow/run")),
      workflowRunPresent: Boolean(ui?.text?.includes("/workflow/run")),
    },
    workflow: {
      healthStatus: workflowHealth?.status ?? null,
      mode: workflowHealth?.data?.mode ?? null,
      outputDirectory: workflowHealth?.data?.output?.managedDirectory ?? null,
      arbitraryCommandExecution: workflowHealth?.data?.safety?.arbitraryCommandExecution ?? null,
      broadFileSystemScan: workflowHealth?.data?.safety?.broadFileSystemScan ?? null,
      actionCount: workflowActions?.data?.actions?.length ?? null,
      plannedStepCount: plan?.data?.steps?.length ?? null,
      runStatus: run?.data?.status ?? null,
      workflowId: run?.data?.workflowId ?? null,
      artifactRelativePath: run?.data?.artifact?.relativePath ?? null,
      artifactBytes: run?.data?.artifact?.bytes ?? null,
      artifactSha256: run?.data?.artifact?.sha256 ?? null,
      artifactMarkerPresent: artifactText.includes(marker),
      artifactSafetyTextPresent: artifactText.includes("No arbitrary shell command was executed."),
    },
    knowledge: {
      loadStatus: load?.status ?? null,
      loadedSourceId: load?.data?.sourceId ?? null,
      loadedCount: load?.data?.loadedCount ?? null,
      retrieved: run?.data?.knowledge?.retrieved ?? null,
      chunkCount: run?.data?.knowledge?.chunkCount ?? null,
      topHitDocumentId: run?.data?.knowledge?.topHit?.document?.documentId ?? null,
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
  return `# Phase 30A Local Workflow Automation Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.service.url ?? "n/a"}
- Health status: ${body.service.healthStatus ?? "n/a"}
- Workflow health route present: ${body.service.workflowHealthRoutePresent}
- Workflow run route present: ${body.service.workflowRunRoutePresent}
- UI URL: ${body.ui.url ?? "n/a"}
- UI HTTP status: ${body.ui.httpStatus ?? "n/a"}
- Workflow panel present: ${body.ui.workflowPanelPresent}
- Workflow run present: ${body.ui.workflowRunPresent}
- Workflow mode: ${body.workflow.mode ?? "n/a"}
- Output directory: ${body.workflow.outputDirectory ?? "n/a"}
- Arbitrary command execution: ${body.workflow.arbitraryCommandExecution}
- Broad file system scan: ${body.workflow.broadFileSystemScan}
- Action count: ${body.workflow.actionCount ?? "n/a"}
- Planned step count: ${body.workflow.plannedStepCount ?? "n/a"}
- Run status: ${body.workflow.runStatus ?? "n/a"}
- Artifact path: ${body.workflow.artifactRelativePath ?? "n/a"}
- Artifact bytes: ${body.workflow.artifactBytes ?? "n/a"}
- Artifact marker present: ${body.workflow.artifactMarkerPresent}
- Artifact safety text present: ${body.workflow.artifactSafetyTextPresent}
- Loaded source ID: ${body.knowledge.loadedSourceId ?? "n/a"}
- Loaded count: ${body.knowledge.loadedCount ?? "n/a"}
- Knowledge retrieved: ${body.knowledge.retrieved}
- Knowledge chunk count: ${body.knowledge.chunkCount ?? "n/a"}
- Top hit document: ${body.knowledge.topHitDocumentId ?? "n/a"}
- Conclusion: ${body.conclusion}
`;
}
