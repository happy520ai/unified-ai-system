// =============================================================================
// cli-local-client.js — 本地客户端命令簇
//
// 从 cli-core.js 机械拆出（T-073 延续）：runClients / runLocalClientLifecycle /
// runClientsOnboarding 及其全部 projection/render/validator 助手与两个错误类。
// 行为不变：cli-core.js 以同名导入回这些符号，公开入口与测试面完全一致。
// =============================================================================

import { closeSync, fstatSync, lstatSync, openSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { createGatewayClient } from "@unified-ai-system/shared-sdk";
import { CliUsageError } from "./cli-errors.js";
import {
  LOCAL_CLIENT_CAPABILITY_PATTERN,
  LOCAL_CLIENT_DECLARATION_PATTERN,
  LOCAL_CLIENT_DISABLE_REASONS,
  LOCAL_CLIENT_ID_PATTERN,
  LOCAL_CLIENT_LIFECYCLE_ALWAYS_MUTATING,
  LOCAL_CLIENT_LIFECYCLE_SUBCOMMANDS,
  LOCAL_CLIENT_ONBOARDING_CERTIFICATION,
  LOCAL_CLIENT_ONBOARDING_MUTATIONS,
  LOCAL_CLIENT_ONBOARDING_PLAN_ID_PATTERN,
  LOCAL_CLIENT_ONBOARDING_PROFILE_DEFINITIONS,
  LOCAL_CLIENT_ONBOARDING_PROFILE_IDS,
  LOCAL_CLIENT_ONBOARDING_RECEIPT_MAX_BYTES,
  LOCAL_CLIENT_ONBOARDING_REGISTRY_PLAN_ID_PATTERN,
  LOCAL_CLIENT_ONBOARDING_TRANSACTION_ID_PATTERN,
  LOCAL_CLIENT_REVOKE_REASONS,
  LOCAL_CLIENT_SEMVER_PATTERN,
  SAFE_LOCAL_CLIENT_LIFECYCLE_ERROR_CODES,
  SAFE_LOCAL_CLIENT_ONBOARDING_ERROR_CODES,
  SHA256_PATTERN,
  UNKNOWN_LOCAL_CLIENT_ONBOARDING_ERROR_CODES,
  localClientOnboardingProfileFormat,
} from "./cli-constants.js";
import { unwrapEnvelope } from "./cli-shared-helpers.js";

class CliOnboardingFailure extends Error {
  constructor(code, options = {}) {
    super(code);
    this.name = "CliOnboardingFailure";
    this.code = code;
    this.operation = options.operation ?? null;
    this.status = options.status ?? "rejected";
    this.retryAllowed = false;
    this.exitCode = 1;
  }
}

class CliLocalClientFailure extends Error {
  constructor(code, options = {}) {
    super(code);
    this.name = "CliLocalClientFailure";
    this.code = code;
    this.operation = options.operation ?? null;
    this.status = options.status ?? "rejected";
    this.mutation = options.mutation === true;
    this.retryAllowed = false;
    this.exitCode = 1;
  }
}

async function runClients(options, output) {
  if (!options.adminKey) {
    throw new CliUsageError(
      "The clients command requires an admin key.",
      { hint: "Pass --admin-key or set AGENT_CONSOLE_ADMIN_KEY." },
    );
  }
  if (options.positionals.length === 1) {
    return runLocalClientLifecycle(options, output);
  }

  const client = createGatewayClient({
    baseUrl: options.url,
    timeoutMs: options.timeoutMs,
    headers: { authorization: `Bearer ${options.adminKey}` },
  });
  const [statusResponse, registryResponse, onboarding] = await Promise.all([
    client.localClientsStatus(),
    client.localClients({ includeDisabled: true, limit: 100 }),
    loadLocalClientOnboarding(client),
  ]);
  const status = projectLocalClientStatus(unwrapEnvelope(statusResponse));
  const registry = projectLocalClientRegistry(unwrapEnvelope(registryResponse));
  const result = {
    ok: true,
    gatewayUrl: options.url,
    mode: status.executionEnabled === true ? "governed-execution" : "preview-only",
    status,
    registry,
    onboarding,
  };

  if (options.json) {
    output.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    output.write([
      "",
      output.bold("Local client management"),
      `Gateway: ${options.url}`,
      `Mode: ${result.mode}`,
      `Status: ${status.status ?? "unknown"}`,
      `Clients: ${registry.total ?? 0}`,
      "",
      status.executionEnabled === true
        ? output.yellow("Execution is enabled only through governed adapters.")
        : output.muted("Execution is preview-only; no local application action was performed."),
      "",
      ...renderLocalClientOnboarding(onboarding, output),
      "",
    ].join("\n"));
  }
  return 0;
}

function projectLocalClientStatus(value) {
  if (
    !isPlainRecord(value)
    || !new Set(["ready", "preview-ready", "degraded"]).has(value.status)
    || typeof value.executionEnabled !== "boolean"
    || !isPlainRecord(value.boundaries)
    || typeof value.boundaries.previewOnly !== "boolean"
    || value.boundaries.tenantScoped !== true
    || value.boundaries.observedApplicationsRoutable !== false
    || typeof value.boundaries.executionAdapterConfigured !== "boolean"
  ) {
    throw new Error("invalid local-client status response");
  }
  return Object.freeze({
    status: value.status,
    executionEnabled: value.executionEnabled,
    boundaries: Object.freeze({
      previewOnly: value.boundaries.previewOnly,
      tenantScoped: true,
      observedApplicationsRoutable: false,
      executionAdapterConfigured: value.boundaries.executionAdapterConfigured,
      ...(typeof value.boundaries.executionRequested === "boolean"
        ? { executionRequested: value.boundaries.executionRequested }
        : {}),
      ...(typeof value.boundaries.executionReady === "boolean"
        ? { executionReady: value.boundaries.executionReady }
        : {}),
      ...(typeof value.boundaries.executionMode === "string"
        && new Set(["ready", "preview-only", "blocked"]).has(value.boundaries.executionMode)
        ? { executionMode: value.boundaries.executionMode }
        : {}),
      ...(Array.isArray(value.boundaries.executionBlockers)
        ? { executionBlockers: Object.freeze(value.boundaries.executionBlockers.map(projectSafeLifecycleLabel)) }
        : {}),
    }),
  });
}

async function runLocalClientLifecycle(options, output) {
  const operation = options.positionals[0];
  const mutation = isLocalClientLifecycleMutation(options);
  const client = createGatewayClient({
    baseUrl: options.url,
    timeoutMs: options.timeoutMs,
    headers: { authorization: `Bearer ${options.adminKey}` },
  });

  try {
    let data;
    if (operation === "list") {
      data = projectLocalClientRegistry(unwrapEnvelope(await client.localClients({
        includeDisabled: options.lifecycleIncludeDisabled,
        limit: options.lifecycleLimit ?? 100,
        offset: options.lifecycleOffset ?? 0,
        capabilities: options.lifecycleCapabilities,
      })));
    } else if (operation === "inspect") {
      data = projectLocalClientInspection(
        unwrapEnvelope(await client.inspectLocalClient(options.lifecycleClientId)),
        options.lifecycleClientId,
      );
    } else if (operation === "discover") {
      const request = {
        dryRun: !options.lifecycleApply,
        ...(options.lifecycleMaxProcesses === null
          ? {}
          : { maxProcesses: options.lifecycleMaxProcesses }),
        ...(options.lifecycleIncludeUnknown ? { includeUnknown: true } : {}),
        ...(options.lifecycleIncludeSystemProcesses ? { includeSystemProcesses: true } : {}),
        ...(options.lifecycleIncludeMissingAsDisabled
          ? { includeMissingAsDisabled: true }
          : {}),
        ...(options.lifecycleAutoDiscoverAll ? { autoDiscoverAll: true } : {}),
      };
      data = projectLocalClientDiscovery(
        unwrapEnvelope(await client.discoverLocalClients(request)),
        request,
      );
    } else if (operation === "register") {
      const adapterBinding = options.lifecycleAdapterId === null
        ? {}
        : {
            adapterId: options.lifecycleAdapterId,
            adapterType: options.lifecycleAdapterType,
            adapterVersion: options.lifecycleAdapterVersion,
            manifestSha256: options.lifecycleManifestSha256,
          };
      const request = {
        clientId: options.lifecycleClientId,
        ...(options.lifecycleDisplayName === null
          ? {}
          : { displayName: options.lifecycleDisplayName }),
        capabilityIds: options.lifecycleCapabilities,
        ...adapterBinding,
        ...(options.lifecycleProtocolVersion === null
          ? {}
          : { protocolVersion: options.lifecycleProtocolVersion }),
      };
      data = projectLocalClientMutationResult(
        unwrapEnvelope(await client.registerLocalClient(request)),
        operation,
        options.lifecycleClientId,
      );
    } else if (operation === "verify") {
      const request = {
        clientId: options.lifecycleClientId,
        expectedRevision: options.lifecycleRevision,
        expectedAdapter: {
          id: options.lifecycleAdapterId,
          type: options.lifecycleAdapterType,
          version: options.lifecycleAdapterVersion,
        },
        expectedManifestSha256: options.lifecycleManifestSha256,
      };
      data = projectLocalClientVerification(
        unwrapEnvelope(await client.verifyLocalClient(request)),
        request,
      );
    } else if (operation === "disable") {
      data = projectLocalClientMutationResult(
        unwrapEnvelope(await client.disableLocalClient({
          clientId: options.lifecycleClientId,
          reason: options.lifecycleReason ?? "manual_disable",
        })),
        operation,
        options.lifecycleClientId,
      );
    } else if (operation === "revoke") {
      data = projectLocalClientMutationResult(
        unwrapEnvelope(await client.revokeLocalClient({
          clientId: options.lifecycleClientId,
          expectedRevision: options.lifecycleRevision,
          reason: options.lifecycleReason ?? "manual_revoke",
        })),
        operation,
        options.lifecycleClientId,
      );
    } else {
      const request = { dryRun: !options.lifecycleApply };
      data = projectLocalClientSmartManage(
        unwrapEnvelope(await client.smartManageLocalClients(request)),
        request,
      );
    }

    const result = {
      ok: true,
      command: "clients",
      operation,
      mode: mutation
        ? "governed-mutation"
        : new Set(["discover", "smart-manage"]).has(operation)
          ? "dry-run"
          : "read-only",
      ...(mutation ? { retryAllowed: false } : { writesPerformed: false }),
      data,
    };
    if (options.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      renderLocalClientLifecycle(result, output);
    }
    return 0;
  } catch (error) {
    if (error instanceof CliUsageError) throw error;
    throw createSafeLocalClientLifecycleFailure(error, { operation, mutation });
  }
}

function projectLocalClientRegistry(value) {
  if (
    !isPlainRecord(value)
    || !isNonNegativeSafeInteger(value.total)
    || !Array.isArray(value.clients)
    || !isPlainRecord(value.pagination)
    || !isNonNegativeSafeInteger(value.pagination.offset)
    || !Number.isSafeInteger(value.pagination.limit)
    || value.pagination.limit < 1
    || !isNonNegativeSafeInteger(value.pagination.returned)
    || typeof value.pagination.includeDisabled !== "boolean"
  ) {
    throw new Error("invalid local-client registry response");
  }
  const clients = value.clients.map(projectManagedLocalClient);
  if (clients.length !== value.pagination.returned || clients.length > value.total) {
    throw new Error("inconsistent local-client registry response");
  }
  return Object.freeze({
    source: "registry-list",
    total: value.total,
    clients: Object.freeze(clients),
    pagination: Object.freeze({
      offset: value.pagination.offset,
      limit: value.pagination.limit,
      returned: value.pagination.returned,
      includeDisabled: value.pagination.includeDisabled,
    }),
  });
}

function projectLocalClientInspection(value, expectedClientId) {
  if (
    !isPlainRecord(value)
    || value.source !== "registry-list"
    || value.independentAuthority !== false
    || value.clientId !== expectedClientId
    || typeof value.found !== "boolean"
    || !Number.isSafeInteger(value.pagesScanned)
    || value.pagesScanned < 1
    || (value.found ? !isPlainRecord(value.client) : value.client !== null)
  ) {
    throw new Error("invalid local-client inspection response");
  }
  return Object.freeze({
    source: "registry-list",
    independentAuthority: false,
    clientId: expectedClientId,
    found: value.found,
    pagesScanned: value.pagesScanned,
    client: value.found ? projectManagedLocalClient(value.client) : null,
  });
}

function projectLocalClientDiscovery(value, request) {
  if (
    !isPlainRecord(value)
    || value.strategy !== "system-scan"
    || value.dryRun !== request.dryRun
    || !isNonNegativeSafeInteger(value.discovered)
    || typeof value.includeUnknown !== "boolean"
    || (request.dryRun && typeof value.includeMissingAsDisabled !== "boolean")
    || typeof value.includedSystemProcesses !== "boolean"
    || typeof value.autoDiscoverAll !== "boolean"
    || !Number.isSafeInteger(value.maxProcesses)
    || value.maxProcesses < 1
  ) {
    throw new Error("invalid local-client discovery response");
  }
  const droppedCount = projectLocalClientDiscoveryDroppedCount(value.dropped);
  const source = projectSafeLifecycleLabel(value.source);
  const common = {
    source,
    strategy: "system-scan",
    dryRun: value.dryRun,
    discovered: value.discovered,
    includeUnknown: value.includeUnknown,
    includeMissingAsDisabled: typeof value.includeMissingAsDisabled === "boolean"
      ? value.includeMissingAsDisabled
      : request.includeMissingAsDisabled === true || request.autoDiscoverAll === true,
    includeSystemProcesses: value.includedSystemProcesses,
    autoDiscoverAll: value.autoDiscoverAll,
    maxProcesses: value.maxProcesses,
    droppedCount,
  };
  if (request.dryRun) {
    if (!Array.isArray(value.candidates)) {
      throw new Error("invalid local-client discovery preview");
    }
    return Object.freeze({
      ...common,
      candidates: Object.freeze(value.candidates.map(projectManagedLocalClient)),
      writesPerformed: false,
    });
  }
  if (!Array.isArray(value.inserted) || !Array.isArray(value.updated)) {
    throw new Error("invalid local-client discovery mutation result");
  }
  return Object.freeze({
    ...common,
    inserted: Object.freeze(projectClientIdList(value.inserted)),
    updated: Object.freeze(projectClientIdList(value.updated)),
    registry: projectLocalClientRegistry(value.registry),
  });
}

function projectLocalClientMutationResult(value, operation, expectedClientId) {
  if (!isPlainRecord(value) || !isPlainRecord(value.client)) {
    throw new Error("invalid local-client mutation response");
  }
  const allowedActions = {
    register: new Set(["created", "updated"]),
    disable: new Set(["disabled"]),
    revoke: new Set(["revoked", "already-revoked"]),
  }[operation];
  if (!allowedActions.has(value.action)) {
    throw new Error("invalid local-client mutation action");
  }
  if (operation !== "register" && value.mode !== "applied") {
    throw new Error("invalid local-client mutation mode");
  }
  const client = projectManagedLocalClient(value.client);
  if (client.clientId !== expectedClientId) {
    throw new Error("local-client mutation target mismatch");
  }
  return Object.freeze({
    action: value.action,
    ...(operation === "register" ? {} : { mode: "applied" }),
    client,
  });
}

function projectLocalClientVerification(value, request) {
  if (
    !isPlainRecord(value)
    || value.promotionVersion !== "local-client-verification-promotion-v1"
    || value.descriptorVersion !== "verified-local-client-adapter-target-v1"
    || value.clientId !== request.clientId
    || !Number.isSafeInteger(value.revision)
    || value.revision < request.expectedRevision
    || value.state !== "verified"
    || value.trustDecision !== "verified"
    || !isPlainRecord(value.adapter)
    || value.adapter.id !== request.expectedAdapter.id
    || value.adapter.type !== request.expectedAdapter.type
    || value.adapter.version !== request.expectedAdapter.version
    || value.manifestSha256 !== request.expectedManifestSha256
    || !Array.isArray(value.capabilityIds)
    || !isPlainRecord(value.verification)
    || !SHA256_PATTERN.test(value.verification.fingerprint)
    || !isNonNegativeSafeInteger(value.verification.verifiedAtMs)
    || !isNonNegativeSafeInteger(value.verification.expiresAtMs)
    || value.verification.verifiedAtMs >= value.verification.expiresAtMs
  ) {
    throw new Error("invalid local-client verification response");
  }
  return Object.freeze({
    promotionVersion: value.promotionVersion,
    descriptorVersion: value.descriptorVersion,
    clientId: value.clientId,
    revision: value.revision,
    state: "verified",
    trustDecision: "verified",
    adapter: Object.freeze({
      id: value.adapter.id,
      type: value.adapter.type,
      version: value.adapter.version,
    }),
    manifestSha256: value.manifestSha256,
    capabilityIds: Object.freeze(projectCapabilityList(value.capabilityIds)),
    verification: Object.freeze({
      fingerprint: value.verification.fingerprint,
      verifiedAtMs: value.verification.verifiedAtMs,
      expiresAtMs: value.verification.expiresAtMs,
    }),
  });
}

function projectLocalClientSmartManage(value, request) {
  if (
    !isPlainRecord(value)
    || value.action !== "smart-manage"
    || value.dryRun !== request.dryRun
    || typeof value.includeDiscoveryOnly !== "boolean"
    || !isPlainRecord(value.discovery)
    || value.discovery.dryRun !== request.dryRun
    || !isNonNegativeSafeInteger(value.discovery.discovered)
  ) {
    throw new Error("invalid local-client smart-manage response");
  }
  const droppedCount = projectLocalClientDiscoveryDroppedCount(value.discovery.dropped);
  const maintenance = value.maintenance === null
    ? null
    : projectLocalClientMaintenanceSummary(value.maintenance);
  return Object.freeze({
    action: "smart-manage",
    dryRun: value.dryRun,
    includeDiscoveryOnly: value.includeDiscoveryOnly,
    discovery: Object.freeze({
      source: projectSafeLifecycleLabel(value.discovery.source),
      dryRun: value.discovery.dryRun,
      discovered: value.discovery.discovered,
      includeUnknown: value.discovery.includeUnknown === true,
      includeMissingAsDisabled: value.discovery.includeMissingAsDisabled === true,
      includeSystemProcesses: value.discovery.includeSystemProcesses === true,
      autoDiscoverAll: value.discovery.autoDiscoverAll === true,
      droppedCount,
    }),
    maintenance,
    recommendationCount: Array.isArray(value.recommendations)
      ? value.recommendations.length
      : 0,
    registrySnapshotCount: Array.isArray(value.registrySnapshot)
      ? value.registrySnapshot.length
      : 0,
    ...(request.dryRun ? { writesPerformed: false } : {}),
  });
}

function projectLocalClientDiscoveryDroppedCount(value) {
  if (Array.isArray(value)) return value.length;
  const keys = [
    "filteredSystemProcessCount",
    "filteredUnknownCount",
    "duplicateProcessCount",
  ];
  if (
    !hasExactKeys(value, keys)
    || keys.some((key) => !isNonNegativeSafeInteger(value[key]))
  ) {
    throw new Error("invalid local-client discovery drop summary");
  }
  return keys.reduce((total, key) => total + value[key], 0);
}

function projectLocalClientMaintenanceSummary(value) {
  if (!isPlainRecord(value) || typeof value.dryRun !== "boolean") {
    throw new Error("invalid local-client maintenance response");
  }
  const summary = isPlainRecord(value.summary) ? value.summary : {};
  const counts = isPlainRecord(value.counts) ? value.counts : {};
  return Object.freeze({
    dryRun: value.dryRun,
    staleCandidates: projectOptionalCount(value.staleCandidates),
    autoRiskRecoveries: projectOptionalCount(value.autoRiskRecoveries),
    summary: Object.freeze({
      totalClients: projectOptionalCount(summary.totalClients),
      staleCandidates: projectOptionalCount(summary.staleCandidates),
      riskCandidates: projectOptionalCount(summary.riskCandidates),
      appliedChanges: projectOptionalCount(summary.appliedChanges),
    }),
    counts: Object.freeze({
      staleDisabledCount: projectOptionalCount(counts.staleDisabledCount),
      autoRiskRecoveredCount: projectOptionalCount(counts.autoRiskRecoveredCount),
      riskDisabledCount: projectOptionalCount(counts.riskDisabledCount),
      riskMarkedCount: projectOptionalCount(counts.riskMarkedCount),
    }),
  });
}

function projectManagedLocalClient(value) {
  if (
    !isPlainRecord(value)
    || !LOCAL_CLIENT_ID_PATTERN.test(value.clientId ?? "")
    || !new Set(["observed", "declared", "pending_approval", "verified", "disabled", "revoked"]).has(value.state)
    || typeof value.enabled !== "boolean"
    || typeof value.routable !== "boolean"
    || !Array.isArray(value.capabilityIds)
    || !isPlainRecord(value.health)
    || !new Set(["healthy", "degraded", "unhealthy", "unknown"]).has(value.health.status)
    || !new Set(["unverified", "declared", "verified", "rejected"]).has(value.trustDecision)
    || (value.revision !== undefined && (!Number.isSafeInteger(value.revision) || value.revision < 1))
  ) {
    throw new Error("invalid managed local-client projection");
  }
  return Object.freeze({
    clientId: value.clientId,
    displayName: projectSafeDisplayName(value.displayName, value.clientId),
    state: value.state,
    enabled: value.enabled,
    routable: value.routable,
    ...projectOptionalDeclarationFields(value),
    capabilityIds: Object.freeze(projectCapabilityList(value.capabilityIds)),
    health: Object.freeze({
      status: value.health.status,
      ...(Number.isFinite(value.health.latencyMs)
        ? { latencyMs: value.health.latencyMs }
        : {}),
      ...(validIsoDate(value.health.lastSeenAt) ? { lastSeenAt: value.health.lastSeenAt } : {}),
      ...(validIsoDate(value.health.leaseExpiresAt)
        ? { leaseExpiresAt: value.health.leaseExpiresAt }
        : {}),
    }),
    trustDecision: value.trustDecision,
    ...(value.revision === undefined ? {} : { revision: value.revision }),
  });
}

function projectOptionalDeclarationFields(value) {
  const output = {};
  for (const key of ["adapterId", "adapterType", "adapterVersion", "protocolVersion"]) {
    if (value[key] === null) output[key] = null;
    else if (typeof value[key] === "string" && LOCAL_CLIENT_DECLARATION_PATTERN.test(value[key])) {
      output[key] = value[key];
    }
  }
  if (value.manifestSha256 === null) output.manifestSha256 = null;
  else if (SHA256_PATTERN.test(value.manifestSha256 ?? "")) {
    output.manifestSha256 = value.manifestSha256;
  }
  return output;
}

function projectCapabilityList(values) {
  const capabilities = values.map((value) => String(value).trim().toLowerCase());
  if (capabilities.some((value) => !LOCAL_CLIENT_CAPABILITY_PATTERN.test(value))) {
    throw new Error("invalid local-client capability projection");
  }
  return [...new Set(capabilities)];
}

function projectClientIdList(values) {
  if (values.some((value) => !LOCAL_CLIENT_ID_PATTERN.test(value ?? ""))) {
    throw new Error("invalid local-client id projection");
  }
  return [...new Set(values)];
}

function projectSafeDisplayName(value, fallback) {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= 128
    && value === value.trim()
    && !/[\\/\u0000-\u001f\u007f]/u.test(value)
    ? value
    : fallback;
}

function projectSafeLifecycleLabel(value) {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9._:-]{0,127}$/u.test(value)) {
    throw new Error("invalid local-client response label");
  }
  return value;
}

