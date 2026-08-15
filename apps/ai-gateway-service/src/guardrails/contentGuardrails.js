// =============================================================================
// contentGuardrails.js — 内容安全 Guardrails
// PII 检测、毒性过滤、敏感词过滤、幻觉检测、注入防护
// =============================================================================

/**
 * PII 模式（个人身份信息）
 */
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone_cn: /\b1[3-9]\d{9}\b/g,
  phone_us: /\b(\+1)?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  idcard_cn: /\b\d{17}[\dXx]\b/g,
  ssn_us: /\b\d{3}-\d{2}-\d{4}\b/g,
  credit_card: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  ip_address: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  passport_cn: /\b[A-Z]\d{8}\b/g,
};

/**
 * 注入攻击模式
 */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /忽略.*之前.*指令|忽略.*上面.*提示/i,
  /system\s*:\s*you\s+are/i,
  /<\|im_start\|>system/i,
  /\[INST\].*\[\/INST\]/i,
  /jailbreak|DAN\s+mode|developer\s+mode/i,
  /pretend\s+you\s+are|act\s+as\s+if\s+you\s+are/i,
];

/**
 * 敏感内容类别
 */
const HIGH_CONFIDENCE_INJECTION_RULES = [
  { id: "instruction_override", pattern: /\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions?|prompts?|rules?)\b/i },
  { id: "instruction_override_synonym", pattern: /\b(?:disregard|forget|discard)\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|prompts?|rules?|directives?)\b/i },
  { id: "instruction_override_compact", pattern: /\bignore(?:all)?(?:previous|prior|above)(?:instructions?|prompts?|rules?)\b/i },
  { id: "policy_bypass", pattern: /\b(?:override|bypass|disable)\s+(?:the\s+)?(?:system|developer|safety|security)(?:\s+security)?\s+(?:instructions?|rules?|policy|guardrails?)\b/i },
  { id: "prompt_exfiltration", pattern: /\b(?:reveal|print|show|repeat)\s+(?:the\s+)?(?:hidden\s+)?(?:system|developer)\s+(?:prompt|instructions?)\b/i },
  { id: "prompt_exfiltration_compact", pattern: /\b(?:reveal|print|show|repeat)(?:the)?(?:hidden)?(?:system|developer)(?:prompt|instructions?)\b/i },
  { id: "role_prefix_injection", pattern: /^\s*(?:system|developer)\s*:\s*(?:you|ignore|override|reveal)\b/im },
  { id: "chat_control_token", pattern: /<\|(?:im_start|im_end|system|developer)\|>/i },
  { id: "instruction_envelope", pattern: /\[INST\][\s\S]{0,4096}\[\/INST\]/i },
  { id: "chinese_instruction_override", pattern: /(?:\u5ffd\u7565|\u8986\u76d6|\u7ed5\u8fc7).{0,24}(?:\u4e4b\u524d|\u4e0a\u9762|\u7cfb\u7edf|\u5f00\u53d1\u8005).{0,24}(?:\u6307\u4ee4|\u63d0\u793a|\u89c4\u5219)/i },
];
const INVISIBLE_CONTROL_CHARACTERS = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
const BASE64_CANDIDATE = /(?<![A-Za-z0-9+/])(?:[A-Za-z0-9+/]{4}){3,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?(?![A-Za-z0-9+/=])/g;
const CONFUSABLE_CHARACTERS = /[\u0391\u0392\u0395\u0397\u0399\u039A\u039C\u039D\u039F\u03A1\u03A4\u03A5\u03A7\u03B1\u03B5\u03B9\u03BA\u03BF\u03C1\u03C4\u03C5\u03C7\u0410\u0412\u0415\u041A\u041C\u041D\u041E\u0420\u0421\u0422\u0425\u0430\u0435\u043E\u0440\u0441\u0445\u0443\u0456\u0458]/g;
const CONFUSABLE_ASCII = Object.freeze({
  "\u0391": "A", "\u0392": "B", "\u0395": "E", "\u0397": "H", "\u0399": "I", "\u039A": "K",
  "\u039C": "M", "\u039D": "N", "\u039F": "O", "\u03A1": "P", "\u03A4": "T", "\u03A5": "Y",
  "\u03A7": "X", "\u03B1": "a", "\u03B5": "e", "\u03B9": "i", "\u03BA": "k", "\u03BF": "o",
  "\u03C1": "p", "\u03C4": "t", "\u03C5": "y", "\u03C7": "x", "\u0410": "A", "\u0412": "B",
  "\u0415": "E", "\u041A": "K", "\u041C": "M", "\u041D": "H", "\u041E": "O", "\u0420": "P",
  "\u0421": "C", "\u0422": "T", "\u0425": "X", "\u0430": "a", "\u0435": "e", "\u043E": "o",
  "\u0440": "p", "\u0441": "c", "\u0445": "x", "\u0443": "y", "\u0456": "i", "\u0458": "j",
});
const LEET_ASCII = Object.freeze({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" });

export function canonicalizeInjectionText(content) {
  return String(content ?? "")
    .normalize("NFKC")
    .replace(INVISIBLE_CONTROL_CHARACTERS, "")
    .replace(CONFUSABLE_CHARACTERS, (character) => CONFUSABLE_ASCII[character] ?? character)
    .replace(/\s+/g, " ")
    .trim();
}

function buildInjectionVariants(content) {
  const variants = new Set();
  const addVariant = (value) => {
    const canonical = canonicalizeInjectionText(value);
    if (!canonical) return;
    variants.add(canonical);
    const leetFolded = canonical.replace(/[013457@$!]/g, (character) => LEET_ASCII[character] ?? character);
    variants.add(leetFolded);
    for (const candidate of [canonical, leetFolded]) {
      const separatorFolded = candidate
        .replace(/[\p{P}\p{S}_]+/gu, "")
        .replace(/\s+/g, " ")
        .trim();
      if (separatorFolded) variants.add(separatorFolded);
      const compact = candidate.replace(/[\s\p{P}\p{S}_]+/gu, "");
      if (compact) variants.add(compact);
    }
  };

  const raw = String(content ?? "");
  addVariant(raw);
  let percentDecoded = raw;
  for (let depth = 0; depth < 2 && /%[0-9a-f]{2}/i.test(percentDecoded); depth += 1) {
    try {
      percentDecoded = decodeURIComponent(percentDecoded);
      addVariant(percentDecoded);
    } catch {
      break;
    }
  }
  addVariant(decodeHtmlEntities(raw));
  addVariant(decodeEscapedCharacters(raw));

  for (const match of raw.match(BASE64_CANDIDATE) ?? []) {
    if (match.length > 4096) continue;
    try {
      const decoded = Buffer.from(match, "base64").toString("utf8");
      const controls = [...decoded].filter((character) => /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(character)).length;
      if (decoded.length > 0 && !decoded.includes("\uFFFD") && controls / decoded.length <= 0.15) {
        addVariant(decoded);
      }
    } catch {
      // Malformed candidates are ignored without exposing their content.
    }
  }
  return [...variants];
}

function decodeHtmlEntities(content) {
  return String(content)
    .replace(/&#(\d{1,7});?/g, (match, decimal) => safeCodePoint(decimal, 10, match))
    .replace(/&#x([0-9a-f]{1,6});?/gi, (match, hexadecimal) => safeCodePoint(hexadecimal, 16, match))
    .replace(/&(colon|tab|newline|excl|sol|bsol|period);/gi, (match, name) => ({
      colon: ":", tab: "\t", newline: "\n", excl: "!", sol: "/", bsol: "\\", period: ".",
    })[String(name).toLowerCase()] ?? match);
}

function decodeEscapedCharacters(content) {
  return String(content).replace(
    /\\u\{([0-9a-f]{1,6})\}|\\u([0-9a-f]{4})|\\x([0-9a-f]{2})/gi,
    (match, braced, unicode, hexadecimal) => safeCodePoint(braced ?? unicode ?? hexadecimal, 16, match),
  );
}

function safeCodePoint(value, radix, fallback) {
  const codePoint = Number.parseInt(value, radix);
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10FFFF || (codePoint >= 0xD800 && codePoint <= 0xDFFF)) {
    return fallback;
  }
  return String.fromCodePoint(codePoint);
}

export function detectPromptInjection(content) {
  const results = [];
  for (const variant of buildInjectionVariants(content)) {
    for (const rule of HIGH_CONFIDENCE_INJECTION_RULES) {
      if (rule.pattern.test(variant) && !results.some((result) => result.ruleId === rule.id)) {
        results.push({ ruleId: rule.id });
      }
    }
  }
  return results;
}

const SENSITIVE_CATEGORIES = {
  violence:    /暴力|杀|枪|bomb|weapon|kill|murder|attack/i,
  illegal:     /毒品|赌博|诈骗|洗钱|drug|gambling|fraud|money\s*laundering/i,
  adult:       /色情|裸体|sex|porn|nude|explicit/i,
  hate_speech: /仇恨|歧视|种族主义|hate|discrimination|racism/i,
  self_harm:   /自杀|自残|suicide|self-harm|cutting/i,
};

/**
 * 创建内容 Guardrails
 * @param {Object} options
 * @returns {Object}
 */
export function createContentGuardrails(options = {}) {
  const config = {
    enablePIIDetection: options.enablePIIDetection ?? true,
    enableInjectionDetection: options.enableInjectionDetection ?? true,
    enableSensitiveContentDetection: options.enableSensitiveContentDetection ?? true,
    enableToxicityDetection: options.enableToxicityDetection ?? false, // 需要外部模型
    blockOnPII: options.blockOnPII ?? false, // 默认只检测不阻断
    blockOnInjection: options.blockOnInjection ?? true,
    blockOnSensitive: options.blockOnSensitive ?? false,
    maskPII: options.maskPII ?? true,
    maxInputLength: options.maxInputLength ?? 100000,
    customSensitiveWords: options.customSensitiveWords ?? [],
  };

  const detectionStats = {
    totalScans: 0,
    piiDetected: 0,
    injectionDetected: 0,
    sensitiveDetected: 0,
    blocked: 0,
  };

  /**
   * 扫描内容
   * @param {string} content - 待扫描内容
   * @param {Object} context - { direction: "input"|"output", userId }
   * @returns {Object} { safe, violations, maskedContent }
   */
  function scan(content, context = {}) {
    detectionStats.totalScans++;
    const violations = [];
    let maskedContent = content;

    if (!content || typeof content !== "string") {
      return { safe: true, violations: [], maskedContent: content };
    }

    // 长度检查
    if (content.length > config.maxInputLength) {
      violations.push({
        type: "length_exceeded",
        severity: "block",
        message: `Content length ${content.length} exceeds max ${config.maxInputLength}`,
      });
    }

    // PII 检测
    if (config.enablePIIDetection) {
      const piiResults = detectPII(content);
      if (piiResults.length > 0) {
        detectionStats.piiDetected++;
        violations.push({
          type: "pii_detected",
          severity: config.blockOnPII ? "block" : "warning",
          count: piiResults.length,
          types: piiResults.map((r) => r.type),
        });

        // 掩码 PII
        if (config.maskPII) {
          maskedContent = maskPIIContent(maskedContent, piiResults);
        }
      }
    }

    // 注入检测
    if (config.enableInjectionDetection && context.direction === "input") {
      const injectionResults = detectPromptInjection(content);
      if (injectionResults.length > 0) {
        detectionStats.injectionDetected++;
        violations.push({
          type: "injection_detected",
          severity: config.blockOnInjection ? "block" : "warning",
          ruleIds: injectionResults.map((r) => r.ruleId),
        });
      }
    }

    // 敏感内容检测
    if (config.enableSensitiveContentDetection) {
      const sensitiveResults = detectSensitiveContent(content);
      if (sensitiveResults.length > 0) {
        detectionStats.sensitiveDetected++;
        violations.push({
          type: "sensitive_content",
          severity: config.blockOnSensitive ? "block" : "warning",
          categories: sensitiveResults.map((r) => r.category),
        });
      }
    }

    // 自定义敏感词
    if (config.customSensitiveWords.length > 0) {
      const customHits = config.customSensitiveWords.filter((w) =>
        content.toLowerCase().includes(w.toLowerCase())
      );
      if (customHits.length > 0) {
        violations.push({
          type: "custom_sensitive_words",
          severity: "warning",
          words: customHits,
        });
      }
    }

    const hasBlock = violations.some((v) => v.severity === "block");
    if (hasBlock) detectionStats.blocked++;

    return {
      safe: !hasBlock,
      violations,
      maskedContent,
      scannedAt: Date.now(),
    };
  }

  /**
   * PII 检测
   */
  function detectPII(content) {
    const results = [];
    for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(content)) !== null) {
        results.push({ type, value: match[0], index: match.index });
      }
    }
    return results;
  }

  /**
   * 掩码 PII 内容
   */
  function maskPIIContent(content, piiResults) {
    let masked = content;
    // 从后往前替换，避免索引偏移
    const sorted = [...piiResults].sort((a, b) => b.index - a.index);
    for (const pii of sorted) {
      const before = masked.slice(0, pii.index);
      const after = masked.slice(pii.index + pii.value.length);
      const mask = pii.value.slice(0, 2) + "*".repeat(Math.max(0, pii.value.length - 4)) + pii.value.slice(-2);
      masked = before + mask + after;
    }
    return masked;
  }

  /**
   * 敏感内容检测
   */
  function detectSensitiveContent(content) {
    const results = [];
    for (const [category, pattern] of Object.entries(SENSITIVE_CATEGORIES)) {
      if (pattern.test(content)) {
        results.push({ category });
      }
    }
    return results;
  }

  /**
   * 获取统计
   */
  function getStats() {
    return { ...detectionStats };
  }

  /**
   * 获取健康状态
   */
  function getHealth() {
    return {
      status: "ready",
      config: {
        piiDetection: config.enablePIIDetection,
        injectionDetection: config.enableInjectionDetection,
        sensitiveContentDetection: config.enableSensitiveContentDetection,
        maskPII: config.maskPII,
      },
      stats: detectionStats,
    };
  }

  return { scan, detectPII, detectInjection: detectPromptInjection, getStats, getHealth };
}
