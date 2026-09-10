import { createHash } from "node:crypto";
import { stableStringify } from "@unified-ai-system/policy-engine";
import type { WorkforceWorkflowHandoffReview } from "@unified-ai-system/shared-contracts";
import { createLogRedactor } from "./logRedactor.js";

const SELECTOR_KEYS = ["roleId", "query", "sourceIds", "topK"];
const REVIEW_KEYS = ["version", "kind", "roleId", "goal", "query", "topK", "sourceIds", "outputRootHash", "reviewHash"];
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const redactor = createLogRedactor() as { redactString(value: string): string };
type Selector = { roleId: string; query?: string; sourceIds: readonly string[]; topK: number };

/** Reads only the bounded request selector; runtime identities and targets are server-owned. */
export function readWorkforceWorkflowHandoffSelector(input: unknown): Selector | undefined {
  try {
    const source = plainRecord(input);
    if (!Object.hasOwn(source, "workflowHandoff")) return undefined;
    const property = dataProperty(source, "workflowHandoff");
    const selector = record(property, SELECTOR_KEYS, ["roleId"]);
    return Object.freeze({ roleId: identifier(selector.roleId),
      ...(Object.hasOwn(selector, "query") ? { query: safeText(selector.query, 1_000) } : {}),
      sourceIds: Object.freeze(Object.hasOwn(selector, "sourceIds") ? sourceIds(selector.sourceIds) : []),
      topK: Object.hasOwn(selector, "topK") ? topK(selector.topK) : 3 });
  } catch { throw invalid(); }
}

/** Pure review construction: no workflow, filesystem, policy or Provider operation. */
export function createWorkforceWorkflowHandoffReview(input: {
  input?: object; plan: Record<string, unknown>; outputRootHash: string;
}): WorkforceWorkflowHandoffReview | undefined {
  try {
    const selector = readWorkforceWorkflowHandoffSelector(input.input ?? {});
    if (!selector) return undefined;
    const plan = plainRecord(input.plan);
    const roles = ownArray(dataProperty(plan, "selectedRoles"), 32);
    const tasks = ownArray(dataProperty(plan, "taskBreakdown"), 128);
    if (!roles.includes(selector.roleId)
      || !tasks.some(task => dataProperty(plainRecord(task), "roleId") === selector.roleId)) throw invalid();
    const goal = safeText(dataProperty(plan, "goal"), 1_000);
    return freezeReview({ version: 1, kind: "local-knowledge-report", roleId: selector.roleId, goal,
      query: selector.query ?? goal, topK: selector.topK, sourceIds: selector.sourceIds,
      outputRootHash: outputRootHash(input.outputRootHash) });
  } catch { throw invalid(); }
}

/** Reconstruct every reviewed field and its digest; a hash-only lookalike is never trusted. */
export function readWorkforceWorkflowHandoffReview(value: unknown): WorkforceWorkflowHandoffReview {
  try {
    const source = record(value, REVIEW_KEYS, REVIEW_KEYS);
    if (source.version !== 1 || source.kind !== "local-knowledge-report") throw invalid();
    const review = freezeReview({ version: 1, kind: "local-knowledge-report", roleId: identifier(source.roleId),
      goal: safeText(source.goal, 1_000), query: safeText(source.query, 1_000), topK: topK(source.topK),
      sourceIds: Object.freeze(sourceIds(source.sourceIds)), outputRootHash: outputRootHash(source.outputRootHash) });
    if (source.reviewHash !== review.reviewHash || stableStringify(source) !== stableStringify(review)) throw invalid();
    return review;
  } catch { throw invalid(); }
}

function freezeReview(review: Omit<WorkforceWorkflowHandoffReview, "reviewHash">): WorkforceWorkflowHandoffReview {
  return Object.freeze({ ...review, reviewHash: `sha256:${createHash("sha256").update(stableStringify(review), "utf8").digest("hex")}` });
}
function plainRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).some(key => typeof key !== "string" || FORBIDDEN_KEYS.has(key))) throw invalid();
  return value as Record<string, unknown>;
}
function dataProperty(value: Record<string, unknown>, key: string): unknown {
  const property = Object.getOwnPropertyDescriptor(value, key);
  if (!property || !("value" in property) || !property.enumerable) throw invalid();
  return property.value;
}
function record(value: unknown, allowed: readonly string[], required: readonly string[]): Record<string, unknown> {
  const source = plainRecord(value);
  const keys = Object.keys(source);
  if (Reflect.ownKeys(source).length !== keys.length || keys.some(key => !allowed.includes(key))
    || required.some(key => !Object.hasOwn(source, key))) throw invalid();
  return Object.fromEntries(keys.map(key => [key, dataProperty(source, key)]));
}
function ownArray(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum
    || Reflect.ownKeys(value).length !== value.length + 1) throw invalid();
  return Array.from({ length: value.length }, (_, index) => dataProperty(value as unknown as Record<string, unknown>, String(index)));
}
function sourceIds(value: unknown): string[] {
  // Match localWorkflowService for valid entries: trim, preserve order and duplicates.
  return ownArray(value, 32).map(item => safeText(item, 256));
}
function safeText(value: unknown, maximum: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum
    || /[\u0000-\u001f\u007f]/u.test(value) || redactor.redactString(value) !== value) throw invalid();
  return value.trim();
}
function identifier(value: unknown): string {
  const text = safeText(value, 128);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(text)) throw invalid();
  return text;
}
function outputRootHash(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) throw invalid();
  return value;
}
function topK(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) throw invalid();
  return value;
}
function invalid() {
  return Object.assign(new Error("Workforce workflow handoff must contain a complete, safe local report review."), {
    code: "WORKFORCE_WORKFLOW_HANDOFF_INVALID", statusCode: 400, category: "validation", retryable: false,
  });
}
