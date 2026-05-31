# Phase3977C: MiMo CredentialRef Resolver Contract Wiring

## 目标
把 mimo 的 CredentialRef 纳入 resolver contract。

## 修改文件
- `apps/ai-gateway-service/src/providers/credentialRefResolverRuntime.contract.js`

## 修改内容
在 `supportedProviderRefs` 数组中添加：
```javascript
Object.freeze({
  providerId: "mimo",
  credentialRef: "credentialRef:mimo:default",
  allowedModelIds: Object.freeze([
    "mimo-v2.5-pro",
  ]),
}),
```

## 安全边界
- 不写入 API key
- 不读取 .env / auth.json
- 不打印 token / header
- 不调用 Provider
