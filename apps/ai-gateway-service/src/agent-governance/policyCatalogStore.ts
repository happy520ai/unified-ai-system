/**
 * Versioned policy catalog store.
 *
 * Policies are immutable per (policyKey, version): creating the same
 * pair twice fails, and activation supersedes rather than rewrites.
 * Storage is an atomically-written JSON file under the gitignored
 * governance data directory. Shared baseline layers are seeded once on
 * first load.
 */

import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { PolicyLayerContent, PolicyRecord } from "@unified-ai-system/shared-contracts";
import {
  computePolicyContentHash,
  validatePolicyLayerContent,
} from "@unified-ai-system/policy-engine";
import { resolveGovernanceSecret } from "./governanceSecret.ts";
import { createGovernanceStateFileBinding } from "./governanceStateAnchor.ts";

export interface CreatePolicyInput {
  policyKey: string;
  version: number;
  policyType: PolicyRecord["policyType"];
  scopeKey: string;
  content: PolicyLayerContent;
}

export interface PolicyCatalogStore {
  create(input: CreatePolicyInput, actor: string): Promise<PolicyRecord>;
  activate(policyKey: string, version: number, actor: string): Promise<PolicyRecord>;
  snapshotActivation(policyKey: string): Promise<PolicyCatalogActivationSnapshot>;
  restoreActivation(snapshot: PolicyCatalogActivationSnapshot, actor: string): Promise<void>;
  getActivationState(): Promise<PolicyCatalogActivationState>;
  completeActivationOperation(
    operationId: string,
    outcome: PolicyCatalogActivationOutcome,
    expectedBase: PolicyCatalogActivationState,
  ): Promise<PolicyCatalogActivationState>;
  get(policyKey: string, version: number): Promise<PolicyRecord | null>;
  getActive(policyKey: string): Promise<PolicyRecord | null>;
  list(): Promise<PolicyRecord[]>;
  load(): Promise<void>;
}

/** Exact rollback image for one policy key. It contains policy metadata only,
 * never credentials or runtime state. */
export interface PolicyCatalogActivationSnapshot {
  policyKey: string;
  activeVersion: number | null;
  records: PolicyRecord[];
}

export type PolicyCatalogActivationOutcome = "committed" | "rolled_back";

/** Monotonic, anchored replay fence for the cross-file activation WAL. */
export interface PolicyCatalogActivationState {
  sequence: number;
  lastOperationId: string | null;
  lastOutcome: PolicyCatalogActivationOutcome | null;
}

export const BUILT_IN_EXECUTION_FAMILY_V2 = Object.freeze<CreatePolicyInput>({
  policyKey: "execution-family",
  version: 2,
  policyType: "family",
  scopeKey: "execution",
  content: {
    capabilityCeiling: [
      "file_read",
      "glob",
      "grep",
      "file_write",
      "file_edit",
      "file_insert",
      "ast_edit",
      "code_format",
      "generate_test",
      "git_status",
      "git_diff",
      "git_log",
      "git_branch",
      "git_commit",
      "git_push",
      "git_create_pr",
      "workforce_execute",
      "forge_orchestrate",
      "mcp",
    ],
    toolRules: {
      "shell_exec": "deny",
      "code_run": "deny",
      "git_push": "require_approval",
      "git_create_pr": "require_approval",
      "workforce_execute": "allow",
      "forge_orchestrate": "allow",
      "mcp": "require_approval",
    },
    limits: {
      maxSteps: 20,
      maxToolCalls: 30,
      maxRuntimeSeconds: 240,
      maxWorkforceRoles: 8,
    },
    permissions: {
      canCreateChildren: true,
      canWrite: true,
      canSendExternalMessage: true,
      canExecuteCode: false,
    },
  },
});

export const BUILT_IN_EXECUTION_FAMILY_V2_CONTENT_HASH =
  "sha256:889476ea8593bd8814f958f4a0f7e40f4ccd9615f935921d40ce5440725df19f";

/** Only these immutable v1 payloads may trigger unattended migration. */
export const AUTO_MIGRATABLE_EXECUTION_FAMILY_V1_HASHES = Object.freeze([
  // Original ZCode baseline: file_glob/grep_search and no Workforce/MCP grants.
  "sha256:290cff8b130da77b76ca3716db78bb3fbfc2c69c29d89505bf68fe90b45fd2b2",
  // Current built-in v1 immediately before immutable v2 was introduced.
  "sha256:c0a98d7aa2de775c09b44d852a3ce617aae014531af8897328f1cbc613c8dc22",
]);

