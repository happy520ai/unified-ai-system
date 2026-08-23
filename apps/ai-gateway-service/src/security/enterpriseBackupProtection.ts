import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  hkdfSync,
  randomBytes,
  sign as createSignature,
  verify as verifySignature,
  type KeyObject,
} from "node:crypto";
import { readFileSync, statSync } from "node:fs";

export const ENTERPRISE_BACKUP_PAYLOAD_TYPE = "pme-enterprise-backup";
export const ENTERPRISE_BACKUP_PAYLOAD_VERSION = 3;

const ENVELOPE_TYPE = "pme-enterprise-backup-envelope";
const ENVELOPE_VERSION = 1;
const CHECKPOINT_TYPE = "pme-enterprise-backup-checkpoint";
const CHECKPOINT_VERSION = 1;
const ALGORITHM = "aes-256-gcm";
const SIGNING_ALGORITHM = "ed25519";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const SIGNATURE_BYTES = 64;
const MAX_KEY_FILE_BYTES = 4096;
const MAX_PREVIOUS_KEYS = 3;
const MAX_PLAINTEXT_BYTES = 16 * 1024 * 1024;
const HKDF_SALT = Buffer.from("pme-enterprise-backup:v1", "utf8");
const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

type RuntimeEnv = Record<string, string | undefined>;
type BackupPayload = Record<string, unknown>;

interface BackupKeyEntry {
  keyId: string;
  encryptionKey: Buffer;
  signingKeyId: string;
  signingPrivateKey: KeyObject;
  signingPublicKey: KeyObject;
}

export interface EnterpriseBackupEnvelope {
  type: typeof ENVELOPE_TYPE;
  version: typeof ENVELOPE_VERSION;
  payloadType: typeof ENTERPRISE_BACKUP_PAYLOAD_TYPE;
  payloadVersion: typeof ENTERPRISE_BACKUP_PAYLOAD_VERSION;
  backupId: string;
  tenantId: string;
  sequence: number;
  generatedAt: string;
  previousBackupDigest: string | null;
  algorithm: typeof ALGORITHM;
  keyId: string;
  signingAlgorithm: typeof SIGNING_ALGORITHM;
  signingKeyId: string;
  iv: string;
  tag: string;
  ciphertext: string;
  signature: string;
}

export interface EnterpriseBackupCheckpoint {
  type: typeof CHECKPOINT_TYPE;
  version: typeof CHECKPOINT_VERSION;
  tenantBinding: string;
  sequence: number;
  artifactDigest: string;
  updatedAt: string;
  keyId: string;
  signingAlgorithm: typeof SIGNING_ALGORITHM;
  signingKeyId: string;
  signature: string;
}

export interface OpenedEnterpriseBackup {
  payload: BackupPayload;
  artifactDigest: string;
  envelope: EnterpriseBackupEnvelope;
}

export interface EnterpriseBackupProtector {
  readonly keyId: string;
  readonly signingKeyId: string;
  readonly algorithm: typeof ALGORITHM;
  readonly signingAlgorithm: typeof SIGNING_ALGORITHM;
  sealBackup(input: {
    payload: BackupPayload;
    backupId: string;
    tenantId: string;
    sequence: number;
    generatedAt: string;
    previousBackupDigest?: string | null;
  }): { envelope: EnterpriseBackupEnvelope; artifactDigest: string };
  openBackup(value: unknown, expectedTenantId: string): OpenedEnterpriseBackup;
  sealCheckpoint(input: {
    tenantId: string;
    sequence: number;
    artifactDigest: string;
    updatedAt: string;
  }): EnterpriseBackupCheckpoint;
  openCheckpoint(value: unknown, expectedTenantId: string): EnterpriseBackupCheckpoint;
}

