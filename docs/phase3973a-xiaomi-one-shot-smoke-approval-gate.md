# Phase3973A: Xiaomi One-Shot Smoke Approval Gate

## 目标
生成小米真实 Provider 单次 smoke 的 owner 授权门。本阶段只生成 approval input，不执行真实调用。

## Approval Input 模板
位于 `docs/provider-smoke/xiaomi-one-shot-smoke-approval.input.json`

```json
{
  "decision": "rejected",
  "provider": "mimo",
  "model": "",
  "maxRequests": 1,
  "providerCallAllowed": false,
  "credentialRefOnly": true,
  "rawSecretReadAllowed": false,
  "rawSecretPrintAllowed": false,
  "authorizationHeaderPrintAllowed": false,
  "deployAllowed": false,
  "chatRouteChangeAllowed": false,
  "chatGatewayExecuteChangeAllowed": false,
  "prompt": "请用一句中文回复：小米模型真实 smoke 测试成功。"
}
```

## 执行规则
- `decision` 不是 `approved_execute_xiaomi_one_shot_real_provider_smoke` => 不允许执行
- `providerCallAllowed !== true` => 不允许执行
- `maxRequests !== 1` => 不允许执行
- `credentialRefOnly` 必须为 `true`
- `rawSecretReadAllowed` 必须为 `false`
- `rawSecretPrintAllowed` 必须为 `false`
- `deployAllowed` 必须为 `false`

## 当前状态
- Approval Gate 已准备
- Decision: `rejected`（等待 owner 授权）
- 执行允许：false

## 安全边界
- 不执行真实调用
- 不读取 secret
- 不 deploy
