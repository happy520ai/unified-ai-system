# Phase1963A 桌面一键启动更新

## 阶段目标

更新桌面 `AI Gateway Workbench.lnk` 和启动脚本，让一键启动直接进入五大能力真实可用面板。

## 已实现能力

- 快捷方式重新生成到桌面。
- 启动 URL 指向 `/ui#five-capability-activation-panel`。
- 启动脚本在打开 UI 前检查 `/real-capabilities/status`。
- 快捷方式描述更新为 `Open AI Gateway Workbench Owner OS - Five Real Capabilities`。

## 明确边界

- 不部署。
- 不发布。
- 不 commit。
- 不 push。
- 不读取密钥。
- 不调用 Provider。
- 不声称 workspace clean。

## 验证命令

```powershell
cmd /c pnpm run verify:phase1963a-desktop-shortcut-five-capability-launcher
```
