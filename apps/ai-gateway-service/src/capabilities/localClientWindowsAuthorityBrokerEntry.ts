import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";
import {
  createLocalClientWindowsAuthorityFileHmac, LOCAL_CLIENT_WINDOWS_AUTHORITY_FILE_VERSION,
  type LocalClientWindowsAuthorityCheckpointState,
} from "./localClientWindowsProtectedAuthorityAnchor.ts";
import {
  createLocalClientWindowsAuthorityProvisioningPlan, LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
} from "./localClientWindowsAuthorityBrokerService.ts";
import {
  boundedJson, parseBounded, handleLocalClientNativeAuthorityRequest, loadLocalClientNativeAuthority,
  parseLocalClientNativeAuthorityBootstrap, type LocalClientNativeAuthorityApi,
  LOCAL_CLIENT_NATIVE_AUTHORITY_LEGACY_SLOTS, LOCAL_CLIENT_NATIVE_AUTHORITY_SLOTS,
} from "./localClientWindowsAuthorityNative.ts";

const PRIVATE_LIMIT = 8 * 65_536;

/** Private host envelope only; callers on the named pipe supply request text,
 * never a token handle or worker id. The native host constructs this envelope. */
export async function handleLocalClientAuthorityWorkerEnvelope(native: LocalClientNativeAuthorityApi, envelope: unknown) {
  const withInstance = envelope !== null && typeof envelope === "object" && Object.hasOwn(envelope, "serviceInstanceId");
  exact(envelope, ["id", "callerTokenHandle", "request", ...(withInstance ? ["serviceInstanceId"] : [])]);
  if (typeof envelope.id !== "string" || !/^[A-Za-z0-9-]{1,64}$/u.test(envelope.id)
    || typeof envelope.callerTokenHandle !== "string" || !/^[1-9][0-9]{0,19}$/u.test(envelope.callerTokenHandle)
    || typeof envelope.request !== "string" || (withInstance && envelope.serviceInstanceId !== null
      && (typeof envelope.serviceInstanceId !== "string" || !/^[a-f0-9]{64}$/u.test(envelope.serviceInstanceId)))) fail();
  parseBounded(envelope.request);
  return Object.freeze({ id: envelope.id,
    response: await handleLocalClientNativeAuthorityRequest(native, envelope.callerTokenHandle, envelope.request,
      typeof envelope.serviceInstanceId === "string" ? envelope.serviceInstanceId : undefined) });
}

/** The installer sends its newly generated dedicated HMAC key through private
 * stdin. This helper performs no filesystem, registry, service or network writes.
 * It reuses the existing file signing protocol and never includes that key in output. */
export function createLocalClientNativeAuthorityZeroCheckpoints(input: unknown) {
  return createZeroCheckpoints(input, false);
}

/** The preserving installer may request only the two new slots. It receives no
 * newly signed legacy checkpoint and must never rewrite an existing slot. */
export function createLocalClientNativeAuthorityMaintenanceCheckpoints(input: unknown) {
  return createZeroCheckpoints(input, true);
}

function createZeroCheckpoints(input: unknown, popOnly: boolean) {
  const v2 = input !== null && typeof input === "object" && !Array.isArray(input) && Object.hasOwn(input, "packageManifestSha256");
  exactData(input, ["hostId", "currentUserSid", "programDataBasePath", "anchorIds", "integrityKey", ...(v2 ? ["packageManifestSha256"] : [])]);
  if (popOnly && !v2) fail();
  if (typeof input.hostId !== "string" || !input.hostId.startsWith("windows-authority-")
    || typeof input.integrityKey !== "string") fail();
  const key = Buffer.from(input.integrityKey, "base64");
  try {
    if (key.byteLength !== 32 || key.toString("base64") !== input.integrityKey) fail();
    input.integrityKey = "";
    const bootstrap = parseLocalClientNativeAuthorityBootstrap({ version: v2 ? "local-client-windows-authority-bootstrap-v4" : "local-client-windows-authority-bootstrap-v1",
      installationId: input.hostId.slice("windows-authority-".length), hostId: input.hostId,
      currentUserSid: input.currentUserSid, programDataBasePath: input.programDataBasePath, anchorIds: input.anchorIds,
      ...(v2 ? { packageManifestSha256: input.packageManifestSha256 } : {}) });
    const slots = popOnly ? ["pop-replay", "validation-pop-replay"] : bootstrap.anchorIds;
    const checkpoints = slots.map(anchorId => {
      const plan = createLocalClientWindowsAuthorityProvisioningPlan(bootstrap.programDataBasePath, [], { anchorId });
      const unsigned = { fileVersion: LOCAL_CLIENT_WINDOWS_AUTHORITY_FILE_VERSION, hostId: bootstrap.hostId,
        serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID, anchorPath: plan.storage.anchorPath,
        hklmKeyPath: plan.registry.keyPath, hklmView: "registry64" as const,
        currentGeneration: 0, currentDigest: null, pendingGeneration: null, pendingDigest: null };
      return Object.freeze({ anchorId, checkpointJson: boundedJson({ ...unsigned,
        hmacSha256: createLocalClientWindowsAuthorityFileHmac(key, unsigned) }) });
    });
    return Object.freeze({ checkpoints: Object.freeze(checkpoints) });
  } finally { key.fill(0); }
}

