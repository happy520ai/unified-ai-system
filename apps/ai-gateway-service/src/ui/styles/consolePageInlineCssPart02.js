export const consolePageInlineCssPart02 = `      left: 18%;
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
`;
