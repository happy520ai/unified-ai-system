export const ownerDesignTokensCss = `
    :root {
      /* ── Xiaomi HyperOS Light Theme ── */
      --owner-bg: #f5f5f5;
      --owner-ink: #1a1a1a;
      --owner-muted: #888888;
      --owner-line: #e8e8e8;
      --owner-surface: #ffffff;
      --owner-surface-soft: #fafafa;
      --owner-accent: #ff6700;
      --owner-accent-strong: #e55d00;
      --owner-accent-soft: #fff3e6;
      --owner-success: #34c759;
      --owner-success-soft: rgba(52, 199, 89, 0.1);
      --owner-warn: #ff9500;
      --owner-warn-soft: rgba(255, 149, 0, 0.1);
      --owner-danger: #ff3b30;
      --owner-danger-soft: rgba(255, 59, 48, 0.1);
      --owner-info: #007aff;
      --owner-info-soft: rgba(0, 122, 255, 0.1);
      --owner-radius: 16px;
      --owner-radius-sm: 8px;
      --owner-radius-md: 12px;
      --owner-radius-lg: 16px;
      --owner-radius-xl: 20px;
      --owner-radius-full: 999px;
      --owner-shadow: 0 2px 8px rgba(0,0,0,0.06);
      --owner-shadow-lg: 0 4px 16px rgba(0,0,0,0.08);

      /* ── Typography ── */
      --font-family: -apple-system, "SF Pro Text", "Helvetica Neue",
                     "PingFang SC", "Microsoft YaHei", sans-serif;
      --font-xs: 12px;
      --font-sm: 13px;
      --font-base: 15px;
      --font-lg: 17px;
      --font-xl: 20px;
      --font-2xl: 24px;
      --font-3xl: 32px;
      --weight-regular: 400;
      --weight-medium: 500;
      --weight-semibold: 600;
      --weight-bold: 700;

      /* ── Spacing ── */
      --space-1: 4px;
      --space-2: 8px;
      --space-3: 12px;
      --space-4: 16px;
      --space-5: 20px;
      --space-6: 24px;
      --space-8: 32px;
      --space-10: 40px;
      --space-12: 48px;
      --space-16: 64px;

      /* ── Shadows ── */
      --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
      --shadow-md: 0 2px 8px rgba(0,0,0,0.06);
      --shadow-lg: 0 4px 16px rgba(0,0,0,0.08);
      --shadow-xl: 0 8px 32px rgba(0,0,0,0.12);
    }

    .owner-design-polished {
      --owner-card-pad: 20px;
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
      font-weight: 600;
      letter-spacing: 0;
    }

    .owner-design-polished .owner-card-kicker {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 4px 10px;
      color: var(--owner-accent);
      background: var(--owner-accent-soft);
      border: 1px solid rgba(255, 103, 0, 0.15);
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      letter-spacing: 0.03em;
    }
`;