export function createEnterpriseBackupProtector({
  env = process.env,
}: { env?: RuntimeEnv } = {}): EnterpriseBackupProtector {
  const primary = createKeyEntry(readPrimaryKey(env));
  const keyring = new Map<string, BackupKeyEntry>([[primary.keyId, primary]]);

  for (const key of readPreviousKeys(env)) {
    const entry = createKeyEntry(key);
    if (!keyring.has(entry.keyId)) keyring.set(entry.keyId, entry);
  }

  return Object.freeze({
    keyId: primary.keyId,
    signingKeyId: primary.signingKeyId,
    algorithm: ALGORITHM,
    signingAlgorithm: SIGNING_ALGORITHM,

    sealBackup(input) {
      assertBackupContext(input);
      assertPayloadMetadata(input.payload, input);
      const plaintext = Buffer.from(JSON.stringify(input.payload), "utf8");
      if (plaintext.length === 0 || plaintext.length > MAX_PLAINTEXT_BYTES) {
        throw backupProtectionError(
          "ENTERPRISE_BACKUP_PAYLOAD_TOO_LARGE",
          "Enterprise backup payload exceeds the encrypted artifact limit.",
        );
      }

      const metadata = createEnvelopeMetadata({
        backupId: input.backupId,
        tenantId: input.tenantId,
        sequence: input.sequence,
        generatedAt: input.generatedAt,
        previousBackupDigest: input.previousBackupDigest ?? null,
        keyId: primary.keyId,
        signingKeyId: primary.signingKeyId,
      });
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(ALGORITHM, primary.encryptionKey, iv);
      cipher.setAAD(canonicalBytes(metadata));
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const unsignedEnvelope = {
        ...metadata,
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        ciphertext: ciphertext.toString("base64"),
      };
      const signature = createSignature(null, canonicalBytes(unsignedEnvelope), primary.signingPrivateKey);
      const envelope: EnterpriseBackupEnvelope = {
        ...unsignedEnvelope,
        signature: signature.toString("base64"),
      };
      return {
        envelope,
        artifactDigest: digestEnvelope(envelope),
      };
    },

    openBackup(value, expectedTenantId) {
      assertTenantId(expectedTenantId);
      assertEnvelope(value);
      const envelope = value;
      if (envelope.tenantId !== expectedTenantId) {
        throw backupProtectionError(
          "ENTERPRISE_BACKUP_TENANT_MISMATCH",
          "Enterprise backup tenant binding does not match the authenticated tenant.",
        );
      }
      const key = keyring.get(envelope.keyId);
      if (!key || key.signingKeyId !== envelope.signingKeyId) {
        throw backupProtectionError(
          "ENTERPRISE_BACKUP_MASTER_KEY_MISMATCH",
          "No configured enterprise backup key can verify and decrypt this artifact.",
        );
      }

      const unsignedEnvelope = createUnsignedEnvelope(envelope);
      const signature = decodeCanonicalBase64(envelope.signature, SIGNATURE_BYTES, "signature");
      if (!verifySignature(null, canonicalBytes(unsignedEnvelope), key.signingPublicKey, signature)) {
        throw backupProtectionError(
          "ENTERPRISE_BACKUP_SIGNATURE_INVALID",
          "Enterprise backup manifest signature verification failed.",
        );
      }

      let payload: BackupPayload;
      try {
        const iv = decodeCanonicalBase64(envelope.iv, IV_BYTES, "iv");
        const tag = decodeCanonicalBase64(envelope.tag, TAG_BYTES, "tag");
        const ciphertext = decodeCanonicalBase64(envelope.ciphertext, undefined, "ciphertext");
        if (ciphertext.length === 0 || ciphertext.length > MAX_PLAINTEXT_BYTES + TAG_BYTES) {
          throw new Error("ciphertext length is invalid");
        }
        const decipher = createDecipheriv(ALGORITHM, key.encryptionKey, iv);
        decipher.setAAD(canonicalBytes(createEnvelopeMetadata(envelope)));
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        payload = JSON.parse(plaintext.toString("utf8")) as BackupPayload;
      } catch (error) {
        if (isEnterpriseBackupProtectionError(error)) throw error;
        throw backupProtectionError(
          "ENTERPRISE_BACKUP_AUTHENTICATION_FAILED",
          "Enterprise backup authentication or decryption failed.",
        );
      }
      assertPayloadMetadata(payload, envelope);

      return {
        payload,
        envelope,
        artifactDigest: digestEnvelope(envelope),
      };
    },

    sealCheckpoint(input) {
      assertTenantId(input.tenantId);
      assertPositiveSequence(input.sequence);
      assertDigest(input.artifactDigest, "artifactDigest");
      assertIsoTimestamp(input.updatedAt, "updatedAt");
      const unsignedCheckpoint = {
        type: CHECKPOINT_TYPE,
        version: CHECKPOINT_VERSION,
        tenantBinding: createEnterpriseBackupTenantBinding(input.tenantId),
        sequence: input.sequence,
        artifactDigest: input.artifactDigest,
        updatedAt: input.updatedAt,
        keyId: primary.keyId,
        signingAlgorithm: SIGNING_ALGORITHM,
        signingKeyId: primary.signingKeyId,
      } as const;
      return {
        ...unsignedCheckpoint,
        signature: createSignature(null, canonicalBytes(unsignedCheckpoint), primary.signingPrivateKey).toString("base64"),
      };
    },

    openCheckpoint(value, expectedTenantId) {
      assertTenantId(expectedTenantId);
      assertCheckpoint(value);
      const checkpoint = value;
      if (checkpoint.tenantBinding !== createEnterpriseBackupTenantBinding(expectedTenantId)) {
        throw backupProtectionError(
          "ENTERPRISE_BACKUP_CHECKPOINT_TENANT_MISMATCH",
          "Enterprise backup checkpoint is bound to another tenant.",
        );
      }
      const key = keyring.get(checkpoint.keyId);
      if (!key || key.signingKeyId !== checkpoint.signingKeyId) {
        throw backupProtectionError(
          "ENTERPRISE_BACKUP_CHECKPOINT_KEY_MISMATCH",
          "No configured enterprise backup key can verify this checkpoint.",
        );
      }
      const unsignedCheckpoint = createUnsignedCheckpoint(checkpoint);
      const signature = decodeCanonicalBase64(checkpoint.signature, SIGNATURE_BYTES, "checkpoint signature");
      if (!verifySignature(null, canonicalBytes(unsignedCheckpoint), key.signingPublicKey, signature)) {
        throw backupProtectionError(
          "ENTERPRISE_BACKUP_CHECKPOINT_SIGNATURE_INVALID",
          "Enterprise backup checkpoint signature verification failed.",
        );
      }
      return checkpoint;
    },
  });
}

