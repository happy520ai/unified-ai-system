// One measured figure is written down in several places that are revised at different times: a page's
// own <meta name="description">, its og:description, its JSON-LD description, and the docs/llms.txt
// bullet that summarizes it for assistants. Tonight's stale copy was exactly that shape - a Chinese
// description reading 6,391-8,461 ms beside an og that said 8,914 ms, and an llms.txt line still
// quoting batch A's 7,630-8,461 ms after the pooled 23-boot measurement had replaced it.
//
// A "does this number still appear on the page" test cannot see this: batch rows in the BODY
// legitimately keep their own older endpoints and must stay. So this compares only the HEADLINE
// interval of each surface, taken as the widest range that surface states, and requires them to agree.
//
// Run: node tools/check-summary-ranges.mjs [--json]
// Exit: 0 consistent | 2 a surface headlines a superseded figure | 3 unreadable input | 4 the tool
// itself refuses to guess what to compare

import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// 到 is the separator the Chinese pages write their ranges with. Omitting it would silently exempt
// every zh surface from this check - it reads as "no range quoted", which is a skip, not a pass.
// The unit is followed by a lookahead, not \b: \b is defined over ASCII word characters, so after 秒
// it demands a word character and never matches the CJK text that follows in the real pages.
const RANGE_RE = /(\d[\d,]*(?:\.\d+)?)\s*[-–〜至到]{1,2}\s*(\d[\d,]*(?:\.\d+)?)\s*(ms|毫秒|s|秒)(?![a-z0-9])/giu;
const TO_MS = { ms: 1, 毫秒: 1, s: 1000, 秒: 1000 };

function normalize(low, high, unit) {
  const clean = (n) => String(n).replace(/,/gu, "");
  return `${clean(low)}-${clean(high)}${unit === "毫秒" ? "ms" : unit === "秒" ? "s" : unit}`;
}

export function rangesIn(text) {
  const found = [];
  for (const m of String(text ?? "").matchAll(RANGE_RE)) {
    const low = Number(m[1].replace(/,/gu, ""));
    const high = Number(m[2].replace(/,/gu, ""));
    if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) continue;
    found.push({ norm: normalize(m[1], m[2], m[3].toLowerCase()), ms: high * (TO_MS[m[3].toLowerCase()] ?? 1) });
  }
  return found;
}

// The headline is the widest interval a surface states, in milliseconds, so "6.4-8.9 s" and
// "6,391-8,914 ms" both outrank a "3-7 ms" side note on the same line.
export function headlineOf(text) {
  const found = rangesIn(text);
  if (found.length === 0) return null;
  return found.reduce((a, b) => (b.ms > a.ms ? b : a)).norm;
}

export function metaContent(html, attr) {
  const re = new RegExp(`<meta[^>]+(?:name|property)="${attr}"[^>]*content="([^"]*)"`, "iu");
  const m = html.match(re);
  return m ? m[1] : null;
}

export function jsonLdDescription(html) {
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/giu)];
  for (const b of blocks) {
    try {
      const data = JSON.parse(b[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item && typeof item.description === "string") return item.description;
      }
    } catch {
      return null;
    }
  }
  return null;
}

// llms.txt is one bullet per article, keyed by the page's URL fragment. Matching the whole line rather
// than a fragment of it matters: a bullet can hold two ranges (headline plus side note) and only the
// widest one should be compared.
export function llmsBullet(llmsText, urlFragment) {
  const line = String(llmsText ?? "").split("\n").find((l) => l.includes(`/${urlFragment}`));
  return line ?? null;
}

export function surfaceHeadlines({ pageHtml, llmsText, urlFragment }) {
  const surfaces = [
    { label: "og:description", role: "reference", text: metaContent(pageHtml, "og:description") },
    { label: "name=description", role: "compare", text: metaContent(pageHtml, "description") },
    { label: "json-ld description", role: "compare", text: jsonLdDescription(pageHtml) },
    { label: `llms.txt bullet (${urlFragment})`, role: "compare", text: llmsBullet(llmsText, urlFragment) },
  ];
  return surfaces.map((s) => ({ ...s, headline: s.text === null ? "unreadable" : (headlineOf(s.text) ?? "none") }));
}

