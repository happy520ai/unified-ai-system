import { createScanner, parseTree, ScanError, SyntaxKind } from "jsonc-parser";
import type { Node as JsonNode, ParseError } from "jsonc-parser";
import type { WorkforceCodeDeliveryProfile } from "@unified-ai-system/shared-contracts";
import { containsSensitivePublicationText } from "../security/secretSafety.js";
import { freezeWorkforceCodeDeliveryProfile } from "../workforce/workforceCodeDeliveryProfile.ts";
import { externalRunnerHash as hash } from "../workforce/workforceExternalRunnerProfile.ts";
import { nodeTestMinimumOutputBytes } from "../workforce/workforceNodeTestVerification.ts";

export type GovernedAgentTaskVerificationResult = Readonly<{
  version: 1; adapter: "node-test"; minimumPassed: number;
  requiredChecks: readonly Readonly<{ file: string; name: string }>[];
}>;
export type GovernedAgentTaskProfileInput = Readonly<{
  version: 1; mode: "governed-agent-long-task"; profileId: string; projectId: string; baselineRevision: string;
  model: Readonly<{ providerId: string; modelId: string; maxInputTokens: number; maxOutputTokens: number }>;
  limits: Readonly<{ maxPlanSteps: number; maxIterations: number; maxModelCalls: number; maxTotalTokens: number;
    maxRepairAttempts: number; chunkTimeoutMs: number; maxInputBytes: number }>;
  verificationResult: GovernedAgentTaskVerificationResult;
  artifact: Readonly<Pick<WorkforceCodeDeliveryProfile, "readPaths" | "writePaths" | "verification" | "artifactLimits">>;
}>;
export type GovernedAgentTaskProfile = GovernedAgentTaskProfileInput & Readonly<{ profileHash: string }>;
export type GovernedAgentTaskReviewInput = Readonly<{ profile: GovernedAgentTaskProfile; configuredRepositoryHash: string;
  goal: string; prompt: string; sourceFilesHash: string }>;
export type GovernedAgentTaskReview = GovernedAgentTaskReviewInput & Readonly<{ version: 1; reviewHash: string }>;
export type GovernedAgentTaskPlanStep = Readonly<{ id: string; kind: "inspect" | "implement" | "verify"; title: string; paths: readonly string[] }>;
export type GovernedAgentTaskPlan = Readonly<{ version: 1; reviewHash: string; steps: readonly GovernedAgentTaskPlanStep[]; planHash: string }>;

const PROFILE_KEYS = ["version", "mode", "profileId", "projectId", "baselineRevision", "model", "limits", "verificationResult", "artifact"];
const REVIEW_KEYS = ["profile", "configuredRepositoryHash", "goal", "prompt", "sourceFilesHash"];
const HEX = /^[a-f0-9]{64}$/u, HASH = /^sha256:[a-f0-9]{64}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u, MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u;
const STEP_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
type InvalidKind = "PROFILE" | "REVIEW" | "PLAN" | "SELECTOR";
function invalid(kind: InvalidKind = "PROFILE"): never {
  throw Object.assign(new Error("The governed Agent task data is malformed, unsafe or inconsistent."), {
    code: `AGENT_LONG_TASK_${kind}_INVALID`, statusCode: kind === "PROFILE" ? 503 : 400,
    category: kind === "PROFILE" ? "configuration" : "validation", retryable: false as const,
  });
}
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).length !== keys.length) invalid();
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const property = Object.getOwnPropertyDescriptor(value, key);
    if (!property?.enumerable || !("value" in property)) invalid();
    result[key] = property.value;
  }
  return result;
}
function array(value: unknown, minimum: number, maximum: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length < minimum || value.length > maximum
    || Reflect.ownKeys(value).length !== value.length + 1) invalid();
  return Array.from({ length: value.length }, (_, index) => {
    const property = Object.getOwnPropertyDescriptor(value, String(index));
    if (!property?.enumerable || !("value" in property)) invalid();
    return property.value;
  });
}
function text(value: unknown, maximum: number, multiline = false): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum || containsSensitivePublicationText(value)
    || /\bBearer\s+[A-Za-z0-9._~+/-]{8,}/iu.test(value)
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(value)
    || (multiline ? /\r(?!\n)/u : /[\t\r\n]/u).test(value) || Buffer.from(value, "utf8").toString("utf8") !== value) invalid();
  return value;
}
function identifier(value: unknown, model = false): string {
  const result = text(value, model ? 256 : 128); if (!(model ? MODEL_ID : ID).test(result)) invalid(); return result;
}
function integer(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) invalid(); return Number(value);
}
function artifactPolicy(source: Record<string, unknown>): WorkforceCodeDeliveryProfile {
  const artifact = record(source.artifact, ["readPaths", "writePaths", "verification", "artifactLimits"]);
  return freezeWorkforceCodeDeliveryProfile({ version: 1, mode: "forge-owned-worktree-artifact", roleId: "backend-engineer",
    profileId: source.profileId, projectId: source.projectId, baselineRevision: source.baselineRevision, ...artifact });
}

