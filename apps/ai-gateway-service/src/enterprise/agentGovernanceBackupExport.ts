import { createHash } from "node:crypto";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { stableStringify } from "@unified-ai-system/policy-engine";
import type { AgentRegistryRecord } from "@unified-ai-system/shared-contracts";

const SCHEMA_VERSION = 1 as const;
const MAX_COMPONENT_FILE_BYTES = 64 * 1024 * 1024;
const MAX_BUNDLE_FILE_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;
const MAX_AGENT_DIRECTORIES = 10_000;
const AGENT_ID_PATTERN = /^agt_[A-Za-z0-9_-]{1,128}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const TRANSIENT_TOP_LEVEL_NAMES = new Set([
  "agent-generation.journal.json",
  "policy-activation.journal.json",
  "governance-state.journal.json",
]);
const CANONICAL_FILES = Object.freeze({
  registry: "agents.json",
  policies: "policies.json",
  approvals: "approvals.json",
  usage: "usage.json",
  audit: "audit-events.jsonl",
});
const INTEGRITY_FILES = Object.freeze([
  "governance-state.anchor.json",
  "governance-state.checkpoint.json",
  "governance-state.installation.json",
]);
const BUNDLE_FILES = new Set([
  "agent.json",
  "policy-delta.json",
  "effective-policy.json",
  "manifest.json",
  "audit.ndjson",
]);
const REQUIRED_REGISTERED_BUNDLE_FILES = [
  "agent.json",
  "policy-delta.json",
  "effective-policy.json",
  "manifest.json",
];

type GovernanceHealth = {
  ready?: boolean;
  startupRecovery?: string;
  stateIntegrity?: string;
  auditIntegrity?: string;
};

type GovernanceSource = {
  dataDir: string;
  service: {
    checkHealth(): Promise<GovernanceHealth>;
    verifyAllAgentBundles(): Promise<{ verifiedAgentCount: number }>;
  };
  registryStore?: {
    listAll(): Promise<AgentRegistryRecord[]>;
    getHealth?(): { storageMode?: string; available?: boolean };
  } | null;
} | null | undefined;

export type GovernanceBackupComponent = Readonly<{
  present: boolean;
  recordCount: number;
  fileCount: number;
  byteSize: number;
  digest: string;
  source: "anchored-file" | "logical-query" | "agent-bundles" | "integrity-heads";
}>;

export type AgentGovernanceBackupExport = Readonly<{
  schemaVersion: 1;
  enabled: boolean;
  included: boolean;
  mode: "disabled" | "platform-tenant-required" | "read-only-consistency-export";
  generatedAt: string;
  restoreMode: "verify-only";
  restorable: false;
  mutation: "none";
  reason: null | "agent_governance_disabled" | "platform_tenant_required";
  consistency: "not_applicable" | "double-read-stable";
  registryStorage: "not_applicable" | "single-process-json" | "single-host-sqlite-logical-query" | "central-postgres-logical-query";
  excluded: Readonly<{
    secretMaterial: true;
    ownerLease: true;
    transientWal: true;
    sqliteDatabaseBytes: true;
  }>;
  components?: Readonly<{
    registry: GovernanceBackupComponent;
    policies: GovernanceBackupComponent;
    approvals: GovernanceBackupComponent;
    usage: GovernanceBackupComponent;
    audit: GovernanceBackupComponent;
    agentBundles: GovernanceBackupComponent;
    integrityHeads: GovernanceBackupComponent;
  }>;
  aggregateDigest?: string;
}>;

export type AgentGovernanceBackupValidation = Readonly<{
  valid: boolean;
  included: boolean;
  restoreMode: "verify-only";
  restorable: false;
  mutation: "none";
  blockers: string[];
  warnings: string[];
  componentCount: number;
}>;

