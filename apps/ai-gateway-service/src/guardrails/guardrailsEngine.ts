// =============================================================================
// guardrailsEngine.ts — deterministic, local, zero-credential chat guardrails
//
// Portkey/Kong sell guardrails as a cloud plugin tier. This engine is the
// self-hosted answer: every rule is a local deterministic scan with an explicit
// action (off | warn | redact | block), a per-finding audit trail, and
// Prometheus metrics. Nothing leaves the process, no extra credentials, no
// third-party calls.
//
// House rules honored from the cache integration:
//  - opt-in: AI_GATEWAY_GUARDRAILS_ENABLED must be exactly "true"
//  - fail-open: any engine error must never change the chat response
// =============================================================================

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { recordGuardrailEvaluation, recordGuardrailFinding } from "../observability/aiMetrics.ts";

export const GUARDRAILS_ENABLED_ENV = "AI_GATEWAY_GUARDRAILS_ENABLED";
export const GUARDRAILS_CONFIG_ENV = "AI_GATEWAY_GUARDRAILS_CONFIG";
export const GUARDRAILS_STORAGE_DIR_ENV = "AI_GATEWAY_GUARDRAILS_STORAGE_DIR";

export type GuardrailAction = "off" | "warn" | "redact" | "block";

export type GuardrailRuleName =
  | "input.pii.email"
  | "input.pii.phone"
  | "input.secrets"
  | "input.injection"
  | "input.limits"
  | "output.pii.email"
  | "output.pii.phone"
  | "output.secrets"
  | "banned.terms";

export type GuardrailsRuleConfig = {
  [rule in GuardrailRuleName]?: GuardrailAction;
};

export interface GuardrailsConfig {
  enabled: boolean;
  rules: GuardrailsRuleConfig;
  maxInputChars: number;
  bannedTerms: string[];
}

export interface GuardrailFinding {
  rule: string;
  action: Exclude<GuardrailAction, "off">;
  count: number;
}

export interface GuardrailsInputVerdict {
  decision: "allow" | "block";
  findings: GuardrailFinding[];
  /** Mutated message contents after redaction (same indexes as request messages). */
  replacements: Array<{ index: number; content: string | unknown[] }>;
}

export interface GuardrailsOutputVerdict {
  decision: "allow" | "block";
  findings: GuardrailFinding[];
  text: string;
}

export interface GuardrailsEngine {
  readConfig(): GuardrailsConfig;
  describeConfig(): GuardrailsConfig;
  applyOverrides(partial: {
    enabled?: boolean;
    rules?: GuardrailsRuleConfig;
    maxInputChars?: number;
    bannedTerms?: string[];
  }): GuardrailsConfig;
  persistOverridesPath(): string | null;
  inspectInput(requestBody: { messages?: unknown[] }): GuardrailsInputVerdict;
  inspectOutputText(text: string): GuardrailsOutputVerdict;
  inspectSseDelta(textDelta: string): string;
}

export const GUARDED_STREAM_LIMITS = Object.freeze({ chars: 200_000, bytes: 1_048_576, events: 4_096 });

export interface GuardrailsOutputPolicy {
  fingerprint: string;
  enabled: boolean;
  inspectOutputText(text: string): GuardrailsOutputVerdict;
}

/** Server-captured policy: the cache key and output inspection must use one snapshot. */
export function captureGuardrailsOutputPolicy(engine: GuardrailsEngine): GuardrailsOutputPolicy {
  const config = engine.readConfig();
  const rules = Object.fromEntries(["output.pii.email", "output.pii.phone", "output.secrets", "banned.terms"]
    .map(name => [name, config.rules[name as GuardrailRuleName] ?? "off"]));
  const snapshot = new DefaultGuardrailsEngine({ overridesPath: null, overrides: {
    ...config, rules: { ...config.rules }, bannedTerms: [...config.bannedTerms],
  } });
  return Object.freeze({
    fingerprint: createHash("sha256").update(JSON.stringify({ enabled: config.enabled, rules,
      bannedTerms: [...config.bannedTerms].sort() })).digest("hex"),
    enabled: config.enabled && Object.entries(rules).some(([name, action]) => action !== "off"
      && (name !== "banned.terms" || config.bannedTerms.length > 0)),
    inspectOutputText: (text: string) => snapshot.inspectOutputText(text),
  });
}

