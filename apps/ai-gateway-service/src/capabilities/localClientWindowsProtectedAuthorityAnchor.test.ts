import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, win32 } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { performance } from "node:perf_hooks";

import {
  LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_VERSION,
  LOCAL_CLIENT_WINDOWS_AUTHORITY_FILE_VERSION,
  LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_VERSION,
  LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_V2_VERSION,
  LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_V2_VERSION,
  LOCAL_CLIENT_WINDOWS_PROTECTED_AUTHORITY_BOUNDARIES,
  createLocalClientWindowsAuthorityFileHmac,
  createLocalClientWindowsAuthorityRequestHmac,
  createLocalClientWindowsAuthorityResponseHmac,
  createLocalClientWindowsAuthorityRequestDigest,
  createLocalClientWindowsProtectedAuthorityAnchor,
  type LocalClientWindowsAuthorityAclFacts,
  type LocalClientWindowsAuthorityBrokerRequest,
  type LocalClientWindowsAuthorityBrokerResponse,
  type LocalClientWindowsAuthorityCheckpointState,
  type LocalClientWindowsAuthorityFileCheckpoint,
  type LocalClientWindowsAuthorityPrivilegedBrokerPort,
  type LocalClientWindowsProtectedAuthorityEnabledOptions,
  type LocalClientWindowsAuthorityUnsignedResponse,
  type LocalClientWindowsAuthorityRequestV2,
} from "./localClientWindowsProtectedAuthorityAnchor.ts";

const HOST_ID = "protected-authority-test-host";
const SERVICE_SID = "S-1-5-80-111-222-333-444-555";
const OTHER_SERVICE_SID = "S-1-5-80-999-888-777-666-555";
const CURRENT_USER_SID = "S-1-5-21-100-200-300-1001";
const SYSTEM_SID = "S-1-5-18";
const ADMINISTRATORS_SID = "S-1-5-32-544";
const USERS_SID = "S-1-5-32-545";
const EVERYONE_SID = "S-1-1-0";
const HKLM_KEY = "HKLM\\Software\\UnifiedAISystem\\LocalClientAuthority";
const KEY = Buffer.from("0123456789abcdef0123456789abcdef", "utf8");
const DIGEST_ONE = "a".repeat(64);
const DIGEST_TWO = "b".repeat(64);

// Enabled anchor flows are fail-closed to Windows by contract (the runtime
// reports NOT_WINDOWS elsewhere), so only the disabled-default guarantees
// below stay cross-platform; broker-attested flows run on win32 only.
const describeWindowsAnchorFlows = process.platform === "win32" ? describe : describe.skip;

