import { ownerDesignTokensCss } from "./ownerDesignTokens.js";
import { ownerOsThemeCss } from "./ownerOsTheme.js";
import { workbenchCoreCss } from "./workbenchCoreCss.js";

export const consolePageInlineCssPart01 = `
${workbenchCoreCss}
${ownerDesignTokensCss}
${ownerOsThemeCss}
    .future-os-panel {
      display: grid;
      gap: 18px;
      min-height: min(760px, calc(100dvh - 132px));
      align-content: center;
      border: 1px solid rgb(215 222 232 / 92%);
      border-radius: 18px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      padding: clamp(20px, 4vw, 44px);
      box-shadow: 0 18px 45px rgb(15 23 42 / 8%);
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
      color: #111827;
    }
    .future-os-title-block p {
      margin: 0;
      max-width: 680px;
      color: #536170;
      font-size: 16px;
      line-height: 1.7;
    }
    .future-safe-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid #cfd8e3;
      border-radius: 999px;
      padding: 9px 12px;
      background: #ffffff;
      color: #23415d;
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
    }
    .future-safe-pill span {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #197a42;
      box-shadow: 0 0 0 4px rgb(25 122 66 / 12%);
    }
    .future-os-composer {
      display: grid;
      gap: 10px;
    }
    .future-os-composer label {
      font-size: 18px;
      font-weight: 800;
      color: #111827;
    }
    .future-os-composer textarea {
      min-height: 132px;
      border-radius: 16px;
      padding: 16px;
      font-size: 16px;
      line-height: 1.6;
      background: #ffffff;
    }
    .future-os-action-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .future-primary-cta {
      min-height: 48px;
      border-radius: 12px;
      padding: 0 18px;
      font-weight: 800;
    }
    .future-os-action-row span,
    .future-preview-empty {
      color: #667085;
      font-size: 13px;
      line-height: 1.5;
    }
    .future-boundary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .future-boundary-grid span {
      border: 1px solid #d7dee8;
      border-radius: 12px;
      background: #f8fafc;
      color: #344054;
      padding: 11px 12px;
      font-size: 13px;
      font-weight: 700;
      text-align: center;
    }
    .future-mode-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .future-mode-card {
      display: grid;
      gap: 8px;
      border: 1px solid #d7dee8;
      border-radius: 14px;
      background: #ffffff;
      padding: 14px;
      min-height: 138px;
    }
    .future-mode-card.is-recommended {
      border-color: #9fb6cc;
      background: #f4f8fb;
      box-shadow: inset 0 0 0 1px rgb(31 106 165 / 8%);
    }
    .future-mode-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      color: #41576b;
      font-size: 13px;
      font-weight: 800;
    }
    .future-mode-head small {
      border: 1px solid #cfd8e3;
      border-radius: 999px;
      padding: 3px 8px;
      background: #ffffff;
      color: #536170;
      font-size: 11px;
    }
    .future-mode-card strong {
      font-size: 16px;
      color: #111827;
    }
    .future-mode-card p,
    .future-preview-grid p,
    .future-details-grid p {
      margin: 0;
      color: #536170;
      line-height: 1.55;
      overflow-wrap: anywhere;
    }
    .future-preview-card {
      border: 1px solid #d7dee8;
      border-radius: 16px;
      background: #ffffff;
      padding: 16px;
    }
    .future-preview-card[data-preview-visible="true"] {
      box-shadow: 0 10px 30px rgb(15 23 42 / 7%);
    }
    .future-sample-bridge {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      border: 1px solid #d7dee8;
      border-radius: 14px;
      background: #ffffff;
      padding: 14px 16px;
    }
    .future-sample-bridge h3 {
      margin: 2px 0 4px;
      color: #111827;
      font-size: 17px;
    }
    .future-sample-bridge p {
      margin: 0;
      color: #536170;
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
    }
    .future-preview-head span {
      border: 1px solid #d7dee8;
      border-radius: 999px;
      padding: 6px 10px;
      color: #536170;
      font-size: 12px;
      white-space: nowrap;
    }
    .future-preview-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .future-preview-grid > div {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: #f8fafc;
      padding: 12px;
    }
    .future-preview-grid strong {
      display: block;
      margin-bottom: 7px;
      color: #111827;
    }
    .future-details-drawer {
      display: grid;
      gap: 14px;
      border: 1px solid #cfd8e3;
      border-radius: 16px;
      background: #f8fafc;
      padding: 16px;
    }
    .future-details-head {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 12px;
    }
    .future-details-head h3 {
      margin: 4px 0 0;
    }
    .future-details-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .future-details-grid details {
      border: 1px solid #d7dee8;
      border-radius: 12px;
      background: #ffffff;
      padding: 11px 12px;
    }
    .future-details-grid summary {
      cursor: pointer;
      color: #1f3d57;
      font-weight: 800;
    }
    .future-advanced-system-details {
      border: 1px solid #d7dee8;
      border-radius: 14px;
      background: #ffffff;
      padding: 12px 14px;
    }
    .future-advanced-system-details > summary {
      cursor: pointer;
      color: #41576b;
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
      gap: 12px;
      align-items: center;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: linear-gradient(135deg, rgb(255 255 255 / 96%), #f5fbff);
      padding: 12px;
      position: relative;
      overflow: hidden;
      min-height: 222px;
      z-index: 2;
    }
    .yiyi-avatar-layer::before {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent, rgb(31 106 165 / 7%), transparent);
      transform: translateX(-100%);
      animation: yiyi-scan 8s ease-in-out infinite;
      pointer-events: none;
    }
    .yiyi-avatar-stage {
      width: 100%;
      min-height: 190px;
      position: relative;
      display: grid;
      place-items: center;
      border-radius: 18px;
      background:
        radial-gradient(circle at 50% 32%, rgb(255 255 255 / 96%), rgb(238 245 251 / 80%) 42%, rgb(223 234 244 / 80%) 74%, rgb(213 225 237 / 75%));
      border: 1px solid rgb(193 212 229 / 70%);
      box-shadow: inset 0 0 0 1px rgb(255 255 255 / 58%), 0 12px 24px rgb(15 23 42 / 8%);
      overflow: hidden;
      z-index: 1;
    }
    .yiyi-avatar-stage-card .yiyi-avatar-stage-shell {
      width: 100%;
      min-height: 176px;
      transform: scale(0.92);
    }
    .yiyi-avatar-stage-shell {
      width: 100%;
      min-height: 218px;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 8px;
      position: relative;
      z-index: 2;
    }
    .yiyi-avatar-stage-header,
    .yiyi-avatar-stage-footer {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 6px;
    }
    .yiyi-avatar-stage-header span,
    .yiyi-avatar-stage-footer span {
      border: 1px solid rgb(59 130 246 / 16%);
      border-radius: 999px;
      background: rgb(239 246 255 / 90%);
      color: #24445f;
      font-size: 10px;
      font-weight: 800;
      padding: 4px 7px;
    }
    .yiyi-avatar-stage-viewport {
      min-height: 142px;
      display: grid;
      place-items: center;
      border: 1px dashed rgb(79 155 179 / 34%);
      border-radius: 16px;
      background:
        radial-gradient(circle at 50% 36%, rgb(255 255 255 / 96%), transparent 32%),
        radial-gradient(circle at 50% 56%, rgb(174 226 255 / 24%), transparent 62%);
      box-shadow: inset 0 0 0 1px rgb(255 255 255 / 58%);
      overflow: hidden;
    }
    .yiyi-avatar-placeholder {
      display: grid;
      grid-template-columns: 68px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      padding: 12px;
      max-width: 100%;
    }
    .yiyi-avatar-placeholder-image,
    .yiyi-avatar-placeholder-frame {
      width: 68px;
      height: 68px;
      border-radius: 14px;
      object-fit: cover;
      border: 1px solid rgb(147 169 189 / 38%);
      background: rgb(255 255 255 / 82%);
    }
    .yiyi-avatar-placeholder-frame {
      display: grid;
      place-items: center;
      color: #1f6aa5;
      font-weight: 900;
    }
    .yiyi-avatar-placeholder-copy {
      display: grid;
      gap: 5px;
      min-width: 0;
    }
    .yiyi-avatar-placeholder-copy strong {
      color: #163247;
      font-size: 13px;
      line-height: 1.2;
    }
    .yiyi-avatar-placeholder-copy span {
      color: var(--muted);
      font-size: 11px;
      line-height: 1.35;
    }
    .yiyi-avatar-real3d-viewer {
      display: grid;
      gap: 8px;
      place-items: center;
      text-align: center;
      padding: 12px;
    }
    .yiyi-avatar-real3d-badge {
      border: 1px solid rgb(25 122 66 / 24%);
      border-radius: 999px;
      background: rgb(240 253 244 / 88%);
      color: #166534;
      font-size: 11px;
      font-weight: 800;
      padding: 5px 9px;
    }
    .yiyi-avatar-real3d-stage-frame {
      border: 1px solid rgb(79 155 179 / 28%);
      border-radius: 12px;
      background: rgb(255 255 255 / 82%);
      padding: 12px;
      display: grid;
      gap: 5px;
      color: #163247;
    }
    .yiyi-aura,
    .yiyi-orbit,
    .yiyi-path,
    .yiyi-stars {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .yiyi-aura {
      background:
        radial-gradient(circle at 50% 42%, rgb(255 255 255 / 92%), transparent 34%),
        radial-gradient(circle at 50% 55%, rgb(129 179 218 / 18%), transparent 62%);
      animation: yiyi-pulse 4.5s ease-in-out infinite;
    }
    .yiyi-orbit {
      width: 64%;
      height: 64%;
`;
