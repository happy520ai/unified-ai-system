# Zero-Learning Owner Mode Guide

本阶段只解决一个问题：owner 不需要打开网页，也不需要理解按钮。

## 使用方式

1. 双击 `run-xiaotian-daily-check.cmd`。
2. 等待窗口显示检查进度。
3. 检查完成后，系统会自动打开中文老板日报。
4. owner 只看日报里的三块内容：
   - 今天完成了什么
   - 发现了什么问题
   - 下一步我该做什么

## 安全边界

- 不调用 Provider。
- 不读取 secret / auth.json / raw CredentialRef。
- 不修改 `/chat`。
- 不修改 `/chat-gateway/execute`。
- 不 deploy / release / tag / artifact upload。
- 不声明 production-ready。

## 失败时

如果窗口显示失败，把日志路径发给 Codex 修复：

`apps/ai-gateway-service/evidence/phase1781_1800/logs/phase1781-1800-zero-learning-run.log`
