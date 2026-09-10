export type ImConnectorId = "feishu" | "wecom";
export type ImMessageFormat = "text" | "markdown" | "card";
export type FeishuReceiveIdType = "open_id" | "user_id" | "union_id" | "email" | "chat_id";
export interface ImConnectorMessage {
  title?: string;
  body?: string;
  /** Compatibility alias; if both body and text are supplied they must agree. */
  text?: string;
  format?: ImMessageFormat;
  /** API mode only. Webhooks are bound to their configured group. */
  targetId?: string;
  receiveIdType?: FeishuReceiveIdType;
  riskLevel?: "low" | "medium" | "high";
  requiresResponse?: boolean;
  responseDeadlineMs?: number;
}
export interface ImConnectorSendOptions {
  /** Caller-owned key. An unknown outcome does not authorize a retry or a new key. */
  externalEffectKey: string;
}
export interface ImConnectorSendResult {
  route: string;
  delivered: boolean;
  dryRun: boolean;
  externalMessageId: string | null;
  status: "dry_run" | "not_sent" | "accepted" | "rejected" | "outcome_unknown";
  /** The message transport was invoked; this does not prove recipient delivery or reading. */
  messageAttempted: boolean;
  outcomeUnknown: boolean;
  error?: string;
  metadata: Record<string, unknown>;
}
export interface ImConnectorSummary {
  connectorId: ImConnectorId | "explicit-text";
  title: string;
  mode: "api" | "webhook" | "manual-input";
  status?: "closed" | "dry-run" | "configured-unverified";
  dryRun?: boolean;
  webhookConfigured?: boolean;
  appIdConfigured?: boolean;
  supportedFormats?: ImMessageFormat[];
  /** Count for the authenticated tenant; no recipient list or secret is disclosed. */
  allowedTargets?: number;
  safety?: string;
}
export interface ImConnectorListResult { connectors: ImConnectorSummary[]; }