export function createEnterpriseBackupTenantBinding(tenantId: string): string {
  assertTenantId(tenantId);
  return createHash("sha256").update("pme-enterprise-backup-tenant:v1:").update(tenantId).digest("hex");
}

export function isEnterpriseBackupProtectionError(error: unknown): error is Error & { code: string } {
  if (!(error instanceof Error)) return false;
  const candidate = error as { code?: unknown; category?: unknown };
  return candidate.category === "security" &&
    typeof candidate.code === "string" &&
    candidate.code.startsWith("ENTERPRISE_BACKUP_");
}

function readPrimaryKey(env: RuntimeEnv): Buffer {
  const inline = String(env.PME_ENTERPRISE_BACKUP_MASTER_KEY ?? "").trim();
  const filePath = String(env.PME_ENTERPRISE_BACKUP_MASTER_KEY_FILE ?? "").trim();
  if (inline && filePath) {
    throw backupProtectionError(
      "ENTERPRISE_BACKUP_MASTER_KEY_AMBIGUOUS",
      "Configure either the enterprise backup master key or its file, not both.",
    );
  }
  if (!inline && !filePath) {
    throw backupProtectionError(
      "ENTERPRISE_BACKUP_MASTER_KEY_REQUIRED",
      "Encrypted enterprise backups require a dedicated 256-bit master key.",
    );
  }
  return parseKeyMaterial(inline || readKeyFile(filePath));
}

