// Task claim token service.
//
// 一次性、TTL 受限的任务认领令牌：真实执行前必须先按 (planId, taskId)
// 签发令牌，执行请求携带令牌换取执行权；令牌消费后立即失效，支持显式
// 撤销与过期回收。令牌只存在于内存与调用方返回值中，绝不写入计划导出
// 或证据文件。

import { randomBytes, timingSafeEqual, createHash } from "node:crypto";

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_ACTIVE_TOKENS = 256;

export function createTaskClaimTokenService({
  ttlMs = DEFAULT_TTL_MS,
  clock = () => Date.now(),
} = {}) {
  // key: `${planId}::${taskId}` → { tokenHash, issuedAt, expiresAt, issuedBy, consumedAt }
  const activeClaims = new Map();

  function keyOf(planId, taskId) {
    return `${planId}::${taskId}`;
  }

  function hashToken(token) {
    return createHash("sha256").update(String(token), "utf8").digest();
  }

  function sweepExpired() {
    const now = clock();
    for (const [key, claim] of activeClaims) {
      if (claim.expiresAt <= now || claim.consumedAt) {
        activeClaims.delete(key);
      }
    }
  }

  return {
    issueTaskClaimToken({ planId, taskId, issuedBy = "unknown" } = {}) {
      if (!planId || !taskId) {
        return { issued: false, code: "CLAIM_INPUT_INVALID", reason: "planId and taskId are required." };
      }
      sweepExpired();
      if (activeClaims.has(keyOf(planId, taskId))) {
        return {
          issued: false,
          code: "CLAIM_ALREADY_ACTIVE",
          reason: "A live claim token already exists for this task; consume or revoke it first.",
        };
      }
      if (activeClaims.size >= MAX_ACTIVE_TOKENS) {
        return { issued: false, code: "CLAIM_CAPACITY_REACHED", reason: "Too many active claim tokens." };
      }
      const token = `tct_${randomBytes(24).toString("hex")}`;
      const now = clock();
      const claim = {
        tokenHash: hashToken(token),
        issuedAt: now,
        expiresAt: now + ttlMs,
        issuedBy: String(issuedBy),
        consumedAt: null,
      };
      activeClaims.set(keyOf(planId, taskId), claim);
      return {
        issued: true,
        token,
        planId,
        taskId,
        expiresAt: claim.expiresAt,
        ttlMs,
        singleUse: true,
      };
    },

    consumeTaskClaimToken({ planId, taskId, token } = {}) {
      if (!planId || !taskId || !token) {
        return { valid: false, code: "CLAIM_INPUT_INVALID", reason: "planId, taskId, and token are required." };
      }
      const claim = activeClaims.get(keyOf(planId, taskId));
      if (!claim) {
        return { valid: false, code: "CLAIM_NOT_FOUND", reason: "No live claim token for this task." };
      }
      const presented = hashToken(String(token));
      const matches = presented.length === claim.tokenHash.length
        && timingSafeEqual(presented, claim.tokenHash);
      if (!matches) {
        return { valid: false, code: "CLAIM_TOKEN_MISMATCH", reason: "Claim token does not match." };
      }
      if (claim.consumedAt !== null) {
        return { valid: false, code: "CLAIM_ALREADY_CONSUMED", reason: "Claim token was already used." };
      }
      if (clock() >= claim.expiresAt) {
        activeClaims.delete(keyOf(planId, taskId));
        return { valid: false, code: "CLAIM_EXPIRED", reason: "Claim token expired." };
      }
      claim.consumedAt = clock();
      activeClaims.delete(keyOf(planId, taskId));
      return { valid: true, code: "CLAIM_CONSUMED", planId, taskId };
    },

    revokeTaskClaimToken({ planId, taskId } = {}) {
      sweepExpired();
      const revoked = activeClaims.delete(keyOf(planId, taskId));
      return {
        revoked,
        code: revoked ? "CLAIM_REVOKED" : "CLAIM_NOT_FOUND",
      };
    },

    getStatus() {
      sweepExpired();
      return {
        implemented: true,
        singleUse: true,
        ttlMs,
        activeClaims: activeClaims.size,
        maxActiveClaims: MAX_ACTIVE_TOKENS,
      };
    },
  };
}
