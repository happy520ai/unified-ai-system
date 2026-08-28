import { describe, expect, it } from "vitest";
import { createFileContextStore } from "./fileContextStore.js";

const tenantA = { tenantId: "tenant-a" };
const tenantB = { tenantId: "tenant-b" };

describe("file context store isolation and bounds", () => {
  it("partitions records by authenticated tenant and evicts oldest records", () => {
    const store = createFileContextStore({
      maxSelectionsPerTenant: 2,
      maxFilesPerSelection: 2,
    });

    expect(() => store.select({ files: [] })).toThrowError(
      expect.objectContaining({ code: "enterprise_tenant_context_required" }),
    );

    const first = store.select({
      files: [
        { name: "safe-a.txt", path: "docs/safe-a.txt" },
        { name: ".env", path: ".env" },
        { name: "overflow.txt", path: "docs/overflow.txt" },
      ],
    }, tenantA);
    expect(first.filesSelected).toBe(1);
    expect(first.blocked).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "blocked-sensitive-file" }),
      expect.objectContaining({ reason: "too-many-files", count: 1 }),
    ]));

    store.select({ files: [{ name: "second.txt" }] }, tenantA);
    store.select({ files: [{ name: "third.txt" }] }, tenantA);

    expect(store.list(tenantA)).toHaveLength(2);
    expect(store.list(tenantA)[0].accepted[0].name).toBe("second.txt");
    expect(store.list(tenantB)).toEqual([]);
  });

  it("bounds attacker-controlled metadata fields", () => {
    const store = createFileContextStore();
    const result = store.select({
      files: [{
        name: "a".repeat(2_000),
        path: `folder/${"b".repeat(4_000)}`,
        type: "c".repeat(1_000),
        size: Number.POSITIVE_INFINITY,
        contentLength: -10,
      }],
    }, tenantA);

    expect(result.accepted[0].name).toHaveLength(256);
    expect(result.accepted[0].path).toHaveLength(1_024);
    expect(result.accepted[0].type).toHaveLength(128);
    expect(result.accepted[0].size).toBe(0);
    expect(result.accepted[0].contentLength).toBe(0);
  });
});
