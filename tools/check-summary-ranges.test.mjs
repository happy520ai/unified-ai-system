import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  compareSurfaces,
  headlineOf,
  llmsBullet,
  rangesIn,
  run,
  surfaceHeadlines,
} from "./check-summary-ranges.mjs";

test("the widest interval wins the headline, not the first one written", () => {
  // The page og reads "3-7 ms" after the boot range; a matcher that took the first or the smallest
  // match would compare side notes against each other and call the headline invisible.
  assert.equal(headlineOf("Measured: 6.4-8.9 s to answer initialize, and 3-7 ms from that answer"), "6.4-8.9s");
  // ...and the Chinese notation must resolve too, or every zh surface would read as "no range quoted"
  // and be skipped - a pass that is really an exemption.
  assert.equal(headlineOf("initialize 在 6,391 到 8,914 毫秒之间应答，工具清单只晚 3 到 7 毫秒"), "6391-8914ms");
});

test("thousands separators and both dash forms normalize to one key", () => {
  const a = rangesIn("between 6,391 - 8,914 ms");
  const b = rangesIn("between 6391–8914ms");
  assert.deepEqual(a.map((r) => r.norm), b.map((r) => r.norm));
  assert.equal(a[0].norm, "6391-8914ms");
});

test("the two startup pages and their llms bullets agree as written", () => {
  const out = run();
  assert.equal(out.verdict, "consistent", JSON.stringify(out.problems));
  assert.ok(out.denominators.surfaces_compared_and_judged >= 4, `expected at least 4 judged surfaces, got ${JSON.stringify(out.denominators)}`);
});

test("a reverted llms bullet is caught, naming both figures", () => {
  const real = readFileSync("docs/llms.txt", "utf8");
  const page = readFileSync("docs/mcp-startup-timeouts.html", "utf8");
  const bullet = llmsBullet(real, "mcp-startup-timeouts.html");
  assert.ok(bullet, "the fixture needs a real bullet to tamper with");
  const stale = bullet.replace(/6\.4-8\.9 s/u, "7,630-8,461 ms");
  assert.notEqual(stale, bullet, "the tamper changed nothing, so this fixture would prove nothing");
  const rows = surfaceHeadlines({ pageHtml: page, llmsText: stale, urlFragment: "mcp-startup-timeouts.html" });
  const res = compareSurfaces(rows);
  assert.equal(res.problems.length, 1, JSON.stringify(res));
  assert.match(res.problems[0], /headlines 7630-8461ms while og:description states 6\.4-8\.9s/u);
});

test("a surface that quotes no range is skipped rather than judged", () => {
  const rows = [
    { label: "og:description", role: "reference", headline: "6.4-8.9s" },
    { label: "name=description", role: "compare", headline: "none" },
    { label: "json-ld description", role: "compare", headline: "6.4-8.9s" },
  ];
  const res = compareSurfaces(rows);
  assert.deepEqual(res.problems, []);
  assert.equal(res.evaluated, 1, "only the agreeing json-ld surface counts as judged");
});

test("an unreadable reference reports a gap instead of a false clean", () => {
  const res = compareSurfaces([
    { label: "og:description", role: "reference", headline: "unreadable" },
    { label: "llms.txt bullet", role: "compare", headline: "6.4-8.9s" },
  ]);
  assert.equal(res.problems.length, 1);
  assert.match(res.problems[0], /could not be read/u);
  assert.equal(res.evaluated, 0, "a blind run must report that it judged nothing");
});

test("a missing page is named, not silently absent from the denominator", () => {
  const out = run({ pairs: [{ file: "docs/does-not-exist.html", urlFragment: "does-not-exist.html" }] });
  assert.equal(out.problems.length, 1);
  assert.match(out.problems[0], /missing, so its summaries were not compared/u);
});
