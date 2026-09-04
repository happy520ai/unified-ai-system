/**
 * Integrity primitives for the agent governance control plane.
 *
 * Pure functions over node:crypto — no filesystem, no clock. All hashing is
 * SHA-256 over a stable canonical JSON form so that equivalent policy
 * objects always produce identical hashes across processes and platforms.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type {
  AgentPolicyManifest,
  AgentRegistryRecord,
  EffectiveAgentPolicy,
  PolicyLayerContent,
} from "@unified-ai-system/shared-contracts";

const POLICY_HASH_PREFIX = "sha256";
const SIGNATURE_PREFIX = "hmac-sha256";
const MANIFEST_SIGNATURE_DOMAIN = "unified-ai/agent-governance-manifest/v2";

/** Canonical JSON: object keys sorted, arrays order-preserving, undefined dropped. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value === undefined ? null : value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

type PolicyWithoutHash = Omit<EffectiveAgentPolicy, "policyHash">;

/** Hash of the compiled policy content (every field except the hash itself). */
export function computePolicyHash(policy: PolicyWithoutHash): string {
  return `${POLICY_HASH_PREFIX}:${sha256Hex(stableStringify(policy))}`;
}

/** Hash of an immutable policy-layer content document. */
export function computePolicyContentHash(content: PolicyLayerContent): string {
  return `${POLICY_HASH_PREFIX}:${sha256Hex(stableStringify(content))}`;
}

/**
 * Hash over the complete persisted registry record. Binding every field is
 * intentional: tenant, ancestry, grants, policy linkage and lifecycle state
 * are all authorization-relevant and must not be mutable without re-signing.
 */
export function computeAgentHash(agent: AgentRegistryRecord): string {
  return `${POLICY_HASH_PREFIX}:${sha256Hex(stableStringify(agent))}`;
}

/** Hash that locks the exact arguments of an approval request. */
export function computeArgumentsHash(args: unknown): string {
  return `${POLICY_HASH_PREFIX}:${sha256Hex(stableStringify(args === undefined ? null : args))}`;
}

/** Hash of the immutable per-Agent inheritance and instance-rule delta. */
export function computePolicyDeltaHash(delta: unknown): string {
  return `${POLICY_HASH_PREFIX}:${sha256Hex(stableStringify(delta === undefined ? null : delta))}`;
}

function hmacHex(secret: string | Uint8Array, input: string): string {
  return createHmac("sha256", secret).update(input, "utf8").digest("hex");
}

function isNonEmptySecret(secret: unknown): secret is string | Uint8Array {
  return (typeof secret === "string" && secret.length > 0)
    || (secret instanceof Uint8Array && secret.byteLength > 0);
}

function isSha256Digest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);
}

export function buildManifest(input: {
  agentId: string;
  agentHash: string;
  policyHash: string;
  deltaHash: string;
  compiledAt: string;
  secret: string | Uint8Array;
}): AgentPolicyManifest {
  if (!isNonEmptySecret(input.secret)) throw new TypeError("Manifest secret must not be empty.");
  if (typeof input.agentId !== "string" || input.agentId.trim() === "") {
    throw new TypeError("Manifest agentId must be a non-empty string.");
  }
  if (!isSha256Digest(input.agentHash) || !isSha256Digest(input.policyHash)
    || !isSha256Digest(input.deltaHash)) {
    throw new TypeError("Manifest agent, policy and delta hashes must be canonical SHA-256 digests.");
  }
  if (typeof input.compiledAt !== "string" || !Number.isFinite(Date.parse(input.compiledAt))) {
    throw new TypeError("Manifest compiledAt must be a valid ISO timestamp.");
  }
  return {
    agentId: input.agentId,
    agentHash: input.agentHash,
    policyHash: input.policyHash,
    deltaHash: input.deltaHash,
    signature: signManifestInput(input.agentHash, input.policyHash, input.deltaHash, input.secret),
    compiledAt: input.compiledAt,
  };
}

function signManifestInput(
  agentHash: string,
  policyHash: string,
  deltaHash: string,
  secret: string | Uint8Array,
): string {
  return `${SIGNATURE_PREFIX}:${hmacHex(
    secret,
    `${MANIFEST_SIGNATURE_DOMAIN}\n${agentHash}:${policyHash}:${deltaHash}`,
  )}`;
}

function safeEqualHex(left: unknown, right: unknown): boolean {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const leftHex = left.replace(/^hmac-sha256:/u, "");
  const rightHex = right.replace(/^hmac-sha256:/u, "");
  if (!/^[a-f0-9]{64}$/u.test(leftHex) || !/^[a-f0-9]{64}$/u.test(rightHex)) return false;
  try {
    return timingSafeEqual(Buffer.from(leftHex, "hex"), Buffer.from(rightHex, "hex"));
  } catch {
    return false;
  }
}

