# Phase1958P-CredentialSetup OpenRouter Owner Guide

## Goal

Owner 在本机安全位置配置 OpenRouter API Key，使其映射为：

```text
credentialRef:openrouter:default
```

Codex 不接收、不读取、不打印 API Key。验证器只判断 credentialRef 是否可解析为“存在/可用状态”，不得输出 secret value。

## Owner Boundary

- 不要把 OpenRouter API Key 发给 Codex。
- 不要把 API Key 写进 docs、evidence、chat、终端日志或 approval JSON。
- 不要让 Codex 输出任何 authorization header。
- 配置完成后，需要重新生成 fresh text-first owner approval；旧 Phase1957P approval 不可复用。

## Current Masked Status

- providerId: openrouter
- modelId: openai/gpt-4o-mini
- credentialRef: credentialRef:openrouter:default
- openRouterCredentialRefResolvable: false
- blocker: openrouter_credentialref_still_missing
- aliasesChecked: openrouter, openrouter/default, openrouter:default, openrouter::default, credentialRef:openrouter:default
- matchedAlias: null

This packet does not call OpenRouter and does not read secret material.
