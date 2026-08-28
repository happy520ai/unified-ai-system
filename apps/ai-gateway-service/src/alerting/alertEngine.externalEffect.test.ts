import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ safeOutboundFetch: vi.fn() }));
vi.mock("../security/safeOutboundFetch.ts", () => ({
  safeOutboundFetch: mocks.safeOutboundFetch,
}));

import { createAlertEngine } from "./alertEngine.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  mocks.safeOutboundFetch.mockReset();
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createLogDir() {
  const directory = mkdtempSync(join(tmpdir(), "alert-effect-"));
  temporaryDirectories.push(directory);
  return directory;
}

describe("alert webhook external-effect boundary", () => {
  it("keeps local alerts but does not send without a durable guard", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const engine = createAlertEngine({
      logDir: createLogDir(),
      webhookUrls: ["https://alerts.example/hooks/one"],
      cooldownMs: 0,
    });

    expect(engine.evaluate({ errorRate: 1 })).toHaveLength(1);
    await engine.flush();
    expect(engine.getHistory()).toHaveLength(1);
    expect(engine.getHealth()).toMatchObject({
      webhookCount: 1,
      externalEffectGuardConfigured: false,
    });
    expect(mocks.safeOutboundFetch).not.toHaveBeenCalled();
  });

  it("sends only after a hash-only reservation", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const reserveAndCommit = vi.fn(async () => {});
    mocks.safeOutboundFetch.mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(0) });
    const webhookUrl = "https://alerts.example/hooks/private-target";
    const engine = createAlertEngine({
      logDir: createLogDir(),
      webhookUrls: [webhookUrl],
      cooldownMs: 0,
      externalEffectGuard: { reserveAndCommit },
    });

    engine.evaluate({ errorRate: 1 });
    await engine.flush();

    expect(reserveAndCommit).toHaveBeenCalledWith({
      effectType: "webhook:alert",
      effectKeyHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      targetFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
      payloadFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(JSON.stringify(reserveAndCommit.mock.calls)).not.toContain(webhookUrl);
    expect(mocks.safeOutboundFetch).toHaveBeenCalledOnce();
    expect(engine.getHealth().externalEffectGuardConfigured).toBe(true);
  });
});
