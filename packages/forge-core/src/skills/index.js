/**
 * Skills module index — public API for forge's skill marketplace layer.
 *
 * Re-exports the building blocks + a factory for the unified SkillRegistry.
 */
export { parseSkillManifest, buildSkillManifest } from "./skillManifest.js";
export { searchSkills, fetchSkillManifest, searchSkillRepos } from "./githubSkillSearcher.js";
export { installSkill, scanForForbidden } from "./skillInstaller.js";
export { scoreSkill, rankCandidates } from "./skillScorer.js";
export { evaluateTrust, filterByTrust } from "./skillTrustFilter.js";
export { createSkillLearningLedger } from "./skillLearningLedger.js";
export { createSkillRouter } from "./skillRouter.js";
export { createSkillRegistry } from "./skillRegistry.js";
