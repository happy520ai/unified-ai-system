import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LOCAL_CLIENT_ONBOARDING_PROFILE_IDS,
  createLocalClientOnboardingRegistry,
  type LocalClientOnboardingProfileId,
  type LocalClientOnboardingReceipt,
  type LocalClientOnboardingRegistry,
} from "./localClientOnboardingRegistry.ts";
import {
  createLocalClientGovernedOnboardingApi,
  type LocalClientOnboardingReceiptAuthorityStorePort,
  type LocalClientGovernedOnboardingDependencies,
  type LocalClientGovernedOnboardingMutationOutcome,
} from "./localClientGovernedOnboardingApi.ts";
import {
  createIdempotencyCoordinator,
  type IdempotencyCoordinator,
} from "../http/idempotencyCoordinator.ts";
import {
  createLocalClientSqliteOnboardingReceiptAuthorityStore,
  type LocalClientSqliteOnboardingReceiptAuthorityStore,
} from "./localClientSqliteOnboardingReceiptAuthorityStore.ts";

const IDENTITY_A = Object.freeze({ tenantId: "tenant-a", subjectId: "subject-a" });
const IDENTITY_B = Object.freeze({ tenantId: "tenant-b", subjectId: "subject-b" });
const PROFILE_ID = LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.cursor;
const NOW_MS = Date.parse("2026-08-28T14:00:00.000Z");
const PRIVATE_COMMAND = "C:\\private\\gateway-command.exe";
const PRIVATE_ARGUMENT = "--private-config-value";


// The governed onboarding harness always composes the durable SQLite
// idempotency and receipt-authority stores, which fail closed unless the
// runtime provides node:sqlite defensive mode; this suite runs only where
// that capability exists.
const durableLocalClientSqliteSupported = (() => {
  try {
    const probe = new DatabaseSync(":memory:");
    try {
      return typeof (probe as DatabaseSync & {
        enableDefensive?: unknown;
      }).enableDefensive === "function";
    } finally {
      probe.close();
    }
  } catch {
    return false;
  }
})();
const describeDurableLocalClientSqlite = durableLocalClientSqliteSupported
  ? describe
  : describe.skip;