export function isAutoMigratableExecutionFamilyV1(contentHash: string): boolean {
  return AUTO_MIGRATABLE_EXECUTION_FAMILY_V1_HASHES.includes(contentHash);
}

interface CatalogFile {
  version: 1;
  updatedAt: string;
  policies: Record<string, PolicyRecord>;
  activeByPolicyKey: Record<string, number>;
  activationState?: PolicyCatalogActivationState;
}

const INITIAL_ACTIVATION_STATE: PolicyCatalogActivationState = Object.freeze({
  sequence: 0,
  lastOperationId: null,
  lastOutcome: null,
});

function policyId(policyKey: string, version: number): string {
  return `${policyKey}@${version}`;
}

function normalizeRecord(input: CreatePolicyInput, createdAt: string): PolicyRecord {
  return {
    policyKey: input.policyKey,
    version: input.version,
    policyType: input.policyType,
    scopeKey: input.scopeKey,
    content: input.content,
    contentHash: computePolicyContentHash(input.content),
    status: "draft",
    createdAt,
  };
}

export function createPolicyCatalogStore(options: {
  storePath?: string;
  now?: () => string;
  secret?: string;
  /** Explicit, migration-only opt-in for a pre-anchor catalog. */
  allowLegacyStateMigration?: boolean;
} = {}): PolicyCatalogStore {
  const storePath = options.storePath ?? ".data/agent-governance/policies.json";
  const now = options.now ?? (() => new Date().toISOString());
  const state = createGovernanceStateFileBinding({
    filePath: storePath,
    secret: options.secret ?? resolveGovernanceSecret({ dataDir: dirname(storePath) }),
    kind: "json",
    validateLegacy: (content) => { parseCatalogFile(content.toString("utf8")); },
    allowLegacyStateMigration: options.allowLegacyStateMigration === true,
  });
  const records = new Map<string, PolicyRecord>();
  const activeByPolicyKey = new Map<string, number>();
  let activationState: PolicyCatalogActivationState = { ...INITIAL_ACTIVATION_STATE };
  let loaded = false;
  let loadPromise: Promise<void> | null = null;
  let dirty = false;
  let mutationTail: Promise<void> = Promise.resolve();

  async function flush(): Promise<void> {
    if (!dirty) return;
    const file: CatalogFile = {
      version: 1,
      updatedAt: now(),
      policies: Object.fromEntries(records),
      activeByPolicyKey: Object.fromEntries(activeByPolicyKey),
      activationState: structuredClone(activationState),
    };
    await state.commit(JSON.stringify(file, null, 2));
    dirty = false;
  }

  async function load(): Promise<void> {
    if (loaded) return;
    if (!loadPromise) {
      loadPromise = (async () => {
        await state.verify();
        let missing = false;
        try {
          const raw = await readFile(storePath, "utf8");
          const data = parseCatalogFile(raw);
          for (const [id, candidate] of Object.entries(data.policies)) {
            records.set(id, candidate);
          }
          for (const [key, version] of Object.entries(data.activeByPolicyKey)) {
            activeByPolicyKey.set(key, Number(version));
          }
          activationState = structuredClone(data.activationState ?? INITIAL_ACTIVATION_STATE);
        } catch (error) {
          if (isMissingFile(error)) missing = true;
          else if ((error as Error)?.name === "GovernancePolicyCatalogCorrupt") throw error;
          else throw corrupt("Policy catalog could not be parsed or read.", error);
        }
        if (missing) {
          const seeds = baselinePolicies();
          const freshActiveVersions = new Map<string, number>();
          for (const seed of seeds) {
            freshActiveVersions.set(
              seed.policyKey,
              Math.max(freshActiveVersions.get(seed.policyKey) ?? 0, seed.version),
            );
          }
          for (const seed of seeds) {
            const active = freshActiveVersions.get(seed.policyKey) === seed.version;
            const record: PolicyRecord = {
              ...normalizeRecord(seed, now()),
              status: active ? "active" : "draft",
              ...(active ? { activatedAt: now() } : {}),
            };
            records.set(policyId(seed.policyKey, seed.version), record);
            if (active) activeByPolicyKey.set(seed.policyKey, seed.version);
          }
          dirty = true;
          await flush();
        }
        loaded = true;
      })();
    }
    await loadPromise;
  }

  function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationTail.then(operation, operation);
    mutationTail = result.then(() => undefined, () => undefined);
    return result;
  }

  return {
    load,
    async create(input, actor) {
      await load();
      return exclusive(async () => {
      await state.verify();
      validateCreatePolicyInput(input);
      const id = policyId(input.policyKey, input.version);
      if (records.has(id)) {
        const error = new Error(`Policy ${id} already exists; versions are immutable.`);
        error.name = "PolicyVersionImmutable";
        throw error;
      }
      if (!Number.isInteger(input.version) || input.version < 1) {
        const error = new Error("Policy version must be a positive integer.");
        error.name = "PolicyVersionInvalid";
        throw error;
      }
      const record = normalizeRecord(input, now());
      records.set(id, record);
      dirty = true;
      try {
        await flush();
      } catch (error) {
        records.delete(id);
        dirty = false;
        throw error;
      }
      void actor;
      return record;
      });
    },
    async activate(policyKey, version, actor) {
      await load();
      return exclusive(async () => {
      await state.verify();
      if (!isSafeKey(policyKey) || !Number.isSafeInteger(version) || version < 1) {
        throw named("PolicyVersionInvalid", "Policy key and version are invalid.");
      }
      const record = records.get(policyId(policyKey, version));
      if (!record) {
        const error = new Error(`Policy ${policyId(policyKey, version)} not found.`);
        error.name = "PolicyNotFound";
        throw error;
      }
      if (record.contentHash !== computePolicyContentHash(record.content)) {
        throw corrupt(`Policy ${policyId(policyKey, version)} content integrity failed.`);
      }
      const previousVersion = activeByPolicyKey.get(policyKey);
      if (previousVersion === version && record.status === "active") {
        return record;
      }
      const previousSnapshot = typeof previousVersion === "number"
        ? structuredClone(records.get(policyId(policyKey, previousVersion)) ?? null)
        : null;
      const targetSnapshot = structuredClone(record);
      if (typeof previousVersion === "number") {
        const previous = records.get(policyId(policyKey, previousVersion));
        if (previous && previous.status === "active") {
          previous.status = "superseded";
          previous.supersededAt = now();
        }
      }
      record.status = "active";
      record.activatedAt = now();
      activeByPolicyKey.set(policyKey, version);
      dirty = true;
      try {
        await flush();
      } catch (error) {
        records.set(policyId(policyKey, version), targetSnapshot);
        if (typeof previousVersion === "number" && previousSnapshot) {
          records.set(policyId(policyKey, previousVersion), previousSnapshot);
          activeByPolicyKey.set(policyKey, previousVersion);
        } else {
          activeByPolicyKey.delete(policyKey);
        }
        dirty = false;
        throw error;
      }
      void actor;
      return record;
      });
    },
    async snapshotActivation(policyKey) {
      await load();
      await state.verify();
      if (!isSafeKey(policyKey)) {
        throw named("PolicyVersionInvalid", "Policy key is invalid.");
      }
      await mutationTail;
      return {
        policyKey,
        activeVersion: activeByPolicyKey.get(policyKey) ?? null,
        records: Array.from(records.values())
          .filter((record) => record.policyKey === policyKey)
          .map((record) => structuredClone(record)),
      };
    },
    async restoreActivation(snapshot, actor) {
      await load();
      return exclusive(async () => {
        await state.verify();
        validateActivationSnapshot(snapshot);
        const beforeRecords = new Map<string, PolicyRecord>();
        for (const record of records.values()) {
          if (record.policyKey === snapshot.policyKey) {
            beforeRecords.set(policyId(record.policyKey, record.version), structuredClone(record));
          }
        }
        const beforeActiveVersion = activeByPolicyKey.get(snapshot.policyKey) ?? null;
        const snapshotIds = new Set(snapshot.records.map((record) => policyId(record.policyKey, record.version)));
        const unexpected = [...beforeRecords.keys()].filter((id) => !snapshotIds.has(id));
        if (unexpected.length > 0) {
          throw named(
            "PolicyActivationSnapshotDiverged",
            "Policy activation rollback would remove immutable versions created after its snapshot.",
          );
        }
        for (const id of beforeRecords.keys()) records.delete(id);
        for (const record of snapshot.records) {
          records.set(policyId(record.policyKey, record.version), structuredClone(record));
        }
        if (snapshot.activeVersion === null) activeByPolicyKey.delete(snapshot.policyKey);
        else activeByPolicyKey.set(snapshot.policyKey, snapshot.activeVersion);
        dirty = true;
        try {
          await flush();
        } catch (error) {
          for (const record of snapshot.records) {
            records.delete(policyId(record.policyKey, record.version));
          }
          for (const [id, record] of beforeRecords) records.set(id, record);
          if (beforeActiveVersion === null) activeByPolicyKey.delete(snapshot.policyKey);
          else activeByPolicyKey.set(snapshot.policyKey, beforeActiveVersion);
          dirty = false;
          throw error;
        }
        void actor;
      });
    },
    async getActivationState() {
      await load();
      await state.verify();
      await mutationTail;
      return structuredClone(activationState);
    },
    async completeActivationOperation(operationId, outcome, expectedBase) {
      await load();
      return exclusive(async () => {
        await state.verify();
        validateActivationState(expectedBase);
        if (!isUuid(operationId) || !new Set<PolicyCatalogActivationOutcome>(["committed", "rolled_back"]).has(outcome)) {
          throw named("PolicyActivationOperationInvalid", "Policy activation completion metadata is invalid.");
        }
        if (activationState.lastOperationId === operationId) {
          if (activationState.sequence !== expectedBase.sequence + 1 || activationState.lastOutcome !== outcome) {
            throw named("PolicyActivationOperationDiverged", "Policy activation operation was completed with a different outcome.");
          }
          return structuredClone(activationState);
        }
        if (!activationStateEqual(activationState, expectedBase)) {
          throw named("PolicyActivationOperationDiverged", "Policy activation replay fence no longer matches its base state.");
        }
        if (!Number.isSafeInteger(activationState.sequence + 1)) {
          throw named("PolicyActivationOperationOverflow", "Policy activation replay sequence overflowed.");
        }
        const previous = activationState;
        activationState = {
          sequence: activationState.sequence + 1,
          lastOperationId: operationId,
          lastOutcome: outcome,
        };
        dirty = true;
        try {
          await flush();
        } catch (error) {
          activationState = previous;
          dirty = false;
          throw error;
        }
        return structuredClone(activationState);
      });
    },
    async get(policyKey, version) {
      await load();
      await state.verify();
      return records.get(policyId(policyKey, version)) ?? null;
    },
    async getActive(policyKey) {
      await load();
      await state.verify();
      const version = activeByPolicyKey.get(policyKey);
      if (typeof version !== "number") return null;
      return records.get(policyId(policyKey, version)) ?? null;
    },
    async list() {
      await load();
      await state.verify();
      return Array.from(records.values());
    },
  };
}

