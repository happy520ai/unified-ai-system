#!/usr/bin/env node
// Catches the mistake I made three times on 2026-09-26: writing the CURRENT release's tool count
// into a procedure that pins an OLDER image by digest. The older image ships fewer names, so the
// instruction tells a reader to expect something they will never see, and they conclude the
// install failed. Two of those edits were merged into other people's repositories before anyone
// caught it, and the review bots caught the third.
//
// Deliberately standalone: it reads and reports, it does not alter any existing criterion, and it
// is not a variant of star-growth-check's carrier arm (that arm narrows text to anchor lines and
// would never see a numbered setup step). Adding an arm nobody runs is false safety, so this file
// is wired into test:verification-tools and exits non-zero on a finding.
//
// The roster-by-version table below is MEASURED, not inherited. Each row is the count of names
// tools/verify-image-roster.mjs reads out of that published image, and 0.5.0 was measured
// specifically because a public title claimed it and no one had checked:
//   0.4.9 -> 9    0.5.0 -> 12    0.7.0 -> 12    0.8.0 -> 15
// An unlisted pinned version is reported as inconclusive rather than excused, because guessing is
// what produced the wrong numbers in the first place.
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const PINNED_ROSTER = {
  "0.4.9": 9,
  "0.5.0": 12,
  "0.7.0": 12,
  "0.8.0": 15,
};

const WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
};

const COUNT_ON_LINE =
  /\b(\d{1,2}|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen)\s+((?:governed|dedicated|stdio|MCP|bounded|codex|current|tool\s+definition)\s+)*tools?\b/gi;

const versionIn = (window) => {
  const hits = [...String(window).matchAll(/\bv?(\d+\.\d+\.\d+)\b/g)].map((m) => m[1]);
  return hits;
};

// A sentence scoped to the release itself is true regardless of what the procedure pins.
const PRODUCT_SCOPED = /current release|v?d+.d+.d+|declares|ships .*names|as of /i;

// Pure: given text plus the current roster count, list lines that assert the current count while
// the surrounding window pins an older identity whose measured roster differs.
export function pinnedCountMismatches(text, currentCount) {
  const findings = [];
  const inconclusive = new Set();
  const lines = String(text ?? "").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const claims = [...lines[i].matchAll(COUNT_ON_LINE)];
    for (const claim of claims) {
      const raw = claim[1].toLowerCase();
      const stated = /^\d+$/.test(raw) ? Number(raw) : WORDS[raw];
      if (stated !== currentCount) continue; // only the current count can be wrongly placed
      // The claim must be about what the reader will SEE, not about what the product HAS. Without
      // this, the arm fires on the true sentence "Current release: v0.8.0. It declares and ships
      // fifteen tool names" merely because a digest pin appears within forty lines of it - and a
      // guard that flags correct prose gets its findings ignored, which is worse than no guard.
      if (PRODUCT_SCOPED.test(lines[i])) continue;
      // A pinned identity can sit up to WINDOW lines either side, so a numbered step and the
      // `IMAGE=...@sha256:...` line that follows it are still read as one instruction.
      const WINDOW = 40;
      const window = lines.slice(Math.max(0, i - WINDOW), Math.min(lines.length, i + WINDOW + 1)).join("\n");
      if (!/@sha256:[0-9a-f]{16}/.test(window)) continue;
      const older = [...new Set(versionIn(window))].filter((v) => PINNED_ROSTER[v] !== undefined && v !== CURRENT_RELEASE);
      if (older.length === 0) {
        const anyPin = [...new Set(versionIn(window))].find((v) => !(v in PINNED_ROSTER));
        if (anyPin) inconclusive.add(`line ${i + 1} claims ${stated} tools near a pin to ${anyPin}, which has no measured roster row`);
        continue;
      }
      for (const v of older) {
        if (PINNED_ROSTER[v] !== currentCount) {
          findings.push({
            line: i + 1,
            text: lines[i].trim().slice(0, 90),
            claimed: currentCount,
            pinnedVersion: v,
            pinnedShips: PINNED_ROSTER[v],
          });
          break;
        }
      }
    }
  }
  return { findings, inconclusive: [...inconclusive] };
}

// The inverse reading: a count that matches a pinned older image is CORRECT there and must not be
// "helpfully" updated. Reported so a human can see the exception is deliberate.
export function pinnedCorrectReadings(text, currentCount) {
  const lines = String(text ?? "").split("\n");
  const kept = [];
  for (let i = 0; i < lines.length; i += 1) {
    for (const claim of [...lines[i].matchAll(COUNT_ON_LINE)]) {
      const raw = claim[1].toLowerCase();
      const stated = /^\d+$/.test(raw) ? Number(raw) : WORDS[raw];
      if (stated === currentCount || stated === undefined) continue;
      const window = lines.slice(Math.max(0, i - 40), i + 41).join("\n");
      const v = [...new Set(versionIn(window))].find((x) => PINNED_ROSTER[x] === stated);
      if (v) kept.push({ line: i + 1, stated, pinnedVersion: v });
    }
  }
  return kept;
}

export const CURRENT_RELEASE = "0.8.0";

export function run({ paths = null } = {}) {
  const roster = PINNED_ROSTER[CURRENT_RELEASE];
  if (!Number.isInteger(roster)) return { status: "inconclusive", reason: "no measured roster for the current release" };
  const files = paths ?? execFileSync("git", ["ls-files", "skills", "docs", "*.md"], { encoding: "utf8" })
    .split("\n").filter((p) => p.endsWith(".md") && existsSync(p));
  const report = [];
  let mismatches = 0;
  let inconclusive = 0;
  for (const p of files) {
    let text = "";
    try { text = readFileSync(p, "utf8"); } catch { continue; }
    const { findings, inconclusive: inc } = pinnedCountMismatches(text, roster);
    const correct = pinnedCorrectReadings(text, roster);
    mismatches += findings.length;
    inconclusive += inc.length;
    for (const f of findings) {
      report.push(`MISMATCH ${p}:${f.line} claims ${f.claimed} tools but the procedure pins ${f.pinnedVersion}, which ships ${f.pinnedShips}`);
    }
    for (const s of inc) report.push(`INCONCLUSIVE ${p}: ${s}`);
    for (const c of correct) {
      report.push(`ok(pinned-identity) ${p}:${c.line} states ${c.stated} tools, matching the pinned ${c.pinnedVersion} - correct, do not "update" it`);
    }
  }
  return { status: mismatches > 0 ? "mismatch" : inconclusive > 0 ? "inconclusive" : "clean", mismatches, inconclusive, roster, files: files.length, report };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = run({});
  console.log(`=== pinned-vs-current tool count check (roster ${out.roster} for ${CURRENT_RELEASE}, ${out.files ?? 0} files) ===`);
  for (const line of out.report) console.log(`  ${line}`);
  console.log(`status=${out.status} mismatches=${out.mismatches} inconclusive=${out.inconclusive}`);
  if (out.status === "mismatch") process.exit(1);
  if (out.status !== "clean") process.exit(3);
}
