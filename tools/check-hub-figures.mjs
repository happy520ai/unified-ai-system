// Does every measurement the ecosystem hub quotes - in either language - still match the artifact that
// produced it?
//
// Why this exists: the hub tables are derived from dataset rows and the renderer refuses when a tally
// disagrees with the row count, but the surrounding prose in both `docs/mcp-ecosystem-measurements.html`
// and its zh-CN twin carries its figures as literals. Nothing compared those literals to `docs/data/*.json`,
// so a re-measurement that moved a number would have left the pages confidently quoting a stale census with
// CI green. That is the twelve-tool-marker shape: page and gate agreeing with each other, neither reading
// the source.
//
//   node tools/check-hub-figures.mjs                       # advisory, both languages
//   node tools/check-hub-figures.mjs --lang en             # one page
//   node tools/check-hub-figures.mjs --require-present     # exit 2 if any expected phrase is absent
//   node tools/check-hub-figures.mjs --selftest            # proves a moved number and a stale page both bite
//
// Matching runs on tag-stripped, whitespace-collapsed text, because the published sentences contain inline
// anchors: matching raw HTML would make the guard sensitive to markup the figure does not depend on.
//
// What this cannot do: it compares published pages to published artifacts. It cannot say whether an artifact
// still describes the live registry - that is the survey instrument's job. Uncovered figures are printed
// under `not_checked` with their reason rather than dropped, because a guard that hides its own gaps
// certifies less than it appears to.
//
// Corrected in 136575fa, and the correction stays: this file's first version put the resolve 785/15 figures
// on the not_checked list on a guess that 785 came from excluding unsupported-host rows. It did not - 785 is
// sum(by_type.*.definite) while 791 is sum(.measured), two books of one draw, both plain field reads. A
// guard's stated limitation is itself a claim about the source, and a wrong one is how a gap gets blessed.
import { readFileSync, writeFileSync, rmSync, mkdtempSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i > 0 && typeof process.argv[i + 1] === "string" ? process.argv[i + 1] : dflt;
};
const REQUIRE = process.argv.includes("--require-present");
const LANG = arg("--lang", "both");

const FILES = {
  en: arg("--page-en", "docs/mcp-ecosystem-measurements.html"),
  zh: arg("--page", arg("--page-zh", "docs/mcp-ecosystem-measurements.zh-CN.html")),
  install: arg("--install", "docs/data/mcp-registry-installability.2026-09-28.json"),
  census: arg("--census", "docs/data/mcp-registry-census.2026-09-28.json"),
  wide: arg("--wide", "docs/data/mcp-registry-census-including-deleted.2026-09-28.json"),
  npm: arg("--npm", "docs/data/mcp-npm-installability-sample.2026-09-28.json"),
  resolve: arg("--resolve", "docs/data/mcp-package-resolve.2026-09-28.json"),
  tdqs: arg("--tdqs", "docs/data/mcp-tool-definition-quality.2026-09-28.json"),
  llms: arg("--llms", "docs/llms.txt"),
  measure: arg("--measure", "docs/data/mcp-ecosystem-measurements.json"),
  measureDated: arg("--measure-dated", "docs/data/mcp-ecosystem-measurements.2026-09-28.json"),
};

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`REFUSED: cannot read artifact ${path}: ${e.message}`);
  }
}

// A field that is absent reads as `undefined`, and `undefined` never matches a page - which would look like
// "the page is stale" when the real fault is a renamed artifact field. Every compared value must be present
// and finite before it is compared.
function num(obj, dotted, where) {
  const v = dotted.split(".").reduce((acc, k) => (acc && typeof acc === "object" ? acc[k] : undefined), obj);
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`REFUSED: ${where} has no number at ${dotted}`);
  return v;
}

const fmt = (n) => n.toLocaleString("en-US");
const pct = (n) => (n * 100).toFixed(2);
const strip = (html) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

// Head figures need their own reader: `strip` deletes tags, and a <meta> carries its sentence inside the
// tag, so every head description on these pages is invisible to the prose matcher above.
const HEAD_KEYS = { description: 'name="description"', "og:description": 'property="og:description"' };

