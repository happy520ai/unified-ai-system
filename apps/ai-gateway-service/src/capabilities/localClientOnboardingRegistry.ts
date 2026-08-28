import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import {
  createLocalClientConfigTransactionEngine,
  type LocalClientConfigJsonValue,
  type LocalClientConfigReceipt,
  type LocalClientConfigRecoveryReceipt,
  type LocalClientConfigRollbackReceipt,
  type LocalClientConfigTransactionEngine,
  type LocalClientConfigTransactionOptions,
} from "./localClientConfigTransaction.ts";

export const LOCAL_CLIENT_ONBOARDING_PLAN_VERSION = "local-client-onboarding-plan-v1" as const;
export const LOCAL_CLIENT_ONBOARDING_RECEIPT_VERSION = "local-client-onboarding-receipt-v1" as const;
export const LOCAL_CLIENT_ONBOARDING_ROLLBACK_VERSION = "local-client-onboarding-rollback-v1" as const;
export const LOCAL_CLIENT_ONBOARDING_RECOVERY_VERSION = "local-client-onboarding-recovery-v1" as const;
export const LOCAL_CLIENT_ONBOARDING_CERTIFICATION_STATUS =
  "fixture-tested-not-real-client-certified" as const;
export const LOCAL_CLIENT_ONBOARDING_SERVER_NAME = "unified-ai-system" as const;

export const LOCAL_CLIENT_ONBOARDING_PROFILE_IDS = Object.freeze({
  claudeCompatible: "claude-compatible-mcp-json" as const,
  cursor: "cursor-mcp-json" as const,
  vscode: "vscode-mcp-json" as const,
});

export type LocalClientOnboardingProfileId =
  typeof LOCAL_CLIENT_ONBOARDING_PROFILE_IDS[keyof typeof LOCAL_CLIENT_ONBOARDING_PROFILE_IDS];
export type LocalClientOnboardingAction = "enable" | "disable";
export type LocalClientOnboardingClient = "claude-compatible" | "cursor" | "vscode";

export interface LocalClientOnboardingBoundPaths {
  readonly targetPath: string;
  readonly allowedRoot: string;
  readonly backupDir: string;
  readonly journalPath: string;
  readonly maxBytes?: number;
  readonly maxTransactions?: number;
  readonly clock?: () => number;
}

export interface UnifiedAiMcpServerDefinition {
  readonly transport: "stdio";
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
}

export interface LocalClientOnboardingRegistryOptions {
  readonly profiles: Readonly<{
    claudeCompatible: LocalClientOnboardingBoundPaths;
    cursor: LocalClientOnboardingBoundPaths;
    vscode: LocalClientOnboardingBoundPaths;
  }>;
  readonly serverDefinition: UnifiedAiMcpServerDefinition;
  readonly committedRetentionMs?: number;
  readonly backupEncryptionKey?: Uint8Array;
}

export interface LocalClientOnboardingProfileSummary {
  readonly profileId: LocalClientOnboardingProfileId;
  readonly client: LocalClientOnboardingClient;
  readonly format: "json-only";
  readonly containerKey: "mcpServers" | "servers";
  readonly serverName: typeof LOCAL_CLIENT_ONBOARDING_SERVER_NAME;
  readonly transport: "stdio";
  readonly backupProtection: "aes-256-gcm" | "0600-plaintext";
  readonly supportedActions: readonly ["enable", "disable"];
  readonly certificationStatus: typeof LOCAL_CLIENT_ONBOARDING_CERTIFICATION_STATUS;
  readonly redacted: true;
}

export interface LocalClientOnboardingVerification {
  readonly profileId: LocalClientOnboardingProfileId;
  readonly installed: boolean;
  readonly state: "exact" | "absent" | "different";
  readonly format: "json-only";
  readonly certificationStatus: typeof LOCAL_CLIENT_ONBOARDING_CERTIFICATION_STATUS;
  readonly redacted: true;
}

export interface LocalClientOnboardingInspection {
  readonly profile: LocalClientOnboardingProfileSummary;
  readonly installation: LocalClientOnboardingVerification;
  readonly recoveryRequired: boolean;
  readonly journalCorrupt: boolean;
  readonly pendingTransactionCount: number;
  readonly storedPlanCount: number;
  readonly available: true;
}

