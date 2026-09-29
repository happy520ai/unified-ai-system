import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dateOnlyProof, fileForLoc, refresh } from "./refresh-sitemap-dates.mjs";

// The tool's logic is tested with an injected reader, so these arms behave identically in a deep clone and in
// the single-commit checkout the Windows job uses. Only the last arm touches git, and it says so when it cannot.
const xml = `<urlset>
  <url>
    <loc>https://example.test/a.html</loc>
    <lastmod>2026-01-01</lastmod>
  </url>
  <url>
    <loc>https://example.test/b.html</loc>
    <lastmod>2026-01-02</lastmod>
  </url>
  <url>
    <loc>https://example.test/c.html</loc>
  </url>
  <url>
    <loc>https://example.test/d.html</loc>
    <lastmod>2026-01-04</lastmod>
  </url>
</urlset>`;

const reader = (p) => {
  if (p.endsWith("b.html")) return { day: "2026-01-02", sha: "deadbeef" }; // already current
  if (p.endsWith("c.html")) return { day: "2026-01-03", sha: "cafe0000" }; // no lastmod at all
  if (p.endsWith("d.html")) return { error: "history truncated at 12345678" };
  return { day: "2026-02-02", sha: "12345678" };
};

test("a stale lastmod is replaced in place, and a current one is left alone", () => {
  const { next, changes, unchecked } = refresh(xml, reader);
  // c.html is in this fixture too, with no lastmod at all, so it is a change as well - listed here rather
  // than filtered out, because the count of moved pages is the thing a later edit is most likely to break.
  assert.deepEqual(changes.map((c) => [c.file, c.from, c.to]), [["a.html", "2026-01-01", "2026-02-02"], ["c.html", "(absent)", "2026-01-03"]]);
  assert.match(next, /a\.html<\/loc>\n\s*<lastmod>2026-02-02<\/lastmod>/u);
  assert.ok(next.includes("<lastmod>2026-01-02</lastmod>"), "b.html was already current and must not be rewritten");
  assert.equal(unchecked.length, 1);
});

test("a page with no lastmod gains one after its loc", () => {
  const { next, changes } = refresh(xml, reader);
  assert.deepEqual(changes.find((c) => c.file === "c.html").from, "(absent)");
  assert.match(next, /c\.html<\/loc>\n\s*<lastmod>2026-01-03<\/lastmod>/u);
});

test("an unreadable history is reported as unchecked, never stamped with the boundary date", () => {
  const { next, changes, unchecked } = refresh(xml, reader);
  assert.equal(unchecked[0], "d.html: history truncated at 12345678");
  assert.ok(!changes.some((c) => c.file === "d.html"), "a truncated reading must not become a published date");
  assert.ok(next.includes("<lastmod>2026-01-04</lastmod>"), "the untouched block must keep its original bytes");
});

test("refreshing changes only lastmod lines and never the URL set", () => {
  const { next } = refresh(xml, reader);
  assert.equal((next.match(/<loc>/gu) || []).length, (xml.match(/<loc>/gu) || []).length);
  assert.equal((next.match(/<url>/gu) || []).length, (xml.match(/<url>/gu) || []).length);
  // Deleting the inserted line and restoring the replaced one must give the original bytes back. Line counts are
  // not the invariant, because a page that had no lastmod gains a line - that is the point of the tool.
  const lines = next.split("\n");
  const inserted = lines.filter((l) => /<lastmod>2026-01-03</u.test(l));
  assert.equal(inserted.length, 1, "the fixture must have inserted exactly one new lastmod line");
  const restored = lines
    .filter((l) => l !== inserted[0])
    .map((l) => l.replace("<lastmod>2026-02-02<", "<lastmod>2026-01-01<"))
    .join("\n");
  assert.equal(restored, xml, "undoing the date changes must reproduce the input byte for byte");
});

test("the shipped sitemap carries no page whose lastmod lags its own commit", () => {
  const depth = Number(spawnSync("git", ["rev-list", "--count", "HEAD"], { encoding: "utf8" }).stdout.trim());
  const shipped = readFileSync("docs/sitemap.xml", "utf8");
  const { changes, unchecked, unmapped, blocks, accounted } = refresh(shipped);
  const dated = blocks - unchecked.length;
  // Print what this checkout could actually see. "changes is empty" only means "nothing is stale" if some page
  // was datable; without this line a blind run and a clean run read the same in the log.
  console.log(`DATED ${dated} of ${blocks} url blocks (clone depth ${depth})`);
  assert.deepEqual(changes, [], "these pages need their lastmod refreshed: " + JSON.stringify(changes));
  // The coverage identity is what makes "no changes" mean "nothing is stale" rather than "nothing was read".
  assert.deepEqual(unmapped, [], "a <url> block this tool cannot map would be silently undated");
  assert.equal(accounted, blocks, "every url block must land in stamped, current, or unchecked");
  assert.ok(blocks >= 31, "the shipped sitemap should still declare the whole site, saw " + blocks);
  // The floor is gated on depth, not on faith: a two-commit CI checkout genuinely cannot date most files,
  // while a deep checkout that dates almost nothing is the tool failing and must say so.
  if (depth >= 5) assert.ok(dated >= 20, "a deep checkout should date most of the site, saw " + dated + " of " + blocks);
  if (unchecked.length > 0) console.log("NOT CHECKED (truncated history): " + unchecked.slice(0, 3).join("; ") + (unchecked.length > 3 ? ` … (${unchecked.length} total)` : ""));
});

