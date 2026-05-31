import {
  buildFieldReasoningEvidenceReplay,
  validateFieldReasoningEvidenceReplay,
} from "../../packages/taiji-beidou-engine/src/index.js";
import { readPhaseResult, requirePhaseResult, writePhaseResult } from "../phase1203-1210/run-phase1203-1210-helpers.mjs";

const readout = requirePhaseResult("phase1203", await readPhaseResult("phase1203"));
const alignment = requirePhaseResult("phase1204", await readPhaseResult("phase1204"));
const replay = buildFieldReasoningEvidenceReplay({ readout, alignment });
const validation = validateFieldReasoningEvidenceReplay(replay);
const result = await writePhaseResult("phase1205", {
  ...replay,
  schemaValidation: validation,
});

if (!validation.valid || !result.recommended_sealed) process.exitCode = 1;