function headTags(html, where) {
  const found = { description: [], "og:description": [] };
  for (const m of html.matchAll(/<meta\b[^>]*>/gu)) {
    const tag = m[0].replace(/\s+/gu, " ");
    for (const [key, attr] of Object.entries(HEAD_KEYS)) {
      if (!tag.includes(attr)) continue;
      const c = /content="([^"]*)"/u.exec(tag);
      if (!c) throw new Error(`REFUSED: ${where} has a <meta ${attr}> with no content attribute`);
      found[key].push(c[1].replace(/&amp;/gu, "&").replace(/&quot;/gu, '"').replace(/&#39;/gu, "'"));
    }
  }
  for (const [key, attr] of Object.entries(HEAD_KEYS)) {
    // Read as an error rather than a missing phrase: a page with two descriptions is not stale, it is
    // ambiguous, and a crawler picks one of them without telling anyone which.
    if (found[key].length !== 1) {
      throw new Error(`REFUSED: ${where} declares <meta ${attr}> ${found[key].length} times; exactly one is required`);
    }
  }
  // Returned as strings, not the collected arrays: `Array.prototype.includes` compares whole elements, so an
  // array here would satisfy a phrase only by coincidence (this tool's first version passed the English head
  // description exactly that way, on a phrase that happened to equal the entire attribute).
  return { description: found.description[0], "og:description": found["og:description"][0] };
}

function llmsCoverage(llmsText, datasets) {
  const hrefs = [...llmsText.matchAll(/\((?:https?:\/\/)[^)\s]+\)/gu)].map((m) => m[0].slice(1, -1));
  const linked = datasets.filter((f) => hrefs.some((h) => h.endsWith("/data/" + f)));
  const missing = datasets.filter((f) => !linked.includes(f));
  return { linked, missing, hrefs: hrefs.length };
}

function measurementValues() {
  const first = readJson(FILES.measure);
  const dated = readJson(FILES.measureDated);
  for (const [name, art] of [["first run", first], ["dated run", dated]]) {
    if (!Array.isArray(art.questions) || art.questions.length === 0) throw new Error(`REFUSED: ${name} artifact has no questions array to count`);
    for (const q of art.questions) {
      if (typeof q.id !== "string" || q.id.length === 0) throw new Error(`REFUSED: ${name} artifact has a question with no id`);
    }
    if (typeof art.sample?.limit !== "number" || !Number.isSafeInteger(art.sample.limit)) throw new Error(`REFUSED: ${name} artifact has no number at sample.limit`);
  }
  // The two runs have to share a sample size or "40 servers" in the head copy is half true.
  if (first.sample.limit !== dated.sample.limit) throw new Error(`REFUSED: the two measurement runs sampled different limits (${first.sample.limit} vs ${dated.sample.limit}) - the head copy cannot name one number`);
  // The head copy states how many datasets are published, so the denominator is the directory rather than the
  // two files this tool happens to read. A fourth artifact with the copy unchanged has to go red.
  const siblings = readdirSync("docs/data")
    .filter((f) => /^mcp-ecosystem-measurements[^/]*\.json$/u.test(f) && !f.endsWith(".partial.json"))
    .sort();
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const datasetWord = WORDS[siblings.length];
  if (!datasetWord) throw new Error(`REFUSED: ${siblings.length} measurement datasets is past the word table - extend WORDS deliberately`);
  // Counted from the directory, never from the --measure flags: an overridden artifact path must not be able to
  // change what the published copy claims about how many datasets exist.
  const datasetCount = siblings.length;
  // Collapsed exactly the way docs/render-mcp-hub-zh.mjs collapses it, so the two languages cannot drift into
  // two different definitions of "question".
  const collapse = (id) => String(id).replace(/-(legacy|modern)-leg$/u, "");
  const questions = new Set(dated.questions.map((q) => collapse(q.id))).size;
  const agreed = first.questions.find((q) => q.id === "protocol-revision-tolerance")?.verdicts?.AGREED_TO_THE_IMPOSSIBLE;
  if (!Number.isSafeInteger(questions) || questions <= 0) throw new Error("REFUSED: cannot count distinct questions in the dated artifact");
  if (!Number.isSafeInteger(agreed) || agreed <= 0) throw new Error("REFUSED: the protocol-revision-tolerance verdict AGREED_TO_THE_IMPOSSIBLE is not a positive safe integer");
  return { questions, legs: dated.questions.length, limit: dated.sample.limit, datasetCount, datasetWord, agreed, firstCount: first.questions.length, siblings };
}

