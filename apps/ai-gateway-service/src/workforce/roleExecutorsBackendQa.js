/**
 * @module roleExecutorsBackendQa
 * @description Backend Engineer and QA role executor functions.
 */

import { buildRoleMeta, estimateConfidence } from "./roleExecutorHelpers.js";

// ---------------------------------------------------------------------------
// Backend Engineer Executor
// ---------------------------------------------------------------------------

/**
 * Generate Backend Engineer-level analysis.
 * @param {string} goal
 * @param {object} [context={}]
 * @returns {object}
 */
export function executeBackendAnalysis(goal, context = {}) {
  const confidence = estimateConfidence(context);

  const apiSpecs = [
    {
      method: "POST", path: "/v1/workflows", summary: "Create a new workflow definition",
      requestSchema: { body: { name: { type: "string", required: true, maxLength: 128 }, description: { type: "string", maxLength: 1024 }, steps: { type: "array", required: true, minItems: 1, maxItems: 50, items: { id: "uuid", name: "string", action: "enum[http_request,transform,condition,delay,notify]", config: "object" } }, config: { type: "object", properties: { maxRetries: { type: "integer", default: 3 }, timeoutSeconds: { type: "integer", default: 300 } } } } },
      responseSchema: { 201: { id: "uuid", name: "string", status: "draft", version: 1, createdAt: "ISO-8601" }, 400: { error: "VALIDATION_ERROR", details: "array" }, 409: { error: "DUPLICATE_NAME" } },
    },
    {
      method: "GET", path: "/v1/workflows", summary: "List workflows with pagination",
      requestSchema: { query: { page: { type: "integer", default: 1 }, limit: { type: "integer", default: 20, max: 100 }, status: { type: "string", enum: ["draft","active","archived"] }, search: { type: "string" } } },
      responseSchema: { 200: { data: "array<WorkflowSummary>", pagination: { page: "int", limit: "int", totalItems: "int", totalPages: "int" } } },
    },
    {
      method: "POST", path: "/v1/workflows/:id/execute", summary: "Trigger workflow execution",
      requestSchema: { params: { id: "uuid" }, headers: { "Idempotency-Key": "uuid (required)" }, body: { inputs: { type: "object" }, callbackUrl: { type: "uri", optional: true } } },
      responseSchema: { 202: { executionId: "uuid", status: "queued", queuedAt: "ISO-8601" }, 404: { error: "NOT_FOUND" }, 429: { error: "RATE_LIMITED", retryAfter: "int" } },
    },
  ];

  const databaseSchema = {
    tables: [
      {
        name: "workflows", description: "Workflow definitions",
        columns: [
          { name: "id", type: "UUID", constraints: "PK, DEFAULT gen_random_uuid()" },
          { name: "tenant_id", type: "UUID", constraints: "NOT NULL, FK tenants" },
          { name: "name", type: "VARCHAR(128)", constraints: "NOT NULL" },
          { name: "description", type: "TEXT", constraints: "NULLABLE" },
          { name: "steps", type: "JSONB", constraints: "NOT NULL, DEFAULT '[]'" },
          { name: "config", type: "JSONB", constraints: "NOT NULL, DEFAULT '{}'" },
          { name: "status", type: "VARCHAR(20)", constraints: "NOT NULL, DEFAULT 'draft'" },
          { name: "version", type: "INTEGER", constraints: "NOT NULL, DEFAULT 1" },
          { name: "created_by", type: "UUID", constraints: "NOT NULL, FK users" },
          { name: "created_at", type: "TIMESTAMPTZ", constraints: "NOT NULL, DEFAULT now()" },
          { name: "updated_at", type: "TIMESTAMPTZ", constraints: "NOT NULL, DEFAULT now()" },
        ],
        indexes: [
          { name: "idx_workflows_tenant_status", columns: ["tenant_id", "status"] },
          { name: "idx_workflows_tenant_name", columns: ["tenant_id", "name"], unique: true },
        ],
      },
      {
        name: "workflow_executions", description: "Execution records",
        columns: [
          { name: "id", type: "UUID", constraints: "PK, DEFAULT gen_random_uuid()" },
          { name: "workflow_id", type: "UUID", constraints: "NOT NULL, FK workflows" },
          { name: "tenant_id", type: "UUID", constraints: "NOT NULL" },
          { name: "status", type: "VARCHAR(20)", constraints: "NOT NULL (queued|running|completed|failed|cancelled)" },
          { name: "inputs", type: "JSONB", constraints: "NOT NULL, DEFAULT '{}'" },
          { name: "outputs", type: "JSONB", constraints: "NULLABLE" },
          { name: "idempotency_key", type: "UUID", constraints: "UNIQUE" },
          { name: "started_at", type: "TIMESTAMPTZ", constraints: "NULLABLE" },
          { name: "completed_at", type: "TIMESTAMPTZ", constraints: "NULLABLE" },
          { name: "created_at", type: "TIMESTAMPTZ", constraints: "NOT NULL, DEFAULT now()" },
        ],
        indexes: [
          { name: "idx_exec_workflow_status", columns: ["workflow_id", "status"] },
          { name: "idx_exec_tenant_created", columns: ["tenant_id", "created_at"] },
          { name: "idx_exec_idempotency", columns: ["idempotency_key"], unique: true },
        ],
      },
      {
        name: "audit_events", description: "Immutable audit log",
        columns: [
          { name: "id", type: "BIGSERIAL", constraints: "PK" },
          { name: "tenant_id", type: "UUID", constraints: "NOT NULL" },
          { name: "actor_id", type: "UUID", constraints: "NOT NULL" },
          { name: "action", type: "VARCHAR(64)", constraints: "NOT NULL" },
          { name: "resource_type", type: "VARCHAR(64)", constraints: "NOT NULL" },
          { name: "resource_id", type: "UUID", constraints: "NOT NULL" },
          { name: "payload", type: "JSONB", constraints: "NOT NULL" },
          { name: "created_at", type: "TIMESTAMPTZ", constraints: "NOT NULL, DEFAULT now()" },
        ],
        indexes: [
          { name: "idx_audit_tenant_resource", columns: ["tenant_id", "resource_type", "resource_id"] },
        ],
        partitioning: "RANGE (created_at) — monthly partitions",
      },
    ],
    migrations: [
      { version: "001", description: "Create workflows table", reversible: true },
      { version: "002", description: "Create workflow_executions table", reversible: true },
      { version: "003", description: "Create audit_events table with partitioning", reversible: true },
      { version: "004", description: "Add RLS policies for tenant isolation", reversible: true },
    ],
  };

  const serviceDesign = {
    services: [
      { name: "WorkflowService", responsibility: "Business logic for workflow CRUD and lifecycle", methods: ["createWorkflow(tenantId, userId, data)", "getWorkflow(tenantId, id)", "listWorkflows(tenantId, filters, pagination)", "updateWorkflow(tenantId, id, data)", "archiveWorkflow(tenantId, id)"] },
      { name: "ExecutionService", responsibility: "Execution lifecycle — queue, run, complete, fail", methods: ["executeWorkflow(tenantId, workflowId, inputs, idempotencyKey)", "getExecution(tenantId, id)", "cancelExecution(tenantId, id)", "retryExecution(tenantId, id, fromStepId)"] },
      { name: "StepExecutor", responsibility: "Dispatch individual steps by action type", methods: ["execute(step, context)", "retry(step, context, attempt)", "rollback(step, context)"] },
    ],
    repositories: [
      { name: "WorkflowRepository", table: "workflows" },
      { name: "ExecutionRepository", table: "workflow_executions" },
      { name: "AuditRepository", table: "audit_events" },
    ],
    middleware: [
      { name: "authenticate", purpose: "Validate JWT and attach user context" },
      { name: "authorize", purpose: "Check role-based permissions" },
      { name: "tenantScope", purpose: "Inject tenant_id and enforce isolation" },
      { name: "rateLimiter", purpose: "Per-tenant sliding window rate limit" },
      { name: "requestLogger", purpose: "Log request/response with correlation ID" },
      { name: "validateBody", purpose: "Schema validation via Zod" },
    ],
  };

  const validationRules = {
    inputValidation: [
      { field: "workflow.name", rules: ["Required", "1-128 chars", "Trimmed whitespace", "Unique per tenant"] },
      { field: "workflow.steps", rules: ["Required", "1-50 items", "Unique step IDs", "At least one entry point"] },
      { field: "steps[].action", rules: ["Required", "Enum: http_request|transform|condition|delay|notify"] },
      { field: "execution.inputs", rules: ["Optional", "Valid JSON object", "Max 1 MB"] },
    ],
    businessRules: [
      "Workflow must have >= 1 step before activation",
      "Cannot delete workflow with active executions",
      "Step graph must be valid DAG (no cycles)",
      "Cannot execute a draft workflow",
      "Idempotency key unique across all executions per workflow",
      "Tenant cannot exceed concurrent execution limit",
    ],
  };

  const integrationPoints = [
    { name: "Notification Service", type: "message-queue", protocol: "Kafka", topic: "workflow-notifications", description: "Publish completion/failure events" },
    { name: "External HTTP Endpoints", type: "http", protocol: "HTTPS", description: "http_request steps invoke external APIs with timeouts/retries" },
    { name: "Audit Logging", type: "message-queue", protocol: "Kafka", topic: "audit-events", description: "All state changes emit audit events" },
    { name: "Callback Webhooks", type: "http", protocol: "HTTPS", description: "POST results to callbackUrl with HMAC-SHA256 signature" },
  ];

  const cachingStrategy = [
    { layer: "Redis", target: "Workflow definitions", ttl: "5 min", invalidation: "On update/archive via Pub/Sub", hitRate: "85-90%" },
    { layer: "Redis", target: "User permissions", ttl: "10 min", invalidation: "On role change from auth service", hitRate: "95%+" },
    { layer: "CDN", target: "Static frontend assets", ttl: "1 year (content-hashed)", invalidation: "Cache-bust via filename", hitRate: "99%+" },
    { layer: "PostgreSQL", target: "Dashboard metrics", ttl: "Materialized view, 60s refresh", invalidation: "Scheduled + on-demand", hitRate: "N/A" },
  ];

  const errorHandling = {
    strategy: "Layered error handling with structured responses and logging",
    layers: [
      { layer: "Controller", approach: "Catch unhandled errors; return standardised response with requestId", responseFormat: "{ error, message, requestId, timestamp }" },
      { layer: "Service", approach: "Domain exceptions mapped to HTTP status codes", logging: "Structured JSON with correlationId, tenantId, userId, operation" },
      { layer: "Repository", approach: "DB errors wrapped; unique violations -> 409; connection errors -> circuit breaker", logging: "Query time at DEBUG; slow queries (>500ms) at WARN" },
    ],
    logging: {
      format: "Structured JSON (pino)",
      levels: { ERROR: "Unhandled exceptions", WARN: "Degraded ops and slow queries", INFO: "Request lifecycle", DEBUG: "Diagnostic detail" },
      correlationId: "X-Request-Id propagated through all layers",
      sensitiveDataPolicy: "PII and credentials redacted; request bodies masked",
    },
  };

  return { roleMeta: buildRoleMeta("backend-engineer", goal, confidence), apiSpecs, databaseSchema, serviceDesign, validationRules, integrationPoints, cachingStrategy, errorHandling };
}

