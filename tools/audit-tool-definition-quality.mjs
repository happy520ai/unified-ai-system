// Score OUR OWN served MCP tool definitions against the mechanically checkable
// half of Glama's open Tool Definition Quality Score (TDQS) rubric.
//
// Why this exists: punkpeye/awesome-mcp-servers#12218 is held on one requirement - the
// Glama quality grade must not read "?". Glama publishes its methodology as a
// 760-line open specification (github.com/glama-ai/tool-definition-quality-score),
// and its "Improving your score" section is a checklist. Most of that checklist is
// deterministic - annotations declared, parameters documented, output schema
// described, sibling boundaries named, bloat - and needs no evaluator to check.
//
// What this is NOT: a TDQS score. Stage 3 of the pipeline is an LLM rubric call,
// so the graded dimensions (Purpose Clarity, Usage Guidelines, Conciseness, ...)
// are not computed here. This reads the same inputs TDQS reads - exactly what a
// client gets from tools/list - and reports the fields a maintainer can verify
// without a judge. No credential is used and no provider is called.
//
// Usage: node tools/audit-tool-definition-quality.mjs /tmp/tdqs.json [--expect-count N]
const ANNOTATIONS = ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"];
const HTTP_MODULE = new URL("../packages/mcp-server/src/http.js", import.meta.url).href;
const TIMEOUT = 20000;

// "always call this first" is the shape TDQS calls a priority rather than a
// boundary, and says no description fully offsets.
const ORDERING_SMELL = /\b(always call|call this first|before (?:using|calling)|first use)\b/i;
const BOUNDARY = /\b(?:instead|use the|other tool|for (?:that|this) use|when (?:you |the )?\w+ (?:need|want)|prefer)\b/i;
const WHEN_TO_USE = /\b(when|if you|use this|for )\b/i;

function walkSchema(schema, out) {
  if (!schema || typeof schema !== "object") return;
  const props = schema.properties;
  if (props && typeof props === "object") {
    for (const [name, child] of Object.entries(props)) {
      out.total += 1;
      if (child && typeof child === "object" && typeof child.description === "string" && child.description.trim()) out.documented += 1;
      if (child && Array.isArray(child.enum) && child.enum.length) out.withEnum += 1;
      if (child && typeof child === "object") walkSchema(child, out);
    }
  }
  if (schema.items && typeof schema.items === "object") walkSchema(schema.items, out);
}

function describeTool(tool, siblingNames) {
  const desc = typeof tool.description === "string" ? tool.description : null;
  const input = { total: 0, documented: 0, withEnum: 0 };
  walkSchema(tool.inputSchema, input);
  const output = { total: 0, documented: 0, withEnum: 0 };
  walkSchema(tool.outputSchema, output);
  const bareOutput =
    Boolean(tool.outputSchema) &&
    tool.outputSchema.type === "object" &&
    output.total === 0;
  const ann = tool.annotations && typeof tool.annotations === "object" ? tool.annotations : {};
  const declared = ANNOTATIONS.filter((k) => typeof ann[k] === "boolean");
  const text = desc || "";
  return {
    name: tool.name,
    has_title: typeof tool.title === "string" && tool.title.trim().length > 0,
    description_chars: text.length,
    description_words: (text.match(/\S+/g) || []).length,
    annotations_declared: declared,
    annotations_missing: ANNOTATIONS.filter((k) => !declared.includes(k)),
    input_properties_total: input.total,
    input_properties_documented: input.documented,
    input_undocumented: input.total - input.documented,
    input_with_enum: input.withEnum,
    required_count: Array.isArray(tool.inputSchema?.required) ? tool.inputSchema.required.length : 0,
    output_schema_present: Boolean(tool.outputSchema),
    output_schema_bare: bareOutput,
    output_properties_total: output.total,
    output_properties_documented: output.documented,
    names_sibling: siblingNames.filter((n) => n !== tool.name && text.includes(n)),
    states_boundary: BOUNDARY.test(text),
    mentions_when_to_use: WHEN_TO_USE.test(text),
    ordering_smell: ORDERING_SMELL.test(text),
  };
}

