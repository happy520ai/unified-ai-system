import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { classifyImmuneRisk } from "./immuneRiskClassifier.js";

export type RuntimeProfileId = "risk-classification-v1" | "context-jsonl-v1" | "evidence-summary-v1";
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type ProfileArguments = Record<string, Json>;
export type ProfileParameters = { additionalRiskKeywords?: Record<string, string[]> };
export type RuntimeArtifact = { mediaType: "application/json" | "application/x-ndjson"; content: string; sha256: string; bytes: number };
const PROFILES: readonly RuntimeProfileId[] = ["risk-classification-v1", "context-jsonl-v1", "evidence-summary-v1"];
const RISK_SIGNALS = ["provider_call", "secret_read", "deploy_release", "chat_mutation", "execute_mutation", "codex_config", "recursive_spawn", "self_approval"];
const MAX_BYTES = 64 * 1024;

export function digest(value: string): string { return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`; }

/** Finite code-owned adapters accept data, never code, modules, or paths. */
export function describeRuntimeProfiles() {
  return PROFILES.map(id => ({ id, implementationHash: runtimeProfileHash(id),
    operation: id === "risk-classification-v1" ? "Classify text using the published deterministic risk rules"
      : id === "context-jsonl-v1" ? "Encode named context facts with exact JSONL recovery"
        : "Summarize supplied evidence while preserving every attempt and first failure",
    providerCalls: false, filesystemAccess: false, networkAccess: false, generatedCodeExecution: false }));
}

export function runtimeProfileHash(profileId: RuntimeProfileId): string {
  if (!PROFILES.includes(profileId)) throw profileError("PROFILE_UNSUPPORTED");
  // Fixed package source only. This includes rule data as well as all execution
  // and verification code, and is independent of the test transpiler in use.
  return digest([profileId, ...["sandboxRuntimeProfiles.ts", "sandboxRuntime.ts", "sandboxRuntimeWorker.ts", "sandboxAutoRuntimeExecutor.js", "immuneRiskClassifier.js", "naturalLanguageNeurogenesisCompiler.js", "capabilityNeuronManifest.js"]
    .map(name => readFileSync(new URL(name, import.meta.url), "utf8"))].join("\n"));
}

export function normalizeProfileArguments(profileId: RuntimeProfileId, value: unknown): ProfileArguments {
  const input = record(value);
  if (profileId === "risk-classification-v1") {
    exact(input, ["text"], ["expectedSignals"]);
    const result: ProfileArguments = { text: text(input.text, 16_384) };
    if (input.expectedSignals !== undefined) {
      if (!Array.isArray(input.expectedSignals) || input.expectedSignals.length > 8
        || new Set(input.expectedSignals).size !== input.expectedSignals.length
        || input.expectedSignals.some(item => typeof item !== "string" || !RISK_SIGNALS.includes(item))) throw profileError("ARGUMENTS_INVALID");
      result.expectedSignals = [...input.expectedSignals].sort() as string[];
    }
    return result;
  }
  if (profileId === "context-jsonl-v1") {
    exact(input, ["facts"]);
    if (!Array.isArray(input.facts) || input.facts.length < 1 || input.facts.length > 128) throw profileError("ARGUMENTS_INVALID");
    const keys = new Set<string>();
    const facts = input.facts.map(value => {
      const fact = record(value); exact(fact, ["key", "value"], ["reference"]);
      const key = text(fact.key, 128);
      if (keys.has(key)) throw profileError("ARGUMENTS_INVALID"); keys.add(key);
      return { key, value: jsonScalar(fact.value), ...(fact.reference !== undefined ? { reference: text(fact.reference, 1024) } : {}) };
    });
    const result = { facts };
    if (Buffer.byteLength(JSON.stringify(result), "utf8") > MAX_BYTES) throw profileError("INPUT_TOO_LARGE");
    return result;
  }
  if (profileId === "evidence-summary-v1") {
    exact(input, ["records"]);
    if (!Array.isArray(input.records) || input.records.length < 1 || input.records.length > 128) throw profileError("ARGUMENTS_INVALID");
    const keys = new Set<string>();
    const records = input.records.map(value => {
      const entry = record(value); exact(entry, ["id", "attempt", "status", "evidenceSha256"]);
      const id = text(entry.id, 128), attempt = entry.attempt;
      if (!Number.isSafeInteger(attempt) || (attempt as number) < 1 || (attempt as number) > 1000
        || !["passed", "failed", "unknown", "skipped"].includes(entry.status as string)
        || typeof entry.evidenceSha256 !== "string" || !/^sha256:[a-f0-9]{64}$/.test(entry.evidenceSha256)) throw profileError("ARGUMENTS_INVALID");
      const key = JSON.stringify([id, attempt]); if (keys.has(key)) throw profileError("ARGUMENTS_INVALID"); keys.add(key);
      return { id, attempt: attempt as number, status: entry.status as string, evidenceSha256: entry.evidenceSha256 };
    }).sort((a, b) => a.id.localeCompare(b.id, "en") || a.attempt - b.attempt);
    return { records };
  }
  throw profileError("PROFILE_UNSUPPORTED");
}

export function normalizeProfileParameters(profileId: RuntimeProfileId, value: unknown = {}): ProfileParameters {
  const parameters = record(value);
  exact(parameters, [], profileId === "risk-classification-v1" ? ["additionalRiskKeywords"] : []);
  if (parameters.additionalRiskKeywords === undefined) return {};
  const source = record(parameters.additionalRiskKeywords), mapping: Record<string, string[]> = {};
  if (Object.keys(source).some(signal => !RISK_SIGNALS.includes(signal))) throw profileError("PARAMETERS_INVALID");
  for (const signal of RISK_SIGNALS) if (source[signal] !== undefined) {
    const keywords = source[signal];
    if (!Array.isArray(keywords) || !keywords.length || keywords.length > 8) throw profileError("PARAMETERS_INVALID");
    mapping[signal] = [...new Set(keywords.map(keyword => text(keyword, 256).toLowerCase()))].sort();
  }
  return Object.keys(mapping).length ? { additionalRiskKeywords: mapping } : {};
}

export function executeProfile(profileId: RuntimeProfileId, args: ProfileArguments, parameters: ProfileParameters = {}): RuntimeArtifact {
  let value: unknown;
  if (profileId === "context-jsonl-v1") {
    const content = (args.facts as Json[]).map(fact => JSON.stringify(fact)).join("\n");
    return { mediaType: "application/x-ndjson", content, sha256: digest(content), bytes: Buffer.byteLength(content, "utf8") };
  }
  if (profileId === "risk-classification-v1") {
    const result = classifyImmuneRisk(args.text as string);
    const signals = new Set<string>(result.riskSignals);
    for (const [signal, keywords] of Object.entries(parameters.additionalRiskKeywords ?? {})) {
      if (keywords.some(keyword => (args.text as string).toLowerCase().includes(keyword))) signals.add(signal);
    }
    value = { classifierVersion: result.classifierVersion, sourceHash: digest(args.text as string),
      decision: signals.size ? "approval_required" : "dry_run_allowed", riskTier: signals.size ? "high" : "low", signals: [...signals].sort() };
  } else value = summarizeEvidence(args.records as Array<Record<string, Json>>);
  const content = JSON.stringify(value);
  return { mediaType: "application/json", content, sha256: digest(content), bytes: Buffer.byteLength(content, "utf8") };
}

function summarizeEvidence(records: Array<Record<string, Json>>) {
  const ids = [...new Set(records.map(item => item.id as string))];
  return { sourceHash: digest(JSON.stringify(records)), attempts: records,
    results: ids.map(id => {
      const attempts = records.filter(item => item.id === id);
      return { id, currentStatus: attempts[attempts.length - 1].status,
        firstFailureAttempt: attempts.find(item => item.status === "failed")?.attempt ?? null, attempts: attempts.length };
    }) };
}

/** Independently parse produced bytes and check recovery/invariants. A worker's
 * success flag or counters are never evidence. Risk semantics use expected
 * signals when supplied; the underlying classifier is a heuristic. */
export function verifyProfileArtifact(profileId: RuntimeProfileId, args: ProfileArguments, value: unknown): RuntimeArtifact {
  const artifact = record(value); exact(artifact, ["mediaType", "content", "sha256", "bytes"]);
  if (typeof artifact.content !== "string" || !artifact.content || Buffer.byteLength(artifact.content, "utf8") > MAX_BYTES
    || artifact.sha256 !== digest(artifact.content) || artifact.bytes !== Buffer.byteLength(artifact.content, "utf8")) throw profileError("VERIFICATION_FAILED");
  if (profileId === "context-jsonl-v1") {
    if (artifact.mediaType !== "application/x-ndjson") throw profileError("VERIFICATION_FAILED");
    const decoded = artifact.content.split("\n").map(line => JSON.parse(line));
    const recovered = normalizeProfileArguments(profileId, { facts: decoded });
    if (JSON.stringify(recovered.facts) !== JSON.stringify(args.facts)) throw profileError("FACT_RECOVERY_FAILED");
  } else {
    if (artifact.mediaType !== "application/json") throw profileError("VERIFICATION_FAILED");
    const result = record(JSON.parse(artifact.content));
    if (profileId === "risk-classification-v1") {
      exact(result, ["classifierVersion", "sourceHash", "decision", "riskTier", "signals"]);
      if (result.classifierVersion !== "phase651-666-immune-risk-v1" || result.sourceHash !== digest(args.text as string)
        || !Array.isArray(result.signals) || new Set(result.signals).size !== result.signals.length
        || result.signals.some(signal => !RISK_SIGNALS.includes(signal as string))
        || result.decision !== (result.signals.length ? "approval_required" : "dry_run_allowed")
        || result.riskTier !== (result.signals.length ? "high" : "low")
        || (args.expectedSignals !== undefined && JSON.stringify([...result.signals].sort()) !== JSON.stringify(args.expectedSignals))) throw profileError("VERIFICATION_FAILED");
    } else {
      exact(result, ["sourceHash", "attempts", "results"]);
      if (result.sourceHash !== digest(JSON.stringify(args.records)) || JSON.stringify(result.attempts) !== JSON.stringify(args.records)
        || !Array.isArray(result.results)) throw profileError("VERIFICATION_FAILED");
      const attempts = args.records as Array<Record<string, Json>>, ids = new Set(attempts.map(item => item.id));
      if (result.results.length !== ids.size) throw profileError("VERIFICATION_FAILED");
      for (const item of result.results) {
        const summary = record(item); exact(summary, ["id", "currentStatus", "firstFailureAttempt", "attempts"]);
        if (!ids.delete(summary.id as string)) throw profileError("VERIFICATION_FAILED");
        const rows = attempts.filter(row => row.id === summary.id);
        const latest = rows.reduce((a, b) => (a.attempt as number) > (b.attempt as number) ? a : b);
        const failures = rows.filter(row => row.status === "failed").map(row => row.attempt as number);
        if (summary.currentStatus !== latest.status || summary.attempts !== rows.length
          || summary.firstFailureAttempt !== (failures.length ? Math.min(...failures) : null)) throw profileError("VERIFICATION_FAILED");
      }
    }
  }
  return Object.freeze({ ...artifact }) as RuntimeArtifact;
}

export function profileError(suffix: string): Error & { code: string } {
  return Object.assign(new Error(`Taiji capability ${suffix.toLowerCase().replaceAll("_", " ")}.`), { code: `TAIJI_${suffix}` });
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    || Object.values(Object.getOwnPropertyDescriptors(value)).some(item => !("value" in item))) throw profileError("ARGUMENTS_INVALID");
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, required: string[], optional: string[] = []): void {
  if (required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) throw profileError("ARGUMENTS_INVALID");
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || Buffer.byteLength(value, "utf8") > max
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) throw profileError("ARGUMENTS_INVALID");
  return value;
}
function jsonScalar(value: unknown): null | string | number | boolean {
  if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return value;
  if (typeof value === "string" && Buffer.byteLength(value, "utf8") <= 4096 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) return value;
  throw profileError("ARGUMENTS_INVALID");
}
