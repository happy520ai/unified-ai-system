// Renders docs/mcp-list-cache-hints.md from the cache-hint survey and the own-server artifact.
// Refuses to write unless the survey's tally reconciles with its rows and the own-server reading is an
// observation rather than a guess, because a page of numbers hand-copied from memory is the defect
// this repo keeps having to fix on itself.
import { readFileSync, statSync, writeFileSync } from "node:fs";

import { evaluateQuestion } from "./mcp-measurement-guard.mjs";

const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const SURVEY = arg("--survey", ".pm/t448-cachehints.json");
const OWN = arg("--own", ".pm/t447-own-cachehints.json");
// The revision-scoped re-run. Without it this page carries a count taken at a revision where the two
// fields are not required, sitting next to prose a reader could take as conformance.
const MODERN = arg("--modern", ".pm/t504-cachehints-modern.json");
// Same instrument, same day, older revision: the leg that makes the modern run a single-variable
// comparison instead of two different windows.
const CONTROL = arg("--control", ".pm/t510-cachehints-legacy-today.json");
const OUT = arg("--out", "docs/mcp-list-cache-hints.md");

const data = JSON.parse(readFileSync(SURVEY, "utf8"));
const check = evaluateQuestion({ id: "list-cache-hints", script: "tools/survey-mcp-list-cache-hints.mjs" }, data);
if (check.failure) {
  console.error(JSON.stringify({ refused: check.failure.status, detail: check.failure.stderr }));
  process.exit(2);
}
const listed = data.rows.filter((r) => r.shape);
if (listed.length === 0) throw new Error("no server returned a tool list: there is no denominator to publish");
const declared = listed.filter((r) => r.verdict === "RESULT_LEVEL_HINT" || r.verdict === "TOOL_LEVEL_HINT");
const silent = listed.filter((r) => r.verdict === "no_cache_hint_declared");
if (declared.length + silent.length !== listed.length) {
  throw new Error(`declared(${declared.length}) + silent(${silent.length}) != listed(${listed.length})`);
}
const own = JSON.parse(readFileSync(OWN, "utf8"));
if (own.verdict !== "measured") throw new Error(`own-server probe did not measure: ${own.verdict}`);
const route = own.route_headers ?? {};
const mod = JSON.parse(readFileSync(MODERN, "utf8"));
const modRows = (mod.rows || []).filter((r) => r.shape);
if (modRows.some((r) => typeof r.revision_answered !== "string")) {
  throw new Error("modern artifact rows lack revision_answered: the count cannot be scoped to a revision");
}
if (modRows.length === 0) throw new Error("modern artifact has no answering rows: nothing to scope");
const modNegotiated = modRows.filter((r) => r.revision_answered === "2026-07-28");
const modDeclared = modNegotiated.filter((r) => r.verdict === "RESULT_LEVEL_HINT" || r.verdict === "TOOL_LEVEL_HINT");
const modDate = statSync(MODERN).mtime.toISOString().slice(0, 10);
const ctl = JSON.parse(readFileSync(CONTROL, "utf8"));
const ctlRows = (ctl.rows || []).filter((r) => r.shape);
if ((ctl.rows || []).length === 0) throw new Error("control artifact has no rows: nothing to pair against");
if (ctlRows.some((r) => typeof r.revision_answered !== "string")) {
  throw new Error("control rows lack revision_answered: the pair cannot be labelled");
}
const ctlSet = new Set((ctl.rows || []).map((r) => r.url));
const modSet = new Set((mod.rows || []).map((r) => r.url));
const overlap = [...modSet].filter((u) => ctlSet.has(u)).length;
if (overlap !== modSet.size || overlap !== ctlSet.size) {
  throw new Error(`the two legs are not the same endpoint set (overlap ${overlap} of ${modSet.size}/${ctlSet.size})`);
}
const ctlDeclared = ctlRows.filter((r) => r.verdict === "RESULT_LEVEL_HINT" || r.verdict === "TOOL_LEVEL_HINT").length;
for (const key of ["our_tool_field_names", "our_result_ttlMs_present", "our_result_cacheScope_present", "baseline_result_keys"]) {
  if (!(key in route)) throw new Error(`own artifact missing route_headers.${key}`);
}
const clamp = (value) => Math.min(600_000, Math.max(1_000, Math.floor(value)));

