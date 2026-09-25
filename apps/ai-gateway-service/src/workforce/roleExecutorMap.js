/**
 * @module roleExecutorMap
 * @description Role-id to local executor registry. Extracted from roleExecutors.js (T-094/g6)
 * so roleExecutorsLlm.js can look up roles without importing the orchestrator back.
 */
import { executeCEOAnalysis, executePMAnalysis } from "./roleExecutorsCeoPm.js";
import { executeArchitectAnalysis, executeFrontendAnalysis } from "./roleExecutorsArchFront.js";
import { executeBackendAnalysis, executeQAAnalysis } from "./roleExecutorsBackendQa.js";
import { executeReviewerAnalysis } from "./roleExecutorsReviewer.js";

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
