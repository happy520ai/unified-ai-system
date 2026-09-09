import { describe, expect, it } from "vitest";

import {
  LOCAL_CLIENT_WINDOWS_AUTHORITY_FILE_VERSION,
  LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_VERSION,
  LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_V2_VERSION,
  createLocalClientWindowsAuthorityFileHmac,
  createLocalClientWindowsAuthorityRequestHmac,
  createLocalClientWindowsAuthorityResponseHmac,
  createLocalClientWindowsAuthorityRequestDigest,
  type LocalClientWindowsAuthorityAclFacts,
  type LocalClientWindowsAuthorityBrokerRequest,
  type LocalClientWindowsAuthorityRequestV1,
  type LocalClientWindowsAuthorityRequestV2,
  type LocalClientWindowsAuthorityCheckpointState,
  type LocalClientWindowsAuthorityFileCheckpoint,
  type LocalClientWindowsAuthorityOperation,
} from "./localClientWindowsProtectedAuthorityAnchor.ts";
import {
  LOCAL_CLIENT_WINDOWS_AUTHORITY_ANCHOR_FILE_NAME,
  LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_BOUNDARIES,
  LOCAL_CLIENT_WINDOWS_AUTHORITY_HKLM_KEY,
  LOCAL_CLIENT_WINDOWS_AUTHORITY_PROGRAM_DATA_SUBPATH,
  LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_NAME,
  LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
  LocalClientWindowsAuthorityBrokerService,
  createLocalClientWindowsAuthorityProvisioningPlan,
  resolveLocalClientWindowsAuthorityProvisioningMode,
  type WindowsAuthorityExclusiveLockInput,
  type WindowsAuthorityNonceClaimInput,
  type WindowsAuthorityOsPort,
  type WindowsAuthorityRuntimeIdentity,
  type WindowsAuthorityStorageTarget,
  type WindowsAuthorityExpiringNonceInput,
  type WindowsAuthorityExpiringNonceResult,
} from "./localClientWindowsAuthorityBrokerService.ts";

const PROGRAM_DATA = "C:\\ProgramData";
const HOST_ID = "windows-broker-fixture-host";
const CURRENT_USER_SID = "S-1-5-21-100-200-300-1001";
const SYSTEM_SID = "S-1-5-18";
const ADMINISTRATORS_SID = "S-1-5-32-544";
const EVERYONE_SID = "S-1-1-0";
const KEY = Buffer.from("0123456789abcdef0123456789abcdef", "utf8");
const DIGEST_ONE = "a".repeat(64);
const DIGEST_TWO = "b".repeat(64);

