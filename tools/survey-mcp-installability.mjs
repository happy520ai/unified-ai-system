// Does a record in the official MCP Registry let anyone install the server?
//
// Motivation, stated as it happened: while comparing registry records against repositories we found
// that most records carry no package at all, which means "published in the registry" and "installable
// from the registry" are different claims. A directory that shows an install button can only do that for
// the first group. Nobody had counted the second.
//
// Method notes that matter to the reading:
//  - `GET /v0/servers` returns one row per PUBLISHED VERSION in oldest-first order, so N rows are not
//    N servers. The sample is therefore paged and de-duplicated by name; a `limit` is not a sample size.
//  - Every server is then read at `/versions/latest`, with the name percent-encoded. The unencoded form
//    answers 404, and counting packages on the first (oldest) list row instead of the latest record
//    gives a different number on purpose-different grounds, so both are recorded and reported.
//  - Structure only: counts, registry types, transport types, whether an identifier exists. No tool
//    names, descriptions or any other server-authored text is captured.
import { writeFileSync } from "node:fs";

const TARGET_SERVERS = Number(process.argv[2] || 40);
const MAX_PAGES = 15;
const CONCURRENCY = 5;
const OUT = process.argv[3] || ".pm/t639-installability.json";
const REG = "https://registry.modelcontextprotocol.io";
const started = new Date().toISOString();

async function getJson(url) {
  try {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    const text = await r.text();
    if (!r.ok) return { status: r.status, error: text.slice(0, 80) };
    return { status: r.status, body: JSON.parse(text) };
  } catch (e) {
    return { status: 0, error: e.name + " " + String(e.message).slice(0, 60) };
  }
}

// Step 1: page through the list until enough DISTINCT servers are collected.
const byName = new Map();
let cursor = null;
let pages = 0;
let listErrors = 0;
for (; pages < MAX_PAGES && byName.size < TARGET_SERVERS; pages += 1) {
  const url = new URL(REG + "/v0/servers");
  url.searchParams.set("limit", "100");
  if (cursor) url.searchParams.set("cursor", cursor);
  const r = await getJson(url.toString());
  if (r.status !== 200) {
    listErrors += 1;
    console.log(`REFUSED: list page ${pages} http=${r.status} ${r.error || ""}`);
    process.exit(3);
  }
  for (const entry of r.body.servers || []) {
    const s = entry.server;
    if (s && s.name && !byName.has(s.name)) byName.set(s.name, s);
  }
  cursor = (r.body.metadata || {}).nextCursor || null;
  if (!cursor) break;
}

const names = [...byName.keys()];
if (names.length < Math.min(TARGET_SERVERS, 10)) {
  console.log(`REFUSED: only ${names.length} distinct servers after ${pages} pages - refusing to publish a thin sample`);
  process.exit(3);
}