export interface LocalClientOnboardingPlan {
  readonly planVersion: typeof LOCAL_CLIENT_ONBOARDING_PLAN_VERSION;
  readonly planId: string;
  readonly profileId: LocalClientOnboardingProfileId;
  readonly action: LocalClientOnboardingAction;
  readonly beforeSha256: string;
  readonly afterSha256: string;
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
  readonly writesPerformed: false;
  readonly format: "json-only";
  readonly certificationStatus: typeof LOCAL_CLIENT_ONBOARDING_CERTIFICATION_STATUS;
  readonly redacted: true;
}

export interface LocalClientOnboardingReceipt {
  readonly receiptVersion: typeof LOCAL_CLIENT_ONBOARDING_RECEIPT_VERSION;
  readonly profileId: LocalClientOnboardingProfileId;
  readonly action: LocalClientOnboardingAction;
  readonly planId: string;
  readonly transaction: LocalClientConfigReceipt;
  readonly receiptDigest: string;
  readonly format: "json-only";
  readonly certificationStatus: typeof LOCAL_CLIENT_ONBOARDING_CERTIFICATION_STATUS;
  readonly redacted: true;
}

export interface LocalClientOnboardingRollbackReceipt {
  readonly rollbackVersion: typeof LOCAL_CLIENT_ONBOARDING_ROLLBACK_VERSION;
  readonly profileId: LocalClientOnboardingProfileId;
  readonly action: LocalClientOnboardingAction;
  readonly planId: string;
  readonly transaction: LocalClientConfigRollbackReceipt;
  readonly format: "json-only";
  readonly certificationStatus: typeof LOCAL_CLIENT_ONBOARDING_CERTIFICATION_STATUS;
  readonly redacted: true;
}

export interface LocalClientOnboardingRecoveryReceipt {
  readonly recoveryVersion: typeof LOCAL_CLIENT_ONBOARDING_RECOVERY_VERSION;
  readonly profileId: LocalClientOnboardingProfileId;
  readonly transaction: LocalClientConfigRecoveryReceipt;
  readonly format: "json-only";
  readonly certificationStatus: typeof LOCAL_CLIENT_ONBOARDING_CERTIFICATION_STATUS;
  readonly redacted: true;
}

export type LocalClientOnboardingErrorCode =
  | "LOCAL_CLIENT_ONBOARDING_CONFIGURATION_INVALID"
  | "LOCAL_CLIENT_ONBOARDING_PROFILE_UNKNOWN"
  | "LOCAL_CLIENT_ONBOARDING_ACTION_INVALID"
  | "LOCAL_CLIENT_ONBOARDING_PLAN_UNKNOWN"
  | "LOCAL_CLIENT_ONBOARDING_PLAN_PROFILE_MISMATCH"
  | "LOCAL_CLIENT_ONBOARDING_RECEIPT_INVALID"
  | "LOCAL_CLIENT_ONBOARDING_CONFIG_INVALID"
  | "LOCAL_CLIENT_ONBOARDING_RECOVERY_REQUIRED"
  | "LOCAL_CLIENT_ONBOARDING_RECOVERY_NOT_REQUIRED";

