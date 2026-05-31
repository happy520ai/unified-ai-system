# Phase565 Core Mission Control Product Function Audit

## 审计背景

Phase565 在 Phase564A / Phase564B 之后执行。当前 Workbench / Mission Control 已隐藏 3D、2D、character、companion 相关可见入口，本阶段只审计纯产品功能表达，并做低风险文案修复。

## 主功能区列表

| 功能区 | 产品目的 | 当前可见状态 | Blocker | 人物模块残留 | 开发态文案 | 死按钮风险 | 最小修复建议 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mission Radar | 说明 AI Gateway 的任务指挥台定位、运行边界和 evidence 状态 | 可见 | none | 未发现 | 已修复乱码 | 未发现 | 保持 dry-run / no-provider-call / no-deploy 边界 |
| First-run Tour | 帮用户理解 Mission / Modes / Shield / Evidence | 可见 | none | 未发现 | 已修复乱码 | Skip 可隐藏 | 保持简短引导 |
| Normal Mode | 直接对话入口，仅允许 verified selectable chat model | 可见 | none | 未发现 | 已修复乱码 | 未发现 | 保持 providerCalled 边界 |
| God Arena | 多视角 review / critic / risk scout / supervisor 预览 | 可见 | none | 未发现 | 已修复乱码 | 按钮为 mock drill-down | 明确 mock / no provider call |
| Tianshu Flight | 任务规划、能力匹配、fallback reason 和下一步建议 | 可见 | none | 未发现 | 已修复乱码 | 计划卡仅切换展示 | 保持 credentialRef gate |
| Security Shield | 表达 prompt / secret / provider / dangerous action 等阻断价值 | 可见 | none | 未发现 | 未发现 | 未发现 | 保持 guarded 语义 |
| Red Team Playground | 演示风险识别和阻断，不执行真实危险动作 | 可见 | none | 未发现 | 未发现 | dry-run scenario 按钮 | 保持 dry-run detection only |
| Evidence Timeline | 展示 trace / replay / local export 价值 | 可见 | none | 未发现 | 未发现 | 未发现 | 保持 local package only |
| Provider / CredentialRef | 说明用户自有 Key、credentialRef-only、secret 不回显、未配置不调用 | 可见 | none | 未发现 | 已修复乱码 | 未发现 | 保持不显示 secret |

## 人物模块残留审计

主界面可见 HTML 中未发现：

- `Yiyi`
- `依依`
- `companion`
- `avatar`
- `character`
- `persona visual`
- `2D fallback`
- `3D not connected`
- `pseudo-3D`
- `snowman`
- `blob placeholder`

说明：历史人物相关源码仍保留为 disabled / archived / experimental，不作为当前产品可见入口。

## 危险动作与误导性表达审计

未发现危险按钮文案：

- `Deploy Now`
- `Release Now`
- `Push to Production`
- `Call Provider Now`
- `Save Secret`
- `Upload Secret`
- `Real Billing`
- `Generate Invoice`

未发现误导性生产完成文案：

- `production GA enabled`
- `real provider connected`
- `billing enabled`
- `invoice generated`
- `deployment completed`

## 已执行最小修复

1. 修复 Mission Control 首屏乱码文案。
2. 修复 Normal / God / Tianshu 三模式 copy 乱码。
3. 修复 Provider / CredentialRef copy 乱码。
4. 保留 no-provider-call、dry-run、no-deploy、credentialRef-only 说明。
5. 未改 runtime、provider、selectable gate、Chat Gateway 主链。

## 审计结论

Mission Control 已回到功能型 AI Gateway 产品界面。三模式、安全盾、证据回放、Provider / CredentialRef 边界均可见；人物模块没有恢复；当前可支撑下一步进入真实内测准备前的产品功能审查。
