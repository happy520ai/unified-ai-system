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
  EffectiveAgentPolicy,
} from "@unified-ai-system/shared-contracts";

const POLICY_HASH_PREFIX = "sha256";
const SIGNATURE_PREFIX = "hmac-sha256";
const MANIFEST_SIGNATURE_DOMAIN = "unified-ai/agent-governance-manifest/v1";

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

/** Identity hash over the immutable registry fields of an agent. */
export function computeAgentHash(agent: {
  agentId: string;
  name: string;
  purpose: string;
  tenantId: string;
  ownerUserId: string;
  parentAgentId: string | null;
  generationDepth: number;
  classification: { family: string; domain: string; subclass: string };
  traits: string[];
  riskLevel: string;
  status: string;
  expiresAt: string;
}): string {
  return `${POLICY_HASH_PREFIX}:${sha256Hex(stableStringify(agent))}`;
}

/** Hash that locks the exact arguments of an approval request. */
export function computeArgumentsHash(args: unknown): string {
  return `${POLICY_HASH_PREFIX}:${sha256Hex(stableStringify(args === undefined ? null : args))}`;
}

function hmacHex(secret: string | Uint8Array, input: string): string {
  return createHmac("sha256", secret).update(input, "utf8").digest("hex");
}

export function buildManifest(input: {
  agentId: string;
  agentHash: string;
  policyHash: string;
  compiledAt: string;
  secret: string | Uint8Array;
}): AgentPolicyManifest {
  return {
    agentId: input.agentId,
    agentHash: input.agentHash,
    policyHash: input.policyHash,
    signature: signManifestInput(input.agentHash, input.policyHash, input.secret),
    compiledAt: input.compiledAt,
  };
}

function signManifestInput(agentHash: string, policyHash: string, secret: string | Uint8Array): string {
  return `${SIGNATURE_PREFIX}:${hmacHex(secret, `${MANIFEST_SIGNATURE_DOMAIN}\n${agentHash}:${policyHash}`)}`;
}

function safeEqualHex(left: string, right: string): boolean {
  const leftHex = left.replace(/^hmac-sha256:/u, "");
  const rightHex = right.replace(/^hmac-sha256:/u, "");
  if (leftHex.length !== rightHex.length || leftHex.length !== 64) return false;
  try {
    return timingSafeEqual(Buffer.from(leftHex, "hex"), Buffer.from(rightHex, "hex"));
  } catch {
    return false;
  }
}

/** Constant-time manifest signature verification. */
export function verifyManifestSignature(
  manifest: AgentPolicyManifest,
  secret: string | Uint8Array,
): boolean {
  if (!manifest || typeof manifest !== "object") return false;
  const expected = signManifestInput(manifest.agentHash, manifest.policyHash, secret);
  return safeEqualHex(manifest.signature ?? "", expected);
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
  policy: EffectiveAgentPolicy,
  manifest: AgentPolicyManifest,
  secret: string | Uint8Array,
): EffectivePolicyIntegrityResult {
  if (!policy || typeof policy !== "object") {
    return { ok: false, reason: "POLICY_MISSING" };
  }
  if (!manifest || typeof manifest !== "object") {
    return { ok: false, reason: "MANIFEST_MISSING" };
  }
  if (manifest.agentId !== policy.agentId) {
    return { ok: false, reason: "MANIFEST_AGENT_MISMATCH" };
  }
  const { policyHash: _storedHash, ...policyContent } = policy;
  const recomputed = computePolicyHash(policyContent as PolicyWithoutHash);
  if (recomputed !== policy.policyHash) {
    return { ok: false, reason: "POLICY_HASH_MISMATCH" };
  }
  if (manifest.policyHash !== policy.policyHash) {
    return { ok: false, reason: "MANIFEST_HASH_MISMATCH" };
  }
  if (manifest.compiledAt !== policy.compiledAt) {
    return { ok: false, reason: "MANIFEST_COMPILED_AT_MISMATCH" };
  }
  if (!verifyManifestSignature(manifest, secret)) {
    return { ok: false, reason: "MANIFEST_SIGNATURE_INVALID" };
  }
  return { ok: true };
}
