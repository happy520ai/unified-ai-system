# Provider-Free Prompt Enhancement With curl

This example sends ordinary language to the local prompt-enhancement route.
It does not require an API key, call a model, or contact a provider.

## 1. Start the gateway

From a source checkout:

```bash
pnpm gateway serve
```

Keep that process running. The examples below use the default local endpoint
at `http://127.0.0.1:3100`.

## 2. Send a request

On macOS, Linux, and Git Bash:

```bash
curl --fail-with-body --request POST http://127.0.0.1:3100/prompts/enhance \
  --header "content-type: application/json" \
  --data '{"input":"Help me plan a small API for my team","profile":"planning","language":"en"}'
```

On Windows PowerShell, use the native curl executable so the command is
consistent with the other platforms:

```powershell
$payload = '{"input":"Help me plan a small API for my team","profile":"planning","language":"en"}'
curl.exe --fail-with-body --request POST http://127.0.0.1:3100/prompts/enhance `
  --header "content-type: application/json" `
  --data-raw $payload
```

## 3. Check the evidence

The response is an ordinary JSON envelope. The important fields are:

```json
{
  "status": "ok",
  "data": {
    "original": "Help me plan a small API for my team",
    "enhancedPrompt": "...",
    "profile": "planning",
    "language": "en",
    "metadata": {
      "providerCalled": false,
      "credentialRequired": false,
      "deterministic": true
    }
  }
}
```

`data.original` preserves the input. `data.enhancedPrompt` adds explicit
execution, output, clarification, and completion guidance. The metadata is
the safety proof for this route: the transformation is local and deterministic
and `providerCalled` is `false`.

The route accepts `auto`, `general`, `coding`, `analysis`, `writing`,
`research`, and `planning` profiles. It accepts `auto`, `zh-CN`, and `en`
language settings. See the [full prompt-enhancement guide](../prompt-enhancement.md)
for chat opt-in and SDK examples.
