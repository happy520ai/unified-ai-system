// Are the carriers that already merged us still showing us, and are they showing us in the catalogue or
// in a holding file?
//
// Why this exists: three things went wrong when this was answered by hand. A merged pull request was read as
// a published listing (in one carrier the maintainer routed our entry into `WATCHLIST.md`, not the
// catalogue, so the merge was real and the listing was not). A repo's default branch was guessed as `main`
// and a 404 was read as absence (both branches exist in one of these repos, and absence from a URL that
// never resolves is blindness). And the count itself drifted under-stated in our own FAQ while PRs merged
// without anyone re-checking. This makes the question a command.
//
//   node tools/check-carrier-presence.mjs                 # prints a table + CARRIER_SUMMARY line
//   node tools/check-carrier-presence.mjs --require-clean # exit 2 if anything is absent or unreadable
//
// Verdicts per carrier, and the rule behind them:
//   LISTED       our marker found in a file whose kind is "catalog"
//   WATCHLISTED  found only in a "staging" file (true, but not the placement we asked for)
//   ABSENT       every candidate file was read successfully and held a populated list, and none has us
//   UNREADABLE   a fetch failed or a list looked empty, so nothing is being claimed
const { pathToFileURL } = await import("node:url");
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const TIMEOUT_MS = 30000;
// A list file with fewer than this many GitHub links is treated as empty-for-the-purpose-of-absence, because
// an empty or truncated file would otherwise let "we are not in it" be read out of a page that holds nothing.
const MIN_LIST_LINKS = 5;

// kind: "catalog" is a placement a visitor can find by browsing; "staging" is a maintainer's holding file.
// paths are checked in order, and the first hit decides the verdict.
export const CARRIERS = [
  { repo: "hashgraph-online/awesome-codex-plugins", paths: [{ path: "plugins/happy520ai/unified-ai-system/skills/unified-ai-gateway/SKILL.md", kind: "catalog", self: true }] },
  { repo: "agentskillexchange/skills", paths: [{ path: "skills/unified-ai-gateway/SKILL.md", kind: "catalog", self: true }] },
  { repo: "sickn33/agentic-awesome-skills", paths: [{ path: "skills/unified-ai-gateway/SKILL.md", kind: "catalog", self: true }, { path: "README.md", kind: "catalog" }] },
  { repo: "hashgraph-online/awesome-ai-plugins", paths: [{ path: "README.md", kind: "catalog" }] },
  { repo: "alvinreal/awesome-opensource-ai", paths: [{ path: "README.md", kind: "catalog" }] },
  { repo: "TensorBlock/awesome-mcp-servers", paths: [{ path: "docs/ai--llm-integration.md", kind: "catalog" }] },
  { repo: "scadastrangelove/awesome-ai-security-tools", paths: [{ path: "README.md", kind: "catalog" }, { path: "data/sections.json", kind: "catalog" }, { path: "WATCHLIST.md", kind: "staging" }] },
  // Merged 2026-09-29T12:37:40Z by @shiftkey (up-for-grabs#6176): the entry corrects our description and
  // declares the TypeScript good-first issues. A listing that landed is only evidence while it is still there,
  // so it joins the probe set on the day it merges rather than being remembered by hand.
  { repo: "up-for-grabs/up-for-grabs.net", paths: [{ path: "_data/projects/unified-ai-system.yml", kind: "catalog" }] },
  // Merged 2026-08-19T02:42:56Z (yzfly/Awesome-MCP-ZH#442, after #422 was closed): a 7,699-star Chinese MCP
  // catalogue carrying our row in its README. It sat unnoticed for six weeks because the carrier set was
  // assembled from the pull requests anyone was still watching, and this one had already closed out - which
  // is exactly the failure this probe exists to make impossible. Found on 2026-09-29 by asking a web search
  // for our own repository name and reading what came back.
  { repo: "yzfly/Awesome-MCP-ZH", paths: [{ path: "README.md", kind: "catalog" }] },
];

