import {
  buildCapabilityCellGeneration,
  validateCapabilityCellGeneration,
} from "../../packages/taiji-beidou-engine/src/index.js";
import { readPhaseResult, requirePhaseResult, writePhaseResult } from "../phase1203-1210/run-phase1203-1210-helpers.mjs";

const readout = requirePhaseResult("phase1203", await readPhaseResult("phase1203"));
const evidenceReplay = requirePhaseResult("phase1205", await readPhaseResult("phase1205"));
const safetyCostSources = requirePhaseResult("phase1206", await readPhaseResult("phase1206"));
const generation = buildCapabilityCellGeneration({ readout, evidenceReplay, safetyCostSources });
const validation = validateCapabilityCellGeneration(generation);
const result = await writePhaseResult("phase1207", {
  ...generation,
  schemaValidation: validation,
});

if (!validation.valid || !result.recommended_sealed) process.exitCode = 1;
