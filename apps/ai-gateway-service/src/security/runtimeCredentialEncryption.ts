import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { readFileSync, statSync } from "node:fs";

const ALGORITHM = "aes-256-gcm";
const ENVELOPE_VERSION = 2;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MAX_KEY_FILE_BYTES = 4096;
const MAX_PLAINTEXT_BYTES = 1024 * 1024;
const MAX_PREVIOUS_KEYS = 3;

type RuntimeEnv = Record<string, string | undefined>;
type CredentialRecord = Record<string, unknown> & { providerId: string };

export interface RuntimeCredentialEnvelope {
  version: 2;
  algorithm: "aes-256-gcm";
  keyId: string;
  providerId: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

export interface RuntimeCredentialCipher {
  readonly keyId: string;
  seal(record: CredentialRecord): RuntimeCredentialEnvelope;
  open(envelope: RuntimeCredentialEnvelope): CredentialRecord;
  isPrimaryEnvelope(envelope: RuntimeCredentialEnvelope): boolean;
}

export function createRuntimeCredentialCipher({
  env = process.env,
}: { env?: RuntimeEnv } = {}): RuntimeCredentialCipher {
  const primary = createKeyEntry(readPrimaryKey(env));
  const keyring = new Map<string, Buffer>([[primary.keyId, primary.key]]);

  for (const key of readPreviousKeys(env)) {
    const entry = createKeyEntry(key);
    if (!keyring.has(entry.keyId)) {
      keyring.set(entry.keyId, entry.key);
    }
  }

  return Object.freeze({
    keyId: primary.keyId,
    seal(record) {
      assertCredentialRecord(record);
      const plaintext = Buffer.from(JSON.stringify(record), "utf8");
      if (plaintext.length > MAX_PLAINTEXT_BYTES) {
        throw credentialEncryptionError(
          "RUNTIME_CREDENTIAL_RECORD_TOO_LARGE",
          "Runtime credential record exceeds the encrypted persistence limit.",
        );
      }

      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(ALGORITHM, primary.key, iv);
      cipher.setAAD(createAad(record.providerId));
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const tag = cipher.getAuthTag();

      return {
        version: ENVELOPE_VERSION,
        algorithm: ALGORITHM,
        keyId: primary.keyId,
        providerId: record.providerId,
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
        ciphertext: ciphertext.toString("base64"),
      };
    },

    open(envelope) {
      assertEnvelope(envelope);
      const key = keyring.get(envelope.keyId);
      if (!key) {
        throw credentialEncryptionError(
          "RUNTIME_CREDENTIAL_MASTER_KEY_MISMATCH",
          "No configured runtime credential key can decrypt this store.",
        );
      }

      try {
        const iv = decodeCanonicalBase64(envelope.iv, IV_BYTES, "iv");
        const tag = decodeCanonicalBase64(envelope.tag, TAG_BYTES, "tag");
        const ciphertext = decodeCanonicalBase64(
          envelope.ciphertext,
          undefined,
          "ciphertext",
        );
        if (ciphertext.length === 0 || ciphertext.length > MAX_PLAINTEXT_BYTES + TAG_BYTES) {
          throw new Error("ciphertext length is invalid");
        }

        const decipher = createDecipheriv(ALGORITHM, key, iv);
        decipher.setAAD(createAad(envelope.providerId));
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        const record = JSON.parse(plaintext.toString("utf8")) as CredentialRecord;
        assertCredentialRecord(record);
        if (record.providerId !== envelope.providerId) {
          throw new Error("provider identity does not match authenticated metadata");
        }
        return record;
      } catch (error) {
        if (isCredentialEncryptionError(error)) {
          throw error;
        }
        throw credentialEncryptionError(
          "RUNTIME_CREDENTIAL_DECRYPTION_FAILED",
          "Runtime credential authentication or decryption failed.",
        );
      }
    },

    isPrimaryEnvelope(envelope) {
      return envelope.keyId === primary.keyId;
    },
  });
}

export function isRuntimeCredentialEnvelope(value: unknown): value is RuntimeCredentialEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<RuntimeCredentialEnvelope>;
  return candidate.version === ENVELOPE_VERSION &&
    candidate.algorithm === ALGORITHM &&
    typeof candidate.keyId === "string" &&
    typeof candidate.providerId === "string" &&
    typeof candidate.iv === "string" &&
    typeof candidate.tag === "string" &&
    typeof candidate.ciphertext === "string";
}

