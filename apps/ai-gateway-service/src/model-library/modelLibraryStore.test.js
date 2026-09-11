import { afterEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createModelLibraryStore } from "./modelLibraryStore.js";
import * as registry from "./unifiedModelRegistry.js";

vi.mock("node:fs", async (original) => {
  const actual = await original();
  return { ...actual, openSync: vi.fn(actual.openSync), fsyncSync: vi.fn(actual.fsyncSync),
    renameSync: vi.fn(actual.renameSync), unlinkSync: vi.fn(actual.unlinkSync), writeFileSync: vi.fn(actual.writeFileSync) };
});
vi.mock("./unifiedModelRegistry.js", async (original) => {
  const actual = await original();
  return { ...actual, buildUnifiedModelRegistry: vi.fn(actual.buildUnifiedModelRegistry) };
});

const ownedRoots = [];
function fixture() {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "uai-model-store-"));
  ownedRoots.push(root);
  return { root, path: join(root, "model-state.json") };
}
afterEach(() => {
  for (const name of ["openSync", "fsyncSync", "renameSync", "unlinkSync", "writeFileSync"]) vi.mocked(fs[name]).mockReset();
  vi.mocked(registry.buildUnifiedModelRegistry).mockReset();
  for (const root of ownedRoots.splice(0)) {
    expect(realpathSync(root)).toBe(root);
    expect(dirname(root)).toBe(realpathSync(tmpdir()));
    rmSync(root, { recursive: true, force: true });
  }
});

