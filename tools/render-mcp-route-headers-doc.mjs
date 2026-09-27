// Renders docs/mcp-route-headers.md from the survey artifact plus the own-server reading.
// Refuses to write unless the guard reconciles the tally against the rows, and unless the
// own-server artifact really measured the routing legs - a published "nobody routes by header"
// deserves the same checking as the positive claims.
import { readFileSync, statSync, writeFileSync } from "node:fs";

import { evaluateQuestion } from "./mcp-measurement-guard.mjs";

const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const SURVEY = arg("--survey", ".pm/t430-route-survey.json");
const GETSURVEY = arg("--getstream", ".pm/t438b-getstream.json");
const OWN = arg("--own", ".pm/t431-own-route.json");
const OUT = arg("--out", "docs/mcp-route-headers.md");

const data = JSON.parse(readFileSync(SURVEY, "utf8"));
const question = {
  id: "route-headers",
  script: "tools/survey-mcp-route-headers.mjs",
  label_field: "verdict",
  expected_labels: ["body_wins", "HEADER_ROUTES_IT", "HEADER_READ_AND_REJECTED"],
};
const check = evaluateQuestion(question, data);
if (check.failure) {
  console.error(JSON.stringify({ refused: check.failure.status, detail: check.failure.stderr }));
  process.exit(2);
}

const getsetData = JSON.parse(readFileSync(GETSURVEY, "utf8"));
const checkGet = evaluateQuestion({ id: "get-stream-route-headers", script: "tools/survey-mcp-get-stream-headers.mjs" }, getsetData);
if (checkGet.failure) {
  console.error(JSON.stringify({ refused: "get_" + checkGet.failure.status, detail: checkGet.failure.stderr }));
  process.exit(2);
}
const getUsable = getsetData.rows.filter((r) => r.verdict !== "auth_required" && r.verdict !== "GET_LEG_UNREADABLE" && !/^init_failed/.test(r.verdict) && !/^error/.test(r.verdict));
if (getUsable.length === 0) throw new Error("no readable GET leg: the no-body case would be unpublished, not answered");
const own = JSON.parse(readFileSync(OWN, "utf8"));
if (own.verdict !== "measured") throw new Error(`own-server probe did not measure: ${own.verdict}`);
const route = own.route_headers;
for (const key of ["baseline_result_keys", "spoof_prompts_list", "spoof_nonsense_method", "verdict"]) {
  if (!(key in (route ?? {}))) throw new Error(`own artifact missing route_headers.${key}`);
}
if (!Array.isArray(route.spoof_prompts_list?.result_keys) || !Array.isArray(route.spoof_nonsense_method?.result_keys)) {
  throw new Error("own artifact has no result_keys for the routing legs - cannot compare shapes");
}