function guardedStreamError(code: string) {
  return { type: "error", envelope: { code, category: "governance", retryable: false,
    message: code === "guardrail_blocked" ? "Response blocked by chat guardrails."
      : "Guarded output exceeds the bounded stream inspection limit." } };
}

/** Output rules opt into bounded whole-output inspection; disabled output stays incremental. */
export async function* inspectGuardrailsOutputStream(
  source: AsyncIterable<Record<string, any>>,
  policy: GuardrailsOutputPolicy,
  shouldStop: () => boolean = () => false,
): AsyncGenerator<Record<string, any>> {
  if (!policy.enabled) {
    for await (const event of source) {
      if (shouldStop()) return;
      yield event;
    }
    return;
  }
  const events: Array<Record<string, any>> = [];
  let outputText = "";
  let bytes = 0;
  let failure: Record<string, any> | undefined;
  for await (const event of source) {
    if (shouldStop()) return;
    if (event.type === "error") { failure = event; break; }
    if (typeof event.textDelta === "string") outputText += event.textDelta;
    // Core chunks contain the complete prefix too. Do not retain that quadratic duplicate.
    // The terminal object itself must survive: billing is bound to its identity in a WeakMap.
    const retained = event.type !== "done" && typeof event.outputText === "string"
      ? { ...event, outputText: "" } : event;
    bytes += Buffer.byteLength(JSON.stringify(retained), "utf8");
    if (outputText.length > GUARDED_STREAM_LIMITS.chars
      || (typeof event.outputText === "string" && event.outputText.length > GUARDED_STREAM_LIMITS.chars)
      || bytes > GUARDED_STREAM_LIMITS.bytes || events.length >= GUARDED_STREAM_LIMITS.events) {
      failure = guardedStreamError("guardrail_output_limit");
      break;
    }
    events.push(retained);
  }
  // Breaking the source iteration first awaits its return/finally and usage settlement.
  if (shouldStop()) return;
  if (failure) { yield failure; return; }
  const verdict = policy.inspectOutputText(outputText);
  const terminalVerdicts = new Map<Record<string, any>, GuardrailsOutputVerdict>();
  for (const event of events) {
    if (event.type === "done" && typeof event.outputText === "string") {
      terminalVerdicts.set(event, event.outputText === outputText ? verdict : policy.inspectOutputText(event.outputText));
    }
  }
  const blocked = [verdict, ...terminalVerdicts.values()].find(result => result.decision === "block");
  const recorded = blocked ?? verdict;
  recordGuardrailEvaluation("output", recorded.decision);
  for (const finding of recorded.findings) recordGuardrailFinding(finding.rule, finding.action);
  if (blocked) { yield guardedStreamError("guardrail_blocked"); return; }
  let replacedText = false;
  let visiblePrefix = "";
  for (const event of events) {
    if (typeof event.textDelta === "string") {
      if (verdict.text !== outputText && event.textDelta) {
        event.textDelta = replacedText ? "" : verdict.text;
        replacedText = true;
      }
      visiblePrefix += event.textDelta;
    }
    if (typeof event.outputText === "string") {
      event.outputText = terminalVerdicts.get(event)?.text ?? visiblePrefix;
    }
  }
  for (const event of events) {
    if (shouldStop()) return;
    yield event;
  }
}

const DEFAULT_RULES: GuardrailsRuleConfig = {
  "input.pii.email": "redact",
  "input.pii.phone": "redact",
  "input.secrets": "block",
  "input.injection": "warn",
  "input.limits": "block",
  "output.pii.email": "redact",
  "output.pii.phone": "redact",
  "output.secrets": "redact",
  "banned.terms": "block",
};

