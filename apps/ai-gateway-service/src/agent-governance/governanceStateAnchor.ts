/**
 * Single-owner rollback detection for the JSON Agent Governance backend.
 *
 * The signed anchor authenticates every registered state file. A separately
 * signed checkpoint detects replacement of only the anchor, while a durable
 * write-ahead journal makes every file/anchor/checkpoint update replayable.
 * The two heads deliberately live beside the JSON backend: restoring the
 * entire directory (including both heads and the secret) remains outside this
 * local-only trust boundary.
 */

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { stableStringify } from "@unified-ai-system/policy-engine";

const ANCHOR_FILE = "governance-state.anchor.json";
const CHECKPOINT_FILE = "governance-state.checkpoint.json";
const INSTALLATION_FILE = "governance-state.installation.json";
const JOURNAL_FILE = "governance-state.journal.json";
const ANCHOR_VERSION = "agent-governance-state-anchor-v1" as const;
const CHECKPOINT_VERSION = "agent-governance-state-checkpoint-v1" as const;
const INSTALLATION_VERSION = "agent-governance-state-installation-v1" as const;
const JOURNAL_VERSION = "agent-governance-state-journal-v1" as const;
const DOMAIN = "unified-ai/agent-governance-state/v1";
const CANONICAL_STATE_FILES = new Set([
  "policies.json",
  "agents.json",
  "approvals.json",
  "usage.json",
  "audit-events.jsonl",
]);

export type GovernanceStateFileKind = "json" | "audit";
export type GovernanceStateCommitStage =
  | "after-journal"
  | "after-file"
  | "after-anchor"
  | "after-checkpoint";

export interface GovernanceStateFileBinding {
  verify(): Promise<void>;
  commit(content: string | Buffer): Promise<void>;
}

export interface GovernanceStateFileBindingOptions {
  filePath: string;
  secret: string;
  kind: GovernanceStateFileKind;
  validateLegacy(content: Buffer): void | Promise<void>;
  /**
   * Migration-only seam for a pre-anchor canonical store. Default false.
   * Normal runtime bindings must never enable this: deleting all three signed
   * heads must not turn existing governance state into a fresh installation.
   */
  allowLegacyStateMigration?: boolean;
  /** Fault-injection seam used only by focused persistence tests. */
  faultInjector?: (stage: GovernanceStateCommitStage) => void | Promise<void>;
}

interface StateEntry {
  sha256: string;
  bytes: number;
  kind: GovernanceStateFileKind;
  auditSequence?: number;
  auditHeadHash?: string;
}

interface AnchorContent {
  version: typeof ANCHOR_VERSION;
  epoch: string;
  revision: number;
  previousAnchorDigest: string | null;
  entries: Record<string, StateEntry>;
}

interface SignedAnchor extends AnchorContent { hmacSha256: string }

interface CheckpointContent {
  version: typeof CHECKPOINT_VERSION;
  epoch: string;
  revision: number;
  anchorDigest: string;
}

interface SignedCheckpoint extends CheckpointContent { hmacSha256: string }

interface InstallationContent {
  version: typeof INSTALLATION_VERSION;
  installationId: string;
  createdAt: string;
}

interface SignedInstallation extends InstallationContent { hmacSha256: string }

interface JournalContent {
  version: typeof JOURNAL_VERSION;
  operationId: string;
  baseAnchor: SignedAnchor | null;
  baseCheckpoint: SignedCheckpoint | null;
  nextAnchor: SignedAnchor;
  nextCheckpoint: SignedCheckpoint;
  installation: SignedInstallation | null;
  writes: Array<{ path: string; contentBase64: string }>;
}

interface SignedJournal extends JournalContent { hmacSha256: string }

interface Registration {
  path: string;
  relativePath: string;
  kind: GovernanceStateFileKind;
  validateLegacy(content: Buffer): void | Promise<void>;
  allowLegacyStateMigration: boolean;
}

