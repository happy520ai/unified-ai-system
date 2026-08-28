import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";

import type { ExternalEffectGate } from "./externalEffectGate.ts";
import { readExternalEffectKeyContext } from "./externalEffectHttpContext.ts";

export async function reserveWebhookExternalEffect({
  gate,
  request,
  route,
  effectType,
  webhookUrl,
  payload,
  tenantId,
}: {
  gate: ExternalEffectGate;
  request: IncomingMessage;
  route: string;
  effectType: string;
  webhookUrl: string;
  payload: unknown;
  tenantId?: string;
}) {
  const keyContext = readExternalEffectKeyContext(request);
  const targetFingerprint = createHash("sha256").update(webhookUrl).digest("hex");
  const payloadFingerprint = createHash("sha256")
    .update(stableStringify({ targetFingerprint, payload }))
    .digest("hex");
  return gate.reserve({
    ...keyContext,
    route,
    tenantId: tenantId ?? "default",
    effectType,
    payloadFingerprint,
  });
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
