export const ownerOsThemeCss = `
    :root {
      --owner-os-bg: #f6f8fb;
      --owner-os-bg-2: #edf3f7;
      --owner-os-panel: rgb(255 255 255 / 92%);
      --owner-os-panel-strong: rgb(255 255 255 / 96%);
      --owner-os-line: rgb(31 42 55 / 12%);
      --owner-os-text: #111827;
      --owner-os-muted: #5b6878;
      --owner-os-soft: #233041;
      --owner-os-accent: #0f766e;
      --owner-os-accent-strong: #115e59;
      --owner-os-success: #177245;
      --owner-os-warn: #9a6200;
      --owner-os-danger: #b42318;
      --owner-os-radius: 8px;
      --owner-os-shadow: 0 24px 70px rgb(17 24 39 / 12%);
    }

    .owner-os-shell {
      position: relative;
      overflow: visible;
      display: grid;
      gap: 20px;
      min-height: 660px;
      border: 1px solid var(--owner-os-line);
      border-radius: 8px;
      background:
        linear-gradient(135deg, rgb(15 118 110 / 11%), transparent 34%),
        linear-gradient(315deg, rgb(154 98 0 / 10%), transparent 30%),
        linear-gradient(180deg, var(--owner-os-bg), var(--owner-os-bg-2));
      color: var(--owner-os-text);
      padding: clamp(20px, 3vw, 36px);
      box-shadow: var(--owner-os-shadow);
    }

    .owner-os-shell * { letter-spacing: 0; }

    .owner-os-shell::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background-image:
        linear-gradient(rgb(17 24 39 / 4%) 1px, transparent 1px),
        linear-gradient(90deg, rgb(17 24 39 / 4%) 1px, transparent 1px);
      background-size: 42px 42px;
      mask-image: linear-gradient(180deg, rgb(0 0 0 / 38%), transparent 72%);
    }

    .owner-os-ambient {
      position: absolute;
      inset: auto 28px 28px auto;
      width: 220px;
      height: 220px;
      border: 1px solid rgb(15 118 110 / 18%);
      border-radius: 999px;
      opacity: 0.24;
      pointer-events: none;
    }

    .owner-os-content {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 20px;
      overflow: visible;
    }

    .owner-os-hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 24px;
      align-items: start;
    }

    .owner-os-mark {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      min-height: 30px;
      border: 1px solid rgb(15 118 110 / 24%);
      border-radius: 999px;
      background: rgb(15 118 110 / 8%);
      color: var(--owner-os-soft);
      padding: 5px 10px;
      font-size: 13px;
      font-weight: 800;
    }

    .owner-os-hero h2 {
      max-width: 820px;
      margin: 16px 0 0;
      color: var(--owner-os-text);
      font-size: clamp(34px, 4vw, 58px);
      line-height: 1.06;
      font-weight: 900;
    }

    .owner-os-hero p {
      max-width: 760px;
      margin: 14px 0 0;
      color: var(--owner-os-muted);
      font-size: 17px;
      line-height: 1.75;
    }

    .owner-os-boundary {
      display: grid;
      gap: 6px;
      min-width: 220px;
      border: 1px solid rgb(23 114 69 / 20%);
      border-radius: 8px;
      background: rgb(255 255 255 / 70%);
      padding: 14px;
      color: var(--owner-os-success);
      font-weight: 800;
    }

    .owner-os-boundary small {
      color: var(--owner-os-muted);
      font-weight: 650;
      line-height: 1.55;
    }

    .owner-primary-action {
      display: grid;
      max-width: 520px;
    }

    .owner-task-input-panel {
      display: grid;
      gap: 8px;
      max-width: 760px;
    }

    .owner-task-input-panel label {
      color: var(--owner-os-text);
      font-size: 16px;
      font-weight: 850;
    }

    .owner-task-input-panel textarea {
      width: 100%;
      min-height: 92px;
      border: 1px solid rgb(31 42 55 / 15%);
      border-radius: 8px;
      background: rgb(255 255 255 / 86%);
      color: var(--owner-os-text);
      padding: 12px 14px;
      resize: vertical;
      line-height: 1.65;
      box-shadow: inset 0 1px 0 rgb(255 255 255 / 5%);
    }

    .owner-task-input-panel textarea::placeholder {
      color: rgb(91 104 120 / 78%);
    }

    .owner-task-input-panel small {
      color: var(--owner-os-muted);
      line-height: 1.5;
    }

    .owner-primary-cta {
      display: grid;
      gap: 6px;
      width: 100%;
      min-height: 76px;
      border: 1px solid rgb(17 94 89 / 44%);
      border-radius: 8px;
      background: linear-gradient(135deg, #0f766e, #177245 58%, #9a6200);
      color: #ffffff;
      padding: 16px 20px;
      box-shadow: 0 18px 44px rgb(15 118 110 / 22%);
      text-align: left;
      font-weight: 900;
    }

    .owner-primary-cta span { font-size: 18px; }
    .owner-primary-cta small { color: rgb(255 255 255 / 84%); font-size: 13px; line-height: 1.45; }

    .owner-primary-cta:hover {
      border-color: rgb(15 118 110 / 70%);
      box-shadow: 0 20px 54px rgb(15 118 110 / 28%);
    }

    .owner-readiness-matrix {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
    }

    .owner-readiness-item {
      display: grid;
      gap: 6px;
      min-height: 104px;
      border: 1px solid var(--owner-os-line);
      border-radius: 8px;
      background: rgb(255 255 255 / 76%);
      padding: 12px;
      box-shadow: inset 0 1px 0 rgb(255 255 255 / 70%);
    }

    .owner-readiness-item span {
      color: var(--owner-os-text);
      font-size: 13px;
      font-weight: 900;
      line-height: 1.35;
    }

    .owner-readiness-item strong {
      color: var(--owner-os-muted);
      font-size: 12px;
      line-height: 1.45;
    }

    .owner-readiness-success { border-color: rgb(23 114 69 / 24%); background: rgb(233 248 239 / 72%); }
    .owner-readiness-warn { border-color: rgb(154 98 0 / 26%); background: rgb(255 247 228 / 76%); }
    .owner-readiness-neutral { border-color: rgb(31 42 55 / 14%); }

    .owner-readiness-success span { color: var(--owner-os-success); }
    .owner-readiness-warn span { color: var(--owner-os-warn); }
    }

    .owner-os-feedback {
      display: grid;
      gap: 12px;
      border: 1px solid rgb(31 42 55 / 12%);
      border-radius: 8px;
      background: rgb(255 255 255 / 68%);
      padding: 14px;
    }

    .owner-os-shell .owner-summary-grid,
    .owner-os-shell .owner-daily-report-panel,
    .owner-os-shell .owner-action-log {
      overflow: visible;
    }

    .owner-feedback-line {
      border: 1px solid rgb(15 118 110 / 18%);
      border-radius: 8px;
      background: rgb(15 118 110 / 8%);
      color: var(--owner-os-soft);
      padding: 12px 14px;
      line-height: 1.65;
      font-weight: 750;
    }

    .owner-state-rail {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 8px;
    }

    .owner-state-rail span {
      border: 1px solid rgb(164 188 224 / 20%);
      border-radius: 8px;
      background: rgb(255 255 255 / 62%);
      color: var(--owner-os-muted);
      padding: 8px;
      text-align: center;
      font-size: 12px;
      font-weight: 800;
    }

    .owner-summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    .owner-summary-card,
    .owner-daily-report-panel,
    .owner-action-log {
      border: 1px solid var(--owner-os-line);
      border-radius: 8px;
      background: linear-gradient(180deg, rgb(255 255 255 / 82%), rgb(255 255 255 / 56%));
      padding: 18px;
      box-shadow: inset 0 1px 0 rgb(255 255 255 / 80%);
    }

    .owner-summary-card {
      min-height: 220px;
      display: grid;
      align-content: start;
      gap: 14px;
    }

    .owner-card-title {
      display: grid;
      gap: 7px;
    }

    .owner-card-title strong {
      color: var(--owner-os-text);
      font-size: 20px;
      line-height: 1.25;
      font-weight: 900;
    }

    .owner-card-kicker {
      width: fit-content;
      border: 1px solid rgb(15 118 110 / 18%);
      border-radius: 999px;
      background: rgb(15 118 110 / 8%);
      color: var(--owner-os-accent);
      padding: 4px 8px;
      font-size: 12px;
      font-weight: 850;
    }

    .owner-summary-card ul,
    .owner-daily-report-panel ul,
    .owner-action-log ul {
      margin: 0;
      padding-left: 18px;
    }

    .owner-summary-card li,
    .owner-daily-report-panel li,
    .owner-action-log li {
      margin: 8px 0;
      color: var(--owner-os-muted);
      line-height: 1.62;
    }

    .owner-summary-card-today-completed { border-color: rgb(23 114 69 / 24%); }
    .owner-summary-card-problems-found { border-color: rgb(15 118 110 / 24%); }
    .owner-summary-card-next-action { border-color: rgb(154 98 0 / 28%); box-shadow: inset 4px 0 0 var(--owner-os-warn); }

    .owner-daily-report-panel {
      display: grid;
      gap: 10px;
      background: linear-gradient(135deg, rgb(15 118 110 / 8%), rgb(255 255 255 / 62%));
    }

    .owner-automation-summary {
      margin: 0;
      color: var(--owner-os-text);
      line-height: 1.7;
    }

    .owner-automation-advanced-record {
      margin-top: 4px;
      border: 1px solid var(--owner-os-line);
      border-radius: 8px;
      padding: 10px 12px;
      background: rgb(255 255 255 / 48%);
    }

    .owner-automation-advanced-record summary {
      cursor: pointer;
      color: var(--owner-os-muted);
      font-weight: 800;
    }

    .owner-automation-command-palette {
      border-color: rgb(125 211 252 / 34%);
      background: linear-gradient(135deg, rgb(15 118 110 / 8%), rgb(23 114 69 / 7%), rgb(255 255 255 / 60%));
    }

    .five-capability-panel {
      display: grid;
      gap: 16px;
      border: 1px solid rgb(15 118 110 / 22%);
      border-radius: 8px;
      background: linear-gradient(135deg, rgb(15 118 110 / 10%), rgb(255 255 255 / 68%)), rgb(255 255 255 / 72%);
      padding: 18px;
    }

    .five-capability-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(240px, 340px);
      gap: 16px;
      align-items: start;
    }

    .five-capability-head h3 {
      margin: 4px 0 8px;
      color: var(--owner-os-text);
      font-size: 24px;
      line-height: 1.25;
    }

    .five-capability-head p,
    .five-capability-card p,
    .five-capability-result p {
      margin: 0;
      color: var(--owner-os-muted);
      line-height: 1.65;
    }

    .five-capability-run {
      min-height: 68px;
      max-width: none;
    }

    .five-capability-grid,
    .five-capability-result-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
    }

    .five-capability-card,
    .five-capability-result-grid span {
      display: grid;
      gap: 8px;
      min-height: 132px;
      border: 1px solid var(--owner-os-line);
      border-radius: 8px;
      background: rgb(255 255 255 / 74%);
      padding: 12px;
    }

    .five-capability-card strong {
      color: var(--owner-os-text);
      line-height: 1.25;
    }

    .five-capability-card span {
      width: fit-content;
      border: 1px solid rgb(23 114 69 / 22%);
      border-radius: 999px;
      background: rgb(233 248 239 / 82%);
      color: var(--owner-os-success);
      padding: 4px 8px;
      font-size: 12px;
      font-weight: 900;
    }

    .five-capability-result {
      display: grid;
      gap: 10px;
      border: 1px solid rgb(23 114 69 / 22%);
      border-radius: 8px;
      background: rgb(233 248 239 / 72%);
      padding: 14px;
    }

    .five-capability-result[hidden] {
      display: none;
    }

    .five-capability-result strong {
      color: var(--owner-os-success);
      font-size: 18px;
    }

    .five-capability-result-grid span {
      min-height: 64px;
      color: var(--owner-os-soft);
      font-size: 12px;
      font-weight: 850;
      line-height: 1.45;
    }

    .owner-neural-skill-preview {
      display: grid;
      gap: 12px;
      border: 1px solid rgb(125 211 252 / 28%);
      border-radius: 8px;
      background: linear-gradient(135deg, rgb(15 118 110 / 8%), rgb(23 114 69 / 7%), rgb(255 255 255 / 60%));
      padding: 16px;
    }

    .owner-neural-skill-preview-heading {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .owner-neural-skill-preview-heading span {
      color: var(--owner-os-accent);
      font-size: 13px;
      font-weight: 900;
    }

    .owner-neural-skill-preview-heading strong {
      border: 1px solid rgb(134 239 172 / 30%);
      border-radius: 999px;
      background: rgb(134 239 172 / 10%);
      color: var(--owner-os-success);
      padding: 5px 9px;
      font-size: 12px;
      line-height: 1.2;
    }

    .owner-neural-skill-preview-summary,
    .owner-neural-skill-preview-note {
      margin: 0;
      color: var(--owner-os-muted);
      line-height: 1.65;
    }

    .owner-neural-skill-preview-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .owner-neural-skill-preview-grid div {
      display: grid;
      gap: 6px;
      border: 1px solid rgb(164 188 224 / 20%);
      border-radius: 8px;
      background: rgb(255 255 255 / 58%);
      padding: 12px;
      min-height: 82px;
    }

    .owner-neural-skill-preview-grid span {
      color: var(--owner-os-text);
      font-weight: 850;
      line-height: 1.45;
    }

    .owner-neural-skill-preview-grid strong {
      color: var(--owner-os-muted);
      font-size: 12px;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .owner-automation-command-palette-heading {
      display: grid;
      gap: 8px;
    }

    .owner-automation-command-palette-heading p {
      margin: 0;
      color: var(--owner-os-muted);
      line-height: 1.7;
    }

    .owner-automation-command-card {
      display: grid;
      gap: 12px;
      border: 1px solid rgb(164 188 224 / 20%);
      border-radius: 8px;
      background: rgb(255 255 255 / 60%);
      padding: 16px;
    }

    .owner-automation-command-card-main {
      display: grid;
      gap: 8px;
    }

    .owner-automation-command-card-main strong {
      color: var(--owner-os-text);
      font-size: 21px;
      line-height: 1.3;
    }

    .owner-automation-command-card-main p {
      margin: 0;
      color: var(--owner-os-muted);
      line-height: 1.65;
    }

    .owner-automation-command-status {
      color: var(--owner-os-success) !important;
      font-weight: 800;
    }

    .owner-automation-command-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .owner-command-secondary,
    .owner-command-disabled-real-run,
    .owner-command-enabled-real-run {
      min-height: 38px;
      border: 1px solid rgb(125 211 252 / 32%);
      border-radius: 8px;
      background: rgb(125 211 252 / 10%);
      color: var(--owner-os-soft);
      padding: 8px 12px;
      font-weight: 850;
    }

    .owner-command-disabled-real-run {
      border-color: rgb(252 211 77 / 26%);
      background: rgb(252 211 77 / 9%);
      color: var(--owner-os-warn);
      cursor: not-allowed;
      opacity: 0.88;
    }

    .owner-command-enabled-real-run {
      border-color: rgb(134 239 172 / 36%);
      background: rgb(134 239 172 / 12%);
      color: var(--owner-os-success);
    }

    .owner-command-real-run-lock {
      display: grid;
      gap: 6px;
      border: 1px solid rgb(252 211 77 / 24%);
      border-radius: 8px;
      background: rgb(252 211 77 / 8%);
      color: var(--owner-os-muted);
      padding: 10px 12px;
      line-height: 1.55;
    }

    .owner-command-real-run-lock strong {
      color: var(--owner-os-warn);
      font-size: 14px;
      line-height: 1.45;
    }

    .owner-command-real-run-lock span {
      color: var(--owner-os-muted);
      font-size: 13px;
    }

    .owner-automation-command-details {
      border: 1px solid var(--owner-os-line);
      border-radius: 8px;
      background: rgb(255 255 255 / 52%);
      padding: 10px 12px;
    }

    .owner-automation-command-details summary {
      cursor: pointer;
      color: var(--owner-os-muted);
      font-weight: 850;
    }

    .owner-automation-command-details p {
      margin: 8px 0 0;
      color: var(--owner-os-muted);
      line-height: 1.65;
    }

    .owner-command-preview-drawer {
      border-color: rgb(125 211 252 / 34%);
      background: rgb(255 255 255 / 56%);
    }

    .owner-command-preview-drawer-body {
      display: grid;
      gap: 10px;
      margin-top: 10px;
    }

    .owner-command-preview-primary {
      color: var(--owner-os-text) !important;
      font-weight: 850;
    }

    .owner-command-preview-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .owner-command-preview-grid div {
      border: 1px solid rgb(125 211 252 / 22%);
      border-radius: 8px;
      background: rgb(15 118 110 / 7%);
      padding: 10px;
    }

    .owner-command-preview-grid span {
      display: block;
      color: var(--owner-os-muted);
      font-size: 12px;
      font-weight: 800;
    }

    .owner-command-preview-grid strong {
      display: block;
      margin-top: 4px;
      color: var(--owner-os-soft);
      font-size: 14px;
      line-height: 1.45;
    }

    .owner-command-preview-muted {
      color: var(--owner-os-warn) !important;
      font-weight: 800;
    }

    .owner-daily-report-panel strong,
    .owner-action-log strong {
      color: var(--owner-os-text);
      font-size: 18px;
    }

    .owner-report-note {
      margin: 0;
      color: var(--owner-os-muted);
      line-height: 1.7;
    }

    .owner-action-log {
      background: rgb(255 255 255 / 54%);
    }

    @media (max-width: 980px) {
      .owner-os-hero { grid-template-columns: 1fr; }
      .owner-os-boundary { min-width: 0; }
      .owner-summary-grid { grid-template-columns: 1fr; }
      .owner-readiness-matrix { grid-template-columns: 1fr 1fr; }
      .five-capability-head { grid-template-columns: 1fr; }
      .five-capability-grid,
      .five-capability-result-grid { grid-template-columns: 1fr 1fr; }
      .owner-neural-skill-preview-grid { grid-template-columns: 1fr; }
      .owner-state-rail { grid-template-columns: 1fr 1fr; }
    }

    @media (max-width: 640px) {
      .owner-os-shell { min-height: auto; padding: 18px; }
      .owner-os-hero h2 { font-size: 30px; }
      .owner-primary-cta span { font-size: 16px; }
      .owner-state-rail { grid-template-columns: 1fr; }
      .owner-readiness-matrix { grid-template-columns: 1fr; }
      .five-capability-grid,
      .five-capability-result-grid { grid-template-columns: 1fr; }
      .owner-task-input-panel textarea { min-height: 84px; }
      .owner-command-preview-grid { grid-template-columns: 1fr; }
    }
`;
