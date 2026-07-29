import { describe, it, expect, beforeAll } from "vitest";
import { createGatewayApplication } from "./createGatewayApplication.js";

describe("gateway-application", () => {
  let app;

  beforeAll(() => {
    app = createGatewayApplication();
  });

  it("creates application with all services", () => {
    expect(app.gatewayService).toBeDefined();
    expect(app.knowledgeService).toBeDefined();
    expect(app.workflowService).toBeDefined();
    expect(app.workforceService).toBeDefined();
    expect(app.enterpriseGovernanceService).toBeDefined();
    expect(app.modelImportService).toBeDefined();
    expect(app.modelLibraryStore).toBeDefined();
    expect(app.providerConfigRoutes).toBeDefined();
    expect(app.runtimeCredentialStore).toBeDefined();
    expect(app.userExperienceService).toBeDefined();
    expect(app.capabilityRouterService).toBeDefined();
  });

  it("has correct config", () => {
    expect(app.config.aiGatewayService.endpoint.host).toBe("127.0.0.1");
    expect(app.config.aiGatewayService.endpoint.port).toBe(3100);
  });

  it("has provider registry with providers", () => {
    const providers = app.gatewayService.getProviderDescriptors();
    expect(providers.length).toBeGreaterThan(0);
  });

  it("has knowledge service ready", () => {
    const health = app.knowledgeService.getHealth();
    expect(health.status).toBe("ready");
  });

  it("has workflow service ready", () => {
    const health = app.workflowService.getHealth();
    expect(health.status).toBe("ready");
  });

  it("has workforce service ready", () => {
    const health = app.workforceService.getHealth();
    expect(health.status).toBe("ready");
  });

  it("has enterprise governance ready", () => {
    const health = app.enterpriseGovernanceService.getHealth();
    expect(health.status).toBe("ready");
  });
});
