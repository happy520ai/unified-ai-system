// Measure how OUR OWN MCP HTTP server treats the MCP-Protocol-Version header.
//
// Why this exists: docs/mcp-protocol-version-header.md published a claim about our inbound posture
// ("advertises the header over CORS and never reads its value") that was read out of source code,
// not observed. #183 changed the outbound half with measurements behind it; the inbound half
// deserved the same standard. This boots the real server in-process on the credential-free local
// runtime and asks it the same three questions the public survey asked strangers.
//
// Positive control, which is the whole point: the baseline leg (header = the revision this server
// answered with) must succeed. If it does not, nothing here says anything about header enforcement
// - it means the probe never reached the handler. Absence of a rejection and rejection are not the
// same reading, and a misconfigured probe looks exactly like the first one.
//
// Usage: node tools/probe-own-mcp-header-behavior.mjs
const HTTP_MODULE = new URL("../packages/mcp-server/src/http.js", import.meta.url).href;
const TIMEOUT = 15000;
const ASKED = "2025-06-18";
const DECLINED = "2025-03-26";

async function rpc(base, body, { revision, session, routeMethod } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    };
    if (revision) headers["mcp-protocol-version"] = revision;
    if (session) headers["mcp-session-id"] = session;
    if (routeMethod) headers["mcp-method"] = routeMethod;
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
      session: res.headers.get("mcp-session-id"),
      echoed: res.headers.get("mcp-protocol-version"),
      contentType: res.headers.get("content-type") || "",
      bodyHead: text.slice(0, 80),
    };
  } finally {
    clearTimeout(timer);
  }
}

function served(res) {
  return res.status < 400 && Boolean(res.payload?.result);
}

const { startMcpHttpServer } = await import(HTTP_MODULE);
const server = await startMcpHttpServer({ env: {}, host: "127.0.0.1", port: 0 });
// Field names read off packages/mcp-server/src/http.js:274 - it returns
// { config, endpoint, runtime, stop, killNow }. Fail loudly if that ever stops being true, rather
// than fetching http://127.0.0.1:undefined and reporting "the server rejects the header".
let base = String(server.endpoint ?? "");
let parsed;
try {
  parsed = new URL(base);
} catch {
  console.error(JSON.stringify({ verdict: "INSTRUMENT_BLIND", why: `server returned no usable endpoint`, endpoint: base, keys: Object.keys(server) }, null, 1));
  process.exitCode = 3;
  throw new Error(`probe cannot reach the server it started: endpoint=${JSON.stringify(base)}`);
}
const port = Number(parsed.port);
// The blind branch needs a fixture that actually makes it fire, otherwise "we would have noticed a
// misconfigured probe" is a claim with no evidence behind it. One character off the path is enough:
// the handler answers 404 MCP_HTTP_NOT_FOUND, no tool list comes back, and the run must refuse to
// say anything about header enforcement.
if (process.argv.includes("--tamper-blind")) {
  parsed.pathname = `${parsed.pathname}x`;
  base = parsed.toString();
}