function projectOptionalCount(value) {
  return isNonNegativeSafeInteger(value) ? value : 0;
}

function isLocalClientLifecycleMutation(options) {
  const operation = options.positionals[0];
  return LOCAL_CLIENT_LIFECYCLE_ALWAYS_MUTATING.has(operation)
    || (new Set(["discover", "smart-manage"]).has(operation) && options.lifecycleApply);
}

function createSafeLocalClientLifecycleFailure(error, { operation, mutation }) {
  const rawCode = typeof error?.code === "string" ? error.code : null;
  const allowlisted = SAFE_LOCAL_CLIENT_LIFECYCLE_ERROR_CODES.has(rawCode);
  const safeCode = allowlisted ? rawCode : "LOCAL_CLIENT_LIFECYCLE_UNAVAILABLE";
  const transportUncertain = new Set([
    "GATEWAY_CLIENT_ABORTED",
    "GATEWAY_CLIENT_TIMEOUT",
    "GATEWAY_HTTP_ERROR",
    "GATEWAY_NETWORK_ERROR",
    "GATEWAY_PROTOCOL_ERROR",
  ]).has(safeCode);
  const unknown = mutation && (
    transportUncertain
    || !allowlisted
    || (Number.isInteger(error?.statusCode) && error.statusCode >= 500)
  );
  return new CliLocalClientFailure(
    unknown ? "LOCAL_CLIENT_LIFECYCLE_OUTCOME_UNKNOWN" : safeCode,
    {
      operation,
      mutation,
      status: unknown ? "unknown-reconcile-required" : "rejected",
    },
  );
}

