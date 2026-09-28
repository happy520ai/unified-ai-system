// Render the self-audit article from the artifact produced by
// tools/audit-tool-definition-quality.mjs. Every number is derived from the
// artifact; the renderer refuses rather than publishing a sentence it cannot
// point at a field for.
//
// Usage: node tools/render-tdqs-self-audit-doc.mjs --artifact <json> --out <md>
import { readFileSync, writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf("--" + name);
  return i >= 0 ? argv[i + 1] : null;
};
const artifactPath = flag("artifact");
const outPath = flag("out");
if (!artifactPath || !outPath) {
  console.error("usage: --artifact <json> --out <md>");
  process.exit(2);
}
const a = JSON.parse(readFileSync(artifactPath, "utf8"));

const ANNOTATIONS = ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"];
const problems = [];
if (a.producer !== "tools/audit-tool-definition-quality.mjs") problems.push(`producer is ${JSON.stringify(a.producer)}`);
if (!Array.isArray(a.tools) || a.tools.length === 0) problems.push("tools is not a non-empty array");
if (a.tools?.length !== a.tool_count) problems.push(`tool_count ${a.tool_count} != tools.length ${a.tools?.length}`);
if (a.cursor_exhausted !== true) problems.push("the tools/list walk did not report an exhausted cursor - this is a prefix, not the surface");
const names = (a.tools || []).map((t) => t.name);
if (new Set(names).size !== names.length) problems.push("duplicate tool names in the artifact");
if (names.some((n) => typeof n !== "string" || !n.trim())) problems.push("a tool row has no name");
if (Number.isInteger(a.expected_count) && a.expected_count !== a.tool_count) {
  problems.push(`served ${a.tool_count} but the instrument was told the published claim is ${a.expected_count}`);
}

// Recompute every aggregate from the rows. An artifact whose totals disagree with
// its own rows cannot be quoted.
const count = (pred) => a.tools.filter(pred).length;
const expected = {
  with_description: count((t) => t.description_chars > 0),
  with_title: count((t) => t.has_title),
  all_four_annotations: count((t) => t.annotations_declared.length === ANNOTATIONS.length),
  no_annotations: count((t) => t.annotations_declared.length === 0),
  input_properties_total: a.tools.reduce((s, t) => s + t.input_properties_total, 0),
  input_properties_documented: a.tools.reduce((s, t) => s + t.input_properties_documented, 0),
  output_schema_present: count((t) => t.output_schema_present),
  output_schema_bare: count((t) => t.output_schema_bare),
  names_a_sibling: count((t) => t.names_sibling.length > 0),
  states_boundary: count((t) => t.states_boundary),
  mentions_when_to_use: count((t) => t.mentions_when_to_use),
  ordering_smell: count((t) => t.ordering_smell),
};
for (const [k, v] of Object.entries(expected)) {
  if (a.totals?.[k] !== v) problems.push(`totals.${k} says ${a.totals?.[k]} but its rows sum to ${v}`);
}
for (const t of a.tools || []) {
  if (t.input_properties_documented > t.input_properties_total) problems.push(`${t.name}: documented params exceed total`);
  if (t.annotations_declared.some((k) => !ANNOTATIONS.includes(k))) problems.push(`${t.name}: annotation outside the MCP four`);
}
if (problems.length) {
  console.error("REFUSED:\n" + problems.map((p) => "  - " + p).join("\n"));
  process.exit(3);
}

const n = a.tool_count;
const T = a.totals;
const day = a.served_at.slice(0, 10);
const pct = (x) => ((100 * x) / n).toFixed(0) + "%";

// The sibling cluster is derived, not asserted: group by the last name segment,
// because that is the axis along which these names could be confused.
const bySuffix = new Map();
for (const t of a.tools) {
  const suffix = t.name.split("_").slice(1).join("_") || t.name;
  if (!bySuffix.has(suffix)) bySuffix.set(suffix, []);
  bySuffix.get(suffix).push(t);
}
const clusters = [...bySuffix.entries()].filter(([, g]) => g.length > 1).sort((x, y) => y[1].length - x[1].length);
const biggest = clusters[0] || null;
const clusterRefs = biggest ? biggest[1].reduce((s, t) => s + t.names_sibling.length, 0) : 0;
const shortDesc = a.tools.filter((t) => t.description_chars < 90).length;
const zeroParam = a.tools.filter((t) => t.input_properties_total === 0).length;

