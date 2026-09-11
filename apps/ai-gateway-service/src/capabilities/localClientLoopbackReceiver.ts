import { createServer, type IncomingMessage } from "node:http";
import {
  LOCAL_CLIENT_LOOPBACK_ADAPTER_ID, LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION,
  LOCAL_CLIENT_LOOPBACK_ACTION_VERSION, LOCAL_CLIENT_LOOPBACK_CHALLENGE_VERSION,
  LOCAL_CLIENT_LOOPBACK_VERIFICATION_VERSION, LOCAL_CLIENT_LOOPBACK_RECEIPT_VERSION,
  LOCAL_CLIENT_LOOPBACK_RECONCILIATION_PATH, localClientLoopbackWire as wire,
  type LocalClientLoopbackActionRequest,
} from "./localClientLoopbackAdapter.ts";
import type {
  LocalClientSqliteExecutionReceiptJournal, LocalClientDispatchIntent,
  LocalClientDurableExecutionReceipt, LocalClientReceiptReconciliationQuery,
} from "./localClientExecutionReceiptReconciliation.ts";

export interface LocalClientLoopbackReceiverOptions {
  readonly clientId: string;
  readonly manifestSha256: string;
  readonly sharedSecret: Uint8Array;
  readonly journal: LocalClientSqliteExecutionReceiptJournal;
  /** Validate/prepare without effects. The returned operation commits once.
   * Cancellation before commit must not write. Errors after claiming an effect
   * remain unknown and are never converted into a success receipt. */
  readonly prepare: (
    payload: string, signal: AbortSignal, intent: LocalClientDispatchIntent,
  ) => Promise<() => Promise<void | LocalClientDurableExecutionReceipt>>;
  /** Read actual native committed state only; never open/edit/save a document. */
  readonly recoverNativeReceipt?: (
    query: LocalClientReceiptReconciliationQuery,
  ) => Promise<LocalClientDurableExecutionReceipt | null>;
}

/** Receiving transport only. It provides neither gateway approval nor OS
 * identity attestation. The journal still declares the effect/receipt crash
 * window and snapshot protection as unverified. No readiness override exists. */