/** Reviewed display of the fixed Node adapter invocation; never executed as arbitrary shell input. */
export function renderGovernedAgentTaskNodeTestCommand(immutablePaths: readonly string[]): string {
  const paths = array(immutablePaths, 1, 8).map(path => text(path, 256)).sort();
  if (new Set(paths).size !== paths.length) invalid();
  return text("node --test " + paths.map(path => "'" + path.replaceAll("'", "'\\''") + "'").join(" "), 512);
}

/** Pure intent validation. The declared checks grant no result or execution authority. */
export function freezeGovernedAgentTaskVerificationResult(value: unknown, immutablePaths: readonly string[]): GovernedAgentTaskVerificationResult {
  try {
    const source = record(value, ["version", "adapter", "minimumPassed", "requiredChecks"]);
    const paths = array(immutablePaths, 1, 8).map(path => text(path, 256)), allowed = new Set(paths);
    if (source.version !== 1 || source.adapter !== "node-test" || allowed.size !== paths.length) invalid();
    const unique = new Set<string>(), covered = new Set<string>();
    const requiredChecks = array(source.requiredChecks, 1, 64).map(value => {
      const check = record(value, ["file", "name"]), file = text(check.file, 256), name = text(check.name, 256);
      const key = JSON.stringify([file, name]);
      if (!allowed.has(file) || unique.has(key)) invalid();
      unique.add(key); covered.add(file); return Object.freeze({ file, name });
    }).sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    if (paths.some(path => !covered.has(path))) invalid();
    return Object.freeze({ version: 1, adapter: "node-test", minimumPassed: integer(source.minimumPassed, 1, 10000),
      requiredChecks: Object.freeze(requiredChecks) });
  } catch { return invalid(); }
}

