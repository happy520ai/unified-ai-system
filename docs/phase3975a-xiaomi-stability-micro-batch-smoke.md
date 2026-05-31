# Phase3975A: Xiaomi Stability Micro-Batch Smoke

## 目标
在 one-shot 成功后，准备小米小批量稳定性验证。默认只生成计划和授权门。

## 执行模式
- 默认：approval-gated
- 只有 owner 再次授权后，才允许最多 3 次真实调用

## Approval Input 模板
位于 `docs/provider-smoke/xiaomi-stability-micro-batch-approval.input.json`

## 成功标准
- `successThreshold`: 3
- `maxAllowedFailures`: 0
- `maxAllowedP95LatencyMs`: 30000

## 注意
即使 3 次都成功，也只能写：
- `xiaomiMicroBatchSmokePassed=true`

不得写：
- `providerStabilityClaimed=true`
- `productionReadyClaimed=true`

## 安全边界
- 不读取 raw secret
- 不打印 key/token/header
- 不 deploy
