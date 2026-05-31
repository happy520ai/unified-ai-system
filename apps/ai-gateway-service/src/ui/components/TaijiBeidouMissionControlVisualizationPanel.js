import { renderCapabilityCellCandidatePanel } from "./CapabilityCellCandidatePanel.js";
import { renderConceptFieldPreviewPanel } from "./ConceptFieldPreviewPanel.js";
import { renderEvidenceCoherencePanel } from "./EvidenceCoherencePanel.js";
import { renderFieldSnapshotTimelinePanel } from "./FieldSnapshotTimelinePanel.js";
import { renderGodModeConflictMapPanel } from "./GodModeConflictMapPanel.js";
import { renderOperatorReviewChecklistPanel } from "./OperatorReviewChecklistPanel.js";
import { renderRiskFieldPanel } from "./RiskFieldPanel.js";
import { renderRouteAffinityPanel } from "./RouteAffinityPanel.js";
import { renderSecurityNegativeSourceMapPanel } from "./SecurityNegativeSourceMapPanel.js";
import { renderSleepCandidateReviewDrawer } from "./SleepCandidateReviewDrawer.js";
import { renderTianshuRouteComparisonPanel } from "./TianshuRouteComparisonPanel.js";
import { renderTokenSavingDashboardPanel } from "./TokenSavingDashboardPanel.js";

export function renderTaijiBeidouMissionControlVisualizationPanel() {
  return `
              <section class="scenario-trial-panel" id="taiji-beidou-mission-control-visualization" data-phase1486-1505-ui-root="true" data-local-only="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase1486-1505AIO · Mission Control visualization</div>
                    <h3>Taiji / Beidou Local Intelligence Console</h3>
                    <p>Concept Field, Context Gateway, Evidence Memory, Tianshu, God Mode, and Security Shield are visible as local dry-run state panels.</p>
                  </div>
                  <span class="tour-chip">local-only · no Provider · no dangerous execution</span>
                </div>
                <div class="comparison-footer">
                  <span>missionControlUsable=true</span>
                  <span>conceptFieldVisible=true</span>
                  <span>characterModuleVisible=false</span>
                  <span>productionReadyClaimed=false</span>
                </div>
              </section>
${renderConceptFieldPreviewPanel()}
${renderRouteAffinityPanel()}
${renderEvidenceCoherencePanel()}
${renderRiskFieldPanel()}
${renderSleepCandidateReviewDrawer()}
${renderCapabilityCellCandidatePanel()}
${renderFieldSnapshotTimelinePanel()}
${renderTokenSavingDashboardPanel()}
${renderGodModeConflictMapPanel()}
${renderTianshuRouteComparisonPanel()}
${renderSecurityNegativeSourceMapPanel()}
${renderOperatorReviewChecklistPanel()}`;
}


