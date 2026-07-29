export const consolePageInlineCssPart04 = `      border-color: #f3d9a3;
    }
    .owner-summary-card-next-action {
      background: linear-gradient(180deg, #ffffff, var(--owner-accent-soft));
      border-color: #bfdbfe;
    }
    .owner-summary-card strong, .owner-usage-panel strong, .owner-gated-panel strong, .owner-action-log strong, .owner-daily-report-panel strong, .owner-advanced-intro strong {
      font-size: 15px;
    }
    .owner-summary-card ul, .owner-usage-panel ol, .owner-action-log ul, .owner-daily-report-panel ul {
      margin: 0;
      padding-left: 20px;
      color: var(--muted);
      line-height: 1.65;
    }
    .owner-daily-report-panel p, .owner-advanced-intro p {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
    }
    .owner-gated-panel p {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
    }
    .owner-gated-panel button:disabled {
      cursor: not-allowed;
      background: #eef1f4;
      color: #697586;
      border-color: #d0d5dd;
      box-shadow: none;
    }
    .mission-radar { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 0.8fr); gap: 14px; align-items: start; position: relative; }
    .mission-radar h2 { margin: 0; font-size: 24px; }
    .mission-radar p { margin: 6px 0 0; color: var(--muted); line-height: 1.55; }
    .eyebrow { color: var(--brand); font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .radar-grid, .shield-list, .mission-flow, .red-team-playground, .evidence-timeline, .arena-strip { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .radar-grid span, .shield-list span, .mission-flow span, .red-team-playground span, .evidence-timeline span, .arena-strip span { border: 1px solid var(--line); border-radius: 999px; background: rgb(255 255 255 / 82%); color: var(--muted); padding: 7px 10px; font-size: 12px; }
    .radar-grid strong, .shield-list strong { color: var(--text); }
    .mission-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 300px); gap: 12px; position: relative; }
    .mission-workspace, .security-shield { border: 1px solid var(--line); border-radius: 14px; background: rgb(255 255 255 / 72%); padding: 12px; display: grid; gap: 10px; }
    .mission-input-row { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
    .mission-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .mission-card { border: 1px solid var(--line); border-radius: 14px; background: var(--surface); padding: 12px; min-height: 132px; display: grid; gap: 7px; position: relative; overflow: hidden; }
    .mission-card:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgb(15 23 42 / 8%); border-color: #bfd3e5; }
    .mission-card p { margin: 0; color: var(--muted); line-height: 1.45; }
    .mission-card small { color: var(--success); }
    .life-dot, .agent-orbit { width: 12px; height: 12px; border-radius: 999px; background: var(--success); box-shadow: 0 0 0 6px rgb(25 122 66 / 10%); animation: mission-pulse 2.8s ease-in-out infinite; flex: 0 0 auto; }
    .agent-orbit { position: absolute; right: 12px; top: 12px; width: 9px; height: 9px; background: var(--brand); }
    .security-shield h3 { margin: 0; }
    .red-team-playground, .evidence-timeline, .arena-strip { border: 1px solid var(--line); border-radius: 14px; background: rgb(255 255 255 / 72%); padding: 10px; position: relative; }
    .red-team-playground strong, .evidence-timeline strong, .arena-strip strong { margin-right: 4px; }
    .mission-tagline { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
    .mission-tagline::before { content: ""; width: 26px; height: 1px; background: rgb(31 106 165 / 34%); }
    .onboarding-tour, .drilldown-panel, .comparison-panel, .scenario-library, .evidence-export, .scenario-trial-panel, .scenario-dry-run-result, .workforce-preview-panel, .internal-employee-communication-panel, .branch-execution-preview-panel, .long-horizon-hardening-panel, .codex-context-gateway-panel {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: rgb(255 255 255 / 80%);
      padding: 12px;
      display: grid;
      gap: 10px;
    }
    .tour-head, .drilldown-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: start;
      flex-wrap: wrap;
    }
    .tour-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .tour-chip, .comparison-badge {
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      padding: 8px 12px;
      color: var(--muted);
      font-size: 12px;
    }
    .drilldown-card, .comparison-card, .scenario-card, .export-card {
      min-width: 0;
    }
    .tour-steps, .drilldown-grid, .comparison-grid, .scenario-grid, .export-grid {
      display: grid;
      gap: 10px;
    }
    .tour-steps { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .drilldown-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .comparison-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .scenario-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .export-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .scenario-trial-panel {
      background: linear-gradient(135deg, rgb(255 255 255 / 92%), rgb(240 247 252 / 92%));
      position: relative;
      z-index: 1;
    }
    .scenario-trial-panel.is-prominent {
      border-color: rgb(31 106 165 / 38%);
      box-shadow: 0 14px 34px rgb(15 23 42 / 12%);
    }
    .scenario-trial-copy h3, .scenario-dry-run-result h3 {
      margin: 2px 0 0;
      font-size: 19px;
    }
    .scenario-trial-copy p, .scenario-sample-task p, .scenario-step p, .scenario-mode-explainer p, .scenario-replay-preview p {
      margin: 0;
      color: var(--muted);
      line-height: 1.5;
    }
    .scenario-sample-task {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      border: 1px solid rgb(31 106 165 / 24%);
      border-radius: 14px;
      background: var(--surface);
      padding: 12px;
    }
    .scenario-sample-task strong {
      display: block;
      margin-bottom: 6px;
    }
    .scenario-sample-task small, .scenario-replay-preview small {
      display: block;
      margin-top: 8px;
      color: var(--success);
      line-height: 1.45;
    }
    .scenario-trial-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
      min-width: 220px;
    }
    .scenario-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 38px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface);
      color: var(--text);
      padding: 8px 12px;
      text-decoration: none;
      font-size: 13px;
    }
    button.scenario-action {
      cursor: pointer;
    }
    .scenario-action.primary {
      background: linear-gradient(135deg, var(--brand), var(--brand-strong));
      color: #fff;
      border-color: var(--brand-strong);
    }
    .scenario-dry-run-result[hidden] {
      display: none;
    }
    .scenario-dry-run-result.is-visible {
      border-color: rgb(25 122 66 / 34%);
      box-shadow: inset 0 0 0 1px rgb(25 122 66 / 12%);
    }
    .scenario-boundary-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .scenario-boundary-badges span {
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      color: var(--success);
      padding: 7px 10px;
      font-size: 12px;
      font-weight: 700;
    }
    .scenario-step-grid, .scenario-mode-explainer {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .scenario-step, .scenario-mode-explainer article, .scenario-replay-preview {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: rgb(255 255 255 / 82%);
      padding: 11px;
      display: grid;
      gap: 6px;
    }
    .scenario-mode-explainer article.is-recommended {
      border-color: rgb(25 122 66 / 34%);
      box-shadow: inset 0 0 0 1px rgb(25 122 66 / 10%);
    }
    .workforce-preview-panel, .internal-employee-communication-panel, .branch-execution-preview-panel, .long-horizon-hardening-panel, .codex-context-gateway-panel {
      background: rgb(255 255 255 / 72%);
      border-style: dashed;
    }
    .workforce-preview-grid, .internal-communication-grid, .branch-execution-grid, .hardening-preview-grid, .codex-context-grid, .codex-context-preview-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .hardening-preview-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .codex-context-preview-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .workforce-preview-card, .workforce-pyramid-preview, .workforce-preview-result, .internal-communication-card, .internal-communication-result, .internal-communication-flow-strip, .branch-execution-card, .branch-execution-result, .branch-execution-flow-strip, .hardening-preview-card, .hardening-preview-result, .hardening-flow-strip, .codex-context-card, .codex-context-preview-card, .codex-context-result {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: rgb(255 255 255 / 82%);
      padding: 11px;
      display: grid;
      gap: 6px;
    }
    .workforce-preview-card p, .workforce-preview-result p, .internal-communication-card p, .internal-communication-result p, .branch-execution-card p, .branch-execution-result p, .hardening-preview-card p, .hardening-preview-result p, .codex-context-card p, .codex-context-preview-card p, .codex-context-result p {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
    }
    .codex-context-card small, .codex-context-preview-card small {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
    }
    .codex-context-card strong {
      overflow-wrap: anywhere;
      line-height: 1.25;
    }
    .codex-context-preview-card ul {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 5px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
    }
    .codex-context-preview-card li {
      overflow-wrap: anywhere;
    }
    .codex-context-preview-card code {
      color: #24445f;
      background: #edf3f9;
      border-radius: 6px;
      padding: 1px 5px;
    }
    .codex-context-preview-card pre {
      max-height: 150px;
      overflow: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      margin: 0;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: #f8fafc;
      color: #263746;
      padding: 9px;
      font-size: 12px;
      line-height: 1.45;
    }
    .workforce-level-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .workforce-level-row span {
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      color: var(--muted);
      padding: 7px 10px;
      font-size: 12px;
    }
    .workforce-preview-actions, .internal-communication-actions, .branch-execution-actions, .hardening-preview-actions, .codex-context-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .internal-communication-flow-strip, .branch-execution-flow-strip, .hardening-flow-strip {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-size: 12px;
    }
    .internal-communication-flow-strip span, .branch-execution-flow-strip span, .hardening-flow-strip span {
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      padding: 6px 9px;
    }
    .workforce-preview-result[hidden], .internal-communication-result[hidden], .branch-execution-result[hidden], .hardening-preview-result[hidden], .codex-context-result[hidden] {
      display: none;
    }
    .workforce-preview-result.is-visible, .internal-communication-result.is-visible, .branch-execution-result.is-visible, .hardening-preview-result.is-visible, .codex-context-result.is-visible {
      border-color: rgb(25 122 66 / 34%);
      box-shadow: inset 0 0 0 1px rgb(25 122 66 / 10%);
    }
    .tour-step, .drilldown-card, .comparison-card, .scenario-card {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surface);
      padding: 12px;
      display: grid;
      gap: 4px;
      text-align: left;
    }
    .tour-step strong, .drilldown-card strong, .comparison-card strong, .scenario-card strong, .export-card strong { font-size: 14px; }
    .tour-step small, .drilldown-card small, .comparison-card small, .scenario-card small, .export-card small, .drilldown-detail small, .scenario-detail small { color: var(--success); }
    .tour-step.is-active, .drilldown-card.is-active, .scenario-card.is-active, .comparison-card.is-recommended {
      border-color: rgb(31 106 165 / 36%);
      box-shadow: 0 10px 22px rgb(15 23 42 / 8%);
    }
    .tour-step strong { margin: 0; }
    .tour-copy, .drilldown-detail, .scenario-detail, .comparison-footer, .shield-summary {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--surface-muted);
      padding: 12px;
      color: var(--text);
      line-height: 1.55;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .drilldown-detail, .scenario-detail { display: grid; gap: 6px; }
    .comparison-card { border-radius: 16px; align-content: start; }
    .export-card {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surface);
      padding: 12px;
      display: grid;
      gap: 4px;
      text-align: left;
    }
    .comparison-card.is-recommended { background: linear-gradient(135deg, #eef6ff, #ffffff); }
    .comparison-card p { margin: 0; color: var(--muted); line-height: 1.5; }
    .comparison-footer { justify-content: space-between; }
    .comparison-footer span, .shield-summary span { border: 1px solid var(--line); border-radius: 999px; padding: 6px 10px; background: var(--surface); font-size: 12px; color: var(--muted); }
    @keyframes mission-pulse { 0%, 100% { transform: scale(1); opacity: 0.82; } 50% { transform: scale(1.18); opacity: 1; } }
    @keyframes mission-scan { 0%, 70% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
    .scenario-card, .drilldown-card, .tour-step, .comparison-card, .export-card {
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background-color 120ms ease;
    }
    .scenario-card:hover, .drilldown-card:hover, .tour-step:hover, .comparison-card:hover {
      transform: translateY(-1px);
      border-color: #bfd3e5;
      box-shadow: 0 10px 22px rgb(15 23 42 / 8%);
    }
    .workspace {
      min-height: 0;
      overflow: visible;
      padding: 18px;
    }
    .page {
      display: none;
      height: 100%;
      min-height: 0;
    }
    .page.is-active { display: block; }
    .page-shell {
      height: auto;
      min-height: 100%;
      display: grid;
      gap: 16px;
      align-content: start;
      overflow: visible;
      padding-right: 4px;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 18px;
      background: rgb(255 255 255 / 92%);
      box-shadow: var(--shadow);
      padding: 18px;
    }
    .card h2, .card h3, .card h4 { margin: 0; }
    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }
    .card-copy {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.55;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
    .grid-two {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .grid-three {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }
    .stat-card {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surface-muted);
      padding: 14px;
      display: grid;
      gap: 6px;
    }
    .stat-label { color: var(--muted); font-size: 12px; }
    .stat-value { font-size: 20px; font-weight: 700; }
    .chat-page {
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      gap: 14px;
      height: 100%;
      min-height: 0;
    }
    .chat-hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
      border: 1px solid var(--line);
`;
