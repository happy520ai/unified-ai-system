import {
  COLLABORATION_PHASE,
  ROLE_BY_ID,
  TIER_BY_ROLE,
  extractArray,
} from "./roleCollaborationData.js";
import {
  mergeRoleOutputs,
} from "./roleCollaborationMerge.js";

// ---------------------------------------------------------------------------
// identifyCrossRoleRisks
// ---------------------------------------------------------------------------

/**
 * Analyze outputs from multiple roles and identify risks that span role
 * boundaries (e.g. architect proposes something the frontend cannot implement).
 *
 * @param {Object<string, object>} roleOutputs - Map of roleId to role output.
 * @returns {{
 *   risks: Array<object>,
 *   severity: "low" | "medium" | "high" | "critical",
 *   recommendations: string[],
 * }}
 */
export function identifyCrossRoleRisks(roleOutputs) {
  if (!roleOutputs || typeof roleOutputs !== "object" || Object.keys(roleOutputs).length === 0) {
    return { risks: [], severity: "low", recommendations: [] };
  }

  const risks = [];
  const recommendations = [];

  const archOutput = roleOutputs["architect"];
  const feOutput = roleOutputs["frontend-engineer"];
  const beOutput = roleOutputs["backend-engineer"];
  const qaOutput = roleOutputs["qa"];
  const reviewerOutput = roleOutputs["reviewer"];
  const ceoOutput = roleOutputs["ceo"];
  const pmOutput = roleOutputs["pm"];

  // Risk: Architect proposes APIs that backend doesn't plan to implement
  if (archOutput && beOutput) {
    const archApis = extractArray(archOutput, "apiContracts", "apis", "endpoints");
    const beApis = extractArray(beOutput, "apiEndpoints", "apis", "endpoints");
    const archApiPaths = new Set(
      archApis.map((a) => (typeof a === "string" ? a : a?.path ?? a?.name ?? "")).filter(Boolean),
    );
    const beApiPaths = new Set(
      beApis.map((a) => (typeof a === "string" ? a : a?.path ?? a?.name ?? "")).filter(Boolean),
    );
    const uncovered = [...archApiPaths].filter((p) => !beApiPaths.has(p));
    if (uncovered.length > 0) {
      risks.push({
        id: "CR-001",
        type: "api-coverage-gap",
        severity: "high",
        sourceRoles: ["architect", "backend-engineer"],
        description: `Architect defines ${uncovered.length} API contract(s) not covered by backend engineer: ${uncovered.join(", ")}.`,
        impact: "Missing API implementations will block frontend integration and QA testing.",
      });
      recommendations.push(
        "Backend engineer must review architect's API contracts and add missing implementations.",
      );
    }
  }

  // Risk: Frontend components reference APIs not in backend plan
  if (feOutput && beOutput) {
    const feApis = extractArray(feOutput, "apiDependencies", "apiCalls", "endpoints");
    const beApis = extractArray(beOutput, "apiEndpoints", "apis", "endpoints");
    const beApiPaths = new Set(
      beApis.map((a) => (typeof a === "string" ? a : a?.path ?? a?.name ?? "")).filter(Boolean),
    );
    const feApiPaths = new Set(
      feApis.map((a) => (typeof a === "string" ? a : a?.path ?? a?.name ?? "")).filter(Boolean),
    );
    const missing = [...feApiPaths].filter((p) => !beApiPaths.has(p));
    if (missing.length > 0) {
      risks.push({
        id: "CR-002",
        type: "frontend-backend-api-mismatch",
        severity: "high",
        sourceRoles: ["frontend-engineer", "backend-engineer"],
        description: `Frontend depends on ${missing.length} API(s) not in backend plan: ${missing.join(", ")}.`,
        impact: "Frontend will be blocked during integration testing.",
      });
      recommendations.push(
        "Align frontend API dependencies with backend endpoint plan before implementation begins.",
      );
    }
  }

  // Risk: QA plan doesn't cover all role deliverables
  if (qaOutput) {
    const qaCoverage = extractArray(qaOutput, "testCoverage", "coveredAreas", "testPlan");
    const allRoleIds = Object.keys(roleOutputs);
    const coveredRoles = new Set(
      qaCoverage.map((c) => (typeof c === "string" ? c : c?.roleId ?? c?.role ?? "")).filter(Boolean),
    );
    const uncoveredRoles = allRoleIds.filter(
      (r) => r !== "qa" && r !== "reviewer" && !coveredRoles.has(r),
    );
    if (uncoveredRoles.length > 0 && qaCoverage.length > 0) {
      risks.push({
        id: "CR-003",
        type: "qa-coverage-gap",
        severity: "medium",
        sourceRoles: ["qa", ...uncoveredRoles],
        description: `QA plan does not explicitly cover outputs from: ${uncoveredRoles.join(", ")}.`,
        impact: "Untested deliverables may reach production with defects.",
      });
      recommendations.push(
        "QA should extend test plan to cover all role deliverables, especially implementation roles.",
      );
    }
  }

  // Risk: CEO goal misalignment with PM scope
  if (ceoOutput && pmOutput) {
    const ceoGoals = extractArray(ceoOutput, "goals", "objectives", "successCriteria");
    const pmScope = pmOutput?.productScope ?? pmOutput?.scope ?? null;
    if (ceoGoals.length > 0 && pmScope && typeof pmScope === "object") {
      const outOfScope = pmScope.outOfScope ?? [];
      const goalKeywords = ceoGoals.map((g) =>
        typeof g === "string" ? g.toLowerCase() : String(g).toLowerCase(),
      );
      const scopeConflicts = outOfScope.filter((item) =>
        goalKeywords.some((gk) => gk.includes(String(item).toLowerCase().slice(0, 20))),
      );
      if (scopeConflicts.length > 0) {
        risks.push({
          id: "CR-004",
          type: "goal-scope-misalignment",
          severity: "high",
          sourceRoles: ["ceo", "pm"],
          description: `CEO goals may conflict with PM's out-of-scope items: ${scopeConflicts.join(", ")}.`,
          impact: "Misaligned expectations between strategic intent and product plan.",
        });
        recommendations.push(
          "PM should revisit out-of-scope items with CEO to ensure goal alignment.",
        );
      }
    }
  }

  // Risk: Reviewer identifies blockers that earlier roles haven't addressed
  if (reviewerOutput) {
    const blockers = extractArray(reviewerOutput, "blockers", "releaseBlockers", "criticalRisks");
    if (blockers.length > 0) {
      risks.push({
        id: "CR-005",
        type: "unaddressed-review-blockers",
        severity: "critical",
        sourceRoles: ["reviewer"],
        description: `Reviewer identified ${blockers.length} release blocker(s) that need resolution before shipping.`,
        impact: "Product cannot be released until all blockers are resolved.",
      });
      recommendations.push(
        "All release blockers from the reviewer must be addressed by the responsible roles before release.",
      );
    }
  }

  // Risk: Parallel roles produce conflicting technical decisions
  if (feOutput && beOutput) {
    const feTech = extractArray(feOutput, "technologyChoices", "techStack", "frameworks");
    const beTech = extractArray(beOutput, "technologyChoices", "techStack", "frameworks");
    if (feTech.length > 0 && beTech.length > 0) {
      const feSet = new Set(feTech.map((t) => (typeof t === "string" ? t.toLowerCase() : String(t).toLowerCase())));
      const beSet = new Set(beTech.map((t) => (typeof t === "string" ? t.toLowerCase() : String(t).toLowerCase())));
      const overlap = [...feSet].filter((t) => beSet.has(t));
      if (overlap.length > 0) {
        risks.push({
          id: "CR-006",
          type: "parallel-tech-choice-overlap",
          severity: "low",
          sourceRoles: ["frontend-engineer", "backend-engineer"],
          description: `Frontend and backend both specify technology choices for: ${overlap.join(", ")}. Ensure these are intentionally aligned.`,
          impact: "Uncoordinated duplicate decisions may lead to version mismatches.",
        });
        recommendations.push(
          "Coordinate shared technology choices between frontend and backend engineers.",
        );
      }
    }
  }

  // Determine overall severity
  const severityLevels = risks.map((r) => r.severity);
  let overallSeverity = "low";
  if (severityLevels.includes("critical")) {
    overallSeverity = "critical";
  } else if (severityLevels.includes("high")) {
    overallSeverity = "high";
  } else if (severityLevels.includes("medium")) {
    overallSeverity = "medium";
  }

  if (risks.length === 0) {
    recommendations.push("No cross-role risks detected. Proceed with standard collaboration pipeline.");
  }

  return { risks, severity: overallSeverity, recommendations };
}

