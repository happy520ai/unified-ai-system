/**
 * v5 SystemFirstLine — 系统第一句话组件（服务端渲染）
 * 状态融入语气，无独立呼吸灯/问候语。
 * 客户端 JS 会根据 resolveTone() 更新 #v5-first-text。
 */

export function renderSystemFirstLine() {
  return `
    <div class="v5-first-line" id="v5-first-line">
      <p class="v5-first-text" id="v5-first-text">正在加载系统状态…</p>
    </div>`;
}