export function createAgentGovernanceBackupExporter(options: {
  governance?: GovernanceSource;
  platformTenantId: string;
  now?: () => string;
}) {
  const governance = options.governance;
  const platformTenantId = normalizeTenant(options.platformTenantId);
  const now = options.now ?? (() => new Date().toISOString());

  return Object.freeze({
    async exportSummary(input: { tenantId: string }): Promise<AgentGovernanceBackupExport> {
      const tenantId = normalizeTenant(input?.tenantId);
      const generatedAt = safeTimestamp(now);
      if (!governance) return excludedExport("disabled", generatedAt, "agent_governance_disabled");
      if (tenantId !== platformTenantId) {
        return excludedExport("platform-tenant-required", generatedAt, "platform_tenant_required", true);
      }

      const firstVerification = await assertGovernanceHealthy(governance);
      const first = await collectSnapshot(governance);
      const secondVerification = await assertGovernanceHealthy(governance);
      const second = await collectSnapshot(governance);
      if (first.aggregateDigest !== second.aggregateDigest
        || firstVerification.verifiedAgentCount !== first.components.registry.recordCount
        || secondVerification.verifiedAgentCount !== second.components.registry.recordCount
        || firstVerification.verifiedAgentCount !== secondVerification.verifiedAgentCount) {
        throw backupError(
          "AGENT_GOVERNANCE_BACKUP_STATE_CHANGED",
          "Agent Governance state changed during consistency export; retry after mutations drain.",
          409,
        );
      }
      const summary: AgentGovernanceBackupExport = Object.freeze({
        schemaVersion: SCHEMA_VERSION,
        enabled: true,
        included: true,
        mode: "read-only-consistency-export",
        generatedAt,
        restoreMode: "verify-only",
        restorable: false,
        mutation: "none",
        reason: null,
        consistency: "double-read-stable",
        registryStorage: second.registryStorage,
        excluded: excludedFields(),
        components: second.components,
        aggregateDigest: second.aggregateDigest,
      });
      const validation = validateAgentGovernanceBackupExport(summary);
      if (!validation.valid) throw backupError(
        "AGENT_GOVERNANCE_BACKUP_SUMMARY_INVALID",
        "Agent Governance consistency summary failed self-validation.",
        500,
      );
      return summary;
    },
  });
}

export function validateAgentGovernanceBackupExport(
  input: unknown,
): AgentGovernanceBackupValidation {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(input) || input.schemaVersion !== SCHEMA_VERSION
    || input.restoreMode !== "verify-only" || input.restorable !== false || input.mutation !== "none"
    || typeof input.generatedAt !== "string" || !Number.isFinite(Date.parse(input.generatedAt))
    || !hasOnlyKeys(input, [
      "schemaVersion", "enabled", "included", "mode", "generatedAt", "restoreMode", "restorable",
      "mutation", "reason", "consistency", "registryStorage", "excluded", "components", "aggregateDigest",
    ])) {
    return validation(false, false, ["agent_governance_summary_schema_invalid"], [], 0);
  }
  if (input.included !== true) {
    if (Object.hasOwn(input, "components") || Object.hasOwn(input, "aggregateDigest")) {
      blockers.push("agent_governance_summary_schema_invalid");
    }
    if (input.enabled === true && input.mode === "platform-tenant-required"
      && input.reason === "platform_tenant_required" && input.consistency === "not_applicable"
      && input.registryStorage === "not_applicable" && validExcluded(input.excluded)) {
      warnings.push("agent_governance_export_requires_platform_tenant");
    } else if (input.enabled !== false || input.mode !== "disabled"
      || input.reason !== "agent_governance_disabled" || input.consistency !== "not_applicable"
      || input.registryStorage !== "not_applicable" || !validExcluded(input.excluded)) {
      blockers.push("agent_governance_summary_schema_invalid");
    }
    return validation(blockers.length === 0, false, blockers, warnings, 0);
  }
  if (input.enabled !== true || input.mode !== "read-only-consistency-export"
    || input.reason !== null
    || input.consistency !== "double-read-stable"
    || (input.registryStorage !== "single-process-json"
      && input.registryStorage !== "single-host-sqlite-logical-query"
      && input.registryStorage !== "central-postgres-logical-query")
    || !validExcluded(input.excluded) || !isRecord(input.components)
    || typeof input.aggregateDigest !== "string" || !SHA256_PATTERN.test(input.aggregateDigest)) {
    blockers.push("agent_governance_summary_schema_invalid");
    return validation(false, true, blockers, warnings, 0);
  }
  const componentNames = [
    "registry", "policies", "approvals", "usage", "audit", "agentBundles", "integrityHeads",
  ];
  if (!hasOnlyKeys(input.components, componentNames)) {
    blockers.push("agent_governance_summary_schema_invalid");
  }
  for (const name of componentNames) {
    if (!validComponent(input.components[name])) blockers.push(`agent_governance_component_invalid:${name}`);
  }
  if (blockers.length === 0) {
    const expected = aggregateDigest(
      input.registryStorage as AgentGovernanceBackupExport["registryStorage"],
      input.components as AgentGovernanceBackupExport["components"],
    );
    if (expected !== input.aggregateDigest) blockers.push("agent_governance_aggregate_digest_mismatch");
  }
  warnings.push("agent_governance_restore_is_verify_only");
  return validation(blockers.length === 0, true, blockers, warnings, componentNames.length);
}