describe("LocalClientWindowsAuthorityBrokerService", () => {
  it("PoP v2 uses its expiring ledger and binds the complete request in a v2 response", async () => {
    const state = checkpoint(1, DIGEST_ONE);
    const { broker, osPort } = createHarness(state, "pop-replay");
    const now = Date.now();
    const { requestHmacSha256: _legacyMac, ...base } = createRequest(broker.target, "inspect", state, 99);
    const unsigned = { ...base, requestVersion: "local-client-windows-authority-request-v2" as const,
      serviceInstanceId: "1".repeat(64), clientSessionId: "2".repeat(64), requestSequence: 1,
      issuedAtMs: now, expiresAtMs: now + 8000, attestationContext: null };
    Object.assign(osPort, {
      async claimExpiringNonce() { osPort.operations.push("claim-expiring"); return { result: "claimed", observedAtMs: now }; },
      async assertExpiringRequestFresh() { osPort.operations.push("assert-fresh"); return { observedAtMs: now }; },
    });
    const request = { ...unsigned, requestHmacSha256: createLocalClientWindowsAuthorityRequestHmac(KEY,
      unsigned as unknown as Omit<LocalClientWindowsAuthorityBrokerRequest, "requestHmacSha256">) } as unknown as LocalClientWindowsAuthorityBrokerRequest;
    await expect(broker.inspect(request)).resolves.toMatchObject({
      brokerVersion: "local-client-windows-authority-broker-v2", serviceInstanceId: unsigned.serviceInstanceId,
      clientSessionId: unsigned.clientSessionId, requestSequence: 1, issuedAtMs: now, expiresAtMs: now + 8000,
      observedAtMs: now, requestDigestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(osPort.operations).toContain("claim-expiring");
    expect(osPort.operations).toContain("assert-fresh");
    expect(osPort.claimedNonces.size).toBe(0);
  });

  it.each(["pop-replay", "validation-pop-replay"])("routes every operation for %s exclusively through v2", async slot => {
    const f = createPopHarness(checkpoint(0, null), slot);
    await f.broker.enrollBaseline(createPopRequest(f.broker.target, "enroll-baseline", checkpoint(0, null), 1,
      { nextGeneration: 1, nextDigest: DIGEST_ONE }));
    await f.broker.inspect(createPopRequest(f.broker.target, "inspect", checkpoint(1, DIGEST_ONE), 2));
    await f.broker.prepareNext(createPopRequest(f.broker.target, "prepare-next", checkpoint(1, DIGEST_ONE), 3,
      { nextGeneration: 2, nextDigest: DIGEST_TWO }));
    const request = createPopRequest(f.broker.target, "finalize", checkpoint(1, DIGEST_ONE, 2, DIGEST_TWO), 4);
    const result = await f.broker.finalize(request);
    const { requestHmacSha256: _mac, ...unsigned } = request;
    expect(result).toMatchObject({ requestDigestSha256: createLocalClientWindowsAuthorityRequestDigest(unsigned),
      fileCheckpoint: checkpoint(2, DIGEST_TWO), hklmCheckpoint: checkpoint(2, DIGEST_TWO) });
    expect(f.claims).toHaveLength(4);
    expect(f.freshness).toHaveLength(4);
    expect(f.osPort.claimedNonces.size).toBe(0);
    expect(f.osPort.operations).not.toContain("claim-nonce");
  });

  it.each(["expired", "future", "capacity", "replayed"] as const)("does not read or mutate authority after a v2 %s rejection", async result => {
    const f = createPopHarness(checkpoint(1, DIGEST_ONE));
    f.behavior.claimResult = result;
    await expect(f.broker.prepareNext(createPopRequest(f.broker.target, "prepare-next", checkpoint(1, DIGEST_ONE), 1,
      { nextGeneration: 2, nextDigest: DIGEST_TWO }))).rejects.toThrow();
    expect(f.claims).toHaveLength(1);
    expect(f.freshness).toHaveLength(0);
    expect(f.osPort.operations).not.toContain("read-file");
    expect(f.osPort.operations).not.toContain("write-file-atomic");
    expect(f.osPort.claimedNonces.size).toBe(0);
  });

  it("rejects v1 on PoP and v2 on legacy before either ledger is used", async () => {
    const pop = createPopHarness(checkpoint(1, DIGEST_ONE));
    await expect(pop.broker.inspect(createRequest(pop.broker.target, "inspect", checkpoint(1, DIGEST_ONE), 1))).rejects.toThrow();
    const legacy = createHarness(checkpoint(1, DIGEST_ONE), "gateway-vscode");
    await expect(legacy.broker.inspect(createPopRequest(legacy.broker.target, "inspect", checkpoint(1, DIGEST_ONE), 2))).rejects.toThrow();
    expect(pop.claims).toHaveLength(0);
    expect(legacy.osPort.claimedNonces.size).toBe(0);
  });

  it.each([
    { serviceInstanceId: "short" }, { clientSessionId: "short" }, { requestSequence: 0 }, { requestSequence: Number.MAX_SAFE_INTEGER + 1 },
    { issuedAtMs: -1 }, { issuedAtMs: 1.5 }, { expiresAtMs: Number.MAX_SAFE_INTEGER + 1 },
    { issuedAtMs: 1, expiresAtMs: 8002 }, { issuedAtMs: 8, expiresAtMs: 8 }, { attestationContext: {} },
    { attestationContext: { unexpected: true } }, { unexpected: true },
  ])("rejects malformed signed v2 context before claiming: %j", async malformed => {
    const f = createPopHarness(checkpoint(1, DIGEST_ONE));
    const { requestHmacSha256: _mac, ...base } = createPopRequest(f.broker.target, "inspect", checkpoint(1, DIGEST_ONE), 1);
    const unsigned = { ...base, ...malformed };
    const request = { ...unsigned, requestHmacSha256: createLocalClientWindowsAuthorityRequestHmac(KEY,
      unsigned as unknown as LocalClientWindowsAuthorityRequestV2) } as unknown as LocalClientWindowsAuthorityRequestV2;
    await expect(f.broker.inspect(request)).rejects.toThrow();
    expect(f.claims).toHaveLength(0);
  });

  it("authenticates the complete nested challenge and rejects accessor payloads without invoking them", async () => {
    const f = createPopHarness(checkpoint(1, DIGEST_ONE));
    const context = { storeBindingSha256: "3".repeat(64), anchorBindingSha256: "4".repeat(64),
      installedManifestSha256: "5".repeat(64), bindingSha256: "6".repeat(64),
      generation: 1, digest: DIGEST_ONE, challengeSha256: "7".repeat(64) };
    const request = createPopRequest(f.broker.target, "inspect", checkpoint(1, DIGEST_ONE), 1, { attestationContext: context });
    await expect(f.broker.inspect({ ...request, attestationContext: { ...context, challengeSha256: "8".repeat(64) } })).rejects.toThrow();
    let getterCalls = 0;
    const accessor = { ...context };
    Object.defineProperty(accessor, "challengeSha256", { enumerable: true, get() { getterCalls++; return context.challengeSha256; } });
    await expect(f.broker.inspect({ ...request, attestationContext: accessor })).rejects.toThrow();
    expect(getterCalls).toBe(0);
    expect(f.claims).toHaveLength(0);
    await expect(f.broker.inspect(request)).resolves.toMatchObject({ brokerVersion: "local-client-windows-authority-broker-v2" });
  });

  it("keeps a claimed mutation committed when final freshness fails, requiring fresh recovery", async () => {
    const f = createPopHarness(checkpoint(1, DIGEST_ONE));
    f.behavior.failFreshness = true;
    const request = createPopRequest(f.broker.target, "prepare-next", checkpoint(1, DIGEST_ONE), 1,
      { nextGeneration: 2, nextDigest: DIGEST_TWO });
    await expect(f.broker.prepareNext(request)).rejects.toThrow();
    expect(f.osPort.fileState()).toEqual(checkpoint(1, DIGEST_ONE, 2, DIGEST_TWO));
    expect(f.claims).toHaveLength(1);
    f.behavior.failFreshness = false;
    await expect(f.broker.prepareNext(request)).rejects.toMatchObject({ code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_NONCE_REPLAYED" });
    await expect(f.broker.inspect(createPopRequest(f.broker.target, "inspect", checkpoint(1, DIGEST_ONE, 2, DIGEST_TWO), 2)))
      .resolves.toMatchObject({ fileCheckpoint: checkpoint(1, DIGEST_ONE, 2, DIGEST_TWO) });
  });

  it("refuses v2 without both native lifecycle capabilities before claiming", async () => {
    const f = createHarness(checkpoint(1, DIGEST_ONE), "pop-replay");
    await expect(f.broker.inspect(createPopRequest(f.broker.target, "inspect", checkpoint(1, DIGEST_ONE), 1)))
      .rejects.toMatchObject({ code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_OS_PORT_UNAVAILABLE" });
    expect(f.osPort.claimedNonces.size).toBe(0);
  });

  it("exposes a fixed, check-only provisioning plan and requires both apply flags", () => {
    const plan = createLocalClientWindowsAuthorityProvisioningPlan(PROGRAM_DATA);

    expect(plan).toMatchObject({
      mode: "check-only",
      mutatesSystem: false,
      service: {
        name: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_NAME,
        sid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
        account: `NT SERVICE\\${LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_NAME}`,
        requireServiceSidToken: true,
      },
      storage: {
        programDataBasePath: PROGRAM_DATA,
        programDataRoot: `${PROGRAM_DATA}\\${LOCAL_CLIENT_WINDOWS_AUTHORITY_PROGRAM_DATA_SUBPATH}`,
        anchorPath: `${PROGRAM_DATA}\\${LOCAL_CLIENT_WINDOWS_AUTHORITY_PROGRAM_DATA_SUBPATH}\\${LOCAL_CLIENT_WINDOWS_AUTHORITY_ANCHOR_FILE_NAME}`,
        rejectReparsePoints: true,
        requireAtomicReplaceAndFlush: true,
      },
      registry: {
        hive: "HKLM",
        keyPath: LOCAL_CLIENT_WINDOWS_AUTHORITY_HKLM_KEY,
        view: "registry64",
      },
      boundaries: {
        ...LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_BOUNDARIES,
        nativeWindowsAdapterImplemented: false,
        provisionerImplemented: false,
        shellExecution: false,
      },
    });
    expect(resolveLocalClientWindowsAuthorityProvisioningMode([])).toBe("check-only");
    expect(resolveLocalClientWindowsAuthorityProvisioningMode(["--check-only"]))
      .toBe("check-only");
    expect(resolveLocalClientWindowsAuthorityProvisioningMode(["--apply", "--yes"]))
      .toBe("apply");
    for (const argv of [
      ["--apply"],
      ["--yes"],
      ["--check-only", "--yes"],
      ["--apply", "--yes", "--check-only"],
      ["--apply", "--apply"],
      ["--force"],
    ]) {
      expect(() => resolveLocalClientWindowsAuthorityProvisioningMode(argv))
        .toThrow(expect.objectContaining({
          code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_CONFIGURATION_INVALID",
        }));
    }
    expect(() => createLocalClientWindowsAuthorityProvisioningPlan("C:\\Temp"))
      .toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_CONFIGURATION_INVALID",
      }));
  });

  it("authenticates, binds, consumes a durable nonce, and signs an inspect response", async () => {
    const state = checkpoint(1, DIGEST_ONE);
    const { broker, osPort } = createHarness(state);
    const request = createRequest(broker.target, "inspect", state, 1);

    const response = await broker.inspect(request);
    const { responseHmacSha256, ...unsignedResponse } = response;
    expect(response).toMatchObject({
      operation: "inspect",
      nonce: request.nonce,
      osPlatform: "win32",
      hostId: HOST_ID,
      serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
      hklmView: "registry64",
      fileCheckpoint: state,
      hklmCheckpoint: state,
      acl: { source: "independent-privileged-broker" },
    });
    expect(responseHmacSha256).toBe(
      createLocalClientWindowsAuthorityResponseHmac(KEY, unsignedResponse),
    );
    expect(osPort.operations).toEqual([
      "lock",
      "identity",
      "claim-nonce",
      "read-file",
      "read-hklm64",
      "acl",
    ]);
    expect(osPort.claimedNonces).toEqual(new Set([request.nonce]));
  });

  it("derives independent restricted anchor slots while preserving the legacy target", () => {
    const slots = ["vscode-gateway-journal", "vscode-client-journal", "vscode-workcopy",
      "cursor-gateway-journal", "cursor-client-journal", "cursor-workcopy"];
    for (const anchorId of slots) {
      const plan = createLocalClientWindowsAuthorityProvisioningPlan(PROGRAM_DATA, [], { anchorId });
      expect(plan.storage.anchorPath).toBe(`${PROGRAM_DATA}\\${LOCAL_CLIENT_WINDOWS_AUTHORITY_PROGRAM_DATA_SUBPATH}\\anchors\\${anchorId}\\authority.json`);
      expect(plan.registry.keyPath).toBe(`${LOCAL_CLIENT_WINDOWS_AUTHORITY_HKLM_KEY}\\Anchors\\${anchorId}`);
      expect(plan).toMatchObject({ mode: "check-only", mutatesSystem: false, applyAuthorized: false });
    }
    for (const anchorId of ["", "../other", "a\\b", "Upper", "a.b", "con", "nul", "com1", "x".repeat(65)]) {
      expect(() => createLocalClientWindowsAuthorityProvisioningPlan(PROGRAM_DATA, [], { anchorId })).toThrow();
      expect(() => createHarness(checkpoint(0, null), anchorId)).toThrow();
    }
  });

  it("enrolls a zero checkpoint once and requires a fresh nonce for exact baseline replay", async () => {
    const zero = checkpoint(0, null);
    const { broker, osPort } = createHarness(zero);
    const request = createRequest(broker.target, "enroll-baseline", zero, 1001,
      { nextGeneration: 1, nextDigest: DIGEST_ONE });
    await expect(broker.enrollBaseline(request)).resolves.toMatchObject({ fileCheckpoint: checkpoint(1, DIGEST_ONE) });
    await expect(broker.enrollBaseline(request)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_NONCE_REPLAYED",
    });
    await expect(broker.enrollBaseline(createRequest(broker.target, "enroll-baseline", zero, 1002,
      { nextGeneration: 1, nextDigest: DIGEST_ONE }))).resolves.toMatchObject({ fileCheckpoint: checkpoint(1, DIGEST_ONE) });
    expect(osPort.operations.filter((entry) => entry === "write-file-atomic")).toHaveLength(1);
    expect(osPort.operations.filter((entry) => entry === "write-hklm64")).toHaveLength(1);
  });

  it.each([
    checkpoint(1, DIGEST_TWO), checkpoint(2, DIGEST_ONE),
    checkpoint(0, null, 1, DIGEST_ONE), checkpoint(1, DIGEST_ONE, 2, DIGEST_TWO),
  ])("does not replace a positive or pending baseline: %j", async (state) => {
    const { broker, osPort } = createHarness(state);
    await expect(broker.enrollBaseline(createRequest(broker.target, "enroll-baseline", checkpoint(0, null), 1003,
      { nextGeneration: 1, nextDigest: DIGEST_ONE }))).rejects.toThrow();
    expect(osPort.operations).not.toContain("write-file-atomic");
    expect(osPort.operations).not.toContain("write-hklm64");
  });

  it("keeps ordinary zero-generation advancement forbidden and authenticates enrollment before OS access", async () => {
    const { broker, osPort } = createHarness(checkpoint(0, null));
    const request = createRequest(broker.target, "enroll-baseline", checkpoint(0, null), 1004,
      { nextGeneration: 1, nextDigest: DIGEST_ONE });
    await expect(broker.enrollBaseline({ ...request, requestHmacSha256: "0".repeat(64) })).rejects.toThrow();
    await expect(broker.prepareNext(createRequest(broker.target, "prepare-next", checkpoint(0, null), 1005,
      { nextGeneration: 1, nextDigest: DIGEST_ONE }))).rejects.toThrow();
    await expect(broker.enrollBaseline(createRequest(broker.target, "enroll-baseline", checkpoint(1, DIGEST_ONE), 1006,
      { nextGeneration: 2, nextDigest: DIGEST_TWO }))).rejects.toThrow();
    expect(osPort.operations).toEqual([]);
  });

  it("retains divergence after a partial baseline enrollment instead of enrolling again", async () => {
    const zero = checkpoint(0, null);
    const { broker, osPort } = createHarness(zero);
    osPort.failNextHklmWrite = true;
    await expect(broker.enrollBaseline(createRequest(broker.target, "enroll-baseline", zero, 1007,
      { nextGeneration: 1, nextDigest: DIGEST_ONE }))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_WRITE_INCOMPLETE",
    });
    await expect(broker.enrollBaseline(createRequest(broker.target, "enroll-baseline", zero, 1008,
      { nextGeneration: 1, nextDigest: DIGEST_ONE }))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_CHECKPOINT_DIVERGED",
    });
    expect(osPort.fileState()).toEqual(checkpoint(1, DIGEST_ONE));
    expect(osPort.hklmCheckpoint).toEqual(zero);
  });

  it.each(["missing", "forged", "user-writable"])("does not enroll a %s authority baseline", async (condition) => {
    const osPort = new FakeWindowsAuthorityOsPort();
    const broker = new LocalClientWindowsAuthorityBrokerService({ programDataBasePath: PROGRAM_DATA,
      hostId: HOST_ID, currentUserSid: CURRENT_USER_SID, integrityKey: KEY, osPort });
    if (condition !== "missing") osPort.seed(broker.target, checkpoint(0, null));
    if (condition === "forged") osPort.tamperFileHmac();
    if (condition === "user-writable") osPort.aclOverride = { ...safeAcl(), registryCurrentUserCanWrite: true };
    await expect(broker.enrollBaseline(createRequest(broker.target, "enroll-baseline", checkpoint(0, null), 1009,
      { nextGeneration: 1, nextDigest: DIGEST_ONE }))).rejects.toThrow();
    expect(osPort.operations).not.toContain("write-file-atomic");
    expect(osPort.operations).not.toContain("write-hklm64");
  });

  it("isolates slot checkpoints and rejects cross-slot bindings and service-wide nonce replay", async () => {
    const osPort = new FakeWindowsAuthorityOsPort();
    const createSlot = (anchorId: string) => {
      const broker = new LocalClientWindowsAuthorityBrokerService({
        programDataBasePath: PROGRAM_DATA, hostId: HOST_ID, currentUserSid: CURRENT_USER_SID,
        integrityKey: KEY, osPort, anchorId,
      });
      osPort.seed(broker.target, checkpoint(0, null));
      return broker;
    };
    const vscode = createSlot("vscode-workcopy"), cursor = createSlot("cursor-workcopy");
    await vscode.enrollBaseline(createRequest(vscode.target, "enroll-baseline", checkpoint(0, null), 2001,
      { nextGeneration: 1, nextDigest: DIGEST_ONE }));
    await cursor.enrollBaseline(createRequest(cursor.target, "enroll-baseline", checkpoint(0, null), 2002,
      { nextGeneration: 1, nextDigest: DIGEST_TWO }));
    await vscode.prepareNext(createRequest(vscode.target, "prepare-next", checkpoint(1, DIGEST_ONE), 2003,
      { nextGeneration: 2, nextDigest: DIGEST_TWO }));
    expect(osPort.fileState(vscode.target)).toEqual(checkpoint(1, DIGEST_ONE, 2, DIGEST_TWO));
    expect(osPort.fileState(cursor.target)).toEqual(checkpoint(1, DIGEST_TWO));
    await expect(cursor.inspect(createRequest(vscode.target, "inspect", checkpoint(1, DIGEST_ONE, 2, DIGEST_TWO), 2004)))
      .rejects.toMatchObject({ code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_REQUEST_BINDING_MISMATCH" });
    await expect(cursor.inspect(createRequest(cursor.target, "inspect", checkpoint(1, DIGEST_TWO), 2001)))
      .rejects.toMatchObject({ code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_NONCE_REPLAYED" });
    await expect(cursor.inspect(createRequest(cursor.target, "inspect", checkpoint(1, DIGEST_TWO), 2005)))
      .resolves.toMatchObject({ fileCheckpoint: checkpoint(1, DIGEST_TWO) });
  });

  it("performs exact protected-file plus HKLM prepare/finalize transitions", async () => {
    const initial = checkpoint(1, DIGEST_ONE);
    const { broker, osPort } = createHarness(initial);

    const preparedResponse = await broker.prepareNext(createRequest(
      broker.target,
      "prepare-next",
      initial,
      2,
      { nextGeneration: 2, nextDigest: DIGEST_TWO },
    ));
    const pending = checkpoint(1, DIGEST_ONE, 2, DIGEST_TWO);
    expect(preparedResponse.fileCheckpoint).toEqual(pending);
    expect(osPort.fileState()).toEqual(pending);
    expect(osPort.hklmCheckpoint).toEqual(pending);

    const finalizedResponse = await broker.finalize(createRequest(
      broker.target,
      "finalize",
      pending,
      3,
      { nextGeneration: 2, nextDigest: DIGEST_TWO },
    ));
    const finalized = checkpoint(2, DIGEST_TWO);
    expect(finalizedResponse.fileCheckpoint).toEqual(finalized);
    expect(finalizedResponse.hklmCheckpoint).toEqual(finalized);
    expect(osPort.fileState()).toEqual(finalized);
    expect(osPort.hklmCheckpoint).toEqual(finalized);
    expect(osPort.operations.filter((entry) => entry === "write-file-atomic")).toHaveLength(2);
    expect(osPort.operations.filter((entry) => entry === "write-hklm64")).toHaveLength(2);
  });

  it("rejects forged HMACs, accessor objects, and extra fields before any OS operation", async () => {
    const state = checkpoint(1, DIGEST_ONE);
    const { broker, osPort } = createHarness(state);
    const valid = createRequest(broker.target, "inspect", state, 4);
    const forged = {
      ...valid,
      requestHmacSha256: `${valid.requestHmacSha256.slice(0, 63)}${valid.requestHmacSha256.endsWith("0") ? "1" : "0"}`,
    };
    await expect(broker.inspect(forged)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_REQUEST_AUTHENTICATION_FAILED",
    });

    const withExtra = { ...valid, attackerControlled: true } as unknown as LocalClientWindowsAuthorityBrokerRequest;
    await expect(broker.inspect(withExtra)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_REQUEST_INVALID",
    });

    const accessor = { ...valid } as Record<string, unknown>;
    Object.defineProperty(accessor, "nonce", {
      enumerable: true,
      get: () => valid.nonce,
    });
    await expect(broker.inspect(accessor as unknown as LocalClientWindowsAuthorityBrokerRequest))
      .rejects.toMatchObject({
        code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_REQUEST_INVALID",
      });
    expect(osPort.operations).toEqual([]);
  });

  it.each([
    { label: "host", override: { hostId: "other-windows-host" } },
    { label: "service SID", override: { serviceSid: "S-1-5-80-1-2-3-4-5" } },
    { label: "anchor path", override: { anchorPath: "C:\\ProgramData\\Other\\authority.json" } },
    { label: "HKLM key", override: { hklmKeyPath: "HKLM\\Software\\Other\\Authority" } },
    { label: "registry view", override: { hklmView: "registry32" as never } },
  ])("rejects a correctly signed request rebound to another $label", async ({ override }) => {
    const state = checkpoint(1, DIGEST_ONE);
    const { broker, osPort } = createHarness(state);
    const rebound = createRequest(broker.target, "inspect", state, 5, override);

    await expect(broker.inspect(rebound)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_REQUEST_BINDING_MISMATCH",
    });
    expect(osPort.operations).toEqual([]);
  });

  it("rejects a replayed authenticated nonce after the first response", async () => {
    const state = checkpoint(1, DIGEST_ONE);
    const { broker, osPort } = createHarness(state);
    const request = createRequest(broker.target, "inspect", state, 6);

    await expect(broker.inspect(request)).resolves.toMatchObject({ operation: "inspect" });
    await expect(broker.inspect(request)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_NONCE_REPLAYED",
      category: "authentication",
    });
    expect(osPort.operations.filter((entry) => entry === "read-file")).toHaveLength(1);
  });

  it("rejects runtime host/service identity mismatch before claiming the nonce", async () => {
    const state = checkpoint(1, DIGEST_ONE);
    const { broker, osPort } = createHarness(state);
    osPort.identityOverride = { runningAsServiceSid: false as never };

    await expect(broker.inspect(createRequest(broker.target, "inspect", state, 7)))
      .rejects.toMatchObject({
        code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_IDENTITY_MISMATCH",
      });
    expect(osPort.claimedNonces.size).toBe(0);
    expect(osPort.operations).toEqual(["lock", "identity"]);
  });

  it("rejects divergent protected-file and HKLM checkpoints without self-healing", async () => {
    const state = checkpoint(1, DIGEST_ONE);
    const { broker, osPort } = createHarness(state);
    osPort.hklmCheckpoint = checkpoint(2, DIGEST_TWO);

    await expect(broker.inspect(createRequest(broker.target, "inspect", state, 8)))
      .rejects.toMatchObject({
        code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_CHECKPOINT_DIVERGED",
        category: "recovery",
      });
    expect(osPort.operations).not.toContain("write-file-atomic");
    expect(osPort.operations).not.toContain("write-hklm64");
  });

  it("rejects a forged protected-file checkpoint before ACL inspection or writes", async () => {
    const state = checkpoint(1, DIGEST_ONE);
    const { broker, osPort } = createHarness(state);
    osPort.tamperFileHmac();

    await expect(broker.inspect(createRequest(broker.target, "inspect", state, 81)))
      .rejects.toMatchObject({
        code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_CHECKPOINT_INVALID",
        category: "integrity",
      });
    expect(osPort.operations).not.toContain("acl");
    expect(osPort.operations).not.toContain("write-file-atomic");
    expect(osPort.operations).not.toContain("write-hklm64");
  });

  it("leaves a partial pair fail-closed if HKLM fails after the file transition", async () => {
    const initial = checkpoint(1, DIGEST_ONE);
    const { broker, osPort } = createHarness(initial);
    osPort.failNextHklmWrite = true;
    const pending = checkpoint(1, DIGEST_ONE, 2, DIGEST_TWO);

    await expect(broker.prepareNext(createRequest(
      broker.target,
      "prepare-next",
      initial,
      9,
      { nextGeneration: 2, nextDigest: DIGEST_TWO },
    ))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_WRITE_INCOMPLETE",
      category: "persistence",
    });
    expect(osPort.fileState()).toEqual(pending);
    expect(osPort.hklmCheckpoint).toEqual(initial);

    await expect(broker.inspect(createRequest(broker.target, "inspect", pending, 10)))
      .rejects.toMatchObject({
        code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_CHECKPOINT_DIVERGED",
      });
  });

  it.each([
    {
      label: "ordinary-user write access",
      mutate: (acl: LocalClientWindowsAuthorityAclFacts) => ({
        ...acl,
        fileCurrentUserCanWrite: true,
      }),
    },
    {
      label: "broad inherited writer",
      mutate: (acl: LocalClientWindowsAuthorityAclFacts) => ({
        ...acl,
        rootInheritedWriteSids: [EVERYONE_SID],
      }),
    },
    {
      label: "untrusted source claim",
      mutate: (acl: LocalClientWindowsAuthorityAclFacts) => ({
        ...acl,
        source: "self-reported" as never,
      }),
    },
  ])("rejects ACL facts with $label", async ({ mutate }) => {
    const state = checkpoint(1, DIGEST_ONE);
    const { broker, osPort } = createHarness(state);
    osPort.aclOverride = mutate(safeAcl());

    await expect(broker.inspect(createRequest(broker.target, "inspect", state, 11)))
      .rejects.toMatchObject({
        code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_ACL_INVALID",
        category: "integrity",
      });
  });

  it("validates ACL safety before any prepare mutation", async () => {
    const state = checkpoint(1, DIGEST_ONE);
    const { broker, osPort } = createHarness(state);
    osPort.aclOverride = { ...safeAcl(), registryCurrentUserCanWrite: true };

    await expect(broker.prepareNext(createRequest(
      broker.target,
      "prepare-next",
      state,
      111,
      { nextGeneration: 2, nextDigest: DIGEST_TWO },
    ))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_ACL_INVALID",
    });
    expect(osPort.operations).not.toContain("write-file-atomic");
    expect(osPort.operations).not.toContain("write-hklm64");
  });

  it("rejects stale prepare and non-exact finalization without a write", async () => {
    const pending = checkpoint(1, DIGEST_ONE, 2, DIGEST_TWO);
    const { broker, osPort } = createHarness(pending);

    await expect(broker.prepareNext(createRequest(
      broker.target,
      "prepare-next",
      checkpoint(1, DIGEST_ONE),
      12,
      { nextGeneration: 2, nextDigest: "c".repeat(64) },
    ))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_PENDING_RECOVERY_REQUIRED",
    });
    await expect(broker.finalize(createRequest(
      broker.target,
      "finalize",
      pending,
      13,
      { nextGeneration: 2, nextDigest: "c".repeat(64) },
    ))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_PENDING_RECOVERY_REQUIRED",
    });
    expect(osPort.operations).not.toContain("write-file-atomic");
    expect(osPort.operations).not.toContain("write-hklm64");
  });
});

