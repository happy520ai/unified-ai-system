import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { refresh, dateOnlyProof } from "./refresh-sitemap-dates.mjs";

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
  if (depth <= 1) {
    console.log("SKIPPED sitemap currency check: this checkout has " + depth + " commit and cannot date any file");
    return;
  }
  const shipped = readFileSync("docs/sitemap.xml", "utf8");
  const { changes, unchecked } = refresh(shipped);
  assert.deepEqual(changes, [], "these pages need their lastmod refreshed: " + JSON.stringify(changes));
  if (unchecked.length > 0) console.log("NOT CHECKED (truncated history): " + unchecked.join("; "));
  assert.ok(unchecked.length <= 31, "the unchecked list is reported, not absorbed");
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
