import { createHash } from "node:crypto";

type ToolDefinition = {
  externalEffectType?: string | null;
  externalEffectRequiresFence?: boolean;
};

type ExternalEffectFence = {
  fingerprint?: unknown;
  fencingToken?: unknown;
  assertActive?: (phase: "reserve" | "commit") => unknown | Promise<unknown>;
};

type ExternalEffectGateLike = {
  reserve(input: Record<string, unknown>): Promise<{ commit(): Promise<void> }>;
};

export function createExternalEffectToolBoundary({
  tool,
  toolName,
  params,
  context,
  gate,
  trustedFence,
  tenantId,
}: {
  tool: ToolDefinition;
  toolName: string;
  params: Record<string, unknown>;
  context: Record<string, any>;
  gate?: ExternalEffectGateLike;
  trustedFence?: ExternalEffectFence;
  tenantId?: string;
}) {
  const effectType = tool.externalEffectType || classifyDynamicExternalEffect(toolName, params);
  if (!effectType) {
    return {
      required: false,
      context,
      isCommitted: () => false,
      reconciliation: null,
    };
  }
  if (!gate || typeof gate.reserve !== "function") {
    return denied(
      "TOOL_EXTERNAL_EFFECT_GATE_REQUIRED",
      "A durable external-effect gate is required before this tool can execute.",
    );
  }
  const effectKey = typeof context.externalEffectKey === "string"
    ? context.externalEffectKey.trim()
    : "";
  if (!effectKey || effectKey.length > 255 || /[\u0000-\u001f\u007f]/u.test(effectKey)) {
    return denied(
      "TOOL_EXTERNAL_EFFECT_KEY_REQUIRED",
      "A bounded stable external-effect key is required for this tool call.",
    );
  }
  const requiresFence = tool.externalEffectRequiresFence === true || Boolean(effectType);
  if (requiresFence && typeof trustedFence?.assertActive !== "function") {
    return denied(
      "TOOL_EXTERNAL_EFFECT_FENCE_REQUIRED",
      "An active execution fence is required for this irreversible tool.",
    );
  }

  let reservation: { commit(): Promise<void> } | null = null;
  let committed = false;
  const guardedContext = {
    ...context,
    externalEffectRequired: true,
    async commitExternalEffect() {
      if (committed) return;
      if (!reservation) {
        const fenceIdentity = trustedFence?.fingerprint ?? trustedFence?.fencingToken;
        reservation = await gate.reserve({
          effectKeyHash: sha256(effectKey),
          route: `/agent-tools/${toolName}`,
          tenantId: tenantId ?? "default",
          effectType,
          payloadFingerprint: sha256(stableStringify({ toolName, params })),
          ...(fenceIdentity === undefined || fenceIdentity === null
            ? {}
            : { fenceFingerprint: normalizeFingerprint(fenceIdentity) }),
          fenceRequired: requiresFence,
          ...(typeof trustedFence?.assertActive === "function"
            ? { assertFence: (phase: "reserve" | "commit") => trustedFence.assertActive!(phase) }
            : {}),
        });
      }
      await reservation.commit();
      committed = true;
    },
  };
  return {
    required: true,
    context: guardedContext,
    isCommitted: () => committed,
    reconciliation: Object.freeze({
      effectType,
      effectKeyHash: sha256(effectKey),
      toolName,
    }),
  };
}

function denied(code: string, error: string) {
  return {
    required: true,
    denied: { code, error },
    context: {},
    isCommitted: () => false,
    reconciliation: null,
  };
}

function sha256(value: unknown) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function normalizeFingerprint(value: unknown) {
  const normalized = String(value).trim().toLowerCase();
  return /^[a-f0-9]{64}$/u.test(normalized) ? normalized : sha256(normalized);
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

export function classifyDynamicExternalEffect(toolName: string, params: Record<string, unknown>) {
  if (toolName !== "shell_exec" || typeof params?.command !== "string") return null;
  const patterns: Array<[RegExp, string]> = [
    [/(?:^|[;&|]\s*)git\s+push\b/iu, "git:push"],
    [/\bgh\s+pr\s+create\b/iu, "github:pull-request-create"],
    [/\b(?:npm|pnpm|yarn)\s+(?:run\s+)?(?:publish|deploy|release)\b/iu, "package:publish-or-deploy"],
    [/\bdocker\s+(?:buildx\s+)?push\b/iu, "container:push"],
    [/\bkubectl\s+(?:apply|create|delete|patch|replace|rollout|set)\b/iu, "kubernetes:mutation"],
    [/\bhelm\s+(?:install|upgrade|uninstall|rollback)\b/iu, "helm:mutation"],
    [/\bterraform\s+(?:apply|destroy|import)\b/iu, "terraform:mutation"],
    [/\b(?:serverless|sls|vercel|netlify)\b[^\n\r]*(?:deploy|--prod)\b/iu, "deployment:mutation"],
    [/\b(?:curl|wget|Invoke-WebRequest)\b/iu, "http:unclassified-external"],
  ];
  // A shell can hide a mutation behind an alias, script, subshell, or custom
  // executable. Named patterns improve audit classification, but the fallback
  // keeps every shell invocation behind the same durable fence.
  return patterns.find(([pattern]) => pattern.test(params.command as string))?.[1]
    ?? "shell:unclassified";
}
