// Renders docs/mcp-ecosystem-measurements.zh-CN.html from the machine-readable dataset.
//
// Why generated: the Chinese twin of the evidence hub would otherwise be a hand-typed copy of numbers
// that have already drifted once in this repository's own prose. Every count on the page is read from the
// dataset, and the page refuses to render if any block's tally does not sum to its own rows, or if a
// block cannot say which protocol revision it asked with.
//
// Usage: node tools/render-mcp-hub-zh.mjs [--dataset <file>] [--out <file>]
import { readFileSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i > 0 && typeof process.argv[i + 1] === "string" ? process.argv[i + 1] : dflt;
};
const DATASET = arg("--dataset", "docs/data/mcp-ecosystem-measurements.2026-09-28.json");
const OUT = arg("--out", "docs/mcp-ecosystem-measurements.zh-CN.html");
const BASE = "https://happy520ai.github.io/unified-ai-system/";

// Prose labels only: nothing here may carry a number.
const LABELS = {
  "tools-list-pagination": { q: "tools/list 会不会分页？", art: "mcp-tools-list-pagination-survey.md" },
  "protocol-revision-tolerance": { q: "服务端会不会答应一个根本不存在的协议版本？", art: "mcp-protocol-revision-tolerance.md" },
  "session-enforcement": { q: "发出 session id 的服务端，会不会要求客户端带回来？", art: "mcp-session-enforcement.md" },
  "server-discover-support": { q: "有人实现 server/discover 吗？", art: "mcp-ecosystem-measurements.html" },
  "instructions-field": { q: "服务端写的 instructions 长文本会送到匿名客户端吗？", art: "mcp-ecosystem-measurements.html" },
  "protocol-version-header": { q: "有人真的强制 MCP-Protocol-Version 头吗？", art: "mcp-protocol-version-header.md" },
  "route-headers": { q: "Mcp-Method / Mcp-Name 头能把请求改道到正文没写的方法吗？", art: "mcp-route-headers.md" },
  "get-stream-headers": { q: "没有正文的 GET 事件流，带不带这个头有区别吗？", art: "mcp-route-headers.md" },
  "cache-hints-legacy-leg": { q: "在【不要求】缓存提示的那个修订下，有人声明吗？", art: "mcp-list-cache-hints.md" },
  "cache-hints-modern-leg": { q: "在【要求】缓存提示的那个修订下，接受了该修订的服务端声明了吗？", art: "mcp-list-cache-hints.md" },
};

const doc = JSON.parse(readFileSync(DATASET, "utf8"));
const blocks = Array.isArray(doc.questions) ? doc.questions : [];
if (blocks.length === 0) throw new Error("dataset has no questions");
const problems = [];
for (const b of blocks) {
  if (!LABELS[b.id]) problems.push(`no Chinese label for question id ${b.id}`);
  if (typeof b.asked_with !== "string" || !b.asked_with) problems.push(`${b.id}: asked_with missing`);
  if (!Array.isArray(b.rows) || b.rows.length === 0) problems.push(`${b.id}: no rows`);
  if (!b.row_label_field) problems.push(`${b.id}: no row_label_field, cannot recount from rows`);
  // The counts on this page come from the rows, never from a pre-chewed summary: one survey's
  // `verdicts` is a mixed object (numeric labels plus per-server arrays), so treating it as a tally
  // would either refuse a valid dataset or print a number that does not describe the sample.
  const recount = {};
  for (const r of b.rows) {
    const key = String(r?.[b.row_label_field] ?? "(missing label)");
    recount[key] = (recount[key] || 0) + 1;
  }
  b.__counts = recount;
  const numericOnly = b.verdicts && typeof b.verdicts === "object"
    && Object.values(b.verdicts).every((v) => typeof v === "number");
  if (numericOnly) {
    const diverging = Object.keys({ ...recount, ...b.verdicts })
      .filter((k) => (recount[k] || 0) !== (b.verdicts[k] || 0));
    if (diverging.length) problems.push(`${b.id}: verdicts disagree with rows on ${diverging.join(",")}`);
  }
}
if (problems.length) { console.error(`REFUSED:\n${problems.join("\n")}`); process.exit(1); }

