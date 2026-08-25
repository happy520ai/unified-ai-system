import { createHash } from "node:crypto";

import {
  externalEffectGateConfigInternals,
  resolveExternalEffectGateResources,
  type ExternalEffectRuntimeEnv,
  type ExternalEffectStoreMode,
} from "./externalEffectGateConfig.ts";
import type { IdempotencyCoordinator } from "../http/idempotencyCoordinator.ts";

type FenceAssertion = (phase: "reserve" | "commit") => unknown | Promise<unknown>;

export type ExternalEffectReservationInput = {
  effectKeyHash?: unknown;
  effectKeyInvalid?: boolean;
  route?: unknown;
  tenantId?: unknown;
  effectType?: unknown;
  payloadFingerprint?: unknown;
  fenceFingerprint?: unknown;
  fenceRequired?: boolean;
  assertFence?: FenceAssertion;
};

export type ExternalEffectReservation = {
  reserved: boolean;
  bypassed: boolean;
  reservationFingerprint: string | null;
  commit(): Promise<void>;
};

export type ExternalEffectGate = {
  readonly status: {
    mode: ExternalEffectStoreMode;
    enabled: boolean;
    durable: boolean;
    distributed: boolean;
    centralRequired: boolean;
    ttlMs: number;
    maxEntries: number;
  };
  reserve(input: ExternalEffectReservationInput): Promise<ExternalEffectReservation>;
  getHealth(): Record<string, unknown>;
  checkHealth(): Promise<Record<string, unknown>>;
  close(): Promise<void>;
};

export function createExternalEffectGate({
  env = process.env,
  enabled = false,
  coordinator,
}: {
  env?: ExternalEffectRuntimeEnv;
  enabled?: boolean;
  coordinator?: IdempotencyCoordinator;
} = {}): ExternalEffectGate {
  if (!enabled && !coordinator) return createDisabledGate();

  const {
    centralRequired,
    mode,
    ttlMs,
    maxEntries,
    ownsCoordinator,
    effectCoordinator,
  } = resolveExternalEffectGateResources({ env, enabled, coordinator });
  const status = Object.freeze({
    mode,
    enabled: true,
    durable: true,
    distributed: mode === "postgres",
    centralRequired,
    ttlMs,
    maxEntries,
  });

  return {
    status,
    async reserve(input) {
      if (input.effectKeyInvalid === true) {
        throw effectError(
          "EXTERNAL_EFFECT_KEY_INVALID",
          "External effects require exactly one valid operation key.",
          400,
          "validation",
        );
      }
      const effectKeyHash = requiredDigest(input.effectKeyHash, "effectKeyHash");
      const route = boundedText(input.route ?? "/internal", "route", 2_048);
      const tenantId = boundedText(input.tenantId ?? "default", "tenantId", 256);
      const effectType = boundedText(input.effectType, "effectType", 128);
      const payloadFingerprint = requiredDigest(input.payloadFingerprint, "payloadFingerprint");
      const fenceFingerprint = optionalDigest(input.fenceFingerprint);
      const assertFence = typeof input.assertFence === "function" ? input.assertFence : null;
      if (input.fenceRequired === true && (!assertFence || !fenceFingerprint)) {
        throw effectError(
          "EXTERNAL_EFFECT_FENCE_REQUIRED",
          "This external effect requires an active execution fence.",
          409,
          "concurrency",
        );
      }
      await assertActiveFence(assertFence, "reserve");

      const routeHash = createHash("sha256").update(route).digest("hex").slice(0, 24);
      const typeHash = createHash("sha256").update(effectType).digest("hex").slice(0, 24);
      const tenantFingerprint = createHash("sha256").update(tenantId).digest("hex");
      const reservationRoute = `/__external-effect/${routeHash}/${typeHash}`;
      let outcome;
      try {
        outcome = await effectCoordinator.execute({
          request: {
            headers: {
              "idempotency-key": effectKeyHash,
              authorization: `Bearer ee-${tenantFingerprint}`,
            },
            socket: { remoteAddress: "127.0.0.1" },
          },
          route: reservationRoute,
          payload: {
            payloadFingerprint,
            effectType,
            fenceFingerprint,
          },
          operation: async () => ({ reserved: true }),
        });
      } catch (error) {
        throw effectError(
          "EXTERNAL_EFFECT_STORE_UNAVAILABLE",
          "The durable external-effect reservation could not be committed.",
          503,
          "persistence",
          true,
          error,
        );
      }
      if (!outcome.accepted) throw mapRejectedOutcome(outcome);
      if (outcome.status !== "created") {
        throw effectError(
          "EXTERNAL_EFFECT_RESERVATION_UNCONFIRMED",
          "The external-effect reservation was not durably confirmed.",
          409,
          "persistence",
        );
      }
      let committed = false;
      return {
        reserved: true,
        bypassed: false,
        reservationFingerprint: createHash("sha256")
          .update([
            "external-effect-log-v1",
            effectKeyHash,
            payloadFingerprint,
            tenantFingerprint,
            reservationRoute,
            fenceFingerprint ?? "none",
          ].join("\0"))
          .digest("hex")
          .slice(0, 16),
        async commit() {
          if (committed) return;
          await assertActiveFence(assertFence, "commit");
          committed = true;
        },
      };
    },
    getHealth() {
      return safeHealth(status, effectCoordinator.getStats());
    },
    async checkHealth() {
      const snapshot = effectCoordinator.checkHealth
        ? await effectCoordinator.checkHealth()
        : effectCoordinator.getStats();
      return safeHealth(status, snapshot);
    },
    async close() {
      if (ownsCoordinator) await effectCoordinator.close();
    },
  };
}

