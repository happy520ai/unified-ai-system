#!/usr/bin/env node
/**
 * product-scout.mjs — AI 选品参谋
 *
 * 用法:
 *   node tools/product-scout.mjs "便携式榨汁机 39.9元 月销2万+"
 *   node tools/product-scout.mjs --history
 *   node tools/product-scout.mjs --stats
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DATA_DIR = resolve(ROOT, ".data/product-scout");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const HISTORY_FILE = resolve(DATA_DIR, "history.jsonl");
const STATS_FILE = resolve(DATA_DIR, "stats.json");

const GATEWAY_URL = process.env.AI_GATEWAY_URL ?? "http://127.0.0.1:3100";
const PROVIDER = process.env.SCOUT_PROVIDER ?? "siliconflow";

const args = process.argv.slice(2);

// ── 选品 Prompt 模板 ──
const SCOUT_PROMPT = `你是一个资深电商选品分析师。用户会给你一个商品信息（标题、价格、销量等），你需要在30秒内给出一份结构化的选品参谋报告。

请严格按照以下格式输出，不要添加额外内容：

═══ 选品参谋报告 ═══
商品: [简短商品名]
平台价: ¥[价格] / 月销[销量]

📊 选品评分: [0-100]/100

评分标准:
- 需求刚性 (0-20分): 是否刚需/高频
- 竞争程度 (0-20分): 竞品数量、价格战激烈程度
- 利润空间 (0-20分): 预估利润率
- 差异化空间 (0-20分): 能否做出差异化
- 试错成本 (0-20分): 客单价高低、退货风险

✅ 优势:
- [优势1]
- [优势2]
- [优势3]

⚠️ 风险:
- [风险1]
- [风险2]
- [风险3]

💡 建议:
- 差异化方向: [具体建议]
- 测试进货量: [建议数量]
- 1688 找货关键词: [关键词] 预估进货价 ¥[价格]
- 定价策略: [建议]

🎯 综合判断: [一句话结论]
═════════════════

注意:
1. 评分要客观，不要虚高。50分以下不建议做，60-70分可小批量测试，70分以上值得重点考虑。
2. 如果信息不足，给出初步判断并说明需要补充什么信息。
3. 利润空间要扣除平台费(约5%)、物流(约3-5元)、退换货(约5-10%)。
4. 价格战程度要基于品类实际情况判断。

用户输入的商品信息:`;

// ── 命令分发 ──
if (args[0] === "--history") {
  showHistory();
} else if (args[0] === "--stats") {
  showStats();
} else if (args[0] === "--help" || args.length === 0) {
  showHelp();
} else {
  await analyzeProduct(args.join(" "));
}

function showHelp() {
  console.log(`
🔍 AI 选品参谋

用法:
  node tools/product-scout.mjs "便携式榨汁机 39.9元 月销2万+"
  node tools/product-scout.mjs --history
  node tools/product-scout.mjs --stats

环境变量:
  AI_GATEWAY_URL    Gateway 地址 (默认 http://127.0.0.1:3100)
  SCOUT_PROVIDER    使用的 Provider (默认 siliconflow)
`);
}

// ── 分析商品 ──
async function analyzeProduct(input) {
  console.log("\n🔍 正在分析商品...\n");

  const startTime = Date.now();

  try {
    const resp = await fetch(`${GATEWAY_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: SCOUT_PROMPT + "\n" + input,
        providerId: PROVIDER,
      }),
      signal: AbortSignal.timeout(60000),
    });

    const data = await resp.json();
    const duration = Date.now() - startTime;

    if (!data.success) {
      console.log("❌ 分析失败:", data.error?.message ?? data.error?.code);
      return;
    }

    const report = data.data?.text ?? "";
    console.log(report);
    console.log(`\n⏱️  分析耗时: ${(duration / 1000).toFixed(1)}s | Provider: ${data.data?.provider ?? PROVIDER} | Model: ${data.data?.model ?? "unknown"}`);

    // 提取评分
    const scoreMatch = report.match(/选品评分:\s*(\d+)/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : null;

    // 保存历史
    const record = {
      timestamp: new Date().toISOString(),
      input: input.slice(0, 200),
      score,
      provider: data.data?.provider,
      model: data.data?.model,
      durationMs: duration,
      report: report.slice(0, 2000),
    };
    appendFileSync(HISTORY_FILE, JSON.stringify(record) + "\n");

    console.log("\n✅ 已保存到历史记录");
  } catch (err) {
    console.log("❌ 请求失败:", err.message);
  }
}

// ── 查看历史 ──
function showHistory() {
  if (!existsSync(HISTORY_FILE)) {
    console.log("📭 暂无历史记录");
    return;
  }

  const lines = readFileSync(HISTORY_FILE, "utf8").split("\n").filter(Boolean);
  console.log(`\n📋 选品历史 (共 ${lines.length} 条)\n`);

  for (const line of lines) {
    const r = JSON.parse(line);
    const time = r.timestamp.slice(0, 16).replace("T", " ");
    const score = r.score !== null ? `${r.score}分` : "未提取";
    console.log(`  ${time} | ${score} | ${r.input.slice(0, 50)}`);
  }
}

// ── 统计 ──
function showStats() {
  if (!existsSync(HISTORY_FILE)) {
    console.log("📭 暂无历史记录");
    return;
  }

  const lines = readFileSync(HISTORY_FILE, "utf8").split("\n").filter(Boolean);
  const records = lines.map((l) => JSON.parse(l));

  const scores = records.filter((r) => r.score !== null).map((r) => r.score);
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "N/A";
  const highScore = scores.filter((s) => s >= 70).length;
  const midScore = scores.filter((s) => s >= 50 && s < 70).length;
  const lowScore = scores.filter((s) => s < 50).length;

  console.log(`
📊 选品统计
═══════════════════════════════
总分析次数: ${records.length}
平均评分: ${avgScore}
高分品 (≥70): ${highScore} 个
中等品 (50-69): ${midScore} 个
低分品 (<50): ${lowScore} 个
═══════════════════════════════
`);
}
