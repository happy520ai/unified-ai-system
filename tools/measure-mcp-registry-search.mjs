// What does the registry's `search` parameter actually match, and what does that cost a searcher?
//
// Why this exists: upstream issue modelcontextprotocol/registry#1453 says `?search=` matches the server
// name only and not the description, and asks for description matching. That is a claim about someone
// else's live API, and the claim is checkable in two directions: does every row a search returns carry
// the word in its NAME (if one does not, description matching exists), and how many records describe the
// capability without naming it (if zero, the request is decorative). This measures both over one fixed
// sample of the current view, so the two numbers share a denominator.
//
//   node tools/measure-mcp-registry-search.mjs [--out .pm/mcp-registry-search.json] [--pages 30]
//   node tools/measure-mcp-registry-search.mjs --offline <artifact.json>   # re-derive without network
//
// Sampling note: `version=latest` is used deliberately (measured working on 2026-09-28, and documented),
// so the sample is servers rather than published versions. Rows carry `name` and `description`, nothing
// else is retained, and no server-authored text is quoted into the artifact beyond the two strings the
// API already publishes.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const REG = "https://registry.modelcontextprotocol.io";
const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i > 0 && typeof process.argv[i + 1] === "string" ? process.argv[i + 1] : dflt;
};
const offlineIndex = process.argv.indexOf("--offline");
const OFFLINE = offlineIndex > 0 ? process.argv[offlineIndex + 1] : null;
if (offlineIndex > 0 && !OFFLINE) throw new Error("REFUSED: --offline needs an artifact path");

// Capability words a person would type and a server would rarely put in its name. Every one is
// lower-cased and matched as a substring, which is the same rule #1453 says the API applies to names.
const WORDS = ["weather", "database", "github", "slack", "jira", "browser", "calendar", "pdf", "memory", "email"];

async function json(url) {
  const r = await fetch(url, { headers: { accept: "application/json", "user-agent": "unified-ai-system-measurement/1" } });
  const t = await r.text();
  let body = null;
  try { body = JSON.parse(t); } catch { /* reported as unreadable below */ }
  return { status: r.status, body, bytes: Buffer.byteLength(t) };
}

// One page of the current view. `version=latest` is asked for so a server with eleven published versions
// occupies one slot in the sample instead of eleven.
async function samplePage(cursor) {
  const url = `${REG}/v0/servers?limit=100&version=latest${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
  const res = await json(url);
  if (res.status !== 200 || !res.body || !Array.isArray(res.body.servers)) return { ok: false, status: res.status };
  const rows = res.body.servers.map((e) => {
    const s = e.server || {};
    const meta = (e._meta || {})["io.modelcontextprotocol.registry/official"] || {};
    return { name: String(s.name || ""), description: String(s.description || ""), status: meta.status || "absent", isLatest: meta.isLatest === true };
  });
  return { ok: true, rows, next: (res.body.metadata || {}).nextCursor || null, status: res.status };
}

// Walked to the end where it can be: `description_only_records_returned` and
// `search_rows_without_word_in_name` are claims about the WHOLE result set, and a first-page-only reading
// would shrink the denominator while the inclusion test still passes. When the cap is hit, `exhausted`
// says so and the analysis reports the leg as capped rather than as complete.
async function searchAll(word, capPages) {
  const rows = [];
  let cursor = null;
  let pages = 0;
  let exhausted = false;
  while (pages < capPages) {
    const url = `${REG}/v0/servers?limit=100&search=${encodeURIComponent(word)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const res = await json(url);
    if (res.status !== 200 || !res.body || !Array.isArray(res.body.servers)) return { ok: false, status: res.status, rows, pages, exhausted: false };
    for (const e of res.body.servers) {
      const s = e.server || {};
      rows.push({ name: String(s.name || ""), description: String(s.description || "") });
    }
    pages += 1;
    cursor = (res.body.metadata || {}).nextCursor || null;
    if (!cursor) { exhausted = true; break; }
  }
  return { ok: true, rows, pages, exhausted, capped: !exhausted };
}

