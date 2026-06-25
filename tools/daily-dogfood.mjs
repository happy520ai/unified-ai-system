#!/usr/bin/env node
/**
 * daily-dogfood.mjs — 每日 dogfooding 日志工具
 *
 * 用法:
 *   node tools/daily-dogfood.mjs "你的问题"
 *   node tools/daily-dogfood.mjs --log          查看今日日志
 *   node tools/daily-dogfood.mjs --week         查看本周统计
 *   node tools/daily-dogfood.mjs --export       导出本周日志为 markdown
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const logDir = resolve(repoRoot, ".dogfood");
if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

const GATEWAY_URL = process.env.AI_GATEWAY_URL ?? "http://127.0.0.1:3100";
const args = process.argv.slice(2);

// ── 命令分发 ──
if (args[0] === "--log") {
  showTodayLog();
} else if (args[0] === "--week") {
  showWeekStats();
} else if (args[0] === "--export") {
  exportWeekMarkdown();
} else if (args.length > 0) {
  await sendChat(args.join(" "));
} else {
  console.log(`
🐕 AI Gateway 每日 Dogfooding 工具

用法:
  node tools/daily-dogfood.mjs "你的问题"     发送真实对话并记录
  node tools/daily-dogfood.mjs --log          查看今日日志
  node tools/daily-dogfood.mjs --week         查看本周统计
  node tools/daily-dogfood.mjs --export       导出本周日志为 markdown

环境变量:
  AI_GATEWAY_URL    Gateway 地址 (默认 http://127.0.0.1:3100)
`);
}

// ── 发送对话并记录 ──
async function sendChat(prompt) {
  const startedAt = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const logFile = resolve(logDir, `${today}.jsonl`);

  try {
    const resp = await fetch(`${GATEWAY_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(60000),
    });

    const data = await resp.json();
    const latencyMs = Date.now() - startedAt;

    const entry = {
      timestamp: new Date().toISOString(),
      prompt: prompt.slice(0, 200),
      responsePreview: (data.data?.text ?? data.message ?? "").slice(0, 200),
      model: data.data?.model ?? null,
      provider: data.data?.provider ?? null,
      tokens: data.data?.usage?.totalTokens ?? 0,
      latencyMs,
      success: data.success ?? false,
      code: data.code ?? null,
    };

    appendFileSync(logFile, JSON.stringify(entry) + "\n");

    // 打印结果
    if (entry.success) {
      console.log(`\n✅ ${entry.model} | ${entry.tokens} tokens | ${entry.latencyMs}ms`);
      console.log(`💬 ${entry.responsePreview}\n`);
    } else {
      console.log(`\n❌ ${entry.code} | ${entry.latencyMs}ms`);
      console.log(`💬 ${entry.responsePreview}\n`);
    }
  } catch (err) {
    const entry = {
      timestamp: new Date().toISOString(),
      prompt: prompt.slice(0, 200),
      responsePreview: err.message,
      model: null,
      provider: null,
      tokens: 0,
      latencyMs: Date.now() - startedAt,
      success: false,
      code: "NETWORK_ERROR",
    };
    appendFileSync(logFile, JSON.stringify(entry) + "\n");
    console.log(`\n❌ ${err.message}\n`);
  }
}

// ── 查看今日日志 ──
function showTodayLog() {
  const today = new Date().toISOString().slice(0, 10);
  const logFile = resolve(logDir, `${today}.jsonl`);

  if (!existsSync(logFile)) {
    console.log(`📭 今日 (${today}) 无记录`);
    return;
  }

  const lines = readFileSync(logFile, "utf8").split("\n").filter(Boolean);
  console.log(`\n📅 ${today} — ${lines.length} 条记录\n`);

  for (const line of lines) {
    const e = JSON.parse(line);
    const icon = e.success ? "✅" : "❌";
    const time = e.timestamp.slice(11, 19);
    console.log(`${icon} ${time} | ${e.model ?? "N/A"} | ${e.tokens}t | ${e.latencyMs}ms`);
    console.log(`   Q: ${e.prompt}`);
    console.log(`   A: ${e.responsePreview.slice(0, 80)}...`);
    console.log();
  }
}

// ── 查看本周统计 ──
function showWeekStats() {
  const files = getWeekFiles();
  if (files.length === 0) {
    console.log("📭 本周无记录");
    return;
  }

  let totalRequests = 0;
  let successCount = 0;
  let totalTokens = 0;
  let totalLatency = 0;
  const byModel = {};
  const byDay = {};

  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
    const day = file.split(/[\\/]/).pop().replace(".jsonl", "");

    for (const line of lines) {
      const e = JSON.parse(line);
      totalRequests++;
      if (e.success) successCount++;
      totalTokens += e.tokens ?? 0;
      totalLatency += e.latencyMs ?? 0;

      const model = e.model ?? "unknown";
      byModel[model] = (byModel[model] ?? 0) + 1;

      byDay[day] = (byDay[day] ?? 0) + 1;
    }
  }

  console.log(`
📊 本周 Dogfooding 统计
═══════════════════════════════════════
总请求数:     ${totalRequests}
成功数:       ${successCount}
成功率:       ${totalRequests > 0 ? ((successCount / totalRequests) * 100).toFixed(1) : 0}%
总 Token:     ${totalTokens}
平均延迟:     ${totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0}ms

按模型:
${Object.entries(byModel).map(([m, c]) => `  ${m}: ${c} 次`).join("\n")}

按日期:
${Object.entries(byDay).map(([d, c]) => `  ${d}: ${c} 次`).join("\n")}
═══════════════════════════════════════
`);
}

// ── 导出本周日志为 markdown ──
function exportWeekMarkdown() {
  const files = getWeekFiles();
  if (files.length === 0) {
    console.log("📭 本周无记录");
    return;
  }

  const lines = ["# Dogfooding 周报\n"];
  lines.push(`生成时间: ${new Date().toISOString()}\n`);

  for (const file of files) {
    const day = file.split(/[\\/]/).pop().replace(".jsonl", "");
    const entries = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

    lines.push(`\n## ${day}\n`);
    lines.push("| 时间 | 模型 | Token | 延迟 | 成功 | 问题 | 回答预览 |");
    lines.push("|------|------|-------|------|------|------|----------|");

    for (const e of entries) {
      const time = e.timestamp.slice(11, 19);
      const icon = e.success ? "✅" : "❌";
      lines.push(`| ${time} | ${e.model ?? "N/A"} | ${e.tokens} | ${e.latencyMs}ms | ${icon} | ${e.prompt.slice(0, 40)} | ${e.responsePreview.slice(0, 60)} |`);
    }
  }

  const md = lines.join("\n");
  const outPath = resolve(logDir, `week-${new Date().toISOString().slice(0, 10)}.md`);
  writeFileSync(outPath, md);
  console.log(`📝 已导出到 ${outPath}`);
}

// ── 获取本周日志文件 ──
function getWeekFiles() {
  const now = new Date();
  const files = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    const file = resolve(logDir, `${day}.jsonl`);
    if (existsSync(file)) files.push(file);
  }
  return files.sort();
}