test("the site root is a page with a date, not a loc that does not match", () => {
  // The defect this arm exists for: the root is written <loc>https://…/unified-ai-system/</loc>, which has no
  // filename, and the first version of the tool required one. The homepage's own lastmod therefore froze at
  // 2026-09-26 while every run reported "already current" - the most-crawled URL on the site, undated, silent.
  assert.equal(fileForLoc("https://happy520ai.github.io/unified-ai-system/"), "index.html");
  assert.equal(fileForLoc("https://happy520ai.github.io/unified-ai-system/index.zh-CN.html"), "index.zh-CN.html");
  assert.equal(fileForLoc("https://happy520ai.github.io/unified-ai-system/docs/a.html"), "a.html");
  // A loc that names no file under docs/ is not skipped; it is reported and stops the run.
  assert.equal(fileForLoc("https://happy520ai.github.io/unified-ai-system/feed.xml"), null);
  assert.equal(fileForLoc(""), null);

  const rooted = `<urlset>
  <url>
    <loc>https://example.test/</loc>
    <lastmod>2026-01-01</lastmod>
  </url>
</urlset>`;
  const seen = [];
  const { changes, blocks, accounted } = refresh(rooted, (p) => { seen.push(p); return { day: "2026-05-05", sha: "abc12345" }; });
  assert.deepEqual(seen, ["docs/index.html"], "the bare root must be read as docs/index.html");
  assert.deepEqual(changes.map((c) => [c.file, c.to]), [["index.html", "2026-05-05"]]);
  assert.equal(accounted, blocks, "one block in, one block accounted for");

  // Always decidable, at any clone depth: the root block is inside the tool's scope, so it must land in one
  // of stamped / current / unchecked. This is the arm the Windows job (which checks out a single commit and so
  // can date nothing) actually runs. The first version of this test forgot it and asked for a changed date
  // instead, which is a reading no one-deep clone can produce - it failed there on the commit that shipped it.
  const shipped = readFileSync("docs/sitemap.xml", "utf8");
  const scope = refresh(shipped);
  assert.deepEqual(scope.unmapped, [], "the shipped sitemap must contain no loc the tool cannot map");
  assert.equal(scope.accounted, scope.blocks,
    "every url block must be stamped, current or unchecked - never skipped: " + JSON.stringify(scope.unchecked));

  // The accounting itself, proved without git: a block that is neither stamped, current, nor unchecked has to
  // leave `accounted` short of `blocks`. Without this pair the invariant above is only ever observed to be true.
  const mixed = `<urlset>
  <url>
    <loc>https://example.test/a.html</loc>
    <lastmod>2026-01-01</lastmod>
  </url>
  <url>
    <loc>https://example.test/feed.xml</loc>
  </url>
</urlset>`;
  const counted = refresh(mixed, reader);
  assert.equal(counted.blocks, 2);
  assert.equal(counted.accounted, 1, "the unmappable block is not accounted, which is what makes the skip visible");
  assert.deepEqual(counted.unmapped, ["https://example.test/feed.xml"]);
  if (scope.unchecked.some((u) => u.startsWith("index.html:"))) {
    // Gated on the tool's own verdict for THIS file, not on a commit count. The first guard said "more than one
    // commit", which is true of the two-commit checkout CI uses while docs/index.html's own last change still
    // falls outside the graft - so the arm ran there and could only fail. If the page cannot be dated, no
    // staleness can be required of it, and that is a skip rather than a pass.
    console.log("SKIPPED root staleness arm: this checkout cannot date docs/index.html - " +
      scope.unchecked.find((u) => u.startsWith("index.html:")));
    return;
  }
  const staled = shipped.replace("<loc>https://happy520ai.github.io/unified-ai-system/</loc>\n    <lastmod>2026-09-29</lastmod>",
    "<loc>https://happy520ai.github.io/unified-ai-system/</loc>\n    <lastmod>2026-01-01</lastmod>");
  assert.notEqual(staled, shipped, "fixture precondition: the shipped root must currently be dated 2026-09-29");
  assert.deepEqual(refresh(staled).changes.map((c) => c.file), ["index.html"], "a stale root must be caught, not skipped");
});

