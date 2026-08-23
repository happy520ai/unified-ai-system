# Forge Vision Quickstart(设想族群点亮指南)

业主勾选"除 E 外全部接入"后,forge-core / taiji / workforce / three-mode 的
核心能力通过受治理端点点亮。所有端点走既有权限/预算/审计;forge 的 LLM
调用一律经网关 provider lane(fake 默认,真实需三道门),不旁路治理。

## 端点一览

| 端点 | 能力(族群) | 权限 |
| --- | --- | --- |
| `POST /forge/polish` | 迭代精修文本/产物(B) | chat:use |
| `POST /forge/quality` | 质量门评估代码(B) | workflow:run |
| `POST /forge/memory` `{action:"remember"\|"recall"}` | 工作记忆+语义记忆(C) | chat:use |
| `GET /forge/memory/stats` | 记忆统计(C) | dashboard:read |
| `POST /forge/orchestrate` | 目标编排(compile→run)(A+G,LLM 需真实凭证) | workflow:run |
| `GET /forge/runs` | 编排运行列表(G) | workflow:run |
| `GET /forge/status` | 引擎状态与惰性加载报告(F) | dashboard:read |
| `GET /forge/consensus` | 共识引擎状态(A) | dashboard:read |
| `POST /taiji/compile` | 能力规格→免疫风险分类→清单草稿(H) | workflow:run |
| `POST /workforce/preview` | 多角色干跑预览(H) | workflow:run |
| `POST /three-mode/execute` | normal/god/tianshu 三模式真执行(H) | workflow:run |

## CLI(更好用)

```bash
uai forge status
uai forge polish "把这段设计文档打磨成可执行任务"
uai forge quality "export const add=(a,b)=>a+b"
uai forge memory "记住:网关默认 fake lane"
uai forge recall "fake lane"
uai forge taiji "生成内部报表,读取数据库"
uai forge workforce "为网关设计 UX 修复计划"
```

## 性能(更流畅)

2026-08-23 优化后(fake lane、单机、基准工具复测):
chat JSON p50 **15.7ms → 3.3ms(≈4.8×)**,SSE TTFT **2.6ms → 1.6ms**。
来源:审计落盘改为后台串行队列(不再阻塞响应)、provider 注册表与模型
列表版本化缓存、fake 回声通道去除人为 20ms 延迟。

## 未点亮(保持在场)

E 族上下文工程由 codex-channel-gateway 直系承担;forge-dashboard 浏览器
面默认关(与"无浏览器 UI"诚实边界一致,JSON 面在 /forge/status);
agent-pool 常驻池与 self-loop/self-healing 待治理线成熟后按需点亮。
