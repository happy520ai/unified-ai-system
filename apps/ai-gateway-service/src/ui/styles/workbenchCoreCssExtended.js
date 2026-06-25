/**
 * Workbench Core CSS (Extended) — Xiaomi HyperOS Light Theme
 * Extracted sections: nav-card, search, topbar status, utilities
 * Imported and concatenated by workbenchCoreCss.js
 */

export const workbenchCoreCssExtended = `
    /* ── Individual Nav Card ── */
    .nav-card {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 120px;
      height: 72px;
      border: 1px solid var(--line);
      border-radius: 12px;
      cursor: pointer;
      transition: border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
      background: var(--surface);
      color: var(--text-dim);
      font-family: inherit;
      padding: 0;
      min-height: unset;
      box-shadow: none;
    }

    .nav-card::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 12px;
      opacity: 0;
      transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 0;
      background: var(--surface-muted);
    }

    .nav-card:hover {
      border-color: rgba(255, 103, 0, 0.25);
      transform: translateY(-2px);
      box-shadow: 0 4px 14px rgba(255, 103, 0, 0.08), 0 2px 6px rgb(0 0 0 / 4%);
    }

    .nav-card:hover::before { opacity: 1; }

    .nav-card:hover .card-icon {
      color: var(--brand);
      opacity: 0.85;
    }

    .nav-card.is-active {
      border-color: var(--brand);
      color: var(--text);
      background: linear-gradient(180deg, #fffaf6 0%, #fff5ee 100%);
      box-shadow: 0 2px 12px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.7);
    }

    .nav-card.is-active::before { opacity: 0; }

    .nav-card.is-active::after {
      content: "";
      position: absolute;
      bottom: 0;
      left: 15%;
      right: 15%;
      height: 2.5px;
      background: var(--brand);
      border-radius: 2px 2px 0 0;
      z-index: 2;
      box-shadow: 0 -1px 6px var(--brand-glow);
    }

    /* Card content layers */
    .card-icon {
      position: relative;
      z-index: 1;
      width: 22px;
      height: 22px;
      flex-shrink: 0;
      opacity: 0.6;
    }

    .nav-card.is-active .card-icon {
      opacity: 1;
      color: var(--brand);
    }

    .card-label {
      position: relative;
      z-index: 1;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .nav-card.is-active .card-label {
      color: var(--text);
      font-weight: 700;
    }

    /* ── Global Search ── */
    .nav-search {
      position: relative;
      margin-left: auto;
      flex-shrink: 0;
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 14px;
      background: var(--surface-muted);
      border: 1px solid var(--line);
      border-radius: var(--radius-pill);
      width: 260px;
      transition: border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .search-box:focus-within {
      border-color: var(--brand);
      background: var(--surface);
      width: 340px;
      box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.1), 0 2px 16px var(--brand-glow);
    }

    .search-icon {
      width: 16px;
      height: 16px;
      color: var(--muted);
      flex-shrink: 0;
    }

    .search-input {
      flex: 1;
      border: none;
      background: transparent;
      color: var(--text);
      font-size: 13px;
      outline: none;
      font-family: inherit;
      padding: 0;
      min-height: unset;
      width: auto;
      box-shadow: none;
    }

    .search-input:focus {
      border: none;
      box-shadow: none;
    }

    .search-input::placeholder {
      color: var(--muted);
    }

    .search-kbd {
      font-size: 11px;
      padding: 2px 7px;
      border: 1px solid var(--line-bright);
      border-radius: 6px;
      color: var(--muted);
      background: var(--surface);
      font-family: inherit;
      flex-shrink: 0;
      box-shadow: 0 1px 0 var(--line);
    }

    .search-box:focus-within .search-kbd { display: none; }

    /* ── Search Dropdown ── */
    .search-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 420px;
      max-height: 480px;
      overflow-y: auto;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      box-shadow: 0 4px 12px rgb(0 0 0 / 6%), 0 16px 40px rgb(0 0 0 / 10%);
      z-index: 200;
    }

    .search-dropdown[hidden] { display: none; }

    .search-results { padding: 8px; }

    .search-group { padding: 4px 0; }

    .search-group-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      padding: 8px 12px 4px;
    }

    .search-result-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s cubic-bezier(0.4, 0, 0.2, 1), padding-left 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      color: var(--text-dim);
      font-size: 13px;
      border-left: 2px solid transparent;
    }

    .search-result-item:hover,
    .search-result-item.is-highlighted {
      background: rgba(255, 103, 0, 0.04);
      color: var(--text);
      border-left-color: var(--brand);
      padding-left: 14px;
    }

    .search-result-icon {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      background: var(--surface-muted);
      flex-shrink: 0;
    }

    .search-result-icon svg { width: 14px; height: 14px; }

    .search-result-meta {
      margin-left: auto;
      font-size: 11px;
      color: var(--muted);
    }

    .search-no-results {
      padding: 24px;
      text-align: center;
      color: var(--muted);
      font-size: 13px;
    }

    /* ── Topbar Status ── */
    .topbar-status {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: center;
      gap: 10px;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 20px;
      font-size: 12px;
      white-space: nowrap;
      transition: background-color 0.25s cubic-bezier(0.4, 0, 0.2, 1), color 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .status-pill:hover {
      border-color: var(--brand);
      box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.08), 0 2px 8px var(--brand-glow);
      transform: translateY(-1px);
    }

    .pill-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .pill-dot.green {
      background: var(--success);
      animation: pill-pulse 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }

    @keyframes pill-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(52, 199, 89, 0.45); }
      50% { box-shadow: 0 0 0 5px rgba(52, 199, 89, 0); }
    }

    .pill-dot.yellow {
      background: var(--warn);
    }

    .pill-dot.red {
      background: var(--danger);
    }

    .pill-dot.gray {
      background: var(--muted);
    }

    .pill-label {
      color: var(--text-dim);
      font-size: 11px;
      font-weight: 500;
    }

    .pill-value {
      color: var(--text);
      font-weight: 600;
      font-size: 12px;
    }

    .topbar-refresh {
      min-height: 34px;
      width: 34px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      color: var(--text-dim);
      transition: color 0.25s cubic-bezier(0.4, 0, 0.2, 1), background 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .topbar-refresh:hover {
      color: var(--brand);
      background: rgba(255, 103, 0, 0.06);
    }

    .topbar-refresh:hover svg {
      transform: rotate(180deg);
    }

    .topbar-refresh svg {
      transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .topbar-refresh:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(255, 103, 0, 0.2);
      border-color: var(--brand);
    }

    /* ── Responsive: shrink cards on narrower viewports ── */
    @media (max-width: 1200px) {
      .nav-card { width: 110px; height: 66px; }
      .search-box { width: 200px; }
      .search-box:focus-within { width: 260px; }
    }

    @media (max-width: 900px) {
      .nav-cards { overflow-x: auto; }
      .nav-card { width: 100px; height: 60px; }
      .card-label { font-size: 11px; }
      .brand-label { display: none; }
    }

    .mission-control {
      display: grid;
      gap: 16px;
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      background: var(--surface);
      box-shadow: 0 1px 4px rgb(0 0 0 / 4%), 0 4px 16px rgb(0 0 0 / 3%);
      padding: 20px;
      overflow: hidden;
      position: relative;
    }

    /* page animation managed by consolePageInlineCss (quantum-fade-in) */

    /* ── Spacing Utilities ── */
    .mt-sm { margin-top: 8px; }
    .mt-md { margin-top: 14px; }
    .mt-lg { margin-top: 20px; }
    .mb-sm { margin-bottom: 8px; }
    .mb-md { margin-bottom: 14px; }
    .mb-lg { margin-bottom: 20px; }

    .icon-spacer { margin-right: 8px; }
    .placeholder-text { color: var(--muted); }
    .loading-static { animation: none; color: var(--muted); }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    .skeleton {
      background: linear-gradient(90deg, #f2f2f2 25%, #ebebeb 50%, #f2f2f2 75%);
      background-size: 200% 100%;
      animation: shimmer 2s ease-in-out infinite;
      border-radius: var(--radius-sm);
      color: transparent;
      min-height: 16px;
    }

    .loading-text {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-size: 13px;
    }

    .loading-text::before {
      content: "";
      width: 16px;
      height: 16px;
      border: 2px solid var(--line);
      border-top-color: var(--brand);
      border-radius: 50%;
      animation: spin 0.65s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      flex-shrink: 0;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .empty-state {
      text-align: center;
      padding: 36px 24px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.65;
      background: linear-gradient(180deg, var(--bg-light) 0%, var(--surface) 100%);
      border: 1px dashed var(--line-bright);
      border-radius: var(--radius-md);
    }

    .empty-state-icon {
      font-size: 32px;
      display: block;
      margin-bottom: 10px;
      opacity: 0.45;
      filter: grayscale(0.3);
    }

    details > summary {
      cursor: pointer;
      list-style: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--brand);
      font-weight: 600;
      transition: color 0.2s ease, text-decoration-color 0.2s ease;
      text-decoration: underline transparent 1px;
      text-underline-offset: 3px;
    }

    details > summary::-webkit-details-marker { display: none; }

    details > summary::before {
      content: "\\25B6";
      font-size: 10px;
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      display: inline-block;
    }

    details[open] > summary::before {
      transform: rotate(90deg);
    }

    details > summary:hover {
      color: var(--brand-strong);
      text-decoration-color: var(--brand-strong);
    }

    button:disabled, button[disabled] {
      opacity: 0.45;
      cursor: not-allowed;
      transform: none !important;
      box-shadow: none !important;
    }
`;
