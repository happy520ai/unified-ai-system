import { createHash } from "node:crypto";

const HASH_FIELDS = Object.freeze([
  "version",
  "title",
  "capabilityTags",
  "inputContract",
  "outputContract",
  "deps",
  "riskLevel",
  "allowedEffects",
  "requiresProvider",
  "requiresSecret",
  "supportsDryRun",
]);

export function buildCapabilityAtomHashInput(atom) {
  const input = {};
  for (const field of HASH_FIELDS) {
    input[field] = normalizeForHash(atom[field]);
  }
  return input;
}

export function computeCapabilityAtomId(atom) {
  const hashInput = JSON.stringify(buildCapabilityAtomHashInput(atom));
  return `atom_${createHash("sha256").update(hashInput).digest("hex").slice(0, 20)}`;
}

export function verifyCapabilityAtomIds(atoms) {
  const results = atoms.map((atom) => {
    const expectedAtomId = computeCapabilityAtomId(atom);
    return {
      title: atom.title,
      atomId: atom.atomId,
      expectedAtomId,
      verified: atom.atomId === expectedAtomId,
    };
  });
  return {
    atomIdVerified: results.every((item) => item.verified),
    atomIdMismatchCount: results.filter((item) => !item.verified).length,
    results,
  };
}

function normalizeForHash(value) {
  if (Array.isArray(value)) return value.map(normalizeForHash).sort(compareStable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalizeForHash(value[key])]));
  }
  return value;
}

function compareStable(left, right) {
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}