function readPreviousKeys(env: RuntimeEnv): Buffer[] {
  const raw = String(env.PME_ENTERPRISE_BACKUP_PREVIOUS_MASTER_KEYS ?? "").trim();
  if (!raw) return [];
  const values = raw.split(",").map((value) => value.trim()).filter(Boolean);
  if (values.length > MAX_PREVIOUS_KEYS) {
    throw backupProtectionError(
      "ENTERPRISE_BACKUP_PREVIOUS_KEYS_LIMIT",
      "At most three previous enterprise backup keys may be configured.",
    );
  }
  return values.map(parseKeyMaterial);
}

function readKeyFile(filePath: string): string {
  try {
    const fileStat = statSync(filePath);
    if (!fileStat.isFile() || fileStat.size <= 0 || fileStat.size > MAX_KEY_FILE_BYTES) {
      throw new Error("invalid key file size or type");
    }
    if (process.platform !== "win32" && (fileStat.mode & 0o077) !== 0) {
      throw backupProtectionError(
        "ENTERPRISE_BACKUP_MASTER_KEY_FILE_PERMISSIONS",
        "Enterprise backup key files must not be accessible by group or other users.",
      );
    }
    return readFileSync(filePath, "utf8").trim();
  } catch (error) {
    if (isEnterpriseBackupProtectionError(error)) throw error;
    throw backupProtectionError(
      "ENTERPRISE_BACKUP_MASTER_KEY_FILE_INVALID",
      "Enterprise backup master key file could not be read securely.",
    );
  }
}

function parseKeyMaterial(value: string): Buffer {
  const material = value.trim();
  let key: Buffer;
  if (/^(?:hex:)?[a-fA-F0-9]{64}$/.test(material)) {
    key = Buffer.from(material.replace(/^hex:/, ""), "hex");
  } else {
    const base64 = material.replace(/^base64:/, "");
    if (!/^[A-Za-z0-9+/]{43}=$/.test(base64)) throw invalidKeyError();
    key = Buffer.from(base64, "base64");
    if (key.toString("base64") !== base64) throw invalidKeyError();
  }
  if (key.length !== KEY_BYTES) throw invalidKeyError();
  return key;
}

function createKeyEntry(masterKey: Buffer): BackupKeyEntry {
  const encryptionKey = deriveKey(masterKey, "encryption-key");
  const signingSeed = deriveKey(masterKey, "ed25519-signing-seed");
  const signingPrivateKey = createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, signingSeed]),
    format: "der",
    type: "pkcs8",
  });
  const signingPublicKey = createPublicKey(signingPrivateKey);
  const publicDer = signingPublicKey.export({ format: "der", type: "spki" });
  return {
    keyId: createHash("sha256").update(masterKey).digest("hex").slice(0, 16),
    encryptionKey,
    signingKeyId: createHash("sha256").update(publicDer).digest("hex").slice(0, 16),
    signingPrivateKey,
    signingPublicKey,
  };
}

function deriveKey(masterKey: Buffer, purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", masterKey, HKDF_SALT, Buffer.from(purpose, "utf8"), KEY_BYTES));
}

function createEnvelopeMetadata(input: {
  backupId: string;
  tenantId: string;
  sequence: number;
  generatedAt: string;
  previousBackupDigest?: string | null;
  keyId: string;
  signingKeyId: string;
}) {
  return {
    type: ENVELOPE_TYPE,
    version: ENVELOPE_VERSION,
    payloadType: ENTERPRISE_BACKUP_PAYLOAD_TYPE,
    payloadVersion: ENTERPRISE_BACKUP_PAYLOAD_VERSION,
    backupId: input.backupId,
    tenantId: input.tenantId,
    sequence: input.sequence,
    generatedAt: input.generatedAt,
    previousBackupDigest: input.previousBackupDigest ?? null,
    algorithm: ALGORITHM,
    keyId: input.keyId,
    signingAlgorithm: SIGNING_ALGORITHM,
    signingKeyId: input.signingKeyId,
  } as const;
}

function createUnsignedEnvelope(envelope: EnterpriseBackupEnvelope) {
  return {
    ...createEnvelopeMetadata(envelope),
    iv: envelope.iv,
    tag: envelope.tag,
    ciphertext: envelope.ciphertext,
  };
}

