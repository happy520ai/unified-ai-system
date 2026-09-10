import { chmod, link, lstat, mkdir, open, readdir, realpath, unlink } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequestId, throwIfExecutionAborted } from "@unified-ai-system/shared-utils";
import { DurableWorkflowRunStore, executeDurableWorkflow, validateWorkflowId, workflowStateError, workflowTargetFingerprint } from "./durableWorkflowRunStore.ts";
import { createWorkflowHandoffContexts } from "./workflowHandoffContext.ts";
import { workflowHandoffHash } from "../workforce/workforceWorkflowHandoffBinding.ts";

const PHASE = "phase-30a-local-workflow-automation";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const DEFAULT_OUTPUT_DIR = resolve(repoRoot, ".data", "workflows");
const DEFAULT_TOP_K = 3;
const localWorkflowServices = new WeakSet();
export function isLocalWorkflowService(value) { return Boolean(value && typeof value === "object" && localWorkflowServices.has(value)); }

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

/** @param {{ knowledgeService?: { retrieve: Function }, env?: Record<string, string | undefined>, outputDir?: string,
 * workflowStateOptions?: { clock?: () => number, leaseMs?: number, onInitialization?: () => void }, workflowHooks?: Record<string, () => Promise<void>> }} [options] */
export function createLocalWorkflowService({ knowledgeService, env = {}, outputDir, workflowStateOptions = {}, workflowHooks = {} } = {}) {
  if (!knowledgeService || typeof knowledgeService.retrieve !== "function") {
    throw new Error("Local workflow service requires a knowledgeService with retrieve().");
  }

  const managedOutputDir = resolve(outputDir ?? env.WORKFLOW_OUTPUT_DIR ?? DEFAULT_OUTPUT_DIR);
  const runStore = new DurableWorkflowRunStore(managedOutputDir, workflowStateOptions);
  const outputRootHash = workflowHandoffHash(managedOutputDir);
  const handoffContexts = createWorkflowHandoffContexts({ outputRootHash,
    inspect: (workflowId, identity) => runStore.inspect(workflowId, identity) });

  function getHealth() {
    return {
      status: runStore.getHealth().state === "degraded" ? "degraded" : "ready",
      phase: PHASE,
      mode: "local-safe",
      execution: "allowlisted",
      persistence: runStore.getHealth(),
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
    const workflowId = validateWorkflowId(request.workflowId ?? createRequestId("workflow"));
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

  async function run(request = {}, requestContext = {}, callbacks) {
    throwIfExecutionAborted(requestContext.signal);
    if (requestContext.workflowGovernancePending === true
      && (typeof callbacks?.beforePublish !== "function" || typeof callbacks?.beforeReplay !== "function")) {
      throw workflowStateError("GOVERNANCE_CALLBACK_REQUIRED", "Governed workflows require server-created publication and receipt checks.", 403);
    }
    const tenantId = requireTenantId(requestContext);
    const workflowPlan = plan(request);
    if (["workforceHandoff", "workflowHandoffContext"].some(key => Object.hasOwn(request, key))) {
      throw workflowStateError("HANDOFF_CONTEXT_INVALID", "Workflow handoff authority cannot come from request JSON.", 403);
    }
    const normalizedRequest = { goal: workflowPlan.goal, query: workflowPlan.query, topK: workflowPlan.topK,
      sourceIds: workflowPlan.sourceIds ?? [], artifactName: createSafeArtifactName(request.artifactName ?? `${workflowPlan.workflowId}.md`) };
    const handoff = requestContext.workflowHandoffContext === undefined ? { origin: null, callbacks }
      : await handoffContexts.consume(requestContext.workflowHandoffContext,
        { workflowId: workflowPlan.workflowId, ...normalizedRequest }, requestContext, callbacks);
    callbacks = handoff.callbacks;
    const paths = { rootDir: managedOutputDir, outputDir: resolve(managedOutputDir, tenantPartition(tenantId)) };
    return executeDurableWorkflow({
      store: runStore, workflowId: workflowPlan.workflowId, scope: requestContext, signal: requestContext.signal,
      request: { ...normalizedRequest, ...(handoff.origin ? { workforceHandoff: handoff.origin } : {}) },
      prepare: async (claim) => {
        const startedAt = Date.now();
        const retrieve = await knowledgeService.retrieve({
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
        }, requestContext);
        throwIfExecutionAborted(requestContext.signal);
        runStore.composing(claim);
        const report = composeReport({ plan: workflowPlan, retrieve });
        const result = {
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
          safety: createSafetySummary(),
          meta: { durationMs: Date.now() - startedAt },
        };
        const draft = await stageManagedArtifact({ ...paths, requestedName: request.artifactName ?? `${workflowPlan.workflowId}.md`, report, result, signal: requestContext.signal });
        try { await workflowHooks.afterStaging?.(); }
        catch (error) {
          try { await discardStagedArtifact({ ...paths, draft }); }
          catch (cleanupError) { Object.assign(error, { cleanupError }); }
          throw error;
        }
        return draft;
      },
      publish: (claim, draft) => writeManagedArtifact({ ...paths, store: runStore, claim, draft, signal: requestContext.signal, hooks: workflowHooks, callbacks }),
      discard: (draft) => discardStagedArtifact({ ...paths, draft }),
      replay: callbacks ? async (claim) => {
        const record = claim.record;
        const directoryGuard = { root: await captureDirectoryIdentity(paths.rootDir), tenant: await captureDirectoryIdentity(paths.outputDir) };
        if (resolve(directoryGuard.tenant.realPath, "..") !== directoryGuard.root.realPath || !record.draft || !record.publication || !record.result) {
          throw workflowStateError("STATE_INVALID", "The workflow receipt has no complete durable publication record.");
        }
        const target = createPublicationTarget(directoryGuard, record.publication.fileName);
        if (record.draft.target && target.fingerprint !== record.draft.target.fingerprint) {
          throw workflowStateError("TARGET_CHANGED", "The original workflow publication directory identity changed.");
        }
        if (record.result.artifact.absolutePath !== resolve(paths.outputDir, target.fileName)) throw unsafeWorkflowPathError();
        const { content: _content, ...material } = publicationMaterial(claim, record.draft, target, null, paths.outputDir);
        await callbacks.beforeReplay({ ...material, authorization: record.publication.authorization, governancePending: record.governancePending });
      } : undefined,
    });
  }

  function getRun(workflowId, requestContext = {}) { return runStore.inspect(workflowId, requestContext); }
  function listRuns(requestContext = {}, limit = 50) { return runStore.list(requestContext, limit); }
  async function recoverRun(workflowId, requestContext = {}) {
    const tenantId = requireTenantId(requestContext);
    throwIfExecutionAborted(requestContext.signal);
    return runStore.recover(workflowId, requestContext, (draft, fileName) => reconcileManagedArtifact({
      rootDir: managedOutputDir, outputDir: resolve(managedOutputDir, tenantPartition(tenantId)), draft, fileName, cleanupStaging: true,
    }));
  }

  const service = {
    getHealth,
    listActions,
    plan,
    run,
    getRun,
    listRuns,
    recoverRun,
    getWorkforceHandoffInfo: () => ({ mode: "single-host-sqlite", outputRootHash }),
    verifyWorkforceHandoffArtifact: (workflowId, requestContext = {}) => runStore.verifyCompletedArtifact(workflowId, requestContext,
      (draft, fileName) => reconcileManagedArtifact({ rootDir: managedOutputDir,
        outputDir: resolve(managedOutputDir, tenantPartition(requireTenantId(requestContext))), draft, fileName, cleanupStaging: false })),
    createWorkforceHandoffContext: (input) => handoffContexts.initial(input),
    createWorkforceHandoffRecoveryContext: (input) => handoffContexts.recovery(input),
    markGovernanceUncertain: (workflowId, requestContext) => runStore.markGovernanceUncertain(workflowId, requestContext),
    confirmGovernanceComplete: (workflowId, requestContext, deliveredResult) => runStore.confirmGovernanceComplete(workflowId, requestContext, deliveredResult),
  };
  localWorkflowServices.add(service);
  return service;
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
    tenantIsolation: "server-owned-sha256-partition",
    publication: "exclusive-atomic-no-overwrite",
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

async function stageManagedArtifact({ rootDir, outputDir, requestedName, report, result, signal }) {
  throwIfExecutionAborted(signal);
  const directoryGuard = await ensureSafeWorkflowDirectory(rootDir, outputDir);
  const requestedFileName = createSafeArtifactName(requestedName);
  if ((await readdir(outputDir)).filter(name => /^\.[a-f0-9-]{36}\.workflow\.tmp$/.test(name)).length >= 32) {
    throw workflowStateError("STAGING_CAPACITY", "Retained workflow staging evidence requires explicit maintenance; unknown files were preserved.", 503);
  }
  const stagingPath = resolve(outputDir, `.${randomUUID()}.workflow.tmp`);
  assertInsideDirectory(stagingPath, outputDir);
  const staging = await open(stagingPath, "wx", 0o600);
  const stagingIdentity = await staging.stat({ bigint: true });
  const draft = {
    stagingName: relative(outputDir, stagingPath), requestedName: requestedFileName,
    device: stagingIdentity.dev.toString(), inode: stagingIdentity.ino.toString(), birthtime: stagingIdentity.birthtimeNs.toString(),
    bytes: Buffer.byteLength(report, "utf8"), sha256: createHash("sha256").update(report).digest("hex"), result,
  };
  let failure;
  try {
    await staging.writeFile(report, "utf8");
    await staging.sync();
    await assertSafeStagingPath(stagingPath, stagingIdentity, directoryGuard.tenant.realPath);
  } catch (error) { failure = error; }
  try { await staging.close(); } catch (error) { failure ??= error; }
  if (failure) {
    try { await discardStagedArtifact({ rootDir, outputDir, draft, allowPartial: true }); }
    catch (cleanupError) { Object.assign(failure, { cleanupError }); }
    throw failure;
  }
  return draft;
}

async function discardStagedArtifact({ rootDir, outputDir, draft, allowPartial = false }) {
  const root = await captureDirectoryIdentity(rootDir); const tenant = await captureDirectoryIdentity(outputDir);
  if (resolve(tenant.realPath, "..") !== root.realPath) throw unsafeWorkflowPathError();
  const path = resolve(outputDir, draft.stagingName);
  await assertSafeStagingPath(path, { dev: BigInt(draft.device), ino: BigInt(draft.inode), birthtimeNs: BigInt(draft.birthtime) }, tenant.realPath);
  if ((await lstat(path)).nlink !== 1) throw workflowStateError("STAGING_CLEANUP_REQUIRED", "The staging identity has another link and was preserved.");
  if (!allowPartial && !await matchesArtifact(path, draft)) throw workflowStateError("STAGING_CLEANUP_REQUIRED", "Changed staging content was preserved for explicit maintenance.");
  await unlink(path);
}

async function writeManagedArtifact({ rootDir, outputDir, store, claim, draft, signal, hooks, callbacks }) {
  const directoryGuard = await ensureSafeWorkflowDirectory(rootDir, outputDir);
  const stagingPath = resolve(outputDir, draft.stagingName);
  const stagingIdentity = { dev: BigInt(draft.device), ino: BigInt(draft.inode), birthtimeNs: BigInt(draft.birthtime) };
  await hooks.afterPrepared?.();
  if (callbacks) {
    if (draft.target) {
      if (createPublicationTarget(directoryGuard, draft.target.fileName).fingerprint !== draft.target.fingerprint) {
        throw workflowStateError("TARGET_CHANGED", "The prepared workflow publication directory identity changed.");
      }
    } else {
      let selected;
      for (let version = 1; version <= 100; version += 1) {
        const name = versionedArtifactName(draft.requestedName, version);
        try { await lstat(resolve(outputDir, name)); }
        catch (error) { if (error?.code !== "ENOENT") throw error; selected = name; break; }
      }
      if (!selected) throw workflowStateError("ARTIFACT_VERSION_EXHAUSTED", "No free workflow artifact target is available.");
      draft = { ...draft, target: store.bindPublicationTarget(claim, createPublicationTarget(directoryGuard, selected)) };
    }
  }
  for (let version = 1; version <= 100; version += 1) {
      throwIfExecutionAborted(signal);
      await assertDirectoryIdentity(rootDir, directoryGuard.root);
      await assertDirectoryIdentity(outputDir, directoryGuard.tenant);
      await assertSafeStagingPath(stagingPath, stagingIdentity, directoryGuard.tenant.realPath);
      if (!await matchesArtifact(stagingPath, draft)) throw workflowStateError("STAGED_CONTENT_CHANGED", "Prepared workflow content or file identity changed.");
      const candidateName = draft.target?.fileName ?? versionedArtifactName(draft.requestedName, version);
      const candidatePath = resolve(outputDir, candidateName);
      assertInsideDirectory(candidatePath, outputDir);
      let admission;
      if (callbacks) {
        // A fixed target collision is a known no-write result. Never spend an
        // existing approval for a different version of the requested name.
        try { await lstat(candidatePath); throw workflowStateError("TARGET_OCCUPIED", "The reviewed target now exists; it was preserved and no replacement target was selected."); }
        catch (error) { if (error?.code !== "ENOENT") throw error; }
        const content = await readPreparedReviewContent(stagingPath, draft);
        admission = await callbacks.beforePublish(publicationMaterial(claim, draft, draft.target, content, outputDir));
        await hooks.afterAdmission?.();
        throwIfExecutionAborted(signal);
        await admission.assertActive();
      }
      await hooks.beforeIntent?.();
      throwIfExecutionAborted(signal);
      try {
        store.intendPublication(claim, candidateName, admission?.authorization);
        await hooks.afterIntent?.();
        const result = await store.publish(claim, async () => {
          throwIfExecutionAborted(signal);
          await assertDirectoryIdentity(rootDir, directoryGuard.root);
          await assertDirectoryIdentity(outputDir, directoryGuard.tenant);
          await assertSafeStagingPath(stagingPath, stagingIdentity, directoryGuard.tenant.realPath);
          if (!await matchesArtifact(stagingPath, draft)) throw workflowStateError("STAGED_CONTENT_CHANGED", "Prepared workflow content or file identity changed.");
          await hooks.beforeLink?.();
          if (admission) await admission.assertActive();
          // Authorization may await another durable authority. Recheck the
          // frozen filesystem identities after that await before using paths.
          await assertDirectoryIdentity(rootDir, directoryGuard.root);
          await assertDirectoryIdentity(outputDir, directoryGuard.tenant);
          await assertSafeStagingPath(stagingPath, stagingIdentity, directoryGuard.tenant.realPath);
          if (!await matchesArtifact(stagingPath, draft)) throw workflowStateError("STAGED_CONTENT_CHANGED", "Prepared workflow content or file identity changed during final authorization.");
          throwIfExecutionAborted(signal);
          // The store holds BEGIN IMMEDIATE across this exact effect and its
          // completion commit. Recovery cannot revoke this claim in between.
          await link(stagingPath, candidatePath);
          await syncWorkflowDirectory(outputDir);
          await hooks.afterPublish?.();
          const completed = await reconcileManagedArtifact({ rootDir, outputDir, draft, fileName: candidateName });
          if (!completed) throw workflowStateError("ARTIFACT_RECONCILIATION_REQUIRED", "Published workflow artifact could not be verified.");
          await assertSafeStagingPath(stagingPath, stagingIdentity, directoryGuard.tenant.realPath);
          await unlink(stagingPath);
          return completed;
        });
        return result;
      } catch (error) {
        if (error?.code !== "WORKFLOW_ARTIFACT_COLLISION") throw error;
        store.rejectCollision(claim);
        if (callbacks) throw workflowStateError("TARGET_OCCUPIED", "The reviewed target was occupied concurrently; no alternate file was written.");
      }
  }
  const error = new Error("Workflow artifact version capacity is exhausted for the requested name.");
  error.code = "WORKFLOW_ARTIFACT_VERSION_EXHAUSTED";
  error.category = "conflict";
  error.statusCode = 409;
  throw error;
}

function createPublicationTarget(directoryGuard, fileName) {
  const fingerprint = (identity) => createHash("sha256").update(JSON.stringify([
    "workflow-directory-v1", identity.realPath, identity.dev.toString(), identity.ino.toString(), identity.birthtimeNs.toString(),
  ])).digest("hex");
  const target = { fileName, rootFingerprint: fingerprint(directoryGuard.root), tenantFingerprint: fingerprint(directoryGuard.tenant) };
  return { ...target, fingerprint: workflowTargetFingerprint(target) };
}

function publicationMaterial(claim, draft, target, content, outputDir) {
  return { workflowId: claim.record.workflowId, inputHash: claim.record.inputSha256, subjectFingerprint: claim.record.scopeKey,
    tenantPartition: relative(resolve(outputDir, ".."), outputDir), requestedName: draft.requestedName, target,
    contentHash: draft.sha256, contentBytes: draft.bytes, content };
}

async function readPreparedReviewContent(path, draft) {
  if (draft.bytes > 65_536) return null;
  const bytes = await matchesArtifact(path, draft, true);
  if (!bytes) throw workflowStateError("STAGED_CONTENT_CHANGED", "The prepared artifact cannot be read from its recorded file identity.");
  try {
    const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return content.length <= 16_000 ? content : null;
  } catch { return null; }
}

async function reconcileManagedArtifact({ rootDir, outputDir, draft, fileName, cleanupStaging = false }) {
  // Do not create a missing output directory during recovery.
  const root = await captureDirectoryIdentity(rootDir);
  const tenant = await captureDirectoryIdentity(outputDir);
  if (resolve(tenant.realPath, "..") !== root.realPath) throw unsafeWorkflowPathError();
  const filePath = resolve(outputDir, fileName);
  assertInsideDirectory(filePath, outputDir);
  if (!await matchesArtifact(filePath, draft)) return null;
  await assertDirectoryIdentity(rootDir, root);
  await assertDirectoryIdentity(outputDir, tenant);
  const result = { ...draft.result, artifact: { fileName, absolutePath: filePath, relativePath: toRepoRelative(filePath), bytes: draft.bytes, sha256: draft.sha256 } };
  if (cleanupStaging) {
    const temporary = resolve(outputDir, draft.stagingName);
    let cleanup = "already-absent";
    try {
      const stat = await lstat(temporary);
      cleanup = "preserved-unknown-identity";
      if (stat.isFile() && !stat.isSymbolicLink() && await matchesArtifact(temporary, draft)) {
        await assertDirectoryIdentity(outputDir, tenant);
        await assertSafeStagingPath(temporary, { dev: BigInt(draft.device), ino: BigInt(draft.inode), birthtimeNs: BigInt(draft.birthtime) }, tenant.realPath);
        await unlink(temporary); cleanup = "removed-original-staging";
      }
    } catch (error) { if (error?.code !== "ENOENT") cleanup = "requires-explicit-maintenance"; }
    result.meta = { ...result.meta, stagingCleanup: cleanup };
  }
  return result;
}

async function matchesArtifact(path, draft, returnBytes = false) {
  let handle;
  try {
    const before = await lstat(path, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.dev.toString() !== draft.device || before.ino.toString() !== draft.inode
      || before.birthtimeNs.toString() !== draft.birthtime
      || Number(before.size) !== draft.bytes || before.nlink < 1n || before.nlink > 2n) return false;
    handle = await open(path, "r");
    const opened = await handle.stat({ bigint: true });
    if (opened.dev !== before.dev || opened.ino !== before.ino) return false;
    // Bound recovery reads even if an editor grows the file after stat().
    const buffer = Buffer.alloc(draft.bytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const read = await handle.read(buffer, length, buffer.length - length, length);
      if (read.bytesRead === 0) break;
      length += read.bytesRead;
    }
    const bytes = buffer.subarray(0, length);
    const after = await lstat(path, { bigint: true });
    const matches = after.dev === before.dev && after.ino === before.ino && after.birthtimeNs === before.birthtimeNs
      && bytes.length === draft.bytes && createHash("sha256").update(bytes).digest("hex") === draft.sha256;
    return matches ? returnBytes ? bytes : true : false;
  } catch (error) { if (["ENOENT", "EISDIR"].includes(error?.code)) return false; throw error; }
  finally { await handle?.close(); }
}

async function syncWorkflowDirectory(path) {
  let handle;
  try { handle = await open(path, "r"); await handle.sync(); }
  catch (error) { if (process.platform !== "win32" || !["EACCES", "EPERM", "EISDIR", "ENOTSUP"].includes(error?.code)) throw error; }
  finally { await handle?.close(); }
}

async function ensureSafeWorkflowDirectory(rootDir, tenantDir) {
  assertInsideDirectory(tenantDir, rootDir);
  await mkdir(rootDir, { recursive: true, mode: 0o700 });
  const root = await captureDirectoryIdentity(rootDir);
  await chmod(rootDir, 0o700).catch(() => {});
  const tenantRelative = relative(rootDir, tenantDir);
  if (!tenantRelative || tenantRelative.split(/[\\/]+/u).filter(Boolean).length !== 1) {
    throw unsafeWorkflowPathError();
  }
  try {
    await mkdir(tenantDir, { mode: 0o700 });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
  const tenant = await captureDirectoryIdentity(tenantDir);
  await chmod(tenantDir, 0o700).catch(() => {});
  assertInsideDirectory(tenant.realPath, root.realPath);
  if (resolve(tenant.realPath, "..") !== root.realPath) throw unsafeWorkflowPathError();
  return { root, tenant };
}

async function captureDirectoryIdentity(directoryPath) {
  const stat = await lstat(directoryPath, { bigint: true }).catch(() => {
    throw unsafeWorkflowPathError();
  });
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw unsafeWorkflowPathError();
  const realPath = resolve(await realpath(directoryPath));
  return { realPath, dev: stat.dev, ino: stat.ino, birthtimeNs: stat.birthtimeNs };
}

async function assertDirectoryIdentity(directoryPath, expected) {
  const current = await captureDirectoryIdentity(directoryPath);
  if (current.realPath !== expected.realPath || current.dev !== expected.dev || current.ino !== expected.ino || current.birthtimeNs !== expected.birthtimeNs) {
    throw unsafeWorkflowPathError();
  }
}

async function assertSafeStagingPath(stagingPath, expected, realTenantDir) {
  const stat = await lstat(stagingPath, { bigint: true }).catch(() => {
    throw unsafeWorkflowPathError();
  });
  if (!stat.isFile() || stat.isSymbolicLink() || stat.dev !== expected.dev || stat.ino !== expected.ino
    || expected.birthtimeNs !== undefined && stat.birthtimeNs !== expected.birthtimeNs) {
    throw unsafeWorkflowPathError();
  }
  const canonical = resolve(await realpath(stagingPath));
  assertInsideDirectory(canonical, realTenantDir);
}

function unsafeWorkflowPathError() {
  const error = new Error("Workflow output directories and staging files must be real, unchanged, non-link paths.");
  error.code = "WORKFLOW_OUTPUT_PATH_UNSAFE";
  error.category = "security";
  error.statusCode = 409;
  return error;
}

function requireTenantId(requestContext) {
  const tenantId = typeof requestContext?.tenantId === "string"
    ? requestContext.tenantId.trim()
    : "";
  if (!tenantId) {
    const error = new Error("Workflow execution requires an authenticated server-owned tenant context.");
    error.code = "WORKFLOW_TENANT_CONTEXT_REQUIRED";
    error.category = "auth";
    error.statusCode = 403;
    throw error;
  }
  return tenantId;
}

function tenantPartition(tenantId) {
  return `tenant-${createHash("sha256").update(tenantId, "utf8").digest("hex").slice(0, 24)}`;
}

function versionedArtifactName(fileName, version) {
  if (version === 1) return fileName;
  const stem = fileName.toLowerCase().endsWith(".md") ? fileName.slice(0, -3) : fileName;
  return `${stem}-${version}.md`;
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
