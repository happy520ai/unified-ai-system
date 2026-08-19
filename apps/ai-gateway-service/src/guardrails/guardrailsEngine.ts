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

import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";

export const GUARDRAILS_ENABLED_ENV = "AI_GATEWAY_GUARDRAILS_ENABLED";
export const GUARDRAILS_CONFIG_ENV = "AI_GATEWAY_GUARDRAILS_CONFIG";

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
  replacements: Array<{ index: number; content: string }>;
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

const VALID_ACTIONS: GuardrailAction[] = ["off", "warn", "redact", "block"];

function countMatches(text: string, pattern: RegExp): number {
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

function replaceAll(text: string, pattern: RegExp, replacement: string): string {
  return text.replace(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g"), replacement);
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
    this.overridesPath = options.overridesPath ?? defaultOverridesPath();
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
      const replacements: Array<{ index: number; content: string }> = [];
      let blocked = false;

      // 长度上限按全部消息的累计字符数判定：只查末条会被"把超长内容
      // 拆进多条消息"绕过。
      const totalAllMessageChars = messages.reduce(
        (sum, message) => sum + extractMessageText((message as { content?: unknown })?.content).length,
        0,
      );
      const limitsRule = config.rules["input.limits"] ?? "off";
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
        let mutated: string | null = null;

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
            mutated = redact(mutated ?? text);
          }
        };

        handleRule("input.pii.email", countMatches(text, EMAIL_PATTERN), rule("input.pii.email"), (t) => replaceAll(t, EMAIL_PATTERN, EMAIL_REDACTION));
        handleRule("input.pii.phone", countMatches(text, PHONE_PATTERN), rule("input.pii.phone"), (t) => replaceAll(t, PHONE_PATTERN, PHONE_REDACTION));

        const secretCount = SECRET_PATTERNS.reduce((sum, pattern) => sum + countMatches(text, pattern), 0);
        handleRule("input.secrets", secretCount, rule("input.secrets"), (t) => {
          let out = t;
          for (const pattern of SECRET_PATTERNS) out = replaceAll(out, pattern, SECRET_REDACTION);
          return out;
        });

        const injectionCount = INJECTION_PATTERNS.reduce((sum, pattern) => sum + countMatches(text, pattern), 0);
        handleRule("input.injection", injectionCount, rule("input.injection"), null);

        const bannedMatches = config.bannedTerms.filter((term) => text.toLowerCase().includes(term.toLowerCase()));
        handleRule("banned.terms", bannedMatches.length, rule("banned.terms"), null);

        if (mutated !== null && mutated !== text && typeof message?.content === "string") {
          replacements.push({ index, content: mutated });
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

      const bannedMatches = config.bannedTerms.filter((term) => original.toLowerCase().includes(term.toLowerCase()));
      handleRule("banned.terms", bannedMatches.length, rule("banned.terms"), null);

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
    try {
      const verdict = this.inspectOutputText(String(textDelta ?? ""));
      return verdict.text;
    } catch {
      return String(textDelta ?? "");
    }
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

function defaultOverridesPath(): string | null {
  try {
    return resolvePath(process.cwd(), ".data", "enterprise", "guardrails-config.json");
  } catch {
    return null;
  }
}

let engineForTests: GuardrailsEngine | null = null;
let defaultEngine: GuardrailsEngine | null = null;

export function getGuardrailsEngine(): GuardrailsEngine {
  if (engineForTests) return engineForTests;
  defaultEngine ??= new DefaultGuardrailsEngine();
  return defaultEngine;
}

export function setGuardrailsEngineForTests(engine: GuardrailsEngine | null): void {
  engineForTests = engine;
}

/** Test helper: build an engine with explicit config and no file I/O. */
export function createGuardrailsEngineForTests(config: Partial<GuardrailsConfig>): GuardrailsEngine {
  const engine = new DefaultGuardrailsEngine({
    overridesPath: null,
    overrides: normalizeConfig(config),
  });
  return engine;
}