/** Offline verification of already-read bytes. OS paths, ACLs, registry types,
 * ownership and before/after byte preservation remain the installer's checks. */
export function verifyLocalClientNativeAuthorityMaintenanceCheckpoints(input: unknown) {
  exactData(input, ["bootstrap", "integrityKey", "checkpoints"]);
  if (typeof input.integrityKey !== "string" || !Array.isArray(input.checkpoints)) fail();
  const key = Buffer.from(input.integrityKey, "base64");
  try {
    if (key.byteLength !== 32 || key.toString("base64") !== input.integrityKey) fail();
    input.integrityKey = "";
    const bootstrap = parseLocalClientNativeAuthorityBootstrap(input.bootstrap);
    const expected = input.checkpoints.length === LOCAL_CLIENT_NATIVE_AUTHORITY_LEGACY_SLOTS.length
      && bootstrap.version === "local-client-windows-authority-bootstrap-v1"
      ? LOCAL_CLIENT_NATIVE_AUTHORITY_LEGACY_SLOTS : LOCAL_CLIENT_NATIVE_AUTHORITY_SLOTS;
    if (input.checkpoints.length !== expected.length) fail();
    const seen = new Set<string>();
    for (const raw of input.checkpoints) {
      exactData(raw, ["anchorId", "fileJson", "registryJson"]);
      if (typeof raw.anchorId !== "string" || !expected.includes(raw.anchorId) || seen.has(raw.anchorId)
        || typeof raw.fileJson !== "string" || typeof raw.registryJson !== "string") fail();
      seen.add(raw.anchorId);
      const plan = createLocalClientWindowsAuthorityProvisioningPlan(bootstrap.programDataBasePath, [], { anchorId: raw.anchorId });
      const file = parseBounded(raw.fileJson), registry = parseBounded(raw.registryJson);
      exactData(file, ["fileVersion", "hostId", "serviceSid", "anchorPath", "hklmKeyPath", "hklmView",
        "currentGeneration", "currentDigest", "pendingGeneration", "pendingDigest", "hmacSha256"]);
      if (file.fileVersion !== LOCAL_CLIENT_WINDOWS_AUTHORITY_FILE_VERSION || file.hostId !== bootstrap.hostId
        || file.serviceSid !== LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID || file.anchorPath !== plan.storage.anchorPath
        || file.hklmKeyPath !== plan.registry.keyPath || file.hklmView !== "registry64"
        || typeof file.hmacSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(file.hmacSha256)) fail();
      const state = maintenanceCheckpointState(file, false);
      const unsigned = { fileVersion: LOCAL_CLIENT_WINDOWS_AUTHORITY_FILE_VERSION, hostId: bootstrap.hostId,
        serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID, anchorPath: plan.storage.anchorPath,
        hklmKeyPath: plan.registry.keyPath, hklmView: "registry64" as const, ...state };
      const expectedHmac = createLocalClientWindowsAuthorityFileHmac(key, unsigned);
      if (!timingSafeEqual(Buffer.from(file.hmacSha256, "hex"), Buffer.from(expectedHmac, "hex"))) fail();
      const registryState = maintenanceCheckpointState(registry, true);
      if (state.currentGeneration !== registryState.currentGeneration || state.currentDigest !== registryState.currentDigest
        || state.pendingGeneration !== registryState.pendingGeneration || state.pendingDigest !== registryState.pendingDigest) fail();
    }
    if (expected.some(anchorId => !seen.has(anchorId))) fail();
    return Object.freeze({ verified: true as const, checkpointCount: seen.size });
  } finally { key.fill(0); }
}

