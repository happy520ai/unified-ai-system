// Nightly reading of the public skills index: how many installs our skill's row reports, with
// the index's own counter, plus the mirrors that hold the same file and named controls for scale.
//
// Why it refuses rather than reports zero. The index is a crawl of `skills/*/SKILL.md` in public
// repositories, so a row disappearing can mean our file moved, the crawler broke, or the endpoint
// changed shape - and those need different answers. A missing row is only a finding when the call
// that looked for it demonstrably worked, so every leg separates "answered" from "unreadable".
//
// Why the denominator is printed: the endpoint caps at `limit`. If it returns exactly `limit`
// rows, "we found 2 mirrors" is a statement about a window, not the population, and the artifact
// says so instead of letting a later reader count it as a census.
//
//   node tools/check-skill-index-installs.mjs [--output FILE] [--offline FILE] [--limit N]
// Exit: 0 clean | 2 the index could not be read | 3 --offline payload unusable | 4 real problems
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ENDPOINT = "https://skills.sh/api/search";
const OUR_SOURCE = "happy520ai/unified-ai-system";
const SKILL_ID = /(?:^|\/)unified-ai-gateway$/u;
// Named, unrelated rows on the same endpoint. Their job is to make our number readable as small or
// large; they are not claims about those projects.
const CONTROLS = [
  { q: "pdf", label: "first-party skill on the same index" },
  { q: "azure-aigateway", label: "large-vendor skill on the same index" },
];

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** Pure: classify one search leg's rows against our repository and skill id. */
export function classify(rows, ourSource = OUR_SOURCE) {
  const list = Array.isArray(rows) ? rows : [];
  const mine = list.filter((r) => SKILL_ID.test(String(r?.id ?? "")));
  const direct = mine.filter((r) => String(r?.source ?? "") === ourSource);
  const mirrors = mine.filter((r) => String(r?.source ?? "") !== ourSource);
  const num = (v) => (Number.isSafeInteger(Number(v)) && Number(v) >= 0 ? Number(v) : null);
  // The busiest row on the leg, whatever it is: a control leg that reports matched=0 has to still
  // say how big the neighbouring numbers are, or "3 installs" has nothing to be read against.
  const all = list.map((r) => num(r?.installs)).filter((n) => n !== null);
  return {
    matched: mine.length,
    direct: direct.length,
    maxInstalls: all.length ? Math.max(...all) : null,
    directInstalls: direct.reduce((a, r) => a + (num(r.installs) ?? 0), 0),
    mirrorInstalls: mirrors.reduce((a, r) => a + (num(r.installs) ?? 0), 0),
    mirrorSources: mirrors.map((r) => `${String(r.source ?? "?")}=${String(r.installs ?? "none")}`).sort(),
    unreadableInstalls: mine.filter((r) => num(r.installs) === null).length,
  };
}

/** Pure: turn one parsed payload plus its request into either a leg or a named failure. */
export function legFromPayload(payload, { query, rowsReturned, limit }) {
  if (!payload || !Array.isArray(payload.skills)) {
    return { error: "unreadable", query, detail: `response had no skills array (keys: ${payload ? Object.keys(payload).join(",") : "null"})` };
  }
  if (rowsReturned !== payload.skills.length) {
    return { error: "inconsistent", query, detail: `rowsReturned=${rowsReturned} but the array holds ${payload.skills.length}` };
  }
  // The row the query actually names, when it is on the leg at all. `maxInstalls` is the busiest
  // neighbour, which is a different statement - conflating them would let "736,754" be quoted as
  // if it were the control skill's own count.
  const namedRow = payload.skills.find((r) => String(r?.id ?? "").toLowerCase().endsWith(String(query).toLowerCase()));
  const namedNum = Number(namedRow?.installs);
  return {
    error: null,
    query,
    rows: payload.skills.length,
    namedInstalls: Number.isSafeInteger(namedNum) && namedNum >= 0 ? namedNum : null,
    count: typeof payload.count === "number" ? payload.count : null,
    searchType: typeof payload.searchType === "string" ? payload.searchType : null,
    truncated: payload.skills.length >= limit,
    verdict: classify(payload.skills),
  };
}