function renderLocalClientLifecycle(result, output) {
  const lines = [
    "",
    output.bold("Governed local-client lifecycle"),
    `Operation: ${result.operation}`,
    `Mode: ${result.mode}`,
  ];
  if (result.operation === "list") {
    lines.push(`Clients: ${result.data.total}`, "Configuration writes: none");
  } else if (result.operation === "inspect") {
    lines.push(
      `Client: ${result.data.clientId}`,
      `Found: ${result.data.found}`,
      "Source: registry-list (not an independent authoritative read)",
      "Configuration writes: none",
    );
  } else if (!isLocalClientLifecycleMutation({
    positionals: [result.operation],
    lifecycleApply: result.mode === "governed-mutation",
  })) {
    lines.push(
      `Discovered: ${result.data.discovery?.discovered ?? result.data.discovered ?? 0}`,
      "Configuration writes: none (dry-run)",
    );
  } else {
    const clientId = result.data.clientId ?? result.data.client?.clientId ?? null;
    if (clientId) lines.push(`Client: ${clientId}`);
    lines.push(
      `Status: ${result.data.action ?? result.data.state ?? "completed"}`,
      output.yellow("Automatic retry: forbidden; reconcile before another attempt."),
    );
  }
  output.write(`${lines.join("\n")}\n\n`);
}

