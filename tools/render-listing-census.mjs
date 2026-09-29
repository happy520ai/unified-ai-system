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

// The third leg is the organic one: repositories that carry a copy of our skills/unified-ai-gateway/SKILL.md
// without us filing anything. Measured 2026-09-29: fourteen of them, found by searching for our own name. They
// are kept in a separate kind because they are not listings a person curated for us and they move between
// runs - the sweep counted 44 repositories locally and 45 in CI fifteen minutes later, which is the code
// search index settling, not the world changing twice. Classifying them with the curated rows would either
// red the nightly over an index hiccup or force the page to stop claiming anything about them.
export function parseSweep(text) {
  // The sweep prints its report and then a one-line summary, the same shape the directory probe uses. Cut at
  // the summary rather than trusting the whole stream to be one JSON value.
  const raw = String(text ?? "");
  const cut = raw.indexOf("\nMENTION_SUMMARY ");
  const body = cut >= 0 ? raw.slice(0, cut) : raw;
  let report;
  try {
    report = JSON.parse(body);
  } catch {
    return { rows: [], error: "sweep output was not parseable JSON" };
  }
  const rows = (report.repos ?? [])
    .filter((r) => r.group === "REDISTRIBUTION" && typeof r.repo === "string")
    .map((r) => ({ kind: "surface", repo: r.repo, group: "redistribution", files: r.files ?? 0, path: (r.paths ?? [])[0] ?? "" }))
    .sort((a, b) => a.repo.localeCompare(b.repo));
  return { rows, error: null, truncated: report.truncated === true, total: report.total_count ?? null };
}

export function collect() {
  const carrier = spawnSync(process.execPath, ["tools/check-carrier-presence.mjs"], { encoding: "utf8", timeout: 10 * 60 * 1000 });
  const directory = spawnSync(process.execPath, ["tools/check-directory-presence.mjs", "--github-mcp", "--smithery"], { encoding: "utf8", timeout: 20 * 60 * 1000 });
  const carriers = parseCarriers(carrier.stdout);
  const directories = parseDirectories(directory.stdout);
  // Optional leg: a failed sweep costs the organic section, not the page. It is never pushed into
  // `unreadable`, because that list is the refusal condition and the curated rows are what the page claims.
  const sweep = spawnSync(process.execPath, ["tools/growth-mention-sweep.mjs", "--json"], { encoding: "utf8", timeout: 10 * 60 * 1000 });
  const surfaces = parseSweep(sweep.stdout);
  const unreadable = [];
  if (typeof carrier.status !== "number" || carrier.status > 1) unreadable.push("carriers: exit " + carrier.status);
  if (typeof directory.status !== "number" || directory.status > 1) unreadable.push("directories: exit " + directory.status);
  if (!carriers.summary) unreadable.push("carriers: no CARRIER_SUMMARY line");
  if (!directories.summary) unreadable.push("directories: " + (directories.error ?? "no SUMMARY line"));
  return { carriers, directories, surfaces, unreadable, carrierStatus: carrier.status, directoryStatus: directory.status, sweepStatus: sweep.status };
}

