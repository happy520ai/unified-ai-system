import { createHash } from "node:crypto";
import { constants, openSync, closeSync, fstatSync, lstatSync, readSync } from "node:fs";
import { basename, resolve } from "node:path";
import { createGatewayClient } from "@unified-ai-system/shared-sdk";

interface OperatorOptions {
  command: string; positionals: string[]; json: boolean; url: string; timeoutMs: number; timeoutProvided: boolean; adminKey: string | null;
  confirmed: boolean; allowRealProvider: boolean; prompt: string | null; operatorInput: string | null;
  operatorMode: string | null; operatorSources: string[]; operatorPasses: number | null;
  operatorMaxOutputTokens: number | null;
  lifecycleLimit: number | null; lifecycleOffset: number | null; agentId: string | null; agentGoal: string | null;
  agentProviderId: string | null; agentModelId: string | null;
}
interface Output { write(value: string): unknown; writeError(value: string): unknown }
type Data = Record<string, any>;
const OPERATIONS: Record<string, readonly string[]> = {
  knowledge: ["health", "sources", "load", "retrieve"], routing: ["modes", "preview"],
  forge: ["status", "runs", "polish", "quality", "memory", "recall", "orchestrate", "taiji", "workforce"],
  taiji: ["status", "run", "evaluate", "activate", "execute", "revoke", "repair", "reweight", "prune"],
};
const SECRET_KEYS = /^(?:(?:api|provider|signing|encryption)[-_]?key|(?:client[-_]?)?secret|password|authorization|credentials?|private[-_]?key|access[-_]?token|refresh[-_]?token|token|cookies?)$/iu;
const SECRET_TEXT = /\b(?:sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{25,}|gh[pousr]_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._~+/-]{8,}|(?:api[-_]?key|password|secret|access[-_]?token)\s*[:=]\s*[^\s,;"'}]{8,})/giu;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u;
const AGENT = /^agt_[A-Za-z0-9_-]{1,128}$/u;

function invalid(message: string): never { throw Object.assign(new Error(message), { code: "OPERATOR_INPUT_INVALID" }); }
function record(value: unknown): value is Data { return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype); }
function boundedText(value: unknown, limit = 16000): value is string { return typeof value === "string" && value.trim().length > 0 && Buffer.byteLength(value, "utf8") <= limit; }
function count(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) >= 0; }
function keys(value: unknown, required: string[], optional: string[] = []): asserts value is Data {
  if (!record(value) || required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => ![...required, ...optional].includes(key))) invalid("Payload has missing or unsupported fields.");
}
function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (record(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function safeData(value: any, input = false, depth = 0, budget = { nodes: 0 }): any {
  if (++budget.nodes > 20000 || depth > 16) invalid("Payload is too complex to inspect safely.");
  if (value === undefined && !input) return null;
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") { if (!Number.isFinite(value)) invalid("Invalid numeric value."); return value; }
  if (typeof value === "string") {
    if (Buffer.byteLength(value, "utf8") > 262144) invalid("Text exceeds the operator limit.");
    const cleaned = value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, "")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, "").replace(SECRET_TEXT, "[redacted]")
      .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/giu, "$1[redacted]@");
    if (input && (cleaned !== value || /\r(?!\n)/u.test(value))) invalid("Remove credential-like or terminal-control text from the payload.");
    return input ? value : cleaned.replace(/\r\n?/gu, "\n");
  }
  if (Array.isArray(value)) return value.map(item => safeData(item, input, depth + 1, budget));
  if (!record(value)) invalid("Only JSON data is supported.");
  const output: Data = {};
  for (const [key, item] of Object.entries(value)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) invalid("Unsafe object key.");
    if (SECRET_KEYS.test(key)) { if (input) invalid("Credentials must not be included in an operation payload."); output[key] = "[redacted]"; }
    else output[key] = safeData(item, input, depth + 1, budget);
  }
  return output;
}
function readPayload(path: string, parse: (text: string) => unknown = JSON.parse): Data {
  const absolute = resolve(path);
  if (/^(?:\.env(?:\..*)?|\.mcp\.json|auth\.json|secret\.key)$/iu.test(basename(absolute))) invalid("Protected configuration files are not operation payloads.");
  let descriptor: number | undefined;
  try {
    const before = lstatSync(absolute, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || before.size > 1048576n) invalid("Input must be one regular JSON file no larger than 1 MiB.");
    descriptor = openSync(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = fstatSync(descriptor, { bigint: true });
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.nlink !== 1n || opened.size !== before.size) invalid("Input file changed before reading.");
    const bytes = Buffer.alloc(Number(opened.size) + 1), length = readSync(descriptor, bytes, 0, bytes.length, 0);
    if (length !== Number(opened.size)) invalid("Input file changed while reading.");
    const raw = bytes.subarray(0, length).toString("utf8"), after = fstatSync(descriptor, { bigint: true }), named = lstatSync(absolute, { bigint: true });
    if (after.size !== opened.size || after.mtimeNs !== opened.mtimeNs || named.dev !== opened.dev || named.ino !== opened.ino || named.nlink !== 1n) invalid("Input file changed while reading.");
    const value: unknown = parse(raw.replace(/^\uFEFF/u, ""));
    if (!record(value)) invalid("Input must contain one JSON object.");
    return safeData(value, true);
  } catch (error) {
    if ((error as any)?.code === "OPERATOR_INPUT_INVALID") throw error;
    return invalid("Cannot read a stable, valid JSON operation file.");
  } finally { if (descriptor !== undefined) closeSync(descriptor); }
}