// ---------------------------------------------------------------------------
// generateCollaborationReport
// ---------------------------------------------------------------------------

/**
 * Create a comprehensive collaboration report that includes execution timeline,
 * handoff summary, conflict resolution, and final recommendations.
 *
 * @param {object} collaborationPlan - The plan returned by createCollaborationPlan.
 * @param {Object<string, object>} [roleOutputs={}] - Optional map of roleId to role output.
 * @returns {{ report: object, markdown: string }}
 */
export function generateCollaborationReport(collaborationPlan, roleOutputs = {}) {
  if (!collaborationPlan || !collaborationPlan.workflowId) {
    throw new Error("generateCollaborationReport requires a valid collaboration plan.");
  }

  const generatedAt = new Date().toISOString();

  // Timeline
  const timeline = collaborationPlan.steps.map((step, idx) => ({
    order: idx + 1,
    roleId: step.roleId,
    roleName: step.roleName,
    tier: step.tier,
    estimatedEffort: step.estimatedEffort,
    dependsOn: step.dependsOn,
    parallelGroupName: step.parallelGroupName,
    status: step.status,
  }));

  // Handoff summary
  const handoffSummary = collaborationPlan.handoffPoints.map((hp) => ({
    from: hp.from,
    to: hp.to,
    handoffType: hp.handoffType,
    requiredFieldCount: hp.requiredFields.length,
    hasProtocol: hp.protocolKey !== null,
  }));

  // Merge analysis (if role outputs provided)
  let mergeAnalysis = null;
  let crossRoleRiskAnalysis = null;
  if (Object.keys(roleOutputs).length > 0) {
    mergeAnalysis = mergeRoleOutputs(roleOutputs);
    crossRoleRiskAnalysis = identifyCrossRoleRisks(roleOutputs);
  }

  // Build report object
  const report = {
    phase: COLLABORATION_PHASE,
    generatedAt,
    workflowId: collaborationPlan.workflowId,
    workflowName: collaborationPlan.workflowName,
    goal: collaborationPlan.goal,
    estimatedDuration: collaborationPlan.estimatedDuration,
    totalSteps: collaborationPlan.totalSteps,
    timeline,
    handoffSummary,
    parallelGroups: collaborationPlan.parallelGroups,
    mergeAnalysis: mergeAnalysis
      ? {
          conflictCount: mergeAnalysis.conflicts.length,
          crossCuttingConcernCount: mergeAnalysis.crossCuttingConcerns.length,
          roleSummaries: mergeAnalysis.roleSummaries,
          recommendations: mergeAnalysis.recommendations,
        }
      : null,
    crossRoleRisks: crossRoleRiskAnalysis
      ? {
          riskCount: crossRoleRiskAnalysis.risks.length,
          severity: crossRoleRiskAnalysis.severity,
          risks: crossRoleRiskAnalysis.risks,
          recommendations: crossRoleRiskAnalysis.recommendations,
        }
      : null,
    finalRecommendations: buildFinalRecommendations(
      collaborationPlan,
      mergeAnalysis,
      crossRoleRiskAnalysis,
    ),
  };

  // Generate Markdown
  const markdown = formatReportMarkdown(report);

  return { report, markdown };
}

