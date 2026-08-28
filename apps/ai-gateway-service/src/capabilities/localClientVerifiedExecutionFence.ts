import { createHash } from "node:crypto";

import type {
  LocalClientExecutionFence,
  LocalClientExecutionIdentity,
  ResolvedVerifiedLocalClientExecutionTarget,
} from "./localClientExecutionOrchestrator.ts";
import type { LocalClientRoutePlan } from "./localClientRoutePlanStore.ts";

export interface LocalClientVerifiedExecutionFenceDependencies {
  readonly acquireClaimFence: (input: Readonly<{
    executionId: string;
    plan: LocalClientRoutePlan;
    identity: LocalClientExecutionIdentity;
    signal: AbortSignal;
  }>) => LocalClientExecutionFence | Promise<LocalClientExecutionFence>;
  readonly resolveVerifiedTarget: (input: Readonly<{
    plan: LocalClientRoutePlan;
    identity: LocalClientExecutionIdentity;
  }>) => ResolvedVerifiedLocalClientExecutionTarget | Promise<ResolvedVerifiedLocalClientExecutionTarget>;
  readonly lifecycle: {
    getStatus(executionId: string): unknown | Promise<unknown>;
  };
}

export class LocalClientVerifiedExecutionFenceError extends Error {
  readonly code = "LOCAL_CLIENT_EXECUTION_AUTHORITY_INACTIVE" as const;
  readonly category = "concurrency" as const;
  readonly statusCode = 409;
  readonly retryable = false;

  constructor() {
    super("The local-client execution authority is no longer active.");
    this.name = "LocalClientVerifiedExecutionFenceError";
  }
}

export function createLocalClientVerifiedExecutionFence(
  dependencies: LocalClientVerifiedExecutionFenceDependencies,
) {
  assertDependencies(dependencies);

  return async function acquireVerifiedExecutionFence(input: Readonly<{
    executionId: string;
    plan: LocalClientRoutePlan;
    identity: LocalClientExecutionIdentity;
    signal: AbortSignal;
  }>): Promise<LocalClientExecutionFence> {
    const claimFence = await dependencies.acquireClaimFence(input);
    assertFence(claimFence);
    let released = false;

    return Object.freeze({
      fingerprint: claimFence.fingerprint,
      async assertActive(phase: "reserve" | "commit" | "dispatch") {
        if (released) throw inactive();
        await claimFence.assertActive(phase);
        const [target, lifecycle] = await Promise.all([
          dependencies.resolveVerifiedTarget({ plan: input.plan, identity: input.identity }),
          dependencies.lifecycle.getStatus(input.executionId),
        ]).catch(() => {
          throw inactive();
        });
        assertTarget(target, input.plan);
        assertLifecycle(lifecycle, input.executionId, input.identity);
        return true;
      },
      async release() {
        if (released) return;
        released = true;
        await claimFence.release?.();
      },
    });
  };
}

function assertTarget(target: ResolvedVerifiedLocalClientExecutionTarget, plan: LocalClientRoutePlan): void {
  if (
    !isRecord(target)
    || target.descriptorVersion !== "verified-local-client-adapter-target-v1"
    || target.clientId !== plan.clientId
    || target.revision !== plan.clientRevision
    || target.state !== "verified"
    || target.trustDecision !== "verified"
    || !isRecord(target.adapter)
    || target.adapter.id !== plan.adapterId
    || target.adapter.type !== plan.adapterType
    || target.adapter.version !== plan.adapterVersion
    || !Array.isArray(target.capabilityIds)
    || !target.capabilityIds.includes(plan.capabilityId)
  ) throw inactive();
}

function assertLifecycle(
  raw: unknown,
  executionId: string,
  identity: LocalClientExecutionIdentity,
): void {
  if (
    !isRecord(raw)
    || raw.success !== true
    || raw.planId !== executionId
    || raw.status !== "running"
    || raw.cancelRequested !== false
    || raw.pauseRequested !== false
    || raw.tenantFingerprint !== identityFingerprint(identity.tenantId)
    || raw.subjectFingerprint !== identityFingerprint(identity.subjectId)
  ) throw inactive();
}

function assertDependencies(dependencies: LocalClientVerifiedExecutionFenceDependencies): void {
  if (
    !isRecord(dependencies)
    || Reflect.ownKeys(dependencies).some((key) => !new Set([
      "acquireClaimFence",
      "resolveVerifiedTarget",
      "lifecycle",
    ]).has(String(key)))
    || typeof dependencies.acquireClaimFence !== "function"
    || typeof dependencies.resolveVerifiedTarget !== "function"
    || typeof dependencies.lifecycle?.getStatus !== "function"
  ) throw inactive();
}

function assertFence(value: LocalClientExecutionFence): void {
  if (
    !isRecord(value)
    || typeof value.fingerprint !== "string"
    || !/^[a-f0-9]{16,64}$/u.test(value.fingerprint)
    || typeof value.assertActive !== "function"
    || (value.release !== undefined && typeof value.release !== "function")
  ) throw inactive();
}

function identityFingerprint(value: string): string {
  return `idfp_${createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function inactive(): LocalClientVerifiedExecutionFenceError {
  return new LocalClientVerifiedExecutionFenceError();
}
