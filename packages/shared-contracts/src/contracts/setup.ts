import type { ResultEnvelope } from "./common.js";

export type SetupReadinessStatus = "ready" | "needs_attention" | "preview";

export interface SetupReadinessStep {
  stepId: string;
  title: string;
  status: SetupReadinessStatus;
  ready: boolean;
  nextAction: string;
}

export interface SetupReadinessArea {
  ready: boolean;
  status?: string;
  nextAction?: string;
  [key: string]: unknown;
}

export interface SetupReadinessResult {
  phase: "phase-104a-first-run-setup";
  status: "ready" | "needs_attention";
  userMessage: string;
  steps: SetupReadinessStep[];
  readiness: {
    health: SetupReadinessArea;
    modelImport: SetupReadinessArea;
    chat: SetupReadinessArea;
    knowledge: SetupReadinessArea;
    workforce: SetupReadinessArea;
  };
  limitations: string[];
  safety: {
    apiKeyExposed: false;
    providerProbeCalled: false;
    defaultChatMainLaneChanged: false;
    workforceExecution: false;
    projectFileWrites: false;
  };
}

export type SetupReadinessResponse = ResultEnvelope<SetupReadinessResult>;