async function fetchLeg(query, limit, fetchImpl) {
  const url = `${ENDPOINT}?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetchImpl(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const payload = await res.json();
  return legFromPayload(payload, { query, rowsReturned: payload?.skills?.length ?? 0, limit });
}

/** Pure: the caller's decision, so the exit mapping is assertable instead of folklore. */
export function exitCodeFor({ problems, ourLegReadable }) {
  if (!ourLegReadable) return 2; // the index was not read at all - environment, not a verdict about us
  if (problems.length > 0) return 4; // we were read, and what came back is about us
  return 0;
}

export async function run({ limit = 100, fetchImpl = globalThis.fetch, offline = null } = {}) {
  const legs = [];
  const problems = [];
  const environment = [];
  const mainQueries = [{ q: "unified-ai-gateway", label: "our skill by its own id" }, ...CONTROLS];

  for (const { q, label } of mainQueries) {
    if (offline) {
      const byQuery = offline[q];
      if (!byQuery) {
        legs.push({ error: "unreadable", query: q, detail: "--offline payload has no entry for this query" });
        continue;
      }
      legs.push(legFromPayload(byQuery, { query: q, rowsReturned: byQuery?.skills?.length ?? 0, limit }));
      continue;
    }
    let leg;
    try {
      leg = await fetchLeg(q, limit, fetchImpl);
    } catch (error) {
      legs.push({ error: "unreadable", query: q, detail: String(error?.message ?? error).slice(0, 140) });
      continue;
    }
    legs.push(leg);
  }

  const ours = legs.find((l) => l.query === "unified-ai-gateway");
  const ourLegReadable = Boolean(ours && !ours.error);
  const readable = legs.filter((l) => !l.error).length;

  // An unreadable index is never written as "our skill has zero installs": that sentence belongs
  // to a call that actually answered. It arrives as `environment`, which exits 2 so the nightly
  // prints it instead of reddening on someone else's uptime (the same split the quotation and
  // mention-sweep steps already make).
  if (!ourLegReadable) environment.push(`the leg for our own skill was unreadable (${ours ? ours.detail : "absent"}) - installs are NOT reported as zero`);
  else if (ours.verdict.direct === 0) problems.push(`index answered ${ours.rows} rows for q=unified-ai-gateway and none is sourced from ${OUR_SOURCE} - the crawl no longer shows our row`);
  else if (ours.verdict.unreadableInstalls > 0) problems.push(`${ours.verdict.unreadableInstalls} matched row(s) carry a non-numeric installs field - the totals below understate`);

  const controlGaps = legs.filter((l) => l.error && l.query !== "unified-ai-gateway").map((l) => `control q=${l.query}: ${l.detail}`);

  return { limit, readable, legs, problems, environment, controlGaps, ourLegReadable, measured_at: offline ? "from --offline payload" : new Date().toISOString() };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const OUT = arg("--output", "");
  const limit = Number(arg("--limit", "100"));
  const offlinePath = arg("--offline", "");
  let offline = null;
  if (offlinePath) {
    try {
      offline = JSON.parse(readFileSync(offlinePath, "utf8"));
    } catch (error) {
      process.stdout.write(`REFUSED: --offline ${offlinePath} is not readable JSON: ${String(error.message).slice(0, 90)}\n`);
      process.exit(3);
    }
  }
  const result = await run({ limit, offline });

  process.stdout.write(`skills.sh index - q=unified-ai-gateway, limit=${result.limit}, readable legs=${result.readable}/${result.legs.length}\n`);
  process.stdout.write("installs count the index's own counter for a skill row. They are not stars, not unique people, and not this repository's download numbers.\n\n");
  for (const leg of result.legs) {
    if (leg.error) {
      process.stdout.write(`  UNREADABLE q=${leg.query}: ${leg.detail}\n`);
      continue;
    }
    const v = leg.verdict;
    process.stdout.write(
      `  q=${leg.query.padEnd(17)} rows=${String(leg.rows).padStart(3)} count=${String(leg.count ?? "-").padStart(4)} ` +
        `matched=${v.matched} direct=${v.direct} direct_installs=${v.directInstalls} mirror_installs=${v.mirrorInstalls} ` +
        `named_installs=${leg.namedInstalls ?? "none"} max_installs=${v.maxInstalls ?? "none"}` +
        `${leg.truncated ? " [WINDOW: rows==limit, this is not the population]" : ""}\n`,
    );
    if (v.mirrorSources.length) process.stdout.write(`      mirrors: ${v.mirrorSources.join(", ")}\n`);
  }
  const ours = result.legs.find((l) => l.query === "unified-ai-gateway" && !l.error);
  const summary = {
    measured_at: result.measured_at,
    endpoint: ENDPOINT,
    limit: result.limit,
    readable_legs: result.readable,
    legs: result.legs.length,
    our_installs: ours ? ours.verdict.directInstalls : null,
    mirror_installs: ours ? ours.verdict.mirrorInstalls : null,
    mirror_sources: ours ? ours.verdict.mirrorSources : [],
    window_limited: ours ? ours.truncated : null,
    controls: result.legs
      .filter((l) => !l.error && l.query !== "unified-ai-gateway")
      .map((l) => ({ query: l.query, rows: l.rows, named_installs: l.namedInstalls, max_installs: l.verdict.maxInstalls, window_limited: l.truncated })),
    problems: result.problems,
    environment: result.environment,
    control_gaps: result.controlGaps,
  };
  process.stdout.write(`\nSKILL_INDEX ${JSON.stringify(summary)}\n`);
  if (OUT) writeFileSync(OUT, JSON.stringify(summary, null, 2) + "\n");
  if (result.controlGaps.length) process.stdout.write(`CONTROL-GAPS (scale only, no verdict about us):\n${result.controlGaps.map((g) => "  - " + g).join("\n")}\n`);
  const code = exitCodeFor({ problems: result.problems, ourLegReadable: result.ourLegReadable });
  if (result.problems.length) process.stdout.write(`PROBLEMS:\n${result.problems.map((p) => "  - " + p).join("\n")}\n`);
  if (result.environment.length) process.stdout.write(`ENVIRONMENT:\n${result.environment.map((p) => "  - " + p).join("\n")}\n`);
  if (code !== 0) process.exit(code);
}
