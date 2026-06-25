import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createConnectorRoutes } from "./connectorRoutes.js";

describe("connector-routes", () => {
  it("reports health with feishu and wecom", () => {
    const routes = createConnectorRoutes({});
    const health = routes.getHealth();
    assert.equal(health.status, "ready");
    assert.ok(health.connectors.feishu)!== undefined;
    assert.ok(health.connectors.wecom)!== undefined;
    assert.equal(health.connectors.feishu.dryRun, true);
    assert.equal(health.connectors.wecom.dryRun, true);
  });

  it("sends feishu message in dry-run mode", async () => {
    const routes = createConnectorRoutes({});
    const result = await routes.sendFeishu({
      title: "Test",
      body: "Hello Feishu",
      targetId: "ou_xxx",
    });
    assert.equal(result.dryRun, true);
    assert.equal(result.delivered, false);
  });

  it("sends wecom message in dry-run mode", async () => {
    const routes = createConnectorRoutes({});
    const result = await routes.sendWeCom({
      title: "Test",
      body: "Hello WeCom",
      targetId: "user123",
    });
    assert.equal(result.dryRun, true);
    assert.equal(result.delivered, false);
  });

  it("uses real connector when webhook configured", async () => {
    const routes = createConnectorRoutes({ FEISHU_WEBHOOK_URL: "https://fake.feishu.cn/hook/test" });
    const health = routes.getHealth();
    assert.equal(health.connectors.feishu.webhookConfigured, true);
    assert.equal(health.connectors.feishu.dryRun, false);
  });
});
