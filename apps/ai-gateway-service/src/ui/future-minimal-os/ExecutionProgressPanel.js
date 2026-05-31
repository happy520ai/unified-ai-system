export function renderExecutionProgressPanel() {
  const steps = [
    ["Understanding mission", "Completed", "done"],
    ["Planning execution", "Completed", "done"],
    ["Collecting data", "In progress", "active"],
    ["Analyzing data", "Pending", "pending"],
    ["Generating report", "Pending", "pending"],
    ["Finalizing results", "Pending", "pending"]
  ];
  return `
                  <section class="future-execution-panel" aria-label="Execution progress preview">
                    <div class="future-section-head stacked">
                      <span>Executing Mission</span>
                      <strong>God Mode</strong>
                    </div>
                    <div class="future-progress-layout">
                      <div class="future-progress-ring-wrap">
                        <div class="future-progress-ring" aria-label="65 percent preview">
                          <svg viewBox="0 0 120 120" aria-hidden="true">
                            <circle cx="60" cy="60" r="48"></circle>
                            <circle cx="60" cy="60" r="48"></circle>
                          </svg>
                          <strong>65%</strong>
                        </div>
                        <span>Executing...</span>
                        <small>Estimated time remaining: 2m 30s</small>
                      </div>
                      <div class="future-step-list">
                        ${steps.map(([title, state, kind]) => `
                          <div class="${kind}">
                            <i aria-hidden="true">${kind === "done" ? "✓" : kind === "active" ? "→" : "+"}</i>
                            <span>${title}</span>
                            <em>${state}</em>
                          </div>`).join("")}
                      </div>
                    </div>
                    <p class="future-panel-note">ⓘ You will be notified when complete.</p>
                  </section>`;
}
