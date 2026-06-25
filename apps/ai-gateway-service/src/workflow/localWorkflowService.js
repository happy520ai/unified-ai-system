import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequestId } from "@unified-ai-system/shared-utils";

const PHASE = "phase-30a-local-workflow-automation";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const DEFAULT_OUTPUT_DIR = resolve(repoRoot, ".data", "workflows");
const DEFAULT_TOP_K = 3;

const ACTIONS = [
  {
    actionId: "knowledge.retrieve",
    title: "Retrieve local knowledge",
    mode: "read-only",
    description: "Read current local knowledge through the existing keyword retrieval service.",
  },
  {
    actionId: "report.compose",
    title: "Compose workflow report",
    mode: "in-memory",
    description: "Build a deterministic Markdown workflow report from the goal and retrieved knowledge.",
  },
  {
    actionId: "artifact.write",
    title: "Write controlled local artifact",
    mode: "controlled-write",
    description: "Write only the composed Markdown report into the managed .data/workflows directory.",
  },
];

export function createLocalWorkflowService({ knowledgeService, env = {}, outputDir } = {}) {
  if (!knowledgeService || typeof knowledgeService.retrieve !== "function") {
    throw new Error("Local workflow service requires a knowledgeService with retrieve().");
  }

  const managedOutputDir = resolve(outputDir ?? env.WORKFLOW_OUTPUT_DIR ?? DEFAULT_OUTPUT_DIR);

  function getHealth() {
    return {
      status: "ready",
      phase: PHASE,
      mode: "local-safe",
      execution: "allowlisted",
      output: {
        managedDirectory: toRepoRelative(managedOutputDir),
        writeScope: "controlled-artifact-only",
      },
      safety: createSafetySummary(),
    };
  }

  function listActions() {
    return {
      phase: PHASE,
      mode: "local-safe",
      actions: ACTIONS,
      safety: createSafetySummary(),
    };
  }

  function plan(request = {}) {
    const goal = normalizeGoal(request.goal ?? request.prompt ?? request.query);
    const workflowId = request.workflowId ?? createRequestId("workflow");
    const query = normalizeOptionalString(request.query) ?? goal;
    const topK = readBoundedInteger(request.topK, DEFAULT_TOP_K, 1, 5);

    return {
      phase: PHASE,
      workflowId,
      goal,
      query,
      topK,
      sourceIds: normalizeSourceIds(request.sourceIds),
      steps: ACTIONS.map((action, index) => ({
        order: index + 1,
        actionId: action.actionId,
        title: action.title,
        mode: action.mode,
        status: "planned",
      })),
      safety: createSafetySummary(),
    };
  }

  async function run(request = {}) {
    const workflowPlan = plan(request);
    const startedAt = Date.now();
    const retrieve = knowledgeService.retrieve({
      context: {
        ...(request.context ?? {}),
        requestId: `${workflowPlan.workflowId}-knowledge`,
        traceId: request.context?.traceId ?? PHASE,
      },
      query: workflowPlan.query,
      mode: "keyword",
      sourceIds: workflowPlan.sourceIds,
      topK: workflowPlan.topK,
      metadata: {
        phase: PHASE,
        caller: "local-workflow",
      },
    });
    const report = composeReport({ plan: workflowPlan, retrieve });
    const artifact = await writeManagedArtifact({
      outputDir: managedOutputDir,
      workflowId: workflowPlan.workflowId,
      requestedName: request.artifactName,
      report,
    });

    return {
      phase: PHASE,
      status: "completed",
      workflowId: workflowPlan.workflowId,
      goal: workflowPlan.goal,
      query: workflowPlan.query,
      steps: markStepsCompleted(workflowPlan.steps),
      knowledge: {
        mode: retrieve.mode,
        retrieved: retrieve.chunks.length > 0,
        chunkCount: retrieve.chunks.length,
        topHit: retrieve.topHit ?? null,
        citations: createCitations(retrieve.chunks),
        metadata: retrieve.metadata ?? {},
      },
      artifact,
      safety: createSafetySummary(),
      meta: {
        durationMs: Date.now() - startedAt,
      },
    };
  }

  return {
    getHealth,
    listActions,
    plan,
    run,
  };
}

function normalizeGoal(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    const error = new Error("Workflow goal is required.");
    error.code = "WORKFLOW_GOAL_REQUIRED";
    error.category = "validation";
    throw error;
  }

  return value.trim();
}