export class LocalClientOnboardingError extends Error {
  readonly code: LocalClientOnboardingErrorCode;
  readonly category: "configuration" | "validation" | "integrity" | "conflict";
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: LocalClientOnboardingErrorCode,
    message: string,
    category: LocalClientOnboardingError["category"],
    statusCode: number,
    retryable = false,
  ) {
    super(message);
    this.name = "LocalClientOnboardingError";
    this.code = code;
    this.category = category;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

type NormalizedServerDefinition = Readonly<{
  transport: "stdio";
  command: string;
  args: readonly string[];
  cwd?: string;
  env?: Readonly<Record<string, string>>;
}>;

type ProfileRecord = Readonly<{
  summary: LocalClientOnboardingProfileSummary;
  engine: LocalClientConfigTransactionEngine;
  targetPath: string;
  allowedRoot: string;
  maxBytes: number;
  entryDefinition: LocalClientConfigJsonValue;
}>;

type StoredPlan = Readonly<{
  profileId: LocalClientOnboardingProfileId;
  action: LocalClientOnboardingAction;
  transactionPlanId: string;
}>;

const DEFAULT_MAX_BYTES = 1_048_576;
const HARD_MAX_BYTES = 16 * 1_048_576;
const MAX_STRING_BYTES = 16_384;
const MAX_ARGS = 128;
const MAX_ENV_ENTRIES = 128;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const PUBLIC_PLAN_PATTERN = /^onboard:([a-z0-9-]+):([a-f0-9]{64})$/u;

const PROFILE_DEFINITIONS = Object.freeze([
  Object.freeze({
    optionKey: "claudeCompatible" as const,
    profileId: LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.claudeCompatible,
    client: "claude-compatible" as const,
    containerKey: "mcpServers" as const,
  }),
  Object.freeze({
    optionKey: "cursor" as const,
    profileId: LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.cursor,
    client: "cursor" as const,
    containerKey: "mcpServers" as const,
  }),
  Object.freeze({
    optionKey: "vscode" as const,
    profileId: LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.vscode,
    client: "vscode" as const,
    containerKey: "servers" as const,
  }),
] as const);

export class LocalClientOnboardingRegistry {
  readonly #profiles: ReadonlyMap<LocalClientOnboardingProfileId, ProfileRecord>;
  readonly #plans = new Map<string, StoredPlan>();
  readonly #transactionPlanOwners = new Map<string, LocalClientOnboardingProfileId>();

  private constructor(profiles: ReadonlyMap<LocalClientOnboardingProfileId, ProfileRecord>) {
    this.#profiles = profiles;
  }

  static async open(options: LocalClientOnboardingRegistryOptions): Promise<LocalClientOnboardingRegistry> {
    assertRegistryOptions(options);
    const serverDefinition = normalizeServerDefinition(options.serverDefinition);
    await assertDistinctProfileStorage(options.profiles);
    const profiles = new Map<LocalClientOnboardingProfileId, ProfileRecord>();
    try {
      for (const definition of PROFILE_DEFINITIONS) {
        const paths = options.profiles[definition.optionKey];
        const engine = await createLocalClientConfigTransactionEngine(toTransactionOptions(paths, options));
        const summary = createProfileSummary(definition, engine.getStatus().backupProtection);
        const maxBytes = boundedInteger(paths.maxBytes, DEFAULT_MAX_BYTES, 256, HARD_MAX_BYTES);
        profiles.set(definition.profileId, Object.freeze({
          summary,
          engine,
          targetPath: paths.targetPath,
          allowedRoot: paths.allowedRoot,
          maxBytes,
          entryDefinition: createProfileEntry(definition.client, serverDefinition),
        }));
      }
    } catch (error) {
      await Promise.allSettled([...profiles.values()].map((profile) => profile.engine.close()));
      throw error;
    }
    return new LocalClientOnboardingRegistry(profiles);
  }

  listProfiles(): readonly LocalClientOnboardingProfileSummary[] {
    return Object.freeze(PROFILE_DEFINITIONS.map((definition) => this.#profile(definition.profileId).summary));
  }

  async close(): Promise<void> {
    this.#plans.clear();
    this.#transactionPlanOwners.clear();
    await Promise.allSettled([...this.#profiles.values()].map((profile) => profile.engine.close()));
  }

  async inspect(profileId: LocalClientOnboardingProfileId): Promise<LocalClientOnboardingInspection> {
    const profile = this.#profile(profileId);
    const status = profile.engine.getStatus();
    const installation = await this.#readInstallation(profile);
    return Object.freeze({
      profile: profile.summary,
      installation,
      recoveryRequired: status.recoveryRequired,
      journalCorrupt: status.journalCorrupt,
      pendingTransactionCount: status.pendingTransactionIds.length,
      storedPlanCount: status.storedPlans,
      available: true as const,
    });
  }

  async plan(
    profileId: LocalClientOnboardingProfileId,
    action: LocalClientOnboardingAction,
  ): Promise<LocalClientOnboardingPlan> {
    const profile = this.#profile(profileId);
    const normalizedAction = normalizeAction(action);
    assertProfileOperable(profile);
    const transactionPlan = await profile.engine.plan({
      operations: [normalizedAction === "enable"
        ? {
          op: "set" as const,
          path: [profile.summary.containerKey, LOCAL_CLIENT_ONBOARDING_SERVER_NAME],
          value: profile.entryDefinition,
        }
        : {
          op: "delete" as const,
          path: [profile.summary.containerKey, LOCAL_CLIENT_ONBOARDING_SERVER_NAME],
        }],
    });
    const planId = publicPlanId(profileId, transactionPlan.planId);
    this.#plans.set(planId, Object.freeze({
      profileId,
      action: normalizedAction,
      transactionPlanId: transactionPlan.planId,
    }));
    this.#transactionPlanOwners.set(transactionPlan.planId, profileId);
    return Object.freeze({
      planVersion: LOCAL_CLIENT_ONBOARDING_PLAN_VERSION,
      planId,
      profileId,
      action: normalizedAction,
      beforeSha256: transactionPlan.beforeSha256,
      afterSha256: transactionPlan.afterSha256,
      createdAtMs: transactionPlan.createdAtMs,
      expiresAtMs: transactionPlan.expiresAtMs,
      writesPerformed: false as const,
      format: "json-only" as const,
      certificationStatus: LOCAL_CLIENT_ONBOARDING_CERTIFICATION_STATUS,
      redacted: true as const,
    });
  }

  async apply(planId: string): Promise<LocalClientOnboardingReceipt> {
    const parsed = parsePublicPlanId(planId);
    const stored = this.#plans.get(planId);
    if (!stored) {
      const owner = this.#transactionPlanOwners.get(parsed.transactionPlanId);
      if (owner !== undefined && owner !== parsed.profileId) throw planProfileMismatchError();
      throw planUnknownError();
    }
    if (
      stored.profileId !== parsed.profileId
      || stored.transactionPlanId !== parsed.transactionPlanId
    ) throw planProfileMismatchError();
    const profile = this.#profile(stored.profileId);
    assertProfileOperable(profile);
    const transaction = await profile.engine.apply({ planId: stored.transactionPlanId });
    this.#plans.delete(planId);
    this.#transactionPlanOwners.delete(stored.transactionPlanId);
    const receiptDigest = onboardingReceiptDigest({
      profileId: stored.profileId,
      action: stored.action,
      planId,
      transactionReceiptDigest: transaction.receiptDigest,
    });
    return Object.freeze({
      receiptVersion: LOCAL_CLIENT_ONBOARDING_RECEIPT_VERSION,
      profileId: stored.profileId,
      action: stored.action,
      planId,
      transaction: freezeTransactionReceipt(transaction),
      receiptDigest,
      format: "json-only" as const,
      certificationStatus: LOCAL_CLIENT_ONBOARDING_CERTIFICATION_STATUS,
      redacted: true as const,
    });
  }

  async rollback(
    receipt: LocalClientOnboardingReceipt,
  ): Promise<LocalClientOnboardingRollbackReceipt> {
    const normalized = validateOnboardingReceipt(receipt);
    const profile = this.#profile(normalized.profileId);
    if (normalized.transaction.targetFingerprint !== profile.engine.getStatus().targetFingerprint) {
      throw receiptError();
    }
    assertProfileOperable(profile);
    const transaction = await profile.engine.rollback({ receipt: normalized.transaction });
    return Object.freeze({
      rollbackVersion: LOCAL_CLIENT_ONBOARDING_ROLLBACK_VERSION,
      profileId: normalized.profileId,
      action: normalized.action,
      planId: normalized.planId,
      transaction: Object.freeze({ ...transaction }),
      format: "json-only" as const,
      certificationStatus: LOCAL_CLIENT_ONBOARDING_CERTIFICATION_STATUS,
      redacted: true as const,
    });
  }

  async recover(profileId: LocalClientOnboardingProfileId): Promise<LocalClientOnboardingRecoveryReceipt> {
    const profile = this.#profile(profileId);
    const status = profile.engine.getStatus();
    if (status.journalCorrupt) throw recoveryRequiredError();
    if (status.pendingTransactionIds.length !== 1) {
      if (status.pendingTransactionIds.length === 0) throw recoveryNotRequiredError();
      throw recoveryRequiredError();
    }
    const transaction = await profile.engine.recover({
      transactionId: status.pendingTransactionIds[0]!,
    });
    return Object.freeze({
      recoveryVersion: LOCAL_CLIENT_ONBOARDING_RECOVERY_VERSION,
      profileId,
      transaction: freezeRecoveryReceipt(transaction),
      format: "json-only" as const,
      certificationStatus: LOCAL_CLIENT_ONBOARDING_CERTIFICATION_STATUS,
      redacted: true as const,
    });
  }

  async verifyInstalled(
    profileId: LocalClientOnboardingProfileId,
  ): Promise<LocalClientOnboardingVerification> {
    const profile = this.#profile(profileId);
    assertProfileOperable(profile);
    return this.#readInstallation(profile);
  }

  #profile(profileId: LocalClientOnboardingProfileId): ProfileRecord {
    if (typeof profileId !== "string") throw profileUnknownError();
    const profile = this.#profiles.get(profileId);
    if (!profile) throw profileUnknownError();
    return profile;
  }

  async #readInstallation(profile: ProfileRecord): Promise<LocalClientOnboardingVerification> {
    const root = await readBoundJsonObject(
      profile.targetPath,
      profile.allowedRoot,
      profile.maxBytes,
    );
    const container = root[profile.summary.containerKey];
    let state: LocalClientOnboardingVerification["state"];
    if (container === undefined) {
      state = "absent";
    } else {
      if (!isPlainRecord(container)) throw configInvalidError();
      const entry = container[LOCAL_CLIENT_ONBOARDING_SERVER_NAME];
      state = entry === undefined
        ? "absent"
        : canonicalJson(entry) === canonicalJson(profile.entryDefinition)
          ? "exact"
          : "different";
    }
    return Object.freeze({
      profileId: profile.summary.profileId,
      installed: state === "exact",
      state,
      format: "json-only" as const,
      certificationStatus: LOCAL_CLIENT_ONBOARDING_CERTIFICATION_STATUS,
      redacted: true as const,
    });
  }
}