export { readPayload as readOperatorPayload, safeData as sanitizeOperatorData };
export type { OperatorOptions, Output };

export function validateOperatorOptions(options: OperatorOptions): void {
  const operation = options.positionals[0];
  if (!OPERATIONS[options.command]?.includes(operation)) invalid(`${options.command} supports: ${OPERATIONS[options.command]?.join(", ") ?? "none"}.`);
  if (options.command === "taiji") {
    const mutation = ["evaluate", "activate", "execute", "revoke", "repair", "reweight", "prune"].includes(operation);
    if (options.prompt !== null || options.agentGoal !== null || options.allowRealProvider || options.agentProviderId !== null
      || options.agentModelId !== null || options.operatorMaxOutputTokens !== null || options.operatorMode !== null
      || options.operatorSources.length || options.operatorPasses !== null) invalid("Taiji uses a fixed local profile and a JSON operation file.");
    if (options.positionals.length !== (operation === "run" ? 2 : 1) || mutation !== Boolean(options.operatorInput)) invalid("Use --input for Taiji mutations, or taiji run <run-id> for a recorded result.");
    if (options.confirmed && !mutation) invalid("--yes is only valid with a Taiji mutation.");
    if ((options.lifecycleLimit !== null || options.lifecycleOffset !== null) && operation !== "status") invalid("Taiji pagination is only valid with status.");
    if ((options.lifecycleLimit !== null && (options.lifecycleLimit < 1 || options.lifecycleLimit > 100))
      || (options.lifecycleOffset !== null && options.lifecycleOffset > 1000)) invalid("Taiji limit is 1–100 and offset is 0–1000.");
    if (!mutation && (!options.agentId || !AGENT.test(options.agentId))) invalid("Taiji inspection requires --agent-id.");
    if (operation === "run" && !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(options.positionals[1])) invalid("Invalid Taiji run ID.");
    try { const url = new URL(options.url); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) invalid("Invalid gateway URL."); }
    catch { invalid("Invalid gateway URL."); }
    return;
  }
  const textual = options.command === "knowledge" && operation === "retrieve" || options.command === "routing" && operation === "preview"
    || options.command === "forge" && ["polish", "quality", "memory", "recall", "taiji", "workforce"].includes(operation);
  if (!textual && (options.positionals.length !== 1 || options.prompt !== null)) invalid("This operation does not accept prompt text.");
  if (options.prompt !== null && options.positionals.length > 1) invalid("Use positional text or --prompt, not both.");
  if (options.operatorInput && (options.prompt !== null || options.positionals.length > 1 || options.agentGoal !== null)) invalid("Use --input or inline content, not both.");
  const needsPayload = options.command === "knowledge" && operation === "load";
  if (needsPayload && !options.operatorInput) invalid("knowledge load requires --input with a JSON document batch.");
  if (options.operatorInput && ["health", "sources", "modes", "status", "runs"].includes(operation)) invalid("This read operation does not accept --input.");
  if (options.operatorMode !== null && !(options.command === "routing" && operation === "preview" || options.command === "knowledge" && operation === "retrieve")) invalid("--mode is only valid with routing preview or knowledge retrieve.");
  if (options.operatorSources.length && !(options.command === "knowledge" && operation === "retrieve")) invalid("--source-id is only valid with knowledge retrieve.");
  if (options.operatorSources.length > 100 || options.operatorSources.some(id => !IDENTIFIER.test(id))) invalid("Source IDs must be bounded identifiers.");
  if (options.operatorPasses !== null && !(options.command === "forge" && operation === "polish")) invalid("--passes is only valid with forge polish.");
  if (options.lifecycleLimit !== null && !["sources", "retrieve", "runs", "recall"].includes(operation)) invalid("--limit is not valid for this operation.");
  if (options.lifecycleOffset !== null && !(options.command === "knowledge" && operation === "sources")) invalid("--offset is only valid with knowledge sources.");
  const modelOperation = options.command === "forge" && ["polish", "orchestrate"].includes(operation);
  if (!modelOperation && (options.agentProviderId !== null || options.agentModelId !== null)) invalid("Provider/model selection is only valid with forge polish or orchestrate.");
  if (!modelOperation && options.operatorMaxOutputTokens !== null) invalid("--max-output-tokens is only valid with forge polish or orchestrate.");
  if (!(options.command === "forge" && operation === "orchestrate") && (options.agentId !== null || options.agentGoal !== null)) invalid("--agent-id and --goal are only valid with forge orchestrate here.");
  if (options.allowRealProvider && !modelOperation && !(options.command === "knowledge" && operation === "retrieve")) invalid("This operation cannot use --allow-real-provider.");
  const mutation = needsPayload || options.command === "forge" && ["polish", "memory", "orchestrate"].includes(operation);
  if (options.confirmed && !mutation) invalid("--yes is only valid with knowledge load or forge polish, memory and orchestrate.");
  try { const url = new URL(options.url); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) invalid("Gateway URL must use HTTP(S) without credentials, query or fragment."); }
  catch { invalid("Invalid gateway URL."); }
}

