import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../security/safeOutboundFetch.ts", () => ({
  safeOutboundFetch: vi.fn(),
}));

import { safeOutboundFetch } from "../security/safeOutboundFetch.ts";
import { createExternalEffectGate, type ExternalEffectGate } from "../external-effects/externalEffectGate.ts";
import { createHttpServerCapabilityRoutes } from "./httpServerCapabilityRoutes.js";

const temporaryDirectories: string[] = [];
const openGates: ExternalEffectGate[] = [];
const SECRET = "webhook-effect-test-secret".padEnd(64, "x");

afterEach(async () => {
  vi.mocked(safeOutboundFetch).mockReset();
  await Promise.allSettled(openGates.splice(0).map((gate) => gate.close()));
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createApplication() {
  const root = mkdtempSync(join(tmpdir(), "webhook-external-effect-"));
  temporaryDirectories.push(root);
  const externalEffectGate = createExternalEffectGate({
    enabled: true,
    env: {
      AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "sqlite",
      AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH: join(root, "effects.sqlite"),
      AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: SECRET,
    },
  });
  openGates.push(externalEffectGate);
  return {
    externalEffectGate,
    runtimeEnv: {
      FEISHU_WEBHOOK_URL: "https://open.feishu.example/webhook/test",
      WECOM_WEBHOOK_URL: "https://qyapi.weixin.example/webhook/test",
    },
  };
}

function createRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return {
    body,
    headers,
    enterpriseIdentity: { tenantId: "tenant-a" },
  };
}

function createResponse() {
  return {
    statusCode: 0,
    payload: undefined as any,
    writableEnded: false,
    destroyed: false,
    headersSent: false,
    writeHead(statusCode: number) {
      this.statusCode = statusCode;
      this.headersSent = true;
    },
    end(raw: string) {
      this.payload = JSON.parse(raw);
      this.writableEnded = true;
    },
  };
}

function createRoutes(application: ReturnType<typeof createApplication>) {
  return createHttpServerCapabilityRoutes({
    application,
    approvalStore: {},
    capabilityRouterService: {},
    connectorFeishuDryRun: false,
    connectorWeComDryRun: false,
    fileContextStore: {},
    modelLibraryStore: {},
    phase319LocalOperation: {},
    providerConfigRoutes: {},
  }).handlers;
}

describe("connector external-effect boundary", () => {
  it("blocks missing, duplicate, and conflicting keys before a Feishu webhook", async () => {
    const application = createApplication();
    const handler = createRoutes(application).get("POST /connectors/feishu/send");
    expect(handler).toBeTypeOf("function");
    vi.mocked(safeOutboundFetch).mockImplementation(async () => new Response(
      JSON.stringify({ code: 0, message_id: "message-1" }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));

    const missing = createResponse();
    await handler(createRequest({ body: "hello" }), missing, { startedAt: Date.now() });
    expect(missing.statusCode).toBe(400);
    expect(missing.payload.error.code).toBe("EXTERNAL_EFFECT_KEY_REQUIRED");
    expect(safeOutboundFetch).not.toHaveBeenCalled();

    const first = createResponse();
    await handler(
      createRequest({ body: "hello" }, { "idempotency-key": "feishu-operation-1" }),
      first,
      { startedAt: Date.now() },
    );
    expect(first.statusCode).toBe(200);
    expect(first.payload.data).toMatchObject({ delivered: true, externalMessageId: "message-1" });
    expect(safeOutboundFetch).toHaveBeenCalledOnce();

    const duplicate = createResponse();
    await handler(
      createRequest({ body: "hello" }, { "idempotency-key": "feishu-operation-1" }),
      duplicate,
      { startedAt: Date.now() },
    );
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.payload.error.code).toBe("EXTERNAL_EFFECT_ALREADY_RESERVED");
    expect(safeOutboundFetch).toHaveBeenCalledOnce();

    const conflict = createResponse();
    await handler(
      createRequest({ body: "different" }, { "idempotency-key": "feishu-operation-1" }),
      conflict,
      { startedAt: Date.now() },
    );
    expect(conflict.statusCode).toBe(409);
    expect(conflict.payload.error.code).toBe("EXTERNAL_EFFECT_KEY_REUSED");
    expect(safeOutboundFetch).toHaveBeenCalledOnce();
  });

  it("accepts External-Effect-Key for a WeCom webhook without retaining the raw key", async () => {
    const application = createApplication();
    const handler = createRoutes(application).get("POST /connectors/wecom/send");
    vi.mocked(safeOutboundFetch).mockImplementation(async () => new Response(
      JSON.stringify({ errcode: 0, msgid: "message-2" }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));

    const response = createResponse();
    await handler(
      createRequest({ body: "hello" }, { "external-effect-key": "wecom-operation-1" }),
      response,
      { startedAt: Date.now() },
    );
    expect(response.statusCode).toBe(200);
    expect(response.payload.data).toMatchObject({ delivered: true, externalMessageId: "message-2" });
    expect(JSON.stringify(application.externalEffectGate.getHealth())).not.toContain("wecom-operation-1");
  });
});
