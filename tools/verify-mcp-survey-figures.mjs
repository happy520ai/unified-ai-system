import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DATASET = resolve(ROOT, "docs/data/mcp-ecosystem-measurements.json");
const PAGES = [
  { id: "tools-list-pagination", stem: "mcp-tools-list-pagination-survey", checks: (q) => [
    ["attempted", `Of ${q.attempted} attempted`],
    ["single_page", `The ${q.verdicts.single_page} that answered`],
    ["pagination count and denominator", `0 of ${q.verdicts.single_page} emitted nextCursor`],
    ["auth_required", `${q.verdicts.auth_required} of ${q.attempted}`],
    ["early failures", `${q.verdicts.rejected + q.verdicts.no_result_502} more failed before tools/list`],
    ["not asked", `${q.attempted - q.verdicts.single_page} were never asked`],
  ] },
  { id: "protocol-revision-tolerance", stem: "mcp-protocol-revision-tolerance", checks: (q) => {
    const jsonRpcAnswers = q.attempted - q.verdicts.auth_required - q.verdicts.no_version_502;
    const impossible = q.verdicts.AGREED_TO_THE_IMPOSSIBLE;
    const correct = jsonRpcAnswers - impossible;
    return [
      ["JSON-RPC answer denominator", `Of the ${jsonRpcAnswers} that produced a JSON-RPC answer`],
      ["AGREED_TO_THE_IMPOSSIBLE", `${impossible}/${jsonRpcAnswers}`],
      ["correct versus unchecked", `${correct} behaved correctly and ${impossible} did not check`],
      ["answered denominator", `${jsonRpcAnswers} observations`],
      ["substituted_supported_version", `${q.verdicts.substituted_supported_version} chose 2025-06-18`],
      ["answered_2025-11-25", `${q.verdicts["answered_2025-11-25"]} chose 2025-11-25`],
      ["error_object", `${q.verdicts.error_object} rejected the request outright`],
      ["answered_2024-11-05", `${q.verdicts["answered_2024-11-05"]} chose 2024-11-05`],
      ["auth_required", `${q.verdicts.auth_required} of the 40`],
      ["no_version_502", `A ${q.attempted - q.verdicts.auth_required}th endpoint returned 502`],
      ["attempted", `${q.attempted}`],
    ];
  } },
  { id: "session-enforcement", stem: "mcp-session-enforcement", checks: (q) => {
    const answered = q.attempted - q.verdicts.auth_required - q.verdicts.init_failed_400 - q.verdicts.init_failed_502;
    return [
      ["enforced", `${q.verdicts.enforced} of ${answered}`],
      ["ignored issued session", `${q.verdicts.issued_ignored ?? 0} of ${q.verdicts.enforced}`],
      ["auth_required", `${q.verdicts.auth_required} of ${q.attempted}`],
      ["no_session_issued", `served tools/list without one ${q.verdicts.no_session_issued}`],
      ["initialize failures", `failed (400, 502) ${q.verdicts.init_failed_400 + q.verdicts.init_failed_502}`],
      ["stateful sample size", `n=${q.verdicts.enforced}`],
      ["attempted", `${q.attempted}`],
    ];
  } },
];

function plainText(source, extension) {
  // Named entities decode first and &amp; decodes last, so a double-encoded
  // sequence like "&amp;lt;" unescapes exactly once instead of twice.
  if (extension === ".html") return source.replace(/<[^>]*>/g, " ").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
  return source.replace(/\|/g, " ").replace(/\s+/g, " ");
}

function comparable(text) {
  return text.replace(/\*\*/g, "").replace(/`/g, "").replace(/\\/g, "").replace(/\|/g, " ").replace(/\s*([(),])\s*/g, "$1").replace(/\s+/g, " ");
}

export function verifySurveyPages({ dataset, pages }) {
  const problems = [];
  for (const spec of PAGES) {
    const question = dataset.questions.find((entry) => entry.id === spec.id);
    if (!question) {
      problems.push(`dataset is missing question ${spec.id}`);
      continue;
    }
    const sum = Object.values(question.verdicts).filter(Number.isFinite).reduce((a, b) => a + b, 0);
    if (sum !== question.attempted) problems.push(`${spec.id}: category totals sum to ${sum}, attempted is ${question.attempted}`);
    for (const ext of [".md", ".html"]) {
      const key = `${spec.stem}${ext}`;
      const source = pages[key];
      if (typeof source !== "string") {
        problems.push(`${key}: page is missing`);
        continue;
      }
      const page = comparable(plainText(source, ext));
      for (const [claim, fragment] of spec.checks(question, question.attempted)) {
        if (!page.includes(comparable(fragment))) problems.push(`${key}: claim for ${claim} should include “${fragment}” (dataset question ${spec.id}, attempted=${question.attempted}, verdicts=${JSON.stringify(question.verdicts)})`);
      }
    }
  }
  const byId = Object.fromEntries(dataset.questions.map((question) => [question.id, question]));
  const responseCounts = [
    byId["tools-list-pagination"]?.verdicts.single_page,
    byId["protocol-revision-tolerance"] && byId["protocol-revision-tolerance"].attempted - byId["protocol-revision-tolerance"].verdicts.auth_required - byId["protocol-revision-tolerance"].verdicts.no_version_502,
    byId["session-enforcement"] && byId["session-enforcement"].attempted - byId["session-enforcement"].verdicts.auth_required - byId["session-enforcement"].verdicts.init_failed_400 - byId["session-enforcement"].verdicts.init_failed_502,
  ].filter(Number.isFinite);
  const overview = pages["mcp-ecosystem-measurements.html"];
  if (typeof overview !== "string") problems.push("mcp-ecosystem-measurements.html: page is missing");
  else if (responseCounts.length !== 3) problems.push("mcp-ecosystem-measurements.html: cannot derive the answered range from all three dataset questions");
  else {
    const range = `n is ${Math.min(...responseCounts)}-${Math.max(...responseCounts)}, not ${byId["tools-list-pagination"]?.attempted}`;
    if (!comparable(plainText(overview, ".html")).includes(comparable(range))) problems.push(`mcp-ecosystem-measurements.html: response range should include “${range}”, derived from the three dataset questions (${responseCounts.join(", ")})`);
  }
  return problems;
}

function main() {
  const dataset = JSON.parse(readFileSync(DATASET, "utf8"));
  const pages = {};
  for (const spec of PAGES) for (const ext of [".md", ".html"]) {
    const key = `${spec.stem}${ext}`;
    pages[key] = readFileSync(resolve(ROOT, "docs", key), "utf8");
  }
  pages["mcp-ecosystem-measurements.html"] = readFileSync(resolve(ROOT, "docs/mcp-ecosystem-measurements.html"), "utf8");
  const problems = verifySurveyPages({ dataset, pages });
  if (problems.length) {
    for (const problem of problems) console.error(`MISMATCH: ${problem}`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK: ${PAGES.length} survey questions match their .md and .html pages, including attempted and verdict totals`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