/** Constant-time manifest signature verification. */
export function verifyManifestSignature(
  manifest: AgentPolicyManifest | unknown,
  secret: string | Uint8Array,
): boolean {
  if (!manifest || typeof manifest !== "object" || !isNonEmptySecret(secret)) return false;
  const candidate = manifest as Record<string, unknown>;
  if (!isSha256Digest(candidate.agentHash) || !isSha256Digest(candidate.policyHash)
    || !isSha256Digest(candidate.deltaHash)) return false;
  if (typeof candidate.signature !== "string" || !/^hmac-sha256:[a-f0-9]{64}$/u.test(candidate.signature)) {
    return false;
  }
  try {
    const expected = signManifestInput(candidate.agentHash, candidate.policyHash, candidate.deltaHash, secret);
    return safeEqualHex(candidate.signature, expected);
  } catch {
    return false;
  }
}

export interface EffectivePolicyIntegrityResult {
  ok: boolean;
  reason?: string;
}

/**
 * Full runtime integrity check for a loaded effective policy:
 * recomputed hash must equal the stored hash and the manifest's hash, and
 * the manifest signature must verify under the governance secret. Any
 * mismatch means the policy bytes were tampered with after compilation.
 */
export function verifyEffectivePolicyIntegrity(
  policy: EffectiveAgentPolicy | unknown,
  manifest: AgentPolicyManifest | unknown,
  secret: string | Uint8Array,
  currentAgent: AgentRegistryRecord | null | undefined,
  policyDelta: unknown,
  options: { requireActive?: boolean } = {},
): EffectivePolicyIntegrityResult {
  if (!policy || typeof policy !== "object") {
    return { ok: false, reason: "POLICY_MISSING" };
  }
  if (!manifest || typeof manifest !== "object") {
    return { ok: false, reason: "MANIFEST_MISSING" };
  }
  if (!currentAgent || typeof currentAgent !== "object") {
    return { ok: false, reason: "CURRENT_AGENT_REQUIRED" };
  }
  if (policyDelta === undefined || policyDelta === null || typeof policyDelta !== "object") {
    return { ok: false, reason: "POLICY_DELTA_REQUIRED" };
  }
  const typedPolicy = policy as EffectiveAgentPolicy;
  const typedManifest = manifest as AgentPolicyManifest;
  if (typedManifest.agentId !== typedPolicy.agentId) {
    return { ok: false, reason: "MANIFEST_AGENT_MISMATCH" };
  }
  if (currentAgent.agentId !== typedPolicy.agentId) {
    return { ok: false, reason: "REGISTRY_AGENT_MISMATCH" };
  }
  if (options.requireActive !== false && currentAgent.status !== "ACTIVE") {
    return { ok: false, reason: "AGENT_NOT_ACTIVE" };
  }
  let recomputed: string;
  let currentAgentHash: string;
  try {
    const { policyHash: _storedHash, ...policyContent } = typedPolicy;
    recomputed = computePolicyHash(policyContent as PolicyWithoutHash);
    currentAgentHash = computeAgentHash(currentAgent);
  } catch {
    return { ok: false, reason: "INTEGRITY_INPUT_MALFORMED" };
  }
  if (recomputed !== typedPolicy.policyHash) {
    return { ok: false, reason: "POLICY_HASH_MISMATCH" };
  }
  if (typedManifest.policyHash !== typedPolicy.policyHash) {
    return { ok: false, reason: "MANIFEST_HASH_MISMATCH" };
  }
  if (!isSha256Digest(typedManifest.deltaHash)) {
    return { ok: false, reason: "MANIFEST_DELTA_HASH_MISSING" };
  }
  let currentDeltaHash: string;
  try {
    currentDeltaHash = computePolicyDeltaHash(policyDelta);
  } catch {
    return { ok: false, reason: "POLICY_DELTA_MALFORMED" };
  }
  if (typedManifest.deltaHash !== currentDeltaHash) {
    return { ok: false, reason: "MANIFEST_DELTA_HASH_MISMATCH" };
  }
  if (currentAgent.policyHash !== typedPolicy.policyHash) {
    return { ok: false, reason: "REGISTRY_POLICY_HASH_MISMATCH" };
  }
  if (typedManifest.agentHash !== currentAgentHash) {
    return { ok: false, reason: "MANIFEST_AGENT_HASH_MISMATCH" };
  }
  if (typedManifest.compiledAt !== typedPolicy.compiledAt) {
    return { ok: false, reason: "MANIFEST_COMPILED_AT_MISMATCH" };
  }
  if (!verifyManifestSignature(typedManifest, secret)) {
    return { ok: false, reason: "MANIFEST_SIGNATURE_INVALID" };
  }
  return { ok: true };
}
