// Set every <lastmod> in docs/sitemap.xml from git, and touch nothing else in the file.
//
// Why this exists: the sitemap is the only freshness signal Google uses to decide how often to come back, and
// nothing generated it - tools/render-site-feed.mjs writes the feed, tools/render-articles.mjs writes the pages,
// and the sitemap's dates were typed by hand. Measured on 2026-09-29: 28 of 30 declared pages carried a lastmod
// older than the commit that last changed them, the oldest by four days. A stale lastmod is not a wrong fact
// about the page, it is a wrong claim about the repository, and it is invisible to every gate because no gate
// reads it.
//
// Like the date work it mirrors, it refuses rather than guessing: a page whose history is truncated in this
// clone gets reported as unchecked, not stamped with the boundary commit's date.
//
// The first version of this tool matched only locs ending in ".html", so the site root - served by
// docs/index.html, written as <loc>https://…/unified-ai-system/</loc> - was never read and its lastmod stayed
// three days behind while the run printed "already current". Every <url> block now has to land in exactly one
// of stamped / current / unchecked / unmapped, and an unmapped one stops the run: a filter that silently
// returns fewer items is how a coverage claim becomes a cover story.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SITEMAP = "docs/sitemap.xml";

function historyDepth() {
  try {
    return Number(execFileSync("git", ["rev-list", "--count", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()) || 0;
  } catch {
    return 0;
  }
}

// The reading is only a fact about the file if the commit it names is not the clone's graft boundary.
function knowable(sha) {
  if (!sha) return false;
  try {
    execFileSync("git", ["cat-file", "-e", sha + "^"], { stdio: ["ignore", "ignore", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

function lastChange(path) {
  let raw = "";
  try {
    raw = execFileSync("git", ["log", "--format=%H %cI", "-1", "--", path], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return { error: "git failed" };
  }
  if (!raw) return { error: "no commit reports this path" };
  const [sha, when] = raw.split(" ");
  if (!knowable(sha)) return { error: "history truncated at " + String(sha).slice(0, 8) };
  const day = new Date(when).toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/u.test(day) ? { day, sha } : { error: "unreadable commit date " + when };
}

// Exported so the safety property can be falsified without editing a real sitemap: this is the only guard
// between "refreshed a date" and "silently rewrote the file Google crawls against".
export function dateOnlyProof(beforeText, afterText) {
  const before = beforeText.split("\n");
  const after = afterText.split("\n");
  let bi = 0;
  let ai = 0;
  while (bi < before.length || ai < after.length) {
    if (bi < before.length && ai < after.length && before[bi] === after[ai]) { bi += 1; ai += 1; continue; }
    if (bi < before.length && ai < after.length && /<lastmod>/u.test(before[bi]) && /<lastmod>/u.test(after[ai])) { bi += 1; ai += 1; continue; }
    if (ai < after.length && /<lastmod>/u.test(after[ai]) && !/<lastmod>/u.test(before[bi] || "")) { ai += 1; continue; }
    return { ok: false, reason: "line " + (ai + 1) + " is not a lastmod change, so this was not a pure date refresh: " + String(after[ai] || "(end of file)").trim().slice(0, 80) };
  }
  return { ok: true };
}

// Which file a <loc> is served from. The bare site root is not a filename, and it is the URL a crawler
// reaches first, so it needs naming rather than a regex that quietly does not match: the first version of this
// tool skipped every block whose loc had no ".html" in it, which left the root entry carrying a three-day-old
// lastmod while the run reported "already current" and named nothing.
export function fileForLoc(locRaw) {
  const path = String(locRaw).replace(/^https?:\/\/[^/]+/u, "");
  if (path === "/" || /\/$/u.test(path)) return "index.html";
  const named = /\/([\w.-]+\.html)$/u.exec(path);
  return named ? named[1] : null;
}

export function refresh(xml, reader = lastChange) {
  const changes = [];
  const unchecked = [];
  const unmapped = [];
  let next = xml;
  let blocks = 0;
  let accounted = 0;
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/gu)) {
    const block = m[0];
    blocks += 1;
    const locRaw = (/<loc>([^<]*)<\/loc>/u.exec(block) || [])[1] ?? "";
    const file = fileForLoc(locRaw);
    if (file === null) { unmapped.push(locRaw || "(empty loc)"); continue; }
    const read = reader("docs/" + file);
    if (read.error) {
      unchecked.push(file + ": " + read.error);
      accounted += 1;
      continue;
    }
    const current = /<lastmod>([^<]*)<\/lastmod>/u.exec(block);
    if (current && current[1].slice(0, 10) === read.day) { accounted += 1; continue; }
    const rebuilt = current
      ? block.replace(/<lastmod>[^<]*<\/lastmod>/u, "<lastmod>" + read.day + "</lastmod>")
      : block.replace("</loc>", "</loc>\n    <lastmod>" + read.day + "</lastmod>");
    next = next.replace(block, () => rebuilt);
    accounted += 1;
    changes.push({ file, from: current ? current[1].slice(0, 10) : "(absent)", to: read.day });
  }
  return { next, changes, unchecked, unmapped, blocks, accounted };
}

function main() {
  const dry = process.argv.includes("--dry");
  // --sitemap is the test seam: a fixture file exercises the refusal paths without touching the shipped one.
  const si = process.argv.indexOf("--sitemap");
  const target = si > 0 && typeof process.argv[si + 1] === "string" ? process.argv[si + 1] : SITEMAP;
  const xml = readFileSync(target, "utf8");
  if (historyDepth() <= 1) {
    console.error("REFUSED: a one-commit clone cannot date anything; nothing written");
    process.exitCode = 2;
    return;
  }
  const { next, changes, unchecked, unmapped, blocks, accounted } = refresh(xml);
  // Purity: the number of <url> blocks and <loc> values may not move, and every changed line must be a lastmod.
  const count = (s, re) => (s.match(re) || []).length;
  if (count(next, /<loc>/gu) !== count(xml, /<loc>/gu) || count(next, /<url>/gu) !== count(xml, /<url>/gu)) {
    console.error("REFUSED: the URL set changed, and this tool only refreshes dates");
    process.exitCode = 2;
    return;
  }
  // Coverage, not just output: an entry this tool cannot map must stop the run instead of being skipped, or
  // "no lastmod moved" means "the ones we looked at were current" while something else went unread.
  if (unmapped.length > 0) {
    console.error("REFUSED: " + unmapped.length + " <url> block(s) have a loc this tool cannot map to a file in docs/: " + unmapped.join(", "));
    process.exitCode = 3;
    return;
  }
  if (accounted !== blocks) {
    console.error("REFUSED: accounted for " + accounted + " of " + blocks + " url blocks; a block was neither stamped, current, nor unchecked");
    process.exitCode = 3;
    return;
  }
  const proof = dateOnlyProof(xml, next);
  if (!proof.ok) {
    console.error("REFUSED: " + proof.reason);
    process.exitCode = 2;
    return;
  }
  console.log(JSON.stringify({ dry, depth: historyDepth(), changed: changes.length, pages: count(xml, /<loc>/gu),
    url_blocks: blocks, stamped_or_current: accounted - unchecked.length, unchecked: unchecked.length, unchecked_detail: unchecked,
    changes }, null, 2));
  if (unchecked.length > 0) console.error("NOT CHECKED (history truncated): " + unchecked.join("; "));
  if (!dry && changes.length > 0) writeFileSync(target, next, "utf8");
  if (!dry && changes.length === 0) console.log("already current: no lastmod moved");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
