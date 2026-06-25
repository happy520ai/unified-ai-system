/**
 * roleCollaboration.js — Re-export facade.
 *
 * Split into four modules for 分层律 compliance (single file ≤ 500 lines):
 *   - roleCollaborationData.js   — constants, dependency graph, handoff protocols, workflows
 *   - roleCollaborationPlan.js   — plan creation, handoff validation, dependency order
 *   - roleCollaborationMerge.js  — role output merging, conflict detection, cross-cutting concerns
 *   - roleCollaborationReport.js — cross-role risk analysis, report generation
 */

export {
  COLLABORATION_PHASE,
  DEPENDENCY_GRAPH,
  HANDOFF_PROTOCOLS,
  COLLABORATION_WORKFLOWS,
} from "./roleCollaborationData.js";

export {
  createCollaborationPlan,
  validateHandoff,
  getDependencyOrder,
} from "./roleCollaborationPlan.js";

export {
  mergeRoleOutputs,
} from "./roleCollaborationMerge.js";

export {
  identifyCrossRoleRisks,
  generateCollaborationReport,
} from "./roleCollaborationReport.js";
