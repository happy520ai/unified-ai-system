import { describe, expect, it } from "vitest";
import { createGatewayApplication } from "./createGatewayApplication.js";

describe("createGatewayApplication — model access governance", () => {
  it("leaves model access enforcement off by default", () => {
    const app = createGatewayApplication({});
    expect(app.gatewayService.runtimeConfig.modelAccessEnforce).toBe(false);
  });

  it("loads RBAC roles and enables enforcement when configured", () => {
    const app = createGatewayApplication({
      AI_GATEWAY_MODEL_ACCESS_ENFORCE: "true",
      AI_GATEWAY_RBAC_ROLES: JSON.stringify({ alice: ["api_user"] }),
    });

    expect(app.gatewayService.runtimeConfig.modelAccessEnforce).toBe(true);
    // alice (api_user → model:use) can access any model
    expect(app.gatewayService.governance.checkModelAccess("alice", "any-model")).toBe(true);
    // bob has no role → denied
    expect(app.gatewayService.governance.checkModelAccess("bob", "any-model")).toBe(false);
  });

  it("tolerates malformed RBAC config without crashing", () => {
    const app = createGatewayApplication({
      AI_GATEWAY_MODEL_ACCESS_ENFORCE: "true",
      AI_GATEWAY_RBAC_ROLES: "{not-json",
    });

    expect(app.gatewayService.runtimeConfig.modelAccessEnforce).toBe(true);
    expect(app.gatewayService.governance.checkModelAccess("alice", "m")).toBe(false);
  });
});