function readPrimaryKey(env: RuntimeEnv): Buffer {
  const inline = String(env.PME_RUNTIME_CREDENTIAL_MASTER_KEY ?? "").trim();
  const filePath = String(env.PME_RUNTIME_CREDENTIAL_MASTER_KEY_FILE ?? "").trim();
  if (inline && filePath) {
    throw credentialEncryptionError(
      "RUNTIME_CREDENTIAL_MASTER_KEY_AMBIGUOUS",
      "Configure either the runtime credential master key or its file, not both.",
    );
  }
  if (!inline && !filePath) {
    throw credentialEncryptionError(
      "RUNTIME_CREDENTIAL_MASTER_KEY_REQUIRED",
      "Encrypted runtime credential persistence requires a 256-bit master key.",
    );
  }
  return parseKeyMaterial(inline || readKeyFile(filePath));
}

function readPreviousKeys(env: RuntimeEnv): Buffer[] {
  const raw = String(env.PME_RUNTIME_CREDENTIAL_PREVIOUS_MASTER_KEYS ?? "").trim();
  if (!raw) return [];
  const values = raw.split(",").map((value) => value.trim()).filter(Boolean);
  if (values.length > MAX_PREVIOUS_KEYS) {
    throw credentialEncryptionError(
      "RUNTIME_CREDENTIAL_PREVIOUS_KEYS_LIMIT",
      "At most three previous runtime credential keys may be configured.",
    );
  }
  return values.map(parseKeyMaterial);
}

function readKeyFile(filePath: string): string {
  try {
    const stat = statSync(filePath);
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_KEY_FILE_BYTES) {
      throw new Error("invalid key file size or type");
    }
    if (process.platform !== "win32" && (stat.mode & 0o077) !== 0) {
      throw credentialEncryptionError(
        "RUNTIME_CREDENTIAL_MASTER_KEY_FILE_PERMISSIONS",
        "Runtime credential key files must not be accessible by group or other users.",
      );
    }
    return readFileSync(filePath, "utf8").trim();
  } catch (error) {
    if (isCredentialEncryptionError(error)) throw error;
    throw credentialEncryptionError(
      "RUNTIME_CREDENTIAL_MASTER_KEY_FILE_INVALID",
      "Runtime credential master key file could not be read securely.",
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
    if (!/^[A-Za-z0-9+/]{43}=$/.test(base64)) {
      throw invalidKeyError();
    }
    key = Buffer.from(base64, "base64");
    if (key.toString("base64") !== base64) {
      throw invalidKeyError();
    }
  }
  if (key.length !== KEY_BYTES) {
    throw invalidKeyError();
  }
  return key;
}

function createKeyEntry(key: Buffer): { key: Buffer; keyId: string } {
  return {
    key,
    keyId: createHash("sha256").update(key).digest("hex").slice(0, 16),
  };
}

function createAad(providerId: string): Buffer {
  return Buffer.from("pme-runtime-credential:v2:" + providerId, "utf8");
}

function decodeCanonicalBase64(value: string, expectedBytes: number | undefined, label: string): Buffer {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error(label + " is not canonical base64");
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value || (expectedBytes !== undefined && decoded.length !== expectedBytes)) {
    throw new Error(label + " has an invalid length");
  }
  return decoded;
}

function assertEnvelope(value: unknown): asserts value is RuntimeCredentialEnvelope {
  if (!isRuntimeCredentialEnvelope(value) || !value.providerId || value.providerId.length > 128) {
    throw credentialEncryptionError(
      "RUNTIME_CREDENTIAL_ENVELOPE_INVALID",
      "Runtime credential envelope is invalid.",
    );
  }
}

function assertCredentialRecord(value: unknown): asserts value is CredentialRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw credentialEncryptionError(
      "RUNTIME_CREDENTIAL_RECORD_INVALID",
      "Runtime credential record is invalid.",
    );
  }
  const providerId = (value as { providerId?: unknown }).providerId;
  if (typeof providerId !== "string" || providerId.length === 0 || providerId.length > 128) {
    throw credentialEncryptionError(
      "RUNTIME_CREDENTIAL_RECORD_INVALID",
      "Runtime credential provider identity is invalid.",
    );
  }
}

function invalidKeyError(): Error & { code: string; category: string; retryable: boolean } {
  return credentialEncryptionError(
    "RUNTIME_CREDENTIAL_MASTER_KEY_INVALID",
    "Runtime credential master keys must be exactly 32 bytes encoded as canonical base64 or 64 hex characters.",
  );
}

function credentialEncryptionError(code: string, message: string): Error & {
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

function isCredentialEncryptionError(error: unknown): error is Error & { code: string } {
  if (!(error instanceof Error)) return false;
  const candidate = error as { code?: unknown; category?: unknown };
  return candidate.category === "security" &&
    typeof candidate.code === "string" &&
    candidate.code.startsWith("RUNTIME_CREDENTIAL_");
}
