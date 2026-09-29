// Does every number the Chinese ecosystem hub quotes still match the artifact that produced it?
//
// Why this exists: `tools/render-mcp-hub-zh.mjs` derives its table figures from the dataset rows, but the
// cross-links paragraph is hand-written prose - nine published figures sit in it as literals. Before this
// instrument nothing compared those literals to `docs/data/*.json`, so a re-measurement that moved a number
// would have left the Chinese page confidently quoting a stale census, with CI green. That is the same shape
// as the pinned twelve-tool markers: the document and its gate agreeing with each other and neither looking
// at the source.
//
//   node tools/check-hub-zh-figures.mjs                  # advisory: prints checked / missing / not_checked
//   node tools/check-hub-zh-figures.mjs --require-present # exit 2 if any expected phrase is absent
//   node tools/check-hub-zh-figures.mjs --selftest        # proves a moved number and a stale page both bite
//
// What this cannot do: it compares the published page to the published artifacts. It cannot tell you whether
// an artifact still describes the live registry - that is the survey instrument's job. What is not covered
// is reported under `not_checked` with its reason, rather than silently dropped, because a guard that hides
// its own gaps certifies less than it appears to.
//
// Corrected in the follow-up commit, and the correction stays in the file: the first version put the
// "785 条里 15 条" figures on the not_checked list on a guess that 785 came from excluding unsupported-host
// rows. It did not - 785 is sum(by_type.*.definite) while 791 is sum(.measured), two books of one draw, and
// both are plain field reads. They are checked now, because a guard's stated limitation is itself a claim
// about the source, and a wrong one of those is how a gap gets blessed permanently.
import { readFileSync, writeFileSync, rmSync, mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i > 0 && typeof process.argv[i + 1] === "string" ? process.argv[i + 1] : dflt;
};
const REQUIRE = process.argv.includes("--require-present");

const FILES = {
  page: arg("--page", "docs/mcp-ecosystem-measurements.zh-CN.html"),
  install: arg("--install", "docs/data/mcp-registry-installability.2026-09-28.json"),
  census: arg("--census", "docs/data/mcp-registry-census.2026-09-28.json"),
  wide: arg("--wide", "docs/data/mcp-registry-census-including-deleted.2026-09-28.json"),
  npm: arg("--npm", "docs/data/mcp-npm-installability-sample.2026-09-28.json"),
  resolve: arg("--resolve", "docs/data/mcp-package-resolve.2026-09-28.json"),
  tdqs: arg("--tdqs", "docs/data/mcp-tool-definition-quality.2026-09-28.json"),
};

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`REFUSED: cannot read artifact ${path}: ${e.message}`);
  }
}

// A field that is absent reads as `undefined`, and `undefined` compared against a page never matches - which
// would look like "the page is stale" when the real fault is a renamed artifact field. Every compared value
// is therefore required to be present and finite first.
function num(obj, dotted, where) {
  const v = dotted.split(".").reduce((acc, k) => (acc && typeof acc === "object" ? acc[k] : undefined), obj);
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`REFUSED: ${where} has no number at ${dotted}`);
  return v;
}

const fmt = (n) => n.toLocaleString("en-US");
const pct = (n) => (n * 100).toFixed(2);