function parseCatalogFile(raw: string): CatalogFile {
  let data: CatalogFile;
  try { data = JSON.parse(raw) as CatalogFile; }
  catch (error) { throw corrupt("Policy catalog could not be parsed.", error); }
  if (data?.version !== 1 || !isRecord(data.policies) || !isRecord(data.activeByPolicyKey)) {
    throw corrupt("Policy catalog has an unsupported or malformed schema.");
  }
  const policies: Record<string, PolicyRecord> = {};
  for (const [id, candidate] of Object.entries(data.policies)) {
    policies[id] = validateStoredPolicy(id, candidate);
  }
  if (Object.keys(policies).length === 0) throw corrupt("An existing policy catalog cannot be empty.");
  const activeByPolicyKey: Record<string, number> = {};
  for (const [key, version] of Object.entries(data.activeByPolicyKey)) {
    if (!Number.isSafeInteger(version) || Number(version) < 1) {
      throw corrupt(`Active policy pointer for ${key} is invalid.`);
    }
    const active = policies[policyId(key, Number(version))];
    if (!active || active.status !== "active" || active.policyKey !== key) {
      throw corrupt(`Active policy pointer for ${key} is inconsistent.`);
    }
    activeByPolicyKey[key] = Number(version);
  }
  for (const record of Object.values(policies)) {
    if (record.status === "active" && activeByPolicyKey[record.policyKey] !== record.version) {
      throw corrupt(`Active policy ${policyId(record.policyKey, record.version)} has no matching pointer.`);
    }
  }
  const activationState = data.activationState ?? INITIAL_ACTIVATION_STATE;
  validateActivationState(activationState);
  return { ...data, policies, activeByPolicyKey, activationState: structuredClone(activationState) };
}