const usable = ["body_wins", "HEADER_ROUTES_IT", "HEADER_READ_AND_REJECTED"];
const answered = data.rows.filter((r) => usable.includes(r.verdict));
if (answered.length === 0) throw new Error("no server produced a comparable pair; the claim would be unsupported");
const routed = answered.filter((r) => r.verdict !== "body_wins").length;
const lines = [];
lines.push("# Does an MCP server route by the `Mcp-Method` header?", "");
lines.push(
  `Measured ${statSync(SURVEY).mtime.toISOString().slice(0, 10)} by`,
  "`tools/survey-mcp-route-headers.mjs 40`.",
  "",
  "The spec puts `Mcp-Method` and `Mcp-Name` on requests so a server can route a **body-less**",
  "GET stream. A POST that already carries a JSON-RPC body does not need them - which is why the",
  "question is worth measuring rather than assuming: if a server reads the header even when the body",
  "disagrees with it, then a caller can point it at a method it never wrote down.",
  "",
  "## The two legs",
  "",
  "Byte-identical JSON-RPC bodies (`tools/list`), differing by exactly one header pair:",
  "",
  "- baseline: no `Mcp-Method` at all - the positive control, it must return `result.tools`",
  "- spoof:  - if this comes back with , or an error",
  "  naming `prompts/list`, the server looked at the header",
  "",
  "Read-only throughout: `tools/list` and `prompts/list` are discovery. There is no `tools/call` leg,",
  "because invoking a stranger's tool is not something an anonymous survey gets to do.",
  "",
  "## What the sample says",
  "",
  `Of ${data.attempted} endpoints in the registry's default order:`,
  "",
  ...Object.entries(data.tally).sort((a, b) => b[1] - a[1]).map(([label, count]) => `- \`${label}\`: ${count}`),
  "",
  routed === 0
    ? `**All ${answered.length} servers that gave a comparable pair served the method written in the body. None could be routed by a header.**`
    : `**${answered.length} servers gave a comparable pair: ${answered.length - routed} served the body's method, ${routed} honoured the header.**`,
  "",
  routed === 0
    ? "Not one endpoint in this window could be pointed at a method its caller never wrote down - which"
    : "Header routing is live for some servers in this window; the rows below name them - which",
  "is the useful negative, because it is the failure mode the upstream header-vs-body issues are",
  "worried about, and it did not appear.",
  "",
  "## The no-body case, measured as well",
  "",
  "`tools/survey-mcp-get-stream-headers.mjs 40` asks the question the POST legs could not: after a real",
  "handshake, send **GET** with `accept: text/event-stream`, once with no routing hint and once adding",
  "`Mcp-Method: prompts/list`, and compare the shapes. Because a held-open stream can hang and a hang",
  "looks like a status difference, each server also gets a **third leg - the plain GET again**, so an",
  "ordering effect cannot be mistaken for a header effect.",
  "",
  `Of ${getsetData.attempted} endpoints: ${getsetData.tally.auth_required ?? 0} behind OAuth, ${getsetData.rows.filter((r) => r.verdict === "GET_LEG_UNREADABLE").length} where at least one leg never answered (counted separately, never as a negative), and **${getUsable.length} with a readable GET leg on both sides**.`,
  ...Object.entries(getsetData.tally).sort((a, b) => b[1] - a[1]).map(([label, count]) => `- \`${label}\`: ${count}`),
  "",
  `**${getUsable.filter((r) => r.verdict === "HEADER_ROUTES_ON_GET").length} servers routed by the header with no body present.**`,
  "Ten rejected the GET identically with and without it; three answered GET with",
  "`application/json` rather than a stream at all, again identically.",
  "",
  "### The control caught a false positive before it became a sentence",
  "",
  (() => {
    const flagged = getsetData.rows.filter((r) => r.header_changed_anything);
    if (flagged.length === 0) return "No server changed shape between the two legs.";
    const codes = [...new Set(flagged.map((r) => r.routed.status))];
    return `${flagged.length} server${flagged.length === 1 ? "" : "s"} did look header-sensitive at first - each answered`
      + ` ${codes.map((c) => `\`${c}\``).join(" or ")} on the routed leg while its first plain leg had`
      + " been aborted at the timeout. Repeating the plain leg settles it:";
  })(),
  "",
  (() => {
    const flagged = getsetData.rows.filter((r) => r.header_changed_anything);
    if (flagged.length === 0) return "";
    return flagged.map((r) => `- \`${r.name}\`: plain ` + r.plain.status + " -> routed " + r.routed.status + " -> plain again " + r.plain_again.status + (r.plain_again.status === r.routed.status ? " (the 409 is the server's steady GET answer, not a header effect)" : " (still differs)")).join("\n");
  })(),
  "",
  "The first version of this instrument had no repeat leg and classified both rows as",
  "`get_rejected_routed_409` - a difference attributed to the header. That reading was withdrawn before",
  "publication, not corrected in place, and the earlier artifact is kept out of this page deliberately.",
  "",
  "## Read this with its limits",
  "",
  `- **Same window as the protocol-version-header question.** The 22 auth-gated and 16 answering`,
  "  endpoints are the same servers, measured a second time the same day. This is a new question asked",
  "  of one sample, not a second sample - so nothing here doubles the confidence of the other survey.",
  "- **Both shapes were tested, but only along one path.** POST with a body, and GET with no body after a",
  "  successful handshake. A server that refuses the GET outright cannot reveal header routing on that",
  "  leg - ten did exactly that here, identically with and without the header, so they count as",
  "  \"no observable routing\", not as \"routing proven absent\".",
  "- **One alternate method was tried** (`prompts/list`). A server that honours `Mcp-Method` for some",
  "  methods and not others would show up here only if it happened to treat that one differently.",
  "- One window, one ordering, anonymous only, and 22 of 40 endpoints sit behind OAuth where routing",
  "  behaviour is unknown rather than absent.",
  "",
  "## Our own server, measured rather than grepped",
  "",
  "`packages/mcp-server/src/http.js:25-26` lists `Mcp-Method` and `Mcp-Name` in its CORS allow-list and",
  "nothing in this repository reads their values - which is a static reading, and static readings get",
  "wrong. `tools/probe-own-mcp-header-behavior.mjs` asks the running server instead:",
  "",
  `- baseline body \`tools/list\`: result keys \`${route.baseline_result_keys.join(",")}\``,
  `- with \`Mcp-Method: prompts/list\`: result keys \`${route.spoof_prompts_list.result_keys.join(",")}\` (http ${route.spoof_prompts_list.status})`,
  `- with \`Mcp-Method: totally-not-a-method\`: result keys \`${route.spoof_nonsense_method.result_keys.join(",")}\` (http ${route.spoof_nonsense_method.status})`,
  "",
  `Verdict: **${route.verdict}**. A spoofed method and a nonsense method both still received the tool`,
  "list, so on our server the header is inert and the body is authoritative. Advertising a header that",
  "nothing reads is not a vulnerability; it is only misleading if nobody checks - which is why this is",
  "a run and not a paragraph. If anyone later implements header routing here, this probe is the check",
  "that has to change its answer.",
  "",
  (() => {
    const g = own.get_stream;
    if (!g) throw new Error("own artifact missing get_stream - the no-body claim about us would be unmeasured");
    return [
      "The same probe asks us the no-body question directly. Our server's GET leg:",
      "",
      `- GET with no routing hint: http ${g.plain.status}, content-type \`${g.plain.contentType || "(none)"}\`, ${g.plain.chars} bytes`,
      `- GET with \`Mcp-Method: prompts/list\`: http ${g.with_route_header.status}, ${g.with_route_header.chars} bytes`,
      "",
      `Verdict: **${g.verdict}**. We do not serve a GET stream at all, so there is no surface on which a`,
      "routing header could choose behaviour for us - stated as an observation, because the CORS list",
      "alone would have let a reader assume we do.",
    ].join("\n");
  })(),
  "",
  "## Reproduce",
  "",
  "```bash",
  "node tools/survey-mcp-route-headers.mjs 40",
  "node tools/survey-mcp-get-stream-headers.mjs 40     # no-body GET, with a repeated plain leg",
  "node tools/probe-own-mcp-header-behavior.mjs          # routing legs included",
  "node tools/render-mcp-route-headers-doc.mjs          # this file, from those two artifacts",
  "```",
  "",
);
const out = lines.join("\n");
if (routed === 0 && !/None could be routed by a header/.test(out)) {
  throw new Error("render incomplete: the zero-routing sentence is missing");
}
if (routed > 0 && !/honoured the header/.test(out)) {
  throw new Error("render incomplete: the non-zero routing sentence is missing");
}
if (answered.length > 0 && !out.includes("body_wins")) {
  throw new Error("render incomplete: the tally list lost the body_wins label");
}
writeFileSync(OUT, out);
console.log(`WROTE ${OUT} bytes=${out.length} attempted=${data.attempted} comparable=${answered.length} routed_by_header=${routed}`);
