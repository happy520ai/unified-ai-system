import { describe, expect, it, vi } from "vitest";

import { dispatchHttpRoutes03 } from "./httpServerRoutes03.js";

// #178 says the gateway reports the revision each upstream negotiated. That is a claim about the
// HTTP body an operator reads, not only about the service object, and nothing else in this
// repository dispatched GET /mcp/tools before this test.
async function dispatchListTools(servers: unknown[]) {
  const response: Record<string, any> = {};
  const listTools = vi.fn(async () => ({ tools: [{ name: "get_forecast" }], servers }));
  await dispatchHttpRoutes03({
    application: { mcpGatewayService: { listTools } },
    request: {
      method: "GET",
      headers: { "x-request-id": "request-mcp-tools-1" },
      enterpriseIdentity: { tenantId: "tenant-a", userId: "owner-a", role: "operator" },
    },
    response,
    url: new URL("http://gateway.local/mcp/tools"),
    startedAt: Date.now(),
    createOkEnvelope: (data: unknown) => ({ status: "success", data }),
    writeJson: (target: Record<string, any>, statusCode: number, payload: unknown) => {
      target.statusCode = statusCode;
      target.payload = payload;
    },
    writeCapabilityError: ({ response: target, error, fallbackCode }: Record<string, any>) => {
      target.statusCode = error?.statusCode ?? 500;
      target.payload = { status: "error", error: { code: error?.code ?? fallbackCode } };
    },
  } as any);
  return { response, listTools };
}

describe("GET /mcp/tools upstream reporting (#178)", () => {
  it("carries the negotiated revision through to the response body", async () => {
    const { response, listTools } = await dispatchListTools([
      { id: "weather", observed: 2, exposed: 1, protocolVersion: "2024-11-05" },
    ]);
    expect(response.statusCode).toBe(200);
    expect(response.payload.data.servers).toEqual([
      { id: "weather", observed: 2, exposed: 1, protocolVersion: "2024-11-05" },
    ]);
    // The listing is identity-scoped: an unfiltered pass-through would still pass the assertion
    // above while leaking one tenant's servers to another.
    expect(listTools).toHaveBeenCalledWith({ tenantId: "tenant-a", userId: "owner-a", role: "operator" });
  });

  it("does not add a revision for an upstream that never negotiated one", async () => {
    const { response } = await dispatchListTools([{ id: "bridge", observed: 0, exposed: 0 }]);
    expect(JSON.stringify(response.payload.data.servers)).not.toContain("protocolVersion");
  });
});