function createHarness(initialState: LocalClientWindowsAuthorityCheckpointState, anchorId?: string) {
  const osPort = new FakeWindowsAuthorityOsPort();
  const broker = new LocalClientWindowsAuthorityBrokerService({
    programDataBasePath: PROGRAM_DATA,
    hostId: HOST_ID,
    currentUserSid: CURRENT_USER_SID,
    integrityKey: KEY,
    osPort,
    ...(anchorId === undefined ? {} : { anchorId }),
  });
  osPort.seed(broker.target, initialState);
  return { broker, osPort };
}

function createPopHarness(initialState: LocalClientWindowsAuthorityCheckpointState, slot = "pop-replay") {
  const f = createHarness(initialState, slot);
  const claims: WindowsAuthorityExpiringNonceInput[] = [], freshness: WindowsAuthorityExpiringNonceInput[] = [];
  const seen = new Set<string>();
  const behavior = { claimResult: "claimed" as WindowsAuthorityExpiringNonceResult["result"], failFreshness: false };
  Object.assign(f.osPort, {
    async claimExpiringNonce(input: WindowsAuthorityExpiringNonceInput): Promise<WindowsAuthorityExpiringNonceResult> {
      claims.push(input);
      const result = seen.has(input.nonce) ? "replayed" : behavior.claimResult;
      if (result === "claimed") seen.add(input.nonce);
      return { result, observedAtMs: Date.now() };
    },
    async assertExpiringRequestFresh(input: WindowsAuthorityExpiringNonceInput) {
      freshness.push(input);
      if (behavior.failFreshness) throw new Error("native final freshness failure");
      return { observedAtMs: Date.now() };
    },
  });
  return { ...f, claims, freshness, behavior };
}

