import { describe, expect, it } from "vitest";

import { LocalClientSmartManagementScheduler } from "./localClientSmartManagementScheduler.ts";
import {
  LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_BOUNDARIES,
  LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_DEFAULTS,
  LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV,
  LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV_PREFIX,
  resolveLocalClientSmartManagementSchedulerConfig,
} from "./localClientSmartManagementSchedulerConfig.ts";

const SECRET_TENANT = "tenant-secret@example.invalid";
const SECRET_SUBJECT = "subject-secret-001";

describe("resolveLocalClientSmartManagementSchedulerConfig", () => {
  it("is disabled by default and exposes no scheduler or tenant identities", () => {
    const resolved = resolveLocalClientSmartManagementSchedulerConfig({});

    expect(resolved).toEqual({
      enabled: false,
      tenants: [],
      schedulerOptions: null,
      status: {
        enabled: false,
        configurationVersion: 1,
        executionMode: "dry-run",
        applyEnabled: false,
        applyConfigurable: false,
        configuredTenantCount: 0,
        configuredTenantLimit: 0,
        tenantIdentitiesRedacted: true,
        boundaries: LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_BOUNDARIES,
      },
    });
    expect(JSON.stringify(resolved.status)).not.toContain(SECRET_TENANT);
    expect(JSON.stringify(resolved.status)).not.toContain(SECRET_SUBJECT);
  });

  it("does not read unrelated environment values while checking its prefix", () => {
    const env: Record<string, string | undefined> = {};
    Object.defineProperty(env, "UNRELATED_PROVIDER_SECRET", {
      enumerable: true,
      get() { throw new Error("unrelated environment value was read"); },
    });

    expect(resolveLocalClientSmartManagementSchedulerConfig(env)).toMatchObject({
      enabled: false,
      schedulerOptions: null,
    });
  });

  it("requires version 1 tenants and produces dry-run-only scheduler defaults", () => {
    const resolved = resolveLocalClientSmartManagementSchedulerConfig({
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.enabled]: "true",
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.tenantsJson]: tenantsJson([
        { tenantId: SECRET_TENANT, subjectId: SECRET_SUBJECT },
        { tenantId: "tenant-2", subjectId: "subject-2" },
      ]),
    });

    expect(resolved.enabled).toBe(true);
    if (!resolved.enabled) throw new Error("expected enabled fixture");
    expect(resolved.schedulerOptions).toEqual({
      enableApply: false,
      ...LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_DEFAULTS,
    });
    expect(resolved.tenants).toEqual([
      { tenantId: SECRET_TENANT, subjectId: SECRET_SUBJECT },
      { tenantId: "tenant-2", subjectId: "subject-2" },
    ]);
    expect(Object.isFrozen(resolved.tenants)).toBe(true);
    expect(resolved.tenants.every(Object.isFrozen)).toBe(true);
    expect(resolved.status).toMatchObject({
      enabled: true,
      executionMode: "dry-run",
      applyEnabled: false,
      applyConfigurable: false,
      configuredTenantCount: 2,
      configuredTenantLimit: 256,
      tenantIdentitiesRedacted: true,
    });
    const statusJson = JSON.stringify(resolved.status);
    expect(statusJson).not.toContain(SECRET_TENANT);
    expect(statusJson).not.toContain(SECRET_SUBJECT);
  });

  it("parses every bounded numeric override without implicit coercion", () => {
    const resolved = enabledConfig({
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.intervalMs]: "1000",
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.initialDelayMs]: "0",
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.backoffBaseMs]: "2000",
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.backoffMaxMs]: "8000",
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.roundDeadlineMs]: "5000",
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.maxConcurrency]: "8",
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.maxTenants]: "10",
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.jitterRatio]: "0.25",
    });

    expect(resolved.schedulerOptions).toEqual({
      enableApply: false,
      intervalMs: 1_000,
      initialDelayMs: 0,
      failureBackoffBaseMs: 2_000,
      failureBackoffMaxMs: 8_000,
      roundDeadlineMs: 5_000,
      maxConcurrency: 8,
      maxTenants: 10,
      jitterRatio: 0.25,
    });
    expect(resolved.status.configuredTenantLimit).toBe(10);
  });

  it.each([undefined, "", " ", "{}", "not-json"])(
    "fails closed when enabled without a valid tenant document: %s",
    (tenantsValue) => {
      const env: Record<string, string | undefined> = {
        [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.enabled]: "true",
        [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.tenantsJson]: tenantsValue,
      };
      expect(() => resolveLocalClientSmartManagementSchedulerConfig(env))
        .toThrow(expect.objectContaining({
          code: tenantsValue === undefined || tenantsValue === "" || tenantsValue === " "
            ? "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_TENANTS_REQUIRED"
            : "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_TENANTS_INVALID",
        }));
    },
  );

  it.each([
    { label: "wrong version", document: { version: 2, tenants: [tenant(1)] } },
    { label: "string version", document: { version: "1", tenants: [tenant(1)] } },
    { label: "root extra field", document: { version: 1, tenants: [tenant(1)], apply: true } },
    { label: "missing tenants", document: { version: 1 } },
    { label: "empty tenants", document: { version: 1, tenants: [] } },
    {
      label: "tenant extra field",
      document: { version: 1, tenants: [{ ...tenant(1), role: "admin" }] },
    },
    {
      label: "tenant missing subject",
      document: { version: 1, tenants: [{ tenantId: "tenant-1" }] },
    },
    {
      label: "duplicate tenant id",
      document: {
        version: 1,
        tenants: [tenant(1), { tenantId: "tenant-1", subjectId: "another-subject" }],
      },
    },
    {
      label: "more than 256 tenants",
      document: { version: 1, tenants: Array.from({ length: 257 }, (_, index) => tenant(index)) },
    },
  ])("rejects $label", ({ document }) => {
    expect(() => resolveLocalClientSmartManagementSchedulerConfig({
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.enabled]: "true",
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.tenantsJson]: JSON.stringify(document),
    })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_TENANTS_INVALID",
    }));
  });

  it.each([
    { tenantId: " tenant", subjectId: "subject" },
    { tenantId: "tenant/child", subjectId: "subject" },
    { tenantId: "租户", subjectId: "subject" },
    { tenantId: "tenant", subjectId: "subject with space" },
    { tenantId: "tenant", subjectId: "subject\nnewline" },
    { tenantId: "t".repeat(129), subjectId: "subject" },
    { tenantId: "tenant", subjectId: "s".repeat(257) },
  ])("rejects unsafe tenant identity %#", (identity) => {
    expect(() => resolveLocalClientSmartManagementSchedulerConfig({
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.enabled]: "true",
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.tenantsJson]: tenantsJson([identity]),
    })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_TENANTS_INVALID",
    }));
  });

  it("bounds TENANTS_JSON bytes before parsing", () => {
    expect(() => resolveLocalClientSmartManagementSchedulerConfig({
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.enabled]: "true",
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.tenantsJson]: "x".repeat(
        LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_BOUNDARIES.maxJsonBytes + 1,
      ),
    })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_TENANTS_INVALID",
    }));
  });

  it.each([
    { field: "intervalMs", value: "999" },
    { field: "intervalMs", value: "01" },
    { field: "initialDelayMs", value: "-1" },
    { field: "backoffBaseMs", value: "999" },
    { field: "roundDeadlineMs", value: "999" },
    { field: "maxConcurrency", value: "0" },
    { field: "maxConcurrency", value: "33" },
    { field: "maxTenants", value: "0" },
    { field: "maxTenants", value: "257" },
    { field: "jitterRatio", value: ".1" },
    { field: "jitterRatio", value: "1e-1" },
    { field: "jitterRatio", value: "0.500001" },
    { field: "jitterRatio", value: "-0.1" },
  ])("rejects invalid numeric $field=$value", ({ field, value }) => {
    const envName = LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV[
      field as keyof typeof LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV
    ];
    expect(() => enabledConfig({ [envName]: value })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_VALUE_INVALID",
    }));
  });

  it("rejects cross-field backoff and tenant-limit violations", () => {
    expect(() => enabledConfig({
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.backoffBaseMs]: "5000",
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.backoffMaxMs]: "4000",
    })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_VALUE_INVALID",
    }));
    expect(() => enabledConfig({
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.tenantsJson]: tenantsJson([
        tenant(1),
        tenant(2),
      ]),
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.maxTenants]: "1",
    })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_VALUE_INVALID",
    }));
  });

  it("rejects invalid enablement and unknown scheduler-prefixed apply controls", () => {
    for (const value of ["yes", " true", "TRUE ", "2"]) {
      expect(() => resolveLocalClientSmartManagementSchedulerConfig({
        [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.enabled]: value,
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENABLEMENT_INVALID",
      }));
    }
    for (const unknownName of [
      `${LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV_PREFIX}APPLY`,
      `${LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV_PREFIX}ENABLE_APPLY`,
      `${LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV_PREFIX}DRY_RUN`,
      `${LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV_PREFIX}UNKNOWN`,
    ]) {
      expect(() => resolveLocalClientSmartManagementSchedulerConfig({
        [unknownName]: "true",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV_UNKNOWN",
      }));
    }
  });

  it("keeps disabled mode inert even if known tenant or numeric values are stale", () => {
    const resolved = resolveLocalClientSmartManagementSchedulerConfig({
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.enabled]: "false",
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.tenantsJson]: "not-json",
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.intervalMs]: "not-a-number",
    });
    expect(resolved).toMatchObject({
      enabled: false,
      tenants: [],
      schedulerOptions: null,
      status: { configuredTenantCount: 0, applyEnabled: false },
    });
  });

  it("wires into the scheduler without any path to automatic apply", async () => {
    const resolved = enabledConfig({
      [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.tenantsJson]: tenantsJson([
        { tenantId: SECRET_TENANT, subjectId: SECRET_SUBJECT },
      ]),
    });
    const calls: Array<{ tenantId: string; subjectId: string; dryRun?: boolean }> = [];
    const scheduler = new LocalClientSmartManagementScheduler({
      managementApi: {
        async smartManage(input) {
          calls.push({
            tenantId: input.tenantId,
            subjectId: input.subjectId,
            dryRun: input.dryRun,
          });
        },
      },
      tenantProvider: {
        async listTenants() { return resolved.tenants; },
      },
      ...resolved.schedulerOptions,
    });

    await expect(scheduler.runNow()).resolves.toMatchObject({
      dryRun: true,
      executionMode: "dry-run",
      succeeded: 1,
    });
    expect(calls).toEqual([{
      tenantId: SECRET_TENANT,
      subjectId: SECRET_SUBJECT,
      dryRun: true,
    }]);
    expect(JSON.stringify({
      configStatus: resolved.status,
      schedulerStatus: scheduler.getStatus(),
    })).not.toContain(SECRET_TENANT);
    await scheduler.close();
  });
});

function enabledConfig(
  overrides: Readonly<Record<string, string | undefined>> = {},
) {
  const resolved = resolveLocalClientSmartManagementSchedulerConfig({
    [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.enabled]: "true",
    [LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.tenantsJson]: tenantsJson([tenant(1)]),
    ...overrides,
  });
  if (!resolved.enabled) throw new Error("expected enabled fixture");
  return resolved;
}

function tenant(index: number) {
  return {
    tenantId: `tenant-${index}`,
    subjectId: `subject-${index}`,
  };
}

function tenantsJson(tenants: readonly unknown[]): string {
  return JSON.stringify({ version: 1, tenants });
}