describe("LocalClientWindowsProtectedAuthorityAnchor", () => {
  let container = "";
  let programDataRoot = "";
  let anchorPath = "";
  let nonce = 0;

  beforeEach(async () => {
    container = await mkdtemp(join(tmpdir(), "windows-protected-authority-"));
    programDataRoot = win32.normalize(join(container, "program-data-anchor"));
    anchorPath = win32.normalize(join(programDataRoot, "authority.json"));
    await mkdir(programDataRoot, { recursive: true });
    nonce = 0;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(container, { recursive: true, force: true });
  });

  it("is unavailable by default and never claims provisioning or administrator resistance", async () => {
    const anchor = createLocalClientWindowsProtectedAuthorityAnchor();

    await expect(anchor.inspect()).resolves.toMatchObject({
      available: false,
      rollbackResistant: false,
      state: "disabled",
      reason: "DISABLED",
      brokerAttested: false,
      boundaries: {
        ...LOCAL_CLIENT_WINDOWS_PROTECTED_AUTHORITY_BOUNDARIES,
        sameUserResistance: "same-user-resistant-if-provisioned",
        administratorResistance: "not-admin-resistant",
        provisioningCapability: "not-provisioner",
        automaticElevation: false,
        createsWindowsService: false,
        modifiesAcl: false,
        writesHklmDirectly: false,
        usesPowerShell: false,
      },
    });
    await expect(anchor.prepareNext(1, DIGEST_TWO)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_UNAVAILABLE",
    });
    await expect(anchor.enrollBaseline(DIGEST_ONE)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_UNAVAILABLE",
    });
  });

  describeWindowsAnchorFlows("broker-attested win32 flows", () => {
    it("uses v2 for enrollment, reads, advance, finalize and challenge with immutable full context", async () => {
      const f = await createPopAnchor(checkpoint(0, null));
      await f.anchor.enrollBaseline(DIGEST_ONE);
      await f.anchor.prepareNext(1, DIGEST_TWO);
      await f.anchor.finalize(2, DIGEST_TWO);
      const challenge = Buffer.alloc(32, 71);
      const proof = await f.anchor.verifyCheckpointChallenge({ generation: 2, digest: DIGEST_TWO,
        challenge, bindingSha256: "6".repeat(64), storeBindingSha256: "7".repeat(64) });
      const requests = f.broker.requests as LocalClientWindowsAuthorityRequestV2[];
      expect(requests.every(request => request.requestVersion === LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_V2_VERSION)).toBe(true);
      expect(new Set(requests.map(request => request.operation))).toEqual(new Set(["inspect", "enroll-baseline", "prepare-next", "finalize"]));
      expect(requests.map(request => request.requestSequence)).toEqual(requests.map((_request, index) => index + 1));
      const last = requests.at(-1)!;
      expect(last.attestationContext).toEqual({ storeBindingSha256: "7".repeat(64),
        anchorBindingSha256: "4".repeat(64), installedManifestSha256: "5".repeat(64), bindingSha256: "6".repeat(64),
        generation: 2, digest: DIGEST_TWO, challengeSha256: createHash("sha256").update(challenge).digest("hex") });
      expect(requests.slice(0, -1).every(request => request.attestationContext === null)).toBe(true);
      expect(Object.isFrozen(last)).toBe(true);
      expect(Object.isFrozen(last.attestationContext)).toBe(true);
      expect(proof).toMatchObject({ nonce: last.nonce, serviceInstanceId: last.serviceInstanceId, expiresAtMs: last.expiresAtMs });
      await f.anchor.close();
    });

    it.each(["requestDigestSha256", "serviceInstanceId", "clientSessionId", "requestSequence", "issuedAtMs", "expiresAtMs", "observedAtMs"] as const)
      ("rejects a correctly signed v2 response with changed %s", async field => {
        const f = await createPopAnchor(checkpoint(1, DIGEST_ONE), { mutateUnsignedResponse(response) {
          if (response.brokerVersion !== LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_V2_VERSION) throw new Error("expected v2");
          if (field === "observedAtMs") return { ...response, observedAtMs: response.expiresAtMs };
          if (field === "requestSequence" || field === "issuedAtMs" || field === "expiresAtMs") return { ...response, [field]: response[field] + 1 };
          return { ...response, [field]: "f".repeat(64) };
        } });
        await expect(f.anchor.inspect()).resolves.toMatchObject({ available: false, brokerAttested: false });
        await f.anchor.close();
      });

    it("rejects v1 downgrade responses even when correctly signed with the legacy key", async () => {
      const f = await createPopAnchor(checkpoint(1, DIGEST_ONE), { mutateUnsignedResponse(response) {
        if (response.brokerVersion !== LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_V2_VERSION) throw new Error("expected v2");
        const { serviceInstanceId: _instance, clientSessionId: _session, requestSequence: _sequence,
          requestDigestSha256: _digest, issuedAtMs: _issued, expiresAtMs: _expiry, observedAtMs: _observed, ...legacy } = response;
        return { ...legacy, brokerVersion: LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_VERSION };
      } });
      await expect(f.anchor.inspect()).resolves.toMatchObject({ available: false, brokerAttested: false });
      await f.anchor.close();
    });

    it("rejects captured v2 responses after cache eviction and a new client binding", async () => {
      const f = await createPopAnchor(checkpoint(1, DIGEST_ONE));
      const original = f.broker.inspect.bind(f.broker);
      let captured: LocalClientWindowsAuthorityBrokerResponse | undefined;
      let replay = false;
      f.broker.inspect = async request => {
        if (replay) return captured!;
        const response = await original(request);
        captured ??= response;
        return response;
      };
      const input = { generation: 1, digest: DIGEST_ONE, challenge: Buffer.alloc(32, 72),
        bindingSha256: "6".repeat(64), storeBindingSha256: "7".repeat(64) };
      await f.anchor.verifyCheckpointChallenge(input);
      for (let remaining = 1025; remaining > 0; remaining -= 32) {
        const statuses = await Promise.all(Array.from({ length: Math.min(remaining, 32) }, () => f.anchor.inspect()));
        expect(statuses.every(status => status.available)).toBe(true);
      }
      // Repeating the challenge obtains a new, independently bound proof; an old frame is still invalid.
      await f.anchor.verifyCheckpointChallenge(input);
      replay = true;
      await expect(f.anchor.verifyCheckpointChallenge(input)).rejects.toThrow();
      const next = createLocalClientWindowsProtectedAuthorityAnchor({ ...f.configuration, broker: f.broker });
      await expect(next.verifyCheckpointChallenge(input)).rejects.toThrow();
      await next.close(); await f.anchor.close();
    });

    it("rejects expiry at equality and monotonic timeout even while UTC is unchanged", async () => {
      let now = 1_900_000_000_000, tick = 100;
      vi.spyOn(Date, "now").mockImplementation(() => now);
      vi.spyOn(performance, "now").mockImplementation(() => tick);
      const f = await createPopAnchor(checkpoint(1, DIGEST_ONE));
      const original = f.broker.inspect.bind(f.broker);
      f.broker.inspect = async request => { const response = await original(request); now += 8000; return response; };
      await expect(f.anchor.inspect()).resolves.toMatchObject({ available: false });
      f.broker.inspect = async request => { const response = await original(request); tick += 8000; return response; };
      await expect(f.anchor.inspect()).resolves.toMatchObject({ available: false });
      await f.anchor.close();
    });

    it("latches a UTC rollback for the client binding and rejects close during a response", async () => {
      let now = 1_900_000_000_000;
      vi.spyOn(Date, "now").mockImplementation(() => now);
      const f = await createPopAnchor(checkpoint(1, DIGEST_ONE));
      const original = f.broker.inspect.bind(f.broker);
      f.broker.inspect = async request => { const response = await original(request); now--; return response; };
      await expect(f.anchor.inspect()).resolves.toMatchObject({ available: false });
      now += 2;
      await expect(f.anchor.inspect()).resolves.toMatchObject({ available: false });
      expect(f.broker.requests).toHaveLength(1);
      const next = createLocalClientWindowsProtectedAuthorityAnchor({ ...f.configuration, broker: f.broker });
      f.broker.inspect = async request => { const response = await original(request); await next.close(); return response; };
      await expect(next.inspect()).resolves.toMatchObject({ available: false });
      await f.anchor.close();
    });

    it("requires complete PoP configuration on fixed PoP slots and rejects it on legacy slots", async () => {
      const popProtocol = { serviceInstanceId: "1".repeat(64), anchorBindingSha256: "4".repeat(64), installedManifestSha256: "5".repeat(64) };
      expect(() => createLocalClientWindowsProtectedAuthorityAnchor(createConfiguration({ popProtocol }))).toThrow();
      const f = await createPopAnchor(checkpoint(1, DIGEST_ONE));
      const { popProtocol: _pop, ...withoutProtocol } = f.configuration;
      expect(() => createLocalClientWindowsProtectedAuthorityAnchor(withoutProtocol)).toThrow();
      await expect(f.anchor.verifyCheckpointChallenge({ generation: 1, digest: DIGEST_ONE,
        challenge: Buffer.alloc(32, 1), bindingSha256: "6".repeat(64) })).rejects.toThrow();
      expect(f.broker.requests).toHaveLength(0);
      await f.anchor.close();
    });

    it("binds the supplied PoP challenge and checkpoint context into the HMAC-verified broker nonce", async () => {
      const broker = new FakeBroker(createConfiguration({ broker: undefined }), checkpoint(1, DIGEST_ONE));
      await broker.persistFile();
      const requests: LocalClientWindowsAuthorityBrokerRequest[] = [];
      const anchor = createAnchor({ inspect: request => { requests.push(request); return broker.inspect(request); },
        prepareNext: broker.prepareNext.bind(broker), finalize: broker.finalize.bind(broker) });
      const bindingSha256 = "1".repeat(64), challenge = Buffer.alloc(32, 42);
      const proof = await anchor.verifyCheckpointChallenge({ generation: 1, digest: DIGEST_ONE, bindingSha256, challenge });
      const challengeSha256 = createHash("sha256").update(challenge).digest("hex");
      const nonce = createHash("sha256").update(JSON.stringify([
        "local-client-pop-native-challenge-v1", bindingSha256, 1, DIGEST_ONE, challengeSha256,
      ])).digest("hex");
      expect(requests[0]!.nonce).toBe(nonce);
      expect(proof).toMatchObject({ generation: 1, digest: DIGEST_ONE, nonce, challengeSha256,
        attestationSha256: expect.stringMatching(/^[a-f0-9]{64}$/u) });
      await expect(anchor.verifyCheckpointChallenge({ generation: 1, digest: DIGEST_ONE, bindingSha256, challenge })).rejects.toThrow();
      await anchor.verifyCheckpointChallenge({ generation: 1, digest: DIGEST_ONE, bindingSha256, challenge: Buffer.alloc(32, 43) });
      expect(requests[1]!.nonce).not.toBe(nonce);
      expect(broker.operations).toEqual(["inspect", "inspect"]);
      await anchor.close();
    });

    it.each(["hmac", "nonce", "checkpoint"] as const)("rejects a PoP challenge proof with incorrect %s binding", async failure => {
      const broker = new FakeBroker(createConfiguration({ broker: undefined }), checkpoint(1, DIGEST_ONE),
        failure === "hmac" ? { forgeResponseHmac: true } : failure === "nonce"
          ? { mutateUnsignedResponse: response => ({ ...response, nonce: "f".repeat(64) }) } : {});
      await broker.persistFile();
      const anchor = createAnchor(broker);
      await expect(anchor.verifyCheckpointChallenge({ generation: failure === "checkpoint" ? 2 : 1, digest: DIGEST_ONE,
        bindingSha256: "1".repeat(64), challenge: Buffer.alloc(32, 44) })).rejects.toThrow();
      await anchor.close();
    });

    it("explicitly enrolls an authenticated zero baseline and retries only the exact generation-one digest", async () => {
      const broker = new FakeBroker(createConfiguration({ broker: undefined }), checkpoint(0, null));
      await broker.persistFile();
      const anchor = createAnchor(broker);
      await expect(anchor.inspect()).resolves.toMatchObject({ available: false, state: "uninitialized" });
      await expect(anchor.prepareNext(0, DIGEST_ONE)).rejects.toThrow();
      await expect(anchor.enrollBaseline(DIGEST_ONE)).resolves.toMatchObject({
        state: "ready", currentGeneration: 1, currentDigest: DIGEST_ONE, pendingGeneration: null,
      });
      await expect(anchor.enrollBaseline(DIGEST_ONE)).resolves.toMatchObject({ currentGeneration: 1 });
      await expect(anchor.enrollBaseline(DIGEST_TWO)).rejects.toThrow();
      expect(broker.operations.filter((value) => value === "enroll-baseline")).toHaveLength(2);
      await expect(anchor.assertCurrent(1, DIGEST_ONE)).resolves.toMatchObject({ generation: 1 });
    });

    it.each([checkpoint(0, null, 1, DIGEST_ONE), checkpoint(1, DIGEST_ONE, 2, DIGEST_TWO), checkpoint(2, DIGEST_ONE)])(
      "does not re-enroll pending or advanced authority: %j", async (state) => {
        const broker = new FakeBroker(createConfiguration({ broker: undefined }), state);
        await broker.persistFile();
        await expect(createAnchor(broker).enrollBaseline(DIGEST_ONE)).rejects.toThrow();
        expect(broker.operations).toEqual(["inspect"]);
      },
    );

    it("keeps legacy broker ports inspectable while rejecting unsupported explicit enrollment", async () => {
      const broker = new FakeBroker(createConfiguration({ broker: undefined }), checkpoint(0, null));
      await broker.persistFile();
      const legacy = { inspect: broker.inspect.bind(broker), prepareNext: broker.prepareNext.bind(broker), finalize: broker.finalize.bind(broker) };
      const anchor = createAnchor(legacy);
      await expect(anchor.inspect()).resolves.toMatchObject({ state: "uninitialized" });
      await expect(anchor.enrollBaseline(DIGEST_ONE)).rejects.toThrow();
      expect(broker.operations).not.toContain("enroll-baseline");
    });

      it("completes a broker-only two-phase advance and rejects an older generation", async () => {
      const broker = new FakeBroker(
        createConfiguration({ broker: undefined }),
        checkpoint(1, DIGEST_ONE),
      );
      await broker.persistFile();
      const anchor = createAnchor(broker);
  
      await expect(anchor.inspect()).resolves.toMatchObject({
        available: true,
        rollbackResistant: true,
        state: "ready",
        currentGeneration: 1,
        currentDigest: DIGEST_ONE,
        brokerAttested: true,
        localFileVerified: true,
        aclVerified: true,
        hklmVerified: true,
      });
    await expect(anchor.assertCurrent(1, DIGEST_ONE)).resolves.toEqual({
      generation: 1,
      digest: DIGEST_ONE,
    });

    await expect(anchor.prepareNext(1, DIGEST_TWO)).resolves.toMatchObject({
      available: false,
      rollbackResistant: false,
      state: "pending-recovery",
      currentGeneration: 1,
      pendingGeneration: 2,
      pendingDigest: DIGEST_TWO,
    });
    await expect(anchor.assertCurrent(1, DIGEST_ONE)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_PENDING_RECOVERY_REQUIRED",
    });
    await expect(anchor.finalize(2, DIGEST_TWO)).resolves.toMatchObject({
      available: true,
      rollbackResistant: true,
      state: "ready",
      currentGeneration: 2,
      currentDigest: DIGEST_TWO,
      pendingGeneration: null,
    });
    await expect(anchor.assertCurrent(1, DIGEST_ONE)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_ROLLBACK_DETECTED",
    });
    await expect(anchor.assertCurrent(2, DIGEST_TWO)).resolves.toMatchObject({ generation: 2 });
    expect(broker.operations).toEqual([
      "inspect",
      "inspect",
      "inspect",
      "prepare-next",
      "inspect",
      "inspect",
      "finalize",
      "inspect",
      "inspect",
    ]);
    });

    it("fails closed for a forged broker response HMAC", async () => {
    const broker = new FakeBroker(
      createConfiguration({ broker: undefined }),
      checkpoint(1, DIGEST_ONE),
      { forgeResponseHmac: true },
    );
    await broker.persistFile();

    await expect(createAnchor(broker).inspect()).resolves.toMatchObject({
      available: false,
      rollbackResistant: false,
      state: "unavailable",
      reason: "ATTESTATION_INVALID",
    });
    });

    it("rejects a correctly signed response bound to another service SID", async () => {
    const broker = new FakeBroker(
      createConfiguration({ broker: undefined }),
      checkpoint(1, DIGEST_ONE),
      {
        mutateUnsignedResponse: (response) => ({
          ...response,
          serviceSid: OTHER_SERVICE_SID,
        }),
      },
    );
    await broker.persistFile();

    await expect(createAnchor(broker).inspect()).resolves.toMatchObject({
      available: false,
      rollbackResistant: false,
      reason: "ATTESTATION_BINDING_MISMATCH",
    });
    });

    it("rejects an ACL attestation where the ordinary user can write", async () => {
    const configuration = createConfiguration({ broker: undefined });
    const broker = new FakeBroker(configuration, checkpoint(1, DIGEST_ONE), {
      acl: { ...safeAcl(), fileCurrentUserCanWrite: true },
    });
    await broker.persistFile();

    await expect(createAnchor(broker).inspect()).resolves.toMatchObject({
      available: false,
      rollbackResistant: false,
      reason: "CURRENT_USER_WRITABLE",
      aclVerified: false,
    });
    });

    it.each([EVERYONE_SID, USERS_SID])(
    "rejects inherited broad write access for %s",
    async (broadSid) => {
      const configuration = createConfiguration({ broker: undefined });
      const broker = new FakeBroker(configuration, checkpoint(1, DIGEST_ONE), {
        acl: {
          ...safeAcl(),
          rootInheritedWriteSids: [broadSid],
        },
      });
      await broker.persistFile();

      await expect(createAnchor(broker).inspect()).resolves.toMatchObject({
        available: false,
        rollbackResistant: false,
        reason: "INHERITED_BROAD_WRITE",
      });
    },
    );

    it("rejects an unallowed owner and a registry view other than exact HKLM 64-bit", async () => {
    const configuration = createConfiguration({ broker: undefined });
    const ownerBroker = new FakeBroker(configuration, checkpoint(1, DIGEST_ONE), {
      acl: { ...safeAcl(), registryOwnerSid: CURRENT_USER_SID },
    });
    await ownerBroker.persistFile();
    await expect(createAnchor(ownerBroker).inspect()).resolves.toMatchObject({
      reason: "OWNER_NOT_ALLOWED",
      rollbackResistant: false,
    });

    const viewBroker = new FakeBroker(configuration, checkpoint(1, DIGEST_ONE), {
      mutateUnsignedResponse: (response) => ({ ...response, hklmView: "registry32" as never }),
    });
    await viewBroker.persistFile();
    await expect(createAnchor(viewBroker).inspect()).resolves.toMatchObject({
      reason: "HKLM_VIEW_MISMATCH",
      rollbackResistant: false,
    });
    });

    it("rejects divergent file and HKLM checkpoints", async () => {
    const configuration = createConfiguration({ broker: undefined });
    const broker = new FakeBroker(configuration, checkpoint(2, DIGEST_TWO), {
      hklmCheckpoint: checkpoint(1, DIGEST_ONE),
    });
    await broker.persistFile();

    await expect(createAnchor(broker).inspect()).resolves.toMatchObject({
      available: false,
      rollbackResistant: false,
      reason: "CHECKPOINT_DIVERGED",
    });
    });

    it("keeps pending state fail-closed and permits only exact explicit finalization", async () => {
    const pending = checkpoint(1, DIGEST_ONE, 2, DIGEST_TWO);
    const broker = new FakeBroker(createConfiguration({ broker: undefined }), pending);
    await broker.persistFile();
    const anchor = createAnchor(broker);

    await expect(anchor.inspect()).resolves.toMatchObject({
      state: "pending-recovery",
      rollbackResistant: false,
      pendingGeneration: 2,
    });
    await expect(anchor.prepareNext(1, "c".repeat(64))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_PENDING_RECOVERY_REQUIRED",
    });
    await expect(anchor.finalize(2, "c".repeat(64))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_PENDING_RECOVERY_REQUIRED",
    });
    await expect(anchor.finalize(2, DIGEST_TWO)).resolves.toMatchObject({
      state: "ready",
      currentGeneration: 2,
      rollbackResistant: true,
    });
    });

    it("rejects UNC configuration and symlinked or junction-backed roots", async () => {
    expect(() => createLocalClientWindowsProtectedAuthorityAnchor({
      ...createConfiguration({ broker: undefined }),
      anchorPath: "\\\\server\\share\\authority.json",
    })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_CONFIGURATION_INVALID",
    }));

    const realRoot = win32.normalize(join(container, "real-root"));
    const linkedRoot = win32.normalize(join(container, "linked-root"));
    const realAnchor = win32.normalize(join(realRoot, "authority.json"));
    await mkdir(realRoot, { recursive: true });
    programDataRoot = linkedRoot;
    anchorPath = win32.normalize(join(linkedRoot, "authority.json"));
    const broker = new FakeBroker(
      createConfiguration({ broker: undefined }),
      checkpoint(1, DIGEST_ONE),
    );
    await writeCheckpoint(realAnchor, checkpoint(1, DIGEST_ONE), {
      ...createConfiguration({ broker: undefined }),
      anchorPath: realAnchor,
    });
    await symlink(realRoot, linkedRoot, "junction");

    await expect(createAnchor(broker).inspect()).resolves.toMatchObject({
      available: false,
      rollbackResistant: false,
      reason: "PATH_UNSAFE",
    });
    });

    it("requires the independently attested broker even when a signed file exists", async () => {
    const configuration = createConfiguration({ broker: undefined });
    await writeCheckpoint(anchorPath, checkpoint(1, DIGEST_ONE), configuration);
    const anchor = createLocalClientWindowsProtectedAuthorityAnchor(configuration);

    await expect(anchor.inspect()).resolves.toMatchObject({
      available: false,
      rollbackResistant: false,
      reason: "BROKER_UNAVAILABLE",
      brokerAttested: false,
    });
    });
  });

  function createAnchor(broker: LocalClientWindowsAuthorityPrivilegedBrokerPort) {
    return createLocalClientWindowsProtectedAuthorityAnchor(createConfiguration({ broker }));
  }

  function createConfiguration(
    overrides: Partial<LocalClientWindowsProtectedAuthorityEnabledOptions>,
  ): LocalClientWindowsProtectedAuthorityEnabledOptions {
    return {
      enabled: true,
      anchorPath,
      programDataRoot,
      hklmKeyPath: HKLM_KEY,
      hostId: HOST_ID,
      serviceSid: SERVICE_SID,
      currentUserSid: CURRENT_USER_SID,
      integrityKey: KEY,
      nonceFactory: () => (++nonce).toString(16).padStart(64, "0"),
      ...overrides,
    };
  }

  async function createPopAnchor(state: LocalClientWindowsAuthorityCheckpointState, options: FakeBrokerOptions = {}) {
    const root = win32.join(container, "anchors", "pop-replay");
    await mkdir(root, { recursive: true });
    const configuration = createConfiguration({ programDataRoot: root, anchorPath: win32.join(root, "authority.json"),
      hklmKeyPath: `${HKLM_KEY}\\Anchors\\pop-replay`,
      popProtocol: { serviceInstanceId: "1".repeat(64), anchorBindingSha256: "4".repeat(64), installedManifestSha256: "5".repeat(64) } });
    const broker = new FakeBroker(configuration, state, options);
    await broker.persistFile();
    const anchor = createLocalClientWindowsProtectedAuthorityAnchor({ ...configuration, broker });
    return { anchor, broker, configuration };
  }
});

