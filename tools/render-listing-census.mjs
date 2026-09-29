// Generate docs/listing-census.md from the two live presence probes, and --check the committed copy.
//
// Why this page exists: the project appears in six curated catalogues and three public MCP directories, and
// none of that is visible anywhere a visitor would look. Everything else on this site proves what the code
// does; this is the only evidence of who has accepted it, which is the thing a first-time reader actually
// weighs. So the claim has to be as checkable as every other claim here: each row cites the URL the probe
// found, and the probe reports what it read to find it - "listed" is never taken on faith.
//
// The page is generated, not typed, because a typed list of other people's pages rots the moment one of them
// removes us. --check re-runs both probes and fails on drift, which turns "someone deleted our entry" from
// something nobody would notice into a red nightly step.
//
//   node tools/render-listing-census.mjs            # write docs/listing-census.md
//   node tools/render-listing-census.mjs --check    # committed page vs a fresh probe; 4 drift, 5 unreadable
//   node tools/render-listing-census.mjs --stdout   # print the parsed census, write nothing
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const OUT = "docs/listing-census.md";
export const VERDICTS = ["LISTED", "WATCHLISTED", "ABSENT", "UNREADABLE", "NOT_FOUND", "UNDECIDABLE", "BLOCKED"];

// The carrier table separates its columns with runs of spaces: "<repo>   <VERDICT>   <path>". Split on that
// rather than trying to write one regex over three shapes - the facts line under a row is indented, so it
// starts with whitespace and is skipped, and a path may contain anything that is not a space.
export function parseCarriers(text) {
  const rows = [];
  for (const line of String(text ?? "").split(String.fromCharCode(10))) {
    if (line.startsWith(" ") || line.startsWith(String.fromCharCode(9))) continue;
    const cols = line.trim().split(/\s{2,}/u);
    if (cols.length < 2) continue;
    const [repo, verdict, path = ""] = cols;
    if (!VERDICTS.includes(verdict) || !/^[\w.-]+\/[\w.-]+$/u.test(repo)) continue;
    rows.push({ repo, verdict, path, kind: "catalogue" });
  }
  const summary = /CARRIER_SUMMARY listed=(\d+) watchlisted=(\d+) absent=(\d+) unreadable=(\d+)/u.exec(text ?? "");
  return { rows, summary: summary ? { listed: +summary[1], watchlisted: +summary[2], absent: +summary[3], unreadable: +summary[4] } : null };
}

// The directory probe prints a JSON report followed by a SUMMARY line; the evidence URL per site is the
// part this page has to carry, because that is what a reader can click.
export function parseDirectories(text) {
  const cut = (text ?? "").indexOf("SUMMARY ");
  const body = cut >= 0 ? text.slice(0, cut) : text;
  let report;
  try {
    report = JSON.parse(body).report;
  } catch {
    return { rows: [], summary: null, error: "directory probe stdout did not contain a parseable report" };
  }
  const rows = (report ?? []).map((r) => ({
    site: r.site, verdict: r.verdict, evidence: r.evidence ?? null, why: r.why ?? "",
    pagesRead: r.pagesRead ?? null, urlsSeen: r.urlsSeen ?? null, blockedLegs: (r.blockedLegs ?? []).length,
    kind: "directory",
  }));
  const summary = /SUMMARY listed=(\d+) not_found=(\d+) undecidable=(\d+)/u.exec(text ?? "");
  return { rows, summary: summary ? { listed: +summary[1], not_found: +summary[2], undecidable: +summary[3] } : null };
}

export function collect() {
  const carrier = spawnSync(process.execPath, ["tools/check-carrier-presence.mjs"], { encoding: "utf8", timeout: 10 * 60 * 1000 });
  const directory = spawnSync(process.execPath, ["tools/check-directory-presence.mjs", "--github-mcp", "--smithery"], { encoding: "utf8", timeout: 20 * 60 * 1000 });
  const carriers = parseCarriers(carrier.stdout);
  const directories = parseDirectories(directory.stdout);
  const unreadable = [];
  if (typeof carrier.status !== "number" || carrier.status > 1) unreadable.push("carriers: exit " + carrier.status);
  if (typeof directory.status !== "number" || directory.status > 1) unreadable.push("directories: exit " + directory.status);
  if (!carriers.summary) unreadable.push("carriers: no CARRIER_SUMMARY line");
  if (!directories.summary) unreadable.push("directories: " + (directories.error ?? "no SUMMARY line"));
  return { carriers, directories, unreadable, carrierStatus: carrier.status, directoryStatus: directory.status };
}