function normalizeOptionalString(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

function normalizeSourceIds(sourceIds) {
  if (!Array.isArray(sourceIds)) {
    return undefined;
  }

  const normalized = sourceIds.filter((sourceId) => typeof sourceId === "string" && sourceId.trim()).map((sourceId) => sourceId.trim());
  return normalized.length ? normalized : undefined;
}

function readBoundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function createSafetySummary() {
  return {
    arbitraryCommandExecution: false,
    broadFileSystemScan: false,
    networkAutomation: false,
    allowedActions: ACTIONS.map((action) => action.actionId),
    outputScope: ".data/workflows",
  };
}

function markStepsCompleted(steps) {
  return steps.map((step) => ({
    ...step,
    status: "completed",
  }));
}

function createCitations(chunks = []) {
  return chunks.map((chunk, index) => ({
    index: index + 1,
    sourceId: chunk.document?.sourceId ?? null,
    documentId: chunk.document?.documentId ?? null,
    title: chunk.document?.title ?? chunk.document?.documentId ?? "Untitled",
    snippet: chunk.snippet ?? chunk.text ?? "",
    matchedTerms: chunk.matchedTerms ?? [],
    score: chunk.score ?? null,
    metadata: chunk.document?.metadata ?? {},
  }));
}

function composeReport({ plan, retrieve }) {
  const citations = createCitations(retrieve.chunks);
  const citationText = citations.length
    ? citations
        .map((citation) =>
          [
            `### [${citation.index}] ${citation.title}`,
            `- Source: ${citation.sourceId ?? "n/a"}`,
            `- Document: ${citation.documentId ?? "n/a"}`,
            `- Score: ${citation.score ?? "n/a"}`,
            `- Matched terms: ${citation.matchedTerms.join(", ") || "n/a"}`,
            `- Snippet: ${citation.snippet}`,
          ].join("\n"),
        )
        .join("\n\n")
    : "No attributable local knowledge was retrieved.";

  return [
    "# PME Moving Earth Local Workflow Automation Report",
    "",
    `- Workflow ID: ${plan.workflowId}`,
    `- Phase: ${PHASE}`,
    `- Goal: ${plan.goal}`,
    `- Query: ${plan.query}`,
    `- Generated at: ${new Date().toISOString()}`,
    "",
    "## Executed Steps",
    "",
    "1. Retrieved local knowledge through the existing knowledge service.",
    "2. Composed a workflow report from the retrieved snippets.",
    "3. Wrote the report into the managed `.data/workflows` scope.",
    "",
    "## Local Knowledge Citations",
    "",
    citationText,
    "",
    "## Workflow Draft",
    "",
    "- Clarify the business goal and required input material.",
    "- Extract relevant facts, constraints, and next steps from local knowledge.",
    "- Keep human-confirmed actions as todo items; do not execute system commands.",
    "- Open a new explicit mainline before modifying local files outside the managed artifact or automating external systems.",
    "",
    "## Safety Boundary",
    "",
    "- No arbitrary shell command was executed.",
    "- No broad file system scan was performed.",
    "- No business code was modified.",
    "- Only this workflow report artifact was written.",
    "",
  ].join("\n");
}

async function writeManagedArtifact({ outputDir, workflowId, requestedName, report }) {
  await mkdir(outputDir, { recursive: true });
  const fileName = createSafeArtifactName(requestedName ?? `${workflowId}.md`);
  const filePath = resolve(outputDir, fileName);
  assertInsideDirectory(filePath, outputDir);
  await writeFile(filePath, report, "utf8");

  return {
    fileName,
    absolutePath: filePath,
    relativePath: toRepoRelative(filePath),
    bytes: Buffer.byteLength(report, "utf8"),
    sha256: createHash("sha256").update(report).digest("hex"),
  };
}

function createSafeArtifactName(value) {
  const base = String(value)
    .replaceAll("\\", "-")
    .replaceAll("/", "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const safeBase = base || "workflow-report";
  return safeBase.toLowerCase().endsWith(".md") ? safeBase : `${safeBase}.md`;
}

function assertInsideDirectory(filePath, directory) {
  const resolvedFile = resolve(filePath);
  const resolvedDirectory = resolve(directory);

  if (resolvedFile !== resolvedDirectory && !resolvedFile.startsWith(`${resolvedDirectory}${sep}`)) {
    const error = new Error("Workflow artifact path must stay inside the managed output directory.");
    error.code = "WORKFLOW_OUTPUT_SCOPE_VIOLATION";
    error.category = "validation";
    throw error;
  }
}

function toRepoRelative(value) {
  return relative(repoRoot, value).replaceAll("\\", "/");
}
