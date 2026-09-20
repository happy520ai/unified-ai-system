export const COMMANDS = new Set([
  "agents",
  "chat",
  "codec",
  "clients",
  "clients-onboarding",
  "control-center",
  "demo",
  "doctor",
  "enhance",
  "forge",
  "help",
  "knowledge",
  "providers",
  "routing",
  "serve",
  "spend",
  "status",
  "taiji",
  "version",
  "verification",
  "workflow",
  "workforce",
]);
export const WORKFLOW_OPERATIONS = new Set(["run", "list", "status", "recover"]);
export const WORKFLOW_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u;
export const WORKFLOW_STATUSES = new Set(["running", "prepared", "publishing", "completed", "failed", "cancelled", "interrupted", "unknown"]);
export const WORKFLOW_ERROR_CODES = new Set([
  "APPROVAL_REVIEW_UNAVAILABLE",
  "TOOL_APPROVAL_REQUIRED", "AGENT_NOT_FOUND", "AGENT_EXPIRED", "AGENT_EXECUTION_FENCED",
  "WORKFLOW_INPUT_CONFLICT", "WORKFLOW_NOT_FOUND", "WORKFLOW_BUSY", "WORKFLOW_OUTCOME_UNKNOWN", "WORKFLOW_AGENT_ID_REQUIRED",
  "WORKFLOW_CLAIM_EXPIRED", "WORKFLOW_RUN_CANCELLED", "WORKFLOW_RUN_INTERRUPTED", "WORKFLOW_EXECUTION_FAILED",
  "WORKFLOW_STATE_INVALID", "WORKFLOW_STATE_UNAVAILABLE", "WORKFLOW_STATE_MISSING", "WORKFLOW_STATE_INITIALIZING",
  "WORKFLOW_STATE_PERMISSION_DENIED", "WORKFLOW_STORAGE_FULL", "WORKFLOW_STAGING_CAPACITY", "WORKFLOW_STAGING_CLEANUP_REQUIRED",
  "WORKFLOW_RECORD_TOO_LARGE", "WORKFLOW_OUTPUT_PATH_UNSAFE", "WORKFLOW_STAGED_CONTENT_CHANGED", "WORKFLOW_ARTIFACT_OUTCOME_UNCERTAIN",
  "WORKFLOW_ARTIFACT_RECONCILIATION_REQUIRED", "WORKFLOW_POST_WRITE_GOVERNANCE_PENDING", "WORKFLOW_POST_WRITE_GOVERNANCE_UNCERTAIN",
  "WORKFLOW_TARGET_OCCUPIED", "WORKFLOW_TARGET_CHANGED", "WORKFLOW_ORIGINAL_AUTHORIZATION_UNVERIFIED",
  "WORKFLOW_APPROVED_MATERIAL_MISMATCH", "WORKFLOW_GOVERNANCE_SUBJECT_MISMATCH", "TOOL_SCOPE_DENIED", "TOOL_DENIED_BY_POLICY",
]);
export const AGENT_GOVERNANCE_SUBCOMMANDS = new Set([
  "status",
  "list",
  "show",
  "generate",
  "run",
  "revoke",
  "approvals",
  "approve",
  "reject",
]);
export const AGENT_GOVERNANCE_MUTATIONS = new Set([
  "generate",
  "run",
  "revoke",
  "approve",
  "reject",
]);
export const AGENT_ID_PATTERN = /^agt_[A-Za-z0-9_-]{1,128}$/u;
export const AGENT_APPROVAL_ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/u;
export const AGENT_TOOL_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]{0,159}$/u;
export const AGENT_REVIEW_SENSITIVE_KEY = /(?:password|token|secret|authorization|credential|private.?key|sealed|encrypted)/iu;
export const ENHANCEMENT_PROFILES = new Set([
  "auto",
  "general",
  "coding",
  "analysis",
  "writing",
  "research",
  "planning",
]);
export const ENHANCEMENT_LANGUAGES = new Set(["auto", "zh-CN", "en"]);
export const LOCAL_CLIENT_LIFECYCLE_SUBCOMMANDS = new Set([
  "discover",
  "list",
  "inspect",
  "register",
  "verify",
  "disable",
  "revoke",
  "smart-manage",
]);
export const LOCAL_CLIENT_LIFECYCLE_ALWAYS_MUTATING = new Set([
  "register",
  "verify",
  "disable",
  "revoke",
]);
export const LOCAL_CLIENT_DISABLE_REASONS = new Set([
  "manual_disable",
  "maintenance",
  "security_review",
]);
export const LOCAL_CLIENT_REVOKE_REASONS = new Set([
  "manual_revoke",
  "credential_compromise",
  "identity_mismatch",
  "security_incident",
]);
export const SAFE_LOCAL_CLIENT_LIFECYCLE_ERROR_CODES = new Set([
  "FORBIDDEN",
  "GATEWAY_CLIENT_ABORTED",
  "GATEWAY_CLIENT_TIMEOUT",
  "GATEWAY_HTTP_ERROR",
  "GATEWAY_NETWORK_ERROR",
  "GATEWAY_PROTOCOL_ERROR",
  "LOCAL_CLIENT_LIFECYCLE_OUTCOME_UNKNOWN",
  "LOCAL_CLIENT_LIFECYCLE_UNAVAILABLE",
  "LOCAL_CLIENT_VERIFICATION_CANCELLED",
  "LOCAL_CLIENT_VERIFICATION_CONFIGURATION_INVALID",
  "LOCAL_CLIENT_VERIFICATION_DECLARATION_NOT_FOUND",
  "LOCAL_CLIENT_VERIFICATION_DECLARATION_STALE",
  "LOCAL_CLIENT_VERIFICATION_EVIDENCE_INVALID",
  "LOCAL_CLIENT_VERIFICATION_PROBE_FAILED",
  "LOCAL_CLIENT_VERIFICATION_PROBE_UNAVAILABLE",
  "LOCAL_CLIENT_VERIFICATION_PROMOTION_FAILED",
  "LOCAL_CLIENT_VERIFICATION_REQUEST_INVALID",
  "LOCAL_CLIENT_VERIFICATION_SCOPE_REQUIRED",
  "UNAUTHENTICATED",
  "local_client_disable_client_missing",
  "local_client_disable_failed",
  "local_client_disable_invalid_json",
  "local_client_disable_invalid_payload",
  "local_client_disable_not_found",
  "local_client_discover_system_failed",
  "local_client_discover_system_invalid_json",
  "local_client_invalid_payload",
  "local_client_register_adapter_binding_incomplete",
  "local_client_register_adapter_binding_invalid",
  "local_client_register_capabilities_missing",
  "local_client_register_client_missing",
  "local_client_register_failed",
  "local_client_register_invalid_json",
  "local_client_register_persistence_failed",
  "local_client_register_revoked",
  "local_client_registry_corrupt",
  "local_client_registry_failed",
  "local_client_revoke_authority_unavailable",
  "local_client_revoke_client_missing",
  "local_client_revoke_failed",
  "local_client_revoke_invalid_json",
  "local_client_revoke_invalid_payload",
  "local_client_revoke_not_found",
  "local_client_revoke_revision_conflict",
  "local_client_revoke_revision_required",
  "local_client_scope_invalid",
  "local_client_scope_required",
  "local_client_smart_manage_failed",
  "local_client_smart_manage_invalid_json",
  "local_client_verification_persistence_failed",
  "local_client_verification_scope_required",
  "local_client_verify_failed",
  "local_client_verify_invalid_json",
]);
export const LOCAL_CLIENT_ID_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
export const LOCAL_CLIENT_CAPABILITY_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/u;
export const LOCAL_CLIENT_DECLARATION_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
export const LOCAL_CLIENT_SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
export const LOCAL_CLIENT_ONBOARDING_SUBCOMMANDS = new Set([
  "profiles",
  "inspect",
  "verify",
  "plan",
  "approve",
  "apply",
  "rollback",
  "recover",
]);
export const LOCAL_CLIENT_ONBOARDING_MUTATIONS = new Set([
  "approve",
  "apply",
  "rollback",
  "recover",
]);
export const LOCAL_CLIENT_ONBOARDING_ACTIONS = new Set([
  "enable",
  "disable",
  "rollback",
  "recover",
]);
export const LOCAL_CLIENT_ONBOARDING_CERTIFICATION =
  "fixture-tested-not-real-client-certified";