function expectations() {
  const install = readJson(FILES.install);
  const census = readJson(FILES.census);
  const wide = readJson(FILES.wide);
  const npm = readJson(FILES.npm);
  const tdqs = readJson(FILES.tdqs);

  const distinctServers = num(install, "sample.distinct_servers_collected", "installability");
  const withPackage = num(install, "tally.package_present", "installability");
  const censusNames = num(census, "distinct_names", "census");
  const wideNames = num(wide, "distinct_names", "wider census");
  const neither = num(census, "active_reachability.neither", "census");
  const denom = num(census, "active_latest_records", "census");
  const pkgRecords = num(census, "active_records_with_a_package", "census");
  const frameRecords = num(npm, "frame_records", "npm sample");
  const sampleSize = num(npm, "sample_size", "npm sample");
  const published = num(npm, "verdict_tally.listed_version_published", "npm sample");
  const versionMissing = num(npm, "verdict_tally.package_exists_version_missing", "npm sample");
  const packageMissing = num(npm, "verdict_tally.package_missing", "npm sample");
  const rate = num(npm, "unusable_rate", "npm sample");
  const toolCount = num(tdqs, "tool_count", "tdqs self-audit");
  const outputSchema = num(tdqs, "totals.output_schema_present", "tdqs self-audit");
  const ci = npm.ci95;
  if (!Array.isArray(ci) || ci.length !== 2) throw new Error("REFUSED: npm sample has no two-sided ci95 to quote");

  // Checked per family, then summed: an aggregate that happens to land on the right total after a renamed
  // field would still be wrong, and the page would not say which family moved.
  const resolve = readJson(FILES.resolve);
  if (!resolve.by_type || typeof resolve.by_type !== "object") throw new Error("REFUSED: package-resolve artifact has no by_type to sum");
  let definiteSum = 0;
  let unusableSum = 0;
  let measuredSum = 0;
  for (const [family, t] of Object.entries(resolve.by_type)) {
    for (const field of ["definite", "unusable", "measured"]) {
      if (typeof t[field] !== "number" || !Number.isFinite(t[field])) throw new Error(`REFUSED: package-resolve family ${family} has no number at ${field}`);
    }
    definiteSum += t.definite;
    unusableSum += t.unusable;
    measuredSum += t.measured;
  }
  // The pooled sentence spans six artifact families - these five plus npm. npm's decided readings are its
  // draw minus whatever that probe could not decide at all.
  const npmDefinite = sampleSize - num(npm, "unresolvable", "npm sample");
  const npmUnusable = num(npm, "listed_package_unusable", "npm sample");
  const poolDefinite = definiteSum + npmDefinite;
  const poolUnusable = unusableSum + npmUnusable;

  return [
    { label: "installability 54/6 (first mention)", phrase: `字母序最靠前的 ${distinctServers} 个记录里只有 ${withPackage} 个带`, from: "installability.sample.distinct_servers_collected + tally.package_present" },
    { label: "installability 54/6 (link text)", phrase: `${distinctServers} 个去重后的记录里只有 ${withPackage} 个带 package`, from: "same two fields" },
    { label: "census distinct names", phrase: `默认视图 ${fmt(censusNames)} 个服务器；连已移除记录一起要则是 ${fmt(wideNames)} 个`, from: "census.distinct_names + wider census.distinct_names" },
    { label: "census neither-transport count", phrase: `其中 ${neither} 个（${pct(neither / denom)}%）既无 package 也无 remote`, from: "census.active_reachability.neither over active_latest_records" },
    { label: "census package share", phrase: `总体带 package 的比例是 ${pct(pkgRecords / denom)}%。`, from: "census.active_records_with_a_package over active_latest_records" },
    { label: "npm frame and draw", phrase: `从 ${fmt(frameRecords)} 条 npm 记录里抽 ${sampleSize} 条`, from: "npm.frame_records + sample_size" },
    { label: "npm installed count", phrase: `${published} 条能按注册表所列版本在 npm 上装到`, from: "npm.verdict_tally.listed_version_published" },
    { label: "npm failure split", phrase: `${versionMissing} 条版本已不存在、${packageMissing} 条包名已消失`, from: "npm.verdict_tally.package_exists_version_missing + package_missing" },
    { label: "npm rate and interval", phrase: `不可用率 ${pct(rate)}%（95% 置信区间 ${pct(ci[0])}%–${pct(ci[1])}%）`, from: "npm.unusable_rate + ci95" },
    { label: "tdqs outputSchema self-audit", phrase: `我们的 ${toolCount} 个工具里，${outputSchema} 个声明 outputSchema`, from: "tdqs.tool_count + totals.output_schema_present" },
    { label: "resolve decided/failed counts", phrase: `${fmt(definiteSum)} 条里 ${unusableSum} 条解析不了`, from: "sum of package-resolve by_type.*.definite and .unusable; the same artifact's .measured sums to " + fmt(measuredSum) + " entries, which is a different book and is why the page says both" },
    { label: "resolve pooled rate over six families", phrase: `六类合计不可用率 ${pct(poolUnusable / poolDefinite)}%`, from: `(${unusableSum} + npm ${npmUnusable}) over (${fmt(definiteSum)} + npm ${npmDefinite}) = ${poolUnusable}/${poolDefinite}` },
  ];
}