function selection(options: OperatorOptions, supplied: unknown): Data | undefined {
  let target: any = supplied;
  if (options.agentProviderId !== null || options.agentModelId !== null) {
    const flags = { providerId: options.agentProviderId, modelId: options.agentModelId };
    if (target !== undefined && canonical(target) !== canonical(flags)) invalid("Model selection conflicts with the input file.");
    target = flags;
  }
  if (target === undefined && !options.allowRealProvider) target = { providerId: "local-fake-provider", modelId: "local-fake-model" };
  if (target !== undefined) {
    keys(target, ["providerId", "modelId"]);
    if (![target.providerId, target.modelId].every(id => typeof id === "string" && IDENTIFIER.test(id))) invalid("Model selection requires bounded --provider-id and --model-id together.");
    if (target.providerId !== "local-fake-provider" && !options.allowRealProvider) invalid("A non-fake provider requires --allow-real-provider.");
    safeData(target, true);
  }
  return target;
}
function buildRequest(options: OperatorOptions): { body: Data | undefined; mutation: boolean; preview: boolean } {
  const operation = options.positionals[0], input = options.operatorInput ? readPayload(options.operatorInput) : undefined;
  const text = options.prompt ?? options.positionals.slice(1).join(" ");
  const requiredText = () => { if (!boundedText(text)) invalid("Provide non-empty text of at most 16000 UTF-8 bytes."); return text; };
  let body: Data | undefined, mutation = false, preview = false;
  if (options.command === "taiji") {
    mutation = ["evaluate", "activate", "execute", "revoke", "repair", "reweight", "prune"].includes(operation);
    body = input ?? {};
    if (options.agentId !== null && body.agentId !== undefined && body.agentId !== options.agentId) invalid("Agent ID conflicts with the input file.");
    body.agentId = options.agentId ?? body.agentId;
    if (!AGENT.test(body.agentId ?? "")) invalid("Taiji requires an owned root Agent ID.");
    if (operation === "run") body.runId = options.positionals[1];
    if (operation === "execute" && body.selection !== undefined) {
      keys(body, ["agentId", "selection", "runId", "arguments"]); keys(body.selection, ["profileId"]);
      if (!["risk-classification-v1", "context-jsonl-v1", "evidence-summary-v1"].includes(body.selection.profileId)
        || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(body.runId) || !record(body.arguments)) invalid("Invalid automatic capability selection request.");
    } else if (mutation) {
      const required = ["agentId", "capabilityId", "expectedLifecycleRevision", ...(operation === "evaluate" ? ["request", "profileId"] : ["revision"]),
        ...(operation === "execute" ? ["runId", "arguments"] : []),
        ...(["repair", "reweight", "prune"].includes(operation) ? ["sourceRunId"] : []),
        ...(operation === "repair" ? ["sourceArguments", "addRiskKeywords"] : [])];
      keys(body, required, operation === "activate" ? ["limits"] : operation === "revoke" ? ["reason"] : operation === "evaluate" ? ["parameters"] : []);
      if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(body.capabilityId) || !count(body.expectedLifecycleRevision)
        || operation !== "evaluate" && (!Number.isSafeInteger(body.revision) || body.revision < 1 || body.revision > 20)) invalid("Invalid capability identity or revision; inspect taiji status first.");
      if (operation === "evaluate" && (!boundedText(body.request, 4000) || !["risk-classification-v1", "context-jsonl-v1", "evidence-summary-v1"].includes(body.profileId))) invalid("Invalid capability profile or request.");
      if (operation === "execute" && (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(body.runId) || !record(body.arguments))) invalid("Execution requires a unique run ID and JSON arguments.");
    }
  } else if (options.command === "knowledge" && operation === "load") {
    body = input!; keys(body, ["sourceId", "documents"], ["sourceTitle", "metadata"]);
    if (typeof body.sourceId !== "string" || !IDENTIFIER.test(body.sourceId) || !Array.isArray(body.documents) || !body.documents.length) invalid("Knowledge load requires a source ID and document array.");
    for (const document of body.documents) { keys(document, [], ["documentId", "title", "uri", "text", "content", "metadata"]); if (!boundedText(document.content ?? document.text, 262144)) invalid("Every document requires non-empty content."); }
    mutation = true;
  } else if (options.command === "knowledge" && operation === "retrieve") {
    body = input ?? { query: requiredText() }; keys(body, ["query"], ["context", "mode", "sourceIds", "topK", "minScore", "filters", "metadata"]);
    if (!boundedText(body.query)) invalid("Invalid retrieval query.");
    if (options.operatorMode !== null && body.mode !== undefined && options.operatorMode !== body.mode) invalid("Retrieval modes conflict.");
    body.mode = options.operatorMode ?? body.mode ?? "keyword";
    if (!["keyword", "vector"].includes(body.mode)) invalid("Knowledge mode must be keyword or vector.");
    if (body.mode === "vector" && !options.allowRealProvider) invalid("Vector retrieval may use an embedding provider; authorize it with --allow-real-provider.");
    if (options.operatorSources.length) { if (body.sourceIds !== undefined) invalid("Source filters conflict with the input file."); body.sourceIds = [...new Set(options.operatorSources)]; }
    if (body.sourceIds !== undefined && (!Array.isArray(body.sourceIds) || body.sourceIds.length > 100 || body.sourceIds.some((id: unknown) => typeof id !== "string" || !IDENTIFIER.test(id)))) invalid("Source filters must be bounded source IDs.");
    body.topK = options.lifecycleLimit ?? body.topK ?? 5;
    if (!Number.isSafeInteger(body.topK) || body.topK < 1 || body.topK > 100) invalid("Retrieval limit must be 1–100.");
  } else if (options.command === "routing" && operation === "preview") {
    body = input ?? { query: requiredText() }; if (!boundedText(body.query)) invalid("Routing preview requires a query.");
    if (options.operatorMode !== null && !["answer-path", "quality-cost"].includes(options.operatorMode)) invalid("Routing preview mode must be answer-path or quality-cost.");
    preview = true;
  } else if (options.command === "forge" && !["status", "runs"].includes(operation)) {
    if (operation === "orchestrate") {
      body = input ?? { goal: options.agentGoal, agentId: options.agentId };
      keys(body, ["goal"], ["agentId", "options"]);
      if (options.agentId !== null && body.agentId !== undefined && options.agentId !== body.agentId) invalid("Agent IDs conflict.");
      body.agentId ??= options.agentId;
      if (!boundedText(body.goal) || typeof body.agentId !== "string" || !AGENT.test(body.agentId)) invalid("Forge orchestration requires a goal and server-issued --agent-id.");
      body.options ??= {}; keys(body.options, [], ["useRefiner", "maxConcurrent", "budget", "checkpointAfter", "enableCodeIntel", "webTask", "modelSelection", "maxOutputTokens"]);
      const selected = selection(options, body.options.modelSelection); if (selected) body.options.modelSelection = selected;
      body.options.maxOutputTokens = options.operatorMaxOutputTokens ?? body.options.maxOutputTokens ?? 4096;
      if (!Number.isInteger(body.options.maxOutputTokens) || body.options.maxOutputTokens < 1 || body.options.maxOutputTokens > 16384) invalid("Output token limit must be 1–16384.");
      mutation = true;
    } else {
      const field = ({ polish: "content", quality: "code", memory: "content", recall: "query", taiji: "request", workforce: "task" } as Record<string, string>)[operation];
      body = input ?? { [field]: requiredText() };
      const optional = ({ polish: ["task", "passes", "modelSelection", "maxOutputTokens"], quality: ["task"], memory: ["metadata"], recall: ["limit"], taiji: ["capabilityId", "displayName"], workforce: [] } as Record<string, string[]>)[operation];
      keys(body, [field], optional); if (!boundedText(body[field])) invalid("Invalid Forge operation text.");
      if (operation === "polish") { const selected = selection(options, body.modelSelection); if (selected) body.modelSelection = selected;
        body.maxOutputTokens = options.operatorMaxOutputTokens ?? body.maxOutputTokens ?? 4096;
        if (!Number.isInteger(body.maxOutputTokens) || body.maxOutputTokens < 1 || body.maxOutputTokens > 16384) invalid("Output token limit must be 1–16384.");
        body.passes = options.operatorPasses ?? body.passes ?? 3;
        if (!Number.isInteger(body.passes) || body.passes < 1 || body.passes > 10) invalid("Polish passes must be 1–10."); }
      if (operation === "recall") {
        body.limit = options.lifecycleLimit ?? body.limit ?? 5;
        if (!Number.isSafeInteger(body.limit) || body.limit < 1 || body.limit > 100) invalid("Recall limit must be 1–100.");
      }
      mutation = ["polish", "memory"].includes(operation); preview = ["taiji", "workforce"].includes(operation);
    }
  }
  if (body) safeData(body, true);
  return { body, mutation, preview };
}
function unwrap(value: any): Data {
  if (!record(value) || value.status !== "ok" || !record(value.data)) throw Object.assign(new Error("Invalid gateway result envelope."), { code: "OPERATOR_RESPONSE_INVALID" });
  return value.data;
}

