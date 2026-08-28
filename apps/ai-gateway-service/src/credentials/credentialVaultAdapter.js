import { readFileSync, statSync } from "node:fs";
import { resolve as resolvePath, sep as pathSep } from "node:path";
import { createCredentialAuditEvent } from "./credentialAudit.js";

// 文件金库：file_key_path 引用解析到 CREDENTIAL_VAULT_DIR 下的文件。
// 安全约束：路径必须落在金库目录内（拒绝穿越）、文件非空、大小受限、
// secret 只在显式 materializeCredentialRef 时读出且从不写入日志/审计。
// resolveCredentialRef 保持同步（既有调用方均为同步调用）。
const FILE_REFERENCE_TYPE = "file_key_path";
const MAX_SECRET_FILE_BYTES = 64 * 1024;

export function createCredentialVaultAdapter({
  env = process.env,
  vaultDir = env.CREDENTIAL_VAULT_DIR || null,
  readFileFn = defaultReadSecretFile,
  statFn = defaultStatSecretFile,
} = {}) {
  function resolveFileReferenceStatus(reference) {
    if (!vaultDir) {
      return fileFailure("CREDENTIAL_VAULT_NOT_CONFIGURED");
    }
    const root = resolvePath(vaultDir);
    const candidate = resolvePath(root, reference);
    if (candidate !== root && !candidate.startsWith(root + pathSep)) {
      return fileFailure("CREDENTIAL_VAULT_PATH_ESCAPE_REJECTED");
    }
    try {
      const info = statFn(candidate);
      if (!info.isFile()) {
        return fileFailure("CREDENTIAL_VAULT_NOT_A_FILE");
      }
      if (info.size <= 0 || info.size > MAX_SECRET_FILE_BYTES) {
        return fileFailure("CREDENTIAL_VAULT_FILE_SIZE_INVALID");
      }
      // 读出内容校验非空白（文件很小，≤64KB），确保 resolved 意味着“可用”。
      const content = String(readFileFn(candidate) ?? "").trim();
      if (!content) {
        return fileFailure("CREDENTIAL_VAULT_FILE_EMPTY");
      }
      return {
        resolved: true,
        code: "FILE_KEY_REFERENCE_READY",
        materialized: false,
        referenceType: FILE_REFERENCE_TYPE,
        envKeyName: null,
        secretAvailable: true,
        filePath: candidate,
      };
    } catch (error) {
      return fileFailure(
        error?.code === "ENOENT" ? "CREDENTIAL_VAULT_FILE_NOT_FOUND" : "CREDENTIAL_RESOLUTION_FAILED",
      );
    }
  }

  function readFileSyncSecret(reference) {
    const root = resolvePath(vaultDir);
    const candidate = resolvePath(root, reference);
    if (candidate !== root && !candidate.startsWith(root + pathSep)) {
      throw new Error("CREDENTIAL_VAULT_PATH_ESCAPE_REJECTED");
    }
    return readFileFn(candidate);
  }

  return {
    validateCredentialRef(credentialRef) {
      const normalized = normalizeCredentialRef(credentialRef);
      if (!normalized.type || !normalized.reference) {
        return { valid: false, code: "CREDENTIAL_REF_INVALID", normalized };
      }
      return { valid: true, code: "OK", normalized };
    },
    resolveCredentialRef(credentialRef) {
      const { type, reference } = normalizeCredentialRef(credentialRef);
      if (!type || !reference) {
        return { resolved: false, code: "CREDENTIAL_REF_MISSING", materialized: false };
      }
      if (type === "env_key_name") {
        const keyPresent = Object.prototype.hasOwnProperty.call(env, reference);
        return {
          resolved: keyPresent,
          code: keyPresent ? "ENV_KEY_REFERENCE_READY" : "CREDENTIAL_RESOLUTION_FAILED",
          materialized: false,
          referenceType: type,
          envKeyName: reference,
          secretAvailable: keyPresent,
        };
      }
      if (type === FILE_REFERENCE_TYPE) {
        return resolveFileReferenceStatus(reference);
      }
      return {
        resolved: false,
        code: "CREDENTIAL_RESOLVER_NOT_IMPLEMENTED",
        materialized: false,
        referenceType: type,
        envKeyName: null,
        secretAvailable: false,
      };
    },
    /**
     * 显式物化 secret（仅运行时内部使用）：支持 env_key_name 与 file_key_path。
     * 返回值包含 secret 本体；调用方必须保证不写日志、不进审计明细。
     */
    materializeCredentialRef(credentialRef) {
      const { type, reference } = normalizeCredentialRef(credentialRef);
      if (!type || !reference) {
        return { materialized: false, code: "CREDENTIAL_REF_MISSING" };
      }
      if (type === "env_key_name") {
        const value = Object.prototype.hasOwnProperty.call(env, reference) ? env[reference] : undefined;
        if (typeof value !== "string" || !value) {
          return { materialized: false, code: "CREDENTIAL_RESOLUTION_FAILED" };
        }
        return { materialized: true, code: "ENV_KEY_MATERIALIZED", secret: value };
      }
      if (type === FILE_REFERENCE_TYPE) {
        if (!vaultDir) {
          return { materialized: false, code: "CREDENTIAL_VAULT_NOT_CONFIGURED" };
        }
        try {
          const secret = String(readFileSyncSecret(reference) ?? "").trim();
          if (!secret) {
            return { materialized: false, code: "CREDENTIAL_VAULT_FILE_EMPTY" };
          }
          return { materialized: true, code: "FILE_KEY_MATERIALIZED", secret };
        } catch (error) {
          return { materialized: false, code: error?.message || "CREDENTIAL_RESOLUTION_FAILED" };
        }
      }
      return { materialized: false, code: "CREDENTIAL_RESOLVER_NOT_IMPLEMENTED" };
    },
    redactSecret(value) {
      return value ? "[redacted]" : "";
    },
    auditCredentialAccess(event) {
      return createCredentialAuditEvent(event);
    },
  };

  function fileFailure(code) {
    return {
      resolved: false,
      code,
      materialized: false,
      referenceType: FILE_REFERENCE_TYPE,
      envKeyName: null,
      secretAvailable: false,
    };
  }
}

function defaultReadSecretFile(path) {
  return readFileSync(path, "utf8");
}

function defaultStatSecretFile(path) {
  return statSync(path);
}

export function normalizeCredentialRef(credentialRef) {
  if (!credentialRef) return { type: "", reference: "" };
  if (typeof credentialRef === "string") {
    const parts = credentialRef.split(":");
    if (parts.length >= 2) {
      return { type: parts[0], reference: parts.slice(1).join(":") };
    }
    return { type: "env_key_name", reference: credentialRef };
  }
  return {
    type: String(credentialRef.credentialRefType || credentialRef.type || ""),
    reference: String(credentialRef.reference || credentialRef.credentialRef || credentialRef.envKeyName || ""),
  };
}
