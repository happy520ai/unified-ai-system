/**
 * workforceService 的类型声明（7 角色 workforce：计划 + 执行 + 本地编排）。
 * 接口对照 workforce/workforceService.js 实际导出。
 */

import type { WorkforcePlanState } from "@unified-ai-system/shared-contracts";
export type { WorkforcePlanState } from "@unified-ai-system/shared-contracts";

export interface WorkforceHealth {
  phase: string;
  status: string;
  mode: string;
  ready: boolean;
  roleCount: number;
  [key: string]: unknown;
}

export interface WorkforcePlan {
  workforceId: string;
  goal: string;
  taskBreakdown: unknown[];
  roleAssignments: unknown[];
  deliverables: unknown[];
  planState: WorkforcePlanState;
  [key: string]: unknown;
}

export interface WorkforceTaskPackage extends Record<string, unknown> {
  planState: WorkforcePlanState;
}

export interface WorkforceExecutionResult {
  phase: string;
  status: string;
  goal?: string;
  roleOutputs?: Record<string, Record<string, unknown>>;
  crossRoleDependencies?: unknown[];
  llmStats?: Record<string, unknown>;
  llmDriven?: boolean;
  summary?: string;
  [key: string]: unknown;
}

export interface WorkforceLocalRunResult {
  executionStatus: string;
  completionVerified: boolean;
  localRunExecuted: boolean;
  taskQueueCreated: boolean;
  providerCallsMade: boolean;
  secretValueExposed: boolean;
  projectFileWrites: boolean;
  [key: string]: unknown;
}

export interface WorkforceService {
  getHealth(): WorkforceHealth;
  listAgents(): Record<string, unknown>;
  plan(input: { goal: string } & Record<string, unknown>): WorkforcePlan;
  execute(input: { goal: string } | string, options?: Record<string, unknown>): Promise<WorkforceExecutionResult>;
  runLocal(input?: Record<string, unknown>): Promise<WorkforceLocalRunResult>;
  savePlan(input: Record<string, unknown>, tenantId: string): Promise<{ planId: string; taskPackage: WorkforceTaskPackage; [key: string]: unknown }>;
  listPlans(tenantId: string): Promise<Record<string, unknown>>;
  getPlan(planId: string, tenantId: string): Promise<{ plan: WorkforceTaskPackage; taskPackage: WorkforceTaskPackage; [key: string]: unknown }>;
  deletePlan(planId: string, tenantId: string): Promise<Record<string, unknown>>;
  exportPlan(planId: string, tenantId: string): Promise<{ markdown: string; taskPackage: WorkforceTaskPackage; [key: string]: unknown }>;
  answerClarifications(planId: string, input: Record<string, unknown>, tenantId: string): Promise<Record<string, unknown>>;
  updatePlanLifecycle(planId: string, input: Record<string, unknown>, tenantId: string): Promise<Record<string, unknown>>;
  getPlanReviewPackage(planId: string, tenantId: string): Promise<Record<string, unknown>>;
  recordPlanApprovalGate(planId: string, input: Record<string, unknown>, tenantId: string): Promise<Record<string, unknown>>;
}

export declare function createWorkforceService(options?: Record<string, unknown>): WorkforceService;
