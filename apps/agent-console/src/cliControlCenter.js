// Extracted verbatim from cli-core.js so the control-center command family
// (inspect/configure/render) lives beside the other command modules. Pure
// mechanical move; behaviour unchanged.
import {
  CONTROL_CENTER_VISIBLE_ID_PATTERN,
  CONTROL_CENTER_MODEL_PREVIEW_LIMIT,
  CONTROL_CENTER_MANIFEST_SCHEMA,
  CONTROL_CENTER_MANIFEST_SCHEMA_V2,
  CONTROL_CENTER_MANIFEST_MAX_BYTES,
  SAFE_LOCAL_CLIENT_ONBOARDING_ERROR_CODES,
  localClientOnboardingProfileFormat,
} from "./cli-constants.js";
import {
  CliUsageError,
} from "./cli-errors.js";
import {
  createSafeLocalClientOnboardingFailure,
  hasExactKeys,
  isPlainRecord,
  loadLocalClientOnboarding,
  projectLocalClientOnboardingApproval,
  projectLocalClientOnboardingMutationOutcome,
  projectLocalClientOnboardingPlan,
  projectLocalClientOnboardingVerification,
  projectLocalClientRegistry,
  projectLocalClientStatus,
  readBoundedJsonFile,
  redactLocalClientOnboardingErrorCode,
} from "./cli-local-client.js";
import { unwrapEnvelope } from "./cli-shared-helpers.js";
import { createGatewayClient } from "@unified-ai-system/shared-sdk";

function trimUrl(url) {
  return String(url ?? "").replace(/[/]+$/, "");
}

export async function runControlCenter(options, output, configRoot) {
  if (!options.adminKey) {
    throw new CliUsageError(
      "The local AI control center requires an admin key.",
      { hint: "Set AGENT_CONSOLE_ADMIN_KEY or pass --admin-key." },
    );
  }

  if ((options.positionals[0] ?? "status") === "configure") {
    return runControlCenterConfigure(options, output, configRoot);
  }
  const result = await loadControlCenterSnapshot(options);
  if (options.json) {
    output.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    renderControlCenter(result, output);
  }
  return result.ok ? 0 : 1;
}

