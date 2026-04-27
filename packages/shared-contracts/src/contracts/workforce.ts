import type { ContractMetadata, RequestContext, ResultEnvelope } from "./common.js";

export type WorkforceMode = "deterministic-plan-preview";

export interface WorkforceAgent {
  roleId: string;
  name: string;
  title: string;
  responsibility: string;
}

export interface WorkforceHealth {
  phase: "phase-102a-agent-workforce-skeleton";
  status: "ready";
  mode: WorkforceMode;
  ready: boolean;
  roleCount: number;
  safety: WorkforceSafety;
}

export interface WorkforceSafety {
  realLlmCalls: false;
  agentConcurrency: false;
  codeExecution: false;
  projectFileWrites: false;
  workflowRun: false;
  previewOnly: true;
}

export interface WorkforceAgentsResponse {
  phase: "phase-102a-agent-workforce-skeleton";
  mode: WorkforceMode;
  agents: WorkforceAgent[];
  safety: WorkforceSafety;
}

export interface WorkforcePlanRequest {
  context?: RequestContext;
  goal: string;
  metadata?: ContractMetadata;
}

export interface WorkforceTask {
  taskId: string;
  roleId: string;
  role: string;
  title: string;
  description: string;
  status: "planned";
  previewOnly: true;
}

export interface WorkforceRoleAssignment {
  roleId: string;
  role: string;
  responsibility: string;
  taskIds: string[];
}

export interface WorkforceDeliverable {
  deliverableId: string;
  title: string;
  description: string;
  ownerRole: string;
}

export interface WorkforcePlanResponse {
  success: true;
  phase: "phase-102a-agent-workforce-skeleton";
  planVersion: string;
  createdAt: string;
  mode: WorkforceMode;
  workforceId: string;
  goal: string;
  summary: string;
  userFriendlyStatus: "ready_to_review";
  selectedRoles: string[];
  taskBreakdown: WorkforceTask[];
  roleAssignments: WorkforceRoleAssignment[];
  deliverables: WorkforceDeliverable[];
  acceptanceCriteria: string[];
  risks: string[];
  limitations: string[];
  nextActions: string[];
  recommendedNextStep: string;
  markdown: string;
  exportableJson: ContractMetadata;
  safety: WorkforceSafety;
  meta?: ContractMetadata;
}

export interface WorkforcePlanStoreSafety {
  devOnlyLocalStorage: true;
  realLlmCalls: false;
  codeExecution: false;
  projectFileWrites: false;
  workflowRun: false;
  secretValuesStored: false;
}

export interface WorkforceTaskPackage {
  planId: string;
  workforceId: string;
  goal: string;
  summary: string;
  roles: WorkforceRoleAssignment[];
  taskBreakdown: WorkforceTask[];
  deliverables: WorkforceDeliverable[];
  acceptanceCriteria: string[];
  risks: string[];
  nextActions: string[];
  limitations?: string[];
  recommendedNextStep?: string;
  markdown: string;
  exportableJson: ContractMetadata;
  planVersion: string;
  createdAt: string;
  savedAt: string;
  meta?: ContractMetadata;
}

export interface WorkforcePlanSaveRequest {
  context?: RequestContext;
  plan?: WorkforcePlanResponse;
  goal?: string;
  metadata?: ContractMetadata;
}

export interface WorkforcePlanSaveResponse {
  success: true;
  phase: "phase-102d-agent-workforce-plan-store";
  status: "saved";
  mode: "dev-only-local-plan-store";
  planId: string;
  savedAt: string;
  taskPackage: WorkforceTaskPackage;
  safety: WorkforcePlanStoreSafety;
}

export interface WorkforceSavedPlanSummary {
  planId: string;
  workforceId: string;
  goal: string;
  summary: string;
  planVersion: string;
  createdAt: string;
  savedAt: string;
  taskCount: number;
  roleCount: number;
}

export interface WorkforcePlanListResponse {
  success: true;
  phase: "phase-102d-agent-workforce-plan-store";
  status: "listed";
  mode: "dev-only-local-plan-store";
  count: number;
  plans: WorkforceSavedPlanSummary[];
  safety: WorkforcePlanStoreSafety;
}

export interface WorkforcePlanGetResponse {
  success: true;
  phase: "phase-102d-agent-workforce-plan-store";
  status: "found";
  mode: "dev-only-local-plan-store";
  planId: string;
  taskPackage: WorkforceTaskPackage;
  plan: ContractMetadata;
  safety: WorkforcePlanStoreSafety;
}

export interface WorkforcePlanDeleteResponse {
  success: true;
  phase: "phase-102d-agent-workforce-plan-store";
  status: "deleted";
  mode: "dev-only-local-plan-store";
  planId: string;
  deleted: true;
  remainingCount: number;
  safety: WorkforcePlanStoreSafety;
}

export interface WorkforcePlanExportResponse {
  success: true;
  phase: "phase-102d-agent-workforce-plan-store";
  status: "export_ready";
  mode: "dev-only-local-plan-store";
  planId: string;
  formats: string[];
  taskPackage: WorkforceTaskPackage;
  json: WorkforceTaskPackage;
  markdown: string;
  safety: WorkforcePlanStoreSafety;
}

export type WorkforceHealthResult = ResultEnvelope<WorkforceHealth>;
export type WorkforceAgentsResult = ResultEnvelope<WorkforceAgentsResponse>;
export type WorkforcePlanResult = ResultEnvelope<WorkforcePlanResponse>;
export type WorkforcePlanSaveResult = ResultEnvelope<WorkforcePlanSaveResponse>;
export type WorkforcePlanListResult = ResultEnvelope<WorkforcePlanListResponse>;
export type WorkforcePlanGetResult = ResultEnvelope<WorkforcePlanGetResponse>;
export type WorkforcePlanDeleteResult = ResultEnvelope<WorkforcePlanDeleteResponse>;
export type WorkforcePlanExportResult = ResultEnvelope<WorkforcePlanExportResponse>;
