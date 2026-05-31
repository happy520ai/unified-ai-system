# Phase1962A 五大能力真实可用激活

## 阶段目标

把用户点名的五条干运行链路升级为可验证的真实可用入口，但仍排除生产部署和公开发布：

- Workforce 计划生成
- Three-Mode 三模式
- Taiji/Beidou 引擎
- GVC 自主运行
- Codex 集成

## 已实现能力

- `GET /real-capabilities/status`：返回五大能力当前就绪状态。
- `POST /real-capabilities/activate-five`：执行一次五大能力激活闭环。
- Owner OS 首屏新增“五大能力已进入真实可用通道”面板。
- UI 按钮“一键激活五大能力”调用真实激活 route 并回填五条状态。
- Evidence 写入 Phase1962A 目录。

## 五条链路定义

| 能力 | 当前真实可用定义 |
|------|------------------|
| Workforce 计划生成 | 本地真实执行：生成计划、保存计划、创建任务队列、写证据 |
| Three-Mode 三模式 | 真实 Provider 执行器就绪：`POST /three-mode/execute` 保持 selectable gate 和 NVIDIA unified client 调用能力，本阶段不额外消耗 Provider |
| Taiji/Beidou 引擎 | 本地真实沙箱运行：能力生成、准入、租约、沙箱执行、证据闭环 |
| GVC 自主运行 | 受控低风险真实写入：只写 Phase1962A evidence 文件，可回滚，不碰业务主链 |
| Codex 集成 | 本机真实 CLI 桥接检测：检测 `codex --version`，不读 auth.json，不改 Codex 配置 |

## 明确边界

- 不是生产部署。
- 不声称公开发布就绪。
- 不读取、不打印、不暴露 API Key、`.env`、secret、token、auth.json 或 raw CredentialRef。
- 不调用 paid API、MiMo、OpenAI、Claude 或 OpenRouter。
- 本阶段不主动发起 Provider 网络请求，不消耗模型额度。
- 不修改默认 `/chat`。
- 不修改 `/chat-gateway/execute`。
- 不修改 Codex config/base_url。
- 不部署、不发布、不打 tag、不上传 artifact。
- 不 commit、不 push。
- 不修改 `legacy/`。
- 不创建 `PROJECT_CONTEXT.md`。
- 不声称 workspace clean。

## Evidence

- `apps/ai-gateway-service/evidence/phase1962a/five-real-capability-activation-result.json`
- `apps/ai-gateway-service/evidence/phase1962a/five-real-capability-activation-result.md`
- `apps/ai-gateway-service/evidence/phase1962a/five-real-capability-activation-verification-result.json`
- `apps/ai-gateway-service/evidence/phase1962a/taiji-beidou-local-runtime-result.json`
- `apps/ai-gateway-service/evidence/phase1962a/gvc-real-local-*.md`

## 验证命令

```powershell
cmd /c pnpm run verify:phase1962a-five-real-capability-activation
```

## Sealed 判定

当 verifier 全部通过时，本阶段可判定为“五大能力在本地非生产范围内真实可用”。该结论不覆盖生产部署、公开发布、多租户 SaaS、SLA、真实安全审计或对所有 Provider 的稳定性承诺。
