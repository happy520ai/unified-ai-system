# Route Module Staging

本目录用于 Phase323E 起的 route registry 渐进拆分。

当前阶段边界：

- 不改变任何现有路由路径
- 不改变响应 schema
- 不迁移 `/chat-gateway/execute`
- 不默认暴露隐藏模块

Phase323CDE-1 仅新增低风险路由骨架文件，不接入生产主链。
