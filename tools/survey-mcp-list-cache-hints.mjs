// Does a public MCP server declare how long its tool list may be cached - and would we hear it?
//
// Why this exists: the gateway caches every upstream's tool list for a hard-coded 60_000 ms
// (apps/ai-gateway-service/src/mcpGatewayService.ts:29, read at :235), and the list-walking client
// reads only `tools` and `nextCursor` from the response. The spec offers `ttlMs` and `cacheScope` on
// list results precisely so a server can tell a cache what it is allowed to assume. We never look.
// Whether that costs anything today is a measurement, so this measures instead of guessing.
//
// Records only structure: presence, type, numeric bucket, counts. No tool descriptions, titles, or
// any other server prose is copied out - same discipline as the instructions-field survey, because
// server-authored text is the injection surface that page argues about.
//
// Not wired into CI: it measures other people's servers, and its numbers belong to its timestamp.
const LIMIT = Number(process.argv[2] || 40);
const TIMEOUT = 9000;
const REVISION = "2025-06-18";
const UA = "unified-ai-system-survey/1.0 (+https://github.com/happy520ai/unified-ai-system)";

const seen = new Set();
const targets = [];
for (let offset = 0; targets.length < LIMIT * 3 && offset < 400; offset += 100) {
  const res = await fetch(`https://registry.modelcontextprotocol.io/v0/servers?limit=100&offset=${offset}`, {
    headers: { "user-agent": UA, accept: "application/json" },
  });
  if (!res.ok) break;
  const doc = await res.json();
  for (const row of doc.servers || []) {
    for (const remote of row.server?.remotes || []) {
      if (remote.type !== "streamable-http") continue;
      let url;
      try {
        url = new URL(remote.url);
      } catch {
        continue;
      }
      if (url.protocol !== "https:") continue;
      const key = url.origin + url.pathname;
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push({ name: row.server.name, url: key });
      if (targets.length >= LIMIT * 3) break;
    }
  }
}

let id = 0;
async function call(base, body, opts = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "user-agent": UA,
    };
    if (opts.revision) headers["mcp-protocol-version"] = opts.revision;
    if (opts.sessionId) headers["mcp-session-id"] = opts.sessionId;
    const res = await fetch(base, { method: "POST", headers, body: JSON.stringify(body), signal: ctl.signal });
    const text = await res.text();
    const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
    let payload = null;
    try {
      payload = JSON.parse(dataLine ? dataLine.slice(5).trim() : text);
    } catch {
      payload = null;
    }
    return { status: res.status, payload, sessionId: res.headers.get("mcp-session-id") };
  } finally {
    clearTimeout(timer);
  }
}

// Shape only: what a cache could act on, without keeping any of the server's words.
function describe(result) {
  const tools = Array.isArray(result?.tools) ? result.tools : [];
  const ttlValues = [];
  let toolTtl = 0;
  let toolScope = 0;
  let toolMeta = 0;
  for (const t of tools) {
    if (t && typeof t.ttlMs === "number") {
      toolTtl += 1;
      ttlValues.push(t.ttlMs);
    }
    if (t && typeof t.cacheScope === "string") toolScope += 1;
    if (t && t._meta && typeof t._meta === "object") toolMeta += 1;
  }
  return {
    toolCount: tools.length,
    result_ttlMs_type: result && "ttlMs" in result ? typeof result.ttlMs : "absent",
    result_ttlMs_value: typeof result?.ttlMs === "number" ? result.ttlMs : null,
    result_cacheScope: typeof result?.cacheScope === "string" ? result.cacheScope : "absent",
    result_has_meta: Boolean(result && result._meta && typeof result._meta === "object"),
    result_keys: result ? Object.keys(result) : [],
    tools_with_ttlMs: toolTtl,
    tools_with_cacheScope: toolScope,
    tools_with_meta: toolMeta,
    min_tool_ttlMs: ttlValues.length > 0 ? Math.min(...ttlValues) : null,
    max_tool_ttlMs: ttlValues.length > 0 ? Math.max(...ttlValues) : null,
  };
}

const rows = [];
for (const target of targets.slice(0, LIMIT)) {
  const record = { name: target.name, url: target.url, verdict: "unknown" };
  try {
    const init = await call(target.url, {
      jsonrpc: "2.0",
      id: String((id += 1)),
      method: "initialize",
      params: { protocolVersion: REVISION, capabilities: {}, clientInfo: { name: "uai-cache-hint-probe", version: "0.1.0" } },
    }, { revision: REVISION });
    if (init.status === 401 || init.status === 403) record.verdict = "auth_required";
    else if (!init.payload?.result) record.verdict = `init_failed_${init.status}`;
    else {
      const revision = typeof init.payload.result.protocolVersion === "string" ? init.payload.result.protocolVersion : REVISION;
      const opts = { revision, sessionId: init.sessionId ?? undefined };
      record.session_id = Boolean(init.sessionId);
      await call(target.url, { jsonrpc: "2.0", method: "notifications/initialized" }, opts);
      const listed = await call(target.url, { jsonrpc: "2.0", id: String((id += 1)), method: "tools/list", params: {} }, opts);
      const shape = describe(listed.payload?.result);
      record.shape = shape;
      record.list_status = listed.status;
      record.tools = shape.toolCount;

      // Positive control: a server that never gave us a tool list cannot be said to have
      // "declared no cache hints". Absence of a hint needs a list to be absent from.
      if (!Array.isArray(listed.payload?.result?.tools)) {
        record.verdict = `no_tool_list_${listed.status}`;
      } else if (shape.result_ttlMs_type === "number" || shape.result_cacheScope !== "absent") {
        record.verdict = "RESULT_LEVEL_HINT";
      } else if (shape.tools_with_ttlMs > 0 || shape.tools_with_cacheScope > 0) {
        record.verdict = "TOOL_LEVEL_HINT";
      } else {
        record.verdict = "no_cache_hint_declared";
      }
    }
  } catch (err) {
    record.verdict = `error:${String(err.message).slice(0, 30)}`;
  }
  rows.push(record);
  await new Promise((r) => setTimeout(r, 250));
}

const tally = {};
for (const r of rows) tally[r.verdict] = (tally[r.verdict] || 0) + 1;
const comparable = rows.filter((r) => r.shape);
const anyHint = comparable.filter((r) => r.verdict === "RESULT_LEVEL_HINT" || r.verdict === "TOOL_LEVEL_HINT").length;
console.log(JSON.stringify({
  attempted: rows.length,
  servers_with_a_tool_list: comparable.length,
  declaring_any_cache_hint: anyHint,
  our_gateway_cache_ttl_ms: 60000,
  tally,
  rows,
}, null, 1));
