// One reading of "when did this file last change", shared by everything that publishes a freshness date.
//
// Why this exists: four tools date published pages from `git log -1 -- <path>`, which answers with the newest
// commit that touched the path - whatever it touched. Restamping a page is a commit that touches only that
// page's own date lines, so the stamp the tool just wrote became older than the commit that wrote it. Measured
// on 2026-09-30: commit 9f47dbaf corrected 19 files' timestamps, and the nightly check for those same pages
// then demanded 2026-09-30T00:10:10Z, which no restamp can satisfy without moving the target again. The check
// was unsatisfiable by construction, and it also published 18 sitemap <lastmod> values claiming a content
// change on a day when nothing but metadata had moved.
//
// So the question this module answers is the one the published claim actually makes: when did the page's
// content last change? A commit whose patch for that file contains nothing but date values is skipped, and the
// walk continues to the previous one.
//
// The safe direction is "count it as a change": anything this module cannot read as a pure date refresh - a
// rename, a mode change, an empty patch, a line that quotes a key without an ISO value - is treated as content.
import { execFileSync } from "node:child_process";

// A changed line is a date line only if it carries a date *value*. Prose about the keys must not qualify:
// `"dateModified":` inside a sentence explaining the metadata is a content change, not a restamp.
export const DATE_VALUE_LINE_RE = new RegExp(
  [
    '"(?:datePublished|dateModified)"\\s*:\\s*"\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}',
    'article:(?:published|modified)_time"\\s+content="\\d{4}-\\d{2}-\\d{2}',
    "<(?:lastmod|updated)>\\d{4}-\\d{2}-\\d{2}",
  ].join("|"),
  "u",
);

// `patchBody` is the per-file patch text for one commit: the lines between this commit's header and the next.
// Returns true only when the commit changed something in this file and every change was a date value. An
// empty patch (a rename or a mode-only change) is false, because this module cannot see what the reader
// would notice and the reader notices a page appearing under a new URL.
export function isDateOnlyChange(patchBody) {
  let sawChange = false;
  for (const line of String(patchBody).split("\n")) {
    const marker = line[0];
    if (marker !== "+" && marker !== "-") continue;
    const text = line.slice(1);
    // `--- a/path` and `+++ b/path` are diff headers, not changes.
    if (marker === "-" && text.startsWith("--")) continue;
    if (marker === "+" && text.startsWith("++")) continue;
    sawChange = true;
    if (!DATE_VALUE_LINE_RE.test(text)) return false;
  }
  return sawChange;
}

export function isoUtc(raw) {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
}

// Walks the newest `depth` commits that touched `path` and returns the first one that changed its content.
// `skipped` names how many date-only commits it stepped over, so a caller can say "this stamp is three
// restamps behind the file's last touch" instead of printing a bare date nobody can trace.
export function lastContentChange(path, { depth = 12, run = execFileSync } = {}) {
  let raw = "";
  try {
    raw = run("git", ["log", "-p", "--unified=0", "--no-color", "--format=%x00%H %cI", "-n", String(depth), "--", path], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (e) {
    const message = String((e && e.message) || e);
    return { sha: "", date: null, skipped: 0, error: "git log -p failed: " + message.split("\n")[0].slice(0, 120) };
  }
  // %x00 emits a literal NUL, so a file whose patch contains a line starting with "commit " cannot split a
  // record boundary. The leading NUL leaves one empty field, which is dropped.
  const records = String(raw || "").split("\0").filter((r) => r.trim() !== "");
  if (records.length === 0) return { sha: "", date: null, skipped: 0, error: "no commit reports this path" };
  let skipped = 0;
  for (const record of records) {
    const newline = record.indexOf("\n");
    const header = newline === -1 ? record : record.slice(0, newline);
    const body = newline === -1 ? "" : record.slice(newline + 1);
    const [sha, when] = header.trim().split(/\s+/u);
    if (!sha || !when) return { sha: "", date: null, skipped, error: "unreadable commit header " + header.trim().slice(0, 60) };
    if (isDateOnlyChange(body)) {
      skipped += 1;
      continue;
    }
    const date = isoUtc(when);
    if (!date) return { sha: "", date: null, skipped, error: "unreadable commit date " + when };
    return { sha, date, skipped, error: null };
  }
  return {
    sha: "",
    date: null,
    skipped,
    error: "no content change in the last " + skipped + " commit(s) for " + path + "; every one of them moved only dates",
  };
}