// The machine block is what --check compares, so it must not contain a timestamp: a page that is otherwise
// identical would otherwise read as drift every night, and a guard that cries wolf gets ignored.
export function machineBlock(census, measured) {
  const rows = [
    ...census.carriers.rows.map((r) => ({ kind: r.kind, repo: r.repo, verdict: r.verdict, path: r.path })),
    ...census.directories.rows.map((r) => ({ kind: r.kind, site: r.site, verdict: r.verdict, evidence: r.evidence })),
  ].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return "```json listing-census\n" + JSON.stringify({ measured, rows, carriers: census.carriers.summary, directories: census.directories.summary }, null, 1) + "\n```";
}

export function render(census, measured) {
  const listed = census.carriers.rows.filter((r) => r.verdict === "LISTED");
  const watch = census.carriers.rows.filter((r) => r.verdict === "WATCHLISTED");
  const dirs = census.directories.rows;
  const lines = [];
  lines.push("<!-- Generated by tools/render-listing-census.mjs from two live probes. Do not edit: re-run");
  lines.push("     `node tools/render-listing-census.mjs`, and the nightly job runs `--check` against a fresh");
  lines.push("     probe, so a listing that disappears shows up as a red step rather than as a stale claim. -->");
  lines.push("# Where this project is listed, with the URL that proves it");
  lines.push("");
  lines.push("Measured on " + measured + " by `tools/check-carrier-presence.mjs` (curated catalogues, read from");
  lines.push("their own repository files) and `tools/check-directory-presence.mjs` (public MCP directories, read");
  lines.push("from their published sitemaps). Both probes run with no credentials and no API keys.");
  lines.push("");
  lines.push("This page exists because the rest of the site documents what the code does, and nothing documented");
  lines.push("who has accepted it. Every row carries a link you can check without taking our word for it - and");
  lines.push("a listing can be removed by its maintainer on any day, which is why the numbers below are");
  lines.push("regenerated rather than typed.");
  lines.push("");
  lines.push("## Curated catalogues that carry an entry");
  lines.push("");
  lines.push("| Repository | What we appear in | Status |");
  lines.push("| --- | --- | --- |");
  for (const r of listed) lines.push("| [" + r.repo + "](https://github.com/" + r.repo + ") | `" + r.path + "` | listed |");
  for (const r of watch) lines.push("| [" + r.repo + "](https://github.com/" + r.repo + ") | `" + r.path + "` | in a watchlist file, not the catalogue |");
  lines.push("");
  lines.push("The distinction in the last row matters: a merged pull request and a merged pull request that");
  lines.push("landed in a staging file are different facts, and this page does not fold them together.");
  lines.push("");
  lines.push("## Public MCP directories");
  lines.push("");
  lines.push("| Directory | Status | Evidence read |");
  lines.push("| --- | --- | --- |");
  for (const r of dirs) {
    const status = r.verdict === "LISTED" ? "listed" : r.verdict === "NOT_FOUND" ? "no entry found" : r.verdict.toLowerCase();
    const seen = r.pagesRead === null ? "" : " over " + r.pagesRead + " pages and " + (r.urlsSeen ?? 0).toLocaleString("en-US") + " URLs";
    const blocked = r.blockedLegs ? ", " + r.blockedLegs + " leg(s) blocked" : "";
    lines.push("| [" + r.site.replace(/^https:\/\//u, "") + "](" + r.site + ") | " + status + " | " +
      (r.evidence ? "[" + r.evidence.replace(/^https:\/\//u, "") + "](" + r.evidence + ")" : "(none)") + " - " + r.why + seen + blocked + " |");
  }
  lines.push("");
  lines.push("A `no entry found` row is a reading, not a verdict about the directory: it means our slug was");
  lines.push("absent from the sitemaps that probe could read, and the blocked-leg count says how much of the");
  lines.push("site that was. GitHub's own MCP directory and Smithery are named here because being outside a");
  lines.push("list is information a reader can use; being inside one is information we would rather prove.");
  lines.push("");
  lines.push("## Also published, but not measured on this page");
  lines.push("");
  lines.push("- The official MCP Registry entry, `io.github.happy520ai/unified-ai-system`, served at version 0.8.0.");
  lines.push("- Container images `ghcr.io/happy520ai/unified-ai-system/ai-gateway-service` and `…/mcp-server`, whose");
  lines.push("  tool roster is readable without Docker by `node tools/verify-image-roster.mjs 0.8.0`.");
  lines.push("- This repository's own published [measurement datasets](data/mcp-ecosystem-measurements.2026-09-28.json),");
  lines.push("  which several of the catalogues above link back to.");
  lines.push("");
  lines.push(machineBlock(census, measured));
  lines.push("");
  return lines.join(String.fromCharCode(10));
}

export function readMachine(md) {
  const m = /```json listing-census\n([\s\S]*?)\n```/u.exec(md ?? "");
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

// A listing we can no longer reach is not the same fact as a listing that is gone. Without this split the
// nightly would go red because a third-party sitemap had a bad afternoon, which is how a guard gets muted - so
// the classification is by the fresh verdict, and the same --allow-unreadable convention the door-state step
// already uses decides whether "we could not look" fails the job.
export const UNPROVEN = ["UNREADABLE", "UNDECIDABLE", "BLOCKED"];

export function classifyDiff(committedRows, freshRows) {
  const key = (r) => JSON.stringify(r);
  const freshByKey = new Map(freshRows.map((r) => [key(r), r]));
  const committedKeys = new Set(committedRows.map(key));
  const gone = [];
  const unproven = [];
  for (const row of committedRows) {
    if (freshByKey.has(key(row))) continue;
    // The row is no longer confirmed. Was it positively refuted, or merely not read this time?
    const same = freshRows.find((f) => (f.repo ?? f.site) === (row.repo ?? row.site));
    if (!same || UNPROVEN.includes(same.verdict)) unproven.push({ row, fresh: same ?? null });
    else gone.push({ row, fresh: same });
  }
  const appeared = freshRows.filter((r) => !committedKeys.has(key(r)) && !UNPROVEN.includes(r.verdict));
  const appearedUnproven = freshRows.filter((r) => !committedKeys.has(key(r)) && UNPROVEN.includes(r.verdict));
  return { gone, appeared, unproven, appearedUnproven };
}

// Kept for the pure both-directions test: the raw set difference, before verdict classification.
export function diffRows(committedRows, freshRows) {
  const key = (r) => JSON.stringify(r);
  const fresh = new Set(freshRows.map(key));
  const committed = new Set(committedRows.map(key));
  return {
    disappeared: committedRows.filter((r) => !fresh.has(key(r))),
    appeared: freshRows.filter((r) => !committed.has(key(r))),
  };
}

function main() {
  const argv = process.argv.slice(2);
  const census = collect();
  const measured = new Date().toISOString().slice(0, 10);
  if (argv.includes("--stdout")) {
    console.log(machineBlock(census, measured));
    return census.unreadable.length > 0 ? 5 : 0;
  }
  if (census.unreadable.length > 0) {
    console.error("REFUSED: " + census.unreadable.join("; ") + " - nothing is written about listings we could not read");
    return 5;
  }
  const text = render(census, measured);
  if (argv.includes("--check")) {
    if (!existsSync(OUT)) { console.error("REFUSED (--check): " + OUT + " does not exist"); return 4; }
    const committed = readMachine(readFileSync(OUT, "utf8"));
    if (!committed) { console.error("REFUSED (--check): the committed page has no parseable machine block"); return 4; }
    const fresh = readMachine(text);
    const { gone, appeared, unproven } = classifyDiff(committed.rows ?? [], fresh.rows ?? []);
    console.log(JSON.stringify({ committed_rows: (committed.rows ?? []).length, fresh_rows: (fresh.rows ?? []).length,
      gone: gone.map((g) => (g.row.repo ?? g.row.site) + ": " + g.row.verdict + " -> " + g.fresh.verdict),
      appeared: appeared.map((a) => (a.repo ?? a.site) + "=" + a.verdict),
      unproven: unproven.map((u) => (u.row.repo ?? u.row.site) + " -> " + (u.fresh ? u.fresh.verdict : "not reported")),
      measured_committed: committed.measured, measured_fresh: fresh.measured }, null, 1));
    if (gone.length > 0 || appeared.length > 0) {
      for (const g of gone) console.error("GONE " + (g.row.repo ?? g.row.site) + ": page says " + g.row.verdict + ", a fresh probe reads " + g.fresh.verdict);
      for (const a of appeared) console.error("NEW " + (a.repo ?? a.site) + " = " + a.verdict + " is confirmed and not on the page - re-run the generator to publish it");
      console.error("DRIFT (--check): the page and a fresh probe disagree on " + (gone.length + appeared.length) + " listing(s)");
      return 4;
    }
    if (unproven.length > 0) {
      for (const u of unproven) console.error("NOT PROVEN (--check): " + (u.row.repo ?? u.row.site) +
        " is on the page but this probe could not confirm it (" + (u.fresh ? u.fresh.verdict : "absent from the report") + ")");
      if (!argv.includes("--allow-unreadable")) {
        console.error("REFUSED (--check): " + unproven.length + " listing(s) could not be re-confirmed; this is not drift, and re-running would only re-probe");
        return 5;
      }
      console.error("PARTIAL (--allow-unreadable): " + unproven.length + " listing(s) not re-confirmed tonight, nothing claimed about them");
      return 0;
    }
    console.error("OK (--check): " + fresh.rows.length + " rows still confirmed by a fresh probe, none missing");
    return 0;
  }
  writeFileSync(OUT, text, "utf8");
  console.log("WROTE " + OUT + " (" + census.carriers.rows.length + " catalogue rows, " + census.directories.rows.length + " directory rows)");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
