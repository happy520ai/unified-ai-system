export const consolePageInlineCssPart06 = `    }
    body:has(#future-minimal-os-panel:target) {
      overflow: hidden;
      width: 100%;
      background:
        radial-gradient(circle at 28% 16%, rgb(65 85 170 / 28%), transparent 32%),
        radial-gradient(circle at 78% 22%, rgb(31 188 220 / 14%), transparent 30%),
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
`;