async function loadControlCenterSnapshot(options) {
  const headers = { authorization: `Bearer ${options.adminKey}` };
  const client = createGatewayClient({
    baseUrl: options.url,
    timeoutMs: options.timeoutMs,
    headers,
  });

  let health;
  let readiness;
  let status;
  let registry;
  let onboarding;
  let modelCatalog;
  let budget;
  let stage = "snapshot";
  const startedAt = Date.now();
  try {
    const [
      healthEnvelope,
      readinessEnvelope,
      statusEnvelope,
      registryEnvelope,
      loadedOnboarding,
      modelsPayload,
      spendPayload,
    ] = await Promise.all([
      readControlCenterSurface("health", () => client.health()),
      readControlCenterSurface("setup-readiness", () => client.setupReadiness()),
      readControlCenterSurface("clients-status", () => client.localClientsStatus()),
      readControlCenterSurface("clients-registry", () => client.localClients({ includeDisabled: true, limit: 100 })),
      readControlCenterSurface("onboarding-profiles", () => loadLocalClientOnboarding(client)),
      readControlCenterSurface("models", () => fetchControlCenterJson(options, "/v1/models")),
      readControlCenterSurface("budget", () => fetchControlCenterJson(options, "/enterprise/spend-report")),
    ]);
    stage = "health";
    health = unwrapEnvelope(healthEnvelope);
    stage = "setup-readiness";
    readiness = unwrapEnvelope(readinessEnvelope);
    stage = "clients-status";
    status = projectLocalClientStatus(unwrapEnvelope(statusEnvelope));
    stage = "clients-registry";
    registry = projectLocalClientRegistry(unwrapEnvelope(registryEnvelope));
    stage = "onboarding-verification";
    onboarding = await inspectControlCenterOnboarding(client, loadedOnboarding);
    stage = "models";
    modelCatalog = projectControlCenterModels(modelsPayload);
    stage = "budget";
    budget = projectControlCenterBudget(spendPayload);
  } catch (error) {
    if (error instanceof CliControlCenterFailure) throw error;
    throw new CliControlCenterFailure(stage, error, Date.now() - startedAt);
  }

  const providers = projectControlCenterProviders(health.providers);
  const gateway = Object.freeze({
    url: options.url,
    status: boundedControlCenterText(health.status, "unknown", 64),
    providerMode: boundedControlCenterText(health.providerMode, "unknown", 64),
    realProviderEnabled: health.realProviderEnabled === true,
    chatReady: readiness.readiness?.chat?.ready === true,
    providers,
  });
  const managedClients = Object.freeze({
    status: status.status,
    executionMode: status.executionEnabled === true ? "governed-execution" : "preview-only",
    registered: registry.total,
    routable: registry.clients.filter((entry) => entry.routable === true).length,
    verified: registry.clients.filter((entry) => entry.trustDecision === "verified").length,
    onboarding,
  });
  const toolsShared = onboarding.available
    && onboarding.serverName === "unified-ai-system"
    && onboarding.transport === "stdio"
    && onboarding.installedProfileCount >= 2;
  const tools = Object.freeze({
    serverName: onboarding.serverName,
    transport: onboarding.transport,
    supportedProfileCount: onboarding.profiles.length,
    installedProfileCount: onboarding.installedProfileCount,
    sharedByMultipleClients: toolsShared,
    certificationStatus: onboarding.certificationStatus,
  });
  const checks = Object.freeze([
    controlCenterCheck(
      "gateway",
      gateway.status === "ready" && gateway.chatReady,
      "Gateway health and chat readiness",
    ),
    controlCenterCheck(
      "models",
      modelCatalog.count > 0,
      "At least one model is exposed through the shared gateway URL",
    ),
    controlCenterCheck(
      "budget",
      budget.activeKeys > 0,
      "At least one active tenant virtual key is governed by the shared budget ledger",
    ),
    controlCenterCheck(
      "clients",
      onboarding.installedProfileCount >= 2,
      "At least two client profiles point to the same gateway-managed MCP server",
    ),
    controlCenterCheck(
      "tools",
      toolsShared,
      "Installed client profiles share the unified-ai-system stdio MCP server",
    ),
  ]);
  const nextActions = buildControlCenterNextActions({
    checks,
    onboarding,
  });
  const result = Object.freeze({
    ok: checks.every((check) => check.ready),
    command: "control-center",
    mode: "read-only",
    writesPerformed: false,
    gateway,
    shared: Object.freeze({
      models: modelCatalog,
      budget,
      tools,
    }),
    clients: managedClients,
    checks,
    nextActions,
    assurance: Object.freeze({
      level: "control-plane-observed",
      nativeModelLoginRerouted: false,
      realClientCertified: false,
      limitations: Object.freeze([
        "MCP onboarding does not reroute a client's native login or native model channel.",
        "This read-only snapshot does not certify a real client or a real Provider call.",
      ]),
    }),
  });

  return result;
}