function validateActivationState(value: unknown): asserts value is PolicyCatalogActivationState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw corrupt("Policy catalog activation replay state is malformed.");
  }
  const state = value as PolicyCatalogActivationState;
  if (!Number.isSafeInteger(state.sequence) || state.sequence < 0
    || (state.lastOperationId !== null && !isUuid(state.lastOperationId))
    || (state.lastOutcome !== null && state.lastOutcome !== "committed" && state.lastOutcome !== "rolled_back")
    || ((state.lastOperationId === null) !== (state.lastOutcome === null))) {
    throw corrupt("Policy catalog activation replay state is malformed.");
  }
}

function activationStateEqual(left: PolicyCatalogActivationState, right: PolicyCatalogActivationState): boolean {
  return left.sequence === right.sequence
    && left.lastOperationId === right.lastOperationId
    && left.lastOutcome === right.lastOutcome;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

const POLICY_TYPES = new Set<PolicyRecord["policyType"]>([
  "emergency", "root", "tenant", "family", "domain", "subclass", "trait", "instance", "task",
]);
const POLICY_STATUSES = new Set<PolicyRecord["status"]>(["draft", "active", "superseded"]);

function validateCreatePolicyInput(input: CreatePolicyInput): void {
  if (!input || !isSafeKey(input.policyKey) || !Number.isSafeInteger(input.version) || input.version < 1
    || !POLICY_TYPES.has(input.policyType) || !isSafeKey(input.scopeKey)
    || !isRecord(input.content)) {
    throw named("PolicyVersionInvalid", "Policy input is malformed.");
  }
  try {
    computePolicyContentHash(input.content);
  } catch (error) {
    throw corrupt("Policy content cannot be canonically hashed.", error);
  }
  const validation = validatePolicyLayerContent(input.content, input.policyKey);
  if (!validation.valid) {
    const error = named(
      "PolicyContentInvalid",
      validation.errors.map((item) => `${item.code}: ${item.message}`).join(" | "),
    ) as Error & { errors?: unknown[] };
    error.errors = validation.errors;
    throw error;
  }
}

function validateStoredPolicy(id: string, input: unknown): PolicyRecord {
  if (!isRecord(input)) throw corrupt(`Policy ${id} is not an object.`);
  const record = input as unknown as PolicyRecord;
  const contentValidation = validatePolicyLayerContent(record.content, record.policyKey);
  if (!isSafeKey(record.policyKey) || !Number.isSafeInteger(record.version) || record.version < 1
    || id !== policyId(record.policyKey, record.version)
    || !POLICY_TYPES.has(record.policyType) || !isSafeKey(record.scopeKey)
    || !POLICY_STATUSES.has(record.status) || !isRecord(record.content) || !contentValidation.valid
    || record.contentHash !== computePolicyContentHash(record.content)) {
    throw corrupt(`Policy ${id} failed schema or content integrity validation.`);
  }
  return structuredClone(record);
}

function validateActivationSnapshot(snapshot: PolicyCatalogActivationSnapshot): void {
  if (!snapshot || !isSafeKey(snapshot.policyKey)
    || (snapshot.activeVersion !== null
      && (!Number.isSafeInteger(snapshot.activeVersion) || snapshot.activeVersion < 1))
    || !Array.isArray(snapshot.records)) {
    throw named("PolicyActivationSnapshotInvalid", "Policy activation snapshot is malformed.");
  }
  const versions = new Set<number>();
  for (const record of snapshot.records) {
    validateStoredPolicy(policyId(snapshot.policyKey, record?.version), record);
    if (record.policyKey !== snapshot.policyKey || versions.has(record.version)) {
      throw named("PolicyActivationSnapshotInvalid", "Policy activation snapshot contains inconsistent records.");
    }
    versions.add(record.version);
  }
  const active = snapshot.activeVersion === null
    ? null
    : snapshot.records.find((record) => record.version === snapshot.activeVersion) ?? null;
  if ((snapshot.activeVersion !== null && active?.status !== "active")
    || snapshot.records.some((record) => record.status === "active" && record.version !== snapshot.activeVersion)) {
    throw named("PolicyActivationSnapshotInvalid", "Policy activation snapshot has an inconsistent active pointer.");
  }
}

function isSafeKey(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_.:-]{1,128}$/u.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function named(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

function corrupt(message: string, cause?: unknown): Error {
  const error = new Error(message, cause === undefined ? undefined : { cause });
  error.name = "GovernancePolicyCatalogCorrupt";
  return error;
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "ENOENT");
}

/**
 * Baseline shared layers seeded on first boot. Content mirrors the
 * governance specification's root and analysis-family examples, adapted
 * to this gateway's tool names.
 */
function baselinePolicies(): CreatePolicyInput[] {
  return [
    {
      policyKey: "root-policy",
      version: 1,
      policyType: "root",
      scopeKey: "global",
      content: {
        mandatory: {
          auditRequired: true,
          credentialsExposedToAgent: false,
          crossTenantAccess: "deny",
          selfPolicyModification: "deny",
          gatewayBypass: "deny",
          permissionExpansion: "deny",
        },
        limits: {
          maxGenerationDepth: 2,
          maxChildrenPerAgent: 5,
          maxWorkforceRoles: 8,
          maxRuntimeSeconds: 300,
          maxSteps: 30,
          maxToolCalls: 50,
        },
        toolRules: {
          "shell.exec": "deny",
          "code_run": "deny",
          "database.delete": "deny",
          "payment.refund": "require_approval",
          "email.send": "require_approval",
          "git_push": "require_approval",
          "git_create_pr": "require_approval",
          "mcp": "require_approval",
        },
        requirements: { auditRequired: true, detailedLoggingRequired: true },
        permissions: { canCreateChildren: true },
      },
    },
    {
      policyKey: "analysis-family",
      version: 1,
      policyType: "family",
      scopeKey: "analysis",
      content: {
        capabilityCeiling: [
          "file_read",
          "glob",
          "grep",
          "git_status",
          "git_diff",
          "git_log",
          "reports.create",
          "mcp",
        ],
        toolRules: {
          "file_write": "deny",
          "file_edit": "deny",
          "shell_exec": "deny",
          "git_push": "deny",
          "git_create_pr": "deny",
          "web_fetch": "require_approval",
          "mcp": "require_approval",
        },
        limits: {
          maxSteps: 15,
          maxToolCalls: 25,
          maxRuntimeSeconds: 180,
          maxChildrenPerAgent: 0,
          maxWorkforceRoles: 0,
        },
        permissions: {
          canCreateChildren: false,
          canWrite: false,
          canSendExternalMessage: true,
          canExecuteCode: false,
        },
      },
    },
    {
      policyKey: "execution-family",
      version: 1,
      policyType: "family",
      scopeKey: "execution",
      content: {
        capabilityCeiling: [
          "file_read",
          "glob",
          "grep",
          "file_write",
          "file_edit",
          "file_insert",
          "ast_edit",
          "code_format",
          "generate_test",
          "git_status",
          "git_diff",
          "git_log",
          "git_branch",
          "git_commit",
          "git_push",
          "git_create_pr",
          "workforce_execute",
          "mcp",
        ],
        toolRules: {
          "shell_exec": "deny",
          "code_run": "deny",
          "git_push": "require_approval",
          "git_create_pr": "require_approval",
          "workforce_execute": "allow",
          "mcp": "require_approval",
        },
        limits: { maxSteps: 20, maxToolCalls: 30, maxRuntimeSeconds: 240, maxWorkforceRoles: 8 },
        permissions: {
          canCreateChildren: true,
          canWrite: true,
          canSendExternalMessage: true,
          canExecuteCode: false,
        },
      },
    },
    structuredClone(BUILT_IN_EXECUTION_FAMILY_V2) as CreatePolicyInput,
    {
      policyKey: "sensitive-data-trait",
      version: 1,
      policyType: "trait",
      scopeKey: "handles_sensitive_data",
      content: {
        requirements: { outputRedactionRequired: true, detailedLoggingRequired: true },
        dataRules: {
          deniedOutputFields: ["password", "token", "secret", "authorization", "full_card_number", "private_key"],
        },
      },
    },
  ];
}