class GovernanceStateCoordinator {
  readonly #dataDir: string;
  readonly #secret: string;
  readonly #secretFingerprint: string;
  readonly #registrations = new Map<string, Registration>();
  #tail: Promise<void> = Promise.resolve();

  constructor(dataDir: string, secret: string) {
    this.#dataDir = dataDir;
    this.#secret = secret;
    this.#secretFingerprint = sha256(Buffer.from(secret, "utf8"));
  }

  register(options: GovernanceStateFileBindingOptions): GovernanceStateFileBinding {
    if (!safeEqual(this.#secretFingerprint, sha256(Buffer.from(options.secret, "utf8")))) {
      throw integrity("Conflicting Governance state HMAC secrets were registered for one data directory.");
    }
    const absolutePath = resolve(options.filePath);
    const relativePath = portableRelative(this.#dataDir, absolutePath);
    const registration: Registration = {
      path: absolutePath,
      relativePath,
      kind: options.kind,
      validateLegacy: options.validateLegacy,
      allowLegacyStateMigration: options.allowLegacyStateMigration === true,
    };
    this.#registrations.set(relativePath, registration);
    return {
      verify: () => this.#enqueue(async () => { await this.#loadVerifiedAnchor(); }),
      commit: (content) => this.#enqueue(async () => {
        const current = await this.#loadVerifiedAnchor();
        const bytes = Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(content, "utf8");
        const next = nextAnchor(current.anchor, relativePath, stateEntry(bytes, options.kind), this.#secret);
        const nextCheckpoint = signCheckpoint({
          version: CHECKPOINT_VERSION,
          epoch: next.epoch,
          revision: next.revision,
          anchorDigest: anchorDigest(next),
        }, this.#secret);
        const journal = signJournal({
          version: JOURNAL_VERSION,
          operationId: randomUUID(),
          baseAnchor: current.anchor,
          baseCheckpoint: current.checkpoint,
          nextAnchor: next,
          nextCheckpoint,
          installation: null,
          writes: [{ path: relativePath, contentBase64: bytes.toString("base64") }],
        }, this.#secret);
        await this.#writeJournal(journal);
        await options.faultInjector?.("after-journal");
        await atomicWrite(absolutePath, bytes);
        await options.faultInjector?.("after-file");
        await atomicWrite(this.#anchorPath(), serialize(next));
        await options.faultInjector?.("after-anchor");
        await atomicWrite(this.#checkpointPath(), serialize(nextCheckpoint));
        await options.faultInjector?.("after-checkpoint");
        await removeDurably(this.#journalPath());
      }),
    };
  }

  #enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#tail.then(operation, operation);
    this.#tail = result.then(() => undefined, () => undefined);
    return result;
  }

  async #loadVerifiedAnchor(): Promise<{ anchor: SignedAnchor; checkpoint: SignedCheckpoint }> {
    await mkdir(this.#dataDir, { recursive: true });
    const journal = await readOptionalJson<SignedJournal>(this.#journalPath());
    if (journal) await this.#recover(journal);

    const [anchor, checkpoint, installation] = await Promise.all([
      readOptionalJson<SignedAnchor>(this.#anchorPath()),
      readOptionalJson<SignedCheckpoint>(this.#checkpointPath()),
      readOptionalJson<SignedInstallation>(this.#installationPath()),
    ]);
    if (!anchor && !checkpoint && !installation) {
      await this.#assertBootstrapAllowed();
      await this.#bootstrap();
      return this.#loadVerifiedAnchor();
    }
    if (!anchor || !checkpoint || !installation) {
      throw integrity("Governance state anchor, checkpoint, or installation marker is missing.");
    }
    verifyInstallation(installation, this.#secret);
    verifyAnchor(anchor, this.#secret);
    verifyCheckpoint(checkpoint, this.#secret);
    if (checkpoint.epoch !== anchor.epoch || checkpoint.revision !== anchor.revision
      || !safeEqual(checkpoint.anchorDigest, anchorDigest(anchor))) {
      throw integrity("Governance state anchor and independent checkpoint diverged.");
    }
    await this.#verifyEntries(anchor);
    return { anchor, checkpoint };
  }

  async #assertBootstrapAllowed(): Promise<void> {
    const existingCanonical: string[] = [];
    for (const name of CANONICAL_STATE_FILES) {
      if (await exists(resolve(this.#dataDir, name))) existingCanonical.push(name);
    }
    if (existingCanonical.length === 0) return;

    const unregistered = existingCanonical.filter((name) => !this.#registrations.has(name));
    const migrationDisabled = existingCanonical.filter((name) => (
      this.#registrations.get(name)?.allowLegacyStateMigration !== true
    ));
    if (unregistered.length > 0 || migrationDisabled.length > 0) {
      throw integrity(
        "Existing canonical Governance state cannot bootstrap without all signed heads; "
        + "explicit legacy migration is required and is disabled by default.",
      );
    }
  }

  async #bootstrap(): Promise<void> {
    const entries: Record<string, StateEntry> = {};
    for (const registration of this.#registrations.values()) {
      const content = await readOptionalBuffer(registration.path);
      if (!content) continue;
      try {
        await registration.validateLegacy(content);
      } catch (error) {
        throw integrity(`Legacy governance state ${registration.relativePath} failed complete validation.`, error);
      }
      entries[registration.relativePath] = stateEntry(content, registration.kind);
    }
    for (const name of CANONICAL_STATE_FILES) {
      const path = resolve(this.#dataDir, name);
      if (await exists(path) && !this.#registrations.has(name)) {
        throw integrity(`Legacy governance state ${name} has no registered semantic validator; refusing migration.`);
      }
    }
    const anchor = signAnchor({
      version: ANCHOR_VERSION,
      epoch: randomUUID(),
      revision: 0,
      previousAnchorDigest: null,
      entries,
    }, this.#secret);
    const checkpoint = signCheckpoint({
      version: CHECKPOINT_VERSION,
      epoch: anchor.epoch,
      revision: anchor.revision,
      anchorDigest: anchorDigest(anchor),
    }, this.#secret);
    const installation = signInstallation({
      version: INSTALLATION_VERSION,
      installationId: randomUUID(),
      createdAt: new Date().toISOString(),
    }, this.#secret);
    const journal = signJournal({
      version: JOURNAL_VERSION,
      operationId: randomUUID(),
      baseAnchor: null,
      baseCheckpoint: null,
      nextAnchor: anchor,
      nextCheckpoint: checkpoint,
      installation,
      writes: [],
    }, this.#secret);
    await this.#writeJournal(journal);
    await this.#recover(journal);
    // The exception is migration-only, not a durable runtime mode. Once the
    // signed installation exists, later head deletion in the same process must
    // fail closed unless an operator deliberately starts a new migration.
    for (const registration of this.#registrations.values()) {
      registration.allowLegacyStateMigration = false;
    }
  }

  async #recover(raw: SignedJournal): Promise<void> {
    const journal = verifyJournal(raw, this.#secret);
    const [currentAnchor, currentCheckpoint] = await Promise.all([
      readOptionalJson<SignedAnchor>(this.#anchorPath()),
      readOptionalJson<SignedCheckpoint>(this.#checkpointPath()),
    ]);
    assertRecoverableHead(currentAnchor, journal.baseAnchor, journal.nextAnchor, "anchor", this.#secret);
    assertRecoverableHead(currentCheckpoint, journal.baseCheckpoint, journal.nextCheckpoint, "checkpoint", this.#secret);
    for (const write of journal.writes) {
      const registration = this.#registrations.get(write.path);
      if (!registration) throw integrity(`Journal targets unregistered governance state ${write.path}.`);
      await atomicWrite(registration.path, Buffer.from(write.contentBase64, "base64"));
    }
    if (journal.installation) {
      const existing = await readOptionalJson<SignedInstallation>(this.#installationPath());
      if (existing && !safeEqual(digest(existing), digest(journal.installation))) {
        throw integrity("Governance installation marker diverged during recovery.");
      }
      await atomicWrite(this.#installationPath(), serialize(journal.installation));
    }
    await atomicWrite(this.#anchorPath(), serialize(journal.nextAnchor));
    await atomicWrite(this.#checkpointPath(), serialize(journal.nextCheckpoint));
    await removeDurably(this.#journalPath());
  }

  async #verifyEntries(anchor: SignedAnchor): Promise<void> {
    for (const [path, expected] of Object.entries(anchor.entries)) {
      const registration = this.#registrations.get(path);
      if (!registration) throw integrity(`Anchored governance state ${path} has no registered owner.`);
      const content = await readOptionalBuffer(registration.path);
      if (!content) throw integrity(`Anchored governance state ${path} is missing or was deleted.`);
      const actual = stateEntry(content, expected.kind);
      if (!entryEqual(actual, expected)) {
        throw integrity(`Governance state rollback or tampering detected for ${path}.`);
      }
    }
    for (const registration of this.#registrations.values()) {
      if (!Object.hasOwn(anchor.entries, registration.relativePath) && await exists(registration.path)) {
        throw integrity(`Unanchored governance state appeared at ${registration.relativePath}.`);
      }
    }
  }

  async #writeJournal(journal: SignedJournal): Promise<void> {
    if (await exists(this.#journalPath())) {
      throw integrity("A governance state journal already exists and must be recovered first.");
    }
    await atomicWrite(this.#journalPath(), serialize(journal));
  }

  #anchorPath(): string { return resolve(this.#dataDir, ANCHOR_FILE); }
  #checkpointPath(): string { return resolve(this.#dataDir, CHECKPOINT_FILE); }
  #installationPath(): string { return resolve(this.#dataDir, INSTALLATION_FILE); }
  #journalPath(): string { return resolve(this.#dataDir, JOURNAL_FILE); }
}

const coordinators = new Map<string, GovernanceStateCoordinator>();

export function createGovernanceStateFileBinding(
  options: GovernanceStateFileBindingOptions,
): GovernanceStateFileBinding {
  if (typeof options.secret !== "string" || options.secret.length < 32) {
    throw integrity("Governance state anchor HMAC secret must contain at least 32 characters.");
  }
  const filePath = resolve(options.filePath);
  const dataDir = dirname(filePath);
  let coordinator = coordinators.get(dataDir);
  if (!coordinator) {
    coordinator = new GovernanceStateCoordinator(dataDir, options.secret);
    coordinators.set(dataDir, coordinator);
  }
  return coordinator.register({ ...options, filePath });
}

function nextAnchor(
  current: SignedAnchor,
  path: string,
  entry: StateEntry,
  secret: string,
): SignedAnchor {
  if (!Number.isSafeInteger(current.revision + 1)) throw integrity("Governance state revision overflow.");
  return signAnchor({
    version: ANCHOR_VERSION,
    epoch: current.epoch,
    revision: current.revision + 1,
    previousAnchorDigest: anchorDigest(current),
    entries: { ...current.entries, [path]: entry },
  }, secret);
}

function stateEntry(content: Buffer, kind: GovernanceStateFileKind): StateEntry {
  const entry: StateEntry = { sha256: sha256(content), bytes: content.byteLength, kind };
  if (kind === "audit") {
    const head = auditHead(content);
    entry.auditSequence = head.sequence;
    entry.auditHeadHash = head.hash;
  }
  return entry;
}

function auditHead(content: Buffer): { sequence: number; hash: string } {
  const lines = content.toString("utf8").split("\n").filter((line) => line.trim() !== "");
  if (lines.length === 0) return { sequence: 0, hash: "GENESIS" };
  try {
    const record = JSON.parse(lines.at(-1)!) as { sequence?: unknown; entryHash?: unknown };
    // Segmented audit rotation may remove a fully archived prefix while the
    // logical sequence remains monotonic. The audit log validates every
    // per-segment sequence and HMAC; the anchor binds this exact file and head.
    if (!Number.isSafeInteger(record.sequence) || Number(record.sequence) < 1
      || typeof record.entryHash !== "string" || record.entryHash.length < 16) {
      throw new Error("invalid audit head");
    }
    return { sequence: Number(record.sequence), hash: record.entryHash };
  } catch (error) {
    throw integrity("Governance audit head is malformed.", error);
  }
}

function entryEqual(left: StateEntry, right: StateEntry): boolean {
  return left.bytes === right.bytes && left.kind === right.kind
    && left.auditSequence === right.auditSequence && left.auditHeadHash === right.auditHeadHash
    && safeEqual(left.sha256, right.sha256);
}

function signAnchor(content: AnchorContent, secret: string): SignedAnchor {
  return { ...content, hmacSha256: hmac("anchor", content, secret) };
}
function signCheckpoint(content: CheckpointContent, secret: string): SignedCheckpoint {
  return { ...content, hmacSha256: hmac("checkpoint", content, secret) };
}
function signInstallation(content: InstallationContent, secret: string): SignedInstallation {
  return { ...content, hmacSha256: hmac("installation", content, secret) };
}
function signJournal(content: JournalContent, secret: string): SignedJournal {
  return { ...content, hmacSha256: hmac("journal", content, secret) };
}

function verifyAnchor(raw: SignedAnchor, secret: string): void {
  const { hmacSha256, ...content } = raw ?? {} as SignedAnchor;
  if (content.version !== ANCHOR_VERSION || typeof content.epoch !== "string"
    || !Number.isSafeInteger(content.revision) || content.revision < 0
    || !content.entries || typeof content.entries !== "object" || Array.isArray(content.entries)
    || !safeEqual(hmacSha256, hmac("anchor", content as AnchorContent, secret))) {
    throw integrity("Governance state anchor authentication failed.");
  }
}

function verifyCheckpoint(raw: SignedCheckpoint, secret: string): void {
  const { hmacSha256, ...content } = raw ?? {} as SignedCheckpoint;
  if (content.version !== CHECKPOINT_VERSION || typeof content.epoch !== "string"
    || !Number.isSafeInteger(content.revision) || content.revision < 0
    || typeof content.anchorDigest !== "string"
    || !safeEqual(hmacSha256, hmac("checkpoint", content as CheckpointContent, secret))) {
    throw integrity("Governance state checkpoint authentication failed.");
  }
}

function verifyInstallation(raw: SignedInstallation, secret: string): void {
  const { hmacSha256, ...content } = raw ?? {} as SignedInstallation;
  if (content.version !== INSTALLATION_VERSION || typeof content.installationId !== "string"
    || !Number.isFinite(Date.parse(content.createdAt))
    || !safeEqual(hmacSha256, hmac("installation", content as InstallationContent, secret))) {
    throw integrity("Governance state installation marker authentication failed.");
  }
}

function verifyJournal(raw: SignedJournal, secret: string): SignedJournal {
  const { hmacSha256, ...content } = raw ?? {} as SignedJournal;
  if (content.version !== JOURNAL_VERSION || typeof content.operationId !== "string"
    || !Array.isArray(content.writes)
    || !safeEqual(hmacSha256, hmac("journal", content as JournalContent, secret))) {
    throw integrity("Governance state journal authentication failed.");
  }
  verifyAnchor(content.nextAnchor, secret);
  verifyCheckpoint(content.nextCheckpoint, secret);
  if (content.baseAnchor) verifyAnchor(content.baseAnchor, secret);
  if (content.baseCheckpoint) verifyCheckpoint(content.baseCheckpoint, secret);
  if (content.installation) verifyInstallation(content.installation, secret);
  if (content.nextCheckpoint.revision !== content.nextAnchor.revision
    || content.nextCheckpoint.epoch !== content.nextAnchor.epoch
    || !safeEqual(content.nextCheckpoint.anchorDigest, anchorDigest(content.nextAnchor))) {
    throw integrity("Governance state journal next heads are inconsistent.");
  }
  return raw;
}

function assertRecoverableHead<T extends SignedAnchor | SignedCheckpoint>(
  current: T | null,
  base: T | null,
  next: T,
  label: string,
  secret: string,
): void {
  if (current) {
    if ("entries" in current) verifyAnchor(current as SignedAnchor, secret);
    else verifyCheckpoint(current as SignedCheckpoint, secret);
  }
  const currentDigest = current ? digest(current) : null;
  const baseDigest = base ? digest(base) : null;
  if (currentDigest !== null && !safeEqual(currentDigest, digest(next))
    && (baseDigest === null || !safeEqual(currentDigest, baseDigest))) {
    throw integrity(`Governance ${label} is not at the journal base or next revision.`);
  }
  if (currentDigest === null && base !== null) {
    throw integrity(`Governance ${label} was deleted while a non-bootstrap journal was pending.`);
  }
}

function anchorDigest(anchor: SignedAnchor): string { return sha256(Buffer.from(stableStringify(anchor), "utf8")); }
function digest(value: unknown): string { return sha256(Buffer.from(stableStringify(value), "utf8")); }
function sha256(value: Buffer): string { return createHash("sha256").update(value).digest("hex"); }
function hmac(kind: string, value: unknown, secret: string): string {
  return createHmac("sha256", secret).update(`${DOMAIN}/${kind}\n${stableStringify(value)}`, "utf8").digest("hex");
}

function safeEqual(left: unknown, right: unknown): boolean {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

async function atomicWrite(path: string, content: string | Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmpPath = `${path}.${randomUUID()}.tmp`;
  const handle = await open(tmpPath, "wx", 0o600);
  try {
    await handle.writeFile(content);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(tmpPath, path);
  await syncDirectory(dirname(path));
}

async function removeDurably(path: string): Promise<void> {
  try { await unlink(path); } catch (error) { if (!isMissing(error)) throw error; }
  await syncDirectory(dirname(path));
}

async function syncDirectory(path: string): Promise<void> {
  try {
    const handle = await open(path, "r");
    try { await handle.sync(); } finally { await handle.close(); }
  } catch (error) {
    if (process.platform !== "win32") throw error;
  }
}

async function readOptionalBuffer(path: string): Promise<Buffer | null> {
  try { return await readFile(path); }
  catch (error) {
    if (isMissing(error)) return null;
    throw integrity(`Governance state file ${path} could not be read as a regular file.`, error);
  }
}

async function readOptionalJson<T>(path: string): Promise<T | null> {
  const raw = await readOptionalBuffer(path);
  if (!raw) return null;
  try { return JSON.parse(raw.toString("utf8")) as T; }
  catch (error) { throw integrity(`Governance state metadata ${path} is malformed.`, error); }
}

async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch (error) { if (isMissing(error)) return false; throw error; }
}

function portableRelative(dataDir: string, filePath: string): string {
  const result = relative(resolve(dataDir), filePath).replaceAll("\\", "/");
  if (result === "" || result.startsWith("../") || result.includes("/../") || result.startsWith("/")) {
    throw integrity("Governance state file must be a direct child of its data directory.");
  }
  return result;
}

function serialize(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n`; }
function isMissing(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "ENOENT");
}
function integrity(message: string, cause?: unknown): Error {
  const error = new Error(message, cause === undefined ? undefined : { cause });
  error.name = "GovernanceStateIntegrityError";
  return error;
}
