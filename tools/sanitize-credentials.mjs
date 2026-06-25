#!/usr/bin/env node
// =============================================================================
// sanitize-credentials.mjs — 自动化密钥清理脚本
// 扫描配置文件中的硬编码 API Key，替换为环境变量占位符
// 用法: node tools/sanitize-credentials.mjs [--dry-run]
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");

// API Key 模式匹配
const KEY_PATTERNS = [
  { type: "mimo",       regex: /\b(tp-[A-Za-z0-9_-]{20,})\b/g, envVar: "MIMO_API_KEY" },
  { type: "nvidia",     regex: /\b(nvapi-[A-Za-z0-9_-]{12,})\b/g, envVar: "NVIDIA_API_KEY" },
  { type: "openai",     regex: /\b(sk-[A-Za-z0-9_-]{20,})\b/g, envVar: "OPENAI_API_KEY" },
  { type: "gemini",     regex: /\b(AIza[0-9A-Za-z_-]{20,})\b/g, envVar: "GOOGLE_API_KEY" },
  { type: "zhipu",      regex: /\b([a-f0-9]{32}\.[a-zA-Z0-9]{20,})\b/g, envVar: "ZHIPU_API_KEY" },
  { type: "siliconflow", regex: /\b(sk-[a-zA-Z0-9]{40,})\b/g, envVar: "SILICONFLOW_API_KEY" },
  { type: "generic",    regex: /("(?:apiKey|api_key|API_KEY)":\s*")([^"]{16,})(")/g, envVar: null },
];

// 扫描目标文件
const SCAN_FILES = [
  "providers-config.json",
  ".env.example",
  ".env.enterprise.example",
];

// 安全占位符（跳过）
const SAFE_MARKERS = [
  "your-", "your_", "example", "placeholder", "dummy", "fake",
  "mock", "test", "phase", "****", "<", ">", "REPLACE",
  "${", "process.env", "env.",
];

function isSafeValue(value) {
  const lower = value.toLowerCase();
  return SAFE_MARKERS.some((m) => lower.includes(m));
}

function sanitizeFile(filePath) {
  if (!existsSync(filePath)) return { file: filePath, status: "not_found" };

  let content = readFileSync(filePath, "utf8");
  let replacements = 0;
  const details = [];

  for (const pattern of KEY_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      const value = match[1] ?? match[2] ?? match[0];
      if (isSafeValue(value)) continue;

      const envVar = pattern.envVar ?? `${pattern.type.toUpperCase()}_API_KEY`;
      const placeholder = `\${${envVar}}`;

      // 替换为环境变量占位符
      if (content.includes(value)) {
        content = content.split(value).join(placeholder);
        replacements++;
        details.push({ type: pattern.type, masked: `${value.slice(0, 8)}****${value.slice(-4)}`, envVar });
      }
    }
  }

  if (replacements > 0 && !dryRun) {
    writeFileSync(filePath, content, "utf8");
  }

  return { file: filePath, status: replacements > 0 ? "sanitized" : "clean", replacements, details };
}

// 执行扫描
console.log(`\n🔑 密钥清理${dryRun ? " (DRY RUN)" : ""}\n`);

let totalReplacements = 0;
const results = [];

for (const file of SCAN_FILES) {
  const filePath = resolve(repoRoot, file);
  const result = sanitizeFile(filePath);
  results.push(result);

  if (result.replacements > 0) {
    totalReplacements += result.replacements;
    console.log(`  ${dryRun ? "⚠️" : "✅"} ${file}: ${result.replacements} 个密钥${dryRun ? "将被" : "已"}替换`);
    for (const d of result.details) {
      console.log(`    ${d.type}: ${d.masked} → \${${d.envVar}}`);
    }
  } else if (result.status === "not_found") {
    console.log(`  ⬜ ${file}: 文件不存在`);
  } else {
    console.log(`  ✅ ${file}: 无需清理`);
  }
}

// 生成 .env 模板
const envVars = new Set();
for (const result of results) {
  for (const d of result.details ?? []) {
    envVars.add(`${d.envVar}=`);
  }
}

if (envVars.size > 0) {
  const envTemplate = `\n# === 自动生成的环境变量模板 ===\n# 请填入实际的 API Key\n${[...envVars].sort().join("\n")}\n`;
  console.log(`\n📋 需要配置的环境变量:\n${envTemplate}`);

  if (!dryRun) {
    const envPath = resolve(repoRoot, ".env.generated");
    const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
    writeFileSync(envPath, existing + envTemplate, "utf8");
    console.log(`  已追加到 .env.generated`);
  }
}

console.log(`\n📊 总计: ${totalReplacements} 个密钥${dryRun ? "待" : "已"}清理\n`);

if (dryRun && totalReplacements > 0) {
  console.log(`💡 运行不带 --dry-run 参数以实际执行清理：\n   node tools/sanitize-credentials.mjs\n`);
}
