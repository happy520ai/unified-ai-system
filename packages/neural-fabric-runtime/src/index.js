import { canonicalize, normalizeForCanonicalJson } from "./canonicalize.js";
import { contentAddress } from "./contentAddress.js";
import { runAtomContentAddressDryRun } from "./atomContentAddressDryRun.js";
import { runNeuralOpDryRun } from "./neuralOpDryRun.js";
import { runWorkforceRouterDryRun } from "./routerDryRun.js";
import {
  createRevocationLedger,
  evaluateRevocationCandidate,
  runRevocationLedgerDryRun,
} from "./revocationLedgerDryRun.js";
import {
  createLocalSkillRegistry,
  getLocalSkillRegistryEntry,
  listLocalSkillRegistryEntries,
  runLocalSkillRegistryDryRun,
} from "./skillRegistry.js";
import { runWorkerIsolationDryRun } from "./workerIsolationDryRun.js";

export {
  canonicalize,
  contentAddress,
  createLocalSkillRegistry,
  createRevocationLedger,
  evaluateRevocationCandidate,
  getLocalSkillRegistryEntry,
  listLocalSkillRegistryEntries,
  normalizeForCanonicalJson,
  runAtomContentAddressDryRun,
  runLocalSkillRegistryDryRun,
  runNeuralOpDryRun,
  runRevocationLedgerDryRun,
  runWorkforceRouterDryRun,
  runWorkerIsolationDryRun,
};

export function loadManifest(input) {
  const manifest = parseManifestInput(input);
  const normalized = deepFreeze(normalizeForCanonicalJson(manifest));
  return Object.freeze({
    manifest: normalized,
    canonical: canonicalize(normalized),
    contentAddress: contentAddress(normalized),
  });
}

function parseManifestInput(input) {
  if (typeof input === "string") {
    return JSON.parse(input);
  }
  if (input && typeof input === "object") {
    return input;
  }
  throw new TypeError("Manifest input must be a JSON string or object.");
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}