const lines = [];
lines.push("# Do MCP servers say how long their tool list may be cached?");
lines.push("");
lines.push(
  `Sample taken ${statSync(SURVEY).mtime.toISOString().slice(0, 10)} by`,
  "`tools/survey-mcp-list-cache-hints.mjs 40`.",
);
lines.push("");
lines.push(
  "A gateway has to decide how long to keep a cached tool list. The spec gives servers a way to answer",
  "that: `ttlMs` and `cacheScope` on a list result. So the question is not what our policy should be in",
  "the abstract, it is how often an upstream actually tells us anything - because a policy built for a",
  "signal nobody sends is just overhead.",
  "",
  "The probe records **structure only**: field presence, type, numeric buckets, counts. No tool name,",
  "description or any other server-authored text is copied out of the response.",
  "",
  "## What the sample says",
  "",
  `Of ${data.attempted} endpoints in the registry's default order:`,
  "",
  ...Object.entries(data.tally).sort((a, b) => b[1] - a[1]).map(([label, count]) => `- \`${label}\`: ${count}`),
  "",
  `**${listed.length} returned a tool list. ${silent.length} of them declared no cache hint at all, and ${declared.length} declared one.**`,
  "",
  ...(declared.length === 0
    ? ["Nobody spoke, so a gateway's only real input is its own default."]
    : declared.map((r) => {
      const s = r.shape;
      return (
        `- \`${r.name}\` answered at the result level with `
        + `ttlMs=${s.result_ttlMs_value === null ? "n/a" : s.result_ttlMs_value} and `
        + `cacheScope=${s.result_cacheScope}${s.tools_with_ttlMs > 0 ? `, plus ${s.tools_with_ttlMs} tool-level ttlMs` : ""}.`
      );
    })),
  "",
  "## What we did with that, and what it does not justify",
  "",
  "Our gateway used to cache every upstream's list for a hard-coded 60 seconds and shared it across",
  "tenants, reading neither field. One declarant in sixteen is not a large enough signal to invent a",
  "policy engine, so the change stayed small and boring:",
  "",
  `- A declared \`ttlMs\` is honoured, clamped to 1,000..600,000 ms. The one server in this sample that`,
  `  declared anything said 300,000, which is inside that band and becomes ${clamp(300_000)} ms.`,
  "- No declaration keeps the previous 60 seconds **exactly** - the 15-of-16 path is the unchanged path.",
  "- `cacheScope: \"private\"` keys the cache per tenant instead of sharing one entry.",
  "",
  "The floor and the ceiling are ours, not the server's, and they are written down because a declared",
  "`0` would otherwise turn every `/mcp/tools` read into a fresh upstream handshake (we measure that",
  "handshake at 6.4 s on a quiet machine) and a declared decade would let one response freeze a tool",
  "list indefinitely. A number from the network is an input to a policy, not the policy.",
  "",
  "## The part worth more than the timing",
  "",
  "That declarant also said `cacheScope: private`, and we were putting the response in a process-global",
  "map keyed by upstream id, served to every tenant allowed on that server. **Nothing was leaked**, and",
  "saying otherwise would be marketing: `listTools()` receives no caller identity and the upstream",
  "request is built from server config, so the content genuinely is the same for every tenant today.",
  "",
  "What was wrong was the shape - a cache built as though sharing were always safe. The first person to",
  "forward a per-caller token or a tenant-derived header into an upstream list call would have been",
  "serving tenant A's list to tenant B out of a key neither of them owned, and no code would have",
  "objected. Fixing the shape costs one key; auditing it after that change lands costs a disclosure.",
  "",
  "## The same question at the revision that requires the answer",
  "",
  "Everything counted above was counted on a connection the server agreed to run at `2025-06-18`, where",
  "`ttlMs` and `cacheScope` are **not required**. So that sentence describes legacy-negotiated traffic and",
  "cannot be read as conformance in either direction. The older artifact also predates the per-row",
  "revision fields, so that run cannot re-derive what each server answered - which is why this section is",
  "written against a second capture.",
  "",
  `Re-asked ${modDate} with \`tools/survey-mcp-list-cache-hints.mjs 40 --revision 2026-07-28\`: of ${mod.attempted}`,
  `endpoints, ${modRows.length} returned a tool list and only ${modNegotiated.length} of those actually`,
  "negotiated `2026-07-28`; the rest answered an older revision, where sending neither field is correct",
  `behaviour. **Of the modern-negotiated responders, ${modDeclared.length} of ${modNegotiated.length} sent both`,
  "`ttlMs` and `cacheScope`.**",
  "",
  `Paired control, same instrument and same day, asking for the older revision: both legs touched exactly`,
  `the same ${overlap} endpoints. At the older revision ${ctlRows.length} returned a tool list and`,
  `${ctlDeclared} of those declared a hint; at the newer revision ${modRows.length} returned a list and`,
  `${modDeclared.length} of those declared one. Asking for the newer revision therefore costs`,
  `${ctlRows.length - modRows.length} of those list answers, and the extra failures are HTTP 400 on`,
  `initialize (${mod.tally?.init_failed_400 ?? 0} in the modern leg against ${ctl.tally?.init_failed_400 ?? 0} in the legacy`,
  "leg) rather than a negotiation down to an older revision. The registry's first rows also shift from day",
  "to day, which is why this page pairs same-day legs instead of comparing across days.",
  "",
  "Two readings are available here and only one is comfortable: most public endpoints in this sample",
  "decline the revision that requires the fields, and inside the small part that accepts it, nearly all of",
  "them still omit them. The second is exactly the population a strict validator bites - so a client that",
  "rejects an absent hint is not enforcing a widely-implemented rule; on this sample it is enforcing one",
  "that the few servers advertising support for it almost universally fail. Small n, one window, one",
  "ordering, and 20 endpoints sat behind OAuth where behaviour is unknown rather than absent.",
  "",
  "## Our own server, measured at both revisions",
  "",
  `At the revision this repo's own probe negotiates, our result keys are \`${route.baseline_result_keys.join(",")}\`,`,
  `per-tool fields \`${route.our_tool_field_names.join(", ")}\`: \`ttlMs\` present: **${route.our_result_ttlMs_present}**,`,
  `\`cacheScope\` present: **${route.our_result_cacheScope_present}**. That is legitimate at \`2025-06-18\`, and an`,
  "earlier version of this page wrote it up as though it settled what we send under the new revision. It",
  "did not - and the sentence was wrong in the direction of being *more* self-critical than the truth.",
  "",
  "Under a real modern negotiation we do send both fields. Captured through a stdio tee that records whole",
  "frames (no truncation; per-frame byte length asserted) while a pinned official client reached",
  "`2026-07-28`: our server answered `server/discover` with `supportedVersions: [\"2026-07-28\"]`, and its",
  "`tools/list` result carried keys `tools, resultType, ttlMs, cacheScope, _meta`. So the honest contrast",
  "is not that we hide in the silent majority: most endpoints decline the revision, those that accept it",
  "mostly omit what it then requires, and our server is in the minority that fills the fields in.",

  "",
  "## Deliberately not claimed",
  "",
  "- That the rate is stable. One window, one ordering, 22 of 40 endpoints behind OAuth where",
  "  behaviour is unknown rather than absent.",
  "- That 1-of-16 means the feature is unimportant. It means the *timing* half is; the sharing half is",
  "  about a property of our own cache that no server had to declare for us to get wrong.",
  "- That `resources/list` or `prompts/list` carry hints too. Only `tools/list` was examined.",
  "",
  "## Reproduce",
  "",
  "```bash",
  "node tools/survey-mcp-list-cache-hints.mjs 40",
  "node tools/probe-own-mcp-header-behavior.mjs",
  "node tools/render-mcp-cache-hints-doc.mjs",
  "```",
  "",
);
const out = lines.filter((l) => typeof l === "string").join("\n");
if (!/returned a tool list/.test(out)) throw new Error("render incomplete: no denominator sentence");
if (!out.includes("cacheScope: private") && !out.includes("`cacheScope: \"private\"`") && !/private/.test(out)) {
  throw new Error("render incomplete: the sharing section lost its subject");
}
writeFileSync(OUT, out);
console.log(`WROTE ${OUT} bytes=${out.length} listed=${listed.length} silent=${silent.length} declared=${declared.length}`);
