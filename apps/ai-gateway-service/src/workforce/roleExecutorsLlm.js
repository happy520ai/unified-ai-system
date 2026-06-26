/**
 * @module roleExecutorsLlm
 * @description LLM-driven execution path for role executors (Phase 6 Enhancement).
 */

import { EXECUTOR_MAP } from "./roleExecutors.js";
import { getOutputTemplate as getOutputTemplateHelper } from "./roleExecutorHelpers.js";
import { getRoleById, getRoleCapabilities, WORKFORCE_ROLES } from "./workforceRoles.js";

/**
 * Create a role executor for the given workforce role (local copy for LLM module use).
 * @param {string} roleId
 * @returns {object}
 */
function createExecutorForLlm(roleId) {
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
    getSystemPrompt() {
      const roleName = role?.name || roleId;
      const responsibility = role?.responsibility || "Perform role-specific analysis.";
      let capabilities = [];
      try { capabilities = getRoleCapabilities(roleId) || []; } catch { /* unavailable */ }
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
  };
}

/**
 * Execute a single role analysis by its identifier (local copy for LLM module use).
 * @param {string} roleId
 * @param {string} goal
 * @param {object} [context={}]
 * @returns {object}
 */
function executeRoleByIdLocal(roleId, goal, context = {}) {
  const executorFn = EXECUTOR_MAP[roleId];
  if (!executorFn) {
    const validIds = Object.keys(EXECUTOR_MAP).join(", ");
    throw new Error(`Cannot execute unknown role "${roleId}". Valid roleIds are: ${validIds}`);
  }
  return executorFn(goal, context);
}

/**
 * Build an LLM analysis request for a role.
 *
 * @param {string} roleId - Role ID
 * @param {string} goal - Goal description
 * @param {object} context - Execution context (may contain priorOutputs)
 * @returns {{ systemPrompt: string, userMessage: string }}
 */
export function buildLlmPromptForRole(roleId, goal, context = {}) {
  const executor = createExecutorForLlm(roleId);
  const systemPrompt = executor.getSystemPrompt();

  let userMessage = `Goal: ${goal}`;
  if (context.templateId) {
    userMessage += `\nTemplate: ${context.templateId}`;
  }
  if (context.constraints) {
    userMessage += `\nConstraints: ${JSON.stringify(context.constraints)}`;
  }
  if (context.priorOutputs && Object.keys(context.priorOutputs).length > 0) {
    const priorSummary = Object.entries(context.priorOutputs)
      .map(([role, output]) => {
        const summary = output?.summary || output?.roleMeta?.goal || "Completed analysis";
        return `[${role}]: ${summary}`;
      })
      .join("\n");
    userMessage += `\n\nPrior role analyses:\n${priorSummary}`;
  }

  userMessage += "\n\nPlease provide your role-specific analysis in structured JSON format matching the expected output schema.";

  return { systemPrompt, userMessage };
}

/**
 * Try to parse LLM output as structured JSON.
 *
 * @param {string} text - Raw LLM output
 * @returns {object|null} Parsed object or null
 */
export function tryParseLlmOutput(text) {
  if (!text || typeof text !== "string") return null;

  try {
    return JSON.parse(text);
  } catch {
    // continue
  }

  const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim());
    } catch {
      // continue
    }
  }

  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch {
      // give up
    }
  }

  return null;
}

/**
 * Execute a single role analysis using LLM when available, falling back to template.
 *
 * @param {string} roleId - Role ID
 * @param {string} goal - Goal description
 * @param {object} [context={}] - Execution context
 * @param {object} [providerAdapter] - Optional provider adapter { generate(messages, model) }
 * @param {object} [llmOptions={}] - LLM options { model, maxTokens }
 * @returns {Promise<object>} Role analysis result (with llmDriven flag)
 */
