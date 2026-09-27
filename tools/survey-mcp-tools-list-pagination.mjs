// Measures how many public remote MCP servers paginate `tools/list`, and which protocol
// revision they answer with. It reads the official MCP registry for `streamable-http` records
// and sends each one an anonymous `initialize` followed by `tools/list` - no credentials, no
// writes, one request per method plus one more only when a cursor appears.
//
// Deliberately not wired into CI: a network survey cannot be a gate, because its result is
// other people's servers. Run it knowingly, and re-run before quoting it - the numbers belong
// to the timestamp they were taken at. See docs/mcp-tools-list-pagination-survey.md.
const LIMIT = Number(process.argv[2] || 30);
const TIMEOUT = 9000;
const UA = "unified-ai-system-survey/1.0 (+https://github.com/happy520ai/unified-ai-system)";

const seen = new Set();
const targets = [];
for (let offset = 0; targets.length < LIMIT * 3 && offset < 200; offset += 100) {
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
function rpc(base, method, params, sessionId) {
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "user-agent": UA,
    "mcp-protocol-version": "2025-06-18",
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const body = { jsonrpc: "2.0", id: String((id += 1)), method, params };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  return fetch(base, { method: "POST", headers, body: JSON.stringify(body), signal: ctl.signal })
    .then(async (res) => {
      const text = await res.text();
      const sid = res.headers.get("mcp-session-id") || sessionId;
      let payload = null;
      const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
      try {
        payload = JSON.parse(dataLine ? dataLine.slice(5).trim() : text);
      } catch {
        payload = null;
      }
      return { status: res.status, payload, sid, sse: Boolean(dataLine) };
    })
    .finally(() => clearTimeout(timer));
}

const rows = [];
for (const target of targets.slice(0, LIMIT)) {
  const record = { name: target.name, url: target.url, outcome: "unknown" };
  try {
    const init = await rpc(target.url, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "uai-pagination-survey", version: "0.1.0" },
    });
    record.init_status = init.status;
    record.sse = init.sse;
    record.negotiated = init.payload?.result?.protocolVersion || null;
    if (!init.payload?.result) {
      record.outcome = init.status === 401 || init.status === 403 ? "auth_required" : init.status === 400 ? "rejected" : `no_result_${init.status}`;
      rows.push(record);
      await new Promise((r) => setTimeout(r, 250));
      continue;
    }
    const sid = init.sid;
    const listed = await rpc(target.url, "tools/list", {}, sid);
    const result = listed.payload?.result;
    if (!result) {
      record.outcome = `list_no_result_${listed.status}`;
      rows.push(record);
      await new Promise((r) => setTimeout(r, 250));
      continue;
    }
    record.tools_page1 = (result.tools || []).length;
    record.next_cursor_present = Object.prototype.hasOwnProperty.call(result, "nextCursor");
    record.next_cursor_value = typeof result.nextCursor === "string" ? result.nextCursor.slice(0, 24) : result.nextCursor ?? null;
    if (record.next_cursor_present && record.next_cursor_value) {
      const second = await rpc(target.url, "tools/list", { cursor: result.nextCursor }, sid);
      record.page2_tools = (second.payload?.result?.tools || []).length;
      record.page2_cursor = Boolean(second.payload?.result?.nextCursor);
      record.outcome = "PAGINATES";
    } else {
      record.outcome = "single_page";
    }
  } catch (err) {
    record.outcome = `error:${String(err.message).slice(0, 40)}`;
  }
  rows.push(record);
  await new Promise((r) => setTimeout(r, 300));
}

const tally = {};
for (const r of rows) tally[r.outcome] = (tally[r.outcome] || 0) + 1;
console.log(JSON.stringify({ attempted: rows.length, tally, rows }, null, 1));
