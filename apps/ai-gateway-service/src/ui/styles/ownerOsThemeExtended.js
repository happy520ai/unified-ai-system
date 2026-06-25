export const ownerOsThemeExtendedCss = `
    .owner-automation-advanced-record {
      margin-top: 4px;
      border: 1px solid var(--owner-os-line);
      border-radius: 12px;
      padding: 10px 12px;
      background: var(--owner-os-panel-strong);
    }

    .owner-automation-advanced-record summary {
      cursor: pointer;
      color: var(--owner-os-muted);
      font-weight: 700;
    }

    .owner-automation-command-palette {
      border-color: #ffe0b2;
      background: #fff8f2;
    }

    .five-capability-panel {
      display: grid;
      gap: 16px;
      border: 1px solid var(--owner-os-line);
      border-radius: 16px;
      background: var(--owner-os-panel);
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
      font-size: 20px;
      line-height: 1.25;
      font-weight: 700;
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
      border-radius: var(--radius-card);
      background: var(--owner-os-panel);
      padding: 12px;
    }

    .five-capability-card strong {
      color: var(--owner-os-text);
      line-height: 1.25;
    }

    .five-capability-card span {
      width: fit-content;
      border-radius: var(--radius-pill);
      background: #f0faf4;
      color: var(--owner-os-success);
      padding: 4px 8px;
      font-size: 12px;
      font-weight: 700;
    }

    .five-capability-result {
      display: grid;
      gap: 10px;
      border-radius: var(--radius-card);
      background: #f0faf4;
      padding: 14px;
    }

    .five-capability-result[hidden] {
      display: none;
    }

    .five-capability-result strong {
      color: var(--owner-os-success);
      font-size: 17px;
    }

    .five-capability-result-grid span {
      min-height: 64px;
      color: var(--owner-os-soft);
      font-size: 12px;
      font-weight: 700;
      line-height: 1.45;
    }

    .owner-neural-skill-preview {
      display: grid;
      gap: 12px;
      border: 1px solid var(--owner-os-line);
      border-radius: 16px;
      background: var(--owner-os-panel);
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
      font-weight: 700;
    }

    .owner-neural-skill-preview-heading strong {
      border-radius: var(--radius-pill);
      background: #f0faf4;
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
      border: 1px solid var(--owner-os-line);
      border-radius: 12px;
      background: var(--owner-os-panel);
      padding: 12px;
      min-height: 82px;
    }

    .owner-neural-skill-preview-grid span {
      color: var(--owner-os-text);
      font-weight: 600;
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
      border: 1px solid var(--owner-os-line);
      border-radius: var(--radius-card);
      background: var(--owner-os-panel);
      padding: 16px;
    }

    .owner-automation-command-card-main {
      display: grid;
      gap: 8px;
    }

    .owner-automation-command-card-main strong {
      color: var(--owner-os-text);
      font-size: 19px;
      line-height: 1.3;
    }

    .owner-automation-command-card-main p {
      margin: 0;
      color: var(--owner-os-muted);
      line-height: 1.65;
    }

    .owner-automation-command-status {
      color: var(--owner-os-success) !important;
      font-weight: 700;
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
      border: 1px solid var(--owner-os-line);
      border-radius: 12px;
      background: var(--owner-os-panel);
      color: var(--owner-os-soft);
      padding: 8px 12px;
      font-weight: 700;
    }

    .owner-command-disabled-real-run {
      border-color: #ffe0b2;
      background: #fff8f0;
      color: var(--owner-os-warn);
      cursor: not-allowed;
      opacity: 0.88;
    }

    .owner-command-enabled-real-run {
      border-color: #c8e6c9;
      background: #f0faf4;
      color: var(--owner-os-success);
    }

    .owner-command-real-run-lock {
      display: grid;
      gap: 6px;
      border: 1px solid #ffe0b2;
      border-radius: 12px;
      background: #fff8f0;
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
      border-radius: 12px;
      background: var(--owner-os-panel-strong);
      padding: 10px 12px;
    }

    .owner-automation-command-details summary {
      cursor: pointer;
      color: var(--owner-os-muted);
      font-weight: 700;
    }

    .owner-automation-command-details p {
      margin: 8px 0 0;
      color: var(--owner-os-muted);
      line-height: 1.65;
    }

    .owner-command-preview-drawer {
      border-color: var(--owner-os-line);
      background: var(--owner-os-panel);
    }

    .owner-command-preview-drawer-body {
      display: grid;
      gap: 10px;
      margin-top: 10px;
    }

    .owner-command-preview-primary {
      color: var(--owner-os-text) !important;
      font-weight: 700;
    }

    .owner-command-preview-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .owner-command-preview-grid div {
      border: 1px solid var(--owner-os-line);
      border-radius: 12px;
      background: var(--owner-os-panel-strong);
      padding: 10px;
    }

    .owner-command-preview-grid span {
      display: block;
      color: var(--owner-os-muted);
      font-size: 12px;
      font-weight: 600;
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
      font-weight: 700;
    }

    .owner-daily-report-panel strong,
    .owner-action-log strong {
      color: var(--owner-os-text);
      font-size: 17px;
    }

    .owner-report-note {
      margin: 0;
      color: var(--owner-os-muted);
      line-height: 1.7;
    }

    .owner-action-log {
      background: var(--owner-os-panel);
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
      .owner-os-hero h2 { font-size: 26px; }
      .owner-primary-cta span { font-size: 15px; }
      .owner-state-rail { grid-template-columns: 1fr; }
      .owner-readiness-matrix { grid-template-columns: 1fr; }
      .five-capability-grid,
      .five-capability-result-grid { grid-template-columns: 1fr; }
      .owner-task-input-panel textarea { min-height: 84px; }
      .owner-command-preview-grid { grid-template-columns: 1fr; }
    }
`;
