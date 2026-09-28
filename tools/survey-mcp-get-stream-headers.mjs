// When there is no body to disagree with, does a server route by the Mcp-Method header?
//
// Why this exists: the POST survey (tools/survey-mcp-route-headers.mjs) found 16/16 servers serving
// the body's method, and published its own blind spot in plain words - it only asks whether a header
// can OVERRIDE A BODY. `Mcp-Method`/`Mcp-Name` exist for the case with no body: the GET SSE stream.
// So the honest next step is not to re-state the caveat, it is to close it.
//
// Two GETs, differing by exactly the routing header pair, both after a real handshake:
//   plain: GET with accept: text/event-stream            -> what the stream does with no routing hints
//   routed: the same GET plus Mcp-Method: prompts/list   -> if a result shape appears for THAT method,
//                                                          a header chose behaviour with no body to check
//
// Nothing is CI-wired: this measures other people's servers. No server text is re-emitted - only
// status, byte counts, JSON-RPC key names, and a digest prefix, because an SSE stream from a stranger
// is exactly the untrusted prose that the instructions-field survey refused to copy.
const LIMIT = Number(process.argv[2] || 40);
const TIMEOUT = 8000;
const REVISION = "2025-06-18";
const UA = "unified-ai-system-survey/1.0 (+https://github.com/happy520ai/unified-ai-system)";
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
async function post(base, body, opts = {}) {
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

// Read at most the first chunk of the stream, then abort: a GET SSE connection is held open by design,
// and an unbounded read here would be a self-inflicted hang against somebody else's server.
async function getStream(base, opts) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const headers = { accept: "text/event-stream", "user-agent": UA };
    if (opts.revision) headers["mcp-protocol-version"] = opts.revision;
    if (opts.sessionId) headers["mcp-session-id"] = opts.sessionId;
    if (opts.routeMethod) headers["mcp-method"] = opts.routeMethod;
    const res = await fetch(base, { method: "GET", headers, signal: ctl.signal });
    let text = "";
    let truncated = false;
    if (res.body && res.body.getReader) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let rounds = 0;
      while (rounds < 4) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        rounds += 1;
        if (text.length > 4096) {
          truncated = true;
          break;
        }
      }
      try {
        await reader.cancel();
      } catch {
        /* the stream is theirs to close */
      }
    } else {
      text = await res.text();
    }
    // Only structural facts leave this function. No server prose is copied out.
    const dataLines = text.split("\n").filter((l) => l.startsWith("data:"));
    let parsed = null;
    for (const line of dataLines) {
      try {
        parsed = JSON.parse(line.slice(5).trim());
        break;
      } catch {
        parsed = null;
      }
    }
    return {
      status: res.status,
      contentType: res.headers.get("content-type") || "",
      chars: text.length,
      truncated,
      dataEvents: dataLines.length,
      resultKeys: parsed?.result ? Object.keys(parsed.result) : [],
      hasMethod: parsed?.method ?? null,
      errorCode: parsed?.error?.code ?? null,
      errorMentionsSpoof: parsed?.error ? JSON.stringify(parsed.error).includes(SPOOF_METHOD) : false,
    };
  } catch (err) {
    return { status: 0, contentType: "", chars: 0, truncated: false, dataEvents: 0, resultKeys: [], errorMentionsSpoof: false, aborted: String(err && err.name ? err.name : err) };
  } finally {
    clearTimeout(timer);
  }
}

const rows = [];
for (const target of targets.slice(0, LIMIT)) {
  const record = { name: target.name, url: target.url, verdict: "unknown" };
  try {
    const init = await post(target.url, {
      jsonrpc: "2.0",
      id: String((id += 1)),
      method: "initialize",
      params: { protocolVersion: REVISION, capabilities: {}, clientInfo: { name: "uai-get-stream-probe", version: "0.1.0" } },
    }, { revision: REVISION });
    if (init.status === 401 || init.status === 403) record.verdict = "auth_required";
    else if (!init.payload?.result) record.verdict = `init_failed_${init.status}`;
    else {
      const revision = typeof init.payload.result.protocolVersion === "string" ? init.payload.result.protocolVersion : REVISION;
      const session = init.sessionId;
      const opts = { revision, sessionId: session ?? undefined };
      await post(target.url, { jsonrpc: "2.0", method: "notifications/initialized" }, opts);

      const plain = await getStream(target.url, opts);
      const routed = await getStream(target.url, { ...opts, routeMethod: SPOOF_METHOD });
      const plainAgain = await getStream(target.url, opts);
      record.plain = plain;
      record.routed = routed;
      record.plain_again = plainAgain;

      // Positive control: if neither GET produced any HTTP answer at all, the probe never reached a
      // server that could route, so "the header did nothing" would be a blind reading.
      const unreadable = [plain, routed, plainAgain].filter((l) => l.status === 0).length;
      const identicalPlainLegs = plain.status === plainAgain.status && plain.chars === plainAgain.chars;
      record.legs_unreadable = unreadable;
      record.plain_leg_repeat_matched = identicalPlainLegs;
      if (routed.resultKeys.includes("prompts") || routed.errorMentionsSpoof) {
        record.verdict = "HEADER_ROUTES_ON_GET";
      } else if (unreadable > 0) {
        // An aborted leg yields status 0, and 0-vs-409 is not a header effect - it is one leg we
        // could not read. The first version of this script called that a difference; it is not.
        record.verdict = "GET_LEG_UNREADABLE";
      } else if (routed.dataEvents > 0 || /text\/event-stream/.test(routed.contentType)) {
        record.verdict = routed.status === plain.status && routed.chars === plain.chars
          ? "stream_opened_inert_to_header"
          : "stream_changed_shape_no_routed_result";
      } else if (routed.status >= 400) {
        record.verdict = routed.status === plain.status ? "get_rejected_alike" : "get_rejected_differs_needs_repeat";
      } else if (routed.status === plain.status && routed.chars === plain.chars && /application\/json/.test(routed.contentType)) {
        record.verdict = "get_answered_json_not_stream";
      } else {
        record.verdict = "get_other";
      }
      record.header_changed_anything = routed.status !== plain.status || routed.chars !== plain.chars;
    }
  } catch (err) {
    record.verdict = `error:${String(err.message).slice(0, 30)}`;
  }
  rows.push(record);
  await new Promise((r) => setTimeout(r, 300));
}

const tally = {};
for (const r of rows) tally[r.verdict] = (tally[r.verdict] || 0) + 1;
const usable = rows.filter((r) => !["auth_required", "GET_BLIND"].includes(r.verdict) && !/^init_failed/.test(r.verdict) && !/^error/.test(r.verdict)).length;
console.log(JSON.stringify({ attempted: rows.length, asked_with: REVISION, get_legs_answered: usable, tally, rows }, null, 1));
