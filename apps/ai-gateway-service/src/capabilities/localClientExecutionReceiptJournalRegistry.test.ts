import { describe, expect, it, vi } from "vitest";

import {
  createLocalClientExecutionReceiptJournalRegistry,
  LOCAL_CLIENT_EXECUTION_RECEIPT_JOURNAL_REGISTRY_BOUNDARIES,
  LOCAL_CLIENT_RECEIPT_JOURNAL_ENUMERATION_FAILURE_CODE,
} from "./localClientExecutionReceiptJournalRegistry.ts";

describe("local-client execution receipt journal registry", () => {
  it("resolves only an exact tenant/client binding and exposes redacted aggregate status", () => {
    const first = fakeJournal();
    const second = fakeJournal();
    const registry = createLocalClientExecutionReceiptJournalRegistry([
      { tenantId: "tenant-a", clientId: "desktop.one", journal: first },
      { tenantId: "tenant-b", clientId: "desktop.two", journal: second },
    ]);

    expect(registry.resolve({ tenantId: "tenant-a", clientId: "desktop.one" })).toBe(first);
    expect(registry.resolve({ tenantId: "tenant-b", clientId: "desktop.one" })).toBeNull();
    expect(registry.status).toMatchObject({
      ...LOCAL_CLIENT_EXECUTION_RECEIPT_JOURNAL_REGISTRY_BOUNDARIES,
      available: true,
      bindingCount: 2,
      availableJournalCount: 2,
      recoveryContextEncrypted: true,
      snapshotRollbackProtected: false,
      clientAtomicEffectReceiptVerified: false,
    });
    expect(JSON.stringify(registry.status)).not.toContain("tenant-a");
    expect(JSON.stringify(registry.status)).not.toContain("desktop.one");
  });

  it("collects bounded internal work items without granting redispatch", async () => {
    const journal = fakeJournal([Object.freeze({
      executionId: `lc-exec-${"a".repeat(64)}`,
      redispatchAllowed: false,
      identity: Object.freeze({ tenantId: "tenant-a" }),
    })]);
    const registry = createLocalClientExecutionReceiptJournalRegistry([
      { tenantId: "tenant-a", clientId: "desktop.one", journal },
    ]);

    const listing = await registry.listRecoveryWorkItems(5);
    const items = listing.workItems;

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      tenantId: "tenant-a",
      clientId: "desktop.one",
      journal,
      item: { redispatchAllowed: false },
    });
    expect(journal.listRecoveryWorkItems).toHaveBeenCalledWith(5);
    expect(listing.failures).toEqual({ count: 0, code: null });
  });

  it("interleaves clients and advances past a global batch when bindings outnumber the limit", async () => {
    const bindings = Array.from({ length: 64 }, (_, index) => {
      const suffix = index.toString(16).padStart(2, "0");
      return {
        tenantId: `tenant-${index}`,
        clientId: `desktop.${index}`,
        journal: fakeJournal([Object.freeze({
          executionId: `lc-exec-${suffix.repeat(32)}`,
          redispatchAllowed: false,
          identity: Object.freeze({ tenantId: `tenant-${index}` }),
        })]),
      };
    });
    const registry = createLocalClientExecutionReceiptJournalRegistry(bindings);

    const first = await registry.listRecoveryWorkItems(32);
    const second = await registry.listRecoveryWorkItems(32);
    const wrapped = await registry.listRecoveryWorkItems(32);
    expect(first.workItems.map((entry) => entry.clientId)).toEqual(
      Array.from({ length: 32 }, (_, index) => `desktop.${index}`),
    );
    expect(second.workItems.map((entry) => entry.clientId)).toEqual(
      Array.from({ length: 32 }, (_, index) => `desktop.${index + 32}`),
    );
    expect(wrapped.workItems.map((entry) => entry.clientId)).toEqual(
      Array.from({ length: 32 }, (_, index) => `desktop.${index}`),
    );
  });

  it("round-robins work items at the same depth across two clients", async () => {
    const item = (suffix: string) => Object.freeze({
      executionId: `lc-exec-${suffix.repeat(64)}`,
      redispatchAllowed: false,
      identity: Object.freeze({ tenantId: `tenant-${suffix}` }),
    });
    const registry = createLocalClientExecutionReceiptJournalRegistry([
      { tenantId: "tenant-a", clientId: "desktop.a", journal: fakeJournal([item("a"), item("b")]) },
      { tenantId: "tenant-b", clientId: "desktop.b", journal: fakeJournal([item("c"), item("d")]) },
    ]);

    const listing = await registry.listRecoveryWorkItems(4);
    expect(listing.workItems.map((entry) => entry.clientId)).toEqual([
      "desktop.a",
      "desktop.b",
      "desktop.a",
      "desktop.b",
    ]);
  });

  it("isolates one failed journal while returning redacted aggregate failure metadata", async () => {
    const failing = fakeJournal();
    failing.listRecoveryWorkItems.mockRejectedValueOnce(Object.assign(
      new Error("tenant-secret desktop.secret"),
      { code: "TENANT_SECRET_DESKTOP_SECRET" },
    ));
    const healthy = fakeJournal([Object.freeze({
      executionId: `lc-exec-${"e".repeat(64)}`,
      redispatchAllowed: false,
      identity: Object.freeze({ tenantId: "tenant-healthy" }),
    })]);
    const registry = createLocalClientExecutionReceiptJournalRegistry([
      { tenantId: "tenant-secret", clientId: "desktop.secret", journal: failing },
      { tenantId: "tenant-healthy", clientId: "desktop.healthy", journal: healthy },
    ]);

    const listing = await registry.listRecoveryWorkItems(1);

    expect(listing.workItems).toHaveLength(1);
    expect(listing.workItems[0]?.clientId).toBe("desktop.healthy");
    expect(listing.failures).toEqual({
      count: 1,
      code: LOCAL_CLIENT_RECEIPT_JOURNAL_ENUMERATION_FAILURE_CODE,
    });
    expect(JSON.stringify(listing.failures)).not.toContain("tenant-secret");
    expect(JSON.stringify(listing.failures)).not.toContain("desktop.secret");
  });

  it("closes every owned journal once and fails resolution after close", async () => {
    const first = fakeJournal();
    const second = fakeJournal();
    const registry = createLocalClientExecutionReceiptJournalRegistry([
      { tenantId: "tenant-a", clientId: "desktop.one", journal: first },
      { tenantId: "tenant-b", clientId: "desktop.two", journal: second },
    ]);

    const left = registry.close();
    const right = registry.close();
    expect(right).toBe(left);
    await left;

    expect(first.close).toHaveBeenCalledOnce();
    expect(second.close).toHaveBeenCalledOnce();
    expect(registry.resolve({ tenantId: "tenant-a", clientId: "desktop.one" })).toBeNull();
    expect(registry.status).toMatchObject({ available: false, closed: true });
  });

  it("rejects duplicate bindings and non-gateway journals", () => {
    const journal = fakeJournal();
    expect(() => createLocalClientExecutionReceiptJournalRegistry([
      { tenantId: "tenant-a", clientId: "desktop.one", journal },
      { tenantId: "tenant-a", clientId: "desktop.one", journal: fakeJournal() },
    ])).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_RECEIPT_JOURNAL_REGISTRY_BINDING_DUPLICATE",
    }));
    const clientJournal = fakeJournal();
    clientJournal.status.role = "client";
    expect(() => createLocalClientExecutionReceiptJournalRegistry([
      { tenantId: "tenant-a", clientId: "desktop.one", journal: clientJournal },
    ])).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_RECEIPT_JOURNAL_REGISTRY_JOURNAL_INVALID",
    }));
  });
});

function fakeJournal(workItems: readonly unknown[] = []) {
  return {
    status: {
      role: "gateway",
      durable: true,
      available: true,
      recoveryContextEncrypted: true,
      databaseSnapshotRollbackProtected: false,
    },
    prepareDispatch: vi.fn(),
    armDispatch: vi.fn(),
    confirmReceipt: vi.fn(),
    markFeedbackStaged: vi.fn(),
    markLifecycleFinalized: vi.fn(),
    resolvePreparedAsNotDispatched: vi.fn(),
    resolveArmedAsNotDispatched: vi.fn(),
    getRecoveryWorkItem: vi.fn(),
    createReconciliationQuery: vi.fn(),
    applyReconciliation: vi.fn(),
    listRecoveryWorkItems: vi.fn(async () => workItems),
    close: vi.fn(async () => undefined),
  } as any;
}
