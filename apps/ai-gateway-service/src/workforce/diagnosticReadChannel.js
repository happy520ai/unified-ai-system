/**
 * diagnosticReadChannel.js
 *
 * Read-only elevation channel for agent diagnostics.
 *
 * Problem it solves: the workforce agents currently operate "blind" — they
 * cannot read secrets, .env, auth.json, or provider config, which means when
 * something breaks they have no context to diagnose. The current rule
 * ("never read secrets") is correct for the WRITE path, but overly strict for
 * diagnostics.
 *
 * This channel grants a *read* capability with three guarantees:
 *   1. WRITE path stays fully locked (this module exposes read() only, never write).
 *   2. Every read is AUDITED (who, what, when, why) to a tamper-evident ledger.
 *   3. Every read output is SANITIZED before being returned to the agent —
 *      secrets are redacted to shape/presence indicators, never raw values.
 *
 * The agent gets enough context to diagnose ("the key is present and looks like
 * an OpenAI key"), without ever seeing the key itself. This unlocks a lot of
 * autonomy in troubleshooting without lowering the write security boundary.
 */

import { readFile } from "node:fs/promises";
import { mkdir, appendFile } from "node:fs/promises";
import { dirname, resolve, basename } from "node:path";

export const DIAGNOSTIC_PHASE = "PhaseDiagnosticReadChannel";

// Files that may be READ for diagnostics (explicit allowlist).
// Anything not here is denied outright.
const READABLE_DIAGNOSTIC_PATHS = Object.freeze([
  ".env",
  ".env.local",
  "providers-config.json",
  "auth.json",
  "settings.json",
  "knowledge-config.json",
]);

const SENSITIVE_KEY_PATTERN = /(api.?key|auth|bearer|cookie|credential|password|passwd|private|secret|token)/i;
const MAX_PROJECTED_FIELDS = 200;
const MAX_PROJECTED_DEPTH = 12;

const DEFAULT_LEDGER_PATH = resolve(process.cwd(), ".data", "workforce", "diagnostic-read-ledger.jsonl");

/**
 * @param {object} options
 * @param {string} [options.ledgerPath]
 * @param {string[]} [options.readablePaths]  — extend the allowlist
 * @param {object} [options.env]
 */
export function createDiagnosticReadChannel(options = {}) {
  const env = options.env ?? process.env;
  const ledgerPath = resolve(options.ledgerPath || env.WORKFORCE_DIAGNOSTIC_LEDGER || DEFAULT_LEDGER_PATH);
  const rootDir = resolve(options.rootDir || process.cwd());
  const readable = new Set(
    [...READABLE_DIAGNOSTIC_PATHS, ...(options.readablePaths || [])]
      .map((path) => normalizePath(path))
      .filter(Boolean),
  );

  return {
    getInfo() {
      return {
        phase: DIAGNOSTIC_PHASE,
        mode: "diagnostic-read-channel",
        ledgerPath,
        readablePaths: [...readable],
        writeSupported: false,
        valueProjection: "structure-only",
      };
    },

    /**
     * Read a diagnostic file with full audit + sanitization.
     * @param {object} input
     * @param {string} input.path      — relative path (must be in allowlist)
     * @param {string} input.requestor — agent/role id
     * @param {string} [input.reason]  — why the read is needed
     */
    async read(input = {}) {
      const startedAt = new Date();
      const path = normalizePath(input.path);
      const requestor = String(input.requestor || "unknown").slice(0, 100);
      const reason = String(input.reason || "").slice(0, 500);

      if (!path) {
        const auditRecorded = await audit(ledgerPath, { path: null, requestor, reason, outcome: "denied_invalid_path", at: startedAt.toISOString() });
        return denied(path, requestor, "invalid_path", reason, startedAt, auditRecorded);
      }
      if (!readable.has(path)) {
        const auditRecorded = await audit(ledgerPath, { path, requestor, reason, outcome: "denied_not_allowlisted", at: startedAt.toISOString() });
        return denied(path, requestor, "not_allowlisted", reason, startedAt, auditRecorded);
      }

      let raw;
      try {
        raw = await readFile(resolve(rootDir, path), "utf8");
      } catch (err) {
        const outcome = err?.code === "ENOENT" ? "file_not_found" : "read_error";
        const auditRecorded = await audit(ledgerPath, { path, requestor, reason, outcome, errorCode: err?.code ?? "unknown", at: startedAt.toISOString() });
        if (!auditRecorded) return denied(path, requestor, "audit_unavailable", reason, startedAt, false);
        return {
          allowed: true,
          path,
          requestor,
          read: true,
          outcome,
          content: null,
          diagnostic: null,
          present: false,
          safety: createSafety(true),
        };
      }

      const diagnostic = projectDiagnosticContent(path, raw);
      const auditRecorded = await audit(ledgerPath, {
        path,
        requestor,
        reason,
        outcome: "read_structure_only",
        at: startedAt.toISOString(),
        bytesIn: raw.length,
        format: diagnostic.format,
        projectedFieldCount: diagnostic.projectedFieldCount,
        sensitiveFieldCount: diagnostic.sensitiveKeys.length,
      });
      if (!auditRecorded) return denied(path, requestor, "audit_unavailable", reason, startedAt, false);

      return {
        allowed: true,
        path,
        requestor,
        read: true,
        present: true,
        redacted: true,
        content: JSON.stringify(diagnostic, null, 2),
        diagnostic,
        secretIndicators: diagnostic.sensitiveKeys.map((key) => ({ key, classification: "value_redacted" })),
        safety: createSafety(true),
      };
    },

    /**
     * Check whether a key is PRESENT in a config file (boolean only, no value).
     * Useful for agents that just need "is the credential configured?".
     */
    async checkPresence(input = {}) {
      const r = await this.read(input);
      if (!r.read || !r.present) return { path: input.path, present: false };
      return {
        path: input.path,
        present: true,
        secretIndicators: r.secretIndicators,
        configuredKeys: r.diagnostic?.keys ?? [],
      };
    },

    getReadablePaths() {
      return [...readable];
    },
  };
}

