import { createHash } from "node:crypto";

import type { ExternalEffectGate } from "../external-effects/externalEffectGate.ts";

type McpEffectConfig =
  | { transport: "http"; id: string; url: string }
  | { transport: "openapi"; id: string; baseUrl: string }
  | { transport: "stdio"; id: string; command: string; args?: string[]; cwd?: string };

export async function reserveMcpExternalEffect({
  gate,
  config,
  tenantId,
  toolName,
  args,
  keyContext,
}: {
  gate?: ExternalEffectGate;
  config: McpEffectConfig;
  tenantId: string;
  toolName: string;
  args: Record<string, unknown>;
  keyContext?: { effectKeyHash?: unknown; effectKeyInvalid?: boolean };
}) {
  if (!gate || typeof gate.reserve !== "function") {
    throw Object.assign(new Error("This upstream MCP tool requires the durable external-effect gate."), {
      code: "MCP_EXTERNAL_EFFECT_GATE_REQUIRED",
      category: "configuration",
      statusCode: 503,
    });
  }
  const targetFingerprint = fingerprintUpstreamTarget(config);
  const reservation = await gate.reserve({
    ...(keyContext ?? {}),
    route: `/__mcp-effect/${digest(`${config.id}\0${toolName}`).slice(0, 24)}`,
    tenantId,
    effectType: "mcp:upstream-tool-call",
    payloadFingerprint: digest(stableStringify({
      serverId: config.id,
      toolName,
      targetFingerprint,
      arguments: args,
    })),
  });
  await reservation.commit();
  return reservation.reservationFingerprint;
}

function fingerprintUpstreamTarget(config: McpEffectConfig) {
  if (config.transport === "http") {
    return digest(stableStringify({ transport: config.transport, url: config.url }));
  }
  if (config.transport === "openapi") {
    return digest(stableStringify({ transport: config.transport, baseUrl: config.baseUrl }));
  }
  return digest(stableStringify({
    transport: config.transport,
    command: config.command,
    args: config.args ?? [],
    cwd: config.cwd ?? null,
  }));
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
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
