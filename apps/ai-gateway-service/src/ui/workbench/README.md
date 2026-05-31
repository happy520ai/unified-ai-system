# Workbench UI Module Staging

本目录用于 Phase323D 起的原生 ESM 模块化清理。

当前阶段边界：

- 不改变 `/ui` 入口
- 不改变默认 5 个模块
- 不改变 Chat 请求体
- 不引入 React / Vue / Angular
- 不引入构建链

Phase323CDE-1 仅新增低风险骨架模块，不接入生产 UI。

## Phase323D-8 Bridge Stability Boundary

当前已接入 apiClient bridge 的页面：

- **diagnostics**：`getDiagnosticsStatus()` -> `GET /workbench/diagnostics/status`
- **providerConfig**：`getProviderConfigStatus()`, `saveProviderConfig()`, `testProviderConfig()` -> `GET/POST /provider-config/status|save|test`
- **fileContext**：`selectFileContext()` -> `POST /file-context/select`

已接入 apiClient bridge 的页面：

- **Chat send**：已接入 `/chat-gateway/execute` 真实主链，默认使用 OpenRouter Provider。
- **Approvals**：已接入审批链，支持多步路由和 apply-approved 文件写入。

安全边界：

- fileContext 已接入真实文件读取
- 支持 OpenRouter 免费模型，不涉及付费 API
- no secret / token / .env path or name exposure

## Phase324D Model Library UI Status Boundary

- The Workbench model library panel may show verification status, capability,
  evidenceId, failure reason, and non-selectable reason.
- UI display does not change the selectable gate; selectable remains decided by
  Phase313A verification metadata and model-library gate rules.
- Failed, unverified, deprecated, blocked, special-payload, and non-chat models
  remain non-selectable for ordinary Chat.
- Current real provider scope includes OpenRouter and NVIDIA. OpenRouter 免费模型已可真实调用。

## Phase324D-2F Filter Sort Search Boundary

- Model library filtering, sorting, and searching are local UI display features.
- Model selection strategy 已接入真实路由，可改变 real routing、real default models、selectedModel storage、Chat request body。
- Failed and unverified models remain not selectable and must not enter the
  ordinary Chat dropdown.
- Multi-provider slots 已开放，OpenRouter 免费模型可真实调用。
