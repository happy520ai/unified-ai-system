/**
 * @module roleExecutors
 * @description Orchestrator for workforce role executors.
 * Imports individual executors from sibling modules and provides
 * the public API: createRoleExecutor, executeAllRoles, executeRoleById.
 * LLM-driven functions are in roleExecutorsLlm.js.
 */

import { getRoleById, getRoleCapabilities, WORKFORCE_ROLES } from "./workforceRoles.js";
import {
  getOutputTemplate,
  validateOutput,
} from "./roleExecutorHelpers.js";
import { executeCEOAnalysis, executePMAnalysis } from "./roleExecutorsCeoPm.js";
import { executeArchitectAnalysis, executeFrontendAnalysis } from "./roleExecutorsArchFront.js";
import { executeBackendAnalysis, executeQAAnalysis } from "./roleExecutorsBackendQa.js";
import { executeReviewerAnalysis } from "./roleExecutorsReviewer.js";

// ---------------------------------------------------------------------------
// Executor Registry
// ---------------------------------------------------------------------------

/** @type {Object<string, function(string, object): object>} */
export const EXECUTOR_MAP = {
  "ceo": executeCEOAnalysis,
  "pm": executePMAnalysis,
  "architect": executeArchitectAnalysis,
  "frontend-engineer": executeFrontendAnalysis,
  "backend-engineer": executeBackendAnalysis,
  "qa": executeQAAnalysis,
  "reviewer": executeReviewerAnalysis,
};

// ---------------------------------------------------------------------------
// Factory Function (Public API)
// ---------------------------------------------------------------------------

/**
 * Create a role executor for the given workforce role.
 *
 * @param {string} roleId - One of: "ceo", "pm", "architect", "frontend-engineer",
 *                          "backend-engineer", "qa", "reviewer".
 * @returns {{
 *   roleId: string,
 *   role: object|undefined,
 *   analyze: function(string, object): object,
 *   getSystemPrompt: function(): string,
 *   getOutputTemplate: function(): object,
 *   validate: function(object): { valid: boolean, errors: string[], warnings: string[] }
 * }}
 * @throws {Error} If roleId is not a recognised workforce role.
 */
export function createRoleExecutor(roleId) {
  const executorFn = EXECUTOR_MAP[roleId];

  if (!executorFn) {
    const validIds = Object.keys(EXECUTOR_MAP).join(", ");
    throw new Error(`Unknown workforce role "${roleId}". Valid roleIds are: ${validIds}`);
  }

  let role;
  try {
    role = getRoleById(roleId);
  } catch {
    role = WORKFORCE_ROLES.find((r) => r.roleId === roleId);
  }

  return {
    roleId,
    role,

    analyze(goal, context) {
      return executorFn(goal, context);
    },

    getSystemPrompt() {
      const roleName = role?.name || roleId;
      const responsibility = role?.responsibility || "Perform role-specific analysis.";

      let capabilities = [];
      try {
        capabilities = getRoleCapabilities(roleId) || [];
      } catch {
        // Capabilities helper may not be available
      }

      const capSection = capabilities.length > 0
        ? `\n\nYour capabilities include:\n${capabilities.map((c) => `- ${c}`).join("\n")}`
        : "";

      return (
        `You are a world-class ${roleName} agent in a software development workforce.\n\n` +
        `Your primary responsibility: ${responsibility}${
        capSection
        }\n\nWhen given a project goal, produce a thorough, structured analysis demonstrating deep domain expertise.\n` +
        `Prioritise actionable, specific, and measurable outputs over vague generalisations.\n` +
        `Consider cross-functional dependencies and risks.\n` +
        `Use industry-standard frameworks and terminology appropriate to your role.`
      );
    },

    getOutputTemplate() {
      return getOutputTemplate(roleId);
    },

    validate(output) {
      return validateOutput(roleId, output);
    },
  };
}

// ---------------------------------------------------------------------------
// Orchestration: Execute All Roles
// ---------------------------------------------------------------------------

/**
 * Execute all 7 workforce role analyses for a goal.
 *
 * @param {string} goal           - Project or product goal description.
 * @param {object} [context={}]   - Optional shared execution context.
 * @returns {{
 *   goal: string,
 *   executedAt: string,
 *   roleOutputs: Object<string, object>,
 *   crossRoleDependencies: Array<{ from: string, to: string, dependency: string }>,
 *   summary: string
 * }}
 */
export function executeAllRoles(goal, context = {}) {
  const roleIds = Object.keys(EXECUTOR_MAP);
  const roleOutputs = {};

  for (const roleId of roleIds) {
    const enrichedContext = { ...context, priorOutputs: { ...roleOutputs } };
    roleOutputs[roleId] = EXECUTOR_MAP[roleId](goal, enrichedContext);
  }

  const crossRoleDependencies = [
    { from: "ceo", to: "pm", dependency: "Strategic objectives and OKRs inform user story mapping and scope" },
    { from: "ceo", to: "architect", dependency: "Decision boundaries and risk appetite shape architectural trade-offs" },
    { from: "pm", to: "frontend-engineer", dependency: "User stories and acceptance criteria drive component design and UX" },
    { from: "pm", to: "backend-engineer", dependency: "Scope definition and milestones determine API prioritisation" },
    { from: "architect", to: "frontend-engineer", dependency: "API contracts and data flows inform frontend integration layer" },
    { from: "architect", to: "backend-engineer", dependency: "System impact and tech decisions define implementation boundaries" },
    { from: "architect", to: "qa", dependency: "Threat model and performance targets define test requirements" },
    { from: "frontend-engineer", to: "qa", dependency: "Component architecture and UX flows define E2E test scenarios" },
    { from: "backend-engineer", to: "qa", dependency: "API specs and validation rules define integration test cases" },
    { from: "qa", to: "reviewer", dependency: "Test strategy and coverage inform release readiness assessment" },
    { from: "reviewer", to: "ceo", dependency: "Risk review and Go/No-Go feed back into strategic decisions" },
    { from: "all", to: "reviewer", dependency: "All role outputs are inputs to the comprehensive risk review" },
  ];

  return {
    goal,
    executedAt: new Date().toISOString(),
    roleOutputs,
    crossRoleDependencies,
    summary: `Workforce analysis for "${goal}": ${roleIds.length} roles executed, ${crossRoleDependencies.length} cross-role dependencies. Pipeline: CEO > PM > Architect > Frontend > Backend > QA > Reviewer.`,
  };
}

// ---------------------------------------------------------------------------
// Helper: Execute Single Role by ID
// ---------------------------------------------------------------------------

/**
 * Execute a single role analysis by its identifier.
 *
 * @param {string} roleId       - Workforce role identifier.
 * @param {string} goal         - Project or product goal description.
 * @param {object} [context={}] - Optional execution context.
 * @returns {object} Role-specific analysis output.
 * @throws {Error} If roleId is not recognised.
 */
export function executeRoleById(roleId, goal, context = {}) {
  const executorFn = EXECUTOR_MAP[roleId];
  if (!executorFn) {
    const validIds = Object.keys(EXECUTOR_MAP).join(", ");
    throw new Error(`Cannot execute unknown role "${roleId}". Valid roleIds are: ${validIds}`);
  }
  return executorFn(goal, context);
}