function maintenanceCheckpointState(raw: unknown, exactState: boolean): LocalClientWindowsAuthorityCheckpointState {
  if (exactState) exactData(raw, ["currentGeneration", "currentDigest", "pendingGeneration", "pendingDigest"]);
  else if (raw === null || typeof raw !== "object" || Array.isArray(raw)) fail();
  const record = raw as Record<string, unknown>;
  const generation = record.currentGeneration, pending = record.pendingGeneration;
  const digest = record.currentDigest, pendingDigest = record.pendingDigest;
  const nullableDigest = (value: unknown) => value === null || (typeof value === "string" && /^[a-f0-9]{64}$/u.test(value));
  if (typeof generation !== "number" || !Number.isSafeInteger(generation) || generation < 0
    || (pending !== null && (typeof pending !== "number" || !Number.isSafeInteger(pending) || pending <= 0 || pending !== generation + 1))
    || !nullableDigest(digest) || !nullableDigest(pendingDigest)
    || (generation === 0) !== (digest === null) || (pending === null) !== (pendingDigest === null)) fail();
  return Object.freeze({ currentGeneration: generation, currentDigest: digest as string | null,
    pendingGeneration: pending as number | null, pendingDigest: pendingDigest as string | null });
}

/** Called only by the separately bundled private worker entry. Importing this
 * module from the gateway does not register or start a privileged service. */
export async function runNativeAuthorityWorker() {
  let stage = "NATIVE_LOAD";
  let firstFailure: { workerError: string; failureCode: string; popFault: boolean } | null = null;
  const rememberFailure = (workerError: string, error: unknown) => {
    if (firstFailure !== null) return;
    let failureCode = "LOCAL_CLIENT_NATIVE_AUTHORITY_WORKER_REJECTED";
    try {
      const code = error !== null && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
      if (typeof code === "string" && /^[A-Z0-9_]{1,128}$/u.test(code)) failureCode = code;
    } catch { /* Error properties are not diagnostic authority. */ }
    const knownRejection = /^LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_(?:REQUEST_INVALID|REQUEST_AUTHENTICATION_FAILED|REQUEST_BINDING_MISMATCH|NONCE_REPLAYED|REQUEST_EXPIRED|REQUEST_FUTURE|NONCE_CAPACITY|EXPECTATION_MISMATCH|PENDING_RECOVERY_REQUIRED)$/u.test(failureCode);
    firstFailure = { workerError, failureCode, popFault: !knownRejection };
  };
  const nativeStages: Record<keyof LocalClientNativeAuthorityApi, string> = {
    inspectEnvironment: "NATIVE_INSPECT_ENVIRONMENT", initializeService: "NATIVE_INITIALIZE_SERVICE",
    readBootstrap: "NATIVE_READ_BOOTSTRAP", beginRequest: "NATIVE_BEGIN_REQUEST", endRequest: "NATIVE_END_REQUEST",
    acquireLock: "NATIVE_ACQUIRE_LOCK", releaseLock: "NATIVE_RELEASE_LOCK", claimNonce: "NATIVE_CLAIM_NONCE",
    readProtectedFileCheckpoint: "NATIVE_READ_PROTECTED_FILE_CHECKPOINT",
    writeProtectedFileCheckpointAtomically: "NATIVE_WRITE_PROTECTED_FILE_CHECKPOINT_ATOMICALLY",
    readHklmCheckpoint64: "NATIVE_READ_HKLM_CHECKPOINT_64", writeHklmCheckpoint64: "NATIVE_WRITE_HKLM_CHECKPOINT_64",
    inspectAclFacts: "NATIVE_INSPECT_ACL_FACTS", request: "NATIVE_REQUEST",
    startPopServiceInstance: "NATIVE_START_POP_SERVICE_INSTANCE", readPopServiceInstance: "NATIVE_READ_POP_SERVICE_INSTANCE",
    claimExpiringNonce: "NATIVE_CLAIM_EXPIRING_NONCE", assertExpiringRequestFresh: "NATIVE_ASSERT_EXPIRING_REQUEST_FRESH",
  };
  try {
    const serviceStart = process.argv.length === 3 && process.argv[2] === "--start-pop-service-instance";
    if ((!serviceStart && process.argv.length !== 2) || process.platform !== "win32") fail();
    const loaded = loadLocalClientNativeAuthority(join(dirname(fileURLToPath(import.meta.url)), "local-client-authority.node"));
    const native = new Proxy(loaded, { get(target, property) {
      const method = Reflect.get(target, property, target);
      if (!Object.hasOwn(nativeStages, property) || typeof method !== "function") return method;
      const nativeStage = nativeStages[property as keyof LocalClientNativeAuthorityApi];
      return (...args: unknown[]) => {
        try {
          const result = Reflect.apply(method, target, args);
          return result instanceof Promise ? result.catch((error: unknown) => {
            rememberFailure(nativeStage, error); throw error;
          }) : result;
        } catch (error) { rememberFailure(nativeStage, error); throw error; }
      };
    } });
    stage = "PRIVATE_INPUT";
    const envelope = await readPrivateInput();
    if (serviceStart) {
      exact(envelope, ["control"]); if (envelope.control !== "start-pop-service-instance") fail();
      const loadedBootstrap = native.readBootstrap();
      try {
        const bootstrap = parseLocalClientNativeAuthorityBootstrap(parseBounded(loadedBootstrap.configJson));
        if ((bootstrap.version !== "local-client-windows-authority-bootstrap-v3"
          && bootstrap.version !== "local-client-windows-authority-bootstrap-v4") || !native.startPopServiceInstance) fail();
        native.initializeService({ hostId: bootstrap.hostId, currentUserSid: bootstrap.currentUserSid });
        const serviceInstanceId = native.startPopServiceInstance();
        if (!/^[a-f0-9]{64}$/u.test(serviceInstanceId)) fail();
        await writePrivateOutput({ control: "pop-service-instance-ready", serviceInstanceId }); return;
      } finally { loadedBootstrap.integrityKey.fill(0); }
    }
    stage = "AUTHORITY_REQUEST";
    const response = await handleLocalClientAuthorityWorkerEnvelope(native, envelope);
    await writePrivateOutput(response);
  } catch (error) {
    rememberFailure(stage, error);
    process.exitCode = 1;
    process.stderr.write("LOCAL_CLIENT_NATIVE_AUTHORITY_WORKER_REJECTED\n");
    const ignoreOutputError = () => {};
    process.stdout.on("error", ignoreOutputError);
    try { await writePrivateOutput(firstFailure); } catch { /* Retain the fixed stderr and failing exit code. */ }
    finally { process.stdout.off("error", ignoreOutputError); }
  }
}

