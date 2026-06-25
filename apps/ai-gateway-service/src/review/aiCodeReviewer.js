// =============================================================================
// aiCodeReviewer.js — AI 代码审查引擎
// 自动代码审查、问题检测、改进建议
// =============================================================================

export function createAiCodeReviewer(options = {}) {
  const rules = new Map();

  // 内置审查规则
  const BUILTIN_RULES = {
    security: [
      { id: "hardcoded_secret", name: "硬编码密钥", pattern: /(api_key|secret|password|token)\s*=\s*['"][^'"]{8,}/i, severity: "critical" },
      { id: "sql_injection", name: "SQL 注入", pattern: /query\([^)]*\+[^)]*\)/, severity: "critical" },
      { id: "eval_usage", name: "eval 使用", pattern: /\beval\s*\(/, severity: "high" },
      { id: "exec_usage", name: "exec 使用", pattern: /\bexec\s*\(/, severity: "high" },
    ],
    quality: [
      { id: "long_function", name: "函数过长", check: (code) => code.split("\n").length > 100, severity: "medium" },
      { id: "deep_nesting", name: "嵌套过深", check: (code) => { let d = 0, m = 0; for (const c of code) { if (c === "{") { d++; m = Math.max(m, d); } if (c === "}") d--; } return m > 5; }, severity: "medium" },
      { id: "todo_fixme", name: "TODO/FIXME", pattern: /\/\/\s*(TODO|FIXME|HACK|XXX)/i, severity: "low" },
      { id: "console_log", name: "console.log", pattern: /console\.(log|debug|info)\(/, severity: "low" },
    ],
    performance: [
      { id: "sync_read", name: "同步文件读取", pattern: /readFileSync|writeFileSync/, severity: "medium" },
      { id: "n_plus_1", name: "N+1 查询", pattern: /for.*await.*query|forEach.*await/, severity: "high" },
      { id: "large_array", name: "大数组操作", pattern: /\.sort\(\)|\.filter\(.*\.map\(/, severity: "low" },
    ],
  };

  function reviewCode(code, options = {}) {
    const findings = [];
    const category = options.category ?? "all";
    const rulesToCheck = category === "all"
      ? Object.values(BUILTIN_RULES).flat()
      : BUILTIN_RULES[category] ?? [];

    for (const rule of rulesToCheck) {
      if (rule.pattern) {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        const lines = code.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            findings.push({
              rule: rule.id,
              name: rule.name,
              severity: rule.severity,
              line: i + 1,
              code: lines[i].trim().slice(0, 100),
              suggestion: getSuggestion(rule.id),
            });
          }
        }
      }
      if (rule.check && rule.check(code)) {
        findings.push({
          rule: rule.id,
          name: rule.name,
          severity: rule.severity,
          line: null,
          suggestion: getSuggestion(rule.id),
        });
      }
    }

    // 自定义规则
    for (const [id, custom] of rules) {
      if (custom.pattern) {
        const regex = new RegExp(custom.pattern.source, custom.pattern.flags);
        if (regex.test(code)) {
          findings.push({ rule: id, name: custom.name, severity: custom.severity, line: null });
        }
      }
    }

    const critical = findings.filter((f) => f.severity === "critical").length;
    const high = findings.filter((f) => f.severity === "high").length;
    const score = Math.max(0, 100 - critical * 25 - high * 10 - findings.length * 2);

    return {
      score,
      totalFindings: findings.length,
      critical,
      high,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
      findings,
      passed: critical === 0 && high === 0,
    };
  }

  function getSuggestion(ruleId) {
    const suggestions = {
      hardcoded_secret: "使用环境变量或密钥管理服务",
      sql_injection: "使用参数化查询",
      eval_usage: "避免使用 eval，使用安全的替代方案",
      exec_usage: "避免使用 exec，使用安全的替代方案",
      long_function: "将函数拆分为更小的函数",
      deep_nesting: "使用早返回或提取子函数减少嵌套",
      todo_fixme: "处理 TODO/FIXME 或创建 Issue",
      console_log: "使用结构化日志替代 console.log",
      sync_read: "使用异步版本 (readFile/writeFile)",
      n_plus_1: "使用批量查询或 JOIN",
    };
    return suggestions[ruleId] ?? "检查并修复此问题";
  }

  function addRule(id, rule) {
    rules.set(id, rule);
  }

  function getStats() {
    return {
      builtinRules: Object.values(BUILTIN_RULES).flat().length,
      customRules: rules.size,
      categories: Object.keys(BUILTIN_RULES),
    };
  }

  return { reviewCode, addRule, getStats };
}