// The machine block is what --check compares, so it must not contain a timestamp: a page that is otherwise
// identical would otherwise read as drift every night, and a guard that cries wolf gets ignored.
export function machineBlock(census, measured) {
  const rows = [
    ...census.carriers.rows.map((r) => ({ kind: r.kind, repo: r.repo, verdict: r.verdict, path: r.path })),
    ...census.directories.rows.map((r) => ({ kind: r.kind, site: r.site, verdict: r.verdict, evidence: r.evidence })),
    ...(census.surfaces?.rows ?? []).map((r) => ({ kind: r.kind, repo: r.repo, group: r.group, files: r.files, path: r.path })),
  ].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const payload = { measured, rows, carriers: census.carriers.summary, directories: census.directories.summary };
  // Fourteen rows and zero rows are different statements from "the leg did not run", and --check compares rows
  // rather than prose, so the block has to carry which of the three it is.
  payload.surface_leg = census.surfaces && !census.surfaces.error ? "read" : "unreadable";
  if (census.surfaces?.truncated) payload.surface_truncated = true;
  return "```json listing-census\n" + JSON.stringify(payload, null, 1) + "\n```";
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
  const surfaces = census.surfaces?.rows ?? [];
  lines.push("## Copies of our skill file in other repositories");
  lines.push("");
  if (surfaces.length === 0) {
    lines.push("Nothing is claimed here on this run: the mention sweep produced no reading, and an absent table is not an");
    lines.push("empty one. The curated catalogue and directory tables above are unaffected.");
  } else {
    // A row whose matched path ends in our file name holds a copy; one that matched a README, or a bundle's own
    // SKILL.md, only names it. Measured 2026-09-29: 12 of 14 rows are copies, and the two that are not were read
    // from their own files to confirm it - one is a 2,478-skill registry index, the other declares
    // `name: agentic-awesome-skills`. Saying "14 repositories carry our skill file" covered both kinds and was
    // wrong about two of them, on a page whose whole argument is that its claims are checkable.
    const isCopy = (s) => /unified-ai-gateway\/SKILL\.md$/u.test(String(s.path ?? ""));
    const copies = surfaces.filter(isCopy);
    const indexMentions = surfaces.filter((s) => !isCopy(s));
    lines.push(surfaces.length + " repositories matched a code search for our skill file as of " + measured + ".");
    lines.push("Of them, " + copies.length + " carry a copy of the file - the matched path ends in");
    lines.push("`unified-ai-gateway/SKILL.md`, which includes one directory renamed with a vendor prefix - and " + indexMentions.length + " name it from an index");
    lines.push("they generate, holding a README or their own bundle rather than our file.");
    lines.push("Nobody on our side filed any of these, and a count like this one moves: the same search returned 44 repositories");
    lines.push("locally and 45 in CI fifteen minutes later, because the code-search index settles rather than because the world");
    lines.push("changed twice. So this is a dated snapshot, and the nightly treats it as informational - a repository dropping");
    lines.push("its copy is reported, never a build failure, because that repository is not ours to keep.");
    lines.push("");
    lines.push("| Repository | The file there | Files matching | Holds a copy |");
    lines.push("| --- | --- | --- | --- |");
    for (const s of surfaces) {
      lines.push("| [" + s.repo + "](https://github.com/" + s.repo + ") | `" + s.path + "` | " + s.files + " | " + (isCopy(s) ? "yes" : "no - index") + " |");
    }
  }
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

export function classifyDiff(committedRows, freshRowsAll) {
  // Surface rows are reported, not adjudicated: they describe other people's repositories, they legitimately
  // move between runs, and a guard that goes red over an index settling is a guard that gets muted. The
  // curated and directory rows keep their drift contract below.
  const isSurface = (r) => r.kind === "surface";
  const surfaceKey = (r) => JSON.stringify(r);
  const cSurfaces = new Set(committedRows.filter(isSurface).map(surfaceKey));
  const fSurfaces = new Set(freshRowsAll.filter(isSurface).map(surfaceKey));
  const surfaceChanged = [...new Set([...cSurfaces, ...fSurfaces])].filter((k) => cSurfaces.has(k) !== fSurfaces.has(k)).length;
  const committedRows2 = committedRows.filter((r) => !isSurface(r));
  const freshRows = freshRowsAll.filter((r) => !isSurface(r));
  const key = (r) => JSON.stringify(r);
  const freshByKey = new Map(freshRows.map((r) => [key(r), r]));
  const committedKeys = new Set(committedRows2.map(key));
  const gone = [];
  const unproven = [];
  for (const row of committedRows2) {
    if (freshByKey.has(key(row))) continue;
    // The row is no longer confirmed. Was it positively refuted, or merely not read this time?
    const same = freshRows.find((f) => (f.repo ?? f.site) === (row.repo ?? row.site));
    if (!same || UNPROVEN.includes(same.verdict)) unproven.push({ row, fresh: same ?? null });
    else gone.push({ row, fresh: same });
  }
  const appeared = freshRows.filter((r) => !committedKeys.has(key(r)) && !UNPROVEN.includes(r.verdict));
  const appearedUnproven = freshRows.filter((r) => !committedKeys.has(key(r)) && UNPROVEN.includes(r.verdict));
  return { gone, appeared, unproven, appearedUnproven, surfaceChanged };
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

// A probe that *ran* is not a probe that *read*: check-carrier-presence.mjs exits 0 whether or not any
// listing answered, so the write path has to ask its own question. ABSENT is allowed through, because that
// is a real finding about a listing that left. UNREADABLE is this tool being blind, and publishing from it
// would quietly un-claim rows the page already carries. Measured 2026-09-29: a generator run without
// GH_TOKEN hit the anonymous api.github.com per-IP cap and produced a page whose catalogue table was empty
// and whose machine block said unreadable=12 - strictly worse than the page it replaced.
export function publishBlocker(census) {
  const s = census?.carriers?.summary;
  if (!s) return "carrier probe returned no CARRIER_SUMMARY line";
  if (s.unreadable > 0) return s.unreadable + " listing(s) were read as UNREADABLE";
  return null;
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
    const { gone, appeared, unproven, surfaceChanged } = classifyDiff(committed.rows ?? [], fresh.rows ?? []);
    console.log(JSON.stringify({ committed_rows: (committed.rows ?? []).length, fresh_rows: (fresh.rows ?? []).length,
      surface_changed: surfaceChanged,
      gone: gone.map((g) => (g.row.repo ?? g.row.site) + ": " + g.row.verdict + " -> " + g.fresh.verdict),
      appeared: appeared.map((a) => (a.repo ?? a.site) + "=" + a.verdict),
      unproven: unproven.map((u) => (u.row.repo ?? u.row.site) + " -> " + (u.fresh ? u.fresh.verdict : "not reported")),
      measured_committed: committed.measured, measured_fresh: fresh.measured }, null, 1));
    if (surfaceChanged > 0) {
      console.error("SURFACE (informational): " + surfaceChanged + " organic row(s) differ from the committed page. This leg describes other people's repositories and never decides the build - the curated and directory rows above still do.");
    }
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
  const blocker = publishBlocker(census);
  if (blocker) {
    console.error("REFUSED (write): " + blocker + " - the committed page is left as it was. The api.github.com "
      + "leg is capped per IP when anonymous, so set GH_TOKEN (the nightly exports it) or re-run once the hosts answer.");
    return 5;
  }
  writeFileSync(OUT, text, "utf8");
  console.log("WROTE " + OUT + " (" + census.carriers.rows.length + " catalogue rows, " + census.directories.rows.length + " directory rows)");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