export async function createLocalClientOnboardingRegistry(
  options: LocalClientOnboardingRegistryOptions,
): Promise<LocalClientOnboardingRegistry> {
  return LocalClientOnboardingRegistry.open(options);
}

function createProfileSummary(
  definition: typeof PROFILE_DEFINITIONS[number],
  backupProtection: "aes-256-gcm" | "0600-plaintext",
): LocalClientOnboardingProfileSummary {
  return Object.freeze({
    profileId: definition.profileId,
    client: definition.client,
    format: "json-only" as const,
    containerKey: definition.containerKey,
    serverName: LOCAL_CLIENT_ONBOARDING_SERVER_NAME,
    transport: "stdio" as const,
    backupProtection,
    supportedActions: Object.freeze(["enable", "disable"] as const),
    certificationStatus: LOCAL_CLIENT_ONBOARDING_CERTIFICATION_STATUS,
    redacted: true as const,
  });
}

function createProfileEntry(
  client: LocalClientOnboardingClient,
  definition: NormalizedServerDefinition,
): LocalClientConfigJsonValue {
  const common = {
    command: definition.command,
    args: [...definition.args],
    ...(definition.cwd === undefined ? {} : { cwd: definition.cwd }),
    ...(definition.env === undefined ? {} : { env: { ...definition.env } }),
  };
  const value = client === "vscode"
    ? { type: "stdio", ...common }
    : common;
  return deepFreezeJson(value) as LocalClientConfigJsonValue;
}

