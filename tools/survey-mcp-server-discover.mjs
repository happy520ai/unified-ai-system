// How many publicly advertised MCP servers actually implement `server/discover`?
//
// `2026-07-28` makes `server/discover` a named RPC for returning supported protocol versions,
// capabilities and identity in one call, and one server maintainer's logs already show real clients
// sending it and receiving `-32601 method not found`. Nobody has a number for how much of the
// reachable population answers it, so a gateway cannot decide whether to try it first or fall back.
//
// Deliberately not wired into CI: this measures other people's servers, and its numbers belong to
// the timestamp they were taken at. Anonymous, read-only, at most three requests per server.
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
async function call(base, body, sessionId) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "user-agent": UA,
      "mcp-protocol-version": REVISION,
    };
    // Replay whatever the upstream issued. A rejection caused by a missing session would otherwise
    // be counted as "does not implement server/discover", which is a different claim entirely.
    if (sessionId) headers["mcp-session-id"] = sessionId;
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

const rows = [];
for (const target of targets.slice(0, LIMIT)) {
  const record = { name: target.name, url: target.url, verdict: "unknown" };
  try {
    const init = await call(target.url, {
      jsonrpc: "2.0",
      id: String((id += 1)),
      method: "initialize",
      params: { protocolVersion: REVISION, capabilities: {}, clientInfo: { name: "uai-discover-probe", version: "0.1.0" } },
    });
    record.negotiated = init.payload?.result?.protocolVersion ?? null;
    if (init.status === 401 || init.status === 403) record.verdict = "auth_required";
    else if (!init.payload?.result) record.verdict = `init_failed_${init.status}`;
    else {
      const session = init.sessionId;
      record.issued_session = Boolean(session);
      await call(target.url, { jsonrpc: "2.0", method: "notifications/initialized" }, session);
      const found = await call(target.url, { jsonrpc: "2.0", id: String((id += 1)), method: "server/discover", params: {} }, session);
      record.discover_status = found.status;
      record.discover_error = found.payload?.error?.code ?? null;
      record.discover_error_text = found.payload?.error?.message ? String(found.payload.error.message).slice(0, 80) : null;
      if (found.payload?.result) {
        record.verdict = "DISCOVER_IMPLEMENTED";
        record.discover_keys = Object.keys(found.payload.result).sort().join(",");
      } else if (found.payload?.error?.code === -32601) record.verdict = "method_not_found";
      else if (found.payload?.error) record.verdict = `other_error_${found.payload.error.code}`;
      else record.verdict = `no_payload_${found.status}`;
    }
  } catch (err) {
    record.verdict = `error:${String(err.message).slice(0, 30)}`;
  }
  rows.push(record);
  await new Promise((r) => setTimeout(r, 350));
}

const tally = {};
for (const r of rows) tally[r.verdict] = (tally[r.verdict] || 0) + 1;
const answeredInit = rows.filter((r) => r.verdict !== "auth_required" && !r.verdict.startsWith("init_failed_") && !r.verdict.startsWith("error:")).length;
console.log(JSON.stringify({
  attempted: rows.length,
  asked_with_revision: REVISION,
  answered_initialize: answeredInit,
  tally,
  implemented: rows.filter((r) => r.verdict === "DISCOVER_IMPLEMENTED").map((r) => ({ name: r.name, keys: r.discover_keys })),
  rows,
}, null, 1));
