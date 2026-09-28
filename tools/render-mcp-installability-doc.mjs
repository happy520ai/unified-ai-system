// Renders the installability survey into a markdown article.
//
// Every number in the output is read from the artifact. A missing field aborts the render, because the
// alternative is a page that quietly keeps a sentence from the previous run. Lines are built as
// double-quoted strings rather than one template literal: markdown backticks inside a template literal
// terminate the string, which is how the first version of this file failed to parse.
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const arg = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const IN = arg("--artifact", ".pm/t640-installability.json");
const OUT = arg("--out", "docs/mcp-registry-installability.md");

const d = JSON.parse(readFileSync(IN, "utf8"));
const required = [
  "survey",
  "producer",
  "run_started_utc",
  "sample",
  "asked_with",
  "tally",
  "transports_of_records_with_a_package",
  "registry_types_of_records_with_a_package",
  "repository_url_present",
  "counting_on_the_oldest_row_instead",
  "control",
  "rows",
];
for (const key of required) {
  if (d[key] === undefined) throw new Error("REFUSED: " + key + " missing from " + IN);
}

const readable = d.rows.filter((r) => r.verdict !== "latest_record_unreadable");
if (readable.length === 0) throw new Error("REFUSED: no readable rows, so an absence claim would be blindness");
const read = readable.length;
const tallySum = d.tally.package_present + d.tally.no_package_in_record + d.tally.latest_record_unreadable;
if (tallySum !== d.rows.length) throw new Error("REFUSED: tally sums to " + tallySum + " but there are " + d.rows.length + " rows");
if (d.counting_on_the_oldest_row_instead === d.tally.package_present) {
  throw new Error("REFUSED: the oldest-row count equals the latest-record count, so the trap paragraph would be false");
}
if (d.control.verdict !== "package_present") {
  throw new Error("REFUSED: the control record shows no package, so a low count is not evidence about the ecosystem");
}

const pct = (n) => Math.round((n / read) * 100) + "%";
const list = (obj) => Object.entries(obj).map(([k, v]) => "`" + k + "` " + v).join(", ");
const transports = list(d.transports_of_records_with_a_package);
const registryTypes = list(d.registry_types_of_records_with_a_package);
const withRepo = d.repository_url_present;
const sample = d.sample;
const runDate = d.run_started_utc.slice(0, 10);

const lines = [
  "# Is a registry-listed MCP server actually installable from the registry?",
  "",
  "Measured " + runDate + " by `" + d.producer + "` against `" + d.endpoint + "`.",
  "Asked with: " + d.asked_with + ".",
  "Structure only - counts, registry types, transports, and whether an identifier field exists.",
  "No tool names, descriptions or any other server-authored text is captured.",
  "",
  "## What we counted",
  "",
  "| | count | share of servers read |",
  "| --- | --- | --- |",
  "| distinct servers collected | " + sample.distinct_servers_collected + " | - |",
  "| latest record readable | " + read + " | " + pct(read) + " |",
  "| **record carries a `packages` entry** | **" + d.tally.package_present + "** | " + pct(d.tally.package_present) + " |",
  "| record carries none | " + d.tally.no_package_in_record + " | " + pct(d.tally.no_package_in_record) + " |",
  "| record names a repository URL | " + withRepo + " | " + pct(withRepo) + " |",
  "",
  "Of the " + d.tally.package_present + " that do carry a package: transports " + transports + ";",
  "registry types " + registryTypes + ". The sample is the registry's own default order over the first",
  "pages, which groups toward the front of the alphabet, so read the type breakdown as one sample's",
  "shape rather than the population's.",
  "",
  "## What this field does and does not tell you",
  "",
  "`published in the official registry` and `this record carries an artifact an installer can consume`",
  "are two claims, and only the second is what an install button needs. In this sample the second",
  "held for " + d.tally.package_present + " of " + read + " records.",
  "",
  "What this page does **not** measure is the other way a record can be actionable: a `remotes` entry,",
  "which points a client at a hosted endpoint instead of at a package. The instrument that produced",
  "these rows read `packages` and nothing else, so the " + d.tally.no_package_in_record + " package-less records here are",
  "*unclassified as to reachability*: this reading cannot say whether any of them carries a remote, and",
  "a reader must not conclude that it does not. Sentence corrected 2026-09-28 - an earlier version of",
  "this page asserted that those records told a client nothing at all, which the field that was",
  "actually measured cannot support either way.",
  "",
  "That is not a judgement about the servers. A record can be complete as a catalogue item and still",
  "carry no package, because the package is the part an installer consumes and the repository is the",
  "part a human reads.",
  "",
  "## Two ways to read the same field and get different numbers",
  "",
  "Reading the list endpoint's first row for a server counts packages on its **oldest published**",
  "version: the list comes grouped by server name with each name's versions oldest-first, so the first",
  "row carrying a name is that name's earliest record. That gives",
  d.counting_on_the_oldest_row_instead + "; reading each server's latest record gives",
  d.tally.package_present + ". Neither is a typo for the other: they are different questions, and only the",
  "second is about what someone installing today would receive.",
  "",
  "The same endpoint also does not treat a limit as a sample size - " + sample.list_pages_read + " pages were read",
  "to reach " + sample.distinct_servers_collected + " distinct servers, because `limit` counts rows and rows are versions.",
  "",
  "## Our own record, read as a control and not as a sample member",
  "",
  "The instrument reads `" + d.control.name + "` the same way every run and refuses to publish if it comes",
  "back without a package - otherwise a low count is indistinguishable from a broken probe. It reports",
  d.control.verdict.replace(/_/g, " ") + ", registry type `" + d.control.registry_type + "`, transport `" + d.control.transport + "`, version " + d.control.version + ".",
  "It is **not** a member of the sample above (`in_sample: " + d.control.in_sample + "`): the alphabetical prefix",
  "this sample draws from stops before it. So the honest reading is that every sampled package was",
  "npm-over-" + transports + ", and the container-image case here is ours, observed outside the sample.",
  "",
  "## Deliberately not claimed",
  "",
  "- That the ratio holds across the whole registry: " + read + " servers, one ordering, one day.",
  "- That a record without a package is unreachable. Only `packages` was read in this window, so whether",
  "  these records carry a `remotes` entry is a question this page cannot answer in either direction.",
  "- That a record without a package is unmaintained or low quality. " + withRepo + " of " + read + " name a repository, which",
  "  is still somewhere a reader can go.",
  "- That any particular directory shows or hides these servers in any particular way. No directory was",
  "  asked anything here; this is a reading of the registry's own API.",
  "",
  "## Reproduce",
  "",
  "```bash",
  "node " + d.producer + " " + sample.target_servers + " /tmp/installability.json",
  "node tools/render-mcp-installability-doc.mjs --artifact /tmp/installability.json --out /tmp/article.md",
  "```",
  "",
  "Needs network, no credentials, and captures structure only.",
  "",
];

writeFileSync(OUT, lines.join("\n"));
console.log("rendered " + OUT + " from " + IN + ": servers=" + sample.distinct_servers_collected + " with_package=" + d.tally.package_present + "/" + read + " control=" + d.control.verdict);
