import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertRegistryAuthorityMode,
  assertRegistryAuthorityModeSync,
  computeSignedJsonRegistryDigest,
  readRegistryAuthoritySwitchMarker,
  readRegistryAuthoritySwitchMarkerSync,
  REGISTRY_AUTHORITY_SWITCH_FILE,
  writeRegistryAuthoritySwitchMarker,
} from "./registryAuthoritySwitch.ts";

const SECRET = "registry-authority-switch-test-secret-0123456789";
const BINDING = `sqlite-v2:${"a".repeat(64)}`;
const roots: string[] = [];
const identityModel = vi.hoisted(() => ({ path: null as string | null, swapped: false,
  first: 18295873486449854n, second: 18295873486449856n }));

// Model the observed NTFS precision collision while keeping real files,
// handles, path replacement and marker signatures on every test platform.
vi.mock("node:fs/promises", async original => {
  const actual = await original<typeof import("node:fs/promises")>();
  const withIdentity = (stats: any, identity: bigint) => {
    Object.defineProperty(stats, "ino", { value: typeof stats.ino === "bigint" ? identity : Number(identity) });
    return stats;
  };
  return { ...actual,
    lstat: async (path: any, options: any) => {
      const stats = await actual.lstat(path, options);
      return path === identityModel.path ? withIdentity(stats, identityModel.swapped ? identityModel.second : identityModel.first) : stats;
    },
    open: async (path: any, flags: any, mode: any) => {
      const handle = await actual.open(path, flags, mode);
      if (path === identityModel.path) {
        const stat = handle.stat.bind(handle), identity = identityModel.swapped ? identityModel.second : identityModel.first;
        handle.stat = (async (options: any) => withIdentity(await stat(options), identity)) as typeof handle.stat;
      }
      return handle;
    },
  };
});