type FakeBrokerOptions = Readonly<{
  forgeResponseHmac?: boolean;
  mutateUnsignedResponse?: (
    response: LocalClientWindowsAuthorityUnsignedResponse,
  ) => LocalClientWindowsAuthorityUnsignedResponse;
  acl?: LocalClientWindowsAuthorityAclFacts;
  hklmCheckpoint?: LocalClientWindowsAuthorityCheckpointState;
}>;

class FakeBroker implements LocalClientWindowsAuthorityPrivilegedBrokerPort {
  readonly operations: string[] = [];
  readonly requests: LocalClientWindowsAuthorityBrokerRequest[] = [];
  readonly #configuration: LocalClientWindowsProtectedAuthorityEnabledOptions;
  readonly #options: FakeBrokerOptions;
  #state: LocalClientWindowsAuthorityCheckpointState;

  constructor(
    configuration: LocalClientWindowsProtectedAuthorityEnabledOptions,
    initialState: LocalClientWindowsAuthorityCheckpointState,
    options: FakeBrokerOptions = {},
  ) {
    this.#configuration = configuration;
    this.#state = initialState;
    this.#options = options;
  }

  async persistFile(): Promise<void> {
    await writeCheckpoint(this.#configuration.anchorPath, this.#state, this.#configuration);
  }

  async inspect(
    request: LocalClientWindowsAuthorityBrokerRequest,
  ): Promise<LocalClientWindowsAuthorityBrokerResponse> {
    this.#verifyRequest(request, "inspect");
    this.operations.push("inspect");
    return this.#response(request);
  }

  async prepareNext(
    request: LocalClientWindowsAuthorityBrokerRequest,
  ): Promise<LocalClientWindowsAuthorityBrokerResponse> {
    this.#verifyRequest(request, "prepare-next");
    this.operations.push("prepare-next");
    if (
      request.expectedCurrentGeneration !== this.#state.currentGeneration
      || request.expectedCurrentDigest !== this.#state.currentDigest
      || request.nextGeneration !== this.#state.currentGeneration + 1
      || request.nextDigest === null
      || this.#state.pendingGeneration !== null
    ) throw new Error("stale prepare request");
    this.#state = checkpoint(
      this.#state.currentGeneration,
      this.#state.currentDigest,
      request.nextGeneration,
      request.nextDigest,
    );
    await this.persistFile();
    return this.#response(request);
  }

