#!/usr/bin/env node
// Pre-flight for the launch copy: re-reads every volatile claim that
// docs/growth-launch-kit-2026-09.md asks the author to confirm and exits
// non-zero if any of them has moved.
//
// Why a script rather than the checklist: checklists get skipped when someone is
// in a hurry, and the posts written in a hurry are the ones with the biggest
// audience. A wrong number in a Show HN comment gets corrected in the top reply
// of a thread nobody was going to read otherwise.
//
// Rules this file holds itself to:
//  - every live value is fetched here; nothing is read out of the kit and echoed
//    back at it, which would prove only that the file is self-consistent;
//  - the copy side is parsed out of the paste-ready lines, so the checker follows
//    what would actually be published instead of a constant in this file;
//  - claims are compared after normalisation ("fifteen" == 15, "v0.8.0" == 0.8.0),
//    because a checker that cries wolf over notation trains people to ignore it;
//  - a check that could not run is INCONCLUSIVE and exits non-zero - it is never
//    folded into "pass". This session already lost a measurement channel to a 404
//    endpoint, so "unreadable" and "clean" must stay visibly different.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const REPO = "happy520ai/unified-ai-system";
const SLUG = "io.github.happy520ai%2Funified-ai-system";
const SITE = "https://happy520ai.github.io/unified-ai-system";

export const WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};

export const num = (v) => {
  if (typeof v === "number") return v;
  const s = String(v).trim().toLowerCase();
  if (/^\d+$/.test(s)) return Number(s);
  return WORDS[s] ?? null;
};

const COUNT_IN_TEXT =
  /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|\d{1,2})\s+((?:governed\s+|dedicated\s+|stdio\s+|MCP\s+|bounded\s+|codex\s+)*)tools?\b/gi;
// A line that announces it is reproducing somebody else's words is not a claim of
// ours. "Their README says eight dedicated tools" and "the v0.7.0 image exposed 12"
// are records, and flagging them would teach the reader to ignore the real flags.
// A line that marks itself as reproducing, quoting or dating somebody else's words - or
// an older state of our own - is a record, not a claim of ours to defend. "Their README
// says eight dedicated tools", "the v0.7.0 image exposed 12", "every row was produced
// when the surface had twelve tools" all stay true whatever the roster becomes, and
// flagging them trains the reader to ignore the flags that matter. Shared with the
// carrier sweep so the two instruments cannot disagree about where the line sits.
export const RECORD_MARKER =
  /says|stated|statement|quoted|verbatim|reproduc|was true|was produced|currently reads|exposed|→|"[^"]*tools|history|as-of|dated|record\b|records\b|recorded/i;
export const isRecordLine = (line) => RECORD_MARKER.test(String(line ?? ""));
// A version is a claim about the present only next to today/latest/current.
const NEAR_PRESENT = 30;
const PRESENT_WORD = /\b(today|latest|current)\b/i;
const IMAGE_REF = /ghcr\.io\/[a-z0-9._/-]+\/([a-z0-9-]+):(\d+\.\d+\.\d+)/g;

// The paste-ready copy - the `>` blockquote lines, which is what gets published
// verbatim - is the only thing this parses. Everything else in the kit is notes to
// the author that never leave the repository.
export function readCopyClaims(kitText) {
  const copyLines = kitText.split("\n").filter((l) => l.startsWith("> "));
  const presentVersions = [];
  const imageRefs = [];
  const claimedCounts = [];
  const quotedCounts = [];
  for (const line of copyLines) {
    for (const m of line.matchAll(/\bv?(\d+\.\d+\.\d+)\b/g)) {
      const window = line.slice(Math.max(0, m.index - NEAR_PRESENT), m.index + m[0].length + NEAR_PRESENT);
      if (PRESENT_WORD.test(window) && !presentVersions.includes(m[1])) presentVersions.push(m[1]);
    }
    for (const m of line.matchAll(IMAGE_REF)) {
      const ref = `${m[1]}:${m[2]}`;
      if (!imageRefs.some((r) => r.join(":") === ref)) imageRefs.push([m[1], m[2]]);
    }
    for (const m of line.matchAll(COUNT_IN_TEXT)) {
      const value = num(m[1]);
      if (value === null) continue;
      (isRecordLine(line) ? quotedCounts : claimedCounts).push(value);
    }
  }
  return {
    copyLines,
    presentVersions,
    namedVersion: presentVersions.length === 1 ? presentVersions[0] : null,
    imageRefs,
    claimedCounts,
    distinctCounts: [...new Set(claimedCounts)].sort((a, b) => a - b),
    quotedCounts,
  };
}