function values() {
  const install = readJson(FILES.install);
  const census = readJson(FILES.census);
  const wide = readJson(FILES.wide);
  const npm = readJson(FILES.npm);
  const resolve = readJson(FILES.resolve);
  const tdqs = readJson(FILES.tdqs);
  const m = measurementValues();

  const ci = npm.ci95;
  if (!Array.isArray(ci) || ci.length !== 2) throw new Error("REFUSED: npm sample has no two-sided ci95 to quote");
  if (!resolve.by_type || typeof resolve.by_type !== "object") throw new Error("REFUSED: package-resolve artifact has no by_type to sum");

  // Summed per family, and each family's fields required first: an aggregate that lands on the right total
  // after a renamed field would still be wrong, and the page would not say which family moved.
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

  const v = {
    distinctServers: num(install, "sample.distinct_servers_collected", "installability"),
    withPackage: num(install, "tally.package_present", "installability"),
    censusNames: num(census, "distinct_names", "census"),
    wideNames: num(wide, "distinct_names", "wider census"),
    neither: num(census, "active_reachability.neither", "census"),
    denom: num(census, "active_latest_records", "census"),
    pkgRecords: num(census, "active_records_with_a_package", "census"),
    frameRecords: num(npm, "frame_records", "npm sample"),
    sampleSize: num(npm, "sample_size", "npm sample"),
    published: num(npm, "verdict_tally.listed_version_published", "npm sample"),
    versionMissing: num(npm, "verdict_tally.package_exists_version_missing", "npm sample"),
    packageMissing: num(npm, "verdict_tally.package_missing", "npm sample"),
    rate: num(npm, "unusable_rate", "npm sample"),
    ciLo: ci[0],
    ciHi: ci[1],
    toolCount: num(tdqs, "tool_count", "tdqs self-audit"),
    outputSchema: num(tdqs, "totals.output_schema_present", "tdqs self-audit"),
    definiteSum,
    unusableSum,
    measuredSum,
    measure: m,
  };
  // The pooled sentence spans six artifact families - the five probed here plus npm. npm's decided readings
  // are its draw minus whatever that probe could not decide at all.
  const npmDefinite = v.sampleSize - num(npm, "unresolvable", "npm sample");
  const npmUnusable = num(npm, "listed_package_unusable", "npm sample");
  v.poolDefinite = v.definiteSum + npmDefinite;
  v.poolUnusable = v.unusableSum + npmUnusable;
  v.npmDefinite = npmDefinite;
  return v;
}

const zhPhrases = (v) => [
  { label: "installability 54/6 (first mention)", phrase: `字母序最靠前的 ${v.distinctServers} 个记录里只有 ${v.withPackage} 个带` },
  { label: "installability 54/6 (link text)", phrase: `${v.distinctServers} 个去重后的记录里只有 ${v.withPackage} 个带 package` },
  { label: "census distinct names", phrase: `默认视图 ${fmt(v.censusNames)} 个服务器；连已移除记录一起要则是 ${fmt(v.wideNames)} 个` },
  { label: "census neither-transport count", phrase: `其中 ${v.neither} 个（${pct(v.neither / v.denom)}%）既无 package 也无 remote` },
  { label: "census package share", phrase: `总体带 package 的比例是 ${pct(v.pkgRecords / v.denom)}%。` },
  { label: "npm frame and draw", phrase: `从 ${fmt(v.frameRecords)} 条 npm 记录里抽 ${v.sampleSize} 条` },
  { label: "npm installed count", phrase: `${v.published} 条能按注册表所列版本在 npm 上装到` },
  { label: "npm failure split", phrase: `${v.versionMissing} 条版本已不存在、${v.packageMissing} 条包名已消失` },
  { label: "npm rate and interval", phrase: `不可用率 ${pct(v.rate)}%（95% 置信区间 ${pct(v.ciLo)}%–${pct(v.ciHi)}%）` },
  { label: "resolve decided/failed counts", phrase: `${fmt(v.definiteSum)} 条里 ${v.unusableSum} 条解析不了` },
  { label: "resolve pooled rate over six families", phrase: `六类合计不可用率 ${pct(v.poolUnusable / v.poolDefinite)}%` },
  { label: "tdqs outputSchema self-audit", phrase: `我们的 ${v.toolCount} 个工具里，${v.outputSchema} 个声明 outputSchema` },
];