async function rpc(base, session, revision, body) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": revision,
    };
    if (session) headers["mcp-session-id"] = session;
    const res = await fetch(base, { method: "POST", headers, body: JSON.stringify(body), signal: ctl.signal });
    const text = await res.text();
    const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
    let payload = null;
    try {
      payload = JSON.parse(dataLine ? dataLine.slice(5).trim() : text);
    } catch {
      payload = null;
    }
    return { status: res.status, payload, session: res.headers.get("mcp-session-id") };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const outPath = argv.find((a) => !a.startsWith("--"));
  if (!outPath) {
    console.error("usage: node tools/audit-tool-definition-quality.mjs <artifact.json> [--expect-count N]");
    process.exit(2);
  }
  const expectIdx = argv.indexOf("--expect-count");
  const expect = expectIdx >= 0 ? Number(argv[expectIdx + 1]) : null;

  const { startMcpHttpServer } = await import(HTTP_MODULE);
  const server = await startMcpHttpServer({ env: {}, host: "127.0.0.1", port: 0 });
  let base = server.endpoint || server.baseUrl;
  // A refusal arm nobody has seen fire is a claim, not a defence. One character off
  // the path makes the handler answer without a result, which is exactly what exit 3
  // is for; the test suite runs this flag and asserts the refusal.
  if (argv.includes("--tamper-blind")) base = String(base).replace(/\/+$/, "") + "x";
  let pages = 0;
  let cursor = null;
  const raw = [];
  try {
    const init = await rpc(base, null, "2025-06-18", {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "tdqs-audit", version: "1" },
      },
    });
    const session = init.session;
    const revision = init.payload?.result?.protocolVersion;
    // `session` is deliberately not required: this server answers without an mcp-session-id, and
    // docs/mcp-session-enforcement.html is the measurement of that. Requiring one here would make
    // the instrument blind to its own subject.
    if (!revision) {
      console.error(`REFUSED: initialize returned status ${init.status} and no protocolVersion - the probe never reached the handler, so any tool count below would be a reading of a broken pipe (endpoint ${base}).`);
      process.exit(3);
    }
    do {
      pages += 1;
      const params = cursor ? { cursor } : {};
      const res = await rpc(base, session, revision, { jsonrpc: "2.0", id: 2 + pages, method: "tools/list", params });
      if (res.status >= 400 || !res.payload?.result) {
        console.error(`REFUSED: tools/list page ${pages} returned status ${res.status} without a result.`);
        process.exit(4);
      }
      const list = res.payload.result.tools;
      if (!Array.isArray(list)) {
        console.error(`REFUSED: tools/list result has no array under "tools" - the field path is wrong (keys: ${Object.keys(res.payload.result).join(", ")}).`);
        process.exit(5);
      }
      raw.push(...list);
      cursor = res.payload.result.nextCursor || null;
    } while (cursor && pages < 50);
  } finally {
    await server.stop?.();
  }

  const names = raw.map((t) => t?.name);
  const problems = [];
  if (names.some((n) => typeof n !== "string" || !n.trim())) {
    problems.push(`a served tool has no usable "name" - ${names.filter((n) => !n).length} of ${raw.length}`);
  }
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupes.length) problems.push(`duplicate tool names served: ${[...new Set(dupes)].join(", ")}`);
  if (raw.length === 0) problems.push("the server answered tools/list with zero tools - nothing here is a measurement of anything");
  if (Number.isInteger(expect) && raw.length !== expect) {
    problems.push(`served ${raw.length} tools but the pages publish ${expect} - either the claim drifted or this probe read a partial surface`);
  }
  if (problems.length) {
    console.error("REFUSED:\n" + problems.map((p) => "  - " + p).join("\n"));
    process.exit(6);
  }

  const siblingNames = [...new Set(names)];
  const tools = raw.map((t) => describeTool(t, siblingNames));
  const sum = (k) => tools.reduce((a, t) => a + t[k], 0);
  const artifact = {
    producer: "tools/audit-tool-definition-quality.mjs",
    rubric: "github.com/glama-ai/tool-definition-quality-score (open spec, stage 3 not run here)",
    inputs: "exactly what a client receives from tools/list over the credential-free local runtime",
    served_at: new Date().toISOString(),
    pages_read: pages,
    cursor_exhausted: cursor === null,
    expected_count: Number.isInteger(expect) ? expect : null,
    tool_count: tools.length,
    totals: {
      with_description: tools.filter((t) => t.description_chars > 0).length,
      with_title: tools.filter((t) => t.has_title).length,
      all_four_annotations: tools.filter((t) => t.annotations_declared.length === 4).length,
      no_annotations: tools.filter((t) => t.annotations_declared.length === 0).length,
      input_properties_total: sum("input_properties_total"),
      input_properties_documented: sum("input_properties_documented"),
      output_schema_present: tools.filter((t) => t.output_schema_present).length,
      output_schema_bare: tools.filter((t) => t.output_schema_bare).length,
      names_a_sibling: tools.filter((t) => t.names_sibling.length > 0).length,
      states_boundary: tools.filter((t) => t.states_boundary).length,
      mentions_when_to_use: tools.filter((t) => t.mentions_when_to_use).length,
      ordering_smell: tools.filter((t) => t.ordering_smell).length,
    },
    tools,
  };
  const { writeFileSync } = await import("node:fs");
  writeFileSync(outPath, JSON.stringify(artifact, null, 2) + "\n");
  const t = artifact.totals;
  console.log(
    `served ${artifact.tool_count} tools over ${pages} page(s); ` +
      `titles ${t.with_title}/${artifact.tool_count}; ` +
      `all-4-annotations ${t.all_four_annotations}; none ${t.no_annotations}; ` +
      `params documented ${t.input_properties_documented}/${t.input_properties_total}; ` +
      `output schema ${t.output_schema_present} (bare ${t.output_schema_bare}); ` +
      `when-to-use ${t.mentions_when_to_use}; boundary ${t.states_boundary}; ordering smell ${t.ordering_smell}`,
  );
  console.log(`WROTE ${outPath}`);
}

await main();
