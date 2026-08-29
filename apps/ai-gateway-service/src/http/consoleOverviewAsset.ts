/**
 * Self-contained read-only operator console served at `GET /console`.
 *
 * The asset is intentionally a single inline HTML document with no build
 * step, no external requests, and no client framework. Every tab only calls
 * existing authenticated read APIs, so the console cannot mutate gateway
 * state. Operators supply a gateway token once; it is kept in
 * sessionStorage and sent as a bearer token.
 */

export const GATEWAY_CONSOLE_HTML: string = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Unified AI Gateway Console</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #0f1216;
    --panel: #171c22;
    --line: #262e37;
    --text: #dbe4ee;
    --muted: #8b98a8;
    --accent: #4da3ff;
    --ok: #3fb972;
    --warn: #e0a93e;
    --err: #e0604e;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font: 14px/1.5 ui-monospace, "Cascadia Code", Consolas, Menlo, monospace;
  }
  header {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    padding: 12px 18px;
    border-bottom: 1px solid var(--line);
    background: var(--panel);
    position: sticky;
    top: 0;
    z-index: 2;
  }
  header h1 { font-size: 15px; margin: 0; font-weight: 600; letter-spacing: .4px; }
  header h1 span { color: var(--accent); }
  #token {
    background: #0c0f13; border: 1px solid var(--line); color: var(--text);
    padding: 6px 10px; border-radius: 6px; width: 260px;
  }
  button {
    background: #1d2733; color: var(--text); border: 1px solid var(--line);
    padding: 6px 12px; border-radius: 6px; cursor: pointer;
  }
  button:hover { border-color: var(--accent); }
  nav { display: flex; gap: 6px; padding: 10px 18px 0; }
  nav button { border-radius: 6px 6px 0 0; }
  nav button[aria-selected="true"] { border-bottom: 2px solid var(--accent); color: var(--accent); }
  main { padding: 14px 18px 40px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 16px; }
  .card {
    background: var(--panel); border: 1px solid var(--line); border-radius: 8px;
    padding: 10px 12px;
  }
  .card .k { color: var(--muted); font-size: 12px; }
  .card .v { font-size: 18px; margin-top: 2px; word-break: break-all; }
  .v.ok { color: var(--ok); } .v.warn { color: var(--warn); } .v.err { color: var(--err); }
  section.panel {
    background: var(--panel); border: 1px solid var(--line); border-radius: 8px;
    padding: 12px 14px; overflow: auto;
  }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { color: var(--muted); font-weight: 500; white-space: nowrap; }
  pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
  .note { color: var(--muted); }
  .error-box { border: 1px solid var(--err); border-radius: 8px; padding: 10px 12px; color: var(--err); }
  .hint { color: var(--muted); font-size: 12px; margin-top: 8px; }
  #status { margin-left: auto; color: var(--muted); font-size: 12px; }
</style>
</head>
<body>
<header>
  <h1><span>&#9670;</span> Unified AI Gateway Console</h1>
  <input id="token" type="password" placeholder="Gateway token (uai- / PME token)" autocomplete="off" />
  <button id="save">Save token</button>
  <button id="refresh">Refresh</button>
  <label class="note"><input type="checkbox" id="auto" /> auto 10s</label>
  <span id="status"></span>
</header>
<nav>
  <button data-tab="overview" aria-selected="true">Overview</button>
  <button data-tab="keys">Virtual Keys</button>
  <button data-tab="clients">Local Clients</button>
  <button data-tab="cache">Cache Audit</button>
</nav>
<main>
  <section class="panel" id="content"><span class="note">Loading…</span></section>
  <p class="hint">Read-only console. Mutations stay in the CLI and governed APIs. Token is kept in this browser session only.</p>
