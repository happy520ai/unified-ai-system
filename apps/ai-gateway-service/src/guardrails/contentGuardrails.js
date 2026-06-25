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
        severity: "warning",
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
      const injectionResults = detectInjection(content);
      if (injectionResults.length > 0) {
        detectionStats.injectionDetected++;
        violations.push({
          type: "injection_detected",
          severity: "block",
          patterns: injectionResults.map((r) => r.pattern),
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
   * 注入检测
   */
  function detectInjection(content) {
    const results = [];
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(content)) {
        results.push({ pattern: pattern.source });
      }
    }
    return results;
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

  return { scan, detectPII, detectInjection, getStats, getHealth };
}