function createPopRequest(target: WindowsAuthorityStorageTarget, operation: LocalClientWindowsAuthorityOperation,
  state: LocalClientWindowsAuthorityCheckpointState, nonceValue: number,
  overrides: Partial<Omit<LocalClientWindowsAuthorityRequestV2, "requestHmacSha256">> = {}): LocalClientWindowsAuthorityRequestV2 {
  const { requestHmacSha256: _mac, ...base } = createRequest(target, operation, state, nonceValue);
  const now = Date.now();
  const unsigned = { ...base, requestVersion: LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_V2_VERSION,
    serviceInstanceId: "1".repeat(64), clientSessionId: "2".repeat(64), requestSequence: nonceValue,
    issuedAtMs: now, expiresAtMs: now + 8000, attestationContext: null, ...overrides };
  return { ...unsigned, requestHmacSha256: createLocalClientWindowsAuthorityRequestHmac(KEY, unsigned) };
}

function createRequest(
  target: WindowsAuthorityStorageTarget,
  operation: LocalClientWindowsAuthorityOperation,
  state: LocalClientWindowsAuthorityCheckpointState,
  nonceValue: number,
  overrides: Partial<Omit<LocalClientWindowsAuthorityRequestV1, "requestHmacSha256">> = {},
): LocalClientWindowsAuthorityRequestV1 {
  const unsigned = {
    requestVersion: LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_VERSION,
    operation,
    nonce: nonceValue.toString(16).padStart(64, "0"),
    hostId: HOST_ID,
    serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
    currentUserSid: CURRENT_USER_SID,
    anchorPath: target.anchorPath,
    programDataRoot: target.programDataRoot,
    hklmKeyPath: target.hklmKeyPath,
    hklmView: "registry64" as const,
    expectedCurrentGeneration: state.currentGeneration,
    expectedCurrentDigest: state.currentDigest,
    nextGeneration: state.pendingGeneration,
    nextDigest: state.pendingDigest,
    ...overrides,
  };
  return Object.freeze({
    ...unsigned,
    requestHmacSha256: createLocalClientWindowsAuthorityRequestHmac(KEY, unsigned),
  });
}