// ---------------------------------------------------------------------------
// QA Executor
// ---------------------------------------------------------------------------

/**
 * Generate QA-level test and verification analysis.
 * @param {string} goal
 * @param {object} [context={}]
 * @returns {object}
 */
export function executeQAAnalysis(goal, context = {}) {
  const confidence = estimateConfidence(context);

  const testStrategy = {
    overview: "Testing pyramid: heavy unit coverage, targeted integration, focused E2E at the top.",
    layers: [
      { layer: "Unit Tests", coverage: ">= 80% line coverage", tools: ["Vitest", "testing-library"], scope: "Functions, validators, transformers, utilities", execTime: "< 30s", env: "Isolated; no DB or network; mocks for externals" },
      { layer: "Integration Tests", coverage: "All API endpoints and DB operations", tools: ["Vitest", "Supertest", "testcontainers"], scope: "Request/response cycles, DB CRUD, message publishing", execTime: "< 3 min", env: "Dockerised PostgreSQL, Redis, Kafka" },
      { layer: "End-to-End Tests", coverage: "Critical user journeys (happy path + top 3 error paths)", tools: ["Playwright"], scope: "Full stack from browser to DB", execTime: "< 15 min", env: "Dedicated E2E environment with seeded data" },
      { layer: "Performance Tests", coverage: "All public endpoints under load", tools: ["k6", "Grafana"], scope: "Latency percentiles, throughput, error rates", execTime: "30-60 min", env: "Production-like with realistic data" },
    ],
  };

  const testCases = [
    {
      id: "TC-001", title: "Create workflow with valid data succeeds", priority: "critical", type: "integration",
      given: "An authenticated user with 'editor' role and valid tenant context",
      when: "User sends POST /v1/workflows with valid name and 3 workflow steps",
      then: ["Response status 201", "Body contains id, name, status='draft', version=1", "Record persisted with correct tenant_id", "Audit event emitted with action='workflow.created'"],
    },
    {
      id: "TC-002", title: "Create workflow with duplicate name rejected", priority: "high", type: "integration",
      given: "An authenticated user and existing workflow named 'Payroll Processing' in same tenant",
      when: "User sends POST /v1/workflows with name='Payroll Processing'",
      then: ["Response status 409", "Body contains error='DUPLICATE_NAME'", "No new record created", "Audit event emitted with action='workflow.create_failed'"],
    },
    {
      id: "TC-003", title: "Circular step graph rejected", priority: "high", type: "unit",
      given: "Workflow definition where Step A -> B -> C -> A (circular)",
      when: "Step graph validator processes the definition",
      then: ["Validation error indicating circular dependency", "Error identifies the specific cyclic steps", "Workflow status remains 'draft'"],
    },
  ];

  const regressionPlan = {
    approach: "Automated regression suite on every PR merge and nightly against staging",
    categories: [
      { category: "Auth & Authorisation", testCount: 24, description: "JWT validation, RBAC, tenant isolation, token expiry", frequency: "Every PR" },
      { category: "Workflow CRUD", testCount: 36, description: "Create, read, update, archive with various data shapes", frequency: "Every PR" },
      { category: "Execution Engine", testCount: 42, description: "Step execution, error recovery, retry, timeout, cancellation", frequency: "Every PR" },
      { category: "Data Integrity", testCount: 18, description: "Concurrency, race conditions, transaction rollback, idempotency", frequency: "Nightly" },
      { category: "Notifications", testCount: 12, description: "Event publishing, delivery, template rendering", frequency: "Nightly" },
    ],
    totalTests: 132,
    estimatedTime: "8 min (parallelised across 4 workers)",
  };

  const edgeCases = [
    { id: "EC-001", scenario: "Workflow with exactly 50 steps (max)", expected: "Accepted; all steps executable" },
    { id: "EC-002", scenario: "1 MB input payload (max)", expected: "Accepted; payload stored and accessible" },
    { id: "EC-003", scenario: "100 concurrent executions of same workflow", expected: "All complete; concurrency limit enforced with 429s" },
    { id: "EC-004", scenario: "Step timeout at exact boundary", expected: "Marked timed out; failure handler triggered; no zombie" },
    { id: "EC-005", scenario: "Unicode in workflow name", expected: "Stored correctly; search/filter work with unicode" },
    { id: "EC-006", scenario: "Simultaneous archive + execute on same workflow", expected: "One succeeds, one fails gracefully; no inconsistent state" },
    { id: "EC-007", scenario: "DB connection pool exhaustion", expected: "Requests queue; 503 after queue timeout" },
  ];

  const performanceTests = [
    { scenario: "Sustained Load", description: "100 users creating/executing workflows for 30 min", criteria: ["p95 < 300ms", "Error rate < 0.1%", "Throughput >= 50 req/s"] },
    { scenario: "Spike Test", description: "10x traffic for 5 min then return to baseline", criteria: ["Auto-scale within 2 min", "No request loss", "Baseline restored in 5 min"] },
    { scenario: "Soak Test", description: "50 users for 4 hours", criteria: ["Stable memory", "No connection leaks", "GC pauses < 100ms"] },
    { scenario: "DB Stress", description: "1000 concurrent reads + 100 writes", criteria: ["Read p95 < 50ms", "Write p95 < 200ms", "No deadlocks"] },
  ];

  const securityTests = [
    { id: "ST-001", test: "SQL Injection via workflow name", method: "sqlmap + manual", expected: "All inputs parameterised; no injection possible" },
    { id: "ST-002", test: "XSS in workflow description", method: "OWASP ZAP + manual", expected: "Output encoded; no script execution" },
    { id: "ST-003", test: "IDOR on workflow ID", method: "Multiple tenant tokens", expected: "404 for cross-tenant access" },
    { id: "ST-004", test: "Expired JWT handling", method: "Token rotation test", expected: "401 returned; no data leakage" },
    { id: "ST-005", test: "SSRF in http_request step", method: "Internal IP targets", expected: "Internal IPs blocked; DNS rebinding protection" },
  ];

  const acceptanceMatrix = [
    { requirement: "Create a workflow", userStory: "US-001", testCases: ["TC-001", "TC-002"], verified: false },
    { requirement: "Execute a workflow", userStory: "US-001", testCases: ["TC-EXEC-001", "TC-EXEC-002"], verified: false },
    { requirement: "Real-time dashboard", userStory: "US-002", testCases: ["TC-E2E-001"], verified: false },
    { requirement: "Completion notifications", userStory: "US-003", testCases: ["TC-INT-005"], verified: false },
    { requirement: "RBAC enforcement", userStory: "US-004", testCases: ["TC-AUTH-001", "TC-AUTH-002"], verified: false },
    { requirement: "Audit logging", userStory: "US-004", testCases: ["TC-AUDIT-001"], verified: false },
    { requirement: "Performance targets", userStory: "NFR", testCases: ["PT-001", "PT-002"], verified: false },
    { requirement: "Security review pass", userStory: "NFR", testCases: ["ST-001", "ST-002", "ST-003"], verified: false },
  ];

  return { roleMeta: buildRoleMeta("qa", goal, confidence), testStrategy, testCases, regressionPlan, edgeCases, performanceTests, securityTests, acceptanceMatrix };
}