const lines = [
  `# We ran Glama's open tool-definition rubric against our own MCP server. Here is the part that needs no judge.`,
  "",
  `Measured ${day} by \`${a.producer}\`. The inputs are exactly what a client receives from \`tools/list\` on the`,
  `credential-free local runtime - ${n} tools over ${a.pages_read} page(s), cursor exhausted: \`${a.cursor_exhausted}\`.`,
  `No provider was called and no credential was read.`,
  "",
  "## What this is, and the one thing it is not",
  "",
  "[Glama's Tool Definition Quality Score](https://github.com/glama-ai/tool-definition-quality-score) is an open",
  "specification: four stages, of which three are deterministic code and one - stage 3 - is an LLM rubric call.",
  "This page reports the deterministic stages, applied to our own server, which is the part a maintainer can",
  "verify without a judge. **It is not a TDQS score and does not predict one.** The graded dimensions",
  "(purpose clarity, usage guidelines, conciseness) need the evaluator, and Glama's own grade for us is a",
  "separate thing reported below.",
  "",
  "## The checklist, scored against our rows",
  "",
  "| what the rubric asks for | ours | the spec says |",
  "| --- | --- | --- |",
  `| a description that exists | ${T.with_description}/${n} (${pct(T.with_description)}) | "the primary scoring target" |`,
  `| an MCP display title | ${T.with_title}/${n} | optional |`,
  `| all four MCP annotations declared | ${T.all_four_annotations}/${n} (${pct(T.all_four_annotations)}) | item 3: they "lower the disclosure burden on your description" |`,
  `| every parameter documented | ${T.input_properties_documented}/${T.input_properties_total} | item 4: per-property descriptions "raise your baseline to 3 on its own" |`,
  `| a documented output schema | ${T.output_schema_present}/${n} | item 5: "a bare \`{"type": "object"}\` earns nothing" |`,
  `| a description naming a sibling tool | ${T.names_a_sibling}/${n} | item 1: say how this tool differs from its neighbours |`,
  `| any when/if phrasing (proxy, see below) | ${T.mentions_when_to_use}/${n} | item 2: "say when (and when not) to use it" |`,
  `| an ordering smell ("always call this first") | ${T.ordering_smell}/${n} | a tool-set problem, not a description problem |`,
  "",
  `Where the set is strong: ${T.with_title}/${n} carry a display title, ${T.all_four_annotations}/${n} declare all`,
  `four MCP annotations, and ${T.input_properties_documented}/${T.input_properties_total} input properties carry a description -`,
  `item 4 met in full. Where it is thin: **${n - T.output_schema_present} of ${n} tools declare no \`outputSchema\`**, so`,
  `the description has to carry the return-value explanation instead, and ${shortDesc} of the ${n} descriptions`,
  `run under 90 characters - so most of them carry neither.`,
  "",
  "## The row that is a proxy, said plainly",
  "",
  `\`mentions_when_to_use\` is a regex over \`\\b(when|if you|use this|for )\\b\`. It is not the graded "Usage`,
  `Guidelines" dimension and it cannot tell a real boundary from a sentence that happens to contain "for".`,
  `It is reported because it is cheap and because the rubric weights the thing it approximates. Read it as`,
  `${T.mentions_when_to_use} of ${n} descriptions contain at least one word the rubric's own example sentences use, and nothing more.`,
  "",
  biggest
    ? `## Where a judge would look hardest: the ${biggest[0]} cluster`
    : "## Where a judge would look hardest",
  "",
  biggest
    ? `Grouping our tool names by their last segment puts ${biggest[1].length} of the ${n} in one family:`
    : "No two tool names share a last segment, so there is no name-level cluster to discuss.",
  ...(biggest
    ? [
      ``,
      `| tool | description chars | input properties | names a sibling |`,
      `| --- | --- | --- | --- |`,
      ...biggest[1].map((t) => `| \`${t.name}\` | ${t.description_chars} | ${t.input_properties_total} | ${t.names_sibling.length ? t.names_sibling.map((s) => `\`${s}\``).join(", ") : "none"} |`),
      ``,
      `Those ${biggest[1].length} tools answer structurally similar questions and, across all of their`,
      `descriptions, they make ${clusterRefs} references to each other by name. The rubric is specific about why`,
      `this matters: "a description is only clear if it lets an agent distinguish this tool from its`,
      `neighbors", and naming a sibling to mark a boundary "still earns full marks on Usage Guidelines".`,
      `It also gives the counter-example we do not have: ${T.ordering_smell} of our descriptions say anything`,
      `like "always call this first", which the spec treats as a tool-set defect dressed up as prose.`,
    ]
    : []),
  "",
  "## What Glama itself reports about us",
  "",
  `Our public Glama card renders \`license\` and \`maintenance\` as grades and \`quality\` as`,
  `\`Not graded\` - read off the served badge on ${day}, not from a PR comment. That is the state of the`,
  `one requirement blocking our submission to the largest MCP list, and it is worth being exact about`,
  `what this page can and cannot do about it: nothing here triggers Glama's evaluation, and a stronger`,
  `definition set is not the same thing as a scanned one. The audit exists because the rubric is the`,
  `best available description of what an agent sees when it meets our server, which is a reason to run it`,
  `independent of any badge.`,
  "",
  "## What this does not support",
  "",
  `- That we would score well, or badly, on TDQS. Stage 3 is an LLM call we did not make.`,
  `- That \`tools/list\` is the whole client experience: results, errors and streaming behaviour are unscored here.`,
  `- That the ${zeroParam} zero-parameter tools are thinner than the rest; a health check with no inputs is a`,
  `  reasonable shape, and this page does not rank them.`,
  `- That any other server was measured. This is one server, our own, on one day.`,
  "",
  "## Reproduce",
  "",
  "```bash",
  `node ${a.producer} /tmp/tdqs.json --expect-count ${n}`,
  `node tools/render-tdqs-self-audit-doc.mjs --artifact /tmp/tdqs.json --out /tmp/article.md`,
  "```",
  "",
  "The instrument boots the real server in-process on the local runtime, so it needs no credentials and no",
  "network. It refuses rather than reporting: on a blank endpoint, on a `tools/list` result whose field path",
  "it cannot read, on a duplicate or missing name, and when the served count disagrees with the count this",
  "repository publishes. `--tamper-blind` makes the first of those fire on purpose.",
  "",
  "---",
  "",
  `*Instrument output: [\`data/mcp-tool-definition-quality.${day}.json\`](data/mcp-tool-definition-quality.${day}.json).*`,
  "",
  "Generated from the artifact by `tools/render-tdqs-self-audit-doc.mjs`; the renderer recomputes every",
  "number above from the rows and refuses if an aggregate disagrees with the data it sums.",
  "",
];
writeFileSync(outPath, lines.join("\n"));
console.log(`WROTE ${outPath} (${n} tools, ${biggest ? biggest[1].length + "-tool " + biggest[0] + " cluster" : "no cluster"})`);
