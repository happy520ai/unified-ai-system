export const ownerDesignTokensCss = `
    :root {
      --owner-bg: #f4f7fb;
      --owner-ink: #172033;
      --owner-muted: #59677b;
      --owner-line: #d8e1ee;
      --owner-surface: #ffffff;
      --owner-surface-soft: #f8fbff;
      --owner-accent: #1768ac;
      --owner-accent-strong: #0c4f8b;
      --owner-accent-soft: #e8f3ff;
      --owner-success: #177245;
      --owner-success-soft: #e9f8ef;
      --owner-warn: #9a6200;
      --owner-warn-soft: #fff7e4;
      --owner-danger: #b42318;
      --owner-danger-soft: #fff1ef;
      --owner-radius: 8px;
      --owner-shadow: 0 16px 38px rgb(23 32 51 / 10%);
    }

    .owner-design-polished {
      --owner-card-pad: 16px;
      color: var(--owner-ink);
    }

    .owner-design-polished .owner-card-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin: 0;
      color: var(--owner-ink);
      font-size: 16px;
      line-height: 1.35;
      font-weight: 850;
      letter-spacing: 0;
    }

    .owner-design-polished .owner-card-kicker {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 4px 8px;
      color: var(--owner-muted);
      background: rgb(255 255 255 / 70%);
      border: 1px solid rgb(216 225 238 / 80%);
      font-size: 12px;
      font-weight: 750;
      white-space: nowrap;
    }
`;