async function runControlCenterConfigure(options, output, configRoot) {
  const manifest = readControlCenterManifest({
    path: options.controlCenterManifestFile,
    root: configRoot,
    expectedGatewayUrl: options.url,
  });
  const snapshot = await loadControlCenterSnapshot(options);
  const requiredCheckIds = new Set(["gateway", "models", "budget"]);
  const coreChecks = snapshot.checks.filter((check) => requiredCheckIds.has(check.id));
  const profilesById = new Map(
    snapshot.clients.onboarding.profiles.map((profile) => [profile.profileId, profile]),
  );
  const selectedProfiles = manifest.profiles.map((profileId) => {
    const profile = profilesById.get(profileId);
    return profile
      ? Object.freeze({
          ...profile,
          serverName: snapshot.shared.tools.serverName,
          transport: snapshot.shared.tools.transport,
        })
      : null;
  });
  const preflightReady = coreChecks.every((check) => check.ready)
    && snapshot.clients.onboarding.available
    && snapshot.shared.tools.serverName === "unified-ai-system"
    && selectedProfiles.every(Boolean);
  if (!preflightReady) {
    const result = Object.freeze({
      ok: false,
      command: "control-center",
      operation: "configure",
      mode: "preflight",
      clientConfigWritesPerformed: false,
      manifest,
      plans: Object.freeze([]),
      completed: Object.freeze([]),
      retryAllowed: false,
      atomicAcrossClients: false,
      status: "preflight-failed",
      nextActions: snapshot.nextActions,
    });
    writeControlCenterConfigureResult(result, options, output);
    return 1;
  }

  const client = createGatewayClient({
    baseUrl: options.url,
    timeoutMs: options.timeoutMs,
    headers: { authorization: `Bearer ${options.adminKey}` },
  });
  const plans = [];
  const planningStartedAt = Date.now();
  try {
    for (const profileId of manifest.profiles) {
      const request = { profileId, action: "enable" };
      plans.push(projectLocalClientOnboardingPlan(
        unwrapEnvelope(await client.planGovernedLocalClientOnboarding(request)),
        request,
      ));
    }
  } catch (error) {
    throw new CliControlCenterFailure("onboarding-plan", error, Date.now() - planningStartedAt);
  }

  if (!options.lifecycleApply) {
    const result = Object.freeze({
      ok: true,
      command: "control-center",
      operation: "configure",
      mode: "plan",
      clientConfigWritesPerformed: false,
      manifest,
      plans: Object.freeze(plans),
      completed: Object.freeze([]),
      retryAllowed: false,
      atomicAcrossClients: false,
      status: "planned",
      nextAction:
        "Review this exact output, then run configure --apply --yes with an explicit idempotency-key prefix.",
    });
    writeControlCenterConfigureResult(result, options, output);
    return 0;
  }

  const completed = [];
  let failure = null;
  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index];
    let mutationOperation = "approve";
    try {
      const approval = projectLocalClientOnboardingApproval(
        unwrapEnvelope(await client.approveGovernedLocalClientOnboarding(
          { planId: plan.planId },
          { idempotencyKey: `${options.idempotencyKey}:approve:${index + 1}` },
        )),
        plan.planId,
      );
      mutationOperation = "apply";
      const outcome = projectLocalClientOnboardingMutationOutcome(
        unwrapEnvelope(await client.applyGovernedLocalClientOnboarding(
          { planId: plan.planId },
          { idempotencyKey: `${options.idempotencyKey}:apply:${index + 1}` },
        )),
        "apply",
        plan.planId,
      );
      if (outcome.result.profileId !== plan.profileId || outcome.result.action !== "enable") {
        throw new Error("control-center apply result did not match its plan");
      }
      completed.push(Object.freeze({
        profileId: plan.profileId,
        planId: plan.planId,
        approvalId: approval.approvalId,
        status: outcome.status,
        idempotencyStatus: outcome.idempotencyStatus,
        receipt: outcome.result.receipt,
      }));
    } catch (error) {
      const safe = createSafeLocalClientOnboardingFailure(error, {
        operation: mutationOperation,
        mutation: true,
      });
      failure = Object.freeze({
        operation: mutationOperation,
        profileId: plan.profileId,
        planId: plan.planId,
        status: safe.status,
        code: safe.code,
        retryAllowed: false,
      });
      break;
    }
  }

  const selectedOnboarding = Object.freeze({
    available: true,
    profiles: Object.freeze(selectedProfiles),
    certificationStatus: snapshot.clients.onboarding.certificationStatus,
  });
  const verification = await inspectControlCenterOnboarding(client, selectedOnboarding);
  const allExact = verification.profiles.length === manifest.profiles.length
    && verification.profiles.every((profile) => profile.installed && profile.state === "exact");
  const ok = failure === null && completed.length === plans.length && allExact;
  const clientConfigOutcomeUnknown = failure?.operation === "apply"
    && failure.status === "unknown-reconcile-required";
  const result = Object.freeze({
    ok,
    command: "control-center",
    operation: "configure",
    mode: "governed-mutation",
    clientConfigWritesPerformed: completed.length > 0 ? true : clientConfigOutcomeUnknown ? null : false,
    clientConfigOutcomeUnknown,
    manifest,
    plans: Object.freeze(plans),
    completed: Object.freeze(completed),
    verification,
    ...(failure === null ? {} : { failure }),
    retryAllowed: false,
    atomicAcrossClients: false,
    automaticRollbackPerformed: false,
    status: ok ? "completed" : completed.length > 0 ? "partial" : clientConfigOutcomeUnknown ? "unknown-reconcile-required" : "failed",
    nextAction: ok
      ? "Restart or reload each configured client, then rerun control-center for a fresh runtime observation."
      : "Do not retry automatically. Preserve completed receipts and reconcile the failed profile first.",
  });
  writeControlCenterConfigureResult(result, options, output);
  return ok ? 0 : 1;
}

