import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAuditHashChain } from "./auditHashChain.js";
import { createAuditCheckpointStore } from "./auditCheckpointStore.js";

const KEY = `hex:${"19".repeat(32)}`;

function createStore(root: string, overrides: Record<string, unknown> = {}) {
  const chainPath = join(root, "audit-chain.jsonl");
  const checkpointPath = join(root, "anchor", "audit.checkpoint.json");
  return {
    chainPath,
    checkpointPath,
    store: createAuditCheckpointStore({
      chainPath,
      checkpointPath,
      keyMaterial: KEY,
      ...overrides,
    }),
  };
}

describe("signed audit checkpoint store", () => {
  it("requires an exact key/path pair and canonical 32-byte key", () => {
    expect(() => createAuditCheckpointStore({ chainPath: "chain", checkpointPath: "checkpoint" }))
      .toThrowError(expect.objectContaining({ code: "AUDIT_CHECKPOINT_CONFIG_INCOMPLETE" }));
    expect(() => createAuditCheckpointStore({
      chainPath: "chain",
      checkpointPath: "checkpoint",
      keyMaterial: "short",
    })).toThrowError(expect.objectContaining({ code: "AUDIT_CHECKPOINT_KEY_INVALID" }));
    expect(createAuditCheckpointStore({ chainPath: "chain" }).configured).toBe(false);
    expect(() => createAuditCheckpointStore({
      chainPath: "same-path",
      checkpointPath: "same-path",
      keyMaterial: KEY,
    })).toThrowError(expect.objectContaining({ code: "AUDIT_CHECKPOINT_PATH_COLLISION" }));
    expect(() => createAuditCheckpointStore({
      chainPath: "chain",
      checkpointPath: "checkpoint",
      keyMaterial: KEY,
      keyFilePath: "also-a-file",
    })).toThrowError(expect.objectContaining({ code: "AUDIT_CHECKPOINT_KEY_AMBIGUOUS" }));
  });

  it("supports a restricted key file without exposing its contents", async () => {
    const root = await mkdtemp(join(tmpdir(), "audit-checkpoint-key-file-"));
    try {
      const keyFilePath = join(root, "audit.key");
      await writeFile(keyFilePath, `${KEY}\n`, "utf8");
      if (process.platform !== "win32") await chmod(keyFilePath, 0o600);
      const store = createAuditCheckpointStore({
        chainPath: join(root, "chain.jsonl"),
        checkpointPath: join(root, "checkpoint.json"),
        keyFilePath,
      });
      expect(store.configured).toBe(true);
      expect(JSON.stringify(store.getHealth())).not.toContain(KEY);
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it("anchors every fsynced chain append without storing key material", async () => {
    const root = await mkdtemp(join(tmpdir(), "audit-checkpoint-"));
    try {
      const { chainPath, checkpointPath, store } = createStore(root);
      const chain = createAuditHashChain({ chainPath, checkpointStore: store });
      await chain.append({ action: "first" });
      await chain.append({ action: "second" });

      await expect(chain.verify()).resolves.toEqual({ valid: true, totalEntries: 2, brokenAt: null });
      const checkpointText = await readFile(checkpointPath, "utf8");
      const checkpoint = JSON.parse(checkpointText);
      expect(checkpoint).toEqual(expect.objectContaining({
        type: "unified-ai-system-audit-checkpoint",
        version: 1,
        sequence: 2,
        hash: chain.getLastHash(),
        algorithm: "hmac-sha256",
        signature: expect.any(String),
      }));
      expect(checkpointText).not.toContain(KEY);
      expect(chain.getHealth()).toEqual(expect.objectContaining({
        signedCheckpointConfigured: true,
        externalCheckpointConfigured: false,
        checkpoint: expect.objectContaining({
          status: "ready",
          externalRetentionVerified: false,
          pathExposed: false,
          keyExposed: false,
        }),
      }));
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it("detects checkpoint tampering and a chain rollback", async () => {
    const root = await mkdtemp(join(tmpdir(), "audit-checkpoint-tamper-"));
    try {
      const { chainPath, checkpointPath, store } = createStore(root);
      const chain = createAuditHashChain({ chainPath, checkpointStore: store });
      await chain.append({ action: "first" });
      await chain.append({ action: "second" });

      const checkpoint = JSON.parse(await readFile(checkpointPath, "utf8"));
      checkpoint.signature = `${checkpoint.signature.slice(0, -2)}AA`;
      await writeFile(checkpointPath, `${JSON.stringify(checkpoint)}\n`, "utf8");
      const tamperedStore = createStore(root).store;
      const tampered = await createAuditHashChain({ chainPath, checkpointStore: tamperedStore }).verify();
      expect(tampered.valid).toBe(false);
      expect(tampered.reason).toBe("audit_checkpoint_signature_invalid");

      // Restore a valid checkpoint, then truncate one intact chain entry.
      await store.commit({ sequence: 2, hash: chain.getLastHash() });
      const lines = (await readFile(chainPath, "utf8")).trim().split("\n");
      await writeFile(chainPath, `${lines[0]}\n`, "utf8");
      const rolledBackStore = createStore(root).store;
      const rolledBack = await createAuditHashChain({ chainPath, checkpointStore: rolledBackStore }).verify();
      expect(rolledBack.valid).toBe(false);
      expect(rolledBack.reason).toBe("audit_checkpoint_rollback_detected");
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it("requires explicit bootstrap for a pre-existing unanchored chain", async () => {
    const root = await mkdtemp(join(tmpdir(), "audit-checkpoint-bootstrap-"));
    try {
      const chainPath = join(root, "audit-chain.jsonl");
      const checkpointPath = join(root, "anchor.json");
      const unanchored = createAuditHashChain({ chainPath });
      await unanchored.append({ action: "legacy" });

      const strictStore = createAuditCheckpointStore({ chainPath, checkpointPath, keyMaterial: KEY });
      const strict = await createAuditHashChain({ chainPath, checkpointStore: strictStore }).verify();
      expect(strict.valid).toBe(false);
      expect(strict.reason).toBe("audit_checkpoint_missing");

      const bootstrapStore = createAuditCheckpointStore({
        chainPath,
        checkpointPath,
        keyMaterial: KEY,
        allowBootstrap: true,
      });
      await expect(createAuditHashChain({ chainPath, checkpointStore: bootstrapStore }).verify())
        .resolves.toEqual({ valid: true, totalEntries: 1, brokenAt: null });
      expect(bootstrapStore.getHealth()).toEqual(expect.objectContaining({ bootstrapCount: 1 }));

      await bootstrapStore.commit({ sequence: 0, hash: "GENESIS" });
      const laggingStore = createAuditCheckpointStore({ chainPath, checkpointPath, keyMaterial: KEY });
      const lagging = await createAuditHashChain({ chainPath, checkpointStore: laggingStore }).verify();
      expect(lagging.valid).toBe(false);
      expect(lagging.reason).toBe("audit_checkpoint_lag");

      const advancingStore = createAuditCheckpointStore({
        chainPath,
        checkpointPath,
        keyMaterial: KEY,
        allowAdvance: true,
      });
      await expect(createAuditHashChain({ chainPath, checkpointStore: advancingStore }).verify())
        .resolves.toEqual({ valid: true, totalEntries: 1, brokenAt: null });
      expect(advancingStore.getHealth()).toEqual(expect.objectContaining({ advanceCount: 1 }));
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it("enforces an externally supplied sequence floor and serializes shared writers", async () => {
    const root = await mkdtemp(join(tmpdir(), "audit-checkpoint-floor-"));
    try {
      const firstConfig = createStore(root);
      const secondConfig = createStore(root);
      const first = createAuditHashChain({
        chainPath: firstConfig.chainPath,
        checkpointStore: firstConfig.store,
      });
      const second = createAuditHashChain({
        chainPath: secondConfig.chainPath,
        checkpointStore: secondConfig.store,
      });
      await Promise.all(Array.from({ length: 12 }, (_, index) => (
        (index % 2 === 0 ? first : second).append({ action: `writer-${index}` })
      )));

      const verifierConfig = createStore(root);
      await expect(createAuditHashChain({
        chainPath: verifierConfig.chainPath,
        checkpointStore: verifierConfig.store,
      }).verify()).resolves.toEqual({ valid: true, totalEntries: 12, brokenAt: null });

      const floorStore = createStore(root, { trustedMinimumSequence: 13 }).store;
      const belowFloor = await createAuditHashChain({
        chainPath: firstConfig.chainPath,
        checkpointStore: floorStore,
      }).verify();
      expect(belowFloor.valid).toBe(false);
      expect(belowFloor.reason).toBe("audit_checkpoint_rollback_detected");

      const wrongHashStore = createStore(root, {
        trustedMinimumSequence: 5,
        trustedHash: "0".repeat(64),
      }).store;
      const wrongHash = await createAuditHashChain({
        chainPath: firstConfig.chainPath,
        checkpointStore: wrongHashStore,
      }).verify();
      expect(wrongHash.valid).toBe(false);
      expect(wrongHash.reason).toBe("audit_checkpoint_trusted_hash_mismatch");
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });
});