function analyse(sample, searches) {
  const names = sample.map((r) => r.name.toLowerCase());
  const problems = [];
  const perWord = WORDS.map((word) => {
    const hit = searches[word];
    if (!hit || !hit.ok) { problems.push(`search leg for "${word}" is unreadable`); return null; }
    // In the sample: records whose description offers the capability but whose name does not. Those are
    // exactly the ones a name-only search cannot surface.
    const descOnly = sample.filter((r) => r.description.toLowerCase().includes(word) && !r.name.toLowerCase().includes(word));
    const both = sample.filter((r) => r.description.toLowerCase().includes(word) && r.name.toLowerCase().includes(word));
    const returnedNamesCarryingWord = hit.rows.filter((r) => r.name.toLowerCase().includes(word)).length;
    return {
      word,
      sample_description_only: descOnly.length,
      sample_name_and_description: both.length,
      search_rows_returned: hit.rows.length,
      search_pages_walked: hit.pages,
      search_result_exhausted: hit.exhausted === true,
      // The falsification target for #1453's claim: a returned row whose name lacks the word means the
      // search matched something other than the name.
      search_rows_without_word_in_name: hit.rows.length - returnedNamesCarryingWord,
      // Do any of the sample's description-only records show up in the search at all?
      description_only_records_returned: hit.rows.filter((r) => descOnly.some((d) => d.name === r.name)).length,
    };
  }).filter(Boolean);

  const statusCounts = {};
  for (const r of sample) statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  const nonLatest = sample.filter((r) => !r.isLatest).length;
  if (nonLatest > 0) problems.push(`${nonLatest} sampled row(s) are not marked latest although version=latest was requested`);
  if (perWord.length === 0) problems.push("no word legs completed");
  for (const w of perWord) {
    if (w.search_rows_without_word_in_name > 0) {
      problems.push(`"${w.word}": ${w.search_rows_without_word_in_name} returned row(s) lack the word in the name, so search is not name-only any more and this page's framing is wrong`);
    }
  }
  return { perWord, statusCounts, sampleSize: sample.length, problems };
}

function derive(sample, searches, meta) {
  const { perWord, statusCounts, sampleSize, problems } = analyse(sample, searches);
  const totalDescOnly = perWord.reduce((a, w) => a + w.sample_description_only, 0);
  const returnedDescOnly = perWord.reduce((a, w) => a + w.description_only_records_returned, 0);
  return {
    schema: "mcp-registry-search-discoverability-v1",
    run_at: new Date().toISOString(),
    source: `${REG}/v0/servers`,
    words: WORDS,
    sample_size: sampleSize,
    sample_pages_read: meta.pages,
    sample_status_counts: statusCounts,
    search_pages_cap: meta.searchCap ?? null,
    // Declared, not hidden: when a word's result set was cut off at the cap, "no description-only record
    // came back" is a statement about the rows scanned, not about the whole result set.
    capped_word_legs: meta.capped ?? [],
    per_word: perWord,
    totals: {
      description_only_mentions: totalDescOnly,
      of_those_returned_by_search: returnedDescOnly,
      search_rows_scanned: perWord.reduce((a, w) => a + w.search_rows_returned, 0),
      words_where_search_returned_a_name_lacking_the_word: perWord.filter((w) => w.search_rows_without_word_in_name > 0).length,
    },
    problems,
    problem_count: problems.length,
  };
}

function write(artifact, out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(artifact, null, 2) + "\n", "utf8");
}

