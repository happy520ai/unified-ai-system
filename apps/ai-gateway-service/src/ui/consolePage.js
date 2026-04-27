export function createConsolePage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PME 移动地球</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f8;
      --panel: #ffffff;
      --line: #d7dde3;
      --line-strong: #aeb8c2;
      --text: #161a1d;
      --muted: #65717c;
      --accent: #0f766e;
      --accent-soft: #e7f5f3;
      --danger: #b42318;
      --danger-soft: #fff2f0;
      --ok: #1b7447;
      --shadow: 0 18px 42px rgb(17 24 39 / 10%);
    }

    * { box-sizing: border-box; }
    body {
      min-height: 100vh;
      min-height: 100dvh;
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 15px/1.55 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow: hidden;
    }
    button, input, select, textarea { font: inherit; }
    button {
      min-height: 38px;
      border: 1px solid var(--line-strong);
      border-radius: 999px;
      background: var(--panel);
      color: var(--text);
      cursor: pointer;
      font-weight: 750;
      padding: 7px 14px;
      transition: border-color 120ms ease, background 120ms ease, color 120ms ease, opacity 120ms ease;
    }
    button:hover { border-color: var(--accent); background: var(--accent-soft); }
    button:disabled {
      cursor: not-allowed;
      opacity: 0.52;
    }
    .primary { border-color: var(--accent); background: var(--accent); color: #fff; }
    .primary:hover { background: #0b5f59; color: #fff; }
    .app {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      height: 100vh;
      height: 100dvh;
      min-height: 0;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px clamp(12px, 3vw, 26px);
      border-bottom: 1px solid var(--line);
      background: rgb(255 255 255 / 92%);
      backdrop-filter: blur(8px);
    }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 18px; }
    h2 { font-size: 17px; }
    .muted { color: var(--muted); }
    .topbar-actions {
      position: relative;
      align-items: flex-start;
      justify-content: flex-end;
    }
    .top-provider-details {
      position: relative;
    }
    .top-provider-details summary {
      display: inline-flex;
      align-items: center;
      min-height: 38px;
      border: 1px solid var(--line-strong);
      border-radius: 999px;
      padding: 7px 14px;
      background: #fff;
      color: var(--text);
      cursor: pointer;
      font-weight: 800;
      list-style: none;
      user-select: none;
      white-space: nowrap;
    }
    .top-provider-details summary::-webkit-details-marker { display: none; }
    .top-provider-details summary:hover,
    .top-provider-details[open] summary {
      border-color: var(--accent);
      background: var(--accent-soft);
    }
    .top-provider-content {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      z-index: 20;
      display: grid;
      gap: 7px;
      width: min(360px, calc(100vw - 32px));
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 10px;
      background: #fff;
      box-shadow: var(--shadow);
    }
    .top-provider-details:not([open]) .top-provider-content {
      display: none;
    }
    .top-provider-content label {
      color: var(--muted);
      font-size: 12px;
      font-weight: 850;
    }
    .top-provider-help {
      color: var(--muted);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .workspace {
      position: relative;
      display: grid;
      grid-template-columns: 1fr;
      min-height: 0;
      overflow: hidden;
      padding: 18px clamp(10px, 3vw, 28px);
    }
    .chat-shell {
      position: relative;
      display: grid;
      grid-template-rows: 1fr auto;
      width: min(980px, 100%);
      height: 100%;
      min-height: 0;
      margin: 0 auto;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: var(--panel);
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .chat-shell.dragover { outline: 3px solid rgb(15 118 110 / 30%); outline-offset: 4px; }
    .history {
      display: grid;
      align-content: start;
      gap: 14px;
      overflow: auto;
      padding: clamp(18px, 3vw, 30px);
      background: linear-gradient(180deg, #fff, #fbfcfd);
      scroll-behavior: smooth;
      overscroll-behavior: contain;
    }
    .welcome {
      display: grid;
      align-self: center;
      gap: 14px;
      width: min(720px, 100%);
      margin: clamp(24px, 8vh, 84px) auto 14px;
      text-align: center;
    }
    .welcome h2 {
      font-size: clamp(32px, 6vw, 56px);
      line-height: 1.06;
      letter-spacing: 0;
    }
    .welcome p {
      width: min(620px, 100%);
      margin: 0 auto;
      font-size: 16px;
    }
    .chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
    .chip { min-height: 34px; padding: 6px 11px; font-size: 13px; color: #46515c; }
    .quick-start {
      display: grid;
      gap: 8px;
      justify-self: center;
      width: min(560px, 100%);
      margin: 0 auto;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 8px 12px;
      color: var(--muted);
      background: #fbfcfd;
      font-size: 13px;
      text-align: left;
    }
    .quick-start summary {
      cursor: pointer;
      color: var(--text);
      font-weight: 850;
      text-align: center;
      list-style: none;
    }
    .quick-start summary::-webkit-details-marker { display: none; }
    .quick-start strong { color: var(--text); }
    .quick-start code { color: var(--text); }
    .quick-start ol {
      display: grid;
      gap: 4px;
      margin: 0;
      padding-left: 20px;
    }
    .first-run-guide {
      display: grid;
      gap: 10px;
      width: min(660px, 100%);
      margin: 2px auto 0;
      border: 1px solid #cfe5df;
      border-radius: 14px;
      padding: 12px;
      background: #f6fbfa;
      text-align: left;
    }
    .first-run-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      color: #17423e;
      font-weight: 900;
    }
    .first-run-badge {
      flex: 0 0 auto;
      border-radius: 999px;
      padding: 3px 9px;
      color: #0f766e;
      background: #dff4ef;
      font-size: 12px;
      font-weight: 900;
      white-space: nowrap;
    }
    .first-run-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .first-run-step {
      display: grid;
      gap: 5px;
      min-width: 0;
      border: 1px solid #dbe8e4;
      border-radius: 10px;
      padding: 9px;
      background: #fff;
      color: var(--muted);
      font-size: 12px;
    }
    .first-run-step strong {
      color: #17324d;
      font-size: 13px;
    }
    .first-run-step code {
      color: var(--text);
      overflow-wrap: anywhere;
    }
    .setup-wizard {
      display: grid;
      gap: 10px;
      width: min(760px, 100%);
      margin: 8px auto 0;
      border: 1px solid #d8e8e4;
      border-radius: 14px;
      padding: 12px;
      background: #ffffff;
      text-align: left;
    }
    .setup-wizard[data-phase="phase104a-first-run-setup"] {
      border-color: #bfe0da;
      box-shadow: 0 10px 22px rgb(15 118 110 / 6%);
    }
    .setup-wizard-header {
      display: grid;
      gap: 4px;
    }
    .setup-wizard-header strong {
      color: #17324d;
      font-size: 15px;
    }
    .setup-wizard-header span {
      color: var(--muted);
      font-size: 13px;
    }
    .setup-wizard-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .setup-wizard-step {
      display: grid;
      gap: 5px;
      min-width: 0;
      border: 1px solid #e1e9ef;
      border-radius: 10px;
      padding: 9px;
      background: #f8fbfc;
      color: var(--muted);
      font-size: 12px;
    }
    .setup-wizard-step strong {
      color: #17324d;
      font-size: 13px;
    }
    .setup-wizard-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .setup-readiness-output {
      min-height: 48px;
      max-height: 180px;
      margin: 0;
      border: 1px solid #e1e9ef;
      border-radius: 10px;
      padding: 9px;
      overflow: auto;
      background: #fbfcfd;
      color: #2b3b4d;
      font-size: 12px;
      white-space: pre-wrap;
    }
    .message {
      display: grid;
      gap: 8px;
      width: min(84%, 760px);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 11px 14px 12px;
      background: #fff;
      box-shadow: 0 8px 22px rgb(17 24 39 / 5%);
      white-space: pre-wrap;
    }
    .message-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-height: 18px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
      white-space: normal;
    }
    .message-meta time {
      font-size: 11px;
      font-weight: 750;
    }
    .message-text {
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .message.user .message-text,
    .message.system .message-text { white-space: pre-wrap; }
    .message-text p {
      margin: 0 0 8px;
      line-height: 1.64;
    }
    .message-text p:last-child,
    .message-text .md-list:last-child,
    .message-text .md-code-wrap:last-child,
    .message-text .md-blockquote:last-child,
    .message-text .md-table-wrap:last-child,
    .message-text .md-hr:last-child {
      margin-bottom: 0;
    }
    .md-list {
      margin: 0 0 8px;
      padding-left: 22px;
    }
    .md-list li {
      margin: 4px 0;
    }
    .md-code-wrap {
      margin: 8px 0;
      border: 1px solid #d8e0e8;
      border-radius: 8px;
      color: #e6edf5;
      background: #121826;
      overflow: hidden;
    }
    .md-code-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      padding: 7px 10px;
      color: #9fb0c5;
      font-size: 12px;
      font-weight: 800;
    }
    .md-code-copy {
      min-height: 26px;
      border-color: rgba(255, 255, 255, 0.18);
      padding: 3px 8px;
      color: #dce6f4;
      background: rgba(255, 255, 255, 0.08);
      font-size: 12px;
    }
    .md-code-block {
      margin: 0;
      padding: 10px 12px;
      overflow-x: auto;
      white-space: pre;
    }
    .md-code-block code {
      font-family: Consolas, "SFMono-Regular", Menlo, monospace;
      font-size: 13px;
    }
    .md-inline-code {
      border-radius: 5px;
      padding: 1px 5px;
      color: #15202f;
      background: #edf2f7;
      font-family: Consolas, "SFMono-Regular", Menlo, monospace;
      font-size: 0.92em;
    }
    .md-blockquote {
      margin: 8px 0;
      border-left: 4px solid var(--accent);
      border-radius: 0 8px 8px 0;
      padding: 8px 10px;
      color: #344054;
      background: #f6f9fc;
    }
    .md-blockquote p {
      margin: 0 0 6px;
    }
    .md-table-wrap {
      margin: 8px 0;
      overflow-x: auto;
      border: 1px solid #d8e0e8;
      border-radius: 8px;
      background: #fff;
    }
    .md-table {
      width: 100%;
      min-width: 420px;
      border-collapse: collapse;
      font-size: 13px;
      white-space: normal;
    }
    .md-table th,
    .md-table td {
      border-bottom: 1px solid #e4ebf2;
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }
    .md-table th {
      color: #253448;
      background: #f4f7fb;
      font-weight: 900;
    }
    .md-table tr:last-child td {
      border-bottom: 0;
    }
    .md-hr {
      margin: 12px 0;
      border: 0;
      border-top: 1px solid #d8e0e8;
    }
    .md-link {
      color: var(--accent);
      font-weight: 800;
      text-decoration: underline;
      text-underline-offset: 2px;
      overflow-wrap: anywhere;
    }
    .message-status {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      max-width: 100%;
      border-radius: 999px;
      padding: 3px 9px;
      color: var(--muted);
      background: #eef2f5;
      font-size: 12px;
      font-weight: 800;
      white-space: normal;
    }
    .message-status.active { color: var(--accent); background: var(--accent-soft); }
    .message-status.done { color: var(--ok); background: #e8f5ee; }
    .message-status.warn { color: #8a5a00; background: #fff7df; }
    .message-status.error { color: var(--danger); background: var(--danger-soft); }
    .message-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 2px;
      padding-top: 9px;
      border-top: 1px solid var(--line);
    }
    .message-action {
      min-height: 30px;
      padding: 5px 10px;
      font-size: 12px;
      color: var(--muted);
      background: #fff;
    }
    .message-action:disabled {
      cursor: not-allowed;
      opacity: 0.48;
    }
    .chat-command-card {
      display: grid;
      gap: 10px;
      margin-top: 10px;
      border: 1px solid #d7e3ec;
      border-radius: 8px;
      padding: 12px;
      background: #f8fbfc;
      color: var(--text);
    }
    .chat-command-card h4 {
      margin: 0;
      color: #17324d;
      font-size: 14px;
      line-height: 1.35;
    }
    .chat-command-card p {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.55;
    }
    .chat-command-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .chat-command-row {
      display: grid;
      gap: 4px;
      min-width: 0;
      border: 1px solid #e3ebf1;
      border-radius: 8px;
      padding: 8px;
      background: #fff;
    }
    .chat-command-row strong {
      color: #1d3449;
      font-size: 12px;
    }
    .chat-command-row span {
      color: var(--muted);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .chat-command-card select,
    .chat-command-card input {
      width: 100%;
      min-height: 38px;
      border: 1px solid #cbd7e1;
      border-radius: 8px;
      padding: 8px 10px;
      color: var(--text);
      background: #fff;
      font: inherit;
    }
    .chat-command-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .chat-command-card pre {
      max-height: 260px;
      margin: 0;
      border: 1px solid #dce5ed;
      border-radius: 8px;
      padding: 10px;
      overflow: auto;
      background: #ffffff;
      color: #26384c;
      font-size: 12px;
      white-space: pre-wrap;
    }
    .chat-command-note {
      color: #6b5600;
      font-size: 12px;
      font-weight: 750;
    }
    .chat-config-summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .chat-config-summary-item {
      display: grid;
      gap: 4px;
      min-width: 0;
      border: 1px solid #dce8e4;
      border-radius: 8px;
      padding: 9px;
      background: #ffffff;
    }
    .chat-config-summary-item strong {
      color: #20384d;
      font-size: 12px;
    }
    .chat-config-summary-item span {
      color: var(--muted);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .chat-config-status {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      border-radius: 999px;
      padding: 3px 9px;
      color: var(--ok);
      background: #e8f5ee;
      font-size: 12px;
      font-weight: 850;
    }
    .chat-config-status.warn {
      color: #8a5a00;
      background: #fff7df;
    }
    .chat-config-status.neutral {
      color: #475467;
      background: #eef2f5;
    }
    .chat-config-effect {
      display: grid;
      gap: 8px;
      border: 1px solid #d8e8e4;
      border-radius: 8px;
      padding: 10px;
      background: #ffffff;
    }
    .chat-config-effect-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      color: #17324d;
      font-size: 13px;
      font-weight: 900;
    }
    .chat-config-effect-list {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .chat-config-effect-item {
      display: grid;
      gap: 4px;
      min-width: 0;
      border: 1px solid #e1e9ef;
      border-radius: 8px;
      padding: 9px;
      background: #f8fbfc;
    }
    .chat-config-effect-item strong {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #20384d;
      font-size: 12px;
    }
    .chat-config-effect-item span {
      color: var(--muted);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .chat-config-dot {
      width: 8px;
      height: 8px;
      flex: 0 0 auto;
      border-radius: 999px;
      background: #aeb8c2;
    }
    .chat-config-effect-item.ok {
      border-color: #bfe6ce;
      background: #f1fbf5;
    }
    .chat-config-effect-item.ok .chat-config-dot { background: var(--ok); }
    .chat-config-effect-item.warn {
      border-color: #ffe2a8;
      background: #fffaf0;
    }
    .chat-config-effect-item.warn .chat-config-dot { background: #b7791f; }
    .chat-config-effect-item.neutral .chat-config-dot { background: #7b8794; }
    .chat-config-wizard {
      display: grid;
      gap: 8px;
    }
    .chat-config-step {
      display: grid;
      grid-template-columns: 32px minmax(0, 1fr);
      gap: 10px;
      align-items: start;
      border: 1px solid #e1e9ef;
      border-radius: 8px;
      padding: 10px;
      background: #fff;
    }
    .chat-config-step-index {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      color: #fff;
      background: var(--accent);
      font-size: 13px;
      font-weight: 900;
    }
    .chat-config-step-body {
      display: grid;
      gap: 7px;
      min-width: 0;
    }
    .chat-config-step-body strong {
      color: #17324d;
      font-size: 13px;
    }
    .chat-config-helper {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.55;
    }
    .chat-config-feedback {
      display: grid;
      gap: 7px;
      border: 1px solid #cde5dc;
      border-left: 4px solid var(--accent);
      border-radius: 8px;
      padding: 10px;
      background: #f5fbf8;
      color: #17324d;
      font-size: 13px;
    }
    .chat-config-feedback.warn {
      border-color: #ffe2a8;
      border-left-color: #b7791f;
      background: #fffaf0;
      color: #6b4b00;
    }
    .chat-config-feedback.compact {
      gap: 6px;
      background: #f7fcfa;
    }
    .chat-config-feedback.compact > p {
      margin: 0;
    }
    .chat-config-feedback.compact .chat-config-details {
      margin-top: 2px;
      padding: 7px 9px;
      background: #ffffff;
    }
    .chat-config-feedback pre {
      max-height: 220px;
      background: #ffffff;
      color: #26384c;
      border: 1px solid #dce5ed;
    }
    .chat-config-feedback .chat-command-actions {
      margin-top: 2px;
    }
    .chat-config-feedback .chat-command-actions button {
      min-height: 30px;
      padding: 5px 10px;
    }
    .chat-config-details {
      border: 1px solid #e1e9ef;
      border-radius: 8px;
      padding: 9px 10px;
      background: #ffffff;
    }
    .chat-config-details summary {
      cursor: pointer;
      color: #425466;
      font-size: 12px;
      font-weight: 850;
    }
    .chat-config-details:not([open]) > .chat-command-actions,
    .chat-config-details:not([open]) > .chat-config-step {
      display: none;
    }
    .message-citations {
      display: grid;
      gap: 8px;
      margin-top: 2px;
      padding-top: 10px;
      border-top: 1px solid var(--line);
    }
    .citation-heading {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
    }
    .citation-heading strong {
      color: var(--text);
      font-size: 13px;
    }
    .citation-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: #fbfcfd;
      padding: 8px 10px;
    }
    .citation-card summary {
      cursor: pointer;
      color: var(--text);
      font-size: 13px;
      font-weight: 800;
    }
    .citation-pill-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    .citation-pill {
      display: inline-flex;
      align-items: center;
      max-width: 100%;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 3px 8px;
      background: #ffffff;
      color: var(--muted);
      font-size: 11px;
      font-weight: 800;
      overflow-wrap: anywhere;
    }
    .citation-pill.score {
      border-color: #b7dad5;
      background: #edfdfb;
      color: var(--accent);
    }
    .citation-pill.term {
      border-color: #ffe4a3;
      background: #fff7df;
      color: #805800;
    }
    .citation-meta-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
      margin-top: 8px;
    }
    .citation-meta-item {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 6px 8px;
      background: #ffffff;
      color: var(--muted);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .citation-meta-item strong {
      display: block;
      color: var(--text);
      font-size: 11px;
      margin-bottom: 2px;
    }
    .citation-meta, .citation-snippet {
      margin-top: 8px;
      color: var(--muted);
      font-size: 12px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .citation-snippet { color: var(--text); }
    .citation-snippet mark {
      border-radius: 4px;
      background: #fff2b8;
      color: inherit;
      padding: 0 2px;
    }
    .assistant { justify-self: start; border-color: #e1e7ec; }
    .assistant .message-meta span { color: var(--accent); }
    .user {
      justify-self: end;
      border-color: #b7dad5;
      background: var(--accent-soft);
      box-shadow: 0 8px 20px rgb(15 118 110 / 8%);
    }
    .user .message-meta { justify-content: flex-end; }
    .user .message-meta span { color: #0b5f59; }
    .system {
      justify-self: center;
      width: min(680px, 100%);
      border-color: #e4e9ee;
      color: var(--muted);
      background: #f8fafb;
      box-shadow: none;
      text-align: center;
      font-size: 13px;
    }
    .error { border-color: #efb1aa; background: var(--danger-soft); color: var(--danger); }
    .scroll-bottom {
      position: absolute;
      right: 24px;
      bottom: 132px;
      z-index: 4;
      min-height: 34px;
      padding: 6px 12px;
      border-color: var(--line);
      color: var(--accent);
      background: rgb(255 255 255 / 94%);
      box-shadow: 0 10px 28px rgb(17 24 39 / 12%);
    }
    .scroll-bottom.hidden { display: none; }
    .composer {
      display: grid;
      gap: 10px;
      padding: 14px;
      border-top: 1px solid var(--line);
      background: #fff;
    }
    .composer-input-wrap {
      display: grid;
      gap: 7px;
      border: 1px solid var(--line-strong);
      border-radius: 16px;
      padding: 10px 12px 8px;
      background: #fff;
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }
    .composer-input-wrap:focus-within {
      border-color: var(--accent);
      box-shadow: 0 0 0 4px rgb(15 118 110 / 12%);
    }
    .composer-model-status {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      border: 1px solid #dce8e4;
      border-radius: 12px;
      padding: 8px 10px;
      background: #f8fbfc;
    }
    .composer-model-status.ok {
      border-color: #bfe6ce;
      background: #f1fbf5;
    }
    .composer-model-status.warn {
      border-color: #ffe2a8;
      background: #fffaf0;
    }
    .composer-model-status.error {
      border-color: #ffc9c9;
      background: #fff5f5;
    }
    .composer-model-guide {
      grid-column: 1 / -1;
      color: #667085;
      font-size: 12px;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    .composer-model-status.ok .composer-model-guide {
      color: var(--ok);
    }
    .composer-model-status.warn .composer-model-guide {
      color: #8a5a00;
    }
    .composer-model-status.error .composer-model-guide {
      color: var(--danger);
    }
    .composer-model-body {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-width: 0;
      color: #425466;
      font-size: 12px;
    }
    .composer-model-pill {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      max-width: 100%;
      border: 1px solid #d8e8e4;
      border-radius: 999px;
      padding: 3px 9px;
      background: #fff;
      font-weight: 850;
      overflow-wrap: anywhere;
    }
    .composer-model-pill.primary {
      color: var(--accent);
    }
    .composer-model-status.ok .composer-model-pill.state {
      color: var(--ok);
      border-color: #bfe6ce;
    }
    .composer-model-status.warn .composer-model-pill.state {
      color: #8a5a00;
      border-color: #ffe2a8;
    }
    .composer-model-status.error .composer-model-pill.state {
      color: var(--danger);
      border-color: #ffc9c9;
    }
    .composer-model-action {
      min-height: 30px;
      padding: 5px 10px;
      white-space: nowrap;
      border-color: var(--accent);
      color: var(--accent);
      background: #ffffff;
      font-weight: 900;
    }
    .composer-model-action:hover {
      background: var(--accent-soft);
    }
    .composer-input-wrap textarea {
      border: 0;
      border-radius: 0;
      padding: 0;
      min-height: 28px;
      max-height: 180px;
      resize: none;
      line-height: 1.55;
      overflow-y: hidden;
    }
    .composer-input-wrap textarea:focus { outline: none; }
    .composer-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 20px;
      color: var(--muted);
      font-size: 12px;
    }
    .composer-hint, .composer-meter {
      display: inline-flex;
      align-items: center;
      min-height: 20px;
    }
    .composer-hint {
      max-width: min(100%, 720px);
      color: #667085;
      overflow-wrap: anywhere;
    }
    .composer-hint.ok { color: var(--ok); }
    .composer-hint.warn { color: #8a5a00; }
    .composer-hint.error { color: var(--danger); }
    .composer-hint.active { color: var(--accent); }
    .composer-meter { font-weight: 800; }
    textarea, input, select {
      width: 100%;
      border: 1px solid var(--line-strong);
      border-radius: 12px;
      padding: 10px 12px;
      background: #fff;
      color: var(--text);
    }
    textarea { min-height: 84px; resize: vertical; }
    .composer-actions, .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .composer-actions { justify-content: space-between; }
    .composer-left { min-width: 0; }
    .composer-right { justify-content: flex-end; }
    .composer-tool-button {
      min-width: 82px;
    }
    .composer-more-actions {
      position: relative;
      min-width: 82px;
    }
    .composer-more-actions summary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 38px;
      border: 1px solid var(--line-strong);
      border-radius: 999px;
      padding: 8px 13px;
      background: #fff;
      color: var(--muted);
      cursor: pointer;
      font-weight: 800;
      list-style: none;
      user-select: none;
    }
    .composer-more-actions summary::-webkit-details-marker { display: none; }
    .composer-more-actions:not([open]) .composer-more-panel { display: none; }
    .composer-more-panel {
      position: absolute;
      left: 0;
      bottom: calc(100% + 8px);
      z-index: 12;
      display: grid;
      gap: 8px;
      min-width: 238px;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 10px;
      background: #fff;
      box-shadow: var(--shadow);
    }
    .composer-more-help {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    .composer:not(.is-sending) #stop-chat-button {
      display: none;
    }
    .composer.is-sending #stop-chat-button {
      display: inline-flex;
    }
    #stop-chat-button {
      border-color: #ffc9c9;
      background: #fff5f5;
      color: var(--danger);
    }
    .side {
      position: fixed;
      inset: 0 0 0 auto;
      z-index: 10;
      width: min(440px, 94vw);
      transform: translateX(105%);
      transition: transform 160ms ease;
      border-left: 1px solid var(--line);
      background: #fff;
      box-shadow: var(--shadow);
      overflow: auto;
      padding: 16px;
    }
    .side.open { transform: translateX(0); }
    .side-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
    .panel { display: grid; gap: 10px; border: 1px solid var(--line); border-radius: 14px; padding: 12px; margin-bottom: 12px; background: #fbfcfd; }
    .result { border-left: 4px solid var(--ok); border-radius: 10px; background: #f8fbfc; padding: 10px 12px; color: var(--muted); }
    .result.error { border-left-color: var(--danger); background: var(--danger-soft); color: var(--danger); }
    .workforce-status { min-height: 22px; font-size: 13px; color: var(--muted); }
    .workforce-status.ok { color: var(--ok); font-weight: 800; }
    .workforce-status.warn { color: #8a5a00; font-weight: 800; }
    .workforce-status.error { color: var(--danger); font-weight: 800; }
    .workforce-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .workforce-output { display: grid; gap: 12px; }
    .workforce-role-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 8px; }
    .workforce-card { border: 1px solid var(--line); border-radius: 12px; background: #fff; padding: 10px; }
    .workforce-card strong { display: block; color: var(--text); margin-bottom: 4px; }
    .workforce-list { display: grid; gap: 6px; padding-left: 18px; margin: 0; }
    .workforce-section-title { margin: 0 0 6px; color: var(--text); font-size: 13px; }
    .workforce-history-card { display: grid; gap: 8px; border: 1px solid var(--line); border-radius: 12px; background: #fff; padding: 10px; }
    .workforce-history-card h4 { margin: 0; color: var(--text); font-size: 13px; }
    .workforce-history-meta { color: var(--muted); font-size: 12px; overflow-wrap: anywhere; }
    .workforce-history-actions { display: flex; flex-wrap: wrap; gap: 7px; }
    .workforce-history-actions button { min-height: 30px; padding: 5px 10px; font-size: 12px; }
    .workforce-guide {
      display: grid;
      gap: 8px;
      border: 1px solid #cfe5df;
      border-left: 4px solid var(--accent);
      border-radius: 12px;
      padding: 10px 12px;
      background: #f6fbfa;
      color: #17423e;
    }
    .workforce-guide strong { color: #113c38; }
    .workforce-guide ul {
      display: grid;
      gap: 4px;
      margin: 0;
      padding-left: 18px;
      color: var(--muted);
    }
    .overview-summary { display: grid; gap: 8px; margin: 10px 0; }
    .overview-line {
      display: grid;
      grid-template-columns: minmax(120px, 1fr) auto;
      gap: 10px;
      align-items: center;
      min-height: 36px;
      border-top: 1px solid var(--line);
      padding-top: 8px;
      color: var(--text);
    }
    .overview-line span { color: var(--muted); }
    .overview-note { color: var(--muted); font-size: 13px; }
    .status-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 78px;
      border-radius: 999px;
      padding: 3px 9px;
      font-size: 12px;
      font-weight: 800;
      color: var(--text);
      background: #eef2f5;
    }
    .status-ok { color: var(--ok); background: #e8f5ee; }
    .status-warn { color: #8a5a00; background: #fff7df; }
    .status-danger { color: var(--danger); background: var(--danger-soft); }
    pre { overflow: auto; max-height: 260px; margin: 0; padding: 11px; border-radius: 10px; background: #101828; color: #f8fafc; font-size: 12px; white-space: pre-wrap; }
    code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; overflow-wrap: anywhere; }
    .hidden { display: none; }
    .file-input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
    @media (max-width: 760px) {
      header {
        align-items: stretch;
        flex-direction: column;
        gap: 9px;
        padding: 10px 12px;
      }
      header h1 { font-size: 17px; }
      header p { font-size: 13px; line-height: 1.4; }
      header .row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
      }
      .workspace { padding: 8px; }
      .chat-shell {
        border-radius: 12px;
        box-shadow: none;
      }
      .history {
        gap: 10px;
        padding: 12px;
      }
      .welcome {
        gap: 10px;
        margin: 2px auto 4px;
        text-align: left;
      }
      .welcome h2 { font-size: 24px; }
      .welcome p {
        margin: 0;
        font-size: 14px;
      }
      .quick-start { display: none; }
      .chips {
        justify-content: flex-start;
        overflow-x: auto;
        flex-wrap: nowrap;
        padding-bottom: 2px;
      }
      .chip {
        flex: 0 0 auto;
        min-height: 36px;
        white-space: nowrap;
      }
      .message { width: 100%; }
      .message-meta { font-size: 11px; }
      .message-actions { gap: 6px; }
      .chat-command-grid { grid-template-columns: 1fr; }
      .message-action {
        flex: 1 1 auto;
        min-width: 94px;
      }
      .composer {
        gap: 9px;
        padding: 10px;
      }
      .composer-input-wrap { border-radius: 14px; }
      .composer-input-wrap textarea { max-height: min(180px, 32dvh); }
      .composer-meta {
        align-items: flex-start;
        flex-direction: column;
        gap: 3px;
      }
      .composer-actions { align-items: stretch; flex-direction: column; }
      .composer-right { align-items: stretch; justify-content: stretch; }
      .row { align-items: stretch; flex-direction: column; }
      .composer-left {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .composer-more-actions,
      .composer-more-actions summary {
        width: 100%;
      }
      .composer-more-panel {
        position: static;
        margin-top: 8px;
        min-width: 0;
        box-shadow: none;
      }
      #upload-status,
      #chat-session-status {
        display: none;
      }
      .composer-right {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }
      .composer:not(.is-sending) .composer-right {
        grid-template-columns: 1fr;
      }
      .composer-model-status {
        grid-template-columns: 1fr;
      }
      .composer-model-action {
        width: 100%;
      }
      .side {
        width: 100vw;
        max-width: 100vw;
      }
      .scroll-bottom {
        right: 18px;
        bottom: 224px;
      }
    }
  </style>
</head>
<body>
  <div class="app">
    <header>
      <div>
        <h1>PME 移动地球</h1>
        <p class="muted">Chat-first AI Gateway。聊天、知识库、流式输出和安全本地流程都从这里进入。</p>
      </div>
      <div class="row topbar-actions hidden" aria-hidden="true">
        <label class="hidden" for="provider-select">当前聊天模型</label>
        <select id="provider-select" title="Provider" tabindex="-1">
          <option value="">自动选择 provider</option>
        </select>
      </div>
    </header>

    <main class="workspace">
      <div class="hidden">
        Chat-first AI workspace
        PME 移动地球 Console
        NVIDIA single-provider chat
        local-keyword / file-sqlite
        /knowledge/load/file
        PDF Word .docx Excel .xls/.xlsx 100MB
        cmd /c pnpm verify:phase24
        cmd /c pnpm verify:phase27
        autoKnowledgeEnabled = true
        knowledgeInjectionMode
        workflow-draft-button
        本地业务流程自动化
        /chat/rag/stream
        /dashboard/status
        /enterprise/overview
        /enterprise/acceptance/report
        /enterprise/release-candidate/dry-run
        phase44a-enterprise-acceptance-ui
        phase46a-enterprise-release-candidate-ui
        phase47a-enterprise-overview-ui
        /evaluation/score
        /memory/save
        /connectors/import/text
        /knowledge/graph/retrieve
      </div>
      <section id="chat-shell" class="chat-shell" aria-label="Chat-first AI workspace">
        <div id="history" class="history">
          <div class="welcome">
            <h2>直接问，直接丢文件</h2>
            <p class="muted">普通问题会走快速聊天；涉及文件、资料、引用时，PME 会自动检索本地知识库再组织回答。高级入口默认收起，平时专注聊天就好。</p>
            <details class="quick-start" data-phase="phase51a-user-readable-first-screen">
              <summary>日常最推荐顺序</summary>
              <ol>
                <li><code>cmd /c pnpm dev:phase7b</code> 启动系统。</li>
                <li><code>cmd /c pnpm status:phase10a</code> 确认 running。</li>
                <li><code>cmd /c pnpm health:phase12a</code> 检查服务健康。</li>
                <li><code>cmd /c pnpm logs:phase16a</code> 查看当前日志。</li>
                <li><code>cmd /c pnpm idle:phase15a</code> 安全停机归零，再用 status 确认 stopped。</li>
              </ol>
              <span>高级能力也通过聊天进入；可以直接输入“配置模型”“查看状态”“健康检查”“知识库”或“打开能力面板”。</span>
            </details>
            <div class="first-run-guide" data-phase="phase80a-first-run-guide">
              <div class="first-run-title">
                <span>第一次使用只看这三步</span>
                <span class="first-run-badge">面向普通用户</span>
              </div>
              <div class="first-run-grid">
                <div class="first-run-step">
                  <strong>1. 启动 PME</strong>
                  <code>cmd /c pnpm start:pme</code>
                  <span>先做本地预检，再复用托管启动链。</span>
                </div>
                <div class="first-run-step">
                  <strong>2. 打开网页</strong>
                  <code>http://127.0.0.1:3100/ui</code>
                  <span>启动成功后从这里进入聊天前台。</span>
                </div>
                <div class="first-run-step">
                  <strong>3. 直接开始</strong>
                  <span>输入问题，或把 PDF / Word / Excel / 文本直接拖进聊天窗口。</span>
                </div>
              </div>
            </div>
          </div>
          <div class="setup-wizard" data-phase="phase104a-first-run-setup">
            <div class="setup-wizard-header">
              <strong>首次使用引导 / Setup Wizard</strong>
              <span>按这 6 步走就能开始用：先确认服务 ready，再添加模型，最后进入 Chat、Knowledge 或 Agent Workforce。</span>
            </div>
            <div class="setup-wizard-grid">
              <div class="setup-wizard-step">
                <strong>Step 1：系统健康检查</strong>
                <span>点击“检查首次使用状态”，确认服务、知识库和团队计划模块是否 ready。</span>
              </div>
              <div class="setup-wizard-step">
                <strong>Step 2：添加模型 / 检测 API Key</strong>
                <span>点击输入区的“配置模型”。识别失败时，选择 provider 或填写 Base URL 后再检测。</span>
              </div>
              <div class="setup-wizard-step">
                <strong>Step 3：开始聊天</strong>
                <span>模型检测通过后直接输入问题；也可以先用服务端默认路由试聊。</span>
              </div>
              <div class="setup-wizard-step">
                <strong>Step 4：Agent Workforce</strong>
                <span>输入目标生成 AI 团队计划。当前只做计划预览，不执行代码、不修改文件。</span>
              </div>
              <div class="setup-wizard-step">
                <strong>Step 5：Knowledge/RAG 可选</strong>
                <span>需要资料问答时，把文档拖进聊天窗口，系统会在本地知识库检索后回答。</span>
              </div>
              <div class="setup-wizard-step">
                <strong>Step 6：发布前限制</strong>
                <span>当前不是全球发布完成态；真实 fallback、多 Agent 执行、完整 IAM 仍需后续明确主线。</span>
              </div>
            </div>
            <div class="setup-wizard-actions">
              <button type="button" data-get="/setup/readiness" data-target="setup-readiness-output">检查首次使用状态</button>
              <button type="button" data-prompt="配置模型">打开模型配置</button>
              <button type="button" data-prompt="帮我生成一个 Agent Workforce 任务计划">试试 Agent Workforce</button>
            </div>
            <pre id="setup-readiness-output" class="setup-readiness-output">还没有检查。点击“检查首次使用状态”后，这里会显示 health、model import、chat、knowledge、workforce 的 ready 状态。</pre>
          </div>
          <div class="setup-wizard" data-phase="phase105a-user-journey" data-journey="ordinary-user-e2e-path">
            <div class="setup-wizard-header">
              <strong>普通用户从 0 到 1 使用路径 / User Journey</strong>
              <span>按这个顺序验收：打开 /ui -> 检查 /setup/readiness -> 添加或检测模型 -> 进入 Chat -> 使用 Knowledge/RAG -> 使用 Agent Workforce -> 保存/导出计划 -> 遇到错误按提示处理。</span>
            </div>
            <div class="setup-wizard-grid">
              <div class="setup-wizard-step">
                <strong>Chat readiness</strong>
                <span>先确认 readiness 里 chat 是 ready。真实回答失败时，先看模型配置提示、health、doctor、logs。</span>
              </div>
              <div class="setup-wizard-step">
                <strong>Model Import / API Key</strong>
                <span>API Key 只用于识别 provider 候选；模型必须来自 provider models/list。识别失败时请选择 provider 或填写 base URL。</span>
              </div>
              <div class="setup-wizard-step">
                <strong>Knowledge / RAG</strong>
                <span>把资料拖进聊天窗口后再提问；回答会尽量带 topHit、snippet、highlights 和 citations。</span>
              </div>
              <div class="setup-wizard-step">
                <strong>Agent Workforce</strong>
                <span>用于生成 AI 团队计划预览，可保存、查看历史、导出任务包；不会自动执行代码或修改文件。</span>
              </div>
              <div class="setup-wizard-step">
                <strong>Error recovery</strong>
                <span>如果看到 unknown API key、provider 选择、base URL、timeout 或 model 0，按卡片里的下一步处理，不需要读源码。</span>
              </div>
              <div class="setup-wizard-step">
                <strong>Preview boundary</strong>
                <span>105A 是产品可用性回归，不代表全球发布完成、真实多 Agent 执行完成或 fallback 真执行完成。</span>
              </div>
            </div>
          </div>
          <div class="setup-wizard" data-phase="phase108a-access-boundary" data-boundary="access-multi-user-release">
            <div class="setup-wizard-header">
              <strong>发布前账号 / 权限 / 多用户边界</strong>
              <span>当前适合本地或内部测试。不要直接暴露公网给多用户使用。</span>
            </div>
            <div class="setup-wizard-grid">
              <div class="setup-wizard-step">
                <strong>当前可体验</strong>
                <span>本地单用户启动、Chat、Knowledge/RAG、模型检测、Agent Workforce 计划预览。</span>
              </div>
              <div class="setup-wizard-step">
                <strong>生产部署前必须补齐</strong>
                <span>账号体系、权限隔离、密钥加密存储、多租户隔离、rate limit、audit retention。</span>
              </div>
              <div class="setup-wizard-step">
                <strong>Agent Workforce 边界</strong>
                <span>Agent Workforce 不是真实员工执行器；它只生成计划预览，不执行代码、不修改文件。</span>
              </div>
              <div class="setup-wizard-step">
                <strong>本地存储边界</strong>
                <span>model registry / plan store 是本地 dev-only 便利能力，不是生产级密钥保险箱或多用户数据库。</span>
              </div>
              <div class="setup-wizard-step">
                <strong>公网发布提醒</strong>
                <span>生产前需要独立安全评审、真实身份认证、租户隔离、密钥托管和审计保留策略。</span>
              </div>
              <div class="setup-wizard-step">
                <strong>验证命令</strong>
                <span>cmd /c pnpm verify:phase108a-access-boundary</span>
              </div>
            </div>
          </div>
          <div class="message assistant" data-role="assistant" data-type="assistant">
            <div class="message-meta"><span>PME</span><time>现在</time></div>
            <div class="message-text">你好，我是 PME 移动地球。普通问题我会直接快速回答；把文件或资料丢给我时，我会先查本地知识库再组织回答。</div>
          </div>
        </div>
        <button id="scroll-bottom-button" class="scroll-bottom hidden" type="button" aria-label="回到底部">回到底部</button>

        <form id="chat-form" class="composer">
          <div class="composer-input-wrap">
            <div id="composer-model-status" class="composer-model-status neutral" data-model-probe-status="not-checked">
              <div class="composer-model-body">
                <span id="composer-model-label" class="composer-model-pill primary">模型：自动</span>
                <span id="composer-model-probe" class="composer-model-pill state">未检测</span>
                <span id="composer-model-preference" class="composer-model-pill">未记住</span>
              </div>
              <button id="composer-model-config-button" class="composer-model-action" type="button" data-phase="phase82a-model-config-entry" aria-label="打开模型配置">配置模型</button>
              <div id="composer-model-guide" class="composer-model-guide" data-phase="phase82a-model-availability-guide">粘贴 Key，自动找模型。通过后直接聊。</div>
            </div>
            <textarea id="chat-input" rows="1" aria-label="Chat message" placeholder="输入问题，或把文件直接拖到这里。"></textarea>
            <div class="composer-meta">
              <span id="composer-shortcut-hint" class="composer-hint">Enter 发送 · Shift+Enter 换行 · Ctrl/⌘+Enter 发送 · Esc 停止</span>
              <span id="composer-meter" class="composer-meter">准备输入</span>
            </div>
          </div>
          <div class="composer-actions">
            <div class="row composer-left">
              <button id="upload-button" class="composer-tool-button" type="button" title="上传资料">上传</button>
              <details id="composer-more-actions" class="composer-more-actions">
                <summary id="composer-more-summary">更多</summary>
                <div class="composer-more-panel">
                  <button id="clear-chat-button" type="button">清空会话</button>
                  <span class="composer-more-help">只清空当前浏览器会话，不删除知识库。</span>
                </div>
              </details>
              <input id="file-input" class="file-input" type="file" multiple accept=".txt,.md,.markdown,.json,.csv,.log,.html,.htm,.xml,.yaml,.yml,.pdf,.docx,.xlsx,.xls">
              <span id="upload-status" class="muted">支持 PDF / Word .docx / Excel .xls/.xlsx / 文本，单文件 100MB。</span>
              <span id="chat-session-status" class="muted">会话会保存在当前浏览器。</span>
            </div>
            <div class="row composer-right">
              <button id="stop-chat-button" type="button" disabled>停止生成</button>
              <button id="send-button" class="primary" type="submit">发送</button>
            </div>
          </div>
        </form>
      </section>
    </main>

    <aside id="side" class="side" aria-label="PME 能力面板">
      <div class="side-head">
        <div>
          <h2>能力面板</h2>
          <p class="muted">默认隐藏；这里只放真实可调用的入口。</p>
        </div>
        <button id="side-close" type="button">关闭</button>
      </div>

      <section class="panel">
        <h3>账号与租户（Auth / Tenant）</h3>
        <input id="auth-token" placeholder="PME token，可选">
        <input id="tenant-id" placeholder="租户 ID，默认 default">
        <button data-get="/auth/status" data-target="auth-output" type="button">查看登录状态</button>
        <pre id="auth-output">{}</pre>
      </section>

      <section class="panel">
        <h3>企业治理（Enterprise Governance）</h3>
        <p class="muted">这里集中查看账号、租户、权限、审计和上线前检查。角色与审计类操作需要 admin 或 auditor token。</p>
        <div class="result" data-phase="phase47a-enterprise-overview-ui">
          <strong>企业总览（Enterprise overview）</strong>
          <p class="muted">只读汇总治理健康度、上线准备度、验收报告和交付候选预演。不调用 provider，不改运行数据，不打包，不发布，不创建基础设施。</p>
          <div id="enterprise-overview-summary" class="overview-summary" data-phase="phase48a-enterprise-overview-readable-summary">
            <div class="overview-note">点击“查看企业总览”后，这里会显示一屏状态摘要。</div>
          </div>
          <button id="enterprise-overview-run" data-route="/enterprise/overview" type="button">查看企业总览</button>
          <pre id="enterprise-overview-output">{}</pre>
        </div>
        <div class="result" data-phase="phase40a-enterprise-deployment-preflight">
          <strong>上线前预检（Deployment preflight）</strong>
          <p class="muted">只读检查服务健康、部署准备、启动准备、安全准备和向量链路准备度。</p>
          <button id="enterprise-preflight-run" type="button">运行上线前预检</button>
          <pre id="enterprise-preflight-output">{}</pre>
        </div>
        <div class="result" data-phase="phase41a-enterprise-config-wizard">
          <strong>企业配置向导（Enterprise config wizard）</strong>
          <p class="muted">把私有 .env 草稿粘到这里做本地检查。内容只在浏览器里解析，不上传，也不会回显密钥值。</p>
          <textarea id="enterprise-config-input" placeholder="在这里粘贴 .env.enterprise。示例：NVIDIA_API_KEY=..."></textarea>
          <div class="row">
            <button id="enterprise-config-check" type="button">本地检查配置</button>
            <button id="enterprise-config-clear" type="button">清空粘贴内容</button>
          </div>
          <pre id="enterprise-config-output">{}</pre>
        </div>
        <div class="result" data-phase="phase44a-enterprise-acceptance-ui">
          <strong>企业验收报告（Enterprise acceptance report）</strong>
          <p class="muted">只读查看 docs/ENTERPRISE_ACCEPTANCE_REPORT.md 与 Phase43A 证据。不调用 provider，不改运行数据，不创建基础设施，不执行发布自动化。</p>
          <button data-get="/enterprise/acceptance/report" data-target="enterprise-acceptance-output" type="button">查看验收报告</button>
          <pre id="enterprise-acceptance-output">{}</pre>
        </div>
        <div class="result" data-phase="phase46a-enterprise-release-candidate-ui">
          <strong>交付候选只读预演（Enterprise release-candidate dry-run）</strong>
          <p class="muted">只读查看 Phase45A 的交付文档、脚本、证据、UI 标记和边界检查。不打包，不发布，不调用 provider，不创建基础设施。</p>
          <button data-get="/enterprise/release-candidate/dry-run" data-target="enterprise-release-candidate-output" type="button">查看交付候选预演</button>
          <pre id="enterprise-release-candidate-output">{}</pre>
        </div>
        <div class="row">
          <button data-get="/enterprise/health" data-target="enterprise-output" type="button">治理健康度</button>
          <button data-get="/enterprise/session" data-target="enterprise-output" type="button">当前会话</button>
        </div>
        <div class="row">
          <button data-get="/enterprise/roles" data-target="enterprise-output" type="button">角色 / 权限</button>
          <button data-get="/enterprise/security/readiness" data-target="enterprise-output" type="button">安全准备度</button>
          <button data-get="/enterprise/deployment/readiness" data-target="enterprise-output" type="button">部署准备度</button>
          <button data-get="/enterprise/startup/readiness" data-target="enterprise-output" type="button">启动准备度</button>
          <button data-get="/enterprise/users" data-target="enterprise-output" type="button">托管用户</button>
          <button data-get="/enterprise/audit?limit=20" data-target="enterprise-output" type="button">审计日志</button>
          <button data-get="/enterprise/audit/export?limit=50&format=jsonl" data-target="enterprise-output" type="button">导出审计</button>
        </div>
        <div class="row">
          <input id="enterprise-backup-path" placeholder="用于恢复校验的 backupPath">
          <button id="enterprise-backup-create" type="button">创建备份</button>
          <button id="enterprise-backup-validate" type="button">校验备份</button>
        </div>
        <div class="row">
          <input id="enterprise-managed-user-id" placeholder="用户 ID">
          <input id="enterprise-managed-token" placeholder="新 token" type="password">
        </div>
        <div class="row">
          <input id="enterprise-managed-tenant" placeholder="租户 ID" value="default">
          <select id="enterprise-managed-role">
            <option value="viewer">viewer</option>
            <option value="operator">operator</option>
            <option value="auditor">auditor</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <div class="row">
          <input id="enterprise-managed-expires" placeholder="过期时间 ISO，可选">
          <button id="enterprise-user-upsert" type="button">创建 / 更新用户</button>
          <button id="enterprise-user-revoke" type="button">撤销用户</button>
        </div>
        <pre id="enterprise-output">{}</pre>
      </section>

      <section class="panel">
        <h3>运行 Dashboard</h3>
        <button data-get="/dashboard/status" data-target="dashboard-output" type="button">刷新 dashboard</button>
        <pre id="dashboard-output">{}</pre>
      </section>

      <section class="panel">
        <h3>模型通道与 fallback（Provider / fallback）</h3>
        <button data-get="/providers" data-target="providers-output" type="button">查看 provider 列表</button>
        <button data-get="/config/runtime" data-target="providers-output" type="button">查看运行配置</button>
        <pre id="providers-output">{}</pre>
      </section>

      <section class="panel">
        <h3>长期记忆</h3>
        <input id="memory-title" value="用户偏好">
        <textarea id="memory-text">用户希望 PME 移动地球默认用聊天窗口承载知识库、流程自动化和网关能力。</textarea>
        <div class="row">
          <button id="memory-save" type="button">记住</button>
          <button id="memory-list" type="button">查看记忆</button>
        </div>
        <pre id="memory-output">{}</pre>
      </section>

      <section class="panel">
        <h3>外部连接器</h3>
        <p class="muted">最小安全版只支持显式粘贴文本，不爬取、不扫目录、不后台同步。</p>
        <input id="connector-id" value="manual-business-note">
        <input id="connector-title" value="业务资料">
        <textarea id="connector-content">这是一段通过显式文本连接器导入的业务资料。</textarea>
        <button id="connector-import" type="button">导入连接器文本</button>
        <pre id="connector-output">{}</pre>
      </section>

      <section class="panel">
        <h3>评估 / 打分（Evaluation / Scoring）</h3>
        <input id="score-terms" value="PME,知识库,workflow">
        <button id="score-latest" type="button">给最近回答打分</button>
        <pre id="score-output">{}</pre>
      </section>

      <section class="panel">
        <h3>图谱检索（GraphRAG）</h3>
        <input id="graph-query" value="PME workflow knowledge">
        <button id="graph-run" type="button">生成查询图谱</button>
        <pre id="graph-output">{}</pre>
      </section>

      <section class="panel">
        <h3>安全本地业务流程</h3>
        <button id="workflow-run" type="button">执行安全 workflow</button>
        <pre id="workflow-output">{}</pre>
      </section>

      <section class="panel" data-phase="phase103a-product-readiness">
        <h3>产品入口说明</h3>
        <p class="muted">这里把 PME 移动地球的核心能力放在一个入口里：聊天优先，复杂能力默认收起，需要时再打开。</p>
        <ul class="workforce-list">
          <li>Chat：主会话入口，可以提问、上传资料，并由服务端 RAG 检索本地知识后回答。</li>
          <li>API Key 添加模型：只用 API Key 判断 provider 候选，模型必须来自 provider models/list；识别不了时会提示选择 provider 或填写 Base URL。</li>
          <li>Knowledge / RAG：导入资料、检索片段、返回引用，不会自动变成完整 GraphRAG 或长期记忆平台。</li>
          <li>Workflow：只执行 allowlist 内的安全本地流程，不是任意命令执行器。</li>
          <li>Agent Workforce：生成 AI 团队计划预览、保存历史和导出任务包，不会自动写代码或修改文件。</li>
          <li>Enterprise / readiness：只读查看治理、审计、上线准备和交付报告，不会自动发布或创建基础设施。</li>
        </ul>
      </section>

      <section class="panel" data-phase="phase102c-agent-workforce-product-closure">
        <h3>AI 公司团队 / Agent Workforce</h3>
        <p class="muted">输入目标后生成 7 个 AI 员工的分工计划。当前为计划预览，不会执行代码或修改文件。</p>
        <p class="muted" data-phase="phase102d-agent-workforce-plan-store">历史计划使用 dev-only 本地计划库保存，只保存计划包，不保存 API Key，也不写入用户项目文件。</p>
        <div class="workforce-guide" data-phase="phase102e-workforce-user-guide">
          <strong>当前是 AI 团队计划预览，不是自动执行器。</strong>
          <ul>
            <li>适合用于需求拆解、团队分工、任务规划、交付物和验收标准整理。</li>
            <li>不会自动执行代码 / 不会修改文件 / 不会启动多个真实 Agent 并发工作。</li>
            <li>下一步可以复制 Markdown、保存历史计划，或导出任务包交给人工或后续安全执行主线审阅。</li>
          </ul>
        </div>
        <textarea id="workforce-goal" maxlength="1000" placeholder="输入一个目标，例如：构建全球发布级模型管理系统">构建一个全球发布级 AI 模型管理系统</textarea>
        <div id="workforce-goal-hint" class="workforce-status">最多 1000 个字符。</div>
        <div class="workforce-actions">
          <button class="workforce-example" data-workforce-goal="构建一个全球发布级 AI 模型管理系统" type="button">示例：模型管理系统</button>
          <button class="workforce-example" data-workforce-goal="把本地业务流程自动化做成可交付产品" type="button">示例：业务自动化</button>
          <button class="workforce-example" data-workforce-goal="设计一个知识库导入、检索、验收闭环" type="button">示例：知识库闭环</button>
        </div>
        <div class="workforce-actions">
          <button id="workforce-plan" type="button">生成 AI 团队计划</button>
          <button id="workforce-copy" type="button" disabled>复制 Markdown 结果</button>
          <button id="workforce-export-json" type="button" disabled>导出 JSON</button>
          <button id="workforce-save" type="button" disabled>保存计划</button>
          <button id="workforce-history-refresh" type="button">刷新历史</button>
          <button id="workforce-clear" type="button">清空结果</button>
        </div>
        <div id="workforce-status" class="workforce-status">等待输入目标。</div>
        <div id="workforce-history" class="workforce-output"></div>
        <div id="workforce-rendered" class="workforce-output"></div>
        <pre id="workforce-output">{}</pre>
      </section>

      <section class="panel">
        <h3>默认命令</h3>
        <code>cmd /c pnpm dev:phase7b</code>
        <code>cmd /c pnpm status:phase10a</code>
        <code>cmd /c pnpm logs:phase16a</code>
        <code>cmd /c pnpm idle:phase15a</code>
        <code>cmd /c pnpm verify:phase31a</code>
      </section>
    </aside>
  </div>

  <script>
    const autoKnowledgeEnabled = true;
    const knowledgeInjectionMode = "service-side-rag-stream";
    const maxUploadFileBytes = 100 * 1024 * 1024;
    const legacyRuntimeCredentialDetectRoute = "/providers/runtime-credential/detect";
    let latestAnswer = "";
    let latestCitations = [];

    const shell = document.getElementById("chat-shell");
    const history = document.getElementById("history");
    const input = document.getElementById("chat-input");
    const form = document.getElementById("chat-form");
    const fileInput = document.getElementById("file-input");
    const uploadStatus = document.getElementById("upload-status");
    const sessionStatus = document.getElementById("chat-session-status");
    const composerMeter = document.getElementById("composer-meter");
    const composerHint = document.getElementById("composer-shortcut-hint");
    const composerModelStatus = document.getElementById("composer-model-status");
    const composerModelLabel = document.getElementById("composer-model-label");
    const composerModelProbe = document.getElementById("composer-model-probe");
    const composerModelPreference = document.getElementById("composer-model-preference");
    const composerModelGuide = document.getElementById("composer-model-guide");
    const composerModelConfigButton = document.getElementById("composer-model-config-button");
    const providerSelect = document.getElementById("provider-select");
    const showFakeProvidersInUi = new URLSearchParams(window.location.search).get("showFakeProviders") === "1";
    const sendButton = document.getElementById("send-button");
    const stopButton = document.getElementById("stop-chat-button");
    const scrollBottomButton = document.getElementById("scroll-bottom-button");
    const side = document.getElementById("side");
    const chatHistoryStorageKey = "pme-moving-earth-chat-history-v1";
    const chatProviderPreferenceStorageKey = "pme-moving-earth-provider-preference-v1";
    const maxStoredChatMessages = 80;
    const defaultAssistantGreeting = document.querySelector("#history .message.assistant .message-text")?.textContent ||
      document.querySelector("#history .message.assistant")?.textContent ||
      "你好，我是 PME 移动地球。";
    const defaultChatInputPlaceholder = input.getAttribute("placeholder") || "输入问题，或把文件直接拖到这里。";
    let lastKnowledgeUpload = { loadedCount: 0, loadedFileNames: [], skipped: [] };
    let chatSending = false;
    let currentChatAbortController = null;
    let chatAbortRequested = false;
    let pendingModelConfigOpenContext = null;
    let pendingModelConfigRetryPrompt = "";
    let composerReadyNudge = "";
    let composerModelProbeState = {
      status: "not-checked",
      value: "",
      label: "服务端自动选择",
      reason: "未检测",
    };

    restoreChatHistory();
    syncComposerState();

    document.getElementById("side-open")?.addEventListener("click", () => side.classList.add("open"));
    document.getElementById("side-close").addEventListener("click", () => side.classList.remove("open"));

    document.querySelectorAll("[data-prompt]").forEach((button) => {
      button.addEventListener("click", () => {
        input.value = button.dataset.prompt;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        syncComposerState();
      });
    });

    document.querySelectorAll("[data-get]").forEach((button) => {
      button.addEventListener("click", async () => writeJson(button.dataset.target, await requestJson(button.dataset.get)));
    });

    document.getElementById("enterprise-overview-run").addEventListener("click", async () => {
      const result = await requestJson("/enterprise/overview");
      renderEnterpriseOverview(result);
      writeJson("enterprise-overview-output", result);
    });

    document.getElementById("enterprise-preflight-run").addEventListener("click", async () => {
      writeJson("enterprise-preflight-output", await runEnterprisePreflight());
    });

    document.getElementById("enterprise-config-check").addEventListener("click", () => {
      writeJson("enterprise-config-output", checkEnterpriseConfigDraft(document.getElementById("enterprise-config-input").value));
    });

    document.getElementById("enterprise-config-clear").addEventListener("click", () => {
      document.getElementById("enterprise-config-input").value = "";
      writeJson("enterprise-config-output", {
        ok: true,
        payload: {
          data: {
            phase: "phase41a-enterprise-config-wizard",
            mode: "browser-local-only",
            cleared: true,
          },
        },
      });
    });

    document.getElementById("enterprise-user-upsert").addEventListener("click", async () => {
      writeJson("enterprise-output", await requestJson("/enterprise/users", {
        method: "POST",
        body: {
          userId: document.getElementById("enterprise-managed-user-id").value,
          token: document.getElementById("enterprise-managed-token").value,
          tenantId: document.getElementById("enterprise-managed-tenant").value || "default",
          role: document.getElementById("enterprise-managed-role").value,
          expiresAt: document.getElementById("enterprise-managed-expires").value || undefined,
        },
      }));
    });

    document.getElementById("enterprise-user-revoke").addEventListener("click", async () => {
      writeJson("enterprise-output", await requestJson("/enterprise/users/revoke", {
        method: "POST",
        body: {
          userId: document.getElementById("enterprise-managed-user-id").value,
        },
      }));
    });

    document.getElementById("enterprise-backup-create").addEventListener("click", async () => {
      const result = await requestJson("/enterprise/backup", {
        method: "POST",
        body: {
          reason: "ui-enterprise-backup",
        },
      });
      const backupPath = result.payload?.data?.backupPath;
      if (backupPath) document.getElementById("enterprise-backup-path").value = backupPath;
      writeJson("enterprise-output", result);
    });

    document.getElementById("enterprise-backup-validate").addEventListener("click", async () => {
      writeJson("enterprise-output", await requestJson("/enterprise/restore/validate", {
        method: "POST",
        body: {
          backupPath: document.getElementById("enterprise-backup-path").value,
        },
      }));
    });

    document.getElementById("upload-button").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      await loadFiles(fileInput.files);
      fileInput.value = "";
    });
    document.getElementById("clear-chat-button").addEventListener("click", () => clearChatHistory());
    stopButton.addEventListener("click", () => stopChatGeneration());
    input.addEventListener("input", () => {
      if (input.value.trim()) composerReadyNudge = "";
      syncComposerState();
    });
    composerModelConfigButton?.addEventListener("click", () => openModelConfigFromComposer());
    providerSelect.addEventListener("change", () => {
      persistProviderPreference(providerSelect.value, "topbar-select");
      updateComposerModelStatus({ status: "not-checked", reason: "未检测" });
    });
    history.addEventListener("scroll", () => updateScrollBottomButton());
    scrollBottomButton.addEventListener("click", () => scrollChatToBottom("smooth"));
    history.addEventListener("click", (event) => {
      const button = event.target.closest("[data-message-action]");
      if (!button) return;
      handleMessageAction(button);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && chatSending) {
        event.preventDefault();
        stopChatGeneration();
        return;
      }
      const sendByEnter = event.key === "Enter" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && !event.isComposing;
      const sendByAccelerator = event.key === "Enter" && !event.shiftKey && !event.altKey && (event.ctrlKey || event.metaKey) && !event.isComposing;
      if (!sendByEnter && !sendByAccelerator) {
        return;
      }
      event.preventDefault();
      if (chatSending) {
        appendMessage("system", "正在生成回答，请等当前回复完成后再发送。", "system");
        return;
      }
      form.requestSubmit();
    });

    shell.addEventListener("dragover", (event) => {
      event.preventDefault();
      shell.classList.add("dragover");
    });
    shell.addEventListener("dragleave", () => shell.classList.remove("dragover"));
    shell.addEventListener("drop", async (event) => {
      event.preventDefault();
      shell.classList.remove("dragover");
      await loadFiles(event.dataTransfer.files);
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submittedText = input.value;
      if (submittedText.trim() && !chatSending) {
        input.value = "";
        syncComposerState();
      }
      await sendChat(submittedText);
      input.focus();
    });

    document.getElementById("memory-save").addEventListener("click", async () => {
      writeJson("memory-output", await requestJson("/memory/save", {
        method: "POST",
        body: {
          title: document.getElementById("memory-title").value,
          text: document.getElementById("memory-text").value,
        },
      }));
    });

    document.getElementById("memory-list").addEventListener("click", async () => {
      writeJson("memory-output", await requestJson("/memory/list"));
    });

    document.getElementById("connector-import").addEventListener("click", async () => {
      writeJson("connector-output", await requestJson("/connectors/import/text", {
        method: "POST",
        body: {
          connectorId: document.getElementById("connector-id").value,
          title: document.getElementById("connector-title").value,
          content: document.getElementById("connector-content").value,
        },
      }));
    });

    document.getElementById("score-latest").addEventListener("click", async () => {
      writeJson("score-output", await requestJson("/evaluation/score", {
        method: "POST",
        body: {
          answer: latestAnswer || "PME knowledge workflow",
          citations: latestCitations,
          expectedTerms: document.getElementById("score-terms").value.split(",").map((item) => item.trim()).filter(Boolean),
        },
      }));
    });

    document.getElementById("graph-run").addEventListener("click", async () => {
      writeJson("graph-output", await requestJson("/knowledge/graph/retrieve", {
        method: "POST",
        body: {
          query: document.getElementById("graph-query").value,
          topK: 3,
        },
      }));
    });

    document.getElementById("workflow-run").addEventListener("click", async () => {
      writeJson("workflow-output", await requestJson("/workflow/run", {
        method: "POST",
        body: {
          goal: input.value.trim() || "根据当前知识库整理一个本地业务流程报告",
          topK: 3,
        },
      }));
    });

    let lastWorkforceMarkdown = "";
    let lastWorkforceExportJson = "";
    let lastWorkforcePlan = null;
    updateWorkforceGoalHint();
    refreshWorkforceHistory();
    document.querySelectorAll(".workforce-example").forEach((button) => {
      button.addEventListener("click", () => {
        document.getElementById("workforce-goal").value = button.dataset.workforceGoal || "";
        updateWorkforceGoalHint();
        setWorkforceStatus("已填入示例目标，可以直接生成计划。", "ok");
      });
    });

    document.getElementById("workforce-goal").addEventListener("input", () => updateWorkforceGoalHint());

    document.getElementById("workforce-plan").addEventListener("click", async () => {
      const goal = document.getElementById("workforce-goal").value.trim();
      if (!goal) {
        setWorkforceStatus("请先输入一个目标，再生成 AI 团队计划。", "error");
        renderWorkforcePlan(null);
        writeJson("workforce-output", {
          ok: false,
          error: {
            code: "WORKFORCE_GOAL_REQUIRED",
            message: "请输入目标。",
          },
        });
        return;
      }
      if (goal.length > 1000) {
        setWorkforceStatus("目标太长，请控制在 1000 个字符以内。", "error");
        return;
      }

      setWorkforceStatus("正在生成 AI 团队计划预览...", "warn");
      renderWorkforcePlan(null);
      document.getElementById("workforce-copy").disabled = true;
      document.getElementById("workforce-export-json").disabled = true;
      document.getElementById("workforce-save").disabled = true;
      lastWorkforcePlan = null;
      const result = await requestJson("/workforce/plan", {
        method: "POST",
        body: {
          goal,
          context: {
            traceId: "ui-phase102b-workforce-preview",
          },
        },
      });
      writeJson("workforce-output", result);
      if (!result.ok) {
        setWorkforceStatus(formatWorkforceError(result), "error");
        renderWorkforceError(result);
        return;
      }

      const plan = result.payload?.data;
      lastWorkforcePlan = plan;
      lastWorkforceMarkdown = plan.markdown || formatWorkforcePlanMarkdown(plan);
      lastWorkforceExportJson = JSON.stringify(plan.exportableJson || plan, null, 2);
      renderWorkforcePlan(plan);
      document.getElementById("workforce-copy").disabled = !lastWorkforceMarkdown;
      document.getElementById("workforce-export-json").disabled = !lastWorkforceExportJson;
      document.getElementById("workforce-save").disabled = !lastWorkforcePlan;
      setWorkforceStatus("计划已生成。你可以阅读卡片、复制 Markdown、保存历史，或导出任务包给人工/后续安全执行主线审阅。", "ok");
    });

    document.getElementById("workforce-copy").addEventListener("click", async () => {
      if (!lastWorkforceMarkdown) {
        setWorkforceStatus("当前还没有可复制的计划。", "error");
        return;
      }
      try {
        await copyTextToClipboard(lastWorkforceMarkdown);
        setWorkforceStatus("已复制 Markdown 计划。", "ok");
      } catch (error) {
        setWorkforceStatus("复制失败，请直接从下方 JSON 或计划区域手动复制。", "error");
      }
    });

    document.getElementById("workforce-export-json").addEventListener("click", () => {
      if (!lastWorkforceExportJson) {
        setWorkforceStatus("当前还没有可导出的 JSON。", "error");
        return;
      }
      const planId = (() => {
        try {
          return JSON.parse(lastWorkforceExportJson).workforceId || "plan";
        } catch {
          return "plan";
        }
      })();
      downloadTextFile("agent-workforce-" + planId + ".json", lastWorkforceExportJson, "application/json");
      setWorkforceStatus("已导出当前计划 JSON。它是任务包草案，不会自动执行任何任务。", "ok");
    });

    document.getElementById("workforce-save").addEventListener("click", async () => {
      if (!lastWorkforcePlan) {
        setWorkforceStatus("当前还没有可保存的计划。", "error");
        return;
      }
      setWorkforceStatus("正在保存计划到 dev-only 本地计划库...", "warn");
      const result = await requestJson("/workforce/plans/save", {
        method: "POST",
        body: {
          plan: lastWorkforcePlan,
          context: {
            traceId: "ui-phase102d-workforce-plan-store",
          },
        },
      });
      writeJson("workforce-output", result);
      if (!result.ok) {
        setWorkforceStatus(formatWorkforceError(result), "error");
        return;
      }
      setWorkforceStatus("计划已保存到 dev-only 本地历史。下一步可以从历史重新加载，或导出 JSON / Markdown 任务包。", "ok");
      await refreshWorkforceHistory();
    });

    document.getElementById("workforce-history-refresh").addEventListener("click", async () => {
      await refreshWorkforceHistory();
      setWorkforceStatus("历史计划已刷新。", "ok");
    });

      document.getElementById("workforce-clear").addEventListener("click", () => {
      document.getElementById("workforce-goal").value = "";
      lastWorkforceMarkdown = "";
      lastWorkforceExportJson = "";
      lastWorkforcePlan = null;
      renderWorkforcePlan(null);
      writeJson("workforce-output", {});
      document.getElementById("workforce-copy").disabled = true;
      document.getElementById("workforce-export-json").disabled = true;
      document.getElementById("workforce-save").disabled = true;
      updateWorkforceGoalHint();
      setWorkforceStatus("已清空，可以重新输入目标。", "ok");
    });

    initProviders();

    async function initProviders() {
      const response = await requestJson("/providers");
      if (!response.ok) {
        appendMessage("system", "provider 列表暂时加载失败，将继续使用服务端默认路由。可稍后刷新页面，或运行 health / doctor 检查服务配置。", "system");
        return;
      }
      const providers = response.payload?.data ?? response.payload ?? [];
      const models = [];
      for (const provider of Array.isArray(providers) ? providers : []) {
        for (const model of provider.models ?? []) {
          if (!isVisibleProviderModel(provider.id, model.id)) continue;
          models.push({
            providerId: provider.id,
            modelId: model.id,
            label: provider.displayName + " / " + model.displayName,
            endpoint: provider.suggestedEndpoint || model.metadata?.providerEndpoint || "",
            runtimeCredentialPersisted: provider.metadata?.runtimeCredentialPersisted === true,
            runtimeCredentialStorage: provider.metadata?.runtimeCredentialStorage || "memory-only",
          });
        }
      }
      for (const model of models) {
        const option = document.createElement("option");
        option.value = model.providerId + "::" + model.modelId;
        option.textContent = model.label;
        option.dataset.endpoint = model.endpoint || "";
        option.dataset.runtimeCredentialPersisted = model.runtimeCredentialPersisted ? "true" : "false";
        option.dataset.runtimeCredentialStorage = model.runtimeCredentialStorage || "memory-only";
        providerSelect.appendChild(option);
      }
      restoreProviderPreference();
      updateComposerModelStatus();
      if (models.length === 0) {
        appendMessage("system", "当前没有可选择的 provider 模型；聊天会尝试服务端默认路由。如仍失败，请检查 provider 配置。", "system");
      }
    }

    async function runEnterprisePreflight() {
      const checks = [
        { id: "service_health", path: "/health/check" },
        { id: "deployment_readiness", path: "/enterprise/deployment/readiness" },
        { id: "startup_readiness", path: "/enterprise/startup/readiness" },
        { id: "security_readiness", path: "/enterprise/security/readiness" },
        { id: "vector_readiness", path: "/knowledge/infra/readiness" },
      ];
      const results = [];
      for (const check of checks) {
        const result = await requestJson(check.path);
        const data = result.payload?.data ?? {};
        const status = data.status || (result.ok ? "ready" : "blocked");
        const blockers = Array.isArray(data.blockers) ? data.blockers : [];
        results.push({
          id: check.id,
          path: check.path,
          httpStatus: result.httpStatus,
          ok: result.ok,
          status,
          blockers,
          warnings: Array.isArray(data.warnings) ? data.warnings : [],
        });
      }
      const blockers = results
        .filter((item) => !item.ok || item.status === "blocked")
        .map((item) => item.id + ":" + item.httpStatus + ":" + item.status);
      const warnings = results
        .filter((item) => item.status === "warning" || item.status === "not-ready" || item.status === "not-configured")
        .map((item) => item.id + ":" + item.status);
      return {
        ok: blockers.length === 0,
        httpStatus: blockers.length ? 409 : 200,
        payload: {
          data: {
            phase: "phase40a-enterprise-deployment-preflight",
            mode: "ui-readonly-enterprise-preflight",
            status: blockers.length ? "blocked" : "ready",
            blockers,
            warnings,
            checks: results,
          },
        },
      };
    }

    function checkEnterpriseConfigDraft(text) {
      const parsed = parseEnterpriseEnvText(text);
      const required = [
        "AI_GATEWAY_PROVIDER_MODE",
        "AI_GATEWAY_REAL_PROVIDER_ENABLED",
        "AI_GATEWAY_ROUTE_MODE",
        "AI_GATEWAY_DEFAULT_PROVIDER",
        "AI_GATEWAY_ENABLED_PROVIDERS",
        "NVIDIA_MODEL",
        "NVIDIA_API_KEY",
        "KNOWLEDGE_STORAGE_MODE",
        "KNOWLEDGE_PERSISTENCE_DIR",
        "PME_ENTERPRISE_AUTH_ENABLED",
        "PME_AUTH_TOKEN",
        "PME_AUTH_USER_ID",
        "PME_AUTH_TENANT_ID",
        "PME_AUTH_ROLE",
        "PME_AUTH_EXPIRES_AT",
        "PME_ENTERPRISE_USER_STORE_PATH",
        "PME_AUDIT_LOG_PATH",
        "PME_ENTERPRISE_BACKUP_DIR",
      ];
      const vector = [
        "KNOWLEDGE_INFRA_MODE",
        "KNOWLEDGE_EMBEDDING_PROVIDER",
        "KNOWLEDGE_EMBEDDING_MODEL",
        "KNOWLEDGE_EMBEDDING_API_KEY",
        "KNOWLEDGE_VECTOR_STORE",
        "PGVECTOR_CONNECTION_STRING",
        "PGVECTOR_TABLE",
        "KNOWLEDGE_VECTOR_NAMESPACE",
      ];
      const secretKeys = [
        "NVIDIA_API_KEY",
        "KNOWLEDGE_EMBEDDING_API_KEY",
        "PGVECTOR_CONNECTION_STRING",
        "PME_AUTH_TOKEN",
        "PME_ENTERPRISE_USERS_JSON",
      ];
      const missing = required.filter((key) => !isConfiguredEnvValue(parsed[key]));
      const vectorMode = String(parsed.KNOWLEDGE_INFRA_MODE || "").trim() === "vector";
      const missingVector = vectorMode ? vector.filter((key) => !isConfiguredEnvValue(parsed[key])) : [];
      const secretPresence = {};
      for (const key of secretKeys) {
        secretPresence[key] = {
          present: isConfiguredEnvValue(parsed[key]),
          valueExposed: false,
        };
      }
      return {
        ok: missing.length === 0 && missingVector.length === 0,
        httpStatus: missing.length || missingVector.length ? 409 : 200,
        payload: {
          data: {
            phase: "phase41a-enterprise-config-wizard",
            mode: "browser-local-only",
            uploaded: false,
            valuesEchoed: false,
            configuredKeyCount: Object.keys(parsed).length,
            missingRequired: missing,
            vectorMode,
            missingVectorRequired: missingVector,
            secretPresence,
            nextChecks: [
              "cmd /c pnpm verify:enterprise",
              "cmd /c pnpm verify:phase23 when vector mode is enabled",
              "cmd /c pnpm dev:phase7b",
            ],
          },
        },
      };
    }

    function parseEnterpriseEnvText(text) {
      const parsed = {};
      for (const rawLine of String(text || "").split(/\\r?\\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const index = line.indexOf("=");
        if (index <= 0) continue;
        const key = line.slice(0, index).trim();
        let value = line.slice(index + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        parsed[key] = value;
      }
      return parsed;
    }

    function isConfiguredEnvValue(value) {
      const normalized = String(value || "").trim();
      return Boolean(normalized && !/^<.*>$/.test(normalized));
    }

    async function handleChatCommandCenter(prompt) {
      const intent = detectChatCommandIntent(prompt);
      if (!intent) return false;

      appendMessage("user", prompt, "user");
      const assistant = appendMessage("assistant", "", "assistant", { persist: false });
      setMessagePrompt(assistant, prompt);
      setMessageStatus(assistant, "正在处理本地指令...", "active");

      try {
        if (intent === "model-config") {
          await renderModelConfigCommand(assistant);
        } else if (intent === "status") {
          await renderStatusCommand(assistant);
        } else if (intent === "health") {
          await renderHealthCommand(assistant);
        } else if (intent === "knowledge") {
          await renderKnowledgeCommand(assistant);
        } else if (intent === "enterprise") {
          await renderEnterpriseCommand(assistant);
        } else if (intent === "workflow") {
          await renderWorkflowCommand(assistant, prompt);
        } else if (intent === "capability-panel") {
          renderCapabilityPanelCommand(assistant);
        } else {
          renderCommandCenterHelp(assistant);
        }
        saveChatHistory();
        scrollChatToBottom();
      } catch (error) {
        assistant.className = "message assistant error";
        setMessageStatus(assistant, "本地指令执行失败。", "error");
        setMessageText(assistant, "这条指令没有调用大模型，但本地 API 返回了错误：\\n" + describeError(error));
        saveChatHistory();
      }

      return true;
    }

    function detectChatCommandIntent(prompt) {
      const rawText = String(prompt || "").trim();
      const text = normalizeChatCommandText(prompt);
      if (!text) return null;
      const shortCommand = isShortCommandText(rawText, 18);
      if (includesAny(text, ["配置模型", "模型配置", "切换模型", "切模型", "provider", "api key", "apikey", "nvidia", "gemini", "openai"])) {
        return "model-config";
      }
      if (includesAny(text, ["业务流程", "本地流程", "自动化", "生成报告", "流程报告", "workflow", "run workflow", "执行流程"])) {
        return "workflow";
      }
      if (includesAny(text, ["企业状态", "企业总览", "企业治理", "上线预检", "部署准备", "安全准备", "审计", "enterprise", "governance", "preflight", "audit"])) {
        return "enterprise";
      }
      if (
        includesAny(text, ["知识源", "知识状态", "知识健康", "knowledge source"]) ||
        (shortCommand && includesAny(text, ["知识库", "资料库", "source", "sources"]))
      ) {
        return "knowledge";
      }
      if (includesAny(text, ["能力面板", "打开面板", "高级面板", "高级能力", "能力中心", "panel", "dashboard", "capability"])) {
        return "capability-panel";
      }
      if (includesAny(text, ["健康检查", "健康状态", "health", "doctor", "自检"])) {
        return "health";
      }
      if (includesAny(text, ["运行状态", "服务状态", "当前状态", "状态", "status", "ready", "running"])) {
        return "status";
      }
      if (includesAny(text, ["帮助", "怎么用", "能做什么", "命令中心", "command center", "help"])) {
        return "help";
      }
      return null;
    }

    function isShortCommandText(text, maxLength) {
      const compact = String(text || "").replace(/\s+/g, "");
      return compact.length > 0 && compact.length <= maxLength && !/[?？。,.，]/.test(text);
    }

    function normalizeChatCommandText(value) {
      return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[，。！？；：、,.!?;:()[\]{}"']/g, " ")
        .replace(/\s+/g, " ");
    }

    function includesAny(text, keywords) {
      return keywords.some((keyword) => text.includes(keyword));
    }

    async function renderModelConfigCommand(assistant) {
      const [providers, runtime] = await Promise.all([
        requestJson("/providers"),
        requestJson("/config/runtime"),
      ]);
      return renderModelConfigWizardCommand(assistant, providers, runtime);
      const card = createChatCommandCard(
        assistant,
        "model-config",
        "模型配置",
        "我可以在聊天窗口里帮你查看当前模型能力，并把本次浏览器会话的聊天模型切到指定 provider/model。API Key 不会写进聊天记录，也不会在这里明文保存。",
      );

      const grid = appendCommandGrid(card);
      appendCommandRow(grid, "Provider 列表", providers.ok ? "已读取 /providers" : "读取失败 HTTP " + providers.httpStatus);
      appendCommandRow(grid, "运行配置", runtime.ok ? "已读取 /config/runtime" : "读取失败 HTTP " + runtime.httpStatus);
      appendCommandRow(grid, "当前选择", providerSelect.value || "服务端自动路由");
      appendCommandRow(grid, "记住的选择", describeProviderPreference());
      appendCommandRow(grid, "安全边界", "聊天窗口可记住 provider/model；API Key 不明文保存，长期密钥仍应通过启动环境变量或正式配置入口管理。");

      const select = document.createElement("select");
      select.dataset.commandProviderSelect = "true";
      const optionValues = collectProviderOptions(providers);
      for (const optionInfo of optionValues) {
        const option = document.createElement("option");
        option.value = optionInfo.value;
        option.textContent = optionInfo.label;
        select.appendChild(option);
      }
      select.value = providerSelect.value;
      card.appendChild(select);

      const secretInput = document.createElement("input");
      secretInput.type = "password";
      secretInput.dataset.commandSecretDraft = "true";
      secretInput.placeholder = "API Key 草稿检查，不会保存";
      secretInput.autocomplete = "off";
      card.appendChild(secretInput);

      const actions = appendCommandActions(card);
      const applyButton = appendCommandButton(actions, "应用到当前聊天");
      applyButton.dataset.commandAction = "apply-provider";
      const persistButton = appendCommandButton(actions, "记住默认选择");
      persistButton.dataset.commandAction = "persist-provider";
      const clearPreferenceButton = appendCommandButton(actions, "清除记住的选择");
      clearPreferenceButton.dataset.commandAction = "clear-provider-preference";
      const probeButton = appendCommandButton(actions, "检测当前模型是否可用");
      probeButton.dataset.commandAction = "probe-provider";
      const checkSecretButton = appendCommandButton(actions, "检查密钥草稿");
      checkSecretButton.dataset.commandAction = "check-secret";
      const envTemplateButton = appendCommandButton(actions, "生成启动配置模板");
      envTemplateButton.dataset.commandAction = "generate-env-template";
      const openPanelButton = appendCommandButton(actions, "打开高级面板");
      openPanelButton.dataset.commandAction = "open-advanced-panel";
      const output = appendCommandJson(card, {
        providers: summarizeProviders(providers),
        runtime: redactSecrets(runtime.payload?.data ?? runtime.payload ?? {}),
        persistedPreference: readProviderPreference(),
      });

      applyButton.addEventListener("click", () => {
        providerSelect.value = select.value;
        output.textContent = JSON.stringify({
          applied: true,
          selected: providerSelect.value || "server-default-route",
          scope: "current-browser-session",
          persistedSecret: false,
        }, null, 2);
        appendMessage("system", "已把当前聊天模型选择切换为：" + (providerSelect.value || "服务端自动路由"), "system");
      });
      persistButton.addEventListener("click", () => {
        providerSelect.value = select.value;
        const preference = persistProviderPreference(providerSelect.value, "chat-command-card");
        output.textContent = JSON.stringify({
          persisted: true,
          preference,
          scope: "current-browser",
          secretPersisted: false,
        }, null, 2);
        appendMessage("system", "已记住默认聊天模型：" + (providerSelect.value || "服务端自动路由"), "system");
      });
      clearPreferenceButton.addEventListener("click", () => {
        clearProviderPreference();
        output.textContent = JSON.stringify({
          persisted: false,
          preferenceCleared: true,
          selected: providerSelect.value || "server-default-route",
          secretPersisted: false,
        }, null, 2);
        appendMessage("system", "已清除浏览器里记住的默认模型选择。", "system");
      });
      checkSecretButton.addEventListener("click", () => {
        output.textContent = JSON.stringify({
          apiKeyDraftPresent: Boolean(secretInput.value.trim()),
          apiKeyValueStored: false,
          apiKeyValueSentToServer: false,
          nextStep: "检测或保存时才会发送给本地服务；不要把密钥发进普通聊天。",
        }, null, 2);
      });
      envTemplateButton.addEventListener("click", () => {
        output.textContent = createProviderStartupTemplate(select.value, Boolean(secretInput.value.trim()));
      });
      openPanelButton.addEventListener("click", () => side.classList.add("open"));

      setMessageStatus(assistant, "模型配置卡片已就绪。", "done");
    }

    function renderModelConfigWizardCommand(assistant, providers, runtime) {
      const openContext = pendingModelConfigOpenContext;
      pendingModelConfigOpenContext = null;
      const repairContext = openContext?.mode === "restore-recovery" ? openContext : null;
      const optionValues = collectProviderOptions(providers);
      const currentValue = providerSelect.value || "";
      const preference = readProviderPreference();
      const runtimeData = runtime.payload?.data ?? runtime.payload ?? {};
      const currentLabel = providerLabelFromValue(currentValue, optionValues) || "服务端自动选择";
      const rememberedLabel = providerLabelFromValue(preference?.value || "", optionValues) || "还没有记住默认模型";
      const readyToChoose = providers.ok && optionValues.length > 0;

      const card = createChatCommandCard(
        assistant,
        "model-config",
        "添加聊天模型",
        "粘贴 Key，我会真实查询服务商模型列表；选一个可聊天模型，保存后直接用。",
      );
      card.dataset.commandWizard = "model-config-v2";
      if (repairContext) {
        card.dataset.modelConfigRecoveryMode = "restore-recovery";
        card.dataset.modelConfigRecoveryValue = repairContext.value || "";
      }

      const summary = document.createElement("div");
      summary.className = "chat-config-summary";
      appendConfigSummary(summary, "当前", currentLabel);
      appendConfigSummary(summary, "已记住", rememberedLabel);
      appendConfigSummary(summary, "服务", describeRuntimeRoute(runtimeData));
      card.appendChild(summary);

      const status = document.createElement("span");
      status.className = "chat-config-status " + (readyToChoose ? "" : "warn");
      status.textContent = readyToChoose ? "可选模型已加载" : "暂时读不到模型";
      card.appendChild(status);

      const effectStatus = appendConfigEffectStatus(card, {
        current: currentValue ? "当前使用：" + currentLabel : "当前使用服务端自动路由。",
        currentTone: currentValue ? "ok" : "neutral",
        remembered: preference?.value ? "下次打开恢复：" + rememberedLabel : "还没有默认模型。",
        rememberedTone: preference?.value ? "ok" : "neutral",
        restart: "保存后会进入本机配置；生产部署仍建议用正式密钥管理。",
        restartTone: "warn",
      });

      const wizard = document.createElement("div");
      wizard.className = "chat-config-wizard";
      card.appendChild(wizard);

      const stepOne = appendConfigStep(wizard, "1", "选择模型", "先用推荐项；需要时再手动换。");
      const select = document.createElement("select");
      select.dataset.commandProviderSelect = "true";
      for (const optionInfo of optionValues) {
        const option = document.createElement("option");
        option.value = optionInfo.value;
        option.textContent = optionInfo.label;
        select.appendChild(option);
      }
      select.value = currentValue;
      stepOne.appendChild(select);

      const stepTwo = appendConfigStep(wizard, "2", "粘贴 Key", "粘贴后点“一键检测并保存”。不确定服务商就保持自动。");
      const secretInput = document.createElement("input");
      secretInput.type = "password";
      secretInput.dataset.commandSecretDraft = "true";
      secretInput.placeholder = "粘贴 Key";
      secretInput.autocomplete = "off";
      stepTwo.appendChild(secretInput);

      const providerHintSelect = document.createElement("select");
      providerHintSelect.dataset.commandProviderHint = "true";
      [
        ["auto", "自动识别服务商"],
        ["nvidia", "NVIDIA"],
        ["openai", "OpenAI"],
        ["openrouter", "OpenRouter"],
        ["dashscope", "阿里百炼 / DashScope"],
        ["deepseek", "DeepSeek"],
        ["groq", "Groq"],
        ["together", "Together AI"],
        ["mistral", "Mistral"],
        ["xai", "xAI"],
        ["moonshot", "Moonshot / Kimi"],
        ["siliconflow", "硅基流动 / SiliconFlow"],
        ["tencent-hunyuan", "腾讯混元"],
        ["qianfan", "百度千帆"],
        ["zhipu", "智谱 GLM"],
        ["xunfei-spark", "讯飞星火"],
        ["modelscope", "ModelScope"],
        ["cohere", "Cohere"],
        ["volcengine-doubao", "火山方舟 / 豆包"],
        ["minimax", "MiniMax"],
        ["stepfun", "阶跃星辰 / StepFun"],
        ["novita", "Novita AI"],
        ["baichuan", "百川智能"],
        ["yi", "零一万物 / 01.AI"],
        ["infini-ai", "无问芯穹 / Infini AI"],
        ["huggingface", "Hugging Face Router"],
        ["perplexity", "Perplexity"],
        ["fireworks", "Fireworks AI"],
        ["cerebras", "Cerebras"],
        ["anthropic", "Anthropic Claude（识别 / 列模型）"],
        ["gemini", "Gemini"],
        ["openai-compatible", "OpenAI-compatible / 中转 Base URL"],
      ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        providerHintSelect.appendChild(option);
      });
      stepTwo.appendChild(providerHintSelect);

      const baseUrlInput = document.createElement("input");
      baseUrlInput.type = "url";
      baseUrlInput.dataset.commandBaseUrl = "true";
      baseUrlInput.placeholder = "可选：中转 / OpenAI-compatible base URL";
      baseUrlInput.autocomplete = "off";
      stepTwo.appendChild(baseUrlInput);

      const manualModelInput = document.createElement("input");
      manualModelInput.type = "text";
      manualModelInput.dataset.commandManualModelId = "true";
      manualModelInput.placeholder = "可选：手动模型 ID";
      manualModelInput.autocomplete = "off";
      stepTwo.appendChild(manualModelInput);

      const actions = appendCommandActions(stepTwo);
      const detectButton = appendCommandButton(actions, "识别可用模型");
      detectButton.dataset.commandAction = "detect-provider-from-key";
      const quickApplyProbeButton = appendCommandButton(actions, "一键检测并保存");
      quickApplyProbeButton.className = "primary";
      quickApplyProbeButton.dataset.commandAction = "apply-and-probe-provider";
      if (repairContext) {
        select.value = repairContext.value || select.value;
        if (Array.from(providerHintSelect.options).some((option) => option.value === repairContext.providerHint)) {
          providerHintSelect.value = repairContext.providerHint;
        }
        baseUrlInput.value = repairContext.endpoint || "";
        manualModelInput.value = repairContext.modelId || "";
        secretInput.dataset.recoveryRecommended = "true";
        providerHintSelect.dataset.recoveryPrefilled = "true";
        baseUrlInput.dataset.recoveryPrefilled = repairContext.endpoint ? "true" : "false";
        manualModelInput.dataset.recoveryPrefilled = repairContext.modelId ? "true" : "false";
        quickApplyProbeButton.textContent = "重新检测";
        quickApplyProbeButton.dataset.recoveryAction = "true";
      }
      const persistButton = appendCommandButton(actions, "设为默认");
      persistButton.dataset.commandAction = "persist-provider";

      const advancedOptions = document.createElement("details");
      advancedOptions.className = "chat-config-details";
      advancedOptions.dataset.commandAdvancedOptions = "true";
      const advancedSummary = document.createElement("summary");
      advancedSummary.textContent = "高级设置";
      advancedOptions.appendChild(advancedSummary);
      stepTwo.appendChild(advancedOptions);
      const advancedActions = appendCommandActions(advancedOptions);
      const applyButton = appendCommandButton(advancedActions, "只应用本次");
      applyButton.dataset.commandAction = "apply-provider";
      const probeButton = appendCommandButton(advancedActions, "只检测");
      probeButton.dataset.commandAction = "probe-provider";
      const clearPreferenceButton = appendCommandButton(advancedActions, "清除默认");
      clearPreferenceButton.dataset.commandAction = "clear-provider-preference";

      const startupOptions = document.createElement("details");
      startupOptions.className = "chat-config-details";
      startupOptions.dataset.commandStartupOptions = "true";
      const startupSummary = document.createElement("summary");
      startupSummary.textContent = "启动命令";
      startupOptions.appendChild(startupSummary);
      wizard.appendChild(startupOptions);
      const stepThree = appendConfigStep(startupOptions, "3", "长期启动", "需要命令行部署时再看这里；日常用户不用管。");

      const secretActions = appendCommandActions(stepThree);
      const checkSecretButton = appendCommandButton(secretActions, "检查草稿");
      checkSecretButton.dataset.commandAction = "check-secret";
      const envTemplateButton = appendCommandButton(secretActions, "复制启动模板");
      envTemplateButton.dataset.commandAction = "generate-env-template";
      const openPanelButton = appendCommandButton(secretActions, "高级面板");
      openPanelButton.dataset.commandAction = "open-advanced-panel";

      const feedback = document.createElement("div");
      feedback.className = "chat-config-feedback";
      feedback.dataset.commandFeedback = "true";
      setConfigFeedback(feedback, "下一步", [
        readyToChoose ? "粘贴 Key，然后点“一键检测并保存”。" : "先确认服务已启动，再重新打开配置。",
        "通过后会自动回到聊天输入框。",
        "高级设置平时不用管。"
      ]);
      appendConfigFeedbackActions(feedback, [
        { label: "粘贴 Key", action: "focus-api-key-draft", primary: true, onClick: () => focusModelConfigControl(secretInput) },
        { label: "开始识别", action: "run-model-detect", onClick: () => detectButton.click() },
        { label: "填 Base URL", action: "focus-base-url", onClick: () => focusModelConfigControl(baseUrlInput) },
      ]);
      if (repairContext) {
        setConfigEffectItem(effectStatus.current, "warn", "正在修复已恢复但发送失败的模型：" + (repairContext.label || repairContext.value || "当前模型"));
        setConfigEffectItem(effectStatus.remembered, "warn", "浏览器已记住这个模型，但需要重新验证 API Key、provider、base URL 和模型。");
        setConfigFeedback(feedback, "正在修复已恢复的模型配置", [
          "我已经把当前 provider、模型 ID 和能读取到的 base URL 带入向导。",
        "如果只是 provider 临时波动，可以直接点“重新检测模型”。",
        "如果是 API Key、权限、余额或 base URL 变了，请先替换 API Key 或补齐 base URL，再重新检测。",
        pendingModelConfigRetryPrompt ? "修复通过后，我会给你一个“继续刚才的问题”按钮，不用重新输入。" : "",
      ], "warn");
        appendConfigFeedbackActions(feedback, [
          { label: "重新检测模型", action: "repair-restored-model-probe", primary: true, onClick: () => quickApplyProbeButton.click() },
          { label: "替换 API Key", action: "repair-replace-api-key", onClick: () => focusModelConfigControl(secretInput) },
          { label: "检查 Base URL", action: "repair-check-base-url", onClick: () => focusModelConfigControl(baseUrlInput) },
        ]);
        setTimeout(() => focusModelConfigControl(secretInput), 0);
      }
      card.appendChild(feedback);

      appendConfigDetails(card, "查看原始配置与诊断", {
        providers: summarizeProviders(providers),
        runtime: redactSecrets(runtimeData),
        persistedPreference: preference,
        safety: {
          currentBrowserProviderModelCanPersist: true,
          apiKeyStoredInBrowser: false,
          apiKeySentFromWizard: true,
          apiKeySecretStorage: "local-user-file",
          defaultChatMainLaneChanged: false,
        },
      });

      select.addEventListener("change", () => {
        setConfigEffectItem(effectStatus.current, "warn", "已选中但未应用：" + (providerLabelFromValue(select.value, optionValues) || "服务端自动选择"));
        setConfigFeedback(feedback, "已选择模型", [
          providerLabelFromValue(select.value, optionValues) || "服务端自动选择",
          "点“一键检测并保存”后，这个窗口会立刻使用它。",
        ]);
      });

      detectButton.addEventListener("click", async () => {
        await detectProviderFromApiKeyDraft({
          select,
          optionValues,
          apiKeyDraft: secretInput.value.trim(),
          providerHint: providerHintSelect.value,
          baseUrl: baseUrlInput.value.trim(),
          manualModelId: manualModelInput.value.trim(),
          secretInput,
          providerHintSelect,
          baseUrlInputElement: baseUrlInput,
          manualModelInputElement: manualModelInput,
          applyProbeButton: quickApplyProbeButton,
          persistButton,
          feedback,
          effectStatus,
          button: detectButton,
        });
      });

      quickApplyProbeButton.addEventListener("click", async () => {
        const apiKeyDraft = secretInput.value.trim();
        if (apiKeyDraft && !(showFakeProvidersInUi && isFakeProviderValue(select.value))) {
          const detection = await detectProviderFromApiKeyDraft({
            select,
            optionValues,
            apiKeyDraft,
            providerHint: providerHintSelect.value,
            baseUrl: baseUrlInput.value.trim(),
            manualModelId: manualModelInput.value.trim(),
            secretInput,
            providerHintSelect,
            baseUrlInputElement: baseUrlInput,
            manualModelInputElement: manualModelInput,
            applyProbeButton: quickApplyProbeButton,
            persistButton,
            feedback,
            effectStatus,
            button: quickApplyProbeButton,
          });
          if (detection.blocked) {
            return;
          }
        } else if (!select.value) {
          select.value = resolveRecommendedProviderValue(optionValues);
        }
        providerSelect.value = select.value;
        let selectedLabel = providerLabelFromValue(providerSelect.value, optionValues) || "服务端自动选择";
        const credentialResult = await saveRuntimeProviderCredentialIfNeeded({
          providerValue: providerSelect.value,
          optionValues,
          apiKeyDraft,
          baseUrl: baseUrlInput.value.trim(),
          feedback,
          effectStatus,
        });
        if (credentialResult.blocked) {
          return;
        }
        if (credentialResult.providerValue && credentialResult.providerValue !== select.value) {
          const selectedOption = optionValues.find((option) => option.value === select.value);
          const runtimeParts = splitProviderModel(credentialResult.providerValue);
          ensureProviderOption(select, optionValues, {
            value: credentialResult.providerValue,
            label: (credentialResult.providerId || runtimeParts.providerId) + " / " + (credentialResult.displayName || credentialResult.modelId || runtimeParts.modelId),
            capabilities: selectedOption?.capabilities || ["chat", "summary"],
            modalities: selectedOption?.modalities || {},
            supportedParameters: selectedOption?.supportedParameters || [],
            execution: {
              ...(selectedOption?.execution || {}),
              chat: true,
              currentRuntime: "model-import-confirm",
            },
            endpoint: selectedOption?.endpoint || "",
            apiKeyRef: selectedOption?.apiKeyRef || "",
            modelImportSource: selectedOption?.modelImportSource || "model-import-confirm",
          });
          select.value = credentialResult.providerValue;
          providerSelect.value = credentialResult.providerValue;
          selectedLabel = providerLabelFromValue(providerSelect.value, optionValues) || selectedLabel;
        }
        if (credentialResult.saved) {
          secretInput.value = "";
        }
        updateComposerModelStatus({ status: "checking", label: selectedLabel, reason: "正在检测" });
        setConfigEffectItem(effectStatus.current, "ok", "已生效于当前聊天：" + selectedLabel);
        setConfigEffectItem(
          effectStatus.restart,
          credentialResult.saved ? "warn" : "warn",
          credentialResult.saved
            ? (credentialResult.persisted ? "API Key 已保存到本机用户配置；服务重启后会自动恢复。" : "API Key 已添加到当前服务内存；服务重启后需要重新添加或使用启动环境变量。")
            : "仅当前页面生效；服务重启后仍按启动环境变量。",
        );
        appendMessage("system", (credentialResult.saved ? (credentialResult.persisted ? "已保存 API Key 并开始检测当前聊天模型：" : "已添加 API Key 并开始检测当前聊天模型：") : "已应用并开始检测当前聊天模型：") + selectedLabel, "system");
        await runConfigProviderAvailabilityProbe({
          select,
          optionValues,
          effectStatus,
          feedback,
          button: quickApplyProbeButton,
          credentialSaved: credentialResult.saved,
          credentialPersisted: credentialResult.persisted,
          retryButton: quickApplyProbeButton,
          providerHintSelect,
          baseUrlInputElement: baseUrlInput,
          persistButton,
        });
      });

      applyButton.addEventListener("click", () => {
        providerSelect.value = select.value;
        updateComposerModelStatus({ status: "not-checked", reason: "已应用，未检测" });
        setConfigEffectItem(effectStatus.current, "ok", "已生效于当前聊天：" + (providerLabelFromValue(providerSelect.value, optionValues) || "服务端自动选择"));
        setConfigEffectItem(effectStatus.restart, "warn", "仅当前页面生效；服务重启后仍按启动环境变量。");
        setConfigFeedback(feedback, "已经应用到当前聊天", [
          providerLabelFromValue(providerSelect.value, optionValues) || "服务端自动选择",
          "这只是当前页面会话的选择；需要长期使用请设为默认。",
        ]);
        appendMessage("system", "已应用到当前聊天：" + (providerLabelFromValue(providerSelect.value, optionValues) || "服务端自动选择"), "system");
      });

      persistButton.addEventListener("click", () => {
        providerSelect.value = select.value;
        const nextPreference = persistProviderPreference(providerSelect.value, "chat-config-wizard");
        const persistedParts = splitProviderModel(providerSelect.value);
        const persistedLabel = providerLabelFromValue(providerSelect.value, optionValues) || "服务端自动选择";
        updateComposerModelStatus({ status: composerModelProbeState.status, reason: composerModelProbeState.reason });
        setConfigEffectItem(effectStatus.current, "ok", "已生效于当前聊天：" + persistedLabel);
        setConfigEffectItem(
          effectStatus.remembered,
          nextPreference.saved ? "ok" : "warn",
          nextPreference.saved ? "已记住；刷新页面后会自动恢复。" : "当前浏览器不允许保存，刷新后可能不会恢复。",
        );
        setConfigEffectItem(effectStatus.restart, "warn", "浏览器会记住模型选择；如果 API Key 已添加并保存，服务重启后也会自动恢复。");
        setConfigFeedback(feedback, "已设为默认", [
          "Provider 已识别：" + (persistedParts.providerId || "服务端当前配置"),
          "模型已选择：" + (persistedParts.modelId || persistedLabel),
          "聊天可用状态：" + (composerModelProbeState.status === "passed" ? "已通过，可以继续聊。" : "建议再点“一键检测并保存”。"),
          "默认模型：" + persistedLabel,
          nextPreference.saved ? "刷新这个浏览器页面后会自动恢复这个模型选择。" : "当前浏览器不允许 localStorage，无法记住选择。",
          "Key 不写入浏览器、聊天记录、日志或 evidence。",
        ], nextPreference.saved ? "ok" : "warn");
        appendModelConfigSuccessActions(feedback, {
          retryPrompt: pendingModelConfigRetryPrompt,
        });
        appendMessage("system", "已记住默认聊天模型：" + persistedLabel, "system");
      });

      probeButton.addEventListener("click", async () => {
        providerSelect.value = select.value;
        await runConfigProviderAvailabilityProbe({
          select,
          optionValues,
          effectStatus,
          feedback,
          button: probeButton,
          retryButton: probeButton,
          providerHintSelect,
          baseUrlInputElement: baseUrlInput,
          persistButton,
        });
      });

      clearPreferenceButton.addEventListener("click", () => {
        clearProviderPreference();
        select.value = "";
        updateComposerModelStatus({ status: "not-checked", reason: "未检测" });
        setConfigEffectItem(effectStatus.current, "neutral", "当前聊天回到服务端自动路由。");
        setConfigEffectItem(effectStatus.remembered, "neutral", "已清除；刷新页面不会恢复旧选择。");
        setConfigEffectItem(effectStatus.restart, "warn", "服务重启配置没有被修改。");
        setConfigFeedback(feedback, "已经清除记住的默认选择", [
          "以后刷新页面会回到服务端自动选择。",
          "这不会删除任何服务端配置，也不会影响知识库。"
        ]);
        appendMessage("system", "已清除浏览器里记住的默认模型选择。", "system");
      });

      checkSecretButton.addEventListener("click", () => {
        const hasDraft = Boolean(secretInput.value.trim());
        setConfigFeedback(feedback, hasDraft ? "检测到密钥草稿" : "还没有填写密钥草稿", [
          hasDraft ? "已检测到草稿；点击“一键检测并保存”时才会发送到本地服务。" : "只切换当前聊天模型时，可以不填 Key。",
          "不会显示、不写入浏览器、不写入 evidence。长期生效请使用启动配置模板设置 PowerShell 环境变量。"
        ], hasDraft ? "ok" : "warn");
      });

      envTemplateButton.addEventListener("click", async () => {
        const template = createProviderStartupTemplate(select.value, Boolean(secretInput.value.trim()));
        setConfigEffectItem(effectStatus.restart, "ok", "启动模板已生成；复制到 PowerShell 并重启服务后才会长期生效。");
        setConfigFeedback(feedback, "启动模板已生成", [
          "我已经生成可复制的 PowerShell 模板，里面只包含占位符，不包含你的真实 API Key。",
          template,
        ]);
        await copyTextToClipboard(template).catch(() => undefined);
      });

      openPanelButton.addEventListener("click", () => {
        side.classList.add("open");
        setConfigFeedback(feedback, "高级面板已打开", [
          "普通聊天配置优先在这里完成。",
          "高级面板只适合查看更细的系统能力，不是日常必须入口。"
        ]);
      });

      setMessageStatus(assistant, "模型配置已打开。", "done");
    }

    function appendConfigSummary(parent, label, value) {
      const item = document.createElement("div");
      item.className = "chat-config-summary-item";
      const title = document.createElement("strong");
      title.textContent = label;
      const body = document.createElement("span");
      body.textContent = String(value || "未设置");
      item.appendChild(title);
      item.appendChild(body);
      parent.appendChild(item);
      return item;
    }

    function appendConfigStep(parent, index, title, helper) {
      const step = document.createElement("section");
      step.className = "chat-config-step";
      const badge = document.createElement("span");
      badge.className = "chat-config-step-index";
      badge.textContent = index;
      const body = document.createElement("div");
      body.className = "chat-config-step-body";
      const heading = document.createElement("strong");
      heading.textContent = title;
      const note = document.createElement("div");
      note.className = "chat-config-helper";
      note.textContent = helper;
      body.appendChild(heading);
      body.appendChild(note);
      step.appendChild(badge);
      step.appendChild(body);
      parent.appendChild(step);
      return body;
    }

    function appendConfigEffectStatus(parent, state) {
      const wrapper = document.createElement("section");
      wrapper.className = "chat-config-effect";
      wrapper.dataset.configEffectStatus = "true";
      const title = document.createElement("div");
      title.className = "chat-config-effect-title";
      title.textContent = "配置是否已生效";
      wrapper.appendChild(title);
      const list = document.createElement("div");
      list.className = "chat-config-effect-list";
      wrapper.appendChild(list);
      const current = appendConfigEffectItem(list, "当前聊天", state.current, state.currentTone);
      const remembered = appendConfigEffectItem(list, "下次打开", state.remembered, state.rememberedTone);
      const restart = appendConfigEffectItem(list, "服务重启", state.restart, state.restartTone);
      parent.appendChild(wrapper);
      return { wrapper, current, remembered, restart };
    }

    function appendConfigEffectItem(parent, label, value, tone = "neutral") {
      const item = document.createElement("div");
      item.className = "chat-config-effect-item " + tone;
      const title = document.createElement("strong");
      const dot = document.createElement("span");
      dot.className = "chat-config-dot";
      const labelNode = document.createElement("span");
      labelNode.textContent = label;
      title.appendChild(dot);
      title.appendChild(labelNode);
      const body = document.createElement("span");
      body.dataset.configEffectValue = "true";
      body.textContent = String(value || "未设置");
      item.appendChild(title);
      item.appendChild(body);
      parent.appendChild(item);
      return item;
    }

    function setConfigEffectItem(item, tone, value) {
      item.className = "chat-config-effect-item " + (tone || "neutral");
      const body = item.querySelector("[data-config-effect-value]");
      if (body) body.textContent = String(value || "");
    }

    function setConfigFeedback(target, title, lines, tone = "ok") {
      target.className = "chat-config-feedback" + (tone === "warn" ? " warn" : "");
      target.replaceChildren();
      delete target.dataset.modelConfigSuccess;
      const heading = document.createElement("strong");
      heading.textContent = title;
      target.appendChild(heading);
      for (const line of Array.isArray(lines) ? lines : [lines]) {
        if (String(line || "").includes("\\n") || String(line || "").startsWith("# ") || String(line || "").startsWith("$env:")) {
          const pre = document.createElement("pre");
          pre.dataset.commandJson = "true";
          pre.textContent = String(line || "");
          target.appendChild(pre);
          continue;
        }
        const paragraph = document.createElement("p");
        paragraph.textContent = String(line || "");
        target.appendChild(paragraph);
      }
    }

    function compactModelConfigSuccessFeedback(target, visibleParagraphCount = 4) {
      const paragraphs = Array.from(target.querySelectorAll(":scope > p"));
      if (paragraphs.length <= visibleParagraphCount) {
        target.classList.add("compact");
        target.dataset.modelConfigSuccess = "compact";
        return;
      }
      const details = document.createElement("details");
      details.className = "chat-config-details";
      details.dataset.modelConfigSuccessDetails = "true";
      const summary = document.createElement("summary");
      summary.textContent = "查看检测细节";
      details.appendChild(summary);
      for (const paragraph of paragraphs.slice(visibleParagraphCount)) {
        details.appendChild(paragraph);
      }
      target.appendChild(details);
      target.classList.add("compact");
      target.dataset.modelConfigSuccess = "compact";
    }

    function appendConfigFeedbackActions(target, actions) {
      const available = (Array.isArray(actions) ? actions : []).filter((action) => action && typeof action.onClick === "function");
      if (!available.length) return null;
      const wrapper = document.createElement("div");
      wrapper.className = "chat-command-actions";
      wrapper.dataset.modelConfigNextActions = "true";
      for (const action of available) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = action.label;
        button.dataset.commandAction = action.action || "model-config-next-action";
        if (action.primary) button.className = "primary";
        button.addEventListener("click", action.onClick);
        wrapper.appendChild(button);
      }
      target.appendChild(wrapper);
      return wrapper;
    }

    function focusModelConfigControl(control) {
      if (!control) return;
      const details = control.closest?.("details");
      if (details) details.open = true;
      control.scrollIntoView?.({ block: "center", behavior: "smooth" });
      control.focus?.();
    }

    function isMaskedApiKeyDraft(value) {
      const text = String(value || "").trim();
      return Boolean(text) && (/\*{3,}|•{3,}|●{3,}|·{3,}/.test(text));
    }

    function showModelConfigDiagnosticCommands(feedback) {
      setConfigFeedback(feedback, "排查命令", [
        "如果模型添加或聊天连续失败，先按下面顺序看状态；这些命令不会修改模型配置。",
        "cmd /c pnpm health:phase12a\\ncmd /c pnpm doctor:phase13a\\ncmd /c pnpm logs:phase16a",
        "如果是 OpenAI-compatible / 中转 key，请同时确认 provider 和 base URL 是否来自同一个服务商。",
      ], "warn");
      appendConfigFeedbackActions(feedback, [
        { label: "回到聊天输入", action: "continue-chat-after-diagnostics", primary: true, onClick: () => focusModelConfigControl(input) },
      ]);
    }

    function appendModelConfigRecoveryActions(feedback, context = {}) {
      const actions = [];
      if (context.retryButton) {
        actions.push({ label: "重新检测", action: "retry-model-probe", primary: true, onClick: () => context.retryButton.click() });
      }
      actions.push(
        { label: "选择 provider", action: "focus-provider-hint", onClick: () => focusModelConfigControl(context.providerHintSelect || context.select) },
        { label: "填写 Base URL", action: "focus-base-url", onClick: () => focusModelConfigControl(context.baseUrlInputElement) },
        { label: "手填模型 ID", action: "focus-manual-model-id", onClick: () => focusModelConfigControl(context.manualModelInputElement) },
        { label: "查看排查命令", action: "show-model-diagnostic-commands", onClick: () => showModelConfigDiagnosticCommands(feedback) },
      );
      appendConfigFeedbackActions(feedback, actions);
    }

    function appendModelConfigSuccessActions(feedback, context = {}) {
      const actions = [];
      if (context.retryPrompt) {
        actions.push({
          label: "继续刚才的问题",
          action: "continue-last-failed-prompt",
          primary: true,
          onClick: async () => {
            const prompt = context.retryPrompt;
            pendingModelConfigRetryPrompt = "";
            await sendChat(prompt);
          },
        });
      }
      if (context.applyProbeButton) {
        actions.push({ label: "一键检测并保存", action: "apply-detected-model", primary: !context.retryPrompt, onClick: () => context.applyProbeButton.click() });
      }
      if (context.persistButton) {
        actions.push({ label: "设为默认", action: "persist-detected-model", onClick: () => context.persistButton.click() });
      }
      actions.push({ label: "继续聊天", action: "continue-chat-after-model-check", onClick: () => focusReadyChatInput() });
      appendConfigFeedbackActions(feedback, actions);
    }

    function focusReadyChatInput() {
      composerReadyNudge = "已经能聊。直接输入问题，或拖文件进来。";
      input.placeholder = "模型已就绪，直接输入问题。";
      updateSessionStatus("模型已就绪。");
      focusModelConfigControl(input);
      syncComposerState();
    }

    async function detectProviderFromApiKeyDraft({
      select,
      optionValues,
      apiKeyDraft,
      providerHint = "auto",
      baseUrl = "",
      manualModelId = "",
      secretInput,
      providerHintSelect,
      baseUrlInputElement,
      manualModelInputElement,
      applyProbeButton,
      persistButton,
      feedback,
      effectStatus,
      button,
    }) {
      if (!apiKeyDraft) {
        setConfigEffectItem(effectStatus.current, "warn", "还没有粘贴 Key，暂时无法识别。");
        setConfigFeedback(feedback, "先粘贴 Key", [
          "粘贴后我会用真实 models/list 查服务商和模型，不靠前缀乱猜。",
          "支持常见国际与国内 provider；中转服务请补 Base URL。",
          "Key 不写入聊天记录、浏览器或 evidence。",
        ], "warn");
        appendConfigFeedbackActions(feedback, [
          { label: "粘贴 Key", action: "focus-api-key-draft", primary: true, onClick: () => focusModelConfigControl(secretInput) },
          { label: "选服务商", action: "focus-provider-hint", onClick: () => focusModelConfigControl(providerHintSelect) },
          { label: "填 Base URL", action: "focus-base-url", onClick: () => focusModelConfigControl(baseUrlInputElement) },
        ]);
        return { blocked: true };
      }

      if (isMaskedApiKeyDraft(apiKeyDraft)) {
        setConfigEffectItem(effectStatus.current, "warn", "需要完整 API Key，不能使用脱敏文本。");
        setConfigFeedback(feedback, "请重新粘贴完整 API Key", [
          "当前输入看起来包含 **** 或圆点，它只是脱敏显示，不是真实密钥。",
          "我不会把脱敏文本发给 provider，也不会用它猜模型。",
          "请重新粘贴完整 API Key；如果是中转服务，请同时填写 Base URL。",
        ], "warn");
        appendConfigFeedbackActions(feedback, [
          { label: "重新粘贴 Key", action: "focus-api-key-draft", primary: true, onClick: () => focusModelConfigControl(secretInput) },
          { label: "选择 provider", action: "focus-provider-hint", onClick: () => focusModelConfigControl(providerHintSelect) },
          { label: "填写 Base URL", action: "focus-base-url", onClick: () => focusModelConfigControl(baseUrlInputElement) },
        ]);
        return { blocked: true };
      }

      if (button) button.disabled = true;
      setConfigEffectItem(effectStatus.current, "warn", "正在识别可用模型。");
      setConfigFeedback(feedback, "正在检测", [
        "我会调用服务商 models/list 拿真实模型列表。",
        "识别不准时会让你选择服务商，不会乱绑模型。",
      ], "warn");

      try {
        const normalizedProviderHint = String(providerHint || "auto").trim();
        const preferredProviderId = normalizedProviderHint && normalizedProviderHint !== "auto"
          ? normalizedProviderHint
          : "auto";
        const explicitBaseUrl = String(baseUrl || "").trim() || extractBaseUrlFromText(apiKeyDraft) || null;
        const result = await requestJson("/models/import/preview", {
          method: "POST",
          body: {
            apiKey: apiKeyDraft,
            providerHint: preferredProviderId || "auto",
            baseUrl: explicitBaseUrl,
          },
        });
        const data = result.payload?.data ?? {};
        const candidates = flattenModelImportPreviewCandidates(data);
        const requestFailure = summarizeModelImportRequestFailure(result, data);
        if (requestFailure) {
          setConfigEffectItem(effectStatus.current, "warn", "模型检测请求没有连到本地服务。");
          setConfigFeedback(feedback, requestFailure.title, requestFailure.lines, "warn");
          appendModelConfigRecoveryActions(feedback, {
            retryButton: button,
            select,
            providerHintSelect,
            baseUrlInputElement,
            manualModelInputElement,
          });
          return { blocked: true };
        }

        if (!result.ok || result.payload?.success === false || candidates.length === 0) {
          const detectedSummary = summarizeCredentialDetection(data);
          const capabilitySummary = formatCredentialCapabilitySummary(data);
          const allDiscoveredModels = Array.isArray(data.models) ? data.models : [];
          const manualCandidate = createManualProviderCandidate({
            providerHint: preferredProviderId,
            selectedValue: select.value,
            baseUrl: explicitBaseUrl,
            manualModelId,
          });
          if (manualCandidate) {
            ensureProviderOption(select, optionValues, manualCandidate);
            select.value = manualCandidate.value;
            providerSelect.value = manualCandidate.value;
            setConfigEffectItem(effectStatus.current, "warn", "准备手动实测：" + manualCandidate.label);
            setConfigFeedback(feedback, "需要真实检测", [
              detectedSummary || "models/list 没有返回可直接添加的聊天模型。",
              "已使用你指定的服务商和模型：" + manualCandidate.label,
              "点“一键检测并保存”后，会走 /chat 做真实可用性验证。",
              "通过才会保存；失败会显示服务商返回的错误。",
            ], "warn");
            appendConfigFeedbackActions(feedback, [
              { label: "检测并保存", action: "apply-manual-model-probe", primary: true, onClick: () => applyProbeButton?.click?.() },
              { label: "改模型 ID", action: "focus-manual-model-id", onClick: () => focusModelConfigControl(manualModelInputElement) },
              { label: "填 Base URL", action: "focus-base-url", onClick: () => focusModelConfigControl(baseUrlInputElement) },
              { label: "排查命令", action: "show-model-diagnostic-commands", onClick: () => showModelConfigDiagnosticCommands(feedback) },
            ]);
            return { blocked: false, value: manualCandidate.value, manual: true };
          }
          if (allDiscoveredModels.length > 0 && candidates.length === 0) {
            setConfigEffectItem(effectStatus.current, "warn", "已识别服务商，但没有聊天模型。");
            setConfigFeedback(feedback, "没有可聊天模型", [
              detectedSummary || "服务商已返回模型列表。",
              capabilitySummary ? "能力识别：" + capabilitySummary : "能力识别：已发现 " + allDiscoveredModels.length + " 个模型。",
              "已发现的模型：" + formatModelImportModelPreview(allDiscoveredModels),
              "当前聊天窗口只添加 chat / completion / reasoning 模型。",
              "非聊天模型会识别出来，但不会伪装成聊天模型。",
            ], "warn");
            appendConfigFeedbackActions(feedback, [
              { label: "手填模型", action: "focus-manual-model-id", primary: true, onClick: () => focusModelConfigControl(manualModelInputElement) },
              { label: "选服务商", action: "focus-provider-hint", onClick: () => focusModelConfigControl(providerHintSelect || select) },
              { label: "填 Base URL", action: "focus-base-url", onClick: () => focusModelConfigControl(baseUrlInputElement) },
              { label: "重新检测", action: "retry-model-probe", onClick: () => button?.click?.() },
              { label: "排查命令", action: "show-model-diagnostic-commands", onClick: () => showModelConfigDiagnosticCommands(feedback) },
            ]);
            return { blocked: true };
          }
          if (data.status === "needs_provider_selection" || data.status === "needs_base_url") {
            setConfigEffectItem(effectStatus.current, "warn", "需要选择服务商或填写 Base URL。");
            setConfigFeedback(feedback, "需要你确认服务商", [
              detectedSummary || "请选择服务商，或填写 OpenAI-compatible Base URL。",
              capabilitySummary ? "能力识别：" + capabilitySummary : "能力识别：还没有拿到 provider models/list 结果。",
              "第三方中转、Cloudflare、Coze 等请选 OpenAI-compatible 并填 Base URL。",
              "Key 只发给你确认的服务商或 Base URL。",
            ], "warn");
            appendConfigFeedbackActions(feedback, [
              { label: "选服务商", action: "focus-provider-hint", primary: true, onClick: () => focusModelConfigControl(providerHintSelect || select) },
              { label: "填 Base URL", action: "focus-base-url", onClick: () => focusModelConfigControl(baseUrlInputElement) },
              { label: "重新检测", action: "retry-model-probe", onClick: () => button?.click?.() },
            ]);
            return { blocked: true };
          }
          setConfigEffectItem(effectStatus.current, "warn", "没有找到可添加的聊天模型。");
          setConfigFeedback(feedback, "暂时不能添加到聊天", [
            detectedSummary || "我还不能确认这把 key 对应哪个聊天服务商。",
            capabilitySummary ? "能力识别：" + capabilitySummary : "能力识别：未拿到可用模型能力。",
            "如果它是视觉、生图、语音、视频或 embedding key，当前不会伪装成聊天模型。",
            "如果是中转 key，请选 OpenAI-compatible 并填写 Base URL。",
            "我不会把失败的 key 强行加到 NVIDIA。",
          ], "warn");
          appendModelConfigRecoveryActions(feedback, {
            retryButton: button,
            select,
            providerHintSelect,
            baseUrlInputElement,
            manualModelInputElement,
          });
          return { blocked: true };
        }

        for (const candidate of candidates) {
          ensureProviderOption(select, optionValues, candidate);
        }

        const selected = candidates[0];
        select.value = selected.value;
        providerSelect.value = selected.value;
        const providerCount = new Set(candidates.map((candidate) => candidate.providerId)).size;
        const capabilitySummary = formatCredentialCapabilitySummary(data);
        const needsChatProbe = candidates.some((candidate) => candidate.credentialValidated === false && candidate.modelDiscoveryStatus === "ready");
        setConfigEffectItem(effectStatus.current, "ok", "找到 " + candidates.length + " 个候选模型。");
        setConfigFeedback(feedback, "已找到可用模型", [
          "推荐：" + selected.label,
          "共 " + candidates.length + " 个候选，覆盖 " + providerCount + " 个服务商。你可以手动换一个。",
          capabilitySummary ? "能力识别：" + capabilitySummary : "能力识别：只找到当前聊天可用模型。",
          "下一步点“一键检测并保存”，我会用 /chat 做真实可用性验证。",
          "Key 不写入浏览器、聊天记录、日志或 evidence。",
        ]);
        appendModelConfigSuccessActions(feedback, {
          applyProbeButton,
          persistButton,
        });
        return { blocked: false, value: selected.value };
      } finally {
        if (button) button.disabled = false;
      }
    }

    function flattenModelImportPreviewCandidates(data) {
      const models = Array.isArray(data?.models) ? data.models : [];
      return models
        .filter((model) => model?.providerId && model?.modelId)
        .filter(isChatCapableModel)
        .map((model) => ({
          value: model.providerId + "::" + model.modelId,
          label: (data.providerId || model.providerId) + " / " + (model.displayName || model.modelId),
          providerId: model.providerId,
          modelId: model.modelId,
          apiKeyRef: data.apiKeyRef || "",
          modelImportSource: data.source || "provider_models_api",
          capabilities: Array.isArray(model.capabilities) ? model.capabilities : [],
          modalities: model.metadata?.modalities || {},
          supportedParameters: [],
          execution: { chat: true, currentRuntime: "model-import-confirm" },
          modelDiscoveryStatus: data.status,
          credentialValidated: data.status === "models_discovered",
        }));
    }

    function createManualProviderCandidate({ providerHint = "auto", selectedValue = "", baseUrl = "", manualModelId = "" } = {}) {
      const modelId = String(manualModelId || "").trim();
      if (!modelId) return null;

      const selectedProvider = splitProviderModel(selectedValue).providerId;
      const hintedProvider = String(providerHint || "auto").trim();
      const rawProviderId = hintedProvider && hintedProvider !== "auto"
        ? hintedProvider
        : selectedProvider;
      if (!rawProviderId || isFakeProviderModel(rawProviderId, modelId)) return null;

      const runtimeProviderId = rawProviderId === "openai-compatible"
        ? "generic-openai-compatible"
        : rawProviderId;
      const endpoint = String(baseUrl || "").trim();
      if ((runtimeProviderId === "generic-openai-compatible" || rawProviderId === "openai-compatible") && !endpoint) {
        return null;
      }

      return {
        value: runtimeProviderId + "::" + modelId,
        label: rawProviderId + " / " + modelId + "（手动模型 ID，需真实检测）",
        providerId: runtimeProviderId,
        modelId,
        endpoint,
        capabilities: ["chat", "summary"],
        modalities: { text: true },
        supportedParameters: [],
        execution: { chat: true, currentRuntime: "runtime-credential-probe" },
        modelImportSource: "manual_user_input",
        credentialValidated: false,
      };
    }

    function isChatCapableModel(model) {
      const capabilities = Array.isArray(model?.capabilities) ? model.capabilities.map((item) => String(item).toLowerCase()) : [];
      return capabilities.includes("chat") || capabilities.includes("completion") || capabilities.includes("reasoning");
    }

    function flattenCredentialDetectionCandidates(data) {
      const detected = Array.isArray(data?.detected) ? data.detected : [];
      const candidates = [];
      for (const provider of detected) {
        if (!provider?.availableForChat || !provider?.supportedByRuntime) continue;
        for (const model of provider.models ?? []) {
          if (!model?.modelId) continue;
          if (model.execution?.chat !== true) continue;
          candidates.push({
            value: provider.providerId + "::" + model.modelId,
            label: (provider.providerDisplayName || provider.providerId) + " / " + (model.modelDisplayName || model.modelId),
            providerId: provider.providerId,
            modelId: model.modelId,
            endpoint: provider.suggestedEndpoint || model.metadata?.providerEndpoint || "",
            capabilities: Array.isArray(model.capabilities) ? model.capabilities : [],
            modalities: model.modalities || {},
            supportedParameters: Array.isArray(model.supportedParameters) ? model.supportedParameters : [],
            execution: model.execution || {},
            modelDiscoveryStatus: provider.modelDiscovery?.status,
            credentialValidated: provider.modelDiscovery?.credentialValidated === true,
          });
        }
      }
      const recommendedValue = data?.recommended?.value;
      candidates.sort((a, b) => rankCredentialCandidate(a, recommendedValue) - rankCredentialCandidate(b, recommendedValue));
      return candidates;
    }

    function rankCredentialCandidate(candidate, recommendedValue) {
      if (candidate.value === recommendedValue) return 0;
      if (candidate.providerId && String(candidate.providerId).includes("fake")) return 90;
      if (candidate.credentialValidated) return 10;
      if (Array.isArray(candidate.capabilities) && candidate.capabilities.includes("chat")) return 15;
      return 20;
    }

    function summarizeModelImportRequestFailure(result, data) {
      if (data?.status || result?.ok) return null;
      const message = result?.payload?.error?.message || "unknown request failure";
      if (result?.httpStatus === 0) {
        return {
          title: "模型检测没有连到本地服务",
          lines: [
            "这不是 API Key 类型不支持，而是浏览器没有成功请求到 /models/import/preview。",
            "常见原因：服务没有启动、刚刚重启中、页面缓存还是旧脚本，或本地 3100 端口暂时不可达。",
            "请先确认运行 cmd /c pnpm dev:phase7b，再刷新页面后重试。原始错误：" + message,
          ],
        };
      }
      return {
        title: "模型检测接口返回异常",
        lines: [
          "这不是 API Key 文本匹配失败；后端接口返回了 HTTP " + result.httpStatus + "。",
          "请运行 health / doctor / logs 查看服务状态。原始错误：" + message,
        ],
      };
    }

    function formatModelImportModelPreview(models) {
      const items = (Array.isArray(models) ? models : []).slice(0, 8).map((model) => {
        const capabilities = Array.isArray(model.capabilities) && model.capabilities.length
          ? " [" + model.capabilities.join(", ") + "]"
          : "";
        return (model.providerId || "provider") + "/" + (model.displayName || model.modelId || "model") + capabilities;
      });
      const suffix = models.length > items.length ? " 等 " + models.length + " 个" : "";
      return items.join("；") + suffix;
    }

    function summarizeCredentialDetection(data) {
      if (data?.userMessage) {
        const actions = Array.isArray(data.nextActions) && data.nextActions.length
          ? "\n下一步：" + data.nextActions.join("；")
          : "";
        return data.userMessage + actions;
      }
      if (data?.status) {
        const candidates = Array.isArray(data.providerCandidates) && data.providerCandidates.length
          ? "候选 provider：" + data.providerCandidates.join(", ")
          : "";
        if (data.status === "needs_provider_selection") {
          return "无法仅凭 API Key 判断服务商。请选择 provider，或填写 OpenAI-compatible base URL 后继续检测。" + (candidates ? "\\n" + candidates : "");
        }
        if (data.status === "needs_base_url") {
          return "这个 key 可能来自 OpenAI-compatible 或第三方中转平台。请填写 base URL，或手动选择明确 provider 后继续检测。" + (candidates ? "\\n" + candidates : "");
        }
        if (data.status === "invalid_api_key") {
          return "provider models API 拒绝了这把 key。请确认 key、余额、权限和 provider 是否匹配。" + (candidates ? "\\n" + candidates : "");
        }
        if (data.status === "provider_detected_but_no_chat_models") {
          return "已经识别到 provider，但返回的模型没有当前聊天窗口可直接执行的 chat 能力。";
        }
        if (data.status === "provider_detected_but_models_empty") {
          return "已经识别到 provider，但 models/list 返回为空。";
        }
        if (data.status === "probe_failed") {
          return "models/list 探测失败。请检查网络、provider 状态、base URL 或稍后重试。" + (candidates ? "\\n" + candidates : "");
        }
      }
      const detected = Array.isArray(data?.detected) ? data.detected : [];
      if (!detected.length) {
        return "没有识别到已支持的 key 类型。";
      }
      return detected.map((item) => {
        const name = item.providerDisplayName || item.providerId || "unknown";
        const status = item.availableForChat ? "可用于聊天" : "当前聊天不可用";
        return name + "：" + status + "；" + (item.reason || item.status || "");
      }).join("\\n");
    }

    function formatCredentialCapabilitySummary(data) {
      if (Array.isArray(data?.models)) {
        const models = data.models;
        const chatExecutable = models.filter(isChatCapableModel).length;
        const providerCount = new Set(models.map((model) => model.providerId).filter(Boolean)).size || (data.providerId ? 1 : 0);
        const capabilityCounts = {};
        for (const model of models) {
          for (const capability of model.capabilities ?? []) {
            const key = String(capability || "").toLowerCase();
            capabilityCounts[key] = (capabilityCounts[key] ?? 0) + 1;
          }
        }
        const extras = Object.entries(capabilityCounts)
          .filter(([key]) => key !== "chat")
          .slice(0, 6)
          .map(([key, count]) => key + " " + count);
        return ["provider " + providerCount, "模型 " + models.length, "当前可接入聊天 " + chatExecutable, ...extras].join(" / ");
      }
      const summary = data?.capabilitySummary || {};
      const counts = summary.byCapability || {};
      const hasUsefulSummary = Number(summary.totalProviders || 0) > 0 ||
        Number(summary.totalModels || 0) > 0 ||
        Object.values(counts).some((count) => Number(count || 0) > 0);
      if (!hasUsefulSummary) {
        return "";
      }
      const items = [
        ["chat", "聊天"],
        ["vision", "视觉"],
        ["reasoning", "推理"],
        ["coding", "编程"],
        ["tool-use", "工具调用"],
        ["structured-output", "结构化输出"],
        ["image-generation", "生图"],
        ["audio-input", "听觉/转写"],
        ["speech-output", "语音输出"],
        ["video-generation", "视频"],
        ["embedding", "向量/embedding"],
        ["rerank", "重排"],
        ["moderation", "安全审核"],
      ]
        .map(([key, label]) => Number(counts[key] || 0) > 0 ? label + " " + Number(counts[key] || 0) : "")
        .filter(Boolean);
      const chatExecutable = Number(summary.chatExecutableModels || 0);
      const head = [
        "provider " + Number(summary.totalProviders || 0),
        "模型 " + Number(summary.totalModels || 0),
        "当前可接入聊天 " + chatExecutable,
      ];
      return [...head, ...items.slice(0, 8)].join(" / ");
    }

    function ensureProviderOption(select, optionValues, optionInfo) {
      if (!optionInfo?.value) return;
      if (!optionValues.some((item) => item.value === optionInfo.value)) {
        optionValues.push({
          value: optionInfo.value,
          label: optionInfo.label || optionInfo.value,
          capabilities: optionInfo.capabilities || [],
          modalities: optionInfo.modalities || {},
          supportedParameters: optionInfo.supportedParameters || [],
          execution: optionInfo.execution || {},
          endpoint: optionInfo.endpoint || "",
          apiKeyRef: optionInfo.apiKeyRef || "",
          modelImportSource: optionInfo.modelImportSource || "",
        });
      }
      ensureSelectOption(select, optionInfo);
      ensureSelectOption(providerSelect, optionInfo);
    }

    function ensureSelectOption(selectNode, optionInfo) {
      if (!selectNode || Array.from(selectNode.options).some((option) => option.value === optionInfo.value)) {
        return;
      }
      if (selectNode === providerSelect && !isVisibleProviderValue(optionInfo.value)) {
        return;
      }
      const option = document.createElement("option");
      option.value = optionInfo.value;
      option.textContent = optionInfo.label || optionInfo.value;
      option.dataset.endpoint = optionInfo.endpoint || "";
      option.dataset.apiKeyRef = optionInfo.apiKeyRef || "";
      option.dataset.modelImportSource = optionInfo.modelImportSource || "";
      if (optionInfo.runtimeCredentialPersisted != null) {
        option.dataset.runtimeCredentialPersisted = optionInfo.runtimeCredentialPersisted ? "true" : "false";
      }
      if (optionInfo.runtimeCredentialStorage) {
        option.dataset.runtimeCredentialStorage = optionInfo.runtimeCredentialStorage;
      }
      selectNode.appendChild(option);
    }

    async function saveRuntimeProviderCredentialIfNeeded({ providerValue, optionValues, apiKeyDraft, baseUrl = "", feedback, effectStatus }) {
      if (!apiKeyDraft) {
        return { saved: false, blocked: false };
      }

      const { providerId, modelId } = splitProviderModel(providerValue);
      if (!providerId) {
        setConfigEffectItem(effectStatus.current, "warn", "需要先选择一个 provider/model，才能添加 API Key。");
        setConfigFeedback(feedback, "还不能添加 API Key", [
          "请先选择要添加到哪个 provider。",
          "如果你不想手选，我会优先推荐 NVIDIA；当前列表里没有可用 provider 时，请先检查服务配置。",
        ], "warn");
        return { saved: false, blocked: true };
      }

      setConfigFeedback(feedback, "正在添加 API Key", [
        "API Key 会发送到当前本地 ai-gateway-service，并保存到本机用户配置。",
        "不会写入浏览器、聊天记录、日志或 evidence；服务重启后会自动恢复已添加模型。",
      ], "warn");

      const selectedOption = (Array.isArray(optionValues) ? optionValues : []).find((option) => option.value === providerValue);
      if (selectedOption?.apiKeyRef) {
        const confirmResult = await requestJson("/models/import/confirm", {
          method: "POST",
          body: {
            providerId,
            modelId,
            apiKeyRef: selectedOption.apiKeyRef,
            displayName: selectedOption.label?.includes(" / ") ? selectedOption.label.split(" / ").slice(1).join(" / ") : modelId,
          },
        });

        if (!confirmResult.ok || confirmResult.payload?.success === false || confirmResult.payload?.data?.success === false) {
          const message = confirmResult.payload?.data?.reason || confirmResult.payload?.error?.message || confirmResult.payload?.message || "API Key add failed.";
          setConfigEffectItem(effectStatus.current, "warn", "API Key add failed: " + message);
          setConfigFeedback(feedback, "API Key 添加失败", [
            message,
            "未保存草稿。请重新粘贴 Key，并确认服务商能返回模型列表。",
          ], "warn");
          return { saved: false, blocked: true };
        }

        const data = confirmResult.payload?.data ?? {};
        setConfigEffectItem(effectStatus.current, "ok", "API Key 已按 provider models API 结果添加：" + (data.providerId || providerId));
        return {
          saved: true,
          blocked: false,
          providerId: data.runtimeProviderId || data.providerId || providerId,
          runtimeProviderId: data.runtimeProviderId || "",
          modelId: data.modelId || modelId,
          displayName: data.displayName || modelId,
          providerValue: (data.runtimeProviderId || data.providerId || providerId) + "::" + (data.modelId || modelId),
          secretStorage: data.secretStorage || "memory-only",
          persisted: data.persisted === true,
        };
      }

      const result = await requestJson("/providers/runtime-credential", {
        method: "POST",
        body: {
          providerId,
          modelId,
          models: createRuntimeModelsFromOptions(providerId, optionValues),
          apiKey: apiKeyDraft,
          endpoint: resolveRuntimeProviderEndpoint(providerId, providerValue, optionValues, apiKeyDraft, baseUrl),
          source: "web-chat-model-wizard",
        },
      });

      if (!result.ok || result.payload?.success === false) {
        const message = result.payload?.error?.message || result.payload?.message || "API Key 添加失败。";
        setConfigEffectItem(effectStatus.current, "warn", "API Key 添加失败：" + message);
        setConfigFeedback(feedback, "API Key 添加失败", [
          message,
          "我没有保存这次草稿；请检查 provider 选择和 key 是否正确。",
        ], "warn");
        return { saved: false, blocked: true };
      }

      const data = result.payload?.data ?? {};
      setConfigEffectItem(effectStatus.current, "ok", (data.persisted ? "API Key 已保存到本机配置：" : "API Key 已添加到当前服务：") + (data.providerId || providerId));
      return {
        saved: true,
        blocked: false,
        providerId: data.providerId || providerId,
        modelId,
        displayName: modelId,
        providerValue: (data.providerId || providerId) + "::" + modelId,
        secretStorage: data.secretStorage || "memory-only",
        persisted: data.persisted === true,
      };
    }

    function createRuntimeModelsFromOptions(providerId, optionValues) {
      return (Array.isArray(optionValues) ? optionValues : [])
        .map((option) => {
          const { providerId: optionProviderId, modelId } = splitProviderModel(option.value);
          if (optionProviderId !== providerId || !modelId) return null;
          const label = String(option.label || "");
          const displayName = label.includes(" / ") ? label.split(" / ").slice(1).join(" / ") : modelId;
          return {
            providerId,
            modelId,
            modelDisplayName: displayName,
            capabilities: Array.isArray(option.capabilities) && option.capabilities.length ? option.capabilities : ["chat", "summary"],
            modalities: option.modalities || {},
            supportedParameters: option.supportedParameters || [],
            source: "web-chat-model-wizard",
            metadata: {
              execution: option.execution || {},
              providerEndpoint: option.endpoint || "",
            },
          };
        })
        .filter(Boolean);
    }

    function resolveRuntimeProviderEndpoint(providerId, providerValue, optionValues, apiKeyDraft, baseUrl = "") {
      const selectedOption = (Array.isArray(optionValues) ? optionValues : []).find((option) => option.value === providerValue);
      if (selectedOption?.endpoint) return selectedOption.endpoint;
      if (String(baseUrl || "").trim()) return String(baseUrl || "").trim();
      if (providerId === "generic-openai-compatible") return extractBaseUrlFromText(apiKeyDraft);
      return "";
    }

    function extractBaseUrlFromText(text) {
      const match = String(text || "").match(new RegExp("https?://[^\\\\s\\\"'<>]+", "i"));
      if (!match) return "";
      let url = match[0].trim().replace(/[),.;，。]+$/, "");
      if (url.toLowerCase().endsWith("/chat/completions")) {
        url = url.slice(0, -"/chat/completions".length);
      } else if (url.toLowerCase().endsWith("/models")) {
        url = url.slice(0, -"/models".length);
      }
      while (url.endsWith("/")) url = url.slice(0, -1);
      const versionPath = url.slice(url.lastIndexOf("/") + 1).toLowerCase();
      const hasVersionSuffix = versionPath.length >= 2 &&
        versionPath[0] === "v" &&
        !Number.isNaN(Number(versionPath.slice(1)));
      if (!hasVersionSuffix) url += "/v1";
      return url;
    }

    function createModelConfigUsabilityStatusLines({
      selectedLabel,
      providerId,
      modelId,
      credentialSaved = false,
      credentialPersisted = false,
      probeSummary = {},
    }) {
      const providerText = providerId || "服务端当前配置";
      const modelText = modelId || probeSummary.providerModel || selectedLabel || "服务端自动选择";
      const runtimeText = credentialSaved
        ? (credentialPersisted ? "已加入当前服务，并写入本机用户配置；服务重启后会自动恢复。" : "已加入当前服务运行时；本次服务运行期间可以直接使用。")
        : "复用当前服务已有配置，没有写入新的 API Key。";
      const persistedText = credentialPersisted
        ? "已持久化到本机用户配置；刷新页面和服务重启后会自动恢复。"
        : (credentialSaved ? "当前 API Key 只在本次服务运行期间有效；需要长期使用时请保存到本机用户配置或启动环境。" : "没有新的 API Key 需要保存。");
      return [
        "当前聊天可用：可以直接继续提问，不需要再去别的面板操作。",
        "Provider 已识别：" + providerText,
        "模型已选择：" + modelText,
        "/chat 探测已通过：当前模型已经返回成功响应。",
        "已添加到当前服务：" + runtimeText,
        "默认选择状态：" + persistedText,
        "API Key 安全：不会写入浏览器、聊天记录、日志或 evidence。",
        probeSummary.preview ? "返回预览：" + probeSummary.preview : "",
      ].filter(Boolean);
    }

    async function runConfigProviderAvailabilityProbe({
      select,
      optionValues,
      effectStatus,
      feedback,
      button,
      credentialSaved = false,
      credentialPersisted = false,
      retryButton,
      providerHintSelect,
      baseUrlInputElement,
      persistButton,
    }) {
      providerSelect.value = select.value;
      const { providerId, modelId } = splitProviderModel(providerSelect.value);
      const selectedLabel = providerLabelFromValue(providerSelect.value, optionValues) || "服务端自动选择";
      if (button) button.disabled = true;
      updateComposerModelStatus({ status: "checking", label: selectedLabel, reason: "正在检测" });
      setConfigEffectItem(effectStatus.current, "warn", "正在检测当前模型是否能真实回答：" + selectedLabel);
      setConfigFeedback(feedback, "正在检测当前模型", [
        credentialSaved ? (credentialPersisted ? "API Key 已保存到本机用户配置，我会立刻用现有 /chat 路径发起一次很小的真实探测。" : "API Key 已进入当前本地服务内存，我会立刻用现有 /chat 路径发起一次很小的真实探测。") : "我会用现有 /chat 路径发起一次很小的真实探测。",
        "这不会改默认聊天主链；如果 provider 暂时超时，会在这里直接显示原因。",
      ], "warn");

      const result = await requestJson("/chat", {
        method: "POST",
        body: {
          prompt: "请用一句话回复：配置检测通过。",
          providerId: providerId || undefined,
          model: modelId || undefined,
          metadata: {
            surface: "chat-config-wizard",
            purpose: "provider-availability-check",
          },
        },
      });

      const probeSummary = summarizeConfigProbeResult(result);
      if (probeSummary.success) {
        updateComposerModelStatus({
          status: "passed",
          label: probeSummary.providerModel || selectedLabel,
          reason: "检测通过",
        });
        setConfigEffectItem(effectStatus.current, "ok", "检测通过；当前模型可以真实回答：" + (probeSummary.providerModel || selectedLabel));
        setConfigFeedback(feedback, "模型配置已生效，可以开始聊天", createModelConfigUsabilityStatusLines({
          selectedLabel,
          providerId,
          modelId,
          credentialSaved,
          credentialPersisted,
          probeSummary,
        }));
        compactModelConfigSuccessFeedback(feedback);
        appendModelConfigSuccessActions(feedback, {
          persistButton,
          retryPrompt: pendingModelConfigRetryPrompt,
        });
      } else {
        updateComposerModelStatus({
          status: "failed",
          label: selectedLabel,
          reason: probeSummary.reason,
        });
        setConfigEffectItem(effectStatus.current, "warn", "检测未通过：" + probeSummary.reason);
        setConfigFeedback(feedback, "当前模型暂不可用", createModelProbeRecoveryLines(probeSummary.reason), "warn");
        appendModelConfigRecoveryActions(feedback, {
          retryButton: retryButton || button,
          select,
          providerHintSelect,
          baseUrlInputElement,
        });
      }
      if (button) button.disabled = false;
    }

    function createModelProbeRecoveryLines(reason) {
      const raw = String(reason || "");
      const upper = raw.toUpperCase();
      const lines = [
        "错误原因：" + (raw || "检测请求未成功。"),
      ];
      if (upper.includes("401") || upper.includes("403") || upper.includes("UNAUTHORIZED") || upper.includes("FORBIDDEN")) {
        lines.push("下一步：确认服务商、Key、余额、权限和模型是否匹配。");
        lines.push("中转或 OpenAI-compatible Key 请填写 Base URL。");
      } else if (upper.includes("TIMEOUT") || upper.includes("TIMED OUT") || upper.includes("NETWORK") || upper.includes("RATE_LIMIT")) {
        lines.push("下一步：稍后再点“一键检测并保存”，或换一个更稳的模型。");
        lines.push("如果连续失败，请运行 health / doctor / logs，看本地服务和 provider 返回是否正常。");
      } else if (upper.includes("MODEL") || upper.includes("NOT EXIST") || upper.includes("NOT_FOUND")) {
        lines.push("下一步：点“识别可用模型”，从真实模型列表里选择。");
      } else {
        lines.push("下一步：先点“识别可用模型”；不行就选服务商或填 Base URL。");
      }
      lines.push("未通过检测的模型不会被标记为可用。");
      return lines;
    }

    function resolveRecommendedProviderValue(optionValues) {
      const values = optionValues.map((option) => option.value).filter(Boolean);
      return (
        values.find((value) => value.startsWith("nvidia::")) ||
        values.find((value) => value.includes("openai::")) ||
        values.find((value) => !value.includes("fake")) ||
        values[0] ||
        ""
      );
    }

    function summarizeConfigProbeResult(result) {
      const payload = result?.payload || {};
      const data = payload.data || {};
      const error = payload.error || data.errorSummary || {};
      const success = Boolean(result?.ok && payload.success !== false && data.errorSummary == null);
      const provider = data.selectedProvider || data.providerId || error.provider || "";
      const model = data.selectedModel || data.model || error.model || "";
      const preview = String(data.text || data.outputText || data.message?.content || "").trim().slice(0, 160);
      const code = payload.code || error.code || (result?.httpStatus ? "HTTP_" + result.httpStatus : "REQUEST_FAILED");
      const message = payload.message || error.message || "检测请求未成功。";
      return {
        success,
        providerModel: provider && model ? provider + " / " + model : provider || model || "",
        preview,
        reason: success ? "ok" : code + " / " + message,
      };
    }

    function appendConfigDetails(parent, summaryText, value) {
      const details = document.createElement("details");
      details.className = "chat-config-details";
      const summary = document.createElement("summary");
      summary.textContent = summaryText;
      const pre = document.createElement("pre");
      pre.dataset.commandJson = "true";
      pre.textContent = JSON.stringify(value, null, 2);
      details.appendChild(summary);
      details.appendChild(pre);
      parent.appendChild(details);
      return pre;
    }

    function providerLabelFromValue(value, options) {
      const match = (Array.isArray(options) ? options : []).find((item) => item.value === value);
      return match?.label || "";
    }

    function getCurrentProviderLabel() {
      const selected = providerSelect.options[providerSelect.selectedIndex];
      const value = providerSelect.value || "";
      if (!value) return "服务端自动选择";
      return selected?.textContent || value;
    }

    async function openModelConfigFromComposer() {
      if (chatSending) {
        appendMessage("system", "当前正在生成回答，完成后再打开模型配置。", "system");
        return;
      }
      pendingModelConfigOpenContext = composerModelStatus?.dataset.modelRecoveryRequired === "true"
        ? createModelConfigRepairContext()
        : null;
      await handleChatCommandCenter("配置模型");
      input.focus();
      syncComposerState();
    }

    function createModelConfigRepairContext() {
      const value = providerSelect.value || "";
      const { providerId, modelId } = splitProviderModel(value);
      const selectedOption = providerSelect.selectedOptions?.[0] || null;
      return {
        mode: "restore-recovery",
        value,
        providerId,
        modelId,
        label: getCurrentProviderLabel(),
        providerHint: inferProviderHintFromProviderId(providerId),
        endpoint: selectedOption?.dataset.endpoint || "",
        credentialStorage: composerModelStatus?.dataset.modelCredentialStorage || selectedOption?.dataset.runtimeCredentialStorage || "",
      };
    }

    function inferProviderHintFromProviderId(providerId) {
      const normalized = String(providerId || "").toLowerCase();
      if (!normalized) return "auto";
      if (normalized === "generic-openai-compatible" || normalized.includes("compatible")) return "openai-compatible";
      if (normalized.includes("nvidia")) return "nvidia";
      if (normalized.includes("gemini") || normalized.includes("google")) return "gemini";
      if (normalized.includes("dashscope") || normalized.includes("qwen")) return "dashscope";
      if (normalized.includes("zhipu") || normalized.includes("glm")) return "zhipu";
      if (normalized.includes("deepseek")) return "deepseek";
      if (normalized.includes("anthropic") || normalized.includes("claude")) return "anthropic";
      if (normalized.includes("openrouter")) return "openrouter";
      if (normalized.includes("moonshot") || normalized.includes("kimi")) return "moonshot";
      if (normalized.includes("siliconflow")) return "siliconflow";
      if (normalized.includes("volc") || normalized.includes("doubao")) return "volcengine-doubao";
      if (normalized.includes("openai")) return "openai";
      return normalized;
    }

    function updateComposerModelStatus(next = {}) {
      if (!composerModelStatus || !composerModelLabel || !composerModelProbe || !composerModelPreference) return;
      const value = providerSelect.value || "";
      const label = next.label || (next.value === value ? composerModelProbeState.label : "") || getCurrentProviderLabel();
      const status = next.status || (composerModelProbeState.value === value ? composerModelProbeState.status : "not-checked");
      const reason = next.reason || (composerModelProbeState.value === value ? composerModelProbeState.reason : "未检测");
      composerModelProbeState = {
        status,
        value,
        label,
        reason,
      };

      const preference = readProviderPreference();
      const remembered = Boolean(value && preference?.value === value);
      const selectedOption = providerSelect.selectedOptions?.[0] || null;
      const restoredFromLocalCredential = Boolean(value && remembered && selectedOption?.dataset.runtimeCredentialPersisted === "true");
      const runtimeCredentialStorage = selectedOption?.dataset.runtimeCredentialStorage || "";
      const failedRestoredCredential = status === "failed" && restoredFromLocalCredential;
      const tone = status === "passed" ? "ok" : status === "failed" ? "error" : status === "checking" ? "warn" : restoredFromLocalCredential ? "ok" : "neutral";
      const probeText = status === "passed"
        ? "检测通过"
        : status === "failed"
          ? (failedRestoredCredential ? "恢复配置需重新检测" : "检测未通过")
          : status === "checking"
            ? "正在检测"
            : restoredFromLocalCredential
              ? "本机配置已恢复"
              : reason || "未检测";

      composerModelStatus.className = "composer-model-status " + tone;
      composerModelStatus.dataset.modelProbeStatus = status;
      composerModelStatus.dataset.modelValue = value || "server-default-route";
      const modelParts = splitProviderModel(value);
      composerModelStatus.dataset.modelProviderId = modelParts.providerId || "";
      composerModelStatus.dataset.modelId = modelParts.modelId || "";
      composerModelStatus.dataset.modelReady = status === "passed" ? "true" : "false";
      composerModelStatus.dataset.modelRestoredFromLocal = restoredFromLocalCredential ? "true" : "false";
      composerModelStatus.dataset.modelCredentialStorage = runtimeCredentialStorage || "none";
      composerModelStatus.dataset.modelRecoveryRequired = failedRestoredCredential ? "true" : "false";
      composerModelLabel.textContent = "模型：" + (value ? label : "自动");
      composerModelProbe.textContent = probeText;
      composerModelPreference.textContent = failedRestoredCredential ? "需修复" : restoredFromLocalCredential ? "已恢复" : remembered ? "已记住" : "未记住";
      if (composerModelConfigButton) {
        composerModelConfigButton.textContent = failedRestoredCredential ? "重新检测模型" : "配置模型";
        composerModelConfigButton.setAttribute("aria-label", failedRestoredCredential ? "重新检测已恢复的模型配置" : "打开模型配置");
      }
      if (composerModelGuide) {
        composerModelGuide.textContent = status === "passed"
          ? "已经能聊。Key 不会保存在浏览器。"
          : status === "failed"
            ? (failedRestoredCredential
              ? "本机恢复的模型不可用，请重新检测。"
              : "检测未通过。换 Key、服务商、Base URL 或模型后再试。")
            : status === "checking"
              ? "正在检测，稍等一下。"
              : restoredFromLocalCredential
                ? "已从本机恢复，可以直接聊；需要时重新检测。"
              : "粘贴 Key，自动找模型。通过后直接聊。";
      }
      composerModelStatus.title = [
        "当前聊天模型：" + label,
        "检测状态：" + probeText,
        "刷新后恢复：" + (remembered ? "会恢复这个模型" : "不会恢复这个模型"),
        "服务重启恢复：" + (restoredFromLocalCredential ? "已从本机用户配置恢复" : "未确认本机恢复"),
        failedRestoredCredential ? "修复建议：重新检测已恢复配置" : "",
      ].join("\\n");
      syncComposerState();
    }

    function describeRuntimeRoute(runtimeData) {
      const data = runtimeData || {};
      const provider = data.defaultProvider || data.selectedProvider || data.provider || "";
      const mode = data.providerMode || data.mode || data.routeMode || "";
      if (provider && mode) return provider + " / " + mode;
      if (provider) return provider;
      if (mode) return mode;
      return "按服务端当前配置";
    }

    async function renderStatusCommand(assistant) {
      const service = await requestJson("/health/check");
      const card = createChatCommandCard(
        assistant,
        "status",
        "运行状态",
        "这是只读状态检查，只读取当前 ai-gateway-service 的健康状态，不扫描系统进程。",
      );
      const grid = appendCommandGrid(card);
      appendCommandRow(grid, "HTTP", String(service.httpStatus));
      appendCommandRow(grid, "结果", service.ok ? "service ready" : "service not ready");
      appendCommandRow(grid, "默认入口", "cmd /c pnpm status:phase10a");
      appendCommandRow(grid, "Web", window.location.origin + "/ui");
      appendCommandJson(card, redactSecrets(service.payload));
      setMessageStatus(assistant, service.ok ? "服务状态可读。" : "服务状态读取失败。", service.ok ? "done" : "warn");
    }

    async function renderHealthCommand(assistant) {
      const [service, knowledge, infra] = await Promise.all([
        requestJson("/health/check"),
        requestJson("/knowledge/health"),
        requestJson("/knowledge/infra/readiness"),
      ]);
      const card = createChatCommandCard(
        assistant,
        "health",
        "健康检查",
        "这是只读健康检查：服务健康、知识库健康、向量基础设施 readiness 会分开展示。",
      );
      const grid = appendCommandGrid(card);
      appendCommandRow(grid, "Service", service.ok ? "ready" : "failed HTTP " + service.httpStatus);
      appendCommandRow(grid, "Knowledge", knowledge.ok ? "ready" : "failed HTTP " + knowledge.httpStatus);
      appendCommandRow(grid, "Vector readiness", summarizeReadiness(infra));
      appendCommandRow(grid, "默认命令", "cmd /c pnpm health:phase12a");
      appendCommandJson(card, {
        service: redactSecrets(service.payload),
        knowledge: redactSecrets(knowledge.payload),
        infra: redactSecrets(infra.payload),
      });
      setMessageStatus(assistant, service.ok && knowledge.ok ? "健康检查完成。" : "健康检查有异常。", service.ok && knowledge.ok ? "done" : "warn");
    }

    async function renderKnowledgeCommand(assistant) {
      const [health, sources] = await Promise.all([
        requestJson("/knowledge/health"),
        requestJson("/knowledge/sources"),
      ]);
      const data = sources.payload?.data ?? {};
      const sourceList = Array.isArray(data.sources) ? data.sources : [];
      const card = createChatCommandCard(
        assistant,
        "knowledge",
        "知识库状态",
        "这是只读知识库检查。上传文件仍可以直接拖进聊天窗口，我会通过 /knowledge/load/file 放进当前知识库。",
      );
      const grid = appendCommandGrid(card);
      appendCommandRow(grid, "Knowledge health", health.ok ? "ready" : "failed HTTP " + health.httpStatus);
      appendCommandRow(grid, "Sources", String(sourceList.length));
      appendCommandRow(grid, "默认模式", "local-keyword / in-memory or configured persistence");
      appendCommandRow(grid, "检索入口", "聊天会自动调用 /chat/rag/stream；资料入口是 /knowledge/load/file");
      appendCommandJson(card, {
        health: redactSecrets(health.payload),
        sources: redactSecrets(sources.payload),
      });
      setMessageStatus(assistant, health.ok && sources.ok ? "知识库状态可读。" : "知识库状态读取失败。", health.ok && sources.ok ? "done" : "warn");
    }

    async function renderEnterpriseCommand(assistant) {
      const [overview, deployment, security, startup] = await Promise.all([
        requestJson("/enterprise/overview"),
        requestJson("/enterprise/deployment/readiness"),
        requestJson("/enterprise/security/readiness"),
        requestJson("/enterprise/startup/readiness"),
      ]);
      const card = createChatCommandCard(
        assistant,
        "enterprise",
        "企业状态总览",
        "这是只读企业状态检查：只汇总当前治理、部署、安全和启动准备度，不创建用户、不备份、不发布、不调用 provider。",
      );
      const grid = appendCommandGrid(card);
      appendCommandRow(grid, "Enterprise overview", overview.ok ? "ready" : "failed HTTP " + overview.httpStatus);
      appendCommandRow(grid, "部署准备度", summarizeReadiness(deployment));
      appendCommandRow(grid, "安全准备度", summarizeReadiness(security));
      appendCommandRow(grid, "启动准备度", summarizeReadiness(startup));
      appendCommandRow(grid, "默认验收", "cmd /c pnpm verify:enterprise");
      appendCommandJson(card, {
        overview: redactSecrets(overview.payload),
        deployment: redactSecrets(deployment.payload),
        security: redactSecrets(security.payload),
        startup: redactSecrets(startup.payload),
      });
      const passed = overview.ok && deployment.ok && security.ok && startup.ok;
      setMessageStatus(assistant, passed ? "企业状态已读取。" : "企业状态读取有异常。", passed ? "done" : "warn");
    }

    async function renderWorkflowCommand(assistant, prompt) {
      const goal = createWorkflowGoalFromPrompt(prompt);
      const run = await requestJson("/workflow/run", {
        method: "POST",
        body: {
          goal,
          topK: 3,
          artifactName: "chat-workflow-report.md",
          context: {
            surface: "chat-command-center",
            traceId: "web-chat-workflow",
          },
        },
      });
      const data = run.payload?.data ?? {};
      const card = createChatCommandCard(
        assistant,
        "workflow",
        "安全本地业务流程",
        "我已经按 allowlist 执行本地 workflow：只允许知识检索、报告生成、写入受控 artifact 目录，不执行任意 shell，不扫描系统文件。",
      );
      const grid = appendCommandGrid(card);
      appendCommandRow(grid, "HTTP", String(run.httpStatus));
      appendCommandRow(grid, "状态", data.status || (run.ok ? "completed" : "failed"));
      appendCommandRow(grid, "目标", goal);
      appendCommandRow(grid, "Artifact", data.artifact?.relativePath || "n/a");
      appendCommandRow(grid, "安全边界", "knowledge.retrieve -> report.compose -> artifact.write");
      appendCommandJson(card, redactSecrets(run.payload));
      setMessageStatus(assistant, run.ok ? "安全 workflow 已完成。" : "安全 workflow 执行失败。", run.ok ? "done" : "warn");
    }

    function createWorkflowGoalFromPrompt(prompt) {
      const text = String(prompt || "").trim();
      const cleaned = text
        .replace(/^(请)?(帮我)?(执行)?(一个)?(本地)?(安全)?(业务流程|自动化|workflow|生成报告)[:：\s]*/i, "")
        .trim();
      return cleaned || "根据当前知识库整理一个本地业务流程报告";
    }

    function renderCapabilityPanelCommand(assistant) {
      side.classList.add("open");
      const card = createChatCommandCard(
        assistant,
        "capability-panel",
        "能力面板已打开",
        "我已经把高级能力面板打开在右侧。主界面继续保持聊天入口，平时直接说需求即可。",
      );
      const grid = appendCommandGrid(card);
      appendCommandRow(grid, "打开方式", "在聊天框输入：打开能力面板 / 高级面板 / dashboard");
      appendCommandRow(grid, "主界面原则", "只保留聊天、上传、发送、停止这些必须手动操作的入口。");
      appendCommandRow(grid, "关闭方式", "点击右侧面板里的关闭按钮。");
      setMessageStatus(assistant, "能力面板已打开。", "done");
    }

    function renderCommandCenterHelp(assistant) {
      const card = createChatCommandCard(
        assistant,
        "help",
        "聊天命令中心",
        "你可以把系统操作直接说给我听。普通业务问题仍然走 AI Gateway；下面这些属于本地命令，不会调用大模型。",
      );
      const grid = appendCommandGrid(card);
      appendCommandRow(grid, "配置模型", "输入：配置模型 / 切换模型 / API key");
      appendCommandRow(grid, "看状态", "输入：服务状态 / 当前状态 / status");
      appendCommandRow(grid, "健康检查", "输入：健康检查 / health / doctor");
      appendCommandRow(grid, "知识库", "输入：知识库状态 / 知识源 / sources");
      appendCommandRow(grid, "企业状态", "输入：企业总览 / 上线预检 / enterprise");
      appendCommandRow(grid, "业务流程", "输入：业务流程 / 自动化 / 生成报告；会走安全 allowlist workflow");
      appendCommandRow(grid, "能力面板", "输入：打开能力面板 / 高级面板 / dashboard");
      appendCommandRow(grid, "上传资料", "直接把 PDF / Word / Excel / 文本拖进聊天窗口。");
      appendCommandJson(card, {
        defaultDailyFlow: [
          "cmd /c pnpm dev:phase7b",
          "cmd /c pnpm status:phase10a",
          "cmd /c pnpm health:phase12a",
          "cmd /c pnpm logs:phase16a",
          "cmd /c pnpm idle:phase15a",
        ],
        boundary: {
          chatMainLane: "NVIDIA single-provider remains unchanged",
          knowledgeDefault: "local-keyword",
          workflow: "allowlisted knowledge.retrieve -> report.compose -> artifact.write only",
          enterprise: "read-only status and bounded local governance surfaces",
          commandCenter: "browser UI command surface only",
        },
      });
      setMessageStatus(assistant, "命令中心已打开。", "done");
    }

    function createChatCommandCard(assistant, intent, title, lead) {
      setMessageText(assistant, lead);
      const textNode = assistant.querySelector(".message-text");
      const card = document.createElement("section");
      card.className = "chat-command-card";
      card.dataset.commandIntent = intent;
      const heading = document.createElement("h4");
      heading.textContent = title;
      card.appendChild(heading);
      const description = document.createElement("p");
      description.textContent = lead;
      card.appendChild(description);
      textNode?.appendChild(card);
      return card;
    }

    function appendCommandGrid(parent) {
      const grid = document.createElement("div");
      grid.className = "chat-command-grid";
      parent.appendChild(grid);
      return grid;
    }

    function appendCommandRow(parent, label, value) {
      const row = document.createElement("div");
      row.className = "chat-command-row";
      const labelNode = document.createElement("strong");
      labelNode.textContent = label;
      const valueNode = document.createElement("span");
      valueNode.textContent = String(value ?? "");
      row.appendChild(labelNode);
      row.appendChild(valueNode);
      parent.appendChild(row);
      return row;
    }

    function appendCommandActions(parent) {
      const actions = document.createElement("div");
      actions.className = "chat-command-actions";
      parent.appendChild(actions);
      return actions;
    }

    function appendCommandButton(parent, label) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      parent.appendChild(button);
      return button;
    }

    function appendCommandJson(parent, value) {
      const pre = document.createElement("pre");
      pre.dataset.commandJson = "true";
      pre.textContent = JSON.stringify(value, null, 2);
      parent.appendChild(pre);
      return pre;
    }

    function collectProviderOptions(providersResult) {
      const options = Array.from(providerSelect.options)
        .filter((option) => isVisibleProviderValue(option.value))
        .map((option) => ({
          value: option.value,
          label: option.textContent || option.value || "服务端自动路由",
          endpoint: option.dataset.endpoint || "",
          apiKeyRef: option.dataset.apiKeyRef || "",
          modelImportSource: option.dataset.modelImportSource || "",
          runtimeCredentialPersisted: option.dataset.runtimeCredentialPersisted === "true",
          runtimeCredentialStorage: option.dataset.runtimeCredentialStorage || "",
        }));
      if (options.length > 1) return options;

      const providers = providersResult.payload?.data ?? providersResult.payload ?? [];
      const collected = [{ value: "", label: "服务端自动路由" }];
      for (const provider of Array.isArray(providers) ? providers : []) {
        for (const model of provider.models ?? []) {
          if (!isVisibleProviderModel(provider.id, model.id)) continue;
          collected.push({
            value: provider.id + "::" + model.id,
            label: (provider.displayName || provider.id) + " / " + (model.displayName || model.id),
            endpoint: provider.suggestedEndpoint || model.metadata?.providerEndpoint || "",
            runtimeCredentialPersisted: provider.metadata?.runtimeCredentialPersisted === true,
            runtimeCredentialStorage: provider.metadata?.runtimeCredentialStorage || "",
          });
        }
      }
      return collected;
    }

    function summarizeProviders(result) {
      const providers = result.payload?.data ?? result.payload ?? [];
      return (Array.isArray(providers) ? providers : []).map((provider) => ({
        id: provider.id,
        displayName: provider.displayName,
        modelCount: Array.isArray(provider.models) ? provider.models.length : 0,
      }));
    }

    function summarizeReadiness(result) {
      const data = result.payload?.data ?? {};
      return data.status || data.mode || (result.ok ? "ready" : "not-ready");
    }

    function splitProviderModel(value) {
      const [providerId, modelId] = String(value || "").split("::");
      return {
        providerId: providerId || "",
        modelId: modelId || "",
      };
    }

    function isVisibleProviderValue(value) {
      if (!value) return true;
      const { providerId, modelId } = splitProviderModel(value);
      return isVisibleProviderModel(providerId, modelId);
    }

    function isVisibleProviderModel(providerId, modelId) {
      if (showFakeProvidersInUi) return true;
      return !isFakeProviderModel(providerId, modelId);
    }

    function isFakeProviderValue(value) {
      const { providerId, modelId } = splitProviderModel(value);
      return isFakeProviderModel(providerId, modelId);
    }

    function isFakeProviderModel(providerId, modelId) {
      const normalizedProviderId = String(providerId || "").toLowerCase();
      const normalizedModelId = String(modelId || "").toLowerCase();
      const fakeProviderIds = new Set(["local-fake-provider", "backup-fake-provider"]);
      return fakeProviderIds.has(normalizedProviderId) || normalizedModelId === "local-fake-model";
    }

    function persistProviderPreference(value, source) {
      const { providerId, modelId } = splitProviderModel(value);
      const preference = {
        version: 1,
        savedAt: new Date().toISOString(),
        source: source || "unknown",
        providerId,
        modelId,
        value: value || "",
        secretPersisted: false,
      };
      try {
        localStorage.setItem(chatProviderPreferenceStorageKey, JSON.stringify(preference));
      } catch {
        return {
          ...preference,
          saved: false,
          reason: "browser-local-storage-unavailable",
        };
      }
      return {
        ...preference,
        saved: true,
      };
    }

    function readProviderPreference() {
      try {
        const parsed = JSON.parse(localStorage.getItem(chatProviderPreferenceStorageKey) || "{}");
        return parsed && parsed.version === 1 ? parsed : null;
      } catch {
        return null;
      }
    }

    function restoreProviderPreference() {
      const preference = readProviderPreference();
      if (!preference?.value) return false;
      if (!isVisibleProviderValue(preference.value)) return false;
      const hasOption = Array.from(providerSelect.options).some((option) => option.value === preference.value);
      if (!hasOption) return false;
      providerSelect.value = preference.value;
      updateSessionStatus("已恢复默认聊天模型：" + preference.value);
      return true;
    }

    function clearProviderPreference() {
      try {
        localStorage.removeItem(chatProviderPreferenceStorageKey);
      } catch {
        // Local browser storage may be unavailable; clearing remains best-effort.
      }
      providerSelect.value = "";
      updateSessionStatus("已清除默认聊天模型选择。");
    }

    function describeProviderPreference() {
      const preference = readProviderPreference();
      return preference?.value || "未设置";
    }

    function createProviderStartupTemplate(value, apiKeyDraftPresent) {
      const { providerId, modelId } = splitProviderModel(value);
      if (!providerId) {
        return [
          "# 当前选择是服务端自动路由。",
          "# 如需固定真实 provider，请先在卡片里选择一个 provider/model。",
          "cmd /c pnpm dev:phase7b",
        ].join("\\n");
      }

      const normalizedProvider = providerId.toLowerCase();
      const lines = [
        "# PME 移动地球模型启动配置模板",
        "# 这里不会输出你输入的真实 API Key；请在 PowerShell 里自行粘贴。",
        "$env:AI_GATEWAY_PROVIDER_MODE='real'",
        "$env:AI_GATEWAY_REAL_PROVIDER_ENABLED='true'",
        "$env:AI_GATEWAY_ROUTE_MODE='fixed'",
        "$env:AI_GATEWAY_DEFAULT_PROVIDER='" + providerId + "'",
        "$env:AI_GATEWAY_DEFAULT_MODEL='" + modelId + "'",
        "$env:AI_GATEWAY_ENABLED_PROVIDERS='" + providerId + "'",
      ];

      if (normalizedProvider === "nvidia") {
        lines.push("$env:NVIDIA_MODEL='" + modelId + "'");
        lines.push("$env:NVIDIA_API_KEY='<paste-your-nvidia-key-here>'");
      } else if (normalizedProvider === "openai") {
        lines.push("$env:OPENAI_MODEL='" + modelId + "'");
        lines.push("$env:OPENAI_API_KEY='<paste-your-openai-key-here>'");
      } else {
        lines.push("# 当前 provider 未声明专用密钥变量；请按 provider adapter 文档配置。");
      }

      lines.push("# 密钥草稿是否填写：" + (apiKeyDraftPresent ? "yes" : "no"));
      lines.push("cmd /c pnpm dev:phase7b");
      return lines.join("\\n");
    }

    function redactSecrets(value) {
      if (Array.isArray(value)) return value.map((item) => redactSecrets(item));
      if (!value || typeof value !== "object") return value;
      const output = {};
      for (const [key, item] of Object.entries(value)) {
        if (/(api[_-]?key|password|secret|token|connection_string|connectionstring)/i.test(key)) {
          output[key] = item ? "[redacted]" : item;
          continue;
        }
        output[key] = redactSecrets(item);
      }
      return output;
    }

    async function sendChat(text) {
      if (chatSending) {
        appendMessage("system", "正在生成回答，请等当前回复完成后再发送。", "system");
        return;
      }

      const prompt = String(text || "").trim();
      if (!prompt) {
        appendMessage("system", "请输入问题，或把文件拖进来后再发送。", "system");
        input.focus();
        syncComposerState();
        return;
      }

      if (input.value.trim() === prompt) {
        input.value = "";
        syncComposerState();
      }

      if (await handleChatCommandCenter(prompt)) {
        input.focus();
        syncComposerState();
        return;
      }

      const abortController = new AbortController();
      currentChatAbortController = abortController;
      chatAbortRequested = false;
      chatSending = true;
      setChatSending(true);
      appendMessage("user", prompt, "user");
      const assistant = appendMessage("assistant", "", "assistant");
      setMessagePrompt(assistant, prompt);
      setMessageStatus(assistant, "正在连接 AI Gateway...", "active");
      latestAnswer = "";
      latestCitations = [];

      const selected = providerSelect.value ? providerSelect.value.split("::") : [];
      const routePlan = createChatRoutePlan(prompt);
      const body = {
        prompt,
        providerId: selected[0],
        model: selected[1],
        ...(routePlan.useKnowledge ? { knowledge: { topK: 3 } } : {}),
        metadata: {
          surface: "chat-first-ui",
          autoKnowledgeEnabled,
          knowledgeInjectionMode,
          chatRoute: routePlan.id,
          fastReply: routePlan.fastReply,
          knowledgeRequested: routePlan.useKnowledge,
          routeReason: routePlan.reason,
        },
      };
      const streamEndpoint = routePlan.useKnowledge ? "/chat/rag/stream" : "/chat/stream";
      const fallbackEndpoint = routePlan.useKnowledge ? "/chat/rag" : "/chat";

      try {
        let sawChunk = false;
        let firstTextTimeoutId = setTimeout(() => {
          if (!sawChunk && !chatAbortRequested) {
            abortController.abort();
          }
        }, routePlan.firstTextTimeoutMs);

        if (!routePlan.useKnowledge) {
          setMessageStatus(assistant, "快速回答中：本次不检索知识库。", "active");
        }

        try {
          for await (const event of requestSse(streamEndpoint, body, { signal: abortController.signal })) {
          if (event.type === "error") {
            throw createChatStreamError(event);
          }
          if (event.type === "knowledge") {
            latestCitations = event.citations || [];
            setMessageCitations(assistant, latestCitations);
            setMessageStatus(
              assistant,
              latestCitations.length ? "已检索知识库：" + latestCitations.length + " 条引用，正在生成回答。" : "已检索知识库：暂无引用，正在生成回答。",
              latestCitations.length ? "active" : "warn",
            );
            continue;
          }
          if (event.type === "chunk") {
            if (!sawChunk) {
              clearTimeout(firstTextTimeoutId);
              firstTextTimeoutId = null;
              setMessageStatus(assistant, "正在生成回答...", "active");
            }
            sawChunk = true;
            latestAnswer = event.outputText || (latestAnswer + (event.textDelta || ""));
            const shouldFollow = shouldFollowChatScroll();
            setMessageText(assistant, latestAnswer);
            if (shouldFollow) scrollChatToBottom();
          }
          if (event.type === "done") {
            latestAnswer = event.outputText || latestAnswer;
          }
        }
        } finally {
          if (firstTextTimeoutId) {
            clearTimeout(firstTextTimeoutId);
          }
        }
        if (!sawChunk && !latestAnswer) {
          setMessageStatus(assistant, "已完成，但没有返回文本。", "warn");
          setMessageText(assistant, "流式请求已完成，但没有返回文本。");
        } else {
          setMessageStatus(assistant, "回答完成。", "done");
        }
      } catch (error) {
        if (chatAbortRequested) {
          assistant.className = "message assistant";
          setMessageStatus(assistant, "已停止生成。", "warn");
          setMessageText(assistant, latestAnswer ? latestAnswer + "\\n\\n（已停止生成。）" : "已停止生成。");
          appendMessage("system", "已停止当前回答，可以继续发送下一条。", "system");
          return;
        }
        const effectiveError = isAbortError(error) ? createFirstTextTimeoutError(routePlan) : error;
        assistant.className = "message assistant";
        setMessageStatus(assistant, "流式连接中断，正在切换普通回答。", "warn");
        setMessageText(assistant, "\u751f\u6210\u6709\u70b9\u6162\uff0c\u6b63\u5728\u81ea\u52a8\u5207\u6362\u666e\u901a\u56de\u7b54\u3002\u539f\u56e0\uff1a" + describeError(effectiveError));
        const fallbackBody = createChatFallbackBody(body, effectiveError);
        const fallback = await requestJson(fallbackEndpoint, { method: "POST", body: fallbackBody });
        const answer = fallback.payload?.data?.answer || fallback.payload?.data?.text || fallback.payload?.message || "";
        latestAnswer = answer;
        latestCitations = fallback.payload?.data?.knowledge?.citations || [];
        setMessageCitations(assistant, latestCitations);
        if (fallback.ok && answer) {
          assistant.className = "message assistant";
          setMessageStatus(assistant, "已切换普通回答。", "warn");
          setMessageText(assistant, answer);
          appendMessage("system", createChatFallbackSuccessMessage(body, fallbackBody), "system");
        } else {
          assistant.className = "message assistant error";
          setMessageStatus(assistant, "回答失败。", "error");
          markComposerModelChatFailure({
            streamError: effectiveError,
            fallback,
            prompt,
          });
          setMessageText(assistant, createChatFailureText({
            streamError: effectiveError,
            fallback,
          }));
        }
      } finally {
        saveChatHistory();
        currentChatAbortController = null;
        chatAbortRequested = false;
        chatSending = false;
        setChatSending(false);
        syncComposerState();
        input.focus();
      }
    }

    function createChatRoutePlan(prompt) {
      const text = String(prompt || "");
      const lower = text.toLowerCase();
      const hasPhaseMarker = /phase\\d+/i.test(text);
      const hasKnowledgeIntent = /知识库|资料|文件|文档|引用|根据|刚才上传|上传|总结文件|总结资料|表格|pdf|word|excel|knowledge|document|citation|source|uploaded file/i.test(text);
      const hasRecentUploadIntent = lastKnowledgeUpload.loadedCount > 0 &&
        /刚才|上传|文件|资料|文档|总结|提取|对比|表格|这份|这个|这些/.test(text);

      if (hasPhaseMarker || hasKnowledgeIntent || hasRecentUploadIntent) {
        return {
          id: "knowledge-rag",
          useKnowledge: true,
          fastReply: false,
          firstTextTimeoutMs: 30_000,
          reason: hasRecentUploadIntent ? "recent-upload" : (hasKnowledgeIntent ? "knowledge-intent" : "verification-marker"),
        };
      }

      return {
        id: "fast-direct-chat",
        useKnowledge: false,
        fastReply: true,
        firstTextTimeoutMs: 30_000,
        reason: lower.length <= 80 ? "short-general-chat" : "general-chat",
      };
    }

    function createFirstTextTimeoutError(routePlan) {
      const error = new Error("Chat stream did not return the first answer text quickly enough.");
      error.code = routePlan?.useKnowledge ? "RAG_FIRST_TEXT_TIMEOUT" : "CHAT_FIRST_TEXT_TIMEOUT";
      error.httpStatus = null;
      error.retryable = true;
      return error;
    }

    function stopChatGeneration() {
      if (!currentChatAbortController || !chatSending) return;
      chatAbortRequested = true;
      currentChatAbortController.abort();
      stopButton.disabled = true;
      stopButton.textContent = "正在停止";
      input.focus();
    }

    function createChatStreamError(event) {
      const error = event?.error || event?.data?.error || event;
      const message = error?.message || event?.message || "stream error event";
      const streamError = new Error(message);
      streamError.code = error?.code || event?.code || "CHAT_STREAM_ERROR_EVENT";
      streamError.httpStatus = event?.httpStatus || event?.status || null;
      streamError.retryable = error?.retryable ?? event?.retryable ?? null;
      return streamError;
    }

    function createChatFallbackBody(body, error) {
      if (!shouldFallbackToServerAutoRoute(body, error)) {
        return body;
      }

      const nextBody = { ...body };
      delete nextBody.providerId;
      delete nextBody.model;
      nextBody.metadata = {
        ...(body.metadata || {}),
        fallbackRoute: "server-auto",
        fallbackFromProviderId: body.providerId,
        fallbackFromModel: body.model,
        fallbackReason: error?.code || "stream-failed",
      };
      return nextBody;
    }

    function shouldFallbackToServerAutoRoute(body, error) {
      if (!body?.providerId && !body?.model) return false;
      const code = String(error?.code || "").toUpperCase();
      const message = String(error?.message || "").toLowerCase();
      return Boolean(error?.retryable === true) ||
        code.includes("TIMEOUT") ||
        code.includes("RATE_LIMIT") ||
        code.includes("NETWORK") ||
        message.includes("timed out");
    }

    function createChatFallbackSuccessMessage(originalBody, fallbackBody) {
      const switchedToAuto = Boolean((originalBody?.providerId || originalBody?.model) && !fallbackBody?.providerId && !fallbackBody?.model);
      if (switchedToAuto) {
        return "流式连接中断，已自动切回服务端自动路由完成普通回答。原模型稍慢时，我会尽量换可用通道继续，不让聊天窗口卡死。";
      }
      return "\u6d41\u5f0f\u8fde\u63a5\u4e2d\u65ad\uff0c\u5df2\u81ea\u52a8\u5207\u6362\u666e\u901a\u56de\u7b54\u3002\u672c\u6b21\u56de\u7b54\u4ecd\u6765\u81ea\u540c\u4e00\u4e2a AI Gateway\u3002";
    }

    function createChatFailureText({ streamError, fallback }) {
      const fallbackError = fallback?.payload?.error || fallback?.payload?.data?.error || {};
      const fallbackCode = fallbackError.code || fallback?.payload?.code || "CHAT_FALLBACK_FAILED";
      const fallbackMessage = fallbackError.message || fallback?.payload?.message || "\u666e\u901a\u56de\u7b54\u4e5f\u6ca1\u6709\u8fd4\u56de\u53ef\u5c55\u793a\u5185\u5bb9\u3002";
      const streamReason = describeError(streamError);
      const fallbackStatus = fallback?.httpStatus ?? 0;
      const recoveryLines = createChatRecoveryHintLines({
        streamReason,
        fallbackStatus,
        fallbackCode,
        fallbackMessage,
      });
      return [
        "\u804a\u5929\u8bf7\u6c42\u5931\u8d25\uff0c\u4f46\u9875\u9762\u5df2\u7ecf\u6062\u590d\uff0c\u53ef\u4ee5\u7ee7\u7eed\u53d1\u9001\u4e0b\u4e00\u6761\u3002",
        "\u6d41\u5f0f\u5931\u8d25\u539f\u56e0\uff1a" + streamReason,
        "\u666e\u901a\u56de\u7b54\u5931\u8d25\uff1aHTTP " + fallbackStatus + " / " + fallbackCode + " / " + fallbackMessage,
        "",
        ...recoveryLines,
      ].join("\\n");
    }

    function markComposerModelChatFailure({ streamError, fallback, prompt = "" }) {
      if (!providerSelect.value) return;
      const restoredFromLocal = composerModelStatus?.dataset.modelRestoredFromLocal === "true";
      if (restoredFromLocal && String(prompt || "").trim()) {
        pendingModelConfigRetryPrompt = String(prompt || "").trim();
      }
      const fallbackError = fallback?.payload?.error || fallback?.payload?.data?.error || {};
      const reasonParts = [
        describeError(streamError),
        fallback?.httpStatus ? "HTTP " + fallback.httpStatus : "",
        fallbackError.code || fallback?.payload?.code || "",
        fallbackError.message || fallback?.payload?.message || "",
      ].filter(Boolean);
      updateComposerModelStatus({
        status: "failed",
        value: providerSelect.value,
        label: getCurrentProviderLabel(),
        reason: restoredFromLocal
          ? "本机恢复的模型发送失败，请重新检测。"
          : (reasonParts.join(" / ") || "聊天发送失败，请重新检测。"),
      });
    }

    function createChatRecoveryHintLines({ streamReason, fallbackStatus, fallbackCode, fallbackMessage }) {
      const combined = [streamReason, fallbackStatus, fallbackCode, fallbackMessage].join(" ").toUpperCase();
      const lines = ["恢复建议："];
      if (composerModelStatus?.dataset.modelRestoredFromLocal === "true") {
        lines.push("- 这次失败发生在“本机配置已恢复”的模型上；请先点输入区“重新检测模型”，重新验证 API Key、provider、base URL 和模型。");
        lines.push("- 重新检测通过后可以直接继续发送，不需要刷新页面。");
      }
      if (combined.includes("401") || combined.includes("403") || combined.includes("UNAUTHORIZED") || combined.includes("FORBIDDEN")) {
        lines.push("- 这更像 Key、权限、余额或服务商不匹配。请重新配置模型。");
        lines.push("- 如果你用的是 OpenAI-compatible / 中转 key，请确认 provider 和 base URL，不要只凭 sk- 前缀自动猜。");
      } else if (combined.includes("TIMEOUT") || combined.includes("TIMED OUT") || combined.includes("RATE_LIMIT") || combined.includes("NETWORK")) {
        lines.push("- 这更像 provider 超时、限流或网络波动。可以直接点“重新发送”，或在“配置模型”里换一个可用模型后再发。");
        lines.push("- 如果连续超时，先看 health / doctor / logs，确认服务和模型配置是否正常。");
      } else if (Number(fallbackStatus) >= 500 || combined.includes("HTTP 5")) {
        lines.push("- 这更像服务端或 provider 临时异常。请稍后重试，或运行 health / logs 查看服务状态。");
      } else {
        lines.push("- 请先点“配置模型”检测当前 API Key、provider 和模型是否可用。");
        lines.push("- 也可以运行 health / doctor / logs 查看服务状态；页面已经恢复，不需要刷新。");
      }
      lines.push("- 我不会把失败的 key 强行绑定到默认 NVIDIA，也不会用假模型冒充可用模型。");
      return lines;
    }

    function describeError(error) {
      if (!error) return "unknown error";
      const parts = [];
      if (error.httpStatus) parts.push("HTTP " + error.httpStatus);
      if (error.code) parts.push(error.code);
      if (error.message) parts.push(error.message);
      return parts.join(" / ") || String(error);
    }

    function isAbortError(error) {
      return Boolean(error && (error.name === "AbortError" || error.code === "ABORT_ERR"));
    }

    function setChatSending(active) {
      sendButton.textContent = active ? "生成中" : "发送";
      stopButton.disabled = !active;
      stopButton.textContent = active ? "停止生成" : "停止生成";
      form.classList.toggle("is-sending", active);
      input.setAttribute("aria-busy", active ? "true" : "false");
      syncComposerState();
    }

    function setComposerHint(guidance) {
      if (!composerHint) return;
      const tone = guidance?.tone || "neutral";
      composerHint.className = "composer-hint " + tone;
      composerHint.dataset.composerGuidance = tone;
      composerHint.dataset.composerGuidanceKind = guidance?.kind || tone;
      composerHint.textContent = guidance?.text || "Enter 发送 · Shift+Enter 换行 · Esc 停止";
    }

    function getComposerGuidance(value, hasText) {
      if (chatSending) {
        return {
          tone: "active",
          kind: "sending",
          text: "正在生成。按 Esc 或点“停止生成”可以中断；输入框已清空，可以继续准备下一条。",
        };
      }
      if (composerModelProbeState.status === "checking") {
        return {
          tone: "warn",
          kind: "model-checking",
          text: "正在检测模型，检测完成后这里会自动更新。",
        };
      }
      if (composerModelProbeState.status === "failed") {
        return {
          tone: "error",
          kind: hasText ? "typing-model-failed" : "empty-model-failed",
          text: hasText
            ? "模型检测未通过。可以继续发送让服务端尝试，也可以直接输入“配置模型”重新检测。"
            : "模型检测未通过。建议输入“配置模型”重新检测，或运行 health / logs 查原因。",
        };
      }
      if (!hasText) {
        if (composerReadyNudge) {
          return {
            tone: "ok",
            kind: "model-ready-nudge",
            text: composerReadyNudge,
          };
        }
        if (lastKnowledgeUpload.loadedCount > 0) {
          return {
            tone: composerModelProbeState.status === "passed" ? "ok" : "neutral",
            kind: "empty-knowledge-loaded",
            text: "Enter 发送 · Shift+Enter 换行。刚才的资料已入库，可以直接问我总结、提取重点、列待办。",
          };
        }
        if (composerModelProbeState.status === "passed") {
          return {
            tone: "ok",
            kind: "empty-model-passed",
            text: "Enter 发送 · Shift+Enter 换行。模型已检测通过，可以直接提问或拖文件。",
          };
        }
        return {
          tone: "neutral",
          kind: "empty-unchecked",
          text: "Enter 发送 · Shift+Enter 换行。可以直接提问或拖文件；想更稳可输入“配置模型”。",
        };
      }
      if (composerModelProbeState.status === "passed") {
        return {
          tone: "ok",
          kind: "typing-model-passed",
          text: "Enter 发送 · Shift+Enter 换行；模型已检测通过，普通问题会直接快速回答。",
        };
      }
      return {
        tone: "warn",
        kind: "typing-unchecked",
        text: "Enter 发送 · Shift+Enter 换行；模型还未检测，想更稳可以先输入“配置模型”。",
      };
    }

    function syncComposerState() {
      autoResizeChatInput();
      const value = input.value || "";
      const hasText = Boolean(value.trim());
      sendButton.disabled = chatSending || !hasText;
      sendButton.setAttribute("aria-disabled", sendButton.disabled ? "true" : "false");
      if (composerModelConfigButton) {
        composerModelConfigButton.disabled = chatSending;
        composerModelConfigButton.setAttribute("aria-disabled", chatSending ? "true" : "false");
      }
      if (composerMeter) {
        composerMeter.textContent = value.length ? value.length + " 字" : "准备输入";
      }
      setComposerHint(getComposerGuidance(value, hasText));
      form.classList.toggle("has-text", hasText);
    }

    function autoResizeChatInput() {
      const maxHeight = 180;
      input.style.height = "auto";
      const nextHeight = Math.min(input.scrollHeight, maxHeight);
      input.style.height = Math.max(nextHeight, 28) + "px";
      input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
    }

    async function loadFiles(fileList) {
      const files = Array.from(fileList || []);
      if (!files.length) return;
      uploadStatus.textContent = "正在导入 " + files.length + " 个文件...";
      const payloadFiles = [];
      const skipped = [];
      for (const file of files) {
        if (file.size > maxUploadFileBytes) {
          skipped.push(file.name + " 超过 100MB");
          continue;
        }
        payloadFiles.push({
          fileName: file.name,
          mimeType: file.type || "unknown",
          size: file.size,
          base64: await readFileAsBase64(file),
        });
      }
      const result = await requestJson("/knowledge/load/file", {
        method: "POST",
        body: {
          sourceId: "ui-chat-file-import-source",
          sourceTitle: "Chat File Import Source",
          metadata: { loadedBy: "chat-first-ui" },
          files: payloadFiles,
        },
      });
      if (!result.ok) {
        uploadStatus.textContent = "导入失败：" + (result.payload?.error?.message || ("HTTP " + result.httpStatus));
        appendMessage("system", uploadStatus.textContent, "system");
        syncComposerState();
        return;
      }
      const count = result.payload?.data?.loadedCount ?? 0;
      uploadStatus.textContent = "已导入 " + count + " 个文档。" + (skipped.length ? " 跳过：" + skipped.join("; ") : "");
      const loadedFileNames = payloadFiles.slice(0, Math.max(0, count)).map((file) => file.fileName);
      lastKnowledgeUpload = { loadedCount: count, loadedFileNames, skipped };
      input.placeholder = count > 0
        ? "资料已入库，可以直接问：帮我总结刚才上传的文件。"
        : defaultChatInputPlaceholder;
      appendMessage("system", createKnowledgeUploadReceipt(count, loadedFileNames, skipped), "system");
      updateSessionStatus(count > 0
        ? "已入库 " + count + " 个资料文档，可以直接在聊天里提问。"
        : "没有新的资料入库。");
      syncComposerState();
      input.focus();
    }

    function createKnowledgeUploadReceipt(count, loadedFileNames, skipped) {
      const loadedText = loadedFileNames.length
        ? "已导入：" + count + " 个文档（" + loadedFileNames.join("、") + "）"
        : "已导入：" + count + " 个文档";
      return [
        "资料已放进知识库。",
        loadedText,
        skipped.length ? "已跳过：" + skipped.join("；") : "",
        count > 0 ? "接下来不用再选择知识库，直接问我：总结刚才的文件、提取关键事项、找表格里的重点。" : "",
      ].filter(Boolean).join("\\n");
    }

    async function requestJson(path, options = {}) {
      try {
        const response = await fetch(path, {
          method: options.method || "GET",
          headers: createHeaders(),
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
        const text = await response.text();
        try {
          return { ok: response.ok, httpStatus: response.status, payload: text ? JSON.parse(text) : {} };
        } catch (parseError) {
          return {
            ok: false,
            httpStatus: response.status,
            payload: {
              error: {
                message: "Invalid JSON response",
                detail: parseError?.message || "",
                rawText: String(text || "").slice(0, 500),
              },
            },
          };
        }
      } catch (error) {
        return { ok: false, httpStatus: 0, payload: { error: { message: error.message } } };
      }
    }

    async function* requestSse(path, body, options = {}) {
      const response = await fetch(path, {
        method: "POST",
        headers: createHeaders(),
        body: JSON.stringify(body),
        signal: options.signal,
      });
      if (!response.ok || !response.body) {
        throw new Error("HTTP " + response.status);
      }
      const decoder = new TextDecoder();
      let buffer = "";
      for await (const chunk of response.body) {
        buffer += decoder.decode(chunk, { stream: true });
        const frames = buffer.split(/\\r?\\n\\r?\\n/);
        buffer = frames.pop() || "";
        for (const frame of frames) {
          const parsed = parseSseFrame(frame);
          if (parsed) yield parsed;
        }
      }
      const parsed = parseSseFrame(buffer);
      if (parsed) yield parsed;
    }

    function parseSseFrame(frame) {
      const lines = frame.split(/\\r?\\n/);
      const event = (lines.find((line) => line.startsWith("event:")) || "").slice(6).trim();
      const data = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\\n");
      if (!event || !data) return null;
      const payload = JSON.parse(data);
      return { ...payload, type: payload.type || event };
    }

    function createHeaders() {
      const headers = { "content-type": "application/json" };
      const token = document.getElementById("auth-token").value.trim();
      const tenantId = document.getElementById("tenant-id").value.trim();
      if (token) headers["x-pme-auth-token"] = token;
      if (tenantId) headers["x-pme-tenant-id"] = tenantId;
      return headers;
    }

    function appendMessage(role, text, type, options = {}) {
      const node = document.createElement("div");
      node.className = "message " + (type || role);
      node.dataset.role = role;
      node.dataset.type = type || role;
      const metaNode = createMessageMeta(role, type || role);
      if (metaNode) {
        node.appendChild(metaNode);
      }
      if ((type || role) === "assistant") {
        const statusNode = document.createElement("div");
        statusNode.className = "message-status hidden";
        statusNode.setAttribute("role", "status");
        statusNode.setAttribute("aria-live", "polite");
        node.appendChild(statusNode);
      }
      const textNode = document.createElement("div");
      textNode.className = "message-text";
      node.appendChild(textNode);
      if ((type || role) === "assistant") {
        const citationsNode = document.createElement("div");
        citationsNode.className = "message-citations hidden";
        citationsNode.dataset.citationList = "true";
        node.appendChild(citationsNode);
        node.appendChild(createAssistantActions());
      }
      setMessageText(node, text);
      history.appendChild(node);
      scrollChatToBottom();
      if (options.persist !== false) {
        saveChatHistory();
      }
      return node;
    }

    function createMessageMeta(role, type) {
      if (type === "system" || type === "error") return null;
      const meta = document.createElement("div");
      meta.className = "message-meta";
      const label = document.createElement("span");
      label.textContent = type === "user" || role === "user" ? "你" : "PME";
      const time = document.createElement("time");
      const now = new Date();
      time.dateTime = now.toISOString();
      time.textContent = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
      meta.appendChild(label);
      meta.appendChild(time);
      return meta;
    }

    function shouldFollowChatScroll() {
      const distanceToBottom = history.scrollHeight - history.scrollTop - history.clientHeight;
      return distanceToBottom <= 96;
    }

    function scrollChatToBottom(behavior = "auto") {
      history.scrollTo({ top: history.scrollHeight, behavior });
      updateScrollBottomButton();
    }

    function updateScrollBottomButton() {
      const awayFromBottom = history.scrollHeight - history.scrollTop - history.clientHeight > 160;
      scrollBottomButton.classList.toggle("hidden", !awayFromBottom);
    }

    function createAssistantActions() {
      const actions = document.createElement("div");
      actions.className = "message-actions";
      actions.appendChild(createMessageAction("copy-answer", "复制回答"));
      actions.appendChild(createMessageAction("copy-citations", "复制引用", true));
      actions.appendChild(createMessageAction("retry-message", "重新发送", true));
      return actions;
    }

    function createMessageAction(action, label, disabled = false) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "message-action";
      button.dataset.messageAction = action;
      button.textContent = label;
      button.disabled = disabled;
      return button;
    }

    async function handleMessageAction(button) {
      const message = button.closest(".message");
      if (!message) return;
      const action = button.dataset.messageAction;
      if (action === "copy-answer") {
        const text = getMessageText(message).trim();
        if (!text) {
          appendMessage("system", "当前回答为空，暂时没有可复制内容。", "system");
          return;
        }
        await copyTextToClipboard(text);
        appendMessage("system", "已复制回答。", "system");
        return;
      }
      if (action === "copy-citations") {
        const citationsText = formatCitations(getMessageCitations(message));
        if (!citationsText) {
          appendMessage("system", "当前回答没有可复制引用。", "system");
          return;
        }
        await copyTextToClipboard(citationsText);
        appendMessage("system", "已复制引用。", "system");
        return;
      }
      if (action === "copy-single-citation") {
        const citationIndex = Number(button.dataset.citationIndex || "-1");
        const citation = getMessageCitations(message)[citationIndex];
        const citationText = citation ? formatCitations([citation]) : "";
        if (!citationText) {
          appendMessage("system", "这条引用暂时没有可复制内容。", "system");
          return;
        }
        await copyTextToClipboard(citationText);
        appendMessage("system", "已复制第 " + (citationIndex + 1) + " 条引用。", "system");
        return;
      }
      if (action === "copy-code-block") {
        const codeBlock = button.closest(".md-code-wrap")?.querySelector("code");
        const codeText = codeBlock?.textContent || "";
        if (!codeText) {
          appendMessage("system", "这个代码块暂时没有可复制内容。", "system");
          return;
        }
        await copyTextToClipboard(codeText);
        button.textContent = "已复制";
        setTimeout(() => {
          button.textContent = "复制代码";
        }, 1200);
        appendMessage("system", "已复制代码块。", "system");
        return;
      }
      if (action === "retry-message") {
        const prompt = message.dataset.prompt || "";
        if (!prompt) {
          appendMessage("system", "这条回答没有可重发的上一条问题。", "system");
          return;
        }
        if (chatSending) {
          appendMessage("system", "正在生成回答，请等当前回复完成后再重发。", "system");
          return;
        }
        input.value = prompt;
        input.focus();
        await sendChat(prompt);
        input.value = "";
      }
    }

    function getMessageText(node) {
      const textNode = node.querySelector(".message-text");
      if (textNode) return textNode.dataset.rawText ?? textNode.textContent ?? "";
      return node.textContent || "";
    }

    function setMessageText(node, text) {
      const textNode = node.querySelector(".message-text");
      const rawText = String(text ?? "");
      if (textNode) {
        textNode.dataset.rawText = rawText;
        if (node.dataset.type === "assistant" || node.dataset.role === "assistant") {
          renderMarkdownLite(textNode, rawText);
        } else {
          textNode.textContent = rawText;
        }
      } else {
        node.textContent = rawText;
      }
    }

    function renderMarkdownLite(target, rawText) {
      target.replaceChildren();
      const text = String(rawText || "");
      if (!text) return;

      const lines = text.replace(/\\r\\n/g, "\\n").split("\\n");
      const codeFence = String.fromCharCode(96, 96, 96);
      let index = 0;
      while (index < lines.length) {
        const line = lines[index];
        if (!line.trim()) {
          index += 1;
          continue;
        }

        const trimmedLine = line.trim();
        if (trimmedLine.startsWith(codeFence)) {
          const language = trimmedLine.slice(codeFence.length).trim();
          if (language && !/^[a-zA-Z0-9_-]+$/.test(language)) {
            const paragraph = document.createElement("p");
            appendInlineMarkdown(paragraph, line);
            target.appendChild(paragraph);
            index += 1;
            continue;
          }
          index += 1;
          const codeLines = [];
          while (index < lines.length && lines[index].trim() !== codeFence) {
            codeLines.push(lines[index]);
            index += 1;
          }
          if (index < lines.length) index += 1;
          target.appendChild(createCodeBlock(codeLines.join("\\n"), language));
          continue;
        }

        if (isThematicBreak(line)) {
          const hr = document.createElement("hr");
          hr.className = "md-hr";
          target.appendChild(hr);
          index += 1;
          continue;
        }

        if (/^\\s*>\\s?/.test(line)) {
          const quoteLines = [];
          while (index < lines.length && /^\\s*>\\s?/.test(lines[index])) {
            quoteLines.push(lines[index].replace(/^\\s*>\\s?/, ""));
            index += 1;
          }
          target.appendChild(createBlockquote(quoteLines));
          continue;
        }

        if (isMarkdownTableLine(line) && isMarkdownTableSeparator(lines[index + 1] || "")) {
          const headerCells = splitMarkdownTableRow(line);
          index += 2;
          const rowCells = [];
          while (index < lines.length && lines[index].trim() && isMarkdownTableLine(lines[index]) && !isThematicBreak(lines[index])) {
            rowCells.push(splitMarkdownTableRow(lines[index]));
            index += 1;
          }
          target.appendChild(createMarkdownTable(headerCells, rowCells));
          continue;
        }

        if (/^\\s*[-*]\\s+/.test(line)) {
          const list = document.createElement("ul");
          list.className = "md-list";
          while (index < lines.length && /^\\s*[-*]\\s+/.test(lines[index])) {
            const item = document.createElement("li");
            appendInlineMarkdown(item, lines[index].replace(/^\\s*[-*]\\s+/, ""));
            list.appendChild(item);
            index += 1;
          }
          target.appendChild(list);
          continue;
        }

        if (/^\\s*\\d+[.)]\\s+/.test(line)) {
          const list = document.createElement("ol");
          list.className = "md-list";
          while (index < lines.length && /^\\s*\\d+[.)]\\s+/.test(lines[index])) {
            const item = document.createElement("li");
            appendInlineMarkdown(item, lines[index].replace(/^\\s*\\d+[.)]\\s+/, ""));
            list.appendChild(item);
            index += 1;
          }
          target.appendChild(list);
          continue;
        }

        const paragraphLines = [];
        while (index < lines.length &&
          lines[index].trim() &&
          !lines[index].trim().startsWith(codeFence) &&
          !isThematicBreak(lines[index]) &&
          !/^\\s*>\\s?/.test(lines[index]) &&
          !(isMarkdownTableLine(lines[index]) && isMarkdownTableSeparator(lines[index + 1] || "")) &&
          !/^\\s*[-*]\\s+/.test(lines[index]) &&
          !/^\\s*\\d+[.)]\\s+/.test(lines[index])) {
          paragraphLines.push(lines[index]);
          index += 1;
        }
        const paragraph = document.createElement("p");
        appendInlineMarkdown(paragraph, paragraphLines.join("\\n"));
        target.appendChild(paragraph);
      }
    }

    function createBlockquote(lines) {
      const quote = document.createElement("blockquote");
      quote.className = "md-blockquote";
      lines.forEach((line) => {
        if (!line.trim()) return;
        const paragraph = document.createElement("p");
        appendInlineMarkdown(paragraph, line);
        quote.appendChild(paragraph);
      });
      return quote;
    }

    function createMarkdownTable(headerCells, rowCells) {
      const wrapper = document.createElement("div");
      wrapper.className = "md-table-wrap";
      const table = document.createElement("table");
      table.className = "md-table";
      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");
      headerCells.forEach((cell) => {
        const th = document.createElement("th");
        appendInlineMarkdown(th, cell);
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      rowCells.forEach((cells) => {
        const row = document.createElement("tr");
        headerCells.forEach((_, columnIndex) => {
          const td = document.createElement("td");
          appendInlineMarkdown(td, cells[columnIndex] || "");
          row.appendChild(td);
        });
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      wrapper.appendChild(table);
      return wrapper;
    }

    function isThematicBreak(line) {
      return /^\\s*(?:-{3,}|\\*{3,}|_{3,})\\s*$/.test(String(line || ""));
    }

    function isMarkdownTableLine(line) {
      return String(line || "").includes("|") && splitMarkdownTableRow(line).length >= 2;
    }

    function isMarkdownTableSeparator(line) {
      const cells = splitMarkdownTableRow(line);
      return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
    }

    function splitMarkdownTableRow(line) {
      let value = String(line || "").trim();
      if (value.startsWith("|")) value = value.slice(1);
      if (value.endsWith("|")) value = value.slice(0, -1);
      return value.split("|").map((cell) => cell.trim());
    }

    function createCodeBlock(codeText, language) {
      const wrapper = document.createElement("div");
      wrapper.className = "md-code-wrap";
      const toolbar = document.createElement("div");
      toolbar.className = "md-code-toolbar";
      const label = document.createElement("span");
      label.textContent = language || "code";
      const copyButton = createMessageAction("copy-code-block", "复制代码");
      copyButton.classList.add("md-code-copy");
      toolbar.appendChild(label);
      toolbar.appendChild(copyButton);

      const pre = document.createElement("pre");
      pre.className = "md-code-block";
      if (language) pre.dataset.language = language;
      const code = document.createElement("code");
      code.textContent = codeText;
      pre.appendChild(code);
      wrapper.appendChild(toolbar);
      wrapper.appendChild(pre);
      return wrapper;
    }

    function appendInlineMarkdown(target, text) {
      const markdownLink = /\\[([^\\]]+)\\]\\(([^)\\s]+)\\)/g;
      let cursor = 0;
      let match;
      while ((match = markdownLink.exec(text)) !== null) {
        appendTextWithAutoLinks(target, text.slice(cursor, match.index));
        appendSafeLink(target, match[1], match[2]);
        cursor = match.index + match[0].length;
      }
      appendTextWithAutoLinks(target, text.slice(cursor));
    }

    function appendTextWithAutoLinks(target, text) {
      const urlPattern = /https?:\\/\\/[^\\s<>()]+/g;
      let cursor = 0;
      let match;
      while ((match = urlPattern.exec(text)) !== null) {
        const before = text.slice(cursor, match.index);
        if (before) appendTextWithInlineCode(target, before);
        const { url, suffix } = splitTrailingUrlPunctuation(match[0]);
        appendSafeLink(target, url, url);
        if (suffix) appendTextWithInlineCode(target, suffix);
        cursor = match.index + match[0].length;
      }
      const rest = text.slice(cursor);
      if (rest) appendTextWithInlineCode(target, rest);
    }

    function appendTextWithInlineCode(target, text) {
      const backtick = String.fromCharCode(96);
      const segments = String(text || "").split(backtick);
      segments.forEach((segment, index) => {
        if (!segment) return;
        if (index % 2 === 1) {
          const code = document.createElement("code");
          code.className = "md-inline-code";
          code.textContent = segment;
          target.appendChild(code);
          return;
        }
        target.appendChild(document.createTextNode(segment));
      });
    }

    function splitTrailingUrlPunctuation(value) {
      const match = String(value || "").match(/^(.+?)([.,;:!?]+)?$/);
      return {
        url: match?.[1] || value,
        suffix: match?.[2] || "",
      };
    }

    function appendSafeLink(target, label, href) {
      const safeHref = normalizeSafeLinkHref(href);
      if (!safeHref) {
        target.appendChild(document.createTextNode(String(label || "")));
        if (href) target.appendChild(document.createTextNode(" (" + href + ")"));
        return;
      }
      const link = document.createElement("a");
      link.className = "md-link";
      link.href = safeHref;
      link.target = "_blank";
      link.rel = "noreferrer noopener";
      link.textContent = String(label || href || "");
      target.appendChild(link);
    }

    function normalizeSafeLinkHref(href) {
      const raw = String(href || "").trim();
      if (!/^https?:\\/\\//i.test(raw)) return "";
      try {
        const url = new URL(raw);
        return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
      } catch {
        return "";
      }
    }

    function setMessageStatus(node, text, tone = "active") {
      const statusNode = node.querySelector(".message-status");
      if (!statusNode) return;
      statusNode.textContent = text || "";
      statusNode.className = "message-status" + (text ? " " + tone : " hidden");
    }

    function setMessagePrompt(node, prompt) {
      node.dataset.prompt = prompt || "";
      const retry = node.querySelector('[data-message-action="retry-message"]');
      if (retry) retry.disabled = !node.dataset.prompt;
    }

    function setMessageCitations(node, citations) {
      const list = Array.isArray(citations) ? citations : [];
      node.dataset.citations = JSON.stringify(list);
      renderMessageCitations(node, list);
      const copyCitations = node.querySelector('[data-message-action="copy-citations"]');
      if (copyCitations) copyCitations.disabled = list.length === 0;
    }

    function renderMessageCitations(node, citations) {
      const target = node.querySelector("[data-citation-list]");
      if (!target) return;
      target.replaceChildren();
      const list = Array.isArray(citations) ? citations : [];
      if (!list.length) {
        target.classList.add("hidden");
        return;
      }
      target.classList.remove("hidden");
      const heading = document.createElement("div");
      heading.className = "citation-heading";
      heading.textContent = "引用 " + list.length + " 条";
      target.appendChild(heading);
      const headingStrong = document.createElement("strong");
      headingStrong.textContent = "知识命中";
      heading.replaceChildren(headingStrong, document.createTextNode(" / 引用 " + list.length + " 条"));
      list.forEach((citation, index) => {
        const details = document.createElement("details");
        details.className = "citation-card";
        details.open = index === 0;

        const summary = document.createElement("summary");
        summary.textContent = "引用 " + (index + 1) + " · " + citationTitle(citation) + " · " + citationDocumentId(citation);
        details.appendChild(summary);
        summary.textContent = "资料 " + (index + 1) + " · " + citationTitle(citation);

        const pillRow = document.createElement("div");
        pillRow.className = "citation-pill-row";
        const scoreText = citationScoreText(citation);
        if (scoreText) appendCitationPill(pillRow, "分数 " + scoreText, "score");
        citationMatchedTerms(citation).forEach((term) => appendCitationPill(pillRow, term, "term"));
        const scoreBreakdownText = citationScoreBreakdownText(citation);
        if (scoreBreakdownText) appendCitationPill(pillRow, scoreBreakdownText);
        if (pillRow.childElementCount > 0) details.appendChild(pillRow);

        const meta = document.createElement("div");
        meta.className = "citation-meta hidden";
        meta.textContent = [
          "sourceId: " + citationSourceId(citation),
          "documentId: " + citationDocumentId(citation),
        ].join("\\n");
        details.appendChild(meta);

        const metaGrid = document.createElement("div");
        metaGrid.className = "citation-meta-grid";
        metaGrid.appendChild(createCitationMetaItem("sourceId", citationSourceId(citation)));
        metaGrid.appendChild(createCitationMetaItem("documentId", citationDocumentId(citation)));
        const fileName = citationMetadataValue(citation, "fileName");
        if (fileName) metaGrid.appendChild(createCitationMetaItem("file", fileName));
        const namespace = citationMetadataValue(citation, "namespace");
        if (namespace) metaGrid.appendChild(createCitationMetaItem("namespace", namespace));
        details.appendChild(metaGrid);

        const snippet = document.createElement("div");
        snippet.className = "citation-snippet";
        snippet.textContent = citationSnippetText(citation) || "这条引用没有返回 snippet。";
        details.appendChild(snippet);
        renderHighlightedSnippet(snippet, citationSnippetText(citation) || snippet.textContent, citationMatchedTerms(citation));

        const copyButton = createMessageAction("copy-single-citation", "复制这条引用");
        copyButton.dataset.citationIndex = String(index);
        details.appendChild(copyButton);
        target.appendChild(details);
      });
    }

    function getMessageCitations(node) {
      try {
        const parsed = JSON.parse(node.dataset.citations || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    function formatCitations(citations) {
      return (Array.isArray(citations) ? citations : [])
        .map((citation, index) => {
          const title = citationTitle(citation);
          const documentId = citationDocumentId(citation);
          const sourceId = citationSourceId(citation);
          const snippet = citationSnippetText(citation);
          const score = citationScoreText(citation);
          const matchedTerms = citationMatchedTerms(citation);
          return [
            "[" + (index + 1) + "] " + title,
            "sourceId: " + sourceId,
            "documentId: " + documentId,
            score ? "score: " + score : "",
            matchedTerms.length ? "matchedTerms: " + matchedTerms.join(", ") : "",
            snippet ? "snippet: " + snippet : "",
          ].filter(Boolean).join("\\n");
        })
        .filter(Boolean)
        .join("\\n\\n");
    }

    function citationTitle(citation) {
      return citation?.title || citation?.documentTitle || citation?.sourceTitle || "Untitled citation";
    }

    function citationDocumentId(citation) {
      return citation?.documentId || citation?.chunkDocumentId || citation?.id || "unknown-document";
    }

    function citationSourceId(citation) {
      return citation?.sourceId || citation?.source || "unknown-source";
    }

    function citationSnippetText(citation) {
      return citation?.snippet || citation?.text || citation?.content || "";
    }

    function citationMatchedTerms(citation) {
      const terms = Array.isArray(citation?.matchedTerms) ? citation.matchedTerms : [];
      return terms
        .map((term) => String(term || "").trim())
        .filter(Boolean)
        .slice(0, 8);
    }

    function citationScoreText(citation) {
      const score = Number(citation?.score);
      return Number.isFinite(score) ? score.toFixed(4) : "";
    }

    function citationScoreBreakdownText(citation) {
      const breakdown = citation?.scoreBreakdown && typeof citation.scoreBreakdown === "object"
        ? citation.scoreBreakdown
        : {};
      return Object.entries(breakdown)
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .slice(0, 4)
        .map(([key, value]) => key + ": " + String(value))
        .join(" / ");
    }

    function citationMetadataValue(citation, key) {
      const value = citation?.metadata && typeof citation.metadata === "object" ? citation.metadata[key] : "";
      return value === undefined || value === null ? "" : String(value);
    }

    function appendCitationPill(row, text, type = "") {
      const pill = document.createElement("span");
      pill.className = "citation-pill" + (type ? " " + type : "");
      pill.textContent = text;
      row.appendChild(pill);
    }

    function createCitationMetaItem(label, value) {
      const item = document.createElement("div");
      item.className = "citation-meta-item";
      const labelNode = document.createElement("strong");
      labelNode.textContent = label;
      item.appendChild(labelNode);
      item.appendChild(document.createTextNode(value || "n/a"));
      return item;
    }

    function renderHighlightedSnippet(target, text, terms) {
      target.replaceChildren();
      const source = String(text || "");
      const normalizedTerms = (Array.isArray(terms) ? terms : [])
        .map((term) => String(term || "").trim())
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);
      if (!source || !normalizedTerms.length) {
        target.textContent = source;
        return;
      }
      const expression = new RegExp("(" + normalizedTerms.map(escapeRegExp).join("|") + ")", "gi");
      let lastIndex = 0;
      let matched = false;
      for (const match of source.matchAll(expression)) {
        const index = match.index ?? 0;
        if (index > lastIndex) {
          target.appendChild(document.createTextNode(source.slice(lastIndex, index)));
        }
        const mark = document.createElement("mark");
        mark.textContent = match[0];
        target.appendChild(mark);
        lastIndex = index + match[0].length;
        matched = true;
      }
      if (lastIndex < source.length) {
        target.appendChild(document.createTextNode(source.slice(lastIndex)));
      }
      if (!matched) {
        target.textContent = source;
      }
    }

    function escapeRegExp(value) {
      return String(value).replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
    }

    async function copyTextToClipboard(text) {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          return;
        } catch {
          // Fall back to a temporary textarea when browser clipboard permission is unavailable.
        }
      }
      const scratch = document.createElement("textarea");
      scratch.value = text;
      scratch.setAttribute("readonly", "true");
      scratch.style.position = "fixed";
      scratch.style.opacity = "0";
      document.body.appendChild(scratch);
      scratch.select();
      document.execCommand("copy");
      scratch.remove();
    }

    function restoreChatHistory() {
      const saved = readStoredChatMessages();
      if (!saved.length) {
        updateSessionStatus("会话会保存在当前浏览器。");
        saveChatHistory();
        return;
      }
      history.querySelectorAll(".message").forEach((node) => node.remove());
      for (const item of saved.slice(-maxStoredChatMessages)) {
        appendMessage(item.role || "assistant", item.text || "", item.type || item.role || "assistant", { persist: false });
      }
      updateSessionStatus("已恢复 " + saved.length + " 条会话记录。");
    }

    function clearChatHistory() {
      try {
        localStorage.removeItem(chatHistoryStorageKey);
      } catch {
        // Local browser storage may be unavailable; UI still clears the page.
      }
      history.querySelectorAll(".message").forEach((node) => node.remove());
      appendMessage("assistant", defaultAssistantGreeting, "assistant", { persist: false });
      saveChatHistory();
      updateSessionStatus("已清空当前浏览器里的会话记录。");
      input.focus();
    }

    function saveChatHistory() {
      const messages = Array.from(history.querySelectorAll(".message"))
        .map((node) => ({
          role: node.dataset.role || roleFromClassName(node),
          type: node.dataset.type || roleFromClassName(node),
          text: getMessageText(node),
        }))
        .filter((item) => item.text.trim())
        .slice(-maxStoredChatMessages);
      try {
        localStorage.setItem(chatHistoryStorageKey, JSON.stringify({
          version: 1,
          savedAt: new Date().toISOString(),
          messages,
        }));
        updateSessionStatus("已保存 " + messages.length + " 条会话记录。");
      } catch {
        updateSessionStatus("当前浏览器无法保存会话；刷新后可能丢失本页聊天记录。");
      }
    }

    function readStoredChatMessages() {
      try {
        const parsed = JSON.parse(localStorage.getItem(chatHistoryStorageKey) || "{}");
        return Array.isArray(parsed.messages) ? parsed.messages : [];
      } catch {
        return [];
      }
    }

    function updateSessionStatus(text) {
      if (sessionStatus) {
        sessionStatus.textContent = text;
      }
    }

    function roleFromClassName(node) {
      if (node.classList.contains("user")) return "user";
      if (node.classList.contains("system")) return "system";
      if (node.classList.contains("error")) return "error";
      return "assistant";
    }

    function setWorkforceStatus(text, tone) {
      const target = document.getElementById("workforce-status");
      if (!target) return;
      target.textContent = text;
      target.className = "workforce-status " + (tone || "");
    }

    function updateWorkforceGoalHint() {
      const inputNode = document.getElementById("workforce-goal");
      const hint = document.getElementById("workforce-goal-hint");
      if (!inputNode || !hint) return;
      const length = inputNode.value.length;
      const remaining = Math.max(0, 1000 - length);
      hint.textContent = "目标长度 " + length + "/1000，还可输入 " + remaining + " 个字符。";
      hint.className = "workforce-status " + (remaining === 0 ? "warn" : "");
    }

    async function refreshWorkforceHistory() {
      const target = document.getElementById("workforce-history");
      if (!target) return;
      const result = await requestJson("/workforce/plans");
      if (!result.ok) {
        target.replaceChildren(createWorkforceNotice("历史计划暂时无法读取：" + formatWorkforceError(result), "error"));
        return;
      }
      renderWorkforceHistory(result.payload?.data?.plans || []);
    }

    function renderWorkforceHistory(plans) {
      const target = document.getElementById("workforce-history");
      if (!target) return;
      target.replaceChildren();

      const heading = document.createElement("div");
      heading.className = "workforce-status";
      heading.textContent = "历史计划（dev-only 本地计划库）：共 " + plans.length + " 条。";
      target.appendChild(heading);

      if (!plans.length) {
        target.appendChild(createWorkforceNotice("暂无历史计划。生成计划后点击“保存计划”即可出现在这里。"));
        return;
      }

      for (const item of plans) {
        const card = document.createElement("div");
        card.className = "workforce-history-card";

        const title = document.createElement("h4");
        title.textContent = item.goal || item.planId;
        card.appendChild(title);

        const meta = document.createElement("div");
        meta.className = "workforce-history-meta";
        meta.textContent = "planId: " + item.planId + " / savedAt: " + (item.savedAt || "n/a") + " / tasks: " + (item.taskCount || 0);
        card.appendChild(meta);

        const actions = document.createElement("div");
        actions.className = "workforce-history-actions";
        actions.appendChild(createWorkforceHistoryButton("加载", () => loadWorkforcePlan(item.planId)));
        actions.appendChild(createWorkforceHistoryButton("导出 JSON", () => exportWorkforceTaskPackage(item.planId, "json")));
        actions.appendChild(createWorkforceHistoryButton("导出 Markdown", () => exportWorkforceTaskPackage(item.planId, "markdown")));
        actions.appendChild(createWorkforceHistoryButton("删除", () => deleteWorkforcePlan(item.planId)));
        card.appendChild(actions);

        target.appendChild(card);
      }
    }

    function createWorkforceNotice(text, tone) {
      const node = document.createElement("div");
      node.className = "workforce-card" + (tone === "error" ? " result error" : "");
      node.textContent = text;
      return node;
    }

    function createWorkforceHistoryButton(label, onClick) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", onClick);
      return button;
    }

    async function loadWorkforcePlan(planId) {
      const result = await requestJson("/workforce/plans/" + encodeURIComponent(planId));
      writeJson("workforce-output", result);
      if (!result.ok) {
        setWorkforceStatus(formatWorkforceError(result), "error");
        return;
      }

      const taskPackage = result.payload?.data?.taskPackage;
      const plan = createPlanFromTaskPackage(taskPackage);
      lastWorkforcePlan = plan;
      lastWorkforceMarkdown = taskPackage?.markdown || formatWorkforcePlanMarkdown(plan);
      lastWorkforceExportJson = JSON.stringify(taskPackage || plan, null, 2);
      document.getElementById("workforce-goal").value = plan.goal || "";
      updateWorkforceGoalHint();
      renderWorkforcePlan(plan);
      document.getElementById("workforce-copy").disabled = !lastWorkforceMarkdown;
      document.getElementById("workforce-export-json").disabled = !lastWorkforceExportJson;
      document.getElementById("workforce-save").disabled = !lastWorkforcePlan;
      setWorkforceStatus("历史计划已加载。它仍是计划预览，不会自动执行代码或修改文件。", "ok");
    }

    async function exportWorkforceTaskPackage(planId, format) {
      const result = await requestJson("/workforce/plans/" + encodeURIComponent(planId) + "/export");
      writeJson("workforce-output", result);
      if (!result.ok) {
        setWorkforceStatus(formatWorkforceError(result), "error");
        return;
      }
      const data = result.payload?.data || {};
      const taskPackage = data.taskPackage || {};
      if (format === "markdown") {
        downloadTextFile("agent-workforce-" + planId + ".md", data.markdown || taskPackage.markdown || "", "text/markdown");
        setWorkforceStatus("已导出任务包 Markdown，可交给人工或后续安全执行主线审阅。", "ok");
        return;
      }
      downloadTextFile("agent-workforce-" + planId + "-task-package.json", JSON.stringify(taskPackage, null, 2), "application/json");
      setWorkforceStatus("已导出任务包 JSON，可交给人工或后续安全执行主线审阅。", "ok");
    }

    async function deleteWorkforcePlan(planId) {
      const result = await requestJson("/workforce/plans/" + encodeURIComponent(planId), {
        method: "DELETE",
      });
      writeJson("workforce-output", result);
      if (!result.ok) {
        setWorkforceStatus(formatWorkforceError(result), "error");
        return;
      }
      setWorkforceStatus("历史计划已删除。", "ok");
      await refreshWorkforceHistory();
    }

    function createPlanFromTaskPackage(taskPackage) {
      if (!taskPackage) return {};
      const exported = taskPackage.exportableJson && typeof taskPackage.exportableJson === "object"
        ? taskPackage.exportableJson
        : {};
      return {
        ...exported,
        planVersion: exported.planVersion || taskPackage.planVersion,
        createdAt: exported.createdAt || taskPackage.createdAt,
        workforceId: exported.workforceId || taskPackage.workforceId,
        goal: exported.goal || taskPackage.goal,
        summary: exported.summary || taskPackage.summary,
        userFriendlyStatus: exported.userFriendlyStatus || "ready_to_review",
        roleAssignments: exported.roleAssignments || taskPackage.roles || [],
        selectedRoles: exported.selectedRoles || (taskPackage.roles || []).map((item) => item.role),
        taskBreakdown: exported.taskBreakdown || taskPackage.taskBreakdown || [],
        deliverables: exported.deliverables || taskPackage.deliverables || [],
        acceptanceCriteria: exported.acceptanceCriteria || taskPackage.acceptanceCriteria || [],
        risks: exported.risks || taskPackage.risks || [],
        limitations: exported.limitations || taskPackage.limitations || [],
        nextActions: exported.nextActions || taskPackage.nextActions || [],
        recommendedNextStep: exported.recommendedNextStep || taskPackage.recommendedNextStep,
        markdown: taskPackage.markdown,
      };
    }

    function renderWorkforcePlan(plan) {
      const target = document.getElementById("workforce-rendered");
      if (!target) return;
      target.replaceChildren();
      if (!plan) return;

      const summary = document.createElement("div");
      summary.className = "result";
      const title = document.createElement("strong");
      title.textContent = plan.userFriendlyStatus === "ready_to_review" ? "计划已生成，等待你确认" : "计划预览";
      const text = document.createElement("p");
      text.className = "muted";
      text.textContent = plan.summary || plan.goal || "";
      summary.append(title, text);
      target.appendChild(summary);

      appendWorkforceList(target, "计划信息", [
        "版本：" + (plan.planVersion || "n/a"),
        "生成时间：" + (plan.createdAt || "n/a"),
        "状态：" + (plan.userFriendlyStatus || "n/a"),
        "建议下一步：" + (plan.recommendedNextStep || "n/a"),
      ], (item) => item);
      appendWorkforceRoleGrid(target, plan.roleAssignments || []);
      appendWorkforceList(target, "任务拆解", plan.taskBreakdown || [], (task) => task.role + " - " + task.title + "：" + task.description);
      appendWorkforceList(target, "交付物", plan.deliverables || [], (item) => item.title + "：" + item.description + "（负责人：" + item.ownerRole + "）");
      appendWorkforceList(target, "验收标准", plan.acceptanceCriteria || [], (item) => item);
      appendWorkforceList(target, "风险", plan.risks || [], (item) => item);
      appendWorkforceList(target, "限制", plan.limitations || [], (item) => item);
      appendWorkforceList(target, "下一步", plan.nextActions || [], (item) => item);
    }

    function renderWorkforceError(result) {
      const target = document.getElementById("workforce-rendered");
      if (!target) return;
      target.replaceChildren();
      const box = document.createElement("div");
      box.className = "result error";
      const title = document.createElement("strong");
      title.textContent = "生成失败";
      const text = document.createElement("p");
      text.textContent = formatWorkforceError(result);
      box.append(title, text);
      target.appendChild(box);
    }

    function appendWorkforceRoleGrid(target, assignments) {
      const section = appendWorkforceSection(target, "7 个 Agent 角色");
      const grid = document.createElement("div");
      grid.className = "workforce-role-grid";
      for (const assignment of assignments) {
        const card = document.createElement("div");
        card.className = "workforce-card";
        const role = document.createElement("strong");
        role.textContent = assignment.role;
        const responsibility = document.createElement("div");
        responsibility.className = "muted";
        responsibility.textContent = assignment.responsibility;
        card.append(role, responsibility);
        grid.appendChild(card);
      }
      section.appendChild(grid);
    }

    function appendWorkforceList(target, title, items, formatter) {
      const section = appendWorkforceSection(target, title);
      const list = document.createElement("ol");
      list.className = "workforce-list";
      for (const item of items) {
        const node = document.createElement("li");
        node.textContent = formatter(item);
        list.appendChild(node);
      }
      section.appendChild(list);
    }

    function appendWorkforceSection(target, title) {
      const section = document.createElement("div");
      section.className = "workforce-card";
      const heading = document.createElement("h4");
      heading.className = "workforce-section-title";
      heading.textContent = title;
      section.appendChild(heading);
      target.appendChild(section);
      return section;
    }

    function formatWorkforcePlanMarkdown(plan) {
      if (!plan) return "";
      const lines = [
        "# Agent Workforce Plan Preview",
        "",
        "- Workforce ID: " + plan.workforceId,
        "- Plan version: " + plan.planVersion,
        "- Created at: " + plan.createdAt,
        "- Goal: " + plan.goal,
        "- Status: " + plan.userFriendlyStatus,
        "",
        "## Summary",
        plan.summary || "",
        "",
        "## Roles",
      ]
        .concat((plan.roleAssignments || []).map((item) => "- " + item.role + ": " + item.responsibility))
        .concat([
          "",
          "## Tasks",
        ])
        .concat((plan.taskBreakdown || []).map((item) => "- " + item.taskId + " / " + item.role + ": " + item.description))
        .concat([
          "",
          "## Deliverables",
        ])
        .concat((plan.deliverables || []).map((item) => "- " + item.title + ": " + item.description + " (" + item.ownerRole + ")"))
        .concat([
          "",
          "## Acceptance Criteria",
        ])
        .concat((plan.acceptanceCriteria || []).map((item) => "- " + item))
        .concat([
          "",
          "## Risks",
        ])
        .concat((plan.risks || []).map((item) => "- " + item))
        .concat([
          "",
          "## Next Actions",
        ])
        .concat((plan.nextActions || []).map((item) => "- " + item))
        .concat([
          "",
          "## Safety",
          "- Preview only: true",
          "- Real LLM calls: false",
          "- Code execution: false",
          "- Project file writes: false",
          "- Workflow run: false",
        ]);
      return lines.join("\n");
    }

    function formatWorkforceError(result) {
      const error = result?.payload?.error || {};
      const userMessage = error.details?.userMessage || error.message;
      if (userMessage) {
        return userMessage + "（HTTP " + (result.httpStatus || 0) + " / " + (error.code || "UNKNOWN") + "）";
      }
      return "生成失败，请检查目标内容后重试。";
    }

    function downloadTextFile(filename, text, type) {
      const blob = new Blob([text], { type: type || "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }

    function writeJson(id, value) {
      document.getElementById(id).textContent = JSON.stringify(value.payload || value, null, 2);
    }

    function renderEnterpriseOverview(result) {
      const target = document.getElementById("enterprise-overview-summary");
      const data = result.payload?.data;
      if (!result.ok || !data) {
        target.innerHTML = overviewLine("总览", "HTTP " + result.httpStatus, "danger") +
          overviewLine("下一步", "检查 token / auditor role", "warn");
        return;
      }
      const acceptance = data.acceptance || {};
      const releaseCandidate = data.releaseCandidate || {};
      const readiness = data.readiness || {};
      const governance = data.governance || {};
      const safety = data.safety || {};
      const safeSummary = safety.providerCalls === false &&
        safety.runtimeMutation === false &&
        safety.releaseAutomation === false &&
        safety.infrastructureProvisioning === false;

      target.innerHTML = [
        '<div class="overview-note">phase48a-enterprise-overview-readable-summary: 只读状态摘要，原始 JSON 保留在下方。</div>',
        overviewLine("总体状态", data.status || "unknown", statusTone(data.status)),
        overviewLine("企业治理", governance.authEnabled ? "auth/rbac/audit 已开启" : "auth 未开启", governance.authEnabled ? "ok" : "warn"),
        overviewLine("部署准备", readiness.deployment?.status || "unknown", statusTone(readiness.deployment?.status)),
        overviewLine("启动准备", readiness.startup?.status || "unknown", statusTone(readiness.startup?.status)),
        overviewLine("安全准备", readiness.security?.status || "unknown", statusTone(readiness.security?.status)),
        overviewLine("向量链路", (readiness.vector?.mode || "local-keyword") + " / " + (readiness.vector?.status || "unknown"), statusTone(readiness.vector?.status)),
        overviewLine("验收证据", (acceptance.passedCount ?? 0) + "/" + (acceptance.requiredCount ?? 0) + " " + (acceptance.status || "unknown"), statusTone(acceptance.status)),
        overviewLine("交付候选", (releaseCandidate.evidencePassedCount ?? 0) + "/" + (releaseCandidate.evidenceRequiredCount ?? 0) + " " + (releaseCandidate.status || "unknown"), statusTone(releaseCandidate.status)),
        overviewLine("安全边界", safeSummary ? "只读 / 无副作用" : "需要复核", safeSummary ? "ok" : "danger"),
      ].join("");
    }

    function overviewLine(label, value, tone) {
      return '<div class="overview-line"><span>' + escapeHtml(label) + '</span><strong class="status-pill status-' + escapeHtml(tone || "warn") + '">' + escapeHtml(String(value || "unknown")) + '</strong></div>';
    }

    function statusTone(value) {
      const normalized = String(value || "").toLowerCase();
      if (["ready", "passed", "ok", "running", "enabled"].includes(normalized)) return "ok";
      if (["disabled", "not-configured", "not-ready"].includes(normalized)) return "warn";
      if (["blocked", "failed", "error", "denied"].includes(normalized)) return "danger";
      return "warn";
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function readFileAsBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const value = String(reader.result || "");
          resolve(value.includes(",") ? value.slice(value.indexOf(",") + 1) : value);
        };
        reader.onerror = () => reject(reader.error || new Error("File read failed"));
        reader.readAsDataURL(file);
      });
    }
  </script>
</body>
</html>`;
}