export async function createLocalClientLoopbackReceiver(options: LocalClientLoopbackReceiverOptions) {
  if (!/^[a-z][a-z0-9._-]{0,127}$/u.test(options.clientId)
    || !/^[a-f0-9]{64}$/u.test(options.manifestSha256)
    || !(options.sharedSecret instanceof Uint8Array) || options.sharedSecret.length !== 32
    || options.journal.status.role !== "client" || typeof options.prepare !== "function"
    || (options.recoverNativeReceipt !== undefined && typeof options.recoverNativeReceipt !== "function")) {
    throw new Error("LOCAL_CLIENT_RECEIVER_CONFIGURATION_INVALID");
  }
  const secret = Buffer.from(options.sharedSecret);
  const challenges = new Map<string, number>();
  const requests = new Map<AbortController, Promise<void>>();
  const activeExecutions = new Set<string>();
  let revoked = false;
  let closing: Promise<void> | null = null;
  let closingRequested = false;
  const server = createServer(async (request, response) => {
    const controller = new AbortController();
    let finish!: () => void;
    requests.set(controller, new Promise<void>((resolve) => { finish = resolve; }));
    response.on("close", () => { if (!response.writableFinished) controller.abort(); });
    try {
      if (closingRequested || request.method !== "POST" || request.headers.origin
        || request.headers.host !== `127.0.0.1:${(server.address() as { port: number }).port}`
        || request.headers["content-encoding"]
        || !/^application\/json(?:;|$)/iu.test(String(request.headers["content-type"]))) fail();
      const body = await readBody(request);
      let result: unknown;
      if (request.url === LOCAL_CLIENT_LOOPBACK_RECONCILIATION_PATH) {
        const query = body as unknown as LocalClientReceiptReconciliationQuery;
        let response = await options.journal.reconcile(query); // Authenticate before the native lookup.
        if (response.state === "pending" && options.recoverNativeReceipt) {
          const receipt = await options.recoverNativeReceipt(query);
          if (receipt) {
            assertNativeReceiptBinding(receipt, query);
            await options.journal.recordNativeCompleted(receipt);
            response = await options.journal.reconcile(query);
          }
        }
        result = response;
      } else {
        if (revoked || controller.signal.aborted) fail();
        if (request.url === "/.well-known/unified-ai/local-client/challenge") {
          handshake(body, false);
          for (const [nonce, expiry] of challenges) if (expiry <= Date.now()) challenges.delete(nonce);
          if (challenges.size >= 256 || challenges.has(String(body.nonce))) fail();
          challenges.set(String(body.nonce), Number(body.expiresAtMs));
          result = { ...body, signature: wire.signChallengeResponse(secret, body as never) };
        } else if (request.url === "/.well-known/unified-ai/local-client/verify") {
          handshake(body, true);
          result = { ...body, signature: wire.signVerificationResponse(secret, body as never) };
        } else if (request.url === "/v1/unified-ai/local-client/actions/invoke") {
          result = await action(body, controller.signal);
        } else fail();
      }
      response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(JSON.stringify(result));
    } catch {
      if (!response.destroyed) {
        response.writeHead(409, { "content-type": "application/json", "cache-control": "no-store" });
        response.end('{"error":"LOCAL_CLIENT_RECEIVER_REQUEST_REJECTED"}');
      }
    } finally {
      // Also cancel unconsumed preparation when claim/validation failed after
      // prepare returned but the HTTP response ended normally.
      controller.abort();
      requests.delete(controller); finish();
    }
  });
  server.requestTimeout = 5_000;
  server.headersTimeout = 5_000;
  server.maxConnections = 16;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); });
  });
  return Object.freeze({
    endpoint: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    revoke() { revoked = true; challenges.clear(); for (const request of requests.keys()) request.abort(); },
    close() {
      if (closing) return closing;
      closingRequested = true;
      revoked = true;
      challenges.clear();
      for (const request of requests.keys()) request.abort();
      closing = (async () => {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => error ? reject(error) : resolve());
          server.closeAllConnections();
        });
        // Closing sockets does not complete async editor operations. Preserve
        // the journal/secret lifetime until admitted handlers have finished.
        while (requests.size > 0) await Promise.all(requests.values());
        secret.fill(0);
      })();
      return closing;
    },
  });

  function handshake(body: Record<string, unknown>, verification: boolean) {
    const fields = ["protocolVersion", "nonce", "clientId", "manifestSha256", "adapterVersion",
      "issuedAtMs", "expiresAtMs", "signature"];
    if (verification) fields.push("adapterId", "adapterType");
    if (!wire.hasExactKeys(body, fields) || body.clientId !== options.clientId
      || body.manifestSha256 !== options.manifestSha256
      || body.adapterVersion !== LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION
      || !/^[A-Za-z0-9_-]{43}$/u.test(String(body.nonce))
      || !Number.isSafeInteger(body.issuedAtMs) || !Number.isSafeInteger(body.expiresAtMs)
      || Number(body.issuedAtMs) > Date.now() || Number(body.expiresAtMs) <= Date.now()
      || Number(body.expiresAtMs) - Number(body.issuedAtMs) > (verification ? 86_400_000 : 10_000)) fail();
    if (verification) {
      if (body.protocolVersion !== LOCAL_CLIENT_LOOPBACK_VERIFICATION_VERSION
        || body.adapterId !== LOCAL_CLIENT_LOOPBACK_ADAPTER_ID || body.adapterType !== "loopback-http"
        || !wire.safeSignatureEqual(body.signature, wire.signVerificationRequest(secret, body as never))) fail();
    } else if (body.protocolVersion !== LOCAL_CLIENT_LOOPBACK_CHALLENGE_VERSION
      || !wire.safeSignatureEqual(body.signature, wire.signChallengeRequest(secret, body as never))) fail();
  }

  async function action(raw: Record<string, unknown>, signal: AbortSignal) {
    if (!wire.hasExactKeys(raw, ["protocolVersion", "executionId", "clientId", "manifestSha256",
      "adapterVersion", "nonce", "capabilityId", "actionId", "planFingerprint", "inputSha256",
      "dispatchIntentSha256", "dispatchIntent", "input", "signature"])) fail();
    const body = raw as unknown as LocalClientLoopbackActionRequest;
    if (body.protocolVersion !== LOCAL_CLIENT_LOOPBACK_ACTION_VERSION || body.clientId !== options.clientId
      || body.manifestSha256 !== options.manifestSha256 || body.adapterVersion !== LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION
      || body.capabilityId !== "local_application" || body.actionId !== "invoke"
      || !wire.hasExactKeys(body.input, ["payload"]) || typeof body.input.payload !== "string"
      || body.input.payload.length > 4_096
      || body.inputSha256 !== wire.sha256(wire.canonicalJson(body.input))
      || body.dispatchIntentSha256 !== wire.sha256(wire.canonicalJson(body.dispatchIntent))
      || body.dispatchIntent.executionId !== body.executionId
      || body.dispatchIntent.planFingerprint !== body.planFingerprint
      || body.dispatchIntent.inputSha256 !== body.inputSha256
      || !wire.safeSignatureEqual(body.signature, wire.signAction(secret, body))) fail();
    const expiry = challenges.get(body.nonce);
    challenges.delete(body.nonce);
    if (expiry === undefined || expiry <= Date.now()) fail();
    // A duplicate must not prepare or terminalize the active owner's intent.
    // Occupy synchronously before the journal's first asynchronous operation.
    if (activeExecutions.has(body.executionId)) fail();
    activeExecutions.add(body.executionId);
    try {
      let nativeReceipt: LocalClientDurableExecutionReceipt | void = undefined;
      const accepted = await options.journal.acceptDispatchIntent(body.dispatchIntent);
      if (accepted.record.state === "accepted") {
        let commit: () => Promise<void | LocalClientDurableExecutionReceipt>;
        try {
          if (revoked || signal.aborted) fail();
          commit = await options.prepare(body.input.payload, signal, Object.freeze({ ...body.dispatchIntent }));
          if (revoked || signal.aborted) fail();
        } catch (error) {
          await options.journal.recordFailedBeforeEffect(body.dispatchIntent);
          throw error;
        }
        const claim = await options.journal.claimEffect(body.dispatchIntent);
        if (claim.execute) {
          if (revoked || signal.aborted) fail();
          nativeReceipt = await commit();
          if (nativeReceipt !== undefined) assertNativeReceiptBinding(nativeReceipt, body.dispatchIntent);
          else if (options.recoverNativeReceipt) fail();
        } else if (claim.state !== "completed") fail();
      } else if (accepted.record.state !== "completed") fail();
      const { receipt: durableReceipt } = nativeReceipt !== undefined
        ? await options.journal.recordNativeCompleted(nativeReceipt)
        : await options.journal.recordCompleted(body.dispatchIntent);
      const core = {
        protocolVersion: LOCAL_CLIENT_LOOPBACK_RECEIPT_VERSION, executionId: body.executionId,
        clientId: options.clientId, manifestSha256: options.manifestSha256,
        adapterVersion: LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION, nonce: body.nonce,
        capabilityId: "local_application" as const, actionId: "invoke" as const,
        planFingerprint: body.planFingerprint, inputSha256: body.inputSha256,
        durableReceiptSha256: wire.sha256(wire.canonicalJson(durableReceipt)), durableReceipt,
        executionMode: "governed" as const, externalEffectPerformed: true, status: "completed" as const,
      };
      const receipt = { ...core, receiptId: wire.deriveReceiptId(core), signature: "" };
      return { ...receipt, signature: wire.signReceipt(secret, receipt) };
    } finally { activeExecutions.delete(body.executionId); }
  }
}

function assertNativeReceiptBinding(
  receipt: LocalClientDurableExecutionReceipt,
  expected: LocalClientDispatchIntent | LocalClientReceiptReconciliationQuery,
) {
  if (!receipt || typeof receipt !== "object") fail();
  for (const field of ["executionId", "intentId", "executionBindingHmac", "tenantBindingHmac",
    "subjectBindingHmac", "clientBindingHmac", "routeBindingHmac", "identityBindingHmac",
    "planFingerprint", "inputSha256", "dispatchFencingToken"] as const) {
    if (receipt[field] !== expected[field]) fail();
  }
}

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 16_384) fail();
    chunks.push(chunk);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail();
  return value;
}
function fail(): never { throw new Error("LOCAL_CLIENT_RECEIVER_REQUEST_REJECTED"); }
