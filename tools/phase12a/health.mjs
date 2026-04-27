const PHASE = "phase-12a-service-health";
const serviceUrl = normalizeServiceUrl(
  process.env.AI_GATEWAY_SERVICE_URL ??
    `http://${process.env.AI_GATEWAY_SERVICE_HOST ?? "127.0.0.1"}:${process.env.AI_GATEWAY_SERVICE_PORT ?? "3100"}`,
);
const healthUrl = `${serviceUrl}/health/check`;
const timeoutMs = toNumber(process.env.PHASE12A_HEALTH_TIMEOUT_MS, 5_000);

try {
  const health = await fetchJson(healthUrl, { timeoutMs });
  const data = health.body?.data;
  const passed =
    health.httpStatus === 200 &&
    health.body?.status === "ok" &&
    data?.status === "ready" &&
    Array.isArray(data?.routes) &&
    data.routes.includes("POST /chat");

  const result = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    serviceUrl,
    healthUrl,
    healthHttpStatus: health.httpStatus,
    serviceStatus: data?.status ?? null,
    providerMode: data?.providerMode ?? null,
    realProviderEnabled: data?.realProviderEnabled ?? null,
    providerCount: Array.isArray(data?.providers) ? data.providers.length : 0,
    routes: {
      chat: Boolean(data?.routes?.includes("POST /chat")),
      ragChat: Boolean(data?.routes?.includes("POST /chat/rag")),
      knowledgeHealth: Boolean(data?.routes?.includes("GET /knowledge/health")),
    },
    providerSmoke: {
      checked: false,
      command: "cmd /c pnpm verify:phase7a-1",
      note: "health:phase12a only checks local service readiness. Run verify:phase7a-1 when you explicitly need a real provider smoke.",
    },
    conclusion: passed ? "service-health-ready" : "service-health-not-ready",
  };

  console.log(JSON.stringify(result, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  console.log(
    JSON.stringify(
      {
        phase: PHASE,
        status: "failed",
        serviceUrl,
        healthUrl,
        healthHttpStatus: null,
        serviceStatus: "unreachable",
        providerSmoke: {
          checked: false,
          command: "cmd /c pnpm verify:phase7a-1",
          note: "health:phase12a did not call any provider.",
        },
        error: error instanceof Error ? error.message : String(error),
        conclusion: "service-health-unreachable",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}

async function fetchJson(url, { timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      signal: controller.signal,
    });
    const text = await response.text();

    return {
      httpStatus: response.status,
      body: text ? JSON.parse(text) : {},
    };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeServiceUrl(value) {
  return String(value || "http://127.0.0.1:3100").replace(/\/+$/, "");
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
