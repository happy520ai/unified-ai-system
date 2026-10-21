// Extracted verbatim from localClientManagementCore.ts so the registry
// integrity/IO cluster lives beside the discovery module it leans on. The
// core imports the shared symbols back and re-exports the moved ones; the
// moved set depends only on the discovery module, the types file, and node
// builtins, so there is no runtime cycle. Pure mechanical move; behaviour
// unchanged.
import type { UnknownRecord, LocalClientRegistry } from "./localClientManagementCore.types.ts";
import { isRecord, createError } from "./localClientDiscovery.ts";
import { timingSafeEqual, createHmac, createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { mkdir, chmod, open, rename, appendFile } from "node:fs/promises";

export const REGISTRY_VERSION = "local-client-management-registry-v1";

export const REGISTRY_INTEGRITY_VERSION = "local-client-registry-integrity-v1" as const;

export const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

export function hasExactKeys(value: unknown, expected: readonly string[]): value is UnknownRecord {
  if (!isRecord(value)) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === expected.length
    && keys.every((key) => typeof key === "string" && expected.includes(key))
    && expected.every((key) => Object.hasOwn(value, key));
}

export function safeSha256Equal(left: unknown, right: unknown): boolean {
  if (
    typeof left !== "string"
    || typeof right !== "string"
    || !SHA256_PATTERN.test(left)
    || !SHA256_PATTERN.test(right)
  ) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function verifyRegistryIntegrity(key: Buffer, data: UnknownRecord): boolean {
  if (
    data.version !== REGISTRY_VERSION
    || !isRegistryGeneration(data.generation, false)
    || typeof data.createdAt !== "string"
    || typeof data.updatedAt !== "string"
    || !Array.isArray(data.clients)
    || !hasExactKeys(data.integrity, ["version", "hmacSha256"])
    || data.integrity.version !== REGISTRY_INTEGRITY_VERSION
    || typeof data.integrity.hmacSha256 !== "string"
    || !SHA256_PATTERN.test(data.integrity.hmacSha256)
  ) return false;
  try {
    const expected = computeRegistryHmac(key, {
      version: data.version,
      generation: data.generation,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      clients: data.clients,
    });
    return safeSha256Equal(expected, data.integrity.hmacSha256);
  } catch {
    return false;
  }
}

export function computeRegistryHmac(key: Buffer, payload: object): string {
  return createHmac("sha256", key)
    .update(REGISTRY_INTEGRITY_VERSION)
    .update("\0")
    .update(canonicalRegistryJson(payload))
    .digest("hex");
}

export function computeRegistryDigest(snapshot: LocalClientRegistry | UnknownRecord): string {
  return createHash("sha256")
    .update("local-client-signed-registry-checkpoint-v1\0", "utf8")
    .update(canonicalRegistryJson(snapshot), "utf8")
    .digest("hex");
}

export function isRegistryGeneration(value: unknown, allowZero: boolean): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && (allowZero ? value >= 0 : value > 0);
}

export function incrementRegistryGeneration(value: unknown): number {
  if (!isRegistryGeneration(value, true) || value >= Number.MAX_SAFE_INTEGER) {
    throw createError(
      "local_client_registry_generation_exhausted",
      "The signed local-client registry generation cannot be incremented safely.",
      { statusCode: 503, category: "integrity" },
    );
  }
  return value + 1;
}

export function canonicalRegistryJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite registry value");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalRegistryJson).join(",")}]`;
  if (!isRecord(value)) throw new Error("unsupported registry value");
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalRegistryJson(value[key])}`
  )).join(",")}}`;
}


export async function saveJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await chmod(dirname(filePath), 0o700).catch(() => undefined);
  const serial = JSON.stringify(data, null, 2);
  const tmpPath = `${filePath}.tmp`;
  const handle = await open(tmpPath, "w", 0o600);
  try {
    await handle.writeFile(serial, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(tmpPath, filePath);
  await chmod(filePath, 0o600).catch(() => undefined);
  const directoryHandle = await open(dirname(filePath), "r").catch(() => null);
  if (directoryHandle) {
    try {
      await directoryHandle.sync().catch(() => undefined);
    } finally {
      await directoryHandle.close();
    }
  }
}

export async function appendLogEntry(filePath: string, entry: UnknownRecord): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await chmod(dirname(filePath), 0o700).catch(() => undefined);
  const line = `${JSON.stringify(entry)}\n`;
  await appendFile(filePath, line, "utf8");
  await chmod(filePath, 0o600).catch(() => undefined);
}
