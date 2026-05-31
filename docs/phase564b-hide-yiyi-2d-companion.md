# Phase564B Hide Yiyi 2D Companion

## 阶段目标

在 Phase564A 已隐藏 3D Avatar Stage 的基础上，继续隐藏 Workbench / Mission Control 主界面中的 2D 人物陪伴入口，让产品 UI 回到人物模块引入之前的功能型 AI Gateway 形态。

## 本阶段做了什么

1. 从 Mission Control 主界面移除了 2D companion 与 guided showcase 的可见挂载入口。
2. 保留了 Normal / God / Tianshu、Security Shield、Evidence Replay、Provider / CredentialRef 等核心产品模块。
3. 更新角色 manifest 与 3D generation config，将 3D / 2D / character 可见性 feature flag 全部默认关闭。
4. 新增 Phase564B verifier，验证主 UI 已不再展示人物模块，同时功能型产品 UI 仍然存在。

## 为什么隐藏 2D 人物模块

- 当前产品重点回到 AI Gateway 的真实功能链路，而不是角色展示。
- 粗糙的 companion/avatar/persona 视觉会降低产品完成度观感。
- 角色相关历史代码先保留，避免未来重新开启时丢失上下文。
- 在正式视觉资产、产品定位、人工验收未完成前，不再默认向用户展示人物模块。

## 当前产品形态

- 主界面回到纯产品功能布局。
- 不再显示依依/Yiyi/头像/概念图/fallback 图/人物状态文案。
- 不再显示 emotion panel、人物陪伴入口、3D not connected、2D fallback 等开发态内容。
- 角色相关代码仅保留为 disabled / archived / experimental 能力，不作为当前产品主界面的一部分。

## Feature Flags / Manifest 默认值

- `YIYI_3D_AVATAR_ENABLED=false`
- `YIYI_2D_COMPANION_ENABLED=false`
- `YIYI_CHARACTER_UI_VISIBLE=false`
- `avatar3DVisible=false`
- `companion2DVisible=false`
- `characterModuleVisible=false`
- `fallbackMode="none"`
- `real3DModelLoaded=false`
- `realVrmRuntimeLoaded=false`
- `pseudo3DLiveMotion=false`

## 安全边界

- `providerCallsMade=false`
- `nonNvidiaProviderCallsMade=false`
- `secretValueExposed=false`
- `rawSecretAccessed=false`
- `deployExecuted=false`
- `releaseExecuted=false`
- `tagCreated=false`
- `artifactUploaded=false`
- `rawPhotoStored=false`
- `faceRecognitionPerformed=false`
- `workspaceCleanClaimed=false`

## 后续恢复条件

只有在以下条件同时满足后，才应考虑重新开放人物模块：

1. 有正式产品决策批准人物模块回归。
2. 有稳定的正式视觉资产，而不是开发期 fallback。
3. 完成人工 UI 验收。
4. 明确开启对应 feature flag。

在那之前，Workbench 主界面保持无人物模块的功能型产品布局。
