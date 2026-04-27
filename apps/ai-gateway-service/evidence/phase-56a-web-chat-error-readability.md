# Phase 56A Web Chat Error Readability Evidence

- Phase: phase-56a-web-chat-error-readability
- Status: passed
- Generated at: 2026-04-26T08:16:20.433Z
- Service URL: http://127.0.0.1:64604
- Prompt: 请触发 phase56a readable error smoke。
- Assistant text: PME16:16回答失败。聊天请求失败，但页面已经恢复，可以继续发送下一条。
流式失败原因：HTTP 503
普通回答失败：HTTP 502 / PHASE56A_FORCED_RAG_FAILURE / Phase56A forced readable error for Chat-first UI.恢复建议：这更像服务端或 provider 临时异常。请稍后重试，或运行 health / logs 查看服务状态。我不会把失败的 key 强行绑定到默认 NVIDIA，也不会用假模型冒充可用模型。复制回答复制引用重新发送
- Error class present: true
- Readable stream failure text present: true
- HTTP status text present: true
- Forced error code: PHASE56A_FORCED_RAG_FAILURE
- Forced error code present: true
- Fetches: /chat/rag/stream, /chat/rag
- Fetch statuses: [{"path":"/chat/rag/stream","status":503,"ok":false,"simulated":true},{"path":"/chat/rag","status":502,"ok":false,"simulated":true}]
- Message count: 3
- Screenshot path: apps/ai-gateway-service/evidence/phase-56a-web-chat-error-readability.png
- Screenshot bytes: 140648
- Screenshot dimensions: 1424x1105
- Valid PNG: true
- Browser error interaction: true
- Simulated browser fetch failure only: true
- Fake provider only: true
- Default chat main lane changed: false
- Backend business route added: false
- Provider calls: false
- Runtime mutation: false
- Release automation: false
- Infrastructure provisioning: false
- Conclusion: web-chat-error-readability-connected