async function runClientsOnboarding(options, output, receiptRoot) {
  const operation = options.positionals[0];
  const mutation = LOCAL_CLIENT_ONBOARDING_MUTATIONS.has(operation);
  const client = createGatewayClient({
    baseUrl: options.url,
    timeoutMs: options.timeoutMs,
    headers: options.adminKey
      ? { authorization: `Bearer ${options.adminKey}` }
      : {},
  });

  try {
    let data;
    if (operation === "profiles") {
      data = {
        profiles: projectLocalClientOnboardingProfiles(
          unwrapEnvelope(await client.localClientOnboardingProfiles()),
        ),
        certificationStatus: LOCAL_CLIENT_ONBOARDING_CERTIFICATION,
      };
    } else if (operation === "inspect") {
      data = projectLocalClientOnboardingInspection(
        unwrapEnvelope(
          await client.localClientOnboardingProfile(options.onboardingProfileId),
        ),
        options.onboardingProfileId,
      );
    } else if (operation === "verify") {
      data = projectLocalClientOnboardingVerification(
        unwrapEnvelope(
          await client.verifyLocalClientOnboardingProfile(options.onboardingProfileId),
        ),
        options.onboardingProfileId,
      );
    } else if (operation === "plan") {
      const receipt = options.onboardingAction === "rollback"
        ? readBoundedLocalClientOnboardingReceipt({
            path: options.onboardingReceiptFile,
            root: receiptRoot,
            expectedProfileId: options.onboardingProfileId,
          })
        : undefined;
      const request = {
        profileId: options.onboardingProfileId,
        action: options.onboardingAction,
        ...(receipt === undefined ? {} : { receipt }),
      };
      data = projectLocalClientOnboardingPlan(
        unwrapEnvelope(await client.planGovernedLocalClientOnboarding(request)),
        request,
      );
    } else if (operation === "approve") {
      data = projectLocalClientOnboardingApproval(
        unwrapEnvelope(await client.approveGovernedLocalClientOnboarding(
          { planId: options.onboardingPlanId },
          { idempotencyKey: options.idempotencyKey },
        )),
        options.onboardingPlanId,
      );
    } else {
      const method = {
        apply: "applyGovernedLocalClientOnboarding",
        rollback: "rollbackGovernedLocalClientOnboarding",
        recover: "recoverGovernedLocalClientOnboarding",
      }[operation];
      data = projectLocalClientOnboardingMutationOutcome(
        unwrapEnvelope(await client[method](
          { planId: options.onboardingPlanId },
          { idempotencyKey: options.idempotencyKey },
        )),
        operation,
        options.onboardingPlanId,
      );
    }

    const result = {
      ok: true,
      command: "clients-onboarding",
      operation,
      mode: mutation ? "governed-mutation" : "read-only",
      ...(mutation ? { retryAllowed: false } : { writesPerformed: false }),
      data,
    };
    if (options.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      renderLocalClientOnboardingCommand(result, output);
    }
    return 0;
  } catch (error) {
    if (error instanceof CliUsageError) throw error;
    throw createSafeLocalClientOnboardingFailure(error, { operation, mutation });
  }
}