export const versionClaim = (claims) =>
  claims.namedVersion ??
  `copy-names-${claims.presentVersions.length}-versions[${claims.presentVersions.join(",") || "none"}]`;

export const countClaim = (claims) =>
  claims.distinctCounts.length === 1
    ? String(claims.distinctCounts[0])
    : claims.distinctCounts.length === 0
      ? "READ-FAILED:no-count-in-copy"
      : `copy-says-${claims.distinctCounts.join("-and-")}`;

const sh = (cmd, args, timeout = 120_000) =>
  spawnSync(cmd, args, { encoding: "utf8", timeout, maxBuffer: 64 * 1024 * 1024 });

const ghcrStatus = async (image, tag) => {
  // GHCR answers 401 to an unauthenticated manifest GET; the anonymous pull token is
  // the documented way to read a public image. Reporting 401 would be a defect in this
  // checker, not a fact about the image.
  const repo = `${REPO}/${image}`;
  try {
    const t = await fetch(`https://ghcr.io/token?scope=repository:${repo}:pull&service=ghcr.io`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!t.ok) return `UNREADABLE:token-${t.status}`;
    const { token } = await t.json();
    if (!token) return "UNREADABLE:token-empty";
    const r = await fetch(`https://ghcr.io/v2/${repo}/manifests/${tag}`, {
      signal: AbortSignal.timeout(30_000),
      headers: {
        accept:
          "application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json",
        authorization: `Bearer ${token}`,
      },
    });
    await r.body?.cancel();
    return String(r.status);
  } catch (error) {
    return `UNREADABLE:${String(error?.name ?? error).slice(0, 24)}`;
  }
};

const status = async (url) => {
  try {
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
      headers: {
        accept:
          "application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/json, text/html;q=0.8, */*;q=0.5",
      },
    });
    await r.body?.cancel();
    return String(r.status);
  } catch (error) {
    return `UNREADABLE:${String(error?.name ?? error).slice(0, 24)}`;
  }
};

// A sentinel can sit on either side of a row: "UNREADABLE:AbortError" comes from the
// probe and "READ-FAILED:no-count-in-copy" from the copy. Both mean the check did not
// run, and neither may be reported as "clean".
export const isUnreadable = (row) =>
  /READ-FAILED|UNREADABLE|exit-|unparseable|not-read/.test(`${row.expect} ${row.live}`);

