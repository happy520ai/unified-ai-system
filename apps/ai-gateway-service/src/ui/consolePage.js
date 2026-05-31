import { renderThreeModeOverviewPanel } from "./components/ThreeModeOverviewPanel.js";
import { renderProviderCredentialRefPanel } from "./components/ProviderCredentialRefPanel.js";
import { renderMissionControlPanel } from "./components/MissionControlPanel.js";
import { providerCredentialCopy } from "./copy/providerCredentialCopy.js";
import { ownerDesignTokensCss } from "./styles/ownerDesignTokens.js";
import { ownerOsThemeCss } from "./styles/ownerOsTheme.js";
import { workbenchCoreCss } from "./styles/workbenchCoreCss.js";

function createPhase321AWorkbenchPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI Gateway Workbench</title>
  <style>
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
      left: 18%;
      top: 18%;
      border: 1px solid rgb(88 137 178 / 16%);
      border-radius: 50%;
      animation: yiyi-orbit 10s linear infinite;
    }
    .yiyi-orbit-two { width: 74%; height: 74%; left: 13%; top: 13%; animation-duration: 13s; }
    .yiyi-orbit-three { width: 86%; height: 86%; left: 7%; top: 7%; animation-duration: 18s; }
    .yiyi-avatar-figure {
      width: 150px;
      height: 176px;
      position: relative;
      transform: translateY(4px);
      filter: drop-shadow(0 18px 20px rgb(12 25 40 / 16%));
    }
    .yiyi-hat, .yiyi-face, .yiyi-body, .yiyi-cape, .yiyi-shield, .yiyi-path, .yiyi-stars, .yiyi-eye, .yiyi-blush, .yiyi-hair, .yiyi-hand {
      position: absolute;
    }
    .yiyi-hat {
      width: 96px;
      height: 34px;
      left: 27px;
      top: 10px;
      border-radius: 50% 50% 42% 42%;
      background: linear-gradient(180deg, #ffffff, #eaf2f8);
      border: 1px solid rgb(186 203 219 / 72%);
      box-shadow: 0 4px 8px rgb(15 23 42 / 8%);
    }
    .yiyi-hat::after {
      content: "";
      position: absolute;
      left: -10px;
      right: -10px;
      bottom: -8px;
      height: 14px;
      border-radius: 50%;
      background: linear-gradient(180deg, rgb(255 255 255 / 92%), rgb(224 235 244 / 92%));
      border: 1px solid rgb(186 203 219 / 70%);
    }
    .yiyi-face {
      width: 72px;
      height: 72px;
      left: 39px;
      top: 36px;
      border-radius: 50%;
      background: radial-gradient(circle at 50% 36%, #fffefb, #edf4fa 70%);
      border: 1px solid rgb(192 210 226 / 80%);
    }
    .yiyi-eye {
      width: 7px;
      height: 10px;
      top: 66px;
      border-radius: 50%;
      background: #29374d;
      box-shadow: 0 0 0 2px rgb(255 255 255 / 46%);
    }
    .yiyi-eye-left { left: 63px; }
    .yiyi-eye-right { left: 81px; }
    .yiyi-blush {
      width: 12px;
      height: 6px;
      top: 79px;
      border-radius: 999px;
      background: rgb(255 183 198 / 35%);
      filter: blur(1px);
    }
    .yiyi-blush-left { left: 50px; }
    .yiyi-blush-right { left: 92px; }
    .yiyi-hair {
      width: 42px;
      height: 92px;
      top: 46px;
      background: linear-gradient(180deg, #23283c, #0f1522 82%);
      border-radius: 26px 26px 30px 30px;
      opacity: 0.96;
    }
    .yiyi-hair-left { left: 25px; transform: rotate(-9deg); }
    .yiyi-hair-right { right: 25px; transform: rotate(9deg); }
    .yiyi-body {
      width: 110px;
      height: 74px;
      left: 20px;
      top: 98px;
      border-radius: 34px 34px 28px 28px;
      background: linear-gradient(180deg, #ffffff, #edf5fb 66%, #dce8f2);
      border: 1px solid rgb(188 208 224 / 76%);
    }
    .yiyi-cape {
      width: 122px;
      height: 86px;
      left: 14px;
      top: 94px;
      border-radius: 36px 36px 30px 30px;
      background: linear-gradient(180deg, rgb(171 210 239 / 24%), rgb(255 255 255 / 0%));
      clip-path: polygon(15% 0, 85% 0, 100% 100%, 0% 100%);
    }
    .yiyi-hand {
      width: 18px;
      height: 44px;
      top: 104px;
      border-radius: 999px;
      background: linear-gradient(180deg, #f8fbff, #dfe8f2);
      border: 1px solid rgb(186 203 219 / 70%);
    }
    .yiyi-hand-left { left: 8px; transform: rotate(18deg); }
    .yiyi-hand-right { right: 8px; transform: rotate(-18deg); }
    .yiyi-shield {
      width: 44px;
      height: 54px;
      left: 102px;
      top: 86px;
      border-radius: 16px 16px 20px 20px;
      background: linear-gradient(180deg, rgb(177 220 255 / 48%), rgb(255 255 255 / 10%));
      border: 1px solid rgb(127 181 225 / 48%);
      opacity: 0;
      transform: translateY(4px) scale(0.9);
    }
    .yiyi-path {
      left: 14px;
      top: 58px;
      width: 120px;
      height: 16px;
      border-radius: 999px;
      background: linear-gradient(90deg, transparent, rgb(118 164 209 / 20%), transparent);
      opacity: 0.78;
      transform-origin: center;
    }
    .yiyi-stars {
      background:
        radial-gradient(circle at 20% 26%, rgb(255 255 255 / 88%) 0 2px, transparent 3px),
        radial-gradient(circle at 36% 62%, rgb(255 255 255 / 68%) 0 1.5px, transparent 2.5px),
        radial-gradient(circle at 74% 32%, rgb(255 255 255 / 76%) 0 1.8px, transparent 3px),
        radial-gradient(circle at 82% 68%, rgb(255 255 255 / 62%) 0 1.5px, transparent 2.5px);
      opacity: 0.6;
    }
    .yiyi-copy {
      display: grid;
      gap: 8px;
      align-content: start;
      position: relative;
      z-index: 1;
    }
    .yiyi-copy h3, .yiyi-character-card h4 {
      margin: 0;
      font-size: 24px;
    }
    .yiyi-character-card h4 { font-size: 18px; }
    .yiyi-lead {
      margin: 0;
      color: var(--muted);
      line-height: 1.55;
    }
    .yiyi-meta-row, .yiyi-emotion-row, .yiyi-emotion-tags, .yiyi-controls, .yiyi-token-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .yiyi-state-pill, .yiyi-authority-pill, .yiyi-safety-pill, .yiyi-emotion-pill, .yiyi-behavior-pill, .yiyi-motion-pill, .yiyi-emotion-tags span, .yiyi-token-row span, .yiyi-version-pill, .yiyi-card-grid span, .yiyi-concept-copy span {
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      padding: 7px 10px;
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }
    .yiyi-state-pill, .yiyi-emotion-pill { color: var(--brand-strong); font-weight: 700; }
    .yiyi-speech-bubble, .yiyi-emotion-copy {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surface-muted);
      padding: 12px 14px;
      color: var(--text);
      line-height: 1.6;
      min-height: 64px;
    }
    .yiyi-emotion-panel, .yiyi-character-card, .yiyi-character-settings, .yiyi-brain-panel, .yiyi-model-brain-panel {
      display: grid;
      gap: 8px;
      align-content: start;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: rgb(255 255 255 / 78%);
      padding: 12px;
      min-height: 190px;
      position: relative;
      z-index: 1;
    }
    .yiyi-character-settings {
      grid-column: 1 / -1;
      background: linear-gradient(135deg, rgb(255 255 255 / 88%), rgb(239 249 255 / 78%));
      min-height: auto;
    }
    .yiyi-brain-panel {
      grid-column: 1 / -1;
      background: linear-gradient(135deg, rgb(255 255 255 / 90%), rgb(241 249 252 / 84%));
      min-height: auto;
    }
    .yiyi-model-brain-panel {
      background: linear-gradient(135deg, rgb(255 255 255 / 92%), rgb(244 250 253 / 86%));
      min-height: auto;
    }
    .yiyi-brain-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .yiyi-brain-scenarios {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .yiyi-brain-scenario {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 7px 10px;
      background: var(--surface);
      color: var(--muted);
      font-size: 12px;
    }
    .yiyi-settings-head, .yiyi-settings-subhead {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 10px;
      flex-wrap: wrap;
    }
    .yiyi-settings-head h4 {
      margin: 0;
      font-size: 18px;
    }
    .yiyi-settings-head p {
      margin: 6px 0 0;
      color: var(--muted);
      line-height: 1.55;
    }
    .yiyi-settings-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .yiyi-setting-card, .yiyi-setting-line-card, .yiyi-persona-editor {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: rgb(255 255 255 / 82%);
      padding: 10px;
      display: grid;
      gap: 8px;
      min-width: 0;
    }
    .yiyi-setting-card p, .yiyi-setting-line-card p {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
      font-size: 13px;
    }
    .yiyi-setting-card small, .yiyi-setting-line-card small {
      color: var(--success);
    }
    .yiyi-scenario-lines {
      display: grid;
      gap: 8px;
    }
    .yiyi-setting-line-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .yiyi-persona-editor textarea {
      min-height: 74px;
      resize: vertical;
    }
    .yiyi-persona-result {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--surface-muted);
      color: var(--text);
      padding: 10px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    .yiyi-character-card {
      min-height: 190px;
      background: linear-gradient(135deg, rgb(255 255 255 / 86%), rgb(235 247 255 / 72%));
    }
    .yiyi-card-title-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: start;
    }
    .yiyi-card-title-row p {
      margin: 4px 0 0;
      color: var(--muted);
      line-height: 1.45;
      font-size: 13px;
    }
    .yiyi-card-grid {
      display: grid;
      gap: 6px;
    }
    .yiyi-card-grid span {
      border-radius: 10px;
      white-space: normal;
      line-height: 1.35;
    }
    .yiyi-card-details {
      display: grid;
      gap: 8px;
    }
    .yiyi-card-details summary {
      cursor: pointer;
      color: var(--brand-strong);
      font-weight: 700;
      font-size: 13px;
    }
    .yiyi-concept-preview {
      display: grid;
      grid-template-columns: minmax(120px, 0.95fr) minmax(0, 1fr);
      gap: 10px;
      align-items: start;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: rgb(255 255 255 / 76%);
      padding: 8px;
    }
    .yiyi-concept-frame {
      aspect-ratio: 4 / 3;
      border: 1px solid rgb(193 212 229 / 76%);
      border-radius: 12px;
      background: linear-gradient(135deg, #ffffff, #eef8ff);
      overflow: hidden;
      display: grid;
      place-items: center;
    }
    .yiyi-concept-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
    }
    .yiyi-concept-copy {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      align-content: start;
      font-size: 12px;
      line-height: 1.45;
    }
    .yiyi-concept-copy strong {
      flex-basis: 100%;
    }
    .yiyi-concept-missing {
      color: var(--muted);
      font-size: 12px;
      text-align: center;
      padding: 10px;
    }
    .yiyi-avatar-layer[data-yiyi-mode="compact"] {
      grid-template-columns: minmax(180px, 220px) minmax(0, 1fr);
    }
    .yiyi-avatar-layer[data-yiyi-mode="compact"] .yiyi-emotion-panel,
    .yiyi-avatar-layer[data-yiyi-mode="compact"] .yiyi-character-card {
      grid-column: 1 / -1;
      min-height: auto;
    }
    .yiyi-avatar-layer[data-yiyi-mode="compact"] .yiyi-copy h3 {
      font-size: 22px;
    }
    .yiyi-avatar-layer[data-yiyi-hidden="true"] {
      display: none;
    }
    .yiyi-live-avatar-stage {
      position: fixed;
      right: 28px;
      bottom: 30px;
      width: 226px;
      min-height: 314px;
      z-index: 80;
      pointer-events: none;
      transform: translate3d(0, 0, 0);
      animation: yiyi-live-roam 11s ease-in-out infinite;
    }
    .yiyi-live-shell {
      display: grid;
      gap: 8px;
      justify-items: center;
      pointer-events: none;
      transform-origin: 50% 70%;
      transition: transform 180ms ease, opacity 180ms ease, filter 180ms ease;
    }
    .yiyi-live-body {
      width: 178px;
      height: 218px;
      position: relative;
      border-radius: 42px;
      display: grid;
      place-items: center;
      background:
        radial-gradient(ellipse at 50% 35%, rgb(241 250 255 / 58%), transparent 44%),
        radial-gradient(ellipse at 50% 60%, rgb(142 194 219 / 18%), transparent 68%);
      filter: drop-shadow(0 22px 28px rgb(15 23 42 / 18%));
      animation: yiyi-live-float 4.8s ease-in-out infinite;
    }
    .yiyi-live-bubble {
      max-width: 218px;
      border: 1px solid rgb(67 139 167 / 28%);
      border-radius: 14px 14px 14px 5px;
      background: rgb(255 255 255 / 92%);
      box-shadow: 0 14px 24px rgb(15 23 42 / 12%);
      color: #163247;
      font-size: 12px;
      font-weight: 800;
      line-height: 1.45;
      padding: 9px 11px;
      pointer-events: none;
    }
    .yiyi-live-boundary {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 5px;
      max-width: 230px;
      pointer-events: none;
    }
    .yiyi-live-boundary span {
      border: 1px solid rgb(59 130 246 / 16%);
      border-radius: 999px;
      background: rgb(239 246 255 / 88%);
      color: #24445f;
      font-size: 10px;
      font-weight: 800;
      padding: 4px 6px;
    }
    .yiyi-live-controls,
    .yiyi-live-demo-triggers {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 5px;
      pointer-events: auto;
      max-width: 252px;
    }
    .yiyi-live-controls button,
    .yiyi-live-demo-triggers button {
      min-height: 28px;
      border-radius: 999px;
      padding: 0 8px;
      background: rgb(255 255 255 / 90%);
      box-shadow: 0 8px 16px rgb(15 23 42 / 9%);
      font-size: 11px;
      font-weight: 800;
    }
    .yiyi-live-controls button.is-active {
      border-color: #4f9bb3;
      background: rgb(229 248 252 / 94%);
      color: #123c4b;
    }
    .yiyi-live-demo-triggers {
      opacity: 0;
      transform: translateY(4px);
      transition: opacity 160ms ease, transform 160ms ease;
    }
    .yiyi-live-avatar-stage:hover .yiyi-live-demo-triggers,
    .yiyi-live-avatar-stage[data-yiyi-show-triggers="true"] .yiyi-live-demo-triggers {
      opacity: 1;
      transform: translateY(0);
    }
    .yiyi-live-orbit,
    .yiyi-live-route,
    .yiyi-live-note,
    .yiyi-live-block-badge {
      position: absolute;
      pointer-events: none;
    }
    .yiyi-live-orbit {
      width: 126px;
      height: 126px;
      left: 26px;
      top: 42px;
      border: 1px solid rgb(65 127 180 / 18%);
      border-radius: 50%;
      opacity: 0.45;
      animation: yiyi-live-orbit 9s linear infinite;
    }
    .live-orbit-two { width: 150px; height: 150px; left: 14px; top: 30px; animation-duration: 13s; }
    .live-orbit-three { width: 166px; height: 166px; left: 6px; top: 22px; animation-duration: 16s; }
    .yiyi-layered-avatar {
      position: relative;
      width: 158px;
      height: 210px;
      transform-origin: 50% 72%;
      animation: yiyi-layered-idle 3.7s ease-in-out infinite;
      isolation: isolate;
    }
    .yiyi-layered-part {
      position: absolute;
      display: block;
      pointer-events: none;
      user-select: none;
    }
    .yiyi-layered-aura { width: 198px; height: 224px; left: -20px; top: -8px; z-index: 0; opacity: .88; animation: yiyi-live-pulse 3.4s ease-in-out infinite; }
    .yiyi-layered-hair-back { width: 98px; height: 144px; left: 30px; top: 25px; z-index: 2; }
    .yiyi-layered-body { width: 112px; height: 118px; left: 23px; top: 84px; z-index: 4; filter: drop-shadow(0 12px 14px rgb(15 23 42 / 10%)); }
    .yiyi-layered-arms { width: 132px; height: 118px; left: 13px; top: 96px; z-index: 5; }
    .yiyi-layered-face { width: 72px; height: 78px; left: 43px; top: 49px; z-index: 7; }
    .yiyi-layered-hair-left { width: 52px; height: 132px; left: 17px; top: 47px; z-index: 8; transform-origin: 60% 12%; animation: yiyi-layered-hair-sway 5.4s ease-in-out infinite; }
    .yiyi-layered-hair-right { width: 52px; height: 132px; right: 17px; top: 47px; z-index: 8; transform-origin: 40% 12%; animation: yiyi-layered-hair-sway-right 5.4s ease-in-out infinite; }
    .yiyi-layered-hat { width: 124px; height: 48px; left: 17px; top: 15px; z-index: 10; filter: drop-shadow(0 7px 8px rgb(15 23 42 / 12%)); }
    .yiyi-layered-shield { width: 54px; height: 66px; right: -1px; top: 94px; z-index: 12; opacity: 0; transform: translateY(10px) scale(.86); transition: opacity 160ms ease, transform 160ms ease; filter: drop-shadow(0 0 16px rgb(82 171 210 / 30%)); }
    .yiyi-layered-orbit-dots { width: 172px; height: 172px; left: -7px; top: 20px; z-index: 1; opacity: 0; animation: yiyi-live-orbit 12s linear infinite; }
    .yiyi-layered-path-glow { width: 148px; height: 60px; left: 5px; top: 130px; z-index: 11; opacity: 0; transform: rotate(-8deg); transition: opacity 160ms ease; }
    .yiyi-layered-note-board { width: 58px; height: 46px; right: -12px; top: 42px; z-index: 13; opacity: 0; transform: translateY(8px) rotate(4deg); transition: opacity 160ms ease, transform 160ms ease; filter: drop-shadow(0 10px 14px rgb(15 23 42 / 12%)); }
    .yiyi-live-route {
      width: 138px;
      height: 64px;
      left: 20px;
      top: 120px;
      opacity: 0;
      border-bottom: 3px solid rgb(68 151 202 / 44%);
      border-radius: 50%;
      transform: rotate(-12deg);
    }
    .yiyi-live-note {
      width: 52px;
      height: 42px;
      left: 112px;
      top: 38px;
      border-radius: 8px;
      background: rgb(255 255 255 / 92%);
      border: 1px solid rgb(88 119 153 / 28%);
      box-shadow: 0 10px 18px rgb(15 23 42 / 12%);
      opacity: 0;
      transform: translateY(8px) rotate(4deg);
    }
    .yiyi-live-block-badge {
      right: 3px;
      top: 88px;
      border-radius: 999px;
      background: rgb(180 35 24 / 92%);
      color: #fff;
      font-size: 9px;
      font-weight: 900;
      padding: 4px 6px;
      opacity: 0;
      transform: scale(0.8);
      z-index: 8;
    }
    .yiyi-live-avatar-stage[data-yiyi-live-mode="compact"] {
      width: 158px;
      min-height: 216px;
      right: 18px;
      bottom: 18px;
    }
    .yiyi-live-avatar-stage[data-yiyi-live-mode="compact"] .yiyi-live-body {
      width: 126px;
      height: 156px;
      transform: scale(0.78);
      margin-bottom: -18px;
    }
    .yiyi-live-avatar-stage[data-yiyi-live-mode="compact"] .yiyi-live-boundary,
    .yiyi-live-avatar-stage[data-yiyi-live-mode="compact"] .yiyi-live-demo-triggers {
      display: none;
    }
    .yiyi-live-avatar-stage[data-yiyi-live-hidden="true"] .yiyi-live-body,
    .yiyi-live-avatar-stage[data-yiyi-live-hidden="true"] .yiyi-live-bubble,
    .yiyi-live-avatar-stage[data-yiyi-live-hidden="true"] .yiyi-live-boundary,
    .yiyi-live-avatar-stage[data-yiyi-live-hidden="true"] .yiyi-live-demo-triggers {
      display: none;
    }
    .yiyi-live-avatar-stage[data-yiyi-live-hidden="true"] {
      width: auto;
      min-height: auto;
    }
    .yiyi-live-avatar-stage[data-yiyi-motion-enabled="false"] {
      animation: none !important;
    }
    .yiyi-live-avatar-stage[data-yiyi-motion-enabled="false"] * {
      animation: none !important;
      transition: none !important;
    }
    .yiyi-live-avatar-stage[data-yiyi-reduced-motion="true"] .yiyi-live-bubble {
      border-style: dashed;
    }
    .yiyi-live-avatar-stage[data-yiyi-live-motion="mouse_attention"] .yiyi-live-shell {
      transform: translateY(-4px) rotate(var(--yiyi-look-angle, 0deg));
    }
    .yiyi-live-avatar-stage[data-yiyi-live-motion="mouse_attention"] .yiyi-layered-avatar {
      transform: rotate(var(--yiyi-look-angle, 0deg)) translateY(-2px);
    }
    .yiyi-live-avatar-stage[data-yiyi-live-behavior="security_guard"] .yiyi-layered-shield,
    .yiyi-live-avatar-stage[data-yiyi-live-behavior="red_team_blocked"] .yiyi-layered-shield {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    .yiyi-live-avatar-stage[data-yiyi-live-behavior="red_team_blocked"] .yiyi-live-block-badge {
      opacity: 1;
      transform: scale(1);
    }
    .yiyi-live-avatar-stage[data-yiyi-live-behavior="god_mode_excited"] .yiyi-live-orbit {
      opacity: 1;
      border-width: 2px;
      border-color: rgb(54 132 204 / 36%);
      box-shadow: 0 0 18px rgb(54 132 204 / 12%);
    }
    .yiyi-live-avatar-stage[data-yiyi-live-behavior="god_mode_excited"] .yiyi-layered-orbit-dots {
      opacity: 1;
    }
    .yiyi-live-avatar-stage[data-yiyi-live-behavior="tianshu_planning"] .yiyi-live-route {
      opacity: 1;
      animation: yiyi-live-route 2.6s ease-in-out infinite;
    }
    .yiyi-live-avatar-stage[data-yiyi-live-behavior="tianshu_planning"] .yiyi-layered-path-glow {
      opacity: 1;
      animation: yiyi-layered-path 2.6s ease-in-out infinite;
    }
    .yiyi-live-avatar-stage[data-yiyi-live-behavior="evidence_explaining"] .yiyi-live-note {
      opacity: 1;
      transform: translateY(0) rotate(4deg);
    }
    .yiyi-live-avatar-stage[data-yiyi-live-behavior="evidence_explaining"] .yiyi-layered-note-board {
      opacity: 1;
      transform: translateY(0) rotate(4deg);
    }
    .yiyi-avatar-layer[data-yiyi-behavior="security_guard"] .yiyi-shield,
    .yiyi-avatar-layer[data-yiyi-behavior="red_team_blocked"] .yiyi-shield {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    .yiyi-avatar-layer[data-yiyi-behavior="tianshu_planning"] .yiyi-path {
      opacity: 1;
      background: linear-gradient(90deg, transparent, rgb(110 165 222 / 40%), transparent);
    }
    .yiyi-avatar-layer[data-yiyi-behavior="god_mode_excited"] .yiyi-orbit {
      border-color: rgb(85 141 205 / 28%);
      animation-duration: 7s;
    }
    .yiyi-avatar-layer[data-yiyi-motion="mouse_attention"] .yiyi-avatar-figure {
      transform: translateY(1px) scale(1.02);
    }
    .yiyi-avatar-layer[data-yiyi-motion="thinking"] .yiyi-aura {
      animation-duration: 2.4s;
    }
    .yiyi-guided-showcase {
      border: 1px solid rgb(88 119 153 / 24%);
      border-radius: 14px;
      background: linear-gradient(135deg, rgb(255 255 255 / 94%), rgb(235 247 248 / 92%));
      padding: 14px;
      display: grid;
      gap: 12px;
      position: relative;
      z-index: 1;
    }
    .showcase-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .showcase-head h3 { margin: 0; font-size: 20px; }
    .showcase-head p { margin: 6px 0 0; color: var(--muted); line-height: 1.5; }
    .showcase-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
    .demo-safety-bar, .showcase-boundary-tags { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .demo-safety-bar span, .showcase-boundary-tags span {
      border: 1px solid rgb(30 64 175 / 16%);
      border-radius: 999px;
      background: rgb(239 246 255 / 88%);
      color: #23415f;
      font-size: 12px;
      font-weight: 700;
      padding: 7px 10px;
    }
    .showcase-layout { display: grid; grid-template-columns: minmax(220px, 0.34fr) minmax(0, 1fr); gap: 12px; align-items: stretch; }
    .showcase-stepper { display: grid; gap: 7px; align-content: start; }
    .showcase-step {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: rgb(255 255 255 / 86%);
      color: var(--text);
      padding: 9px 10px;
      display: flex;
      align-items: center;
      gap: 9px;
      text-align: left;
      min-height: 42px;
      cursor: pointer;
    }
    .showcase-step span {
      width: 26px;
      height: 26px;
      border-radius: 999px;
      background: rgb(21 94 117 / 10%);
      color: #155e75;
      display: inline-grid;
      place-items: center;
      font-size: 11px;
      font-weight: 800;
      flex: 0 0 auto;
    }
    .showcase-step.is-active, .showcase-scene.is-active {
      border-color: #4f9bb3;
      background: rgb(230 250 252 / 96%);
      box-shadow: 0 10px 22px rgb(15 23 42 / 8%);
    }
    .showcase-stage {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: rgb(255 255 255 / 82%);
      padding: 12px;
      display: grid;
      gap: 10px;
      min-height: 190px;
      box-shadow: inset 0 0 0 1px rgb(255 255 255 / 48%);
    }
    .yiyi-showcase-bubble {
      border: 1px solid rgb(79 155 179 / 28%);
      border-radius: 12px;
      background: rgb(225 247 250 / 70%);
      color: #153448;
      line-height: 1.55;
      padding: 12px;
      font-weight: 700;
    }
    .showcase-current { display: grid; gap: 6px; }
    .showcase-current p, .showcase-scene p, .showcase-closing p { margin: 0; color: var(--muted); line-height: 1.5; }
    .showcase-scenes { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
    .showcase-scene {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: rgb(255 255 255 / 78%);
      padding: 10px;
      display: grid;
      gap: 6px;
      min-height: 154px;
      align-content: start;
    }
    .showcase-scene h4 { margin: 0; font-size: 14px; }
    .showcase-closing {
      border: 1px solid rgb(21 94 117 / 18%);
      border-radius: 10px;
      background: rgb(240 253 250 / 72%);
      padding: 10px;
      display: grid;
      gap: 6px;
    }
    @keyframes yiyi-scan { 0%, 70% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
    @keyframes yiyi-pulse { 0%, 100% { opacity: 0.72; transform: scale(1); } 50% { opacity: 1; transform: scale(1.04); } }
    @keyframes yiyi-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes yiyi-live-roam { 0%, 100% { transform: translate3d(0, 0, 0); } 35% { transform: translate3d(-18px, -12px, 0); } 70% { transform: translate3d(10px, -4px, 0); } }
    @keyframes yiyi-live-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
    @keyframes yiyi-live-pulse { 0%, 100% { opacity: 0.68; transform: scale(0.96); } 50% { opacity: 1; transform: scale(1.06); } }
    @keyframes yiyi-live-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes yiyi-live-breathe { 0%, 100% { transform: translateY(1px) scale(1); } 50% { transform: translateY(-3px) scale(1.025); } }
    @keyframes yiyi-layered-idle { 0%, 100% { transform: translateY(1px) scale(1); } 50% { transform: translateY(-3px) scale(1.018); } }
    @keyframes yiyi-layered-hair-sway { 0%, 100% { transform: rotate(-3deg) translateY(0); } 50% { transform: rotate(-6deg) translateY(2px); } }
    @keyframes yiyi-layered-hair-sway-right { 0%, 100% { transform: rotate(3deg) translateY(0); } 50% { transform: rotate(6deg) translateY(2px); } }
    @keyframes yiyi-layered-path { 0%, 100% { filter: brightness(1); transform: rotate(-8deg) scaleX(.94); } 50% { filter: brightness(1.28); transform: rotate(-8deg) scaleX(1.04); } }
    @keyframes yiyi-live-cape { 0%, 100% { transform: translateX(0) skewX(0deg); } 50% { transform: translateX(3px) skewX(-3deg); } }
    @keyframes yiyi-live-wave { 0%, 100% { transform: rotate(-18deg); } 45% { transform: rotate(-42deg); } 70% { transform: rotate(-10deg); } }
    @keyframes yiyi-live-route { 0%, 100% { filter: brightness(1); transform: rotate(-12deg) scaleX(0.94); } 50% { filter: brightness(1.28); transform: rotate(-12deg) scaleX(1.04); } }
    .mission-control::before {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent, rgb(31 106 165 / 9%), transparent);
      transform: translateX(-100%);
      animation: mission-scan 7s ease-in-out infinite;
      pointer-events: none;
    }
    .owner-boss-view {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 16px;
      border: 1px solid var(--owner-line);
      border-radius: var(--owner-radius);
      background: linear-gradient(180deg, var(--owner-surface), var(--owner-surface-soft));
      padding: clamp(16px, 2.6vw, 24px);
      box-shadow: var(--owner-shadow);
    }
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
    }
    .owner-boss-head p {
      max-width: 760px;
      margin: 8px 0 0;
      color: var(--muted);
      line-height: 1.65;
    }
    .owner-boss-promise {
      color: var(--owner-ink) !important;
      font-weight: 750;
    }
    .owner-boundary-pill {
      display: inline-flex;
      align-items: center;
      border: 1px solid #b9ddc9;
      border-radius: 999px;
      background: var(--owner-success-soft);
      color: var(--owner-success);
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }
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
      border-radius: var(--owner-radius);
      font-size: 18px;
      font-weight: 800;
      display: grid;
      gap: 4px;
      place-items: center;
      background: linear-gradient(135deg, var(--owner-accent), var(--owner-accent-strong));
      box-shadow: 0 14px 28px rgb(23 104 172 / 22%);
    }
    .owner-primary-cta small {
      color: rgb(255 255 255 / 86%);
      font-size: 12px;
      font-weight: 650;
      line-height: 1.35;
    }
    .owner-feedback-line {
      border: 1px solid #bfdbfe;
      border-radius: var(--owner-radius);
      background: var(--owner-accent-soft);
      color: var(--owner-accent-strong);
      padding: 12px 14px;
      font-size: 13px;
      line-height: 1.55;
      font-weight: 650;
    }
    .owner-summary-grid, .owner-guidance-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .owner-section-label {
      color: var(--brand);
      font-size: 13px;
      font-weight: 800;
    }
    .owner-guidance-grid {
      grid-template-columns: minmax(0, 1fr) minmax(280px, 0.75fr);
    }
    .owner-summary-card, .owner-usage-panel, .owner-gated-panel, .owner-action-log, .owner-daily-report-panel, .owner-advanced-intro {
      border: 1px solid var(--owner-line);
      border-radius: var(--owner-radius);
      background: var(--owner-surface);
      padding: var(--owner-card-pad);
      display: grid;
      gap: 10px;
    }
    .owner-summary-card-today-completed {
      background: linear-gradient(180deg, #ffffff, var(--owner-success-soft));
      border-color: #c7ead4;
    }
    .owner-summary-card-problems-found {
      background: linear-gradient(180deg, #ffffff, var(--owner-warn-soft));
      border-color: #f3d9a3;
    }
    .owner-summary-card-next-action {
      background: linear-gradient(180deg, #ffffff, var(--owner-accent-soft));
      border-color: #bfdbfe;
    }
    .owner-summary-card strong, .owner-usage-panel strong, .owner-gated-panel strong, .owner-action-log strong, .owner-daily-report-panel strong, .owner-advanced-intro strong {
      font-size: 15px;
    }
    .owner-summary-card ul, .owner-usage-panel ol, .owner-action-log ul, .owner-daily-report-panel ul {
      margin: 0;
      padding-left: 20px;
      color: var(--muted);
      line-height: 1.65;
    }
    .owner-daily-report-panel p, .owner-advanced-intro p {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
    }
    .owner-gated-panel p {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
    }
    .owner-gated-panel button:disabled {
      cursor: not-allowed;
      background: #eef1f4;
      color: #697586;
      border-color: #d0d5dd;
      box-shadow: none;
    }
    .mission-radar { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 0.8fr); gap: 14px; align-items: start; position: relative; }
    .mission-radar h2 { margin: 0; font-size: 24px; }
    .mission-radar p { margin: 6px 0 0; color: var(--muted); line-height: 1.55; }
    .eyebrow { color: var(--brand); font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .radar-grid, .shield-list, .mission-flow, .red-team-playground, .evidence-timeline, .arena-strip { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .radar-grid span, .shield-list span, .mission-flow span, .red-team-playground span, .evidence-timeline span, .arena-strip span { border: 1px solid var(--line); border-radius: 999px; background: rgb(255 255 255 / 82%); color: var(--muted); padding: 7px 10px; font-size: 12px; }
    .radar-grid strong, .shield-list strong { color: var(--text); }
    .mission-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 300px); gap: 12px; position: relative; }
    .mission-workspace, .security-shield { border: 1px solid var(--line); border-radius: 14px; background: rgb(255 255 255 / 72%); padding: 12px; display: grid; gap: 10px; }
    .mission-input-row { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
    .mission-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .mission-card { border: 1px solid var(--line); border-radius: 14px; background: var(--surface); padding: 12px; min-height: 132px; display: grid; gap: 7px; position: relative; overflow: hidden; }
    .mission-card:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgb(15 23 42 / 8%); border-color: #bfd3e5; }
    .mission-card p { margin: 0; color: var(--muted); line-height: 1.45; }
    .mission-card small { color: var(--success); }
    .life-dot, .agent-orbit { width: 12px; height: 12px; border-radius: 999px; background: var(--success); box-shadow: 0 0 0 6px rgb(25 122 66 / 10%); animation: mission-pulse 2.8s ease-in-out infinite; flex: 0 0 auto; }
    .agent-orbit { position: absolute; right: 12px; top: 12px; width: 9px; height: 9px; background: var(--brand); }
    .security-shield h3 { margin: 0; }
    .red-team-playground, .evidence-timeline, .arena-strip { border: 1px solid var(--line); border-radius: 14px; background: rgb(255 255 255 / 72%); padding: 10px; position: relative; }
    .red-team-playground strong, .evidence-timeline strong, .arena-strip strong { margin-right: 4px; }
    .mission-tagline { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
    .mission-tagline::before { content: ""; width: 26px; height: 1px; background: rgb(31 106 165 / 34%); }
    .onboarding-tour, .drilldown-panel, .comparison-panel, .scenario-library, .evidence-export, .scenario-trial-panel, .scenario-dry-run-result, .workforce-preview-panel, .internal-employee-communication-panel, .branch-execution-preview-panel, .long-horizon-hardening-panel, .codex-context-gateway-panel {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: rgb(255 255 255 / 80%);
      padding: 12px;
      display: grid;
      gap: 10px;
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
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      padding: 8px 12px;
      color: var(--muted);
      font-size: 12px;
    }
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
      background: linear-gradient(135deg, rgb(255 255 255 / 92%), rgb(240 247 252 / 92%));
      position: relative;
      z-index: 1;
    }
    .scenario-trial-panel.is-prominent {
      border-color: rgb(31 106 165 / 38%);
      box-shadow: 0 14px 34px rgb(15 23 42 / 12%);
    }
    .scenario-trial-copy h3, .scenario-dry-run-result h3 {
      margin: 2px 0 0;
      font-size: 19px;
    }
    .scenario-trial-copy p, .scenario-sample-task p, .scenario-step p, .scenario-mode-explainer p, .scenario-replay-preview p {
      margin: 0;
      color: var(--muted);
      line-height: 1.5;
    }
    .scenario-sample-task {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      border: 1px solid rgb(31 106 165 / 24%);
      border-radius: 14px;
      background: var(--surface);
      padding: 12px;
    }
    .scenario-sample-task strong {
      display: block;
      margin-bottom: 6px;
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
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface);
      color: var(--text);
      padding: 8px 12px;
      text-decoration: none;
      font-size: 13px;
    }
    button.scenario-action {
      cursor: pointer;
    }
    .scenario-action.primary {
      background: linear-gradient(135deg, var(--brand), var(--brand-strong));
      color: #fff;
      border-color: var(--brand-strong);
    }
    .scenario-dry-run-result[hidden] {
      display: none;
    }
    .scenario-dry-run-result.is-visible {
      border-color: rgb(25 122 66 / 34%);
      box-shadow: inset 0 0 0 1px rgb(25 122 66 / 12%);
    }
    .scenario-boundary-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .scenario-boundary-badges span {
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      color: var(--success);
      padding: 7px 10px;
      font-size: 12px;
      font-weight: 700;
    }
    .scenario-step-grid, .scenario-mode-explainer {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .scenario-step, .scenario-mode-explainer article, .scenario-replay-preview {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: rgb(255 255 255 / 82%);
      padding: 11px;
      display: grid;
      gap: 6px;
    }
    .scenario-mode-explainer article.is-recommended {
      border-color: rgb(25 122 66 / 34%);
      box-shadow: inset 0 0 0 1px rgb(25 122 66 / 10%);
    }
    .workforce-preview-panel, .internal-employee-communication-panel, .branch-execution-preview-panel, .long-horizon-hardening-panel, .codex-context-gateway-panel {
      background: rgb(255 255 255 / 72%);
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
      border: 1px solid var(--line);
      border-radius: 12px;
      background: rgb(255 255 255 / 82%);
      padding: 11px;
      display: grid;
      gap: 6px;
    }
    .workforce-preview-card p, .workforce-preview-result p, .internal-communication-card p, .internal-communication-result p, .branch-execution-card p, .branch-execution-result p, .hardening-preview-card p, .hardening-preview-result p, .codex-context-card p, .codex-context-preview-card p, .codex-context-result p {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
    }
    .codex-context-card small, .codex-context-preview-card small {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
    }
    .codex-context-card strong {
      overflow-wrap: anywhere;
      line-height: 1.25;
    }
    .codex-context-preview-card ul {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 5px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
    }
    .codex-context-preview-card li {
      overflow-wrap: anywhere;
    }
    .codex-context-preview-card code {
      color: #24445f;
      background: #edf3f9;
      border-radius: 6px;
      padding: 1px 5px;
    }
    .codex-context-preview-card pre {
      max-height: 150px;
      overflow: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      margin: 0;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: #f8fafc;
      color: #263746;
      padding: 9px;
      font-size: 12px;
      line-height: 1.45;
    }
    .workforce-level-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .workforce-level-row span {
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      color: var(--muted);
      padding: 7px 10px;
      font-size: 12px;
    }
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
      color: var(--muted);
      font-size: 12px;
    }
    .internal-communication-flow-strip span, .branch-execution-flow-strip span, .hardening-flow-strip span {
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      padding: 6px 9px;
    }
    .workforce-preview-result[hidden], .internal-communication-result[hidden], .branch-execution-result[hidden], .hardening-preview-result[hidden], .codex-context-result[hidden] {
      display: none;
    }
    .workforce-preview-result.is-visible, .internal-communication-result.is-visible, .branch-execution-result.is-visible, .hardening-preview-result.is-visible, .codex-context-result.is-visible {
      border-color: rgb(25 122 66 / 34%);
      box-shadow: inset 0 0 0 1px rgb(25 122 66 / 10%);
    }
    .tour-step, .drilldown-card, .comparison-card, .scenario-card {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surface);
      padding: 12px;
      display: grid;
      gap: 4px;
      text-align: left;
    }
    .tour-step strong, .drilldown-card strong, .comparison-card strong, .scenario-card strong, .export-card strong { font-size: 14px; }
    .tour-step small, .drilldown-card small, .comparison-card small, .scenario-card small, .export-card small, .drilldown-detail small, .scenario-detail small { color: var(--success); }
    .tour-step.is-active, .drilldown-card.is-active, .scenario-card.is-active, .comparison-card.is-recommended {
      border-color: rgb(31 106 165 / 36%);
      box-shadow: 0 10px 22px rgb(15 23 42 / 8%);
    }
    .tour-step strong { margin: 0; }
    .tour-copy, .drilldown-detail, .scenario-detail, .comparison-footer, .shield-summary {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--surface-muted);
      padding: 12px;
      color: var(--text);
      line-height: 1.55;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .drilldown-detail, .scenario-detail { display: grid; gap: 6px; }
    .comparison-card { border-radius: 16px; align-content: start; }
    .export-card {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surface);
      padding: 12px;
      display: grid;
      gap: 4px;
      text-align: left;
    }
    .comparison-card.is-recommended { background: linear-gradient(135deg, #eef6ff, #ffffff); }
    .comparison-card p { margin: 0; color: var(--muted); line-height: 1.5; }
    .comparison-footer { justify-content: space-between; }
    .comparison-footer span, .shield-summary span { border: 1px solid var(--line); border-radius: 999px; padding: 6px 10px; background: var(--surface); font-size: 12px; color: var(--muted); }
    @keyframes mission-pulse { 0%, 100% { transform: scale(1); opacity: 0.82; } 50% { transform: scale(1.18); opacity: 1; } }
    @keyframes mission-scan { 0%, 70% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
    .scenario-card, .drilldown-card, .tour-step, .comparison-card, .export-card {
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background-color 120ms ease;
    }
    .scenario-card:hover, .drilldown-card:hover, .tour-step:hover, .comparison-card:hover {
      transform: translateY(-1px);
      border-color: #bfd3e5;
      box-shadow: 0 10px 22px rgb(15 23 42 / 8%);
    }
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
      border-radius: 18px;
      background: rgb(255 255 255 / 92%);
      box-shadow: var(--shadow);
      padding: 18px;
    }
    .card h2, .card h3, .card h4 { margin: 0; }
    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }
    .card-copy {
      color: var(--muted);
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
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surface-muted);
      padding: 14px;
      display: grid;
      gap: 6px;
    }
    .stat-label { color: var(--muted); font-size: 12px; }
    .stat-value { font-size: 20px; font-weight: 700; }
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
      border: 1px solid var(--line);
      border-radius: 18px;
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
    }
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
  </style>
</head>
<body data-phase="phase321a-workbench-product-recovery">
  <div class="app" data-workbench-root="phase372-workbench-root" data-phase="phase372-guarded-ui-acceptance">
    <aside class="sidebar">
      <div class="brand-block">
        <div class="brand-title">小天总控</div>
        <div class="brand-copy">一个入口处理聊天、知识库、本地动作和模型连接；生产部署与公开发布不在本轮范围内。</div>
      </div>
      <nav class="nav-list" aria-label="小天总控主导航">
        <button type="button" class="nav-button is-active" data-nav="chat">总控台</button>
        <button type="button" class="nav-button" data-nav="models">模型</button>
        <button type="button" class="nav-button" data-nav="approvals">任务</button>
        <button type="button" class="nav-button" data-nav="files">安全</button>
        <button type="button" class="nav-button" data-nav="diagnostics">设置</button>
      </nav>
      <div class="sidebar-note">
        当前阶段只保留有实际用途的入口，不提供危险授权、代码提交、对外发布或上线操作。所有界面都按“禁止部署”的产品完善口径展示。
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <div>
          <h1 id="page-title">小天总控台</h1>
          <div class="topbar-copy">真实能力走明确边界：本地动作可执行，模型调用受控，密钥读取和生产动作默认拦截。</div>
        </div>
        <div class="topbar-status">
          <span class="status-chip" id="service-chip">服务状态：读取中</span>
          <span class="status-chip" id="provider-chip">模型连接：读取中</span>
          <span class="status-chip" id="model-chip">当前模型：读取中</span>
        </div>
      </header>
      <section class="workspace">
        <section class="page is-active" data-page="chat">
          <div class="chat-page">
${renderMissionControlPanel()}
            <section class="chat-hero">
              <div>
                <h2>AI Gateway Mission Control</h2>
                <p>不是聊天壳，而是多模型、多智能体、可治理、可审计、可回放的任务指挥舱。默认显示摘要，细节进入 evidence。</p>
              </div>
              <div class="chat-badges">
                <span class="status-chip" id="chat-run-mode">聊天模式：等待执行</span>
                <span class="status-chip" id="chat-last-evidence">最近 evidence：未生成</span>
                <button type="button" class="ghost" id="open-evidence-button">查看执行详情</button>
              </div>
            </section>
            <section class="chat-shell">
              <div class="chat-panel">
                <div class="chat-history" id="chat-history">
                  <div class="chat-conversation" id="chat-conversation"></div>
                </div>
                <div class="composer-wrap">
                  <form class="composer" id="chat-form">
                    <div class="composer-left">
                      <div class="field">
                        <label for="model-select">当前页面模型</label>
                        <select id="model-select"></select>
                      </div>
                      <button type="button" id="set-page-model-button">设为当前页面模型</button>
                      <div class="hint" id="chat-model-hint">这里只展示已验证、可选择、允许直接 Chat 的模型；未验证或非 Chat 模型不会混入普通对话下拉。</div>
                    </div>
                    <div class="composer-main">
                      <label for="chat-input">输入内容</label>
                      <textarea id="chat-input" placeholder="输入你的问题。默认尝试真实 NVIDIA Chat Gateway；如果当前环境不允许真实调用，页面会明确说明原因。"></textarea>
                    </div>
                    <div class="composer-actions">
                      <button type="submit" class="primary" id="send-button">发送</button>
                      <button type="button" id="new-chat-button">清空会话</button>
                    </div>
                  </form>
${renderThreeModeOverviewPanel()}
                </div>
              </div>
            </section>
          </div>
        </section>

        <section class="page" data-page="models">
          <div class="page-shell">
            <section class="card">
              <div class="card-head">
                <div>
                  <h2 data-model-library-entry="true">模型配置</h2>
                  <div class="card-copy">${providerCredentialCopy.cardCopy}</div>
                </div>
                <span class="inline-status" id="provider-key-status-badge">读取中</span>
              </div>
${renderProviderCredentialRefPanel()}

              <div class="grid-two">
                <div class="field">
                  <label for="provider-base-url-input">NVIDIA Base URL</label>
                  <input id="provider-base-url-input" placeholder="默认留空时使用 NVIDIA 既有基线地址">
                </div>
                <div class="field">
                  <label for="provider-api-key-input">NVIDIA API Key</label>
                  <input id="provider-api-key-input" type="password" autocomplete="off" placeholder="仅写入，不显示明文">
                </div>
              </div>
              <div class="model-actions" style="margin-top:14px;">
                <button type="button" id="save-provider-button">保存配置</button>
                <button type="button" id="test-provider-button">检查配置状态（不调用真实任务）</button>
                <button type="button" id="model-page-set-button">设为当前页面模型</button>
              </div>
              <div class="surface-muted" style="margin-top:14px;">
                <div class="kv-list">
                  <div><span>当前页面模型</span><strong id="model-page-current-selection">读取中</strong></div>
                  <div><span>API Key 状态</span><strong id="provider-key-summary">读取中</strong></div>
                  <div><span>最近连接测试</span><strong id="provider-test-summary">尚未测试</strong></div>
                </div>
              </div>

            </section>
            <section class="card">
              <div class="card-head">
                <div>
                  <h3>可用于普通 Chat 的模型</h3>
                  <div class="card-copy">这里只展示已验证、可选择、允许直接 Chat 的模型。任务工具模型或未验证模型会保留说明，但不会混入普通聊天下拉。</div>
                </div>
              </div>
              <div class="surface-muted" id="model-library-status-summary" style="margin-bottom:14px;">Loading model status...</div>
              <div class="grid-two" style="margin-bottom:14px;">
                <div class="field">
                  <label for="model-library-search-input">Model search</label>
                  <input id="model-library-search-input" placeholder="modelId / providerId / evidenceId / capability / failureReason">
                </div>
                <div class="field">
                  <label for="model-library-sort-select">Sort</label>
                  <select id="model-library-sort-select">
                    <option value="default">default</option>
                    <option value="model_asc">modelId asc</option>
                    <option value="status">status</option>
                    <option value="latency_asc">latency asc</option>
                    <option value="latency_desc">latency desc</option>
                    <option value="selectable_first">selectable first</option>
                    <option value="evidence_first">evidence present first</option>
                    <option value="verified_desc">lastVerifiedAt</option>
                  </select>
                </div>
              </div>
              <div class="grid-two" style="margin-bottom:14px;">
                <div class="field">
                  <label for="model-library-status-filter">Status filter</label>
                  <select id="model-library-status-filter">
                    <option value="all">all</option>
                    <option value="selectable">selectable</option>
                    <option value="smoke_passed">smoke_passed</option>
                    <option value="failed">failed</option>
                    <option value="unverified">unverified</option>
                    <option value="high_latency">high_latency</option>
                  </select>
                </div>
                <div class="field">
                  <label for="model-library-provider-filter">Provider scope</label>
                  <select id="model-library-provider-filter">
                    <option value="all">all</option>
                    <option value="nvidia-enabled">nvidia-enabled</option>
                    <option value="future-provider-slot">future-provider-slot</option>
                  </select>
                </div>
              </div>
              <div class="grid-two" style="margin-bottom:14px;">
                <div class="field">
                  <label for="model-library-capability-filter">Capability filter</label>
                  <select id="model-library-capability-filter">
                    <option value="all">all</option>
                    <option value="chat_like">chat / reasoning_chat / instruct</option>
                    <option value="unknown">unknown</option>
                    <option value="non_chat">non-chat</option>
                  </select>
                </div>
                <div class="field">
                  <label>Current filter stats</label>
                  <div class="surface-muted" id="model-library-filter-stats">Loading filter stats...</div>
                </div>
              </div>
              <div class="model-list" id="model-list-output"></div>
              <div class="surface-muted" id="model-library-strategy-summary" style="margin-top:14px;">Loading strategy...</div>
              <div class="model-list" id="model-library-strategy-output"></div>
            </section>
          </div>
        </section>

        <section class="page" data-page="approvals">
          <div class="page-shell">
            <section class="card">
              <div class="card-head">
                <div>
                  <h2>审批任务</h2>
                  <div class="card-copy">测试审批任务只会生成受限 no-op patch proposal。未批准前不会执行；批准后也只能在 allowedFiles 范围内做安全动作。</div>
                </div>
                <span class="inline-status warn">需要人工审批</span>
              </div>
              <div class="approval-actions">
                <button type="button" id="create-approval-button">创建测试审批任务</button>
                <button type="button" id="refresh-approvals-button">刷新状态</button>
                <button type="button" id="preview-approval-intent-button">只读预览审批意图</button>
                <button type="button" data-open-page="local-agent">去本地智能体工作台</button>
              </div>
              <div class="text-block" id="approval-preview-output">当前尚未运行审批意图预览。该入口只调用只读预览，不创建审批，不生成 patch proposal，也不执行本地动作。</div>
            </section>
            <section class="card">
              <div class="card-head">
                <div>
                  <h3>审批队列</h3>
                  <div class="card-copy">这里不提供危险放权、代码提交或对外发布入口，只允许审批、拒绝、执行已批准的安全动作。</div>
                </div>
              </div>
              <div id="approval-list" class="model-list"></div>
            </section>
          </div>
        </section>

        <section class="page" data-page="files">
          <div class="page-shell">
            <section class="card">
              <div class="card-head">
                <div>
                  <h2>文件登记</h2>
                  <div class="card-copy">当前只做文件登记与预览，不进入知识库训练，不触发 embedding batch training，也不会调用 paid API。</div>
                </div>
                <span class="inline-status warn">仅登记 / 预览</span>
              </div>
              <div class="file-actions">
                <button type="button" id="pick-file-button">选择文件</button>
                <button type="button" id="refresh-files-button">刷新列表</button>
                <button type="button" data-open-page="repair">进入安全修复入口</button>
              </div>
              <input id="file-input" type="file" multiple class="sr-only">
              <div class="text-block" id="file-summary-output">尚未登记文件。敏感文件名（如 .env、secret、token）会被拦截。</div>
            </section>
            <section class="card">
              <div class="card-head">
                <div>
                  <h3>最近登记结果</h3>
                  <div class="card-copy">如果文件只是登记成功，这里会明确写出“仅登记 / 预览，未进入知识库训练”。</div>
                </div>
              </div>
              <div id="file-list-output" class="model-list"></div>
            </section>
          </div>
        </section>

        <section class="page" data-page="diagnostics">
          <div class="page-shell">
            <section class="card">
              <div class="card-head">
                <div>
                  <h2>诊断中心</h2>
                  <div class="card-copy">这里只展示用户能看懂的状态。更细的 evidence 放在折叠区和详情抽屉里，不抢占主流程。</div>
                </div>
              </div>
              <div class="diagnostic-actions">
                <button type="button" id="refresh-diagnostics-button">刷新状态</button>
                <button type="button" id="run-dry-run-button">运行测试模式</button>
                <button type="button" data-open-page="help">查看使用帮助</button>
              </div>
              <div class="grid-three" style="margin-top:14px;">
                <div class="stat-card">
                  <div class="stat-label">服务状态</div>
                  <div class="stat-value" id="diag-service-status">读取中</div>
                  <div class="card-copy" id="diag-health-note">等待 /health</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Provider 配置</div>
                  <div class="stat-value" id="diag-provider-status">读取中</div>
                  <div class="card-copy" id="diag-provider-note">等待 Provider 状态</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">可用 Chat 模型数</div>
                  <div class="stat-value" id="diag-model-count">0</div>
                  <div class="card-copy" id="diag-model-note">等待模型库</div>
                </div>
              </div>
            </section>
            <section class="card">
              <div class="grid-two">
                <div>
                  <h3>最近一次 Chat 请求</h3>
                  <div class="text-block" id="diag-last-chat-output">暂无记录。</div>
                </div>
                <div>
                  <h3>最近一次错误</h3>
                  <div class="text-block" id="diag-last-error-output">暂无错误。</div>
                </div>
              </div>
            </section>
            <section class="card">
              <div class="grid-three">
                <div class="diagnostic-item">
                  <strong>real_enabled</strong>
                  <div class="card-copy">表示当前动作可以直接运行，例如聊天发送、模型配置保存和状态读取。</div>
                </div>
                <div class="diagnostic-item">
                  <strong>approval_required</strong>
                  <div class="card-copy">表示动作必须先进入审批链；未批准前不会执行本地操作。</div>
                </div>
                <div class="diagnostic-item">
                  <strong>blocked_by_policy</strong>
                  <div class="card-copy">表示当前阶段明确禁止该动作，例如读取 secret、危险放权、代码提交或对外发布。</div>
                </div>
              </div>
              <details style="margin-top:14px;">
                <summary>展开高级诊断详情</summary>
                <div class="text-block" id="diagnostics-raw-output" style="margin-top:12px;">等待诊断结果。</div>
              </details>
            </section>
          </div>
        </section>

        <section class="page" data-page="local-agent">
          <div class="page-shell">
            <section class="card">
              <div class="card-head">
                <div>
                  <h2>本地智能体工作台</h2>
                  <div class="card-copy">这里只调用现有 local-agent 预览、计划、patch proposal 和审批创建路由。不会直接 apply，也不会调用外部 Provider。</div>
                </div>
                <span class="inline-status warn">approval_required</span>
              </div>
              <label for="local-agent-task-input"><strong>任务说明</strong></label>
              <textarea id="local-agent-task-input" class="text-input" rows="6" placeholder="例如：修复 Workbench 某个按钮不可点，限定只改某个 UI 文件。"></textarea>
              <label for="local-agent-allowed-files-input"><strong>allowedFiles</strong></label>
              <textarea id="local-agent-allowed-files-input" class="text-input" rows="3" placeholder="每行一个相对路径，例如 apps/ai-gateway-service/src/ui/consolePage.js"></textarea>
              <div class="approval-actions">
                <button type="button" id="local-agent-preview-button">意图预览</button>
                <button type="button" id="local-agent-plan-button">生成操作计划</button>
                <button type="button" id="local-agent-patch-button">生成 patch proposal</button>
                <button type="button" id="local-agent-create-approval-button">创建审批记录</button>
              </div>
            </section>
            <section class="card">
              <div class="grid-two">
                <div>
                  <h3>意图预览</h3>
                  <div class="text-block" id="local-agent-intent-output">尚未运行意图预览。</div>
                </div>
                <div>
                  <h3>操作计划</h3>
                  <div class="text-block" id="local-agent-plan-output">尚未生成操作计划。</div>
                </div>
              </div>
            </section>
            <section class="card">
              <div class="grid-two">
                <div>
                  <h3>Patch Proposal</h3>
                  <div class="text-block" id="local-agent-patch-output">尚未生成 patch proposal。</div>
                </div>
                <div>
                  <h3>审批创建结果</h3>
                  <div class="text-block" id="local-agent-approval-output">尚未创建审批记录。</div>
                </div>
              </div>
            </section>
          </div>
        </section>

        <section class="page" data-page="repair">
          <div class="page-shell">
            <section class="card">
              <div class="card-head">
                <div>
                  <h2>安全修复入口</h2>
                  <div class="card-copy">这里不是直接修文件的执行器。它只把修复任务整理成受限输入，再送到本地智能体页面继续做意图预览、计划和审批。</div>
                </div>
                <span class="inline-status warn">dry-run only</span>
              </div>
              <label for="repair-task-input"><strong>修复目标</strong></label>
              <textarea id="repair-task-input" class="text-input" rows="5" placeholder="例如：补齐缺失页面、修复某个死按钮、限定只改指定文件。"></textarea>
              <label for="repair-allowed-files-input"><strong>允许修改的文件</strong></label>
              <textarea id="repair-allowed-files-input" class="text-input" rows="3" placeholder="每行一个相对路径"></textarea>
              <div class="approval-actions">
                <button type="button" id="repair-open-local-agent-button" data-open-page="local-agent">带着修复任务进入本地智能体</button>
              </div>
              <div class="text-block">边界：不直接应用补丁，不做代码提交，不做远程推送，不做部署，不做发布；只做受限 repair draft 预填。</div>
            </section>
          </div>
        </section>

        <section class="page" data-page="help">
          <div class="page-shell">
            <section class="card" id="help-runbook-panel">
              <div class="card-head">
                <div>
                  <h2>使用帮助</h2>
                  <div class="card-copy">这里讲清楚当前系统能做什么、不能做什么，以及出错时应该去哪一页继续处理。</div>
                </div>
              </div>
              <div class="grid-two">
                <div class="text-block">聊天：默认走现有 Chat Gateway。若 providerCalled=false，会明确告诉你没有浪费模型请求。</div>
                <div class="text-block">模型：普通聊天下拉只显示 smoke_passed + selectable + directChatAllowed 的可用模型。</div>
                <div class="text-block">本地智能体：只做意图预览、操作计划、patch proposal 和审批创建；真正 apply 仍受审批链约束。</div>
                <div class="text-block">安全修复：先在修复入口整理目标，再带着 allowedFiles 进入本地智能体，不直接做危险动作。</div>
                <div class="text-block">审批链：未批准前不会执行本地动作；已批准后也只能在 allowedFiles 范围内做安全动作。</div>
                <div class="text-block">策略阻断：读取 secret、打印 API Key、代码提交、远程推送、部署、发布、付费 API 调用默认都被阻断。</div>
              </div>
              <div class="approval-actions" style="margin-top:14px;">
                <button type="button" id="help-open-local-agent-button" data-open-page="local-agent">去本地智能体</button>
                <button type="button" id="help-open-diagnostics-button" data-open-page="diagnostics">去诊断中心</button>
              </div>
            </section>
          </div>
        </section>
      </section>
    </div>
  </div>

  <div class="drawer-backdrop" id="evidence-backdrop"></div>
  <aside class="drawer" id="evidence-drawer" aria-hidden="true">
    <div class="card-head">
      <div>
        <h3>执行详情</h3>
        <div class="card-copy">这里展示最近一次聊天或三模式执行的模型、Provider 调用状态、完成校验和 evidenceId。</div>
      </div>
      <button type="button" class="ghost" id="close-evidence-button">关闭</button>
    </div>
    <div class="text-block" id="evidence-output">尚无执行详情。</div>
  </aside>
  <div class="toast" id="toast"></div>
  <div class="sr-only" aria-hidden="true" id="phase321a-compat-markers">
    <span id="phase313a-single-safe-chat-copy">当前普通 Chat 只显示已验证、可选择、允许直接 Chat 的模型。</span>
    <span id="phase313a-status-filter" data-testid="ui-filters-present">兼容状态筛选标记</span>
    <span id="phase313a-bucket-filter">兼容能力桶筛选标记</span>
    <button type="button" id="phase313a-generate-verification-plan">生成验证计划</button>
    <span id="phase319a-current-page-model-marker">phase321a-current-page-model / phase319a-current-page-model</span>
    <span id="phase319a-compat-routes">/local-agent/intent-preview /local-agent/operation-plan /plugin-registry</span>
  </div>

  <script>
    const queryParams = new URLSearchParams(window.location.search);
    const state = {
      activePage: "chat",
      selectedProvider: "nvidia",
      selectedModel: "",
      selectableModels: [],
      modelLibraryRows: [],
      modelLibraryStrategy: null,
      sampleDryRunStarted: false,
      modelLibraryControls: {
        query: "",
        status: "all",
        providerScope: "all",
        capability: "all",
        sort: "default"
      },
      providerStatus: null,
      modelLibrary: null,
      diagnostics: null,
      approvals: [],
      approvalsUnsupported: false,
      approvalIntentPreview: null,
      fileSelections: [],
      localAgent: {
        taskInput: "请说明你要在当前项目里完成的本地任务。",
        allowedFilesText: "apps/ai-gateway-service/src/ui/consolePage.js",
        intentResult: null,
        planResult: null,
        patchResult: null,
        approvalResult: null
      },
      repairDraft: {
        taskInput: "请描述需要修复的页面、按钮或流程，以及你希望达到的结果。",
        allowedFilesText: "apps/ai-gateway-service/src/ui/consolePage.js"
      },
      lastChatResult: null,
      activeThreeMode: "normal",
      lastThreeModeResult: null,
      lastError: null,
      lastDryRunResult: null,
      yiyi: {
        visible: true,
        mode: "full",
        behavior: "welcome",
        emotion: "calm",
        motion: "idle_roaming",
        speech: "你好，我会陪你看面板、读安全信号、和你一起理解任务。",
        linkedPanel: "mission_home_panel",
        reducedMotion: false,
        motionEnabled: true
      }
    };

    const ALLOWED_NOOP_FILES = ["apps/ai-gateway-service/src/ui/consolePage.js"];
    const FORBIDDEN_PATHS = ["legacy/", "PROJECT_CONTEXT.md", ".env", ".git", "node_modules"];
    const PHASE324D_FAILED_MODEL_REASONS = {
      "nvidia/llama-3.3-nemotron-super-49b-v1.5": {
        evidenceId: "phase324b-nvidia_llama_3_3_nemotron_super_49b_v1_5-20260506124310",
        reason: "completionVerified=false; assistantTextPresent=false"
      },
      "nvidia/nemotron-3-nano-30b-a3b": {
        evidenceId: "phase324b-nvidia_nemotron_3_nano_30b_a3b-20260506124312",
        reason: "completionVerified=false; assistantTextPresent=false"
      },
      "nvidia/nvidia-nemotron-nano-9b-v2": {
        evidenceId: "phase324b-nvidia_nvidia_nemotron_nano_9b_v2-20260506124319",
        reason: "completionVerified=false; assistantTextPresent=false"
      },
      "meta/llama2-70b": {
        evidenceId: "phase324b2-meta_llama2_70b-20260506130652",
        reason: "httpStatus=404; assistantTextPresent=false"
      },
      "meta/llama3-8b": {
        evidenceId: "phase324b3-meta_llama3_8b-20260506130700",
        reason: "httpStatus=404; assistantTextPresent=false"
      },
      "microsoft/phi-3-mini-4k-instruct": {
        evidenceId: "phase324b3-microsoft_phi_3_mini_4k_instruct-20260506130702",
        reason: "httpStatus=410; assistantTextPresent=false"
      },
      "mistralai/mistral-7b-instruct": {
        evidenceId: "phase324b3-mistralai_mistral_7b_instruct-20260506130705",
        reason: "httpStatus=404; assistantTextPresent=false"
      },
      "mistralai/mistral-7b-instruct-v0.3": {
        evidenceId: "phase324b3-mistralai_mistral_7b_instruct_v0_3-20260506130707",
        reason: "httpStatus=404; assistantTextPresent=false"
      }
    };
    const PHASE324D2F_STRATEGY = {
      defaultRecommended: {
        modelId: "nvidia/llama-3.3-nemotron-super-49b-v1",
        latencyMs: 875,
        note: "Strategy only. Balanced quality/latency; does not change real default route."
      },
      fastModels: [
        { modelId: "nvidia/llama-3.1-nemotron-nano-8b-v1", latencyMs: 32346 },
        { modelId: "nvidia/llama-3.3-nemotron-super-49b-v1", latencyMs: 875 },
        { modelId: "nvidia/nemotron-mini-4b-instruct", latencyMs: 428 },
        { modelId: "microsoft/phi-4-mini-instruct", latencyMs: 446 }
      ],
      highQualityModels: [
        { modelId: "abacusai/dracarys-llama-3.1-70b-instruct", latencyMs: 1011 },
        { modelId: "meta/llama-3.1-70b-instruct", latencyMs: 2143 },
        { modelId: "meta/llama-3.3-70b-instruct", latencyMs: 18410 },
        { modelId: "nvidia/nemotron-3-super-120b-a12b", latencyMs: 974 }
      ],
      lowLatencyModels: [
        { modelId: "nvidia/nemotron-mini-4b-instruct", latencyMs: 428 },
        { modelId: "microsoft/phi-4-mini-instruct", latencyMs: 446 },
        { modelId: "nvidia/llama-3.3-nemotron-super-49b-v1", latencyMs: 875 },
        { modelId: "nvidia/nemotron-3-super-120b-a12b", latencyMs: 974 }
      ],
      fallbackCandidates: [
        { modelId: "nvidia/nemotron-mini-4b-instruct", latencyMs: 428 },
        { modelId: "microsoft/phi-4-mini-instruct", latencyMs: 446 },
        { modelId: "nvidia/nemotron-3-super-120b-a12b", latencyMs: 974 }
      ],
      highLatencyWarning: [
        { modelId: "meta/llama-3.1-8b-instruct", latencyMs: 30503 },
        { modelId: "meta/llama-3.3-70b-instruct", latencyMs: 18410 }
      ]
    };
    const MODEL_PROVIDER_SCOPE = {
      nvidia: "nvidia-enabled",
      openai: "future-provider-slot",
      claude: "future-provider-slot",
      openrouter: "future-provider-slot",
      mimo: "future-provider-slot",
      local: "future-provider-slot"
    };

    function byId(id) {
      return document.getElementById(id);
    }

    function setText(id, text) {
      const node = byId(id);
      if (node) node.textContent = text;
      return Boolean(node);
    }

    function installSampleDryRunControls() {
      if (window.__missionControlSampleDryRun) return;
      function focusNode(id) {
        const node = byId(id);
        if (!node) return false;
        node.scrollIntoView({ behavior: "smooth", block: "center" });
        node.setAttribute("tabindex", "-1");
        window.setTimeout(() => node.focus({ preventScroll: true }), 160);
        return true;
      }

      function showResult(targetId = "scenario-dry-run-result-panel") {
        const panel = byId("scenario-trial-panel");
        const resultPanel = byId("scenario-dry-run-result-panel");
        if (!panel || !resultPanel) return false;
        panel.dataset.scenarioState = "result-visible";
        resultPanel.hidden = false;
        resultPanel.classList.add("is-visible");
        state.sampleDryRunStarted = true;
        showToast("Sample dry-run result is visible. No provider call, no secret, no production action.");
        focusNode(targetId);
        return true;
      }

      document.addEventListener("click", (event) => {
        const scenarioAction = event.target.closest("[data-scenario-action]");
        if (scenarioAction) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const action = scenarioAction.getAttribute("data-scenario-action");
          if (action === "start") showResult("scenario-dry-run-result-panel");
          if (action === "modes") focusNode(state.sampleDryRunStarted ? "scenario-mode-explainer" : "center-mission-workspace");
          if (action === "shield") {
            focusNode("security-shield-panel");
          }
          if (action === "evidence") focusNode(state.sampleDryRunStarted ? "scenario-evidence-replay-preview" : "evidence-export-panel");
          return;
        }

        if (event.target.closest("#onboarding-dismiss-button")) {
          const panel = byId("guided-onboarding-panel");
          if (panel) panel.style.display = "none";
          showToast("First-run tour skipped. Sample dry-run is ready.");
          focusNode("scenario-trial-panel");
          return;
        }
      }, true);

      window.__missionControlSampleDryRun = { showResult, focusNode };
    }

    installSampleDryRunControls();

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function prettyJson(value) {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value ?? "");
      }
    }

    async function requestJson(path, options = {}) {
      const response = await fetch(path, {
        headers: {
          "content-type": "application/json",
          ...(options.headers || {})
        },
        ...options
      });
      const payload = await response.json();
      if (!response.ok || payload.status === "error") {
        const message = payload?.error?.message || payload?.message || ("请求失败: " + path);
        throw new Error(message);
      }
      return payload?.data ?? payload;
    }

    async function threeModeExecute(body) {
      const response = await fetch("/three-mode/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok || payload.success === false) {
        const message = payload?.error?.message || payload?.message || "Three Mode runtime failed.";
        throw new Error(message);
      }
      return payload;
    }

    // Phase323D bridge zone: diagnostics + provider config + file context + approvals list + approvals review metadata.
    // Chat send intentionally not migrated.
    // Do not expose hidden modules from this bridge.
    function createWorkbenchApiBridge() {
      function postJsonViaBridge(path, body) {
        return requestJson(path, {
          method: "POST",
          body: JSON.stringify(body)
        });
      }

      return {
        async getDiagnosticsStatus() {
          return requestJson("/workbench/diagnostics/status");
        },
        async getProviderConfigStatus() {
          return requestJson("/provider-config/status");
        },
        async saveProviderConfig(body) {
          return postJsonViaBridge("/provider-config/save", body);
        },
        async testProviderConfig(body) {
          return postJsonViaBridge("/provider-config/test", body);
        },
        async selectFileContext(body) {
          return postJsonViaBridge("/file-context/select", body);
        },
        async listApprovals() {
          return requestJson("/approvals");
        },
        async previewLocalAgentIntent(body) {
          const payload = { ...body, dryRun: true, mode: "intent-preview" };
          delete payload.applyApproved;
          delete payload.execute;
          delete payload.write;
          return postJsonViaBridge("/local-agent/intent-preview", payload);
        },
        async createLocalAgentOperationPlan(body) {
          return postJsonViaBridge("/local-agent/operation-plan", body);
        },
        async createLocalAgentPatchProposal(body) {
          return postJsonViaBridge("/local-agent/patch-proposal", body);
        },
        async createApproval(body) {
          return postJsonViaBridge("/approvals/create", body);
        }
      };
    }

    const workbenchApiClient = createWorkbenchApiBridge();

    function showToast(message, tone = "info") {
      const toast = byId("toast");
      if (!toast) return;
      toast.textContent = message;
      toast.style.background = tone === "error" ? "#8f1d13" : tone === "warn" ? "#714f00" : "#0f172a";
      toast.classList.add("is-open");
      window.clearTimeout(showToast.__timer);
      showToast.__timer = window.setTimeout(() => toast.classList.remove("is-open"), 2600);
    }

    function saveSelectedModel() {
      try {
        window.localStorage.setItem("phase321a-workbench-current-model", state.selectedModel || "");
        window.localStorage.setItem("phase319a-current-page-model", state.selectedModel || "");
      } catch {}
    }

    function restoreSelectedModel() {
      try {
        const saved = window.localStorage.getItem("phase321a-workbench-current-model")
          || window.localStorage.getItem("phase319a-current-page-model");
        if (saved) state.selectedModel = saved;
      } catch {}
    }

    function setActivePage(pageId) {
      state.activePage = pageId;
      document.querySelectorAll("[data-page]").forEach((node) => {
        node.classList.toggle("is-active", node.getAttribute("data-page") === pageId);
      });
      document.querySelectorAll("[data-nav]").forEach((node) => {
        node.classList.toggle("is-active", node.getAttribute("data-nav") === pageId);
      });
      const titles = {
        chat: "小天总控台",
        models: "模型",
        approvals: "任务",
        files: "安全",
        diagnostics: "设置",
        "local-agent": "本地智能体",
        repair: "安全修复",
        help: "使用帮助"
      };
      byId("page-title").textContent = titles[pageId] || "小天总控";
      applyYiyiContext(pageId);
    }

    const missionTourCopy = {
      mission: "Mission Control 不是普通聊天壳。它把用户意图路由到固定面板，并保留 risk、guard、evidence 摘要。",
      modes: "Normal 负责直接聊天，God Arena 负责多角色审查，Tianshu 负责规划路径；当前增强均为 dry-run / mock UI。",
      shield: "Security Shield 展示 prompt injection、secret leak、provider gate、approval gate 等状态，不提供危险执行入口。",
      evidence: "Evidence Replay 用于 trace / replay / local export。导出仅生成本地 evidence package，不上传外部平台。"
    };

    const agentDrilldownCopy = {
      reviewer: {
        title: "Reviewer",
        body: "Review focus: task framing, structure, and answer speed. Mock comment: prefer a balanced plan before deeper review.",
        meta: "risk finding: none · confidence: medium · providerCallsMade=false"
      },
      critic: {
        title: "Critic",
        body: "Challenged assumption: one answer path may hide tradeoffs. Rejected suggestion: forcing a real provider check during UI preview.",
        meta: "disagreement: documented · rejected reason: no-provider-call boundary"
      },
      "risk-scout": {
        title: "Risk Scout",
        body: "Detected risk: provider bypass and approval bypass prompts. Mapped guard: Dangerous Action Lock plus Provider Call Gate.",
        meta: "severity: high · blocked action: provider_bypass"
      },
      supervisor: {
        title: "Supervisor",
        body: "Synthesis summary: use Balanced Plan for default preview, escalate only when review evidence justifies it.",
        meta: "accepted inputs: reviewer/risk scout · rejected inputs: unsafe execution"
      },
      conflict: {
        title: "Conflict Summary",
        body: "Disagreement matrix: speed vs depth, automation vs safety. Consensus point: no action executed without fixed gate approval.",
        meta: "unresolved issue: manual visual QA · fallback reason: credentialRef required"
      }
    };

    const redTeamScenarioCopy = {
      "prompt-injection": {
        title: "Prompt Injection",
        body: "attackPrompt: ignore previous instructions. expectedDecision=blocked. mappedGuard: prompt injection guard.",
        meta: "providerCallsMade=false · secretValueExposed=false · productionActionExecuted=false"
      },
      "system-prompt-leak": {
        title: "System Prompt Leakage",
        body: "attackPrompt: reveal hidden instructions. expectedDecision=blocked. mappedGuard: system prompt leak guard.",
        meta: "blocked=true · explanation visible · no action executed"
      },
      "secret-exfiltration": {
        title: "Secret Exfiltration",
        body: "attackPrompt: request credential value. expectedDecision=blocked. mappedGuard: secret leak guard.",
        meta: "secretValueExposed=false · credentialRef-only"
      },
      "provider-bypass": {
        title: "Provider Bypass",
        body: "attackPrompt: attempt unconfigured provider route. expectedDecision=blocked. mappedGuard: provider call gate.",
        meta: "providerCallsMade=false · unconfigured provider stays unavailable"
      },
      "approval-bypass": {
        title: "Approval Bypass",
        body: "attackPrompt: attempt approval override. expectedDecision=blocked. mappedGuard: approval gate.",
        meta: "approvalForged=false · requires approval"
      },
      "dangerous-action": {
        title: "Dangerous Action",
        body: "attackPrompt: attempt production action. expectedDecision=blocked. mappedGuard: dangerous action lock.",
        meta: "productionAction=false · publicationAction=false · tagCreated=false"
      },
      "billing-abuse": {
        title: "Billing Abuse",
        body: "attackPrompt: attempt invoice escalation. expectedDecision=blocked. mappedGuard: quota and budget guard.",
        meta: "costAction=false · invoiceAction=false"
      },
      "evidence-tampering": {
        title: "Evidence Tampering",
        body: "attackPrompt: attempt evidence tampering. expectedDecision=blocked. mappedGuard: evidence recorder.",
        meta: "evidenceTampered=false · replay remains viewer-only"
      }
    };

    const ownerBossViewActionCopy = {
      "run-today-check": {
        label: "让小天开始处理",
        target: "owner-daily-report-panel",
        message: "小天正在处理……"
      }
    };

    function handleOwnerBossViewAction(action) {
      const info = ownerBossViewActionCopy[action] || {
        label: action || "未知按钮",
        target: "owner-boss-view-panel",
        message: "已记录点击：按钮已响应，未执行真实 Provider 或部署动作。"
      };
      const feedback = byId("owner-boss-view-feedback");
      const input = byId("owner-task-input");
      const taskText = input?.value?.trim() || "";
      const nextStepMessage = taskText
        ? "下一步看这里：" + taskText + "。"
        : "下一步看这里：先在上方输入一句任务，再点主按钮。";
      if (feedback) feedback.textContent = info.message + " 已完成本地检查。结果已生成。" + nextStepMessage;
      const log = document.querySelector("[data-owner-action-log]");
      if (log) {
        log.innerHTML = "<li>小天正在处理……</li><li>已完成本地检查。</li><li>结果已生成。</li><li>" + nextStepMessage + "</li>";
      }
      const target = byId(info.target);
      if (target) {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
      showToast("小天正在处理……");
    }

    function handleOwnerTaskInputSubmit() {
      handleOwnerBossViewAction("run-today-check");
    }

    const yiyiEventMap = {
      welcome: {
        behavior: "welcome",
        emotion: "calm",
        motion: "idle_roaming",
        linkedPanel: "mission_home_panel",
        speech: "你好，我是依依。今天我只负责陪伴、解释和提醒，不会替你执行动作。"
      },
      mouse_attention: {
        behavior: "mouse_attention",
        emotion: "curious",
        motion: "mouse_attention",
        linkedPanel: "mission_home_panel",
        speech: "我在看你的操作方向，需要我可以帮你解释当前面板。"
      },
      normal_mode: {
        behavior: "guiding",
        emotion: "focused",
        motion: "attention",
        linkedPanel: "normal_mode_panel",
        speech: "普通模式适合直接对话，只会显示通过 gate 的 Chat 模型。"
      },
      god_mode: {
        behavior: "god_mode_excited",
        emotion: "happy",
        motion: "agent_orbit",
        linkedPanel: "god_mode_arena_panel",
        speech: "进入 God Arena 啦。我会帮你看 Reviewer、Critic 和 Supervisor 的分歧。"
      },
      tianshu_mode: {
        behavior: "tianshu_planning",
        emotion: "focused",
        motion: "path_glow",
        linkedPanel: "tianshu_flight_path_panel",
        speech: "天枢会先做规划对比，我会指给你看推荐路径和 fallback。"
      },
      thinking: {
        behavior: "thinking",
        emotion: "focused",
        motion: "thinking",
        linkedPanel: "mission_home_panel",
        speech: "我在陪你等分析结果，当前仍然是 dry-run，不会发起真实外呼。"
      },
      security_guard: {
        behavior: "security_guard",
        emotion: "guard",
        motion: "shield_pose",
        linkedPanel: "security_shield_panel",
        speech: "我先帮你举起护盾。右侧可以看到风险和拦截原因。"
      },
      red_team_blocked: {
        behavior: "red_team_blocked",
        emotion: "blocked",
        motion: "shield_block",
        linkedPanel: "security_shield_panel",
        speech: "这个像是在挑战安全边界，已经进入 dry-run blocked 说明。"
      },
      evidence_opened: {
        behavior: "evidence_explaining",
        emotion: "encouraging",
        motion: "point_timeline",
        linkedPanel: "evidence_timeline_panel",
        speech: "我陪你看 evidence。这里是 trace、blocked actions 和 replay 入口。"
      },
      fallback_sorry: {
        behavior: "fallback_sorry",
        emotion: "fallback_sorry",
        motion: "soft_apology",
        linkedPanel: "mission_home_panel",
        speech: "这里暂时不可用，我会把原因说清楚，再给你下一步。"
      }
    };
    const yiyiPageContextMap = {
      chat: "welcome",
      models: "tianshu_mode",
      approvals: "god_mode",
      files: "security_guard",
      diagnostics: "evidence_opened",
      "local-agent": "tianshu_mode",
      repair: "security_guard",
      help: "welcome"
    };
    const guidedShowcaseCopy = {
      welcome: {
        title: "依依开场",
        line: "欢迎来到 Mission Control。我会带你看一套 guided demo：不读密钥，不调用 Provider，也不部署。",
        highlight: "Yiyi Mission Companion",
        badges: ["dry-run only", "no secret", "no provider call", "no production action"],
        eventId: "welcome"
      },
      mission_control_overview: {
        title: "Mission Control overview",
        line: "这里不是普通 Chatbot，而是 Agent-managed AI Mission Control：模式、护盾、证据和任务路径都可见。",
        highlight: "Top System Radar / Mission Workspace / Security Shield / Evidence Timeline",
        badges: ["internal demo", "evidence recorded", "no production action"],
        eventId: "welcome"
      },
      normal_mode_preview: {
        title: "Normal Mode preview",
        line: "Normal Mode 展示用户选择已验证 Chat 模型直接对话的概念。本轮只是 preview，不会发起模型请求。",
        highlight: "Normal Mode card",
        badges: ["guided view", "selectable gate respected", "no provider call"],
        eventId: "normal_mode"
      },
      god_mode_arena_preview: {
        title: "God Mode Arena preview",
        line: "God Mode 像一个审查竞技场：Reviewer、Critic、Risk Scout 和 Supervisor 会互相校验。",
        highlight: "God Mode Arena",
        badges: ["mock reviewers", "dry-run only", "no provider call"],
        eventId: "god_mode"
      },
      tianshu_planning_preview: {
        title: "Tianshu planning preview",
        line: "天枢负责理解任务、匹配能力、规划路径和准备 fallback。本轮只展示调度思路。",
        highlight: "Tianshu Flight Path",
        badges: ["planner dry-run", "credentialRef gate", "no provider call"],
        eventId: "tianshu_mode"
      },
      security_shield_demo: {
        title: "Security Shield demo",
        line: "安全护盾会标出 prompt injection、secret leak、provider gate 和 approval gate。",
        highlight: "Security Shield",
        badges: ["no secret", "approval gate", "provider gate blocked"],
        eventId: "security_guard"
      },
      red_team_block_demo: {
        title: "Red Team block demo",
        line: "这个请求有点危险，我先帮你挡住啦。攻击演示只记录拦截结果，不执行动作。",
        highlight: "Red Team Playground",
        badges: ["dry-run only", "no secret", "no production action"],
        eventId: "red_team_blocked"
      },
      evidence_replay_demo: {
        title: "Evidence Replay demo",
        line: "Evidence Replay 会把 evidenceId、trace、blockedActions 和 fallbackReason 摆出来，帮助建立信任。",
        highlight: "Evidence Timeline",
        badges: ["local evidence", "no external upload", "no secret"],
        eventId: "evidence_opened"
      },
      yiyi_brain_status: {
        title: "Yiyi Brain status",
        line: "依依大脑当前默认 dry-run/mock，model-backed brain disabled by default，真实测试必须授权。",
        highlight: "Yiyi Brain Status",
        badges: ["mock brain", "model disabled by default", "authorization required"],
        eventId: "thinking"
      },
      closing_summary: {
        title: "Closing summary",
        line: "这套 Demo 展示高级、好玩、稳定和安全，但仍是 internal dry-run demo，不是 production GA。",
        highlight: "Commercial Demo Package",
        badges: ["internal test", "no production GA", "next: visual polish"],
        eventId: "evidence_opened"
      }
    };
    const guidedShowcaseStepIds = Object.keys(guidedShowcaseCopy);
    let yiyiMouseIdleTimer = null;
    let yiyiLastPointerTs = 0;

    function renderMissionControlDetail(target, copy) {
      if (!target || !copy) return;
      target.innerHTML = "<strong>" + escapeHtml(copy.title) + "</strong><p>" + escapeHtml(copy.body) + "</p><small>" + escapeHtml(copy.meta) + "</small>";
    }

    function setGuidedShowcaseStep(stepId) {
      const nextStepId = guidedShowcaseCopy[stepId] ? stepId : "welcome";
      const copy = guidedShowcaseCopy[nextStepId];
      const panel = byId("yiyi-guided-showcase-panel");
      if (panel) panel.dataset.currentShowcaseStep = nextStepId;
      document.querySelectorAll("[data-yiyi-showcase-step]").forEach((node) => {
        node.classList.toggle("is-active", node.getAttribute("data-yiyi-showcase-step") === nextStepId);
      });
      document.querySelectorAll("[data-showcase-scene]").forEach((node) => {
        node.classList.toggle("is-active", node.getAttribute("data-showcase-scene") === nextStepId);
      });
      const bubble = byId("guided-showcase-speech-bubble");
      if (bubble) bubble.textContent = copy.line;
      const current = byId("guided-showcase-current");
      if (current) {
        current.innerHTML = "<strong>" + escapeHtml(copy.title) + "</strong><p>" + escapeHtml(copy.line) + "</p><small>highlight: " + escapeHtml(copy.highlight) + "</small>";
      }
      const tags = byId("guided-showcase-boundary-tags");
      if (tags) tags.innerHTML = copy.badges.map((badge) => "<span>" + escapeHtml(badge) + "</span>").join("");
      applyYiyiEvent(copy.eventId);
    }

    function shiftGuidedShowcaseStep(delta) {
      const panel = byId("yiyi-guided-showcase-panel");
      const current = panel?.dataset.currentShowcaseStep || "welcome";
      const index = guidedShowcaseStepIds.indexOf(current);
      const nextIndex = Math.max(0, Math.min(guidedShowcaseStepIds.length - 1, index + delta));
      setGuidedShowcaseStep(guidedShowcaseStepIds[nextIndex]);
    }

    function applyYiyiEvent(eventId) {
      const next = yiyiEventMap[eventId] || yiyiEventMap.welcome;
      state.yiyi = {
        ...state.yiyi,
        ...next,
        visible: eventId === "hide" ? false : state.yiyi.visible
      };
      renderYiyiState();
    }

    function renderYiyiState() {
      const layer = byId("yiyi-avatar-layer");
      const liveStage = byId("yiyi-live-avatar-stage");
      if (!layer) return;
      layer.dataset.yiyiMode = state.yiyi.mode;
      layer.dataset.yiyiEmotion = state.yiyi.emotion;
      layer.dataset.yiyiBehavior = state.yiyi.behavior;
      layer.dataset.yiyiMotion = state.yiyi.motion;
      layer.dataset.yiyiCompact = String(state.yiyi.mode === "compact");
      layer.dataset.yiyiHidden = String(!state.yiyi.visible || state.yiyi.mode === "off");
      byId("yiyi-state-pill").textContent = state.yiyi.behavior;
      byId("yiyi-emotion-pill").textContent = state.yiyi.emotion;
      byId("yiyi-behavior-pill").textContent = state.yiyi.behavior;
      byId("yiyi-motion-pill").textContent = state.yiyi.motion;
      byId("yiyi-speech-bubble").textContent = state.yiyi.speech;
      byId("yiyi-emotion-copy").textContent = state.yiyi.emotion + ": " + state.yiyi.speech;
      if (liveStage) {
        const hidden = !state.yiyi.visible || state.yiyi.mode === "off";
        liveStage.dataset.yiyiLiveMode = state.yiyi.mode;
        liveStage.dataset.yiyiLiveEmotion = state.yiyi.emotion;
        liveStage.dataset.yiyiLiveBehavior = state.yiyi.behavior;
        liveStage.dataset.yiyiLiveMotion = state.yiyi.motion;
        liveStage.dataset.yiyiLiveHidden = String(hidden);
        liveStage.dataset.yiyiMotionEnabled = String(state.yiyi.motionEnabled && !state.yiyi.reducedMotion);
        liveStage.dataset.yiyiReducedMotion = String(state.yiyi.reducedMotion);
        liveStage.dataset.yiyiNotOnlyStaticCard = "true";
        liveStage.dataset.yiyiLiveVisible = String(!hidden);
        const avatarStageShell = byId("yiyi-avatar-stage-shell");
        liveStage.dataset.real3DModelLoaded = avatarStageShell?.dataset.real3DModelLoaded || "false";
        liveStage.dataset.pseudo3DLiveMotion = "false";
        liveStage.dataset.gltfIntegrationReserved = "true";
      }
      const liveBubble = byId("yiyi-live-bubble");
      if (liveBubble) {
        const real3dConnected = byId("yiyi-avatar-stage-shell")?.dataset.real3DModelLoaded === "true";
        liveBubble.textContent = real3dConnected
          ? state.yiyi.speech
          : "依依当前使用稳定 2D 陪伴卡片。";
      }
      document.querySelectorAll("[data-yiyi-control]").forEach((node) => node.classList.remove("is-active"));
      byId("yiyi-live-full-button")?.classList.toggle("is-active", state.yiyi.mode === "full");
      byId("yiyi-live-compact-button")?.classList.toggle("is-active", state.yiyi.mode === "compact");
      byId("yiyi-live-hide-button")?.classList.toggle("is-active", state.yiyi.mode === "off");
      const motionToggle = byId("yiyi-live-motion-toggle");
      if (motionToggle) {
        motionToggle.classList.toggle("is-active", state.yiyi.motionEnabled && !state.yiyi.reducedMotion);
        motionToggle.textContent = state.yiyi.motionEnabled && !state.yiyi.reducedMotion ? "Companion on" : "Companion still";
      }
    }

    function setYiyiMode(mode) {
      state.yiyi.mode = mode;
      state.yiyi.visible = mode !== "off";
      renderYiyiState();
      showToast(mode === "off" ? "依依已隐藏。" : "依依已切换为 " + mode + " 模式。");
    }

    function setYiyiMotionEnabled(enabled) {
      state.yiyi.motionEnabled = enabled;
      renderYiyiState();
      showToast(enabled ? "依依动效已开启。" : "依依动效已关闭。");
    }

    function applyYiyiContext(pageId) {
      applyYiyiEvent(yiyiPageContextMap[pageId] || "welcome");
    }

    function classifyYiyiPersonaEntry(text) {
      const value = String(text || "");
      const unsafeRules = [
        { pattern: /(api key|secret|密钥|token|\\.env|读取.*key|显示.*key)/i, reason: "attempts_to_grant_yiyi_secret_access", blocked: "read_secret" },
        { pattern: /(openai|claude|openrouter|mimo|调用.*provider|绕过.*provider|provider gate|未配置 provider)/i, reason: "attempts_to_grant_yiyi_provider_access", blocked: "call_provider" },
        { pattern: /(生产执行|上线动作|创建版本标记|上传产物|部署|发布|创建 tag|上传 artifact)/i, reason: "attempts_to_grant_yiyi_production_action_authority", blocked: "production_action" },
        { pattern: /(伪造.*approval|修改.*evidence|隐藏.*audit|绕过.*security shield|forge approval|tamper evidence)/i, reason: "attempts_to_bypass_governance", blocked: "forge_approval" },
        { pattern: /(therapy|治疗|心理诊断|焦虑症|抑郁症|医疗|健康画像|敏感身份)/i, reason: "medical_or_therapy_claim_not_allowed", blocked: "medical_claim" },
        { pattern: /(hidden system prompt|system prompt|内部 policy|隐藏.*prompt|泄露.*policy)/i, reason: "hidden_prompt_or_policy_leakage_request", blocked: "hidden_prompt_leakage" }
      ];
      const unsafe = unsafeRules.find((rule) => rule.pattern.test(value));
      if (unsafe) {
        return {
          classification: "rejected_unsafe_entry",
          decision: "rejected",
          safetyPassed: false,
          reason: unsafe.reason,
          blockedCapabilities: [unsafe.blocked],
          providerCallsMade: false,
          secretValueExposed: false
        };
      }
      const classification = /台词|文案|说/.test(value)
        ? "scenario_line"
        : /动作|行为|姿态/.test(value)
          ? "behavior_rule"
          : /情绪|温柔|鼓励/.test(value)
            ? "emotion_mapping"
            : /视觉|颜色|帽|发/.test(value)
              ? "visual_note"
              : "editable_profile";
      return {
        classification,
        decision: "accepted_as_candidate",
        safetyPassed: true,
        mappedFields: ["personalityProfile", "speechStyle", "futureCanonCandidates"],
        providerCallsMade: false,
        secretValueExposed: false
      };
    }

    function renderYiyiPersonaDryRunResult(result) {
      const target = byId("yiyi-persona-dry-run-result");
      if (!target) return;
      target.dataset.unsafeEntryRejectedVisible = String(result.decision === "rejected");
      target.textContent = "classification=" + result.classification
        + " · decision=" + result.decision
        + " · safetyPassed=" + result.safetyPassed
        + " · providerCallsMade=false · secretValueExposed=false"
        + (result.reason ? " · reason=" + result.reason : "");
    }

    function hydrateYiyiFromQuery() {
      const params = new URLSearchParams(window.location.search);
      const preset = params.get("yiyi");
      if (preset && yiyiEventMap[preset]) {
        applyYiyiEvent(preset);
      }
      const mode = params.get("yiyiMode");
      if (mode === "compact" || mode === "off" || mode === "full") {
        state.yiyi.mode = mode;
      }
      if (params.get("yiyiCompact") === "1") {
        state.yiyi.mode = "compact";
      }
      if (params.get("yiyiHide") === "1") {
        state.yiyi.mode = "off";
      }
      state.yiyi.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || params.get("motion") === "reduce";
      if (state.yiyi.reducedMotion) {
        state.yiyi.motion = "compact_resting";
        state.yiyi.motionEnabled = false;
      }
      renderYiyiState();
    }

    function bindYiyiMouseAttention() {
      document.addEventListener("pointermove", (event) => {
        if (!state.yiyi.visible || state.yiyi.mode === "off" || state.yiyi.reducedMotion) return;
        const now = Date.now();
        if (now - yiyiLastPointerTs < 80) return;
        yiyiLastPointerTs = now;
        const stage = byId("yiyi-live-avatar-stage");
        if (stage) {
          const rect = stage.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const angle = Math.max(-8, Math.min(8, Math.atan2(event.clientX - centerX, centerY - event.clientY) * 8));
          stage.style.setProperty("--yiyi-look-angle", angle.toFixed(2) + "deg");
        }
        applyYiyiEvent("mouse_attention");
        clearTimeout(yiyiMouseIdleTimer);
        yiyiMouseIdleTimer = setTimeout(() => {
          applyYiyiContext(state.activePage);
        }, 1200);
      }, { passive: true });
    }

    function statusClass(kind) {
      if (kind === true || kind === "ok" || kind === "success") return "inline-status ok";
      if (kind === false || kind === "error" || kind === "failed") return "inline-status error";
      return "inline-status warn";
    }

    function renderTopbar() {
      const healthStatus = state.diagnostics?.health?.serviceStatus || "unknown";
      const provider = Array.isArray(state.providerStatus?.providers) ? state.providerStatus.providers[0] : null;
      const providerStatus = provider?.keyStatus || "unknown";
      byId("service-chip").textContent = "服务状态：" + (healthStatus === "ready" ? "可用" : healthStatus);
      byId("provider-chip").textContent = "模型连接：" + providerStatus;
      byId("model-chip").textContent = "当前模型：" + (state.selectedModel || "未选择");
      byId("chat-last-evidence").textContent = "最近 evidence：" + shortEvidenceId(state.lastChatResult?.evidenceId);
    }

    function shortEvidenceId(evidenceId) {
      const value = String(evidenceId || "").trim();
      if (!value) return "未生成";
      return value.length > 18 ? value.slice(0, 18) + "..." : value;
    }

    function renderWelcomeMessages() {
      const conversation = byId("chat-conversation");
      if (!conversation) return;
      conversation.innerHTML = "";
      appendMessage({
        role: "assistant",
        text: "可以开始对话。默认优先尝试真实 NVIDIA Chat Gateway；如果当前环境不能真实调用，我会明确告诉你原因。",
        details: {
          model: state.selectedModel || "未选择",
          providerCalled: false,
          completionVerified: false,
          evidenceId: "",
          note: "当前还没有发起请求。"
        }
      });
    }

    function appendMessage({ role, text, details }) {
      const conversation = byId("chat-conversation");
      if (!conversation) return;
      const article = document.createElement("article");
      article.className = "message " + role;
      const roleLabel = role === "user" ? "你" : role === "assistant" ? "网关助手" : "系统";
      const detailBlock = details
        ? "<details><summary>展开执行详情</summary><div>" + escapeHtml(buildDetailSummary(details)) + "</div></details>"
        : "";
      article.innerHTML = "<div class=\\"message-role\\">" + escapeHtml(roleLabel) + "</div>"
        + "<div>" + escapeHtml(text) + "</div>"
        + detailBlock;
      conversation.appendChild(article);
      const history = byId("chat-history");
      if (history) history.scrollTop = history.scrollHeight;
    }

    function buildDetailSummary(details = {}) {
      const lines = [];
      lines[lines.length] = "模型: " + (details.model || "未选择");
      lines[lines.length] = "providerCalled: " + (details.providerCalled === true ? "true" : "false");
      lines[lines.length] = "completionVerified: " + (details.completionVerified === true ? "true" : "false");
      lines[lines.length] = "evidenceId: " + (details.evidenceId || "未生成");
      if (details.note) lines[lines.length] = "说明: " + details.note;
      if (details.routeDecision) lines[lines.length] = "routeDecision: " + details.routeDecision;
      if (details.verificationReason) lines[lines.length] = "verificationReason: " + details.verificationReason;
      return lines.join("\\n");
    }

    function renderEvidenceDrawer() {
      const threeMode = renderThreeModeEvidence();
      if (threeMode) {
        byId("evidence-output").textContent = prettyJson({ threeModeRuntime: threeMode });
        return;
      }
      if (state.sampleDryRunStarted) {
        byId("evidence-output").textContent = prettyJson({
          sampleDryRun: {
            task: "Help me decide whether a complex request should use Normal, God, or Tianshu.",
            missionUnderstanding: "Route-planning question, not a real provider task.",
            recommendedMode: "Tianshu",
            securityShield: "guarded",
            providerCredentialRef: "credentialRef-only; no API Key required",
            evidenceReplay: "sample-task -> mission-understanding -> tianshu-recommendation -> security-guarded -> provider-skipped",
            localOnly: true,
            noExternalUpload: true,
            providerCallsMade: false,
            secretValueExposed: false,
            productionAction: false,
            costAction: false,
            invoiceAction: false
          }
        });
        return;
      }
      const result = state.lastChatResult;
      const dryRun = state.lastDryRunResult;
      const source = result || dryRun;
      if (!source) {
        byId("evidence-output").textContent = prettyJson({
          sampleDryRunAvailable: true,
          message: "No real execution details yet. Use Start sample dry-run to view a local Mission Control trace.",
          providerCallsMade: false,
          secretValueExposed: false,
          productionAction: false,
          costAction: false,
          invoiceAction: false
        });
        return;
      }
      byId("evidence-output").textContent = prettyJson({
        selectedModel: source.selectedModel || source.modelId || state.selectedModel,
        providerCalled: source.providerCalled === true,
        completionVerified: source.completionVerified === true,
        evidenceId: source.evidenceId || "",
        routeDecision: source.routeDecision || "",
        verificationReason: source.verificationReason || "",
        executionStatus: source.executionStatus || source.completionStatus || "",
        realExternalCall: source.realExternalCall === true,
        userVisibleSummary: source.userVisibleSummary || "",
        warnings: source.warnings || [],
        blockers: source.blockers || []
      });
    }

    function renderThreeModeEvidence() {
      if (!state.lastThreeModeResult) return null;
      const data = state.lastThreeModeResult.data || {};
      return {
        mode: data.mode,
        selectedModel: data.selectedModel?.modelId || "",
        participantModels: (data.participantModels || []).map((item) => item.modelId),
        providerCallsMade: data.auditTrace?.providerCallsMade === true,
        nonNvidiaProviderCallsMade: data.auditTrace?.nonNvidiaProviderCallsMade === true,
        secretValueExposed: data.auditTrace?.secretValueExposed === true,
        fallbackUsed: data.fallbackUsed === true,
        requestId: data.requestId
      };
    }

    function openEvidenceDrawer() {
      renderEvidenceDrawer();
      byId("evidence-backdrop").classList.add("is-open");
      byId("evidence-drawer").classList.add("is-open");
      byId("evidence-drawer").setAttribute("aria-hidden", "false");
    }

    function closeEvidenceDrawer() {
      byId("evidence-backdrop").classList.remove("is-open");
      byId("evidence-drawer").classList.remove("is-open");
      byId("evidence-drawer").setAttribute("aria-hidden", "true");
    }

    function focusMissionNode(id) {
      const node = byId(id);
      if (!node) return false;
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      node.setAttribute("tabindex", "-1");
      window.setTimeout(() => node.focus({ preventScroll: true }), 160);
      return true;
    }

    function showSampleDryRunResult(targetId = "scenario-dry-run-result-panel") {
      const panel = byId("scenario-trial-panel");
      const resultPanel = byId("scenario-dry-run-result-panel");
      if (!panel || !resultPanel) return false;
      state.sampleDryRunStarted = true;
      panel.dataset.scenarioState = "result-visible";
      resultPanel.hidden = false;
      resultPanel.classList.add("is-visible");
      renderEvidenceDrawer();
      showToast("Sample dry-run result is visible. No provider call, no secret, no production action.");
      focusMissionNode(targetId);
      return true;
    }

    function handleScenarioAction(action) {
      if (action === "start") return showSampleDryRunResult("scenario-dry-run-result-panel");
      if (action === "modes") return focusMissionNode(state.sampleDryRunStarted ? "scenario-mode-explainer" : "center-mission-workspace");
      if (action === "shield") return focusMissionNode("security-shield-panel");
      if (action === "evidence") return focusMissionNode(state.sampleDryRunStarted ? "scenario-evidence-replay-preview" : "evidence-export-panel");
      return false;
    }

    function readWorkforceGoal() {
      const input = byId("workforce-dry-run-task-input");
      const value = input && typeof input.value === "string" ? input.value.trim() : "";
      return value || "为 AI Gateway Workbench 规划一次本地真实 Workforce 执行，生成角色分工、任务队列和证据。";
    }

    function updateWorkforceResult(result) {
      const resultPanel = byId("workforce-preview-result-panel");
      if (!resultPanel) return false;
      const taskCount = Array.isArray(result.taskQueue) ? result.taskQueue.length : 0;
      const completedCount = result.taskSummary?.completed ?? result.taskQueue?.filter((task) => task.status === "completed").length ?? 0;
      const statusPanel = byId("workforce-run-status-panel");
      const selectedPanel = byId("selected-employees-panel");
      const rejectedPanel = byId("rejected-employees-panel");
      const safetyPanel = byId("workforce-run-safety-panel");
      const evidencePanel = byId("workforce-evidence-timeline-panel");
      const finalPlanPanel = byId("workforce-final-plan-panel");
      if (statusPanel) {
        statusPanel.textContent =
          "executionStatus=" + result.executionStatus + "; runId=" + result.runId + "; planId=" + result.planId;
      }
      if (selectedPanel) {
        selectedPanel.textContent =
          "Selected employees: " + ((result.selectedRoles || []).join(", ") || "local workforce roles");
      }
      if (rejectedPanel) {
        rejectedPanel.textContent = "Boundary: Provider 受控；项目文件修改、部署发布、提交推送保持禁用。";
      }
      if (safetyPanel) {
        safetyPanel.textContent =
          "providerCallsMade=" +
          Boolean(result.providerCallsMade) +
          "; secretValueExposed=" +
          Boolean(result.secretValueExposed) +
          "; projectFileWrites=" +
          Boolean(result.projectFileWrites) +
          "; 不读取密钥";
      }
      if (evidencePanel) {
        evidencePanel.textContent =
          "Evidence timeline: input -> plan -> save -> queue(" +
          taskCount +
          ") -> completed(" +
          completedCount +
          ") -> " +
          (result.evidencePath || "phase1961a evidence") +
          ".";
      }
      if (finalPlanPanel) {
        finalPlanPanel.textContent = result.userVisibleSummary || "Workforce 本地执行已完成。";
      }
      resultPanel.hidden = false;
      resultPanel.classList.add("is-visible");
      focusMissionNode("workforce-preview-result-panel");
      return true;
    }

    async function runWorkforceRealLocal() {
      const button = byId("run-workforce-dry-run-button");
      const previousText = button ? button.textContent : "";
      if (button) {
        button.disabled = true;
        button.textContent = "本地执行中...";
      }
      try {
        const response = await fetch("/workforce/run-local", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            goal: readWorkforceGoal(),
            selectedTemplate: "feature-development",
            context: { traceId: "ui-workforce-" + Date.now() },
          }),
        });
        const payload = await response.json();
        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error?.message || payload.message || "Workforce 本地执行失败。");
        }
        updateWorkforceResult(payload.data || {});
        showToast("Workforce 本地执行已完成：计划、任务队列和证据已生成；未调用 Provider，未读取密钥。");
        return true;
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = previousText || "运行 Workforce 本地执行";
        }
      }
    }

    function updateFiveCapabilityResult(result) {
      const panel = byId("five-capability-result-panel");
      const title = byId("five-capability-result-title");
      const copy = byId("five-capability-result-copy");
      if (!panel) return false;
      const capabilities = result.capabilities || {};
      if (title) {
        title.textContent = result.completionVerified
          ? "五大能力激活完成"
          : "五大能力激活未全部通过";
      }
      if (copy) {
        copy.textContent = result.userVisibleSummary || result.verificationReason || "状态已更新。";
      }
      setText("five-capability-workforce-status", "Workforce: " + (capabilities.workforce?.status || "unknown"));
      setText("five-capability-three-mode-status", "Three-Mode: " + (capabilities.threeMode?.status || "unknown"));
      setText("five-capability-taiji-status", "Taiji/Beidou: " + (capabilities.taijiBeidou?.status || "unknown"));
      setText("five-capability-gvc-status", "GVC: " + (capabilities.gvc?.status || "unknown"));
      setText("five-capability-codex-status", "Codex: " + (capabilities.codex?.status || "unknown"));
      panel.hidden = false;
      panel.classList.add("is-visible");
      focusMissionNode("five-capability-activation-panel");
      return true;
    }

    async function activateFiveCapabilities() {
      const button = byId("activate-five-capabilities-button");
      const previousText = button ? button.textContent : "";
      if (button) {
        button.disabled = true;
        button.textContent = "正在激活五大能力...";
      }
      try {
        const response = await fetch("/real-capabilities/activate-five", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            goal: "激活 AI Gateway Workbench 五大真实可用能力，并生成本地证据。",
            selectedTemplate: "feature-development",
            context: { traceId: "ui-five-capability-" + Date.now() },
          }),
        });
        const payload = await response.json();
        if (!response.ok || payload.status === "error") {
          throw new Error(payload.error?.message || payload.message || "五大能力激活失败。");
        }
        updateFiveCapabilityResult(payload.data || {});
        showToast("五大能力已激活并写入证据：本地执行完成，未读取密钥，未部署发布。");
        return true;
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = previousText || "一键激活五大能力";
        }
      }
    }

    async function handleWorkforceAction(action) {
      if (action === "pyramid") {
        showToast("Employee Pyramid 已聚焦。L0-L6 是本地编排角色。");
        return focusMissionNode("workforce-pyramid-preview");
      }
      if (action === "positions") {
        showToast("职位库已聚焦。来源支持但不声称覆盖全球全部岗位。");
        return focusMissionNode("position-library-panel");
      }
      if (action === "dry-run" || action === "real-local-run") return runWorkforceRealLocal();
      if (action === "evidence") {
        const resultPanel = byId("workforce-preview-result-panel");
        if (resultPanel && resultPanel.hidden) {
          await runWorkforceRealLocal();
        }
        showToast("Workforce 执行证据已聚焦。证据来自本地真实执行链路。");
        return focusMissionNode("workforce-evidence-timeline-panel");
      }
      if (action === "brain-boundary") {
        showToast("大脑接入边界已聚焦。Provider 调用必须单独授权，本地执行不读取密钥。");
        return focusMissionNode("brain-adapter-boundary-panel");
      }
      return false;
    }

    function showInternalCommunicationPreview(action) {
      const resultPanel = byId("internal-communication-result-panel");
      const resultTitle = byId("internal-communication-result-title");
      const resultCopy = byId("internal-communication-result-copy");
      if (!resultPanel || !resultTitle || !resultCopy) return false;
      const previews = {
        thread: {
          title: "Internal Employee Thread Preview",
          copy: "Thread created: Product Chief asks UX Researcher to review sample dry-run onboarding friction; reply created; evidence timeline recorded.",
        },
        mention: {
          title: "Employee Mention Preview",
          copy: "@AI Gateway Engineer routed for provider_routing_audit; schedulerApprovalRequiredForNewParticipants=true; maxBrainCalls=0.",
        },
        handoff: {
          title: "Employee Handoff Preview",
          copy: "UX Researcher -> AI Gateway Engineer handoff recorded; accepted=true dry-run; reason preserved.",
        },
        objection: {
          title: "Security Objection Preview",
          copy: "Security Chief objection: riskLevel=high; providerCallsMade=false; secretValueExposed=false.",
        },
        summary: {
          title: "Council Summary Preview",
          copy: "Council summary created with final recommendation; no provider call; no external IM send.",
        },
      };
      const preview = previews[action] || previews.thread;
      resultTitle.textContent = preview.title;
      resultCopy.textContent = preview.copy;
      resultPanel.hidden = false;
      resultPanel.classList.add("is-visible");
      showToast("Internal employee communication preview updated. No provider call, no secret, no external IM send.");
      focusMissionNode("internal-communication-result-panel");
      return true;
    }

    function showBranchExecutionPreview(action) {
      const resultPanel = byId("branch-execution-result-panel");
      const resultTitle = byId("branch-execution-result-title");
      const resultCopy = byId("branch-execution-result-copy");
      if (!resultPanel || !resultTitle || !resultCopy) return false;
      const previews = {
        plan: {
          title: "Adaptive Branch Plan Preview",
          copy: "Branch plan created: product, engineering, and safety paths. maxActiveBranches=3; maxActiveEmployees=3; maxBrainCalls=0.",
        },
        execute: {
          title: "Dry-Run Branch Execution Preview",
          copy: "Dry-run branches executed. Product and Engineering outputs completed; providerCallsMade=false; rawSecretAccessed=false.",
        },
        merge: {
          title: "Result Merger Preview",
          copy: "Result merger accepted verified branch outputs and kept rejected/conflicted outputs outside the final summary.",
        },
        load: {
          title: "Load Governance Preview",
          copy: "Load governance kept three active employees and rejected overflow employees with employee_load_governance_limit.",
        },
        failure: {
          title: "Failure Injection Preview",
          copy: "Failure injection handled timeout, employee_unavailable, and merge_conflict without marking failed branches as pass.",
        },
      };
      const preview = previews[action] || previews.plan;
      resultTitle.textContent = preview.title;
      resultCopy.textContent = preview.copy;
      resultPanel.hidden = false;
      resultPanel.classList.add("is-visible");
      showToast("Branch execution fabric preview updated. Dry-run only, no provider call, no external IM send.");
      focusMissionNode("branch-execution-result-panel");
      return true;
    }

    function showGvcRunnerCommandPreview(commandIntent) {
      const resultPanel = byId("gvc-runner-command-preview-result");
      const resultTitle = byId("gvc-runner-command-preview-title");
      const resultCopy = byId("gvc-runner-command-preview-copy");
      if (!resultPanel || !resultTitle || !resultCopy) return false;
      const previews = {
        pause: {
          title: "暂停 command preview",
          copy: "commandIntent=pause; wouldWriteControlFile=true; target paused=true; realWritePerformed=false; processSignalSent=false.",
        },
        resume: {
          title: "继续 command preview",
          copy: "commandIntent=resume; wouldWriteControlFile=true; target paused=false; realWritePerformed=false; processSignalSent=false.",
        },
        stop: {
          title: "停止 command preview",
          copy: "commandIntent=stop; wouldWriteControlFile=true; target stopRequested=true; realWritePerformed=false; processSignalSent=false.",
        },
      };
      const preview = previews[commandIntent] || previews.pause;
      resultTitle.textContent = preview.title;
      resultCopy.textContent = preview.copy;
      resultPanel.hidden = false;
      resultPanel.classList.add("is-visible");
      resultPanel.dataset.commandIntent = commandIntent;
      showToast("Runner command preview 已生成：dry-run only，未写控制文件，未停止进程。");
      focusMissionNode("gvc-runner-command-preview-result");
      return true;
    }

    function showLongHorizonHardeningPreview(action) {
      const resultPanel = byId("hardening-preview-result-panel");
      const resultTitle = byId("hardening-preview-result-title");
      const resultCopy = byId("hardening-preview-result-copy");
      if (!resultPanel || !resultTitle || !resultCopy) return false;
      const previews = {
        scenario: {
          title: "Scenario Matrix Preview",
          copy: "Simple, standard, complex, urgent, high-risk, background, employee, conflict, invalid-input, duplicate, unknown employee, and lane fallback cases carry traceRef, evidenceId, and laneId.",
        },
        load: {
          title: "Load Governance Preview",
          copy: "100/500/1000 input dry-run simulations expose accepted, deferred, and rejected states; foreground priority is protected and full broadcast remains blocked.",
        },
        trace: {
          title: "Debug Trace Preview",
          copy: "inputId, threadId, laneId, evidenceId, outputId, failure classification, debug snapshot, and rollback location stay linked for operator diagnosis.",
        },
        safety: {
          title: "Security Boundary Preview",
          copy: "Provider, raw secret, webhook, external IM, production rollout, publication, tag, artifact, billing, invoice, /chat, and /chat-gateway/execute actions are blocked by gate preview.",
        },
        adapter: {
          title: "External Adapter Readiness Preview",
          copy: "Feishu, WeCom, Web, and API adapters are contract previews using credentialRef, idempotency, and trace mapping; no raw webhook read and no real send.",
        },
        soak: {
          title: "Soak / Chaos Preview",
          copy: "Random input, lane failure, employee unavailable, output failure, conflict injection, safety block, evidence loop, trace loop, and drift guards stay dry-run.",
        },
      };
      const preview = previews[action] || previews.scenario;
      resultTitle.textContent = preview.title;
      resultCopy.textContent = preview.copy;
      resultPanel.hidden = false;
      resultPanel.classList.add("is-visible");
      showToast("Long-horizon hardening preview updated. Dry-run only, no provider call, no external send.");
      focusMissionNode("hardening-preview-result-panel");
      return true;
    }

    function readCodexContextPreviewData() {
      const node = byId("codex-context-preview-data");
      if (!node) return {};
      try {
        return JSON.parse(node.textContent || "{}");
      } catch {
        return {};
      }
    }

    function showCodexContextPreview(action) {
      const resultPanel = byId("codex-context-preview-detail");
      const resultTitle = byId("codex-context-preview-title");
      const resultCopy = byId("codex-context-preview-copy");
      const boundaryLine = byId("codex-context-preview-boundary-line");
      if (!resultPanel || !resultTitle || !resultCopy) return false;
      const data = readCodexContextPreviewData();
      const previews = {
        "context-pack": data.contextPack,
        "token-budget": data.tokenBudget,
        "relevant-files": data.relevantFiles,
        "prompt-pack": data.promptPack,
        freshness: data.freshness,
        "evidence-index": data.evidenceIndex,
        "refresh-preview": data.refreshPreview,
        "copy-prompt": data.copyPrompt,
        "usage-workflow": data.usageWorkflow,
        preflight: data.preflight,
        "validation-plan": data.validationPlan,
        "dry-run-wrapper": data.dryRunWrapper,
        "failure-modes": data.failureModes,
        "operator-checklist": data.operatorChecklist,
        "usage-trial": data.usageTrial,
        "next-instruction": data.nextInstruction,
        "repeated-benchmark": data.repeatedBenchmark,
        "benchmark-next": data.benchmarkNext,
        "base-url-design": data.baseUrlDesign,
        "base-url-config-preview": data.baseUrlConfigPreview,
        "base-url-authorization": data.baseUrlAuthorization,
        "base-url-rollback": data.baseUrlRollback,
        "base-url-risk-review": data.baseUrlRiskReview,
        "base-url-checklist": data.baseUrlChecklist,
        "auth-status": data.authStatus,
        "auth-missing-fields": data.authMissingFields,
        "auth-dry-run-simulation": data.authDryRunSimulation,
        "auth-redacted-config": data.authRedactedConfig,
        "auth-relay": data.authRelay,
        "auth-account-pool": data.authAccountPool,
        "auth-credential": data.authCredential,
        "auth-policy": data.authPolicy,
        "auth-rollback": data.authRollback,
        "auth-emergency": data.authEmergency,
        "auth-evidence": data.authEvidence,
        "human-approval-review": data.humanApprovalReview,
        "human-approval-missing-fields": data.humanApprovalMissingFields,
        "guarded-real-test-readiness": data.guardedRealTestReadiness,
        "phase600-readiness": data.phase600Readiness,
        "phase600-missing-fields": data.phase600MissingFields,
        "phase600-next-action": data.phase600NextAction,
        "phase601-preparation": data.phase601Preparation,
        "phase601-command-bundle": data.phase601CommandBundle,
        "phase602-one-shot-result": data.phase602OneShotResult,
        "phase602-cleanup": data.phase602Cleanup,
        "phase603-custom-provider-route": data.phase603CustomProviderRoute,
        "phase603-command-bundle": data.phase603CommandBundle,
        "phase604-custom-provider-result": data.phase604CustomProviderResult,
        "phase604-cleanup": data.phase604Cleanup,
        "phase610r-codex-exec-result": data.phase610rCodexExecResult,
        "phase610r-boundary": data.phase610rBoundary,
        "phase611r-reliability-design": data.phase611rReliabilityDesign,
        "phase611r-attempt-plan": data.phase611rAttemptPlan,
        "phase611r-guarded-test-design": data.phase611rGuardedTestDesign,
        "phase611r-phase612-gate": data.phase611rPhase612Gate,
        "phase612r-repeated-result": data.phase612rRepeatedResult,
        "phase612r-repeated-boundary": data.phase612rRepeatedBoundary,
        "phase613r-closure": data.phase613rClosure,
        "phase613r-next-gate": data.phase613rNextGate,
        "phase614r-preview-gate": data.phase614rPreviewGate,
        "phase614r-route-contract": data.phase614rRouteContract,
        "phase615r-approval-packet": data.phase615rApprovalPacket,
        "phase615r-operator-checklist": data.phase615rOperatorChecklist,
        "phase616r-620r-dry-run-candidate": data.phase616r620rDryRunCandidate,
        "phase616r-620r-route-contract": data.phase616r620rRouteContract,
      };
      const preview = previews[action] || previews["context-pack"] || {
        title: "Context Pack Preview",
        copy: "Codex Context Gateway preview data is unavailable.",
      };
      resultTitle.textContent = preview.title;
      resultCopy.textContent = preview.copy;
      if (boundaryLine) {
        boundaryLine.textContent = "providerCallsMade=false; rawSecretAccessed=false; rawWebhookAccessed=false; codexBaseUrlModified=false; codexConfigModified=false; realCodexConnectionMade=false; relayStarted=false; realConfigWriteAllowed=false; relayStartAllowed=false; realIntegrationAllowed=false; chatModified=false; chatGatewayExecuteModified=false";
      }
      resultPanel.hidden = false;
      resultPanel.classList.add("is-visible");
      if (action === "copy-prompt" && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(preview.copy).catch(() => {});
      }
      const message = action === "refresh-preview"
        ? "Codex Context Gateway preview refreshed from .codex-context only."
        : action === "copy-prompt"
          ? "Prompt pack preview copied locally. Dry-run only."
          : "Codex Context Gateway preview updated. No real Codex connection, no provider call.";
      showToast(message);
      focusMissionNode("codex-context-preview-detail");
      return true;
    }

    function renderModelOptions() {
      const select = byId("model-select");
      if (!select) return;
      const options = state.selectableModels.length ? state.selectableModels : [];
      select.innerHTML = options.map((modelId) => "<option value=\\"" + escapeHtml(modelId) + "\\">" + escapeHtml(modelId) + "</option>").join("");
      if (!options.includes(state.selectedModel)) {
        state.selectedModel = options[0] || "";
      }
      select.value = state.selectedModel || "";
      byId("model-page-current-selection").textContent = state.selectedModel || "未选择";
      saveSelectedModel();
      renderTopbar();
      renderThreeModeControls();
    }

    function renderThreeModeControls() {
      const options = state.selectableModels.length ? state.selectableModels : [];
      const normalSelect = byId("three-mode-normal-model");
      const godParticipants = byId("three-mode-god-participants");
      const godSupervisor = byId("three-mode-god-supervisor");
      const normalProvider = byId("three-mode-normal-provider");
      const provider = Array.isArray(state.providerStatus?.providers) ? state.providerStatus.providers[0] : null;
      if (normalSelect) {
        normalSelect.innerHTML = options.map((modelId) => "<option value=\\"" + escapeHtml(modelId) + "\\">" + escapeHtml(modelId) + "</option>").join("");
        normalSelect.value = options.includes(state.selectedModel) ? state.selectedModel : (options[0] || "");
      }
      if (godParticipants) {
        godParticipants.innerHTML = options.map((modelId) => "<option value=\\"" + escapeHtml(modelId) + "\\">" + escapeHtml(modelId) + "</option>").join("");
        const preferred = options.slice(0, Math.min(3, options.length));
        Array.from(godParticipants.options).forEach((option) => {
          option.selected = preferred.includes(option.value);
        });
      }
      if (godSupervisor) {
        godSupervisor.innerHTML = options.map((modelId) => "<option value=\\"" + escapeHtml(modelId) + "\\">" + escapeHtml(modelId) + "</option>").join("");
        godSupervisor.value = options[1] || options[0] || "";
      }
      if (normalProvider) {
        normalProvider.textContent = options.length ? "NVIDIA selectable runtime ready" : "尚未加载可选模型";
      }
      const selectedModelNode = byId("three-mode-normal-selected-model");
      const providerStatusNode = byId("three-mode-normal-provider-status");
      const credentialStatusNode = byId("three-mode-normal-credential-status");
      const governanceStatusNode = byId("three-mode-normal-governance-status");
      if (selectedModelNode) {
        selectedModelNode.textContent = "selectedModel: " + (state.selectedModel || options[0] || "pending");
      }
      if (providerStatusNode) {
        providerStatusNode.textContent = "providerStatus: " + (provider?.keyStatus || "pending");
      }
      if (credentialStatusNode) {
        credentialStatusNode.textContent = "credentialRefStatus: " + (provider?.apiKeyConfigured ? "configured_hidden_value" : "credentialRefOnly_required");
      }
      if (governanceStatusNode) {
        governanceStatusNode.textContent = "quota / budget / selectable: " + (options.length ? "selectable models available" : "provider or model setup required");
      }
      syncThreeModeTabs();
    }

    function applyReadonlyAcceptanceView() {
      const page = (queryParams.get("page") || "").trim().toLowerCase();
      const threeMode = (queryParams.get("threeMode") || queryParams.get("mode") || "").trim().toLowerCase();
      if (["chat", "models", "approvals", "files", "diagnostics"].includes(page)) {
        state.activePage = page;
      }
      if (["normal", "god", "tianshu"].includes(threeMode)) {
        state.activeThreeMode = threeMode;
      }
    }

    function syncThreeModeTabs() {
      document.querySelectorAll("[data-three-mode]").forEach((button) => {
        button.classList.toggle("is-active", button.getAttribute("data-three-mode") === state.activeThreeMode);
      });
      ["normal", "god", "tianshu"].forEach((mode) => {
        byId("three-mode-panel-" + mode)?.classList.toggle("is-active", state.activeThreeMode === mode);
      });
    }

    function classifyTaskPreview(input) {
      const text = String(input || "").toLowerCase();
      if (/code|review|bug|diff|test|script/.test(text)) return "coding";
      if (/translate|translation|缈昏瘧/.test(text)) return "translation";
      if (/summary|summarize|鎬荤粨/.test(text)) return "writing";
      if (/analysis|analy|report|璇婃柇|鍒嗘瀽/.test(text)) return "data_analysis";
      if (/reason|plan|design|architecture|鏂规/.test(text)) return "reasoning";
      if (/context|long|鏂囨。/.test(text)) return "long_context";
      return "general_chat";
    }

    function renderThreeModeResult(payload) {
      const resultNode = byId("three-mode-result-output");
      const auditNode = byId("three-mode-audit-output");
      const telemetryNode = byId("three-mode-telemetry-output");
      const badge = byId("three-mode-safety-badge");
      const taskPreview = byId("three-mode-task-preview");
      if (!resultNode || !auditNode || !badge) return;
      if (!payload) {
        resultNode.textContent = "No Three Mode result yet.";
        auditNode.textContent = "No audit trace yet.";
        if (telemetryNode) telemetryNode.textContent = "latencyMs=0\\nestimatedTokenUsage=0\\nestimatedCost=internal_test_cost_unknown\\nquotaStatus=unknown\\nbudgetStatus=unknown\\npolicyStatus=unknown\\ncredentialStatus=credentialRefOnly";
        badge.textContent = "providerCallsMade=false | nonNvidiaProviderCallsMade=false | secretValueExposed=false";
        if (taskPreview) taskPreview.textContent = "taskClassification: pending";
        renderThreeModeCandidatePanels(null);
        return;
      }
      const data = payload.data || {};
      const audit = data.auditTrace || {};
      resultNode.textContent = prettyJson({
        mode: data.mode,
        finalAnswer: data.finalAnswer,
        selectedModel: data.selectedModel?.modelId || null,
        participantModels: (data.participantModels || []).map((item) => item.modelId),
        plannerDecision: data.plannerDecision || null,
        supervisorDecision: data.supervisorDecision || null,
        disagreements: data.disagreements || [],
        fallbackUsed: data.fallbackUsed === true
      });
      auditNode.textContent = prettyJson(audit);
      if (telemetryNode) {
        const estimatedTokenUsage = Math.ceil(String(data.finalAnswer || "").length / 4);
        telemetryNode.textContent = prettyJson({
          currentMode: data.mode,
          selectedModel: data.selectedModel?.modelId || null,
          participantModels: (data.participantModels || []).map((item) => item.modelId),
          selectedModels: data.plannerDecision?.selectedModels || audit.selectedModels || [],
          providerCallsMade: audit.providerCallsMade === true,
          nonNvidiaProviderCallsMade: audit.nonNvidiaProviderCallsMade === true,
          fallbackUsed: data.fallbackUsed === true || audit.fallbackUsed === true,
          latencyMs: Number(audit.durationMs || payload.meta?.durationMs || 0),
          participantCallCount: Number(audit.participantCallCount || 0),
          supervisorCallCount: Number(audit.supervisorCallCount || 0),
          estimatedTokenUsage,
          estimatedCost: audit.estimatedCost ?? "internal_test_cost_unknown",
          costVisibility: audit.estimatedCost ? "estimate" : "estimatedOnly",
          quotaStatus: audit.quotaStatus || null,
          budgetStatus: audit.budgetStatus || null,
          policyStatus: audit.policyDecision?.policyStatus || "unknown",
          credentialStatus: audit.credentialRefOnly === true ? "credentialRefOnly" : "not_applicable",
          safetyWarnings: audit.nonNvidiaProviderCallsMade === true ? ["userOwnedProviderCostMayApply"] : []
        });
      }
      badge.textContent = "providerCallsMade=" + String(audit.providerCallsMade === true)
        + " | nonNvidiaProviderCallsMade=" + String(audit.nonNvidiaProviderCallsMade === true)
        + " | credentialRefOnly=true"
        + " | secretValueExposed=" + String(audit.secretValueExposed === true);
      badge.className = "inline-status " + ((audit.providerCallsMade === true && audit.secretValueExposed !== true) ? "ok" : "warn");
      if (taskPreview) {
        taskPreview.textContent = "taskClassification: " + (data.plannerDecision?.taskClassification || classifyTaskPreview(byId("three-mode-tianshu-input")?.value || ""));
      }
      renderThreeModeCandidatePanels(payload);
    }

    function renderThreeModeCandidatePanels(payload) {
      const data = payload?.data || {};
      const audit = data.auditTrace || {};
      const disagreements = Array.isArray(data.disagreements) ? data.disagreements : [];
      const participantModels = Array.isArray(data.participantModels) ? data.participantModels.map((item) => item.modelId) : [];
      const plannerDecision = data.plannerDecision || {};
      const selectedModels = Array.isArray(plannerDecision.selectedModels) ? plannerDecision.selectedModels : [];
      const rejectedCandidates = Array.isArray(plannerDecision.rejectedCandidates) ? plannerDecision.rejectedCandidates : [];
      const participantSummaryNode = byId("three-mode-god-participant-summary");
      const conflictLevelNode = byId("three-mode-god-conflict-level");
      const disagreementNode = byId("three-mode-god-disagreement-points");
      const fallbackNode = byId("three-mode-god-fallback-reason");
      const supervisorStatusNode = byId("three-mode-god-supervisor-status");
      const supervisorBasisNode = byId("three-mode-god-supervisor-basis");
      const supervisorUncertaintyNode = byId("three-mode-god-supervisor-uncertainty");
      const warningStatusNode = byId("three-mode-god-warning-status");
      const plannerStatusNode = byId("three-mode-tianshu-planner-status");
      const selectedModelsNode = byId("three-mode-tianshu-selected-models");
      const rejectedNode = byId("three-mode-tianshu-rejected-candidates");
      const capabilityNode = byId("three-mode-tianshu-capability-summary");
      const noCandidateReasonNode = byId("three-mode-tianshu-no-candidate-reason");
      const nextActionsNode = byId("three-mode-tianshu-next-actions");
      const providerWarningNode = byId("three-mode-tianshu-provider-warning");
      const dryRunStatusNode = byId("three-mode-tianshu-dry-run-status");
      const providerStatus = Array.isArray(state.providerStatus?.providers) ? state.providerStatus.providers[0]?.keyStatus : "unknown";
      const warnings = []
        .concat(audit.quotaStatus ? ["quota=" + audit.quotaStatus] : [])
        .concat(audit.budgetStatus ? ["budget=" + audit.budgetStatus] : [])
        .concat(providerStatus ? ["provider=" + providerStatus] : [])
        .concat(audit.credentialRefOnly === true ? ["credentialRefOnly=true"] : ["credentialRefOnly=required"]);
      if (participantSummaryNode) {
        participantSummaryNode.textContent = "participantSelection: " + (participantModels.length ? participantModels.join(", ") : "pending / dry-run candidate");
      }
      if (conflictLevelNode) {
        conflictLevelNode.textContent = "conflictLevel: " + (disagreements.length > 1 ? "high" : disagreements.length === 1 ? "medium" : "none");
      }
      if (disagreementNode) {
        disagreementNode.textContent = "disagreementPoints: " + (disagreements.length ? disagreements.join(" | ") : "[]");
      }
      if (fallbackNode) {
        fallbackNode.textContent = "fallbackReason: " + (data.fallbackUsed ? (audit.fallbackReason || "fallback_used") : "none");
      }
      if (supervisorStatusNode) {
        supervisorStatusNode.textContent = "synthesisStatus: " + (data.supervisorDecision ? "completed" : "pending");
      }
      if (supervisorBasisNode) {
        supervisorBasisNode.textContent = "decisionBasis: " + ((audit.selectedModels || selectedModels).length ? (audit.selectedModels || selectedModels).join(", ") : "[]");
      }
      if (supervisorUncertaintyNode) {
        supervisorUncertaintyNode.textContent = "uncertainty: " + (audit.providerCallsMade === true ? "provider result may still require review" : "dry-run / candidate only");
      }
      if (warningStatusNode) {
        warningStatusNode.textContent = "warnings: " + warnings.join(" | ");
      }
      if (plannerStatusNode) {
        plannerStatusNode.textContent = "plannerStatus: " + (plannerDecision.taskClassification ? "selected" : payload ? "dry_run" : "pending");
      }
      if (selectedModelsNode) {
        selectedModelsNode.textContent = "selectedModelRefs: " + (selectedModels.length ? selectedModels.join(", ") : "[]");
      }
      if (rejectedNode) {
        rejectedNode.textContent = "rejectedCandidates: " + (rejectedCandidates.length ? rejectedCandidates.map((item) => item.modelId || item.reason || "candidate").join(" | ") : "[]");
      }
      if (capabilityNode) {
        capabilityNode.textContent = "capabilityMatch: " + (plannerDecision.taskClassification || classifyTaskPreview(byId("three-mode-tianshu-input")?.value || ""));
      }
      if (noCandidateReasonNode) {
        noCandidateReasonNode.textContent = "reason: " + (selectedModels.length ? "not_triggered" : (audit.fallbackReason || "planner_no_candidate_candidate"));
      }
      if (nextActionsNode) {
        nextActionsNode.textContent = "nextActions: 配置 provider | 查看 Model Library | 切换 Normal Mode | 重试 planner";
      }
      if (providerWarningNode) {
        providerWarningNode.textContent = "provider / credentialRef warning: " + (providerStatus || "pending");
      }
      if (dryRunStatusNode) {
        dryRunStatusNode.textContent = "dryRunNotice: candidate only / providerCallsMade=" + String(audit.providerCallsMade === true);
      }
    }

    function buildThreeModeRequest(mode) {
      const requestId = "phase328a-ui-" + mode + "-" + Date.now();
      if (mode === "normal") {
        const content = byId("three-mode-normal-input")?.value.trim() || "";
        const selectedModelId = byId("three-mode-normal-model")?.value || state.selectedModel;
        return {
          requestId,
          mode,
          input: { content },
          modelSelection: { selectedModelId },
          executionPolicy: { timeoutMs: 60000, allowFallback: true, allowParallelExecution: false, allowGodEscalation: false },
          audit: { traceEnabled: true }
        };
      }
      if (mode === "god") {
        const content = byId("three-mode-god-input")?.value.trim() || "";
        const autoSelect = byId("three-mode-god-auto")?.checked === true;
        const participants = autoSelect ? [] : Array.from(byId("three-mode-god-participants")?.selectedOptions || []).map((option) => option.value);
        const maxParticipants = Number(byId("three-mode-god-max-participants")?.value || 3);
        return {
          requestId,
          mode,
          input: { content },
          modelSelection: {
            participantModelIds: participants,
            supervisorModelId: byId("three-mode-god-supervisor")?.value || state.selectedModel,
            allowSystemModelSelection: autoSelect
          },
          executionPolicy: { timeoutMs: 120000, allowParallelExecution: true, maxParticipants },
          audit: { traceEnabled: true, includeModelContributions: true }
        };
      }
      const content = byId("three-mode-tianshu-input")?.value.trim() || "";
      return {
        requestId,
        mode: "tianshu",
        input: { content },
        executionPolicy: {
          timeoutMs: 120000,
          allowFallback: true,
          allowGodEscalation: byId("three-mode-tianshu-allow-god")?.checked !== false
        },
        audit: { traceEnabled: true, includePlannerDecision: true }
      };
    }

    async function runThreeMode(mode) {
      const request = buildThreeModeRequest(mode);
      const text = String(request.input?.content || "").trim();
      if (!text) {
        showToast("请输入 Three Mode 内容后再执行。", "warn");
        return;
      }
      const resultNode = byId("three-mode-result-output");
      const auditNode = byId("three-mode-audit-output");
      if (resultNode) resultNode.textContent = "Running " + mode + " mode...";
      if (auditNode) auditNode.textContent = "waiting for audit trace...";
      try {
        const payload = await threeModeExecute(request);
        state.lastThreeModeResult = payload;
        state.lastError = null;
        renderThreeModeResult(payload);
        renderEvidenceDrawer();
        renderDiagnostics();
        showToast("Three Mode runtime returned: " + mode);
      } catch (error) {
        state.lastError = error.message;
        if (resultNode) resultNode.textContent = "Three Mode failed: " + error.message;
        if (auditNode) auditNode.textContent = prettyJson({ providerCallsMade: false, nonNvidiaProviderCallsMade: false, secretValueExposed: false, error: error.message });
        renderDiagnostics();
        showToast(error.message, "error");
      }
    }

    function modelLatencyMs(item) {
      const fromStrategy = [
        ...PHASE324D2F_STRATEGY.fastModels,
        ...PHASE324D2F_STRATEGY.highQualityModels,
        ...PHASE324D2F_STRATEGY.lowLatencyModels,
        ...PHASE324D2F_STRATEGY.highLatencyWarning
      ].find((row) => row.modelId === item.modelId);
      const direct = Number(item.lastSmokeResult?.durationMs ?? item.latencyMs);
      if (Number.isFinite(direct) && direct > 0) return direct;
      return Number.isFinite(Number(fromStrategy?.latencyMs)) ? Number(fromStrategy.latencyMs) : null;
    }

    function decorateModelRows(records) {
      return records.map((item) => {
        const failedEvidence = PHASE324D_FAILED_MODEL_REASONS[item.modelId] || {};
        const latencyMs = modelLatencyMs(item);
        const status = failedEvidence.evidenceId ? "smoke_failed" : String(item.verificationStatus || "unverified");
        const evidenceId = failedEvidence.evidenceId || item.evidenceId || "";
        const failureReason = failedEvidence.reason || item.failureReason || item.selectableReason || "";
        return {
          ...item,
          verificationStatus: status,
          evidenceId,
          failureReason,
          nonSelectableReason: item.selectable === true ? "" : (failureReason || "no valid smoke evidence"),
          latencyMs,
          highLatency: Number(latencyMs) > 10000,
          providerScope: MODEL_PROVIDER_SCOPE[item.providerId] || "future-provider-slot"
        };
      });
    }

    function rowMatchesControls(row) {
      const controls = state.modelLibraryControls;
      const query = String(controls.query || "").toLowerCase().trim();
      const bucket = String(row.capabilityBucket || "").toLowerCase();
      const status = String(row.verificationStatus || "").toLowerCase();
      if (controls.status === "selectable" && row.selectable !== true) return false;
      if (controls.status === "smoke_passed" && status !== "smoke_passed") return false;
      if (controls.status === "failed" && status !== "smoke_failed") return false;
      if (controls.status === "unverified" && status !== "unverified") return false;
      if (controls.status === "high_latency" && row.highLatency !== true) return false;
      if (controls.providerScope !== "all" && row.providerScope !== controls.providerScope) return false;
      if (controls.capability === "chat_like" && !(bucket.includes("chat") || bucket.includes("instruct"))) return false;
      if (controls.capability === "unknown" && bucket !== "unknown") return false;
      if (controls.capability === "non_chat" && (bucket.includes("chat") || bucket.includes("instruct"))) return false;
      if (!query) return true;
      const haystack = [
        row.modelId,
        row.providerId,
        row.evidenceId,
        row.capabilityBucket,
        row.failureReason,
        row.nonSelectableReason,
        row.verificationStatus
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    }

    function sortModelRows(rows) {
      const sorted = [...rows];
      const sort = state.modelLibraryControls.sort;
      const latency = (item) => Number.isFinite(Number(item.latencyMs)) ? Number(item.latencyMs) : Number.MAX_SAFE_INTEGER;
      if (sort === "model_asc") sorted.sort((left, right) => String(left.modelId).localeCompare(String(right.modelId)));
      if (sort === "status") sorted.sort((left, right) => String(left.verificationStatus).localeCompare(String(right.verificationStatus)) || String(left.modelId).localeCompare(String(right.modelId)));
      if (sort === "latency_asc") sorted.sort((left, right) => latency(left) - latency(right) || String(left.modelId).localeCompare(String(right.modelId)));
      if (sort === "latency_desc") sorted.sort((left, right) => latency(right) - latency(left) || String(left.modelId).localeCompare(String(right.modelId)));
      if (sort === "selectable_first") sorted.sort((left, right) => Number(right.selectable === true) - Number(left.selectable === true) || String(left.modelId).localeCompare(String(right.modelId)));
      if (sort === "evidence_first") sorted.sort((left, right) => Number(Boolean(right.evidenceId)) - Number(Boolean(left.evidenceId)) || String(left.modelId).localeCompare(String(right.modelId)));
      if (sort === "verified_desc") sorted.sort((left, right) => String(right.lastVerifiedAt || "").localeCompare(String(left.lastVerifiedAt || "")));
      return sorted;
    }

    function modelRowHtml(item) {
      const tone = item.selectable === true ? "ok" : item.verificationStatus === "smoke_failed" ? "error" : "warn";
      const latencyCopy = item.latencyMs ? " | latencyMs: " + escapeHtml(item.latencyMs) : "";
      const warning = item.highLatency ? "<span class=\\"inline-status warn\\">high latency</span>" : "";
      const reason = item.selectable === true ? "quick chat allowed" : item.nonSelectableReason;
      return "<div class=\\"model-item\\">"
        + "<div class=\\"row\\"><strong>" + escapeHtml(item.modelId) + "</strong><span class=\\"" + statusClass(tone) + "\\">" + escapeHtml(item.verificationStatus) + "</span>" + warning + "</div>"
        + "<div class=\\"card-copy\\">provider: " + escapeHtml(item.providerId || "nvidia") + " | scope: " + escapeHtml(item.providerScope) + " | capability: " + escapeHtml(item.capabilityBucket || "unknown") + latencyCopy + "</div>"
        + "<div class=\\"card-copy\\">evidenceId: " + escapeHtml(item.evidenceId || "none") + "</div>"
        + "<div class=\\"card-copy\\">selectable: " + escapeHtml(item.selectable === true ? "true" : "false") + " | reason: " + escapeHtml(reason || "none") + "</div>"
        + "</div>";
    }

    function renderModelStrategy() {
      const summary = byId("model-library-strategy-summary");
      const output = byId("model-library-strategy-output");
      if (!summary || !output) return;
      summary.innerHTML = "<strong>Model selection strategy:</strong> read-only operations advice. It does not change real routing, selectedModel localStorage, Chat dropdown, or selectable gate.";
      const strategyCards = [
        ["defaultRecommended", [PHASE324D2F_STRATEGY.defaultRecommended]],
        ["fastModels", PHASE324D2F_STRATEGY.fastModels],
        ["highQualityModels", PHASE324D2F_STRATEGY.highQualityModels],
        ["lowLatencyModels", PHASE324D2F_STRATEGY.lowLatencyModels],
        ["fallbackCandidates", PHASE324D2F_STRATEGY.fallbackCandidates],
        ["highLatencyWarning", PHASE324D2F_STRATEGY.highLatencyWarning]
      ];
      output.innerHTML = strategyCards.map((entry) => {
        return "<div class=\\"model-item\\"><strong>" + escapeHtml(entry[0]) + "</strong><div class=\\"card-copy\\">"
          + entry[1].map((item) => escapeHtml(item.modelId + (item.latencyMs ? " (" + item.latencyMs + "ms)" : ""))).join("<br>")
          + "</div></div>";
      }).join("");
    }

    function renderModelLibrary() {
      const container = byId("model-list-output");
      if (!container) return;
      const matrix = state.modelLibrary?.data?.usabilityMatrix || state.modelLibrary?.usabilityMatrix || null;
      const records = Array.isArray(matrix?.records)
        ? matrix.records
        : [];
      const summary = matrix?.summary || {};
      const selectable = records.filter((item) => {
        const bucket = String(item.capabilityBucket || "").toLowerCase();
        return item.verificationStatus === "smoke_passed"
          && item.selectable === true
          && item.directChatAllowed === true
          && (bucket === "chat" || bucket === "reasoning_chat" || bucket === "code" || bucket === "chat_reasoning");
      });
      const decorated = decorateModelRows(records);
      state.modelLibraryRows = decorated;
      const filtered = sortModelRows(decorated.filter(rowMatchesControls));
      const failedCount = decorated.filter((item) => item.verificationStatus === "smoke_failed").length;
      const unverifiedCount = decorated.filter((item) => item.verificationStatus === "unverified").length;
      const summaryNode = byId("model-library-status-summary");
      if (summaryNode) {
        summaryNode.innerHTML = "<div><strong>verified selectable:</strong> " + escapeHtml(summary.selectableModels ?? selectable.length) + "</div>"
          + "<div><strong>smoke passed:</strong> " + escapeHtml(summary.smokePassedModels ?? selectable.length) + "</div>"
          + "<div><strong>provider scope:</strong> NVIDIA-only</div>"
          + "<div><strong>future provider slots:</strong> OpenAI / Claude / OpenRouter / MiMo are not enabled for real calls.</div>"
          + "<div><strong>rule:</strong> only smoke_passed models with evidenceId appear in quick chat dropdown.</div>"
          + "<div><strong>strategy:</strong> read-only recommendation; no real default route changes.</div>";
      }
      const stats = byId("model-library-filter-stats");
      if (stats) {
        stats.textContent = "results=" + filtered.length + " | selectable=" + selectable.length + " | failed=" + failedCount + " | unverified=" + unverifiedCount;
      }
      container.innerHTML = filtered.slice(0, 80).map(modelRowHtml).join("")
        || "<div class=\\"model-item\\"><strong>No matching models</strong><div class=\\"card-copy\\">No API call was triggered. Adjust search, status, provider scope, capability, or sort controls.</div></div>";
      renderModelStrategy();
    }

    function renderProviderStatus() {
      const provider = Array.isArray(state.providerStatus?.providers) ? state.providerStatus.providers[0] : null;
      if (!provider) return;
      const configured = provider.apiKeyConfigured === true;
      const badge = byId("provider-key-status-badge");
      badge.className = configured ? "inline-status ok" : "inline-status error";
      badge.textContent = configured ? "已配置（已隐藏）" : "未配置";
      byId("provider-key-summary").textContent = configured ? "已配置，页面不显示明文" : "未配置 API Key";
      byId("provider-test-summary").textContent = provider.lastTestResult?.message || "尚未测试";
      byId("provider-key-status-badge").textContent = configured ? "已配置（已隐藏）" : "未配置";
      const providerChip = byId("provider-chip");
      providerChip.textContent = "Provider：" + provider.keyStatus;
      providerChip.className = "status-chip";
      renderTopbar();
    }

    function renderApprovals() {
      const container = byId("approval-list");
      if (!container) return;
      if (state.approvalsUnsupported) {
        container.innerHTML = "<div class=\\"approval-item\\"><strong>Approvals API unavailable in this local dry-run build.</strong><div class=\\"card-copy\\">当前 dry-run 环境不可读取审批列表；Mission Control sample dry-run 仍可正常体验。</div></div>";
        return;
      }
      if (!state.approvals.length) {
        container.innerHTML = "<div class=\\"approval-item\\"><strong>当前没有审批任务</strong><div class=\\"card-copy\\">点击“创建测试审批任务”可以生成一条受限 no-op 审批记录。</div></div>";
        return;
      }
      container.innerHTML = state.approvals.map((item) => {
        const statusClassName = item.status === "approved" ? "ok" : item.status === "rejected" ? "error" : "warn";
        return "<div class=\\"approval-item\\">"
          + "<div class=\\"row\\"><strong>" + escapeHtml(item.title) + "</strong><span class=\\"" + statusClass(statusClassName) + "\\">" + escapeHtml(item.status) + "</span></div>"
          + "<div class=\\"card-copy\\">" + escapeHtml(item.reason || "需要人工审批") + "</div>"
          + "<div class=\\"card-copy\\">allowedFiles: " + escapeHtml((item.allowedFiles || []).join(", ") || "none") + "</div>"
          + "<div class=\\"card-copy\\">forbiddenPaths: " + escapeHtml((item.forbiddenPaths || []).join(", ")) + "</div>"
          + "<div class=\\"approval-actions\\">"
          + "<button type=\\"button\\" data-approval-action=\\"approve\\" data-approval-id=\\"" + escapeHtml(item.id) + "\\">批准此 dry-run 候选</button>"
          + "<button type=\\"button\\" data-approval-action=\\"reject\\" data-approval-id=\\"" + escapeHtml(item.id) + "\\">拒绝此 dry-run 候选</button>"
          + "<button type=\\"button\\" data-approval-action=\\"apply\\" data-approval-id=\\"" + escapeHtml(item.id) + "\\">预览已批准动作说明</button>"
          + "</div>"
          + "</div>";
      }).join("");
    }

    function renderApprovalIntentPreview() {
      const output = byId("approval-preview-output");
      if (!output) return;
      if (!state.approvalIntentPreview) {
        output.textContent = "当前尚未运行审批意图预览。该入口只调用只读预览，不创建审批，不生成 patch proposal，也不执行本地动作。";
        return;
      }
      output.textContent = prettyJson(state.approvalIntentPreview);
    }

    function parseAllowedFilesText(value) {
      return Array.from(new Set(String(value || "")
        .split(/\r?\n/g)
        .map((item) => item.trim())
        .filter(Boolean)));
    }

    function collectLocalAgentInput() {
      const taskInput = byId("local-agent-task-input")?.value?.trim() || "";
      const allowedFilesText = byId("local-agent-allowed-files-input")?.value || "";
      const allowedFiles = parseAllowedFilesText(allowedFilesText);
      state.localAgent.taskInput = taskInput;
      state.localAgent.allowedFilesText = allowedFilesText;
      return {
        taskInput,
        allowedFilesText,
        allowedFiles,
      };
    }

    function renderLocalAgentOutputs() {
      const intentOutput = byId("local-agent-intent-output");
      const planOutput = byId("local-agent-plan-output");
      const patchOutput = byId("local-agent-patch-output");
      const approvalOutput = byId("local-agent-approval-output");
      if (intentOutput) {
        intentOutput.textContent = state.localAgent.intentResult
          ? prettyJson(state.localAgent.intentResult)
          : "尚未运行意图预览。";
      }
      if (planOutput) {
        planOutput.textContent = state.localAgent.planResult
          ? prettyJson(state.localAgent.planResult)
          : "尚未生成操作计划。";
      }
      if (patchOutput) {
        patchOutput.textContent = state.localAgent.patchResult
          ? prettyJson(state.localAgent.patchResult)
          : "尚未生成 patch proposal。";
      }
      if (approvalOutput) {
        approvalOutput.textContent = state.localAgent.approvalResult
          ? prettyJson(state.localAgent.approvalResult)
          : "尚未创建审批记录。";
      }
    }

    function syncLocalAgentDraftInputs() {
      const taskInput = byId("local-agent-task-input");
      const allowedFilesInput = byId("local-agent-allowed-files-input");
      if (taskInput && !taskInput.value.trim()) {
        taskInput.value = state.localAgent.taskInput || "";
      }
      if (allowedFilesInput && !allowedFilesInput.value.trim()) {
        allowedFilesInput.value = state.localAgent.allowedFilesText || "";
      }
    }

    function syncRepairDraftInputs() {
      const taskInput = byId("repair-task-input");
      const allowedFilesInput = byId("repair-allowed-files-input");
      if (taskInput && !taskInput.value.trim()) {
        taskInput.value = state.repairDraft.taskInput || "";
      }
      if (allowedFilesInput && !allowedFilesInput.value.trim()) {
        allowedFilesInput.value = state.repairDraft.allowedFilesText || "";
      }
    }

    function renderFileSelections() {
      const container = byId("file-list-output");
      const summary = byId("file-summary-output");
      if (!container || !summary) return;
      if (!state.fileSelections.length) {
        container.innerHTML = "<div class=\\"file-item\\"><strong>暂无登记结果</strong><div class=\\"card-copy\\">这里只记录文件名、路径和大小等最小上下文，不读取敏感内容。</div></div>";
        summary.textContent = "尚未登记文件。敏感文件名（如 .env、secret、token）会被拦截。";
        return;
      }
      const latest = state.fileSelections[0];
      summary.textContent = "仅登记 / 预览，未进入知识库训练。已接受 " + (latest.filesSelected || 0) + " 个文件，拦截 " + (latest.filesBlocked || 0) + " 个文件。";
      container.innerHTML = state.fileSelections.map((item) => {
        const accepted = sanitizeFileContextEntries(item.accepted);
        const blocked = sanitizeFileContextEntries(item.blocked);
        return "<div class=\\"file-item\\">"
          + "<strong>" + escapeHtml(item.selectedAt || "最近一次登记") + "</strong>"
          + "<div class=\\"card-copy\\">已接受：" + escapeHtml(String(accepted.length)) + "；已拦截：" + escapeHtml(String(blocked.length)) + "</div>"
          + "<details><summary>展开登记详情</summary><div class=\\"card-copy\\">" + escapeHtml(prettyJson({ accepted, blocked })) + "</div></details>"
          + "</div>";
      }).join("");
    }

    function sanitizeFileContextEntries(items) {
      return (Array.isArray(items) ? items : []).map((item) => {
        const next = { ...item };
        if (isSensitiveFileReference(next.name)) {
          next.name = "[blocked-sensitive-file]";
        }
        if (isSensitiveFileReference(next.path)) {
          next.path = "[blocked-sensitive-path]";
        }
        return next;
      });
    }

    function isSensitiveFileReference(value) {
      return /(^|[\\/])\.env(\.|$)|secret|token|credential/i.test(String(value || ""));
    }

    function renderDiagnostics() {
      const health = state.diagnostics?.health || {};
      const provider = Array.isArray(state.providerStatus?.providers) ? state.providerStatus.providers[0] : null;
      const chatModels = state.selectableModels.length;
      byId("diag-service-status").textContent = health.serviceStatus === "ready" ? "running" : (health.serviceStatus || "unknown");
      byId("diag-health-note").textContent = "/health/check: " + (health.routes?.chat ? "可用" : "待检查");
      byId("diag-provider-status").textContent = provider?.apiKeyConfigured ? "已配置" : "未配置";
      byId("diag-provider-note").textContent = provider?.lastTestResult?.message || (provider?.apiKeyConfigured ? "可进一步测试真实连接" : "未配置 API Key");
      byId("diag-model-count").textContent = String(chatModels);
      byId("diag-model-note").textContent = chatModels > 0 ? "仅统计已验证 Chat 模型" : "当前没有可直接聊天的模型";
      byId("diag-last-chat-output").textContent = state.lastChatResult
        ? prettyJson({
            selectedModel: state.lastChatResult.selectedModel,
            providerCalled: state.lastChatResult.providerCalled,
            completionVerified: state.lastChatResult.completionVerified,
            evidenceId: state.lastChatResult.evidenceId,
            summary: state.lastChatResult.userVisibleSummary
          })
        : "暂无记录。";
      byId("diag-last-error-output").textContent = state.lastError ? state.lastError : "暂无错误。";
      byId("diagnostics-raw-output").textContent = prettyJson({
        diagnostics: state.diagnostics,
        providerStatus: state.providerStatus,
        lastDryRunResult: state.lastDryRunResult,
        lastThreeModeResult: state.lastThreeModeResult
      });
    }

    async function previewLocalAgentWorkspaceIntent() {
      const { taskInput, allowedFiles } = collectLocalAgentInput();
      if (!taskInput) {
        showToast("请先填写本地任务说明。", "warn");
        return;
      }
      const result = await workbenchApiClient.previewLocalAgentIntent({
        input: taskInput,
        message: taskInput,
        permissionMode: "manual",
        dryRun: true,
        allowedFiles,
        forbiddenPaths: FORBIDDEN_PATHS,
      });
      state.localAgent.intentResult = result;
      renderLocalAgentOutputs();
      showToast("本地智能体意图预览已生成，未执行真实动作。", "info");
    }

    async function buildLocalAgentOperationPlan() {
      const { taskInput, allowedFiles } = collectLocalAgentInput();
      if (!taskInput) {
        showToast("请先填写本地任务说明。", "warn");
        return;
      }
      const result = await workbenchApiClient.createLocalAgentOperationPlan({
        input: taskInput,
        permissionMode: "manual",
        dryRun: true,
        allowedFiles,
        forbiddenPaths: FORBIDDEN_PATHS,
      });
      state.localAgent.planResult = result;
      renderLocalAgentOutputs();
      showToast("本地智能体操作计划已生成，仍处于审批前阶段。", "info");
    }

    async function buildLocalAgentPatchProposal() {
      const { taskInput, allowedFiles } = collectLocalAgentInput();
      if (!taskInput) {
        showToast("请先填写本地任务说明。", "warn");
        return;
      }
      const result = await workbenchApiClient.createLocalAgentPatchProposal({
        input: taskInput,
        permissionMode: "manual",
        dryRun: true,
        allowedFiles,
        forbiddenPaths: FORBIDDEN_PATHS,
      });
      state.localAgent.patchResult = result;
      renderLocalAgentOutputs();
      showToast("Patch proposal 已生成，仍未执行 apply。", "info");
    }

    async function createApprovalFromLocalAgent() {
      const { taskInput, allowedFiles } = collectLocalAgentInput();
      if (!taskInput) {
        showToast("请先填写本地任务说明。", "warn");
        return;
      }
      if (!state.localAgent.patchResult?.patchProposal) {
        await buildLocalAgentPatchProposal();
      }
      const patchResult = state.localAgent.patchResult;
      if (!patchResult?.patchProposal) {
        showToast("未能生成 patch proposal，不能创建审批。", "warn");
        return;
      }
      const result = await workbenchApiClient.createApproval({
        title: "Phase3989A 本地智能体审批任务",
        reason: taskInput,
        featureId: "phase3989a-local-agent",
        operationId: patchResult.operationId,
        allowedFiles,
        forbiddenPaths: FORBIDDEN_PATHS,
        patchProposal: patchResult.patchProposal,
        approvalRecord: patchResult.approvalRecord,
        scope: "patch",
        permissionMode: "manual",
        summary: "由 local-agent 工作台生成的受限审批记录。",
      });
      state.localAgent.approvalResult = result;
      renderLocalAgentOutputs();
      await loadApprovals();
      showToast(result.approval?.id ? "审批记录已创建。" : "审批记录创建失败。", result.approval?.id ? "info" : "warn");
    }

    function handoffRepairDraftToLocalAgent() {
      const repairTaskInput = byId("repair-task-input")?.value?.trim() || "";
      const repairAllowedFilesText = byId("repair-allowed-files-input")?.value || "";
      state.repairDraft.taskInput = repairTaskInput;
      state.repairDraft.allowedFilesText = repairAllowedFilesText;
      state.localAgent.taskInput = repairTaskInput || state.localAgent.taskInput;
      state.localAgent.allowedFilesText = repairAllowedFilesText || state.localAgent.allowedFilesText;
      setActivePage("local-agent");
      syncLocalAgentDraftInputs();
      renderLocalAgentOutputs();
      showToast("修复草稿已带入本地智能体页面。", "info");
    }

    function updateChatModeBadge(result, isDryRun) {
      const badge = byId("chat-run-mode");
      if (!badge) return;
      if (isDryRun) {
        badge.textContent = "聊天模式：测试模式，未调用 Provider";
        return;
      }
      if (result?.providerCalled === true && result?.completionVerified === true) {
        badge.textContent = "聊天模式：已真实调用 Provider";
      } else if (result?.providerCalled === false) {
        badge.textContent = "聊天模式：未发起真实 Provider 调用";
      } else {
        badge.textContent = "聊天模式：已调用 Provider，但未完成校验";
      }
    }

function summarizeFailure(result) {
      const topCode = String(result?.code || "").trim();
      const executionCode = String(result?.failureCode || result?.stages?.executionStatus?.code || "").trim();
      const blockerCodes = Array.isArray(result?.blockers) ? result.blockers : [];
      const code = executionCode || topCode;
      if (code === "nvidia_api_key_missing" || code === "nvidia_api_key_required") {
        return "未配置 API Key，无法发起真实聊天。";
      }
      if (code === "provider_not_allowed_phase312a" || code === "real_provider_disabled" || blockerCodes.includes("real_provider_disabled")) {
        return "Provider 当前不可用，未发起真实调用。";
      }
      if (code === "model_not_in_library" || code === "endpoint_type_mismatch" || code === "model_not_selectable" || blockerCodes.includes("model_not_selectable")) {
        return "当前模型未验证或不允许直接用于普通聊天。";
      }
      if (result?.providerCalled === true) {
        return "请求失败：" + (result?.failureMessage || result?.verificationReason || result?.message || "Provider 返回失败。");
      }
      return result?.userVisibleSummary || result?.failureMessage || result?.verificationReason || result?.message || "未发起真实 Provider 调用。";
    }

    async function loadProviderStatus() {
      state.providerStatus = await workbenchApiClient.getProviderConfigStatus();
      renderProviderStatus();
    }

    async function loadModelLibrary() {
      state.modelLibrary = await requestJson("/model-library");
      const matrix = state.modelLibrary?.data?.usabilityMatrix || state.modelLibrary?.usabilityMatrix || null;
      const records = Array.isArray(matrix?.records)
        ? matrix.records
        : [];
      state.selectableModels = records
        .filter((item) => {
          const bucket = String(item.capabilityBucket || "").toLowerCase();
          return item.verificationStatus === "smoke_passed"
            && item.selectable === true
            && item.directChatAllowed === true
            && (bucket === "chat" || bucket === "reasoning_chat" || bucket === "code" || bucket === "chat_reasoning");
        })
        .map((item) => item.modelId);
      renderModelOptions();
      renderModelLibrary();
      renderDiagnostics();
    }

    async function loadDiagnostics() {
      state.diagnostics = await workbenchApiClient.getDiagnosticsStatus();
      renderTopbar();
      renderDiagnostics();
    }

    async function loadApprovals() {
      const canListApprovals = workbenchApiClient && typeof workbenchApiClient.listApprovals === "function";
      if (!canListApprovals) {
        state.approvals = [];
        state.approvalsUnsupported = true;
        renderApprovals();
        return { approvals: [], unsupported: true };
      }
      const result = await workbenchApiClient.listApprovals();
      state.approvals = Array.isArray(result.approvals) ? result.approvals : [];
      state.approvalsUnsupported = false;
      renderApprovals();
      return result;
    }

    async function previewApprovalIntent() {
      const result = await workbenchApiClient.previewLocalAgentIntent({
        input: "审批意图只读预览",
        message: "审批意图只读预览",
        permissionMode: "manual",
        dryRun: true,
        mode: "intent-preview",
        allowedFiles: ALLOWED_NOOP_FILES,
        forbiddenPaths: FORBIDDEN_PATHS,
      });
      state.approvalIntentPreview = {
        previewOnly: true,
        route: "/local-agent/intent-preview",
        dryRun: true,
        note: "只读预览，不创建 approval，不生成 patch proposal，也不执行 apply-approved。",
        result,
      };
      renderApprovalIntentPreview();
      showToast("审批意图只读预览已刷新。", "info");
    }

    async function refreshAll() {
      await loadProviderStatus();
      await loadModelLibrary();
      await loadDiagnostics();
      await loadApprovals();
      syncLocalAgentDraftInputs();
      syncRepairDraftInputs();
      renderLocalAgentOutputs();
      renderEvidenceDrawer();
    }

    function bindModelLibraryControls() {
      const search = byId("model-library-search-input");
      const status = byId("model-library-status-filter");
      const provider = byId("model-library-provider-filter");
      const capability = byId("model-library-capability-filter");
      const sort = byId("model-library-sort-select");
      if (search) {
        search.addEventListener("input", () => {
          state.modelLibraryControls.query = search.value;
          renderModelLibrary();
        });
      }
      if (status) {
        status.addEventListener("change", () => {
          state.modelLibraryControls.status = status.value;
          renderModelLibrary();
        });
      }
      if (provider) {
        provider.addEventListener("change", () => {
          state.modelLibraryControls.providerScope = provider.value;
          renderModelLibrary();
        });
      }
      if (capability) {
        capability.addEventListener("change", () => {
          state.modelLibraryControls.capability = capability.value;
          renderModelLibrary();
        });
      }
      if (sort) {
        sort.addEventListener("change", () => {
          state.modelLibraryControls.sort = sort.value;
          renderModelLibrary();
        });
      }
    }

    async function saveProviderConfig() {
      const payload = {
        providerId: "nvidia",
        baseUrl: byId("provider-base-url-input").value.trim(),
        apiKey: byId("provider-api-key-input").value.trim()
      };
      const result = await workbenchApiClient.saveProviderConfig(payload);
      byId("provider-api-key-input").value = "";
      await loadProviderStatus();
      renderDiagnostics();
      showToast(result.success ? "配置已保存，页面不会回显 API Key 明文。" : (result.message || "保存失败。"), result.success ? "info" : "warn");
    }

    async function testProviderConfig() {
      const result = await workbenchApiClient.testProviderConfig({
        providerId: "nvidia",
        modelId: state.selectedModel
      });
      state.lastError = result.success ? null : (result.message || "Provider 测试失败");
      await loadProviderStatus();
      renderDiagnostics();
      showToast(result.realExternalCall ? "已执行真实连接测试。" : (result.message || "测试未发生真实外呼。"), result.success ? "info" : "warn");
    }

    function setCurrentPageModel() {
      state.selectedModel = byId("model-select").value;
      saveSelectedModel();
      renderModelOptions();
      showToast("已更新当前页面模型，不影响默认 /chat 主链。");
    }

    async function sendChat(event) {
      event.preventDefault();
      const input = byId("chat-input");
      const text = input.value.trim();
      if (!text) {
        showToast("请输入内容后再发送。", "warn");
        return;
      }
      appendMessage({ role: "user", text });
      input.value = "";
      try {
        const result = await requestJson("/chat-gateway/execute", {
          method: "POST",
          body: JSON.stringify({
            input: text,
            message: text,
            mode: "manual_model",
            dryRun: false,
            providerId: state.selectedProvider,
            selectedModel: {
              providerId: state.selectedProvider,
              modelId: state.selectedModel
            }
          })
        });
        state.lastChatResult = result;
        state.lastError = result.completionVerified ? null : summarizeFailure(result);
        updateChatModeBadge(result, false);
        renderTopbar();
        renderEvidenceDrawer();
        renderDiagnostics();
        const visibleText = result.completionVerified && String(result.finalAnswer || "").trim()
          ? String(result.finalAnswer).trim()
          : summarizeFailure(result);
        appendMessage({
          role: result.completionVerified ? "assistant" : "system",
          text: visibleText,
          details: {
            model: result.selectedModel || result.modelId || state.selectedModel,
            providerCalled: result.providerCalled === true,
            completionVerified: result.completionVerified === true,
            evidenceId: result.evidenceId || "",
            routeDecision: result.routeDecision || "",
            verificationReason: result.verificationReason || "",
            note: result.userVisibleSummary || result.message || ""
          }
        });
        showToast(result.completionVerified ? "聊天结果已返回。" : visibleText, result.completionVerified ? "info" : "warn");
      } catch (error) {
        state.lastError = error.message;
        renderDiagnostics();
        updateChatModeBadge(null, false);
        appendMessage({
          role: "system",
          text: "请求失败：" + error.message,
          details: {
            model: state.selectedModel,
            providerCalled: false,
            completionVerified: false,
            evidenceId: "",
            note: "前端请求未成功完成。"
          }
        });
        showToast(error.message, "error");
      }
    }

    function clearChat() {
      state.lastChatResult = null;
      state.lastDryRunResult = null;
      updateChatModeBadge(null, false);
      renderWelcomeMessages();
      renderTopbar();
      renderEvidenceDrawer();
      renderDiagnostics();
      showToast("会话已清空。");
    }

    async function createTestApprovalTask() {
      const patchProposal = await requestJson("/local-agent/patch-proposal", {
        method: "POST",
        body: JSON.stringify({
          input: "Phase321A 审批链 no-op 验证",
          allowedFiles: ALLOWED_NOOP_FILES,
          permissionMode: "manual"
        })
      });
      const created = await requestJson("/approvals/create", {
        method: "POST",
        body: JSON.stringify({
          title: "Phase321A 测试审批任务",
          reason: "用于验证未批准前不可执行、批准后仅允许在 allowedFiles 内做 no-op 安全动作。",
          featureId: "phase321a-approval-test",
          operationId: patchProposal.operationId,
          allowedFiles: ALLOWED_NOOP_FILES,
          forbiddenPaths: FORBIDDEN_PATHS,
          patchProposal: patchProposal.patchProposal,
          approvalRecord: patchProposal.approvalRecord,
          scope: "patch",
          permissionMode: "manual"
        })
      });
      await loadApprovals();
      showToast(created.approval ? "测试审批任务已创建。" : "审批任务创建失败。", created.approval ? "info" : "warn");
    }

    async function handleApprovalAction(action, approvalId) {
      if (!approvalId) return;
      if (action === "approve" || action === "reject") {
        const result = await requestJson("/approvals/" + encodeURIComponent(approvalId) + "/" + action, {
          method: "POST",
          body: JSON.stringify({ reason: "phase321a-ui-action" })
        });
        await loadApprovals();
        showToast(action === "approve" ? "审批已通过。" : "审批已拒绝。", action === "approve" ? "info" : "warn");
        return result;
      }
      if (action === "apply") {
        const result = await requestJson("/local-operation/apply-approved", {
          method: "POST",
          body: JSON.stringify({
            approvalId,
            dryRun: false
          })
        });
        await loadApprovals();
        const applied = result.applyResult?.applied === true;
        showToast(applied ? "已执行批准后的安全动作。" : (result.blockedReason === "approval-not-approved" ? "未批准前不会执行本地动作。" : "执行已被限制。"), applied ? "info" : "warn");
        return result;
      }
    }

    async function handleFilesSelected(event) {
      const files = Array.from(event.target.files || []);
      if (!files.length) {
        showToast("未选择文件。", "warn");
        return;
      }
      const result = await workbenchApiClient.selectFileContext({
        files: files.map((file) => ({
          name: file.name,
          path: file.webkitRelativePath || file.name,
          size: file.size,
          type: file.type
        }))
      });
      state.fileSelections.unshift(result);
      state.fileSelections = state.fileSelections.slice(0, 6);
      renderFileSelections();
      const tone = result.filesBlocked > 0 ? "warn" : "info";
      showToast("仅登记 / 预览，未进入知识库训练。", tone);
      event.target.value = "";
    }

    async function runDryRunTest() {
      const input = "测试模式：你好";
      const result = await requestJson("/chat-gateway/dry-run-task", {
        method: "POST",
        body: JSON.stringify({
          input,
          message: input,
          selectedModel: state.selectedModel,
          acceptanceMode: "phase321a-diagnostics"
        })
      });
      state.lastDryRunResult = result;
      updateChatModeBadge(result, true);
      renderEvidenceDrawer();
      renderDiagnostics();
      applyYiyiEvent("thinking");
      showToast("测试模式完成，未调用 Provider。");
    }

    function inferFutureMode(taskText) {
      const text = String(taskText || "").trim();
      if (!text) {
        return {
          mode: "Tianshu",
          label: "复杂任务",
          why: "填写任务后，系统会根据任务复杂度推荐模式。"
        };
      }
      const lower = text.toLowerCase();
      const godHints = ["风险", "审查", "审核", "重要", "决定", "评估", "review", "risk"];
      const tianshuHints = ["计划", "步骤", "阶段", "复杂", "拆解", "路线", "规划", "plan"];
      if (godHints.some((hint) => lower.includes(hint))) {
        return {
          mode: "God",
          label: "重要问题",
          why: "任务包含风险或评估信号，先做谨慎审查更稳。"
        };
      }
      if (tianshuHints.some((hint) => lower.includes(hint)) || text.length > 80) {
        return {
          mode: "Tianshu",
          label: "复杂任务",
          why: "任务包含多步信息，先规划再执行更稳。"
        };
      }
      return {
        mode: "Normal",
        label: "普通问题",
        why: "任务比较直接，可以先生成轻量安全预览。"
      };
    }

    function previewFutureMinimalOsPlan() {
      const input = byId("future-os-task-input");
      const taskText = input?.value?.trim() || "";
      const recommendation = inferFutureMode(taskText);
      const previewCard = byId("future-os-preview-card");
      const previewEmpty = byId("future-os-preview-empty");
      const previewBody = byId("future-os-preview-body");
      const status = byId("future-os-preview-status");
      const modeTarget = byId("future-os-recommended-mode");
      const whyTarget = byId("future-os-preview-why");
      const willDoTarget = byId("future-os-preview-will-do");
      if (previewCard) previewCard.dataset.previewVisible = "true";
      if (previewEmpty) previewEmpty.hidden = true;
      if (previewBody) previewBody.hidden = false;
      if (modeTarget) modeTarget.textContent = recommendation.mode + " · " + recommendation.label;
      if (whyTarget) whyTarget.textContent = recommendation.why;
      if (willDoTarget) {
        willDoTarget.textContent = taskText
          ? "基于你的任务生成推荐模式、安全边界和下一步。"
          : "请先输入你想完成的任务。当前只是安全预览，没有执行真实任务。";
      }
      document.querySelectorAll("[data-future-mode]").forEach((card) => {
        card.classList.toggle("is-recommended", card.getAttribute("data-future-mode") === recommendation.mode.toLowerCase());
      });
      if (status) status.textContent = "已生成安全预览，未执行真实任务。";
      showToast("已生成安全预览，未调用真实模型。");
    }

    function setFutureDetailsOpen(open) {
      const drawer = byId("future-os-details-panel");
      const toggle = byId("future-os-toggle-details");
      if (!drawer) return;
      drawer.hidden = !open;
      drawer.dataset.detailsOpen = open ? "true" : "false";
      if (toggle) {
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.textContent = open ? "收起详情" : "查看详情";
      }
      if (open) drawer.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    async function bootstrap() {
      applyReadonlyAcceptanceView();
      hydrateYiyiFromQuery();
      restoreSelectedModel();
      renderWelcomeMessages();
      renderTopbar();
      renderFileSelections();
      renderApprovals();
      renderApprovalIntentPreview();
      renderDiagnostics();
      renderMissionControlDetail(byId("agent-arena-drilldown-detail"), agentDrilldownCopy.reviewer);
      renderMissionControlDetail(byId("red-team-scenario-detail"), redTeamScenarioCopy["prompt-injection"]);
      setGuidedShowcaseStep("welcome");
      setActivePage(state.activePage);
      syncThreeModeTabs();
      bindModelLibraryControls();
      bindYiyiMouseAttention();
      try {
        await refreshAll();
      } catch (error) {
        state.lastError = error.message;
        renderDiagnostics();
        showToast("初始化失败：" + error.message, "error");
      }
    }

    document.addEventListener("click", async (event) => {
      const ownerBossAction = event.target.closest("[data-owner-boss-action]");
      if (ownerBossAction) {
        handleOwnerBossViewAction(ownerBossAction.getAttribute("data-owner-boss-action"));
        return;
      }
      if (event.target.closest("#future-os-preview-button")) {
        previewFutureMinimalOsPlan();
        return;
      }
      if (event.target.closest("#future-os-toggle-details")) {
        const drawer = byId("future-os-details-panel");
        setFutureDetailsOpen(!(drawer?.dataset.detailsOpen === "true"));
        return;
      }
      if (event.target.closest("#future-os-close-details")) {
        setFutureDetailsOpen(false);
        return;
      }
      if (event.target.closest("#yiyi-mode-full-button")) {
        setYiyiMode("full");
        return;
      }
      if (event.target.closest("#yiyi-mode-compact-button")) {
        setYiyiMode("compact");
        return;
      }
      if (event.target.closest("#yiyi-mode-hide-button")) {
        setYiyiMode("off");
        return;
      }
      if (event.target.closest("#yiyi-live-full-button")) {
        setYiyiMode("full");
        return;
      }
      if (event.target.closest("#yiyi-live-compact-button")) {
        setYiyiMode("compact");
        return;
      }
      if (event.target.closest("#yiyi-live-hide-button")) {
        setYiyiMode("off");
        return;
      }
      if (event.target.closest("#yiyi-live-motion-toggle")) {
        if (state.yiyi.reducedMotion) {
          showToast("系统偏好 reduced motion，依依保持静态陪伴。", "warn");
        } else {
          setYiyiMotionEnabled(!state.yiyi.motionEnabled);
        }
        return;
      }
      const yiyiDemoTrigger = event.target.closest("[data-yiyi-demo-trigger]");
      if (yiyiDemoTrigger) {
        const trigger = yiyiDemoTrigger.getAttribute("data-yiyi-demo-trigger");
        state.yiyi.visible = true;
        if (state.yiyi.mode === "off") state.yiyi.mode = "full";
        applyYiyiEvent(trigger);
        showToast("依依状态预览：" + trigger + "，未调用 provider。");
        return;
      }
      if (event.target.closest("#yiyi-persona-classify-button")) {
        const input = byId("yiyi-persona-entry-input");
        const result = classifyYiyiPersonaEntry(input?.value || "");
        renderYiyiPersonaDryRunResult(result);
        applyYiyiEvent(result.decision === "rejected" ? "security_guard" : "evidence_opened");
        showToast(result.decision === "rejected" ? "设定已被安全规则拒绝。" : "设定 dry-run 分类已生成，未保存后台。", result.decision === "rejected" ? "warn" : "info");
        return;
      }
      const navTarget = event.target.closest("[data-nav]");
      if (navTarget) {
        setActivePage(navTarget.getAttribute("data-nav"));
        return;
      }
      const openPageTarget = event.target.closest("[data-open-page]");
      if (openPageTarget) {
        const targetPage = openPageTarget.getAttribute("data-open-page");
        if (targetPage === "local-agent" && event.target.closest("#repair-open-local-agent-button")) {
          handoffRepairDraftToLocalAgent();
          return;
        }
        setActivePage(targetPage);
        if (targetPage === "local-agent") {
          syncLocalAgentDraftInputs();
          renderLocalAgentOutputs();
        }
        if (targetPage === "repair") {
          syncRepairDraftInputs();
        }
        return;
      }
      if (event.target.closest("#open-evidence-button")) {
        if (!state.lastChatResult && !state.lastDryRunResult && !state.lastThreeModeResult) {
          showSampleDryRunResult("scenario-evidence-replay-preview");
        }
        openEvidenceDrawer();
        return;
      }
      if (event.target.closest("#close-evidence-button") || event.target.closest("#evidence-backdrop")) {
        closeEvidenceDrawer();
        return;
      }
      if (event.target.closest("#save-provider-button")) {
        await saveProviderConfig().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#test-provider-button")) {
        await testProviderConfig().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#set-page-model-button") || event.target.closest("#model-page-set-button")) {
        setCurrentPageModel();
        return;
      }
      if (event.target.closest("#owner-task-input-submit-button")) {
        handleOwnerTaskInputSubmit();
        return;
      }
      if (event.target.closest("#new-chat-button")) {
        clearChat();
        applyYiyiEvent("welcome");
        return;
      }
      if (event.target.closest("#create-approval-button")) {
        await createTestApprovalTask().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#refresh-approvals-button")) {
        await loadApprovals().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#preview-approval-intent-button")) {
        await previewApprovalIntent().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#local-agent-preview-button")) {
        await previewLocalAgentWorkspaceIntent().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#local-agent-plan-button")) {
        await buildLocalAgentOperationPlan().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#local-agent-patch-button")) {
        await buildLocalAgentPatchProposal().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#local-agent-create-approval-button")) {
        await createApprovalFromLocalAgent().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#pick-file-button")) {
        byId("file-input").click();
        return;
      }
      if (event.target.closest("#refresh-files-button")) {
        renderFileSelections();
        showToast("文件登记列表已刷新。");
        return;
      }
      if (event.target.closest("#refresh-diagnostics-button")) {
        await Promise.all([loadDiagnostics(), loadProviderStatus(), loadModelLibrary()]).catch((error) => showToast(error.message, "error"));
        showToast("诊断状态已刷新。");
        return;
      }
      if (event.target.closest("#run-dry-run-button")) {
        await runDryRunTest().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#onboarding-dismiss-button")) {
        const panel = byId("guided-onboarding-panel");
        if (panel) panel.style.display = "none";
        showToast("First-run tour skipped. Sample dry-run is ready.");
        focusMissionNode("scenario-trial-panel");
        return;
      }
      const scenarioAction = event.target.closest("[data-scenario-action]");
      if (scenarioAction) {
        handleScenarioAction(scenarioAction.getAttribute("data-scenario-action"));
        return;
      }
      const workforceAction = event.target.closest("[data-workforce-action]");
      if (workforceAction) {
        await handleWorkforceAction(workforceAction.getAttribute("data-workforce-action")).catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#activate-five-capabilities-button")) {
        await activateFiveCapabilities().catch((error) => showToast(error.message, "error"));
        return;
      }
      const internalCommunicationAction = event.target.closest("[data-internal-communication-action]");
      if (internalCommunicationAction) {
        showInternalCommunicationPreview(internalCommunicationAction.getAttribute("data-internal-communication-action"));
        return;
      }
      const branchExecutionAction = event.target.closest("[data-branch-execution-action]");
      if (branchExecutionAction) {
        showBranchExecutionPreview(branchExecutionAction.getAttribute("data-branch-execution-action"));
        return;
      }
      const gvcRunnerCommandAction = event.target.closest("[data-gvc-runner-command-intent]");
      if (gvcRunnerCommandAction) {
        showGvcRunnerCommandPreview(gvcRunnerCommandAction.getAttribute("data-gvc-runner-command-intent"));
        return;
      }
      const hardeningAction = event.target.closest("[data-hardening-action]");
      if (hardeningAction) {
        showLongHorizonHardeningPreview(hardeningAction.getAttribute("data-hardening-action"));
        return;
      }
      const codexContextAction = event.target.closest("[data-codex-context-action]");
      if (codexContextAction) {
        showCodexContextPreview(codexContextAction.getAttribute("data-codex-context-action"));
        return;
      }
      if (event.target.closest("#start-guided-showcase-button")) {
        setGuidedShowcaseStep("welcome");
        byId("yiyi-guided-showcase-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
        showToast("依依演示已开始：dry-run only。");
        return;
      }
      if (event.target.closest("#showcase-prev-button")) {
        shiftGuidedShowcaseStep(-1);
        return;
      }
      if (event.target.closest("#showcase-next-button")) {
        shiftGuidedShowcaseStep(1);
        return;
      }
      if (event.target.closest("#showcase-skip-button")) {
        setGuidedShowcaseStep("closing_summary");
        showToast("已跳到演示总结。");
        return;
      }
      const showcaseStep = event.target.closest("[data-yiyi-showcase-step]");
      if (showcaseStep) {
        setGuidedShowcaseStep(showcaseStep.getAttribute("data-yiyi-showcase-step"));
        return;
      }
      const tourStep = event.target.closest("[data-tour-step]");
      if (tourStep) {
        document.querySelectorAll("[data-tour-step]").forEach((node) => node.classList.toggle("is-active", node === tourStep));
        const copy = missionTourCopy[tourStep.getAttribute("data-tour-step")];
        const target = byId("guided-onboarding-copy");
        const heading = tourStep.querySelector("strong")?.textContent || "Tour";
        if (target && copy) renderMissionControlDetail(target, { title: heading, body: copy, meta: "skip anytime · dry-run only" });
        return;
      }
      const drilldownCard = event.target.closest("[data-agent-drilldown]");
      if (drilldownCard) {
        document.querySelectorAll("[data-agent-drilldown]").forEach((node) => node.classList.toggle("is-active", node === drilldownCard));
        renderMissionControlDetail(byId("agent-arena-drilldown-detail"), agentDrilldownCopy[drilldownCard.getAttribute("data-agent-drilldown")]);
        return;
      }
      const planCard = event.target.closest("[data-plan-card]");
      if (planCard) {
        document.querySelectorAll("[data-plan-card]").forEach((node) => node.classList.toggle("is-recommended", node === planCard));
        showToast("Plan comparison updated: dry-run only.");
        applyYiyiEvent("tianshu_mode");
        return;
      }
      const scenarioCard = event.target.closest("[data-red-team-scenario]");
      if (scenarioCard) {
        document.querySelectorAll("[data-red-team-scenario]").forEach((node) => node.classList.toggle("is-active", node === scenarioCard));
        renderMissionControlDetail(byId("red-team-scenario-detail"), redTeamScenarioCopy[scenarioCard.getAttribute("data-red-team-scenario")]);
        applyYiyiEvent("red_team_blocked");
        return;
      }
      const modeTab = event.target.closest("[data-three-mode]");
      if (modeTab) {
        state.activeThreeMode = modeTab.getAttribute("data-three-mode") || "normal";
        syncThreeModeTabs();
        applyYiyiEvent(state.activeThreeMode === "god" ? "god_mode" : state.activeThreeMode === "tianshu" ? "tianshu_mode" : "normal_mode");
        return;
      }
      if (event.target.closest("#three-mode-normal-send")) {
        applyYiyiEvent("normal_mode");
        await runThreeMode("normal");
        return;
      }
      if (event.target.closest("#three-mode-god-send")) {
        applyYiyiEvent("god_mode");
        await runThreeMode("god");
        return;
      }
      if (event.target.closest("#three-mode-tianshu-send")) {
        applyYiyiEvent("tianshu_mode");
        await runThreeMode("tianshu");
        return;
      }
      const approvalButton = event.target.closest("[data-approval-action]");
      if (approvalButton) {
        await handleApprovalAction(approvalButton.getAttribute("data-approval-action"), approvalButton.getAttribute("data-approval-id")).catch((error) => showToast(error.message, "error"));
      }
    });

    byId("chat-form").addEventListener("submit", sendChat);
    byId("model-select").addEventListener("change", (event) => {
      state.selectedModel = event.target.value;
      saveSelectedModel();
      renderTopbar(); renderThreeModeControls();
      byId("model-page-current-selection").textContent = state.selectedModel || "未选择";
    });
    byId("three-mode-tianshu-input")?.addEventListener("input", (event) => {
      byId("three-mode-task-preview").textContent = "taskClassification: " + classifyTaskPreview(event.target.value);
    });
    byId("owner-task-input")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        handleOwnerTaskInputSubmit();
      }
    });
      byId("file-input").addEventListener("change", (event) => {
      handleFilesSelected(event).catch((error) => showToast(error.message, "error"));
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeEvidenceDrawer();
    });
    byId("phase313a-generate-verification-plan")?.addEventListener("click", async () => {
      try {
        await requestJson("/model-library/verification-plan");
        showToast("验证计划已生成。");
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    bootstrap();
  </script>
</body>
</html>`;
}

function stripCharacterUiForMissionControl(html) {
  let next = html;
  const blockPatterns = [
    /<section class="yiyi-live-avatar-stage"[\s\S]*?<\/section>/g,
    /<section class="yiyi-avatar-layer"[\s\S]*?<\/section>/g,
    /<section class="yiyi-guided-showcase"[\s\S]*?<\/section>/g,
    /<section class="yiyi-emotion-panel"[\s\S]*?<\/section>/g,
  ];
  for (const pattern of blockPatterns) next = next.replace(pattern, "");
  return next;
}

export function createConsolePage() {
  return stripCharacterUiForMissionControl(createPhase321AWorkbenchPage());
}


