import { contentAddress } from "./contentAddress.js";

const MOCK_SKILL_ENTRIES = Object.freeze([
  Object.freeze({
    skillId: "mock.summarize.preview",
    atomId: "atom.mock.summary.v1",
    capability: "summarize",
    backend: "mock-local",
    status: "mock-only",
    riskLevel: "low",
    revoked: false,
    evidenceRef: "apps/ai-gateway-service/evidence/phase1314a/local-skill-registry-result.json#mock.summarize.preview",
  }),
  Object.freeze({
    skillId: "mock.route.selector",
    atomId: "atom.mock.router.v1",
    capability: "route-select",
    backend: "mock-local",
    status: "mock-only",
    riskLevel: "low",
    revoked: false,
    evidenceRef: "apps/ai-gateway-service/evidence/phase1314a/local-skill-registry-result.json#mock.route.selector",
  }),
  Object.freeze({
    skillId: "mock.revoked.fixture",
    atomId: "atom.mock.revoked.v1",
    capability: "negative-control",
    backend: "mock-local",
    status: "mock-only",
    riskLevel: "medium",
    revoked: true,
    evidenceRef: "apps/ai-gateway-service/evidence/phase1314a/local-skill-registry-result.json#mock.revoked.fixture",
  }),
]);

export function createLocalSkillRegistry({ entries = MOCK_SKILL_ENTRIES } = {}) {
  const normalizedEntries = entries.map(validateSkillEntry).map((entry) => Object.freeze({ ...entry }));
  const skillIds = new Set();

  for (const entry of normalizedEntries) {
    if (skillIds.has(entry.skillId)) {
      throw new TypeError(`Duplicate skillId in local registry: ${entry.skillId}`);
    }
    skillIds.add(entry.skillId);
  }

  return Object.freeze({
    schemaVersion: "phase1314a.local-skill-registry.v1",
    scope: "mock-skills-only",
    entries: Object.freeze(normalizedEntries),
    registryAddress: contentAddress(normalizedEntries),
    safety: Object.freeze({
      realExternalModelRegistered: false,
      providerConnected: false,
      providerCallsMade: false,
      secretRead: false,
      networkUsed: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
    }),
  });
}

export function listLocalSkillRegistryEntries(registry = createLocalSkillRegistry()) {
  return Object.freeze(registry.entries.map((entry) => Object.freeze({ ...entry })));
}

export function getLocalSkillRegistryEntry(registry = createLocalSkillRegistry(), skillId) {
  if (typeof skillId !== "string" || skillId.trim().length === 0) {
    throw new TypeError("skillId must be a non-empty string.");
  }
  const entry = registry.entries.find((candidate) => candidate.skillId === skillId);
  return entry ? Object.freeze({ ...entry }) : null;
}

export function runLocalSkillRegistryDryRun() {
  const registry = createLocalSkillRegistry();
  const entries = listLocalSkillRegistryEntries(registry);
  const requiredFields = ["skillId", "atomId", "capability", "backend", "status", "riskLevel", "revoked", "evidenceRef"];

  return Object.freeze({
    phase: "Phase1314A",
    status: "dry-run-pass",
    registrySchemaVersion: registry.schemaVersion,
    registryAddress: registry.registryAddress,
    registryEntryCount: entries.length,
    entries,
    requiredFieldsPresent: entries.every((entry) => requiredFields.every((field) => Object.hasOwn(entry, field))),
    mockOnly: entries.every((entry) => entry.status === "mock-only" && entry.backend === "mock-local" && entry.skillId.startsWith("mock.")),
    revokedSkillCount: entries.filter((entry) => entry.revoked === true).length,
    activeSkillCount: entries.filter((entry) => entry.revoked === false).length,
    realExternalModelRegistered: false,
    providerConnected: false,
    providerCallsMade: false,
    secretRead: false,
    secretValueExposed: false,
    networkUsed: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
  });
}

function validateSkillEntry(entry) {
  const requiredStringFields = ["skillId", "atomId", "capability", "backend", "status", "riskLevel", "evidenceRef"];
  for (const field of requiredStringFields) {
    if (typeof entry?.[field] !== "string" || entry[field].trim().length === 0) {
      throw new TypeError(`${field} must be a non-empty string.`);
    }
  }
  if (typeof entry.revoked !== "boolean") {
    throw new TypeError("revoked must be a boolean.");
  }
  if (!entry.skillId.startsWith("mock.") || entry.status !== "mock-only" || entry.backend !== "mock-local") {
    throw new TypeError("Phase1314A registry accepts mock-only local skills.");
  }
  return entry;
}
