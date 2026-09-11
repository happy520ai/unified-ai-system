type GovernanceOwnerLeaseProbe = {
  assertHeld(): void;
};

type GovernanceServiceHealth = {
  ready?: boolean;
  startupRecovery?: string;
  stateIntegrity?: string;
  auditIntegrity?: string;
};

type GovernanceHealthSource = {
  service?: {
    checkHealth?: () => Promise<GovernanceServiceHealth>;
  };
} | null | undefined;

export type AgentGovernanceHealthSummary = Readonly<{
  enabled: boolean;
  ready: boolean;
  status: "disabled" | "initializing" | "ready" | "degraded";
  ownerLease: "not_required" | "held" | "lost";
  startupRecovery: "not_required" | "pending" | "ready" | "failed";
  stateIntegrity: "not_required" | "pending" | "verified" | "failed";
  auditIntegrity: "not_required" | "pending" | "verified" | "failed";
  failureCode: null | "owner_lease_lost" | "startup_recovery_failed" | "state_integrity_failed" | "audit_integrity_failed" | "governance_health_unavailable";
  checkedAt: string | null;
}>;

export type AgentGovernanceHealthMonitor = {
  snapshot(): AgentGovernanceHealthSummary;
  check(): Promise<AgentGovernanceHealthSummary>;
};

const DISABLED_SUMMARY: AgentGovernanceHealthSummary = Object.freeze({
  enabled: false,
  ready: true,
  status: "disabled",
  ownerLease: "not_required",
  startupRecovery: "not_required",
  stateIntegrity: "not_required",
  auditIntegrity: "not_required",
  failureCode: null,
  checkedAt: null,
});

export function createAgentGovernanceHealthMonitor(options: {
  governance?: GovernanceHealthSource;
  ownerLease?: GovernanceOwnerLeaseProbe | null;
  now?: () => string;
  minimumServiceCheckIntervalMs?: number;
} = {}): AgentGovernanceHealthMonitor {
  const governance = options.governance;
  const ownerLease = options.ownerLease ?? null;
  const now = options.now ?? (() => new Date().toISOString());
  const minimumServiceCheckIntervalMs = Number.isFinite(options.minimumServiceCheckIntervalMs)
    ? Math.min(300_000, Math.max(0, Math.floor(Number(options.minimumServiceCheckIntervalMs))))
    : 60_000;
  let current: AgentGovernanceHealthSummary = governance
    ? Object.freeze({
        enabled: true,
        ready: false,
        status: "initializing",
        ownerLease: "held",
        startupRecovery: "pending",
        stateIntegrity: "pending",
        auditIntegrity: "pending",
        failureCode: null,
        checkedAt: null,
      })
    : DISABLED_SUMMARY;
  let inFlight: Promise<AgentGovernanceHealthSummary> | null = null;
  let lastServiceCheckAtMs = Number.NaN;

  function failed(
    failureCode: Exclude<AgentGovernanceHealthSummary["failureCode"], null>,
    checkedAt: string,
    detail: Partial<AgentGovernanceHealthSummary> = {},
  ): AgentGovernanceHealthSummary {
    return Object.freeze({
      enabled: true,
      ready: false,
      status: "degraded",
      ownerLease: "held",
      startupRecovery: "failed",
      stateIntegrity: "failed",
      auditIntegrity: "failed",
      failureCode,
      checkedAt,
      ...detail,
    });
  }

  async function runCheck(): Promise<AgentGovernanceHealthSummary> {
    if (!governance) return DISABLED_SUMMARY;
    const checkedAt = safeTimestamp(now);
    try {
      if (!ownerLease) {
        current = failed("owner_lease_lost", checkedAt, { ownerLease: "lost" });
        return current;
      }
      ownerLease.assertHeld();
    } catch {
      current = failed("owner_lease_lost", checkedAt, { ownerLease: "lost" });
      return current;
    }

    if (typeof governance.service?.checkHealth !== "function") {
      current = failed("governance_health_unavailable", checkedAt);
      return current;
    }

    const checkedAtMs = Date.parse(checkedAt);
    if (current.status !== "initializing"
      && Number.isFinite(lastServiceCheckAtMs)
      && checkedAtMs - lastServiceCheckAtMs < minimumServiceCheckIntervalMs) {
      return current;
    }
    lastServiceCheckAtMs = checkedAtMs;

    try {
      const serviceHealth = await governance.service.checkHealth();
      const startupRecovery = serviceHealth?.startupRecovery === "ready" ? "ready" : "failed";
      const stateIntegrity = serviceHealth?.stateIntegrity === "verified" ? "verified" : "failed";
      const auditIntegrity = serviceHealth?.auditIntegrity === "verified" ? "verified" : "failed";
      const ready = serviceHealth?.ready === true
        && startupRecovery === "ready"
        && stateIntegrity === "verified"
        && auditIntegrity === "verified";
      current = ready
        ? Object.freeze({
            enabled: true,
            ready: true,
            status: "ready",
            ownerLease: "held",
            startupRecovery,
            stateIntegrity,
            auditIntegrity,
            failureCode: null,
            checkedAt,
          })
        : failed(
            auditIntegrity !== "verified"
              ? "audit_integrity_failed"
              : stateIntegrity !== "verified"
                ? "state_integrity_failed"
                : "startup_recovery_failed",
            checkedAt,
            { startupRecovery, stateIntegrity, auditIntegrity },
          );
      return current;
    } catch (error) {
      const failureCode = classifyFailure(error);
      current = failed(failureCode, checkedAt, failureCode === "audit_integrity_failed"
        ? { startupRecovery: "ready", stateIntegrity: "verified", auditIntegrity: "failed" }
        : {});
      return current;
    }
  }

  return Object.freeze({
    snapshot() {
      return current;
    },
    check() {
      if (!inFlight) {
        inFlight = runCheck().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
  });
}

function classifyFailure(error: unknown): Exclude<AgentGovernanceHealthSummary["failureCode"], null> {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const code = `${String(record.code ?? "")} ${String(record.name ?? "")}`.toUpperCase();
  if (code.includes("AUDIT")) return "audit_integrity_failed";
  if (code.includes("INTEGRITY") || code.includes("CORRUPT") || code.includes("ANCHOR")) {
    return "state_integrity_failed";
  }
  if (code.includes("RECOVERY") || code.includes("MIGRATION") || code.includes("JOURNAL")) {
    return "startup_recovery_failed";
  }
  return "governance_health_unavailable";
}

function safeTimestamp(now: () => string): string {
  try {
    const value = now();
    return typeof value === "string" && Number.isFinite(Date.parse(value))
      ? new Date(value).toISOString()
      : new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}
