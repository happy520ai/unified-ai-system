import { readTextIfExists } from "../phase1203-1210/phase1203-1210-common.mjs";
import {
  missionControlPanelPath,
  missionControlReadoutPanelPath,
} from "../phase1203-1210/phase1203-1210-common.mjs";
import { readPhaseResult, requirePhaseResult, writePhaseResult } from "../phase1203-1210/run-phase1203-1210-helpers.mjs";

const readout = requirePhaseResult("phase1203", await readPhaseResult("phase1203"));
const alignment = requirePhaseResult("phase1204", await readPhaseResult("phase1204"));
const replay = requirePhaseResult("phase1205", await readPhaseResult("phase1205"));
const safety = requirePhaseResult("phase1206", await readPhaseResult("phase1206"));
const cells = requirePhaseResult("phase1207", await readPhaseResult("phase1207"));
const repair = requirePhaseResult("phase1208", await readPhaseResult("phase1208"));
const panelText = await readTextIfExists(missionControlReadoutPanelPath, "");
const missionControlText = await readTextIfExists(missionControlPanelPath, "");

const missionControlPreview = {
  previewId: "taiji-beidou-dry-run-readout-preview",
  readOnly: true,
  collapsedByDefault: panelText.includes("<details") && !panelText.includes(" open"),
  runtimeActionButtonsAdded: false,
  providerTriggerButtonsAdded: false,
  deployButtonsAdded: false,
  panelWired: missionControlText.includes("renderTaijiBeidouDryRunReadoutPreviewPanel"),
};

const previewCards = [
  card("candidate-readout", "Capability candidates", readout.candidateCapabilities.length),
  card("planner-alignment", "Route candidates", alignment.routeCandidates.length),
  card("evidence-replay", "Replay traces", replay.sourceTrace.length + replay.fieldStepTrace.length),
  card("safety-cost", "Blocked request patterns", safety.blockedRequestMatrix.length),
  card("capability-cells", "Dry-run cells", cells.capabilityCells.length),
  card("repair-prune-reweight", "Reweighted cells", repair.reweightedCells.length),
];

await writePhaseResult("phase1209", {
  missionControlPreview,
  previewCards,
  previewCopy: {
    title: "Taiji / Beidou dry-run capability readout preview",
    summary: "Read-only synthetic evidence preview for Phase1203-1210.",
    collapsedByDefault: true,
    noRuntimeAction: true,
  },
  syntheticEvidenceRefs: [
    readout.trace.evidenceRef,
    alignment.trace.evidenceRef,
    replay.trace.evidenceRef,
    safety.trace.evidenceRef,
    cells.trace.evidenceRef,
    repair.trace.evidenceRef,
  ],
  uiReadOnlyPreviewGenerated: missionControlPreview.readOnly && missionControlPreview.panelWired,
});

function card(id, label, count) {
  return {
    id,
    label,
    count,
    readOnly: true,
    syntheticOnly: true,
  };
}