// Step 2: read each server's latest record. `asked_with` is recorded for the dataset contract even
// though this question reads registry metadata rather than speaking MCP to a server.
const rows = [];
let next = 0;
async function worker() {
  for (;;) {
    const i = next++;
    if (i >= names.length) return;
    const name = names[i];
    const lat = await getJson(`${REG}/v0/servers/${encodeURIComponent(name)}/versions/latest`);
    const s = lat.body && lat.body.server;
    if (lat.status !== 200 || !s) {
      rows.push({ row_label: name, verdict: "latest_record_unreadable", http: lat.status, note: lat.error || "" });
      continue;
    }
    const pkg = (s.packages || [])[0] || null;
    const firstListRow = byName.get(name) || {};
    rows.push({
      row_label: name,
      verdict: pkg ? "package_present" : "no_package_in_record",
      version: String(s.version || ""),
      registry_type: pkg ? String(pkg.registryType || "?") : null,
      transport: pkg && pkg.transport ? String(pkg.transport.type || "?") : null,
      has_identifier: pkg ? Boolean(pkg.identifier) : false,
      repository_url_present: Boolean(s.repository && s.repository.url),
      packages_latest: (s.packages || []).length,
      packages_first_list_row: (firstListRow.packages || []).length,
    });
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const readable = rows.filter((r) => r.verdict !== "latest_record_unreadable");
const withPkg = readable.filter((r) => r.verdict === "package_present");
// A negative conclusion of this shape ("most records carry nothing installable") needs the
// instrument to prove it can see the positive case, so our own record is read the same way
// every time and reported as a control rather than as a member of the sample - the sample is the
// registry's default order over the first pages, which over-represents names starting with `a`,
// and ours is not in it.
const CONTROL = "io.github.happy520ai/unified-ai-system";
let control = { name: CONTROL, verdict: "unreadable" };
{
  const r = await getJson(`${REG}/v0/servers/${encodeURIComponent(CONTROL)}/versions/latest`);
  const s = r.body && r.body.server;
  if (r.status === 200 && s) {
    const pkg = (s.packages || [])[0] || null;
    control = {
      name: CONTROL,
      verdict: pkg ? "package_present" : "no_package_in_record",
      version: String(s.version || ""),
      registry_type: pkg ? String(pkg.registryType || "?") : null,
      transport: pkg && pkg.transport ? String(pkg.transport.type || "?") : null,
      in_sample: names.includes(CONTROL),
    };
  } else {
    control = { name: CONTROL, verdict: "unreadable", http: r.status, note: r.error || "" };
  }
}
if (control.verdict !== "package_present") {
  console.log(
    "REFUSED: the control record did not show a package, so a low package count cannot be read as " +
      "an ecosystem property - either the endpoint changed shape or the probe is broken. control=" +
      JSON.stringify(control),
  );
  process.exit(3);
}

const tally = {
  package_present: withPkg.length,
  no_package_in_record: readable.filter((r) => r.verdict === "no_package_in_record").length,
  latest_record_unreadable: rows.length - readable.length,
};
if (readable.length === 0) {
  console.log("REFUSED: no latest records were readable, so every absence claim below would be blindness");
  process.exit(3);
}

const transports = {};
const registryTypes = {};
for (const r of withPkg) {
  transports[r.transport || "?"] = (transports[r.transport || "?"] || 0) + 1;
  registryTypes[r.registry_type || "?"] = (registryTypes[r.registry_type || "?"] || 0) + 1;
}

const document = {
  survey: "mcp-registry-installability",
  producer: "tools/survey-mcp-installability.mjs",
  license: "Apache-2.0",
  run_started_utc: started,
  run_finished_utc: new Date().toISOString(),
  endpoint: REG + "/v0/servers",
  sample: {
    target_servers: TARGET_SERVERS,
    distinct_servers_collected: names.length,
    list_pages_read: pages,
    list_is_per_version_row: true,
    ordering: "registry default order, which is alphabetical by name over the first pages",
  },
  asked_with: "n/a - registry metadata, no MCP request was sent to a server",
  tally,
  transports_of_records_with_a_package: transports,
  registry_types_of_records_with_a_package: registryTypes,
  identifier_present: withPkg.filter((r) => r.has_identifier).length,
  repository_url_present: readable.filter((r) => r.repository_url_present).length,
  counting_on_the_oldest_row_instead: readable.filter((r) => r.packages_first_list_row > 0).length,
  control,
  rows,
};

writeFileSync(OUT, JSON.stringify(document, null, 2) + "\n");
console.log(
  `servers=${names.length} readable=${readable.length} with_package=${tally.package_present} ` +
    `without=${tally.no_package_in_record} unreadable=${tally.latest_record_unreadable} ` +
    `transports=${JSON.stringify(transports)} registry_types=${JSON.stringify(registryTypes)} ` +
    `counting_on_oldest_row=${document.counting_on_the_oldest_row_instead}`,
);
console.log(`control=${JSON.stringify(control)} wrote ${OUT} rows=${rows.length}`);