function readControlCenterManifest({ path, root, expectedGatewayUrl }) {
  const value = readBoundedJsonFile({
    path,
    root,
    label: "Control-center manifest",
    maxBytes: CONTROL_CENTER_MANIFEST_MAX_BYTES,
  });
  if (
    !hasExactKeys(value, ["schema", "gatewayUrl", "profiles"])
    || ![CONTROL_CENTER_MANIFEST_SCHEMA, CONTROL_CENTER_MANIFEST_SCHEMA_V2].includes(value.schema)
    || typeof value.gatewayUrl !== "string"
    || !Array.isArray(value.profiles)
    || value.profiles.length < 2
    || value.profiles.length > (value.schema === CONTROL_CENTER_MANIFEST_SCHEMA ? 3 : 6)
    || new Set(value.profiles).size !== value.profiles.length
    || value.profiles.some((profileId) => !localClientOnboardingProfileFormat(profileId)
      || (value.schema === CONTROL_CENTER_MANIFEST_SCHEMA && localClientOnboardingProfileFormat(profileId) !== "json-only"))
  ) {
    throw new CliUsageError(
      "Control-center manifest must select unique supported profiles: v1 accepts two or three JSON profiles; v2 accepts two to six profiles.",
    );
  }
  const gatewayUrl = normalizeControlCenterGatewayUrl(value.gatewayUrl);
  if (gatewayUrl !== normalizeControlCenterGatewayUrl(expectedGatewayUrl)) {
    throw new CliUsageError("Control-center manifest gatewayUrl must exactly match --url.");
  }
  return Object.freeze({
    schema: value.schema,
    gatewayUrl,
    profiles: Object.freeze([...value.profiles]),
  });
}

function normalizeControlCenterGatewayUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new CliUsageError("Control-center manifest gatewayUrl is invalid.");
  }
  if (
    !new Set(["http:", "https:"]).has(parsed.protocol)
    || parsed.username.length > 0
    || parsed.password.length > 0
    || parsed.search.length > 0
    || parsed.hash.length > 0
  ) {
    throw new CliUsageError(
      "Control-center manifest gatewayUrl must be an http(s) URL without credentials, query, or fragment.",
    );
  }
  return trimUrl(parsed.toString());
}

