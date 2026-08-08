# Credential-Free Streaming Chat With curl

This example exercises the gateway's Server-Sent Events (SSE) chat route with
the local fake provider. It needs no API key and does not contact a real
provider.

## 1. Start the gateway

From a source checkout:

```bash
pnpm gateway serve
```

Keep the process running at `http://127.0.0.1:3100` while you run the request.

## 2. Print the SSE events

On macOS, Linux, and Git Bash:

```bash
curl --fail-with-body --no-buffer --request POST http://127.0.0.1:3100/chat/stream \
  --header "content-type: application/json" \
  --data '{"prompt":"Say hello in one short sentence","providerId":"local-fake-provider","model":"local-fake-model"}'
```

On Windows PowerShell, use `curl.exe`:

```powershell
$payload = '{"prompt":"Say hello in one short sentence","providerId":"local-fake-provider","model":"local-fake-model"}'
curl.exe --fail-with-body --no-buffer --request POST http://127.0.0.1:3100/chat/stream `
  --header "content-type: application/json" `
  --data-raw $payload
```

The response is an SSE stream. Each event has an `event:` line and a JSON
`data:` line. A successful fake-provider response includes `start`, one or
more `chunk`, and `done` events. The final event contains evidence like:

```text
event: done
data: {"type":"done","selectedProvider":"local-fake-provider","selectedModel":"local-fake-model","executionMode":"fake","executionStatus":"success","outputText":"[fake:local-fake-provider/local-fake-model] Say hello in one short sentence"}
```

`executionMode=fake` and `selectedProvider=local-fake-provider` prove that
this example stayed on the credential-free local path. Stop the local gateway
with `Ctrl+C` when finished. Do not add provider credentials to this example.

For the machine-checkable version of the same contract, run
`pnpm verify:public-clone`; it also checks prompt enhancement, fake chat, and
MCP process cleanup.