afterEach(async () => {
  identityModel.path = null; identityModel.swapped = false;
  const temporaryRoot = await realpath(tmpdir());
  for (const root of roots.splice(0)) {
    const owned = await realpath(root);
    expect(dirname(owned)).toBe(temporaryRoot); expect(basename(owned).startsWith("registry-authority-switch-")).toBe(true);
    await rm(owned, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

describe("Registry authority switch marker", () => {
  it("writes one exclusive HMAC marker and idempotently preserves the first completedAt", async () => {
    const root = await fixture();
    const sourceDigest = await computeSignedJsonRegistryDigest(root);
    const first = await writeRegistryAuthoritySwitchMarker({
      dataDir: root,
      secret: SECRET,
      sourceAgentsSha256: sourceDigest!,
      targetAuthorityBinding: BINDING,
      recordCount: 2,
      sqliteSchemaVersion: 3,
      completedAt: "2026-08-31T00:00:00.000Z",
    });
    const repeated = await writeRegistryAuthoritySwitchMarker({
      dataDir: root,
      secret: SECRET,
      sourceAgentsSha256: sourceDigest!,
      targetAuthorityBinding: BINDING,
      recordCount: 2,
      sqliteSchemaVersion: 3,
      completedAt: "2026-08-31T01:00:00.000Z",
    });

    expect(repeated).toEqual(first);
    expect(repeated.completedAt).toBe("2026-08-31T00:00:00.000Z");
    expect((await lstat(join(root, REGISTRY_AUTHORITY_SWITCH_FILE))).nlink).toBe(1);
    expect(await readRegistryAuthoritySwitchMarker({ dataDir: root, secret: SECRET }))
      .toEqual(first);
    expect(readRegistryAuthoritySwitchMarkerSync({ dataDir: root, secret: SECRET }))
      .toEqual(first);
  });

  it("retires JSON mode and requires the exact SQLite v2 authority", async () => {
    const root = await fixture();
    const sourceDigest = await computeSignedJsonRegistryDigest(root);
    await writeRegistryAuthoritySwitchMarker({
      dataDir: root,
      secret: SECRET,
      sourceAgentsSha256: sourceDigest!,
      targetAuthorityBinding: BINDING,
      recordCount: 2,
      sqliteSchemaVersion: 3,
    });

    await expect(assertRegistryAuthorityMode({ dataDir: root, secret: SECRET, mode: "json" }))
      .rejects.toMatchObject({ code: "AGENT_REGISTRY_JSON_AUTHORITY_RETIRED" });
    expect(() => assertRegistryAuthorityModeSync({ dataDir: root, secret: SECRET, mode: "json" }))
      .toThrow(expect.objectContaining({ code: "AGENT_REGISTRY_JSON_AUTHORITY_RETIRED" }));

    const target = {
      authorityProtocol: "sqlite-checkpoint-v1",
      authorityBinding: BINDING,
      recordCount: 2,
      sqliteSchemaVersion: 3,
    };
    await expect(assertRegistryAuthorityMode({
      dataDir: root,
      secret: SECRET,
      mode: "sqlite",
      target,
    })).resolves.toMatchObject({ target: { authorityBinding: BINDING } });
    expect(assertRegistryAuthorityModeSync({
      dataDir: root,
      secret: SECRET,
      mode: "sqlite",
      target,
    })).toMatchObject({ target: { authorityBinding: BINDING } });

    await expect(assertRegistryAuthorityMode({
      dataDir: root,
      secret: SECRET,
      mode: "sqlite",
      target: { ...target, recordCount: 1 },
    })).rejects.toMatchObject({ code: "AGENT_REGISTRY_AUTHORITY_SWITCH_MISMATCH" });
  });

  it("requires a switch for SQLite whenever agents.json exists", async () => {
    const root = await fixture();
    await expect(assertRegistryAuthorityMode({
      dataDir: root,
      secret: SECRET,
      mode: "sqlite",
      target: {
        authorityProtocol: "sqlite-checkpoint-v1",
        authorityBinding: BINDING,
        recordCount: 2,
        sqliteSchemaVersion: 3,
      },
    })).rejects.toMatchObject({ code: "AGENT_REGISTRY_AUTHORITY_SWITCH_REQUIRED" });
    await expect(assertRegistryAuthorityMode({ dataDir: root, secret: SECRET, mode: "json" }))
      .resolves.toBeNull();
  });

  it("rejects HMAC tampering and a conflicting immutable switch", async () => {
    const root = await fixture();
    const sourceDigest = await computeSignedJsonRegistryDigest(root);
    await writeRegistryAuthoritySwitchMarker({
      dataDir: root,
      secret: SECRET,
      sourceAgentsSha256: sourceDigest!,
      targetAuthorityBinding: BINDING,
      recordCount: 2,
      sqliteSchemaVersion: 3,
    });
    await expect(writeRegistryAuthoritySwitchMarker({
      dataDir: root,
      secret: SECRET,
      sourceAgentsSha256: sourceDigest!,
      targetAuthorityBinding: `sqlite-v2:${"b".repeat(64)}`,
      recordCount: 2,
      sqliteSchemaVersion: 3,
    })).rejects.toMatchObject({ code: "AGENT_REGISTRY_AUTHORITY_SWITCH_CONFLICT" });

    const markerPath = join(root, REGISTRY_AUTHORITY_SWITCH_FILE);
    const marker = JSON.parse(await readFile(markerPath, "utf8"));
    marker.target.recordCount = 3;
    await writeFile(markerPath, `${JSON.stringify(marker)}\n`, "utf8");
    await expect(readRegistryAuthoritySwitchMarker({ dataDir: root, secret: SECRET }))
      .rejects.toMatchObject({ code: "AGENT_REGISTRY_AUTHORITY_SWITCH_INVALID" });
  });

  it("rejects hard links, symbolic links and path swaps instead of following them", async () => {
    const root = await fixture();
    const sourceDigest = await computeSignedJsonRegistryDigest(root);
    await writeRegistryAuthoritySwitchMarker({
      dataDir: root,
      secret: SECRET,
      sourceAgentsSha256: sourceDigest!,
      targetAuthorityBinding: BINDING,
      recordCount: 2,
      sqliteSchemaVersion: 3,
    });
    const markerPath = join(root, REGISTRY_AUTHORITY_SWITCH_FILE);
    const hardLinkPath = join(root, "marker-hardlink.json");
    await link(markerPath, hardLinkPath);
    await expect(readRegistryAuthoritySwitchMarker({ dataDir: root, secret: SECRET }))
      .rejects.toMatchObject({ code: "AGENT_REGISTRY_AUTHORITY_FILE_UNSAFE" });
    await unlink(hardLinkPath);

    const backupPath = join(root, "marker-backup.json");
    await rename(markerPath, backupPath);
    try {
      await symlink(backupPath, markerPath, "file");
      await expect(readRegistryAuthoritySwitchMarker({ dataDir: root, secret: SECRET }))
        .rejects.toMatchObject({ code: "AGENT_REGISTRY_AUTHORITY_FILE_UNSAFE" });
      await unlink(markerPath);
      await rename(backupPath, markerPath);
    } catch (error) {
      if ((error as { code?: unknown })?.code !== "EPERM") throw error;
      // Some Windows runners deny symlink creation before application code can
      // observe it. The hard-link and inode-swap probes below remain active.
      await rename(backupPath, markerPath);
    }

    const bytes = await readFile(markerPath);
    const originalIdentity = await lstat(markerPath, { bigint: true });
    let swapped = false;
    await expect(readRegistryAuthoritySwitchMarker({
      dataDir: root,
      secret: SECRET,
      fileReadProbe: async (_stage, path) => {
        if (swapped) return;
        swapped = true;
        await rename(path, backupPath);
        await writeFile(path, bytes);
        expect((await lstat(path, { bigint: true })).ino).not.toBe(originalIdentity.ino);
      },
    })).rejects.toMatchObject({ code: "AGENT_REGISTRY_AUTHORITY_FILE_UNSAFE" });
  });
});

it("rejects a real path swap when two distinct full file IDs round to the same Number", async () => {
  expect(identityModel.first).not.toBe(identityModel.second);
  expect(Number(identityModel.first)).toBe(Number(identityModel.second));
  const root = await fixture();
  await writeRegistryAuthoritySwitchMarker({ dataDir: root, secret: SECRET,
    sourceAgentsSha256: (await computeSignedJsonRegistryDigest(root))!, targetAuthorityBinding: BINDING,
    recordCount: 2, sqliteSchemaVersion: 3 });
  const path = join(root, REGISTRY_AUTHORITY_SWITCH_FILE), bytes = await readFile(path);
  identityModel.path = path;
  await expect(readRegistryAuthoritySwitchMarker({ dataDir: root, secret: SECRET,
    fileReadProbe: async (_stage, target) => {
      await rename(target, join(root, "precision-original.json"));
      await writeFile(target, bytes);
      identityModel.swapped = true;
    },
  })).rejects.toMatchObject({ code: "AGENT_REGISTRY_AUTHORITY_FILE_UNSAFE" });
  expect(identityModel.swapped).toBe(true);
});

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "registry-authority-switch-"));
  roots.push(root);
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "agents.json"), JSON.stringify({
    version: 1,
    updatedAt: "2026-08-31T00:00:00.000Z",
    agents: {},
  }), "utf8");
  return root;
}
