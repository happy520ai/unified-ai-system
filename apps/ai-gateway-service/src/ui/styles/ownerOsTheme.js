import { ownerOsThemeExtendedCss } from './ownerOsThemeExtended.js';

export const ownerOsThemeCss = `
    :root {
      --owner-os-bg: #f5f5f5;
      --owner-os-bg-2: #eeeeee;
      --owner-os-panel: #ffffff;
      --owner-os-panel-strong: #fafafa;
      --owner-os-line: #e8e8e8;
      --owner-os-text: #1a1a1a;
      --owner-os-muted: #888888;
      --owner-os-soft: #666666;
      --owner-os-accent: #ff6700;
      --owner-os-accent-strong: #e55d00;
      --owner-os-success: #00c853;
      --owner-os-warn: #ff9500;
      --owner-os-danger: #ff3b30;
      --owner-os-radius: 16px;
      --owner-os-shadow: 0 2px 12px rgb(0 0 0 / 8%);
    }

    .owner-os-shell {
      position: relative;
      overflow: visible;
      display: grid;
      gap: 20px;
      min-height: 660px;
      border: 1px solid var(--owner-os-line);
      border-radius: 20px;
      background: var(--owner-os-panel);
      color: var(--owner-os-text);
      padding: clamp(20px, 3vw, 36px);
      box-shadow: var(--owner-os-shadow);
    }

    .owner-os-shell * { letter-spacing: 0; }

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
      border-radius: var(--radius-pill);
      background: #fff8f2;
      color: var(--owner-os-accent);
      padding: 5px 10px;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .owner-os-hero h2 {
      max-width: 820px;
      margin: 16px 0 0;
      color: var(--owner-os-text);
      font-size: clamp(28px, 3.5vw, 48px);
      line-height: 1.1;
      font-weight: 700;
    }

    .owner-os-hero p {
      max-width: 760px;
      margin: 14px 0 0;
      color: var(--owner-os-muted);
      font-size: 15px;
      line-height: 1.75;
    }

    .owner-os-boundary {
      display: grid;
      gap: 6px;
      min-width: 220px;
      border-radius: 16px;
      background: #f0faf4;
      padding: 14px;
      color: var(--owner-os-success);
      font-weight: 700;
    }

    .owner-os-boundary small {
      color: var(--owner-os-muted);
      font-weight: 500;
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
      font-size: 15px;
      font-weight: 600;
    }

    .owner-task-input-panel textarea {
      width: 100%;
      min-height: 92px;
      border: 1px solid var(--owner-os-line);
      border-radius: 12px;
      background: var(--owner-os-panel);
      color: var(--owner-os-text);
      padding: 12px 14px;
      resize: vertical;
      line-height: 1.65;
      transition: border-color 200ms ease;
    }

    .owner-task-input-panel textarea:focus {
      border-color: var(--owner-os-accent);
      outline: none;
    }

    .owner-task-input-panel textarea::placeholder {
      color: var(--owner-os-muted);
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
      border: none;
      border-radius: 16px;
      background: var(--owner-os-accent);
      color: #ffffff;
      padding: 16px 20px;
      box-shadow: 0 4px 16px rgb(255 103 0 / 30%);
      text-align: left;
      font-weight: 700;
      transition: background-color 200ms ease, box-shadow 200ms ease, transform 200ms ease;
    }

    .owner-primary-cta span { font-size: 17px; }
    .owner-primary-cta small { color: rgb(255 255 255 / 80%); font-size: 13px; line-height: 1.45; }

    .owner-primary-cta:hover {
      background: var(--owner-os-accent-strong);
      box-shadow: 0 6px 24px rgb(255 103 0 / 40%);
      transform: translateY(-2px);
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
      border-radius: var(--radius-card);
      background: var(--owner-os-panel);
      padding: 12px;
      transition: background-color 200ms ease, box-shadow 200ms ease, transform 200ms ease;
    }

    .owner-readiness-item:hover {
      border-color: var(--owner-os-accent);
      box-shadow: 0 2px 12px rgb(255 103 0 / 10%);
    }

    .owner-readiness-item span {
      color: var(--owner-os-text);
      font-size: 13px;
      font-weight: 600;
      line-height: 1.35;
    }

    .owner-readiness-item strong {
      color: var(--owner-os-muted);
      font-size: 12px;
      line-height: 1.45;
    }

    .owner-readiness-success { border-color: #c8e6c9; background: #f0faf4; }
    .owner-readiness-warn { border-color: #ffe0b2; background: #fff8f0; }
    .owner-readiness-neutral { border-color: var(--owner-os-line); }

    .owner-readiness-success span { color: var(--owner-os-success); }
    .owner-readiness-warn span { color: var(--owner-os-warn); }

    .owner-os-feedback {
      display: grid;
      gap: 12px;
      border: 1px solid var(--owner-os-line);
      border-radius: var(--radius-card);
      background: var(--owner-os-panel);
      padding: 14px;
    }

    .owner-os-shell .owner-summary-grid,
    .owner-os-shell .owner-daily-report-panel,
    .owner-os-shell .owner-action-log {
      overflow: visible;
    }

    .owner-feedback-line {
      border: 1px solid #ffe0b2;
      border-radius: 12px;
      background: #fff8f2;
      color: var(--owner-os-soft);
      padding: 12px 14px;
      line-height: 1.65;
      font-weight: 600;
    }

    .owner-state-rail {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 8px;
    }

    .owner-state-rail span {
      border: 1px solid var(--owner-os-line);
      border-radius: 12px;
      background: var(--owner-os-panel);
      color: var(--owner-os-muted);
      padding: 8px;
      text-align: center;
      font-size: 12px;
      font-weight: 600;
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
      border-radius: 16px;
      background: var(--owner-os-panel);
      padding: 18px;
      transition: border-color 200ms ease, box-shadow 200ms ease, background-color 200ms ease;
    }

    .owner-summary-card:hover,
    .owner-daily-report-panel:hover,
    .owner-action-log:hover {
      border-color: var(--owner-os-accent);
      box-shadow: 0 4px 16px rgb(255 103 0 / 10%);
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
      font-size: 18px;
      line-height: 1.25;
      font-weight: 700;
    }

    .owner-card-kicker {
      width: fit-content;
      border-radius: var(--radius-pill);
      background: #fff8f2;
      color: var(--owner-os-accent);
      padding: 4px 8px;
      font-size: 12px;
      font-weight: 700;
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

    .owner-summary-card-today-completed { border-color: #c8e6c9; }
    .owner-summary-card-problems-found { border-color: #ffe0b2; }
    .owner-summary-card-next-action { border-color: #ffe0b2; box-shadow: inset 4px 0 0 var(--owner-os-warn); }

    .owner-daily-report-panel {
      display: grid;
      gap: 10px;
    }

    .owner-automation-summary {
      margin: 0;
      color: var(--owner-os-text);
      line-height: 1.7;
    }
` + ownerOsThemeExtendedCss;
