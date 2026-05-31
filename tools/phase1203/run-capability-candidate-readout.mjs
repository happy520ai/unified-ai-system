import {
  buildCapabilityCandidateReadout,
  validateCapabilityCandidateReadout,
} from "../../packages/taiji-beidou-engine/src/index.js";
import { buildSourceSchemas, writePhaseResult } from "../phase1203-1210/run-phase1203-1210-helpers.mjs";

const readout = buildCapabilityCandidateReadout({ sourceSchemas: buildSourceSchemas() });
const validation = validateCapabilityCandidateReadout(readout);
const result = await writePhaseResult("phase1203", {
  ...readout,
  schemaValidation: validation,
});

if (!validation.valid || !result.recommended_sealed) process.exitCode = 1;
