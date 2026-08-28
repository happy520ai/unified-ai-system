import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";

export function readExternalEffectKeyContext(request: IncomingMessage) {
  const idempotencyKey = request.headers?.["idempotency-key"];
  const externalEffectKey = request.headers?.["external-effect-key"];
  if (idempotencyKey !== undefined && externalEffectKey !== undefined) {
    return { effectKeyInvalid: true };
  }
  const rawKey = externalEffectKey ?? idempotencyKey;
  if (rawKey === undefined) return {};
  if (
    typeof rawKey !== "string"
    || rawKey.length < 1
    || rawKey.length > 255
    || !/^[\x21-\x7e]+$/u.test(rawKey)
  ) {
    return { effectKeyInvalid: true };
  }
  return {
    effectKeyHash: createHash("sha256").update(rawKey, "utf8").digest("hex"),
  };
}
