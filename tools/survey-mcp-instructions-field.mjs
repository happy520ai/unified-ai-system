// How much server-controlled natural language do reachable MCP servers actually send?
//
// MCP-2026-015 (modelcontextprotocol/modelcontextprotocol#3213) argues that `instructions` on
// `initialize` and `server/discover` is an unauthenticated write into an LLM system prompt, and that
// `cacheScope: "public"` lets a middlebox spread it. The discussion needs the deployment fact nobody
// had: how many servers you can reach anonymously send the field at all, how long it is, and whether
// anyone pairs it with a public cache scope.
//
// Deliberately not wired into CI. This measures other people's servers, and its numbers belong to the
// timestamp they were taken at.
//
// Nothing from a server response is ever re-emitted as text by this script: lengths, key names and a
// digest only. An `instructions` field is exactly the kind of payload that should not be copied into
// a human-facing artifact, and copying it into a terminal is the same mistake.
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

const { createHash } = await import("node:crypto");
const digest = (value) => createHash("sha256").update(String(value)).digest("hex").slice(0, 12);

// Shape only: does the string read like advice to a model rather than a human-facing blurb. Reported
// as counts of matched markers, never as the text itself.
const MARKERS = [/ignore (all|any) (previous|prior|safety)/i, /you are (now|a)/i, /do not (tell|reveal|inform)/i, /system prompt/i, /\bOVERRIDE\b/i];
const shapeOf = (value) => ({
  chars: String(value).length,
  digest: digest(value),
  markers: MARKERS.filter((re) => re.test(String(value))).length,
});

const rows = [];
for (const target of targets.slice(0, LIMIT)) {
  const record = { name: target.name, url: target.url, verdict: "unknown" };
  try {
    const init = await call(target.url, {
      jsonrpc: "2.0",
      id: String((id += 1)),
      method: "initialize",
      params: { protocolVersion: REVISION, capabilities: {}, clientInfo: { name: "uai-instructions-probe", version: "0.1.0" } },
    });
    if (init.status === 401 || init.status === 403) record.verdict = "auth_required";
    else if (!init.payload?.result) record.verdict = `init_failed_${init.status}`;
    else {
      record.verdict = "answered";
      const initInstructions = init.payload.result.instructions;
      record.init_instructions = typeof initInstructions === "string" ? shapeOf(initInstructions) : initInstructions === undefined ? null : "non_string";
      const session = init.sessionId;
      await call(target.url, { jsonrpc: "2.0", method: "notifications/initialized" }, session);
      const found = await call(target.url, { jsonrpc: "2.0", id: String((id += 1)), method: "server/discover", params: {} }, session);
      const result = found.payload?.result;
      record.discover = result ? "answered" : found.payload?.error ? `error_${found.payload.error.code ?? "no_code"}` : `http_${found.status}`;
      if (result) {
        record.discover_keys = Object.keys(result).sort().join(",");
        record.discover_cache_scope = typeof result.cacheScope === "string" ? result.cacheScope : null;
        record.discover_ttl_ms = Number.isFinite(result.ttlMs) ? result.ttlMs : null;
        const dInstructions = result.instructions;
        record.discover_instructions = typeof dInstructions === "string" ? shapeOf(dInstructions) : dInstructions === undefined ? null : "non_string";
      }
    }
  } catch (err) {
    record.verdict = `error:${String(err.message).slice(0, 30)}`;
  }
  rows.push(record);
  await new Promise((r) => setTimeout(r, 350));
}

const answered = rows.filter((r) => r.verdict === "answered");
const withInit = answered.filter((r) => r.init_instructions && r.init_instructions !== "non_string");
const discoverAnswered = rows.filter((r) => r.discover === "answered");
console.log(JSON.stringify({
  attempted: rows.length,
  answered_initialize: answered.length,
  sent_instructions_on_initialize: withInit.length,
  initialize_instruction_chars: withInit.map((r) => r.init_instructions.chars).sort((a, b) => a - b),
  initialize_marker_hits: withInit.filter((r) => r.init_instructions.markers > 0).length,
  answered_server_discover: discoverAnswered.length,
  discover_with_instructions: discoverAnswered.filter((r) => r.discover_instructions).length,
  discover_cache_scopes: discoverAnswered.map((r) => r.discover_cache_scope).filter(Boolean),
  rows,
}, null, 1));
