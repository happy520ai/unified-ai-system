/**
 * @unified-ai-system/policy-engine
 *
 * Deterministic policy calculus for the agent governance control plane:
 * classification backfill, draft validation, layered compilation,
 * no-expansion recompilation and SHA-256/HMAC integrity. Pure functions
 * only — no filesystem, no clock, no network. Model output enters as
 * drafts and never bypasses validation.
 */

export {
  DEFAULT_TOOL_DECISION,
  atLeastAsStrict,
  decisionStrictness,
  getEffectiveToolDecision,
  isAgentToolDecision,
  isSafeToolName,
  mergeDecisions,
} from "./decisionAlgebra.ts";
export {
  AGENT_FAMILIES,
  AGENT_TRAITS,
  deriveToolRisk,
  isAgentFamily,
  isAgentTrait,
  isValidClassification,
  maxRiskLevel,
  normalizeTraits,
  recomputeClassification,
} from "./classification.ts";
export {
  earliestExpiry,
  intersectCapabilities,
  intersectStringSets,
  mergeLimits,
  mergeMandatoryRules,
  mergePermissions,
  mergeResourceScopes,
  mergeSafetyRequirements,
  scopesOf,
  unionStringSets,
} from "./merge.ts";
export {
  validateAgentDraft,
  validateNoSelfModification,
} from "./validation.ts";
export type {
  AgentDraftValidationError,
  AgentDraftValidationInput,
  AgentDraftValidationResult,
  ParentValidationContext,
} from "./validation.ts";
export {
  compileEffectivePolicy,
  isPolicyExpired,
  PolicyCompilationError,
  recompileWithoutExpansion,
  validatePolicyLayerContent,
  validatePolicyLayerStack,
} from "./compiler.ts";
export type {
  CompileEffectivePolicyInput,
  PolicyLayerValidationError,
  PolicyLayerValidationResult,
  RecompileClamp,
  RecompileResult,
} from "./compiler.ts";
export {
  buildManifest,
  computeAgentHash,
  computeArgumentsHash,
  computePolicyContentHash,
  computePolicyHash,
  sha256Hex,
  stableStringify,
  verifyEffectivePolicyIntegrity,
  verifyManifestSignature,
} from "./integrity.ts";
export type { EffectivePolicyIntegrityResult } from "./integrity.ts";
export {
  checkUsageLimits,
  evaluateResourceScope,
} from "./enforcement.ts";
export type {
  ScopeCheckRequest,
  ScopeCheckResult,
} from "./enforcement.ts";