describeDurableLocalClientSqlite("governed local-client onboarding API", () => {
  let root: string;
  let paths: ReturnType<typeof profilePaths>;
  let closeables: Array<{ close(): unknown | Promise<unknown> }>;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "local-client-governed-onboarding-"));
    paths = profilePaths(root);
    closeables = [];
    await initializeProfileFiles(paths);
  });

  afterEach(async () => {
    await Promise.all(closeables.map((coordinator) => coordinator.close()));
    await rm(root, { recursive: true, force: true });
  });

  async function createHarness(overrides: Partial<HarnessOptions> = {}) {
    const registry = overrides.registry ?? await createRegistry(paths);
    const registryPort = registryPortFor(registry, overrides.registryApply);
    const approval = createApprovalHarness(overrides.consumeMode);
    const idempotencyCoordinator = overrides.idempotencyCoordinator
      ?? durableIdempotency(join(root, `idempotency-${closeables.length}.sqlite`));
    if (!overrides.idempotencyCoordinator) closeables.push(idempotencyCoordinator);
    const external = createExternalEffectHarness(overrides.externalMode);
    let receiptAuthorityStore: LocalClientOnboardingReceiptAuthorityStorePort;
    if (overrides.receiptAuthorityStore) {
      receiptAuthorityStore = overrides.receiptAuthorityStore;
    } else {
      const createdAuthority = durableReceiptAuthority(
        join(root, `receipt-authority-${closeables.length}.sqlite`),
      );
      closeables.push(createdAuthority);
      receiptAuthorityStore = createdAuthority;
    }
    const dependencies: LocalClientGovernedOnboardingDependencies = {
      registry: registryPort,
      approvalGate: {
        approve: approval.approve,
        consume: approval.consume,
      },
      idempotencyCoordinator,
      externalEffectGate: {
        status: overrides.externalStatus ?? {
          mode: "sqlite",
          enabled: true,
          durable: true,
          distributed: false,
        },
        reserve: external.reserve,
      },
      receiptAuthorityStore,
    };
    const api = createLocalClientGovernedOnboardingApi(dependencies, { now: () => NOW_MS });
    return {
      api,
      registry,
      registryPort,
      approval,
      external,
      idempotencyCoordinator,
      receiptAuthorityStore,
    };
  }

  it("keeps list, inspect, plan, and verify write-free and redacted", async () => {
    const harness = await createHarness();
    const before = await snapshotProfileFiles(paths);

    const profiles = await harness.api.list(IDENTITY_A);
    const inspection = await harness.api.inspect({ ...IDENTITY_A, profileId: PROFILE_ID });
    const plan = await harness.api.plan({
      ...IDENTITY_A,
      profileId: PROFILE_ID,
      action: "enable",
    });
    const verification = await harness.api.verify({ ...IDENTITY_A, profileId: PROFILE_ID });

    expect(profiles).toHaveLength(3);
    expect(inspection).toMatchObject({
      installation: { state: "absent", installed: false },
      recoveryRequired: false,
    });
    expect(plan).toMatchObject({
      action: "enable",
      profileId: PROFILE_ID,
      writesPerformed: false,
      redacted: true,
      planDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      scopes: [
        "local-client:onboarding",
        "local-client:onboarding:enable",
        `local-client:onboarding:profile:${PROFILE_ID}`,
      ],
    });
    expect(verification).toMatchObject({ state: "absent", installed: false });
    expect(await snapshotProfileFiles(paths)).toEqual(before);
    assertRedacted({ profiles, inspection, plan, verification });
  });

  it("re-reads the stored identity-bound plan and derives exact digest and scopes for approval", async () => {
    const harness = await createHarness();
    const idempotencyExecute = vi.spyOn(harness.idempotencyCoordinator, "execute");
    const plan = await harness.api.plan({
      ...IDENTITY_A,
      profileId: PROFILE_ID,
      action: "enable",
    });

    const approvalRequest = {
      ...IDENTITY_A,
      planId: plan.planId,
      note: "explicit operator approval",
    };
    const approvalPort = requestPort("approval-exact-key");
    const approved = await harness.api.approve(approvalRequest, approvalPort);
    const replay = await harness.api.approve(approvalRequest, approvalPort);

    expect(harness.approval.approve).toHaveBeenCalledWith({
      planId: plan.planId,
      tenantId: IDENTITY_A.tenantId,
      userId: IDENTITY_A.subjectId,
      planDigest: plan.planDigest,
      approvedScopes: plan.scopes,
      note: "explicit operator approval",
    });
    expect(approved).toMatchObject({
      status: "approved",
      planId: plan.planId,
      planDigest: plan.planDigest,
      scopes: plan.scopes,
      writesPerformed: false,
      redacted: true,
    });
    expect(replay).toEqual(approved);
    expect(harness.approval.approve).toHaveBeenCalledTimes(1);
    expect(harness.external.reserve).not.toHaveBeenCalled();
    expect(idempotencyExecute).toHaveBeenCalledTimes(2);
    const persistedPayload = JSON.stringify(idempotencyExecute.mock.calls[0]![0].payload);
    expect(persistedPayload).not.toContain("explicit operator approval");
    expect(persistedPayload).toContain(sha256("explicit operator approval"));
    assertRedacted({ approved, replay });
  });

  it("binds approval idempotency to the note fingerprint and rejects same-key changes", async () => {
    const harness = await createHarness();
    const plan = await harness.api.plan({ ...IDENTITY_A, profileId: PROFILE_ID, action: "enable" });
    const port = requestPort("approval-note-conflict-key");
    await harness.api.approve({
      ...IDENTITY_A,
      planId: plan.planId,
      note: "first bounded note",
    }, port);

    await expect(harness.api.approve({
      ...IDENTITY_A,
      planId: plan.planId,
      note: "different bounded note",
    }, port)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_APPROVAL_IDEMPOTENCY_CONFLICT",
      statusCode: 409,
    });
    expect(harness.approval.approve).toHaveBeenCalledTimes(1);
  });

  it("applies once and durably replays without a second file mutation", async () => {
    const harness = await createHarness();
    const plan = await planAndApprove(harness, "enable");
    const request = { ...IDENTITY_A, planId: plan.planId };
    const port = requestPort("apply-replay-key");

    const first = await harness.api.apply(request, port);
    const replay = await harness.api.apply(request, port);

    expectCompleted(first, false);
    expectCompleted(replay, true);
    expect(harness.registryPort.apply).toHaveBeenCalledTimes(1);
    expect(harness.approval.consume).toHaveBeenCalledTimes(1);
    expect(harness.approval.consume).toHaveBeenCalledWith({
      planId: plan.planId,
      tenantId: IDENTITY_A.tenantId,
      userId: IDENTITY_A.subjectId,
      planDigest: plan.planDigest,
      requiredScopes: plan.scopes,
    });
    expect(harness.external.reserve).toHaveBeenCalledTimes(1);
    expect(harness.external.commit).toHaveBeenCalledTimes(1);
    expect(JSON.parse(await readFile(paths.cursor.targetPath, "utf8"))).toMatchObject({
      mcpServers: {
        "unified-ai-system": {
          command: PRIVATE_COMMAND,
          args: [PRIVATE_ARGUMENT],
        },
      },
    });
    assertRedacted({ first, replay });
  });

  it("coordinates concurrent same-key apply calls with one approval and one mutation", async () => {
    const harness = await createHarness();
    const plan = await planAndApprove(harness, "enable");
    const request = { ...IDENTITY_A, planId: plan.planId };
    const port = requestPort("concurrent-key");

    const [left, right] = await Promise.all([
      harness.api.apply(request, port),
      harness.api.apply(request, port),
    ]);

    expect([left.status, right.status].sort()).toEqual(["completed", "replayed"]);
    expect(harness.registryPort.apply).toHaveBeenCalledTimes(1);
    expect(harness.approval.consume).toHaveBeenCalledTimes(1);
    expect(harness.external.commit).toHaveBeenCalledTimes(1);
  });

  it("rejects same-key different-plan conflicts without mutating the second profile", async () => {
    const harness = await createHarness();
    const cursorPlan = await planAndApprove(harness, "enable", PROFILE_ID);
    const vscodePlan = await planAndApprove(
      harness,
      "enable",
      LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.vscode,
    );
    const port = requestPort("conflicting-key");

    const first = await harness.api.apply({ ...IDENTITY_A, planId: cursorPlan.planId }, port);
    const conflict = await harness.api.apply({ ...IDENTITY_A, planId: vscodePlan.planId }, port);

    expectCompleted(first, false);
    expect(conflict).toMatchObject({
      accepted: false,
      status: "rejected",
      code: "IDEMPOTENCY_KEY_REUSED",
      operationInvoked: false,
    });
    expect(JSON.parse(await readFile(paths.vscode.targetPath, "utf8"))).toEqual({ unrelated: "vscode" });
  });

  it("isolates plans by tenant and subject", async () => {
    const harness = await createHarness();
    const plan = await harness.api.plan({
      ...IDENTITY_A,
      profileId: PROFILE_ID,
      action: "enable",
    });

    await expect(harness.api.approve(
      { ...IDENTITY_B, planId: plan.planId },
      requestPort("wrong-identity-approval"),
    )).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_API_PLAN_MISMATCH",
    });
    await expect(harness.api.apply(
      { ...IDENTITY_B, planId: plan.planId },
      requestPort("wrong-identity"),
    )).resolves.toMatchObject({
      accepted: false,
      status: "rejected",
      code: "LOCAL_CLIENT_ONBOARDING_PRECOMMIT_REJECTED",
    });
    expect(harness.approval.approve).not.toHaveBeenCalled();
    expect(harness.registryPort.apply).not.toHaveBeenCalled();
  });

  it("rejects body-supplied authority fields and missing Idempotency-Key", async () => {
    const harness = await createHarness();
    const unsafePlan = {
      ...IDENTITY_A,
      profileId: PROFILE_ID,
      action: "enable" as const,
      targetPath: "C:\\attacker\\config.json",
      scopes: ["attacker:scope"],
      planDigest: "a".repeat(64),
      serverDefinition: { command: "attacker" },
    };
    await expect(harness.api.plan(unsafePlan as never)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_API_REQUEST_INVALID",
    });
    const plan = await planAndApprove(harness, "enable");
    await expect(harness.api.approve({
      ...IDENTITY_A,
      planId: plan.planId,
      scopes: ["attacker:scope"],
      planDigest: "b".repeat(64),
    } as never, requestPort("unsafe-approval"))).rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_API_REQUEST_INVALID" });
    await expect(harness.api.apply(
      { ...IDENTITY_A, planId: plan.planId },
      requestPort(undefined),
    )).rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_API_IDEMPOTENCY_REQUIRED" });
    const unapprovedPlan = await harness.api.plan({
      ...IDENTITY_A,
      profileId: LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.vscode,
      action: "enable",
    });
    await expect(harness.api.approve(
      { ...IDENTITY_A, planId: unapprovedPlan.planId },
      requestPort(undefined),
    )).rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_API_IDEMPOTENCY_REQUIRED" });
    expect(harness.registryPort.apply).not.toHaveBeenCalled();
  });

  it("rejects memory idempotency and non-durable external-effect gates", async () => {
    const memoryCoordinator = createIdempotencyCoordinator({ storeMode: "memory" });
    closeables.push(memoryCoordinator);
    const memoryHarness = await createHarness({ idempotencyCoordinator: memoryCoordinator });
    const memoryPlan = await memoryHarness.api.plan({
      ...IDENTITY_A,
      profileId: PROFILE_ID,
      action: "enable",
    });
    await expect(memoryHarness.api.approve(
      { ...IDENTITY_A, planId: memoryPlan.planId },
      requestPort("memory-key"),
    )).rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_API_IDEMPOTENCY_NOT_DURABLE" });

    const externalHarness = await createHarness({
      externalStatus: { mode: "memory", enabled: true, durable: false, distributed: false },
    });
    const externalPlan = await planAndApprove(externalHarness, "enable");
    await expect(externalHarness.api.apply(
      { ...IDENTITY_A, planId: externalPlan.planId },
      requestPort("external-key"),
    )).rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_API_EXTERNAL_EFFECT_NOT_DURABLE" });
  });

  it.each([
    ["created-unconfirmed", {
      accepted: true,
      status: "created-unconfirmed",
      replayed: false,
      replayable: false,
      value: {},
    }],
    ["previous-unknown", {
      accepted: false,
      status: "rejected",
      replayed: false,
      replayable: false,
      statusCode: 409,
      code: "IDEMPOTENCY_PREVIOUS_ATTEMPT_UNKNOWN",
      message: "unknown",
      retryable: false,
    }],
    ["not-replayable", {
      accepted: false,
      status: "rejected",
      replayed: false,
      replayable: false,
      statusCode: 409,
      code: "IDEMPOTENCY_RESULT_NOT_REPLAYABLE",
      message: "not replayable",
      retryable: false,
    }],
  ] as const)("fails approval closed for %s durable outcomes", async (_label, outcome) => {
    const coordinator = scriptedCoordinator(outcome);
    const harness = await createHarness({ idempotencyCoordinator: coordinator });
    const plan = await harness.api.plan({ ...IDENTITY_A, profileId: PROFILE_ID, action: "enable" });

    await expect(harness.api.approve(
      { ...IDENTITY_A, planId: plan.planId },
      requestPort(`approval-unknown-${_label}`),
    )).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_APPROVAL_OUTCOME_UNKNOWN",
    });
    expect(harness.approval.approve).not.toHaveBeenCalled();
  });

  it("never approves twice when a durable store creates an unconfirmed non-replayable result", async () => {
    const coordinator = createIdempotencyCoordinator({
      storeMode: "sqlite",
      sqlitePath: join(root, "approval-unconfirmed.sqlite"),
      secret: "test-only-onboarding-idempotency-secret-000000000000",
      ttlMs: 60_000,
      maxEntries: 16,
      maxResultBytes: 1,
      now: () => NOW_MS,
    });
    closeables.push(coordinator);
    const harness = await createHarness({ idempotencyCoordinator: coordinator });
    const plan = await harness.api.plan({ ...IDENTITY_A, profileId: PROFILE_ID, action: "enable" });
    const request = { ...IDENTITY_A, planId: plan.planId };
    const port = requestPort("approval-unconfirmed-key");

    await expect(harness.api.approve(request, port)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_APPROVAL_OUTCOME_UNKNOWN",
      statusCode: 503,
    });
    await expect(harness.api.approve(request, port)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_APPROVAL_OUTCOME_UNKNOWN",
    });
    expect(harness.approval.approve).toHaveBeenCalledTimes(1);
    expect(harness.external.reserve).not.toHaveBeenCalled();
  });

  it("returns a pre-commit rejection without calling reserve or registry apply", async () => {
    const harness = await createHarness({ consumeMode: "reject" });
    const plan = await planAndApprove(harness, "enable");

    const outcome = await harness.api.apply(
      { ...IDENTITY_A, planId: plan.planId },
      requestPort("precommit-key"),
    );

    expect(outcome).toMatchObject({
      accepted: false,
      status: "rejected",
      operationInvoked: true,
      retryAllowed: false,
      result: null,
    });
    expect(harness.external.reserve).not.toHaveBeenCalled();
    expect(harness.registryPort.apply).not.toHaveBeenCalled();
  });

  it("marks commit and post-commit failures unknown and never invokes the mutation on replay", async () => {
    const failingApply = vi.fn(async () => {
      throw new Error("private path and command must not leak");
    });
    const harness = await createHarness({ registryApply: failingApply });
    const plan = await planAndApprove(harness, "enable");
    const request = { ...IDENTITY_A, planId: plan.planId };
    const port = requestPort("postcommit-key");

    const first = await harness.api.apply(request, port);
    const replay = await harness.api.apply(request, port);

    expect(first).toMatchObject({
      status: "unknown-reconcile-required",
      operationInvoked: true,
      retryAllowed: false,
    });
    expect(replay).toMatchObject({
      status: "unknown-reconcile-required",
      operationInvoked: false,
      retryAllowed: false,
    });
    expect(failingApply).toHaveBeenCalledTimes(1);
    expect(harness.external.commit).toHaveBeenCalledTimes(1);
    assertRedacted({ first, replay });
  });

  it("treats an uncertain external-effect commit as unknown and never calls the registry", async () => {
    const harness = await createHarness({ externalMode: "commit-error" });
    const plan = await planAndApprove(harness, "enable");
    const request = { ...IDENTITY_A, planId: plan.planId };
    const port = requestPort("commit-error-key");

    const first = await harness.api.apply(request, port);
    const replay = await harness.api.apply(request, port);

    expect(first).toMatchObject({
      status: "unknown-reconcile-required",
      operationInvoked: true,
      retryAllowed: false,
    });
    expect(replay).toMatchObject({
      status: "unknown-reconcile-required",
      operationInvoked: false,
      retryAllowed: false,
    });
    expect(harness.external.commit).toHaveBeenCalledTimes(1);
    expect(harness.registryPort.apply).not.toHaveBeenCalled();
  });

  it("governs rollback with a new exact approval and replays without restoring twice", async () => {
    const harness = await createHarness();
    const enablePlan = await planAndApprove(harness, "enable");
    const applied = await harness.api.apply(
      { ...IDENTITY_A, planId: enablePlan.planId },
      requestPort("enable-before-rollback"),
    );
    expectCompleted(applied, false);
    const applyReceipt = applied.result.receipt as LocalClientOnboardingReceipt;
    const rollbackPlan = await harness.api.plan({
      ...IDENTITY_A,
      profileId: PROFILE_ID,
      action: "rollback",
      receipt: applyReceipt,
    });
    await harness.api.approve(
      { ...IDENTITY_A, planId: rollbackPlan.planId },
      requestPort("rollback-approval-key"),
    );

    const first = await harness.api.rollback(
      { ...IDENTITY_A, planId: rollbackPlan.planId },
      requestPort("rollback-key"),
    );
    const replay = await harness.api.rollback(
      { ...IDENTITY_A, planId: rollbackPlan.planId },
      requestPort("rollback-key"),
    );

    expectCompleted(first, false);
    expectCompleted(replay, true);
    expect(harness.registryPort.rollback).toHaveBeenCalledTimes(1);
    expect(JSON.parse(await readFile(paths.cursor.targetPath, "utf8"))).toEqual({ unrelated: "cursor" });
    expect(rollbackPlan.scopes).toContain("local-client:onboarding:rollback");
  });

  it("replays apply after a full API restart and authorizes rollback from durable receipt authority", async () => {
    const idempotencyPath = join(root, "restart-idempotency.sqlite");
    const authorityPath = join(root, "restart-authority.sqlite");
    const firstCoordinator = durableIdempotency(idempotencyPath);
    const firstAuthority = durableReceiptAuthority(authorityPath);
    closeables.push(firstCoordinator, firstAuthority);
    const first = await createHarness({
      idempotencyCoordinator: firstCoordinator,
      receiptAuthorityStore: firstAuthority,
    });
    const plan = await planAndApprove(first, "enable");
    const request = { ...IDENTITY_A, planId: plan.planId };
    const port = requestPort("restart-apply-key");
    const applied = await first.api.apply(request, port);
    expectCompleted(applied, false);
    const receipt = applied.result.receipt as LocalClientOnboardingReceipt;
    await firstCoordinator.close();
    await firstAuthority.close();

    const restartedCoordinator = durableIdempotency(idempotencyPath);
    const restartedAuthority = durableReceiptAuthority(authorityPath);
    closeables.push(restartedCoordinator, restartedAuthority);
    const restartedRegistry = await createRegistry(paths);
    const restarted = await createHarness({
      registry: restartedRegistry,
      idempotencyCoordinator: restartedCoordinator,
      receiptAuthorityStore: restartedAuthority,
    });

    const approvalReplay = await restarted.api.approve(
      { ...IDENTITY_A, planId: plan.planId },
      requestPort(`approval-${plan.planId}`),
    );
    expect(approvalReplay).toMatchObject({ status: "approved", planId: plan.planId });
    expect(restarted.approval.approve).not.toHaveBeenCalled();
    const replay = await restarted.api.apply(request, port);
    expectCompleted(replay, true);
    expect(restarted.registryPort.apply).not.toHaveBeenCalled();
    await expect(restarted.api.plan({
      ...IDENTITY_B,
      profileId: PROFILE_ID,
      action: "rollback",
      receipt,
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_API_PLAN_UNKNOWN" });

    const rollbackPlan = await restarted.api.plan({
      ...IDENTITY_A,
      profileId: PROFILE_ID,
      action: "rollback",
      receipt,
    });
    await restarted.api.approve(
      { ...IDENTITY_A, planId: rollbackPlan.planId },
      requestPort("restart-rollback-approval"),
    );
    const rolledBack = await restarted.api.rollback(
      { ...IDENTITY_A, planId: rollbackPlan.planId },
      requestPort("restart-rollback-key"),
    );
    expectCompleted(rolledBack, false);
    expect(restarted.registryPort.rollback).toHaveBeenCalledTimes(1);
    await restartedCoordinator.close();
    await restartedAuthority.close();

    const thirdCoordinator = durableIdempotency(idempotencyPath);
    const thirdAuthority = durableReceiptAuthority(authorityPath);
    closeables.push(thirdCoordinator, thirdAuthority);
    const third = await createHarness({
      registry: await createRegistry(paths),
      idempotencyCoordinator: thirdCoordinator,
      receiptAuthorityStore: thirdAuthority,
    });
    const rollbackReplay = await third.api.rollback(
      { ...IDENTITY_A, planId: rollbackPlan.planId },
      requestPort("restart-rollback-key"),
    );
    expectCompleted(rollbackReplay, true);
    expect(third.registryPort.rollback).not.toHaveBeenCalled();
    await expect(third.api.plan({
      ...IDENTITY_A,
      profileId: PROFILE_ID,
      action: "rollback",
      receipt,
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_API_PLAN_UNKNOWN" });
  });

  it("returns unknown when durable receipt recording fails after apply and never mutates twice", async () => {
    const authority = durableReceiptAuthority(join(root, "record-failure-authority.sqlite"));
    closeables.push(authority);
    const recordApplied = vi.fn(async () => {
      throw new Error("record failure");
    });
    const harness = await createHarness({
      receiptAuthorityStore: authorityPort(authority, { recordApplied }),
    });
    const plan = await planAndApprove(harness, "enable");
    const request = { ...IDENTITY_A, planId: plan.planId };
    const port = requestPort("record-failure-key");

    const first = await harness.api.apply(request, port);
    const replay = await harness.api.apply(request, port);

    expect(first).toMatchObject({ status: "unknown-reconcile-required", retryAllowed: false });
    expect(replay).toMatchObject({ status: "unknown-reconcile-required", retryAllowed: false });
    expect(harness.registryPort.apply).toHaveBeenCalledTimes(1);
    expect(recordApplied).toHaveBeenCalledTimes(2);
  });

  it("keeps rollback claim on unknown mark failure but releases it on explicit precommit rejection", async () => {
    const authority = durableReceiptAuthority(join(root, "rollback-authority-failures.sqlite"));
    closeables.push(authority);
    const markRolledBack = vi.fn(async () => {
      throw new Error("mark failure");
    });
    const releaseRollbackClaim = vi.fn(authority.releaseRollbackClaim.bind(authority));
    const harness = await createHarness({
      receiptAuthorityStore: authorityPort(authority, { markRolledBack, releaseRollbackClaim }),
    });
    const enablePlan = await planAndApprove(harness, "enable");
    const applied = await harness.api.apply(
      { ...IDENTITY_A, planId: enablePlan.planId },
      requestPort("mark-failure-apply"),
    );
    expectCompleted(applied, false);
    const receipt = applied.result.receipt as LocalClientOnboardingReceipt;
    const rollbackPlan = await harness.api.plan({
      ...IDENTITY_A,
      profileId: PROFILE_ID,
      action: "rollback",
      receipt,
    });
    await harness.api.approve(
      { ...IDENTITY_A, planId: rollbackPlan.planId },
      requestPort("mark-failure-approval"),
    );
    const request = { ...IDENTITY_A, planId: rollbackPlan.planId };
    const port = requestPort("mark-failure-rollback");

    const unknown = await harness.api.rollback(request, port);
    const unknownReplay = await harness.api.rollback(request, port);
    expect(unknown).toMatchObject({ status: "unknown-reconcile-required", retryAllowed: false });
    expect(unknownReplay).toMatchObject({ status: "unknown-reconcile-required", retryAllowed: false });
    expect(markRolledBack).toHaveBeenCalledTimes(2);
    expect(releaseRollbackClaim).not.toHaveBeenCalled();
    expect(harness.registryPort.rollback).toHaveBeenCalledTimes(1);

    const releaseAuthority = durableReceiptAuthority(join(root, "rollback-precommit-release.sqlite"));
    closeables.push(releaseAuthority);
    const releaseSpy = vi.spyOn(releaseAuthority, "releaseRollbackClaim");
    const releaseHarness = await createHarness({ receiptAuthorityStore: releaseAuthority });
    const releaseEnablePlan = await planAndApprove(releaseHarness, "enable");
    const releaseApplied = await releaseHarness.api.apply(
      { ...IDENTITY_A, planId: releaseEnablePlan.planId },
      requestPort("release-apply"),
    );
    expectCompleted(releaseApplied, false);
    const releaseReceipt = releaseApplied.result.receipt as LocalClientOnboardingReceipt;
    const releasePlan = await releaseHarness.api.plan({
      ...IDENTITY_A,
      profileId: PROFILE_ID,
      action: "rollback",
      receipt: releaseReceipt,
    });
    await releaseHarness.api.approve(
      { ...IDENTITY_A, planId: releasePlan.planId },
      requestPort("release-approval"),
    );
    releaseHarness.approval.consume.mockResolvedValueOnce({
      success: true,
      approved: false,
      consumed: false,
      code: "APPROVAL_NOT_FOUND",
    });
    const rejected = await releaseHarness.api.rollback(
      { ...IDENTITY_A, planId: releasePlan.planId },
      requestPort("release-rollback"),
    );
    expect(rejected).toMatchObject({ status: "rejected", operationInvoked: true });
    expect(releaseSpy).toHaveBeenCalledTimes(1);
    expect(releaseHarness.registryPort.rollback).not.toHaveBeenCalled();
  });

  it("requires separately scoped approval for explicit recovery", async () => {
    const directRegistry = await createRegistry(paths);
    const registryPlan = await directRegistry.plan(PROFILE_ID, "enable");
    await directRegistry.apply(registryPlan.planId);
    const journal = JSON.parse(await readFile(paths.cursor.journalPath, "utf8"));
    const entry = journal.entries[0];
    entry.status = "pending";
    entry.afterIdentityFingerprint = null;
    entry.committedAtMs = null;
    entry.receiptDigest = null;
    entry.rolledBackAtMs = null;
    entry.rollbackReceiptDigest = null;
    await writeFile(paths.cursor.journalPath, `${JSON.stringify(journal, null, 2)}\n`, "utf8");
    const restarted = await createRegistry(paths);
    const recoveryIdempotencyPath = join(root, "recovery-replay-idempotency.sqlite");
    const recoveryAuthorityPath = join(root, "recovery-replay-authority.sqlite");
    const recoveryCoordinator = durableIdempotency(recoveryIdempotencyPath);
    const recoveryAuthority = durableReceiptAuthority(recoveryAuthorityPath);
    closeables.push(recoveryCoordinator, recoveryAuthority);
    const harness = await createHarness({
      registry: restarted,
      idempotencyCoordinator: recoveryCoordinator,
      receiptAuthorityStore: recoveryAuthority,
    });
    const recoveryPlan = await harness.api.plan({
      ...IDENTITY_A,
      profileId: PROFILE_ID,
      action: "recover",
    });
    expect(recoveryPlan.scopes).toContain("local-client:onboarding:recover");
    await harness.api.approve(
      { ...IDENTITY_A, planId: recoveryPlan.planId },
      requestPort("recovery-approval-key"),
    );

    const recovered = await harness.api.recover(
      { ...IDENTITY_A, planId: recoveryPlan.planId },
      requestPort("recover-key"),
    );

    expectCompleted(recovered, false);
    expect(harness.registryPort.recover).toHaveBeenCalledTimes(1);
    expect(recovered.result.receipt).toMatchObject({
      recoveryVersion: "local-client-onboarding-recovery-v1",
      redacted: true,
    });
    assertRedacted(recovered);
    await recoveryCoordinator.close();
    await recoveryAuthority.close();

    const replayCoordinator = durableIdempotency(recoveryIdempotencyPath);
    const replayAuthority = durableReceiptAuthority(recoveryAuthorityPath);
    closeables.push(replayCoordinator, replayAuthority);
    const replayHarness = await createHarness({
      registry: await createRegistry(paths),
      idempotencyCoordinator: replayCoordinator,
      receiptAuthorityStore: replayAuthority,
    });
    const recoveryReplay = await replayHarness.api.recover(
      { ...IDENTITY_A, planId: recoveryPlan.planId },
      requestPort("recover-key"),
    );
    expectCompleted(recoveryReplay, true);
    expect(replayHarness.registryPort.recover).not.toHaveBeenCalled();
  });
});

type HarnessOptions = {
  registry: LocalClientOnboardingRegistry;
  registryApply: (planId: string) => Promise<LocalClientOnboardingReceipt>;
  consumeMode: "accept" | "reject";
  idempotencyCoordinator: IdempotencyCoordinator;
  externalMode: "success" | "reserve-error" | "commit-error";
  externalStatus: Record<string, unknown>;
  receiptAuthorityStore: LocalClientOnboardingReceiptAuthorityStorePort;
};

function profilePaths(root: string) {
  const profile = (name: string) => ({
    targetPath: join(root, name, "config.json"),
    allowedRoot: root,
    backupDir: join(root, ".uai", name, "backups"),
    journalPath: join(root, ".uai", name, "journal.json"),
    maxBytes: 64 * 1_024,
    maxTransactions: 32,
    clock: () => NOW_MS,
  });
  return {
    claudeCompatible: profile("claude"),
    cursor: profile("cursor"),
    vscode: profile("vscode"),
  };
}

async function initializeProfileFiles(paths: ReturnType<typeof profilePaths>) {
  for (const [name, profile] of Object.entries(paths)) {
    await mkdir(dirname(profile.targetPath), { recursive: true });
    await writeFile(profile.targetPath, `${JSON.stringify({ unrelated: name }, null, 2)}\n`, "utf8");
  }
}

async function createRegistry(paths: ReturnType<typeof profilePaths>) {
  return createLocalClientOnboardingRegistry({
    profiles: paths,
    serverDefinition: {
      transport: "stdio",
      command: PRIVATE_COMMAND,
      args: [PRIVATE_ARGUMENT],
    },
  });
}

function registryPortFor(
  registry: LocalClientOnboardingRegistry,
  applyOverride?: (planId: string) => Promise<LocalClientOnboardingReceipt>,
) {
  return {
    listProfiles: vi.fn(() => registry.listProfiles()),
    inspect: vi.fn((profileId) => registry.inspect(profileId)),
    plan: vi.fn((profileId, action) => registry.plan(profileId, action)),
    apply: vi.fn(applyOverride ?? ((planId) => registry.apply(planId))),
    rollback: vi.fn((receipt) => registry.rollback(receipt)),
    recover: vi.fn((profileId) => registry.recover(profileId)),
    verifyInstalled: vi.fn((profileId) => registry.verifyInstalled(profileId)),
  } satisfies LocalClientGovernedOnboardingDependencies["registry"];
}

function createApprovalHarness(mode: HarnessOptions["consumeMode"] = "accept") {
  const approvals = new Map<string, Record<string, unknown>>();
  const approve = vi.fn(async (input: Record<string, unknown>) => {
    const approvedAt = new Date(NOW_MS).toISOString();
    const approval = {
      approvalId: `appr_${sha256(String(input.planId)).slice(0, 16)}`,
      planId: input.planId,
      tenantId: input.tenantId,
      userId: input.userId,
      planDigest: input.planDigest,
      approvedScopes: input.approvedScopes,
      status: "approved",
      revoked: false,
      approvedAt,
      expiresAt: new Date(NOW_MS + 60_000).toISOString(),
    };
    approvals.set(String(input.planId), approval);
    return { success: true, status: "approved", approval };
  });
  const consume = vi.fn(async (input: Record<string, unknown>) => {
    const approval = approvals.get(String(input.planId));
    if (mode === "reject" || !approval || approval.status !== "approved") {
      return { success: true, approved: false, consumed: false, code: "APPROVAL_NOT_FOUND" };
    }
    if (
      approval.tenantId !== input.tenantId
      || approval.userId !== input.userId
      || approval.planDigest !== input.planDigest
      || JSON.stringify([...(approval.approvedScopes as string[])].sort())
        !== JSON.stringify([...(input.requiredScopes as string[])].sort())
    ) {
      return { success: true, approved: false, consumed: false, code: "APPROVAL_MISMATCH" };
    }
    approval.status = "consumed";
    return { success: true, approved: true, consumed: true, approval };
  });
  return { approve, consume };
}

function createExternalEffectHarness(mode: HarnessOptions["externalMode"] = "success") {
  const commit = vi.fn(async () => {
    if (mode === "commit-error") throw new Error("commit failed");
  });
  const reserve = vi.fn(async () => {
    if (mode === "reserve-error") throw new Error("reserve failed");
    return { reservationFingerprint: "a".repeat(64), commit };
  });
  return { reserve, commit };
}

function durableIdempotency(sqlitePath: string) {
  return createIdempotencyCoordinator({
    storeMode: "sqlite",
    sqlitePath,
    secret: "test-only-onboarding-idempotency-secret-000000000000",
    ttlMs: 60_000,
    maxEntries: 128,
    maxResultBytes: 128 * 1_024,
    now: () => NOW_MS,
  });
}

function durableReceiptAuthority(sqlitePath: string) {
  return createLocalClientSqliteOnboardingReceiptAuthorityStore({
    sqlitePath,
    hostId: "governed-onboarding-test-host",
    integrityKey: Buffer.alloc(32, 0x6a),
    namespace: "governed-onboarding-test",
    ttlMs: 60_000,
    leaseTtlMs: 1_000,
    maxRows: 128,
    now: () => NOW_MS,
  });
}

function authorityPort(
  store: LocalClientSqliteOnboardingReceiptAuthorityStore,
  overrides: Partial<LocalClientOnboardingReceiptAuthorityStorePort> = {},
): LocalClientOnboardingReceiptAuthorityStorePort {
  return {
    status: store.status,
    recordApplied: store.recordApplied.bind(store),
    authorizeRollback: store.authorizeRollback.bind(store),
    markRolledBack: store.markRolledBack.bind(store),
    releaseRollbackClaim: store.releaseRollbackClaim.bind(store),
    ...overrides,
  };
}

function scriptedCoordinator(outcome: unknown): IdempotencyCoordinator {
  return {
    execute: vi.fn(async () => outcome) as unknown as IdempotencyCoordinator["execute"],
    getStats() {
      return {
        entries: 0,
        inFlight: 0,
        replayable: 0,
        tombstones: 0,
        ttlMs: 60_000,
        maxEntries: 10,
        maxResultBytes: 64 * 1_024,
        storeMode: "sqlite" as const,
      };
    },
    close() {},
  };
}

function requestPort(key: string | undefined) {
  return {
    getHeader(name: string) {
      return name === "idempotency-key" ? key : undefined;
    },
    signal: new AbortController().signal,
  };
}

async function planAndApprove(
  harness: { api: ReturnType<typeof createLocalClientGovernedOnboardingApi> },
  action: "enable" | "disable",
  profileId: LocalClientOnboardingProfileId = PROFILE_ID,
) {
  const plan = await harness.api.plan({ ...IDENTITY_A, profileId, action });
  await harness.api.approve(
    { ...IDENTITY_A, planId: plan.planId },
    requestPort(`approval-${plan.planId}`),
  );
  return plan;
}

function expectCompleted(
  outcome: LocalClientGovernedOnboardingMutationOutcome,
  replayed: boolean,
): asserts outcome is Extract<LocalClientGovernedOnboardingMutationOutcome, { accepted: true }> {
  expect(outcome).toMatchObject({
    accepted: true,
    status: replayed ? "replayed" : "completed",
    replayed,
    replayable: true,
    retryAllowed: false,
    result: { status: "completed", redacted: true },
  });
  if (!outcome.accepted) throw new Error("Expected completed onboarding outcome.");
}

async function snapshotProfileFiles(paths: ReturnType<typeof profilePaths>) {
  return Promise.all(Object.values(paths).map(async (profile) => ({
    target: await readFile(profile.targetPath, "utf8"),
    backup: await exists(profile.backupDir),
    journal: await exists(profile.journalPath),
  })));
}

function assertRedacted(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    PRIVATE_COMMAND,
    PRIVATE_ARGUMENT,
    "targetPath",
    "allowedRoot",
    "backupDir",
    "journalPath",
    "serverDefinition",
    "private-config-value",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
}

async function exists(path: string) {
  return readFile(path).then(() => true, () => false);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
