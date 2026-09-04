import { createPublicKey, generateKeyPairSync } from "node:crypto";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AgentCard,
  verifyAgentCardSignature,
} from "@a2a-js/sdk";
import { describe, expect, it } from "vitest";
import { type JsonWebKey } from "./a2aAgentCardSigning.js";
import {
  A2A_AGENT_CARD_PATH,
  A2A_JWKS_PATH,
  createA2AGateway,
} from "./a2aGateway.js";
import { dispatchA2ARoutes } from "./a2aRoutes.js";

type TestResponse = {
  statusCode: number | null;
  headers: Record<string, string>;
  text: string;
  writeHead(statusCode: number, headers?: Record<string, string>): void;
  end(chunk?: string): void;
};

async function createEd25519KeyFile(mode = 0o600) {
  const directory = await mkdtemp(join(tmpdir(), "a2a-card-signing-"));
  const keyFilePath = join(directory, "agent-card-ed25519.pem");
  const { privateKey } = generateKeyPairSync("ed25519");
  const keyMaterial = privateKey.export({ format: "pem", type: "pkcs8" });
  await writeFile(keyFilePath, keyMaterial, { mode });
  if (process.platform !== "win32") await chmod(keyFilePath, mode);
  return {
    directory,
    keyFilePath,
    async cleanup() {
      await rm(directory, { recursive: true, force: true });
    },
  };
}

function createGetContext(gateway: ReturnType<typeof createA2AGateway>, pathname: string) {
  const response: TestResponse = {
    statusCode: null,
    headers: {},
    text: "",
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk = "") {
      this.text += String(chunk);
    },
  };
  return {
    a2aGateway: gateway,
    request: { method: "GET", headers: {} },
    response,
    startedAt: Date.now(),
    url: new URL(`http://127.0.0.1${pathname}`),
  };
}