test("--check refuses a stale page and accepts the shipped tree, writing nothing", () => {
  // The scheduled defense. Both halves are needed: a check that only ever passes on the current tree is
  // indistinguishable from a check that looks at nothing.
  const depth = Number(spawnSync("git", ["rev-list", "--count", "HEAD"], { encoding: "utf8" }).stdout.trim());
  if (depth < 5) {
    console.log("SKIPPED --check arms: this checkout dates too few pages to require freshness of all of them");
    return;
  }
  const clean = spawnSync(process.execPath, ["tools/refresh-sitemap-dates.mjs", "--check"], { encoding: "utf8" });
  assert.equal(clean.status, 0, clean.stdout + clean.stderr);
  assert.match(clean.stderr, /OK \(--check\): \d+ url blocks dated against git/u);

  const dir = mkdtempSync(join(tmpdir(), "sitemap-check-"));
  const fixture = join(dir, "stale.xml");
  const shipped = readFileSync("docs/sitemap.xml", "utf8");
  const staled = shipped.replace("<loc>https://happy520ai.github.io/unified-ai-system/</loc>\n    <lastmod>2026-09-29</lastmod>",
    "<loc>https://happy520ai.github.io/unified-ai-system/</loc>\n    <lastmod>2026-01-01</lastmod>");
  assert.notEqual(staled, shipped, "fixture precondition: the shipped root must be dated 2026-09-29");
  writeFileSync(fixture, staled, "utf8");
  const before = readFileSync(fixture, "utf8");
  const bad = spawnSync(process.execPath, ["tools/refresh-sitemap-dates.mjs", "--check", "--sitemap", fixture], { encoding: "utf8" });
  assert.equal(bad.status, 4, bad.stdout + bad.stderr);
  assert.match(bad.stderr, /STALE index\.html: published 2026-01-01/u);
  assert.equal(readFileSync(fixture, "utf8"), before, "--check must never write the fix it is reporting");
});

test("the nightly job actually runs the freshness check, on full history", () => {
  // Wiring asserted from the workflow file, because a step that was deleted in a later edit would otherwise
  // take the only deep-history run of this guard with it silently.
  const yml = readFileSync(".github/workflows/star-growth-snapshot.yml", "utf8");
  assert.match(yml, /fetch-depth: 0/u, "the snapshot job must fetch full history, or the check dates almost nothing");
  assert.match(yml, /node tools\/refresh-sitemap-dates\.mjs --check/u, "the job must run the freshness check");
  const stepIndex = yml.indexOf("refresh-sitemap-dates.mjs --check");
  const checkoutIndex = yml.indexOf("fetch-depth: 0");
  assert.ok(checkoutIndex >= 0 && checkoutIndex < stepIndex, "the fetch-depth must be on the checkout that precedes the check");
  assert.equal((yml.match(/fetch-depth: 0/gu) || []).length, 1, "exactly one full-history fetch, and it must be the one this step uses");
});

test("an unmappable loc stops the CLI instead of passing quietly", () => {
  const dir = mkdtempSync(join(tmpdir(), "sitemap-map-"));
  const fixture = join(dir, "sitemap.xml");
  const unmappable = `<urlset>
  <url>
    <loc>https://happy520ai.github.io/unified-ai-system/</loc>
  </url>
  <url>
    <loc>https://happy520ai.github.io/unified-ai-system/feed.xml</loc>
  </url>
</urlset>`;
  writeFileSync(fixture, unmappable, "utf8");
  const depth = Number(spawnSync("git", ["rev-list", "--count", "HEAD"], { encoding: "utf8" }).stdout.trim());
  if (depth <= 1) {
    console.log("SKIPPED CLI refusal arm: a one-commit clone cannot date anything, so it would fail for the wrong reason");
    return;
  }
  const r = spawnSync(process.execPath, ["tools/refresh-sitemap-dates.mjs", "--dry", "--sitemap", fixture], { encoding: "utf8" });
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stderr, /cannot map to a file in docs\//u);
  assert.match(r.stderr, /feed\.xml/u, "the refusal has to name the entry it could not read: " + r.stderr);

  // Boundary arm: the same fixture with the unmappable block removed must succeed, so the refusal above is
  // about the loc and not about the tool always failing on a file it did not write.
  const mappable = unmappable.replace(/  <url>\s*<loc>[^<]*feed\.xml<\/loc>\s*<\/url>\n/u, "");
  const ok = join(dir, "ok.xml");
  writeFileSync(ok, mappable, "utf8");
  const good = spawnSync(process.execPath, ["tools/refresh-sitemap-dates.mjs", "--dry", "--sitemap", ok], { encoding: "utf8" });
  assert.equal(good.status, 0, good.stdout + good.stderr);
  assert.match(good.stdout, /"url_blocks": 1/u);
});

test("the date-only proof accepts a refresh and rejects a structural edit", () => {
  const { next } = refresh(xml, reader);
  assert.equal(dateOnlyProof(xml, next).ok, true, "a legitimate refresh must satisfy its own guard");
  // Two ways this tool could damage the file it is not supposed to touch, both invisible to a line count.
  const movedUrl = next.replace("<loc>https://example.test/b.html</loc>", "<loc>https://example.test/z.html</loc>");
  const urlProof = dateOnlyProof(xml, movedUrl);
  assert.equal(urlProof.ok, false);
  assert.match(urlProof.reason, /not a lastmod change/u);
  const droppedPage = next.replace(/<url>\s*<loc>https:\/\/example\.test\/c\.html<\/loc>[\s\S]*?<\/url>/u, "");
  const dropProof = dateOnlyProof(xml, droppedPage);
  assert.equal(dropProof.ok, false, "removing a page must not pass a date-refresh guard");
});
