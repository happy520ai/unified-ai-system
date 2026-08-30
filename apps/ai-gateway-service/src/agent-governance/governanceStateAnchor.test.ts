import { mkdtemp, readFile, rm, truncate, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGovernanceStateFileBinding,
  type GovernanceStateCommitStage,
} from "./governanceStateAnchor.ts";
import { createGovernanceAuditLog } from "./governanceAuditLog.ts";

const SECRET = "test-only-governance-anchor-secret-0123456789";

function jsonBinding(
  path: string,
  faultInjector?: (stage: GovernanceStateCommitStage) => void,
  allowLegacyStateMigration = false,
) {
  return createGovernanceStateFileBinding({
    filePath: path,
    secret: SECRET,
    kind: "json",
    validateLegacy(content) {
      const value = JSON.parse(content.toString("utf8")) as { version?: unknown };
      if (value.version !== 1) throw new Error("invalid legacy schema");
    },
    allowLegacyStateMigration,
    faultInjector,
  });
}

describe("Agent Governance state rollback anchor", () => {
  it("bootstraps a genuinely empty installation", async () => {
    const root = await mkdtemp(join(tmpdir(), "governance-anchor-fresh-"));
    const path = join(root, "usage.json");
    try {
      await jsonBinding(path).verify();
      await expect(readFile(join(root, "governance-state.anchor.json"), "utf8"))
        .resolves.toContain("agent-governance-state-anchor-v1");
      await expect(readFile(join(root, "governance-state.checkpoint.json"), "utf8"))
        .resolves.toContain("agent-governance-state-checkpoint-v1");
      await expect(readFile(join(root, "governance-state.installation.json"), "utf8"))
        .resolves.toContain("agent-governance-state-installation-v1");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails closed on deletion and on a valid older file snapshot", async () => {
    const root = await mkdtemp(join(tmpdir(), "governance-anchor-rollback-"));
    const path = join(root, "usage.json");
    try {
      const state = jsonBinding(path);
      await state.commit(JSON.stringify({ version: 1, value: 1 }));
      const old = await readFile(path);
      await state.commit(JSON.stringify({ version: 1, value: 2 }));

      await writeFile(path, old);
      await expect(state.verify()).rejects.toMatchObject({ name: "GovernanceStateIntegrityError" });

      // Restore by replaying the latest authenticated commit is intentionally
      // impossible without its journal; use a second installation for deletion.
      const deletionRoot = await mkdtemp(join(tmpdir(), "governance-anchor-delete-"));
      try {
        const deletionPath = join(deletionRoot, "agents.json");
        const deletionState = jsonBinding(deletionPath);
        await deletionState.commit(JSON.stringify({ version: 1, agents: {} }));
        await unlink(deletionPath);
        await expect(deletionState.verify()).rejects.toMatchObject({
          name: "GovernanceStateIntegrityError",
        });
      } finally {
        await rm(deletionRoot, { recursive: true, force: true });
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("detects rollback of the signed anchor through the independent checkpoint", async () => {
    const root = await mkdtemp(join(tmpdir(), "governance-anchor-head-"));
    const path = join(root, "policies.json");
    const anchorPath = join(root, "governance-state.anchor.json");
    try {
      const state = jsonBinding(path);
      await state.commit(JSON.stringify({ version: 1, value: 1 }));
      const oldAnchor = await readFile(anchorPath);
      await state.commit(JSON.stringify({ version: 1, value: 2 }));
      await writeFile(anchorPath, oldAnchor);
      await expect(state.verify()).rejects.toThrow(/anchor and independent checkpoint diverged/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  for (const stage of ["after-journal", "after-file", "after-anchor", "after-checkpoint"] as const) {
    it(`rolls forward an authenticated commit interrupted ${stage}`, async () => {
      const root = await mkdtemp(join(tmpdir(), `governance-anchor-${stage}-`));
      const path = join(root, "approvals.json");
      try {
        let armed = false;
        let injected = false;
        const state = jsonBinding(path, (current) => {
          if (armed && !injected && current === stage) {
            injected = true;
            throw new Error(`simulated crash ${stage}`);
          }
        });
        await state.commit(JSON.stringify({ version: 1, value: 1 }));
        armed = true;
        await expect(state.commit(JSON.stringify({ version: 1, value: 2 })))
          .rejects.toThrow(`simulated crash ${stage}`);

        const restarted = jsonBinding(path);
        await restarted.verify();
        expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({ value: 2 });
        expect(JSON.parse(await readFile(join(root, "governance-state.anchor.json"), "utf8")))
          .toMatchObject({ revision: 2 });
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  }

  it("rejects canonical legacy state by default and migrates it only through the explicit seam", async () => {
    const defaultDeniedRoot = await mkdtemp(join(tmpdir(), "governance-anchor-migrate-default-denied-"));
    const validRoot = await mkdtemp(join(tmpdir(), "governance-anchor-migrate-valid-"));
    const invalidRoot = await mkdtemp(join(tmpdir(), "governance-anchor-migrate-invalid-"));
    try {
      const defaultDeniedPath = join(defaultDeniedRoot, "usage.json");
      await writeFile(defaultDeniedPath, JSON.stringify({ version: 1, usage: {} }));
      await expect(jsonBinding(defaultDeniedPath).verify())
        .rejects.toThrow(/explicit legacy migration is required/u);
      await expect(readFile(join(defaultDeniedRoot, "governance-state.anchor.json"), "utf8"))
        .rejects.toMatchObject({ code: "ENOENT" });

      const validPath = join(validRoot, "usage.json");
      await writeFile(validPath, JSON.stringify({ version: 1, usage: {} }));
      await jsonBinding(validPath, undefined, true).verify();
      expect(JSON.parse(await readFile(join(validRoot, "governance-state.anchor.json"), "utf8")))
        .toMatchObject({ revision: 0 });
      await Promise.all([
        rm(join(validRoot, "governance-state.anchor.json"), { force: true }),
        rm(join(validRoot, "governance-state.checkpoint.json"), { force: true }),
        rm(join(validRoot, "governance-state.installation.json"), { force: true }),
      ]);
      await expect(jsonBinding(validPath).verify())
        .rejects.toThrow(/explicit legacy migration is required/u);

      const invalidPath = join(invalidRoot, "usage.json");
      await writeFile(invalidPath, JSON.stringify({ version: 0, usage: {} }));
      await expect(jsonBinding(invalidPath, undefined, true).verify())
        .rejects.toThrow(/failed complete validation/u);
      await expect(readFile(join(invalidRoot, "governance-state.anchor.json"), "utf8"))
        .rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(defaultDeniedRoot, { recursive: true, force: true });
      await rm(validRoot, { recursive: true, force: true });
      await rm(invalidRoot, { recursive: true, force: true });
    }
  });

  it("does not accept an older canonical snapshot after all three signed heads are deleted", async () => {
    const root = await mkdtemp(join(tmpdir(), "governance-anchor-three-head-delete-"));
    const path = join(root, "usage.json");
    try {
      const state = jsonBinding(path);
      await state.commit(JSON.stringify({ version: 1, value: 1 }));
      const oldState = await readFile(path);
      await state.commit(JSON.stringify({ version: 1, value: 2 }));

      await Promise.all([
        rm(join(root, "governance-state.anchor.json"), { force: true }),
        rm(join(root, "governance-state.checkpoint.json"), { force: true }),
        rm(join(root, "governance-state.installation.json"), { force: true }),
        rm(join(root, "governance-state.journal.json"), { force: true }),
      ]);
      await writeFile(path, oldState);

      await expect(jsonBinding(path).verify()).rejects.toMatchObject({
        name: "GovernanceStateIntegrityError",
      });
      await expect(readFile(join(root, "governance-state.anchor.json"), "utf8"))
        .rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("detects audit tail truncation through its anchored head", async () => {
    const root = await mkdtemp(join(tmpdir(), "governance-anchor-audit-tail-"));
    const logPath = join(root, "audit-events.jsonl");
    try {
      const log = createGovernanceAuditLog({ logPath, secret: SECRET });
      await log.record({ eventType: "AGENT_ACTIVATED", agentId: "agt_one", timestamp: "2026-08-30T00:00:00.000Z" });
      await log.record({ eventType: "TOOL_REQUESTED", agentId: "agt_one", toolName: "file_read", timestamp: "2026-08-30T00:00:01.000Z" });
      const content = await readFile(logPath);
      await truncate(logPath, Math.max(0, content.byteLength - 20));
      await expect(log.read()).rejects.toMatchObject({ name: "GovernanceStateIntegrityError" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
