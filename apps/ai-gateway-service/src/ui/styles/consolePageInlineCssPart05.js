export const consolePageInlineCssPart05 = `      border-radius: 18px;
      background: linear-gradient(135deg, rgb(255 255 255 / 96%), #edf5ff);
      box-shadow: var(--shadow);
      padding: 18px 20px;
    }
    .chat-hero h2 { margin: 0; font-size: 22px; }
    .chat-hero p { margin: 8px 0 0; color: var(--muted); line-height: 1.6; }
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
      border: 1px solid var(--line);
      border-radius: 22px;
      background: rgb(255 255 255 / 94%);
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .chat-history {
      min-height: 0;
      overflow: auto;
      padding: 24px 0;
      background:
        radial-gradient(circle at top right, rgb(31 106 165 / 10%), transparent 34%),
        linear-gradient(180deg, #fbfdff, #f6f8fb 46%, #f2f5f8);
    }
    .chat-conversation {
      width: min(1080px, calc(100% - 48px));
      margin: 0 auto;
      display: grid;
      align-content: start;
      gap: 14px;
    }
    .message {
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 14px 16px;
      background: var(--surface);
      box-shadow: 0 8px 18px rgb(15 23 42 / 5%);
      line-height: 1.65;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .message-role {
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 8px;
      font-weight: 700;
    }
    .message.user {
      justify-self: end;
      width: min(54%, 720px);
      background: linear-gradient(135deg, #dbeeff, #eef6ff);
      border-color: #bfd8f2;
    }
    .message.assistant,
    .message.system {
      justify-self: start;
      width: min(76%, 880px);
    }
    .message.system {
      background: #fffdf7;
      border-color: #ecd7a6;
    }
    .message details {
      margin-top: 10px;
      border-top: 1px dashed var(--line);
      padding-top: 10px;
      color: var(--muted);
      font-size: 12px;
    }
    .message details summary { cursor: pointer; color: var(--brand-strong); }
    .composer-wrap {
      border-top: 1px solid var(--line);
      background: rgb(255 255 255 / 98%);
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
      color: var(--muted);
      font-weight: 700;
    }
    .composer-main textarea {
      min-height: 118px;
      max-height: 220px;
      padding: 14px;
      line-height: 1.6;
    }
    .composer-actions {
      display: grid;
      gap: 10px;
      align-self: stretch;
    }
    .three-mode-runtime {
      width: min(1080px, 100%);
      margin: 14px auto 0;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surface-muted);
      padding: 12px;
      display: grid;
      gap: 12px;
    }
    .three-mode-tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .three-mode-notice {
      border: 1px solid #ecd7a6;
      border-radius: 12px;
      background: #fffdf7;
      color: #7a5a00;
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
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surface);
      padding: 12px 14px;
      display: grid;
      gap: 8px;
    }
    .three-mode-candidate-card strong {
      font-size: 13px;
    }
    .three-mode-candidate-card ul {
      margin: 0;
      padding-left: 18px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.55;
    }
    .three-mode-tab {
      min-height: 36px;
    }
    .three-mode-tab.is-active {
      background: var(--brand);
      color: white;
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
    }
    .hint {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }
    .surface-muted {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surface-muted);
      padding: 12px 14px;
    }
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
      border-radius: 14px;
      background: var(--surface-muted);
      padding: 14px;
      display: grid;
      gap: 8px;
    }
    .model-item strong,
    .approval-item strong,
    .diagnostic-item strong { font-size: 14px; }
    .inline-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 12px;
      border: 1px solid var(--line);
      background: var(--surface);
      color: var(--muted);
    }
    .inline-status.ok { color: var(--success); border-color: rgb(25 122 66 / 28%); background: rgb(25 122 66 / 8%); }
    .inline-status.warn { color: var(--warn); border-color: rgb(148 98 0 / 24%); background: rgb(148 98 0 / 8%); }
    .inline-status.error { color: var(--danger); border-color: rgb(180 35 24 / 24%); background: rgb(180 35 24 / 8%); }
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
    .kv-list span:first-child { color: var(--muted); }
    .approval-actions,
    .file-actions,
    .diagnostic-actions,
    .model-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .text-block {
      min-height: 120px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surface-muted);
      padding: 14px;
      white-space: pre-wrap;
      overflow: auto;
      line-height: 1.6;
    }
    .drawer-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgb(15 23 42 / 30%);
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
      transition: transform 160ms ease;
      z-index: 80;
      border-left: 1px solid var(--line);
      background: rgb(255 255 255 / 98%);
      box-shadow: -14px 0 32px rgb(15 23 42 / 12%);
      padding: 18px;
      overflow: auto;
      display: grid;
      align-content: start;
      gap: 12px;
    }
    .drawer.is-open { transform: translateX(0); }
    .toast {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%);
      min-width: 260px;
      max-width: min(88vw, 560px);
      border-radius: 12px;
      padding: 12px 14px;
      background: #0f172a;
      color: #fff;
      box-shadow: 0 20px 48px rgb(15 23 42 / 22%);
      opacity: 0;
      pointer-events: none;
      transition: opacity 120ms ease;
      z-index: 90;
    }
    .toast.is-open { opacity: 1; }
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
        border-bottom: 1px solid rgb(255 255 255 / 12%);
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
        border-radius: 16px;
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
`;
