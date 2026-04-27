import type { ContractMetadata, RequestContext, ResultEnvelope } from "./common.js";
import type { KnowledgeChunk } from "./knowledge.js";

export type WorkflowActionMode = "read-only" | "in-memory" | "controlled-write";

export interface WorkflowActionDescriptor {
  actionId: "knowledge.retrieve" | "report.compose" | "artifact.write";
  title: string;
  mode: WorkflowActionMode;
  description: string;
}

export interface WorkflowRequest {
  context?: RequestContext;
  workflowId?: string;
  goal?: string;
  prompt?: string;
  query?: string;
  sourceIds?: string[];
  topK?: number;
  artifactName?: string;
  metadata?: ContractMetadata;
}

export interface WorkflowPlanStep {
  order: number;
  actionId: WorkflowActionDescriptor["actionId"];
  title: string;
  mode: WorkflowActionMode;
  status: "planned" | "completed";
}

export interface WorkflowSafetySummary {
  arbitraryCommandExecution: false;
  broadFileSystemScan: false;
  networkAutomation: false;
  allowedActions: string[];
  outputScope: ".data/workflows";
}

export interface WorkflowPlanResponse {
  phase: "phase-30a-local-workflow-automation";
  workflowId: string;
  goal: string;
  query: string;
  topK: number;
  sourceIds?: string[];
  steps: WorkflowPlanStep[];
  safety: WorkflowSafetySummary;
}

export interface WorkflowArtifact {
  fileName: string;
  absolutePath: string;
  relativePath: string;
  bytes: number;
  sha256: string;
}

export interface WorkflowCitation {
  index: number;
  sourceId?: string | null;
  documentId?: string | null;
  title?: string;
  snippet: string;
  matchedTerms: string[];
  score?: number | null;
  metadata?: ContractMetadata;
}

export interface WorkflowRunResponse {
  phase: "phase-30a-local-workflow-automation";
  status: "completed";
  workflowId: string;
  goal: string;
  query: string;
  steps: WorkflowPlanStep[];
  knowledge: {
    mode?: string;
    retrieved: boolean;
    chunkCount: number;
    topHit?: KnowledgeChunk | null;
    citations: WorkflowCitation[];
    metadata?: ContractMetadata;
  };
  artifact: WorkflowArtifact;
  safety: WorkflowSafetySummary;
  meta?: ContractMetadata;
}

export type WorkflowPlanResult = ResultEnvelope<WorkflowPlanResponse>;
export type WorkflowRunResult = ResultEnvelope<WorkflowRunResponse>;