/** Pure server-profile validation. It reads no files, environment, credentials or runtime state. */
export function freezeGovernedAgentTaskProfile(value: unknown): GovernedAgentTaskProfile {
  try {
    const source = record(value, PROFILE_KEYS), model = record(source.model, ["providerId", "modelId", "maxInputTokens", "maxOutputTokens"]);
    const limits = record(source.limits, ["maxPlanSteps", "maxIterations", "maxModelCalls", "maxTotalTokens", "maxRepairAttempts", "chunkTimeoutMs", "maxInputBytes"]);
    if (source.version !== 1 || source.mode !== "governed-agent-long-task" || typeof source.baselineRevision !== "string" || !/^[a-f0-9]{40}$/u.test(source.baselineRevision)) invalid();
    const artifact = artifactPolicy(source), maxInputTokens = integer(model.maxInputTokens, 1), maxOutputTokens = integer(model.maxOutputTokens, 1);
    const immutablePaths = artifact.verification.immutableTests.map(test => test.path);
    const verificationResult = freezeGovernedAgentTaskVerificationResult(source.verificationResult, immutablePaths);
    if (nodeTestMinimumOutputBytes(verificationResult) > artifact.verification.maxOutputBytes) invalid();
    if (artifact.verification.command !== renderGovernedAgentTaskNodeTestCommand(immutablePaths)) invalid();
    const maxIterations = integer(limits.maxIterations, 1, 100), maxModelCalls = integer(limits.maxModelCalls, 1, 100), maxTotalTokens = integer(limits.maxTotalTokens, 1);
    if (maxModelCalls < maxIterations + 1 || !Number.isSafeInteger(maxInputTokens + maxOutputTokens) || maxTotalTokens < maxInputTokens + maxOutputTokens) invalid();
    const profile: GovernedAgentTaskProfileInput = {
      version: 1, mode: "governed-agent-long-task", profileId: identifier(source.profileId), projectId: identifier(source.projectId), baselineRevision: source.baselineRevision,
      model: Object.freeze({ providerId: identifier(model.providerId, true), modelId: identifier(model.modelId, true), maxInputTokens, maxOutputTokens }),
      limits: Object.freeze({ maxPlanSteps: integer(limits.maxPlanSteps, 3, 16), maxIterations, maxModelCalls, maxTotalTokens,
        maxRepairAttempts: integer(limits.maxRepairAttempts, 0, 3), chunkTimeoutMs: integer(limits.chunkTimeoutMs, 1000, 120000), maxInputBytes: integer(limits.maxInputBytes, 1024, 524288) }),
      verificationResult,
      artifact: Object.freeze({ readPaths: artifact.readPaths, writePaths: artifact.writePaths, verification: artifact.verification, artifactLimits: artifact.artifactLimits }),
    };
    return Object.freeze({ ...profile, profileHash: hash(profile) });
  } catch { return invalid(); }
}
export function readGovernedAgentTaskProfile(value: unknown): GovernedAgentTaskProfile {
  try {
    const { profileHash, ...source } = record(value, [...PROFILE_KEYS, "profileHash"]), profile = freezeGovernedAgentTaskProfile(source);
    if (profileHash !== profile.profileHash) invalid(); return profile;
  } catch { return invalid(); }
}
/** Reuses the existing exact-file verification policy only; it is not evidence that Forge executed this task. */
export function governedAgentTaskArtifactPolicy(value: GovernedAgentTaskProfile): WorkforceCodeDeliveryProfile {
  try { return artifactPolicy(readGovernedAgentTaskProfile(value) as unknown as Record<string, unknown>); } catch { return invalid(); }
}
/** Accepts the raw request selector; the HTTP owner chooses its outer field name. */
export function readGovernedAgentTaskSelector(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  try { return identifier(record(value, ["profileId"]).profileId); } catch { return invalid("SELECTOR"); }
}
export function createGovernedAgentTaskReview(input: GovernedAgentTaskReviewInput): GovernedAgentTaskReview {
  try {
    const source = record(input, REVIEW_KEYS), profile = readGovernedAgentTaskProfile(source.profile);
    if (typeof source.configuredRepositoryHash !== "string" || !HASH.test(source.configuredRepositoryHash)
      || typeof source.sourceFilesHash !== "string" || !HEX.test(source.sourceFilesHash)) invalid("REVIEW");
    const goal = text(source.goal, 4000, true), prompt = text(source.prompt, profile.limits.maxInputBytes, true);
    if (Buffer.byteLength(prompt, "utf8") > profile.limits.maxInputBytes) invalid("REVIEW");
    const review = { version: 1 as const, profile, configuredRepositoryHash: source.configuredRepositoryHash, goal, prompt, sourceFilesHash: source.sourceFilesHash };
    return Object.freeze({ ...review, reviewHash: hash(review) });
  } catch { return invalid("REVIEW"); }
}
export function readGovernedAgentTaskReview(value: unknown): GovernedAgentTaskReview {
  try {
    const { version, reviewHash, ...source } = record(value, ["version", ...REVIEW_KEYS, "reviewHash"]);
    if (version !== 1) invalid("REVIEW");
    const review = createGovernedAgentTaskReview(source as GovernedAgentTaskReviewInput);
    if (reviewHash !== review.reviewHash) invalid("REVIEW"); return review;
  } catch { return invalid("REVIEW"); }
}
function planFromData(value: unknown, review: GovernedAgentTaskReview): GovernedAgentTaskPlan {
  const source = record(value, ["version", "reviewHash", "steps"]);
  if (source.version !== 1 || source.reviewHash !== review.reviewHash) invalid("PLAN");
  const ranks = { inspect: 0, implement: 1, verify: 2 }, ids = new Set<string>(), kinds = new Set<string>(), writes = new Set<string>(), tests = new Set<string>();
  const testPaths = review.profile.artifact.verification.immutableTests.map(test => test.path); let rank = 0;
  const steps = array(source.steps, 3, review.profile.limits.maxPlanSteps).map(value => {
    const step = record(value, ["id", "kind", "title", "paths"]), id = text(step.id, 64), title = text(step.title, 256);
    if (!STEP_ID.test(id) || ids.has(id) || typeof step.kind !== "string" || !Object.hasOwn(ranks, step.kind)) invalid("PLAN");
    const kind = step.kind as GovernedAgentTaskPlanStep["kind"];
    if (ranks[kind] < rank) invalid("PLAN"); rank = ranks[kind]; ids.add(id); kinds.add(kind);
    const allowed = kind === "inspect" ? review.profile.artifact.readPaths : kind === "implement" ? review.profile.artifact.writePaths : testPaths;
    const paths = array(step.paths, 1, allowed.length).map(path => {
      if (typeof path !== "string" || !allowed.includes(path)) invalid("PLAN"); return path;
    });
    if (new Set(paths).size !== paths.length) invalid("PLAN");
    if (kind === "implement") paths.forEach(path => writes.add(path));
    if (kind === "verify") paths.forEach(path => tests.add(path));
    return Object.freeze({ id, kind, title, paths: Object.freeze(paths) });
  });
  if (kinds.size !== 3 || review.profile.artifact.writePaths.some(path => !writes.has(path)) || testPaths.some(path => !tests.has(path))) invalid("PLAN");
  const plan = { version: 1 as const, reviewHash: review.reviewHash, steps: Object.freeze(steps) };
  return Object.freeze({ ...plan, planHash: hash(plan) });
}
function parseModelJson(value: unknown): unknown {
  if (typeof value !== "string" || !value.trim() || value.length > 1048576 || Buffer.byteLength(value, "utf8") > 1048576
    || Buffer.from(value, "utf8").toString("utf8") !== value) invalid("PLAN");
  const scanner = createScanner(value, false); let depth = 0;
  for (;;) {
    const token = scanner.scan();
    if (scanner.getTokenError() !== ScanError.None || [SyntaxKind.Unknown, SyntaxKind.LineCommentTrivia, SyntaxKind.BlockCommentTrivia].includes(token)) invalid("PLAN");
    if (token === SyntaxKind.EOF) break;
    if (token === SyntaxKind.OpenBraceToken || token === SyntaxKind.OpenBracketToken) depth++;
    if (token === SyntaxKind.CloseBraceToken || token === SyntaxKind.CloseBracketToken) depth--;
    if (depth < 0 || depth > 16) invalid("PLAN");
  }
  const errors: ParseError[] = [], tree = parseTree(value, errors, { disallowComments: true, allowTrailingComma: false });
  if (!tree || errors.length) invalid("PLAN");
  const pending: JsonNode[] = [tree]; let nodes = 0;
  while (pending.length) {
    const node = pending.pop()!; if (++nodes > 50000) invalid("PLAN");
    if (node.type === "object") {
      const keys = new Set<string>();
      for (const field of node.children ?? []) {
        const key: unknown = field.children?.[0]?.value;
        if (typeof key !== "string" || keys.has(key)) invalid("PLAN"); keys.add(key);
      }
    }
    pending.push(...(node.children ?? []));
  }
  return JSON.parse(value);
}
/** A model plan is a bounded proposal; parsing grants neither execution authority nor a verified outcome. */
export function parseGovernedAgentTaskPlan(modelJson: string, reviewInput: GovernedAgentTaskReview): GovernedAgentTaskPlan {
  try { return planFromData(parseModelJson(modelJson), readGovernedAgentTaskReview(reviewInput)); } catch { return invalid("PLAN"); }
}
/** Revalidates all steps and rehashes durable data against the complete originally reviewed task. */
export function readGovernedAgentTaskPlan(value: unknown, reviewInput: GovernedAgentTaskReview): GovernedAgentTaskPlan {
  try {
    const { planHash, ...source } = record(value, ["version", "reviewHash", "steps", "planHash"]);
    const plan = planFromData(source, readGovernedAgentTaskReview(reviewInput));
    if (planHash !== plan.planHash) invalid("PLAN"); return plan;
  } catch { return invalid("PLAN"); }
}
