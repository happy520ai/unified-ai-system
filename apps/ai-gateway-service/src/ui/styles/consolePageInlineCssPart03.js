export const consolePageInlineCssPart03 = `      justify-content: center;
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
`;