const DEFAULT_MAX_INPUT_CHARS = 200_000;

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// International E.164-ish and common grouped forms. Deliberately narrow so
// version numbers and IDs are not mangled.
const PHONE_PATTERN = /(?:\+\d{1,3}[\s-]?)?(?:\(\d{2,4}\)[\s-]?)?\d{3}[\s.-]\d{3,4}[\s.-]\d{4}\b/g;

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-ant-[0-9A-Za-z_-]{8,}\b/g,
  /\bsk-proj-[0-9A-Za-z_-]{16,}\b/g,
  /\bsk-[0-9A-Za-z_-]{20,}\b/g,
  /\buai-[0-9a-f]{16,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bghp_[A-Za-z0-9]{20,}\b/g,
  /\bgho_[A-Za-z0-9]{20,}\b/g,
  /\bAIza[0-9A-Za-z_-]{10,}\b/g,
  /\bxox[bpars]-[0-9A-Za-z-]{10,}\b/g,
];

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(?:all\s+|any\s+)?(?:previous|prior|above)\s+instructions?/i,
  /disregard\s+(?:all\s+|any\s+)?(?:previous|prior|above)\s+instructions?/i,
  /(?:reveal|show|print|repeat|leak)\s+(?:your\s+|the\s+)?system\s+prompt/i,
  /repeat\s+(?:everything|all text)\s+(?:above|before)/i,
];

const EMAIL_REDACTION = "[redacted-email]";
const PHONE_REDACTION = "[redacted-phone]";
const SECRET_REDACTION = "[redacted-secret]";
const BANNED_TERM_REDACTION = "[redacted-term]";
const INJECTION_REDACTION = "[redacted-injection]";

const VALID_ACTIONS: GuardrailAction[] = ["off", "warn", "redact", "block"];

function countMatches(text: string, pattern: RegExp): number {
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

function replaceAll(text: string, pattern: RegExp, replacement: string): string {
  return text.replace(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g"), replacement);
}

function createBannedTermPattern(terms: string[]): RegExp | null {
  // Literal, case-insensitive, non-overlapping matches; longest term wins at a shared start.
  const ordered = [...new Set(terms.flatMap(term => [term, term.toLowerCase()]))]
    .sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
  return ordered.length ? new RegExp(ordered.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "giu") : null;
}

function extractMessageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((part) => part?.type === "text" || typeof part === "string")
      .map((part) => (typeof part === "string" ? part : String(part.text ?? "")))
      .join("");
  }
  return "";
}

type TextSegment = { partIndex: number; text: string };
type TextEdit = { start: number; end: number; text: string };
const generatedEmptyText = new WeakSet<object>();

/** Only a transformation-created object can authorize a consumer's empty-text adaptation. */
export function consumeGuardrailsGeneratedEmptyText(value: unknown): boolean {
  return value !== null && typeof value === "object" && generatedEmptyText.delete(value);
}

function messageTextSegments(content: unknown): TextSegment[] {
  if (typeof content === "string") return [{ partIndex: -1, text: content }];
  if (!Array.isArray(content)) return [];
  return content.flatMap((part, partIndex) => typeof part === "string"
    ? [{ partIndex, text: part }]
    : part?.type === "text" ? [{ partIndex, text: String(part.text ?? "") }] : []);
}

/** Preserve part positions: replacements start in the part containing the match start. */
function editTextSegments(segments: TextSegment[], edits: TextEdit[]): void {
  let offset = 0;
  let editIndex = 0;
  for (const segment of segments) {
    const end = offset + segment.text.length;
    let cursor = offset;
    let next = "";
    while (editIndex < edits.length && edits[editIndex].end <= offset) editIndex += 1;
    while (editIndex < edits.length && edits[editIndex].start < end) {
      const edit = edits[editIndex];
      next += segment.text.slice(cursor - offset, Math.max(cursor, edit.start) - offset);
      if (edit.start >= offset) next += edit.text;
      cursor = Math.min(end, edit.end);
      if (edit.end > end) break;
      editIndex += 1;
    }
    next += segment.text.slice(cursor - offset);
    segment.text = next;
    offset = end;
  }
}

