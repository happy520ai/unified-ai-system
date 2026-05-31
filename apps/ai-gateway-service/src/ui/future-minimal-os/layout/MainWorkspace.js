import { renderMissionComposerPanel } from "../MissionComposerPanel.js";
import { renderMissionHomePanel } from "../MissionHomePanel.js";
import { renderDetailsAccordionPanel } from "../DetailsAccordionPanel.js";
import { renderExecutionProgressPanel } from "../ExecutionProgressPanel.js";
import { renderRecommendationShowcasePanel } from "../RecommendationShowcasePanel.js";

export function renderMainWorkspace({ copy, state, previewCard }) {
  return `
                <main class="future-main-workspace">
                  <section class="future-first-screen" data-reference-layout="mission-control-os" aria-label="Mission entry">
${renderMissionHomePanel(copy, state)}
${renderMissionComposerPanel(copy)}
${renderRecommendationShowcasePanel()}
${renderExecutionProgressPanel()}
${renderDetailsAccordionPanel()}
                  </section>
${previewCard}
                </main>`;
}