async function collectSnapshot(governance: NonNullable<GovernanceSource>): Promise<{
  registryStorage: "single-process-json" | "single-host-sqlite-logical-query" | "central-postgres-logical-query";
  components: NonNullable<AgentGovernanceBackupExport["components"]>;
  aggregateDigest: string;
}> {
  const dataDir = resolve(governance.dataDir);
  await assertSafeRoot(dataDir);
  await assertNoTransientState(dataDir);

  let totalBytes = 0;
  const addBytes = (bytes: number) => {
    totalBytes += bytes;
    if (totalBytes > MAX_TOTAL_BYTES) throw backupError(
      "AGENT_GOVERNANCE_BACKUP_CAPACITY_EXCEEDED",
      "Agent Governance consistency export exceeds its bounded byte capacity.",
      413,
    );
  };

  let registryRecords: AgentRegistryRecord[];
  let registry: GovernanceBackupComponent;
  let registryStorage: "single-process-json" | "single-host-sqlite-logical-query" | "central-postgres-logical-query";
  if (governance.registryStore) {
    const health = governance.registryStore.getHealth?.();
    if (health && health.available !== true) throw backupError(
      "AGENT_GOVERNANCE_BACKUP_REGISTRY_UNAVAILABLE",
      "The logical SQLite Agent Registry snapshot is unavailable.",
      503,
    );
    registryRecords = await governance.registryStore.listAll();
    const canonical = Buffer.from(stableStringify([...registryRecords]
      .sort((left, right) => left.agentId.localeCompare(right.agentId))), "utf8");
    addBytes(canonical.byteLength);
    registry = componentFromEntries("logical-query", [{ name: "registry", bytes: canonical }], registryRecords.length);
    registryStorage = health?.storageMode === "central-postgres"
      ? "central-postgres-logical-query"
      : "single-host-sqlite-logical-query";
  } else {
    const registryBytes = await readOptionalSafeFile(join(dataDir, CANONICAL_FILES.registry), dataDir, MAX_COMPONENT_FILE_BYTES);
    addBytes(registryBytes?.byteLength ?? 0);
    registryRecords = parseRegistryRecords(registryBytes);
    registry = componentFromEntries(
      "anchored-file",
      registryBytes ? [{ name: CANONICAL_FILES.registry, bytes: registryBytes }] : [],
      registryRecords.length,
    );
    registryStorage = "single-process-json";
  }

  const policies = await jsonFileComponent(dataDir, CANONICAL_FILES.policies, "policies", addBytes);
  const approvals = await jsonFileComponent(dataDir, CANONICAL_FILES.approvals, "approvals", addBytes);
  const usage = await jsonFileComponent(dataDir, CANONICAL_FILES.usage, "usage", addBytes);
  const audit = await auditFileComponent(dataDir, addBytes);
  const agentBundles = await bundleComponent(dataDir, new Set(registryRecords.map((record) => record.agentId)), addBytes);
  const integrityHeads = await integrityComponent(dataDir, addBytes);
  const components = Object.freeze({ registry, policies, approvals, usage, audit, agentBundles, integrityHeads });
  return {
    registryStorage,
    components,
    aggregateDigest: aggregateDigest(registryStorage, components),
  };
}

async function jsonFileComponent(
  dataDir: string,
  fileName: string,
  collectionKey: string,
  addBytes: (bytes: number) => void,
): Promise<GovernanceBackupComponent> {
  const bytes = await readOptionalSafeFile(join(dataDir, fileName), dataDir, MAX_COMPONENT_FILE_BYTES);
  addBytes(bytes?.byteLength ?? 0);
  let recordCount = 0;
  if (bytes) {
    const parsed = parseJsonObject(bytes, fileName);
    const collection = parsed[collectionKey];
    if (!isRecord(collection)) throw backupError(
      "AGENT_GOVERNANCE_BACKUP_STATE_INVALID",
      `Agent Governance ${fileName} has no valid ${collectionKey} collection.`,
      409,
    );
    recordCount = Object.keys(collection).length;
  }
  return componentFromEntries("anchored-file", bytes ? [{ name: fileName, bytes }] : [], recordCount);
}