function checkpoint(
  currentGeneration: number,
  currentDigest: string | null,
  pendingGeneration: number | null = null,
  pendingDigest: string | null = null,
): LocalClientWindowsAuthorityCheckpointState {
  return Object.freeze({ currentGeneration, currentDigest, pendingGeneration, pendingDigest });
}

function signedFile(
  target: WindowsAuthorityStorageTarget,
  state: LocalClientWindowsAuthorityCheckpointState,
): LocalClientWindowsAuthorityFileCheckpoint {
  const unsigned = {
    fileVersion: LOCAL_CLIENT_WINDOWS_AUTHORITY_FILE_VERSION,
    hostId: HOST_ID,
    serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
    anchorPath: target.anchorPath,
    hklmKeyPath: target.hklmKeyPath,
    hklmView: "registry64" as const,
    ...state,
  };
  return Object.freeze({
    ...unsigned,
    hmacSha256: createLocalClientWindowsAuthorityFileHmac(KEY, unsigned),
  });
}

function safeAcl(hklmKeyPath: string = LOCAL_CLIENT_WINDOWS_AUTHORITY_HKLM_KEY): LocalClientWindowsAuthorityAclFacts {
  const writers = [
    ADMINISTRATORS_SID,
    SYSTEM_SID,
    LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
  ].sort();
  return Object.freeze({
    source: "independent-privileged-broker" as const,
    currentUserSid: CURRENT_USER_SID,
    serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
    rootOwnerSid: SYSTEM_SID,
    rootAllowedWriteSids: writers,
    rootInheritedWriteSids: [],
    rootCurrentUserCanWrite: false,
    fileOwnerSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
    fileAllowedWriteSids: writers,
    fileInheritedWriteSids: [],
    fileCurrentUserCanWrite: false,
    registryOwnerSid: SYSTEM_SID,
    registryAllowedWriteSids: writers,
    registryInheritedWriteSids: [],
    registryCurrentUserCanWrite: false,
    hklmHive: "HKLM" as const,
    hklmKeyPath,
    hklmView: "registry64" as const,
  });
}

