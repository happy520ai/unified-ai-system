// Extracted verbatim from the assembly root (createGatewayApplication.js) so
// the agent governance configuration cluster lives beside its sibling
// agent-governance modules. Pure mechanical move; behaviour is unchanged.
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertRegistryAuthorityModeSync,
  computeSignedJsonRegistryDigestSync,
  readRegistryAuthoritySwitchMarkerSync,
} from "../agent-governance/registryAuthoritySwitch.ts";
import { createSqliteAgentRegistryStore } from "../agent-governance/sqliteAgentRegistryStore.ts";
import { createPostgresAgentRegistryStore } from "../agent-governance/postgresAgentRegistryStore.ts";

const repoRoot = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));

const SUPPORTED_AGENT_GOVERNANCE_HIGH_RISK_TOOLS = new Set(["git_push", "git_create_pr"]);

export function resolveAgentGovernanceRuntimeConfiguration(env) {
  const setting = String(env.AI_GATEWAY_AGENT_GOVERNANCE_ENABLED ?? "").trim().toLowerCase();
  if (setting && setting !== "true" && setting !== "false") {
    const error = new Error("AI_GATEWAY_AGENT_GOVERNANCE_ENABLED must be true or false when configured.");
    error.code = "AGENT_GOVERNANCE_CONFIGURATION_INVALID";
    error.category = "configuration";
    throw error;
  }
  const multiRaw = String(env.AI_GATEWAY_MULTI_INSTANCE ?? "").trim().toLowerCase();
  if (multiRaw && !new Set(["true", "1", "false", "0"]).has(multiRaw)) {
    const error = new Error("AI_GATEWAY_MULTI_INSTANCE must be true or false when configured.");
    error.code = "AGENT_GOVERNANCE_CONFIGURATION_INVALID";
    error.category = "configuration";
    throw error;
  }
  const multiInstance = multiRaw === "true" || multiRaw === "1";
  // Governance changes the contract of execution-bearing routes (Agent Exec,
  // reverse MCP, controlled Workforce and Forge). Keep it an explicit opt-in
  // so an upgrade cannot silently turn existing legacy callers into governed
  // callers that suddenly require a server-issued agentId.
  const enabled = setting === "true";
  const configuredTools = String(env.AI_GATEWAY_AGENT_GOVERNANCE_HIGH_RISK_TOOLS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const highRiskTools = Object.freeze(Array.from(new Set(configuredTools)));
  const unknown = highRiskTools.filter((toolName) => !SUPPORTED_AGENT_GOVERNANCE_HIGH_RISK_TOOLS.has(toolName));
  if (unknown.length > 0) {
    const error = new Error(`Unsupported Agent Governance high-risk tool(s): ${unknown.join(", ")}.`);
    error.code = "AGENT_GOVERNANCE_HIGH_RISK_TOOL_UNSUPPORTED";
    error.category = "configuration";
    throw error;
  }
  if (highRiskTools.length > 0 && !enabled) {
    const error = new Error("High-risk Agent tools require Agent Governance to be enabled.");
    error.code = "AGENT_GOVERNANCE_HIGH_RISK_REQUIRES_GOVERNANCE";
    error.category = "configuration";
    throw error;
  }
  if (enabled && multiInstance) {
    const error = new Error(
      "Agent Governance requires a transactional shared-state backend before multi-instance mode can be enabled.",
    );
    error.code = "AGENT_GOVERNANCE_MULTI_INSTANCE_UNSUPPORTED";
    error.category = "configuration";
    throw error;
  }
  const proposerSetting = String(
    env.AI_GATEWAY_AGENT_GOVERNANCE_MODEL_PROPOSER_ENABLED ?? "",
  ).trim().toLowerCase();
  if (proposerSetting && proposerSetting !== "true" && proposerSetting !== "false") {
    const error = new Error(
      "AI_GATEWAY_AGENT_GOVERNANCE_MODEL_PROPOSER_ENABLED must be true or false when configured.",
    );
    error.code = "AGENT_GOVERNANCE_CONFIGURATION_INVALID";
    error.category = "configuration";
    throw error;
  }
  const modelProposerEnabled = proposerSetting === "true";
  if (modelProposerEnabled && !enabled) {
    const error = new Error("Agent model proposal requires Agent Governance to be enabled.");
    error.code = "AGENT_GOVERNANCE_MODEL_PROPOSER_REQUIRES_GOVERNANCE";
    error.category = "configuration";
    throw error;
  }
  const proposerProviderId = String(
    env.AI_GATEWAY_AGENT_GOVERNANCE_MODEL_PROPOSER_PROVIDER_ID ?? "",
  ).trim();
  const proposerModelId = String(
    env.AI_GATEWAY_AGENT_GOVERNANCE_MODEL_PROPOSER_MODEL_ID ?? "",
  ).trim();
  if (modelProposerEnabled && !proposerProviderId) {
    const error = new Error(
      "AI_GATEWAY_AGENT_GOVERNANCE_MODEL_PROPOSER_PROVIDER_ID is required when model proposal is enabled.",
    );
    error.code = "AGENT_GOVERNANCE_MODEL_PROPOSER_PROVIDER_REQUIRED";
    error.category = "configuration";
    throw error;
  }
  return Object.freeze({
    enabled,
    multiInstance,
    highRiskTools,
    healthCheckIntervalMs: strictRegistryInteger(
      env.AI_GATEWAY_AGENT_GOVERNANCE_HEALTH_CHECK_INTERVAL_MS,
      60_000,
      1_000,
      300_000,
      "AI_GATEWAY_AGENT_GOVERNANCE_HEALTH_CHECK_INTERVAL_MS",
    ),
    modelProposer: Object.freeze({
      enabled: modelProposerEnabled,
      providerId: proposerProviderId,
      modelId: proposerModelId || undefined,
    }),
  });
}

export function resolveAgentGovernanceRegistryConfiguration(env, repositoryRoot, dataDir) {
  const mode = String(
    env.AI_GATEWAY_AGENT_GOVERNANCE_REGISTRY_STORE_MODE ?? "json",
  ).trim().toLowerCase();
  if (mode !== "json" && mode !== "sqlite" && mode !== "postgres") {
    const error = new Error(
      "AI_GATEWAY_AGENT_GOVERNANCE_REGISTRY_STORE_MODE must be json, sqlite, or postgres.",
    );
    error.code = "AGENT_GOVERNANCE_REGISTRY_CONFIGURATION_INVALID";
    error.category = "configuration";
    throw error;
  }
  const postgresConfigured = [
    "AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_URL",
    "AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_URL_FILE",
    "AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_NAMESPACE",
    "AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_AUTHORITY_ID",
    "AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_TLS_REQUIRED",
    "AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_POOL_MAX",
    "AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_STATEMENT_TIMEOUT_MS",
    "AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_MINIMUM_REVISION",
    "AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_TRUSTED_HEAD_HASH",
  ].some((name) => String(env[name] ?? "").trim() !== "");
  const configuredPath = String(env.AI_GATEWAY_AGENT_GOVERNANCE_SQLITE_PATH ?? "").trim();
  const sqlitePath = configuredPath
    ? (isAbsolute(configuredPath) ? configuredPath : resolve(repositoryRoot, configuredPath))
    : resolve(dataDir, "agent-registry.sqlite");
  const configuredCheckpoint = String(
    env.AI_GATEWAY_AGENT_GOVERNANCE_SQLITE_CHECKPOINT_PATH ?? "",
  ).trim();
  const sqliteCheckpointPath = configuredCheckpoint
    ? (isAbsolute(configuredCheckpoint)
      ? configuredCheckpoint
      : resolve(repositoryRoot, configuredCheckpoint))
    : resolve(dirname(sqlitePath), "agent-registry.checkpoint.json");
  const sqliteConfigured = Boolean(configuredPath
    || configuredCheckpoint
    || String(env.AI_GATEWAY_AGENT_GOVERNANCE_HOST_ID ?? "").trim()
    || String(env.AI_GATEWAY_AGENT_GOVERNANCE_SQLITE_BUSY_TIMEOUT_MS ?? "").trim());

  if (mode === "json") {
    if (postgresConfigured || sqliteConfigured || existsSync(sqlitePath) || existsSync(sqliteCheckpointPath)) {
      throw agentGovernanceRegistryConfigurationError(
        "AGENT_GOVERNANCE_REGISTRY_CONFIGURATION_CONFLICT",
        "Database Agent Registry configuration or artifacts require an explicit non-JSON authority mode.",
      );
    }
    return Object.freeze({ mode: "json", authorityBinding: "signed-json-v1" });
  }

  if (mode === "sqlite") {
    if (postgresConfigured) {
      throw agentGovernanceRegistryConfigurationError(
        "AGENT_GOVERNANCE_REGISTRY_CONFIGURATION_CONFLICT",
        "SQLite and PostgreSQL Agent Registry configuration cannot be combined.",
      );
    }
    const hostId = String(env.AI_GATEWAY_AGENT_GOVERNANCE_HOST_ID ?? "").trim();
    if (!hostId || hostId.length > 256 || /[\u0000-\u001f\u007f]/u.test(hostId)) {
      throw agentGovernanceRegistryConfigurationError(
        "AGENT_GOVERNANCE_REGISTRY_CONFIGURATION_INVALID",
        "SQLite Agent Registry requires a stable bounded AI_GATEWAY_AGENT_GOVERNANCE_HOST_ID.",
      );
    }
    assertAgentGovernanceRegistryPath(dataDir, sqlitePath, "SQLite database");
    assertAgentGovernanceRegistryPath(dataDir, sqliteCheckpointPath, "SQLite checkpoint");
    if (sqlitePath === sqliteCheckpointPath) {
      throw agentGovernanceRegistryConfigurationError(
        "AGENT_GOVERNANCE_REGISTRY_CONFIGURATION_INVALID",
        "SQLite Agent Registry database and checkpoint paths must differ.",
      );
    }
    return Object.freeze({
      mode: "sqlite",
      sqlitePath,
      checkpointPath: sqliteCheckpointPath,
      hostId,
      busyTimeoutMs: strictRegistryInteger(
        env.AI_GATEWAY_AGENT_GOVERNANCE_SQLITE_BUSY_TIMEOUT_MS,
        5_000,
        100,
        30_000,
        "AI_GATEWAY_AGENT_GOVERNANCE_SQLITE_BUSY_TIMEOUT_MS",
      ),
    });
  }

  if (sqliteConfigured || existsSync(sqlitePath) || existsSync(sqliteCheckpointPath)) {
    throw agentGovernanceRegistryConfigurationError(
      "AGENT_GOVERNANCE_REGISTRY_CONFIGURATION_CONFLICT",
      "PostgreSQL and SQLite Agent Registry configuration or artifacts cannot be combined.",
    );
  }
  if (String(env.AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_URL_FILE ?? "").trim()) {
    throw agentGovernanceRegistryConfigurationError(
      "AGENT_GOVERNANCE_REGISTRY_POSTGRES_URL_FILE_UNSUPPORTED",
      "PostgreSQL Agent Registry URL-file loading is not enabled; inject the URL through a protected runtime secret.",
    );
  }
  const connectionString = String(env.AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_URL ?? "").trim();
  const namespace = String(env.AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_NAMESPACE ?? "default").trim();
  const authorityId = String(env.AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_AUTHORITY_ID ?? "").trim();
  if (!connectionString || !/^[A-Za-z0-9_.:-]{1,128}$/u.test(namespace)
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(authorityId)) {
    throw agentGovernanceRegistryConfigurationError(
      "AGENT_GOVERNANCE_REGISTRY_CONFIGURATION_INVALID",
      "PostgreSQL Agent Registry requires a URL, bounded namespace, and stable authority UUID.",
    );
  }
  assertSecureAgentGovernancePostgresUrl(connectionString, env);
  const minimumRevisionRaw = String(
    env.AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_MINIMUM_REVISION ?? "",
  ).trim();
  const trustedHeadHash = String(
    env.AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_TRUSTED_HEAD_HASH ?? "",
  ).trim().toLowerCase();
  if (Boolean(minimumRevisionRaw) !== Boolean(trustedHeadHash)) {
    throw agentGovernanceRegistryConfigurationError(
      "AGENT_GOVERNANCE_REGISTRY_CONFIGURATION_INVALID",
      "PostgreSQL rollback floor revision and trusted head hash must be configured together.",
    );
  }
  const externalCheckpointFloor = minimumRevisionRaw
    ? Object.freeze({
      minimumRevision: strictRegistryInteger(
        minimumRevisionRaw,
        0,
        0,
        Number.MAX_SAFE_INTEGER,
        "AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_MINIMUM_REVISION",
      ),
      trustedHeadHash,
    })
    : undefined;
  if (externalCheckpointFloor && !/^[a-f0-9]{64}$/u.test(externalCheckpointFloor.trustedHeadHash)) {
    throw agentGovernanceRegistryConfigurationError(
      "AGENT_GOVERNANCE_REGISTRY_CONFIGURATION_INVALID",
      "PostgreSQL rollback floor head hash must be a canonical SHA-256/HMAC digest.",
    );
  }
  return Object.freeze({
    mode: "postgres",
    connectionString,
    namespace,
    authorityId,
    poolMax: strictRegistryInteger(
      env.AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_POOL_MAX,
      4,
      1,
      64,
      "AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_POOL_MAX",
    ),
    statementTimeoutMs: strictRegistryInteger(
      env.AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_STATEMENT_TIMEOUT_MS,
      5_000,
      100,
      60_000,
      "AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_STATEMENT_TIMEOUT_MS",
    ),
    externalCheckpointFloor,
  });
}

export function createConfiguredAgentGovernanceRegistryStore({ configuration, dataDir, secret }) {
  if (configuration.mode === "json") {
    assertRegistryAuthorityModeSync({ dataDir, secret, mode: "json" });
    return null;
  }
  if (configuration.mode === "sqlite") {
    const sourceDigest = computeSignedJsonRegistryDigestSync(dataDir);
    const marker = readRegistryAuthoritySwitchMarkerSync({ dataDir, secret });
    if (sourceDigest && !marker) {
      throw agentGovernanceRegistryConfigurationError(
        "AGENT_REGISTRY_AUTHORITY_SWITCH_REQUIRED",
        "Run the verified offline JSON-to-SQLite migration before selecting SQLite authority.",
      );
    }
    if (marker && (!sourceDigest
      || !existsSync(configuration.sqlitePath)
      || !existsSync(configuration.checkpointPath))) {
      throw agentGovernanceRegistryConfigurationError(
        "AGENT_REGISTRY_AUTHORITY_TARGET_UNAVAILABLE",
        "The authenticated SQLite authority switch exists but its exact source or target is unavailable.",
      );
    }
    const store = createSqliteAgentRegistryStore({
      sqlitePath: configuration.sqlitePath,
      checkpointPath: configuration.checkpointPath,
      hostId: configuration.hostId,
      hmacSecret: secret,
      busyTimeoutMs: configuration.busyTimeoutMs,
    });
    const health = store.getHealth();
    try {
      assertRegistryAuthorityModeSync({
        dataDir,
        secret,
        mode: "sqlite",
        target: {
          authorityProtocol: store.getAuthorityProtocol(),
          authorityBinding: store.getAuthorityBinding(),
          recordCount: health.recordCount,
          sqliteSchemaVersion: health.schemaVersion,
        },
      });
      return store;
    } catch (error) {
      void store.close();
      throw error;
    }
  }
  if (computeSignedJsonRegistryDigestSync(dataDir)
    || readRegistryAuthoritySwitchMarkerSync({ dataDir, secret })) {
    throw agentGovernanceRegistryConfigurationError(
      "AGENT_GOVERNANCE_REGISTRY_POSTGRES_MIGRATION_REQUIRED",
      "PostgreSQL Registry startup requires a fresh governance installation or an explicit migration.",
    );
  }
  return createPostgresAgentRegistryStore({
    connectionString: configuration.connectionString,
    namespace: configuration.namespace,
    authorityId: configuration.authorityId,
    integritySecret: secret,
    poolMax: configuration.poolMax,
    statementTimeoutMs: configuration.statementTimeoutMs,
    externalCheckpointFloor: configuration.externalCheckpointFloor,
  });
}

function assertAgentGovernanceRegistryPath(dataDir, candidate, label) {
  const base = resolve(dataDir);
  const target = resolve(candidate);
  const relation = relative(base, target);
  if (relation === "" || relation === ".." || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    throw agentGovernanceRegistryConfigurationError(
      "AGENT_GOVERNANCE_REGISTRY_PATH_UNSAFE",
      `${label} must stay inside the protected Agent Governance data directory.`,
    );
  }
}

function assertSecureAgentGovernancePostgresUrl(connectionString, env) {
  let url;
  try { url = new URL(connectionString); }
  catch {
    throw agentGovernanceRegistryConfigurationError(
      "AGENT_GOVERNANCE_REGISTRY_POSTGRES_URL_INVALID",
      "The PostgreSQL Agent Registry URL is invalid.",
    );
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw agentGovernanceRegistryConfigurationError(
      "AGENT_GOVERNANCE_REGISTRY_POSTGRES_URL_INVALID",
      "The Agent Registry database URL must use PostgreSQL.",
    );
  }
  const hostname = url.hostname.toLowerCase();
  const loopback = hostname === "localhost" || hostname === "::1"
    || hostname === "[::1]" || /^127(?:\.[0-9]{1,3}){3}$/u.test(hostname);
  const tlsRequired = strictAgentGovernanceBoolean(
    env.AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_TLS_REQUIRED,
    true,
    "AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_TLS_REQUIRED",
  );
  if (loopback) return;
  const sslMode = String(url.searchParams.get("sslmode") ?? env.PGSSLMODE ?? "").trim().toLowerCase();
  if (!tlsRequired || sslMode !== "verify-full") {
    throw agentGovernanceRegistryConfigurationError(
      "AGENT_GOVERNANCE_REGISTRY_POSTGRES_TLS_VERIFY_REQUIRED",
      "A non-loopback PostgreSQL Agent Registry must use sslmode=verify-full.",
    );
  }
}

function strictAgentGovernanceBoolean(value, fallback, name) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw agentGovernanceRegistryConfigurationError(
    "AGENT_GOVERNANCE_REGISTRY_CONFIGURATION_INVALID",
    `${name} must be true or false when configured.`,
  );
}

function agentGovernanceRegistryConfigurationError(code, message) {
  return Object.assign(new Error(message), { code, category: "configuration" });
}

function strictRegistryInteger(value, fallback, minimum, maximum, name) {
  const raw = String(value ?? "").trim();
  const parsed = raw ? Number(raw) : fallback;
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    const error = new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
    error.code = "AGENT_GOVERNANCE_REGISTRY_CONFIGURATION_INVALID";
    error.category = "configuration";
    throw error;
  }
  return parsed;
}

export function resolveAgentExecWorkingDirectory(env) {
  const configured = String(env.AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY ?? "").trim();
  const candidate = configured
    ? (isAbsolute(configured) ? configured : resolve(repoRoot, configured))
    : repoRoot;
  try {
    const stats = lstatSync(candidate);
    if (!stats.isDirectory()) throw new Error("not a directory");
    return realpathSync.native(candidate);
  } catch (cause) {
    const error = new Error("AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY must resolve to an existing directory.");
    error.code = "AGENT_EXEC_WORKING_DIRECTORY_INVALID";
    error.category = "configuration";
    error.cause = cause;
    throw error;
  }
}
