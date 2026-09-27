// Renders docs/mcp-protocol-version-header.md from the survey artifact. Refuses to write if the
// artifact's own numbers do not reconcile, because a published table copied from memory is how the
// last arithmetic error got onto our own pages.
import { readFileSync, writeFileSync, statSync } from "node:fs";

const arg = (flag, dflt) => { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : dflt; };
const SRC = arg("--survey", ".pm/t395-header-survey.json");
const OWN = arg("--own", ".pm/t409-normal.json");
const OUT = arg("--out", "docs/mcp-protocol-version-header.md");
const raw = readFileSync(SRC, "utf8");
const data = JSON.parse(raw.slice(0, raw.lastIndexOf("SUMMARY") > 0 ? raw.lastIndexOf("SUMMARY") : raw.length));

const rows = data.rows;
const sum = Object.values(data.tally).reduce((a, b) => a + b, 0);
if (rows.length === 0) throw new Error("empty sample: nothing to publish");
if (sum !== rows.length) throw new Error(`tally sums to ${sum} but rows are ${rows.length}`);
if (data.attempted !== rows.length) throw new Error(`attempted=${data.attempted} rows=${rows.length}`);
for (const [label, count] of Object.entries(data.tally)) {
  if (!rows.some((r) => r.verdict === label)) throw new Error(`tally key ${label} appears in no row`);
}
const answered = rows.filter((r) => r.verdict !== "auth_required" && !/^init_failed/.test(r.verdict) && !/^error/.test(r.verdict));
const servedBaseline = answered.filter((r) => r.baseline_served === true).length;
const servedOmitted = answered.filter((r) => r.omitted_served === true).length;
if (answered.length === 0) throw new Error("no server answered initialize: the claim would be unsupported");

// The self-measurement is a second artifact, and the doc must not soften it into prose if that probe
// did not actually run: read it, and refuse to render unless it reports a real measurement.
const own = JSON.parse(readFileSync(OWN, "utf8"));
if (own.verdict !== "measured") throw new Error(`own-server probe did not measure: ${own.verdict}`);
for (const key of ["header_answered", "header_omitted", "header_declined_revision"]) {
  if (!own.legs?.[key]) throw new Error(`probe artifact missing legs.${key}`);
}
// The handshake facts are nested, not top-level, and an absent field here would render as "no"/"undefined"
// - a plausible wrong reading, which is worse than a crash. Assert them by name before using them.
for (const key of ["answered", "session_id_issued", "asked"]) {
  if (!(key in (own.handshake ?? {}))) throw new Error(`probe artifact missing handshake.${key}`);
}