  async enrollBaseline(request: LocalClientWindowsAuthorityBrokerRequest): Promise<LocalClientWindowsAuthorityBrokerResponse> {
    this.#verifyRequest(request, "enroll-baseline");
    this.operations.push("enroll-baseline");
    if (request.expectedCurrentGeneration !== 0 || request.expectedCurrentDigest !== null
      || request.nextGeneration !== 1 || request.nextDigest === null || this.#state.pendingGeneration !== null
      || !(this.#state.currentGeneration === 0 || (this.#state.currentGeneration === 1 && this.#state.currentDigest === request.nextDigest))) {
      throw new Error("invalid enrollment request");
    }
    if (this.#state.currentGeneration === 0) {
      this.#state = checkpoint(1, request.nextDigest);
      await this.persistFile();
    }
    return this.#response(request);
  }

  async finalize(
    request: LocalClientWindowsAuthorityBrokerRequest,
  ): Promise<LocalClientWindowsAuthorityBrokerResponse> {
    this.#verifyRequest(request, "finalize");
    this.operations.push("finalize");
    if (
      request.expectedCurrentGeneration !== this.#state.currentGeneration
      || request.expectedCurrentDigest !== this.#state.currentDigest
      || request.nextGeneration !== this.#state.pendingGeneration
      || request.nextDigest !== this.#state.pendingDigest
      || request.nextGeneration === null
      || request.nextDigest === null
    ) throw new Error("stale finalize request");
    this.#state = checkpoint(request.nextGeneration, request.nextDigest);
    await this.persistFile();
    return this.#response(request);
  }

  #verifyRequest(
    request: LocalClientWindowsAuthorityBrokerRequest,
    operation: LocalClientWindowsAuthorityBrokerRequest["operation"],
  ): void {
    const { requestHmacSha256, ...unsigned } = request;
    const expected = createLocalClientWindowsAuthorityRequestHmac(KEY, unsigned);
    if (
      request.requestVersion !== (this.#configuration.popProtocol
        ? LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_V2_VERSION : LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_VERSION)
      || request.operation !== operation
      || requestHmacSha256 !== expected
    ) throw new Error("invalid broker request");
    this.requests.push(request);
  }

