/**
 * @module roleExecutorHelpers
 * @description Shared pure helpers, output templates, and validation for role executors.
 * This module has no imports from executor modules to avoid circular dependencies.
 */

/**
 * Build the standard roleMeta block attached to every executor result.
 * @param {string} roleId
 * @param {string} goal
 * @param {"high"|"medium"|"low"} [confidence="high"]
 * @returns {object}
 */
export function buildRoleMeta(roleId, goal, confidence = "high") {
  return { roleId, executedAt: new Date().toISOString(), goal, confidence };
}

/**
 * Confidence heuristic based on richness of supplied context.
 * @param {object} context
 * @returns {"high"|"medium"|"low"}
 */
export function estimateConfidence(context = {}) {
  const signals = [
    context.templateId,
    context.constraints && Object.keys(context.constraints).length > 0,
    context.priorOutputs && Object.keys(context.priorOutputs).length > 0,
  ].filter(Boolean).length;
  if (signals >= 2) return "high";
  if (signals === 1) return "medium";
  return "low";
}

/**
 * Return the expected output structure template for a given role.
 * @param {string} roleId
 * @returns {object}
 */
export function getOutputTemplate(roleId) {
  const templates = {
    "ceo": { strategicObjectives: "array<{ id, objective, horizon, owner, successIndicator }>", okrs: "array<{ objective, keyResults }>", successMetrics: "array<{ kpi, baseline, target, frequency }>", stakeholderAnalysis: "array<{ stakeholder, impact, influence, strategy }>", decisionBoundaries: "{ riskAppetite, description, budgetCeiling, timelineConstraint, escalationThreshold, tradeOffRules }", priorities: "array<{ rank, item, rationale }>" },
    "pm": { userStories: "array<{ epic, stories }>", scopeDefinition: "{ inScope, outOfScope, deferred }", milestones: "array<{ id, name, week, deliverables, dependencies }>", userJourneys: "array<{ journeyName, persona, steps }>", priorityMatrix: "array<{ feature, impact, effort, quadrant, priority }>", definitionOfDone: "array<{ deliverable, criteria }>" },
    "architect": { systemImpact: "array<{ component, impactLevel, description, changes }>", apiContracts: "array<{ endpoint, description, version, request, response }>", dataFlows: "array<{ flowName, diagram }>", threatModel: "array<{ category, threat, severity, mitigation, stridePhase }>", performancePlan: "{ targets, strategies }", rollbackStrategy: "{ approach, blastRadius, rollbackProcedure, estimatedRollbackTime }", techDecisions: "array<{ decision, alternatives, rationale, tradeOff }>" },
    "frontend-engineer": { componentArchitecture: "{ hierarchy, sharedComponents }", stateStrategy: "{ approach, layers }", uxFlows: "array<{ flowName, sequence }>", accessibilityReqs: "{ standard, requirements }", responsiveDesign: "{ breakpoints, strategies }", errorHandling: "array<{ scenario, userExperience, technicalApproach }>", performanceBudget: "{ budgets, monitoringStrategy }" },
    "backend-engineer": { apiSpecs: "array<{ method, path, summary, requestSchema, responseSchema }>", databaseSchema: "{ tables, migrations }", serviceDesign: "{ services, repositories, middleware }", validationRules: "{ inputValidation, businessRules }", integrationPoints: "array<{ name, type, protocol, topic, description }>", cachingStrategy: "array<{ layer, target, ttl, invalidation, hitRate }>", errorHandling: "{ strategy, layers, logging }" },
    "qa": { testStrategy: "{ overview, layers }", testCases: "array<{ id, title, priority, type, given, when, then }>", regressionPlan: "{ approach, categories, totalTests, estimatedTime }", edgeCases: "array<{ id, scenario, expected }>", performanceTests: "array<{ scenario, description, criteria }>", securityTests: "array<{ id, test, method, expected }>", acceptanceMatrix: "array<{ requirement, userStory, testCases, verified }>" },
    "reviewer": { securityRisks: "array<{ id, owaspCategory, risk, likelihood, impact, riskScore, recommendation, blocking }>", complianceChecklist: "array<{ category, items }>", qualityStandards: "{ codeQuality, reviewProcess }", performanceRisks: "array<{ risk, likelihood, impact, riskScore, mitigation }>", operationalRisks: "array<{ area, risk, likelihood, impact, riskScore, mitigation }>", nonGoals: "array<{ nonGoal, rationale }>", abusePaths: "array<{ path, actor, scenario, mitigation }>", goNoGo: "{ recommendation, summary, conditions, reviewCadence, escalationContact }" },
  };
  return templates[roleId] || {};
}

/**
 * Validate executor output against minimum quality criteria.
 * @param {string} roleId
 * @param {object} output
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateOutput(roleId, output) {
  const errors = [];
  const warnings = [];

  if (!output || typeof output !== "object") {
    errors.push("Output must be a non-null object.");
    return { valid: false, errors, warnings };
  }

  if (!output.roleMeta) {
    errors.push("Missing required field: roleMeta");
  } else {
    if (output.roleMeta.roleId !== roleId) {
      errors.push(`roleMeta.roleId "${output.roleMeta.roleId}" does not match expected "${roleId}"`);
    }
    if (!output.roleMeta.executedAt) warnings.push("roleMeta.executedAt is missing");
    if (!output.roleMeta.goal) warnings.push("roleMeta.goal is missing");
    if (!["high", "medium", "low"].includes(output.roleMeta.confidence)) {
      warnings.push(`roleMeta.confidence should be "high", "medium", or "low"`);
    }
  }

  const template = getOutputTemplate(roleId);
  for (const key of Object.keys(template)) {
    if (!(key in output)) {
      errors.push(`Missing required output section: "${key}"`);
    } else if (Array.isArray(output[key]) && output[key].length === 0) {
      warnings.push(`Section "${key}" is empty; expected substantive content`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
