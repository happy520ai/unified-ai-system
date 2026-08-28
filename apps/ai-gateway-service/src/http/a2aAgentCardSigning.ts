import {
  createHash,
  createPrivateKey,
  createPublicKey,
  type JsonWebKey,
  type KeyObject,
} from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  openSync,
  readFileSync,
} from "node:fs";
import { isAbsolute } from "node:path";
import {
  generateAgentCardSignature,
  type AgentCard,
  type AgentCardSignatureGenerator,
} from "@a2a-js/sdk";

export const A2A_JWKS_PATH = "/.well-known/a2a-jwks.json";

const MAX_PRIVATE_KEY_FILE_BYTES = 16 * 1024;
const MAX_PREVIOUS_SIGNING_KEYS = 3;
const MAX_PREVIOUS_SIGNING_KEYS_CONFIG_BYTES = 16 * 1024;
const SIGNING_ALGORITHM = "EdDSA";
const SIGNATURE_TYPE = "JOSE";

type RuntimeEnv = Record<string, string | undefined>;
type PublicJwk = Readonly<JsonWebKey & {
  alg: typeof SIGNING_ALGORITHM;
  kid: string;
  kty: string;
  key_ops: readonly ["verify"];
  use: "sig";
}>;

export interface A2AAgentCardSigningConfiguration {
  readonly configured: boolean;
  readonly required: boolean;
  readonly keyId: string | null;
  readonly keyIds: readonly string[];
  readonly previousKeyIds: readonly string[];
  readonly signatureCount: number;
  readonly jwksUrl: string | null;
  readonly jwks: Readonly<{ keys: readonly PublicJwk[] }> | null;
  readonly signer: AgentCardSignatureGenerator | null;
}

export function createA2AAgentCardSigningConfiguration({
  env = process.env,
  publicBaseUrl,
}: {
  env?: RuntimeEnv;
  publicBaseUrl: string;
}): A2AAgentCardSigningConfiguration {
  const required = readStrictBoolean(
    env.AI_GATEWAY_A2A_AGENT_CARD_SIGNING_REQUIRED,
    "AI_GATEWAY_A2A_AGENT_CARD_SIGNING_REQUIRED",
  );
  const keyFilePath = String(
    env.AI_GATEWAY_A2A_AGENT_CARD_SIGNING_KEY_FILE ?? "",
  ).trim();
  const configuredJwksUrl = String(
    env.AI_GATEWAY_A2A_AGENT_CARD_JWKS_URL ?? "",
  ).trim();
  const previousKeyFilePaths = readPreviousSigningKeyFiles(
    env.AI_GATEWAY_A2A_AGENT_CARD_PREVIOUS_SIGNING_KEY_FILES_JSON,
  );

  if (!keyFilePath) {
    if (previousKeyFilePaths.length > 0) {
      throw signingError(
        "A2A_AGENT_CARD_PREVIOUS_KEYS_WITHOUT_PRIMARY",
        "Previous A2A Agent Card signing keys require a configured primary signing key file.",
      );
    }
    if (configuredJwksUrl) {
      throw signingError(
        "A2A_AGENT_CARD_JWKS_WITHOUT_SIGNING_KEY",
        "An A2A JWKS URL requires a configured Agent Card signing key file.",
      );
    }
    if (required) {
      throw signingError(
        "A2A_AGENT_CARD_SIGNING_KEY_REQUIRED",
        "Required A2A Agent Card signing needs a stable Ed25519 private key file.",
      );
    }
    return Object.freeze({
      configured: false,
      required: false,
      keyId: null,
      keyIds: Object.freeze([]),
      previousKeyIds: Object.freeze([]),
      signatureCount: 0,
      jwksUrl: null,
      jwks: null,
      signer: null,
    });
  }

  const keyEntries = [keyFilePath, ...previousKeyFilePaths].map(createSigningKeyEntry);
  const keyIds = Object.freeze(keyEntries.map((entry) => entry.keyId));
  if (new Set(keyIds).size !== keyIds.length) {
    throw signingError(
      "A2A_AGENT_CARD_SIGNING_KEY_DUPLICATE",
      "A2A Agent Card signing keys must have distinct public key identifiers.",
    );
  }
  const keyId = keyIds[0];
  const previousKeyIds = Object.freeze(keyIds.slice(1));
  const jwksUrl = normalizeJwksUrl(
    configuredJwksUrl || `${publicBaseUrl}${A2A_JWKS_PATH}`,
  );
  const jwks = Object.freeze({
    keys: Object.freeze(keyEntries.map((entry) => createPublicJwk(entry.publicKey, entry.keyId))),
  });
  const signer = createCompositeSigner(keyEntries, jwksUrl);

  return Object.freeze({
    configured: true,
    required,
    keyId,
    keyIds,
    previousKeyIds,
    signatureCount: keyEntries.length,
    jwksUrl,
    jwks,
    signer,
  });
}