  #response(
    request: LocalClientWindowsAuthorityBrokerRequest,
  ): LocalClientWindowsAuthorityBrokerResponse {
    let unsigned: LocalClientWindowsAuthorityUnsignedResponse = {
      brokerVersion: LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_VERSION,
      operation: request.operation,
      nonce: request.nonce,
      osPlatform: "win32",
      hostId: request.hostId,
      serviceSid: request.serviceSid,
      anchorPath: request.anchorPath,
      programDataRoot: request.programDataRoot,
      hklmKeyPath: request.hklmKeyPath,
      hklmView: "registry64",
      fileCheckpoint: this.#state,
      hklmCheckpoint: this.#options.hklmCheckpoint ?? this.#state,
      acl: this.#options.acl ?? { ...safeAcl(), hklmKeyPath: this.#configuration.hklmKeyPath },
    };
    if (request.requestVersion === LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_V2_VERSION) {
      const { requestHmacSha256: _mac, ...unsignedRequest } = request;
      unsigned = { ...unsigned, brokerVersion: LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_V2_VERSION,
        serviceInstanceId: request.serviceInstanceId, clientSessionId: request.clientSessionId,
        requestSequence: request.requestSequence, issuedAtMs: request.issuedAtMs, expiresAtMs: request.expiresAtMs,
        observedAtMs: Date.now(), requestDigestSha256: createLocalClientWindowsAuthorityRequestDigest(unsignedRequest) };
    }
    unsigned = this.#options.mutateUnsignedResponse?.(unsigned) ?? unsigned;
    const responseHmacSha256 = createLocalClientWindowsAuthorityResponseHmac(KEY, unsigned);
    return Object.freeze({
      ...unsigned,
      responseHmacSha256: this.#options.forgeResponseHmac
        ? `${responseHmacSha256.slice(0, 63)}${responseHmacSha256.endsWith("0") ? "1" : "0"}`
        : responseHmacSha256,
    });
  }
}

