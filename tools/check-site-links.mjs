// Offline internal-link check for the project site.
//
// The launch pre-flight verifies the pages the published copy links, over the network, because
// liveness is the question there. This answers the other question, offline: does every relative
// `.html` reference in docs/ point at a file that exists in docs/? Renaming or deleting a page
// leaves dead navigation behind and nothing notices until a visitor clicks it.
//
//   node tools/check-site-links.mjs              # exit 1 and name each dead reference
//   node tools/check-site-links.mjs --selftest   # proves the detector catches a planted dead link
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const HREF = /href\s*=\s*["']([^"'#]+\.html)(#[^"']*)?["']/gi;

// Absolute URLs are somebody else's uptime and are checked live elsewhere; a bare `#x` is a
// same-page anchor. What is left is exactly the set this repository controls.
export function internalHtmlRefs(htmlText) {
  const refs = [];
  for (const match of String(htmlText ?? "").matchAll(HREF)) {
    const raw = match[1];
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) continue;
    if (!refs.includes(raw)) refs.push(raw);
  }
  return refs;
}

export function brokenRefs(refs, fileForRef) {
  return refs
    .filter((ref) => !existsSync(fileForRef(ref)))
    .map((ref) => ref);
}

export function checkDocsLinks(docsDir) {
  const dir = resolve(docsDir);
  const pages = readdirSync(dir).filter((name) => name.endsWith(".html")).sort();
  const rows = [];
  for (const page of pages) {
    const text = readFileSync(resolve(dir, page), "utf8");
    const refs = internalHtmlRefs(text);
    rows.push({ page, refCount: refs.length, broken: brokenRefs(refs, (ref) => resolve(dir, ref)) });
  }
  return { dir, pages, rows };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const docsIndex = argv.indexOf("--docs");
  const docsDir = docsIndex >= 0 ? argv[docsIndex + 1] : "docs";
  const result = checkDocsLinks(docsDir);
  const totalRefs = result.rows.reduce((sum, row) => sum + row.refCount, 0);
  const dead = result.rows.filter((row) => row.broken.length > 0);
  const deadCount = dead.reduce((sum, row) => sum + row.broken.length, 0);
  for (const row of dead) console.log(`BROKEN ${row.page} -> ${row.broken.join(", ")}`);
  console.log(`pages ${result.pages.length}, internal .html refs ${totalRefs}, broken ${deadCount}`);

  if (argv.includes("--selftest")) {
    // The detector has to fire on a reference only this fixture contains; otherwise "0 broken"
    // against the real site is a reading taken from an instrument nobody proved works.
    const fixture = '<a href="definitely-not-a-page-zzz.html">x</a> <a href="https://example.com/p.html">y</a> <a href="#top">z</a>';
    const planted = internalHtmlRefs(fixture);
    const detected = planted.length === 1 && planted[0] === "definitely-not-a-page-zzz.html";
    const flagged = brokenRefs(["definitely-not-a-page-zzz.html"], (ref) => resolve(docsDir, ref)).length === 1;
    const ok = detected && flagged && deadCount === 0 && totalRefs > 0;
    console.log(`selftest planted_detected=${detected} missing_flagged=${flagged} real_site_broken=${deadCount} refs=${totalRefs}`);
    console.log(ok ? "SELFTEST_OK" : "SELFTEST_FAILED");
    process.exitCode = ok ? 0 : 1;
  } else {
    process.exitCode = deadCount === 0 ? 0 : 1;
  }
}