const run = async () => {
  const kitPath = process.env.PREFLIGHT_KIT_FILE ?? "docs/growth-launch-kit-2026-09.md";
  const kit = readFileSync(kitPath, "utf8");
  if (kit.length < 4000) {
    console.log(`FATAL: ${kitPath} is ${kit.length} bytes - refusing to audit a file that short`);
    process.exit(2);
  }
  const claims = readCopyClaims(kit);
  const rows = [];
  const notes = [];
  const add = (claim, expect, live, kind) => {
    let pass;
    if (kind === "num") {
      const e = num(expect);
      const l = num(live);
      pass = e !== null && l !== null && e === l;
    } else if (kind === "http") {
      pass = live === "200";
    } else {
      pass = String(expect).replace(/^v/, "") === String(live).replace(/^v/, "");
    }
    rows.push({ claim, expect: String(expect), live: String(live), pass });
  };

  // 1. The release the copy calls current vs the release that actually is.
  const liveTag = sh("gh", ["api", `repos/${REPO}/releases/latest`, "--jq", ".tag_name"]).stdout.trim();
  add("release the copy calls current", versionClaim(claims), liveTag || "READ-FAILED", "eq");

  // 2. The tool count the posts quote, measured out of the published image. Not a
  // presence test: kit.includes("fifteen") passes even after someone writes "twelve
  // tools" somewhere else, which is exactly how a first version of this check failed
  // its own calibration fixture.
  const rosterRun = claims.namedVersion
    ? sh("node", ["tools/verify-image-roster.mjs", claims.namedVersion, "--json"], 480_000)
    : { status: -1, stdout: "", stderr: "no current version resolved from the copy" };
  const rosterWhy = (rosterRun.stderr ?? "").split("\n").find((l) => l.trim().length > 0) ?? "(no stderr)";
  let rosterCount = `READ-FAILED:exit-${rosterRun.status}:${rosterWhy.slice(0, 90)}`;
  if (rosterRun.status === 0) {
    try {
      rosterCount = String(JSON.parse(rosterRun.stdout).hits[0].names.length);
    } catch {
      rosterCount = "READ-FAILED:unparseable";
    }
  }
  add("tool count in the copy vs in the image", countClaim(claims), rosterCount, "num");
  notes.push(
    `${claims.claimedCounts.length} count claims read from the copy, ${claims.quotedCounts.length} excused as quoting or recording somebody else's wording`,
  );

  // 3. The images the copy tells a reader to run, read out of the copy, so a stale or
  //    mistyped tag cannot pass by pointing at whatever this file hard-codes.
  if (claims.imageRefs.length === 0) {
    add("ghcr image the copy runs", "READ-FAILED:no-image-ref-in-copy", "not-read", "http");
  }
  for (const [image, tag] of claims.imageRefs) {
    add(`ghcr ${image}:${tag}`, "200", await ghcrStatus(image, tag), "http");
  }

  // 4. Official MCP Registry entry for that version.
  add(
    `MCP Registry ${claims.namedVersion ?? "?"} entry`,
    "200",
    await status(
      `https://registry.modelcontextprotocol.io/v0.1/servers/${SLUG}/versions/${claims.namedVersion ?? "unreadable"}`,
    ),
    "http",
  );

  // 5. Glama - linked from the punkpeye badge and the gate on that door.
  add("Glama listing", "200", await status(`https://glama.ai/mcp/servers/${REPO}`), "http");

  // 6. Pages the posts deep-link into.
  for (const page of ["", "verify-mcp-docker-image.html", "security-drill-evidence.html", "self-hosted-ai-gateways-compared.html"]) {
    add(`site /${page || "(home)"}`, "200", await status(`${SITE}/${page}`), "http");
  }

  // 7. The tag-anchored release size, which cannot drift but is worth proving readable.
  const tagCount = sh("git", ["rev-list", "--count", "v0.7.0..v0.8.0"]).stdout.trim();
  const kitCount = /(\d+)\s+commits between the v0\.7\.0 and v0\.8\.0 tags/.exec(kit);
  add("release size stated tag-to-tag", kitCount ? kitCount[1] : "READ-FAILED:not-stated-in-kit", tagCount || "READ-FAILED", "num");

  console.log("\n=== launch pre-flight ===");
  for (const n of notes) console.log(`note ${n}`);
  for (const r of rows) {
    console.log(`${r.pass ? "OK  " : "FAIL"} ${r.claim.padEnd(44)} expected=${r.expect.padEnd(18)} live=${r.live}`);
  }
  const failed = rows.filter((r) => !r.pass);
  const unreadable = failed.filter(isUnreadable);
  const drift = failed.filter((r) => !isUnreadable(r));
  const meta = sh("gh", ["api", `repos/${REPO}`, "--jq", '"\\(.stargazers_count) stars / \\(.open_issues_count) open\"']).stdout.trim();
  console.log(`\nrepository page reads right now: ${meta || "(unreadable)"} - stars are not a claim the copy depends on unless a post quotes one`);
  console.log(`drift: ${drift.length} | unreadable: ${unreadable.length} | checks: ${rows.length}`);
  if (drift.length > 0) {
    console.log("VERDICT: DRIFT - rewrite the flagged figures before posting.");
    process.exit(1);
  }
  if (unreadable.length > 0) {
    console.log("VERDICT: INCONCLUSIVE - some checks could not run. Do not treat this as a pass.");
    process.exit(3);
  }
  console.log("VERDICT: every volatile claim the copy relies on matches a live reading.");
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await run();
}