async function assertActiveFence(assertFence: FenceAssertion | null, phase: "reserve" | "commit") {
  if (!assertFence) return;
  try {
    const result = await assertFence(phase);
    if (result === false) throw new Error("Execution fence is inactive.");
  } catch (error) {
    throw effectError(
      "EXTERNAL_EFFECT_FENCE_INACTIVE",
      "The execution fence is not active at the external-effect commit boundary.",
      409,
      "concurrency",
      false,
      error,
    );
  }
}

function mapRejectedOutcome(outcome: {
  code: string;
  retryable: boolean;
}) {
  if (outcome.code === "IDEMPOTENCY_KEY_REUSED") {
    return effectError(
      "EXTERNAL_EFFECT_KEY_REUSED",
      "The external-effect key was already used with a different operation.",
      409,
      "validation",
    );
  }
  if (outcome.code === "IDEMPOTENCY_CAPACITY_REACHED") {
    return effectError(
      "EXTERNAL_EFFECT_CAPACITY_REACHED",
      "The bounded external-effect reservation store is full.",
      503,
      "persistence",
      true,
    );
  }
  if (new Set([
    "IDEMPOTENCY_RESULT_NOT_REPLAYABLE",
    "IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED",
    "IDEMPOTENCY_PREVIOUS_ATTEMPT_UNKNOWN",
    "IDEMPOTENCY_REQUEST_IN_PROGRESS",
  ]).has(outcome.code)) {
    return effectError(
      "EXTERNAL_EFFECT_ALREADY_RESERVED",
      "This external-effect key has already been consumed; the prior outcome may be unknown.",
      409,
      "concurrency",
    );
  }
  return effectError(
    "EXTERNAL_EFFECT_STORE_UNAVAILABLE",
    "The durable external-effect store returned an unsafe state.",
    503,
    "persistence",
    outcome.retryable === true,
  );
}

function safeHealth(status: ExternalEffectGate["status"], snapshot: Record<string, unknown>) {
  return Object.freeze({
    ...status,
    ttlMs: Number(snapshot.ttlMs ?? status.ttlMs),
    maxEntries: Number(snapshot.maxEntries ?? status.maxEntries),
    available: snapshot.available !== false,
    entries: Number(snapshot.entries ?? 0),
    inFlight: Number(snapshot.inFlight ?? 0),
    tombstones: Number(snapshot.tombstones ?? 0),
    statsUpdatedAt: snapshot.statsUpdatedAt ?? null,
  });
}

function createDisabledGate(): ExternalEffectGate {
  const status = Object.freeze({
    mode: "disabled" as const,
    enabled: false,
    durable: false,
    distributed: false,
    centralRequired: false,
    ttlMs: 0,
    maxEntries: 0,
  });
  return {
    status,
    async reserve() {
      throw effectError(
        "EXTERNAL_EFFECT_GATE_UNAVAILABLE",
        "Irreversible external effects require the durable external-effect gate.",
        503,
        "configuration",
      );
    },
    getHealth() {
      return Object.freeze({ ...status, available: true, entries: 0, inFlight: 0, tombstones: 0 });
    },
    async checkHealth() {
      return this.getHealth();
    },
    async close() {},
  };
}

function optionalDigest(value: unknown) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return requiredDigest(value, "digest");
}

function requiredDigest(value: unknown, name: string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(normalized)) {
    throw effectError(
      name === "effectKeyHash" ? "EXTERNAL_EFFECT_KEY_REQUIRED" : "EXTERNAL_EFFECT_INPUT_INVALID",
      `${name} must be a SHA-256 digest.`,
      400,
      "validation",
    );
  }
  return normalized;
}

function boundedText(value: unknown, name: string, maxLength: number) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw effectError(
      "EXTERNAL_EFFECT_INPUT_INVALID",
      `${name} is missing, too long, or contains control characters.`,
      400,
      "validation",
    );
  }
  return normalized;
}

function effectError(
  code: string,
  message: string,
  statusCode: number,
  category: string,
  retryable = false,
  cause?: unknown,
) {
  return Object.assign(new Error(message), {
    code,
    statusCode,
    category,
    retryable,
    ...(cause ? { cause } : {}),
  });
}

export const externalEffectGateInternals = Object.freeze({
  ...externalEffectGateConfigInternals,
});
