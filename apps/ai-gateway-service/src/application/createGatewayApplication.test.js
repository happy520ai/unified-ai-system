import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createGatewayApplication } from "./createGatewayApplication.js";

describe("gateway-application", () => {
  let app;

  before(() => {
    app = createGatewayApplication();
  });

  after(() => {
    if (app?.forgeService?.shutdown) {
      app.forgeService.shutdown();
    }
  });

  it("creates application with all services", () => {
    assert.ok(app.gatewayService);
    assert.ok(app.knowledgeService);
    assert.ok(app.workflowService);
    assert.ok(app.workforceService);
    assert.ok(app.enterpriseGovernanceService);
    assert.ok(app.modelImportService);
    assert.ok(app.modelLibraryStore);
    assert.ok(app.providerConfigRoutes);
    assert.ok(app.runtimeCredentialStore);
    assert.ok(app.userExperienceService);
    assert.ok(app.capabilityRouterService);
  });

  it("has correct config", () => {
    assert.equal(app.config.aiGatewayService.endpoint.host, "127.0.0.1");
    assert.equal(app.config.aiGatewayService.endpoint.port, 3100);
  });

  it("has provider registry with providers", () => {
    const providers = app.gatewayService.getProviderDescriptors();
    assert.ok(providers.length > 0, `Expected providers > 0, got ${providers.length}`);
  });

  it("has knowledge service ready", () => {
    const health = app.knowledgeService.getHealth();
    assert.equal(health.status, "ready");
  });

  it("has workflow service ready", () => {
    const health = app.workflowService.getHealth();
    assert.equal(health.status, "ready");
  });

  it("has workforce service ready", () => {
    const health = app.workforceService.getHealth();
    assert.equal(health.status, "ready");
  });

  it("has enterprise governance ready", () => {
    const health = app.enterpriseGovernanceService.getHealth();
    assert.equal(health.status, "ready");
  });
});
