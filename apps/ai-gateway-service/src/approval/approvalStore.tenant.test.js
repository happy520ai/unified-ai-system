import { describe, expect, it } from "vitest";
import { createApprovalStore } from "./approvalStore.js";

describe("approvalStore — tenant isolation", () => {
  it("requires a tenant id when creating records", () => {
    const store = createApprovalStore();
    expect(() => store.create({ title: "no tenant" })).toThrowError(
      expect.objectContaining({ code: "approval_tenant_required" }),
    );
    expect(() => store.create({ title: "blank tenant" }, "   ")).toThrowError(
      expect.objectContaining({ code: "approval_tenant_required" }),
    );
  });

  it("stamps the owning tenant on created records and generates UUID-backed ids", () => {
    const store = createApprovalStore();
    const record = store.create({ title: "tenant-a approval" }, "tenant-a");

    expect(record.tenantId).toBe("tenant-a");
    expect(record.id).toMatch(/^approval-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("only lists records belonging to the requesting tenant", () => {
    const store = createApprovalStore();
    store.create({ title: "a1" }, "tenant-a");
    store.create({ title: "a2" }, "tenant-a");
    store.create({ title: "b1" }, "tenant-b");

    const tenantATitles = store.list("tenant-a").map((record) => record.title).sort();
    expect(tenantATitles).toEqual(["a1", "a2"]);
    expect(store.list("tenant-b").map((record) => record.title)).toEqual(["b1"]);
    expect(store.list("tenant-c")).toEqual([]);
    // Fail-closed: no tenant scope means nothing is visible.
    expect(store.list()).toEqual([]);
    expect(store.list(undefined)).toEqual([]);
    expect(store.list("")).toEqual([]);
  });

  it("hides cross-tenant records from get", () => {
    const store = createApprovalStore();
    const record = store.create({ title: "a1" }, "tenant-a");

    expect(store.get(record.id, "tenant-a")).toMatchObject({ id: record.id, tenantId: "tenant-a" });
    expect(store.get(record.id, "tenant-b")).toBeNull();
    expect(store.get(record.id)).toBeNull();
  });

  it("rejects cross-tenant approve/reject with the same not-found error as missing records", () => {
    const store = createApprovalStore();
    const record = store.create({ title: "a1" }, "tenant-a");

    expect(() => store.approve(record.id, {}, "tenant-b")).toThrowError(
      expect.objectContaining({ code: "approval_not_found" }),
    );
    expect(() => store.reject(record.id, {}, undefined)).toThrowError(
      expect.objectContaining({ code: "approval_not_found" }),
    );
    expect(() => store.approve("approval-does-not-exist", {}, "tenant-a")).toThrowError(
      expect.objectContaining({ code: "approval_not_found" }),
    );

    const approved = store.approve(record.id, {}, "tenant-a");
    expect(approved.status).toBe("approved");
    expect(approved.tenantId).toBe("tenant-a");
  });

  it("keeps the owning tenant immutable through decision updates", () => {
    const store = createApprovalStore();
    const record = store.create({ title: "a1" }, "tenant-a");

    const hijacked = store.approve(record.id, { tenantId: "tenant-b" }, "tenant-a");
    expect(hijacked.tenantId).toBe("tenant-a");
    expect(store.list("tenant-b")).toEqual([]);
    expect(store.get(record.id, "tenant-a")).toMatchObject({ tenantId: "tenant-a" });
  });

  it("keeps records without a tenant stamp invisible (fail-closed)", () => {
    const store = createApprovalStore();
    const record = store.create({ title: "a1" }, "tenant-a");

    // A missing/empty tenant argument behaves exactly like a mismatched tenant:
    // the record must not be readable or mutable.
    expect(store.get(record.id, "")).toBeNull();
    expect(store.get(record.id, null)).toBeNull();
    expect(() => store.approve(record.id, {}, "")).toThrowError(
      expect.objectContaining({ code: "approval_not_found" }),
    );
    expect(store.list("")).toEqual([]);
  });
});