const enPhrases = (v) => [
  { label: "EN census default view", phrase: `${fmt(v.censusNames)} servers visible` },
  { label: "EN census wider view", phrase: `${fmt(v.wideNames)} when removed records are asked for` },
  { label: "EN census package share", phrase: `puts that share at ${pct(v.pkgRecords / v.denom)}%` },
  { label: "EN census neither-transport count", phrase: `finds ${v.neither} records (${pct(v.neither / v.denom)}%) that declare neither a package nor a hosted endpoint` },
  { label: "EN installability draw", phrase: `On the alphabetically-first ${v.distinctServers} records the answer was ${v.withPackage} of ${v.distinctServers} carried a package` },
  { label: "EN npm frame and draw", phrase: `a seeded draw of ${v.sampleSize} of the ${fmt(v.frameRecords)} npm-listed records` },
  { label: "EN npm installed count", phrase: `${v.published} resolve on npm at exactly the listed version` },
  { label: "EN npm failure split", phrase: `${v.versionMissing} list a version npm does not have, and ${v.packageMissing} name is gone` },
  { label: "EN npm rate and interval", phrase: `a ${pct(v.rate)}% unusable rate with a 95% interval of ${pct(v.ciLo)}% to ${pct(v.ciHi)}%` },
  { label: "EN resolve decided/failed counts", phrase: `${v.unusableSum} of ${fmt(v.definiteSum)} do not resolve` },
  { label: "EN resolve pooled rate", phrase: `the unusable rate is ${pct(v.poolUnusable / v.poolDefinite)}%` },
  { label: "EN tdqs outputSchema self-audit", phrase: `${v.toolCount} of ${v.toolCount} of our tools declare no outputSchema`, requiresZero: v.outputSchema === 0 },
];

const headEnPhrases = (v) => [
  { in: "description", label: "EN head description", phrase: `${v.measure.questions} questions put to ${v.measure.limit} servers in the official MCP registry. ${v.measure.agreed} agreed to a protocol revision that does not exist. Scripts and ${v.measure.datasetWord} published datasets alongside.` },
  { in: "og:description", label: "EN head og:description", phrase: `${v.measure.questions} questions in ${v.measure.legs} measurement legs put to ${v.measure.limit} servers in the official MCP registry, plus a wider re-ask of the same ${v.measure.firstCount} questions.` },
];

const headZhPhrases = (v) => [
  { in: "description", label: "zh head description", phrase: `${v.measure.limit} 个服务端匿名提问：${v.measure.questions} 个问题、${v.measure.legs} 次测量` },
  { in: "og:description", label: "zh head og:description", phrase: `${v.measure.questions} 个问题、${v.measure.legs} 次测量` },
];

const HEAD_TABLES = { en: headEnPhrases, zh: headZhPhrases };

const NOT_CHECKED = [
  { label: "the per-family Wilson brackets inside the resolve table", reason: "each interval is recomputed from (unusable, definite) by that page's own renderer. A second Wilson implementation here would give the page and its guard two formulas to disagree over. The counts every interval is built from ARE checked, in both languages." },
];

const TABLES = { en: enPhrases, zh: zhPhrases };

function report(lang, text, v) {
  const flat = strip(text);
  const list = TABLES[lang](v);
  const missing = [];
  for (const e of list) {
    if (e.requiresZero === false) {
      missing.push(`${e.label}: the page's sentence assumes zero outputSchema declarations and the artifact no longer says zero (${v.outputSchema} declare one), so the phrase itself has to be rewritten`);
      continue;
    }
    if (!flat.includes(e.phrase)) missing.push(`${e.label}: expected \`${e.phrase}\``);
  }
  const head = headTags(text, FILES[lang]);
  const headList = HEAD_TABLES[lang](v);
  for (const e of headList) {
    const hay = e.in === "description" ? head.description : head["og:description"];
    if (!hay.includes(e.phrase)) missing.push(`${e.label}: expected \`${e.phrase}\` inside <meta ${HEAD_KEYS[e.in]}>`);
  }
  return {
    lang,
    page: FILES[lang],
    checked: list.length + headList.length - missing.length,
    expected_total: list.length + headList.length,
    missing,
  };
}

