import { renderModeSelectorCards } from "./ModeSelectorCards.js";
import { renderOsNavigationRail } from "./OsNavigationRail.js";
import { renderKPITile, renderStatusPill } from "./components/NeonComponents.js";

/**
 * Enhanced Mission Home Panel with KPI tiles and neon status
 */
export function renderMissionHomePanel(copy, state) {
  const recommendedMode = state?.recommendedMode || copy.modeCopy.defaultRecommendedMode;

  // KPI data (mock - replace with real data from state)
  const kpis = state?.kpis || [
    { value: "$1.2M", delta: "+12.4%", deltaDir: "up", label: "Revenue" },
    { value: "87.3%", delta: "+2.1%", deltaDir: "up", label: "Uptime" },
    { value: "12.4K", delta: "+8.7%", deltaDir: "up", label: "Requests" },
    { value: "4ms", delta: "-15.2%", deltaDir: "down", label: "Latency P99" },
  ];

  // System status
  const systemStatus = state?.systemStatus || "online";

  return `
                  <section class="future-home-panel" aria-label="Mission Control home">
${renderOsNavigationRail()}
                    <div class="future-home-body">
                      <div class="future-home-head">
                        <div>
                          <strong>Mission Control</strong>
                          <span>Your AI OS Command Center</span>
                        </div>
                        <div class="future-system-secure">
                          ${renderStatusPill({ status: systemStatus, label: systemStatus === "online" ? "System Online" : "System Degraded" })}
                        </div>
                      </div>

                      <!-- KPI Tiles -->
                      <div class="kpi-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 16px 0;">
                        ${kpis.map((kpi) => renderKPITile(kpi)).join("")}
                      </div>

                      <div class="future-home-center">
                        <h3>Good morning,<br>Commander.</h3>
                        <p>Describe your mission in natural language. The system will handle the rest.</p>
                      </div>
                      <div class="future-home-spacer" aria-hidden="true"></div>
                      <div class="future-home-mini-input">
                        <span>What do you want to accomplish?</span>
                        <button type="button" aria-label="Preview mission">&rarr;</button>
                      </div>
                      <div class="future-example-row" aria-label="Mission examples">
                        <span>Examples:</span>
                        <button type="button">Analyze financial data</button>
                        <button type="button">Research market trends</button>
                        <button type="button">Generate business report</button>
                      </div>
                      <div class="future-recommended-label">Recommended Mode</div>
${renderModeSelectorCards(copy.modeCopy, recommendedMode)}
                      <div class="future-home-footer">All operations are sandboxed and verifiable. You stay in control.</div>
                    </div>
                  </section>`;
}
