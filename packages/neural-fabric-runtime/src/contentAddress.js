import { createHash } from "node:crypto";
import { canonicalize } from "./canonicalize.js";

export function contentAddress(value) {
  const canonical = typeof value === "string" ? value : canonicalize(value);
  const hash = createHash("sha256").update(canonical, "utf8").digest("hex");
  return Object.freeze({
    algorithm: "sha256",
    hash,
    uri: `sha256:${hash}`,
    byteLength: Buffer.byteLength(canonical, "utf8"),
  });
}