function normalizeServerDefinition(value: UnifiedAiMcpServerDefinition): NormalizedServerDefinition {
  assertExactObject(value, ["transport", "command", "args", "cwd", "env"], new Set(["cwd", "env"]));
  if (value.transport !== "stdio") throw configurationError();
  const command = boundedString(value.command, MAX_STRING_BYTES);
  if (!Array.isArray(value.args) || value.args.length > MAX_ARGS) throw configurationError();
  const args = Object.freeze(value.args.map((item) => boundedString(item, MAX_STRING_BYTES, true)));
  const cwd = value.cwd === undefined ? undefined : boundedString(value.cwd, MAX_STRING_BYTES);
  if (cwd !== undefined && !isAbsolute(cwd)) throw configurationError();
  let env: Readonly<Record<string, string>> | undefined;
  if (value.env !== undefined) {
    if (!isPlainRecord(value.env)) throw configurationError();
    const entries = Object.entries(value.env);
    if (entries.length > MAX_ENV_ENTRIES) throw configurationError();
    const normalized: Record<string, string> = Object.create(null) as Record<string, string>;
    for (const [key, raw] of entries) {
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/u.test(key)) throw configurationError();
      normalized[key] = boundedString(raw, MAX_STRING_BYTES, true);
    }
    env = Object.freeze(normalized);
  }
  return Object.freeze({
    transport: "stdio" as const,
    command,
    args,
    ...(cwd === undefined ? {} : { cwd }),
    ...(env === undefined ? {} : { env }),
  });
}

function assertRegistryOptions(options: LocalClientOnboardingRegistryOptions): void {
  assertExactObject(
    options,
    ["profiles", "serverDefinition", "committedRetentionMs", "backupEncryptionKey"],
    new Set(["committedRetentionMs", "backupEncryptionKey"]),
  );
  assertExactObject(options.profiles, ["claudeCompatible", "cursor", "vscode"], new Set());
  for (const definition of PROFILE_DEFINITIONS) {
    assertPathOptions(options.profiles[definition.optionKey]);
  }
  if (
    options.backupEncryptionKey !== undefined
    && (!(options.backupEncryptionKey instanceof Uint8Array) || options.backupEncryptionKey.byteLength !== 32)
  ) throw configurationError();
}

