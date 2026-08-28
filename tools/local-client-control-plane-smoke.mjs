#!/usr/bin/env node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID,
  createLocalClientAdapterRegistry,
} from "../apps/ai-gateway-service/src/capabilities/localClientAdapterRegistry.ts";
import { createLocalClientManagementService } from "../apps/ai-gateway-service/src/capabilities/localClientManagementService.ts";
import { createLocalClientRoutePlanStore } from "../apps/ai-gateway-service/src/capabilities/localClientRoutePlanStore.ts";
import { createLocalClientExecutionPreview } from "../apps/ai-gateway-service/src/capabilities/localClientExecutionPreview.ts";
import { createLocalClientProviderRuntimeRouter } from "../apps/ai-gateway-service/src/routing/localClientProviderRuntimeRouter.ts";
import { createConfiguredLocalClientProviderPolicyResolver } from "../apps/ai-gateway-service/src/routing/localClientProviderPolicyConfig.ts";

const rootDir = await mkdtemp(join(tmpdir(), "unified-ai-local-client-smoke-"));
const scope = Object.freeze({
  tenantId: "credential-free-smoke-tenant",
  userId: "credential-free-smoke-subject",
});
let processDiscoveryCalled = false;
let output;

try {
  const adapterRegistry = createLocalClientAdapterRegistry();
  const routePlanStore = createLocalClientRoutePlanStore();
  const service = createLocalClientManagementService({
    registryPath: join(rootDir, "registry.json"),
    executionLogPath: join(rootDir, "execution-log.jsonl"),
    discoveryHintsPath: join(rootDir, "discovery-hints.json"),
    adapterRegistry,
    executionEnabled: false,
    registryIntegrityKey: Buffer.alloc(32, 0x73),
    processRowsProvider: async () => {
      processDiscoveryCalled = true;
      throw new Error("process discovery is forbidden in the credential-free smoke");
    },
  });

  const initialStatus = await service.getStatus(scope);
  const registration = await service.register({
    clientId: "credential-free-smoke-client",
    displayName: "Credential-free Smoke Client",
    capabilityIds: ["browser", "web_automation"],
  }, scope);
  const route = await service.route({
    taskText: "credential-free route smoke",
    requiredCapabilities: ["browser"],
  }, scope);
  const executionPreview = await service.execute({
    clientId: "credential-free-smoke-client",
    action: "inspect",
    requiredCapabilities: ["browser"],
    dryRun: false,
    arguments: { privateInput: "must-not-appear-in-output" },
  }, scope);
  const revocation = await service.revoke({
    clientId: "credential-free-smoke-client",
    expectedRevision: registration.client.revision,
    reason: "manual_revoke",
  }, scope);
  const registry = await service.list({ includeDisabled: true, limit: 10 }, scope);

  const providerPolicyResolver = createConfiguredLocalClientProviderPolicyResolver({});
  const providerRouter = createLocalClientProviderRuntimeRouter({
    providerRegistry: {
      listDescriptors: () => [{
        id: "credential-free-provider",
        metadata: { routingRegion: "local" },
        models: [{
          id: "credential-free-model",
          enabled: true,
          capabilities: ["chat", "reasoning"],
          costTier: "free",
          metadata: {
            routingRegion: "local",
            routingCostUsd: 0,
            routingQuotaRemaining: 1,
          },
        }],
      }],
    },
    healthFacts: {
      getScore: () => 100,
      getSnapshot: () => ({ sampleCount: 1, successRate: 1, p50LatencyMs: 0 }),
    },
    resolvePolicy: (input) => providerPolicyResolver.resolve(input),
    authorizeClient: async ({ clientId }) => ({
      descriptorVersion: "verified-local-client-adapter-target-v1",
      clientId,
      revision: 1,
      state: "verified",
      trustDecision: "verified",
      adapter: { id: "smoke.adapter", type: "smoke-governed", version: "1.0.0" },
      capabilityIds: ["local_application"],
    }),
  });
  const providerRoute = await providerRouter.route({
    tenantId: scope.tenantId,
    subjectId: scope.userId,
    clientId: "credential-free-smoke-client",
    requiredCapabilities: ["reasoning"],
    requestedFanout: 1,
    fusionRequested: false,
  });

  const fakeDescriptor = adapterRegistry.lookup(BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID);
  if (!fakeDescriptor) throw new Error("built-in fake local-client adapter is missing");
  const fakeAction = fakeDescriptor.actions[0];
  const adapterInput = { requestTag: "credential-free-smoke", sequence: 1 };
  const routePlan = routePlanStore.create({
    tenantId: scope.tenantId,
    subjectId: scope.userId,
    target: {
      descriptorVersion: "verified-local-client-adapter-target-v1",
      clientId: "credential-free-fake-target",
      revision: 1,
      state: "verified",
      trustDecision: "verified",
      adapter: {
        id: fakeDescriptor.id,
        type: fakeDescriptor.type,
        version: fakeDescriptor.version,
      },
      capabilityIds: [fakeAction.capabilityId],
    },
    capabilityId: fakeAction.capabilityId,
    actionId: fakeAction.actionId,
    input: adapterInput,
    policyVersion: "credential-free-smoke-policy-v1",
  });
  const fakeReceipt = await adapterRegistry.execute({
    executionId: `lc-exec-${"1".repeat(64)}`,
    tenantId: scope.tenantId,
    subjectId: scope.userId,
    client: {
      descriptorVersion: "verified-local-client-adapter-target-v1",
      clientId: "credential-free-fake-target",
      state: "verified",
      trustDecision: "verified",
      adapter: {
        id: fakeDescriptor.id,
        type: fakeDescriptor.type,
        version: fakeDescriptor.version,
      },
      capabilityIds: [fakeAction.capabilityId],
    },
    capabilityId: fakeAction.capabilityId,
    actionId: fakeAction.actionId,
    input: adapterInput,
    receiptReconciliation: null,
    signal: new AbortController().signal,
    assertAuthority: async () => true,
  });
  const governedPreview = createLocalClientExecutionPreview({
    routePlanStore,
    adapterRegistry,
    resolveVerifiedTarget: async () => ({
      descriptorVersion: "verified-local-client-adapter-target-v1",
      clientId: "credential-free-fake-target",
      revision: 1,
      state: "verified",
      trustDecision: "verified",
      adapter: {
        id: fakeDescriptor.id,
        type: fakeDescriptor.type,
        version: fakeDescriptor.version,
      },
      capabilityIds: [fakeAction.capabilityId],
    }),
  }, { policyVersion: "credential-free-smoke-policy-v1" });
  let fakeGovernedPreviewRejected = false;
  try {
    await governedPreview.preview({
      tenantId: scope.tenantId,
      subjectId: scope.userId,
      clientId: "credential-free-fake-target",
      capabilityId: fakeAction.capabilityId,
      actionId: fakeAction.actionId,
      input: adapterInput,
    });
  } catch (error) {
    fakeGovernedPreviewRejected = error?.code === "LOCAL_CLIENT_EXECUTION_PREVIEW_FAKE_ADAPTER_DENIED";
  }
  routePlanStore.consume({
    tenantId: scope.tenantId,
    subjectId: scope.userId,
    planId: routePlan.planId,
  });
  let duplicatePlanConsumeRejected = false;
  try {
    routePlanStore.consume({
      tenantId: scope.tenantId,
      subjectId: scope.userId,
      planId: routePlan.planId,
    });
  } catch (error) {
    duplicatePlanConsumeRejected = error?.code === "LOCAL_CLIENT_ROUTE_PLAN_ALREADY_CONSUMED";
  }

  const serializedPublicData = JSON.stringify({
    initialStatus,
    registration,
    route,
    executionPreview,
    revocation,
    registry,
    providerRoute,
    routePlan,
    fakeReceipt,
  });
  const forbiddenPublicFields = [
    "privateInput",
    "registryPath",
    "executionLogPath",
    "discoveryHintsPath",
    "executable",
    "command",
    "processPid",
    "metadata",
  ];
  const checks = {
    initialPreviewOnly: initialStatus.executionEnabled === false
      && initialStatus.boundaries?.previewOnly === true,
    tenantScoped: initialStatus.boundaries?.tenantScoped === true,
    fakeAdapterWired: initialStatus.boundaries?.fakeAdapterConfigured === true,
    registeredDeclaredClient: registration.client?.state === "declared"
      && registration.client?.routable === true,
    exactRouteReady: route.status === "route-ready"
      && route.selected?.clientId === "credential-free-smoke-client",
    executionPreviewOnly: executionPreview.status === "preview-only"
      && executionPreview.executionEnabled === false
      && executionPreview.dryRun === true,
    fakeReceiptExplicit: fakeReceipt.executionMode === "fake"
      && fakeReceipt.externalEffectPerformed === false
      && fakeReceipt.status === "simulated",
    trustedProviderRuntimeRoute: providerRoute.dispatchPerformed === false
      && providerRoute.boundaries?.candidatesFromTrustedRegistry === true
      && providerRoute.boundaries?.policyFromTrustedResolver === true
      && providerRoute.decision?.selected?.[0]?.provider === "credential-free-provider",
    fakeCannotCreateGovernedPreview: fakeGovernedPreviewRejected,
    routePlanHashOnly: routePlan.planId.length === 64
      && routePlan.inputSha256.length === 64
      && !("input" in routePlan)
      && routePlan.boundaries?.grantsApproval === false
      && routePlan.boundaries?.providesExternalEffectFence === false,
    routePlanOneTimeConsume: duplicatePlanConsumeRejected,
    revocationSticky: revocation.client?.state === "revoked"
      && revocation.client?.routable === false
      && registry.clients?.[0]?.state === "revoked",
    noProcessDiscovery: processDiscoveryCalled === false,
    publicDataRedacted: forbiddenPublicFields.every((field) => !serializedPublicData.includes(field)),
  };
  output = {
    ok: Object.values(checks).every(Boolean),
    checks,
    executionMode: "fake-and-preview-only",
    realProviderCallsMade: false,
    localApplicationEffectPerformed: false,
    managedClientCount: registry.total,
    selectedClientId: route.selected?.clientId ?? null,
    routePlanId: routePlan.planId,
    fakeReceipt,
  };
} catch (error) {
  output = {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    executionMode: "failed-closed",
    realProviderCallsMade: false,
    localApplicationEffectPerformed: false,
    processDiscoveryCalled,
  };
  process.exitCode = 1;
} finally {
  await rm(rootDir, { recursive: true, force: true });
}

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
