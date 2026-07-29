import { describe, it, expect } from "vitest";
import { createConnectorRoutes } from "./connectorRoutes.js";

describe("connector-routes", () => {
  it("reports health with feishu and wecom", () => {
    const routes = createConnectorRoutes({});
    const health = routes.getHealth();
    expect(health.status).toBe("ready");
    expect(health.connectors.feishu).toBeDefined();
    expect(health.connectors.wecom).toBeDefined();
    expect(health.connectors.feishu.dryRun).toBe(true);
    expect(health.connectors.wecom.dryRun).toBe(true);
  });

  it("sends feishu message in dry-run mode", async () => {
    const routes = createConnectorRoutes({});
    const result = await routes.sendFeishu({
      title: "Test",
      body: "Hello Feishu",
      targetId: "ou_xxx",
    });
    expect(result.dryRun).toBe(true);
    expect(result.delivered).toBe(false);
  });

  it("sends wecom message in dry-run mode", async () => {
    const routes = createConnectorRoutes({});
    const result = await routes.sendWeCom({
      title: "Test",
      body: "Hello WeCom",
      targetId: "user123",
    });
    expect(result.dryRun).toBe(true);
    expect(result.delivered).toBe(false);
  });

  it("uses real connector when webhook configured", async () => {
    const routes = createConnectorRoutes({ FEISHU_WEBHOOK_URL: "https://fake.feishu.cn/hook/test" });
    const health = routes.getHealth();
    expect(health.connectors.feishu.webhookConfigured).toBe(true);
    expect(health.connectors.feishu.dryRun).toBe(false);
  });
});
