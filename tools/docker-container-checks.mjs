// Final container checks for the docker publish smoke.
//
// Verifies the running gateway container (built from the local image or
// pulled from the registry) with the production auth posture: a bootstrap
// admin token comes in via PME_AUTH_TOKEN, and every check request carries
// it as the Bearer credential.
//
// Exit 0 when all checks pass; prints a JSON diagnostics line either way.

const baseUrl = process.env.SMOKE_BASE_URL;
const token = process.env.PME_AUTH_TOKEN;

if (!baseUrl || !token) {
  console.error("SMOKE_BASE_URL and PME_AUTH_TOKEN are required.");
  process.exit(1);
}

const authHeaders = { authorization: `Bearer ${token}` };

async function readJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { ...(options.headers ?? {}), ...authHeaders },
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

const health = await readJson("/health/check");
const setup = await readJson("/setup/readiness");
const ui = await fetch(`${baseUrl}/ui`, { headers: authHeaders });
const consoleRoute = await fetch(`${baseUrl}/console`, { headers: authHeaders });
const chat = await readJson("/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ prompt: "Container smoke test" }),
});

const diagnostics = {
  ui: ui.status,
  consoleRoute: consoleRoute.status,
  chat: chat.status,
  chatBody: JSON.stringify(chat.body).slice(0, 200),
};

const checks = {
  health: health.status === 200 && health.body?.data?.status === "ready",
  setup: setup.status === 200 && setup.body?.data?.status === "ready",
  terminalFirstSurface: ui.status === 404 && consoleRoute.status === 404,
  fakeProviderDisabledRealCalls: health.body?.data?.realProviderEnabled === false,
  chat: chat.status === 200
    && chat.body?.success === true
    && chat.body?.data?.executionMode === "fake",
};

console.log(JSON.stringify(diagnostics));
console.log(JSON.stringify(checks));
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
