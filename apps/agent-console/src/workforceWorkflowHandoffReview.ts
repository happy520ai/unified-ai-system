import { createHash } from "node:crypto";

const KEYS = ["version", "kind", "roleId", "goal", "query", "topK", "sourceIds", "outputRootHash", "reviewHash"];
const FORBIDDEN = new Set(["__proto__", "prototype", "constructor"]);
const SECRET = /(?:sk-|nvapi-|gh[pousr]_)[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{12,}|AKIA[A-Z0-9]{12,}|eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|(?:api[_-]?key|apikey|token|secret|password|authorization|auth)\s*[:=]\s*["']?[A-Za-z0-9_\-./+]{8,}|Bearer\s+[A-Za-z0-9_\-./+]{8,}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|\b[0-9a-f]{16,}\b|C:\\Users\\[^\\]+|\/home\/[^/]+|\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/iu;

/** Transport validation only; the server retains execution and write-approval authority. */
export function projectWorkforceWorkflowHandoffReview(value: unknown) {
  const source = record(value, KEYS);
  if (source.version !== 1 || source.kind !== "local-knowledge-report"
    || typeof source.topK !== "number" || !Number.isInteger(source.topK) || source.topK < 1 || source.topK > 5
    || typeof source.outputRootHash !== "string" || !/^[a-f0-9]{64}$/u.test(source.outputRootHash)) invalid();
  const roleId = text(source.roleId, 128);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(roleId)) invalid();
  const review = { version: 1 as const, kind: "local-knowledge-report" as const, roleId,
    goal: text(source.goal, 1000), query: text(source.query, 1000), topK: source.topK,
    sourceIds: Object.freeze(array(source.sourceIds, 32).map(value => text(value, 256))), outputRootHash: source.outputRootHash };
  const reviewHash = hash(review);
  if (source.reviewHash !== reviewHash) invalid();
  return Object.freeze({ ...review, reviewHash });
}

/** Require the complete options before and after the CLI's secret-safe projection. */
export function assertWorkforceWorkflowOptionsHash(value: unknown, expected: unknown): void {
  if (typeof expected !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(expected) || hash(value) !== expected) invalid();
}

export function formatWorkforceWorkflowHandoffReview(review: ReturnType<typeof projectWorkforceWorkflowHandoffReview>) {
  return [
    `Workflow handoff: ${review.kind}; version: ${review.version}; role: ${review.roleId}`,
    `Workflow goal: ${JSON.stringify(review.goal)}`,
    `Knowledge query: ${JSON.stringify(review.query)}; topK: ${review.topK}`,
    `Source IDs (ordered, duplicates retained): ${JSON.stringify(review.sourceIds)}`,
    `Output root configuration hash: ${review.outputRootHash}`,
    `Workflow review hash: ${review.reviewHash}`,
    "The workflow retrieves local knowledge and writes a managed report; the actual artifact has its own write-approval check.",
  ];
}

function invalid(): never { throw new Error("invalid or incomplete Workforce workflow handoff review"); }
function record(value: unknown, keys?: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
  const own = Reflect.ownKeys(value);
  if (own.length > 100 || own.some(key => typeof key !== "string" || FORBIDDEN.has(key))
    || keys && (own.length !== keys.length || keys.some(key => !Object.hasOwn(value, key)))) invalid();
  return Object.fromEntries(own.map(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) invalid();
    return [key, descriptor.value];
  }));
}
function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum
    || Reflect.ownKeys(value).length !== value.length + 1) invalid();
  return Array.from({ length: value.length }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) invalid();
    return descriptor.value;
  });
}
function text(value: unknown, maximum: number): string {
  if (typeof value !== "string" || !value || value.trim() !== value || value.length > maximum
    || /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(value) || SECRET.test(value)) invalid();
  return value;
}
function stable(value: unknown, depth = 0): string {
  if (depth > 16) invalid();
  if (value === null || typeof value === "boolean" || typeof value === "string"
    || typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${array(value, 128).map(item => stable(item, depth + 1)).join(",")}]`;
  const source = record(value);
  return `{${Object.keys(source).sort().map(key => `${JSON.stringify(key)}:${stable(source[key], depth + 1)}`).join(",")}}`;
}
function hash(value: unknown) { return `sha256:${createHash("sha256").update(stable(value), "utf8").digest("hex")}`; }