export async function runPrepareBootstrap() {
  try {
    if (process.argv.length !== 3) fail();
    const mode = process.argv[2];
    if (mode !== "--prepare-bootstrap" && mode !== "--prepare-maintenance" && mode !== "--verify-maintenance-checkpoints") fail();
    const input = await readPrivateInput();
    await writePrivateOutput(mode === "--prepare-maintenance" ? createLocalClientNativeAuthorityMaintenanceCheckpoints(input)
      : mode === "--verify-maintenance-checkpoints" ? verifyLocalClientNativeAuthorityMaintenanceCheckpoints(input)
      : createLocalClientNativeAuthorityZeroCheckpoints(input));
  } catch {
    process.stderr.write("LOCAL_CLIENT_NATIVE_AUTHORITY_BOOTSTRAP_REJECTED\n");
    process.exitCode = 1;
  }
}

async function readPrivateInput(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let length = 0;
    const timer = setTimeout(() => finish(new Error("PRIVATE_INPUT_TIMEOUT")), 5_000);
    function finish(error?: Error) {
      clearTimeout(timer);
      process.stdin.off("data", data); process.stdin.off("end", end); process.stdin.off("error", finish);
      process.stdin.pause();
      const bytes = Buffer.concat(chunks);
      try {
        if (error) return reject(error);
        const text = bytes.toString("utf8");
        if (!Buffer.from(text, "utf8").equals(bytes)) fail();
        const newline = text.indexOf("\n");
        if (newline >= 0 && text.slice(newline + 1).trim() !== "") fail();
        resolve(JSON.parse(newline < 0 ? text : text.slice(0, newline)));
      } catch { reject(new Error("PRIVATE_INPUT_INVALID")); }
      finally { bytes.fill(0); for (const chunk of chunks) chunk.fill(0); }
    }
    function data(chunk: Buffer) {
      length += chunk.byteLength;
      if (length > PRIVATE_LIMIT) return finish(new Error("PRIVATE_INPUT_TOO_LARGE"));
      chunks.push(Buffer.from(chunk));
      if (chunk.includes(10)) finish();
    }
    function end() { finish(); }
    process.stdin.on("data", data); process.stdin.once("end", end); process.stdin.once("error", finish);
  });
}
async function writePrivateOutput(value: unknown) {
  const output = Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
  try {
    if (output.byteLength > PRIVATE_LIMIT) fail();
    await new Promise<void>((resolve, reject) => process.stdout.write(output, error => error ? reject(error) : resolve()));
  } finally { output.fill(0); }
}
function exact(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail();
}
function exactData(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  exact(value, keys);
  if ((Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    || Reflect.ownKeys(value).length !== keys.length
    || Object.values(Object.getOwnPropertyDescriptors(value)).some(descriptor => !("value" in descriptor))) fail();
}
function fail(): never { throw new Error("LOCAL_CLIENT_NATIVE_AUTHORITY_ENTRY_REJECTED"); }
