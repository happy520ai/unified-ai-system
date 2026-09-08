import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createLocalClientWindowsAuthorityFileHmac, LOCAL_CLIENT_WINDOWS_AUTHORITY_FILE_VERSION,
} from "./localClientWindowsProtectedAuthorityAnchor.ts";
import {
  createLocalClientWindowsAuthorityProvisioningPlan, LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
} from "./localClientWindowsAuthorityBrokerService.ts";
import {
  boundedJson, parseBounded, handleLocalClientNativeAuthorityRequest, loadLocalClientNativeAuthority,
  parseLocalClientNativeAuthorityBootstrap, type LocalClientNativeAuthorityApi,
} from "./localClientWindowsAuthorityNative.ts";

const PRIVATE_LIMIT = 8 * 65_536;

/** Private host envelope only; callers on the named pipe supply request text,
 * never a token handle or worker id. The native host constructs this envelope. */
export async function handleLocalClientAuthorityWorkerEnvelope(native: LocalClientNativeAuthorityApi, envelope: unknown) {
  exact(envelope, ["id", "callerTokenHandle", "request"]);
  if (typeof envelope.id !== "string" || !/^[A-Za-z0-9-]{1,64}$/u.test(envelope.id)
    || typeof envelope.callerTokenHandle !== "string" || !/^[1-9][0-9]{0,19}$/u.test(envelope.callerTokenHandle)
    || typeof envelope.request !== "string") fail();
  parseBounded(envelope.request);
  return Object.freeze({ id: envelope.id,
    response: await handleLocalClientNativeAuthorityRequest(native, envelope.callerTokenHandle, envelope.request) });
}

/** The installer sends its newly generated dedicated HMAC key through private
 * stdin. This helper performs no filesystem, registry, service or network writes.
 * It reuses the existing file signing protocol and never includes that key in output. */
export function createLocalClientNativeAuthorityZeroCheckpoints(input: unknown) {
  exact(input, ["hostId", "currentUserSid", "programDataBasePath", "anchorIds", "integrityKey"]);
  if (typeof input.hostId !== "string" || !input.hostId.startsWith("windows-authority-")
    || typeof input.integrityKey !== "string") fail();
  const key = Buffer.from(input.integrityKey, "base64");
  try {
    if (key.byteLength !== 32 || key.toString("base64") !== input.integrityKey) fail();
    input.integrityKey = "";
    const bootstrap = parseLocalClientNativeAuthorityBootstrap({ version: "local-client-windows-authority-bootstrap-v1",
      installationId: input.hostId.slice("windows-authority-".length), hostId: input.hostId,
      currentUserSid: input.currentUserSid, programDataBasePath: input.programDataBasePath, anchorIds: input.anchorIds });
    const checkpoints = bootstrap.anchorIds.map(anchorId => {
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

/** Called only by the separately bundled private worker entry. Importing this
 * module from the gateway does not register or start a privileged service. */
export async function runNativeAuthorityWorker() {
  let stage = "NATIVE_LOAD";
  let firstFailure: { workerError: string; failureCode: string } | null = null;
  const rememberFailure = (workerError: string, error: unknown) => {
    if (firstFailure !== null) return;
    let failureCode = "LOCAL_CLIENT_NATIVE_AUTHORITY_WORKER_REJECTED";
    try {
      const code = error !== null && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
      if (typeof code === "string" && /^[A-Z0-9_]{1,128}$/u.test(code)) failureCode = code;
    } catch { /* Error properties are not diagnostic authority. */ }
    firstFailure = { workerError, failureCode };
  };
  const nativeStages: Record<keyof LocalClientNativeAuthorityApi, string> = {
    inspectEnvironment: "NATIVE_INSPECT_ENVIRONMENT", initializeService: "NATIVE_INITIALIZE_SERVICE",
    readBootstrap: "NATIVE_READ_BOOTSTRAP", beginRequest: "NATIVE_BEGIN_REQUEST", endRequest: "NATIVE_END_REQUEST",
    acquireLock: "NATIVE_ACQUIRE_LOCK", releaseLock: "NATIVE_RELEASE_LOCK", claimNonce: "NATIVE_CLAIM_NONCE",
    readProtectedFileCheckpoint: "NATIVE_READ_PROTECTED_FILE_CHECKPOINT",
    writeProtectedFileCheckpointAtomically: "NATIVE_WRITE_PROTECTED_FILE_CHECKPOINT_ATOMICALLY",
    readHklmCheckpoint64: "NATIVE_READ_HKLM_CHECKPOINT_64", writeHklmCheckpoint64: "NATIVE_WRITE_HKLM_CHECKPOINT_64",
    inspectAclFacts: "NATIVE_INSPECT_ACL_FACTS", request: "NATIVE_REQUEST",
  };
  try {
    if (process.argv.length !== 2 || process.platform !== "win32") fail();
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
    if (process.argv.length !== 3 || process.argv[2] !== "--prepare-bootstrap") fail();
    await writePrivateOutput(createLocalClientNativeAuthorityZeroCheckpoints(await readPrivateInput()));
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
function fail(): never { throw new Error("LOCAL_CLIENT_NATIVE_AUTHORITY_ENTRY_REJECTED"); }