export function projectForgeApprovalReview(value: unknown): Data {
  keys(value, ["schemaVersion", "reviewable", "effectType", "policyHash", "forge"], ["redactedFields"]);
  const forge = value.forge;
  keys(forge, ["goal", "goalDigest", "goalBytes", "optionsHash", "options"]);
  if (value.schemaVersion !== 1 || value.reviewable !== true || value.effectType !== "forge:orchestrate"
    || !boundedText(value.policyHash, 160) || !boundedText(forge.goal, 65536) || forge.goal.length > 16000
    || forge.goalBytes !== Buffer.byteLength(forge.goal, "utf8")
    || forge.goalDigest !== "sha256:" + createHash("sha256").update(forge.goal).digest("hex")) invalid("Forge approval goal is incomplete or mismatched.");
  const options = forge.options;
  keys(options, ["enableCodeIntel"], ["useRefiner", "maxConcurrent", "budget", "checkpointAfter", "webTask", "modelSelection", "maxOutputTokens"]);
  if (options.maxOutputTokens !== undefined && (!Number.isInteger(options.maxOutputTokens) || options.maxOutputTokens < 1 || options.maxOutputTokens > 16384)) invalid("Forge approval output limit is invalid.");
  if (options.enableCodeIntel !== false || forge.optionsHash !== "sha256:" + createHash("sha256").update(canonical(options)).digest("hex")) invalid("Forge approval options are incomplete or mismatched.");
  if (options.budget !== undefined) {
    keys(options.budget, [], ["maxTokens", "maxCost", "maxMinutes"]);
    for (const [key, maximum] of [["maxTokens", 1000000], ["maxMinutes", 120]] as const) {
      if (options.budget[key] !== undefined && (!Number.isInteger(options.budget[key]) || options.budget[key] < 1 || options.budget[key] > maximum)) invalid("Forge approval budget is invalid.");
    }
    if (options.budget.maxCost !== undefined && (typeof options.budget.maxCost !== "number" || !Number.isFinite(options.budget.maxCost) || options.budget.maxCost < 0 || options.budget.maxCost > 100)) invalid("Forge approval cost limit is invalid.");
  }
  if (options.modelSelection !== undefined) {
    keys(options.modelSelection, ["providerId", "modelId"]);
    if (![options.modelSelection.providerId, options.modelSelection.modelId].every(id => typeof id === "string" && IDENTIFIER.test(id))) invalid("Forge approval model selection is invalid.");
  }
  return safeData(value, true);
}
export function projectTaijiApprovalReview(value: unknown): Data {
  keys(value, ["schemaVersion", "reviewable", "effectType", "policyHash", "taiji"], ["redactedFields"]);
  const taiji = value.taiji; keys(taiji, ["operation", "params", "paramsHash", "effect"]);
  if (value.schemaVersion !== 1 || value.reviewable !== true || value.effectType !== "taiji:capability" || !/^sha256:[a-f0-9]{64}$/.test(value.policyHash)
    || !["evaluate", "activate", "execute", "repair", "reweight", "prune"].includes(taiji.operation) || !record(taiji.params) || taiji.params.operation !== taiji.operation
    || taiji.paramsHash !== "sha256:" + createHash("sha256").update(canonical(taiji.params)).digest("hex")
    || !boundedText(taiji.effect, 512) || Buffer.byteLength(canonical(value)) > 80000) invalid("Taiji review is incomplete or has changed.");
  if (!/^sha256:[a-f0-9]{64}$/.test(taiji.params.ownerHash) || !/^[a-f0-9-]{36}$/.test(taiji.params.authorityEpoch)
    || !count(taiji.params.lifecycleRevision) || !Number.isSafeInteger(taiji.params.revision) || taiji.params.revision < 1) invalid("Taiji review has no valid owner/version binding.");
  const common = ["operation", "capabilityId", "lifecycleRevision", "revision", "profileId", "implementationHash", "ownerHash", "authorityEpoch", "parameters"];
  const extra = taiji.operation === "evaluate" ? ["request", "compiledSpec", "suiteHash"]
    : taiji.operation === "repair" ? ["request", "compiledSpec", "suiteHash", "baseRevision", "regression", "addRiskKeywords", "feedback"]
      : taiji.operation === "activate" ? ["candidateHash", "evaluationHash", "limits"]
        : taiji.operation === "reweight" || taiji.operation === "prune" ? ["candidateHash", "feedback", "previousWeight", "proposedWeight"]
          : ["candidateHash", "activationEpoch", "runId", "arguments", "argumentsHash"];
  keys(taiji.params, [...common, ...extra], taiji.operation === "execute" ? ["selection"] : []);
  return safeData(value, true);
}
function validTaijiResult(operation: string, value: Data, body?: Data): void {
  const bad = (): never => { throw Object.assign(new Error("Taiji returned incomplete or mismatched execution evidence."), { code: "OPERATOR_RESPONSE_INVALID" }); };
  if (operation === "status") {
    if (typeof value.enabled !== "boolean" || !Array.isArray(value.profiles) || !Array.isArray(value.capabilities) || !Array.isArray(value.runs)
      || !count(value.capabilityCount) || !count(value.runCount) || value.capabilities.length > value.capabilityCount || value.runs.length > value.runCount
      || value.capabilities.some((capability: any) => !record(capability) || !boundedText(capability.id, 128) || !count(capability.lifecycleRevision))) bad();
    return;
  }
  if (value.status === "approval_required") {
    if (!boundedText(value.approvalId, 160) || value.agentId !== body?.agentId || value.toolName !== "taiji_capability") bad(); return;
  }
  if (["evaluate", "activate", "revoke", "repair", "reweight", "prune"].includes(operation)) {
    if (!record(value.capability) || value.capability.id !== body?.capabilityId || !count(value.capability.lifecycleRevision)
      || !Array.isArray(value.capability.versions) || !["evaluated", "active", "revoked", "failed", "unknown", "pruned", "reweighted"].includes(value.status)) bad();
    if (value.status === "active" && (operation !== "activate" || value.capability.activation?.revision !== body?.revision)) bad();
    if (value.status === "evaluated" && (!["evaluate", "repair"].includes(operation) || value.capability.versions.at(-1)?.evaluation?.passed !== true
      || !value.capability.versions.at(-1)?.evaluation?.tests?.length)) bad();
    if (value.status === "revoked" && (operation !== "revoke" || !value.capability.versions.some((version: any) => version.revision === body?.revision && version.status === "revoked"))) bad();
    if (value.status === "pruned" && (operation !== "prune" || !value.capability.versions.some((version: any) => version.revision === body?.revision && version.status === "revoked" && version.weight === 0))) bad();
    if (value.status === "reweighted" && (operation !== "reweight" || !value.capability.versions.some((version: any) => version.revision === body?.revision && typeof version.weight === "number"))) bad();
    return;
  }
  const run = value.run;
  if (!record(run) || run.id !== body?.runId || !boundedText(run.capabilityId, 128) || !Number.isSafeInteger(run.revision) || run.revision < 1
    || body?.capabilityId !== undefined && (run.capabilityId !== body.capabilityId || run.revision !== body.revision)
    || !["running", "passed", "failed", "cancelled", "unknown"].includes(run.status)) bad();
  if (run.status === "passed") {
    const artifact = run.result?.artifact;
    if (!record(artifact) || typeof artifact.content !== "string" || artifact.bytes !== Buffer.byteLength(artifact.content)
      || artifact.sha256 !== "sha256:" + createHash("sha256").update(artifact.content).digest("hex")
      || run.result.actualExecution !== true || run.result.workerClosed !== true || run.result.modelUsage?.unit !== "tokens"
      || run.result.modelUsage.total !== 0 || run.result.modelUsage.requests !== 0) bad();
  }
}
function validResult(command: string, operation: string, data: Data, body?: Data): void {
  const bad = () => { throw Object.assign(new Error("Gateway returned an incomplete or inconsistent result."), { code: "OPERATOR_RESPONSE_INVALID" }); };
  if (command === "taiji") { validTaijiResult(operation, data, body); return; }
  if (command === "knowledge") {
    if (operation === "health" && (!boundedText(data.status, 80) || ![data.sourceCount, data.documentCount, data.chunkCount].every(count))) bad();
    if (operation === "sources" && (!Array.isArray(data.sources) || data.sources.some((row: any) => !record(row) || !boundedText(row.sourceId, 256) || !count(row.documentCount)))) bad();
    if (operation === "load" && (data.status !== "loaded" || data.sourceId !== body?.sourceId || ![data.loadedCount, data.sourceCount, data.documentCount].every(count)
      || data.loadedCount !== body?.documents.length || !Array.isArray(data.documents) || data.documents.length !== data.loadedCount
      || data.documents.some((document: any) => !record(document) || document.sourceId !== body?.sourceId || !boundedText(document.documentId, 256)))) bad();
    if (operation === "retrieve" && (!Array.isArray(data.chunks) || data.chunks.some((row: any) => !record(row) || !boundedText(row.text, 262144) || !record(row.document)))) bad();
  } else if (command === "routing") {
    if (operation === "modes" && (!Array.isArray(data.modes) || !Array.isArray(data.routeModes))) bad();
    if (operation === "preview" && (data.success !== true || data.externalApiCalled !== false || data.paidApiCallCount !== 0
      || data.modelActuallyCalled !== undefined && data.modelActuallyCalled !== false
      || !["local-routing-preview-only", "local-quality-cost-routing-preview-only"].includes(data.mode) || typeof data.shouldBlock !== "boolean")) bad();
  } else {
    if (operation === "status" && typeof data.enabled !== "boolean") bad();
    if (operation === "runs" && (data.ok !== true || !Array.isArray(data.runs) || !count(data.total))) bad();
    if (operation === "orchestrate" && data.outcome === "approval_required") { if (!boundedText(data.approvalId, 160) || data.agentId !== body?.agentId || data.toolName !== "forge_orchestrate") bad(); }
    else if (!["status", "taiji", "workforce"].includes(operation) && typeof data.ok !== "boolean") bad();
    if (operation === "polish" && data.ok === true && (!record(data.result) || !boundedText(data.result.code, 262144))) bad();
    if (operation === "memory" && data.ok === true && !boundedText(data.id, 256)) bad();
    if (operation === "recall" && data.ok === true && (!record(data.working) || !Array.isArray(data.working.entries) || !Array.isArray(data.semantic)
      || data.working.entries.some((entry: any) => !record(entry) || !boundedText(entry.content, 262144)))) bad();
    if (operation === "orchestrate" && data.ok === true && (!boundedText(data.runId, 160) || !record(data.result)
      || !["completed", "failed"].includes(data.result.status) || !count(data.result.completedTasks) || !count(data.result.failedTasks)
      || data.result.status === "completed" && (data.result.completedTasks < 1 || data.result.failedTasks !== 0))) bad();
    if (operation === "orchestrate" && data.ok === true && body?.options?.webTask
      && (!record(data.result?.web) || data.result.web.goalVerified !== true || data.result.web.browserClosed !== true
        || data.result.web.agentId !== body.agentId || data.result.web.profileId !== body.options.webTask.profileId)) bad();
    if (operation === "quality" && (!record(data.evaluation) || typeof data.evaluation.passed !== "boolean")) bad();
    if (operation === "taiji" && (!record(data.spec) || !record(data.risk) || !record(data.manifest))) bad();
    if (operation === "workforce" && (data.route !== "/workforce/preview" || !record(data.preview))) bad();
  }
}