describe("model-library state recovery", () => {
  it("rejects corrupt existing bytes without disclosing or overwriting them", () => {
    const { path } = fixture();
    const bytes = '{"version":1,"synthetic-private-marker":';
    writeFileSync(path, bytes);
    let failure;
    try { createModelLibraryStore({ env: {}, storagePath: path }); } catch (error) { failure = error; }
    expect(failure?.code).toBe("MODEL_LIBRARY_STATE_INVALID");
    expect(failure.message).not.toContain("synthetic-private-marker");
    expect(failure.message).not.toContain(path);
    expect(readFileSync(path, "utf8")).toBe(bytes);
  });

  it("rejects unknown versions, non-files and obviously invalid state shapes", () => {
    for (const content of [JSON.stringify({ version: 2 }), JSON.stringify([]), JSON.stringify({ version: 1, smokeState: [] })]) {
      const { path } = fixture(); writeFileSync(path, content);
      expect(() => createModelLibraryStore({ env: {}, storagePath: path })).toThrow();
      expect(readFileSync(path, "utf8")).toBe(content);
    }
    const { path } = fixture(); mkdirSync(path);
    expect(() => createModelLibraryStore({ env: {}, storagePath: path })).toThrow();
  });

  it("does not publish a new in-memory state when saving fails", () => {
    const { path } = fixture();
    const store = createModelLibraryStore({ env: {}, storagePath: path });
    const before = store.getState();
    mkdirSync(path);
    expect(() => store.recordProviderTest({ providerId: "fake", success: true, realExternalCall: false })).toThrow();
    expect(store.getState()).toEqual(before);
  });

  it("initializes only a missing file and preserves normal legacy v1 fields on reload", () => {
    const { path } = fixture();
    const missing = createModelLibraryStore({ env: {}, storagePath: path });
    expect(missing.getState().version).toBe(1);
    expect(fs.existsSync(path)).toBe(false);
    const legacy = { version: 1, phase: "312A", smokeState: { "legacy-model": {
      testStatus: "smoke_passed", lastSmokeAt: "2026-01-01T00:00:00.000Z", lastSmokeResult: { success: true } } },
    providerStatus: { fake: { providerId: "fake", keyStatus: "tested_passed", lastTestAt: "2026-01-01T00:00:00.000Z", lastTestResult: { success: true } } },
    taskDefaults: { chatDefaultProviderId: "fake", chatDefaultModelId: "legacy-model" }, retainedLegacyMetadata: { source: "synthetic" } };
    writeFileSync(path, JSON.stringify(legacy));
    const store = createModelLibraryStore({ env: {}, storagePath: path });
    expect(store.getState()).toMatchObject(legacy);
    store.recordProviderTest({ providerId: "other", success: false });
    expect(createModelLibraryStore({ env: {}, storagePath: path }).getState()).toMatchObject(legacy);
  });

  it("safely rejects read access errors and does not expose native error text or paths", () => {
    const { path } = fixture(); writeFileSync(path, JSON.stringify({ version: 1 }));
    vi.mocked(fs.openSync).mockImplementationOnce(() => { throw Object.assign(new Error(`synthetic-secret ${path}`), { code: "EACCES" }); });
    let failure;
    try { createModelLibraryStore({ env: {}, storagePath: path }); } catch (error) { failure = error; }
    expect(failure?.code).toBe("MODEL_LIBRARY_STATE_UNAVAILABLE");
    expect(failure.message).not.toContain(path);
    expect(failure.message).not.toContain("synthetic-secret");
    expect(readFileSync(path, "utf8")).toBe('{"version":1}');
  });

  it("all four mutation methods retain memory and original bytes after pre-rename fsync failure", async () => {
    const operations = [
      (store) => store.recordProviderTest({ providerId: "next", success: true }),
      (store) => store.recordSmokeResult({ providerId: "fake", modelId: "next", result: { success: true } }),
      (store) => store.refreshCatalog(),
      (store) => {
        vi.mocked(registry.buildUnifiedModelRegistry).mockReturnValueOnce({ models: [{ providerId: "fake", modelId: "next", state: { default_candidate: true } }] });
        return store.setTaskDefault({ providerId: "fake", modelId: "next" });
      },
    ];
    for (const operation of operations) {
      const { root, path } = fixture();
      const store = createModelLibraryStore({ env: {}, storagePath: path });
      store.recordProviderTest({ providerId: "before", success: false });
      const before = store.getState(); const bytes = readFileSync(path);
      vi.mocked(fs.fsyncSync).mockImplementationOnce(() => { throw Object.assign(new Error("synthetic disk failure"), { code: "EIO" }); });
      let failure;
      try { await operation(store); } catch (error) { failure = error; }
      expect(failure?.code).toBe("MODEL_LIBRARY_STATE_SAVE_FAILED");
      expect(store.getState()).toEqual(before);
      expect(readFileSync(path)).toEqual(bytes);
      expect(readdirSync(root)).toEqual(["model-state.json"]);
    }
  });

  it("uses exclusive random temporary files and leaves an unrelated legacy pid temp untouched", () => {
    const { root, path } = fixture();
    const unrelated = `${path}.${process.pid}.tmp`; writeFileSync(unrelated, "unrelated-owned-fixture");
    const store = createModelLibraryStore({ env: {}, storagePath: path });
    store.recordProviderTest({ providerId: "first", success: true });
    store.recordProviderTest({ providerId: "second", success: true });
    const temporaryOpens = vi.mocked(fs.openSync).mock.calls.filter((call) => call[1] === "wx");
    expect(temporaryOpens).toHaveLength(2);
    expect(temporaryOpens[0][0]).not.toBe(temporaryOpens[1][0]);
    for (const call of temporaryOpens) { expect(call[0]).toMatch(/\.[0-9a-f-]{36}\.tmp$/); expect(call[2]).toBe(0o600); }
    expect(readFileSync(unrelated, "utf8")).toBe("unrelated-owned-fixture");
    expect(readdirSync(root).sort()).toEqual(["model-state.json", `model-state.json.${process.pid}.tmp`].sort());
  });

  it("preserves a foreign temporary entry when exclusive creation collides", async () => {
    const actualFs = await vi.importActual("node:fs");
    const { root, path } = fixture();
    const store = createModelLibraryStore({ env: {}, storagePath: path });
    let foreignPath;
    vi.mocked(fs.openSync).mockImplementationOnce((target, flags) => {
      expect(flags).toBe("wx"); foreignPath = target;
      actualFs.writeFileSync(target, "foreign-synthetic-entry");
      throw Object.assign(new Error("synthetic collision"), { code: "EEXIST" });
    });
    expect(() => store.recordProviderTest({ providerId: "next", success: true })).toThrowError(expect.objectContaining({ code: "MODEL_LIBRARY_STATE_SAVE_FAILED" }));
    expect(fs.existsSync(path)).toBe(false);
    expect(readFileSync(foreignPath, "utf8")).toBe("foreign-synthetic-entry");
    expect(readdirSync(root)).toHaveLength(1);
    expect(vi.mocked(fs.unlinkSync)).not.toHaveBeenCalled();
  });

  it("rejects an oversized existing file before reading its contents", () => {
    const { path } = fixture(); writeFileSync(path, "{}"); fs.truncateSync(path, 16 * 1024 * 1024 + 1);
    vi.mocked(fs.openSync).mockClear();
    expect(() => createModelLibraryStore({ env: {}, storagePath: path })).toThrowError(expect.objectContaining({ code: "MODEL_LIBRARY_STATE_INVALID" }));
    expect(vi.mocked(fs.openSync)).not.toHaveBeenCalled();
    expect(fs.statSync(path).size).toBe(16 * 1024 * 1024 + 1);
  });

  it("does not overwrite a state file externally changed since this writer loaded it", () => {
    const { path } = fixture();
    const store = createModelLibraryStore({ env: {}, storagePath: path });
    store.recordProviderTest({ providerId: "before", success: true });
    const changed = JSON.stringify({ version: 1, taskDefaults: { chatDefaultModelId: "external" } });
    writeFileSync(path, changed);
    expect(() => store.recordProviderTest({ providerId: "next", success: true })).toThrowError(expect.objectContaining({ code: "MODEL_LIBRARY_STATE_CHANGED" }));
    expect(readFileSync(path, "utf8")).toBe(changed);
  });

  it("reports rename failure as uncertain and prevents later reads or writes on that instance", () => {
    const { path } = fixture();
    const store = createModelLibraryStore({ env: {}, storagePath: path });
    store.recordProviderTest({ providerId: "before", success: true });
    const bytes = readFileSync(path);
    vi.mocked(fs.renameSync).mockImplementationOnce(() => { throw Object.assign(new Error(`synthetic path ${path}`), { code: "EIO" }); });
    expect(() => store.recordProviderTest({ providerId: "next", success: true })).toThrowError(expect.objectContaining({ code: "MODEL_LIBRARY_STATE_WRITE_UNCERTAIN", outcomeUnknown: true }));
    expect(() => store.getState()).toThrowError(expect.objectContaining({ code: "MODEL_LIBRARY_STATE_WRITE_UNCERTAIN" }));
    expect(() => store.recordProviderTest({ providerId: "again", success: true })).toThrow();
    expect(readFileSync(path)).toEqual(bytes);
    expect(createModelLibraryStore({ env: {}, storagePath: path }).getState().providerStatus.next).toBeUndefined();
  });

  it("does not report success when rename committed but the syscall result is uncertain", async () => {
    const actualFs = await vi.importActual("node:fs");
    const { root, path } = fixture();
    const store = createModelLibraryStore({ env: {}, storagePath: path });
    vi.mocked(fs.renameSync).mockImplementationOnce((from, to) => { actualFs.renameSync(from, to); throw Object.assign(new Error("synthetic late I/O error"), { code: "EIO" }); });
    expect(() => store.recordProviderTest({ providerId: "next", success: true })).toThrowError(expect.objectContaining({ code: "MODEL_LIBRARY_STATE_WRITE_UNCERTAIN" }));
    expect(() => store.getRegistry()).toThrow();
    expect(createModelLibraryStore({ env: {}, storagePath: path }).getState().providerStatus.next.lastTestResult.success).toBe(true);
    expect(readdirSync(root)).toEqual(["model-state.json"]);
  });

  it("returns detached records so callers cannot mutate the committed in-memory state", () => {
    const { path } = fixture();
    const store = createModelLibraryStore({ env: {}, storagePath: path });
    const record = store.recordProviderTest({ providerId: "fake", success: true });
    record.lastTestResult.success = false;
    expect(store.getState().providerStatus.fake.lastTestResult.success).toBe(true);
    expect(createModelLibraryStore({ env: {}, storagePath: path }).getState().providerStatus.fake.lastTestResult.success).toBe(true);
  });

  it("round-trips every mutation API using local synthetic results only", async () => {
    const { path } = fixture();
    const store = createModelLibraryStore({ env: {}, storagePath: path });
    store.recordProviderTest({ providerId: "fake", success: true, realExternalCall: false });
    store.recordSmokeResult({ providerId: "fake", modelId: "fixture", result: { success: false, code: "synthetic-only" } });
    await store.refreshCatalog();
    vi.mocked(registry.buildUnifiedModelRegistry).mockReturnValueOnce({ models: [{ providerId: "fake", modelId: "fixture", state: { default_candidate: true } }] });
    expect(store.setTaskDefault({ providerId: "fake", modelId: "fixture" }).success).toBe(true);
    const reloaded = createModelLibraryStore({ env: {}, storagePath: path }).getState();
    expect(reloaded).toEqual(store.getState());
    expect(reloaded.providerStatus.fake.lastTestResult.realExternalCall).toBe(false);
    expect(reloaded.smokeState.fake.fixture.lastSmokeResult.code).toBe("synthetic-only");
    expect(reloaded.taskDefaults.chatDefaultModelId).toBe("fixture");
    expect(reloaded.lastRefreshAt).not.toBeNull();
  });
});
