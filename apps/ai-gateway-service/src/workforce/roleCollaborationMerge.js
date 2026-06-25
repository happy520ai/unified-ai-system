import {
  COLLABORATION_PHASE,
  ROLE_BY_ID,
  TIER_BY_ROLE,
  DEPENDENCY_GRAPH,
  extractArray,
} from "./roleCollaborationData.js";
import {
  getDependencyOrder,
} from "./roleCollaborationPlan.js";

// ---------------------------------------------------------------------------
// mergeRoleOutputs
// ---------------------------------------------------------------------------

/**
 * Merge outputs from multiple roles into a unified project plan, resolving
 * conflicts and identifying cross-cutting concerns.
 *
 * @param {Object<string, object>} roleOutputs - Map of roleId to each role's analysis output.
 * @returns {{
 *   unifiedPlan: object,
 *   conflicts: Array<object>,
 *   crossCuttingConcerns: Array<object>,
 *   roleSummaries: Array<object>,
 *   recommendations: string[],
 * }}
 */
export function mergeRoleOutputs(roleOutputs) {
  if (!roleOutputs || typeof roleOutputs !== "object") {
    throw new Error("mergeRoleOutputs requires a non-null object mapping roleId to output.");
  }

  const roleIds = Object.keys(roleOutputs);
  if (roleIds.length === 0) {
    throw new Error("mergeRoleOutputs received an empty roleOutputs map.");
  }

  const roleSummaries = [];
  const conflicts = [];
  const crossCuttingConcerns = [];
  const recommendations = [];
  const allRisks = [];
  const allTasks = [];
  const allAcceptanceCriteria = [];

  // Phase 1: Extract per-role summaries
  for (const roleId of roleIds) {
    const output = roleOutputs[roleId];
    const role = ROLE_BY_ID.get(roleId);
    const summary = {
      roleId,
      roleName: role?.name ?? roleId,
      tier: TIER_BY_ROLE[roleId] ?? "unknown",
      hasOutput: output != null && typeof output === "object",
      keyDecisions: extractArray(output, "keyDecisions", "decisions"),
      risks: extractArray(output, "risks", "identifiedRisks"),
      tasks: extractArray(output, "tasks", "plannedTasks", "actionItems"),
      acceptanceCriteria: extractArray(output, "acceptanceCriteria", "criteria"),
      recommendations: extractArray(output, "recommendations", "suggestions"),
    };
    roleSummaries.push(summary);
    allRisks.push(...summary.risks.map((r) => ({ ...r, sourceRole: roleId })));
    allTasks.push(...summary.tasks.map((t) => ({ ...t, sourceRole: roleId })));
    allAcceptanceCriteria.push(...summary.acceptanceCriteria);
  }

  // Phase 2: Detect conflicts between role outputs
  conflicts.push(...detectScopeConflicts(roleSummaries));
  conflicts.push(...detectTimelineConflicts(roleSummaries));
  conflicts.push(...detectTechnologyConflicts(roleSummaries));

  // Phase 3: Identify cross-cutting concerns
  crossCuttingConcerns.push(...identifySecurityConcerns(allRisks, roleIds));
  crossCuttingConcerns.push(...identifyPerformanceConcerns(allRisks, roleIds));
  crossCuttingConcerns.push(...identifyDataFlowConcerns(roleSummaries));

  // Phase 4: Build unified plan
  const sortedRoleIds = getDependencyOrder(roleIds);
  const unifiedPlan = {
    phase: COLLABORATION_PHASE,
    generatedAt: new Date().toISOString(),
    roleCount: roleIds.length,
    executionOrder: sortedRoleIds,
    scope: mergeScopes(roleSummaries),
    tasks: deduplicateTasks(allTasks),
    risks: deduplicateRisks(allRisks),
    acceptanceCriteria: deduplicateStrings(allAcceptanceCriteria),
    milestones: buildMilestones(sortedRoleIds, roleSummaries),
    conflictCount: conflicts.length,
    crossCuttingConcernCount: crossCuttingConcerns.length,
  };

  // Phase 5: Generate recommendations
  if (conflicts.length > 0) {
    recommendations.push(
      `Resolve ${conflicts.length} conflict(s) before proceeding to implementation.`,
    );
  }
  if (crossCuttingConcerns.length > 0) {
    recommendations.push(
      `Address ${crossCuttingConcerns.length} cross-cutting concern(s) across role boundaries.`,
    );
  }
  if (allRisks.length > 5) {
    recommendations.push(
      "High risk count detected. Consider a dedicated risk mitigation session before execution.",
    );
  }
  recommendations.push(
    "Validate all handoff protocols between consecutive roles before starting the pipeline.",
  );
  recommendations.push(
    "Ensure the QA role has sufficient test fixtures from both frontend and backend engineers.",
  );

  return {
    unifiedPlan,
    conflicts,
    crossCuttingConcerns,
    roleSummaries,
    recommendations,
  };
}

// ===========================================================================
// Internal helpers for mergeRoleOutputs
// ===========================================================================