export async function runOperatorCommand(options: OperatorOptions, output: Output): Promise<number> {
  const operation = options.positionals[0]; let dispatched = false, mutation = false, requestDigest: string | undefined;
  let requestBody: Data | undefined;
  try {
    const request = buildRequest(options); mutation = request.mutation; requestBody = request.body;
    requestDigest = createHash("sha256").update(canonical({ command: options.command, operation, gatewayUrl: options.url, body: request.body ?? null })).digest("hex");
    if (mutation && !options.confirmed) {
      const review = options.command === "knowledge" ? { sourceId: request.body!.sourceId, documentCount: request.body!.documents.length,
        documentIds: request.body!.documents.map((document: any, index: number) => document.documentId ?? `loaded-document-${index + 1}`) }
        : request.body;
      const plan = { ok: true, status: "preview", command: options.command, operation, requestDigest, request: review,
        nextAction: "Review this request, then repeat the same command with --yes. Server approval may still be required." };
      output.write(options.json ? JSON.stringify(plan, null, 2) + "\n" : `Preview: ${options.command} ${operation}\n${JSON.stringify(review, null, 2)}\nRequest digest: ${requestDigest}\n${plan.nextAction}\n`);
      return 0;
    }
    // Align the default wait with the built-in 240s Agent execution ceiling;
    // explicit --timeout and the server's own deadline retain priority.
    const timeoutMs = !options.timeoutProvided && options.command === "forge" && ["polish", "orchestrate"].includes(operation)
      ? 245000 : options.timeoutMs;
    const client = createGatewayClient({ baseUrl: options.url, timeoutMs,
      headers: options.adminKey ? { authorization: `Bearer ${options.adminKey}` } : {} });
    const body = request.body as any;
    let envelope: unknown;
    dispatched = true;
    if (options.command === "taiji") {
      const handlers: Record<string, () => Promise<unknown>> = {
        status: () => client.taijiCapabilities(body.agentId, { ...(options.lifecycleLimit !== null ? { limit: options.lifecycleLimit } : {}), ...(options.lifecycleOffset !== null ? { offset: options.lifecycleOffset } : {}) }),
        run: () => client.taijiCapabilityRun(body.agentId, body.runId), evaluate: () => client.evaluateTaijiCapability(body),
        activate: () => client.activateTaijiCapability(body), execute: () => client.executeTaijiCapability(body), revoke: () => client.revokeTaijiCapability(body),
        repair: () => client.repairTaijiCapability(body), reweight: () => client.reweightTaijiCapability(body), prune: () => client.pruneTaijiCapability(body),
      }; envelope = await handlers[operation]();
    } else if (options.command === "knowledge") {
      if (operation === "health") envelope = await client.knowledgeHealth();
      else if (operation === "sources") envelope = await client.knowledgeSources();
      else if (operation === "load") envelope = await client.knowledgeLoad(body);
      else envelope = await client.knowledgeRetrieve(body);
    } else if (options.command === "routing") envelope = operation === "modes" ? await client.routeModes() : await client.routingPreview((options.operatorMode ?? "answer-path") as "answer-path", body);
    else {
      const handlers: Record<string, () => Promise<unknown>> = { status: () => client.forgeStatus(), runs: () => client.forgeRuns(), polish: () => client.forgePolish(body),
        quality: () => client.forgeQuality(body), memory: () => client.forgeRemember(body), recall: () => client.forgeRecall(body), orchestrate: () => client.forgeOrchestrate(body),
        taiji: () => client.taijiCompile(body), workforce: () => client.workforcePreview(body) };
      envelope = await handlers[operation]();
    }
    const raw = unwrap(envelope); validResult(options.command, operation, raw, body);
    const data = safeData(raw), approval = data.outcome === "approval_required" || options.command === "taiji" && data.status === "approval_required";
    if (operation === "sources") { const total = data.sources.length; data.sources = data.sources.slice(options.lifecycleOffset ?? 0, (options.lifecycleOffset ?? 0) + (options.lifecycleLimit ?? 50))
      .map((source: any) => ({ sourceId: source.sourceId, title: source.title, documentCount: source.documentCount })); data.total = total; }
    if (operation === "runs") data.runs = data.runs.slice(-(options.lifecycleLimit ?? 50));
    const ok = !approval && data.ok !== false && !(operation === "quality" && data.evaluation.passed === false)
      && !(options.command === "taiji" && ["failed", "cancelled", "unknown", "running"].includes(data.run?.status ?? data.status))
      && !(options.command === "routing" && data.shouldBlock === true) && !(operation === "orchestrate" && data.result?.status !== "completed");
    const nextAction = approval ? `Inspect agents approvals --agent-id ${body.agentId}; approve the exact request, then repeat this command. Do not approve automatically.`
      : options.command === "taiji" ? "Inspect taiji status for current revisions, and taiji run <run-id> for recorded artifacts. Revoked versions require a newly evaluated version and approval."
      : options.command === "routing" ? "Preview only: no model was called. Actual execution checks current provider availability and policy."
        : operation === "load" ? "Use knowledge sources and knowledge retrieve to verify the imported documents."
          : operation === "orchestrate" ? "Inspect forge runs and keep the returned run ID; unknown outcomes must not be retried automatically."
            : request.preview ? "This is a local draft/preview; it did not activate a capability or execute a workforce."
              : operation === "quality" ? "Static inspection only; run project tests before treating this as implementation evidence."
              : operation === "memory" ? "This is Forge session memory; inspect forge recall before another write."
                : "Inspect the result before the next operation.";
    const result = { ok, command: options.command, operation, status: approval ? "approval_required" : ok ? request.preview ? "preview" : "completed" : "not_completed", retryAllowed: false, requestDigest, data, nextAction };
    output.write(options.json ? JSON.stringify(result, null, 2) + "\n" : render(result));
    return approval ? 3 : ok ? 0 : 1;
  } catch (error: any) {
    if (options.command === "taiji" && error.statusCode === 422 && record(error.responseBody?.data)) {
      try {
        validTaijiResult(operation, error.responseBody.data, requestBody);
        const result = { ok: false, command: "taiji", operation, status: "not_completed", retryAllowed: false, requestDigest,
          data: safeData(error.responseBody.data), nextAction: "Read the recorded run and first failure before changing input or requesting another approval." };
        output.write(options.json ? JSON.stringify(result, null, 2) + "\n" : render(result)); return 1;
      } catch { /* A malformed recorded failure follows the normal fail-closed response path. */ }
    }
    const remote = record(error?.responseBody?.error) ? error.responseBody.error : record(error?.responseBody?.data) ? error.responseBody.data : {};
    const code = typeof (remote.code ?? error.code) === "string" && /^[A-Za-z][A-Za-z0-9_:-]{0,127}$/u.test(remote.code ?? error.code) ? remote.code ?? error.code : "OPERATOR_REQUEST_FAILED";
    const unknown = dispatched && mutation && (remote.details?.outcomeUnknown === true || !Number.isInteger(error.statusCode) || error.statusCode >= 500);
    const causeCode = typeof remote.details?.causeCode === "string" && /^[A-Za-z][A-Za-z0-9_:-]{0,127}$/u.test(remote.details.causeCode) ? remote.details.causeCode : null;
    const failure = { ok: false, command: options.command, operation, code, causeCode, status: unknown ? "unknown-reconcile-required" : "rejected", retryAllowed: false,
      httpStatus: Number.isInteger(error.statusCode) ? error.statusCode : null,
      requestDigest, message: code === "OPERATOR_INPUT_INVALID" ? error.message
        : options.command === "taiji" && boundedText(remote.message, 2000) ? remote.message : "Gateway operation did not return a verified result.",
      runId: typeof remote.details?.reconciliation?.runId === "string" && /^[A-Za-z0-9_.:-]{1,160}$/u.test(remote.details.reconciliation.runId) ? remote.details.reconciliation.runId
        : options.command === "taiji" && typeof requestBody?.runId === "string" && /^[A-Za-z0-9_.:-]{1,128}$/u.test(requestBody.runId) ? requestBody.runId : undefined,
      nextAction: causeCode === "COST_GUARD_BLOCKED" ? "Reduce --max-output-tokens to fit the gateway policy, then review before another model request."
        : options.command === "knowledge" ? "Check the scoped gateway key, knowledge health and sources; inspect existing documents before repeating a load."
        : options.command === "forge" ? "Inspect forge status, forge runs and agents approvals. Keep the same goal and inspect unknown effects before another execution."
          : options.command === "taiji" ? "Inspect taiji status and the returned run ID. Do not resubmit an unknown operation; read its persisted state first."
          : "Check gateway authentication and preview inputs; no automatic retry is performed." };
    output.writeError(options.json ? JSON.stringify(safeData(failure), null, 2) + "\n" : `${code}${causeCode ? ` (${causeCode})` : ""}: ${safeData(failure.message)}\n${failure.nextAction}\n`);
    return code === "OPERATOR_INPUT_INVALID" ? 2 : 1;
  }
}

