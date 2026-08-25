import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { dispatchHttpRoutes03 } from "./httpServerRoutes03.js";

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function dispatch(headers: Record<string, string>) {
  const response: Record<string, any> = {};
  const callTool = vi.fn(async (_identity, request) => {
    if (request.externalEffect?.effectKeyInvalid === true) {
      throw Object.assign(new Error("Invalid external-effect key."), {
        code: "EXTERNAL_EFFECT_KEY_INVALID",
        statusCode: 400,
        category: "validation",
      });
    }
    return {
      serverId: request.server,
      toolName: request.tool,
      result: { content: [] },
      externalEffect: { required: true, reservationFingerprint: "0123456789abcdef" },
    };
  });
  await dispatchHttpRoutes03({
    application: { mcpGatewayService: { callTool } },
    request: {
      method: "POST",
      headers,
      enterpriseIdentity: { tenantId: "tenant-a", role: "operator" },
    },
    response,
    url: new URL("http://gateway.local/mcp/call"),
    startedAt: Date.now(),
    readCapabilityJson: async () => ({
      server: "ops",
      tool: "create_ticket",
      arguments: { title: "bounded" },
    }),
    createOkEnvelope: (data: unknown) => ({ status: "success", data }),
    writeJson: (target: Record<string, any>, statusCode: number, payload: unknown) => {
      target.statusCode = statusCode;
      target.payload = payload;
    },
    writeCapabilityError: ({ response: target, error, fallbackCode }: Record<string, any>) => {
      target.statusCode = error?.statusCode ?? 422;
      target.payload = {
        status: "error",
        error: { code: error?.code ?? fallbackCode },
      };
    },
  } as any);
  return { response, callTool };
}

describe("active MCP route external-effect identity", () => {
  it("hashes a caller key before passing a mutation context to the gateway service", async () => {
    const rawKey = "mcp-operation-1";
    const { response, callTool } = await dispatch({ "external-effect-key": rawKey });

    expect(response.statusCode).toBe(200);
    expect(callTool).toHaveBeenCalledWith(
      { tenantId: "tenant-a", role: "operator" },
      expect.objectContaining({
        server: "ops",
        tool: "create_ticket",
        externalEffect: { effectKeyHash: digest(rawKey) },
      }),
    );
    expect(JSON.stringify(callTool.mock.calls)).not.toContain(rawKey);
  });

  it("rejects ambiguous key headers before an upstream mutation", async () => {
    const { response } = await dispatch({
      "idempotency-key": "one",
      "external-effect-key": "two",
    });
    expect(response).toMatchObject({
      statusCode: 400,
      payload: { error: { code: "EXTERNAL_EFFECT_KEY_INVALID" } },
    });
  });
});