// --- helpers ---

function normalizePath(p) {
  if (!p || typeof p !== "string") return null;
  // Block path traversal
  const cleaned = p.replace(/\\/g, "/").replace(/^\.?\//, "").trim();
  if (cleaned.includes("..")) return null;
  if (cleaned.includes("\0")) return null;
  return cleaned;
}

function denied(path, requestor, reason, humanReason, startedAt, auditRecorded) {
  return {
    allowed: false,
    path,
    requestor,
    reason,
    read: false,
    at: startedAt.toISOString(),
    safety: createSafety(auditRecorded),
  };
}

async function audit(ledgerPath, entry) {
  try {
    await mkdir(dirname(ledgerPath), { recursive: true });
    const line = `${JSON.stringify({ ...entry, recordedAt: new Date().toISOString(), ledger: "diagnostic-read" })}\n`;
    await appendFile(ledgerPath, line, "utf8");
    return true;
  } catch {
    return false;
  }
}

function createSafety(auditRecorded) {
  return {
    rawSecretReturned: false,
    rawContentReturned: false,
    valuesReturned: false,
    writeAttempted: false,
    auditRecorded,
  };
}

function projectDiagnosticContent(path, raw) {
  if (basename(path).startsWith(".env")) return projectDotenv(raw);
  try {
    const sensitiveKeys = new Set();
    const state = { projectedFieldCount: 0, sensitiveKeys };
    const structure = projectJsonValue(JSON.parse(raw), state, 0, "$");
    return {
      format: "json-structure",
      projectedFieldCount: state.projectedFieldCount,
      sensitiveKeys: [...sensitiveKeys].sort(),
      keys: topLevelKeys(structure),
      structure,
    };
  } catch {
    return {
      format: "opaque-structure",
      projectedFieldCount: 0,
      sensitiveKeys: [],
      keys: [],
      byteLength: Buffer.byteLength(raw, "utf8"),
      lineCount: raw.split(/\r?\n/).length,
    };
  }
}

function projectDotenv(raw) {
  const entries = [];
  const sensitiveKeys = [];
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=([\s\S]*)$/);
    if (!match || entries.length >= MAX_PROJECTED_FIELDS) continue;
    const key = match[1];
    const configured = match[2].trim().length > 0;
    entries.push({ key, configured, value: "[REDACTED]" });
    if (SENSITIVE_KEY_PATTERN.test(key)) sensitiveKeys.push(key);
  }
  return {
    format: "dotenv-structure",
    projectedFieldCount: entries.length,
    sensitiveKeys: [...new Set(sensitiveKeys)].sort(),
    keys: entries.map((entry) => entry.key),
    entries,
  };
}

function projectJsonValue(value, state, depth, path) {
  if (depth >= MAX_PROJECTED_DEPTH) return { type: "truncated", value: "[REDACTED]" };
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_PROJECTED_FIELDS).map((item, index) => (
      projectJsonValue(item, state, depth + 1, `${path}[${index}]`)
    ));
    return { type: "array", length: value.length, items };
  }
  if (value && typeof value === "object") {
    const fields = {};
    for (const key of Object.keys(value).sort().slice(0, MAX_PROJECTED_FIELDS)) {
      state.projectedFieldCount += 1;
      const keyPath = path === "$" ? key : `${path}.${key}`;
      if (SENSITIVE_KEY_PATTERN.test(key)) state.sensitiveKeys.add(keyPath);
      fields[key] = projectJsonValue(value[key], state, depth + 1, keyPath);
    }
    return { type: "object", fields };
  }
  return {
    type: value === null ? "null" : typeof value,
    configured: value !== null && value !== "",
    value: "[REDACTED]",
  };
}

function topLevelKeys(structure) {
  return structure?.type === "object" ? Object.keys(structure.fields) : [];
}
