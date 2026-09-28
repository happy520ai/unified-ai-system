// Does a public MCP server route by the Mcp-Method header, or by the JSON-RPC body?
//
// Why this exists: our own server advertises `Mcp-Method` and `Mcp-Name` in its CORS allow-list
// (packages/mcp-server/src/http.js:25-26), and nothing in this repository ever reads their value.
// Meanwhile the MCP SDK repos are actively filing header-vs-body routing inconsistencies
// (python-sdk#3269, go-sdk#1164). A gateway that advertises a header it does not inspect is fine;
// a server that *routes* on it is a different machine - that one can be pointed at a method the
// caller never wrote in the body. Only measurement says which world we are in.
//
// Two legs, differing by exactly one header pair, body byte-identical:
//   baseline: tools/list, no Mcp-Method        -> the positive control; must serve a tool list
//   spoof:    tools/list + Mcp-Method: prompts/list
// If the spoofed request still returns `result.tools`, the body wins. If it returns `result.prompts`,
// or a -32601/-32602 about prompts/list, the server looked at the header.
//
// Deliberately read-only: prompts/list and tools/list are discovery. No tools/call leg, because
// invoking a stranger's tool is not something an anonymous survey gets to do.
// Not wired into CI: this measures other people's servers, and its numbers belong to its timestamp.
const LIMIT = Number(process.argv[2] || 40);
const TIMEOUT = 9000;
const REVISION = "2025-06-18";
const UA = "unified-ai-system-survey/1.0 (+https://github.com/happy520ai/unified-ai-system)";
const BODY_METHOD = "tools/list";
const SPOOF_METHOD = "prompts/list";

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
    if (opts.routeMethod) headers["mcp-method"] = opts.routeMethod;
    const res = await fetch(base, { method: "POST", headers, body: JSON.stringify(body), signal: ctl.signal });
    const text = await res.text();
    const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
    let payload = null;
    try {
      payload = JSON.parse(dataLine ? dataLine.slice(5).trim() : text);
    } catch {
      payload = null;
    }
    return {
      status: res.status,
      payload,
      sessionId: res.headers.get("mcp-session-id"),
      resultKeys: payload?.result ? Object.keys(payload.result) : [],
      errorCode: payload?.error?.code ?? null,
      errorText: payload?.error ? JSON.stringify(payload.error).slice(0, 90) : null,
    };
  } finally {
    clearTimeout(timer);
  }
}

const rows = [];
for (const target of targets.slice(0, LIMIT)) {
  const record = { name: target.name, url: target.url, verdict: "unknown" };
  try {
    const init = await call(
      target.url,
      {
        jsonrpc: "2.0",
        id: String((id += 1)),
        method: "initialize",
        params: { protocolVersion: REVISION, capabilities: {}, clientInfo: { name: "uai-route-header-probe", version: "0.1.0" } },
      },
      { revision: REVISION },
    );
    if (init.status === 401 || init.status === 403) record.verdict = "auth_required";
    else if (!init.payload?.result) record.verdict = `init_failed_${init.status}`;
    else {
      const revision = typeof init.payload.result.protocolVersion === "string" ? init.payload.result.protocolVersion : REVISION;
      const session = init.sessionId;
      const opts = { revision, sessionId: session ?? undefined };
      await call(target.url, { jsonrpc: "2.0", method: "notifications/initialized" }, opts);

      const baseline = await call(target.url, { jsonrpc: "2.0", id: String((id += 1)), method: BODY_METHOD, params: {} }, opts);
      const spoof = await call(
        target.url,
        { jsonrpc: "2.0", id: String((id += 1)), method: BODY_METHOD, params: {} },
        { ...opts, routeMethod: SPOOF_METHOD },
      );
      record.baseline_status = baseline.status;
      record.baseline_keys = baseline.resultKeys;
      record.spoof_status = spoof.status;
      record.spoof_keys = spoof.resultKeys;
      record.spoof_error_code = spoof.errorCode;
      record.spoof_error_text = spoof.errorText;

      const baselineIsToolList = baseline.resultKeys.includes("tools");
      if (!baselineIsToolList) {
        // Without a working baseline the two legs cannot be compared, so absence of a spoof effect
        // would be a blind reading dressed as a negative result.
        record.verdict = `baseline_blind_${baseline.status}`;
      } else if (spoof.resultKeys.includes("prompts")) {
        record.verdict = "HEADER_ROUTES_IT";
      } else if (spoof.errorCode !== null && String(spoof.errorText || "").includes(SPOOF_METHOD)) {
        record.verdict = "HEADER_READ_AND_REJECTED";
      } else if (spoof.resultKeys.includes("tools")) {
        record.verdict = "body_wins";
      } else {
        record.verdict = `spoof_changed_shape_${spoof.status}`;
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
const usable = rows.filter((r) => ["body_wins", "HEADER_ROUTES_IT", "HEADER_READ_AND_REJECTED"].includes(r.verdict)).length;
console.log(JSON.stringify({ attempted: rows.length, asked_with: REVISION, usable_comparison: usable, tally, rows }, null, 1));