function assertPathOptions(value: LocalClientOnboardingBoundPaths): void {
  assertExactObject(
    value,
    ["targetPath", "allowedRoot", "backupDir", "journalPath", "maxBytes", "maxTransactions", "clock"],
    new Set(["maxBytes", "maxTransactions", "clock"]),
  );
  for (const path of [value.targetPath, value.allowedRoot, value.backupDir, value.journalPath]) {
    if (
      typeof path !== "string"
      || !isAbsolute(path)
      || path !== path.trim()
      || path.length > 4_096
      || path.includes("\0")
    ) throw configurationError();
  }
}

async function assertDistinctProfileStorage(
  profiles: LocalClientOnboardingRegistryOptions["profiles"],
): Promise<void> {
  const storage = PROFILE_DEFINITIONS.flatMap((definition) => {
    const profile = profiles[definition.optionKey];
    return [
      { profileId: definition.profileId, role: "target" as const, path: profile.targetPath },
      { profileId: definition.profileId, role: "backup" as const, path: profile.backupDir },
      { profileId: definition.profileId, role: "journal" as const, path: profile.journalPath },
      { profileId: definition.profileId, role: "journal-lock" as const, path: `${profile.journalPath}.lock` },
    ];
  }).map((entry) => Object.freeze({
    ...entry,
    canonicalPath: normalizePath(resolve(entry.path)),
  }));

  for (let leftIndex = 0; leftIndex < storage.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < storage.length; rightIndex += 1) {
      const left = storage[leftIndex]!;
      const right = storage[rightIndex]!;
      if (left.canonicalPath === right.canonicalPath) throw configurationError();
      if (
        (left.role === "backup" && pathContains(left.canonicalPath, right.canonicalPath))
        || (right.role === "backup" && pathContains(right.canonicalPath, left.canonicalPath))
      ) {
        throw configurationError();
      }
    }
  }

  try {
    const targets = await Promise.all(PROFILE_DEFINITIONS.map(async (definition) => {
      const targetPath = profiles[definition.optionKey].targetPath;
      const [resolvedTarget, stat] = await Promise.all([
        realpath(targetPath),
        lstat(targetPath, { bigint: true }),
      ]);
      return Object.freeze({
        canonicalPath: normalizePath(resolve(resolvedTarget)),
        device: stat.dev,
        inode: stat.ino,
      });
    }));
    for (let leftIndex = 0; leftIndex < targets.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < targets.length; rightIndex += 1) {
        const left = targets[leftIndex]!;
        const right = targets[rightIndex]!;
        if (
          left.canonicalPath === right.canonicalPath
          || (left.inode !== 0n && left.device === right.device && left.inode === right.inode)
        ) {
          throw configurationError();
        }
      }
    }
  } catch (error) {
    if (error instanceof LocalClientOnboardingError) throw error;
    throw configurationError();
  }
}

function pathContains(parentPath: string, candidatePath: string): boolean {
  const suffix = relative(parentPath, candidatePath);
  return suffix !== ""
    && suffix !== ".."
    && !suffix.startsWith(`..${sep}`)
    && !isAbsolute(suffix);
}

function toTransactionOptions(
  paths: LocalClientOnboardingBoundPaths,
  options: Pick<LocalClientOnboardingRegistryOptions, "committedRetentionMs" | "backupEncryptionKey">,
): LocalClientConfigTransactionOptions {
  return {
    targetPath: paths.targetPath,
    allowedRoot: paths.allowedRoot,
    backupDir: paths.backupDir,
    journalPath: paths.journalPath,
    ...(paths.maxBytes === undefined ? {} : { maxBytes: paths.maxBytes }),
    ...(paths.maxTransactions === undefined ? {} : { maxTransactions: paths.maxTransactions }),
    ...(paths.clock === undefined ? {} : { clock: paths.clock }),
    ...(options.committedRetentionMs === undefined
      ? {}
      : { committedRetentionMs: options.committedRetentionMs }),
    ...(options.backupEncryptionKey === undefined
      ? {}
      : { backupEncryptionKey: options.backupEncryptionKey }),
  };
}

function assertProfileOperable(profile: ProfileRecord): void {
  const status = profile.engine.getStatus();
  if (status.recoveryRequired || status.journalCorrupt) throw recoveryRequiredError();
}