function createUnsignedCheckpoint(checkpoint: EnterpriseBackupCheckpoint) {
  return {
    type: checkpoint.type,
    version: checkpoint.version,
    tenantBinding: checkpoint.tenantBinding,
    sequence: checkpoint.sequence,
    artifactDigest: checkpoint.artifactDigest,
    updatedAt: checkpoint.updatedAt,
    keyId: checkpoint.keyId,
    signingAlgorithm: checkpoint.signingAlgorithm,
    signingKeyId: checkpoint.signingKeyId,
  };
}

function digestEnvelope(envelope: EnterpriseBackupEnvelope): string {
  return createHash("sha256").update(canonicalBytes(envelope)).digest("hex");
}

function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function assertEnvelope(value: unknown): asserts value is EnterpriseBackupEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidEnvelopeError();
  const candidate = value as Partial<EnterpriseBackupEnvelope>;
  const expectedKeys = [
    "algorithm", "backupId", "ciphertext", "generatedAt", "iv", "keyId", "payloadType",
    "payloadVersion", "previousBackupDigest", "sequence", "signature", "signingAlgorithm",
    "signingKeyId", "tag", "tenantId", "type", "version",
  ];
  if (JSON.stringify(Object.keys(candidate).sort()) !== JSON.stringify(expectedKeys)) throw invalidEnvelopeError();
  if (candidate.type !== ENVELOPE_TYPE || candidate.version !== ENVELOPE_VERSION ||
      candidate.payloadType !== ENTERPRISE_BACKUP_PAYLOAD_TYPE || candidate.payloadVersion !== ENTERPRISE_BACKUP_PAYLOAD_VERSION ||
      candidate.algorithm !== ALGORITHM || candidate.signingAlgorithm !== SIGNING_ALGORITHM) throw invalidEnvelopeError();
  assertBackupId(candidate.backupId);
  assertTenantId(candidate.tenantId);
  assertPositiveSequence(candidate.sequence);
  assertIsoTimestamp(candidate.generatedAt, "generatedAt");
  assertOptionalDigest(candidate.previousBackupDigest, "previousBackupDigest");
  assertBoundedIdentifier(candidate.keyId, "keyId");
  assertBoundedIdentifier(candidate.signingKeyId, "signingKeyId");
  if (typeof candidate.iv !== "string" || typeof candidate.tag !== "string" ||
      typeof candidate.ciphertext !== "string" || typeof candidate.signature !== "string") throw invalidEnvelopeError();
}

function assertCheckpoint(value: unknown): asserts value is EnterpriseBackupCheckpoint {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidCheckpointError();
  const candidate = value as Partial<EnterpriseBackupCheckpoint>;
  const expectedKeys = [
    "artifactDigest", "keyId", "sequence", "signature", "signingAlgorithm", "signingKeyId",
    "tenantBinding", "type", "updatedAt", "version",
  ];
  if (JSON.stringify(Object.keys(candidate).sort()) !== JSON.stringify(expectedKeys)) throw invalidCheckpointError();
  if (candidate.type !== CHECKPOINT_TYPE || candidate.version !== CHECKPOINT_VERSION ||
      candidate.signingAlgorithm !== SIGNING_ALGORITHM || typeof candidate.tenantBinding !== "string" ||
      !/^[a-f0-9]{64}$/.test(candidate.tenantBinding)) throw invalidCheckpointError();
  assertPositiveSequence(candidate.sequence);
  assertDigest(candidate.artifactDigest, "artifactDigest");
  assertIsoTimestamp(candidate.updatedAt, "updatedAt");
  assertBoundedIdentifier(candidate.keyId, "keyId");
  assertBoundedIdentifier(candidate.signingKeyId, "signingKeyId");
  if (typeof candidate.signature !== "string") throw invalidCheckpointError();
}

