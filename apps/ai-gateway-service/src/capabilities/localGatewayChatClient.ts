import { randomUUID } from "node:crypto";

import { resolveGatewayOutboundUrl } from "../security/gatewayOutboundUrlPolicy.ts";
import { safeOutboundFetch } from "../security/safeOutboundFetch.ts";

export const DEFAULT_INTERNAL_GATEWAY_URL = "http://127.0.0.1:3100";
export const DEFAULT_INTERNAL_GATEWAY_TIMEOUT_MS = 30_000;

type LocalGatewayOptions = {
  gatewayUrl?: string;
  gatewayAuthToken?: string;
  idempotencyKey?: string;
  providerDispatchKey?: string;
  timeoutMs?: number;
};

type LocalGatewayResult = {
  success: boolean;
  content?: string;
  error?: string;
};

function resolveGatewayUrl(options: LocalGatewayOptions) {
  if (options.gatewayUrl) return options.gatewayUrl.replace(/\/+$/u, "");
  const port = String(process.env.AI_GATEWAY_SERVICE_PORT ?? "3100").trim();
  return `http://127.0.0.1:${port}`;
}

function createHeaders(options: LocalGatewayOptions) {
  if (options.idempotencyKey !== undefined && options.providerDispatchKey !== undefined) {
    throw new Error("Use exactly one of idempotencyKey or providerDispatchKey.");
  }
  const token = options.gatewayAuthToken ?? process.env.PME_AUTH_TOKEN;
  const dispatchHeaders = options.idempotencyKey !== undefined
    ? { "Idempotency-Key": String(options.idempotencyKey) }
    : {
        "Provider-Dispatch-Key": String(
          options.providerDispatchKey ?? `local-capability-${randomUUID()}`,
        ),
      };
  return {
    "Content-Type": "application/json",
    ...(typeof token === "string" && token.length > 0
      ? { Authorization: `Bearer ${token}` }
      : {}),
    ...dispatchHeaders,
  };
}

function extractContent(data: any) {
  return data?.data?.outputText
    ?? data?.data?.text
    ?? data?.data?.content
    ?? data?.content
    ?? data?.text
    ?? data?.choices?.[0]?.message?.content
    ?? data?.choices?.[0]?.text
    ?? "";
}

export async function callLocalGatewayAI(
  message: string,
  mode = "standard",
  options: LocalGatewayOptions = {},
): Promise<LocalGatewayResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_INTERNAL_GATEWAY_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await safeOutboundFetch(
      `${resolveGatewayUrl(options)}/chat/auto`,
      {
        method: "POST",
        headers: createHeaders(options),
        body: JSON.stringify({ message, mode }),
        signal: controller.signal,
      },
      { resolveOutboundUrl: resolveGatewayOutboundUrl },
    );
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      return {
        success: false,
        error: `Gateway responded ${response.status}: ${errorBody.slice(0, 200)}`,
      };
    }
    const data = await response.json().catch(() => null);
    const content = extractContent(data);
    if (data?.success !== false && content) return { success: true, content };
    return { success: false, error: "AI returned an empty or invalid response." };
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return { success: false, error: `AI call timed out after ${timeoutMs}ms.` };
    }
    return {
      success: false,
      error: `AI gateway call failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