function checkpoint(
  currentGeneration: number,
  currentDigest: string | null,
  pendingGeneration: number | null = null,
  pendingDigest: string | null = null,
): LocalClientWindowsAuthorityCheckpointState {
  return Object.freeze({ currentGeneration, currentDigest, pendingGeneration, pendingDigest });
}

function safeAcl(): LocalClientWindowsAuthorityAclFacts {
  const writers = [ADMINISTRATORS_SID, SYSTEM_SID, SERVICE_SID].sort();
  return Object.freeze({
    source: "independent-privileged-broker",
    currentUserSid: CURRENT_USER_SID,
    serviceSid: SERVICE_SID,
    rootOwnerSid: SYSTEM_SID,
    rootAllowedWriteSids: writers,
    rootInheritedWriteSids: [],
    rootCurrentUserCanWrite: false,
    fileOwnerSid: SERVICE_SID,
    fileAllowedWriteSids: writers,
    fileInheritedWriteSids: [],
    fileCurrentUserCanWrite: false,
    registryOwnerSid: SYSTEM_SID,
    registryAllowedWriteSids: writers,
    registryInheritedWriteSids: [],
    registryCurrentUserCanWrite: false,
    hklmHive: "HKLM",
    hklmKeyPath: HKLM_KEY,
    hklmView: "registry64",
  });
}

async function writeCheckpoint(
  path: string,
  state: LocalClientWindowsAuthorityCheckpointState,
  configuration: Pick<
    LocalClientWindowsProtectedAuthorityEnabledOptions,
    "anchorPath" | "hklmKeyPath" | "hostId" | "serviceSid" | "integrityKey"
  >,
): Promise<void> {
  const unsigned = {
    fileVersion: LOCAL_CLIENT_WINDOWS_AUTHORITY_FILE_VERSION,
    hostId: configuration.hostId,
    serviceSid: configuration.serviceSid,
    anchorPath: configuration.anchorPath,
    hklmKeyPath: configuration.hklmKeyPath,
    hklmView: "registry64" as const,
    ...state,
  };
  const file: LocalClientWindowsAuthorityFileCheckpoint = {
    ...unsigned,
    hmacSha256: createLocalClientWindowsAuthorityFileHmac(
      configuration.integrityKey,
      unsigned,
    ),
  };
  await writeFile(path, `${JSON.stringify(file, null, 2)}\n`, "utf8");
}
