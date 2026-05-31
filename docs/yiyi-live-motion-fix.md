# Yiyi Live Motion Fix

## 目标

本次修复只处理 UI 体验问题：让依依从 Mission Control 内部的静态卡片形态，升级为页面空间中可见的 pseudo-3D live avatar layer。

## 本次实现

- 保留原有 `YiyiAvatarLayer` 信息面板、Emotion Panel、Brain Panel、Character Card。
- 新增 `YiyiLiveAvatarStage` 作为独立 live stage。
- live stage 采用 pseudo-3D DOM/CSS/SVG 风格，不声称真实 glTF/GLB 已加载。
- 默认进入页面即显示 `Full + Motion on`。
- 鼠标移动时进入 `mouse_attention`。
- 支持 `security_guard / red_team_blocked / god_mode_excited / tianshu_planning / evidence_explaining` 状态反应。
- 增加 `Full / Compact / Hide / Motion on-off` 控制。
- 增加安全 demo triggers：
  - Welcome
  - Mouse
  - Preview God reaction
  - Preview Tianshu path
  - Preview Guard pose
  - Preview Blocked shield
  - Preview Evidence guide

## 诚实边界

- real3DModelLoaded=false
- pseudo3DLiveMotion=true
- gltfIntegrationReserved=true

## 安全边界

- providerCallsMade=false
- secretValueExposed=false
- deployExecuted=false
- workspaceCleanClaimed=false

## 验收关注点

- 依依 live avatar 肉眼可见
- 不只是静态卡片
- idle motion 可见
- mouse attention 可见
- guard / blocked / god / tianshu / evidence 状态可触发
- Full / Compact / Hide 可用
- reduced motion fallback 存在
- 不遮挡 Mission Control 主操作

## 证据

- `apps/ai-gateway-service/evidence/yiyi-live-motion/yiyi-live-motion-result.json`
- `apps/ai-gateway-service/evidence/yiyi-live-motion/screenshots/*.png`