// ===========================================================================
// Internal helpers
// ===========================================================================

function buildFinalRecommendations(plan, mergeAnalysis, crossRoleRiskAnalysis) {
  const recs = [];

  recs.push(
    `Execute the "${plan.workflowName}" workflow with ${plan.totalSteps} steps in dependency order.`,
  );

  if (plan.parallelGroups.length > 0) {
    const groupNames = plan.parallelGroups.map((g) => g.roles.join(" + ")).join("; ");
    recs.push(`Leverage parallel execution for: ${groupNames}.`);
  }

  for (const hp of plan.handoffPoints) {
    if (!hp.hasProtocol) {
      recs.push(
        `Define a handoff protocol for ${hp.from} -> ${hp.to} (currently using inferred type "${hp.handoffType}").`,
      );
    }
  }

  if (mergeAnalysis) {
    recs.push(...mergeAnalysis.recommendations);
  }

  if (crossRoleRiskAnalysis && crossRoleRiskAnalysis.risks.length > 0) {
    recs.push(...crossRoleRiskAnalysis.recommendations);
  }

  recs.push(
    "Run validateHandoff() at every role transition before passing data downstream.",
  );
  recs.push(
    "Generate a final collaboration report after all roles complete to capture lessons learned.",
  );

  return recs;
}