export const OUR_MARKER = /happy520ai\/unified-ai-system|Unified AI System/i;
const GITHUB_LINK = /https?:\/\/github\.com\//g;

export function decide({ fetched, ourHits, listLinks, selfFile }) {
  if (fetched === 0) return { verdict: "UNREADABLE", why: "no candidate file could be read, so absence cannot be claimed" };
  if (ourHits > 0) return { verdict: null, why: "resolved by the caller from the matching file's kind" };
  const usable = selfFile || listLinks >= MIN_LIST_LINKS;
  if (!usable) return { verdict: "UNREADABLE", why: `files were read but held only ${listLinks} GitHub link(s), below the ${MIN_LIST_LINKS} needed to call an absence real` };
  return { verdict: "ABSENT", why: `${fetched} file(s) read, ${listLinks} links seen, no entry carrying our repository` };
}

async function getText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "*/*" }, redirect: "follow", signal: controller.signal });
    return { status: res.status, body: res.status === 200 ? await res.text() : "" };
  } catch {
    return { status: 0, body: "" };
  } finally {
    clearTimeout(timer);
  }
}

async function defaultBranch(repo) {
  const r = await getText(`https://api.github.com/repos/${repo}`);
  if (r.status !== 200) return null;
  try { return JSON.parse(r.body).default_branch || null; } catch { return null; }
}

// Carriers write tool counts three ways - "fifteen tool names", "9 of the fifteen", "exposes 15 tools" - so
// a word-only scan misses the digits and a digit-only scan misses the words. Both are collected and normalised
// to numbers, because the only useful question is whether the number matches our published roster.
const WORD_NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20 };
const asNumber = (token) => (/^\d+$/.test(token) ? Number(token) : (WORD_NUMBERS[token.toLowerCase()] ?? null));