function redactTextSegments(segments: TextSegment[], pattern: RegExp, replacement: string): void {
  const text = segments.map(segment => segment.text).join("");
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  const edits = Array.from(text.matchAll(re), match => ({ start: match.index, end: match.index + match[0].length, text: replacement }));
  editTextSegments(segments, edits);
}

function contentWithTextSegments(content: unknown, segments: TextSegment[]): string | unknown[] {
  if (typeof content === "string") return segments[0].text;
  const next = [...content as unknown[]];
  for (const segment of segments) {
    const part = next[segment.partIndex] as { type?: unknown; text?: unknown } | string;
    const replacement = typeof part === "string" ? segment.text : { ...part as object, text: segment.text };
    if (typeof replacement === "object" && typeof part !== "string" && part?.type === "text"
      && typeof part.text === "string" && part.text.trim() && !segment.text.trim()) generatedEmptyText.add(replacement);
    next[segment.partIndex] = replacement;
  }
  const original = content as Array<{ type?: unknown; text?: unknown }>;
  if (original.length && original.every(part => part?.type === "text" && typeof part.text === "string")
    && original.some(part => (part.text as string).trim())
    && next.every(part => !(part as { text: string }).text.trim())) generatedEmptyText.add(next);
  return next;
}

function limitTextSegments(segments: TextSegment[], remainingChars: number): { remainingChars: number; changed: boolean } {
  const text = segments.map(segment => segment.text).join("");
  if (text.length <= remainingChars) return { remainingChars: remainingChars - text.length, changed: false };
  let end = remainingChars;
  if (end > 0 && /[\uD800-\uDBFF]/.test(text[end - 1]) && /[\uDC00-\uDFFF]/.test(text[end])) end -= 1;
  editTextSegments(segments, [{ start: end, end: text.length, text: "" }]);
  return { remainingChars: 0, changed: true };
}

/** Limits-only check after protocol conversion; never scans/replaces PII markers again. */
export function inspectGuardrailsInputLimits(requestBody: { messages?: unknown[] }, config: GuardrailsConfig): GuardrailsInputVerdict {
  const verdict: GuardrailsInputVerdict = { decision: "allow", findings: [], replacements: [] };
  const action = config.rules["input.limits"] ?? "off";
  if (!config.enabled || action === "off") return verdict;
  const messages = Array.isArray(requestBody?.messages) ? requestBody.messages : [];
  const total = messages.reduce<number>((sum, message) => sum + extractMessageText((message as { content?: unknown })?.content).length, 0);
  if (total <= config.maxInputChars) return verdict;
  verdict.findings.push({ rule: "input.limits", action, count: 1 });
  if (action === "block") { verdict.decision = "block"; return verdict; }
  if (action !== "redact") return verdict;
  let remainingChars = config.maxInputChars;
  for (const [index, message] of messages.entries()) {
    const content = (message as { content?: unknown })?.content;
    const segments = messageTextSegments(content);
    const limited = limitTextSegments(segments, remainingChars);
    remainingChars = limited.remainingChars;
    if (limited.changed) verdict.replacements.push({ index, content: contentWithTextSegments(content, segments) });
  }
  return verdict;
}

function isValidBannedTerm(term: unknown): term is string {
  return typeof term === "string" && term.length >= 2 && term.length <= 120;
}

function normalizeConfig(raw: unknown): Partial<GuardrailsConfig> {
  if (!raw || typeof raw !== "object") return {};
  const candidate = raw as Record<string, unknown>;
  const out: Partial<GuardrailsConfig> = {};
  if (typeof candidate.enabled === "boolean") out.enabled = candidate.enabled;
  if (candidate.rules && typeof candidate.rules === "object") {
    const rules: GuardrailsRuleConfig = {};
    for (const [name, action] of Object.entries(candidate.rules as Record<string, unknown>)) {
      if (DEFAULT_RULES.hasOwnProperty(name) && VALID_ACTIONS.includes(action as GuardrailAction)) {
        rules[name as GuardrailRuleName] = action as GuardrailAction;
      }
    }
    out.rules = rules;
  }
  if (typeof candidate.maxInputChars === "number" && Number.isFinite(candidate.maxInputChars)) {
    out.maxInputChars = Math.max(1, Math.floor(candidate.maxInputChars));
  }
  if (Array.isArray(candidate.bannedTerms)) {
    out.bannedTerms = candidate.bannedTerms.filter(isValidBannedTerm).slice(0, 500);
  }
  return out;
}

