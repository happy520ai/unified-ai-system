import {
  createLocalSkillRegistry,
  listLocalSkillRegistryEntries,
  getLocalSkillRegistryEntry,
  runLocalSkillRegistryDryRun,
} from "../src/index.js";

const registry = createLocalSkillRegistry();
const entries = listLocalSkillRegistryEntries(registry);
const dryRun = runLocalSkillRegistryDryRun();
const sample = getLocalSkillRegistryEntry(registry, "mock.summarize.preview");

const requiredFields = [
  "skillId",
  "atomId",
  "capability",
  "backend",
  "status",
  "riskLevel",
  "revoked",
  "evidenceRef",
];

const checks = [
  ["exports_create_registry", typeof createLocalSkillRegistry === "function"],
  ["exports_list_entries", typeof listLocalSkillRegistryEntries === "function"],
  ["exports_get_entry", typeof getLocalSkillRegistryEntry === "function"],
  ["exports_run_dry_run", typeof runLocalSkillRegistryDryRun === "function"],
  ["registry_has_mock_entries", Array.isArray(entries) && entries.length >= 2],
  ["all_required_fields_present", entries.every((entry) => requiredFields.every((field) => Object.hasOwn(entry, field)))],
  ["all_skills_are_mock", entries.every((entry) => entry.status === "mock-only" && entry.skillId.startsWith("mock."))],
  ["no_external_model_registered", dryRun.realExternalModelRegistered === false],
  ["provider_not_connected", dryRun.providerConnected === false],
  ["provider_not_called", dryRun.providerCallsMade === false],
  ["secret_not_read", dryRun.secretRead === false],
  ["sample_lookup_works", sample?.skillId === "mock.summarize.preview"],
  ["revoked_flag_boolean", entries.every((entry) => typeof entry.revoked === "boolean")],
  ["evidence_ref_present", entries.every((entry) => typeof entry.evidenceRef === "string" && entry.evidenceRef.includes("phase1314a"))],
  ["entries_are_frozen", Object.isFrozen(entries) && entries.every((entry) => Object.isFrozen(entry))],
];

const failed = checks.filter(([, passed]) => passed !== true);
if (failed.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    failed: failed.map(([id]) => id),
  }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: "passed",
    phase: "Phase1314A",
    registryEntryCount: entries.length,
    mockOnly: dryRun.mockOnly,
    providerCallsMade: dryRun.providerCallsMade,
  }, null, 2));
}
