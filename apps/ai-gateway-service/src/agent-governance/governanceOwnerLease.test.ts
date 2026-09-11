import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  acquireGovernanceOwnerLease,
  GOVERNANCE_OWNER_LEASE_FILE,
} from "./governanceOwnerLease.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function tempDataDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "governance-owner-lease-"));
  roots.push(root);
  return root;
}

describe("Agent Governance owner lease", () => {
  it("creates non-secret owner metadata exclusively and releases idempotently", async () => {
    const dataDir = await tempDataDir();
    const lease = acquireGovernanceOwnerLease({ dataDir });
    const stored = JSON.parse(await readFile(join(dataDir, GOVERNANCE_OWNER_LEASE_FILE), "utf8"));

    expect(stored).toMatchObject({ schemaVersion: 2, pid: process.pid, runtime: "node" });
    expect(stored.processFingerprint).toMatch(/^(linux-proc-start-ticks|windows-start-ticks|posix-ps-lstart):/u);
    expect(await readdir(dataDir)).toEqual([GOVERNANCE_OWNER_LEASE_FILE]);
    expect(Object.keys(stored).sort()).toEqual([
      "acquiredAt",
      "ownerId",
      "pid",
      "processFingerprint",
      "runtime",
      "schemaVersion",
    ]);
    expect(() => lease.assertHeld()).not.toThrow();

    lease.release();
    expect(() => lease.assertHeld()).toThrow(expect.objectContaining({
      code: "AGENT_GOVERNANCE_OWNER_LEASE_NOT_HELD",
    }));
    lease.release();
    await expect(readFile(join(dataDir, GOVERNANCE_OWNER_LEASE_FILE), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("fails closed while the recorded owner process is alive", async () => {
    const dataDir = await tempDataDir();
    const lease = acquireGovernanceOwnerLease({ dataDir });

    expect(() => acquireGovernanceOwnerLease({ dataDir })).toThrow(expect.objectContaining({
      code: "AGENT_GOVERNANCE_OWNER_LEASE_OCCUPIED",
    }));

    lease.release();
  });

  it("excludes a separate live Node process from the same data directory", async () => {
    const dataDir = await tempDataDir();
    const moduleUrl = new URL("./governanceOwnerLease.ts", import.meta.url).href;
    const script = `
      const { acquireGovernanceOwnerLease } = await import(${JSON.stringify(moduleUrl)});
      const lease = acquireGovernanceOwnerLease({ dataDir: process.argv.at(-1) });
      process.stdout.write("READY\\n");
      process.stdin.setEncoding("utf8");
      process.stdin.once("data", () => { lease.release(); process.exit(0); });
    `;
    const child = spawn(process.execPath, ["--input-type=module", "--eval", script, dataDir], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });

    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`child owner did not start: ${stderr}`)), 10_000);
        child.once("error", reject);
        child.once("exit", (code) => reject(new Error(`child owner exited early (${code}): ${stderr}`)));
        child.stdout.setEncoding("utf8");
        child.stdout.once("data", (chunk) => {
          if (!String(chunk).includes("READY")) {
            reject(new Error(`unexpected child owner output: ${chunk}`));
            return;
          }
          clearTimeout(timer);
          resolve();
        });
      });

      expect(() => acquireGovernanceOwnerLease({ dataDir })).toThrow(expect.objectContaining({
        code: "AGENT_GOVERNANCE_OWNER_LEASE_OCCUPIED",
      }));
      const stored = JSON.parse(await readFile(join(dataDir, GOVERNANCE_OWNER_LEASE_FILE), "utf8"));
      expect(stored).toMatchObject({ pid: child.pid, schemaVersion: 2 });
      expect(stored.processFingerprint).toEqual(expect.any(String));
    } finally {
      child.stdin.end("release\n");
      await new Promise<void>((resolve) => {
        if (child.exitCode !== null) resolve();
        else child.once("exit", () => resolve());
      });
    }
  });

  it("removes a stale lease only after definite dead-process verification", async () => {
    const dataDir = await tempDataDir();
    const first = acquireGovernanceOwnerLease({
      dataDir,
      pid: 424242,
      getProcessFingerprint: () => "test:dead-owner",
    });
    // Simulate a crashed owner by preserving its file without calling release.
    const second = acquireGovernanceOwnerLease({
      dataDir,
      getProcessFingerprint: (pid) => pid === 424242 ? "absent" : "test:current-owner",
    });

    expect(second.owner.pid).toBe(process.pid);
    second.release();
    void first;
  });

  it("reclaims a lease when the PID was reused by a different process instance", async () => {
    const dataDir = await tempDataDir();
    const reusedPid = 424243;
    const first = acquireGovernanceOwnerLease({
      dataDir,
      pid: reusedPid,
      getProcessFingerprint: () => "test:old-process-start",
    });

    const second = acquireGovernanceOwnerLease({
      dataDir,
      getProcessFingerprint: (pid) => pid === reusedPid
        ? "test:new-process-start"
        : "test:current-process-start",
    });

    expect(second.owner.pid).toBe(process.pid);
    expect(second.owner.processFingerprint).toBe("test:current-process-start");
    second.release();
    void first;
  });

  it("preserves malformed and unverifiable leases", async () => {
    const dataDir = await tempDataDir();
    const leasePath = join(dataDir, GOVERNANCE_OWNER_LEASE_FILE);
    await writeFile(leasePath, "not-json", "utf8");

    expect(() => acquireGovernanceOwnerLease({ dataDir })).toThrow(expect.objectContaining({
      code: "AGENT_GOVERNANCE_OWNER_LEASE_UNVERIFIABLE",
    }));
    expect(await readFile(leasePath, "utf8")).toBe("not-json");
  });

  it("preserves valid metadata when the process instance cannot be established", async () => {
    const dataDir = await tempDataDir();
    const first = acquireGovernanceOwnerLease({
      dataDir,
      pid: 424244,
      getProcessFingerprint: () => "test:unverifiable-owner",
    });
    const before = await readFile(first.leasePath, "utf8");

    expect(() => acquireGovernanceOwnerLease({
      dataDir,
      getProcessFingerprint: (pid) => pid === process.pid ? "test:current-owner" : "unknown",
    })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_OWNER_LEASE_UNVERIFIABLE" }));
    expect(await readFile(first.leasePath, "utf8")).toBe(before);
  });

  it("does not remove a lease whose owner token changed", async () => {
    const dataDir = await tempDataDir();
    const lease = acquireGovernanceOwnerLease({ dataDir });
    const stored = JSON.parse(await readFile(lease.leasePath, "utf8"));
    stored.ownerId = "00000000-0000-4000-8000-000000000000";
    await writeFile(lease.leasePath, `${JSON.stringify(stored)}\n`, "utf8");

    expect(() => lease.release()).toThrow(expect.objectContaining({
      code: "AGENT_GOVERNANCE_OWNER_LEASE_RELEASE_MISMATCH",
    }));
    await expect(readFile(lease.leasePath, "utf8")).resolves.toContain(stored.ownerId);
  });
});