class DefaultGuardrailsEngine implements GuardrailsEngine {
  private overridesPath: string | null;
  private overrides: Partial<GuardrailsConfig>;

  constructor(options: { overridesPath?: string | null; overrides?: Partial<GuardrailsConfig> } = {}) {
    this.overridesPath = options.overridesPath === undefined ? defaultOverridesPath() : options.overridesPath;
    this.overrides = options.overrides ?? this.#loadOverridesFile();
  }

  #loadOverridesFile(): Partial<GuardrailsConfig> {
    if (!this.overridesPath) return {};
    try {
      if (!existsSync(this.overridesPath)) return {};
      return normalizeConfig(JSON.parse(readFileSync(this.overridesPath, "utf8")));
    } catch {
      // Malformed overrides file: ignore it and keep env defaults (fail-open).
      return {};
    }
  }

  readConfig(): GuardrailsConfig {
    const envConfig = normalizeConfig(safeJsonEnv(GUARDRAILS_CONFIG_ENV));
    const merged: GuardrailsConfig = {
      enabled: process.env[GUARDRAILS_ENABLED_ENV] === "true",
      rules: { ...DEFAULT_RULES },
      maxInputChars: DEFAULT_MAX_INPUT_CHARS,
      bannedTerms: [],
    };
    for (const layer of [envConfig, this.overrides]) {
      if (typeof layer.enabled === "boolean") merged.enabled = layer.enabled;
      if (layer.rules) Object.assign(merged.rules, layer.rules);
      if (typeof layer.maxInputChars === "number") merged.maxInputChars = layer.maxInputChars;
      if (layer.bannedTerms) merged.bannedTerms = layer.bannedTerms;
    }
    return merged;
  }

  describeConfig(): GuardrailsConfig {
    return this.readConfig();
  }

  applyOverrides(partial: Parameters<GuardrailsEngine["applyOverrides"]>[0]): GuardrailsConfig {
    const normalized = normalizeConfig(partial);
    const next: Partial<GuardrailsConfig> = { ...this.overrides, ...normalized };
    this.overrides = next;
    if (this.overridesPath) {
      this.#persistOverridesFile(next);
    }
    return this.readConfig();
  }

  #persistOverridesFile(config: Partial<GuardrailsConfig>): void {
    try {
      mkdirSync(dirname(this.overridesPath as string), { recursive: true });
      const tmpPath = `${this.overridesPath}.${process.pid}.tmp`;
      writeFileSync(tmpPath, JSON.stringify(config, null, 2), { mode: 0o600 });
      renameSync(tmpPath, this.overridesPath as string);
    } catch {
      // Persistence failure keeps in-memory overrides active (fail-open); the
      // next process start simply falls back to env defaults.
    }
  }

  persistOverridesPath(): string | null {
    return this.overridesPath;
  }

  inspectInput(requestBody: { messages?: unknown[] }): GuardrailsInputVerdict {
    const allow: GuardrailsInputVerdict = { decision: "allow", findings: [], replacements: [] };
    try {
      const config = this.readConfig();
      if (!config.enabled) return allow;

      const messages = Array.isArray(requestBody?.messages) ? requestBody.messages : [];
      const findings: GuardrailFinding[] = [];
      const replacements: GuardrailsInputVerdict["replacements"] = [];
      const bannedPattern = createBannedTermPattern(config.bannedTerms);
      let blocked = false;

      // 长度上限按全部消息的累计字符数判定：只查末条会被"把超长内容
      // 拆进多条消息"绕过。
      const totalAllMessageChars = messages.reduce<number>(
        (sum, message) => sum + extractMessageText((message as { content?: unknown })?.content).length,
        0,
      );
      const limitsRule = config.rules["input.limits"] ?? "off";
      let remainingChars = config.maxInputChars;
      let limitFinding = totalAllMessageChars > config.maxInputChars;
      if (limitsRule !== "off" && totalAllMessageChars > config.maxInputChars) {
        findings.push({
          rule: "input.limits",
          action: limitsRule as GuardrailFinding["action"],
          count: 1,
        });
        if (limitsRule === "block") blocked = true;
      }

      for (let index = 0; index < messages.length; index += 1) {
        const message = messages[index] as { content?: unknown } | null;
        const text = extractMessageText(message?.content);
        if (!text) continue;
        const segments = messageTextSegments(message?.content);
        let mutated = false;

        const rule = (name: GuardrailRuleName) => config.rules[name] ?? "off";

        const handleRule = (
          name: GuardrailRuleName,
          count: number,
          action: GuardrailAction,
          patterns: RegExp[],
          replacement: string,
        ) => {
          if (action === "off" || count === 0) return;
          findings.push({ rule: name, action: action as GuardrailFinding["action"], count });
          if (action === "block") blocked = true;
          if (action === "redact") {
            for (const pattern of patterns) redactTextSegments(segments, pattern, replacement);
            mutated = true;
          }
        };

        handleRule("input.pii.email", countMatches(text, EMAIL_PATTERN), rule("input.pii.email"), [EMAIL_PATTERN], EMAIL_REDACTION);
        handleRule("input.pii.phone", countMatches(text, PHONE_PATTERN), rule("input.pii.phone"), [PHONE_PATTERN], PHONE_REDACTION);

        const secretCount = SECRET_PATTERNS.reduce((sum, pattern) => sum + countMatches(text, pattern), 0);
        handleRule("input.secrets", secretCount, rule("input.secrets"), SECRET_PATTERNS, SECRET_REDACTION);

        const injectionCount = INJECTION_PATTERNS.reduce((sum, pattern) => sum + countMatches(text, pattern), 0);
        handleRule("input.injection", injectionCount, rule("input.injection"), INJECTION_PATTERNS, INJECTION_REDACTION);

        handleRule("banned.terms", bannedPattern ? countMatches(text, bannedPattern) : 0, rule("banned.terms"),
          bannedPattern ? [bannedPattern] : [], BANNED_TERM_REDACTION);

        if (limitsRule === "redact") {
          const limited = limitTextSegments(segments, remainingChars);
          remainingChars = limited.remainingChars;
          if (limited.changed) {
            mutated = true;
            if (!limitFinding) {
              findings.push({ rule: "input.limits", action: "redact", count: 1 });
              limitFinding = true;
            }
          }
        }
        if (mutated && segments.map(segment => segment.text).join("") !== text) {
          replacements.push({ index, content: contentWithTextSegments(message?.content, segments) });
        }
      }

      return {
        decision: blocked ? "block" : "allow",
        findings,
        replacements,
      };
    } catch {
      return allow;
    }
  }

  inspectOutputText(text: string): GuardrailsOutputVerdict {
    const allow: GuardrailsOutputVerdict = { decision: "allow", findings: [], text: String(text ?? "") };
    try {
      const config = this.readConfig();
      if (!config.enabled) return allow;

      const original = String(text ?? "");
      let mutated = original;
      const findings: GuardrailFinding[] = [];
      let blocked = false;
      const rule = (name: GuardrailRuleName) => config.rules[name] ?? "off";

      const handleRule = (
        name: GuardrailRuleName,
        count: number,
        action: GuardrailAction,
        redact: ((t: string) => string) | null,
      ) => {
        if (action === "off" || count === 0) return;
        findings.push({ rule: name, action: action as GuardrailFinding["action"], count });
        if (action === "block") blocked = true;
        if (action === "redact" && redact) {
          mutated = redact(mutated);
        }
      };

      handleRule("output.pii.email", countMatches(original, EMAIL_PATTERN), rule("output.pii.email"), (t) => replaceAll(t, EMAIL_PATTERN, EMAIL_REDACTION));
      handleRule("output.pii.phone", countMatches(original, PHONE_PATTERN), rule("output.pii.phone"), (t) => replaceAll(t, PHONE_PATTERN, PHONE_REDACTION));

      const secretCount = SECRET_PATTERNS.reduce((sum, pattern) => sum + countMatches(original, pattern), 0);
      handleRule("output.secrets", secretCount, rule("output.secrets"), (t) => {
        let out = t;
        for (const pattern of SECRET_PATTERNS) out = replaceAll(out, pattern, SECRET_REDACTION);
        return out;
      });

      const bannedPattern = createBannedTermPattern(config.bannedTerms);
      handleRule("banned.terms", bannedPattern ? countMatches(original, bannedPattern) : 0, rule("banned.terms"),
        bannedPattern ? (t) => replaceAll(t, bannedPattern, BANNED_TERM_REDACTION) : null);

      return {
        decision: blocked ? "block" : "allow",
        findings,
        text: mutated,
      };
    } catch {
      return allow;
    }
  }

  inspectSseDelta(textDelta: string): string {
    const verdict = this.inspectOutputText(String(textDelta ?? ""));
    if (verdict.decision === "block") {
      throw Object.assign(new Error("Response blocked by chat guardrails."), {
        code: "guardrail_blocked", category: "governance", retryable: false,
      });
    }
    return verdict.text;
  }
}

