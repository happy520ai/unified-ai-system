import { spawnSync } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { AgentRegistryRecord } from "@unified-ai-system/shared-contracts";
import { afterEach, describe, expect, it } from "vitest";
import { migrateAgentGovernanceJsonToSqlite } from "../../../../tools/migrate-agent-governance-json-to-sqlite.mjs";
import { createAgentRegistryStore } from "./agentRegistryStore.ts";
import {
  assertRegistryAuthorityMode,
  readRegistryAuthoritySwitchMarker,
  REGISTRY_AUTHORITY_SWITCH_FILE,
} from "./registryAuthoritySwitch.ts";
import {
  createSqliteAgentRegistryStore,
  verifySqliteAgentRegistryAuthoritySnapshot,
} from "./sqliteAgentRegistryStore.ts";
import { createUsageStore } from "./usageStore.ts";

const SECRET = "json-to-sqlite-registry-migration-test-secret-0123456789";
const HOST_ID = "migration-test-host";
const NOW = "2026-08-31T00:00:00.000Z";
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 50,
  })));
});

describe.sequential("signed JSON to SQLite Agent Registry migration", () => {
  it("exposes a credential-free help command through the root migration script", async () => {
    const packageJson = JSON.parse(await readFile(resolve(process.cwd(), "package.json"), "utf8"));
    expect(packageJson.scripts["migrate:agent-governance:sqlite"])
      .toBe("node tools/migrate-agent-governance-json-to-sqlite.mjs");
    const result = spawnSync(process.execPath, [
      resolve(process.cwd(), "tools/migrate-agent-governance-json-to-sqlite.mjs"),
      "--help",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Offline signed JSON -> SQLite Agent Registry migration");
    expect(result.stdout).toContain("--source-dir <dir> --target <db> --host-id <stable-id>");
    expect(`${result.stdout}${result.stderr}`).not.toContain(SECRET);
  });

  it("atomically copies every record and lineage edge, then retires JSON authority", async () => {
    const fixture = await createFixture();
    const sourceBytesBefore = await readFile(join(fixture.sourceDir, "agents.json"));
    const summary = await migrate(fixture);

    expect(summary).toMatchObject({
      status: "migrated",
      sourceFormat: "signed-json-v1",
      targetFormat: "sqlite-checkpoint-v1",
      sourceVerified: true,
      targetVerified: true,
      authoritySwitchVerified: true,
      targetReady: true,
      recordCount: 2,
      rootCount: 1,
      relationshipCount: 1,
    });
    expect(summary.semanticDigest).toMatch(/^sha256:[a-f0-9]{64}$/u);
    const publicOutput = JSON.stringify(summary);
    for (const forbidden of ["tenant-a", "agt_parent", "agt_child", SECRET, fixture.root]) {
      expect(publicOutput).not.toContain(forbidden);
    }
    expect(await readFile(join(fixture.sourceDir, "agents.json"))).toEqual(sourceBytesBefore);
    expect(await exists(`${fixture.targetPath}-wal`)).toBe(false);
    expect(await exists(`${fixture.targetPath}-shm`)).toBe(false);

    const marker = await readRegistryAuthoritySwitchMarker({
      dataDir: fixture.sourceDir,
      secret: SECRET,
    });
    expect(marker).toMatchObject({
      source: { kind: "signed-json-v1" },
      target: {
        kind: "sqlite-checkpoint-v1",
        recordCount: 2,
      },
    });
    await expect(assertRegistryAuthorityMode({
      dataDir: fixture.sourceDir,
      secret: SECRET,
      mode: "json",
    })).rejects.toMatchObject({ code: "AGENT_REGISTRY_JSON_AUTHORITY_RETIRED" });

    const snapshot = verifySqliteAgentRegistryAuthoritySnapshot({
      sqlitePath: fixture.targetPath,
      checkpointPath: fixture.checkpointPath,
      hostId: HOST_ID,
      hmacSecret: SECRET,
    });
    expect(snapshot).toMatchObject({
      authorityProtocol: "sqlite-checkpoint-v1",
      recordCount: 2,
      checkpointVerified: true,
    });
    const target = createSqliteAgentRegistryStore({
      sqlitePath: fixture.targetPath,
      checkpointPath: fixture.checkpointPath,
      hostId: HOST_ID,
      hmacSecret: SECRET,
    });
    expect(sortRecords(await target.listAll())).toEqual(sortRecords(fixture.records));
    await target.close();
  });

  it("is idempotent and never overwrites the first completed marker", async () => {
    const fixture = await createFixture();
    await migrate(fixture);
    const markerPath = join(fixture.sourceDir, REGISTRY_AUTHORITY_SWITCH_FILE);
    const markerBefore = await readFile(markerPath);
    const targetBefore = verifySqliteAgentRegistryAuthoritySnapshot({
      sqlitePath: fixture.targetPath,
      checkpointPath: fixture.checkpointPath,
      hostId: HOST_ID,
      hmacSecret: SECRET,
    });

    const repeated = await migrate(fixture, { now: () => "2026-08-31T02:00:00.000Z" });
    expect(repeated.status).toBe("already-complete");
    expect(await readFile(markerPath)).toEqual(markerBefore);
    expect(verifySqliteAgentRegistryAuthoritySnapshot({
      sqlitePath: fixture.targetPath,
      checkpointPath: fixture.checkpointPath,
      hostId: HOST_ID,
      hmacSecret: SECRET,
    })).toEqual(targetBefore);
  });

  it("rejects source tampering before creating any target", async () => {
    const fixture = await createFixture();
    const sourcePath = join(fixture.sourceDir, "agents.json");
    await writeFile(sourcePath, `${await readFile(sourcePath, "utf8")} `, "utf8");

    await expect(migrate(fixture)).rejects.toMatchObject({
      code: "SOURCE_REGISTRY_VERIFICATION_FAILED",
    });
    expect(await exists(fixture.targetPath)).toBe(false);
    expect(await exists(fixture.checkpointPath)).toBe(false);
    expect(await exists(join(fixture.sourceDir, REGISTRY_AUTHORITY_SWITCH_FILE))).toBe(false);
    expect(await exists(join(fixture.sourceDir, "owner.lease.json"))).toBe(false);
  });

  it("verifies every anchored JSON state entry before trusting the Registry snapshot", async () => {
    const fixture = await createFixture();
    const usage = createUsageStore({ dataDir: fixture.sourceDir, secret: SECRET, now: () => NOW });
    await usage.increment("agt_parent", "steps");
    const usagePath = join(fixture.sourceDir, "usage.json");
    await writeFile(usagePath, `${await readFile(usagePath, "utf8")} `, "utf8");

    await expect(migrate(fixture)).rejects.toMatchObject({
      code: "SOURCE_REGISTRY_VERIFICATION_FAILED",
    });
    expect(await exists(fixture.targetPath)).toBe(false);
    expect(await exists(join(fixture.sourceDir, REGISTRY_AUTHORITY_SWITCH_FILE))).toBe(false);
  });

  it("refuses pending signed-state recovery journals without mutating them", async () => {
    const fixture = await createFixture();
    const journalPath = join(fixture.sourceDir, "agent-generation.journal.json");
    const bytes = Buffer.from('{"pending":true}\n', "utf8");
    await writeFile(journalPath, bytes);

    await expect(migrate(fixture)).rejects.toMatchObject({ code: "SOURCE_RECOVERY_REQUIRED" });
    expect(await readFile(journalPath)).toEqual(bytes);
    expect(await exists(fixture.targetPath)).toBe(false);
  });

  it("rejects signed JSON records that violate SQLite lineage semantics before target creation", async () => {
    const fixture = await createFixture({ records: [
      record("agt_orphan", {
        parentAgentId: "agt_missing_parent",
        generationDepth: 1,
      }),
    ] });

    await expect(migrate(fixture)).rejects.toMatchObject({
      code: "SOURCE_REGISTRY_SEMANTICS_INVALID",
    });
    expect(await exists(fixture.targetPath)).toBe(false);
    expect(await exists(fixture.checkpointPath)).toBe(false);
    expect(await exists(join(fixture.sourceDir, REGISTRY_AUTHORITY_SWITCH_FILE))).toBe(false);
  });

  it("preserves unknown reserved staging files instead of deleting them", async () => {
    const fixture = await createFixture();
    const stagingDatabase = `${fixture.targetPath}.migration-staging`;
    const stagingCheckpoint = `${fixture.checkpointPath}.migration-staging`;
    const unknownDatabase = Buffer.from("user-owned-staging-database", "utf8");
    const unknownCheckpoint = Buffer.from("user-owned-staging-checkpoint", "utf8");
    await mkdir(dirname(stagingDatabase), { recursive: true });
    await writeFile(stagingDatabase, unknownDatabase);
    await writeFile(stagingCheckpoint, unknownCheckpoint);

    await expect(migrate(fixture)).rejects.toMatchObject({ code: "TARGET_STAGING_CONFLICT" });
    expect(await readFile(stagingDatabase)).toEqual(unknownDatabase);
    expect(await readFile(stagingCheckpoint)).toEqual(unknownCheckpoint);
    expect(await exists(fixture.targetPath)).toBe(false);
  });

  it("cleans only staging claimed by the current failed attempt and retries safely", async () => {
    const fixture = await createFixture();
    await expect(migrate(fixture, {
      faultInjector: (stage: string) => {
        if (stage === "after-target-populated") throw new Error("simulated pre-publication failure");
      },
    })).rejects.toMatchObject({ code: "TARGET_MIGRATION_FAILED" });
    for (const path of [
      fixture.targetPath,
      fixture.checkpointPath,
      `${fixture.targetPath}.migration-staging`,
      `${fixture.checkpointPath}.migration-staging`,
      `${fixture.targetPath}.migration-staging.claim`,
    ]) expect(await exists(path)).toBe(false);

    await expect(migrate(fixture)).resolves.toMatchObject({ status: "migrated", targetReady: true });
  });

  it("recovers an authenticated exact staging authority but preserves unauthenticated conflicts", async () => {
    const fixture = await createFixture();
    const stagingDatabase = `${fixture.targetPath}.migration-staging`;
    const stagingCheckpoint = `${fixture.checkpointPath}.migration-staging`;
    const staging = createSqliteAgentRegistryStore({
      sqlitePath: stagingDatabase,
      checkpointPath: stagingCheckpoint,
      hostId: HOST_ID,
      hmacSecret: SECRET,
      now: () => NOW,
    });
    await staging.upsertMany(fixture.records);
    await staging.close();

    const summary = await migrate(fixture);
    expect(summary.status).toBe("recovered-complete");
    expect(await exists(stagingDatabase)).toBe(false);
    expect(await exists(stagingCheckpoint)).toBe(false);
    expect(await exists(fixture.targetPath)).toBe(true);
  });

  it("keeps a fully published target inactive after a fault and completes it on retry", async () => {
    const fixture = await createFixture();
    await expect(migrate(fixture, {
      faultInjector: (stage: string) => {
        if (stage === "after-target-published") throw new Error("simulated post-publication failure");
      },
    })).rejects.toMatchObject({ code: "TARGET_POST_PUBLISH_VERIFICATION_FAILED" });
    expect(await exists(fixture.targetPath)).toBe(true);
    expect(await exists(fixture.checkpointPath)).toBe(true);
    expect(await exists(join(fixture.sourceDir, REGISTRY_AUTHORITY_SWITCH_FILE))).toBe(false);
    await expect(assertRegistryAuthorityMode({
      dataDir: fixture.sourceDir,
      secret: SECRET,
      mode: "sqlite",
      target: {
        authorityProtocol: "sqlite-checkpoint-v1",
        authorityBinding: `sqlite-v2:${"0".repeat(64)}`,
        recordCount: 2,
        sqliteSchemaVersion: 3,
      },
    })).rejects.toMatchObject({ code: "AGENT_REGISTRY_AUTHORITY_SWITCH_REQUIRED" });

    await expect(migrate(fixture)).resolves.toMatchObject({
      status: "recovered-complete",
      targetReady: true,
    });
  });
});

async function createFixture(options: { records?: AgentRegistryRecord[] } = {}) {
  const root = await mkdtemp(join(tmpdir(), "agent-registry-json-sqlite-migration-"));
  roots.push(root);
  const sourceDir = join(root, "governance");
  const targetPath = join(root, "sqlite", "agent-registry.sqlite");
  const checkpointPath = join(root, "sqlite", "agent-registry.checkpoint.json");
  const records = options.records ?? parentAndChild();
  const source = createAgentRegistryStore({
    storePath: join(sourceDir, "agents.json"),
    secret: SECRET,
    now: () => NOW,
  });
  await source.upsertMany(records);
  return { root, sourceDir, targetPath, checkpointPath, records };
}

function migrate(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  overrides: Record<string, unknown> = {},
) {
  return migrateAgentGovernanceJsonToSqlite({
    sourceDir: fixture.sourceDir,
    targetPath: fixture.targetPath,
    checkpointPath: fixture.checkpointPath,
    hostId: HOST_ID,
    secret: SECRET,
    now: () => NOW,
    getProcessFingerprint: () => "test-process-fingerprint",
    ...overrides,
  });
}

function parentAndChild(): AgentRegistryRecord[] {
  const parent = record("agt_parent", {
    requestedTools: ["file_read", "grep"],
    grantedTools: ["file_read", "grep"],
    expiresAt: "2026-09-01T00:00:00.000Z",
  });
  return [
    parent,
    record("agt_child", {
      parentAgentId: parent.agentId,
      generationDepth: 1,
      requestedTools: ["file_read"],
      grantedTools: ["file_read"],
      expiresAt: "2026-08-31T12:00:00.000Z",
    }),
  ];
}

function record(agentId: string, overrides: Partial<AgentRegistryRecord> = {}): AgentRegistryRecord {
  return {
    agentId,
    name: agentId.replace("agt_", ""),
    purpose: "offline migration fixture",
    tenantId: "tenant-a",
    ownerUserId: "owner-a",
    createdBy: "owner-a",
    parentAgentId: null,
    generationDepth: 0,
    classification: { family: "analysis", domain: "testing", subclass: "migration" },
    traits: ["read_only"],
    riskLevel: "low",
    requestedTools: ["file_read"],
    grantedTools: ["file_read"],
    policyHash: `sha256:${"a".repeat(64)}`,
    status: "ACTIVE",
    createdAt: NOW,
    expiresAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function sortRecords(records: AgentRegistryRecord[]): AgentRegistryRecord[] {
  return records.map((record) => structuredClone(record))
    .sort((left, right) => left.agentId.localeCompare(right.agentId));
}

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}
