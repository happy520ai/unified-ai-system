import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, win32 } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_VERSION,
  LOCAL_CLIENT_WINDOWS_AUTHORITY_FILE_VERSION,
  LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_VERSION,
  LOCAL_CLIENT_WINDOWS_PROTECTED_AUTHORITY_BOUNDARIES,
  createLocalClientWindowsAuthorityFileHmac,
  createLocalClientWindowsAuthorityRequestHmac,
  createLocalClientWindowsAuthorityResponseHmac,
  createLocalClientWindowsProtectedAuthorityAnchor,
  type LocalClientWindowsAuthorityAclFacts,
  type LocalClientWindowsAuthorityBrokerRequest,
  type LocalClientWindowsAuthorityBrokerResponse,
  type LocalClientWindowsAuthorityCheckpointState,
  type LocalClientWindowsAuthorityFileCheckpoint,
  type LocalClientWindowsAuthorityPrivilegedBrokerPort,
  type LocalClientWindowsProtectedAuthorityEnabledOptions,
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
});

type FakeBrokerOptions = Readonly<{
  forgeResponseHmac?: boolean;
  mutateUnsignedResponse?: (
    response: Omit<LocalClientWindowsAuthorityBrokerResponse, "responseHmacSha256">,
  ) => Omit<LocalClientWindowsAuthorityBrokerResponse, "responseHmacSha256">;
  acl?: LocalClientWindowsAuthorityAclFacts;
  hklmCheckpoint?: LocalClientWindowsAuthorityCheckpointState;
}>;

class FakeBroker implements LocalClientWindowsAuthorityPrivilegedBrokerPort {
  readonly operations: string[] = [];
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
      request.requestVersion !== LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_VERSION
      || request.operation !== operation
      || requestHmacSha256 !== expected
    ) throw new Error("invalid broker request");
  }

  #response(
    request: LocalClientWindowsAuthorityBrokerRequest,
  ): LocalClientWindowsAuthorityBrokerResponse {
    let unsigned: Omit<LocalClientWindowsAuthorityBrokerResponse, "responseHmacSha256"> = {
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
      acl: this.#options.acl ?? safeAcl(),
    };
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
