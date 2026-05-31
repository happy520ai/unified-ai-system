import {
  buildSafetyCostSources,
  validateSafetyCostSources,
} from "../../packages/taiji-beidou-engine/src/index.js";
import { readPhaseResult, requirePhaseResult, writePhaseResult } from "../phase1203-1210/run-phase1203-1210-helpers.mjs";

const readout = requirePhaseResult("phase1203", await readPhaseResult("phase1203"));
const safetyCostSources = buildSafetyCostSources({ readout });
const validation = validateSafetyCostSources(safetyCostSources);
const result = await writePhaseResult("phase1206", {
  ...safetyCostSources,
  schemaValidation: validation,
});

if (!validation.valid || !result.recommended_sealed) process.exitCode = 1;