let report;
try {
  const init = await rpc(base, {
    jsonrpc: "2.0",
    id: "1",
    method: "initialize",
    params: { protocolVersion: ASKED, capabilities: {}, clientInfo: { name: "uai-own-header-probe", version: "0.1.0" } },
  });
  const answered = typeof init.payload?.result?.protocolVersion === "string" ? init.payload.result.protocolVersion : null;
  const session = init.session;
  const opts = { revision: answered ?? ASKED, session: session ?? undefined };
  await rpc(base, { jsonrpc: "2.0", method: "notifications/initialized" }, opts);

  const baseline = await rpc(base, { jsonrpc: "2.0", id: "2", method: "tools/list", params: {} }, opts);
  const omitted = await rpc(base, { jsonrpc: "2.0", id: "3", method: "tools/list", params: {} }, { session: opts.session });
  const declined = await rpc(base, { jsonrpc: "2.0", id: "4", method: "tools/list", params: {} }, { revision: DECLINED, session: opts.session });
  // Does the header hurt on the request that is still proposing a revision? Some clients send it
  // there, and a server that reads it before negotiating would show up here.
  const initWithHeader = await rpc(base, {
    jsonrpc: "2.0",
    id: "5",
    method: "initialize",
    params: { protocolVersion: ASKED, capabilities: {}, clientInfo: { name: "uai-own-header-probe", version: "0.1.0" } },
  }, { revision: ASKED });

  // Does the header route us? Our server lists Mcp-Method/Mcp-Name in its CORS allow-list, so an
  // inbound request can carry them. If it answered `prompts/list` while the body said `tools/list`,
  // a caller could reach a method it never wrote down; if it answers the body, the header is inert.
  const spoofed = await rpc(base, { jsonrpc: "2.0", id: "6", method: "tools/list", params: {} }, {
    revision: opts.revision,
    session: opts.session,
    routeMethod: "prompts/list",
  });
  const nonsense = await rpc(base, { jsonrpc: "2.0", id: "7", method: "tools/list", params: {} }, {
    revision: opts.revision,
    session: opts.session,
    routeMethod: "totally-not-a-method",
  });

  // The case the routing headers actually exist for: a GET stream with no body to disagree with.
  // The POST survey cannot see this, so the caveat it published is closed here instead of restated.
  async function getProbe(headers) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    try {
      const res = await fetch(base, {
        method: "GET",
        headers: { accept: "text/event-stream", ...headers },
        signal: ctl.signal,
      });
      let text = "";
      try {
        text = await res.text();
      } catch {
        text = "";
      }
      return {
        status: res.status,
        contentType: res.headers.get("content-type") || "",
        chars: text.length,
        dataEvents: text.split("\n").filter((l) => l.startsWith("data:")).length,
        errorCodes: (text.match(/"code"\s*:\s*("([^"]+)"|-?\d+)/g) || []).slice(0, 3),
      };
    } catch (err) {
      return { status: 0, contentType: "", chars: 0, dataEvents: 0, aborted: String(err && err.name ? err.name : err) };
    } finally {
      clearTimeout(timer);
    }
  }
  const getPlain = await getProbe({});
  const getSpoofed = await getProbe({ "mcp-method": "prompts/list" });
  const getVerdict = getPlain.status === 0 && getSpoofed.status === 0
    ? "GET_BLIND"
    : getSpoofed.dataEvents > 0 && getSpoofed.dataEvents !== getPlain.dataEvents
      ? "header_changed_the_stream"
      : getPlain.status === getSpoofed.status && getPlain.chars === getSpoofed.chars
        ? "get_shape_identical_with_and_without_header"
        : "get_differs_but_not_routed";

  const keysOf = (r) => (r.payload?.result ? Object.keys(r.payload.result) : []);
  const blind = !served(baseline);
  const count = (r) => (r.payload?.result?.tools || []).length;
  report = {
    instrument: "tools/probe-own-mcp-header-behavior.mjs",
    server: { module: "packages/mcp-server/src/http.js", host: "127.0.0.1", port, path: "/mcp" },
    handshake: {
      asked: ASKED,
      answered,
      session_id_issued: Boolean(session),
      init_status: init.status,
      echoed_header_on_init: init.echoed,
      content_type: init.contentType,
    },
    verdict: blind ? "INSTRUMENT_BLIND" : "measured",
    // The control the claim has to pass: without this leg succeeding, "not rejected" is meaningless.
    baseline_ok: served(baseline),
    baseline_tools: count(baseline),
    legs: {
      header_answered: { status: baseline.status, served: served(baseline), tools: count(baseline) || null },
      header_omitted: { status: omitted.status, served: served(omitted), tools: count(omitted) || null },
      header_declined_revision: { status: declined.status, served: served(declined), tools: count(declined) || null },
      initialize_with_header: { status: initWithHeader.status, served: served(initWithHeader) },
    },
    // Header-vs-body routing, the question the public survey asks in the same shape.
    route_headers: {
      body_method: "tools/list",
      baseline_result_keys: keysOf(baseline),
      // Do WE tell a cache anything? Same question the public survey asks strangers.
      our_tool_field_names: Object.keys(baseline.payload?.result?.tools?.[0] ?? {}),
      our_result_ttlMs_present: keysOf(baseline).includes("ttlMs"),
      our_result_cacheScope_present: keysOf(baseline).includes("cacheScope"),
      spoof_prompts_list: {
        status: spoofed.status,
        result_keys: keysOf(spoofed),
        error_code: spoofed.payload?.error?.code ?? null,
      },
      spoof_nonsense_method: {
        status: nonsense.status,
        result_keys: keysOf(nonsense),
        error_code: nonsense.payload?.error?.code ?? null,
      },
      verdict: blind
        ? "not_evaluated_baseline_blind"
        : keysOf(spoofed).includes("prompts")
          ? "HEADER_ROUTES_IT"
          : keysOf(spoofed).includes("tools") && keysOf(nonsense).includes("tools")
            ? "body_is_authoritative_header_inert"
            : keysOf(spoofed).includes("tools")
              ? "body_wins_but_nonsense_changed_shape"
              : "inconclusive_shape_change",
    },
    get_stream: {
      plain: { status: getPlain.status, contentType: getPlain.contentType, chars: getPlain.chars, dataEvents: getPlain.dataEvents },
      with_route_header: { status: getSpoofed.status, contentType: getSpoofed.contentType, chars: getSpoofed.chars, dataEvents: getSpoofed.dataEvents },
      verdict: getVerdict,
    },
    reading: blind
      ? `baseline leg did not reach a tool list (http ${baseline.status}: ${baseline.bodyHead}) - this run says nothing about header handling`
      : `enforces: ${declined.status >= 400 || !declined.payload?.result ? "yes" : "no"} (a header naming ${DECLINED}, which this server never agreed to, still returned ${declined.status} with ${count(declined) || 0} tools); omitted header: ${omitted.status < 400 && Boolean(omitted.payload?.result) ? "accepted" : `rejected ${omitted.status}`}`,
    tamper_anchor: "point at a nonexistent port and expect this script to fail loudly, not report enforces: no",
  };
} finally {
  const stop = server.close ?? server.stop;
  if (stop) await stop.call(server);
}

console.log(JSON.stringify(report, null, 1));
if (report.verdict === "INSTRUMENT_BLIND") process.exitCode = 3;
