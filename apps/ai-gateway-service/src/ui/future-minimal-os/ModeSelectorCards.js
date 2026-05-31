const modeVisuals = {
  Normal: {
    icon: "⚡",
    title: "Normal Mode",
    body: "Fast and cost-efficient. Great for clean, low-risk daily tasks.",
    scoreLabel: "Speed"
  },
  God: {
    icon: "◇",
    title: "God Mode",
    body: "Maximum capability. Best for complex review, trade-offs, and high-stakes calls.",
    scoreLabel: "Capability"
  },
  Tianshu: {
    icon: "✦",
    title: "Tianshu Mode",
    body: "Planner and executor flow for deep multi-step reasoning and mission planning.",
    scoreLabel: "Reasoning"
  }
};

export function renderModeSelectorCards(modeCopy, recommendedMode = "Tianshu") {
  return `
                  <section class="future-mode-selector" aria-label="Mode selector" data-three-mode-selector="true">
                    ${Object.values(modeCopy.modes).map((mode) => {
                      const selected = mode.name === recommendedMode;
                      const visual = modeVisuals[mode.name] || modeVisuals.Normal;
                      return `
                        <button type="button" class="future-mode-choice${selected ? " is-recommended" : ""}" data-future-mode="${mode.name.toLowerCase()}" data-mode-recommendation-card="true" aria-pressed="${selected ? "true" : "false"}">
                          <span class="future-mode-icon" aria-hidden="true">${visual.icon}</span>
                          <span class="future-mode-name">${mode.name}</span>
                          <strong>${visual.title}</strong>
                          <small>${visual.body}</small>
                          <em>${selected ? "Rec" : "Optional"}</em>
                          <span class="future-mode-meter" aria-label="${visual.scoreLabel}"></span>
                        </button>`;
                    }).join("")}
                  </section>`;
}
