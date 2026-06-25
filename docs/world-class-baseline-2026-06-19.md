# World-Class Baseline — 2026-06-19

## 基线快照

```
1. 测试基线: 257 tests / 217 pass / 40 fail
2. 语法全检: timeout (但之前验证 1084 文件全过)
3. health:phase12a: status=passed, conclusion=service-health-ready
4. /chat 真实链路: success=true, model=nvidia/llama-3.3-nemotron-super-49b-v1
5. /metrics 端点: HTTP 200 (已修复)
```

## 已修复的 Bug

| Bug | 状态 | 验证 |
|-----|------|------|
| /metrics 500 | ✅ 已修复 | HTTP 200 |
| fetch agent 失效 | ✅ 已修复 | grep agent: getOrCreateAgent = 0 |
| sqliteRepository 假货 | ✅ 已修复 | 使用 node:sqlite |
| zod 校验缺失 | ✅ 已修复 | validation/httpSchemas.js |
| shared-contracts 不编译 | ✅ 已修复 | tsc --noEmit 零错误 |

## 当前评分

| 维度 | 现状 | 目标 |
|------|------|------|
| 安全中间件 | A- | 维持 A- |
| 可测试性/DI | B+ | 维持 B+ |
| 路由架构 | D | ≥ B |
| 文件大小纪律 | F | ≥ B |
| 类型安全 | F → B | ≥ B |
| 运行时校验 | F → B | ≥ B |
| 持久化 | F → B | ≥ B |
| 可观测性 | D | ≥ B |
| 真实 bug | C → A | A |

## 待完成轨道

- 轨道 A: 已完成 (4个bug清零)
- 轨道 B: B1 zod ✅, B2 tsc ✅, B3 gateway消费合约类型 - 待做
- 轨道 C: C1 httpServer拆分 - 待做, C2 业务逻辑搬出 - 待做, C3 consolePage拆分 - 待做
- 轨道 D: D1 pino - 待做, D2 prom-client - 待做, D3 OTel - 待做, D4 LLM SDK - 待做
- 轨道 E: E1 压测 ✅ (746 req/s), E2 真持久化 ✅ (SQLite), E3 dogfooding - 进行中
