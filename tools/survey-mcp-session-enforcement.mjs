// Does a public MCP server that hands out an `MCP-Session-Id` actually require it?
//
// The newer revisions move toward stateless, so a session id is optional by contract - but a
// server that issues one and then accepts requests without it has created a token that means
// nothing, and a gateway cannot tell "this upstream is stateless" from "this upstream forgot to
// check". Only the second one is a bug.
//
// Two final requests per server differ in exactly one header, so a failure cannot be blamed on
// something else the client forgot to send. Deliberately not wired into CI: this measures other
// people's servers, and its numbers belong to the timestamp they were taken at.
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
      params: { protocolVersion: REVISION, capabilities: {}, clientInfo: { name: "uai-session-probe", version: "0.1.0" } },
    });
    if (init.status === 401 || init.status === 403) record.verdict = "auth_required";
    else if (!init.payload?.result) record.verdict = `init_failed_${init.status}`;
    else {
      const session = init.sessionId;
      record.issued_session = Boolean(session);
      if (!session) {
        // No token issued at all: the only honest statement is that there is nothing to enforce.
        const noSession = await call(target.url, { jsonrpc: "2.0", id: String((id += 1)), method: "tools/list", params: {} });
        record.no_session_status = noSession.status;
        record.tools = (noSession.payload?.result?.tools || []).length || null;
        record.verdict = "no_session_issued";
      } else {
        await call(target.url, { jsonrpc: "2.0", method: "notifications/initialized" }, session);
        const withSession = await call(target.url, { jsonrpc: "2.0", id: String((id += 1)), method: "tools/list", params: {} }, session);
        const withoutSession = await call(target.url, { jsonrpc: "2.0", id: String((id += 1)), method: "tools/list", params: {} }, null);
        record.with_session_status = withSession.status;
        record.without_session_status = withoutSession.status;
        record.tools_with = (withSession.payload?.result?.tools || []).length || null;
        record.tools_without = (withoutSession.payload?.result?.tools || []).length || null;
        const okWithout = withoutSession.status < 400 && Boolean(withoutSession.payload?.result);
        const okWith = withSession.status < 400 && Boolean(withSession.payload?.result);
        if (!okWith && okWithout) record.verdict = "session_breaks_it";
        else if (okWithout) record.verdict = "SESSION_NOT_ENFORCED";
        else record.verdict = "enforced";
      }
    }
  } catch (err) {
    record.verdict = `error:${String(err.message).slice(0, 30)}`;
  }
  rows.push(record);
  await new Promise((r) => setTimeout(r, 350));
}

const tally = {};
for (const r of rows) tally[r.verdict] = (tally[r.verdict] || 0) + 1;
console.log(JSON.stringify({ attempted: rows.length, asked_with: REVISION, tally, rows }, null, 1));