function render(result: any): string {
  const { command, operation, data } = result;
  const lines = [`${command} ${operation}: ${result.status}`];
  if (command === "taiji") {
    if (data.status === "approval_required") lines.push(`Approval required: ${data.approvalId}`);
    else if (operation === "status") lines.push(`Taiji is ${data.enabled ? "enabled" : "disabled"}; Agent ${data.agentStatus ?? "unknown"}; ${data.capabilityCount} capabilities, ${data.runCount} recorded runs.`,
      ...data.capabilities.map((capability: any) => `${capability.id}: lifecycle revision ${capability.lifecycleRevision}; active version ${capability.activation?.revision ?? "none"}`));
    else if (data.run) lines.push(`Run ${data.run.id}: ${data.run.status}; capability ${data.run.capabilityId} v${data.run.revision}`,
      ...(data.run.result?.blockedReason ? [`Reason: ${data.run.result.blockedReason}`] : []),
      ...(data.run.result?.artifact ? [data.run.result.artifact.content, `Artifact SHA-256: ${data.run.result.artifact.sha256}`] : []));
    else lines.push(`Capability ${data.capability.id}: ${data.status}; lifecycle revision ${data.capability.lifecycleRevision}`);
  }
  else if (command === "knowledge" && operation === "health") lines.push(`${data.status}; ${data.sourceCount} sources, ${data.documentCount} documents; ${data.mode}`);
  else if (operation === "sources") lines.push(...data.sources.map((row: any) => `${row.sourceId}: ${row.documentCount} documents (${row.title ?? row.sourceId})`), `Showing ${data.sources.length} of ${data.total} sources.`);
  else if (command === "knowledge" && operation === "load") lines.push(`Source ${data.sourceId}: loaded ${data.loadedCount} documents; current total ${data.documentCount}.`);
  else if (operation === "retrieve") lines.push(...data.chunks.map((chunk: any, index: number) => `${index + 1}. ${chunk.document.sourceId}/${chunk.document.documentId}\n${chunk.snippet ?? chunk.text}`));
  else if (command === "routing") lines.push(operation === "modes" ? `Provider modes: ${data.modes.join(", ")}; route modes: ${data.routeModes.join(", ")}`
    : `${data.answerPath}; ${data.modelTier}; ${data.providerRecommendation ?? "no provider"}\n${data.routingReason ?? ""}`);
  else if (operation === "status") lines.push(`Forge is ${data.enabled ? "enabled" : "disabled"}.`);
  else if (operation === "runs") lines.push(...data.runs.map((run: any) => `${run.runId}: ${run.status} — ${run.goalPreview ?? ""}`));
  else if (operation === "polish") lines.push(data.result?.code ?? "", `Quality score: ${data.result?.finalScore ?? "unknown"}; target met: ${data.result?.converged === true}.`);
  else if (operation === "quality") lines.push(`Quality: ${data.evaluation.passed ? "passed" : "failed"}; score ${data.evaluation.score}.`);
  else if (operation === "orchestrate") lines.push(data.outcome === "approval_required" ? `Approval required: ${data.approvalId}` : `Run ${data.runId}: ${data.result?.status ?? "unknown"}`);
  else if (operation === "memory") lines.push(`Memory entry: ${data.id ?? "unavailable"}`);
  else if (operation === "recall") lines.push(`Session memory matches: ${data.working.entries.length}; semantic matches: ${data.semantic.length}`,
    ...data.working.entries.map((entry: any) => entry.content));
  else lines.push(JSON.stringify(data, null, 2));
  lines.push(result.nextAction);
  return lines.join("\n") + "\n";
}