function projectLocalClientOnboardingInspection(value, expectedProfileId) {
  if (!isPlainRecord(value)) throw new Error("invalid onboarding inspection");
  const profiles = projectLocalClientOnboardingProfiles(
    [value.profile],
    [expectedProfileId],
  );
  if (
    profiles.length !== 1
    || profiles[0].profileId !== expectedProfileId
    || typeof value.recoveryRequired !== "boolean"
    || typeof value.journalCorrupt !== "boolean"
    || !isNonNegativeSafeInteger(value.pendingTransactionCount)
    || !isNonNegativeSafeInteger(value.storedPlanCount)
    || value.available !== true
  ) {
    throw new Error("invalid onboarding inspection");
  }
  return Object.freeze({
    profile: profiles[0],
    installation: projectLocalClientOnboardingVerification(
      value.installation,
      expectedProfileId,
    ),
    recoveryRequired: value.recoveryRequired,
    journalCorrupt: value.journalCorrupt,
    pendingTransactionCount: value.pendingTransactionCount,
    storedPlanCount: value.storedPlanCount,
    available: true,
  });
}

function projectLocalClientOnboardingVerification(value, expectedProfileId) {
  if (
    !isPlainRecord(value)
    || value.profileId !== expectedProfileId
    || typeof value.installed !== "boolean"
    || !new Set(["exact", "absent", "different"]).has(value.state)
    || value.installed !== (value.state === "exact")
    || value.format !== localClientOnboardingProfileFormat(expectedProfileId)
    || value.certificationStatus !== LOCAL_CLIENT_ONBOARDING_CERTIFICATION
    || value.redacted !== true
  ) {
    throw new Error("invalid onboarding verification");
  }
  return Object.freeze({
    profileId: expectedProfileId,
    installed: value.installed,
    state: value.state,
    format: value.format,
    certificationStatus: LOCAL_CLIENT_ONBOARDING_CERTIFICATION,
    redacted: true,
  });
}

function projectLocalClientOnboardingPlan(value, request) {
  if (
    !isPlainRecord(value)
    || value.apiVersion !== "local-client-governed-onboarding-api-v1"
    || value.planVersion !== "local-client-governed-onboarding-plan-v1"
    || !LOCAL_CLIENT_ONBOARDING_PLAN_ID_PATTERN.test(value.planId)
    || value.profileId !== request.profileId
    || value.action !== request.action
    || !isNonNegativeSafeInteger(value.createdAtMs)
    || !isNonNegativeSafeInteger(value.expiresAtMs)
    || value.createdAtMs >= value.expiresAtMs
    || value.writesPerformed !== false
    || value.redacted !== true
  ) {
    throw new Error("invalid onboarding plan");
  }
  return Object.freeze({
    apiVersion: value.apiVersion,
    planVersion: value.planVersion,
    planId: value.planId,
    profileId: value.profileId,
    action: value.action,
    createdAtMs: value.createdAtMs,
    expiresAtMs: value.expiresAtMs,
    writesPerformed: false,
    redacted: true,
  });
}

function projectLocalClientOnboardingApproval(value, expectedPlanId) {
  if (
    !isPlainRecord(value)
    || value.apiVersion !== "local-client-governed-onboarding-api-v1"
    || value.operation !== "approve"
    || value.status !== "approved"
    || typeof value.approvalId !== "string"
    || value.approvalId.length < 1
    || value.approvalId.length > 256
    || value.planId !== expectedPlanId
    || !validIsoDate(value.approvedAt)
    || !validIsoDate(value.expiresAt)
    || Date.parse(value.approvedAt) >= Date.parse(value.expiresAt)
    || value.writesPerformed !== false
    || value.redacted !== true
  ) {
    throw new Error("invalid onboarding approval");
  }
  return Object.freeze({
    apiVersion: value.apiVersion,
    operation: "approve",
    status: "approved",
    approvalId: value.approvalId,
    planId: value.planId,
    approvedAt: value.approvedAt,
    expiresAt: value.expiresAt,
    writesPerformed: false,
    redacted: true,
  });
}

function projectLocalClientOnboardingMutationOutcome(value, operation, expectedPlanId) {
  if (
    !isPlainRecord(value)
    || value.accepted !== true
    || !new Set(["completed", "replayed"]).has(value.status)
    || !new Set(["created", "replayed"]).has(value.idempotencyStatus)
    || typeof value.replayed !== "boolean"
    || value.replayed !== (value.status === "replayed")
    || value.replayable !== true
    || typeof value.operationInvoked !== "boolean"
    || value.retryAllowed !== false
  ) {
    throw new Error("invalid onboarding mutation outcome");
  }
  return Object.freeze({
    accepted: true,
    status: value.status,
    idempotencyStatus: value.idempotencyStatus,
    replayed: value.replayed,
    replayable: true,
    operationInvoked: value.operationInvoked,
    retryAllowed: false,
    result: projectLocalClientOnboardingMutationResult(
      value.result,
      operation,
      expectedPlanId,
    ),
  });
}

function projectLocalClientOnboardingMutationResult(value, operation, expectedPlanId) {
  const expectedAction = operation === "apply" ? null : operation;
  if (
    !isPlainRecord(value)
    || value.apiVersion !== "local-client-governed-onboarding-api-v1"
    || value.operation !== operation
    || !LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.has(value.profileId)
    || value.planId !== expectedPlanId
    || value.status !== "completed"
    || value.redacted !== true
    || (expectedAction === null
      ? !new Set(["enable", "disable"]).has(value.action)
      : value.action !== expectedAction)
  ) {
    throw new Error("invalid onboarding mutation result");
  }
  const receipt = operation === "apply"
    ? projectLocalClientOnboardingApplyReceipt(value.receipt, value.profileId)
    : projectLocalClientOnboardingReceiptSummary(value.receipt, operation, value.profileId);
  return Object.freeze({
    apiVersion: value.apiVersion,
    operation,
    profileId: value.profileId,
    action: value.action,
    planId: value.planId,
    status: "completed",
    receipt,
    redacted: true,
  });
}

function projectLocalClientOnboardingReceiptSummary(value, operation, expectedProfileId) {
  if (
    !isPlainRecord(value)
    || value.profileId !== expectedProfileId
    || value.format !== localClientOnboardingProfileFormat(expectedProfileId)
    || value.certificationStatus !== LOCAL_CLIENT_ONBOARDING_CERTIFICATION
    || value.redacted !== true
  ) {
    throw new Error("invalid onboarding mutation receipt");
  }
  if (
    operation === "rollback"
    && (
      value.rollbackVersion !== "local-client-onboarding-rollback-v1"
      || !new Set(["enable", "disable"]).has(value.action)
      || !LOCAL_CLIENT_ONBOARDING_REGISTRY_PLAN_ID_PATTERN.test(value.planId)
    )
  ) {
    throw new Error("invalid onboarding rollback receipt");
  }
  if (
    operation === "recover"
    && value.recoveryVersion !== "local-client-onboarding-recovery-v1"
  ) {
    throw new Error("invalid onboarding recovery receipt");
  }
  return Object.freeze({
    ...(operation === "rollback"
      ? {
          rollbackVersion: value.rollbackVersion,
          action: value.action,
          planId: value.planId,
        }
      : { recoveryVersion: value.recoveryVersion }),
    profileId: value.profileId,
    format: value.format,
    certificationStatus: LOCAL_CLIENT_ONBOARDING_CERTIFICATION,
    redacted: true,
  });
}

