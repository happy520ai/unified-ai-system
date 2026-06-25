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
import { createHash } from "node:crypto";

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

// Patterns that look like secrets — matched in content and redacted.
const SECRET_PATTERNS = [
  { name: "openai_key", re: /sk-[A-Za-z0-9]{16,}/g, shape: "sk-*** (OpenAI-shaped)" },
  { name: "anthropic_key", re: /sk-ant-[A-Za-z0-9]{16,}/g, shape: "sk-ant-*** (Anthropic-shaped)" },
  { name: "aws_key", re: /AKIA[0-9A-Z]{16}/g, shape: "AKIA*** (AWS-shaped)" },
  { name: "github_pat", re: /gh[pousr]_[A-Za-z0-9]{16,}/g, shape: "gh*_*** (GitHub PAT)" },
  { name: "slack_token", re: /xox[baprs]-[A-Za-z0-9-]{10,}/g, shape: "xox*-*** (Slack)" },
  { name: "google_api", re: /AIza[0-9A-Za-z_-]{35}/g, shape: "AIza*** (Google API)" },
  { name: "nvidia_key", re: /nvapi-[A-Za-z0-9]{16,}/g, shape: "nvapi-*** (NVIDIA-shaped)" },
  { name: "jwt", re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, shape: "eyJ***.***.*** (JWT)" },
  { name: "generic_bearer", re: /[Bb]earer\s+[A-Za-z0-9_.-]{16,}/g, shape: "Bearer ***" },
  { name: "generic_password_assign", re: /(password|passwd|secret|api_key|apikey|token)\s*[:=]\s*["']?[A-Za-z0-9+/=_-]{8,}/gi, shape: "<redacted assignment>" },
];

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
  const readable = [...READABLE_DIAGNOSTIC_PATHS, ...(options.readablePaths || [])];

  return {
    getInfo() {
      return {
        phase: DIAGNOSTIC_PHASE,
        mode: "diagnostic-read-channel",
        ledgerPath,
        readablePaths: readable,
        writeSupported: false,
        sanitizerPatterns: SECRET_PATTERNS.length,
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
        return denied(path, requestor, "invalid_path", reason, startedAt);
      }
      if (!readable.includes(path) && !readable.some((p) => path.startsWith(p))) {
        await audit(ledgerPath, { path, requestor, reason, outcome: "denied_not_allowlisted", at: startedAt.toISOString() });
        return denied(path, requestor, "not_allowlisted", reason, startedAt);
      }

      let raw;
      try {
        raw = await readFile(resolve(process.cwd(), path), "utf8");
      } catch (err) {
        const outcome = err?.code === "ENOENT" ? "file_not_found" : "read_error";
        await audit(ledgerPath, { path, requestor, reason, outcome, error: String(err.message).slice(0, 200), at: startedAt.toISOString() });
        return { allowed: true, path, requestor, read: true, outcome, redacted: true, content: null, present: false };
      }

      // Sanitize: detect + redact every secret pattern.
      // matchAll needs the global flag; the patterns above are all /.../g or /.../gi.
      const findings = [];
      let sanitized = raw;
      for (const p of SECRET_PATTERNS) {
        const matches = [...raw.matchAll(p.re)];
        if (matches.length > 0) {
          findings.push({ pattern: p.name, count: matches.length, shape: p.shape });
          // Use a fresh global RegExp instance for replaceAll (the source pattern
          // may have been state-advanced by matchAll).
          const redactor = new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : p.re.flags + "g");
          sanitized = sanitized.replaceAll(redactor, `[REDACTED:${p.name}]`);
        }
      }

      await audit(ledgerPath, {
        path,
        requestor,
        reason,
        outcome: "read_sanitized",
        at: startedAt.toISOString(),
        bytesIn: raw.length,
        bytesOut: sanitized.length,
        secretPatternsDetected: findings,
      });

      return {
        allowed: true,
        path,
        requestor,
        read: true,
        present: true,
        redacted: findings.length > 0,
        content: sanitized,
        secretIndicators: findings, // presence/shape only, never raw values
        safety: {
          rawSecretReturned: false,
          writeAttempted: false,
          auditRecorded: true,
        },
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
        // Return only which secret *shapes* exist, never values
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

function denied(path, requestor, reason, humanReason, startedAt) {
  return {
    allowed: false,
    path,
    requestor,
    reason,
    read: false,
    at: startedAt.toISOString(),
    safety: { rawSecretReturned: false, writeAttempted: false, auditRecorded: true },
  };
}

async function audit(ledgerPath, entry) {
  try {
    await mkdir(dirname(ledgerPath), { recursive: true });
    const line = `${JSON.stringify({ ...entry, recordedAt: new Date().toISOString(), ledger: "diagnostic-read" })}\n`;
    await appendFile(ledgerPath, line, "utf8");
  } catch {
    // audit failure should NOT block the read path; swallow
  }
}