function createSigningKeyEntry(filePath: string) {
  if (!isAbsolute(filePath)) {
    throw signingError(
      "A2A_AGENT_CARD_SIGNING_KEY_PATH_NOT_ABSOLUTE",
      "Every A2A Agent Card signing key file path must be absolute.",
    );
  }
  const privateKey = readEd25519PrivateKey(filePath);
  const publicKey = createPublicKey(privateKey);
  return Object.freeze({
    privateKey,
    publicKey,
    keyId: createKeyId(publicKey),
  });
}

function createCompositeSigner(
  keyEntries: readonly ReturnType<typeof createSigningKeyEntry>[],
  jwksUrl: string,
): AgentCardSignatureGenerator {
  const signers = keyEntries.map((entry) => generateAgentCardSignature(entry.privateKey, {
    alg: SIGNING_ALGORITHM,
    typ: SIGNATURE_TYPE,
    kid: entry.keyId,
    jku: jwksUrl,
  }));
  return async (agentCard: AgentCard) => {
    let signedCard = agentCard;
    for (const signer of signers) signedCard = await signer(signedCard);
    return signedCard;
  };
}

export function isA2AAgentCardSigningError(
  error: unknown,
): error is Error & { code: string; category: "security" } {
  if (!(error instanceof Error)) return false;
  const candidate = error as { code?: unknown; category?: unknown };
  return candidate.category === "security"
    && typeof candidate.code === "string"
    && candidate.code.startsWith("A2A_AGENT_CARD_");
}

function readStrictBoolean(value: string | undefined, name: string): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized || normalized === "false") return false;
  if (normalized === "true") return true;
  throw signingError(
    "A2A_AGENT_CARD_SIGNING_CONFIGURATION_INVALID",
    `${name} must be exactly true or false when configured.`,
  );
}

