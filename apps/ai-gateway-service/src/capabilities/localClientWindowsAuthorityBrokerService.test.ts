import { describe, expect, it } from "vitest";

import {
  LOCAL_CLIENT_WINDOWS_AUTHORITY_FILE_VERSION,
  LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_VERSION,
  createLocalClientWindowsAuthorityFileHmac,
  createLocalClientWindowsAuthorityRequestHmac,
  createLocalClientWindowsAuthorityResponseHmac,
  type LocalClientWindowsAuthorityAclFacts,
  type LocalClientWindowsAuthorityBrokerRequest,
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

function createHarness(initialState: LocalClientWindowsAuthorityCheckpointState) {
  const osPort = new FakeWindowsAuthorityOsPort();
  const broker = new LocalClientWindowsAuthorityBrokerService({
    programDataBasePath: PROGRAM_DATA,
    hostId: HOST_ID,
    currentUserSid: CURRENT_USER_SID,
    integrityKey: KEY,
    osPort,
  });
  osPort.seed(broker.target, initialState);
  return { broker, osPort };
}

function createRequest(
  target: WindowsAuthorityStorageTarget,
  operation: LocalClientWindowsAuthorityOperation,
  state: LocalClientWindowsAuthorityCheckpointState,
  nonceValue: number,
  overrides: Partial<Omit<LocalClientWindowsAuthorityBrokerRequest, "requestHmacSha256">> = {},
): LocalClientWindowsAuthorityBrokerRequest {
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

function safeAcl(): LocalClientWindowsAuthorityAclFacts {
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
    hklmKeyPath: LOCAL_CLIENT_WINDOWS_AUTHORITY_HKLM_KEY,
    hklmView: "registry64" as const,
  });
}

class FakeWindowsAuthorityOsPort implements WindowsAuthorityOsPort {
  readonly operations: string[] = [];
  readonly claimedNonces = new Set<string>();
  identityOverride: Partial<WindowsAuthorityRuntimeIdentity> = {};
  aclOverride: LocalClientWindowsAuthorityAclFacts | null = null;
  failNextHklmWrite = false;
  hklmCheckpoint: LocalClientWindowsAuthorityCheckpointState = checkpoint(0, null);
  #fileCheckpoint!: LocalClientWindowsAuthorityFileCheckpoint;
  #tail: Promise<void> = Promise.resolve();

  seed(
    target: WindowsAuthorityStorageTarget,
    state: LocalClientWindowsAuthorityCheckpointState,
  ): void {
    this.#fileCheckpoint = signedFile(target, state);
    this.hklmCheckpoint = state;
  }

  fileState(): LocalClientWindowsAuthorityCheckpointState {
    return checkpoint(
      this.#fileCheckpoint.currentGeneration,
      this.#fileCheckpoint.currentDigest,
      this.#fileCheckpoint.pendingGeneration,
      this.#fileCheckpoint.pendingDigest,
    );
  }

  tamperFileHmac(): void {
    this.#fileCheckpoint = Object.freeze({
      ...this.#fileCheckpoint,
      hmacSha256: "0".repeat(64),
    });
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
    _target: WindowsAuthorityStorageTarget,
  ): Promise<unknown> {
    this.operations.push("read-file");
    return this.#fileCheckpoint;
  }

  async writeProtectedFileCheckpointAtomically(
    _target: WindowsAuthorityStorageTarget,
    checkpointValue: LocalClientWindowsAuthorityFileCheckpoint,
  ): Promise<void> {
    this.operations.push("write-file-atomic");
    this.#fileCheckpoint = checkpointValue;
  }

  async readHklmCheckpoint64(
    _target: WindowsAuthorityStorageTarget,
  ): Promise<unknown> {
    this.operations.push("read-hklm64");
    return this.hklmCheckpoint;
  }

  async writeHklmCheckpoint64(
    _target: WindowsAuthorityStorageTarget,
    checkpointValue: LocalClientWindowsAuthorityCheckpointState,
  ): Promise<void> {
    this.operations.push("write-hklm64");
    if (this.failNextHklmWrite) {
      this.failNextHklmWrite = false;
      throw new Error("fixture HKLM failure");
    }
    this.hklmCheckpoint = checkpointValue;
  }

  async inspectAclFacts(_target: WindowsAuthorityStorageTarget): Promise<unknown> {
    this.operations.push("acl");
    return this.aclOverride ?? safeAcl();
  }
}
