import { describe, expect, it } from "vitest";
import { createRuntimeCredentialCipher } from "./runtimeCredentialEncryption.js";

const MASTER_KEY_A = Buffer.alloc(32, 0x44).toString("base64");
const MASTER_KEY_B = Buffer.alloc(32, 0x55).toString("base64");

function expectErrorCode(action: () => unknown, code: string): void {
  let captured: unknown;
  try {
    action();
  } catch (error) {
    captured = error;
  }
  expect(captured).toMatchObject({ code });
}

describe("runtime credential encryption", () => {
  it("authenticates ciphertext and provider identity", () => {
    const cipher = createRuntimeCredentialCipher({
      env: { PME_RUNTIME_CREDENTIAL_MASTER_KEY: MASTER_KEY_A },
    });
    const envelope = cipher.seal({
      providerId: "openai",
      apiKey: "never-serialize-in-clear",
      endpoint: "https://api.example.test",
    });

    expect(JSON.stringify(envelope)).not.toContain("never-serialize-in-clear");
    expect(cipher.open(envelope)).toMatchObject({
      providerId: "openai",
      apiKey: "never-serialize-in-clear",
    });

    expectErrorCode(() => cipher.open({
      ...envelope,
      providerId: "attacker-controlled",
    }), "RUNTIME_CREDENTIAL_DECRYPTION_FAILED");
  });

  it("rejects tampering and an unknown key without exposing plaintext", () => {
    const cipherA = createRuntimeCredentialCipher({
      env: { PME_RUNTIME_CREDENTIAL_MASTER_KEY: MASTER_KEY_A },
    });
    const cipherB = createRuntimeCredentialCipher({
      env: { PME_RUNTIME_CREDENTIAL_MASTER_KEY: MASTER_KEY_B },
    });
    const envelope = cipherA.seal({ providerId: "openai", apiKey: "secret" });
    const tampered = Buffer.from(envelope.ciphertext, "base64");
    tampered[0] ^= 0x01;

    expectErrorCode(() => cipherA.open({
      ...envelope,
      ciphertext: tampered.toString("base64"),
    }), "RUNTIME_CREDENTIAL_DECRYPTION_FAILED");
    expectErrorCode(() => cipherB.open(envelope), "RUNTIME_CREDENTIAL_MASTER_KEY_MISMATCH");
  });

  it("rejects weak or ambiguous key configuration", () => {
    expectErrorCode(() => createRuntimeCredentialCipher({
      env: { PME_RUNTIME_CREDENTIAL_MASTER_KEY: "too-short" },
    }), "RUNTIME_CREDENTIAL_MASTER_KEY_INVALID");
    expectErrorCode(() => createRuntimeCredentialCipher({
      env: {
        PME_RUNTIME_CREDENTIAL_MASTER_KEY: MASTER_KEY_A,
        PME_RUNTIME_CREDENTIAL_MASTER_KEY_FILE: "unused",
      },
    }), "RUNTIME_CREDENTIAL_MASTER_KEY_AMBIGUOUS");
  });
});
