/**
 * IM Connector Routes
 * Provides HTTP endpoints for Feishu and WeCom message sending.
 */

import { createFeishuConnector } from "@unified-ai-system/im-connector-feishu";
import { createWeComConnector } from "@unified-ai-system/im-connector-wecom";

export function createConnectorRoutes(env = process.env) {
  const feishu = createFeishuConnector({
    webhookUrl: env.FEISHU_WEBHOOK_URL || "",
    appId: env.FEISHU_APP_ID || "",
    appSecret: env.FEISHU_APP_SECRET || "",
    dryRun: !env.FEISHU_WEBHOOK_URL,
  });

  const wecom = createWeComConnector({
    webhookUrl: env.WECOM_WEBHOOK_URL || "",
    dryRun: !env.WECOM_WEBHOOK_URL,
  });

  return {
    getHealth() {
      return {
        status: "ready",
        connectors: { feishu: feishu.getHealth(), wecom: wecom.getHealth() },
      };
    },

    async sendFeishu(body) {
      const envelope = {
        title: body.title || "Message from AI Gateway",
        body: body.body || body.text || "",
        riskLevel: body.riskLevel || "low",
        requiresResponse: Boolean(body.requiresResponse),
        responseDeadlineMs: body.responseDeadlineMs || 3600000,
      };
      return feishu.sendMessage(envelope, {
        targetId: body.targetId,
        format: body.format || "text",
      });
    },

    async sendWeCom(body) {
      const envelope = {
        title: body.title || "Message from AI Gateway",
        body: body.body || body.text || "",
        riskLevel: body.riskLevel || "low",
        requiresResponse: Boolean(body.requiresResponse),
        responseDeadlineMs: body.responseDeadlineMs || 3600000,
      };
      return wecom.sendMessage(envelope, {
        targetId: body.targetId,
        format: body.format || "text",
      });
    },
  };
}
