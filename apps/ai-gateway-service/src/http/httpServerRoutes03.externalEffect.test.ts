import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  safeOutboundFetch: vi.fn(),
}));

vi.mock("../security/safeOutboundFetch.ts", () => ({
  safeOutboundFetch: mocks.safeOutboundFetch,
}));

import { createExternalEffectGate, type ExternalEffectGate } from "../external-effects/externalEffectGate.ts";
import { dispatchHttpRoutes03 } from "./httpServerRoutes03.js";

const temporaryDirectories: string[] = [];
const openGates: ExternalEffectGate[] = [];
const SHARED_SECRET = "active-route-external-effect-test".padEnd(64, "x");

afterEach(async () => {
  mocks.safeOutboundFetch.mockReset();
  await Promise.allSettled(openGates.splice(0).map((gate) => gate.close()));
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createGate() {
  const root = mkdtempSync(join(tmpdir(), "active-webhook-route-"));
  temporaryDirectories.push(root);
  const gate = createExternalEffectGate({
    enabled: true,
    env: {
      AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "sqlite",
      AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH: join(root, "effects.sqlite"),
      AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: SHARED_SECRET,
      AI_GATEWAY_EXTERNAL_EFFECT_TTL_MS: "60000",
    },
  });
  openGates.push(gate);
  return gate;
}

async function dispatch({
  gate,
  path,
  body,
  headers = {},
}: {
  gate: ExternalEffectGate;
  path: string;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}) {
  const response: Record<string, any> = {};
  const request = {
    method: "POST",
    headers,
    enterpriseIdentity: { tenantId: "tenant-a" },
  };
  await dispatchHttpRoutes03({
    application: {
      externalEffectGate: gate,
      runtimeEnv: {
        FEISHU_WEBHOOK_URL: "https://open.feishu.cn/open-apis/bot/v2/hook/test-target",
        WECOM_WEBHOOK_URL: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test-target",
      },
    },
    request,
    response,
    url: new URL(`http://gateway.local${path}`),
    startedAt: Date.now(),
    connectorFeishuDryRun: false,
    connectorWeComDryRun: false,
    readCapabilityJson: async () => body,
    createOkEnvelope: (data: unknown) => ({ ok: true, data }),
    writeJson: (target: Record<string, any>, statusCode: number, payload: unknown) => {
      target.statusCode = statusCode;
      target.payload = payload;
    },
    writeCapabilityError: ({ response: target, error, fallbackCode }: Record<string, any>) => {
      target.statusCode = error?.statusCode ?? 500;
      target.payload = {
        ok: false,
        error: { code: error?.code ?? fallbackCode, message: error?.message ?? "failed" },
      };
    },
  } as any);
  return response;
}

describe("active connector routes use durable external-effect reservations", () => {
  it("does not send Feishu without a key and consumes one keyed payload only once", async () => {
    const gate = createGate();
    mocks.safeOutboundFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 0, message_id: "feishu-message-1" }),
    });

    const missing = await dispatch({
      gate,
      path: "/connectors/feishu/send",
      body: { title: "Audit", body: "first" },
    });
    expect(missing).toMatchObject({
      statusCode: 400,
      payload: { error: { code: "EXTERNAL_EFFECT_KEY_REQUIRED" } },
    });
    expect(mocks.safeOutboundFetch).not.toHaveBeenCalled();

    const first = await dispatch({
      gate,
      path: "/connectors/feishu/send",
      body: { title: "Audit", body: "first" },
      headers: { "idempotency-key": "feishu-operation-1" },
    });
    expect(first).toMatchObject({
      statusCode: 200,
      payload: { data: { delivered: true, externalMessageId: "feishu-message-1" } },
    });
    expect(mocks.safeOutboundFetch).toHaveBeenCalledOnce();

    const replay = await dispatch({
      gate,
      path: "/connectors/feishu/send",
      body: { title: "Audit", body: "first" },
      headers: { "idempotency-key": "feishu-operation-1" },
    });
    expect(replay).toMatchObject({
      statusCode: 409,
      payload: { error: { code: "EXTERNAL_EFFECT_ALREADY_RESERVED" } },
    });

    const conflict = await dispatch({
      gate,
      path: "/connectors/feishu/send",
      body: { title: "Audit", body: "changed" },
      headers: { "idempotency-key": "feishu-operation-1" },
    });
    expect(conflict).toMatchObject({
      statusCode: 409,
      payload: { error: { code: "EXTERNAL_EFFECT_KEY_REUSED" } },
    });
    expect(mocks.safeOutboundFetch).toHaveBeenCalledOnce();
  });

  it("accepts the dedicated key header on the active WeCom route", async () => {
    const gate = createGate();
    mocks.safeOutboundFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ errcode: 0, msgid: "wecom-message-1" }),
    });

    const first = await dispatch({
      gate,
      path: "/connectors/wecom/send",
      body: { title: "Audit", text: "once" },
      headers: { "external-effect-key": "wecom-operation-1" },
    });
    expect(first).toMatchObject({
      statusCode: 200,
      payload: { data: { delivered: true, externalMessageId: "wecom-message-1" } },
    });
    expect(mocks.safeOutboundFetch).toHaveBeenCalledOnce();

    const replay = await dispatch({
      gate,
      path: "/connectors/wecom/send",
      body: { title: "Audit", text: "once" },
      headers: { "external-effect-key": "wecom-operation-1" },
    });
    expect(replay.statusCode).toBe(409);
    expect(mocks.safeOutboundFetch).toHaveBeenCalledOnce();
  });
});
