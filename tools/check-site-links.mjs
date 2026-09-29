// Offline internal-link check for the project site.
//
// The launch pre-flight verifies the pages the published copy links, over the network, because
// liveness is the question there. This answers the other question, offline: does every reference to
// our own site point at a file that exists in docs/? Renaming or deleting a page leaves dead
// navigation behind and nothing notices until a visitor clicks it.
//
// Two address forms reach docs/: the relative `index.html` a normal page writes, and the
// site-root-absolute `/unified-ai-system/index.html` that docs/404.html has to write - see the depth
// rule below. Both are checked, because both are ours to serve.
//
//   node tools/check-site-links.mjs              # exit 1 and name each dead reference
//   node tools/check-site-links.mjs --selftest   # proves each detector catches a planted defect
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// The path GitHub Pages mounts this repository under. A reference starting with anything else is not
// ours to serve, and is reported as a miss rather than silently skipped.
export const SITE_ROOT = "/unified-ai-system/";

export const HREF = /href\s*=\s*["']([^"'#]+\.html)(#[^"']*)?["']/gi;

const LINK_ATTR = /(?:href|src)\s*=\s*["']([^"'#][^"']*)["']/giu;

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

// Every reference a page makes to something this site serves: pages, styles, icons, the sitemap, the
// machine-readable text. Unlike internalHtmlRefs this is not limited to `.html`, because the 404 rule
// below has to cover the stylesheet too - an unstyled error page is still a broken page.
export function ownSiteRefs(htmlText) {
  const refs = [];
  for (const match of String(htmlText ?? "").matchAll(LINK_ATTR)) {
    const raw = match[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) continue; // https:, mailto:, data:, tel:
    if (raw.startsWith("//")) continue; // protocol-relative: somebody else's host
    if (!refs.some((r) => r.raw === raw)) refs.push({ raw, rooted: raw.startsWith("/"), page: raw.endsWith(".html") });
  }
  return refs;
}

// The file a reference resolves to, or null when the site cannot serve that address at all.
export function ownTarget(dir, raw) {
  const bare = String(raw).split("#")[0].split("?")[0];
  if (bare.startsWith("/")) {
    if (!bare.startsWith(SITE_ROOT)) return null;
    return resolve(dir, bare.slice(SITE_ROOT.length));
  }
  return resolve(dir, bare);
}

// A page served at one fixed address can write relative links. docs/404.html cannot: GitHub Pages
// answers it in place of *any* missing path, at any depth, and with no <base> the browser resolves
// relative hrefs against the address the visitor got wrong. The page that exists to rescue a dead
// link then emits nothing but dead links - which is how this rule was found, live, at depth two.
export const ARBITRARY_DEPTH_PAGES = ["404.html"];

export function unrootedOwnRefs(htmlText) {
  return ownSiteRefs(htmlText).filter((ref) => !ref.rooted).map((ref) => ref.raw);
}

export function brokenRefs(refs, fileForRef) {
  return refs
    .filter((ref) => {
      const target = fileForRef(ref);
      return target === null || !existsSync(target);
    })
    .map((ref) => ref);
}

export function checkDocsLinks(docsDir) {
  const dir = resolve(docsDir);
  const pages = readdirSync(dir).filter((name) => name.endsWith(".html")).sort();
  const rows = [];
  for (const page of pages) {
    const text = readFileSync(resolve(dir, page), "utf8");
    const refs = internalHtmlRefs(text);
    const row = {
      page,
      refCount: refs.length,
      broken: brokenRefs(refs, (ref) => ownTarget(dir, ref)),
      ownBroken: brokenRefs(ownSiteRefs(text).map((r) => r.raw), (ref) => ownTarget(dir, ref)),
    };
    if (ARBITRARY_DEPTH_PAGES.includes(page)) row.unrooted = unrootedOwnRefs(text);
    rows.push(row);
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
  const ownDead = result.rows.filter((row) => row.ownBroken.length > 0);
  const ownDeadCount = ownDead.reduce((sum, row) => sum + row.ownBroken.length, 0);
  const shallow = result.rows.filter((row) => row.unrooted && row.unrooted.length > 0);
  const shallowCount = shallow.reduce((sum, row) => sum + row.unrooted.length, 0);
  for (const row of dead) console.log(`BROKEN ${row.page} -> ${row.broken.join(", ")}`);
  for (const row of ownDead) {
    if (row.broken.length === row.ownBroken.length) continue; // already named above
    console.log(`BROKEN-ASSET ${row.page} -> ${row.ownBroken.join(", ")}`);
  }
  for (const row of shallow) console.log(`DEPTH-UNSAFE ${row.page} -> ${row.unrooted.join(", ")}`);
  console.log(`pages ${result.pages.length}, internal .html refs ${totalRefs}, broken ${deadCount}, ` +
    `own-site refs including assets ${ownDeadCount} broken, relative refs on arbitrary-depth pages ${shallowCount}`);

  if (argv.includes("--selftest")) {
    // Each detector has to fire on a reference only its fixture contains; otherwise "0 problems"
    // against the real site is a reading taken from an instrument nobody proved works.
    const fixture = '<a href="definitely-not-a-page-zzz.html">x</a> <a href="https://example.com/p.html">y</a> <a href="#top">z</a>';
    const planted = internalHtmlRefs(fixture);
    const detected = planted.length === 1 && planted[0] === "definitely-not-a-page-zzz.html";
    const flagged = brokenRefs(["definitely-not-a-page-zzz.html"], (ref) => ownTarget(docsDir, ref)).length === 1;
    // The rooted form must resolve, and a foreign root must not - otherwise the fix that made the
    // 404 page readable would be indistinguishable from a checker that stopped looking.
    const rootedResolves = brokenRefs([SITE_ROOT + "index.html"], (ref) => ownTarget(docsDir, ref)).length === 0;
    const foreignRefused = brokenRefs(["/some-other-site/index.html"], (ref) => ownTarget(docsDir, ref)).length === 1;
    const depthFixture = '<link rel="stylesheet" href="site.css" /><a href="index.html">x</a>';
    const depthDetected = unrootedOwnRefs(depthFixture).length === 2;
    const depthIgnoresRooted = unrootedOwnRefs('<a href="' + SITE_ROOT + 'index.html">x</a><a href="#top">y</a>').length === 0;
    const ok = detected && flagged && rootedResolves && foreignRefused && depthDetected && depthIgnoresRooted
      && deadCount === 0 && ownDeadCount === 0 && shallowCount === 0 && totalRefs > 0;
    console.log(`selftest planted_detected=${detected} missing_flagged=${flagged} rooted_resolves=${rootedResolves}` +
      ` foreign_root_refused=${foreignRefused} depth_fires=${depthDetected} depth_ignores_rooted=${depthIgnoresRooted}` +
      ` real_site_broken=${deadCount} real_site_asset_broken=${ownDeadCount} real_site_depth_unrooted=${shallowCount}` +
      ` refs=${totalRefs}`);
    console.log(ok ? "SELFTEST_OK" : "SELFTEST_FAILED");
    process.exitCode = ok ? 0 : 1;
  } else {
    process.exitCode = deadCount === 0 && ownDeadCount === 0 && shallowCount === 0 ? 0 : 1;
  }
}
