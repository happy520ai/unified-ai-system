import {
  buildTianshuPlannerAlignment,
  validateTianshuPlannerAlignment,
} from "../../packages/taiji-beidou-engine/src/index.js";
import { readPhaseResult, requirePhaseResult, writePhaseResult } from "../phase1203-1210/run-phase1203-1210-helpers.mjs";

const readout = requirePhaseResult("phase1203", await readPhaseResult("phase1203"));
const alignment = buildTianshuPlannerAlignment({ readout });
const validation = validateTianshuPlannerAlignment(alignment);
const result = await writePhaseResult("phase1204", {
  ...alignment,
  schemaValidation: validation,
});

if (!validation.valid || !result.recommended_sealed) process.exitCode = 1;