</main>
<script>
"use strict";
(function () {
  var TOKEN_KEY = "uai_console_token";
  var state = { tab: "overview", timer: null };

  function el(id) { return document.getElementById(id); }
  function content() { return el("content"); }

  function status(text, isError) {
    var node = el("status");
    node.textContent = text;
    node.style.color = isError ? "var(--err)" : "var(--muted)";
  }

  function authHeaders() {
    var token = sessionStorage.getItem(TOKEN_KEY) || "";
    return token ? { "Authorization": "Bearer " + token } : {};
  }

  function setStatusColor(value) {
    if (value === "ok" || value === "ready" || value === "healthy" || value === true || value === "closed") return "ok";
    if (value === "degraded" || value === "half-open") return "warn";
    if (value === "error" || value === "failed" || value === "open" || value === false) return "err";
    return "";
  }

  function card(key, value, colorClass) {
    var cls = colorClass || setStatusColor(value);
    return '<div class="card"><div class="k"></div><div class="v ' + cls + '"></div></div>'
      .replace("<div class=\"k\"></div>", '<div class="k">' + key + "</div>")
      .replace("<div class=\"v " + cls + '"></div>', '<div class="v ' + cls + '">' + safeText(value) + "</div>");
  }

  function safeText(value) {
    if (value === null || value === undefined) return "—";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  function renderValue(value) {
    if (Array.isArray(value)) return renderList(value);
    if (value && typeof value === "object") return "<pre>" + escapeHtml(JSON.stringify(value, null, 2)) + "</pre>";
    return "<pre>" + escapeHtml(safeText(value)) + "</pre>";
  }

  function renderList(list) {
    if (list.length === 0) return '<span class="note">(empty list)</span>';
    var keys = [];
    list.forEach(function (item) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        Object.keys(item).forEach(function (key) { if (keys.indexOf(key) < 0) keys.push(key); });
      }
    });
    if (keys.length === 0) return "<pre>" + escapeHtml(JSON.stringify(list, null, 2)) + "</pre>";
    var rows = list.map(function (item) {
      var cells = keys.map(function (key) {
        var cell = item && typeof item === "object" ? item[key] : undefined;
        var text = cell === null || cell === undefined ? "—" : (typeof cell === "object" ? JSON.stringify(cell) : String(cell));
        return "<td>" + escapeHtml(text) + "</td>";
      });
      return "<tr>" + cells.join("") + "</tr>";
    });
    var head = keys.map(function (key) { return "<th>" + escapeHtml(key) + "</th>"; }).join("");
    return '<table><thead><tr>' + head + "</tr></thead><tbody>" + rows.join("") + "</tbody></table>";
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function envelopeData(body) {
    if (body && body.status === "ok" && body.data !== undefined) return body.data;
    return body;
  }

  function errorBox(message, hint) {
    return '<div class="error-box">' + escapeHtml(message) + "</div>" +
      (hint ? '<p class="hint">' + escapeHtml(hint) + "</p>" : "");
  }

  function fetchJson(path) {
    return fetch(path, { headers: authHeaders() }).then(function (response) {
      return response.text().then(function (text) {
        var body = null;
        try { body = text ? JSON.parse(text) : null; } catch (parseError) { body = null; }
        if (!response.ok) {
          var code = body && body.error && body.error.code ? body.error.code : "HTTP " + response.status;
          var hint = response.status === 401
            ? "Supply a valid gateway token in the header bar."
            : "This tab may require a higher role (for example user:admin or audit:read).";
          var error = new Error(code + " — " + (body && body.error && body.error.message ? body.error.message : response.statusText));
          error.hint = hint;
          throw error;
        }
        return envelopeData(body);
      });
    });
  }

  function renderOverview() {
    return fetchJson("/api/overview").then(function (data) {
      var cards = [
        card("Provider mode", data.providerMode),
        card("Real provider", data.realProviderEnabled === true ? "enabled" : "disabled",
          data.realProviderEnabled === true ? "warn" : "ok"),
        card("Health", data.health && data.health.status !== undefined ? data.health.status : "—"),
        card("Readiness", data.readiness && data.readiness.status !== undefined ? data.readiness.status : "—"),
        card("Requests (window)", data.totalRequests),
        card("In-flight", data.currentInFlight),
        card("Error circuit", data.gatewayErrorCircuitState)
      ].join("");
      var failures = data.readiness && Array.isArray(data.readiness.failures) && data.readiness.failures.length > 0
        ? '<section class="panel" style="margin-top:12px"><div class="k note">Readiness failures</div><pre>' +
          escapeHtml(data.readiness.failures.join("\\n")) + "</pre></section>"
        : "";
      content().innerHTML = '<div class="cards">' + cards + "</div>" + failures +
        '<section class="panel"><div class="k note">Raw snapshot</div>' +
        "<pre>" + escapeHtml(JSON.stringify(data, null, 2)) + "</pre></section>";
    });
  }

  function renderKeys() {
    return fetchJson("/enterprise/virtual-keys").then(function (data) {
      var list = Array.isArray(data) ? data : (data && Array.isArray(data.keys) ? data.keys : data);
      content().innerHTML = renderValue(list);
    });
  }

  function renderClients() {
    return fetchJson("/local-clients/status").then(function (statusData) {
      return fetchJson("/local-clients/registry").then(function (registryData) {
        var registryList = registryData && Array.isArray(registryData.clients)
          ? registryData.clients
          : (Array.isArray(registryData) ? registryData : registryData);
        content().innerHTML =
          '<div class="k note">Status</div>' +
          "<pre>" + escapeHtml(JSON.stringify(statusData, null, 2)) + "</pre>" +
          '<div class="k note" style="margin-top:12px">Registry</div>' +
          renderValue(registryList);
      }).catch(function (registryError) {
        content().innerHTML =
          '<div class="k note">Status</div>' +
          "<pre>" + escapeHtml(JSON.stringify(statusData, null, 2)) + "</pre>" +
          errorBox(registryError.message, registryError.hint);
      });
    });
  }

  function renderCache() {
    return fetchJson("/cache/audit").then(function (data) {
      var list = data && Array.isArray(data.entries) ? data.entries : data;
      content().innerHTML = renderValue(list);
    });
  }

  var renderers = {
    overview: renderOverview,
    keys: renderKeys,
    clients: renderClients,
    cache: renderCache
  };

  function render() {
    var renderer = renderers[state.tab] || renderOverview;
    status("refreshing…");
    renderer().then(function () {
      status("updated " + new Date().toLocaleTimeString());
    }, function (error) {
      content().innerHTML = errorBox(error.message, error.hint);
      status("error", true);
    });
  }

  function setTab(tab) {
    state.tab = tab;
    Array.prototype.forEach.call(document.querySelectorAll("nav button"), function (button) {
      button.setAttribute("aria-selected", button.getAttribute("data-tab") === tab ? "true" : "false");
    });
    render();
  }

  function setAutoRefresh(enabled) {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    if (enabled) state.timer = setInterval(render, 10000);
  }

  el("save").addEventListener("click", function () {
    var value = el("token").value.trim();
    if (value) sessionStorage.setItem(TOKEN_KEY, value);
    else sessionStorage.removeItem(TOKEN_KEY);
    status(value ? "token saved for this browser session" : "token cleared");
    render();
  });
  el("refresh").addEventListener("click", render);
  el("auto").addEventListener("change", function (event) { setAutoRefresh(event.target.checked); });
  Array.prototype.forEach.call(document.querySelectorAll("nav button"), function (button) {
    button.addEventListener("click", function () { setTab(button.getAttribute("data-tab")); });
  });

  setTab("overview");
})();
</script>
</body>
</html>
`;
