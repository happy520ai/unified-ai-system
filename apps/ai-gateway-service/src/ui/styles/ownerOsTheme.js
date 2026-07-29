import { ownerOsThemeExtendedCss } from "./ownerOsThemeExtended.js";

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

${ownerOsThemeExtendedCss}`;