function langs() {
  return LANG === "both" ? ["en", "zh"] : [LANG];
}

function selftest() {
  const v = values();
  const problems = [];
  const runs = langs().map((l) => report(l, readFileSync(FILES[l], "utf8"), v));
  for (const r of runs) {
    if (r.checked !== r.expected_total) problems.push(`baseline ${r.lang}: expected every phrase, got ${r.checked}/${r.expected_total} - ${r.missing.join("; ")}`);
  }

  // Arm 1: a page moved a number on its own, in every language it appears in.
  const moved = `${fmt(v.censusNames)} servers visible`;
  const zhMoved = `${fmt(v.censusNames)} 个服务器`;
  let flipped = 0;
  for (const l of langs()) {
    const text = readFileSync(FILES[l], "utf8");
    const stale = l === "en" ? text.replace(moved, "41,111 servers visible") : text.replace(zhMoved, "41,111 个服务器");
    if (stale === text) { problems.push(`arm 1 (${l}): fixture changed no bytes, so it proves nothing`); continue; }
    const dir = mkdtempSync(join(tmpdir(), `hubfig-${l}-`));
    const p = join(dir, "stale.html");
    writeFileSync(p, stale, "utf8");
    const r = report(l, readFileSync(p, "utf8"), v);
    rmSync(p, { force: true });
    rmSync(dir, { force: true, recursive: true });
    if (r.missing.length !== 1) problems.push(`arm 1 (${l}): a census-only move must break exactly one phrase, got ${JSON.stringify(r.missing)}`);
    else flipped += 1;
  }

  // Arm 2: the artifact moved and the pages did not follow - the drift this guard exists for.
  const censusRaw = JSON.parse(readFileSync(FILES.census, "utf8"));
  censusRaw.distinct_names = censusRaw.distinct_names + 1;
  const dir2 = mkdtempSync(join(tmpdir(), "hubfig-census-"));
  const tmp = join(dir2, "census.json");
  writeFileSync(tmp, JSON.stringify(censusRaw), "utf8");
  const saved = FILES.census;
  FILES.census = tmp;
  let r2;
  try {
    const v2 = values();
    r2 = langs().map((l) => ({ l, ...report(l, readFileSync(FILES[l], "utf8"), v2) }));
  } finally {
    FILES.census = saved;
    rmSync(tmp, { force: true });
    rmSync(dir2, { force: true, recursive: true });
  }
  for (const r of r2) {
    if (r.missing.length !== 1 || !/census/.test(r.missing[0])) problems.push(`arm 2 (${r.l}): an artifact-only change must break exactly the census phrase, got ${JSON.stringify(r.missing)}`);
  }
  if (existsSync(tmp)) problems.push("arm 2 left its scratch artifact behind");

  // Arm 3: the figure only the English head copy quotes. en must lose exactly the head phrase; zh must lose
  // nothing, because the Chinese head copy states question and leg counts rather than per-question verdicts.
  const firstRaw = JSON.parse(readFileSync(FILES.measure, "utf8"));
  const rev = firstRaw.questions.find((q) => q.id === "protocol-revision-tolerance");
  rev.verdicts.AGREED_TO_THE_IMPOSSIBLE = rev.verdicts.AGREED_TO_THE_IMPOSSIBLE + 1;
  const dir3 = mkdtempSync(join(tmpdir(), "hubfig-measure-"));
  const tmp3 = join(dir3, "measure-plus-one.json");
  writeFileSync(tmp3, JSON.stringify(firstRaw), "utf8");
  const savedMeasure = FILES.measure;
  FILES.measure = tmp3;
  let r3;
  try {
    const v3 = values();
    r3 = langs().map((l) => ({ l, ...report(l, readFileSync(FILES[l], "utf8"), v3) }));
  } finally {
    FILES.measure = savedMeasure;
    rmSync(tmp3, { force: true });
    rmSync(dir3, { force: true, recursive: true });
  }
  for (const r of r3) {
    const headOnly = r.missing.length === 1 && /head description/.test(r.missing[0]);
    if (r.l === "en" && !headOnly) problems.push(`arm 3 (en): a moved AGREED_TO_THE_IMPOSSIBLE must break exactly the head description, got ${JSON.stringify(r.missing)}`);
    if (r.l === "zh" && r.missing.length !== 0) problems.push(`arm 3 (zh): the Chinese head copy does not quote that verdict, so it must stay green, got ${JSON.stringify(r.missing)}`);
  }
  if (existsSync(tmp3)) problems.push("arm 3 left its scratch artifact behind");

  {
    const datasets = values().measure.siblings;
    const lines = readFileSync(FILES.llms, "utf8").split("\n");
    const drop = datasets[0];
    const kept = lines.filter((l) => !l.includes("/data/" + drop + ")"));
    if (kept.length === lines.length) problems.push(`arm 4: no llms.txt bullet links ${drop}, so the fixture removes nothing`);
    const dir4 = mkdtempSync(join(tmpdir(), "hubfig-llms-"));
    const tmp4 = join(dir4, "llms.txt");
    writeFileSync(tmp4, kept.join("\n"), "utf8");
    const savedLlms = FILES.llms;
    FILES.llms = tmp4;
    try {
      const cov = llmsCoverage(readFileSync(tmp4, "utf8"), datasets);
      if (cov.missing.length !== 1 || cov.missing[0] !== drop) problems.push(`arm 4: expected exactly ${drop} missing, got ${JSON.stringify(cov)}`);
      if (cov.linked.length !== datasets.length - 1) problems.push(`arm 4: the other ${datasets.length - 1} datasets must still read as linked, got ${JSON.stringify(cov.linked)}`);
    } finally {
      FILES.llms = savedLlms;
      rmSync(tmp4, { force: true });
      rmSync(dir4, { force: true, recursive: true });
    }
  }

  console.log(JSON.stringify({ selftest: problems.length === 0, arms: 4, languages: langs(), census_phrase_flips: flipped, problems }, null, 2));
  return problems.length === 0 ? 0 : 7;
}

