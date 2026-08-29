/**
 * Versioned policy catalog store.
 *
 * Policies are immutable per (policyKey, version): creating the same
 * pair twice fails, and activation supersedes rather than rewrites.
 * Storage is an atomically-written JSON file under the gitignored
 * governance data directory. Shared baseline layers are seeded once on
 * first load.
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PolicyLayerContent, PolicyRecord } from "@unified-ai-system/shared-contracts";
import { sha256Hex, stableStringify } from "@unified-ai-system/policy-engine";

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
  get(policyKey: string, version: number): Promise<PolicyRecord | null>;
  getActive(policyKey: string): Promise<PolicyRecord | null>;
  list(): Promise<PolicyRecord[]>;
  load(): Promise<void>;
}

interface CatalogFile {
  version: 1;
  updatedAt: string;
  policies: Record<string, PolicyRecord>;
  activeByPolicyKey: Record<string, number>;
}

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
    contentHash: `sha256:${sha256Hex(stableStringify(input.content))}`,
    status: "draft",
    createdAt,
  };
}

export function createPolicyCatalogStore(options: { storePath?: string; now?: () => string } = {}): PolicyCatalogStore {
  const storePath = options.storePath ?? ".data/agent-governance/policies.json";
  const now = options.now ?? (() => new Date().toISOString());
  const records = new Map<string, PolicyRecord>();
  const activeByPolicyKey = new Map<string, number>();
  let loaded = false;
  let dirty = false;

  async function flush(): Promise<void> {
    if (!dirty) return;
    const file: CatalogFile = {
      version: 1,
      updatedAt: now(),
      policies: Object.fromEntries(records),
      activeByPolicyKey: Object.fromEntries(activeByPolicyKey),
    };
    await mkdir(dirname(storePath), { recursive: true });
    const tmpPath = `${storePath}.${randomUUID()}.tmp`;
    await writeFile(tmpPath, JSON.stringify(file, null, 2), "utf8");
    await rename(tmpPath, storePath);
    dirty = false;
  }

  async function load(): Promise<void> {
    if (loaded) return;
    await mkdir(dirname(storePath), { recursive: true });
    try {
      const raw = await readFile(storePath, "utf8");
      const data = JSON.parse(raw) as CatalogFile;
      if (data && typeof data === "object" && data.policies) {
        for (const [id, record] of Object.entries(data.policies)) {
          records.set(id, record);
        }
      }
      if (data && typeof data === "object" && data.activeByPolicyKey) {
        for (const [key, version] of Object.entries(data.activeByPolicyKey)) {
          if (typeof version === "number") activeByPolicyKey.set(key, version);
        }
      }
    } catch {
      // Missing or corrupt catalog starts fresh; baseline seeds below.
    }
    if (records.size === 0) {
      for (const seed of baselinePolicies()) {
        const record: PolicyRecord = {
          ...normalizeRecord(seed, now()),
          status: "active",
          activatedAt: now(),
        };
        records.set(policyId(seed.policyKey, seed.version), record);
        activeByPolicyKey.set(seed.policyKey, seed.version);
      }
      dirty = true;
      await flush();
    }
    loaded = true;
  }

  return {
    load,
    async create(input, actor) {
      await load();
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
      await flush();
      void actor;
      return record;
    },
    async activate(policyKey, version, actor) {
      await load();
      const record = records.get(policyId(policyKey, version));
      if (!record) {
        const error = new Error(`Policy ${policyId(policyKey, version)} not found.`);
        error.name = "PolicyNotFound";
        throw error;
      }
      const previousVersion = activeByPolicyKey.get(policyKey);
      if (previousVersion === version && record.status === "active") {
        return record;
      }
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
      await flush();
      void actor;
      return record;
    },
    async get(policyKey, version) {
      await load();
      return records.get(policyId(policyKey, version)) ?? null;
    },
    async getActive(policyKey) {
      await load();
      const version = activeByPolicyKey.get(policyKey);
      if (typeof version !== "number") return null;
      return records.get(policyId(policyKey, version)) ?? null;
    },
    async list() {
      await load();
      return Array.from(records.values());
    },
  };
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
          "file_glob",
          "grep_search",
          "git_status",
          "git_diff",
          "git_log",
          "reports.create",
        ],
        toolRules: {
          "file_write": "deny",
          "file_edit": "deny",
          "shell_exec": "deny",
          "git_push": "deny",
          "git_create_pr": "deny",
          "web_fetch": "require_approval",
        },
        limits: { maxSteps: 15, maxToolCalls: 25, maxRuntimeSeconds: 180, maxChildrenPerAgent: 0 },
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
          "file_glob",
          "grep_search",
          "file_write",
          "file_edit",
          "file_insert",
          "git_status",
          "git_diff",
          "git_log",
          "git_branch",
          "git_commit",
          "git_push",
          "git_create_pr",
        ],
        toolRules: {
          "shell_exec": "deny",
          "code_run": "deny",
          "git_push": "require_approval",
          "git_create_pr": "require_approval",
        },
        limits: { maxSteps: 20, maxToolCalls: 30, maxRuntimeSeconds: 240 },
      },
    },
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
