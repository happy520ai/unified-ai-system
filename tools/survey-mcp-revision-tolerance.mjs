// Asks public remote MCP servers to speak a protocol revision that does not exist, and records
// what they do. The spec says a server must answer with a revision it supports and reject ones it
// does not, so "agreed to 9999-99-99" is not a style preference - it is a server that is not
// checking, which means a client cannot tell from the handshake whether the conversation it is
// about to have is the one it asked for.
//
// Deliberately not wired into CI: this measures other people's servers, and its numbers belong to
// the timestamp they were taken at. See docs/mcp-tools-list-pagination-survey.md.
const LIMIT = Number(process.argv[2] || 40);
const TIMEOUT = 9000;
const BOGUS = "9999-99-99";
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
      if (remote.type !== "streamable-http" && !String(remote.url || "").startsWith("http")) continue;
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
async function rpc(base, params) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(base, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "user-agent": UA,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: String((id += 1)),
        method: "initialize",
        params: {
          protocolVersion: params.protocolVersion,
          capabilities: {},
          clientInfo: { name: "uai-revision-tolerance", version: "0.1.0" },
        },
      }),
      signal: ctl.signal,
    });
    const text = await res.text();
    const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
    let payload = null;
    try {
      payload = JSON.parse(dataLine ? dataLine.slice(5).trim() : text);
    } catch {
      payload = null;
    }
    return { status: res.status, payload };
  } finally {
    clearTimeout(timer);
  }
}

function classify(answered, status, payload) {
  if (payload?.error) return "error_object";
  const got = payload?.result?.protocolVersion;
  if (!got) return `no_version_${status}`;
  if (got === BOGUS) return "AGREED_TO_THE_IMPOSSIBLE";
  if (got === answered) return "substituted_supported_version";
  return `answered_${got}`;
}

const rows = [];
for (const target of targets.slice(0, LIMIT)) {
  const record = { name: target.name, url: target.url };
  try {
    const bogus = await rpc(target.url, { protocolVersion: BOGUS });
    record.bogus_status = bogus.status;
    record.bogus_answered = bogus.payload?.result?.protocolVersion ?? null;
    record.verdict = classify("2025-06-18", bogus.status, bogus.payload);
    if (bogus.status === 401 || bogus.status === 403) record.verdict = "auth_required";
  } catch (err) {
    record.verdict = `error:${String(err.message).slice(0, 40)}`;
  }
  rows.push(record);
  await new Promise((r) => setTimeout(r, 300));
}

const tally = {};
for (const r of rows) tally[r.verdict] = (tally[r.verdict] || 0) + 1;
console.log(JSON.stringify({ attempted: rows.length, asked_with: BOGUS, tally, rows }, null, 1));