export async function executeRoleWithLLM(roleId, goal, context = {}, providerAdapter = null, llmOptions = {}) {
  const templateOutput = executeRoleByIdLocal(roleId, goal, context);

  if (!providerAdapter || typeof providerAdapter.generate !== "function") {
    return { ...templateOutput, llmDriven: false, llmFallback: "no_provider" };
  }

  try {
    const { systemPrompt, userMessage } = buildLlmPromptForRole(roleId, goal, context);

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    const providerRequest = {
      request: {
        messages,
        options: {
          temperature: 0.3,
          maxOutputTokens: llmOptions.maxTokens || 4096,
        },
      },
      target: {
        providerId: llmOptions.providerId || "default",
        modelId: llmOptions.model || "default",
      },
    };

    const providerResponse = await providerAdapter.generate(providerRequest);
    const rawText = providerResponse?.text || "";

    const parsed = tryParseLlmOutput(rawText);

    if (parsed && typeof parsed === "object" && parsed.roleMeta) {
      return {
        ...parsed,
        llmDriven: true,
        llmRawText: rawText.length > 5000 ? `${rawText.slice(0, 5000)  }...` : rawText,
        llmUsage: providerResponse?.usage || null,
        llmLatencyMs: providerResponse?.latencyMs || null,
        templateBaseline: templateOutput,
      };
    }

    return {
      ...templateOutput,
      llmDriven: true,
      llmEnhancedText: rawText.length > 5000 ? `${rawText.slice(0, 5000)  }...` : rawText,
      llmUsage: providerResponse?.usage || null,
      llmLatencyMs: providerResponse?.latencyMs || null,
      llmStructured: false,
    };
  } catch (err) {
    return {
      ...templateOutput,
      llmDriven: false,
      llmFallback: `llm_error: ${err.message || "unknown"}`,
    };
  }
}

/**
 * Execute all 7 role analyses using LLM when available.
 *
 * Pipeline order: CEO -> PM -> Architect -> Frontend -> Backend -> QA -> Reviewer.
 * Each role receives prior outputs as context.
 *
 * @param {string} goal - Goal description
 * @param {object} [context={}] - Shared context
 * @param {object} [providerAdapter] - Provider adapter
 * @param {object} [llmOptions={}] - LLM options
 * @returns {Promise<object>} Full analysis result
 */
export async function executeAllRolesWithLLM(goal, context = {}, providerAdapter = null, llmOptions = {}) {
  const roleIds = Object.keys(EXECUTOR_MAP);
  const roleOutputs = {};
  const llmStats = { totalCalls: 0, successfulCalls: 0, fallbackCalls: 0, totalLatencyMs: 0 };

  for (const roleId of roleIds) {
    const enrichedContext = { ...context, priorOutputs: { ...roleOutputs } };
    const result = await executeRoleWithLLM(roleId, goal, enrichedContext, providerAdapter, llmOptions);
    roleOutputs[roleId] = result;

    if (result.llmDriven && !result.llmFallback) {
      llmStats.successfulCalls++;
    } else {
      llmStats.fallbackCalls++;
    }
    llmStats.totalCalls++;
    if (result.llmLatencyMs) llmStats.totalLatencyMs += result.llmLatencyMs;
  }

  const crossRoleDependencies = [
    { from: "ceo", to: "pm", dependency: "Strategic objectives and OKRs inform user story mapping and scope" },
    { from: "ceo", to: "architect", dependency: "Decision boundaries and risk appetite shape architectural trade-offs" },
    { from: "pm", to: "frontend-engineer", dependency: "User stories and acceptance criteria drive component design and UX" },
    { from: "pm", to: "backend-engineer", dependency: "Scope definition and milestones determine API prioritisation" },
    { from: "architect", to: "frontend-engineer", dependency: "API contracts and data flows inform frontend integration layer" },
    { from: "architect", to: "backend-engineer", dependency: "Architecture decisions and infrastructure plan shape backend service design" },
    { from: "frontend-engineer", to: "qa", dependency: "Component structure and UI flows define test scope" },
    { from: "backend-engineer", to: "qa", dependency: "API contracts and data models define integration test targets" },
    { from: "qa", to: "reviewer", dependency: "Test results and quality metrics feed into final review" },
  ];

  return {
    goal,
    executedAt: new Date().toISOString(),
    roleOutputs,
    crossRoleDependencies,
    llmStats,
    llmDriven: llmStats.successfulCalls > 0,
    summary: `LLM-enhanced workforce analysis for "${goal}": ${roleIds.length} roles executed (${llmStats.successfulCalls} LLM-driven, ${llmStats.fallbackCalls} template fallback). Pipeline: CEO > PM > Architect > Frontend > Backend > QA > Reviewer.`,
  };
}
