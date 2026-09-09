import { randomUUID } from "node:crypto";
import type { ApiKeyAuthorizationResult, ApiKeyManager } from "./apiKeyManager.js";

type UsageSource = "reported" | "estimated" | "partial" | "unknown";
type SettlementState = "recorded" | "unknown" | "accounting-unavailable";
export interface VirtualKeySettlement {
  tokens: number | null;
  source: UsageSource;
  incomplete: boolean;
  usageAttemptId?: string;
}
export interface VirtualKeySettlementReceipt extends VirtualKeySettlement {
  state: SettlementState;
  auditRecorded: boolean;
}
export interface VirtualKeyAccountingEvent extends VirtualKeySettlement {
  event: "virtual_key_usage_settled";
  requestAccountingId: string;
  invocationId: string;
  keyFingerprint: string;
  state: SettlementState;
  softBudgetExceeded: boolean;
}
export interface VirtualKeyInvocation { readonly id: string }
export interface VirtualKeyRequestAccounting {
  admit(estimatedTokens: number): Readonly<ApiKeyAuthorizationResult>;
  beginInvocation(estimatedTokens: number, metering?: "tokens" | "unsupported"): VirtualKeyInvocation;
  settle(invocation: VirtualKeyInvocation, usage: VirtualKeySettlement): Promise<Readonly<VirtualKeySettlementReceipt>>;
}

// JSON, object spreads and caller-supplied accounting flags cannot carry these
// capabilities. Only trusted server projections explicitly inherit a binding.
const capabilities = new WeakSet<object>();
const bindings = new WeakMap<object, VirtualKeyRequestAccounting>();

export function bindVirtualKeyRequestAccounting(target: object, capability: VirtualKeyRequestAccounting): void {
  if (!capabilities.has(capability)) throw accountingError();
  const prior = bindings.get(target);
  if (prior && prior !== capability) throw accountingError();
  bindings.set(target, capability);
}

export function getVirtualKeyRequestAccounting(target: unknown): VirtualKeyRequestAccounting | undefined {
  return target !== null && typeof target === "object" ? bindings.get(target) : undefined;
}

export function inheritVirtualKeyRequestAccounting(source: unknown, target: object): void {
  const capability = getVirtualKeyRequestAccounting(source);
  if (capability) bindVirtualKeyRequestAccounting(target, capability);
}

export function createVirtualKeyRequestAccounting(options: {
  manager: ApiKeyManager;
  keyFingerprint: string;
  onEvent: (event: Readonly<VirtualKeyAccountingEvent>) => void | Promise<void>;
}): VirtualKeyRequestAccounting {
  const { manager, keyFingerprint, onEvent } = options;
  if (!/^[a-f0-9]{12}$/u.test(keyFingerprint) || typeof onEvent !== "function"
    || typeof manager?.authorizeUsage !== "function" || typeof manager?.checkContinuation !== "function"
    || typeof manager?.recordUsage !== "function" || typeof manager?.describeUsage !== "function") throw accountingError();
  const requestAccountingId = randomUUID();
  let admission: Readonly<ApiKeyAuthorizationResult> | undefined;
  let admissionError: Error | undefined;
  let auditFailed = false;
  const invocations = new WeakMap<VirtualKeyInvocation, { settlement?: Promise<Readonly<VirtualKeySettlementReceipt>> }>();

  const admit = (estimatedTokens: number): Readonly<ApiKeyAuthorizationResult> => {
    if (admissionError) throw admissionError;
    if (admission) return admission;
    try {
      const result = manager.authorizeUsage({ keyId: keyFingerprint, estimatedTokens });
      admission = Object.freeze({ ...result,
        budget: result.budget ? Object.freeze({ ...result.budget }) : null,
        rate: result.rate ? Object.freeze({ ...result.rate }) : null });
      return admission;
    } catch {
      // Even a failed persistence attempt may already have changed the manager's
      // counters. This logical request must never try admission a second time.
      admissionError = accountingError();
      throw admissionError;
    }
  };

  const capability: VirtualKeyRequestAccounting = Object.freeze({
    admit,
    beginInvocation(estimatedTokens: number, metering: "tokens" | "unsupported" = "tokens") {
      if (auditFailed || !Number.isSafeInteger(estimatedTokens) || estimatedTokens < 0) throw accountingError();
      if (metering !== "tokens" && metering !== "unsupported") throw accountingError();
      if (metering === "unsupported" && manager.describeUsage({ keyId: keyFingerprint })?.usage.budgetEnabled) {
        throw accountingError("VIRTUAL_KEY_METERING_UNSUPPORTED", 400);
      }
      const first = admit(estimatedTokens);
      if (!first.allowed) throw accountingError(first.code, first.code === "api_key_invalid" ? 401 : 429);
      let continuation: ApiKeyAuthorizationResult;
      try { continuation = manager.checkContinuation({ keyId: keyFingerprint, estimatedTokens }); }
      catch { throw accountingError(); }
      if (!continuation.allowed) throw accountingError(continuation.code, continuation.code === "api_key_invalid" ? 401 : 429);
      const invocation = Object.freeze({ id: randomUUID() });
      invocations.set(invocation, {});
      return invocation;
    },
    settle(invocation: VirtualKeyInvocation, usage: VirtualKeySettlement) {
      const state = invocations.get(invocation);
      if (!state) return Promise.reject(accountingError());
      if (state.settlement) return state.settlement;
      // Snapshot before yielding. Completion/error/finally callers share one
      // settlement promise; persistence repair never repeats recordUsage.
      const validSource = usage.source === "reported" || usage.source === "estimated" || usage.source === "partial";
      const validTokens = typeof usage.tokens === "number" && Number.isSafeInteger(usage.tokens) && usage.tokens >= 0;
      const snapshot: VirtualKeySettlement = Object.freeze({
        tokens: validSource && validTokens ? usage.tokens : null,
        source: validSource && validTokens ? usage.source : "unknown",
        incomplete: usage.incomplete !== false || usage.source === "partial" || !validSource || !validTokens,
        ...(typeof usage.usageAttemptId === "string" && /^[a-f0-9-]{36}$/u.test(usage.usageAttemptId)
          ? { usageAttemptId: usage.usageAttemptId } : {}),
      });
      state.settlement = Promise.resolve().then(async () => {
        let outcome: SettlementState = "unknown";
        let softBudgetExceeded = false;
        if (snapshot.tokens !== null) {
          try {
            const result = manager.recordUsage({ keyId: keyFingerprint, tokens: snapshot.tokens });
            outcome = result.recorded ? "recorded" : "accounting-unavailable";
            softBudgetExceeded = result.softBudgetExceeded;
          } catch { outcome = "accounting-unavailable"; }
        }
        let auditRecorded = true;
        try {
          await onEvent(Object.freeze({ ...snapshot, event: "virtual_key_usage_settled", requestAccountingId,
            invocationId: invocation.id, keyFingerprint, state: outcome, softBudgetExceeded }));
        } catch { auditFailed = true; auditRecorded = false; }
        return Object.freeze({ ...snapshot, state: outcome, auditRecorded });
      });
      return state.settlement;
    },
  });
  capabilities.add(capability);
  return capability;
}

function accountingError(code = "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE", statusCode = 503) {
  return Object.assign(new Error("Virtual key execution accounting did not authorize this operation."),
    { code, statusCode, category: statusCode === 429 ? "rate_limit" : statusCode === 400 ? "validation" : "internal", retryable: false });
}
