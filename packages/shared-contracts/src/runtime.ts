/** Runtime constants shared by JavaScript consumers and TypeScript contracts. */
export const CONTRACT_VERSION = "0.2.0" as const;
export const LOCAL_CLIENT_DISPATCH_INTENT_VERSION = "local-client-dispatch-intent-v1" as const;
export const LOCAL_CLIENT_RECONCILIATION_QUERY_VERSION = "local-client-reconciliation-query-v1" as const;
export const LOCAL_CLIENT_DURABLE_RECEIPT_VERSION = "local-client-durable-receipt-v1" as const;
export const LOCAL_CLIENT_RECONCILIATION_RESPONSE_VERSION = "local-client-reconciliation-response-v1" as const;
export const LOCAL_CLIENT_RECEIPT_RECONCILIATION_HMAC_DOMAIN =
  "unified-ai/local-client-execution-receipt-reconciliation/v1" as const;
export const LOCAL_CLIENT_RECEIPT_RECONCILIATION_KEY_DERIVATION_DOMAIN =
  "local-client-receipt-reconciliation-protocol-v1" as const;

/**
 * Agent governance tool-decision strictness: allow (1) < require_approval (2)
 * < deny (3). Conflicts merge to the stricter decision; tools without an
 * explicit grant are denied by default. The type-level counterpart lives in
 * `contracts/agentGovernance.ts` (AgentToolDecision).
 */
export const AGENT_TOOL_DECISION_STRICTNESS = Object.freeze({
  allow: 1,
  require_approval: 2,
  deny: 3,
} as const);

/**
 * Argument and output fields that must never appear in agent-governance
 * audit records in plaintext. The type-level counterpart lives in
 * `contracts/agentGovernance.ts`.
 */
export const AGENT_GOVERNANCE_REDACTED_FIELDS = Object.freeze([
  "password",
  "token",
  "secret",
  "authorization",
  "full_card_number",
  "private_key",
] as const);