export const LOCAL_CLIENT_ONBOARDING_PROFILE_DEFINITIONS = Object.freeze([
  Object.freeze({
    profileId: "claude-compatible-mcp-json",
    client: "claude-compatible",
    label: "Claude-compatible",
    containerKey: "mcpServers",
    format: "json-only",
  }),
  Object.freeze({
    profileId: "cursor-mcp-json",
    client: "cursor",
    label: "Cursor",
    containerKey: "mcpServers",
    format: "json-only",
  }),
  Object.freeze({
    profileId: "vscode-mcp-json",
    client: "vscode",
    label: "VS Code",
    containerKey: "servers",
    format: "json-only",
  }),
  Object.freeze({
    profileId: "vscode-mcp-jsonc-v1",
    client: "vscode",
    label: "VS Code JSONC",
    containerKey: "servers",
    format: "jsonc",
  }),
  Object.freeze({
    profileId: "codex-mcp-toml-v1",
    client: "codex",
    label: "Codex TOML",
    containerKey: "mcp_servers",
    format: "toml",
  }),
  Object.freeze({
    profileId: "continue-mcp-yaml-v1",
    client: "continue",
    label: "Continue YAML",
    containerKey: "mcpServers",
    format: "yaml",
  }),
]);
export const SAFE_LOCAL_CLIENT_ONBOARDING_ERROR_CODES = new Set([
  "FORBIDDEN",
  "GATEWAY_CLIENT_ABORTED",
  "GATEWAY_CLIENT_TIMEOUT",
  "GATEWAY_HTTP_ERROR",
  "GATEWAY_NETWORK_ERROR",
  "GATEWAY_PROTOCOL_ERROR",
  "LOCAL_CLIENT_ONBOARDING_API_APPROVAL_INVALID",
  "LOCAL_CLIENT_ONBOARDING_API_CONFIGURATION_INVALID",
  "LOCAL_CLIENT_ONBOARDING_DISABLED",
  "LOCAL_CLIENT_ONBOARDING_API_EXTERNAL_EFFECT_NOT_DURABLE",
  "LOCAL_CLIENT_ONBOARDING_API_IDEMPOTENCY_NOT_DURABLE",
  "LOCAL_CLIENT_ONBOARDING_API_IDEMPOTENCY_REQUIRED",
  "LOCAL_CLIENT_ONBOARDING_API_DEPENDENCY_FAILED",
  "LOCAL_CLIENT_ONBOARDING_API_PLAN_MISMATCH",
  "LOCAL_CLIENT_ONBOARDING_API_PLAN_UNKNOWN",
  "LOCAL_CLIENT_ONBOARDING_API_REQUEST_INVALID",
  "LOCAL_CLIENT_ONBOARDING_APPROVAL_IDEMPOTENCY_CONFLICT",
  "LOCAL_CLIENT_ONBOARDING_APPROVAL_OUTCOME_UNKNOWN",
  "LOCAL_CLIENT_ONBOARDING_CANCELLED",
  "LOCAL_CLIENT_ONBOARDING_IDEMPOTENCY_REJECTED",
  "LOCAL_CLIENT_ONBOARDING_OUTCOME_UNKNOWN",
  "LOCAL_CLIENT_ONBOARDING_PRECOMMIT_REJECTED",
  "LOCAL_CLIENT_ONBOARDING_RUNTIME_CLOSED",
  "LOCAL_CLIENT_ONBOARDING_RUNTIME_CONFIGURATION_INVALID",
  "LOCAL_CLIENT_ONBOARDING_TENANT_FORBIDDEN",
  "LOCAL_CLIENT_ONBOARDING_UNAVAILABLE",
  "UNAUTHENTICATED",
]);
export const UNKNOWN_LOCAL_CLIENT_ONBOARDING_ERROR_CODES = new Set([
  "LOCAL_CLIENT_ONBOARDING_APPROVAL_OUTCOME_UNKNOWN",
  "LOCAL_CLIENT_ONBOARDING_OUTCOME_UNKNOWN",
]);
export const LOCAL_CLIENT_ONBOARDING_PROFILE_IDS = new Set(
  LOCAL_CLIENT_ONBOARDING_PROFILE_DEFINITIONS.map(({ profileId }) => profileId),
);
export function localClientOnboardingProfileFormat(profileId) {
  return LOCAL_CLIENT_ONBOARDING_PROFILE_DEFINITIONS.find((profile) => profile.profileId === profileId)?.format;
}
export const LOCAL_CLIENT_ONBOARDING_RECEIPT_MAX_BYTES = 64 * 1024;
export const LOCAL_CLIENT_ONBOARDING_PLAN_ID_PATTERN = /^onboarding_[a-f0-9]{64}$/u;
export const LOCAL_CLIENT_ONBOARDING_REGISTRY_PLAN_ID_PATTERN = /^onboard:[a-z0-9-]+:[a-f0-9]{64}$/u;
export const LOCAL_CLIENT_ONBOARDING_TRANSACTION_ID_PATTERN = /^tx_[a-f0-9]{64}$/u;
export const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
export const IDEMPOTENCY_KEY_PATTERN = /^[\x21-\x7e]{1,255}$/u;
export const CONTROL_CENTER_VISIBLE_ID_PATTERN = /^[\x21-\x7e]{1,256}$/u;
export const CONTROL_CENTER_MODEL_PREVIEW_LIMIT = 100;
export const CONTROL_CENTER_MANIFEST_SCHEMA = "unified-ai-system/local-ai-control-center/v1";
export const CONTROL_CENTER_MANIFEST_SCHEMA_V2 = "unified-ai-system/local-ai-control-center/v2";
export const CONTROL_CENTER_MANIFEST_MAX_BYTES = 32 * 1024;
export const CONTROL_CENTER_IDEMPOTENCY_PREFIX_PATTERN = /^[\x21-\x7e]{1,180}$/u;

export const COMMAND_ALIASES = new Map([
  ["center", "control-center"],
  ["health", "status"],
  ["start", "serve"],
]);
