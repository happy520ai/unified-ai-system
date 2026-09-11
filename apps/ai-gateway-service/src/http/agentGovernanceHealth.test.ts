import { describe, expect, it, vi } from "vitest";
import { createAgentGovernanceHealthMonitor } from "./agentGovernanceHealth.ts";

describe("Agent Governance health monitor", () => {
  it("returns a non-secret verified summary and coalesces concurrent checks", async () => {
    let resolveHealth!: (value: Record<string, unknown>) => void;
    const checkHealth = vi.fn(() => new Promise<Record<string, unknown>>((resolve) => {
      resolveHealth = resolve;
    }));
    const monitor = createAgentGovernanceHealthMonitor({
      governance: { service: { checkHealth } },
      ownerLease: { assertHeld: vi.fn() },
      now: () => "2026-08-30T12:00:00.000Z",
      minimumServiceCheckIntervalMs: 0,
    });

    const first = monitor.check();
    const second = monitor.check();
    expect(checkHealth).toHaveBeenCalledTimes(1);
    resolveHealth({
      ready: true,
      startupRecovery: "ready",
      stateIntegrity: "verified",
      auditIntegrity: "verified",
      secret: "must-not-escape",
      path: "must-not-escape",
    });

    await expect(first).resolves.toEqual(await second);
    expect(monitor.snapshot()).toEqual({
      enabled: true,
      ready: true,
      status: "ready",
      ownerLease: "held",
      startupRecovery: "ready",
      stateIntegrity: "verified",
      auditIntegrity: "verified",
      failureCode: null,
      checkedAt: "2026-08-30T12:00:00.000Z",
    });
    expect(JSON.stringify(monitor.snapshot())).not.toContain("must-not-escape");
  });

  it("fails closed without leaking owner metadata after the lease is lost", async () => {
    const ownerLease = {
      ownerId: "private-owner-id",
      leasePath: "C:/private/owner.lease.json",
      assertHeld: vi.fn(() => {
        throw Object.assign(new Error("private owner details"), {
          code: "AGENT_GOVERNANCE_OWNER_LEASE_NOT_HELD",
        });
      }),
    };
    const checkHealth = vi.fn(async () => ({
      ready: true,
      startupRecovery: "ready",
      stateIntegrity: "verified",
      auditIntegrity: "verified",
    }));
    const monitor = createAgentGovernanceHealthMonitor({
      governance: { service: { checkHealth } },
      ownerLease,
    });

    const result = await monitor.check();
    expect(result).toMatchObject({
      enabled: true,
      ready: false,
      status: "degraded",
      ownerLease: "lost",
      failureCode: "owner_lease_lost",
    });
    expect(checkHealth).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(ownerLease.ownerId);
    expect(JSON.stringify(result)).not.toContain(ownerLease.leasePath);
    expect(JSON.stringify(result)).not.toContain("private owner details");
  });

  it("classifies audit verification failures without returning raw errors", async () => {
    const monitor = createAgentGovernanceHealthMonitor({
      governance: {
        service: {
          checkHealth: async () => {
            throw Object.assign(new Error("HMAC secret and path must stay private"), {
              code: "AGENT_GOVERNANCE_AUDIT_CORRUPT",
            });
          },
        },
      },
      ownerLease: { assertHeld() {} },
    });

    const result = await monitor.check();
    expect(result).toMatchObject({
      ready: false,
      failureCode: "audit_integrity_failed",
      auditIntegrity: "failed",
    });
    expect(JSON.stringify(result)).not.toContain("HMAC");
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("classifies generation Registry authority mismatch as startup recovery failure", async () => {
    const monitor = createAgentGovernanceHealthMonitor({
      governance: {
        service: {
          checkHealth: async () => {
            throw Object.assign(new Error("private Registry authority mismatch"), {
              code: "AGENT_GENERATION_RECOVERY_AUTHORITY_MISMATCH",
            });
          },
        },
      },
      ownerLease: { assertHeld() {} },
    });

    await expect(monitor.check()).resolves.toMatchObject({
      ready: false,
      startupRecovery: "failed",
      failureCode: "startup_recovery_failed",
    });
  });

  it("keeps disabled governance ready without probing an owner", async () => {
    const result = await createAgentGovernanceHealthMonitor().check();
    expect(result).toMatchObject({
      enabled: false,
      ready: true,
      status: "disabled",
      ownerLease: "not_required",
    });
  });

  it("does not rescan governance state for repeated public probes inside the default interval", async () => {
    const checkHealth = vi.fn(async () => ({
      ready: true,
      startupRecovery: "ready",
      stateIntegrity: "verified",
      auditIntegrity: "verified",
    }));
    const assertHeld = vi.fn();
    const monitor = createAgentGovernanceHealthMonitor({
      governance: { service: { checkHealth } },
      ownerLease: { assertHeld },
      now: () => "2026-08-30T12:00:00.000Z",
    });

    for (let index = 0; index < 10_000; index += 1) await monitor.check();
    expect(assertHeld).toHaveBeenCalledTimes(10_000);
    expect(checkHealth).toHaveBeenCalledTimes(1);
  });
});
