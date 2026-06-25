/**
 * @module injection-defense/helpers
 * @description Pure functions, constants, and helpers for prompt injection defense.
 * Extracted from index.js to reduce class file size and improve testability.
 */

// ---------------------------------------------------------------------------
// Severity enum
// ---------------------------------------------------------------------------

/**
 * Severity levels for detected threats.
 *
 * @readonly
 * @enum {string}
 */
export const Severity = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
});

/**
 * Numeric weight per severity for risk-score calculation.
 *
 * @type {Record<string, number>}
 */
export const SEVERITY_WEIGHT = {
  [Severity.LOW]: 5,
  [Severity.MEDIUM]: 15,
  [Severity.HIGH]: 35,
  [Severity.CRITICAL]: 60,
};

// ---------------------------------------------------------------------------
// Strictness configuration
// ---------------------------------------------------------------------------

/**
 * Minimum severity required for a pattern to be active at each strictness level.
 *
 * @type {Record<string, string[]>}
 */
export const STRICTNESS_SEVERITIES = {
  low: [Severity.HIGH, Severity.CRITICAL],
  standard: [Severity.MEDIUM, Severity.HIGH, Severity.CRITICAL],
  high: [Severity.LOW, Severity.MEDIUM, Severity.HIGH, Severity.CRITICAL],
};

// ---------------------------------------------------------------------------
// Built-in detection patterns
// ---------------------------------------------------------------------------

/**
 * Each built-in pattern:
 *   - `name`:        Short machine-readable identifier.
 *   - `regex`:       RegExp to test against the input text.
 *   - `severity`:    One of the {@link Severity} values.
 *   - `category`:    Grouping label for reporting.
 *   - `description`: Human-readable explanation of the threat.
 *
 * @type {Array<{ name: string, regex: RegExp, severity: string, category: string, description: string }>}
 */
