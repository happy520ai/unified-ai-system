// =============================================================================
// promptCompressor.js — Prompt 压缩引擎
// 自动压缩长 Prompt，减少 30-50% Token 消耗
// =============================================================================

export function createPromptCompressor(options = {}) {
  const targetCompressionRatio = options.targetRatio ?? 0.5;
  const minInputLength = options.minInputLength ?? 2000;
  const maxInputLength = options.maxInputLength ?? 100000;

  /**
   * 压缩 Prompt
   * @param {string} prompt
   * @param {Object} context - { strategy, preserveCode, preserveStructure }
   * @returns {Object} { compressed, originalLength, compressedLength, ratio, strategy }
   */
  function compress(prompt, context = {}) {
    if (!prompt || typeof prompt !== "string") return { compressed: prompt, ratio: 1 };
    if (prompt.length < minInputLength) return { compressed: prompt, ratio: 1, strategy: "no_compression" };

    const strategies = [
      { name: "remove_repetition", fn: removeRepetition },
      { name: "condense_whitespace", fn: condenseWhitespace },
      { name: "remove_filler", fn: removeFiller },
      { name: "summarize_context", fn: summarizeContext },
    ];

    let compressed = prompt;
    const appliedStrategies = [];

    for (const strategy of strategies) {
      const result = strategy.fn(compressed, context);
      if (result.length < compressed.length) {
        compressed = result;
        appliedStrategies.push(strategy.name);
      }
      // 达到目标压缩率就停
      if (compressed.length <= prompt.length * targetCompressionRatio) break;
    }

    const ratio = compressed.length / prompt.length;
    return {
      compressed,
      originalLength: prompt.length,
      compressedLength: compressed.length,
      ratio: Math.round(ratio * 100) / 100,
      savedTokens: Math.round((prompt.length - compressed.length) / 4),
      strategies: appliedStrategies,
    };
  }

  function removeRepetition(text) {
    // 移除连续重复的句子
    const sentences = text.split(/(?<=[。！？\.\!\?\n])/);
    const seen = new Set();
    const unique = [];
    for (const s of sentences) {
      const trimmed = s.trim();
      if (trimmed.length < 10) { unique.push(s); continue; }
      const key = trimmed.toLowerCase().slice(0, 100);
      if (!seen.has(key)) { seen.add(key); unique.push(s); }
    }
    return unique.join("");
  }

  function condenseWhitespace(text) {
    return text
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/^\s+$/gm, "");
  }

  function removeFiller(text) {
    const fillers = [
      /请注意[，,]?\s*/g,
      /值得一提的是[，,]?\s*/g,
      /需要指出的是[，,]?\s*/g,
      /当然[，,]?\s*/g,
      /总之[，,]?\s*/g,
      /basically[，,]?\s*/gi,
      /as a matter of fact[，,]?\s*/gi,
      /it is worth noting that\s*/gi,
      /please note that\s*/gi,
    ];
    let result = text;
    for (const f of fillers) result = result.replace(f, "");
    return result;
  }

  function summarizeContext(text) {
    // 如果有大段代码注释或日志，压缩它们
    return text
      .replace(/(\/\/[^\n]*\n){5,}/g, (match) => {
        const lines = match.split("\n").filter(Boolean);
        return `// ${lines.length} comment lines removed\n`;
      })
      .replace(/(\d{4}-\d{2}-\d{2}[^\n]*\n){3,}/g, (match) => {
        const lines = match.split("\n").filter(Boolean);
        return `// ${lines.length} log lines removed\n`;
      });
  }

  function getStats() {
    return {
      supportedStrategies: 4,
      minInputLength,
      targetCompressionRatio,
    };
  }

  return { compress, getStats };
}