class FakeWindowsAuthorityOsPort implements WindowsAuthorityOsPort {
  readonly operations: string[] = [];
  readonly claimedNonces = new Set<string>();
  identityOverride: Partial<WindowsAuthorityRuntimeIdentity> = {};
  aclOverride: LocalClientWindowsAuthorityAclFacts | null = null;
  failNextHklmWrite = false;
  #target!: WindowsAuthorityStorageTarget;
  readonly #files = new Map<string, LocalClientWindowsAuthorityFileCheckpoint>();
  readonly #registry = new Map<string, LocalClientWindowsAuthorityCheckpointState>();
  #tail: Promise<void> = Promise.resolve();

  get hklmCheckpoint() { return this.#registry.get(this.#target.hklmKeyPath)!; }
  set hklmCheckpoint(value: LocalClientWindowsAuthorityCheckpointState) { this.#registry.set(this.#target.hklmKeyPath, value); }

  seed(
    target: WindowsAuthorityStorageTarget,
    state: LocalClientWindowsAuthorityCheckpointState,
  ): void {
    this.#target = target;
    this.#files.set(target.anchorPath, signedFile(target, state));
    this.#registry.set(target.hklmKeyPath, state);
  }

  fileState(target = this.#target): LocalClientWindowsAuthorityCheckpointState {
    const file = this.#files.get(target.anchorPath)!;
    return checkpoint(
      file.currentGeneration, file.currentDigest, file.pendingGeneration, file.pendingDigest,
    );
  }

  tamperFileHmac(): void {
    this.#files.set(this.#target.anchorPath, Object.freeze({
      ...this.#files.get(this.#target.anchorPath)!,
      hmacSha256: "0".repeat(64),
    }));
  }

  async runExclusive<T>(
    _input: WindowsAuthorityExclusiveLockInput,
    action: () => Promise<T>,
  ): Promise<T> {
    this.operations.push("lock");
    const previous = this.#tail;
    let release!: () => void;
    this.#tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await action(); } finally { release(); }
  }

  async inspectRuntimeIdentity(): Promise<WindowsAuthorityRuntimeIdentity> {
    this.operations.push("identity");
    return {
      osPlatform: "win32",
      hostId: HOST_ID,
      serviceName: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_NAME,
      serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
      runningAsServiceSid: true,
      programDataBasePath: PROGRAM_DATA,
      hklmView: "registry64",
      ...this.identityOverride,
    } as WindowsAuthorityRuntimeIdentity;
  }

  async claimNonce(input: WindowsAuthorityNonceClaimInput): Promise<"claimed" | "replayed"> {
    this.operations.push("claim-nonce");
    if (this.claimedNonces.has(input.nonce)) return "replayed";
    this.claimedNonces.add(input.nonce);
    return "claimed";
  }

  async readProtectedFileCheckpoint(
    target: WindowsAuthorityStorageTarget,
  ): Promise<unknown> {
    this.operations.push("read-file");
    return this.#files.get(target.anchorPath);
  }

  async writeProtectedFileCheckpointAtomically(
    target: WindowsAuthorityStorageTarget,
    checkpointValue: LocalClientWindowsAuthorityFileCheckpoint,
  ): Promise<void> {
    this.operations.push("write-file-atomic");
    this.#files.set(target.anchorPath, checkpointValue);
  }

  async readHklmCheckpoint64(
    target: WindowsAuthorityStorageTarget,
  ): Promise<unknown> {
    this.operations.push("read-hklm64");
    return this.#registry.get(target.hklmKeyPath);
  }

  async writeHklmCheckpoint64(
    target: WindowsAuthorityStorageTarget,
    checkpointValue: LocalClientWindowsAuthorityCheckpointState,
  ): Promise<void> {
    this.operations.push("write-hklm64");
    if (this.failNextHklmWrite) {
      this.failNextHklmWrite = false;
      throw new Error("fixture HKLM failure");
    }
    this.#registry.set(target.hklmKeyPath, checkpointValue);
  }

  async inspectAclFacts(target: WindowsAuthorityStorageTarget): Promise<unknown> {
    this.operations.push("acl");
    return this.aclOverride ?? safeAcl(target.hklmKeyPath);
  }
}