function detectScopeConflicts(roleSummaries) {
  const conflicts = [];
  const pmSummary = roleSummaries.find((s) => s.roleId === "pm");
  const archSummary = roleSummaries.find((s) => s.roleId === "architect");

  if (pmSummary && archSummary) {
    const pmDecisions = pmSummary.keyDecisions.map((d) => String(d).toLowerCase());
    const archDecisions = archSummary.keyDecisions.map((d) => String(d).toLowerCase());
    const overlapping = pmDecisions.filter((d) => archDecisions.includes(d));
    if (overlapping.length > 0) {
      conflicts.push({
        type: "scope-overlap",
        severity: "medium",
        roles: ["pm", "architect"],
        description: `PM and Architect both define decisions on: ${overlapping.join(", ")}. Clarify ownership.`,
      });
    }
  }

  return conflicts;
}

function detectTimelineConflicts(roleSummaries) {
  const conflicts = [];
  const feSummary = roleSummaries.find((s) => s.roleId === "frontend-engineer");
  const beSummary = roleSummaries.find((s) => s.roleId === "backend-engineer");

  if (feSummary && beSummary) {
    const feTasks = feSummary.tasks.length;
    const beTasks = beSummary.tasks.length;
    if (feTasks > 0 && beTasks > 0 && Math.abs(feTasks - beTasks) > Math.max(feTasks, beTasks) * 0.6) {
      conflicts.push({
        type: "workload-imbalance",
        severity: "low",
        roles: ["frontend-engineer", "backend-engineer"],
        description: `Significant task count imbalance: FE=${feTasks}, BE=${beTasks}. May indicate scope asymmetry.`,
      });
    }
  }

  return conflicts;
}

function detectTechnologyConflicts(roleSummaries) {
  return [];
}

function identifySecurityConcerns(allRisks, roleIds) {
  const concerns = [];
  const securityKeywords = ["auth", "secret", "token", "credential", "encrypt", "permission", "access"];
  const securityRisks = allRisks.filter((r) => {
    const desc = String(r?.description ?? r?.name ?? r).toLowerCase();
    return securityKeywords.some((kw) => desc.includes(kw));
  });

  if (securityRisks.length > 0) {
    concerns.push({
      type: "security",
      severity: "high",
      affectedRoles: [...new Set(securityRisks.map((r) => r.sourceRole))],
      description: `${securityRisks.length} security-related risk(s) identified across role outputs.`,
      recommendation: "Conduct a dedicated security review before implementation.",
    });
  }

  return concerns;
}

function identifyPerformanceConcerns(allRisks, roleIds) {
  const concerns = [];
  const perfKeywords = ["latency", "performance", "throughput", "bottleneck", "slow", "timeout"];
  const perfRisks = allRisks.filter((r) => {
    const desc = String(r?.description ?? r?.name ?? r).toLowerCase();
    return perfKeywords.some((kw) => desc.includes(kw));
  });

  if (perfRisks.length > 0) {
    concerns.push({
      type: "performance",
      severity: "medium",
      affectedRoles: [...new Set(perfRisks.map((r) => r.sourceRole))],
      description: `${perfRisks.length} performance-related risk(s) span multiple roles.`,
      recommendation: "Define performance budgets and include load testing in QA plan.",
    });
  }

  return concerns;
}

function identifyDataFlowConcerns(roleSummaries) {
  const concerns = [];
  const hasArchitect = roleSummaries.some((s) => s.roleId === "architect");
  const hasFE = roleSummaries.some((s) => s.roleId === "frontend-engineer");
  const hasBE = roleSummaries.some((s) => s.roleId === "backend-engineer");

  if (hasArchitect && hasFE && hasBE) {
    concerns.push({
      type: "data-flow",
      severity: "medium",
      affectedRoles: ["architect", "frontend-engineer", "backend-engineer"],
      description:
        "Three roles define data flow independently. Ensure architect's data flow diagram is consistent with FE and BE implementations.",
      recommendation:
        "Hold a data-flow alignment review between architect, frontend, and backend before coding begins.",
    });
  }

  return concerns;
}

function mergeScopes(roleSummaries) {
  const inScopeItems = new Set();
  const outOfScopeItems = new Set();

  for (const summary of roleSummaries) {
    for (const decision of summary.keyDecisions) {
      inScopeItems.add(typeof decision === "string" ? decision : JSON.stringify(decision));
    }
  }

  return {
    inScope: [...inScopeItems],
    outOfScope: [...outOfScopeItems],
    totalDecisions: inScopeItems.size,
  };
}

function deduplicateTasks(tasks) {
  const seen = new Map();
  for (const task of tasks) {
    const key = task?.taskId ?? task?.id ?? task?.name ?? JSON.stringify(task);
    if (!seen.has(key)) {
      seen.set(key, task);
    }
  }
  return [...seen.values()];
}

function deduplicateRisks(risks) {
  const seen = new Map();
  for (const risk of risks) {
    const key = risk?.id ?? risk?.description ?? JSON.stringify(risk);
    if (!seen.has(key)) {
      seen.set(key, risk);
    }
  }
  return [...seen.values()];
}

function deduplicateStrings(items) {
  return [...new Set(items.filter((i) => typeof i === "string" && i.length > 0))];
}

function buildMilestones(sortedRoleIds, roleSummaries) {
  return sortedRoleIds.map((roleId, idx) => {
    const role = ROLE_BY_ID.get(roleId);
    const summary = roleSummaries.find((s) => s.roleId === roleId);
    return {
      milestoneNumber: idx + 1,
      roleId,
      roleName: role?.name ?? roleId,
      title: role?.title ?? roleId,
      taskCount: summary?.tasks?.length ?? 0,
      riskCount: summary?.risks?.length ?? 0,
      status: "planned",
    };
  });
}
