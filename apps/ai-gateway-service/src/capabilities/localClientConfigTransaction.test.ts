import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  LOCAL_CLIENT_CONFIG_JOURNAL_VERSION,
  createLocalClientConfigTransactionEngine,
  type LocalClientConfigReceipt,
} from "./localClientConfigTransaction.ts";

describe("local client JSON config transaction engine", () => {
  let root: string;
  let targetPath: string;
  let backupDir: string;
  let journalPath: string;
  let clockMs: number;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "local-client-config-transaction-"));
    targetPath = join(root, "client", "config.json");
    backupDir = join(root, ".uai", "backups");
    journalPath = join(root, ".uai", "journal.json");
    clockMs = Date.parse("2026-08-28T12:00:00.000Z");
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, fixtureConfig(), "utf8");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  function openEngine(overrides: Record<string, unknown> = {}) {
    return createLocalClientConfigTransactionEngine({
      targetPath,
      allowedRoot: root,
      backupDir,
      journalPath,
      maxBytes: 64 * 1_024,
      maxTransactions: 16,
      clock: () => clockMs,
      ...overrides,
    });
  }

  it("keeps planning write-free and returns only redacted content-addressed metadata", async () => {
    const beforeBytes = await readFile(targetPath);
    const engine = await openEngine();

    const plan = await engine.plan({
      operations: [{
        op: "set",
        path: ["mcpServers", "unified-ai-system"],
        value: {
          command: "private-command-must-not-leak",
          args: ["--private-value"],
        },
      }],
    });

    expect(plan).toMatchObject({
      planVersion: "local-client-config-plan-v1",
      planId: expect.stringMatching(/^[a-f0-9]{64}$/u),
      targetFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
      beforeSha256: sha256(beforeBytes),
      operationCount: 1,
      writesPerformed: false,
      operations: [{
        op: "set",
        pathFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
        valueFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
        valueKind: "object",
      }],
    });
    expect(await readFile(targetPath)).toEqual(beforeBytes);
    expect(await exists(backupDir)).toBe(false);
    expect(await exists(journalPath)).toBe(false);
    expect(await exists(`${journalPath}.lock`)).toBe(false);
    const serialized = JSON.stringify(plan);
    for (const forbidden of [
      targetPath,
      root,
      "mcpServers",
      "unified-ai-system",
      "private-command-must-not-leak",
      "--private-value",
      fixtureConfig(),
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("applies exact set/delete operations while preserving unrelated JSON fields", async () => {
    const engine = await openEngine();
    const plan = await engine.plan({
      operations: [
        {
          op: "set",
          path: ["mcpServers", "unified-ai-system"],
          value: { command: "node", args: ["gateway.mjs"] },
        },
        { op: "delete", path: ["mcpServers", "obsolete"] },
      ],
    });

    const receipt = await engine.apply({ planId: plan.planId });
    const stored = JSON.parse(await readFile(targetPath, "utf8"));

    expect(stored).toEqual({
      unrelated: {
        theme: "dark",
        nested: { keep: true },
      },
      mcpServers: {
        existing: { command: "existing" },
        "unified-ai-system": { command: "node", args: ["gateway.mjs"] },
      },
    });
    expect(receipt).toMatchObject({
      receiptVersion: "local-client-config-receipt-v1",
      planId: plan.planId,
      beforeSha256: plan.beforeSha256,
      afterSha256: plan.afterSha256,
      backupSha256: plan.beforeSha256,
    });
    expect(engine.getStatus()).toMatchObject({
      recoveryRequired: false,
      journalCorrupt: false,
      backupProtection: "0600-plaintext",
    });
    const plaintextJournal = await readJournal(journalPath);
    expect(plaintextJournal.entries[0].backupProtection).toBe("0600-plaintext");
    expect(sha256(await readFile(join(backupDir, plaintextJournal.entries[0].backupFileName))))
      .toBe(plan.beforeSha256);
    const serialized = JSON.stringify(receipt);
    expect(serialized).not.toContain(targetPath);
    expect(serialized).not.toContain(backupDir);
    expect(serialized).not.toContain("gateway.mjs");
  });

  it("uses one exclusive lock so concurrent apply attempts have exactly one winner", async () => {
    const firstEngine = await openEngine();
    const secondEngine = await openEngine();
    const plan = await firstEngine.plan({
      operations: [{ op: "set", path: ["managed"], value: true }],
    });
    const competingPlan = await secondEngine.plan({
      operations: [{ op: "set", path: ["managed"], value: true }],
    });
    expect(competingPlan.planId).toBe(plan.planId);

    const results = await Promise.allSettled([
      firstEngine.apply({ planId: plan.planId }),
      secondEngine.apply({ planId: competingPlan.planId }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const rejection = results.find((result) => result.status === "rejected");
    expect(rejection).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({
        code: expect.stringMatching(/^LOCAL_CLIENT_CONFIG_(?:LOCKED|TARGET_CHANGED)$/u),
      }),
    });
    expect(JSON.parse(await readFile(targetPath, "utf8"))).toMatchObject({ managed: true });
  });

  it("refuses a second operating-system process while a live process owns the lock", async () => {
    await mkdir(dirname(journalPath), { recursive: true });
    const lockPath = `${journalPath}.lock`;
    await writeFile(lockPath, `${JSON.stringify({
      lockVersion: "local-client-config-lock-v1",
      transactionId: `tx_${"a".repeat(64)}`,
      token: "b".repeat(64),
      pid: process.pid,
      createdAtMs: clockMs,
    })}\n`, "utf8");
    const childScript = `
      import { createLocalClientConfigTransactionEngine } from './apps/ai-gateway-service/src/capabilities/localClientConfigTransaction.ts';
      const options = JSON.parse(process.env.LOCAL_CLIENT_CONFIG_TEST_OPTIONS);
      try {
        const engine = await createLocalClientConfigTransactionEngine(options);
        const plan = await engine.plan({ operations: [{ op: 'set', path: ['child'], value: true }] });
        await engine.apply({ planId: plan.planId });
        process.exitCode = 2;
      } catch (error) {
        process.stdout.write(String(error?.code ?? 'unknown'));
        process.exitCode = error?.code === 'LOCAL_CLIENT_CONFIG_LOCKED' ? 0 : 3;
      }
    `;

    const child = spawnSync(process.execPath, [
      "--experimental-strip-types",
      "--input-type=module",
      "--eval",
      childScript,
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        LOCAL_CLIENT_CONFIG_TEST_OPTIONS: JSON.stringify({
          targetPath,
          allowedRoot: root,
          backupDir,
          journalPath,
          maxBytes: 64 * 1_024,
          maxTransactions: 16,
        }),
      },
      timeout: 20_000,
    });

    await rm(lockPath, { force: true });
    expect(child.status).toBe(0);
    expect(child.stdout).toBe("LOCAL_CLIENT_CONFIG_LOCKED");
    expect(JSON.parse(await readFile(targetPath, "utf8"))).not.toHaveProperty("child");
  });

  it("rejects a TOCTOU file identity or content change after planning", async () => {
    const engine = await openEngine();
    const plan = await engine.plan({
      operations: [{ op: "set", path: ["managed"], value: true }],
    });
    const externallyChanged = JSON.parse(fixtureConfig());
    externallyChanged.external = "changed-after-plan";
    await writeFile(targetPath, `${JSON.stringify(externallyChanged, null, 2)}\n`, "utf8");

    await expect(engine.apply({ planId: plan.planId })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_CONFIG_TARGET_CHANGED",
      statusCode: 409,
    });
    expect(await exists(backupDir)).toBe(false);
    expect(await exists(journalPath)).toBe(false);
  });

  it("restores the exact original bytes and hash through receipt-bound rollback", async () => {
    const original = Buffer.from(fixtureConfig().replace(/\n/gu, "\r\n"), "utf8");
    await writeFile(targetPath, original);
    const engine = await openEngine();
    const plan = await engine.plan({
      operations: [{ op: "set", path: ["managed"], value: true }],
    });
    const receipt = await engine.apply({ planId: plan.planId });

    clockMs += 1_000;
    const rollback = await engine.rollback({ receipt });

    const restored = await readFile(targetPath);
    expect(restored).toEqual(original);
    expect(sha256(restored)).toBe(plan.beforeSha256);
    expect(rollback).toMatchObject({
      rollbackReceiptVersion: "local-client-config-rollback-receipt-v1",
      transactionId: receipt.transactionId,
      planId: receipt.planId,
      restoredSha256: plan.beforeSha256,
      replacedSha256: plan.afterSha256,
      backupSha256: plan.beforeSha256,
    });
    expect(JSON.stringify(rollback)).not.toContain(targetPath);
    const journal = await readJournal(journalPath);
    expect(journal.entries).toHaveLength(0);
    expect(await readdir(backupDir)).toEqual([]);
  });

  it("encrypts backups with random AES-256-GCM envelopes and restores byte-exact content", async () => {
    const originalObject = JSON.parse(fixtureConfig());
    originalObject.secret = "plaintext-must-not-appear";
    const original = Buffer.from(`${JSON.stringify(originalObject, null, 2)}\n`, "utf8");
    await writeFile(targetPath, original);
    const key = Buffer.alloc(32, 0x51);
    const engine = await openEngine({ backupEncryptionKey: key });
    expect(engine.getStatus().backupProtection).toBe("aes-256-gcm");
    const plan = await engine.plan({
      operations: [{ op: "set", path: ["managed"], value: true }],
    });
    const receipt = await engine.apply({ planId: plan.planId });
    const journal = await readJournal(journalPath);
    const backupPath = join(backupDir, journal.entries[0].backupFileName);
    const backupText = await readFile(backupPath, "utf8");
    const envelope = JSON.parse(backupText);
    expect(Object.keys(envelope).sort()).toEqual([
      "algorithm",
      "backupVersion",
      "ciphertext",
      "nonce",
      "tag",
    ]);
    expect(envelope).toMatchObject({
      backupVersion: "local-client-config-backup-aes-256-gcm-v1",
      algorithm: "aes-256-gcm",
      nonce: expect.any(String),
      tag: expect.any(String),
      ciphertext: expect.any(String),
    });
    expect(backupText).not.toContain("plaintext-must-not-appear");
    expect(JSON.stringify(receipt)).not.toContain("aes-256-gcm");

    clockMs += 1;
    await engine.rollback({ receipt });
    expect(await readFile(targetPath)).toEqual(original);
    await engine.close();
    expect(key.equals(Buffer.alloc(32, 0x51))).toBe(true);
  });

  it("rejects a wrong backup key, ciphertext tampering, and AAD identity mismatch", async () => {
    const key = Buffer.alloc(32, 0x52);
    const { engine, receipt } = await applyFixtureChange(() => openEngine({ backupEncryptionKey: key }));
    await engine.close();
    const wrongKeyEngine = await openEngine({ backupEncryptionKey: Buffer.alloc(32, 0x53) });
    await expect(wrongKeyEngine.rollback({ receipt })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_CONFIG_BACKUP_INVALID",
    });
    await wrongKeyEngine.close();

    const journal = await readJournal(journalPath);
    const backupPath = join(backupDir, journal.entries[0].backupFileName);
    const envelope = JSON.parse(await readFile(backupPath, "utf8"));
    const ciphertext = String(envelope.ciphertext);
    envelope.ciphertext = `${ciphertext[0] === "A" ? "B" : "A"}${ciphertext.slice(1)}`;
    await writeFile(backupPath, `${JSON.stringify(envelope)}\n`, "utf8");
    const tamperEngine = await openEngine({ backupEncryptionKey: key });
    await expect(tamperEngine.rollback({ receipt })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_CONFIG_BACKUP_INVALID",
    });
    await tamperEngine.close();

    await writeFile(targetPath, fixtureConfig(), "utf8");
    await rm(journalPath, { force: true });
    await rm(backupDir, { recursive: true, force: true });
    const aadEngine = await openEngine({ backupEncryptionKey: key });
    const aadPlan = await aadEngine.plan({
      operations: [{ op: "set", path: ["aad"], value: true }],
    });
    const aadReceipt = await aadEngine.apply({ planId: aadPlan.planId });
    const aadJournal = await readJournal(journalPath);
    makeApplyPending(aadJournal.entries[0]);
    aadJournal.entries[0].beforeIdentityFingerprint = "f".repeat(64);
    await writeJournal(journalPath, aadJournal);
    await aadEngine.close();
    const aadRestarted = await openEngine({ backupEncryptionKey: key });
    await expect(aadRestarted.recover({ transactionId: aadReceipt.transactionId })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_CONFIG_BACKUP_INVALID",
    });
  });

  it("clones the backup key and refuses operations after zeroizing close", async () => {
    const key = Buffer.alloc(32, 0x54);
    const engine = await openEngine({ backupEncryptionKey: key });
    key.fill(0);
    const plan = await engine.plan({
      operations: [{ op: "set", path: ["managed"], value: true }],
    });
    await expect(engine.apply({ planId: plan.planId })).resolves.toMatchObject({
      beforeSha256: plan.beforeSha256,
    });
    await engine.close();
    await expect(engine.plan({
      operations: [{ op: "set", path: ["closed"], value: true }],
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_CONFIG_CONFIGURATION_INVALID" });
    expect(engine.getStatus().available).toBe(false);
  });

  it("removes the exact orphan backup when pre-journal state cannot be persisted", async () => {
    let clockReads = 0;
    const engine = await openEngine({
      clock: () => {
        clockReads += 1;
        if (clockReads === 6) throw new Error("injected pre-journal failure");
        return clockMs;
      },
    });
    const original = await readFile(targetPath);
    const plan = await engine.plan({
      operations: [{ op: "set", path: ["managed"], value: true }],
    });
    await expect(engine.apply({ planId: plan.planId })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_CONFIG_CLOCK_INVALID",
    });
    expect(await readFile(targetPath)).toEqual(original);
    expect(await readdir(backupDir)).toEqual([]);
    expect(await exists(journalPath)).toBe(false);
  });

  it("blocks apply on startup pending state and explicitly recovers a provable before state", async () => {
    const original = await readFile(targetPath);
    const { receipt } = await applyFixtureChange(openEngine);
    const journal = await readJournal(journalPath);
    makeApplyPending(journal.entries[0]);
    await writeJournal(journalPath, journal);
    await writeFile(targetPath, original);

    const restarted = await openEngine();
    expect(restarted.getStatus()).toMatchObject({
      recoveryRequired: true,
      pendingTransactionIds: [receipt.transactionId],
    });
    const newPlan = await restarted.plan({
      operations: [{ op: "set", path: ["another"], value: true }],
    });
    await expect(restarted.apply({ planId: newPlan.planId })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_CONFIG_RECOVERY_REQUIRED",
    });

    clockMs += 1_000;
    const recovery = await restarted.recover({ transactionId: receipt.transactionId });
    expect(recovery).toMatchObject({
      resolution: "apply-aborted",
      currentSha256: sha256(original),
      applyReceipt: null,
      rollbackReceipt: null,
    });
    expect(restarted.getStatus().recoveryRequired).toBe(false);
    expect((await readJournal(journalPath)).entries).toHaveLength(0);
    expect(await readdir(backupDir)).toEqual([]);
  });

  it("commits a provable after state during explicit crash recovery", async () => {
    const { receipt } = await applyFixtureChange(openEngine);
    const journal = await readJournal(journalPath);
    makeApplyPending(journal.entries[0]);
    await writeJournal(journalPath, journal);

    const restarted = await openEngine();
    clockMs += 1_000;
    const recovery = await restarted.recover({ transactionId: receipt.transactionId });

    expect(recovery).toMatchObject({
      resolution: "apply-committed",
      currentSha256: receipt.afterSha256,
      applyReceipt: expect.objectContaining({
        transactionId: receipt.transactionId,
        afterSha256: receipt.afterSha256,
      }),
      rollbackReceipt: null,
    });
    expect(restarted.getStatus().recoveryRequired).toBe(false);
  });

  it("finishes a provable rollback-pending state during explicit recovery", async () => {
    const { receipt } = await applyFixtureChange(openEngine);
    const journal = await readJournal(journalPath);
    journal.entries[0].status = "rollback-pending";
    journal.entries[0].updatedAtMs += 1;
    await writeJournal(journalPath, journal);
    const backupPath = join(backupDir, journal.entries[0].backupFileName);
    await writeFile(targetPath, await readFile(backupPath));

    const restarted = await openEngine();
    clockMs += 1_000;
    const recovery = await restarted.recover({ transactionId: receipt.transactionId });

    expect(recovery).toMatchObject({
      resolution: "rollback-completed",
      currentSha256: receipt.beforeSha256,
      applyReceipt: null,
      rollbackReceipt: expect.objectContaining({
        transactionId: receipt.transactionId,
        restoredSha256: receipt.beforeSha256,
      }),
    });
    expect((await readJournal(journalPath)).entries).toHaveLength(0);
    expect(await readdir(backupDir)).toEqual([]);
  });

  it("never guesses when a pending transaction matches neither before nor after state", async () => {
    const { receipt } = await applyFixtureChange(openEngine);
    const journal = await readJournal(journalPath);
    makeApplyPending(journal.entries[0]);
    await writeJournal(journalPath, journal);
    await writeFile(targetPath, '{"third-party-state":true}\n', "utf8");

    const restarted = await openEngine();
    await expect(restarted.recover({ transactionId: receipt.transactionId })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_CONFIG_RECOVERY_AMBIGUOUS",
      statusCode: 409,
    });
    expect(restarted.getStatus()).toMatchObject({
      recoveryRequired: true,
      pendingTransactionIds: [receipt.transactionId],
    });
  });

  it("fails closed for corrupt journals and corrupt backups", async () => {
    await mkdir(dirname(journalPath), { recursive: true });
    await writeFile(journalPath, "{not-json", "utf8");
    const corruptJournalEngine = await openEngine();
    expect(corruptJournalEngine.getStatus()).toMatchObject({
      recoveryRequired: true,
      journalCorrupt: true,
    });
    await expect(corruptJournalEngine.recover({
      transactionId: `tx_${"a".repeat(64)}`,
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_CONFIG_JOURNAL_CORRUPT" });

    await rm(journalPath, { force: true });
    const { engine, receipt } = await applyFixtureChange(openEngine);
    const journal = await readJournal(journalPath);
    await writeFile(join(backupDir, journal.entries[0].backupFileName), "corrupt-backup", "utf8");
    await expect(engine.rollback({ receipt })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_CONFIG_BACKUP_INVALID",
    });
  });

  it("refuses rollback after unrelated external changes", async () => {
    const { engine, receipt } = await applyFixtureChange(openEngine);
    const current = JSON.parse(await readFile(targetPath, "utf8"));
    current.external = "must-not-be-overwritten";
    await writeFile(targetPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");

    await expect(engine.rollback({ receipt })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_CONFIG_ROLLBACK_CONFLICT",
      statusCode: 409,
    });
    expect(JSON.parse(await readFile(targetPath, "utf8"))).toMatchObject({
      external: "must-not-be-overwritten",
    });
  });

  it("rejects a modified apply receipt before reading or restoring the backup", async () => {
    const { engine, receipt } = await applyFixtureChange(openEngine);
    const tampered = {
      ...receipt,
      afterSha256: "f".repeat(64),
    };

    await expect(engine.rollback({ receipt: tampered })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_CONFIG_RECEIPT_INVALID",
    });
  });

  it.each([
    ["prototype pollution", ["__proto__"]],
    ["constructor pollution", ["constructor", "prototype"]],
    ["dot traversal", ["..", "secret"]],
    ["slash traversal", ["safe/../../secret"]],
  ])("rejects %s key paths", async (_label, path) => {
    const engine = await openEngine();
    await expect(engine.plan({
      operations: [{ op: "set", path, value: true }],
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_CONFIG_OPERATION_INVALID" });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("rejects path escape, symlink or junction traversal, and non-JSON-object targets", async () => {
    const outside = join(dirname(root), `${root.split(/[\\/]/u).at(-1)}-outside.json`);
    await writeFile(outside, "{}", "utf8");
    await expect(openEngine({ targetPath: outside })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_CONFIG_PATH_UNSAFE",
    });
    await expect(openEngine({ backupDir: join(dirname(root), "outside-backups") })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_CONFIG_PATH_UNSAFE",
    });
    await expect(openEngine({ journalPath: join(dirname(root), "outside-journal.json") })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_CONFIG_PATH_UNSAFE",
    });

    const realDirectory = join(root, "real-client");
    const linkedDirectory = join(root, "linked-client");
    await mkdir(realDirectory);
    await writeFile(join(realDirectory, "config.json"), "{}", "utf8");
    try {
      await symlink(realDirectory, linkedDirectory, process.platform === "win32" ? "junction" : "dir");
      await expect(openEngine({ targetPath: join(linkedDirectory, "config.json") })).rejects.toMatchObject({
        code: "LOCAL_CLIENT_CONFIG_PATH_UNSAFE",
      });
    } catch (error) {
      if (!hasCode(error, "EPERM") && !hasCode(error, "EACCES")) throw error;
    } finally {
      await rm(outside, { force: true });
    }

    await writeFile(targetPath, "[]", "utf8");
    const arrayEngine = await openEngine();
    await expect(arrayEngine.plan({
      operations: [{ op: "set", path: ["safe"], value: true }],
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_CONFIG_JSON_INVALID" });
    await writeFile(targetPath, "{/*comment*/\"safe\":true}", "utf8");
    const jsoncEngine = await openEngine();
    await expect(jsoncEngine.plan({
      operations: [{ op: "set", path: ["safe"], value: false }],
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_CONFIG_JSON_INVALID" });
  });

  it("rejects unknown operation fields and overlapping key paths", async () => {
    const engine = await openEngine();
    await expect(engine.plan({
      operations: [{
        op: "set",
        path: ["safe"],
        value: true,
        endpoint: "attacker-controlled",
      } as never],
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_CONFIG_OPERATION_INVALID" });
    await expect(engine.plan({
      operations: [
        { op: "set", path: ["safe"], value: {} },
        { op: "set", path: ["safe", "nested"], value: true },
      ],
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_CONFIG_OPERATION_INVALID" });
  });

  it("reclaims expired committed entries inside the next apply lock", async () => {
    const firstEngine = await openEngine({
      maxTransactions: 1,
      committedRetentionMs: 100,
    });
    const firstPlan = await firstEngine.plan({
      operations: [{ op: "set", path: ["first"], value: true }],
    });
    const firstReceipt = await firstEngine.apply({ planId: firstPlan.planId });
    const firstJournal = await readJournal(journalPath);
    const firstBackupPath = join(backupDir, firstJournal.entries[0].backupFileName);
    expect(await exists(firstBackupPath)).toBe(true);

    clockMs = firstReceipt.committedAtMs + 100;
    const secondEngine = await openEngine({
      maxTransactions: 1,
      committedRetentionMs: 100,
    });
    const secondPlan = await secondEngine.plan({
      operations: [{ op: "set", path: ["second"], value: true }],
    });
    await expect(secondEngine.apply({ planId: secondPlan.planId })).resolves.toMatchObject({
      planId: secondPlan.planId,
    });
    expect(await exists(firstBackupPath)).toBe(false);
    const compacted = await readJournal(journalPath);
    expect(compacted.entries).toHaveLength(1);
    expect(compacted.entries[0].planId).toBe(secondPlan.planId);
  });

  it("does not prune unexpired committed or pending recovery entries", async () => {
    const committedEngine = await openEngine({
      maxTransactions: 1,
      committedRetentionMs: 100,
    });
    const committedPlan = await committedEngine.plan({
      operations: [{ op: "set", path: ["committed"], value: true }],
    });
    await committedEngine.apply({ planId: committedPlan.planId });
    clockMs += 99;
    const stillFull = await openEngine({
      maxTransactions: 1,
      committedRetentionMs: 100,
    });
    const nextPlan = await stillFull.plan({
      operations: [{ op: "set", path: ["next"], value: true }],
    });
    await expect(stillFull.apply({ planId: nextPlan.planId })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_CONFIG_JOURNAL_CAPACITY",
    });

    const journal = await readJournal(journalPath);
    makeApplyPending(journal.entries[0]);
    await writeJournal(journalPath, journal);
    clockMs += 10_000;
    const pendingEngine = await openEngine({
      maxTransactions: 1,
      committedRetentionMs: 100,
    });
    const pendingPlan = await pendingEngine.plan({
      operations: [{ op: "set", path: ["pending"], value: true }],
    });
    await expect(pendingEngine.apply({ planId: pendingPlan.planId })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_CONFIG_RECOVERY_REQUIRED",
    });
    expect((await readJournal(journalPath)).entries[0].status).toBe("pending");
    expect(await readdir(backupDir)).toHaveLength(1);
  });

  it("fails closed when the persisted transaction clock moves backwards", async () => {
    const engine = await openEngine();
    const plan = await engine.plan({
      operations: [{ op: "set", path: ["clock"], value: true }],
    });
    const receipt = await engine.apply({ planId: plan.planId });
    await engine.close();
    clockMs = receipt.committedAtMs - 1;
    await expect(openEngine()).rejects.toMatchObject({
      code: "LOCAL_CLIENT_CONFIG_CLOCK_INVALID",
      category: "integrity",
    });
  });

  it("enforces configured file and transaction capacities", async () => {
    await writeFile(targetPath, `${JSON.stringify({ padding: "x".repeat(512) })}\n`, "utf8");
    const sizeBoundEngine = await openEngine({ maxBytes: 256 });
    await expect(sizeBoundEngine.plan({
      operations: [{ op: "set", path: ["managed"], value: true }],
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_CONFIG_TOO_LARGE" });

    await writeFile(targetPath, fixtureConfig(), "utf8");
    const firstEngine = await openEngine({ maxTransactions: 1 });
    const firstPlan = await firstEngine.plan({
      operations: [{ op: "set", path: ["first"], value: true }],
    });
    await firstEngine.apply({ planId: firstPlan.planId });
    const secondEngine = await openEngine({ maxTransactions: 1 });
    const secondPlan = await secondEngine.plan({
      operations: [{ op: "set", path: ["second"], value: true }],
    });
    await expect(secondEngine.apply({ planId: secondPlan.planId })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_CONFIG_JOURNAL_CAPACITY",
    });
  });
});

function fixtureConfig(): string {
  return `${JSON.stringify({
    unrelated: {
      theme: "dark",
      nested: { keep: true },
    },
    mcpServers: {
      existing: { command: "existing" },
      obsolete: { command: "remove-me" },
    },
  }, null, 2)}\n`;
}

async function applyFixtureChange(
  openEngine: () => ReturnType<typeof createLocalClientConfigTransactionEngine>,
): Promise<{
  engine: Awaited<ReturnType<typeof createLocalClientConfigTransactionEngine>>;
  receipt: LocalClientConfigReceipt;
}> {
  const engine = await openEngine();
  const plan = await engine.plan({
    operations: [{ op: "set", path: ["managed"], value: true }],
  });
  const receipt = await engine.apply({ planId: plan.planId });
  return { engine, receipt };
}

type MutableJournal = {
  journalVersion: typeof LOCAL_CLIENT_CONFIG_JOURNAL_VERSION;
  sequence: number;
  entries: MutableJournalEntry[];
};

type MutableJournalEntry = Record<string, unknown> & {
  transactionId: string;
  backupFileName: string;
  status: string;
  createdAtMs: number;
  updatedAtMs: number;
  afterIdentityFingerprint: string | null;
  committedAtMs: number | null;
  receiptDigest: string | null;
  rolledBackAtMs: number | null;
  rollbackReceiptDigest: string | null;
};

async function readJournal(path: string): Promise<MutableJournal> {
  return JSON.parse(await readFile(path, "utf8")) as MutableJournal;
}

async function writeJournal(path: string, journal: MutableJournal): Promise<void> {
  await writeFile(path, `${JSON.stringify(journal, null, 2)}\n`, "utf8");
}

function makeApplyPending(entry: MutableJournalEntry): void {
  entry.status = "pending";
  entry.afterIdentityFingerprint = null;
  entry.committedAtMs = null;
  entry.receiptDigest = null;
  entry.rolledBackAtMs = null;
  entry.rollbackReceiptDigest = null;
  entry.updatedAtMs = entry.createdAtMs;
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}

function hasCode(error: unknown, code: string): boolean {
  return error !== null
    && typeof error === "object"
    && (error as { code?: unknown }).code === code;
}