async function auditFileComponent(dataDir: string, addBytes: (bytes: number) => void) {
  const fileName = CANONICAL_FILES.audit;
  const bytes = await readOptionalSafeFile(join(dataDir, fileName), dataDir, MAX_COMPONENT_FILE_BYTES);
  addBytes(bytes?.byteLength ?? 0);
  const recordCount = bytes
    ? bytes.toString("utf8").split("\n").filter((line) => line.trim() !== "").length
    : 0;
  return componentFromEntries("anchored-file", bytes ? [{ name: fileName, bytes }] : [], recordCount);
}

async function integrityComponent(dataDir: string, addBytes: (bytes: number) => void) {
  const entries: Array<{ name: string; bytes: Buffer }> = [];
  for (const fileName of INTEGRITY_FILES) {
    const bytes = await readOptionalSafeFile(join(dataDir, fileName), dataDir, MAX_COMPONENT_FILE_BYTES);
    if (bytes) {
      addBytes(bytes.byteLength);
      entries.push({ name: fileName, bytes });
    }
  }
  return componentFromEntries("integrity-heads", entries, entries.length);
}

async function bundleComponent(
  dataDir: string,
  registeredIds: Set<string>,
  addBytes: (bytes: number) => void,
): Promise<GovernanceBackupComponent> {
  const agentsRoot = join(dataDir, "agents");
  const rootStats = await safeLstat(agentsRoot);
  if (!rootStats) return componentFromEntries("agent-bundles", [], 0);
  await assertSafeDirectory(agentsRoot, dataDir);
  const directories = await readdir(agentsRoot, { withFileTypes: true });
  const staging = directories.find((entry) => entry.name === ".bundle-staging");
  if (staging) {
    if (!staging.isDirectory() || staging.isSymbolicLink()) throw unsafeFileError();
    const stagingPath = join(agentsRoot, staging.name);
    await assertSafeDirectory(stagingPath, dataDir);
    const stagedEntries = await readdir(stagingPath);
    if (stagedEntries.length > 0) throw transientStateError();
  }
  const agentDirectories = directories.filter((entry) => entry.name !== ".bundle-staging");
  if (agentDirectories.length > MAX_AGENT_DIRECTORIES) throw backupError(
    "AGENT_GOVERNANCE_BACKUP_CAPACITY_EXCEEDED",
    "Agent Governance Agent directory count exceeds the consistency-export limit.",
    413,
  );
  const entries: Array<{ name: string; bytes: Buffer }> = [];
  let recordCount = 0;
  for (const directory of agentDirectories.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!directory.isDirectory() || directory.isSymbolicLink() || !AGENT_ID_PATTERN.test(directory.name)) {
      throw unsafeFileError();
    }
    const agentDir = join(agentsRoot, directory.name);
    await assertSafeDirectory(agentDir, dataDir);
    const files = await readdir(agentDir, { withFileTypes: true });
    const names = new Set(files.map((file) => file.name));
    for (const file of files) {
      if (!file.isFile() || file.isSymbolicLink() || !BUNDLE_FILES.has(file.name) || file.name.includes(".tmp")) {
        throw unsafeFileError();
      }
      const bytes = await readOptionalSafeFile(join(agentDir, file.name), dataDir, MAX_BUNDLE_FILE_BYTES);
      if (!bytes) throw unsafeFileError();
      addBytes(bytes.byteLength);
      entries.push({ name: `${directory.name}/${file.name}`, bytes });
    }
    if (registeredIds.has(directory.name)) {
      for (const required of REQUIRED_REGISTERED_BUNDLE_FILES) {
        if (!names.has(required)) throw backupError(
          "AGENT_GOVERNANCE_BACKUP_BUNDLE_INCOMPLETE",
          "A registered Agent bundle is incomplete; consistency export refused.",
          409,
        );
      }
    } else if (names.size !== 1 || !names.has("audit.ndjson")) {
      throw backupError(
        "AGENT_GOVERNANCE_BACKUP_ORPHAN_BUNDLE",
        "An unregistered Agent directory contains authority state; consistency export refused.",
        409,
      );
    }
    recordCount += 1;
  }
  return componentFromEntries("agent-bundles", entries, recordCount);
}