async function readBoundJsonObject(
  targetPath: string,
  allowedRoot: string,
  maxBytes: number,
): Promise<Record<string, unknown>> {
  try {
    const [rootStat, targetBefore] = await Promise.all([lstat(allowedRoot), lstat(targetPath)]);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw configInvalidError();
    if (
      !targetBefore.isFile()
      || targetBefore.isSymbolicLink()
      || targetBefore.size < 2
      || targetBefore.size > maxBytes
    ) throw configInvalidError();
    const [resolvedRoot, resolvedTarget] = await Promise.all([
      realpath(allowedRoot),
      realpath(targetPath),
    ]);
    if (!isInside(resolvedRoot, resolvedTarget)) throw configInvalidError();
    const bytes = await readFile(targetPath);
    const targetAfter = await lstat(targetPath);
    if (
      targetAfter.isSymbolicLink()
      || targetBefore.dev !== targetAfter.dev
      || targetBefore.ino !== targetAfter.ino
      || targetBefore.size !== targetAfter.size
      || targetBefore.mtimeMs !== targetAfter.mtimeMs
      || bytes.byteLength !== targetAfter.size
    ) throw configInvalidError();
    const parsed: unknown = JSON.parse(bytes.toString("utf8"));
    if (!isPlainRecord(parsed)) throw configInvalidError();
    return parsed;
  } catch (error) {
    if (error instanceof LocalClientOnboardingError) throw error;
    throw configInvalidError();
  }
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function publicPlanId(profileId: LocalClientOnboardingProfileId, transactionPlanId: string): string {
  if (!SHA256_PATTERN.test(transactionPlanId)) throw planUnknownError();
  return `onboard:${profileId}:${transactionPlanId}`;
}

function parsePublicPlanId(value: unknown): Readonly<{
  profileId: LocalClientOnboardingProfileId;
  transactionPlanId: string;
}> {
  if (typeof value !== "string" || value.length > 160) throw planUnknownError();
  const match = PUBLIC_PLAN_PATTERN.exec(value);
  if (!match) throw planUnknownError();
  const profileId = match[1] as LocalClientOnboardingProfileId;
  if (!Object.values(LOCAL_CLIENT_ONBOARDING_PROFILE_IDS).includes(profileId)) throw planUnknownError();
  return Object.freeze({ profileId, transactionPlanId: match[2]! });
}

function normalizeAction(value: unknown): LocalClientOnboardingAction {
  if (value !== "enable" && value !== "disable") throw actionError();
  return value;
}

function validateOnboardingReceipt(value: unknown): LocalClientOnboardingReceipt {
  assertExactObject(
    value,
    [
      "receiptVersion",
      "profileId",
      "action",
      "planId",
      "transaction",
      "receiptDigest",
      "format",
      "certificationStatus",
      "redacted",
    ],
    new Set(),
    receiptError,
  );
  if (
    value.receiptVersion !== LOCAL_CLIENT_ONBOARDING_RECEIPT_VERSION
    || value.format !== "json-only"
    || value.certificationStatus !== LOCAL_CLIENT_ONBOARDING_CERTIFICATION_STATUS
    || value.redacted !== true
    || !isProfileId(value.profileId)
    || (value.action !== "enable" && value.action !== "disable")
    || typeof value.planId !== "string"
    || typeof value.receiptDigest !== "string"
    || !SHA256_PATTERN.test(value.receiptDigest)
    || !isPlainRecord(value.transaction)
  ) throw receiptError();
  const parsedPlan = parsePublicPlanId(value.planId);
  if (parsedPlan.profileId !== value.profileId || parsedPlan.transactionPlanId !== value.transaction.planId) {
    throw receiptError();
  }
  const expected = onboardingReceiptDigest({
    profileId: value.profileId,
    action: value.action,
    planId: value.planId,
    transactionReceiptDigest: String(value.transaction.receiptDigest ?? ""),
  });
  if (expected !== value.receiptDigest) throw receiptError();
  return value as unknown as LocalClientOnboardingReceipt;
}

function isProfileId(value: unknown): value is LocalClientOnboardingProfileId {
  return typeof value === "string"
    && (Object.values(LOCAL_CLIENT_ONBOARDING_PROFILE_IDS) as readonly string[]).includes(value);
}

function onboardingReceiptDigest(input: Readonly<{
  profileId: LocalClientOnboardingProfileId;
  action: LocalClientOnboardingAction;
  planId: string;
  transactionReceiptDigest: string;
}>): string {
  return createHash("sha256")
    .update("local-client-onboarding-receipt-v1\0", "utf8")
    .update(canonicalJson(input), "utf8")
    .digest("hex");
}

function freezeTransactionReceipt(value: LocalClientConfigReceipt): LocalClientConfigReceipt {
  return Object.freeze({ ...value });
}

function freezeRecoveryReceipt(value: LocalClientConfigRecoveryReceipt): LocalClientConfigRecoveryReceipt {
  return Object.freeze({
    ...value,
    applyReceipt: value.applyReceipt === null ? null : Object.freeze({ ...value.applyReceipt }),
    rollbackReceipt: value.rollbackReceipt === null ? null : Object.freeze({ ...value.rollbackReceipt }),
  });
}

function deepFreezeJson<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreezeJson(nested);
    Object.freeze(value);
  }
  return value;
}

