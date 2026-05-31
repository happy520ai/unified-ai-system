import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function selectGodParticipants({ gate, requestedModelIds = [], maxParticipants = 3 } = {}) {
  const rejectedCandidates = [];
  const selected = [];
  const candidates = requestedModelIds.length
    ? requestedModelIds
    : preferredCandidateIds(gate.selectableRecords()).slice(0, maxParticipants);
  for (const modelId of candidates) {
    try {
      const record = gate.getSelectableRecord(modelId);
      selected.push(record);
    } catch (error) {
      rejectedCandidates.push({ modelId, reason: error.code ?? error.message });
    }
    if (selected.length >= maxParticipants) break;
  }
  return { selected, rejectedCandidates };
}

export function preferredCandidateIds(records = []) {
  const idsFromReport = readPhase324IGodPool();
  const recordIds = new Set(records.map((item) => item.modelId));
  const preferred = idsFromReport.filter((id) => recordIds.has(id));
  const remaining = records
    .filter((item) => !preferred.includes(item.modelId))
    .sort((a, b) => Number(a.lastSmokeResult?.durationMs ?? 999999) - Number(b.lastSmokeResult?.durationMs ?? 999999))
    .map((item) => item.modelId);
  return [...preferred, ...remaining];
}

function readPhase324IGodPool() {
  try {
    const report = JSON.parse(readFileSync(resolve("docs/phase324i-model-library-routing-preference-report.json"), "utf8"));
    return (report.recommendations?.godModeCandidatePool ?? []).map((item) => item.modelId).filter(Boolean);
  } catch {
    return [];
  }
}