function componentFromEntries(
  source: GovernanceBackupComponent["source"],
  entries: Array<{ name: string; bytes: Buffer }>,
  recordCount: number,
): GovernanceBackupComponent {
  const sorted = [...entries].sort((left, right) => left.name.localeCompare(right.name));
  const byteSize = sorted.reduce((total, entry) => total + entry.bytes.byteLength, 0);
  const digest = sha256(stableStringify(sorted.map((entry) => ({
    name: entry.name,
    byteSize: entry.bytes.byteLength,
    digest: sha256(entry.bytes),
  }))));
  return Object.freeze({
    present: sorted.length > 0,
    recordCount,
    fileCount: sorted.length,
    byteSize,
    digest,
    source,
  });
}

function aggregateDigest(
  registryStorage: AgentGovernanceBackupExport["registryStorage"],
  components: AgentGovernanceBackupExport["components"],
): string {
  return sha256(stableStringify({ registryStorage, components }));
}

async function assertGovernanceHealthy(governance: NonNullable<GovernanceSource>) {
  const health = await governance.service.checkHealth();
  if (health?.ready !== true || health.startupRecovery !== "ready"
    || health.stateIntegrity !== "verified" || health.auditIntegrity !== "verified") {
    throw backupError(
      "AGENT_GOVERNANCE_BACKUP_HEALTH_REQUIRED",
      "Agent Governance startup recovery and integrity must be ready before consistency export.",
      503,
    );
  }
  const bundleVerification = await governance.service.verifyAllAgentBundles();
  if (!bundleVerification || !Number.isSafeInteger(bundleVerification.verifiedAgentCount)
    || bundleVerification.verifiedAgentCount < 0 || bundleVerification.verifiedAgentCount > MAX_AGENT_DIRECTORIES) {
    throw backupError(
      "AGENT_GOVERNANCE_BACKUP_BUNDLE_VERIFICATION_FAILED",
      "Agent Governance deep bundle verification failed before consistency export.",
      503,
    );
  }
  return bundleVerification;
}

async function assertSafeRoot(dataDir: string) {
  await assertSafeDirectory(dataDir, dataDir);
  const ownerPath = join(dataDir, "owner.lease.json");
  const ownerStats = await safeLstat(ownerPath);
  if (!ownerStats || !ownerStats.isFile() || ownerStats.isSymbolicLink() || Number(ownerStats.nlink) !== 1) {
    throw backupError(
      "AGENT_GOVERNANCE_BACKUP_OWNER_REQUIRED",
      "A unique regular Agent Governance owner lease is required for consistency export.",
      503,
    );
  }
}

async function assertNoTransientState(dataDir: string) {
  const entries = await readdir(dataDir, { withFileTypes: true });
  for (const entry of entries) {
    if (TRANSIENT_TOP_LEVEL_NAMES.has(entry.name) || entry.name.endsWith(".tmp")) throw transientStateError();
  }
}

async function readOptionalSafeFile(
  filePath: string,
  rootPath: string,
  maximumBytes: number,
): Promise<Buffer | null> {
  const initial = await safeLstat(filePath);
  if (!initial) return null;
  if (!initial.isFile() || initial.isSymbolicLink() || Number(initial.nlink) !== 1) throw unsafeFileError();
  const [canonicalFile, canonicalRoot] = await Promise.all([realpath(filePath), realpath(rootPath)]);
  if (!isPathInside(canonicalFile, canonicalRoot)) throw unsafeFileError();
  const handle = await open(canonicalFile, "r");
  try {
    const current = await handle.stat();
    if (!current.isFile() || Number(current.nlink) !== 1
      || current.size < 0 || current.size > maximumBytes
      || (Number.isFinite(Number(initial.dev)) && Number.isFinite(Number(current.dev)) && initial.dev !== current.dev)
      || (Number.isFinite(Number(initial.ino)) && Number.isFinite(Number(current.ino)) && initial.ino !== current.ino)) {
      throw unsafeFileError();
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function assertSafeDirectory(directoryPath: string, rootPath: string) {
  const stats = await lstat(directoryPath);
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw unsafeFileError();
  const [canonicalDirectory, canonicalRoot] = await Promise.all([realpath(directoryPath), realpath(rootPath)]);
  if (!isPathInside(canonicalDirectory, canonicalRoot)) throw unsafeFileError();
}

function parseRegistryRecords(bytes: Buffer | null): AgentRegistryRecord[] {
  if (!bytes) return [];
  const parsed = parseJsonObject(bytes, CANONICAL_FILES.registry);
  if (!isRecord(parsed.agents)) throw backupError(
    "AGENT_GOVERNANCE_BACKUP_STATE_INVALID",
    "Agent Governance registry has no valid agents collection.",
    409,
  );
  return Object.values(parsed.agents) as AgentRegistryRecord[];
}

function parseJsonObject(bytes: Buffer, label: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(bytes.toString("utf8"));
    if (!isRecord(parsed)) throw new TypeError("not an object");
    return parsed;
  } catch (cause) {
    throw backupError(
      "AGENT_GOVERNANCE_BACKUP_STATE_INVALID",
      `Agent Governance ${label} is not valid JSON state.`,
      409,
      cause,
    );
  }
}

function excludedExport(
  mode: "disabled" | "platform-tenant-required",
  generatedAt: string,
  reason: "agent_governance_disabled" | "platform_tenant_required",
  enabled = false,
): AgentGovernanceBackupExport {
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    enabled,
    included: false,
    mode,
    generatedAt,
    restoreMode: "verify-only",
    restorable: false,
    mutation: "none",
    reason,
    consistency: "not_applicable",
    registryStorage: "not_applicable",
    excluded: excludedFields(),
  });
}