function boundedString(value: unknown, maxBytes: number, allowEmpty = false): string {
  if (
    typeof value !== "string"
    || (!allowEmpty && value.length === 0)
    || value.length > maxBytes
    || Buffer.byteLength(value, "utf8") > maxBytes
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) throw configurationError();
  return value;
}

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  const normalized = value ?? fallback;
  if (!Number.isSafeInteger(normalized) || normalized < min || normalized > max) {
    throw configurationError();
  }
  return normalized;
}

function normalizePath(value: string): string {
  const normalized = resolve(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function assertExactObject(
  value: unknown,
  keys: readonly string[],
  optional: ReadonlySet<string>,
  errorFactory: () => Error = configurationError,
): asserts value is Record<string, unknown> {
  if (!isPlainRecord(value)) throw errorFactory();
  const actual = Reflect.ownKeys(value);
  if (actual.some((key) => typeof key !== "string" || !keys.includes(key))) throw errorFactory();
  for (const key of keys) {
    if (!optional.has(key) && !Object.hasOwn(value, key)) throw errorFactory();
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(",")}}`;
}

function configurationError(): LocalClientOnboardingError {
  return new LocalClientOnboardingError(
    "LOCAL_CLIENT_ONBOARDING_CONFIGURATION_INVALID",
    "The code-bound local-client onboarding configuration is invalid.",
    "configuration",
    500,
  );
}

function profileUnknownError(): LocalClientOnboardingError {
  return new LocalClientOnboardingError(
    "LOCAL_CLIENT_ONBOARDING_PROFILE_UNKNOWN",
    "The code-registered local-client onboarding profile is unknown.",
    "validation",
    404,
  );
}

function actionError(): LocalClientOnboardingError {
  return new LocalClientOnboardingError(
    "LOCAL_CLIENT_ONBOARDING_ACTION_INVALID",
    "The local-client onboarding action must be enable or disable.",
    "validation",
    400,
  );
}

function planUnknownError(): LocalClientOnboardingError {
  return new LocalClientOnboardingError(
    "LOCAL_CLIENT_ONBOARDING_PLAN_UNKNOWN",
    "The local-client onboarding plan is unknown, expired, or belongs to another registry.",
    "conflict",
    409,
  );
}

function planProfileMismatchError(): LocalClientOnboardingError {
  return new LocalClientOnboardingError(
    "LOCAL_CLIENT_ONBOARDING_PLAN_PROFILE_MISMATCH",
    "The local-client onboarding plan is bound to another profile.",
    "integrity",
    409,
  );
}

function receiptError(): LocalClientOnboardingError {
  return new LocalClientOnboardingError(
    "LOCAL_CLIENT_ONBOARDING_RECEIPT_INVALID",
    "The local-client onboarding receipt is invalid or belongs to another profile.",
    "integrity",
    409,
  );
}

function configInvalidError(): LocalClientOnboardingError {
  return new LocalClientOnboardingError(
    "LOCAL_CLIENT_ONBOARDING_CONFIG_INVALID",
    "The code-bound local-client JSON configuration is invalid or changed during inspection.",
    "integrity",
    409,
  );
}

function recoveryRequiredError(): LocalClientOnboardingError {
  return new LocalClientOnboardingError(
    "LOCAL_CLIENT_ONBOARDING_RECOVERY_REQUIRED",
    "The local-client onboarding profile requires explicit transaction recovery.",
    "integrity",
    409,
  );
}

function recoveryNotRequiredError(): LocalClientOnboardingError {
  return new LocalClientOnboardingError(
    "LOCAL_CLIENT_ONBOARDING_RECOVERY_NOT_REQUIRED",
    "The local-client onboarding profile has no pending transaction to recover.",
    "conflict",
    409,
  );
}