// Without this gate, "has 8 stars" and "has 32 open issues" are collected as tool counts: the verbs alone
// carry no idea of what is being counted, and a roster number mixed in with a stars snapshot is a number
// that means nothing.
const ROSTER_VOCABULARY = /\b(?:tools?|names?|endpoints?)\b/i;
const COUNT_PATTERNS = [
  /\b(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\s+(?:governed\s+|model-backed\s+)?(?:MCP\s+)?tools?\b/gi,
  /\b(?:carries|has|had|exposes|declares|ships|lists)\s+(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\b/gi,
];

export function toolCountMentions(text) {
  const found = new Set();
  for (const line of String(text).split("\n")) {
    if (!ROSTER_VOCABULARY.test(line)) continue;
    for (const re of COUNT_PATTERNS) {
      for (const m of line.matchAll(re)) {
        const n = asNumber(m[1]);
        if (n !== null) found.add(n);
      }
    }
  }
  return [...found].sort((a, b) => a - b);
}

// Facts reported about a hit, never judged here: the point is to notice that a carrier still advertises an
// old pinned version or an old tool count without someone re-reading six files by hand.
export function entryFacts(text) {
  const lines = String(text).split("\n").filter((l) => OUR_MARKER.test(l));
  const joined = lines.join("\n");
  return {
    lines_with_us: lines.length,
    // Carriers write both `0.4.9` and `v0.8.0`, and the leading `v` sits inside a word boundary, so a plain
    // /\b\d+\.\d+\.\d+\b/ silently misses the pinned-current-release line - which is the one that matters.
    // Versions are normalised without the `v` so they can be compared against our published roster.
    pinned_versions: [...new Set((joined.match(/\bv?\d+\.\d+\.\d+\b/gi) || []).map((s) => s.replace(/^v/i, "")))].sort(),
    tool_count_mentions: toolCountMentions(joined),
    // A stars snapshot ages, and a carrier that writes the number out as a word ages the same way; the figure
    // is reported, never judged, because it is not a claim we control.
    star_snapshots: [...new Set(joined.match(/\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+stars\b/gi) || [])].slice(0, 4),
  };
}

// Extracted so the decision path is testable without a network: `fileResults` is what a fetch round would
// have produced, and the verdict must come out the same whether it did.
export function pickVerdict(fileResults, { listLinks, selfFile }) {
  const hit = fileResults.find((x) => (x.hits || 0) > 0);
  if (hit) {
    return { verdict: hit.kind === "staging" ? "WATCHLISTED" : "LISTED", why: hit.kind === "staging" ? "present only in a holding file, not the catalogue" : `entry found in ${hit.path}`, hit };
  }
  const d = decide({ fetched: fileResults.filter((x) => x.status === 200).length, ourHits: 0, listLinks, selfFile });
  return { verdict: d.verdict || "LISTED", why: d.why, hit: null };
}

async function checkCarrier(carrier) {
  const branch = await defaultBranch(carrier.repo);
  if (!branch) return { repo: carrier.repo, verdict: "UNREADABLE", why: "default branch could not be read; not guessing it", fetched: 0, listLinks: 0, ours: 0, files: [] };
  const results = [];
  let listLinks = 0;
  for (const entry of carrier.paths) {
    const url = `https://raw.githubusercontent.com/${carrier.repo}/${branch}/${entry.path}`;
    const r = await getText(url);
    if (r.status !== 200) { results.push({ path: entry.path, status: r.status, note: "unreadable" }); continue; }
    const links = (r.body.match(GITHUB_LINK) || []).length;
    listLinks = Math.max(listLinks, links);
    const hits = (r.body.match(new RegExp(OUR_MARKER, "gi")) || []).length;
    results.push({ path: entry.path, status: 200, kind: entry.kind, links_in_file: links, hits, facts: hits ? entryFacts(r.body) : null, ...(entry.self ? { self_file: true } : {}) });
  }
  const decided = pickVerdict(results, { listLinks, selfFile: results.some((x) => x.self_file) });
  return { repo: carrier.repo, branch, verdict: decided.verdict, why: decided.why, fetched: results.filter((x) => x.status === 200).length, listLinks, files: results };
}

function summary(rows) {
  const count = (v) => rows.filter((r) => r.verdict === v).length;
  return { listed: count("LISTED"), watchlisted: count("WATCHLISTED"), absent: count("ABSENT"), unreadable: count("UNREADABLE") };
}

async function run() {
  const rows = [];
  for (const carrier of CARRIERS) rows.push(await checkCarrier(carrier));
  const s = summary(rows);
  for (const r of rows) {
    const hit = r.files.find((f) => (f.hits || 0) > 0);
    console.log(`${r.repo.padEnd(44)} ${r.verdict.padEnd(12)} ${hit ? hit.path.slice(0, 62) : r.why.slice(0, 62)}`);
    if (hit && hit.facts && (hit.facts.pinned_versions.length || hit.facts.tool_count_mentions.length)) {
      console.log(`${"  versions".padEnd(45)}${JSON.stringify(hit.facts.pinned_versions)} ${"tool counts"} ${JSON.stringify(hit.facts.tool_count_mentions)}`);
    }
  }
  console.log(`CARRIER_SUMMARY listed=${s.listed} watchlisted=${s.watchlisted} absent=${s.absent} unreadable=${s.unreadable}`);
  if (process.argv.includes("--require-clean") && (s.absent || s.unreadable)) {
    console.error("REFUSED: " + rows.filter((r) => r.verdict === "ABSENT" || r.verdict === "UNREADABLE").map((r) => r.repo + "=" + r.verdict).join(", "));
    return 2;
  }
  return 0;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
// exitCode rather than process.exit(): on Windows a hard exit while fetch handles are still draining aborts in
// libuv and the shell reports 127 instead of this tool's own verdict.
if (isMain) process.exitCode = await run();
