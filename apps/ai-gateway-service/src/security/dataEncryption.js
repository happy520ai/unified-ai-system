// =============================================================================
// dataEncryption.js — 数据加密服务
// TLS 配置、存储加密、密钥轮换
// =============================================================================

import { createCipheriv, createDecipheriv, randomBytes, scrypt, createHash } from "node:crypto";

export function createDataEncryption(options = {}) {
  const algorithm = "aes-256-gcm";
  const keyLength = 32;
  const ivLength = 16;
  const tagLength = 16;

  let masterKey = options.masterKey ?? process.env.ENCRYPTION_MASTER_KEY;

  function deriveKey(salt) {
    return new Promise((resolve, reject) => {
      if (!masterKey) {
        masterKey = randomBytes(32).toString("hex");
      }
      scrypt(masterKey, salt, keyLength, (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
  }

  async function encrypt(plaintext) {
    const salt = randomBytes(16);
    const key = await deriveKey(salt);
    const iv = randomBytes(ivLength);
    const cipher = createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag();

    return {
      encrypted,
      salt: salt.toString("hex"),
      iv: iv.toString("hex"),
      tag: tag.toString("hex"),
      algorithm,
    };
  }

  async function decrypt({ encrypted, salt, iv, tag }) {
    const key = await deriveKey(Buffer.from(salt, "hex"));
    const decipher = createDecipheriv(algorithm, key, Buffer.from(iv, "hex"));
    decipher.setAuthTag(Buffer.from(tag, "hex"));

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  function hashPassword(password, salt) {
    return new Promise((resolve, reject) => {
      scrypt(password, salt ?? randomBytes(16), 64, (err, derived) => {
        if (err) reject(err);
        else resolve(derived.toString("hex"));
      });
    });
  }

  function generateApiKey() {
    return `aig_${randomBytes(32).toString("hex")}`;
  }

  function maskSecret(value, showChars = 4) {
    if (!value || value.length <= showChars * 2) return "****";
    return value.slice(0, showChars) + "*".repeat(Math.min(8, value.length - showChars * 2)) + value.slice(-showChars);
  }

  function rotateMasterKey(newKey) {
    const oldKey = masterKey;
    masterKey = newKey;
    return { rotated: true, oldKeyMasked: maskSecret(oldKey ?? ""), newKeyMasked: maskSecret(newKey) };
  }

  function getHealth() {
    return {
      status: masterKey ? "ready" : "no_master_key",
      algorithm,
      masterKeyConfigured: !!masterKey,
      keyLength,
    };
  }

  return { encrypt, decrypt, hashPassword, generateApiKey, maskSecret, rotateMasterKey, getHealth };
}