const NOT_CHECKED = [
  { label: "the Wilson brackets quoted next to these rates (pooled 1.24%–2.99%, and each family's bracket)", reason: "each interval is recomputed from (unusable, definite) by that page's own renderer. Putting a second Wilson implementation here would create two formulas that can disagree, and the guard would then be arguing arithmetic instead of reporting drift. The counts every interval is built from are checked." },
];

function report(page, expects) {
  const missing = expects.filter((e) => !page.includes(e.phrase));
  return {
    page: FILES.page,
    checked: expects.length - missing.length,
    expected_total: expects.length,
    missing: missing.map((m) => m.label + ": expected `" + m.phrase + "` (from " + m.from + ")"),
    not_checked: NOT_CHECKED,
    verdict: missing.length === 0 ? "consistent" : "page disagrees with its artifacts",
  };
}

function selftest() {
  const page = readFileSync(FILES.page, "utf8");
  const expects = expectations();
  const problems = [];
  const clean = report(page, expects);
  if (clean.checked !== clean.expected_total) problems.push("baseline: expected every phrase to be present, got " + clean.checked + "/" + clean.expected_total + " - " + clean.missing.join("; "));

  // Arm 1: the page moved a number on its own. One character changed in a copy of the published text.
  const stalePage = page.replace("默认视图 37,013 个服务器", "默认视图 37,014 个服务器");
  if (stalePage === page) problems.push("arm 1 fixture did not change any bytes");
  const r1 = report(stalePage, expects);
  if (r1.missing.length !== 1 || !/census distinct names/.test(r1.missing[0])) problems.push("arm 1: a one-star census change must make exactly this phrase missing, got " + JSON.stringify(r1.missing));

  // Arm 2: the artifact moved and the page did not follow. Same expected strings, rebuilt from a edited copy.
  const censusRaw = JSON.parse(readFileSync(FILES.census, "utf8"));
  censusRaw.distinct_names = censusRaw.distinct_names + 1;
  // Scratch goes to the OS temp dir, never to docs/data/: a selftest that dies mid-arm must not leave an
  // untracked file inside the published artifact directory.
  const tmp = join(mkdtempSync(join(tmpdir(), "hubzh-")), "census.json");
  writeFileSync(tmp, JSON.stringify(censusRaw), "utf8");
  const saved = FILES.census;
  FILES.census = tmp;
  let r2;
  try {
    r2 = report(readFileSync(FILES.page, "utf8"), expectations());
  } finally {
    FILES.census = saved;
    rmSync(tmp, { force: true });
  }
  if (r2.missing.length !== 1 || !/census distinct names/.test(r2.missing[0])) problems.push("arm 2: an artifact-only change must make exactly this phrase missing, got " + JSON.stringify(r2.missing));
  if (existsSync(tmp)) problems.push("arm 2 left its scratch artifact behind");

  console.log(JSON.stringify({ selftest: problems.length === 0, arms: 2, problems }, null, 2));
  return problems.length === 0 ? 0 : 7;
}

function main() {
  let page;
  try {
    page = readFileSync(FILES.page, "utf8");
  } catch (e) {
    console.error(`REFUSED: cannot read the published page ${FILES.page}: ${e.message}`);
    return 3;
  }
  let expects;
  try {
    expects = expectations();
  } catch (e) {
    console.error(e.message);
    return 3;
  }
  const out = report(page, expects);
  console.log(JSON.stringify(out, null, 2));
  if (out.missing.length && REQUIRE) {
    console.error("REFUSED: " + out.missing.join("\n  - "));
    return 2;
  }
  return 0;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) process.exit(process.argv.includes("--selftest") ? selftest() : main());