const lines = [];
lines.push("# Does an MCP server check the protocol-version header?", "");
lines.push(
  // The survey artifact has no timestamp field, so the sample time is taken from the file the probe
  // wrote rather than asserted from memory.
  `Sample taken ${statSync(SRC).mtime.toISOString().slice(0, 10)}, from the anonymous probe`,
  "`tools/survey-mcp-protocol-version-header.mjs 40`.",
)
lines.push(
  "",
  "The 2025-06-18 revision of MCP says a client MUST put `MCP-Protocol-Version` on every HTTP request",
  "after `initialize`, and that a server SHOULD reject a request whose header names a revision it did not",
  "agree to. Two questions follow, and they have different answers:",
  "",
  "1. Do public servers enforce it? In this sample: no, none of them.",
  "2. Did our own gateway send it? No — and that second one was a defect regardless of the first.",
  "",
  "## What the sample says",
  "",
  `Of ${rows.length} \`streamable-http\` endpoints taken from the official MCP registry in its default order:`,
  "",
  ...Object.entries(data.tally).sort((a, b) => b[1] - a[1]).map(([label, count]) => `- \`${label}\`: ${count}`),
  "",
  `**${answered.length} servers completed the handshake.** For each, the same \`tools/list\` request was sent`,
  "twice, differing by exactly one header — once naming the revision the server had answered with, once with the",
  "header absent entirely:",
  "",
  `- served with the header: **${servedBaseline}/${answered.length}**`,
  `- served without the header: **${servedOmitted}/${answered.length}**`,
  "",
  "So enforcement is not a thing that is happening today. The honest reading is narrower than that, though:",
  `${answered.length} answering servers is a small slice of a registry whose majority (\`${data.tally.auth_required}\`)`,
  "sit behind OAuth, and the sample is one window of one ordering. It is evidence about September 2026, not a",
  "statement about the protocol.",
  "",
  "## The one disagreement that mattered",
  "",
  `${data.negotiated_upward} of the ${answered.length} servers that answered named a different revision than the one`,
  "requested. For that server, asking `tools/list` while the header claimed the *requested* revision still worked.",
  "A permissive upstream, not a proof of safety: a conforming one is allowed to reject exactly that request.",
  "",
  "## The rows",
  "",
  "| server | answered revision | with header | without header | session id issued |",
  "| --- | --- | --- | --- | --- |",
);
for (const r of answered) {
  lines.push(
    `| ${r.name} | ${r.answered ?? "—"} | ${r.baseline_served ? "served" : `http ${r.baseline_status}`} | ${r.omitted_served ? "served" : `http ${r.omitted_status}`} | ${r.session_id ? "yes" : "no"} |`,
  );
}
lines.push(
  "",
  "## What we found in ourselves",
  "",
  "The gateway's own upstream client (`apps/ai-gateway-service/src/mcpGateway/mcpUpstreamClient.ts`) stores the",
  "session id the upstream issues and replays it on every later request. It did **not** do the same for the",
  "negotiated revision: it captured that value, reported it through `GET /mcp/tools`, and then never put it back",
  "on the wire. One server-issued value was treated as part of the contract and the other as decoration.",
  "",
  "That asymmetry had a concrete failure shape, which the new tests pin. Before the fix, an operator-supplied",
  "`mcp-protocol-version` header was forwarded verbatim — so against an upstream that answers `2024-11-05` to a",
  "`2025-06-18` request, our client sent `2025-06-18` in the header: a revision the upstream had explicitly not",
  "agreed to, which is the request a conforming server is allowed to reject.",
  "",
  "Now the post-handshake requests carry the revision the upstream *named*, never the one we asked for, and the",
  "`initialize` request itself carries none (the revision it proposes is in the body; a header asserting an",
  "agreement that has not happened yet is the wrong shape). An operator pin cannot outvote the server's answer.",
  "",
  "Three arms prove the change rather than describe it: removing the one-line fix turns them red, and the",
  "operator-pin arm reports the exact wrong value (`2025-06-18`) on the wire. Two further arms — an upstream that",
  "answers no revision, and one that answers an empty string — stay green in both states by design: they are",
  "there to catch a future fallback, not to prove this one.",
  "",
  "## What our own server does, observed rather than read out of source",
  "",
  "`tools/probe-own-mcp-header-behavior.mjs` boots `packages/mcp-server/src/http.js` in-process on the",
  "credential-free local runtime, asks it to `initialize`, then sends the same `tools/list` under three",
  "header shapes:",
  "",
  `- answered revision: **${own.handshake.answered}**, asked: ${own.handshake.asked}, session id issued: **${own.handshake["session_id_issued"] ? "yes" : "no"}**, tools served: **${own.baseline_tools}**`,
  `- header present: http ${own.legs.header_answered.status}, ${own.legs.header_answered.tools} tools`,
  `- header absent: http ${own.legs.header_omitted.status}, ${own.legs.header_omitted.tools} tools`,
  `- header naming a revision this server never agreed to: http ${own.legs.header_declined_revision.status}, ${own.legs.header_declined_revision.tools} tools`,
  "",
  "So we are one of the permissive ones, and that is now an observation instead of a code reading. The",
  "probe refuses to publish any of it if its own baseline leg fails to reach a tool list:",
  "`--tamper-blind` sends the request to a path one character off, and that run exits 3 with",
  "`INSTRUMENT_BLIND` and the sentence `this run says nothing about header handling` - because a",
  "misconfigured probe otherwise looks exactly like a server that accepted everything.",
  "",
  "## Deliberately not claimed",
  "",
  "- That this fixed an interoperability failure. Nothing in the sample rejects a headerless request today.",
  "- That the header is unimportant. The sample says who enforces it *now*; the spec says what a client owes.",
  "- That our HTTP server enforces inbound revisions. It advertises the header over CORS and does not read its",
  "  value — measured behaviour, and a documented choice: the gateway negotiates and records revisions",
  "  (`#178`) rather than dropping connections that name a different one.",
  "- The `claude-code-patterns` demo client was left alone: it has no session handling either, and nothing in the",
  "  product path imports it outside tests. Recorded, not silently doubled.",
  "",
  "## Reproduce",
  "",
  "```bash",
  "node tools/survey-mcp-protocol-version-header.mjs 40   # anonymous, read-only, one window",
  "node tools/probe-own-mcp-header-behavior.mjs              # our own server, local runtime, no credentials",
  "node tools/probe-own-mcp-header-behavior.mjs --tamper-blind   # must exit 3: the probe can refuse",
  "npx vitest run apps/ai-gateway-service/src/mcpGateway/mcpGateway.test.ts   # the five client arms",
  "```",
  "",
);
const out = lines.filter((l) => l !== undefined && l !== null).join("\n");
if (!/served without the header/.test(out)) throw new Error("render incomplete");
writeFileSync(OUT, out);
console.log(`WROTE ${OUT} bytes=${out.length} answered=${answered.length} baseline=${servedBaseline} omitted=${servedOmitted}`);
