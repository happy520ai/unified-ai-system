import { describe, it, expect } from "vitest";
import { createPrometheusExporter } from "./prometheusExporter.js";

describe("prometheusExporter", () => {
  it("formats a metrics snapshot into Prometheus text format", () => {
    const exporter = createPrometheusExporter({ prefix: "ai_gateway" });
    const text = exporter.formatMetrics({
      totalRequests: 10,
      activeConnections: 2,
      latency: { p50: 100, p95: 200, p99: 300 },
      totalErrors: 1,
      providerScores: { "local-fake": 90 },
    });

    expect(text).toContain("# HELP ai_gateway_requests_total");
    expect(text).toContain("ai_gateway_requests_total 10");
    expect(text).toContain("ai_gateway_active_connections 2");
    expect(text).toContain('ai_gateway_request_duration_ms{quantile="0.5"} 100');
    expect(text).toContain('ai_gateway_request_duration_ms{quantile="0.99"} 300');
    expect(text).toContain("ai_gateway_errors_total 1");
    expect(text).toContain('ai_gateway_provider_health_score{provider="local-fake"} 90');
    expect(text).toContain("ai_gateway_uptime_seconds");
  });

  it("handles empty/missing snapshot fields gracefully", () => {
    const exporter = createPrometheusExporter();
    const text = exporter.formatMetrics({});
    expect(text).toContain("ai_gateway_requests_total 0");
    expect(text).toContain("ai_gateway_errors_total 0");
    expect(text).toContain("ai_gateway_memory_usage_bytes");
  });

  it("exposes gateway error circuit resilience metrics", () => {
    const exporter = createPrometheusExporter({ prefix: "ai_gateway" });
    const text = exporter.formatMetrics({
      resilience: {
        gatewayErrorCircuitState: "open",
        gatewayErrorCircuitOpenAt: 1600000000000,
        gatewayErrorCircuitRejections: 3,
        gatewayErrorCircuitFailures: 7,
        gatewayErrorCircuitSuccesses: 11,
      },
    });

    expect(text).toContain("ai_gateway_gateway_error_circuit_state{state=\"open\"} 1");
    expect(text).toContain("ai_gateway_gateway_error_circuit_state{state=\"closed\"} 0");
    expect(text).toContain("ai_gateway_gateway_error_circuit_rejections_total 3");
    expect(text).toContain("ai_gateway_gateway_error_circuit_failures_total 7");
    expect(text).toContain("ai_gateway_gateway_error_circuit_success_total 11");
    expect(text).toMatch(/ai_gateway_gateway_error_circuit_open_seconds [1-9][0-9]*\.\d{2}/);
  });

  it("emits readiness status and failure metrics", () => {
    const exporter = createPrometheusExporter({ prefix: "ai_gateway" });
    const text = exporter.formatMetrics({
      totalRequests: 5,
      activeConnections: 2,
      resilience: {
        readinessCheckCount: 10,
        readinessReadyChecks: 6,
        readinessDegradedChecks: 4,
        readinessFailureReasons: {
          knowledge: 4,
          workflow: 2,
          "service-dependency": 2,
        },
      },
      readinessFailures: ["knowledge", "workflow"],
      latency: null,
      totalErrors: 0,
    });

    expect(text).toContain('ai_gateway_gateway_readiness_status{state="ready"} 0');
    expect(text).toContain('ai_gateway_gateway_readiness_status{state="degraded"} 1');
    expect(text).toContain("ai_gateway_gateway_readiness_checks_total{result=\"total\"} 10");
    expect(text).toContain("ai_gateway_gateway_readiness_checks_total{result=\"ready\"} 6");
    expect(text).toContain("ai_gateway_gateway_readiness_checks_total{result=\"degraded\"} 4");
    expect(text).toContain('ai_gateway_gateway_readiness_failures{reason="knowledge"} 1');
    expect(text).toContain('ai_gateway_gateway_readiness_failures{reason="workflow"} 1');
    expect(text).toContain('ai_gateway_gateway_readiness_events_total{reason="knowledge"} 4');
    expect(text).toContain('ai_gateway_gateway_readiness_events_total{reason="workflow"} 2');
    expect(text).toContain('ai_gateway_gateway_readiness_events_total{reason="service-dependency"} 2');
  });

  it("renders zeroed readiness metrics when no failures are present", () => {
    const exporter = createPrometheusExporter({ prefix: "ai_gateway" });
    const text = exporter.formatMetrics({
      totalRequests: 1,
      activeConnections: 0,
      resilience: {
        readinessCheckCount: 5,
        readinessReadyChecks: 5,
        readinessDegradedChecks: 0,
        readinessFailureReasons: {},
      },
      readinessFailures: [],
      totalErrors: 0,
    });

    expect(text).toContain('ai_gateway_gateway_readiness_status{state="ready"} 1');
    expect(text).toContain('ai_gateway_gateway_readiness_status{state="degraded"} 0');
    expect(text).toContain("ai_gateway_gateway_readiness_failures 0");
  });

  it("renders safe PostgreSQL idempotency health metrics", () => {
    const exporter = createPrometheusExporter({ prefix: "ai_gateway" });
    const text = exporter.formatMetrics({
      idempotency: {
        storeMode: "postgres",
        available: false,
        entries: 7,
        inFlight: 2,
        replayable: 3,
        tombstones: 2,
        statsUpdatedAt: Date.now() - 2_000,
      },
    });

    expect(text).toContain('ai_gateway_idempotency_store_available{mode="postgres"} 0');
    expect(text).toContain('ai_gateway_idempotency_entries{mode="postgres",state="total"} 7');
    expect(text).toContain('ai_gateway_idempotency_entries{mode="postgres",state="replayable"} 3');
    expect(text).toMatch(/ai_gateway_idempotency_stats_age_seconds\{mode="postgres"\} 2\.\d{3}/);
    expect(text).not.toContain("connectionString");
  });

  it("renders provider dispatch reservation health without identifiers", () => {
    const exporter = createPrometheusExporter({ prefix: "ai_gateway" });
    const text = exporter.formatMetrics({
      providerDispatch: {
        mode: "postgres",
        enabled: true,
        required: true,
        durable: true,
        distributed: true,
        available: false,
        entries: 9,
        inFlight: 2,
        tombstones: 7,
        maxEntries: 100_000,
        statsUpdatedAt: Date.now() - 3_000,
        connectionString: "postgres://must-not-leak",
        reservationFingerprint: "must-not-leak",
      },
    });

    expect(text).toContain('ai_gateway_provider_dispatch_gate_enabled{mode="postgres"} 1');
    expect(text).toContain('ai_gateway_provider_dispatch_key_required{mode="postgres"} 1');
    expect(text).toContain('ai_gateway_provider_dispatch_store_available{mode="postgres"} 0');
    expect(text).toContain('ai_gateway_provider_dispatch_store_distributed{mode="postgres"} 1');
    expect(text).toContain('ai_gateway_provider_dispatch_reservations{mode="postgres",state="total"} 9');
    expect(text).toContain('ai_gateway_provider_dispatch_reservations{mode="postgres",state="capacity"} 100000');
    expect(text).toMatch(/ai_gateway_provider_dispatch_stats_age_seconds\{mode="postgres"\} 3\.\d{3}/);
    expect(text).not.toContain("must-not-leak");
  });

  it("renders bounded WebSocket lease metrics without deployment identifiers", () => {
    const exporter = createPrometheusExporter({ prefix: "ai_gateway" });
    const text = exporter.formatMetrics({
      webSocketLease: {
        storeMode: "postgres",
        distributed: true,
        available: false,
        activeLocalLeases: 3,
        leaseMs: 30_000,
        localSafetyMs: 1_000,
        acquired: 9,
        denied: 4,
        lost: 2,
        released: 6,
        namespace: "private-cluster-name",
        connectionString: "postgres://must-not-leak",
      },
    });

    expect(text).toContain("ai_gateway_websocket_lease_enabled 1");
    expect(text).toContain('ai_gateway_websocket_lease_store_available{mode="postgres"} 0');
    expect(text).toContain("ai_gateway_websocket_lease_active_local 3");
    expect(text).toContain("ai_gateway_websocket_lease_duration_seconds 30");
    expect(text).toContain("ai_gateway_websocket_lease_local_safety_seconds 1");
    expect(text).toContain('ai_gateway_websocket_lease_events_total{event="lost"} 2');
    expect(text).not.toContain("private-cluster-name");
    expect(text).not.toContain("postgres://must-not-leak");
  });

  it("renders safe A2A task and Workforce claim-store metrics", () => {
    const exporter = createPrometheusExporter({ prefix: "ai_gateway" });
    const text = exporter.formatMetrics({
      a2aTaskStore: {
        mode: "sqlite",
        durable: true,
        available: true,
        atomicTerminalFence: true,
        maxEntries: 10_000,
        maxEntriesPerOwner: 2_000,
        maxTaskBytes: 4_194_304,
        sqlitePath: "E:/private/a2a.sqlite",
        executionLease: {
          mode: "postgres-fenced",
          enabled: true,
          available: true,
          activeLeases: 2,
        },
      },
      workforceClaimStore: {
        mode: "postgres-fenced",
        distributed: true,
        available: false,
        activeClaims: 3,
        maxClaims: 2_000,
        statsUpdatedAt: Date.now() - 1_000,
        namespace: "private-deployment",
        connectionString: "postgres://must-not-leak",
      },
      workforceTaskQueue: {
        mode: "postgres-central-fenced",
        distributed: true,
        available: true,
        atomicTerminalFence: true,
        totalQueued: 4,
        totalActive: 2,
        totalCompleted: 8,
        totalFailed: 1,
        totalCancelled: 3,
        namespace: "private-queue",
        connectionString: "postgres://queue-must-not-leak",
      },
      workforceExecutionControl: {
        mode: "postgres-central",
        distributed: true,
        available: true,
        approval: { activeApprovals: 3, maxApprovals: 100 },
        lifecycle: { activeExecutions: 2, maxExecutions: 50 },
        namespace: "private-control",
        connectionString: "postgres://control-must-not-leak",
      },
    });

    expect(text).toContain('ai_gateway_a2a_task_store_available{mode="sqlite"} 1');
    expect(text).toContain('ai_gateway_a2a_task_store_durable{mode="sqlite"} 1');
    expect(text).toContain('ai_gateway_a2a_task_store_distributed{mode="sqlite"} 0');
    expect(text).toContain('ai_gateway_a2a_task_store_atomic_terminal_fence{mode="sqlite"} 1');
    expect(text).toContain('ai_gateway_a2a_execution_lease_enabled{mode="postgres-fenced"} 1');
    expect(text).toContain('ai_gateway_a2a_execution_lease_available{mode="postgres-fenced"} 1');
    expect(text).toContain('ai_gateway_a2a_execution_leases{mode="postgres-fenced"} 2');
    expect(text).toContain('ai_gateway_a2a_task_store_limit{resource="entries"} 10000');
    expect(text).toContain('ai_gateway_workforce_claim_store_available{mode="postgres-fenced"} 0');
    expect(text).toContain('ai_gateway_workforce_claim_store_distributed{mode="postgres-fenced"} 1');
    expect(text).toContain('ai_gateway_workforce_claims{state="active"} 3');
    expect(text).toContain('ai_gateway_workforce_task_queue_available{mode="postgres-central-fenced"} 1');
    expect(text).toContain('ai_gateway_workforce_task_queue_distributed{mode="postgres-central-fenced"} 1');
    expect(text).toContain('ai_gateway_workforce_task_queue_tasks{state="active"} 2');
    expect(text).toContain("ai_gateway_workforce_task_queue_atomic_terminal_fence 1");
    expect(text).toContain('ai_gateway_workforce_execution_control_available{mode="postgres-central"} 1');
    expect(text).toContain('ai_gateway_workforce_execution_control_distributed{mode="postgres-central"} 1');
    expect(text).toContain('ai_gateway_workforce_execution_control_records{kind="approval",state="active"} 3');
    expect(text).toContain('ai_gateway_workforce_execution_control_records{kind="lifecycle",state="active"} 2');
    expect(text).toMatch(/ai_gateway_workforce_claim_stats_age_seconds\{mode="postgres-fenced"\} 1\.\d{3}/);
    expect(text).not.toContain("E:/private/a2a.sqlite");
    expect(text).not.toContain("private-deployment");
    expect(text).not.toContain("private-queue");
    expect(text).not.toContain("postgres://must-not-leak");
    expect(text).not.toContain("postgres://queue-must-not-leak");
    expect(text).not.toContain("private-control");
    expect(text).not.toContain("postgres://control-must-not-leak");
  });

  it("renders central usage-ledger health without database identity", () => {
    const exporter = createPrometheusExporter({ prefix: "ai_gateway" });
    const text = exporter.formatMetrics({
      usageLedger: {
        status: "degraded",
        persistence: "postgres-central",
        storeMode: "postgres",
        available: false,
        rowCount: 12,
        maxRows: 1_000,
        totalWriteFailures: 2,
        namespace: "private-ledger",
        connectionString: "postgres://must-not-leak",
      },
    });

    expect(text).toContain('ai_gateway_usage_ledger_store_available{mode="postgres"} 0');
    expect(text).toContain('ai_gateway_usage_ledger_rows{state="current"} 12');
    expect(text).toContain('ai_gateway_usage_ledger_rows{state="capacity"} 1000');
    expect(text).toContain("ai_gateway_usage_ledger_write_failures_total 2");
    expect(text).not.toContain("private-ledger");
    expect(text).not.toContain("postgres://must-not-leak");
  });

  it("renders central audit readiness without hashes, keys, or database identity", () => {
    const exporter = createPrometheusExporter({ prefix: "ai_gateway" });
    const text = exporter.formatMetrics({
      health: {
        enterprise: {
          audit: {
            central: {
              status: "degraded",
              mode: "postgres-hmac-chain",
              available: false,
              sequence: 42,
              hash: "must-not-be-a-label",
              keyId: "private-key-id",
              connectionString: "postgres://must-not-leak",
              externalRetentionVerified: false,
            },
          },
        },
      },
    });

    expect(text).toContain('ai_gateway_audit_central_store_available{mode="postgres-hmac-chain"} 0');
    expect(text).toContain("ai_gateway_audit_central_sequence 42");
    expect(text).toContain("ai_gateway_audit_external_retention_verified 0");
    expect(text).not.toContain("must-not-be-a-label");
    expect(text).not.toContain("private-key-id");
    expect(text).not.toContain("postgres://must-not-leak");
  });

  it("renders PostgreSQL rate-limit store health without partition keys", () => {
    const exporter = createPrometheusExporter({ prefix: "ai_gateway" });
    const text = exporter.formatMetrics({
      rateLimiter: {
        storeMode: "postgres",
        available: false,
        distributed: true,
        global: {
          activeBuckets: 5,
          statsUpdatedAt: Date.now() - 1_000,
          subjectMode: "credential-or-network",
          trustedProxyCount: 2,
        },
        routes: {},
      },
    });

    expect(text).toContain('ai_gateway_rate_limit_active_buckets{scope="global"} 5');
    expect(text).toContain('ai_gateway_rate_limit_store_available{mode="postgres"} 0');
    expect(text).toMatch(/ai_gateway_rate_limit_stats_age_seconds\{mode="postgres"\} 1\.\d{3}/);
    expect(text).toContain('ai_gateway_rate_limit_subject_mode{mode="credential-or-network"} 1');
    expect(text).toContain("ai_gateway_trusted_proxy_cidrs 2");
    expect(text).not.toContain("subject_hash");
  });
});