export function compareSurfaces(rows) {
  const reference = rows.find((r) => r.role === "reference");
  if (!reference) return { problems: ["no reference surface declared"], evaluated: 0 };
  if (reference.headline === "unreadable") {
    return { problems: [`the reference ${reference.label} could not be read, so nothing was compared`], evaluated: 0 };
  }
  if (reference.headline === "none") return { problems: [], evaluated: 0, note: "the reference states no measurable range" };
  const problems = [];
  let evaluated = 0;
  for (const row of rows.filter((r) => r.role === "compare")) {
    if (row.headline === "none") continue; // a surface that quotes no range is not judged
    evaluated += 1;
    if (row.headline === "unreadable") {
      problems.push(`${row.label}: unreadable, so the ${reference.headline} headline could not be checked against it`);
      continue;
    }
    if (row.headline !== reference.headline) {
      problems.push(`${row.label} headlines ${row.headline} while ${reference.label} states ${reference.headline}`);
    }
  }
  return { problems, evaluated, headline: reference.headline };
}

const PAIRS = [
  { file: "docs/mcp-startup-timeouts.html", urlFragment: "mcp-startup-timeouts.html" },
  { file: "docs/mcp-startup-timeouts.zh-CN.html", urlFragment: "mcp-startup-timeouts.zh-CN.html" },
];

export function run({ repoRoot = process.cwd(), pairs = PAIRS } = {}) {
  const llmsPath = `${repoRoot}/docs/llms.txt`;
  if (!existsSync(llmsPath)) return { verdict: "input-unreadable", problems: [`missing ${llmsPath}`], surfaces: [] };
  const llmsText = readFileSync(llmsPath, "utf8");
  const problems = [];
  const surfaces = [];
  let evaluated = 0;
  for (const pair of pairs) {
    const path = `${repoRoot}/${pair.file}`;
    if (!existsSync(path)) {
      problems.push(`${pair.file}: missing, so its summaries were not compared`);
      continue;
    }
    const rows = surfaceHeadlines({ pageHtml: readFileSync(path, "utf8"), llmsText, urlFragment: pair.urlFragment });
    const res = compareSurfaces(rows);
    evaluated += res.evaluated;
    problems.push(...res.problems.map((p) => `${pair.urlFragment}: ${p}`));
    surfaces.push({ page: pair.file, headline: res.headline ?? null, rows });
  }
  const bulletCount = llmsText.split("\n").filter((l) => l.trimStart().startsWith("- [")).length;
  return {
    verdict: problems.length ? "MISMATCH" : "consistent",
    problems,
    evaluated,
    surfaces,
    measured_at: new Date().toISOString(),
    method: "widest interval per surface compared to that page's og:description; body batch rows are out of scope on purpose",
    denominators: { surfaces_compared_and_judged: evaluated, pages: pairs.length, llms_bullets_total: bulletCount },
  };
}

// Reads the real files only when run directly: a check that executes at import time cannot be tested
// without also calling process.exit from inside the test.
const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const out = run();
  console.log(JSON.stringify(out, null, 2));
  const unknown = process.argv.slice(3).filter((a) => a !== "--json");
  if (unknown.length) {
    console.error(`REFUSED: unknown argument ${unknown.join(" ")}`);
    process.exit(4);
  }
  // Three states, not two: "nothing was judged" must not read as clean, and must not read as a mismatch
  // either, because an empty denominator means this tool is blind rather than that the pages agree.
  process.exit(out.problems.length === 0 ? 0 : out.denominators.surfaces_compared_and_judged === 0 ? 3 : 2);
}