function excludedFields() {
  return Object.freeze({
    secretMaterial: true as const,
    ownerLease: true as const,
    transientWal: true as const,
    sqliteDatabaseBytes: true as const,
  });
}

function validExcluded(value: unknown) {
  return isRecord(value) && value.secretMaterial === true && value.ownerLease === true
    && value.transientWal === true && value.sqliteDatabaseBytes === true
    && hasOnlyKeys(value, ["secretMaterial", "ownerLease", "transientWal", "sqliteDatabaseBytes"]);
}

function validComponent(value: unknown): value is GovernanceBackupComponent {
  return isRecord(value) && typeof value.present === "boolean"
    && safeCount(value.recordCount) && safeCount(value.fileCount) && safeCount(value.byteSize)
    && typeof value.digest === "string" && SHA256_PATTERN.test(value.digest)
    && ["anchored-file", "logical-query", "agent-bundles", "integrity-heads"].includes(String(value.source))
    && hasOnlyKeys(value, ["present", "recordCount", "fileCount", "byteSize", "digest", "source"]);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
  const allowlist = new Set(allowed);
  return Object.keys(value).every((key) => allowlist.has(key));
}

function validation(
  valid: boolean,
  included: boolean,
  blockers: string[],
  warnings: string[],
  componentCount: number,
): AgentGovernanceBackupValidation {
  return Object.freeze({
    valid,
    included,
    restoreMode: "verify-only",
    restorable: false,
    mutation: "none",
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    componentCount,
  });
}

function safeCount(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function normalizeTenant(value: unknown) {
  const tenantId = typeof value === "string" ? value.trim() : "";
  if (!tenantId || tenantId.length > 128 || !/^[A-Za-z0-9._:-]+$/u.test(tenantId)) {
    throw backupError("AGENT_GOVERNANCE_BACKUP_TENANT_INVALID", "A valid tenant identity is required.", 400);
  }
  return tenantId;
}

function safeTimestamp(now: () => string) {
  const value = now();
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw backupError(
    "AGENT_GOVERNANCE_BACKUP_CLOCK_INVALID",
    "Agent Governance backup clock is invalid.",
    500,
  );
  return new Date(value).toISOString();
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function isPathInside(targetPath: string, rootPath: string) {
  const rel = relative(resolve(rootPath), resolve(targetPath));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

async function safeLstat(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error && typeof error === "object" && (error as { code?: unknown }).code === "ENOENT") return null;
    throw error;
  }
}

function transientStateError() {
  return backupError(
    "AGENT_GOVERNANCE_BACKUP_TRANSIENT_STATE_PRESENT",
    "Agent Governance has an active recovery or publication WAL; consistency export refused.",
    409,
  );
}

function unsafeFileError() {
  return backupError(
    "AGENT_GOVERNANCE_BACKUP_UNSAFE_FILE",
    "Agent Governance consistency export encountered an unsafe file or directory boundary.",
    409,
  );
}

function backupError(code: string, message: string, statusCode: number, cause?: unknown) {
  return Object.assign(
    new Error(message, cause === undefined ? undefined : { cause }),
    { name: "AgentGovernanceBackupExportError", code, statusCode, category: "security", retryable: false },
  );
}
