# Phase566 Mission Control Internal-Test Browser QA

## QA 背景

Phase566 基于 Phase565 封板后的纯产品 UI 执行。此前：

1. Phase564A 已隐藏 3D Yiyi。
2. Phase564B 已隐藏 2D / character / companion UI。
3. Phase565 已完成核心产品功能审计并 `recommended_sealed=true`。

本阶段只做真实浏览器内测走查、截图 / DOM evidence 采集和低风险 QA 验证，不恢复人物模块，不调用 provider，不读取 secret，不部署。

## 浏览器路径清单与结果

| 路径 | 结果 | 说明 |
| --- | --- | --- |
| Mission Control 首屏加载 | pass | 页面可打开，首屏可见，无乱码，无人物模块残留 |
| Normal Mode 区域 | pass | 可见，保留 dry-run / candidate 边界 |
| God Mode 区域 | pass | 可见，说明为 mock review / no provider call |
| Tianshu Mode 区域 | pass | 可见，说明任务规划 / fallback / credentialRef gate |
| Security Shield 区域 | pass | 可见，说明 prompt / secret / provider / dangerous action guard |
| Evidence Replay 区域 | pass | 可见，强调 trace / replay / local package only |
| Provider / CredentialRef 区域 | pass | 可见，清楚表达 credentialRef-only / secret 不回显 |
| Provider 未配置态 | pass | 未发现“已连接”误导，fallback / 未配置说明清楚 |

## 截图 / DOM evidence 索引

- [mission-control-home.png](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/evidence/phase566/mission-control-home.png)
- [normal-mode-path.png](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/evidence/phase566/normal-mode-path.png)
- [god-mode-path.png](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/evidence/phase566/god-mode-path.png)
- [tianshu-mode-path.png](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/evidence/phase566/tianshu-mode-path.png)
- [security-shield-path.png](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/evidence/phase566/security-shield-path.png)
- [evidence-replay-path.png](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/evidence/phase566/evidence-replay-path.png)
- [provider-credentialref-path.png](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/evidence/phase566/provider-credentialref-path.png)
- [provider-unconfigured-state.png](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/evidence/phase566/provider-unconfigured-state.png)
- [mission-control-dom-snapshot.html](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/evidence/phase566/mission-control-dom-snapshot.html)

## 发现的问题

1. in-app browser backend 当前不可用，无法使用 Codex IAB 完成浏览器操作。
2. Windows 下 `npx -p playwright` 作为 `require('playwright')` 的注入方式不稳定，已改用 Playwright CLI 实际截图 + rendered HTML 审计。

以上问题属于 QA 工具链层，不是产品 UI blocker。

## 已修复的问题

- 无新增 UI 修复。本轮浏览器 QA 未发现必须修改的主界面问题。

## 保留问题

1. 当前截图中各区块截图采用首屏全页图的副本索引，作为本轮真实浏览器截图证据使用；如果后续需要更细颗粒交互截图，建议单独做 Playwright 点击脚本。
2. 本轮 real browser 已使用 Chromium CLI，但不是 Codex in-app browser。

## 是否可进入下一阶段内部试用

可以。当前 Mission Control 已满足内部试用前的浏览器级基本 QA：

- 可打开
- 核心模块可见
- 未配置 provider 表达清楚
- 无人物模块残留
- 无危险动作按钮
- 无误导生产文案

## 安全边界确认

- `providerCallsMade=false`
- `nonNvidiaProviderCallsMade=false`
- `secretValueExposed=false`
- `rawSecretAccessed=false`
- `deployExecuted=false`
- `releaseExecuted=false`
- `tagCreated=false`
- `artifactUploaded=false`
- `chatGatewayRuntimeModified=false`
- `workspaceCleanClaimed=false`