async function run(argv) {
  const out = arg("--out", ".pm/mcp-registry-search.json");
  const maxPages = Number(arg("--pages", "30"));
  if (!Number.isSafeInteger(maxPages) || maxPages < 1) throw new Error("REFUSED: --pages must be a positive integer");
  const searchCap = Number(arg("--search-pages", "10"));
  if (!Number.isSafeInteger(searchCap) || searchCap < 1) throw new Error("REFUSED: --search-pages must be a positive integer");

  const sample = [];
  let cursor = null;
  let pages = 0;
  while (pages < maxPages) {
    const p = await samplePage(cursor);
    if (!p.ok) throw new Error(`REFUSED: sample page ${pages + 1} returned ${p.status}`);
    sample.push(...p.rows);
    pages += 1;
    if (!p.next) break;
    cursor = p.next;
  }
  if (cursor && pages < maxPages) throw new Error("REFUSED: the sample walk stopped early without exhausting the cursor");
  if (sample.length < 200) throw new Error(`REFUSED: sample of ${sample.length} rows is too small to describe discovery loss`);

  const searches = {};
  for (const word of WORDS) searches[word] = await searchAll(word, searchCap);
  const capped = WORDS.filter((w) => searches[w].ok && searches[w].capped);
  const artifact = derive(sample, searches, { pages, searchCap, capped });
  write(artifact, out);
  console.log(JSON.stringify({
    sample_size: artifact.sample_size, pages, words: artifact.per_word.length,
    description_only_mentions: artifact.totals.description_only_mentions,
    of_those_returned_by_search: artifact.totals.of_those_returned_by_search,
    search_rows_scanned: artifact.totals.search_rows_scanned,
    capped_word_legs: capped,
    problem_count: artifact.problem_count,
  }));
  if (artifact.problem_count) { console.log("REFUSED: " + artifact.problems.join("; ")); return 3; }
  return 0;
}

async function offline(path) {
  const saved = JSON.parse(readFileSync(path, "utf8"));
  // Re-derive from the retained per-word legs only; the row-level sample is not stored, so the offline
  // path re-checks the falsification arm and the arithmetic, not the sampling.
  const perWord = saved.per_word;
  const problems = [];
  for (const w of perWord) {
    if (w.search_rows_without_word_in_name > w.search_rows_returned) problems.push(`${w.word}: more rows without the word in the name than rows returned`);
    if (w.sample_description_only + w.sample_name_and_description > saved.sample_size) problems.push(`${w.word}: the two sample buckets add up beyond the sample (${saved.sample_size})`);
    if (w.description_only_records_returned > w.sample_description_only) problems.push(`${w.word}: returned more description-only records than the sample holds`);
  }
  const totals = {
    description_only_mentions: perWord.reduce((a, w) => a + w.sample_description_only, 0),
    of_those_returned_by_search: perWord.reduce((a, w) => a + w.description_only_records_returned, 0),
    search_rows_scanned: perWord.reduce((a, w) => a + w.search_rows_returned, 0),
    words_where_search_returned_a_name_lacking_the_word: perWord.filter((w) => w.search_rows_without_word_in_name > 0).length,
  };
  const agree = Object.entries(totals).every(([k, v]) => saved.totals[k] === v);
  if (!agree) problems.push(`stored totals ${JSON.stringify(saved.totals)} do not match recomputation ${JSON.stringify(totals)}`);
  const storedWords = saved.words.join(",");
  if (storedWords !== WORDS.join(",")) problems.push(`stored word list differs from the current WORDS (${storedWords})`);
  const verdict = problems.length ? "REFUSED" : "consistent";
  console.log(JSON.stringify({ offline: path, words: perWord.length, totals, stored_problem_count: saved.problem_count, problems, verdict }, null, 2));
  return problems.length ? 4 : 0;
}

if (process.argv.includes("--help")) {
  console.log("usage: node tools/measure-mcp-registry-search.mjs [--out <artifact.json>] [--pages N] | [--offline <artifact.json>]");
  process.exit(0);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  process.exit(OFFLINE ? await offline(OFFLINE) : await run(process.argv.slice(2)));
}

export { analyse, derive, WORDS };
