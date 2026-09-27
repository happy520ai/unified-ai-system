// Does a public MCP server care which protocol revision we name in the request header?
//
// The 2025-06-18 revision says the client MUST put `MCP-Protocol-Version` on every request after
// `initialize`, and a server SHOULD reject a request whose header names a revision it did not agree
// to. Our own upstream client replays the session id the server issued but never sends the revision
// it negotiated, so the value we already capture from the handshake goes nowhere. Whether that is a
// bug that bites or a formality nobody enforces is a measurement, not an opinion - so this probe
// changes exactly one header per request and nothing else.
//
// Three legs per server, each differing from the baseline by one thing:
//   baseline   header = the revision the server ANSWERED with   -> what a correct client would do
//   omitted    header absent entirely                            -> is the header required?
//   asked      header = the revision we REQUESTED (only when it differs) -> is a mismatch punished?
//
// Deliberately not wired into CI: this measures other people's servers, and its numbers belong to
// the timestamp they were taken at.
const LIMIT = Number(process.argv[2] || 40);
const TIMEOUT = 9000;
const ASKED = "2025-06-18";
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
    return {
      status: res.status,
      payload,
      sessionId: res.headers.get("mcp-session-id"),
      contentType: res.headers.get("content-type") || "",
    };
  } finally {
    clearTimeout(timer);
  }
}

function served(res) {
  return res.status < 400 && Boolean(res.payload?.result);
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
        params: { protocolVersion: ASKED, capabilities: {}, clientInfo: { name: "uai-revision-header-probe", version: "0.1.0" } },
      },
      { revision: ASKED },
    );
    if (init.status === 401 || init.status === 403) {
      record.verdict = "auth_required";
      rows.push(record);
      await new Promise((r) => setTimeout(r, 250));
      continue;
    }
    const answered = init.payload?.result?.protocolVersion;
    if (typeof answered !== "string") {
      record.verdict = `init_failed_${init.status}`;
      rows.push(record);
      await new Promise((r) => setTimeout(r, 250));
      continue;
    }
    record.asked = ASKED;
    record.answered = answered;
    record.negotiated_upward = answered !== ASKED;
    const session = init.sessionId;
    record.session_id = Boolean(session);
    const opts = { sessionId: session ?? undefined };
    await call(target.url, { jsonrpc: "2.0", method: "notifications/initialized" }, { ...opts, revision: answered });

    const baseline = await call(target.url, { jsonrpc: "2.0", id: String((id += 1)), method: "tools/list", params: {} }, { ...opts, revision: answered });
    const omitted = await call(target.url, { jsonrpc: "2.0", id: String((id += 1)), method: "tools/list", params: {} }, { ...opts, revision: undefined });
    record.baseline_status = baseline.status;
    record.baseline_served = served(baseline);
    record.omitted_status = omitted.status;
    record.omitted_served = served(omitted);
    record.tools_baseline = (baseline.payload?.result?.tools || []).length || null;
    record.tools_omitted = (omitted.payload?.result?.tools || []).length || null;

    if (record.negotiated_upward) {
      const asked = await call(target.url, { jsonrpc: "2.0", id: String((id += 1)), method: "tools/list", params: {} }, { ...opts, revision: ASKED });
      record.asked_status = asked.status;
      record.asked_served = served(asked);
      record.tools_asked = (asked.payload?.result?.tools || []).length || null;
    }

    if (!record.baseline_served) record.verdict = `baseline_rejected_${baseline.status}`;
    else if (!record.omitted_served) record.verdict = "HEADER_REQUIRED";
    else if (record.negotiated_upward && record.asked_served === false) record.verdict = "MISMATCH_PUNISHED";
    else record.verdict = "accepts_anything_we_tried";
  } catch (err) {
    record.verdict = `error:${String(err.message).slice(0, 30)}`;
  }
  rows.push(record);
  await new Promise((r) => setTimeout(r, 250));
}

const tally = {};
for (const r of rows) tally[r.verdict] = (tally[r.verdict] || 0) + 1;
const upward = rows.filter((r) => r.negotiated_upward).length;
console.log(JSON.stringify({ attempted: rows.length, asked: ASKED, negotiated_upward: upward, tally, rows }, null, 1));