function readBoundedLocalClientOnboardingReceipt({ path, root, expectedProfileId }) {
  const parsed = readBoundedJsonFile({
    path,
    root,
    label: "Rollback receipt",
    maxBytes: LOCAL_CLIENT_ONBOARDING_RECEIPT_MAX_BYTES,
  });
  try {
    return projectLocalClientOnboardingApplyReceipt(parsed, expectedProfileId);
  } catch {
    throw new CliUsageError(
      "Rollback receipt must be an exact redacted local-client onboarding apply receipt.",
    );
  }
}

function readBoundedJsonFile({ path, root, label, maxBytes }) {
  let rootPath;
  let unresolvedPath;
  let filePath;
  let fileStat;
  try {
    rootPath = realpathSync(root);
    unresolvedPath = resolve(rootPath, path);
    if (lstatSync(unresolvedPath).isSymbolicLink()) {
      throw new CliUsageError(`${label} files cannot be symbolic links.`);
    }
    filePath = realpathSync(unresolvedPath);
    const relativePath = relative(rootPath, filePath);
    if (isAbsolute(relativePath) || /^\.\.(?:[\\/]|$)/u.test(relativePath)) {
      throw new CliUsageError(`${label} file must stay within the current working directory.`);
    }
    fileStat = statSync(filePath);
  } catch (error) {
    if (error instanceof CliUsageError) throw error;
    throw new CliUsageError(`${label} file is unavailable or unsafe.`);
  }
  let raw;
  try {
    // Open before checking so the stat and the read observe the same file —
    // a path-level stat followed by a path-level read would race.
    const fd = openSync(filePath, "r");
    try {
      fileStat = fstatSync(fd);
      if (
        !fileStat.isFile()
        || fileStat.size < 2
        || fileStat.size > maxBytes
      ) {
        throw new CliUsageError(
          `${label} file must be a JSON file no larger than ${maxBytes} bytes.`,
        );
      }
      raw = readFileSync(fd, "utf8");
    } finally {
      closeSync(fd);
    }
  } catch (error) {
    if (error instanceof CliUsageError) throw error;
    throw new CliUsageError(`${label} file is unavailable or unsafe.`);
  }
  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    throw new CliUsageError(
      `${label} file must be a JSON file no larger than ${maxBytes} bytes.`,
    );
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new CliUsageError(`${label} file must contain valid JSON.`);
  }
}

function projectLocalClientOnboardingApplyReceipt(value, expectedProfileId) {
  const topKeys = [
    "receiptVersion",
    "profileId",
    "action",
    "planId",
    "transaction",
    "receiptDigest",
    "format",
    "certificationStatus",
    "redacted",
  ];
  const transactionKeys = [
    "receiptVersion",
    "transactionId",
    "planId",
    "targetFingerprint",
    "beforeSha256",
    "afterSha256",
    "backupSha256",
    "afterIdentityFingerprint",
    "committedAtMs",
    "receiptDigest",
  ];
  if (
    !hasExactKeys(value, topKeys)
    || value.receiptVersion !== "local-client-onboarding-receipt-v1"
    || value.profileId !== expectedProfileId
    || !new Set(["enable", "disable"]).has(value.action)
    || !LOCAL_CLIENT_ONBOARDING_REGISTRY_PLAN_ID_PATTERN.test(value.planId)
    || !SHA256_PATTERN.test(value.receiptDigest)
    || value.format !== localClientOnboardingProfileFormat(expectedProfileId)
    || value.certificationStatus !== LOCAL_CLIENT_ONBOARDING_CERTIFICATION
    || value.redacted !== true
    || !hasExactKeys(value.transaction, transactionKeys)
    || value.transaction.receiptVersion !== "local-client-config-receipt-v1"
    || !LOCAL_CLIENT_ONBOARDING_TRANSACTION_ID_PATTERN.test(value.transaction.transactionId)
    || !transactionKeys.slice(2, 8).every((key) => SHA256_PATTERN.test(value.transaction[key]))
    || !isNonNegativeSafeInteger(value.transaction.committedAtMs)
    || !SHA256_PATTERN.test(value.transaction.receiptDigest)
    || !value.planId.endsWith(`:${value.transaction.planId}`)
  ) {
    throw new Error("invalid onboarding apply receipt");
  }
  return Object.freeze({
    receiptVersion: value.receiptVersion,
    profileId: value.profileId,
    action: value.action,
    planId: value.planId,
    transaction: Object.freeze({
      receiptVersion: value.transaction.receiptVersion,
      transactionId: value.transaction.transactionId,
      planId: value.transaction.planId,
      targetFingerprint: value.transaction.targetFingerprint,
      beforeSha256: value.transaction.beforeSha256,
      afterSha256: value.transaction.afterSha256,
      backupSha256: value.transaction.backupSha256,
      afterIdentityFingerprint: value.transaction.afterIdentityFingerprint,
      committedAtMs: value.transaction.committedAtMs,
      receiptDigest: value.transaction.receiptDigest,
    }),
    receiptDigest: value.receiptDigest,
    format: value.format,
    certificationStatus: LOCAL_CLIENT_ONBOARDING_CERTIFICATION,
    redacted: true,
  });
}

function createSafeLocalClientOnboardingFailure(error, { operation, mutation }) {
  const rawCode = typeof error?.code === "string" ? error.code : null;
  const safeCode = SAFE_LOCAL_CLIENT_ONBOARDING_ERROR_CODES.has(rawCode)
    ? rawCode
    : "LOCAL_CLIENT_ONBOARDING_UNAVAILABLE";
  const transportUncertain = new Set([
    "GATEWAY_CLIENT_ABORTED",
    "GATEWAY_CLIENT_TIMEOUT",
    "GATEWAY_HTTP_ERROR",
    "GATEWAY_NETWORK_ERROR",
    "GATEWAY_PROTOCOL_ERROR",
  ]).has(safeCode);
  const unknown = UNKNOWN_LOCAL_CLIENT_ONBOARDING_ERROR_CODES.has(safeCode)
    || (
      mutation
      && (
        transportUncertain
        || !SAFE_LOCAL_CLIENT_ONBOARDING_ERROR_CODES.has(rawCode)
      )
    );
  return new CliOnboardingFailure(
    unknown
      ? (UNKNOWN_LOCAL_CLIENT_ONBOARDING_ERROR_CODES.has(safeCode)
          ? safeCode
          : "LOCAL_CLIENT_ONBOARDING_OUTCOME_UNKNOWN")
      : safeCode,
    {
      operation,
      status: unknown ? "unknown-reconcile-required" : "rejected",
    },
  );
}

function renderLocalClientOnboardingCommand(result, output) {
  const lines = [
    "",
    output.bold("Governed local-client onboarding"),
    `Operation: ${result.operation}`,
    `Mode: ${result.mode}`,
  ];
  if (result.operation === "profiles") {
    lines.push(
      ...result.data.profiles.map((profile) => `  - ${profile.profileId} (${profile.client})`),
      "Configuration writes: none",
    );
  } else if (result.operation === "inspect") {
    lines.push(
      `Profile: ${result.data.profile.profileId}`,
      `Installation state: ${result.data.installation.state}`,
      `Recovery required: ${result.data.recoveryRequired}`,
      "Configuration writes: none",
    );
  } else if (result.operation === "verify") {
    lines.push(
      `Profile: ${result.data.profileId}`,
      `Installation state: ${result.data.state}`,
      "Configuration writes: none",
    );
  } else if (result.operation === "plan") {
    lines.push(
      `Plan: ${result.data.planId}`,
      `Profile: ${result.data.profileId}`,
      `Action: ${result.data.action}`,
      "Configuration writes: none",
    );
  } else if (result.operation === "approve") {
    lines.push(
      `Plan: ${result.data.planId}`,
      `Status: ${result.data.status}`,
      "Configuration writes: none",
      output.yellow("Automatic retry: forbidden; reconcile before another attempt."),
    );
  } else {
    lines.push(
      `Plan: ${result.data.result.planId}`,
      `Status: ${result.data.status}`,
      `Idempotency: ${result.data.idempotencyStatus}`,
      "Receipt: redacted",
      output.yellow("Automatic retry: forbidden; reconcile before another attempt."),
    );
  }
  output.write(`${lines.join("\n")}\n\n`);
}

