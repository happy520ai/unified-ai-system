/**
 * Workbench Core CSS — Xiaomi HyperOS Light Theme
 * Clean, minimal, warm light theme inspired by HyperOS design language
 *
 * Core file contains: variables, reset, base elements, app shell, nav bar, brand, main shell, page title.
 * Extended file (workbenchCoreCssExtended.js) contains: nav cards, search, responsive, topbar status, mission control, utilities.
 */

import { workbenchCoreCssExtended } from "./workbenchCoreCssExtended.js";

export const workbenchCoreCss = `
    :root {
      --bg: #f5f5f5;
      --bg-mid: #f0f0f0;
      --bg-light: #fafafa;
      --surface: #ffffff;
      --surface-muted: #f5f5f5;
      --line: #e8e8e8;
      --line-bright: #d9d9d9;
      --text: #1a1a1a;
      --text-dim: #666666;
      --muted: #888888;
      --brand: #ff6700;
      --brand-strong: #e55d00;
      --brand-glow: rgba(255, 103, 0, 0.15);
      --success: #34c759;
      --success-glow: rgba(52, 199, 89, 0.15);
      --danger: #ff3b30;
      --danger-glow: rgba(255, 59, 48, 0.15);
      --warn: #ff9500;
      --warn-glow: rgba(255, 149, 0, 0.15);
      --purple: #af52de;
      --purple-glow: rgba(175, 82, 222, 0.15);
      --shadow: 0 2px 12px rgb(0 0 0 / 8%);
      --shadow-lg: 0 8px 32px rgb(0 0 0 / 12%);
      --shadow-hover: 0 4px 16px rgb(0 0 0 / 10%);
      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-card: 14px;
      --radius-lg: 16px;
      --radius-xl: 20px;
      --radius-pill: 999px;
    }

    * { box-sizing: border-box; }

    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: "SF Pro Text", "PingFang SC", "Inter", "Segoe UI", "Microsoft YaHei", sans-serif;
      position: relative;
    }

    body { overflow-y: auto; overflow-x: hidden; }

    button, input, select, textarea { font: inherit; }

    button {
      min-height: 40px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--surface);
      color: var(--text);
      padding: 0 16px;
      cursor: pointer;
      transition: background-color 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms cubic-bezier(0.4, 0, 0.2, 1), color 200ms cubic-bezier(0.4, 0, 0.2, 1);
      font-weight: 500;
    }

    button:hover {
      border-color: var(--line-bright);
      box-shadow: 0 2px 8px rgb(0 0 0 / 6%);
      transform: translateY(-1px);
    }

    button:active { transform: translateY(0); box-shadow: 0 1px 2px rgb(0 0 0 / 4%); }

    button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible {
      outline: 2px solid var(--brand);
      outline-offset: 2px;
      box-shadow: 0 0 0 4px var(--brand-glow);
    }

    button.primary {
      background: linear-gradient(180deg, #ff7a1a 0%, #ff5c00 100%);
      color: #ffffff;
      border-color: #e55d00;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(255, 103, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15);
    }

    button.primary:hover {
      background: linear-gradient(180deg, #ff8533 0%, #ff6200 100%);
      border-color: #e55d00;
      box-shadow: 0 4px 16px rgba(255, 103, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15);
      transform: translateY(-1px);
    }

    button.primary:active {
      background: linear-gradient(180deg, #f06000 0%, #e55200 100%);
      box-shadow: 0 1px 4px rgba(255, 103, 0, 0.2), inset 0 1px 2px rgba(0, 0, 0, 0.1);
      transform: translateY(0);
    }

    button.ghost {
      background: transparent;
      border-color: var(--line);
    }

    button.ghost:hover {
      background: var(--surface-muted);
      border-color: var(--brand);
    }

    input, select, textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--surface);
      color: var(--text);
      padding: 10px 14px;
      transition: border-color 200ms ease, box-shadow 200ms ease, background-color 200ms ease;
    }

    input:focus, select:focus, textarea:focus {
      border-color: var(--brand);
      box-shadow: 0 0 0 4px var(--brand-glow), 0 1px 4px rgb(0 0 0 / 4%);
    }

    input::placeholder, textarea::placeholder {
      color: var(--muted);
    }

    textarea { resize: vertical; min-height: 110px; }

    /* ── App Shell: full-width flex column (no sidebar) ── */
    .app {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
      position: relative;
      z-index: 1;
    }

    /* ── Navigation Bar ── */
    .nav-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 28px;
      background: rgba(255, 255, 255, 0.88);
      backdrop-filter: saturate(180%) blur(12px);
      -webkit-backdrop-filter: saturate(180%) blur(12px);
      border-bottom: 1px solid var(--line);
      position: relative;
      z-index: 100;
      flex-shrink: 0;
    }

    .nav-bar::after {
      content: "";
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, var(--brand-glow) 30%, var(--brand-glow) 70%, transparent 100%);
      opacity: 0.6;
    }

    /* ── Brand ── */
    .nav-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
      margin-right: 6px;
    }

    .nav-brand .brand-logo {
      color: var(--brand);
      display: flex;
      align-items: center;
    }

    .brand-label {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.03em;
      color: var(--text);
      white-space: nowrap;
    }

    .brand-label::first-letter {
      color: var(--brand);
    }

    /* ── Main Shell (full width, no sidebar) ── */
    .main-shell {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    /* ── Page Title Strip ── */
    .page-title-strip {
      display: flex;
      align-items: baseline;
      gap: 12px;
      padding: 10px 24px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(180deg, var(--surface) 0%, var(--bg-light) 100%);
      flex-shrink: 0;
    }

    .page-title-strip h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: var(--text);
      letter-spacing: -0.01em;
      background: linear-gradient(135deg, var(--text) 0%, var(--text-dim) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .page-title-copy {
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.02em;
      transition: color 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .page-title-strip:hover .page-title-copy {
      color: var(--text-dim);
    }

` + workbenchCoreCssExtended;