describe("A2A Agent Card signing", () => {
  it("publishes a canonical Ed25519 JWS and a public-only JWKS", async () => {
    const keyFile = await createEd25519KeyFile();
    try {
      const gateway = createA2AGateway({
        gatewayService: { execute: async () => ({ success: false }) },
        env: {
          A2A_PUBLIC_BASE_URL: "https://gateway.example.test",
          AI_GATEWAY_A2A_AGENT_CARD_SIGNING_KEY_FILE: keyFile.keyFilePath,
          AI_GATEWAY_A2A_AGENT_CARD_SIGNING_REQUIRED: "true",
        },
      });

      const signedJson = await gateway.getAgentCardJson();
      expect(signedJson.signatures).toHaveLength(1);
      const protectedHeader = JSON.parse(
        Buffer.from(signedJson.signatures[0].protected, "base64url").toString("utf8"),
      );
      expect(protectedHeader).toEqual({
        alg: "EdDSA",
        typ: "JOSE",
        kid: gateway.agentCardSigning.keyId,
        jku: "https://gateway.example.test/.well-known/a2a-jwks.json",
      });
      expect(gateway.agentCardJwks?.keys).toHaveLength(1);
      expect(gateway.agentCardJwks?.keys[0]).not.toHaveProperty("d");
      expect(gateway.agentCardJwks?.keys[0]).toMatchObject({
        alg: "EdDSA",
        kid: gateway.agentCardSigning.keyId,
        key_ops: ["verify"],
        use: "sig",
      });

      const publicKey = createPublicKey({
        key: gateway.agentCardJwks?.keys[0] as JsonWebKey,
        format: "jwk",
      });
      const verify = verifyAgentCardSignature(async (kid, jku) => {
        expect(kid).toBe(gateway.agentCardSigning.keyId);
        expect(jku).toBe(gateway.agentCardSigning.jwksUrl);
        return publicKey;
      });
      await expect(verify(AgentCard.fromJSON(signedJson))).resolves.toBeUndefined();

      const handlerCard = await gateway.requestHandler.getAgentCard();
      expect(handlerCard.signatures).toHaveLength(1);
    } finally {
      await keyFile.cleanup();
    }
  });

  it("publishes bounded overlapping signatures and verifies cached old cards during rotation", async () => {
    const currentKeyFile = await createEd25519KeyFile();
    const previousKeyFile = await createEd25519KeyFile();
    try {
      const previousGateway = createA2AGateway({
        gatewayService: { execute: async () => ({ success: false }) },
        env: {
          A2A_PUBLIC_BASE_URL: "https://gateway.example.test",
          AI_GATEWAY_A2A_AGENT_CARD_SIGNING_KEY_FILE: previousKeyFile.keyFilePath,
          AI_GATEWAY_A2A_AGENT_CARD_SIGNING_REQUIRED: "true",
        },
      });
      const cachedPreviousCard = await previousGateway.getAgentCardJson();
      expect(cachedPreviousCard.signatures).toHaveLength(1);

      const rotatingGateway = createA2AGateway({
        gatewayService: { execute: async () => ({ success: false }) },
        env: {
          A2A_PUBLIC_BASE_URL: "https://gateway.example.test",
          AI_GATEWAY_A2A_AGENT_CARD_SIGNING_KEY_FILE: currentKeyFile.keyFilePath,
          AI_GATEWAY_A2A_AGENT_CARD_PREVIOUS_SIGNING_KEY_FILES_JSON: JSON.stringify([
            previousKeyFile.keyFilePath,
          ]),
          AI_GATEWAY_A2A_AGENT_CARD_SIGNING_REQUIRED: "true",
        },
      });
      const signedJson = await rotatingGateway.getAgentCardJson();
      expect(signedJson.signatures).toHaveLength(2);
      expect(rotatingGateway.agentCardSigning.signatureCount).toBe(2);
      expect(rotatingGateway.agentCardSigning.keyIds).toHaveLength(2);
      expect(rotatingGateway.agentCardSigning.previousKeyIds).toEqual([
        rotatingGateway.agentCardSigning.keyIds[1],
      ]);
      expect(rotatingGateway.agentCardJwks?.keys.map((key) => key.kid)).toEqual(
        rotatingGateway.agentCardSigning.keyIds,
      );
      expect(rotatingGateway.agentCardJwks?.keys.every((key) => !("d" in key))).toBe(true);

      const publicKeys = new Map(
        rotatingGateway.agentCardJwks?.keys.map((key) => [
          key.kid,
          createPublicKey({ key: key as JsonWebKey, format: "jwk" }),
        ]),
      );
      const verify = verifyAgentCardSignature(async (kid, jku) => {
        expect(jku).toBe("https://gateway.example.test/.well-known/a2a-jwks.json");
        const publicKey = publicKeys.get(kid);
        if (!publicKey) throw new Error("unknown test key");
        return publicKey;
      });
      for (const signature of signedJson.signatures) {
        await expect(verify(AgentCard.fromJSON({
          ...signedJson,
          signatures: [signature],
        }))).resolves.toBeUndefined();
      }
      await expect(verify(AgentCard.fromJSON(cachedPreviousCard))).resolves.toBeUndefined();

      const handlerCard = await rotatingGateway.requestHandler.getAgentCard();
      expect(handlerCard.signatures).toHaveLength(2);
      await previousGateway.close();
      await rotatingGateway.close();
    } finally {
      await Promise.all([currentKeyFile.cleanup(), previousKeyFile.cleanup()]);
    }
  });

  it("serves signed discovery and JWKS while keeping an unsigned profile explicit", async () => {
    const unsignedGateway = createA2AGateway({
      gatewayService: { execute: async () => ({ success: false }) },
      env: {},
    });
    const unsignedJwks = createGetContext(unsignedGateway, A2A_JWKS_PATH);
    await dispatchA2ARoutes(unsignedJwks as never);
    expect(unsignedJwks.response.statusCode).toBe(404);
    expect(JSON.parse(unsignedJwks.response.text)).toEqual({
      error: "a2a_agent_card_signing_not_configured",
    });

    const keyFile = await createEd25519KeyFile();
    try {
      const signedGateway = createA2AGateway({
        gatewayService: { execute: async () => ({ success: false }) },
        env: {
          A2A_PUBLIC_BASE_URL: "https://gateway.example.test",
          AI_GATEWAY_A2A_AGENT_CARD_SIGNING_KEY_FILE: keyFile.keyFilePath,
        },
      });
      const cardContext = createGetContext(signedGateway, A2A_AGENT_CARD_PATH);
      await dispatchA2ARoutes(cardContext as never);
      expect(cardContext.response.statusCode).toBe(200);
      expect(JSON.parse(cardContext.response.text).signatures).toHaveLength(1);

      const jwksContext = createGetContext(signedGateway, A2A_JWKS_PATH);
      await dispatchA2ARoutes(jwksContext as never);
      expect(jwksContext.response.statusCode).toBe(200);
      expect(jwksContext.response.headers["content-type"]).toBe(
        "application/json; charset=utf-8",
      );
      expect(JSON.parse(jwksContext.response.text).keys).toHaveLength(1);
    } finally {
      await keyFile.cleanup();
    }
  });

  it("fails closed when signing is required without a stable key", () => {
    expect(() => createA2AGateway({
      gatewayService: { execute: async () => ({ success: false }) },
      env: { AI_GATEWAY_A2A_AGENT_CARD_SIGNING_REQUIRED: "true" },
    })).toThrow(expect.objectContaining({
      code: "A2A_AGENT_CARD_SIGNING_KEY_REQUIRED",
      category: "security",
    }));
  });

  it("fails closed for malformed, unbounded, or unanchored previous signing keys", async () => {
    const keyFile = await createEd25519KeyFile();
    try {
      const emptyOverlapGateway = createA2AGateway({
        gatewayService: { execute: async () => ({ success: false }) },
        env: {
          A2A_PUBLIC_BASE_URL: "https://gateway.example.test",
          AI_GATEWAY_A2A_AGENT_CARD_SIGNING_KEY_FILE: keyFile.keyFilePath,
          AI_GATEWAY_A2A_AGENT_CARD_PREVIOUS_SIGNING_KEY_FILES_JSON: "[]",
        },
      });
      expect(emptyOverlapGateway.agentCardSigning.signatureCount).toBe(1);
      await emptyOverlapGateway.close();

      expect(() => createA2AGateway({
        gatewayService: { execute: async () => ({ success: false }) },
        env: {
          A2A_PUBLIC_BASE_URL: "https://gateway.example.test",
          AI_GATEWAY_A2A_AGENT_CARD_PREVIOUS_SIGNING_KEY_FILES_JSON: JSON.stringify([
            keyFile.keyFilePath,
          ]),
        },
      })).toThrow(expect.objectContaining({
        code: "A2A_AGENT_CARD_PREVIOUS_KEYS_WITHOUT_PRIMARY",
      }));

      expect(() => createA2AGateway({
        gatewayService: { execute: async () => ({ success: false }) },
        env: {
          A2A_PUBLIC_BASE_URL: "https://gateway.example.test",
          AI_GATEWAY_A2A_AGENT_CARD_SIGNING_KEY_FILE: keyFile.keyFilePath,
          AI_GATEWAY_A2A_AGENT_CARD_PREVIOUS_SIGNING_KEY_FILES_JSON: "not-json",
        },
      })).toThrow(expect.objectContaining({
        code: "A2A_AGENT_CARD_PREVIOUS_KEYS_INVALID",
      }));

      expect(() => createA2AGateway({
        gatewayService: { execute: async () => ({ success: false }) },
        env: {
          A2A_PUBLIC_BASE_URL: "https://gateway.example.test",
          AI_GATEWAY_A2A_AGENT_CARD_SIGNING_KEY_FILE: keyFile.keyFilePath,
          AI_GATEWAY_A2A_AGENT_CARD_PREVIOUS_SIGNING_KEY_FILES_JSON: JSON.stringify([
            keyFile.keyFilePath,
          ]),
        },
      })).toThrow(expect.objectContaining({
        code: "A2A_AGENT_CARD_SIGNING_KEY_DUPLICATE",
      }));

      expect(() => createA2AGateway({
        gatewayService: { execute: async () => ({ success: false }) },
        env: {
          A2A_PUBLIC_BASE_URL: "https://gateway.example.test",
          AI_GATEWAY_A2A_AGENT_CARD_SIGNING_KEY_FILE: keyFile.keyFilePath,
          AI_GATEWAY_A2A_AGENT_CARD_PREVIOUS_SIGNING_KEY_FILES_JSON: JSON.stringify([
            keyFile.keyFilePath,
            `${keyFile.keyFilePath}.1`,
            `${keyFile.keyFilePath}.2`,
            `${keyFile.keyFilePath}.3`,
          ]),
        },
      })).toThrow(expect.objectContaining({
        code: "A2A_AGENT_CARD_PREVIOUS_KEYS_INVALID",
      }));
    } finally {
      await keyFile.cleanup();
    }
  });

  it("requires HTTPS for a non-loopback JWKS URL", async () => {
    const keyFile = await createEd25519KeyFile();
    try {
      expect(() => createA2AGateway({
        gatewayService: { execute: async () => ({ success: false }) },
        env: {
          A2A_PUBLIC_BASE_URL: "http://gateway.example.test",
          AI_GATEWAY_A2A_AGENT_CARD_SIGNING_KEY_FILE: keyFile.keyFilePath,
        },
      })).toThrow(expect.objectContaining({
        code: "A2A_AGENT_CARD_JWKS_HTTPS_REQUIRED",
      }));

      expect(() => createA2AGateway({
        gatewayService: { execute: async () => ({ success: false }) },
        env: {
          A2A_PUBLIC_BASE_URL: "http://127.0.0.1:3100",
          AI_GATEWAY_A2A_AGENT_CARD_SIGNING_KEY_FILE: keyFile.keyFilePath,
        },
      })).not.toThrow();
    } finally {
      await keyFile.cleanup();
    }
  });

  it("rejects key files with broad POSIX permissions", async () => {
    if (process.platform === "win32") return;
    const keyFile = await createEd25519KeyFile(0o644);
    try {
      expect(() => createA2AGateway({
        gatewayService: { execute: async () => ({ success: false }) },
        env: {
          A2A_PUBLIC_BASE_URL: "https://gateway.example.test",
          AI_GATEWAY_A2A_AGENT_CARD_SIGNING_KEY_FILE: keyFile.keyFilePath,
        },
      })).toThrow(expect.objectContaining({
        code: "A2A_AGENT_CARD_SIGNING_KEY_FILE_PERMISSIONS",
      }));
    } finally {
      await keyFile.cleanup();
    }
  });
});