function hasExactKeys(value, keys) {
  if (!isPlainRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validIsoDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

async function loadLocalClientOnboarding(client) {
  try {
    const response = await client.localClientOnboardingProfiles();
    return Object.freeze({
      available: true,
      profiles: projectLocalClientOnboardingProfiles(unwrapEnvelope(response)),
      certificationStatus: LOCAL_CLIENT_ONBOARDING_CERTIFICATION,
    });
  } catch (error) {
    if (
      error?.statusCode !== 503
      && error?.code !== "LOCAL_CLIENT_ONBOARDING_DISABLED"
    ) {
      throw error;
    }
    return Object.freeze({
      available: false,
      code: redactLocalClientOnboardingErrorCode(error),
    });
  }
}

function projectLocalClientOnboardingProfiles(value, expectedProfileIds = null) {
  const rawProfiles = Array.isArray(value)
    ? value
    : Array.isArray(value?.profiles)
      ? value.profiles
      : [];
  const definitions = expectedProfileIds === null
    ? LOCAL_CLIENT_ONBOARDING_PROFILE_DEFINITIONS.filter((definition) => rawProfiles.some((profile) => profile?.profileId === definition.profileId))
    : LOCAL_CLIENT_ONBOARDING_PROFILE_DEFINITIONS.filter((definition) => (
        expectedProfileIds.includes(definition.profileId)
      ));
  if (
    definitions.length < 1
    || definitions.length !== (expectedProfileIds?.length ?? definitions.length)
    || rawProfiles.length !== definitions.length
    || new Set(rawProfiles.map((profile) => profile?.profileId)).size !== rawProfiles.length
  ) {
    throw new Error("invalid local-client onboarding profile set");
  }
  const profilesById = new Map(rawProfiles.map((profile) => [profile?.profileId, profile]));
  return Object.freeze(definitions.map((definition) => {
    const profile = profilesById.get(definition.profileId);
    if (
      !profile
      || profile.client !== definition.client
      || profile.format !== definition.format
      || profile.containerKey !== definition.containerKey
      || profile.serverName !== "unified-ai-system"
      || profile.transport !== "stdio"
      || !Array.isArray(profile.supportedActions)
      || profile.supportedActions.length !== 2
      || profile.supportedActions[0] !== "enable"
      || profile.supportedActions[1] !== "disable"
      || profile.certificationStatus !== LOCAL_CLIENT_ONBOARDING_CERTIFICATION
      || !new Set(["aes-256-gcm", "0600-plaintext"]).has(profile.backupProtection)
      || profile.redacted !== true
    ) {
      throw new Error("invalid local-client onboarding profile");
    }
    return Object.freeze({
      profileId: definition.profileId,
      client: profile.client,
      format: profile.format,
      containerKey: profile.containerKey,
      serverName: profile.serverName,
      transport: profile.transport,
      backupProtection: profile.backupProtection,
      supportedActions: Object.freeze([...profile.supportedActions]),
      certificationStatus: profile.certificationStatus,
      redacted: true,
    });
  }));
}

function redactLocalClientOnboardingErrorCode(error) {
  return SAFE_LOCAL_CLIENT_ONBOARDING_ERROR_CODES.has(error?.code)
    ? error.code
    : "LOCAL_CLIENT_ONBOARDING_UNAVAILABLE";
}

function renderLocalClientOnboarding(onboarding, output) {
  if (!onboarding.available) {
    return [
      output.muted(`Onboarding profiles: unavailable (${onboarding.code})`),
      output.muted("inspection only; no config changed"),
    ];
  }
  const labelsByProfile = new Map(
    LOCAL_CLIENT_ONBOARDING_PROFILE_DEFINITIONS.map((definition) => [definition.profileId, definition.label]),
  );
  return [
    output.bold("Supported onboarding profiles"),
    ...onboarding.profiles.map((profile) => (
      `  - ${labelsByProfile.get(profile.profileId)}: ${profile.profileId} (${profile.backupProtection} backup)`
    )),
    `Certification: ${onboarding.certificationStatus}`,
    output.muted("inspection only; no config changed"),
  ];
}

function validateLocalClientLifecycleOptions(options) {
  if (options.prompt !== null || options.positionals.length > 1) {
    throw new CliUsageError(
      "clients accepts at most one operation: discover, list, inspect, register, verify, disable, revoke, or smart-manage.",
    );
  }
  if (options.positionals.length === 0) {
    if (localClientLifecycleOptionsUsed(options) || options.confirmed) {
      throw new CliUsageError("Lifecycle options require an explicit clients operation.");
    }
    return;
  }

  const operation = options.positionals[0];
  if (!LOCAL_CLIENT_LIFECYCLE_SUBCOMMANDS.has(operation)) {
    throw new CliUsageError(`Unsupported clients operation: ${operation}`);
  }
  if (!options.adminKey) {
    throw new CliUsageError(
      `${operation} requires an admin key.`,
      { hint: "Pass --admin-key or set AGENT_CONSOLE_ADMIN_KEY." },
    );
  }

  const mutation = isLocalClientLifecycleMutation(options);
  if (mutation && !options.confirmed) {
    throw new CliUsageError(`${operation} requires explicit --yes confirmation.`);
  }
  if (!mutation && options.confirmed) {
    throw new CliUsageError("--yes is only valid with an applied lifecycle mutation.");
  }
  if (options.lifecycleApply && !new Set(["discover", "smart-manage"]).has(operation)) {
    throw new CliUsageError("--apply is only valid with discover or smart-manage.");
  }

  const requiresClientId = new Set(["inspect", "register", "verify", "disable", "revoke"])
    .has(operation);
  if (requiresClientId) {
    if (!LOCAL_CLIENT_ID_PATTERN.test(options.lifecycleClientId ?? "")) {
      throw new CliUsageError(
        `${operation} requires a lowercase letter-leading --client-id using letters, digits, dot, underscore, or hyphen.`,
      );
    }
  } else if (options.lifecycleClientId !== null) {
    throw new CliUsageError("--client-id is only valid with inspect, register, verify, disable, or revoke.");
  }

  const normalizedCapabilities = options.lifecycleCapabilities
    .map((value) => String(value).trim());
  if (normalizedCapabilities.some((value) => (
    value !== value.toLowerCase()
    || !LOCAL_CLIENT_CAPABILITY_PATTERN.test(value)
  ))) {
    throw new CliUsageError(
      "--capability values must be bounded lowercase identifiers without paths or whitespace.",
    );
  }
  options.lifecycleCapabilities = [...new Set(normalizedCapabilities)];
  if (!new Set(["list", "register"]).has(operation) && options.lifecycleCapabilities.length > 0) {
    throw new CliUsageError("--capability is only valid with list or register.");
  }
  if (operation === "register" && options.lifecycleCapabilities.length === 0) {
    throw new CliUsageError("register requires at least one --capability.");
  }

  const listOptionsUsed = options.lifecycleIncludeDisabled
    || options.lifecycleLimit !== null
    || options.lifecycleOffset !== null;
  if (operation !== "list" && listOptionsUsed) {
    throw new CliUsageError("--include-disabled, --limit, and --offset are only valid with list.");
  }

  const discoveryOptionsUsed = options.lifecycleMaxProcesses !== null
    || options.lifecycleIncludeUnknown
    || options.lifecycleIncludeSystemProcesses
    || options.lifecycleIncludeMissingAsDisabled
    || options.lifecycleAutoDiscoverAll;
  if (operation !== "discover" && discoveryOptionsUsed) {
    throw new CliUsageError("System discovery options are only valid with discover.");
  }

  if (options.lifecycleDisplayName !== null) {
    if (
      operation !== "register"
      || options.lifecycleDisplayName.length < 1
      || options.lifecycleDisplayName.length > 128
      || options.lifecycleDisplayName !== options.lifecycleDisplayName.trim()
      || /[\\/\u0000-\u001f\u007f]/u.test(options.lifecycleDisplayName)
    ) {
      throw new CliUsageError("--display-name is only valid for register and cannot contain a path or control characters.");
    }
  }

  const adapterValues = [
    options.lifecycleAdapterId,
    options.lifecycleAdapterType,
    options.lifecycleAdapterVersion,
    options.lifecycleManifestSha256,
  ];
  const adapterCount = adapterValues.filter((value) => value !== null).length;
  if (new Set(["register", "verify"]).has(operation)) {
    if ((operation === "verify" && adapterCount !== 4) || (adapterCount !== 0 && adapterCount !== 4)) {
      throw new CliUsageError(
        `${operation} requires the complete adapter binding: --adapter-id, --adapter-type, --adapter-version, and --manifest-sha256.`,
      );
    }
    if (
      adapterCount === 4
      && (
        !LOCAL_CLIENT_DECLARATION_PATTERN.test(options.lifecycleAdapterId)
        || !LOCAL_CLIENT_DECLARATION_PATTERN.test(options.lifecycleAdapterType)
        || !LOCAL_CLIENT_SEMVER_PATTERN.test(options.lifecycleAdapterVersion)
        || !SHA256_PATTERN.test(options.lifecycleManifestSha256)
      )
    ) {
      throw new CliUsageError("The adapter binding is invalid or not canonically formatted.");
    }
  } else if (adapterCount > 0) {
    throw new CliUsageError("Adapter binding options are only valid with register or verify.");
  }

  if (options.lifecycleProtocolVersion !== null) {
    if (
      operation !== "register"
      || !LOCAL_CLIENT_DECLARATION_PATTERN.test(options.lifecycleProtocolVersion)
    ) {
      throw new CliUsageError("--protocol-version is only valid with register and must be a bounded identifier.");
    }
  }

  if (new Set(["verify", "revoke"]).has(operation)) {
    if (!Number.isSafeInteger(options.lifecycleRevision) || options.lifecycleRevision < 1) {
      throw new CliUsageError(`${operation} requires the exact current --revision.`);
    }
  } else if (options.lifecycleRevision !== null) {
    throw new CliUsageError("--revision is only valid with verify or revoke.");
  }

  if (options.lifecycleReason !== null) {
    const allowed = operation === "disable"
      ? LOCAL_CLIENT_DISABLE_REASONS
      : operation === "revoke"
        ? LOCAL_CLIENT_REVOKE_REASONS
        : null;
    if (!allowed?.has(options.lifecycleReason)) {
      throw new CliUsageError("--reason is only valid with disable or revoke and must use an allowlisted value.");
    }
  }
}

function localClientLifecycleOptionsUsed(options) {
  return options.lifecycleClientId !== null
    || options.lifecycleDisplayName !== null
    || options.lifecycleCapabilities.length > 0
    || options.lifecycleIncludeDisabled
    || options.lifecycleLimit !== null
    || options.lifecycleOffset !== null
    || options.lifecycleApply
    || options.lifecycleMaxProcesses !== null
    || options.lifecycleIncludeUnknown
    || options.lifecycleIncludeSystemProcesses
    || options.lifecycleIncludeMissingAsDisabled
    || options.lifecycleAutoDiscoverAll
    || options.lifecycleRevision !== null
    || options.lifecycleAdapterId !== null
    || options.lifecycleAdapterType !== null
    || options.lifecycleAdapterVersion !== null
    || options.lifecycleManifestSha256 !== null
    || options.lifecycleProtocolVersion !== null
    || (options.command === "clients" && options.lifecycleReason !== null);
}

function localClientLifecycleOptionsUsedExcludingApply(options) {
  return options.lifecycleClientId !== null
    || options.lifecycleDisplayName !== null
    || options.lifecycleCapabilities.length > 0
    || options.lifecycleIncludeDisabled
    || options.lifecycleLimit !== null
    || options.lifecycleOffset !== null
    || options.lifecycleMaxProcesses !== null
    || options.lifecycleIncludeUnknown
    || options.lifecycleIncludeSystemProcesses
    || options.lifecycleIncludeMissingAsDisabled
    || options.lifecycleAutoDiscoverAll
    || options.lifecycleRevision !== null
    || options.lifecycleAdapterId !== null
    || options.lifecycleAdapterType !== null
    || options.lifecycleAdapterVersion !== null
    || options.lifecycleManifestSha256 !== null
    || options.lifecycleProtocolVersion !== null
    || options.lifecycleReason !== null;
}

export {
  CliLocalClientFailure,
  CliOnboardingFailure,
  createSafeLocalClientLifecycleFailure,
  createSafeLocalClientOnboardingFailure,
  hasExactKeys,
  isLocalClientLifecycleMutation,
  isNonNegativeSafeInteger,
  isPlainRecord,
  loadLocalClientOnboarding,
  localClientLifecycleOptionsUsed,
  localClientLifecycleOptionsUsedExcludingApply,
  projectCapabilityList,
  projectClientIdList,
  projectLocalClientDiscovery,
  projectLocalClientDiscoveryDroppedCount,
  projectLocalClientInspection,
  projectLocalClientMaintenanceSummary,
  projectLocalClientMutationResult,
  projectLocalClientOnboardingApplyReceipt,
  projectLocalClientOnboardingApproval,
  projectLocalClientOnboardingInspection,
  projectLocalClientOnboardingMutationOutcome,
  projectLocalClientOnboardingMutationResult,
  projectLocalClientOnboardingPlan,
  projectLocalClientOnboardingProfiles,
  projectLocalClientOnboardingReceiptSummary,
  projectLocalClientOnboardingVerification,
  projectLocalClientRegistry,
  projectLocalClientSmartManage,
  projectLocalClientStatus,
  projectLocalClientVerification,
  projectManagedLocalClient,
  projectOptionalCount,
  projectOptionalDeclarationFields,
  projectSafeDisplayName,
  projectSafeLifecycleLabel,
  readBoundedJsonFile,
  readBoundedLocalClientOnboardingReceipt,
  redactLocalClientOnboardingErrorCode,
  renderLocalClientLifecycle,
  renderLocalClientOnboarding,
  renderLocalClientOnboardingCommand,
  runClients,
  runClientsOnboarding,
  runLocalClientLifecycle,
  validIsoDate,
  validateLocalClientLifecycleOptions,
};