export const BUILTIN_PATTERNS = [
  // ── Direct injection ────────────────────────────────────────────────────
  {
    name: 'ignore-previous',
    regex: /\bignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?|context)\b/i,
    severity: Severity.CRITICAL,
    category: 'direct-injection',
    description: 'Attempts to discard the system prompt or prior context.',
  },
  {
    name: 'disregard-above',
    regex: /\b(disregard|forget|discard|erase|override)\s+(all\s+)?(the\s+)?(above|previous|prior|earlier|system)\b/i,
    severity: Severity.CRITICAL,
    category: 'direct-injection',
    description: 'Instructs the model to disregard preceding content.',
  },
  {
    name: 'forget-rules',
    regex: /\bforget\s+(your\s+)?(rules?|guidelines?|constraints?|instructions?|training)\b/i,
    severity: Severity.CRITICAL,
    category: 'direct-injection',
    description: 'Attempts to make the model forget its safety rules.',
  },
  {
    name: 'you-are-now',
    regex: /\byou\s+are\s+now\s+(a|an|the|DAN|unrestricted|free|unfiltered)\b/i,
    severity: Severity.CRITICAL,
    category: 'direct-injection',
    description: 'Attempts to redefine the model identity or constraints.',
  },
  {
    name: 'new-instructions',
    regex: /\bnew\s+(instructions?|rules?|directives?|guidelines?|system\s*prompt)\s*[:\-]/i,
    severity: Severity.HIGH,
    category: 'direct-injection',
    description: 'Injects a replacement instruction set.',
  },
  {
    name: 'system-override',
    regex: /\b(system\s*(override|prompt|message)|\[INST\]|<<SYS>>|<\|im_start\|>system)\b/i,
    severity: Severity.CRITICAL,
    category: 'direct-injection',
    description: 'Injects system-level control tokens.',
  },

  // ── Role hijacking ──────────────────────────────────────────────────────
  {
    name: 'act-as',
    regex: /\b(act|behave|respond|reply)\s+as\s+(if\s+you\s+are|a|an)\b/i,
    severity: Severity.MEDIUM,
    category: 'role-hijacking',
    description: 'Attempts to assign a new persona or role.',
  },
  {
    name: 'pretend-you-are',
    regex: /\b(pretend|imagine|assume)\s+(you\s+are|to\s+be|that\s+you)\b/i,
    severity: Severity.MEDIUM,
    category: 'role-hijacking',
    description: 'Asks the model to adopt an alternative identity.',
  },
  {
    name: 'new-role',
    regex: /\b(your\s+new\s+role|from\s+now\s+on\s+you|you\s+must\s+now)\b/i,
    severity: Severity.HIGH,
    category: 'role-hijacking',
    description: 'Explicitly reassigns the model role mid-conversation.',
  },
  {
    name: 'developer-mode',
    regex: /\b(developer|DAN|jailbreak|unfiltered|unrestricted)\s+mode\b/i,
    severity: Severity.CRITICAL,
    category: 'role-hijacking',
    description: 'References known jailbreak mode keywords.',
  },

  // ── Data exfiltration ───────────────────────────────────────────────────
  {
    name: 'send-to-url',
    regex: /\b(send|post|transmit|forward|exfiltrate)\s+(this\s+)?(data|content|response|output|conversation)\s+(to|at)\s+(https?:\/\/|[\w.-]+\.\w{2,})/i,
    severity: Severity.HIGH,
    category: 'data-exfiltration',
    description: 'Directs the model to send data to an external endpoint.',
  },
  {
    name: 'email-to',
    regex: /\b(email|mail|send)\s+(to|at)\s+[\w.+-]+@[\w.-]+\.\w{2,}/i,
    severity: Severity.HIGH,
    category: 'data-exfiltration',
    description: 'Instructs the model to email content externally.',
  },
  {
    name: 'upload-to',
    regex: /\b(upload|paste|submit)\s+(to|at|on)\s+(pastebin|hastebin|github|gist|dropbox|google\s+drive)/i,
    severity: Severity.MEDIUM,
    category: 'data-exfiltration',
    description: 'Directs uploading of content to external services.',
  },

  // ── Encoding tricks ─────────────────────────────────────────────────────
  {
    name: 'base64-instruction',
    regex: /\b(decode|interpret|execute|run)\s+(this\s+)?(base\s*64|b64|encoded)\b/i,
    severity: Severity.HIGH,
    category: 'encoding-tricks',
    description: 'Asks the model to decode Base64-encoded instructions.',
  },
  {
    name: 'reversed-text',
    regex: /\b(read|decode|interpret)\s+(backwards|in\s+reverse|reversed)\b/i,
    severity: Severity.MEDIUM,
    category: 'encoding-tricks',
    description: 'Attempts to hide instructions in reversed text.',
  },
  {
    name: 'hex-encoded',
    regex: /\b(decode|convert)\s+(this\s+)?(hex|hexadecimal|0x[\da-fA-F]{4,})\b/i,
    severity: Severity.MEDIUM,
    category: 'encoding-tricks',
    description: 'Attempts to hide instructions in hex encoding.',
  },
  {
    name: 'unicode-homoglyph',
    regex: /[\u0400-\u04FF\u0500-\u052F\u1E00-\u1EFF\u2C60-\u2C7F]{5,}/,
    severity: Severity.LOW,
    category: 'encoding-tricks',
    description: 'Detects extended runs of Cyrillic/Latin-Extended characters that may be homoglyphs.',
  },

  // ── Comment injection ───────────────────────────────────────────────────
  {
    name: 'html-comment-inject',
    regex: /<!--\s*(IGNORE|SYSTEM|ADMIN|OVERRIDE|INJECT|HIDDEN)[\s\S]*?-->/i,
    severity: Severity.HIGH,
    category: 'comment-injection',
    description: 'HTML comment containing hidden instructions.',
  },
  {
    name: 'js-comment-inject',
    regex: /\/\/\s*(SYSTEM|ADMIN|OVERRIDE|INJECT|HIDDEN|IGNORE|IMPORTANT)\s*:/i,
    severity: Severity.HIGH,
    category: 'comment-injection',
    description: 'Single-line code comment with directive keyword.',
  },
  {
    name: 'block-comment-inject',
    regex: /\/\*\s*(SYSTEM|ADMIN|OVERRIDE|INJECT|HIDDEN|IGNORE|IMPORTANT)\s*[:\n]/i,
    severity: Severity.HIGH,
    category: 'comment-injection',
    description: 'Block comment with directive keyword.',
  },

  // ── Markdown injection ──────────────────────────────────────────────────
  {
    name: 'markdown-javascript',
    regex: /\[.*?\]\s*\(javascript:[^\)]+\)/i,
    severity: Severity.CRITICAL,
    category: 'markdown-injection',
    description: 'Markdown link with javascript: URI — XSS vector.',
  },
  {
    name: 'hidden-html-instruction',
    regex: /<(div|span|p|style)\s+[^>]*(display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0)[^>]*>[\s\S]*?<\/\1>/i,
    severity: Severity.HIGH,
    category: 'markdown-injection',
    description: 'Hidden HTML element that may contain concealed instructions.',
  },
  {
    name: 'data-uri-image',
    regex: /!\[.*?\]\(data:image\/[^)]{200,}\)/i,
    severity: Severity.MEDIUM,
    category: 'markdown-injection',
    description: 'Extremely large data-URI image that may embed hidden text.',
  },

  // ── Code injection ──────────────────────────────────────────────────────
  {
    name: 'backtick-system-prompt',
    regex: /```\s*\n\s*(system|you are|assistant|instructions?)\s*:/i,
    severity: Severity.HIGH,
    category: 'code-injection',
    description: 'Code block that mimics a system prompt definition.',
  },
  {
    name: 'string-literal-prompt',
    regex: /["'`]\s*(You are a helpful|Ignore all previous|You must now|From now on)\b/i,
    severity: Severity.HIGH,
    category: 'code-injection',
    description: 'String literal that contains a prompt injection phrase.',
  },
  {
    name: 'env-access',
    regex: /\b(process\.env|os\.environ|ENV\[)\s*[\[.]*\s*(API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)/i,
    severity: Severity.CRITICAL,
    category: 'code-injection',
    description: 'Code accessing environment secrets.',
  },
];

// ---------------------------------------------------------------------------
// Typedefs
// ---------------------------------------------------------------------------

/**
 * A single detected threat within scanned text.
 *
 * @typedef {Object} Threat
 * @property {string} id          - Unique threat identifier (UUID).
 * @property {string} type        - Pattern name that matched.
 * @property {string} severity    - One of the {@link Severity} values.
 * @property {string} pattern     - The regex source that triggered the match.
 * @property {string} match       - The actual matched text.
 * @property {Object} position    - Location of the match within the input.
 * @property {number} position.start - Character offset where the match begins.
 * @property {number} position.end   - Character offset where the match ends.
 * @property {string} description - Human-readable explanation.
 */

/**
 * Result returned by scan operations.
 *
 * @typedef {Object} ScanResult
 * @property {boolean}   clean       - `true` when no threats were detected.
 * @property {Threat[]}  threats     - All detected threats.
 * @property {string}    sanitized   - The input text with threats neutralised.
 * @property {number}    riskScore   - 0 (clean) to 100 (critical threat).
 * @property {string}    [source]    - Source identifier from scan options.
 */

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

/**
 * Compute a risk score (0-100) from a set of threats.
 *
 * Formula: min(100, sum of severity weights + 2 * number_of_threats)
 *
 * @param {Threat[]} threats - Detected threats.
 * @returns {number} Risk score from 0 (clean) to 100 (critical).
 */
export function computeRiskScore(threats) {
  if (threats.length === 0) return 0;

  let score = 0;
  for (const t of threats) {
    score += SEVERITY_WEIGHT[t.severity] ?? 5;
  }
  // Additional penalty for volume of threats
  score += threats.length * 2;

  return Math.min(100, score);
}

/**
 * Replace detected threat matches in the text with a neutral placeholder.
 *
 * Matches are sorted by position and replaced from end to start to avoid
 * offset invalidation.
 *
 * @param {string}   text    - The original (truncated) text.
 * @param {Threat[]} threats - Detected threats from a scan.
 * @returns {string} Sanitised text.
 */
export function sanitizeText(text, threats) {
  if (threats.length === 0) return text;

  const REPLACEMENT = '[FILTERED: potential injection]';

  // Sort threats by start position descending so replacements don't shift offsets
  const sorted = [...threats].sort((a, b) => b.position.start - a.position.start);

  // De-duplicate overlapping ranges
  const ranges = [];
  for (const t of sorted) {
    const start = t.position.start;
    const end = t.position.end;
    // Skip if overlapping with an already-added range
    if (ranges.length > 0 && end > ranges[ranges.length - 1].start) {
      // Extend the existing range if this one starts earlier
      if (start < ranges[ranges.length - 1].start) {
        ranges[ranges.length - 1].start = start;
      }
      if (end > ranges[ranges.length - 1].end) {
        ranges[ranges.length - 1].end = end;
      }
      continue;
    }
    ranges.push({ start, end });
  }

  // Apply replacements from end to start
  let result = text;
  for (const { start, end } of ranges) {
    result = result.slice(0, start) + REPLACEMENT + result.slice(end);
  }

  return result;
}

/**
 * Get all patterns active at a given strictness level.
 *
 * @param {Array} builtinPatterns - Built-in patterns array.
 * @param {Array} customPatterns  - Custom patterns array.
 * @param {string} strictness     - 'low' | 'standard' | 'high'.
 * @returns {Array<{ name: string, regex: RegExp, severity: string, category: string, description: string }>}
 */
export function getActivePatterns(builtinPatterns, customPatterns, strictness) {
  const allowedSeverities = STRICTNESS_SEVERITIES[strictness] ?? STRICTNESS_SEVERITIES.standard;
  const allPatterns = [...builtinPatterns, ...customPatterns];

  return allPatterns.filter((p) => allowedSeverities.includes(p.severity));
}

/**
 * Truncate text to the configured maximum scan size.
 *
 * @param {string} text         - Input text.
 * @param {number} maxScanBytes - Maximum bytes to scan.
 * @returns {string} Possibly truncated text.
 */
export function truncateText(text, maxScanBytes) {
  if (text.length <= maxScanBytes) return text;
  return text.slice(0, maxScanBytes);
}