function safeJsonEnv(name: string): unknown {
  const raw = process.env[name];
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function defaultOverridesPath(tenantId?: string): string | null {
  try {
    if (tenantId) {
      const tenantScopeKey = createHash("sha256")
        .update(`guardrails-tenant:v1:${tenantId}`)
        .digest("hex");
      const storageRoot = process.env[GUARDRAILS_STORAGE_DIR_ENV]
        ?? resolvePath(process.cwd(), ".data", "enterprise", "guardrails");
      return resolvePath(storageRoot, `${tenantScopeKey}.json`);
    }
    return resolvePath(process.cwd(), ".data", "enterprise", "guardrails-config.json");
  } catch {
    return null;
  }
}

let engineForTests: GuardrailsEngine | null = null;
let defaultEngine: GuardrailsEngine | null = null;
const tenantEngines = new Map<string, GuardrailsEngine>();

export function getGuardrailsEngine(tenantId?: string): GuardrailsEngine {
  if (engineForTests) return engineForTests;
  const normalizedTenantId = typeof tenantId === "string" ? tenantId.trim() : "";
  if (normalizedTenantId) {
    const tenantScopeKey = createHash("sha256")
      .update(`guardrails-tenant:v1:${normalizedTenantId}`)
      .digest("hex");
    let engine = tenantEngines.get(tenantScopeKey);
    if (!engine) {
      engine = new DefaultGuardrailsEngine({
        overridesPath: defaultOverridesPath(normalizedTenantId),
      });
      tenantEngines.set(tenantScopeKey, engine);
    }
    return engine;
  }
  defaultEngine ??= new DefaultGuardrailsEngine();
  return defaultEngine;
}

export function setGuardrailsEngineForTests(engine: GuardrailsEngine | null): void {
  engineForTests = engine;
  if (!engine) {
    defaultEngine = null;
    tenantEngines.clear();
  }
}

export function resetGuardrailsEnginesForTests(): void {
  engineForTests = null;
  defaultEngine = null;
  tenantEngines.clear();
}

/** Test helper: build an engine with explicit config and no file I/O. */
export function createGuardrailsEngineForTests(config: Partial<GuardrailsConfig>): GuardrailsEngine {
  const engine = new DefaultGuardrailsEngine({
    overridesPath: null,
    overrides: normalizeConfig(config),
  });
  return engine;
}
