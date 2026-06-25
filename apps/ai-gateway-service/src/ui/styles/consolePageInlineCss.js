export const consolePageInlineCss = `
    /* ══════════════════════════════════════════════
       Xiaomi HyperOS — Light Theme
       ══════════════════════════════════════════════ */
    .future-os-panel {
      display: grid;
      gap: 18px;
      min-height: min(760px, calc(100dvh - 132px));
      align-content: center;
      border: 1px solid rgba(255, 103, 0, 0.15);
      border-radius: 18px;
      background: linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%);
      padding: clamp(20px, 4vw, 44px);
      box-shadow: 0 2px 12px rgb(0 0 0 / 8%);
    }
    .future-os-hero {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 16px;
    }
    .future-os-title-block {
      display: grid;
      gap: 10px;
      max-width: 760px;
    }
    .future-os-title-block h2 {
      margin: 0;
      font-size: clamp(30px, 4.8vw, 58px);
      line-height: 1.02;
      letter-spacing: 0;
      background: var(--brand);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .future-os-title-block p {
      margin: 0;
      max-width: 680px;
      color: var(--text-dim);
      font-size: 16px;
      line-height: 1.7;
    }
    .future-safe-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid rgba(52, 199, 89, 0.3);
      border-radius: var(--radius-pill);
      padding: 9px 12px;
      background: rgba(52, 199, 89, 0.1);
      color: var(--success);
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1), background 150ms cubic-bezier(0.4, 0, 0.2, 1);
      cursor: default;
    }
    .future-safe-pill:hover {
      transform: scale(1.05);
      border-color: rgba(52, 199, 89, 0.45);
      background: rgba(52, 199, 89, 0.15);
      box-shadow: 0 2px 10px rgba(52, 199, 89, 0.2);
    }
    .future-safe-pill:active { transform: scale(0.97); }
    .future-safe-pill span {
      width: 8px;
      height: 8px;
      border-radius: var(--radius-pill);
      background: var(--success);
      box-shadow: 0 0 8px rgba(52, 199, 89, 0.5), 0 0 0 4px rgba(52, 199, 89, 0.12);
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .future-safe-pill:hover span {
      transform: scale(1.3);
      box-shadow: 0 0 14px rgba(52, 199, 89, 0.7), 0 0 0 6px rgba(52, 199, 89, 0.18);
    }
    .future-safe-pill:active span { transform: scale(1.1); }
    .future-os-composer {
      display: grid;
      gap: 10px;
    }
    .future-os-composer label {
      font-size: 18px;
      font-weight: 800;
      color: var(--text);
    }
    .future-os-composer textarea {
      min-height: 132px;
      border-radius: var(--radius-lg);
      padding: 16px;
      font-size: 16px;
      line-height: 1.6;
      background: var(--bg-light);
      border: 1px solid rgba(255, 103, 0, 0.15);
      color: var(--text);
    }
    .future-os-composer textarea:focus {
      border-color: rgba(255, 103, 0, 0.4);
      box-shadow: 0 0 20px rgba(255, 103, 0, 0.1);
      outline: none;
    }
    .future-os-action-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .future-primary-cta {
      min-height: 48px;
      border-radius: var(--radius-md);
      padding: 0 20px;
      font-weight: 800;
      background: linear-gradient(180deg, #ff7a1a 0%, #ff5c00 100%);
      box-shadow: 0 2px 8px rgba(255, 103, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15);
      transition: box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .future-primary-cta:hover {
      box-shadow: 0 4px 16px rgba(255, 103, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.15);
      transform: translateY(-1px);
    }
    .future-primary-cta:active { transform: translateY(0); }
    .future-primary-cta:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.3), 0 4px 16px rgba(255, 103, 0, 0.28);
    }
    .future-os-action-row span,
    .future-preview-empty {
      color: var(--text-dim);
      font-size: 13px;
      line-height: 1.5;
    }
    .future-boundary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .future-boundary-grid span {
      border: 1px solid rgba(255, 103, 0, 0.15);
      border-radius: var(--radius-sm);
      background: var(--bg-light);
      color: var(--text-dim);
      padding: 11px 12px;
      font-size: 13px;
      font-weight: 700;
      text-align: center;
      transition: transform 140ms cubic-bezier(0.4, 0, 0.2, 1), border-color 140ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 140ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .future-boundary-grid span:hover {
      transform: scale(1.06);
      border-color: rgba(255, 103, 0, 0.35);
      box-shadow: 0 3px 10px rgb(0 0 0 / 8%), 0 0 6px rgba(255, 103, 0, 0.1);
    }
    .future-boundary-grid span:active { transform: scale(0.97); }
    .future-mode-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .future-mode-card {
      display: grid;
      gap: 8px;
      border: 1px solid rgba(255, 103, 0, 0.12);
      border-radius: var(--radius-card);
      background: var(--bg-light);
      padding: 14px;
      min-height: 138px;
      transition: border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .future-mode-card:hover {
      border-color: rgba(255, 103, 0, 0.3);
      box-shadow: 0 0 20px rgba(255, 103, 0, 0.1);
      transform: translateY(-2px);
    }
    .future-mode-card:active { transform: translateY(0) scale(0.98); }
    .future-mode-card:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.2); border-color: var(--brand); }
    .future-mode-card.is-recommended {
      border-color: rgba(255, 103, 0, 0.35);
      background: rgba(255, 103, 0, 0.08);
      box-shadow: inset 0 0 0 1px rgba(255, 103, 0, 0.1), 0 0 20px rgba(255, 103, 0, 0.05);
    }
    .future-mode-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      color: var(--text-dim);
      font-size: 13px;
      font-weight: 800;
    }
    .future-mode-head small {
      border: 1px solid rgba(255, 103, 0, 0.2);
      border-radius: var(--radius-pill);
      padding: 3px 8px;
      background: rgba(255, 103, 0, 0.08);
      color: var(--brand);
      font-size: 11px;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1), background 150ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .future-mode-head small:hover {
      transform: scale(1.08);
      box-shadow: 0 2px 8px rgba(255, 103, 0, 0.15);
      background: rgba(255, 103, 0, 0.14);
    }
    .future-mode-head small:active { transform: scale(0.96); }
    .future-mode-card strong {
      font-size: 16px;
      color: var(--text);
    }
    .future-mode-card p,
    .future-preview-grid p,
    .future-details-grid p {
      margin: 0;
      color: var(--text-dim);
      line-height: 1.55;
      overflow-wrap: anywhere;
    }
    .future-preview-card {
      border: 1px solid rgba(255, 103, 0, 0.12);
      border-radius: var(--radius-lg);
      background: var(--bg-light);
      padding: 16px;
      transition: transform 160ms cubic-bezier(0.4, 0, 0.2, 1), border-color 160ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 160ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .future-preview-card:hover {
      transform: translateY(-2px);
      border-color: rgba(255, 103, 0, 0.28);
      box-shadow: 0 6px 18px rgb(0 0 0 / 10%), 0 0 10px rgba(255, 103, 0, 0.06);
    }
    .future-preview-card:active { transform: translateY(0) scale(0.99); }
    .future-preview-card[data-preview-visible="true"] {
      box-shadow: 0 4px 16px rgb(0 0 0 / 10%);
    }
    .future-sample-bridge {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      border: 1px solid rgba(255, 103, 0, 0.15);
      border-radius: var(--radius-card);
      background: var(--bg-light);
      padding: 14px 16px;
      transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .future-sample-bridge:hover {
      transform: translateY(-2px);
      border-color: rgba(255, 103, 0, 0.3);
      box-shadow: 0 6px 16px rgb(0 0 0 / 6%), 0 0 12px rgba(255, 103, 0, 0.06);
    }
    .future-sample-bridge:active { transform: translateY(0) scale(0.99); }
    .future-sample-bridge h3 {
      margin: 2px 0 4px;
      color: var(--text);
      font-size: 17px;
    }
    .future-sample-bridge p {
      margin: 0;
      color: var(--text-dim);
      line-height: 1.55;
    }
    .future-sample-button {
      white-space: nowrap;
    }
    .future-sample-bridge .scenario-dry-run-result {
      grid-column: 1 / -1;
      margin-top: 4px;
    }
    .future-preview-body {
      display: grid;
      gap: 14px;
    }
    .future-preview-head {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 12px;
    }
    .future-preview-head h3 {
      margin: 4px 0 0;
      font-size: 22px;
      color: var(--text);
    }
    .future-preview-head span {
      border: 1px solid rgba(255, 103, 0, 0.2);
      border-radius: var(--radius-pill);
      padding: 6px 10px;
      color: var(--text-dim);
      font-size: 12px;
      white-space: nowrap;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1), color 150ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .future-preview-head span:hover {
      transform: scale(1.05);
      border-color: rgba(255, 103, 0, 0.35);
      color: var(--brand);
      box-shadow: 0 2px 8px rgba(255, 103, 0, 0.1);
    }
    .future-preview-head span:active {
      transform: scale(0.98);
    }
    .future-preview-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .future-preview-grid > div {
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: var(--radius-sm);
      background: var(--bg);
      padding: 12px;
      position: relative;
      overflow: hidden;
      transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .future-preview-grid > div::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 50%;
      background: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, transparent 100%);
      pointer-events: none;
      opacity: 0;
      transition: opacity 200ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .future-preview-grid > div:hover {
      transform: translateY(-2px);
      border-color: rgba(255, 103, 0, 0.25);
      box-shadow: 0 6px 16px rgb(0 0 0 / 7%), 0 0 10px rgba(255, 103, 0, 0.06);
    }
    .future-preview-grid > div:hover::before { opacity: 1; }
    .future-preview-grid > div:active { transform: translateY(0) scale(0.98); }
    .future-preview-grid strong {
      display: block;
      margin-bottom: 7px;
      color: var(--text);
    }
    .future-details-drawer {
      display: grid;
      gap: 14px;
      border: 1px solid rgba(255, 103, 0, 0.12);
      border-radius: var(--radius-lg);
      background: var(--bg-light);
      padding: 16px;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .future-details-drawer:hover {
      transform: translateY(-1px);
      border-color: rgba(255, 103, 0, 0.28);
      box-shadow: 0 4px 14px rgb(0 0 0 / 8%), 0 0 8px rgba(255, 103, 0, 0.06);
    }
    .future-details-drawer:active { transform: translateY(0) scale(0.995); }
    .future-details-head {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 12px;
    }
    .future-details-head h3 {
      margin: 4px 0 0;
      color: var(--text);
    }
    .future-details-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .future-details-grid details {
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: var(--radius-sm);
      background: var(--bg-light);
      padding: 11px 12px;
      position: relative;
      overflow: hidden;
      transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .future-details-grid details::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 50%;
      background: linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 100%);
      pointer-events: none;
      opacity: 0;
      transition: opacity 200ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .future-details-grid details:hover {
      transform: translateY(-2px);
      border-color: rgba(255, 103, 0, 0.25);
      box-shadow: 0 6px 14px rgb(0 0 0 / 6%), 0 0 8px rgba(255, 103, 0, 0.06);
    }
    .future-details-grid details:hover::before { opacity: 1; }
    .future-details-grid details:active { transform: translateY(0) scale(0.98); }
    .future-details-grid summary {
      cursor: pointer;
      color: var(--brand);
      font-weight: 800;
    }
    .future-advanced-system-details {
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: var(--radius-card);
      background: var(--bg-light);
      padding: 12px 14px;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .future-advanced-system-details:hover {
      transform: translateY(-1px);
      border-color: rgba(255, 103, 0, 0.25);
      box-shadow: 0 4px 14px rgb(0 0 0 / 8%), 0 0 8px rgba(255, 103, 0, 0.06);
    }
    .future-advanced-system-details:active { transform: translateY(0) scale(0.99); }
    .future-advanced-system-details > summary {
      cursor: pointer;
      color: var(--brand);
      font-weight: 800;
    }
    .future-advanced-system-body {
      display: grid;
      gap: 12px;
      margin-top: 14px;
    }
    .yiyi-avatar-layer {
      display: grid;
      grid-template-columns: minmax(200px, 220px) minmax(0, 0.8fr) minmax(280px, 1fr) minmax(220px, 260px);
      gap: 14px;
      align-items: start;
      position: relative;
      padding: 18px;
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: 22px;
      background: var(--bg-light);
      overflow: hidden;
      transition: transform 160ms cubic-bezier(0.4, 0, 0.2, 1), border-color 160ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 160ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .yiyi-avatar-layer:hover {
      transform: translateY(-1px);
      border-color: rgba(255, 103, 0, 0.25);
      box-shadow: 0 5px 16px rgb(0 0 0 / 9%), 0 0 10px rgba(255, 103, 0, 0.06);
    }
    .yiyi-avatar-layer:active { transform: translateY(0) scale(0.995); }
    
    .yiyi-avatar-stage {
      position: relative;
      min-height: 220px;
      border: 1px solid rgba(255, 103, 0, 0.12);
      border-radius: 18px;
      background: var(--bg-light);
      overflow: hidden;
      display: grid;
      place-items: center;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .yiyi-avatar-stage:hover {
      transform: translateY(-1px);
      border-color: rgba(255, 103, 0, 0.25);
      box-shadow: 0 4px 14px rgb(0 0 0 / 8%), 0 0 8px rgba(255, 103, 0, 0.06);
    }
    .yiyi-avatar-stage:active { transform: translateY(0) scale(0.995); }
    .yiyi-avatar-figure {
      position: relative;
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
    }
    .yiyi-live-body {
      width: 112px;
      height: 112px;
      border-radius: var(--radius-pill);
      background: #fff8f2;
      border: 1px solid rgba(255, 103, 0, 0.2);
      position: relative;
    }
    .yiyi-live-head {
      position: absolute;
      left: 50%;
      bottom: 72%;
      transform: translateX(-50%);
      width: 64px;
      height: 64px;
      border-radius: var(--radius-pill);
      background: linear-gradient(180deg, rgba(255, 103, 0, 0.15), rgba(255, 103, 0, 0.15));
      border: 1px solid rgba(255, 103, 0, 0.15);
    }
    .yiyi-live-arm-left,
    .yiyi-live-arm-right {
      position: absolute;
      width: 18px;
      height: 54px;
      border-radius: var(--radius-pill);
      background: rgba(255, 103, 0, 0.1);
      border: 1px solid rgba(255, 103, 0, 0.1);
      top: 24%;
    }
    .yiyi-live-arm-left { left: 12%; transform: rotate(12deg); }
    .yiyi-live-arm-right { right: 12%; transform: rotate(-12deg); }
    .yiyi-live-leg-left,
    .yiyi-live-leg-right {
      position: absolute;
      width: 18px;
      height: 48px;
      border-radius: var(--radius-pill);
      background: rgba(255, 103, 0, 0.08);
      border: 1px solid rgba(255, 103, 0, 0.08);
      bottom: 4%;
    }
    .yiyi-live-leg-left { left: 32%; }
    .yiyi-live-leg-right { right: 32%; }
    
    
    
    .yiyi-copy {
      display: grid;
      gap: 10px;
      align-content: start;
    }
    .yiyi-copy h3 {
      margin: 0;
      font-size: 26px;
      color: var(--text);
      letter-spacing: 0;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), color 150ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .yiyi-copy:hover h3 {
      transform: translateY(-1px);
      color: var(--brand);
    }
    .yiyi-copy p {
      margin: 0;
      color: var(--text-dim);
      line-height: 1.65;
    }
    .yiyi-emotion-panel,
    .yiyi-character-card,
    .yiyi-character-settings,
    .yiyi-brain-panel,
    .yiyi-model-brain-panel {
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: var(--radius-lg);
      background: var(--bg-light);
      padding: 14px;
      display: grid;
      gap: 10px;
      min-height: 180px;
      transition: transform 160ms cubic-bezier(0.4, 0, 0.2, 1), border-color 160ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 160ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .yiyi-emotion-panel:hover,
    .yiyi-character-card:hover,
    .yiyi-character-settings:hover,
    .yiyi-brain-panel:hover,
    .yiyi-model-brain-panel:hover {
      transform: translateY(-2px);
      border-color: rgba(255, 103, 0, 0.25);
      box-shadow: 0 6px 18px rgb(0 0 0 / 10%), 0 0 10px rgba(255, 103, 0, 0.06);
    }
    .yiyi-emotion-panel:active,
    .yiyi-character-card:active,
    .yiyi-character-settings:active,
    .yiyi-brain-panel:active,
    .yiyi-model-brain-panel:active { transform: translateY(0) scale(0.99); }
    .yiyi-emotion-panel strong,
    .yiyi-character-card strong,
    .yiyi-character-settings strong,
    .yiyi-brain-panel strong,
    .yiyi-model-brain-panel strong {
      font-size: 14px;
      color: var(--text);
    }
    .yiyi-emotion-grid,
    .yiyi-brain-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .yiyi-emotion-grid span,
    .yiyi-brain-grid span {
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: 10px;
      background: var(--bg);
      padding: 8px;
      font-size: 12px;
      color: var(--text-dim);
      text-align: center;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1), background 150ms cubic-bezier(0.4, 0, 0.2, 1);
      cursor: default;
    }
    .yiyi-emotion-grid span:hover,
    .yiyi-brain-grid span:hover {
      transform: scale(1.08);
      border-color: rgba(255, 103, 0, 0.3);
      background: rgba(255, 103, 0, 0.04);
      box-shadow: 0 2px 8px rgba(255, 103, 0, 0.1);
    }
    .yiyi-concept-preview {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .yiyi-concept-preview span {
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: var(--radius-sm);
      background: var(--bg);
      padding: 10px;
      font-size: 12px;
      color: var(--text-dim);
      line-height: 1.45;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1), background 150ms cubic-bezier(0.4, 0, 0.2, 1);
      cursor: default;
    }
    .yiyi-concept-preview span:hover {
      transform: scale(1.06);
      border-color: rgba(255, 103, 0, 0.28);
      background: rgba(255, 103, 0, 0.03);
      box-shadow: 0 2px 6px rgba(255, 103, 0, 0.08);
    }
    .yiyi-settings-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .yiyi-setting-line-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .yiyi-setting-line-grid span {
      border: 1px solid rgba(255, 103, 0, 0.08);
      border-radius: 10px;
      background: var(--bg);
      padding: 8px;
      font-size: 12px;
      color: var(--text-dim);
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1), background 150ms cubic-bezier(0.4, 0, 0.2, 1);
      cursor: default;
    }
    .yiyi-setting-line-grid span:hover {
      transform: scale(1.06);
      border-color: rgba(255, 103, 0, 0.25);
      background: rgba(255, 103, 0, 0.03);
      box-shadow: 0 2px 6px rgba(255, 103, 0, 0.08);
    }
    .yiyi-showcase-scenes {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .yiyi-showcase-scenes span {
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: var(--radius-sm);
      background: var(--bg);
      padding: 10px;
      font-size: 12px;
      color: var(--text-dim);
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1), background 150ms cubic-bezier(0.4, 0, 0.2, 1);
      cursor: default;
    }
    .yiyi-showcase-scenes span:hover {
      transform: scale(1.06);
      border-color: rgba(255, 103, 0, 0.28);
      background: rgba(255, 103, 0, 0.03);
      box-shadow: 0 2px 6px rgba(255, 103, 0, 0.08);
    }
    @keyframes yiyi-breathe {
      0%, 100% { transform: scaleY(1); }
      50% { transform: scaleY(1.02); }
    }
    @keyframes yiyi-wave-left {
      0%, 100% { transform: rotate(12deg); }
      50% { transform: rotate(22deg); }
    }
    @keyframes yiyi-wave-right {
      0%, 100% { transform: rotate(-12deg); }
      50% { transform: rotate(-22deg); }
    }
    @keyframes yiyi-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }
    
    .owner-boss-view {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 16px;
      border: 1px solid rgba(255, 103, 0, 0.12);
      border-radius: var(--owner-radius, 18px);
      background: linear-gradient(180deg, #fafafa, #f5f5f5);
      padding: clamp(16px, 2.6vw, 24px);
      box-shadow: 0 2px 12px rgb(0 0 0 / 8%);
      transition: transform 180ms cubic-bezier(0.4, 0, 0.2, 1), border-color 180ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 180ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .owner-boss-view:hover {
      transform: translateY(-2px);
      border-color: rgba(255, 103, 0, 0.25);
      box-shadow: 0 8px 24px rgb(0 0 0 / 12%), 0 0 12px rgba(255, 103, 0, 0.06);
    }
    .owner-boss-view:active { transform: translateY(0) scale(0.995); }
    .owner-boss-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
    }
    .owner-boss-head h2 {
      margin: 0;
      font-size: 30px;
      line-height: 1.2;
      letter-spacing: 0;
      color: var(--text);
    }
    .owner-boss-head p {
      max-width: 760px;
      margin: 8px 0 0;
      color: var(--text-dim);
      line-height: 1.65;
    }
    .owner-boss-promise {
      color: var(--brand) !important;
      font-weight: 700;
    }
    .owner-boundary-pill {
      display: inline-flex;
      align-items: center;
      border: 1px solid rgba(52, 199, 89, 0.3);
      border-radius: var(--radius-pill);
      background: rgba(52, 199, 89, 0.1);
      color: var(--success);
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1), background 150ms cubic-bezier(0.4, 0, 0.2, 1);
      cursor: default;
    }
    .owner-boundary-pill:hover {
      transform: scale(1.05);
      border-color: rgba(52, 199, 89, 0.45);
      background: rgba(52, 199, 89, 0.15);
      box-shadow: 0 2px 10px rgba(52, 199, 89, 0.2);
    }
    .owner-boundary-pill:active { transform: scale(0.97); }
    .owner-action-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .owner-action-row button {
      min-height: 42px;
      border-radius: 8px;
    }
    .owner-primary-action {
      display: grid;
      gap: 8px;
    }
    .owner-primary-cta {
      width: 100%;
      min-height: 68px;
      border-radius: var(--owner-radius, 18px);
      font-size: 18px;
      font-weight: 800;
      display: grid;
      gap: 4px;
      place-items: center;
      background: linear-gradient(180deg, #ff7a1a 0%, #ff5c00 100%);
      color: var(--text-on-brand, #ffffff);
      box-shadow: 0 4px 16px rgba(255, 103, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15);
      transition: box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .owner-primary-cta:hover {
      background: linear-gradient(180deg, #ff8533 0%, #ff6200 100%);
      box-shadow: 0 6px 24px rgba(255, 103, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.15);
      transform: translateY(-2px);
    }
    .owner-primary-cta:active {
      background: linear-gradient(180deg, #f06000 0%, #e55200 100%);
      box-shadow: 0 2px 8px rgba(255, 103, 0, 0.2), inset 0 1px 2px rgba(0, 0, 0, 0.1);
      transform: translateY(0);
    }
    .owner-primary-cta:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.35), 0 6px 24px rgba(255, 103, 0, 0.28);
    }
    .owner-primary-cta small {
      color: rgba(255, 255, 255, 0.78);
      font-size: 12px;
      font-weight: 600;
      line-height: 1.35;
    }
    .owner-feedback-line {
      border: 1px solid rgba(255, 103, 0, 0.2);
      border-radius: var(--owner-radius, 18px);
      background: rgba(255, 103, 0, 0.06);
      color: var(--brand);
      padding: 12px 14px;
      font-size: 13px;
      line-height: 1.55;
      font-weight: 600;
      transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1), background 200ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .owner-feedback-line:hover {
      transform: translateY(-2px);
      border-color: rgba(255, 103, 0, 0.35);
      background: rgba(255, 103, 0, 0.09);
      box-shadow: 0 4px 16px rgba(255, 103, 0, 0.12), 0 0 8px rgba(255, 103, 0, 0.06);
    }
    .owner-feedback-line:active { transform: translateY(0) scale(0.99); box-shadow: 0 1px 4px rgb(0 0 0 / 4%); }
    .owner-summary-grid, .owner-guidance-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .owner-section-label {
      color: var(--brand);
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), color 150ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .owner-summary-card:hover .owner-section-label,
    .owner-usage-panel:hover .owner-section-label,
    .owner-gated-panel:hover .owner-section-label,
    .owner-action-log:hover .owner-section-label,
    .owner-daily-report-panel:hover .owner-section-label,
    .owner-advanced-intro:hover .owner-section-label {
      transform: scale(1.05);
      color: #ff7a1a;
    }
    .owner-guidance-grid {
      grid-template-columns: minmax(0, 1fr) minmax(280px, 0.75fr);
    }
    .owner-summary-card, .owner-usage-panel, .owner-gated-panel, .owner-action-log, .owner-daily-report-panel, .owner-advanced-intro {
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: var(--owner-radius, 18px);
      background: var(--bg-light);
      padding: var(--owner-card-pad, 14px);
      display: grid;
      gap: 10px;
      transition: border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .owner-summary-card:hover, .owner-usage-panel:hover, .owner-gated-panel:hover, .owner-action-log:hover, .owner-daily-report-panel:hover, .owner-advanced-intro:hover {
      border-color: rgba(255, 103, 0, 0.25);
      box-shadow: 0 0 20px rgba(255, 103, 0, 0.08);
      transform: translateY(-2px);
    }
    .owner-summary-card:active, .owner-gated-panel:active, .owner-action-log:active, .owner-daily-report-panel:active, .owner-advanced-intro:active {
      transform: scale(0.99);
      box-shadow: 0 1px 4px rgb(0 0 0 / 4%);
    }
    .owner-summary-card:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.18);
      border-color: var(--brand);
    }
    .owner-summary-card-today-completed {
      background: linear-gradient(180deg, #fafafa, rgba(52, 199, 89, 0.08));
      border-color: rgba(52, 199, 89, 0.3);
    }
    .owner-summary-card-problems-found {
      background: linear-gradient(180deg, #fafafa, rgba(255, 149, 0, 0.08));
      border-color: rgba(255, 149, 0, 0.3);
    }
    .owner-summary-card-next-action {
      background: linear-gradient(180deg, #fafafa, rgba(255, 103, 0, 0.08));
      border-color: rgba(255, 103, 0, 0.3);
    }
    .owner-summary-card strong, .owner-usage-panel strong, .owner-gated-panel strong, .owner-action-log strong, .owner-daily-report-panel strong, .owner-advanced-intro strong {
      font-size: 15px;
      color: var(--text);
    }
    .owner-summary-card ul, .owner-usage-panel ol, .owner-action-log ul, .owner-daily-report-panel ul {
      margin: 0;
      padding-left: 20px;
      color: var(--text-dim);
      line-height: 1.65;
    }
    .owner-daily-report-panel p, .owner-advanced-intro p {
      margin: 0;
      color: var(--text-dim);
      line-height: 1.6;
    }
    .owner-gated-panel p {
      margin: 0;
      color: var(--text-dim);
      line-height: 1.6;
    }
    .owner-gated-panel button:disabled {
      cursor: not-allowed;
      background: var(--bg);
      color: var(--muted);
      border-color: rgba(255, 103, 0, 0.1);
      box-shadow: none;
    }
    .mission-radar { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 0.8fr); gap: 14px; align-items: start; position: relative; }
    .mission-radar h2 { margin: 0; font-size: 24px; color: var(--text); transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), color 150ms cubic-bezier(0.4, 0, 0.2, 1); will-change: transform; }
    .mission-radar:hover h2 { transform: translateY(-1px); color: var(--brand); }
    .mission-radar p { margin: 6px 0 0; color: var(--text-dim); line-height: 1.55; }
    .eyebrow { color: var(--brand); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .radar-grid, .shield-list, .mission-flow, .red-team-playground, .evidence-timeline, .arena-strip { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .radar-grid span, .shield-list span, .mission-flow span, .red-team-playground span, .evidence-timeline span, .arena-strip span { border: 1px solid rgba(255, 103, 0, 0.1); border-radius: var(--radius-pill); background: var(--bg-light); color: var(--text-dim); padding: 7px 10px; font-size: 12px; transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1); will-change: transform; }
    .radar-grid span:hover, .shield-list span:hover, .mission-flow span:hover, .red-team-playground span:hover, .evidence-timeline span:hover, .arena-strip span:hover { transform: scale(1.06); border-color: rgba(255, 103, 0, 0.32); box-shadow: 0 2px 8px rgba(255, 103, 0, 0.1); color: var(--brand); }
    .radar-grid span:active, .shield-list span:active, .mission-flow span:active, .red-team-playground span:active, .evidence-timeline span:active, .arena-strip span:active { transform: scale(0.97); }
    .radar-grid strong, .shield-list strong { color: var(--text); }
    .mission-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 300px); gap: 12px; position: relative; }
    .mission-workspace, .security-shield { border: 1px solid rgba(255, 103, 0, 0.1); border-radius: var(--radius-card); background: var(--bg-light); padding: 12px; display: grid; gap: 10px; transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1); will-change: transform; }
    .mission-workspace:hover, .security-shield:hover { transform: translateY(-1px); border-color: rgba(255, 103, 0, 0.25); box-shadow: 0 4px 14px rgb(0 0 0 / 8%), 0 0 8px rgba(255, 103, 0, 0.06); }
    .mission-workspace:active, .security-shield:active { transform: translateY(0) scale(0.995); }
    .mission-input-row { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
    .mission-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .mission-card { border: 1px solid rgba(255, 103, 0, 0.1); border-radius: var(--radius-card); background: var(--bg-light); padding: 12px; min-height: 132px; display: grid; gap: 7px; position: relative; overflow: hidden; transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1); will-change: transform; }
    .mission-card:hover { transform: translateY(-3px); box-shadow: 0 4px 12px rgb(0 0 0 / 8%); border-color: rgba(255, 103, 0, 0.3); }
    .mission-card:active { transform: translateY(0) scale(0.98); box-shadow: 0 2px 6px rgb(0 0 0 / 6%); }
    .mission-card:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.2); border-color: var(--brand); }
    .mission-card p { margin: 0; color: var(--text-dim); line-height: 1.45; }
    .mission-card small { color: var(--success); }
    .life-dot, .agent-orbit { width: 12px; height: 12px; border-radius: var(--radius-pill); background: var(--success); box-shadow: 0 0 0 3px rgba(52, 199, 89, 0.15);  flex: 0 0 auto; }
    .agent-orbit { position: absolute; right: 12px; top: 12px; width: 9px; height: 9px; background: var(--brand); box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.15); }
    .security-shield h3 { margin: 0; color: var(--text); }
    .red-team-playground, .evidence-timeline, .arena-strip { border: 1px solid rgba(255, 103, 0, 0.1); border-radius: var(--radius-card); background: var(--bg-light); padding: 10px; position: relative; transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1); }
    .red-team-playground:hover, .evidence-timeline:hover, .arena-strip:hover { transform: translateY(-1px); border-color: rgba(255, 103, 0, 0.28); box-shadow: 0 4px 14px rgb(0 0 0 / 8%), 0 0 8px rgba(255, 103, 0, 0.06); }
    .red-team-playground:active, .evidence-timeline:active, .arena-strip:active { transform: translateY(0) scale(0.995); }
    .red-team-playground strong, .evidence-timeline strong, .arena-strip strong { margin-right: 4px; color: var(--text); }
    .mission-tagline { display: inline-flex; align-items: center; gap: 8px; color: var(--text-dim); font-size: 12px; }
    .mission-tagline::before { content: ""; width: 26px; height: 1px; background: rgba(255, 103, 0, 0.3); }
    .onboarding-tour, .drilldown-panel, .comparison-panel, .scenario-library, .evidence-export, .scenario-trial-panel, .scenario-dry-run-result, .workforce-preview-panel, .internal-employee-communication-panel, .branch-execution-preview-panel, .long-horizon-hardening-panel, .codex-context-gateway-panel {
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: var(--radius-card);
      background: var(--bg-light);
      padding: 12px;
      display: grid;
      gap: 10px;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .onboarding-tour:hover, .drilldown-panel:hover, .comparison-panel:hover, .scenario-library:hover, .evidence-export:hover, .scenario-trial-panel:hover, .scenario-dry-run-result:hover, .workforce-preview-panel:hover, .internal-employee-communication-panel:hover, .branch-execution-preview-panel:hover, .long-horizon-hardening-panel:hover, .codex-context-gateway-panel:hover {
      transform: translateY(-2px);
      border-color: rgba(255, 103, 0, 0.25);
      box-shadow: 0 6px 18px rgb(0 0 0 / 9%), 0 0 10px rgba(255, 103, 0, 0.06);
    }
    .onboarding-tour:active, .drilldown-panel:active, .comparison-panel:active, .scenario-library:active, .evidence-export:active, .scenario-trial-panel:active, .scenario-dry-run-result:active, .workforce-preview-panel:active, .internal-employee-communication-panel:active, .branch-execution-preview-panel:active, .long-horizon-hardening-panel:active, .codex-context-gateway-panel:active {
      transform: translateY(0) scale(0.99);
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
      border: 1px solid rgba(255, 103, 0, 0.12);
      border-radius: var(--radius-pill);
      background: var(--bg-light);
      padding: 8px 12px;
      color: var(--text-dim);
      font-size: 12px;
      transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1), background 200ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
      cursor: default;
    }
    .tour-chip:hover, .comparison-badge:hover {
      transform: translateY(-2px);
      border-color: rgba(255, 103, 0, 0.3);
      background: #fff3eb;
      box-shadow: 0 4px 12px rgba(255, 103, 0, 0.1);
    }
    .tour-chip:active, .comparison-badge:active { transform: translateY(0) scale(0.97); box-shadow: 0 1px 3px rgb(0 0 0 / 4%); }
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
      background: linear-gradient(135deg, #fafafa, rgba(255, 103, 0, 0.04));
      position: relative;
      z-index: 1;
    }
    .scenario-trial-panel.is-prominent {
      border-color: rgba(255, 103, 0, 0.3);
      box-shadow: 0 4px 16px rgb(0 0 0 / 8%);
    }
    .scenario-trial-copy h3, .scenario-dry-run-result h3 {
      margin: 2px 0 0;
      font-size: 19px;
      color: var(--text);
    }
    .scenario-trial-copy p, .scenario-sample-task p, .scenario-step p, .scenario-mode-explainer p, .scenario-replay-preview p {
      margin: 0;
      color: var(--text-dim);
      line-height: 1.5;
    }
    .scenario-sample-task {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      border: 1px solid rgba(255, 103, 0, 0.2);
      border-radius: var(--radius-card);
      background: var(--bg-light);
      padding: 12px;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .scenario-sample-task:hover {
      transform: translateY(-1px);
      border-color: rgba(255, 103, 0, 0.35);
      box-shadow: 0 4px 14px rgb(0 0 0 / 8%), 0 0 8px rgba(255, 103, 0, 0.08);
    }
    .scenario-sample-task:active { transform: translateY(0) scale(0.99); }
    .scenario-sample-task strong {
      display: block;
      margin-bottom: 6px;
      color: var(--text);
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
      border: 1px solid rgba(255, 103, 0, 0.12);
      border-radius: 10px;
      background: var(--bg-light);
      color: var(--text);
      padding: 8px 12px;
      text-decoration: none;
      font-size: 13px;
      transition: background 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .scenario-action:hover {
      background: #fff3eb;
      border-color: rgba(255, 103, 0, 0.32);
      transform: translateY(-1px);
    }
    .scenario-action:active { transform: translateY(0); }
    .scenario-action:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.22);
      border-color: var(--brand);
    }
    button.scenario-action {
      cursor: pointer;
    }
    .scenario-action.primary {
      background: var(--brand);
      color: var(--text-on-brand, #f5f5f5);
      border-color: var(--brand);
    }
    .scenario-action.primary:hover {
      background: var(--brand-hover, #e55500);
      border-color: var(--brand-hover, #e55500);
    }
    .scenario-action.primary:active { background: #cc4a00; }
    .scenario-dry-run-result[hidden] {
      display: none;
    }
    .scenario-dry-run-result.is-visible {
      border-color: rgba(52, 199, 89, 0.3);
      box-shadow: inset 0 0 0 1px rgba(52, 199, 89, 0.1);
    }
    .scenario-boundary-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .scenario-boundary-badges span {
      border: 1px solid rgba(52, 199, 89, 0.2);
      border-radius: var(--radius-pill);
      background: rgba(52, 199, 89, 0.08);
      color: var(--success);
      padding: 7px 10px;
      font-size: 12px;
      font-weight: 700;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1), background 150ms cubic-bezier(0.4, 0, 0.2, 1);
      cursor: default;
    }
    .scenario-boundary-badges span:hover {
      transform: scale(1.06);
      border-color: rgba(52, 199, 89, 0.4);
      background: rgba(52, 199, 89, 0.12);
      box-shadow: 0 2px 8px rgba(52, 199, 89, 0.15);
    }
    .scenario-step-grid, .scenario-mode-explainer {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .scenario-step, .scenario-mode-explainer article, .scenario-replay-preview {
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: var(--radius-sm);
      background: var(--bg);
      padding: 11px;
      display: grid;
      gap: 6px;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .scenario-step:hover, .scenario-mode-explainer article:hover, .scenario-replay-preview:hover {
      transform: translateY(-1px);
      border-color: rgba(255, 103, 0, 0.25);
      box-shadow: 0 4px 14px rgb(0 0 0 / 8%), 0 0 8px rgba(255, 103, 0, 0.06);
    }
    .scenario-step:active, .scenario-mode-explainer article:active, .scenario-replay-preview:active {
      transform: translateY(0) scale(0.99);
    }
    .scenario-mode-explainer article.is-recommended {
      border-color: rgba(52, 199, 89, 0.3);
      box-shadow: inset 0 0 0 1px rgba(52, 199, 89, 0.1);
    }
    .workforce-preview-panel, .internal-employee-communication-panel, .branch-execution-preview-panel, .long-horizon-hardening-panel, .codex-context-gateway-panel {
      background: var(--bg);
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
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: var(--radius-sm);
      background: var(--bg);
      padding: 11px;
      display: grid;
      gap: 6px;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .workforce-preview-card:hover, .workforce-pyramid-preview:hover, .internal-communication-card:hover, .internal-communication-flow-strip:hover, .branch-execution-card:hover, .branch-execution-flow-strip:hover, .hardening-preview-card:hover, .hardening-flow-strip:hover, .codex-context-card:hover, .codex-context-preview-card:hover {
      transform: translateY(-1px);
      border-color: rgba(255, 103, 0, 0.25);
      box-shadow: 0 4px 14px rgb(0 0 0 / 8%), 0 0 8px rgba(255, 103, 0, 0.06);
    }
    .workforce-preview-card:active, .workforce-pyramid-preview:active, .internal-communication-card:active, .branch-execution-card:active, .hardening-preview-card:active, .codex-context-card:active, .codex-context-preview-card:active { transform: translateY(0) scale(0.99); }
    .workforce-preview-card p, .workforce-preview-result p, .internal-communication-card p, .internal-communication-result p, .branch-execution-card p, .branch-execution-result p, .hardening-preview-card p, .hardening-preview-result p, .codex-context-card p, .codex-context-preview-card p, .codex-context-result p {
      margin: 0;
      color: var(--text-dim);
      line-height: 1.45;
    }
    .codex-context-card small, .codex-context-preview-card small {
      color: var(--text-dim);
      font-size: 12px;
      line-height: 1.35;
    }
    .codex-context-card strong {
      overflow-wrap: anywhere;
      line-height: 1.25;
      color: var(--text);
    }
    .codex-context-preview-card ul {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 5px;
      color: var(--text-dim);
      font-size: 12px;
      line-height: 1.35;
    }
    .codex-context-preview-card li {
      overflow-wrap: anywhere;
    }
    .codex-context-preview-card code {
      color: var(--brand);
      background: rgba(255, 103, 0, 0.08);
      border-radius: 6px;
      padding: 1px 5px;
    }
    .codex-context-preview-card pre {
      max-height: 150px;
      overflow: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      margin: 0;
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.75);
      color: var(--text-dim);
      padding: 9px;
      font-size: 12px;
      line-height: 1.45;
      transition: border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .codex-context-preview-card pre:hover {
      border-color: rgba(255, 103, 0, 0.3);
      box-shadow: 0 2px 10px rgba(255, 103, 0, 0.08);
    }
    .workforce-level-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .workforce-level-row span {
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: var(--radius-pill);
      background: var(--bg-light);
      color: var(--text-dim);
      padding: 7px 10px;
      font-size: 12px;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1), background 150ms cubic-bezier(0.4, 0, 0.2, 1);
      cursor: default;
    }
    .workforce-level-row span:hover {
      transform: scale(1.06);
      border-color: rgba(255, 103, 0, 0.3);
      background: rgba(255, 103, 0, 0.06);
      box-shadow: 0 2px 8px rgba(255, 103, 0, 0.12);
    }
    .workforce-level-row span:active { transform: scale(0.97); }
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
      color: var(--text-dim);
      font-size: 12px;
    }
    .internal-communication-flow-strip span, .branch-execution-flow-strip span, .hardening-flow-strip span {
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: var(--radius-pill);
      background: var(--bg-light);
      padding: 6px 9px;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1), background 150ms cubic-bezier(0.4, 0, 0.2, 1);
      cursor: default;
    }
    .internal-communication-flow-strip span:hover, .branch-execution-flow-strip span:hover, .hardening-flow-strip span:hover {
      transform: scale(1.06);
      border-color: rgba(255, 103, 0, 0.3);
      background: rgba(255, 103, 0, 0.06);
      box-shadow: 0 2px 8px rgba(255, 103, 0, 0.12);
    }
    .internal-communication-flow-strip span:active, .branch-execution-flow-strip span:active, .hardening-flow-strip span:active { transform: scale(0.97); }
    .workforce-preview-result[hidden], .internal-communication-result[hidden], .branch-execution-result[hidden], .hardening-preview-result[hidden], .codex-context-result[hidden] {
      display: none;
    }
    .workforce-preview-result.is-visible, .internal-communication-result.is-visible, .branch-execution-result.is-visible, .hardening-preview-result.is-visible, .codex-context-result.is-visible {
      border-color: rgba(52, 199, 89, 0.3);
      box-shadow: inset 0 0 0 1px rgba(52, 199, 89, 0.1);
    }
    .tour-step, .drilldown-card, .comparison-card, .scenario-card {
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: var(--radius-card);
      background: var(--bg-light);
      padding: 12px;
      display: grid;
      gap: 4px;
      text-align: left;
    }
    .tour-step strong, .drilldown-card strong, .comparison-card strong, .scenario-card strong, .export-card strong { font-size: 14px; color: var(--text); }
    .tour-step small, .drilldown-card small, .comparison-card small, .scenario-card small, .export-card small, .drilldown-detail small, .scenario-detail small { color: var(--success); }
    .tour-step.is-active, .drilldown-card.is-active, .scenario-card.is-active, .comparison-card.is-recommended {
      border-color: rgba(255, 103, 0, 0.35);
      box-shadow: 0 10px 22px rgb(0 0 0 / 15%), 0 0 15px rgba(255, 103, 0, 0.08);
    }
    .tour-step strong { margin: 0; }
    .tour-copy, .drilldown-detail, .scenario-detail, .comparison-footer, .shield-summary {
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: var(--radius-sm);
      background: var(--bg);
      padding: 12px;
      color: var(--text);
      line-height: 1.55;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1), background 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .tour-copy:hover, .drilldown-detail:hover, .scenario-detail:hover, .comparison-footer:hover, .shield-summary:hover {
      transform: translateY(-2px);
      border-color: rgba(255, 103, 0, 0.25);
      box-shadow: 0 6px 16px rgb(0 0 0 / 10%), 0 0 10px rgba(255, 103, 0, 0.06);
    }
    .tour-copy:active, .drilldown-detail:active, .scenario-detail:active, .comparison-footer:active, .shield-summary:active { transform: translateY(0) scale(0.99); }
    .drilldown-detail, .scenario-detail { display: grid; gap: 6px; }
    .comparison-card { border-radius: var(--radius-lg); align-content: start; }
    .export-card {
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: var(--radius-card);
      background: var(--bg-light);
      padding: 12px;
      display: grid;
      gap: 4px;
      text-align: left;
    }
    .comparison-card.is-recommended { background: #fff8f2; }
    .comparison-card p { margin: 0; color: var(--text-dim); line-height: 1.5; }
    .comparison-footer { justify-content: space-between; }
    .comparison-footer span, .shield-summary span {
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: var(--radius-pill);
      padding: 6px 10px;
      background: var(--bg-light);
      font-size: 12px;
      color: var(--text-dim);
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1), background 150ms cubic-bezier(0.4, 0, 0.2, 1);
      cursor: default;
    }
    .comparison-footer span:hover, .shield-summary span:hover {
      transform: scale(1.06);
      border-color: rgba(255, 103, 0, 0.3);
      background: rgba(255, 103, 0, 0.06);
      box-shadow: 0 2px 8px rgba(255, 103, 0, 0.12);
    }
    .comparison-footer span:active, .shield-summary span:active { transform: scale(0.97); }
    @keyframes mission-pulse { 0%, 100% { transform: scale(1); opacity: 0.82; } 50% { transform: scale(1.18); opacity: 1; } }
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 4px currentColor, 0 0 0 3px rgba(52, 199, 89, 0.1); opacity: 0.85; }
      50% { box-shadow: 0 0 12px currentColor, 0 0 0 6px rgba(52, 199, 89, 0.15); opacity: 1; }
    }
    .scenario-card, .drilldown-card, .tour-step, .comparison-card, .export-card {
      cursor: pointer;
      transition: transform 120ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 120ms cubic-bezier(0.4, 0, 0.2, 1), border-color 120ms cubic-bezier(0.4, 0, 0.2, 1), background-color 120ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .scenario-card:hover, .drilldown-card:hover, .tour-step:hover, .comparison-card:hover {
      transform: translateY(-2px);
      border-color: rgba(255, 103, 0, 0.3);
      box-shadow: 0 10px 22px rgb(0 0 0 / 15%), 0 0 15px rgba(255, 103, 0, 0.08);
    }
    .scenario-card:active, .drilldown-card:active, .tour-step:active, .comparison-card:active, .export-card:active { transform: translateY(0) scale(0.98); }
    .scenario-card:focus-visible, .drilldown-card:focus-visible, .tour-step:focus-visible, .comparison-card:focus-visible, .export-card:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.2); border-color: var(--brand); }
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
      border-radius: var(--radius-lg);
      background: var(--surface);
      box-shadow: 0 1px 4px rgb(0 0 0 / 4%), 0 4px 16px rgb(0 0 0 / 3%);
      padding: 24px;
      transition: box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgb(0 0 0 / 6%), 0 8px 28px rgb(0 0 0 / 5%), 0 0 12px rgba(255, 103, 0, 0.04);
      border-color: rgba(255, 103, 0, 0.12);
    }
    .card:active { transform: translateY(0) scale(0.99); }
    .card h2, .card h3, .card h4 { margin: 0; color: var(--text); }
    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }
    .card-copy {
      color: var(--text-dim);
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
      position: relative;
      border: 1px solid var(--line);
      border-radius: var(--radius-card);
      background: var(--surface);
      padding: 18px 14px 14px;
      display: grid;
      gap: 6px;
      overflow: hidden;
    }
    .stat-card {
      transition: border-color 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .stat-card:hover {
      border-color: var(--line-bright);
      box-shadow: 0 4px 12px rgb(0 0 0 / 6%), 0 1px 3px rgb(0 0 0 / 4%);
      transform: translateY(-2px);
    }
    .stat-card:active { transform: translateY(0) scale(0.98); box-shadow: 0 2px 6px rgb(0 0 0 / 4%); }
    .stat-card:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.2); border-color: var(--brand); }
    .stat-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--accent-color, var(--brand)), color-mix(in srgb, var(--accent-color, var(--brand)) 70%, transparent));
      border-radius: var(--radius-card) var(--radius-card) 0 0;
    }
    .stat-label { color: var(--text-dim); font-size: 12px; }
    .stat-value { font-size: 20px; font-weight: 700; color: var(--text); }
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
      border: 1px solid rgba(255, 103, 0, 0.12);
      border-radius: var(--radius-lg);
      background: linear-gradient(135deg, #ffffff 0%, rgba(255, 103, 0, 0.03) 50%, #fafafa 100%);
      box-shadow: 0 2px 8px rgb(0 0 0 / 4%), 0 8px 24px rgb(0 0 0 / 6%);
      padding: 18px 20px;
      transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .chat-hero:hover {
      transform: translateY(-2px);
      border-color: rgba(255, 103, 0, 0.25);
      box-shadow: 0 4px 12px rgb(0 0 0 / 5%), 0 12px 32px rgb(0 0 0 / 8%), 0 0 12px rgba(255, 103, 0, 0.06);
    }
    .chat-hero:active { transform: translateY(0) scale(0.99); box-shadow: 0 2px 8px rgb(0 0 0 / 4%); }
    .chat-hero h2 { margin: 0; font-size: 22px; color: var(--text); }
    .chat-hero p { margin: 8px 0 0; color: var(--text-dim); line-height: 1.6; }
    .chat-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }
    .chat-shell {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      min-height: 0;
    }
    .chat-panel {
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      min-height: 0;
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: 22px;
      background: var(--bg-light);
      box-shadow: var(--shadow-lg);
      overflow: hidden;
      transition: border-color 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .chat-panel:hover {
      border-color: rgba(255, 103, 0, 0.18);
      box-shadow: 0 8px 28px rgb(0 0 0 / 7%), 0 0 10px rgba(255, 103, 0, 0.04);
    }
    .chat-history {
      min-height: 0;
      overflow: auto;
      padding: 24px 0;
      background: var(--bg);
      scroll-behavior: smooth;
    }
    .chat-conversation {
      width: min(1080px, calc(100% - 48px));
      margin: 0 auto;
      display: grid;
      align-content: start;
      gap: 14px;
    }
    .message {
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: 18px;
      padding: 14px 16px;
      background: var(--bg-light);
      box-shadow: 0 8px 18px rgb(0 0 0 / 6%);
      line-height: 1.65;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      color: var(--text);
      transition: border-color 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .message:hover {
      border-color: rgba(255, 103, 0, 0.2);
      box-shadow: 0 10px 22px rgb(0 0 0 / 8%), 0 0 10px rgba(255, 103, 0, 0.05);
      transform: translateY(-1px);
    }
    .message-role {
      font-size: 12px;
      color: var(--text-dim);
      margin-bottom: 8px;
      font-weight: 700;
    }
    .message.user {
      justify-self: end;
      width: min(54%, 720px);
      background: #fff8f2;
      border-color: rgba(255, 103, 0, 0.2);
    }
    .message.assistant,
    .message.system {
      justify-self: start;
      width: min(76%, 880px);
    }
    .message.system {
      background: rgba(255, 149, 0, 0.06);
      border-color: rgba(255, 149, 0, 0.2);
    }
    .message details {
      margin-top: 10px;
      border-top: 1px dashed rgba(255, 103, 0, 0.15);
      padding-top: 10px;
      color: var(--text-dim);
      font-size: 12px;
    }
    .message details summary { cursor: pointer; color: var(--brand); transition: color 150ms cubic-bezier(0.4, 0, 0.2, 1), transform 150ms cubic-bezier(0.4, 0, 0.2, 1); }
    .message details summary:hover { color: #e55500; transform: translateX(2px); }
    .message details summary:active { transform: translateX(0) scale(0.98); }
    .composer-wrap {
      border-top: 1px solid rgba(255, 103, 0, 0.1);
      background: var(--bg);
      padding: 16px 18px 18px;
    }
    .composer {
      width: min(1080px, 100%);
      margin: 0 auto;
      display: grid;
      grid-template-columns: minmax(220px, 280px) minmax(0, 1fr) auto;
      gap: 12px;
      align-items: end;
    }
    .composer-left {
      display: grid;
      gap: 8px;
      align-content: start;
    }
    .composer-left label,
    .field label {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
      color: var(--text-dim);
      font-weight: 700;
      transition: color 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .composer-left:hover label,
    .field:hover label { color: var(--brand); }
    .composer-main textarea {
      min-height: 118px;
      max-height: 220px;
      padding: 14px;
      line-height: 1.6;
      background: var(--bg-light);
      border: 1px solid rgba(255, 103, 0, 0.12);
      color: var(--text);
      border-radius: var(--radius-card);
    }
    .composer-main textarea:focus {
      border-color: rgba(255, 103, 0, 0.35);
      box-shadow: 0 0 15px rgba(255, 103, 0, 0.08);
      outline: none;
    }
    .composer-actions {
      display: grid;
      gap: 10px;
      align-self: stretch;
    }
    .three-mode-runtime {
      width: min(1080px, 100%);
      margin: 14px auto 0;
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: var(--radius-card);
      background: var(--bg);
      padding: 12px;
      display: grid;
      gap: 12px;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .three-mode-runtime:hover {
      transform: translateY(-1px);
      border-color: rgba(255, 103, 0, 0.25);
      box-shadow: 0 4px 14px rgb(0 0 0 / 8%), 0 0 8px rgba(255, 103, 0, 0.05);
    }
    .three-mode-runtime:active { transform: translateY(0) scale(0.99); }
    .three-mode-tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .three-mode-notice {
      border: 1px solid rgba(255, 149, 0, 0.25);
      border-radius: var(--radius-sm);
      background: rgba(255, 149, 0, 0.06);
      color: var(--warn);
      padding: 12px 14px;
      line-height: 1.55;
      font-size: 13px;
    }
    .three-mode-candidate-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .three-mode-candidate-card {
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: var(--radius-card);
      background: var(--bg-light);
      padding: 12px 14px;
      display: grid;
      gap: 8px;
      transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .three-mode-candidate-card:hover {
      transform: translateY(-2px);
      border-color: rgba(255, 103, 0, 0.25);
      box-shadow: 0 6px 16px rgb(0 0 0 / 6%), 0 0 10px rgba(255, 103, 0, 0.06);
    }
    .three-mode-candidate-card:active { transform: translateY(0) scale(0.98); }
    .three-mode-candidate-card strong {
      font-size: 13px;
      color: var(--text);
    }
    .three-mode-candidate-card ul {
      margin: 0;
      padding-left: 18px;
      color: var(--text-dim);
      font-size: 12px;
      line-height: 1.55;
    }
    .three-mode-tab {
      min-height: 36px;
      transition: background 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .three-mode-tab:hover:not(.is-active) {
      background: rgba(255, 103, 0, 0.08);
      border-color: rgba(255, 103, 0, 0.25);
      transform: translateY(-1px);
    }
    .three-mode-tab:active {
      transform: scale(0.97);
    }
    .three-mode-tab:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.22);
      border-color: var(--brand);
    }
    .three-mode-tab.is-active {
      background: var(--brand);
      color: var(--text-on-brand, #f5f5f5);
      border-color: var(--brand);
    }
    .three-mode-panels {
      display: grid;
      gap: 10px;
    }
    .three-mode-panel {
      display: none;
      gap: 10px;
    }
    .three-mode-panel.is-active {
      display: grid;
    }
    .three-mode-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .three-mode-grid select[multiple] {
      min-height: 112px;
      background: var(--bg-light);
      border: 1px solid rgba(255, 103, 0, 0.12);
      color: var(--text);
      border-radius: 10px;
    }
    .three-mode-wide {
      grid-column: 1 / -1;
    }
    .three-mode-result {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .three-mode-result pre {
      min-height: 88px;
      max-height: 260px;
      overflow: auto;
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      background: #1a1a1a;
      border: 1px solid #333333;
      border-radius: 10px;
      padding: 10px;
      color: #bbbbbb;
    }
    .hint {
      color: var(--text-dim);
      font-size: 12px;
      line-height: 1.5;
    }
    .surface-muted {
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--bg-light);
      padding: 12px 14px;
      transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .surface-muted:hover {
      transform: translateY(-1px);
      border-color: rgba(255, 103, 0, 0.2);
      box-shadow: 0 4px 12px rgb(0 0 0 / 5%), 0 0 8px rgba(255, 103, 0, 0.04);
    }
    .surface-muted:active { transform: translateY(0) scale(0.99); }
    .model-list {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }
    .model-item,
    .approval-item,
    .file-item,
    .diagnostic-item {
      border: 1px solid var(--line);
      border-radius: var(--radius-card);
      background: var(--surface);
      padding: 14px;
      display: grid;
      gap: 8px;
      transition: border-color 180ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 180ms cubic-bezier(0.4, 0, 0.2, 1), transform 180ms cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 1px 3px rgb(0 0 0 / 3%);
    }
    .model-item:hover,
    .approval-item:hover,
    .file-item:hover,
    .diagnostic-item:hover {
      border-color: rgba(255, 103, 0, 0.3);
      box-shadow: 0 2px 8px rgba(255, 103, 0, 0.08), 0 4px 16px rgb(0 0 0 / 4%);
      transform: translateY(-1px);
    }
    .model-item strong,
    .approval-item strong,
    .diagnostic-item strong { font-size: 14px; color: var(--text); }
    .inline-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: var(--radius-pill);
      padding: 4px 10px;
      font-size: 12px;
      border: 1px solid var(--line);
      background: var(--bg-light);
      color: var(--text-dim);
      transition: transform 140ms cubic-bezier(0.4, 0, 0.2, 1), border-color 140ms cubic-bezier(0.4, 0, 0.2, 1), background 140ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 140ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .inline-status:hover {
      transform: scale(1.05);
      border-color: rgba(255, 103, 0, 0.3);
      box-shadow: 0 2px 8px rgba(255, 103, 0, 0.1);
    }
    .inline-status:active { transform: scale(0.97); }
    .inline-status.ok { color: var(--success); border-color: rgba(52, 199, 89, 0.3); background: rgba(52, 199, 89, 0.1); }
    .inline-status.warn { color: var(--warn); border-color: rgba(255, 149, 0, 0.3); background: rgba(255, 149, 0, 0.08); }
    .inline-status.error { color: var(--danger); border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.08); }
    .kv-list {
      display: grid;
      gap: 8px;
      font-size: 13px;
    }
    .kv-list div {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: center;
    }
    .kv-list span:first-child { color: var(--text-dim); }
    .approval-actions,
    .file-actions,
    .diagnostic-actions,
    .model-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .text-block {
      min-height: 80px;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--bg-light);
      padding: 14px;
      white-space: pre-wrap;
      overflow: auto;
      line-height: 1.6;
      color: var(--text-dim, #555555);
      transition: border-color 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .text-block:hover {
      border-color: rgba(255, 103, 0, 0.2);
      box-shadow: 0 4px 12px rgb(0 0 0 / 5%), 0 0 8px rgba(255, 103, 0, 0.04);
    }
    .drawer-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgb(0 0 0 / 50%);
      z-index: 70;
    }
    .drawer-backdrop.is-open { display: block; }
    .drawer {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: min(420px, 92vw);
      transform: translateX(105%);
      transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 80;
      border-left: 1px solid var(--line);
      background: var(--surface);
      box-shadow: -2px 0 8px rgb(0 0 0 / 4%), -8px 0 32px rgb(0 0 0 / 8%);
      padding: 20px;
      overflow: auto;
      display: grid;
      align-content: start;
      gap: 14px;
    }
    .drawer.is-open { transform: translateX(0); }
    .toast {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%);
      min-width: 260px;
      max-width: min(88vw, 560px);
      border-radius: var(--radius-pill);
      padding: 12px 18px;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--line);
      box-shadow: 0 4px 12px rgb(0 0 0 / 6%), 0 12px 32px rgb(0 0 0 / 8%);
      opacity: 0;
      pointer-events: none;
      transition: opacity 250ms cubic-bezier(0.4, 0, 0.2, 1), transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 90;
    }
    .toast.is-open { opacity: 1; transform: translateX(-50%) translateY(-4px); }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
    }
    @media (max-width: 1120px) {
      .app { grid-template-columns: 86px minmax(0, 1fr); }
      .sidebar { padding: 16px 10px; }
      .brand-copy, .sidebar-note { display: none; }
      .brand-title { font-size: 16px; }
      .nav-button { justify-content: center; text-align: center; padding: 0 6px; }
      .topbar { align-items: start; flex-direction: column; }
      .topbar-status { justify-content: flex-start; }
      .composer { grid-template-columns: 1fr; }
      .chat-conversation { width: min(100%, calc(100% - 24px)); }
      .message.user, .message.assistant, .message.system { width: min(100%, 100%); }
      .grid-two, .grid-three { grid-template-columns: 1fr; }
      .three-mode-candidate-grid { grid-template-columns: 1fr; }
      .chat-hero { grid-template-columns: 1fr; }
      .chat-badges { justify-content: flex-start; }
      .mission-radar, .mission-body, .showcase-layout, .owner-summary-grid, .owner-guidance-grid { grid-template-columns: 1fr; }
      .future-preview-grid, .future-details-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .mission-card-grid, .comparison-grid, .scenario-grid, .export-grid, .drilldown-grid, .tour-steps, .scenario-sample-task, .scenario-step-grid, .scenario-mode-explainer, .hardening-preview-grid, .codex-context-grid, .codex-context-preview-grid, .yiyi-settings-grid, .yiyi-setting-line-grid, .showcase-scenes { grid-template-columns: 1fr; }
      .scenario-trial-actions { justify-content: flex-start; min-width: 0; }
      .security-shield { order: 2; }
      .mission-workspace { order: 1; }
      .evidence-timeline { overflow-wrap: anywhere; }
      .comparison-footer { flex-direction: column; align-items: flex-start; }
      .yiyi-avatar-layer { grid-template-columns: 1fr; }
      .yiyi-concept-preview { grid-template-columns: 1fr; }
    }
    @media (max-width: 900px) {
      .future-os-hero, .future-preview-head, .future-details-head { flex-direction: column; align-items: flex-start; }
      .future-sample-bridge { grid-template-columns: 1fr; }
      .future-boundary-grid, .future-mode-grid, .future-preview-grid, .future-details-grid { grid-template-columns: 1fr; }
      .future-os-panel { min-height: auto; }
      .mission-input-row, .showcase-head, .owner-boss-head { flex-direction: column; align-items: flex-start; }
      .owner-boundary-pill { white-space: normal; }
      .tour-head, .drilldown-head { align-items: flex-start; }
      .comparison-footer span, .shield-summary span { white-space: normal; }
      .yiyi-avatar-layer { grid-template-columns: 1fr; }
      .yiyi-avatar-stage { min-height: 176px; }
      .yiyi-emotion-panel, .yiyi-character-card, .yiyi-character-settings, .yiyi-brain-panel, .yiyi-model-brain-panel { min-height: auto; }
      .yiyi-brain-grid { grid-template-columns: 1fr; }
      .showcase-actions { justify-content: flex-start; }
    }
    @media (max-width: 760px) {
      .app {
        grid-template-columns: minmax(0, 1fr);
        min-height: 100dvh;
      }
      .sidebar {
        position: sticky;
        top: 0;
        z-index: 20;
        grid-template-rows: auto auto;
        gap: 10px;
        padding: 12px;
        border-right: 0;
        border-bottom: 1px solid rgba(255, 103, 0, 0.1);
      }
      .brand-block { gap: 2px; }
      .nav-list {
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 6px;
      }
      .nav-button {
        min-height: 42px;
        padding: 0 4px;
        font-size: 14px;
        white-space: normal;
      }
      .main-shell {
        min-height: auto;
      }
      .topbar {
        padding: 14px;
        gap: 10px;
      }
      .topbar-status {
        width: 100%;
      }
      .status-chip {
        max-width: 100%;
        white-space: normal;
        overflow-wrap: anywhere;
      }
      .workspace {
        padding: 14px;
      }
      .mission-control, .owner-boss-view, .onboarding-tour, .drilldown-panel, .comparison-panel, .scenario-library, .evidence-export, .scenario-trial-panel, .scenario-dry-run-result, .long-horizon-hardening-panel, .codex-context-gateway-panel {
        border-radius: var(--radius-lg);
      }
      .owner-boss-head h2 { font-size: 22px; }
      .mission-radar h2 { font-size: 22px; }
      .mission-flow { gap: 6px; }
      .mission-flow span, .radar-grid span, .shield-list span, .comparison-footer span, .shield-summary span {
        width: 100%;
      }
      .yiyi-avatar-figure { transform: scale(0.92); }
      .yiyi-copy h3 { font-size: 22px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .mission-control::before, .yiyi-avatar-layer::before, .life-dot, .agent-orbit, .yiyi-aura, .yiyi-orbit {
        animation: none !important;
      }
      .yiyi-live-avatar-stage, .yiyi-live-body, .yiyi-live-figure, .yiyi-live-aura, .yiyi-live-orbit, .yiyi-live-cape, .hand-right {
        animation: none !important;
      }
    }
    body:has(#future-minimal-os-panel:target) {
      overflow: hidden;
      width: 100%;
      background:
        radial-gradient(circle at 28% 16%, rgba(255, 103, 0, 0.12), transparent 32%),
        radial-gradient(circle at 78% 22%, rgba(255, 103, 0, 0.08), transparent 30%),
        linear-gradient(135deg, #050b14 0%, #07111f 50%, #0b1524 100%);
    }
    body:has(#future-minimal-os-panel:target) .app {
      display: block;
      width: 100%;
      height: auto;
      min-height: 100dvh;
      overflow: hidden;
    }
    body:has(#future-minimal-os-panel:target) .sidebar,
    body:has(#future-minimal-os-panel:target) .topbar,
    body:has(#future-minimal-os-panel:target) .chat-hero,
    body:has(#future-minimal-os-panel:target) .chat-shell,
    body:has(#future-minimal-os-panel:target) .future-local-utility-strip,
    body:has(#future-minimal-os-panel:target) .future-advanced-system-details,
    body:has(#future-minimal-os-panel:target) .drawer-backdrop,
    body:has(#future-minimal-os-panel:target) .drawer,
    body:has(#future-minimal-os-panel:target) .toast {
      display: none !important;
    }
    body:has(#future-minimal-os-panel:target) .main-shell,
    body:has(#future-minimal-os-panel:target) .workspace,
    body:has(#future-minimal-os-panel:target) .chat-page,
    body:has(#future-minimal-os-panel:target) .mission-control {
      display: block;
      width: 100%;
      max-width: none;
      min-height: 100dvh;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      overflow: visible;
    }
    body:has(#future-minimal-os-panel:target) .workspace > .page:not([data-page="chat"]) {
      display: none !important;
    }
    body:has(#future-minimal-os-panel:target) .workspace > .page[data-page="chat"] {
      display: block !important;
      width: 100%;
      max-width: none;
      min-height: 100dvh;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      box-shadow: none;
      overflow: visible;
    }
    body:has(#future-minimal-os-panel:target) .mission-control {
      min-height: 100dvh;
    }
    body:has(#future-minimal-os-panel:target) .future-responsive-frame,
    body:has(#future-minimal-os-panel:target) .future-os-panel {
      width: 100%;
      min-height: 100dvh;
      border-radius: 0;
    }
    body:has(#future-minimal-os-panel:target) .future-os-panel {
      border: 0;
      box-shadow: none;
      scroll-margin-top: 0;
    }
    body:has(#future-minimal-os-panel:target) .future-os-content {
      min-height: 100dvh;
    }
    body:has(#future-minimal-os-panel:target) .future-first-screen {
      min-height: calc(100dvh - 96px);
      align-content: center;
    }
    body:has(#future-minimal-os-panel:target) .future-os-title-block {
      max-width: 760px;
    }
    body:has(#future-minimal-os-panel:target) .future-os-hero {
      max-width: 1440px;
      margin: 0 auto;
      width: 100%;
    }

    /* ══════════════════════════════════════════════
       Dashboard Workbench — Quantum Dark
       ══════════════════════════════════════════════ */
    .wb-greeting {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 0 0 4px;
    }
    .wb-greeting-text {
      display: flex;
      align-items: baseline;
      gap: 14px;
      flex-wrap: wrap;
      min-width: 0;
    }
    .wb-greeting-title {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: var(--text);
      letter-spacing: -0.01em;
      transition: color 150ms cubic-bezier(0.4, 0, 0.2, 1), transform 150ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .wb-greeting:hover .wb-greeting-title { color: var(--brand); transform: translateY(-1px); }
    .wb-greeting-summary {
      margin: 0;
      font-size: 13px;
      color: var(--text-dim);
      line-height: 1.4;
    }
    .wb-greeting-actions {
      flex-shrink: 0;
    }
    .wb-run-check-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 16px;
      border: none;
      border-radius: var(--radius-sm);
      background: var(--brand);
      color: var(--text-on-brand, #fff);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1), transform 0.1s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1);
      white-space: nowrap;
    }
    .wb-run-check-btn:hover {
      box-shadow: 0 0 20px rgba(255, 103, 0, 0.3);
      transform: translateY(-1px);
    }
    .wb-run-check-btn:active {
      transform: translateY(0);
    }
    .wb-run-check-btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.25);
    }
    .wb-run-check-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .wb-run-check-btn svg {
      flex-shrink: 0;
    }

    /* ── Metrics Grid ── */
    .wb-metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin: 12px 0 16px;
    }
    .wb-metric-card {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 14px 16px;
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: var(--radius-card);
      background: var(--bg-light);
      transition: border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }
    .wb-metric-card::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--brand), transparent);
      opacity: 0;
      transition: opacity 0.3s;
    }
    .wb-metric-card:hover {
      border-color: rgba(255, 103, 0, 0.25);
      box-shadow: 0 2px 8px rgba(255, 103, 0, 0.08), 0 8px 24px rgb(0 0 0 / 6%);
      transform: translateY(-2px);
    }
    .wb-metric-card:hover::before {
      opacity: 1;
    }
    .wb-metric-card:active { transform: translateY(0) scale(0.98); box-shadow: 0 1px 4px rgba(255, 103, 0, 0.06); }
    .wb-metric-card:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.2); border-color: var(--brand); }
    .wb-metric-card .wb-metric-label {
      font-size: 12px;
      color: var(--text-dim);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      transition: color 150ms cubic-bezier(0.4, 0, 0.2, 1), transform 150ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .wb-metric-card:hover .wb-metric-label { color: var(--brand); transform: scale(1.05); }
    .wb-metric-card .wb-metric-value {
      font-size: 28px;
      font-weight: 800;
      color: var(--text);
      line-height: 1.1;
    }
    .wb-metric-card .wb-metric-detail {
      font-size: 12px;
      color: var(--text-dim);
      line-height: 1.4;
    }
    .wb-metric-card[data-status="ok"] {
      border-color: rgba(52, 199, 89, 0.25);
    }
    .wb-metric-card[data-status="ok"]::before {
      background: linear-gradient(90deg, transparent, var(--success), transparent);
    }
    .wb-metric-card[data-status="ok"] .wb-metric-value {
      color: var(--success);
    }
    .wb-metric-card[data-status="warn"] {
      border-color: rgba(255, 149, 0, 0.25);
    }
    .wb-metric-card[data-status="warn"]::before {
      background: linear-gradient(90deg, transparent, var(--warn), transparent);
    }
    .wb-metric-card[data-status="warn"] .wb-metric-value {
      color: var(--warn);
    }
    .wb-metric-card[data-status="error"] {
      border-color: rgba(239, 68, 68, 0.25);
    }
    .wb-metric-card[data-status="error"]::before {
      background: linear-gradient(90deg, transparent, var(--danger), transparent);
    }
    .wb-metric-card[data-status="error"] .wb-metric-value {
      color: var(--danger);
    }
    .wb-advanced-panel {
      border: 1px solid rgba(255, 103, 0, 0.08);
      border-radius: var(--radius-card);
      background: var(--bg);
      padding: 14px;
      display: grid;
      gap: 10px;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .wb-advanced-panel:hover {
      transform: translateY(-1px);
      border-color: rgba(255, 103, 0, 0.22);
      box-shadow: 0 4px 14px rgb(0 0 0 / 8%), 0 0 8px rgba(255, 103, 0, 0.05);
    }
    .wb-advanced-panel:active { transform: translateY(0) scale(0.99); }
    .wb-advanced-panel summary {
      cursor: pointer;
      color: var(--brand);
      font-weight: 700;
      font-size: 13px;
    }
    .wb-signal-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .wb-signal-card {
      border: 1px solid rgba(255, 103, 0, 0.1);
      border-radius: var(--radius-sm);
      background: var(--bg);
      padding: 12px;
      display: grid;
      gap: 6px;
      transition: border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .wb-signal-card:hover {
      transform: translateY(-1px);
      border-color: rgba(255, 103, 0, 0.25);
      box-shadow: 0 4px 14px rgb(0 0 0 / 8%), 0 0 8px rgba(255, 103, 0, 0.06);
    }
    .wb-signal-card:active { transform: translateY(0) scale(0.98); }
    .wb-signal-card:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.2); border-color: var(--brand); }
    .wb-signal-card strong {
      font-size: 13px;
      color: var(--text);
    }
    .wb-signal-card p {
      margin: 0;
      color: var(--text-dim);
      font-size: 12px;
      line-height: 1.45;
    }
    .showcase-layout {
      display: grid;
      grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1fr);
      gap: 14px;
      align-items: start;
    }
    .showcase-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .showcase-head h2 {
      margin: 0;
      font-size: 24px;
      color: var(--text);
    }
    .showcase-head p {
      margin: 6px 0 0;
      color: var(--text-dim);
    }
    .showcase-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }
    .owner-boss-view strong {
      color: var(--text);
    }
    .owner-boss-view p, .owner-boss-view li, .owner-boss-view span {
      color: var(--text-dim);
    }

    /* ═══ Quantum Ring Progress ═══ */
    .wb-metric-ring-wrap {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 88px;
      height: 88px;
      margin: 6px auto 2px;
    }
    .wb-metric-ring {
      position: absolute;
      inset: 0;
      transform: rotate(-90deg);
    }
    .wb-ring-bg {
      fill: none;
      stroke: rgba(255, 103, 0, 0.08);
      stroke-width: 5;
    }
    .wb-ring-fg {
      fill: none;
      stroke: var(--brand);
      stroke-width: 5;
      stroke-linecap: round;
      transition: stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1),
                  stroke 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      filter: drop-shadow(0 0 6px rgba(255, 103, 0, 0.5));
    }
    .wb-metric-card[data-status="ok"] .wb-ring-fg { stroke: var(--success); filter: drop-shadow(0 0 6px rgba(52, 199, 89, 0.5)); }
    .wb-metric-card[data-status="warn"] .wb-ring-fg { stroke: var(--warn); filter: drop-shadow(0 0 6px rgba(255, 149, 0, 0.5)); }
    .wb-metric-card[data-status="error"] .wb-ring-fg { stroke: var(--danger); filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.5)); }
    .wb-metric-ring-wrap .wb-metric-value {
      position: relative;
      z-index: 1;
      font-size: 22px;
      font-weight: 800;
      text-align: center;
      letter-spacing: -0.02em;
    }

    /* ═══ Page transition ═══ */
    @keyframes quantum-fade-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .page.is-active {
      animation: quantum-fade-in 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }

    /* ══════════════════════════════════════════════
       v5 ConversationShell — Dark Space Glass
       ══════════════════════════════════════════════ */

    .v5-conversation-shell {
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 760px;
      margin: 0 auto;
      padding: 48px 24px 32px;
      min-height: calc(100dvh - 140px);
      position: relative;
      background: radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255, 103, 0, 0.015) 0%, transparent 60%);
    }

    /* ─── First Line (system greeting) ─── */
    .v5-first-line {
      text-align: center;
      margin-bottom: 56px;
      padding: 40px 24px;
      position: relative;
    }
    .v5-first-line::before {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 120%;
      height: 200%;
      background: radial-gradient(ellipse at center, rgba(255, 103, 0, 0.04) 0%, transparent 70%);
      pointer-events: none;
      z-index: 0;
    }
    .v5-first-text {
      position: relative;
      z-index: 1;
      font-size: 28px;
      font-weight: 700;
      color: var(--text);
      line-height: 1.5;
      letter-spacing: -0.03em;
      margin: 0;
      opacity: 0;
      animation: v5-fade-up 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.3s forwards;
      background: linear-gradient(135deg, #1a1a1a 0%, var(--brand) 50%, var(--text-dim) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      transition: filter 200ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: filter, transform;
    }
    .v5-first-line:hover .v5-first-text { filter: drop-shadow(0 6px 12px rgba(255, 103, 0, 0.2)); transform: scale(1.02); }
    .v5-first-text[data-tone="error"] { color: var(--warn); }
    .v5-first-text[data-tone="offline"] { color: var(--muted); }

    @keyframes v5-fade-up {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ─── Reply Field (conversation area + input) ─── */
    .v5-reply-field {
      display: flex;
      flex-direction: column;
      flex: 1;
      width: 100%;
      min-height: 0;
    }

    .v5-conversation {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scroll-behavior: smooth;
      min-height: 120px;
      max-height: calc(100dvh - 380px);
    }

    /* ─── Bubbles ─── */
    .v5-bubble {
      display: flex;
      flex-direction: column;
      max-width: 85%;
      animation: v5-bubble-in 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform, opacity;
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .v5-bubble:hover {
      transform: translateY(-1px);
    }
    @keyframes v5-bubble-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .v5-bubble-user {
      align-self: flex-end;
    }
    .v5-bubble-user .v5-bubble-body {
      background: linear-gradient(135deg, #ff8c3a 0%, #ff7a1a 40%, #ff5c00 100%);
      border: none;
      border-radius: 18px 18px 4px 18px;
      color: var(--text-on-brand, #ffffff);
      padding: 10px 16px;
      font-size: 15px;
      line-height: 1.55;
      word-break: break-word;
      box-shadow: 0 2px 8px rgba(255, 103, 0, 0.2), 0 1px 2px rgba(255, 103, 0, 0.1);
      position: relative;
      overflow: hidden;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .v5-bubble-user .v5-bubble-body:hover {
      transform: scale(1.01);
      box-shadow: 0 4px 14px rgba(255, 103, 0, 0.28), 0 2px 4px rgba(255, 103, 0, 0.15);
    }
    .v5-bubble-user .v5-bubble-body:active {
      transform: scale(0.99);
    }
    .v5-bubble-user .v5-bubble-body::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 50%;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, transparent 100%);
      pointer-events: none;
    }
    .v5-bubble-user .v5-bubble-label {
      color: var(--brand);
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 3px;
      text-align: right;
      padding-right: 4px;
    }

    .v5-bubble-assistant,
    .v5-bubble-system {
      align-self: flex-start;
    }
    .v5-bubble-assistant .v5-bubble-body,
    .v5-bubble-system .v5-bubble-body {
      background: var(--bg);
      border: 1px solid var(--line, #e8e8e8);
      border-radius: 18px 18px 18px 4px;
      color: var(--text);
      padding: 10px 16px;
      font-size: 15px;
      line-height: 1.5;
      word-break: break-word;
      box-shadow: 0 1px 3px rgb(0 0 0 / 4%);
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .v5-bubble-assistant .v5-bubble-body:hover,
    .v5-bubble-system .v5-bubble-body:hover {
      border-color: rgba(255, 103, 0, 0.2);
      box-shadow: 0 3px 10px rgb(0 0 0 / 7%), 0 0 6px rgba(255, 103, 0, 0.05);
      transform: translateY(-1px);
    }
    .v5-bubble-assistant .v5-bubble-body:active,
    .v5-bubble-system .v5-bubble-body:active {
      transform: translateY(0) scale(0.995);
    }
    .v5-bubble-assistant .v5-bubble-label,
    .v5-bubble-system .v5-bubble-label {
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 3px;
      padding-left: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .v5-bubble-assistant .v5-bubble-label::before {
      content: "";
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--brand);
      opacity: 0.6;
      box-shadow: 0 0 4px rgba(255, 103, 0, 0.3);
      flex-shrink: 0;
    }
    .v5-bubble-system .v5-bubble-body {
      border-color: rgba(255, 149, 0, 0.2);
      border-left: 3px solid rgba(255, 149, 0, 0.3);
      color: var(--text-dim);
    }

    /* ─── Typing indicator ─── */
    .v5-dots {
      display: flex;
      gap: 5px;
      padding: 4px 0;
      align-items: center;
    }
    .v5-dots span {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--brand);
      opacity: 0.5;
      animation: v5-dot-wave 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      will-change: transform, opacity;
      box-shadow: 0 0 6px rgba(255, 103, 0, 0.3);
    }
    .v5-dots span:nth-child(1) { animation-delay: 0s; }
    .v5-dots span:nth-child(2) { animation-delay: 0.15s; }
    .v5-dots span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes v5-dot-wave {
      0%, 100% { opacity: 0.4; transform: translateY(0) scale(0.9); }
      50% { opacity: 1; transform: translateY(-4px) scale(1.15); }
    }

    /* ─── Input bar ─── */
    .v5-input-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 10px 10px 18px;
      background: #fff;
      border: 1px solid var(--line, #e8e8e8);
      border-radius: 26px;
      margin-top: 8px;
      transition: border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 12px rgb(0 0 0 / 6%), 0 10px 24px rgb(0 0 0 / 5%), inset 0 1px 0 rgba(255, 255, 255, 0.8), inset 0 -1px 0 rgba(0, 0, 0, 0.04);
    }
    .v5-input-bar:hover:not(:focus-within) {
      border-color: rgba(255, 103, 0, 0.2);
      box-shadow: 0 6px 16px rgb(0 0 0 / 8%), 0 12px 28px rgb(0 0 0 / 6%), inset 0 1px 0 rgba(255, 255, 255, 0.9), inset 0 -1px 0 rgba(0, 0, 0, 0.03);
      transform: translateY(-1px);
    }
    .v5-input-bar:focus-within {
      border-color: var(--brand);
      box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.15), 0 4px 16px rgba(255, 103, 0, 0.12), 0 8px 24px rgba(255, 103, 0, 0.08), inset 0 1px 2px rgba(255, 103, 0, 0.06);
      background: #fff;
    }

    .v5-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: var(--text);
      font-size: 15px;
      font-family: inherit;
      padding: 10px 4px 10px 0;
      caret-color: var(--brand);
    }
    .v5-input::placeholder {
      color: var(--text-dim);
      opacity: 0.5;
      transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .v5-input-bar:focus-within .v5-input::placeholder {
      opacity: 0.3;
    }
    .v5-input:disabled {
      opacity: 0.5;
    }

    .v5-send-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, #ff8c3a 0%, var(--brand) 50%, #e55500 100%);
      color: var(--text-on-brand, #ffffff);
      cursor: pointer;
      flex-shrink: 0;
      margin-left: 4px;
      transition: background 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), filter 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
      box-shadow: 0 3px 10px rgba(255, 103, 0, 0.3), 0 1px 3px rgba(255, 103, 0, 0.2);
      position: relative;
      overflow: hidden;
      animation: v5-send-pulse 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }
    .v5-send-btn::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 50%;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, transparent 100%);
      pointer-events: none;
    }
    .v5-send-btn:hover:not(:disabled) {
      background: linear-gradient(135deg, #ff9a4d 0%, var(--brand-hover, #e55500) 50%, #cc4a00 100%);
      transform: scale(1.12) rotate(-10deg);
      box-shadow: 0 6px 20px rgba(255, 103, 0, 0.5), 0 2px 6px rgba(255, 103, 0, 0.3);
      animation: none;
    }
    .v5-send-btn:active:not(:disabled) {
      transform: scale(0.9) rotate(0deg);
      box-shadow: 0 1px 4px rgba(255, 103, 0, 0.2);
      animation: none;
    }
    .v5-send-btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.35), 0 3px 10px rgba(255, 103, 0, 0.3);
    }
    .v5-send-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
      box-shadow: none;
      filter: grayscale(0.5);
      animation: none;
    }
    @keyframes v5-send-pulse {
      0%, 100% { box-shadow: 0 3px 10px rgba(255, 103, 0, 0.3), 0 1px 3px rgba(255, 103, 0, 0.2); }
      50% { box-shadow: 0 3px 14px rgba(255, 103, 0, 0.45), 0 1px 3px rgba(255, 103, 0, 0.25); }
    }

    /* ─── Suggestion Chips ─── */
    .v5-suggestion-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: center;
      padding: 32px 0 16px;
      opacity: 0;
      animation: v5-fade-up 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.5s forwards;
      position: relative;
    }
    .v5-suggestion-chips::before {
      content: "";
      position: absolute;
      top: 0;
      left: 15%;
      right: 15%;
      height: 0.5px;
      background: linear-gradient(90deg, transparent 0%, var(--line) 15%, rgba(255, 103, 0, 0.12) 50%, var(--line) 85%, transparent 100%);
      opacity: 0.8;
    }

    .v5-chip {
      padding: 8px 18px;
      border-radius: var(--radius-xl);
      border: 1px solid var(--line, #e8e8e8);
      border-left: 3px solid rgba(255, 103, 0, 0.2);
      background: linear-gradient(180deg, var(--surface) 0%, var(--bg-light, #f8f8f8) 100%);
      color: var(--text-dim);
      font-size: 13px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1), font-weight 0.15s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
      position: relative;
      overflow: hidden;
    }
    .v5-chip::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 50%;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.6) 0%, transparent 100%);
      pointer-events: none;
    }
    .v5-chip:hover {
      border-color: rgba(255, 103, 0, 0.35);
      border-left-color: var(--brand);
      border-left-width: 4px;
      color: var(--brand);
      font-weight: 600;
      background: linear-gradient(180deg, #fff7ed 0%, rgba(255, 103, 0, 0.1) 100%);
      transform: translateY(-3px) scale(1.03);
      box-shadow: 0 6px 18px rgba(255, 103, 0, 0.2);
    }
    .v5-chip:active {
      transform: translateY(0) scale(0.95);
      box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
    }
    .v5-chip:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.22);
      border-color: var(--brand);
    }

    /* ─── More Button ─── */
    .v5-more-button {
      margin-top: 24px;
      padding: 8px 20px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--text-dim);
      font-size: 13px;
      font-family: inherit;
      cursor: pointer;
      border-radius: var(--radius-pill);
      transition: color 0.2s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .v5-more-button:hover {
      color: var(--brand);
      background: rgba(255, 103, 0, 0.08);
      border-color: rgba(255, 103, 0, 0.25);
      transform: translateY(-1px);
      box-shadow: 0 2px 6px rgba(255, 103, 0, 0.1);
    }
    .v5-more-button:active {
      transform: scale(0.96);
    }
    .v5-more-button:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.15);
    }

    /* ─── More Drawer ─── */
    .v5-more-drawer {
      width: 96vw;
      margin-top: 12px;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      overflow: hidden;
      transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      max-height: 0;
      opacity: 0;
      box-shadow: 0 2px 8px rgb(0 0 0 / 4%), 0 8px 24px rgb(0 0 0 / 6%);
      position: relative;
    }
    .v5-more-drawer::before {
      content: "";
      position: absolute;
      top: 0;
      left: 20%;
      right: 20%;
      height: 2px;
      background: linear-gradient(90deg, transparent 0%, rgba(255, 103, 0, 0.2) 50%, transparent 100%);
      z-index: 1;
      opacity: 0;
      transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .v5-more-drawer.is-open::before {
      opacity: 1;
    }
    .v5-more-drawer.is-open {
      max-height: calc(100dvh - 200px);
      opacity: 1;
    }
    .v5-more-drawer[hidden] {
      display: none;
    }

    .v5-drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      border-bottom: 1px solid var(--line);
      color: var(--text-dim);
      font-size: 14px;
      font-weight: 600;
      background: linear-gradient(180deg, var(--surface) 0%, var(--bg-light) 100%);
      position: relative;
    }
    .v5-drawer-header::after {
      content: "";
      position: absolute;
      bottom: 0;
      left: 10%;
      right: 10%;
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, rgba(255, 103, 0, 0.15) 50%, transparent 100%);
    }
    .v5-drawer-close {
      padding: 4px 12px;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--muted);
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .v5-drawer-close:hover {
      border-color: var(--brand);
      color: var(--brand);
      background: rgba(255, 103, 0, 0.06);
      transform: translateY(-1px);
      box-shadow: 0 2px 6px rgba(255, 103, 0, 0.12);
    }
    .v5-drawer-close:active {
      transform: scale(0.95);
    }
    .v5-drawer-close:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.18);
      border-color: var(--brand);
    }

    .v5-drawer-body {
      padding: 16px 20px;
      max-height: calc(100dvh - 280px);
      overflow-y: auto;
      scroll-behavior: smooth;
    }
    .v5-drawer-body::-webkit-scrollbar {
      width: 6px;
    }
    .v5-drawer-body::-webkit-scrollbar-track {
      background: transparent;
    }
    .v5-drawer-body::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 3px;
      transition: background 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .v5-drawer-body::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 103, 0, 0.4);
    }
    /* Contain MissionControlPanel layout inside drawer */
    .v5-drawer-body .mission-control {
      max-width: 100%;
      overflow-x: hidden;
    }
    .v5-drawer-body .mission-body {
      flex-direction: column;
    }
    .v5-drawer-body .mission-card-grid {
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }
    .v5-drawer-body .comparison-grid {
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }

    .v5-drawer-placeholder {
      color: var(--muted);
      font-size: 14px;
      text-align: center;
      padding: 24px 0;
      letter-spacing: 0.02em;
      position: relative;
      transition: color 150ms cubic-bezier(0.4, 0, 0.2, 1), transform 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .v5-drawer-body:hover .v5-drawer-placeholder { color: var(--brand); transform: translateY(-1px); }
    .v5-drawer-placeholder::after {
      content: "";
      display: block;
      margin: 16px auto 0;
      width: 40%;
      height: 0.5px;
      background: linear-gradient(90deg, transparent 0%, rgba(255, 103, 0, 0.12) 50%, transparent 100%);
    }

    /* ─── Conversation scrollbar ─── */
    .v5-conversation::-webkit-scrollbar {
      width: 5px;
    }
    .v5-conversation::-webkit-scrollbar-track {
      background: transparent;
    }
    .v5-conversation::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.15);
      border-radius: 3px;
      transition: background 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .v5-conversation::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 103, 0, 0.4);
    }

    /* ══ Card Transition Engine (spec §6.2) ══ */
    .card-transition-overlay {
      position: fixed;
      z-index: 9999;
      pointer-events: none;
      border-radius: var(--radius-lg);
      background: var(--surface);
      box-shadow: 0 8px 32px rgb(0 0 0 / 12%);
      transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1), width 300ms cubic-bezier(0.4, 0, 0.2, 1), height 300ms cubic-bezier(0.4, 0, 0.2, 1), top 300ms cubic-bezier(0.4, 0, 0.2, 1), left 300ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 300ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform, width, height, top, left, border-radius;
    }
    .card-transition-overlay.is-expanding {
      border-radius: 0;
    }
    .card-transition-content {
      opacity: 0;
      transition: opacity 200ms cubic-bezier(0.4, 0, 0.2, 1) 100ms;
    }
    .card-transition-overlay.is-expanded .card-transition-content {
      opacity: 1;
    }

    /* ══ More Drawer Card Grid (spec §7) ══ */
    .v5-drawer-card-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      padding: 8px 0;
    }
    .v5-drawer-card {
      display: grid;
      gap: 8px;
      padding: 16px;
      border: 1px solid var(--line, #e8e8e8);
      border-radius: var(--radius-lg);
      background: var(--surface);
      cursor: pointer;
      transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1);
      text-align: center;
      will-change: transform;
    }
    .v5-drawer-card:hover {
      border-color: var(--brand);
      box-shadow: 0 4px 16px rgb(255 103 0 / 10%), 0 0 24px rgba(255, 103, 0, 0.06);
      transform: translateY(-2px);
      background: linear-gradient(180deg, rgba(255, 103, 0, 0.03) 0%, var(--surface) 100%);
    }
    .v5-drawer-card:active { transform: translateY(0); }
    .v5-drawer-card:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.22), 0 4px 16px rgb(255 103 0 / 10%);
      border-color: var(--brand);
    }
    .v5-drawer-card-icon {
      font-size: 28px;
      margin: 0 auto;
    }
    .v5-drawer-card-label {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
    }
    .v5-drawer-card-desc {
      font-size: 12px;
      color: var(--text-dim);
      line-height: 1.4;
    }

    @media (max-width: 640px) {
      .v5-drawer-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    /* --- Tab Page Utilities --- */
    .tab-section-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
      font-weight: 700;
      color: var(--text);
      margin: 0 0 16px;
      padding-bottom: 10px;
      border-bottom: 2px solid transparent;
      border-image: linear-gradient(90deg, var(--brand) 0%, rgba(255, 103, 0, 0.2) 100%) 1;
    }
    .tab-section-title .tab-icon { font-size: 20px; }
    .tab-hero-card {
      border: 1px solid var(--line);
      border-radius: var(--radius-xl, 20px);
      background: linear-gradient(135deg, #ffffff 0%, #fafafa 60%, rgba(255, 103, 0, 0.02) 100%);
      padding: 20px 24px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 1px 4px rgb(0 0 0 / 3%), 0 4px 16px rgb(0 0 0 / 4%);
    }
    .tab-hero-card .hero-icon { font-size: 32px; flex-shrink: 0; }
    .tab-hero-card .hero-title { font-size: 18px; font-weight: 700; color: var(--text); margin: 0; }
    .tab-hero-card .hero-desc { font-size: 13px; color: var(--muted); margin: 4px 0 0; line-height: 1.55; }
    .tag-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: var(--radius-pill);
      font-size: 11px;
      font-weight: 600;
      border: 1px solid var(--line, #e8e8e8);
      background: var(--bg-light);
      color: var(--text-dim);
      transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .tag-pill:hover { transform: translateY(-1px); }
    .tag-pill:active { transform: translateY(0) scale(0.97); }
    .tag-pill:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.18); border-color: var(--brand); }
    .tag-pill.ok { color: var(--success); border-color: rgba(0,200,83,0.25); background: rgba(0,200,83,0.08); }
    .tag-pill.warn { color: var(--warn); border-color: rgba(245,158,11,0.25); background: rgba(245,158,11,0.08); }
    .tag-pill.error { color: var(--danger); border-color: rgba(239,68,68,0.25); background: rgba(239,68,68,0.08); }
    .tag-pill.brand { color: var(--brand); border-color: rgba(255,103,0,0.25); background: rgba(255,103,0,0.08); }

    /* --- v5 Panel Components --- */
    .v5-panel { padding: 0; }
    .v5-panel-header {
      display: flex; align-items: center; gap: 12px;
      padding: 20px 24px 16px; border-bottom: 1px solid var(--line, #eee);
      position: relative;
    }
    .v5-panel-header::after {
      content: "";
      position: absolute;
      bottom: 0;
      left: 15%;
      right: 15%;
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, rgba(255, 103, 0, 0.18) 50%, transparent 100%);
    }
    .v5-panel-title { font-size: 20px; font-weight: 700; color: var(--text, #1a1a1a); margin: 0; letter-spacing: 0.01em; }
    .v5-panel-subtitle { font-size: 13px; color: var(--muted, #888888); }
    .v5-panel-badge {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 22px; height: 22px; padding: 0 6px; border-radius: 11px;
      background: var(--brand); color: var(--text-on-brand, #fff); font-size: 12px; font-weight: 600;
    }
    .v5-panel-body { padding: 20px 24px; }

    /* Card Grids */
    .v5-card-grid { display: grid; gap: 16px; margin-bottom: 24px; }
    .v5-card-grid-2 { grid-template-columns: repeat(2, 1fr); }
    .v5-card-grid-3 { grid-template-columns: repeat(3, 1fr); }
    .v5-card-grid-4 { grid-template-columns: repeat(4, 1fr); }
    @media (max-width: 768px) {
      .v5-card-grid-3, .v5-card-grid-4 { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 480px) {
      .v5-card-grid-2, .v5-card-grid-3, .v5-card-grid-4 { grid-template-columns: 1fr; }
    }

    /* Info Card */
    .v5-info-card {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 16px; border-radius: var(--radius-sm); background: var(--bg-light);
      border: 1px solid var(--line, #eee); border-left: 3px solid rgba(255, 103, 0, 0.15);
      transition: background 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .v5-info-card:hover {
      background: #fff7f0;
      border-color: rgba(255, 103, 0, 0.25);
      border-left-color: var(--brand);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(255, 103, 0, 0.1);
    }
    .v5-info-card:active { transform: translateY(0) scale(0.98); box-shadow: 0 1px 3px rgb(0 0 0 / 4%); }
    .v5-info-card-icon { font-size: 24px; flex-shrink: 0; }
    .v5-info-card-content { flex: 1; min-width: 0; }
    .v5-info-card-label { font-size: 12px; color: var(--muted); margin: 0 0 4px; font-weight: 500; }
    .v5-info-card-value { font-size: 16px; font-weight: 600; color: var(--text); margin: 0; }

    /* Stat Card */
    .v5-stat-card {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 20px 16px; border-radius: var(--radius-sm); background: var(--bg-light);
      border: 1px solid var(--line, #eee); text-align: center;
      transition: background 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
      position: relative;
      overflow: hidden;
    }
    .v5-stat-card::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--brand) 0%, rgba(255, 103, 0, 0.5) 100%);
      opacity: 0.7;
    }
    .v5-stat-card:hover {
      background: #fff3eb;
      border-color: rgba(255, 103, 0, 0.28);
      transform: translateY(-2px);
      box-shadow: var(--shadow-hover);
    }
    .v5-stat-card:active {
      transform: translateY(0) scale(0.98);
      box-shadow: var(--shadow);
    }
    .v5-stat-card:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.22);
      border-color: var(--brand);
    }
    .v5-stat-number { font-size: 28px; font-weight: 700; color: var(--brand); }
    .v5-stat-label { font-size: 12px; color: var(--muted); font-weight: 500; }

    /* Metric Card */
    .v5-metric-card {
      display: flex; align-items: center; gap: 12px;
      padding: 16px; border-radius: var(--radius-sm); background: var(--bg-light);
      border: 1px solid var(--line, #eee);
      transition: background 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }
    .v5-metric-card:hover { background: #fff7f0; border-color: rgba(255, 103, 0, 0.22); }
    .v5-metric-card:active { transform: translateY(0) scale(0.98); box-shadow: 0 1px 4px rgb(0 0 0 / 4%); }
    .v5-metric-card:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.18); border-color: var(--brand); }
    .v5-metric-indicator { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 6px rgba(0,0,0,0.1); }
    .v5-indicator-ok { background: var(--success); box-shadow: 0 0 6px rgba(0,200,83,0.35); }
    .v5-indicator-warn { background: var(--warn); box-shadow: 0 0 6px rgba(245,158,11,0.35); }
    .v5-indicator-error { background: var(--danger); box-shadow: 0 0 6px rgba(239,68,68,0.35); }
    .v5-indicator-info { background: var(--brand); box-shadow: 0 0 6px rgba(255,103,0,0.35); }
    .v5-metric-content { flex: 1; }
    .v5-metric-label { font-size: 12px; color: var(--muted); margin: 0 0 2px; font-weight: 500; }
    .v5-metric-value { font-size: 15px; font-weight: 600; color: var(--text); margin: 0; }

    /* Tool Grid */
    .v5-tool-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    @media (max-width: 768px) { .v5-tool-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px) { .v5-tool-grid { grid-template-columns: 1fr; } }
    .v5-tool-card {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 24px 16px; border-radius: var(--radius-sm); background: var(--bg-light);
      border: 1px solid var(--line, #eee); cursor: pointer; text-align: center;
      transition: background 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
      position: relative;
      overflow: hidden;
    }
    .v5-tool-card::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 50%;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.5) 0%, transparent 100%);
      pointer-events: none;
    }
    .v5-tool-card:hover { background: #fff3eb; border-color: var(--brand); transform: translateY(-2px); box-shadow: var(--shadow-hover); }
    .v5-tool-card:active { transform: translateY(0); }
    .v5-tool-card:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.22); border-color: var(--brand); }
    .v5-tool-icon { font-size: 32px; transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
    .v5-tool-card:hover .v5-tool-icon { transform: scale(1.15); }
    .v5-tool-name { font-size: 14px; font-weight: 600; color: var(--text); margin: 0; }
    .v5-tool-desc { font-size: 12px; color: var(--muted); margin: 0; line-height: 1.4; }

    /* Sections */
    .v5-section { margin-bottom: 24px; }
    .v5-section-title {
      font-size: 14px; font-weight: 600; color: var(--text);
      margin: 0 0 12px; padding-bottom: 8px;
      position: relative;
    }
    .v5-section-title::after {
      content: "";
      position: absolute;
      bottom: 0;
      left: 0;
      width: 32px;
      height: 2px;
      border-radius: 1px;
      background: linear-gradient(90deg, var(--brand) 0%, rgba(255, 103, 0, 0.3) 100%);
    }
    .v5-section-desc { font-size: 12px; color: var(--muted); margin: 0 0 12px; line-height: 1.5; }

    /* Signal List */
    .v5-signal-list { list-style: none; padding: 0; margin: 0; }
    .v5-signal-item { display: flex; align-items: center; gap: 8px; padding: 8px 0; font-size: 13px; color: var(--text); }
    .v5-signal-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .v5-signal-ok .v5-signal-dot { background: var(--success); box-shadow: 0 0 6px rgba(0,200,83,0.4); }
    .v5-signal-warn .v5-signal-dot { background: var(--warn); box-shadow: 0 0 6px rgba(245,158,11,0.4); }
    .v5-signal-error .v5-signal-dot { background: var(--danger); box-shadow: 0 0 6px rgba(239,68,68,0.4); }

    /* Config Table */
    .v5-config-table { display: flex; flex-direction: column; gap: 0; }
    .v5-config-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-bottom: 1px solid var(--line); border-radius: 6px; transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1); position: relative; }
    .v5-config-row::before {
      content: "";
      position: absolute;
      left: 0;
      top: 20%;
      bottom: 20%;
      width: 3px;
      border-radius: 2px;
      background: var(--brand);
      opacity: 0;
      transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .v5-config-row:hover { background: rgba(255, 103, 0, 0.04); transform: translateX(2px); }
    .v5-config-row:hover::before { opacity: 0.6; }
    .v5-config-row:last-child { border-bottom: none; }
    .v5-config-key { font-size: 13px; color: var(--muted); }
    .v5-config-val { font-size: 13px; font-weight: 500; color: var(--text); }

    /* Service List */
    .v5-service-list { display: flex; flex-direction: column; gap: 0; }
    .v5-service-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--line); }
    .v5-service-row:last-child { border-bottom: none; }
    .v5-service-name { font-size: 13px; color: var(--text); }
    .v5-service-status { font-size: 12px; font-weight: 500; }
    .v5-status-ok { color: var(--success); }
    .v5-status-warn { color: var(--warn); }
    .v5-status-error { color: var(--danger); }

    /* Capability List */
    .v5-capability-list { display: flex; flex-direction: column; gap: 0; }
    .v5-capability-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--line); }
    .v5-capability-item:last-child { border-bottom: none; }
    .v5-capability-name { font-size: 13px; color: var(--text); }
    .v5-capability-status { font-size: 12px; color: var(--muted); }

    /* Pyramid */
    .v5-pyramid { display: flex; flex-direction: column; gap: 6px; }
    .v5-pyramid-level { display: flex; align-items: center; gap: 12px; padding: 6px 0; }
    .v5-pyramid-label { font-size: 12px; color: var(--muted); width: 80px; flex-shrink: 0; }
    .v5-pyramid-bar { flex: 1; height: 8px; border-radius: 4px; background: linear-gradient(90deg, var(--line, #eee) 0%, rgba(255, 103, 0, 0.08) 100%); position: relative; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.06); }
    .v5-pyramid-bar::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 50%;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, transparent 100%);
      pointer-events: none;
    }

    /* Preference List */
    .v5-preference-list { display: flex; flex-direction: column; gap: 0; }
    .v5-preference-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--line); }
    .v5-preference-item:last-child { border-bottom: none; }
    .v5-preference-label { font-size: 13px; color: var(--text); }
    .v5-preference-value { font-size: 13px; font-weight: 500; color: var(--brand); }

    /* Tag List */
    .v5-tag-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .v5-tag { display: inline-block; padding: 4px 10px; border-radius: var(--radius-pill, 999px); background: var(--bg-light, #f5f5f5); font-size: 12px; color: var(--text-dim, #666666); border: 1px solid var(--line, #eee); transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1); }
    .v5-tag:hover { background: rgba(255, 103, 0, 0.06); border-color: rgba(255, 103, 0, 0.2); transform: translateY(-1px); box-shadow: 0 2px 6px rgba(255, 103, 0, 0.08); }
    .v5-tag:active { transform: scale(0.97); }
    .v5-tag:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.18); border-color: var(--brand); }

    /* Activity List */
    .v5-activity-list { list-style: none; padding: 0; margin: 0; }
    .v5-activity-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; font-size: 13px; color: var(--text); border-bottom: 1px solid var(--line); transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1); }
    .v5-activity-item:hover { background: rgba(255, 103, 0, 0.03); }
    .v5-activity-item:last-child { border-bottom: none; }
    .v5-activity-time { font-size: 11px; color: var(--muted); flex-shrink: 0; width: 48px; }

    /* History List */
    .v5-history-list { list-style: none; padding: 0; margin: 0; }
    .v5-history-item { display: flex; align-items: center; gap: 8px; padding: 10px 12px; font-size: 13px; color: var(--text); border-radius: var(--radius-sm, 8px); transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1); position: relative; }
    .v5-history-item::before {
      content: "";
      position: absolute;
      left: 0;
      top: 15%;
      bottom: 15%;
      width: 3px;
      border-radius: 2px;
      background: var(--brand);
      opacity: 0;
      transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .v5-history-item:hover { background: rgba(255, 103, 0, 0.04); transform: translateX(2px); }
    .v5-history-item:hover::before { opacity: 0.6; }
    .v5-history-status { font-size: 14px; }
    .v5-status-done { color: var(--success); }

    /* Empty State */
    .v5-empty-state {
      text-align: center;
      padding: 48px 24px;
      color: var(--muted, #aaa);
      font-size: 14px;
      line-height: 1.7;
      opacity: 0;
      animation: v5-fade-in 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.5s forwards;
      position: relative;
    }
    .v5-empty-state::before {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 140%;
      height: 160%;
      background: radial-gradient(ellipse at center, rgba(255, 103, 0, 0.025) 0%, transparent 65%);
      pointer-events: none;
      z-index: 0;
    }
    .v5-empty-state::after {
      content: "";
      display: block;
      margin: 20px auto 0;
      width: 48px;
      height: 3px;
      border-radius: 2px;
      background: linear-gradient(90deg, transparent 0%, rgba(255, 103, 0, 0.2) 50%, transparent 100%);
    }
    .v5-empty-state > * { position: relative; z-index: 1; }
    @keyframes v5-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* Summary Text */
    .v5-summary-text { font-size: 13px; color: var(--text-dim); line-height: 1.65; margin: 0; }

    /* Model List */
    .v5-model-list { display: flex; flex-direction: column; gap: 8px; }

    /* Card Transition Close Button */
    .card-transition-close:hover { background: rgba(0,0,0,0.08) !important; }
    .card-transition-overlay .v5-panel { padding: 0; }
    .card-transition-overlay .v5-panel-header { position: sticky; top: 0; background: var(--surface, #fff); z-index: 5; border-bottom: 1px solid var(--line, #eee); }

    /* Panel Store (hidden) */
    .v5-panel-store { display: none; }

`;