function main() {
  let v;
  try {
    v = values();
  } catch (e) {
    console.error(e.message);
    return 3;
  }
  const runs = [];
  for (const l of langs()) {
    let text;
    try {
      text = readFileSync(FILES[l], "utf8");
    } catch (e) {
      console.error(`REFUSED: cannot read the published page ${FILES[l]}: ${e.message}`);
      return 3;
    }
    try {
      runs.push(report(l, text, v));
    } catch (e) {
      // report() refuses for reasons that are not staleness - a head tag declared twice, a content
      // attribute that is missing - and each has to leave the documented exit 3 with its own message.
      const message = String(e && e.message ? e.message : e);
      console.error(message.startsWith("REFUSED:") ? message : `REFUSED: ${FILES[l]}: ${message}`);
      return 3;
    }
  }
  let llmsText;
  try {
    llmsText = readFileSync(FILES.llms, "utf8");
  } catch (e) {
    console.error(`REFUSED: cannot read ${FILES.llms}: ${e.message}`);
    return 3;
  }
  const llms = llmsCoverage(llmsText, v.measure.siblings);
  const out = {
    llms,
    runs,
    checked: runs.reduce((a, r) => a + r.checked, 0),
    expected_total: runs.reduce((a, r) => a + r.expected_total, 0),
    missing: runs.flatMap((r) => r.missing.map((m) => r.lang + ": " + m)),
    not_checked: NOT_CHECKED,
    verdict: runs.every((r) => r.missing.length === 0) && llms.missing.length === 0 ? "consistent" : "a page disagrees with its artifacts",
  };
  console.log(JSON.stringify(out, null, 2));
  const gaps = [...out.missing, ...llms.missing.map((f) => `dataset is not linked from ${FILES.llms}: ${f}`)];
  if (gaps.length && REQUIRE) {
    console.error("REFUSED: " + gaps.join("\n  - "));
    return 2;
  }
  return 0;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) process.exit(process.argv.includes("--selftest") ? selftest() : main());
