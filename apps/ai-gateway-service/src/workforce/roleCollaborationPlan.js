import {
  COLLABORATION_PHASE,
  ROLE_BY_ID,
  TIER_BY_ROLE,
  DEPENDENCY_GRAPH,
  HANDOFF_PROTOCOLS,
  COLLABORATION_WORKFLOWS,
  inferHandoffType,
} from "./roleCollaborationData.js";

// ---------------------------------------------------------------------------
// createCollaborationPlan
// ---------------------------------------------------------------------------

/**
 * Generate a step-by-step collaboration plan for a given goal and workflow.
 *
 * @param {string} goal - The project goal or objective.
 * @param {string} workflowId - One of the keys in COLLABORATION_WORKFLOWS.
 * @param {object} [context={}] - Optional context (extra constraints, metadata, etc.).
 * @returns {{
 *   workflowId: string,
 *   workflowName: string,
 *   steps: Array<object>,
 *   handoffPoints: Array<object>,
 *   parallelGroups: Array<object>,
 *   totalSteps: number,
 * }}
 */
export function createCollaborationPlan(goal, workflowId, context = {}) {
  const workflow = COLLABORATION_WORKFLOWS[workflowId];
  if (!workflow) {
    const available = Object.keys(COLLABORATION_WORKFLOWS).join(", ");
    throw new Error(
      `Unknown workflow "${workflowId}". Available workflows: ${available}`,
    );
  }

  if (typeof goal !== "string" || goal.trim().length === 0) {
    throw new Error("createCollaborationPlan requires a non-empty goal string.");
  }

  const trimmedGoal = goal.trim();
  const sequence = workflow.roleSequence;
  const depGraphMap = new Map(DEPENDENCY_GRAPH.map((d) => [d.roleId, d]));

  // Build steps
  const steps = sequence.map((roleId, index) => {
    const depNode = depGraphMap.get(roleId);
    const role = ROLE_BY_ID.get(roleId);
    const stepNumber = index + 1;
    const isParallel = workflow.parallelGroups.some((g) =>
      g.roles.includes(roleId),
    );

    return {
      stepNumber,
      roleId,
      roleName: role?.name ?? roleId,
      title: role?.title ?? roleId,
      responsibility: role?.responsibility ?? "",
      tier: depNode?.tier ?? TIER_BY_ROLE[roleId] ?? "unknown",
      estimatedEffort: depNode?.estimatedEffort ?? "medium",
      dependsOn: depNode?.dependsOn.filter((d) => sequence.includes(d)) ?? [],
      isParallelGroup: isParallel,
      parallelGroupName: isParallel
        ? workflow.parallelGroups.find((g) => g.roles.includes(roleId))?.group ?? null
        : null,
      status: "planned",
      goal: trimmedGoal,
      contextKeys: Object.keys(context),
    };
  });

  // Build handoff points
  const handoffPoints = [];
  for (let i = 0; i < sequence.length - 1; i++) {
    const fromId = sequence[i];
    const toId = sequence[i + 1];

    // Skip parallel-to-parallel transitions; they share a sync point
    const isParallelPair = workflow.parallelGroups.some(
      (g) => g.roles.includes(fromId) && g.roles.includes(toId),
    );
    if (isParallelPair) continue;

    const protocolKey = `${fromId}-to-${toId}`;
    const protocol = HANDOFF_PROTOCOLS[protocolKey];

    handoffPoints.push({
      from: fromId,
      to: toId,
      handoffType: protocol?.handoffType ?? inferHandoffType(fromId, toId),
      requiredFields: protocol?.requiredFields ?? [],
      protocolKey: protocol ? protocolKey : null,
      syncPoint: i === sequence.length - 2,
    });
  }

  return {
    workflowId: workflow.id,
    workflowName: workflow.name,
    goal: trimmedGoal,
    steps,
    handoffPoints,
    parallelGroups: workflow.parallelGroups,
    totalSteps: steps.length,
    estimatedDuration: workflow.estimatedDuration,
    context,
    createdAt: new Date().toISOString(),
    phase: COLLABORATION_PHASE,
  };
}

// ---------------------------------------------------------------------------
// validateHandoff
// ---------------------------------------------------------------------------

/**
 * Validate that handoff data from one role satisfies the requirements of the
 * next role in the collaboration chain.
 *
 * @param {string} fromRoleId - The producing role's ID.
 * @param {string} toRoleId - The consuming role's ID.
 * @param {object} handoffData - The data object being passed between roles.
 * @returns {{
 *   valid: boolean,
 *   missingFields: string[],
 *   warnings: string[],
 *   suggestions: string[],
 * }}
 */