function writeControlCenterConfigureResult(result, options, output) {
  if (options.json) {
    output.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  const lines = [
    "",
    output.bold("Local AI control center configuration"),
    `Status: ${result.status}`,
    `Mode: ${result.mode}`,
    `Profiles: ${result.manifest.profiles.join(", ")}`,
    `Plans: ${result.plans.length}`,
    `Completed: ${result.completed.length}`,
    ...(result.clientConfigOutcomeUnknown ? ["Client configuration outcome: unknown; reconcile before another mutation."] : []),
    `Cross-client atomicity: ${result.atomicAcrossClients ? "yes" : "no"}`,
    `Automatic retry: ${result.retryAllowed ? "allowed" : "forbidden"}`,
    "",
    ...result.plans.map((plan) => `  - ${plan.profileId}: ${plan.planId}`),
    "",
    result.nextAction ?? result.nextActions?.join(" ") ?? "",
    output.muted("Use --json and preserve every redacted receipt before a mutation."),
    "",
  ];
  output.write(`${lines.join("\n")}\n`);
}

async function fetchControlCenterJson(options, path) {
  let response;
  try {
    response = await fetch(`${trimUrl(options.url)}${path}`, {
      headers: { authorization: `Bearer ${options.adminKey}` },
      redirect: "error",
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch {
    throw new Error("CONTROL_CENTER_NETWORK_UNAVAILABLE");
  }
  if (!response.ok) {
    throw new Error(`CONTROL_CENTER_HTTP_${response.status}`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error("CONTROL_CENTER_RESPONSE_INVALID");
  }
}

async function readControlCenterSurface(surface, read) {
  const startedAt = Date.now();
  try { return await read(); }
  catch (error) { throw new CliControlCenterFailure(surface, error, Date.now() - startedAt); }
}

export class CliControlCenterFailure extends Error {
  constructor(surface, cause, durationMs) {
    super(`The control-center could not read ${surface}.`);
    this.surface = surface;
    const knownCode = typeof cause?.code === "string" && SAFE_LOCAL_CLIENT_ONBOARDING_ERROR_CODES.has(cause.code)
      ? cause.code
      : typeof cause?.message === "string" && /^CONTROL_CENTER_(?:HTTP_[1-5]\d{2}|NETWORK_UNAVAILABLE|RESPONSE_INVALID)$/u.test(cause.message)
        ? cause.message
        : "CONTROL_CENTER_RESPONSE_INVALID";
    this.code = knownCode;
    this.durationMs = Number.isFinite(durationMs) ? Math.max(0, Math.floor(durationMs)) : null;
  }
}

async function inspectControlCenterOnboarding(client, onboarding) {
  if (!onboarding.available) {
    return Object.freeze({
      available: false,
      code: onboarding.code,
      serverName: null,
      transport: null,
      certificationStatus: null,
      installedProfileCount: 0,
      profiles: Object.freeze([]),
    });
  }
  const installations = await Promise.all(onboarding.profiles.map(async (profile) => {
    try {
      const value = projectLocalClientOnboardingVerification(
        unwrapEnvelope(await client.verifyLocalClientOnboardingProfile(profile.profileId)),
        profile.profileId,
      );
      return Object.freeze({
        profileId: profile.profileId,
        client: profile.client,
        installed: value.installed,
        state: value.state,
      });
    } catch (error) {
      return Object.freeze({
        profileId: profile.profileId,
        client: profile.client,
        installed: false,
        state: "unavailable",
        code: redactLocalClientOnboardingErrorCode(error),
      });
    }
  }));
  const serverNames = new Set(onboarding.profiles.map((profile) => profile.serverName));
  const transports = new Set(onboarding.profiles.map((profile) => profile.transport));
  return Object.freeze({
    available: true,
    serverName: serverNames.size === 1 ? [...serverNames][0] : null,
    transport: transports.size === 1 ? [...transports][0] : null,
    certificationStatus: onboarding.certificationStatus,
    installedProfileCount: installations.filter((entry) => entry.installed).length,
    profiles: Object.freeze(installations),
  });
}

function projectControlCenterProviders(rawProviders) {
  if (!Array.isArray(rawProviders) || rawProviders.length > 1_000) {
    throw new Error("invalid control-center provider list");
  }
  return Object.freeze(rawProviders.map((provider) => {
    const id = provider?.id ?? provider?.name;
    if (!CONTROL_CENTER_VISIBLE_ID_PATTERN.test(id ?? "")) {
      throw new Error("invalid control-center provider identifier");
    }
    return id;
  }));
}

function projectControlCenterModels(payload) {
  if (
    !isPlainRecord(payload)
    || payload.object !== "list"
    || !Array.isArray(payload.data)
    || payload.data.length > 10_000
  ) {
    throw new Error("invalid control-center model response");
  }
  const models = payload.data.map((model) => {
    const id = model?.id;
    const providerId = model?.unified_ai?.provider_id ?? model?.owned_by;
    const executionMode = model?.unified_ai?.execution_mode ?? "unknown";
    if (
      !CONTROL_CENTER_VISIBLE_ID_PATTERN.test(id ?? "")
      || !CONTROL_CENTER_VISIBLE_ID_PATTERN.test(providerId ?? "")
      || !new Set(["fake", "real", "unknown"]).has(executionMode)
    ) {
      throw new Error("invalid control-center model record");
    }
    return Object.freeze({ id, providerId, executionMode });
  });
  const preview = models.slice(0, CONTROL_CENTER_MODEL_PREVIEW_LIMIT);
  return Object.freeze({
    count: models.length,
    items: Object.freeze(preview),
    truncated: preview.length !== models.length,
  });
}

function projectControlCenterBudget(payload) {
  const data = unwrapEnvelope(payload);
  const totals = data?.totals;
  const fields = ["keys", "activeKeys", "tokensUsed", "requestCount", "keysOverSoftBudget"];
  if (
    !isPlainRecord(data)
    || !isPlainRecord(totals)
    || !fields.every((field) => Number.isSafeInteger(totals[field]) && totals[field] >= 0)
  ) {
    throw new Error("invalid control-center budget response");
  }
  return Object.freeze({
    window: boundedControlCenterText(data.window, "current-budget-window", 128),
    keys: totals.keys,
    activeKeys: totals.activeKeys,
    tokensUsed: totals.tokensUsed,
    requestCount: totals.requestCount,
    keysOverSoftBudget: totals.keysOverSoftBudget,
  });
}

function boundedControlCenterText(value, fallback, maximum) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maximum
    && !/[\u0000-\u001f\u007f]/u.test(value)
    ? value
    : fallback;
}

function controlCenterCheck(id, ready, detail) {
  return Object.freeze({ id, ready, detail });
}

function buildControlCenterNextActions({ checks, onboarding }) {
  const missing = new Set(checks.filter((check) => !check.ready).map((check) => check.id));
  const actions = [];
  if (missing.has("gateway")) actions.push("Run: pnpm gateway status");
  if (missing.has("models")) actions.push("Configure at least one gateway model and repeat control-center.");
  if (missing.has("budget")) actions.push("Create or activate a tenant virtual key with a reviewed budget.");
  if (missing.has("clients") || missing.has("tools")) {
    if (!onboarding.available || onboarding.profiles.length === 0) {
      actions.push("Enable governed local-client onboarding and inspect its registered profiles.");
    } else {
      actions.push(
        "Plan the reviewed manifest: pnpm gateway control-center configure --manifest docs/examples/local-ai-control-center.json --json",
      );
    }
  }
  return Object.freeze(actions);
}

function renderControlCenter(result, output) {
  const mark = (ready) => ready ? output.green("[ready]") : output.yellow("[setup]");
  const checks = new Map(result.checks.map((check) => [check.id, check]));
  const profiles = result.clients.onboarding.profiles;
  const lines = [
    "",
    output.bold("Local AI control center"),
    output.muted("One read-only view of shared models, budget, tools, and clients"),
    "",
    `  ${mark(checks.get("gateway").ready)} gateway  ${result.gateway.status}; chat ${result.gateway.chatReady ? "ready" : "needs attention"}`,
    `  ${mark(checks.get("models").ready)} models   ${result.shared.models.count} through ${result.gateway.url}`,
    `  ${mark(checks.get("budget").ready)} budget   ${result.shared.budget.activeKeys} active keys; ${result.shared.budget.tokensUsed} tokens used`,
    `  ${mark(checks.get("clients").ready)} clients  ${result.shared.tools.installedProfileCount}/${result.shared.tools.supportedProfileCount} onboarding profiles installed`,
    `  ${mark(checks.get("tools").ready)} tools    ${result.shared.tools.serverName ?? "unavailable"} via ${result.shared.tools.transport ?? "unavailable"}`,
    "",
    ...profiles.map((profile) => `  - ${profile.client}: ${profile.state}`),
    "",
    result.ok
      ? output.green("Control center ready for multiple opted-in clients.")
      : output.yellow("Control center needs setup before multiple clients share the gateway."),
    output.muted("Read-only inspection; no client config, credential, model route, or budget was changed."),
  ];
  if (result.nextActions.length > 0) {
    lines.push("", output.bold("Next actions"), ...result.nextActions.map((action) => `  - ${action}`));
  }
  lines.push("");
  output.write(`${lines.join("\n")}\n`);
}