function readPreviousSigningKeyFiles(value: string | undefined): readonly string[] {
  const raw = String(value ?? "").trim();
  if (!raw) return Object.freeze([]);
  if (Buffer.byteLength(raw, "utf8") > MAX_PREVIOUS_SIGNING_KEYS_CONFIG_BYTES) {
    throw signingError(
      "A2A_AGENT_CARD_PREVIOUS_KEYS_INVALID",
      "The previous A2A Agent Card signing key configuration is too large.",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw signingError(
      "A2A_AGENT_CARD_PREVIOUS_KEYS_INVALID",
      "Previous A2A Agent Card signing key files must be a JSON array of absolute paths.",
    );
  }
  if (
    !Array.isArray(parsed)
    || parsed.length > MAX_PREVIOUS_SIGNING_KEYS
    || parsed.some((entry) => typeof entry !== "string" || !entry.trim())
  ) {
    throw signingError(
      "A2A_AGENT_CARD_PREVIOUS_KEYS_INVALID",
      `Configure at most ${MAX_PREVIOUS_SIGNING_KEYS} previous signing key file paths.`,
    );
  }
  const normalized = parsed.map((entry) => String(entry).trim());
  if (new Set(normalized).size !== normalized.length) {
    throw signingError(
      "A2A_AGENT_CARD_SIGNING_KEY_DUPLICATE",
      "Previous A2A Agent Card signing key paths must be unique.",
    );
  }
  return Object.freeze(normalized);
}

function readEd25519PrivateKey(filePath: string): KeyObject {
  let fileDescriptor: number | undefined;
  try {
    fileDescriptor = openSync(filePath, fsConstants.O_RDONLY);
    const fileStat = fstatSync(fileDescriptor);
    if (
      !fileStat.isFile()
      || fileStat.size <= 0
      || fileStat.size > MAX_PRIVATE_KEY_FILE_BYTES
    ) {
      throw signingError(
        "A2A_AGENT_CARD_SIGNING_KEY_FILE_INVALID",
        "The A2A Agent Card signing key file has an invalid type or size.",
      );
    }
    if (process.platform !== "win32" && (fileStat.mode & 0o077) !== 0) {
      throw signingError(
        "A2A_AGENT_CARD_SIGNING_KEY_FILE_PERMISSIONS",
        "The A2A Agent Card signing key file must not be accessible by group or other users.",
      );
    }

    const keyMaterial = readFileSync(fileDescriptor, "utf8");
    const privateKey = createPrivateKey(keyMaterial);
    if (privateKey.type !== "private" || privateKey.asymmetricKeyType !== "ed25519") {
      throw signingError(
        "A2A_AGENT_CARD_SIGNING_KEY_ALGORITHM",
        "The A2A Agent Card signing key must be an Ed25519 private key.",
      );
    }
    return privateKey;
  } catch (error) {
    if (isA2AAgentCardSigningError(error)) throw error;
    throw signingError(
      "A2A_AGENT_CARD_SIGNING_KEY_FILE_INVALID",
      "The A2A Agent Card signing key file could not be read securely.",
    );
  } finally {
    if (fileDescriptor !== undefined) {
      try {
        closeSync(fileDescriptor);
      } catch {
        // The key material is already memory-resident; close failure must not
        // expose the descriptor or secret path in a response or log.
      }
    }
  }
}

function createKeyId(publicKey: KeyObject): string {
  const publicDer = publicKey.export({ format: "der", type: "spki" });
  return `sha256-${createHash("sha256").update(publicDer).digest("base64url")}`;
}

function createPublicJwk(publicKey: KeyObject, keyId: string): PublicJwk {
  const exported = publicKey.export({ format: "jwk" });
  if (typeof exported.kty !== "string" || "d" in exported) {
    throw signingError(
      "A2A_AGENT_CARD_PUBLIC_KEY_EXPORT_INVALID",
      "The A2A Agent Card public verification key could not be exported safely.",
    );
  }
  return Object.freeze({
    ...exported,
    alg: SIGNING_ALGORITHM,
    kid: keyId,
    key_ops: Object.freeze(["verify"] as const),
    use: "sig",
  }) as unknown as PublicJwk;
}

function normalizeJwksUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw signingError(
      "A2A_AGENT_CARD_JWKS_URL_INVALID",
      "The A2A Agent Card JWKS URL must be an absolute HTTP(S) URL.",
    );
  }
  if (
    !new Set(["http:", "https:"]).has(url.protocol)
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    throw signingError(
      "A2A_AGENT_CARD_JWKS_URL_INVALID",
      "The A2A Agent Card JWKS URL must be HTTP(S) and contain no credentials, query, or fragment.",
    );
  }
  if (url.protocol !== "https:" && !isLoopbackHostname(url.hostname)) {
    throw signingError(
      "A2A_AGENT_CARD_JWKS_HTTPS_REQUIRED",
      "A non-loopback A2A JWKS URL must use HTTPS.",
    );
  }
  return url.toString();
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost"
    || normalized.endsWith(".localhost")
    || normalized === "127.0.0.1"
    || normalized === "[::1]"
    || normalized === "::1";
}

function signingError(code: string, message: string) {
  return Object.assign(new Error(message), {
    code,
    category: "security" as const,
  });
}

export const a2aAgentCardSigningInternals = Object.freeze({
  normalizeJwksUrl,
  readPreviousSigningKeyFiles,
  readStrictBoolean,
});