function formatReportMarkdown(report) {
  const lines = [];

  lines.push("# Collaboration Report");
  lines.push("");
  lines.push(`- **Phase:** ${report.phase}`);
  lines.push(`- **Generated:** ${report.generatedAt}`);
  lines.push(`- **Workflow:** ${report.workflowName} (\`${report.workflowId}\`)`);
  lines.push(`- **Goal:** ${report.goal}`);
  lines.push(`- **Estimated Duration:** ${report.estimatedDuration}`);
  lines.push(`- **Total Steps:** ${report.totalSteps}`);
  lines.push("");

  // Timeline
  lines.push("## Execution Timeline");
  lines.push("");
  lines.push("| Order | Role | Tier | Effort | Depends On | Parallel Group |");
  lines.push("|-------|------|------|--------|------------|----------------|");
  for (const step of report.timeline) {
    lines.push(
      `| ${step.order} | ${step.roleName} | ${step.tier} | ${step.estimatedEffort} | ${step.dependsOn.join(", ") || "-"} | ${step.parallelGroupName || "-"} |`,
    );
  }
  lines.push("");

  // Handoff Summary
  lines.push("## Handoff Summary");
  lines.push("");
  lines.push("| From | To | Type | Required Fields | Has Protocol |");
  lines.push("|------|----|------|-----------------|--------------|");
  for (const hp of report.handoffSummary) {
    lines.push(
      `| ${hp.from} | ${hp.to} | ${hp.handoffType} | ${hp.requiredFieldCount} | ${hp.hasProtocol ? "Yes" : "No"} |`,
    );
  }
  lines.push("");

  // Parallel Groups
  if (report.parallelGroups.length > 0) {
    lines.push("## Parallel Execution Groups");
    lines.push("");
    for (const group of report.parallelGroups) {
      lines.push(`- **${group.group}:** ${group.roles.join(", ")}`);
    }
    lines.push("");
  }

  // Merge Analysis
  if (report.mergeAnalysis) {
    lines.push("## Merge Analysis");
    lines.push("");
    lines.push(`- **Conflicts:** ${report.mergeAnalysis.conflictCount}`);
    lines.push(`- **Cross-Cutting Concerns:** ${report.mergeAnalysis.crossCuttingConcernCount}`);
    lines.push("");

    if (report.mergeAnalysis.roleSummaries.length > 0) {
      lines.push("### Role Summaries");
      lines.push("");
      for (const rs of report.mergeAnalysis.roleSummaries) {
        lines.push(`- **${rs.roleName}** (${rs.tier}): ${rs.keyDecisions.length} decisions, ${rs.risks.length} risks, ${rs.tasks.length} tasks`);
      }
      lines.push("");
    }
  }

  // Cross-Role Risks
  if (report.crossRoleRisks && report.crossRoleRisks.riskCount > 0) {
    lines.push("## Cross-Role Risks");
    lines.push("");
    lines.push(`- **Overall Severity:** ${report.crossRoleRisks.severity}`);
    lines.push(`- **Risk Count:** ${report.crossRoleRisks.riskCount}`);
    lines.push("");
    for (const risk of report.crossRoleRisks.risks) {
      lines.push(`### ${risk.id}: ${risk.type}`);
      lines.push(`- **Severity:** ${risk.severity}`);
      lines.push(`- **Roles:** ${risk.sourceRoles.join(", ")}`);
      lines.push(`- **Description:** ${risk.description}`);
      lines.push(`- **Impact:** ${risk.impact}`);
      lines.push("");
    }
  }

  // Recommendations
  lines.push("## Final Recommendations");
  lines.push("");
  for (const rec of report.finalRecommendations) {
    lines.push(`- ${rec}`);
  }
  lines.push("");

  return lines.join("\n");
}