const topVerdict = (b) => {
  const entries = Object.entries(b.__counts).sort((x, y) => y[1] - x[1]);
  const nonAuth = entries.find(([k]) => k !== "auth_required") ?? entries[0];
  const auth = b.__counts.auth_required ?? 0;
  return `${nonAuth[0]} = ${nonAuth[1]}`
    + (auth ? `，另有 auth_required = ${auth}` : "")
    + `（共 ${b.rows.length}）`;
};

const rows = blocks.map((b) => {
  const L = LABELS[b.id];
  return `        <tr>\n`
    + `          <td><a href="${L.art}">${L.q}</a></td>\n`
    + `          <td><code>${b.asked_with}</code></td>\n`
    + `          <td>${topVerdict(b)}</td>\n`
    + `          <td><code>${b.attempted}</code></td>\n`
    + `        </tr>`;
}).join("\n");

const window = String(doc.generated_at_start_utc ?? "").slice(0, 10);
const out = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>对公开 MCP 生态的测量（中文索引） | Unified AI System</title>
    <meta name="description" content="向官方注册表登记的 ${blocks[0].attempted} 个服务端匿名提问，共 ${blocks.length} 个问题。每个数字都从机器可读数据集生成，页面自己声明分母与所请求的协议修订。" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${BASE}mcp-ecosystem-measurements.zh-CN.html" />
    <link rel="alternate" hreflang="en" href="${BASE}mcp-ecosystem-measurements.html" />
    <link rel="alternate" hreflang="zh-CN" href="${BASE}mcp-ecosystem-measurements.zh-CN.html" />
    <link rel="alternate" hreflang="x-default" href="${BASE}mcp-ecosystem-measurements.html" />
    <link rel="stylesheet" href="site.css" />
    <meta property="og:type" content="article" />
    <meta property="og:locale" content="zh_CN" />
    <meta property="og:title" content="对公开 MCP 生态的测量（中文索引）" />
    <meta property="og:description" content="同一个问题清单的中文索引：${blocks.length} 个条目、每题一行，数字全部来自数据集。" />
  </head>
  <body>
    <main>
      <h1>对公开 MCP 生态的测量（中文索引）</h1>
      <p class="lede">
        这一页是英文测量 hub <a href="mcp-ecosystem-measurements.html">Nine measurements of the public MCP ecosystem</a> 的中文索引。
        它不新增任何数字：下面每一行都由机器可读数据集生成，
        因此「正文与表格各自漂移」这个我们已经在自己身上犯过多次的错，在这页上不可能发生。
      </p>
      <p>
        采样：官方 MCP Registry 默认顺序的前 ${blocks[0].attempted} 个 streamable-http 端点，匿名提问，
        运行窗口 ${window}。注册表默认顺序按标识符排序，因此样本偏向以 a 开头的名字；
        多少端点直接不接受匿名客户端，写在下面每一行的分母里。
      </p>
      <table class="numbers-table">
        <thead>
          <tr>
            <th scope="col">问题（点开看英文原文与脚本）</th>
            <th scope="col">请求的协议修订</th>
            <th scope="col">最多数的判据（/ 该题样本）</th>
            <th scope="col">尝试端点数</th>
          </tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>
      <p>
        机器可读数据（含逐端点判据行）：<a href="data/mcp-ecosystem-measurements.2026-09-28.json">十题重跑，${window}</a>；
        英文原文与可重跑脚本：<a href="mcp-ecosystem-measurements.html">Nine measurements of the public MCP ecosystem</a>。
        每份调查都是双次采样同一窗口：把 <code>ttlMs</code> 与 <code>cacheScope</code> 那题在两个协议修订下各问一遍，
        所以「没人声明」这句话必须配上「问的是哪个修订」才有意义。
      </p>
      <p>
        本页由 <code>tools/render-mcp-hub-zh.mjs</code> 生成；它在任一题的 tally 与行数不等、或缺少所请求修订时
        直接拒绝写出。
      </p>
    </main>
  </body>
</html>
`;
writeFileSync(OUT, out);
console.log(`WROTE ${OUT} bytes=${out.length} questions=${blocks.length} window=${window}`);