export function validateHandoff(fromRoleId, toRoleId, handoffData) {
  const protocolKey = `${fromRoleId}-to-${toRoleId}`;
  const protocol = HANDOFF_PROTOCOLS[protocolKey];

  if (!protocol) {
    return {
      valid: false,
      missingFields: [],
      warnings: [`No handoff protocol defined for ${fromRoleId} -> ${toRoleId}.`],
      suggestions: [
        "Verify the role transition is part of a known collaboration workflow.",
        `Available protocols: ${Object.keys(HANDOFF_PROTOCOLS).join(", ")}`,
      ],
    };
  }

  if (!handoffData || typeof handoffData !== "object") {
    return {
      valid: false,
      missingFields: [...protocol.requiredFields],
      warnings: ["Handoff data is missing or not an object."],
      suggestions: [
        `Provide an object with at least these fields: ${protocol.requiredFields.join(", ")}`,
      ],
    };
  }

  const missingFields = [];
  const warnings = [];
  const suggestions = [];

  // Check required fields
  for (const field of protocol.requiredFields) {
    if (handoffData[field] === undefined || handoffData[field] === null) {
      missingFields.push(field);
    } else {
      // Validate type if rules exist
      const rule = protocol.validationRules[field];
      if (rule) {
        const fieldWarnings = validateFieldValue(field, handoffData[field], rule);
        warnings.push(...fieldWarnings);
      }
    }
  }

  // Check optional fields for completeness suggestions
  for (const field of protocol.optionalFields) {
    if (handoffData[field] === undefined || handoffData[field] === null) {
      suggestions.push(
        `Optional field "${field}" is absent. Including it improves downstream quality.`,
      );
    }
  }

  // Check for unexpected fields
  const knownFields = new Set([
    ...protocol.requiredFields,
    ...protocol.optionalFields,
  ]);
  for (const key of Object.keys(handoffData)) {
    if (!knownFields.has(key)) {
      warnings.push(
        `Unexpected field "${key}" in handoff data. It will be ignored by the consumer.`,
      );
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
    warnings,
    suggestions,
  };
}

/**
 * Validate a single field value against its rule.
 * @param {string} fieldName
 * @param {*} value
 * @param {object} rule
 * @returns {string[]} Array of warning messages.
 */
function validateFieldValue(fieldName, value, rule) {
  const warnings = [];

  if (rule.type === "string" && typeof value !== "string") {
    warnings.push(`Field "${fieldName}" expected string, got ${typeof value}.`);
  }
  if (rule.type === "string" && typeof value === "string") {
    if (rule.minLength && value.length < rule.minLength) {
      warnings.push(
        `Field "${fieldName}" is shorter than minimum length ${rule.minLength}.`,
      );
    }
    if (rule.maxLength && value.length > rule.maxLength) {
      warnings.push(
        `Field "${fieldName}" exceeds maximum length ${rule.maxLength}.`,
      );
    }
  }
  if (rule.type === "array" && !Array.isArray(value)) {
    warnings.push(`Field "${fieldName}" expected array, got ${typeof value}.`);
  }
  if (rule.type === "array" && Array.isArray(value)) {
    if (rule.minItems && value.length < rule.minItems) {
      warnings.push(
        `Field "${fieldName}" has ${value.length} items, minimum is ${rule.minItems}.`,
      );
    }
  }
  if (rule.type === "object" && (typeof value !== "object" || value === null || Array.isArray(value))) {
    warnings.push(`Field "${fieldName}" expected object, got ${typeof value}.`);
  }
  if (rule.type === "object" && typeof value === "object" && value !== null && rule.requiredKeys) {
    for (const key of rule.requiredKeys) {
      if (!(key in value)) {
        warnings.push(`Field "${fieldName}" is missing required key "${key}".`);
      }
    }
  }
  if (rule.allowedValues && !rule.allowedValues.includes(value)) {
    warnings.push(
      `Field "${fieldName}" value "${value}" is not in allowed values: ${rule.allowedValues.join(", ")}.`,
    );
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// getDependencyOrder  (Kahn's algorithm for topological sort)
// ---------------------------------------------------------------------------

/**
 * Return the given roleIds in topologically sorted execution order,
 * respecting the dependency graph. Uses Kahn's algorithm.
 *
 * @param {string[]} roleIds - Array of role IDs to sort.
 * @returns {string[]} Topologically sorted role IDs.
 */
export function getDependencyOrder(roleIds) {
  if (!Array.isArray(roleIds) || roleIds.length === 0) {
    return [];
  }

  const roleSet = new Set(roleIds);

  // Build adjacency list and in-degree map scoped to the provided roleIds
  const adjacency = new Map();
  const inDegree = new Map();

  for (const id of roleSet) {
    adjacency.set(id, []);
    inDegree.set(id, 0);
  }

  for (const node of DEPENDENCY_GRAPH) {
    if (!roleSet.has(node.roleId)) continue;
    for (const dep of node.dependsOn) {
      if (!roleSet.has(dep)) continue;
      adjacency.get(dep).push(node.roleId);
      inDegree.set(node.roleId, (inDegree.get(node.roleId) ?? 0) + 1);
    }
  }

  // Kahn's algorithm
  const queue = [];
  for (const [id, degree] of inDegree.entries()) {
    if (degree === 0) queue.push(id);
  }

  // Sort the initial queue for deterministic output
  queue.sort();

  const sorted = [];
  while (queue.length > 0) {
    const current = queue.shift();
    sorted.push(current);

    const neighbors = adjacency.get(current) ?? [];
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
        queue.sort();
      }
    }
  }

  // Cycle detection
  if (sorted.length !== roleSet.size) {
    const remaining = [...roleSet].filter((id) => !sorted.includes(id));
    throw new Error(
      `Dependency cycle detected among roles: ${remaining.join(", ")}`,
    );
  }

  return sorted;
}
