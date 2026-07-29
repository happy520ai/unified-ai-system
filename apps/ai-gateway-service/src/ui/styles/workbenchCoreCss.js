/**
 * Workbench Core CSS
 * Extracted from consolePage.js for better maintainability.
 */

export const workbenchCoreCss = `
    :root {
      --bg: #eef2f6;
      --surface: #ffffff;
      --surface-muted: #f7f9fc;
      --line: #d7dee8;
      --text: #15202b;
      --muted: #5a6777;
      --brand: #0f766e;
      --brand-strong: #115e59;
      --success: #197a42;
      --danger: #b42318;
      --warn: #946200;
      --shadow: 0 12px 34px rgb(16 24 40 / 10%);
    }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; background: radial-gradient(circle at top left, #f9fbff, var(--bg) 55%); color: var(--text); font-family: "Segoe UI", "Microsoft YaHei", sans-serif; }
    body { overflow-y: auto; overflow-x: hidden; }
    button, input, select, textarea { font: inherit; }
    button {
      min-height: 40px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface);
      color: var(--text);
      padding: 0 14px;
      cursor: pointer;
      transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
    }
    button:hover { border-color: #bac7d7; box-shadow: 0 6px 16px rgb(15 23 42 / 8%); }
    button:active { transform: translateY(1px); }
    button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible {
      outline: 3px solid rgb(31 106 165 / 28%);
      outline-offset: 3px;
    }
    button.primary { background: linear-gradient(135deg, var(--brand), var(--brand-strong)); color: #fff; border-color: var(--brand-strong); }
    button.ghost { background: transparent; }
    input, select, textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface);
      color: var(--text);
      padding: 10px 12px;
    }
    textarea { resize: vertical; min-height: 110px; }
    .app {
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr);
      min-height: 100dvh;
      height: auto;
    }
    .sidebar {
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 18px;
      padding: 18px 16px;
      border-right: 1px solid var(--line);
      background: linear-gradient(180deg, #10251f, #17392f 48%, #243f34);
      color: #f8fbff;
    }
    .brand-block { display: grid; gap: 6px; }
    .brand-title { font-size: 19px; font-weight: 700; letter-spacing: 0.2px; }
    .brand-copy { color: rgb(234 242 248 / 78%); font-size: 13px; line-height: 1.5; }
    .nav-list { display: grid; align-content: start; gap: 8px; }
    .nav-button {
      width: 100%;
      justify-content: flex-start;
      text-align: left;
      border-color: rgb(255 255 255 / 10%);
      background: rgb(255 255 255 / 6%);
      color: #f8fbff;
      min-height: 46px;
    }
    .nav-button.is-active {
      background: linear-gradient(135deg, rgb(255 255 255 / 18%), rgb(255 255 255 / 10%));
      border-color: rgb(255 255 255 / 24%);
      box-shadow: inset 0 0 0 1px rgb(255 255 255 / 10%);
    }
    .sidebar-note {
      border: 1px solid rgb(255 255 255 / 12%);
      border-radius: 12px;
      padding: 12px;
      background: rgb(255 255 255 / 7%);
      color: rgb(241 246 250 / 84%);
      font-size: 12px;
      line-height: 1.55;
    }
    .main-shell {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      min-height: 100dvh;
      height: auto;
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      padding: 16px 22px;
      border-bottom: 1px solid var(--line);
      background: rgb(255 255 255 / 88%);
      backdrop-filter: blur(12px);
    }
    .topbar h1 { margin: 0; font-size: 22px; }
    .topbar-copy { color: var(--muted); font-size: 13px; margin-top: 4px; }
    .topbar-status {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 6px 10px;
      background: var(--surface);
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }
    .mission-control {
      display: grid;
      gap: 12px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: linear-gradient(135deg, rgb(255 255 255 / 96%), #f3f8fb);
      box-shadow: var(--shadow);
      padding: 16px;
      overflow: hidden;
      position: relative;
    }
`;
