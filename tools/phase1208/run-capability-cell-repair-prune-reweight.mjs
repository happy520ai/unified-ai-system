import {
  buildCapabilityCellRepairPruneReweight,
  validateCapabilityCellRepairPruneReweight,
} from "../../packages/taiji-beidou-engine/src/index.js";
import { readPhaseResult, requirePhaseResult, writePhaseResult } from "../phase1203-1210/run-phase1203-1210-helpers.mjs";

const generation = requirePhaseResult("phase1207", await readPhaseResult("phase1207"));
const repairPruneReweight = buildCapabilityCellRepairPruneReweight({ generation });
const validation = validateCapabilityCellRepairPruneReweight(repairPruneReweight);
const result = await writePhaseResult("phase1208", {
  ...repairPruneReweight,
  schemaValidation: validation,
});

if (!validation.valid || !result.recommended_sealed) process.exitCode = 1;
