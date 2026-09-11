import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveGovernanceSecret } from "./governanceSecret.ts";

const aclEnv = { USERNAME: process.env.USERNAME, USERDOMAIN: process.env.USERDOMAIN };

describe("Agent Governance secret storage", () => {
  it("creates once with strong material and reuses the same value", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "agent-governance-secret-"));
    try {
      const first = resolveGovernanceSecret({ dataDir, env: aclEnv });
      const second = resolveGovernanceSecret({ dataDir, env: aclEnv });
      expect(first).toHaveLength(96);
      expect(second).toBe(first);
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  it("refuses weak configured keys and never replaces truncated durable material", async () => {
    expect(() => resolveGovernanceSecret({
      dataDir: "unused",
      env: { AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "too-short" },
    })).toThrow(/at least 32/u);

    const dataDir = await mkdtemp(join(tmpdir(), "agent-governance-secret-truncated-"));
    const path = join(dataDir, "secret.key");
    try {
      await writeFile(path, "truncated", "utf8");
      expect(() => resolveGovernanceSecret({ dataDir, env: aclEnv })).toThrow(/truncated/u);
      expect(await readFile(path, "utf8")).toBe("truncated");
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});