function assertBackupContext(input: {
  payload: BackupPayload;
  backupId: string;
  tenantId: string;
  sequence: number;
  generatedAt: string;
  previousBackupDigest?: string | null;
}) {
  assertBackupId(input.backupId);
  assertTenantId(input.tenantId);
  assertPositiveSequence(input.sequence);
  assertIsoTimestamp(input.generatedAt, "generatedAt");
  assertOptionalDigest(input.previousBackupDigest ?? null, "previousBackupDigest");
}

function assertPayloadMetadata(payload: BackupPayload, context: {
  backupId: string;
  tenantId: string;
  sequence: number;
  generatedAt: string;
}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
      payload.type !== ENTERPRISE_BACKUP_PAYLOAD_TYPE || payload.version !== ENTERPRISE_BACKUP_PAYLOAD_VERSION ||
      payload.backupId !== context.backupId || payload.tenantId !== context.tenantId ||
      payload.sequence !== context.sequence || payload.generatedAt !== context.generatedAt) {
    throw backupProtectionError(
      "ENTERPRISE_BACKUP_PAYLOAD_METADATA_MISMATCH",
      "Enterprise backup payload does not match its authenticated envelope metadata.",
    );
  }
}

function assertBackupId(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length < 8 || value.length > 192 || !/^[A-Za-z0-9._:-]+$/.test(value)) {
    throw invalidEnvelopeError();
  }
}

function assertTenantId(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 128 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw backupProtectionError("ENTERPRISE_BACKUP_TENANT_INVALID", "Enterprise backup tenant identity is invalid.");
  }
}

function assertPositiveSequence(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw backupProtectionError("ENTERPRISE_BACKUP_SEQUENCE_INVALID", "Enterprise backup sequence is invalid.");
  }
}

function assertIsoTimestamp(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length > 40) {
    throw backupProtectionError("ENTERPRISE_BACKUP_TIMESTAMP_INVALID", `Enterprise backup ${label} is invalid.`);
  }
  try {
    if (new Date(value).toISOString() !== value) throw new Error("not canonical");
  } catch {
    throw backupProtectionError("ENTERPRISE_BACKUP_TIMESTAMP_INVALID", `Enterprise backup ${label} is invalid.`);
  }
}

function assertDigest(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw backupProtectionError("ENTERPRISE_BACKUP_DIGEST_INVALID", `Enterprise backup ${label} is invalid.`);
  }
}

function assertOptionalDigest(value: unknown, label: string): asserts value is string | null {
  if (value !== null) assertDigest(value, label);
}

function assertBoundedIdentifier(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length < 8 || value.length > 128 || !/^[a-zA-Z0-9._:-]+$/.test(value)) {
    throw backupProtectionError("ENTERPRISE_BACKUP_IDENTIFIER_INVALID", `Enterprise backup ${label} is invalid.`);
  }
}

function decodeCanonicalBase64(value: string, expectedBytes: number | undefined, label: string): Buffer {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw backupProtectionError("ENTERPRISE_BACKUP_ENCODING_INVALID", `Enterprise backup ${label} is not canonical base64.`);
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value || (expectedBytes !== undefined && decoded.length !== expectedBytes)) {
    throw backupProtectionError("ENTERPRISE_BACKUP_ENCODING_INVALID", `Enterprise backup ${label} has an invalid length.`);
  }
  return decoded;
}

function invalidKeyError() {
  return backupProtectionError(
    "ENTERPRISE_BACKUP_MASTER_KEY_INVALID",
    "Enterprise backup master keys must be exactly 32 bytes encoded as canonical base64 or 64 hex characters.",
  );
}

function invalidEnvelopeError() {
  return backupProtectionError("ENTERPRISE_BACKUP_ENVELOPE_INVALID", "Enterprise backup envelope is invalid.");
}

function invalidCheckpointError() {
  return backupProtectionError("ENTERPRISE_BACKUP_CHECKPOINT_INVALID", "Enterprise backup checkpoint is invalid.");
}

function backupProtectionError(code: string, message: string): Error & {
  code: string;
  category: string;
  retryable: boolean;
} {
  return Object.assign(new Error(message), {
    code,
    category: "security",
    retryable: false,
  });
}
