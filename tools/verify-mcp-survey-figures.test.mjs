import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifySurveyPages } from "./verify-mcp-survey-figures.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataset = JSON.parse(readFileSync(resolve(root, "docs/data/mcp-ecosystem-measurements.json"), "utf8"));
const names = ["mcp-tools-list-pagination-survey", "mcp-protocol-revision-tolerance", "mcp-session-enforcement"];
const pages = Object.fromEntries(names.flatMap((stem) => [".md", ".html"].map((ext) => {
  const name = `${stem}${ext}`;
  return [name, readFileSync(resolve(root, "docs", name), "utf8")];
})));
pages["mcp-ecosystem-measurements.html"] = readFileSync(resolve(root, "docs/mcp-ecosystem-measurements.html"), "utf8");

test("all three survey page pairs match their saved question totals", () => {
  assert.deepEqual(verifySurveyPages({ dataset, pages }), []);
});

test("a survey denominator changed from 18 to 19 fails with a useful diagnostic", () => {
  const incorrect = {
    ...pages,
    "mcp-protocol-revision-tolerance.md": pages["mcp-protocol-revision-tolerance.md"].replace("2/18, not 2/40", "2/19, not 2/40"),
  };
  const problems = verifySurveyPages({ dataset, pages: incorrect });
  assert.ok(problems.some((problem) => problem.includes("mcp-protocol-revision-tolerance.md") && problem.includes("2/18") && problem.includes("protocol-revision-tolerance")), problems.join("\n"));
});
