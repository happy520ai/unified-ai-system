# Natural-Language Prompt Enhancement

Unified AI System can turn an ordinary natural-language request into a more
explicit prompt before a model receives it. The local engine (version
`prompt-enhancer-v3`) preserves the original request and adds an interpreted
intent, an inferred deliverable, task essentials, execution requirements with a
suggested step order, output expectations, a clarification policy, and
completion criteria.

This is a deterministic heuristic transformation. It improves consistency and
inspectability; it is not a guarantee that every model or task will perform
better.

## What The Engine Understands

Given one plain sentence, the engine deterministically produces:

- **Interpreted intent** — the request's core action, normalized to one of
  create, modify, explain, evaluate, summarize, translate, plan, investigate,
  operate, or general assistance.
- **Task essentials** — technologies, artifacts (API, report, website, …),
  quantities ("3 days", "5 pages"), time expressions, and file or URL
  references detected in the request. They are carried into the prompt as
  named terms the downstream model must use as written, without renaming or
  redefining them.
- **Inferred deliverable** — what "done" should look like for the detected
  profile and intent, for example a runnable implementation with a minimal
  verification method for coding requests.
- **Suggested step order** — a per-profile decomposition (confirm boundaries →
  locate context → minimal verifiable version → self-check → deliver) rendered
  as numbered steps.
- **Ambiguity probes** — vague references ("这个", "it"), unmeasured quality
  bars ("好一点", "better"), and vague quantities ("一些", "a few") become
  explicit conservative-interpretation instructions plus targeted clarifying
  questions that are asked only if they block a correct result.
- **Request signals** — requested formats, hard constraints, audience, runtime
  or version conditions, evidence requirements, and success criteria compiled
  into explicit requirements. Missing signals can still produce up to three
  targeted clarification questions.
- **Agent execution protocol** — when `target` is set to `agent`, the prompt
  gains a plan-verify-report protocol: emit a short plan first, use the minimal
  tool set, verify before claiming completion, and report result → evidence →
  remaining risks.

The response also carries a machine-readable `analysis` object (intent,
entities, deliverable, steps, ambiguities) and a `quality` profile with a
quality level and concrete recommendations, so callers can decide whether to
ask the user before dispatching the request.

## Preview From The Terminal

Start the gateway, then preview an enhancement without calling a model:

```bash
pnpm gateway serve
pnpm gateway enhance "帮我开发一个用户登录接口" --profile coding
```

Use `--json` to receive the original request, enhanced prompt, detected
profile and language, clarification questions, and engine metadata.

## Preview Through HTTP

```bash
curl --request POST http://127.0.0.1:3100/prompts/enhance \
  --header "content-type: application/json" \
  --data '{
    "input": "Help me plan a product launch",
    "profile": "auto",
    "language": "auto",
    "target": "model"
  }'
```

`target` is optional and defaults to `model`. Set it to `agent` when the
enhanced prompt will drive an autonomous agent; the engine then appends the
agent execution protocol section.

For a copy-paste walkthrough on macOS, Linux, Git Bash, and Windows
PowerShell, see the [curl quickstart](examples/prompt-enhancement-curl.md).

### Python Standard Library

After starting the gateway, run the dependency-free Python example:

```bash
python docs/examples/prompt-enhancement.py "Help me plan a small API for my team" --profile planning --language en
```

The script uses only Python's standard library and prints the JSON response.
Check `data.metadata.providerCalled` in the response; it should be `false` for
this local, deterministic route. The [Python example](examples/prompt-enhancement.py)
also accepts `--base-url` when the gateway is running somewhere else.

### Node.js Standard Library

The equivalent Node.js example uses only built-in modules and verifies the
gateway's provider-free health and enhancement metadata before printing JSON:

```bash
node docs/examples/prompt-enhancement.mjs "Help me plan a small API for my team" --profile planning --language en
```

It accepts `--base-url`, `--profile`, and `--language`. It exits non-zero when
the gateway is unreachable, returns invalid data, or does not prove
`providerCalled=false`, `credentialRequired=false`, and `deterministic=true`.

### Shared SDK Example

After installing the workspace dependencies and starting the gateway, run the
[Shared SDK example](examples/shared-sdk-prompt-enhancement.mjs):

```bash
pnpm gateway serve
node docs/examples/shared-sdk-prompt-enhancement.mjs "Help me plan a small API for my team" --profile planning --language en
```

The example uses the repository's `createGatewayClient` implementation, verifies
provider-free readiness, and checks the same enhancement contract without adding
an external runtime dependency.

To inspect cancellation behavior without starting a gateway or configuring a
provider, run the [Shared SDK cancellation example](examples/shared-sdk-cancellation.mjs):

```bash
node docs/examples/shared-sdk-cancellation.mjs
```

It uses a loopback stub and proves that caller cancellation preserves its own
cause while an internal timeout exposes a `TimeoutError` cause.

### Provider-Free Contract Fixture

To inspect the stable request and response shape without starting the gateway,
run the dependency-free contract fixture:

```bash
node docs/examples/prompt-enhancement-contract.mjs
```

It preserves the original request, profile, language, and enhanced prompt while
asserting `providerCalled=false`, `credentialRequired=false`, and
`deterministic=true`. The command makes no network request and exits non-zero if
the public contract changes unexpectedly.

### Prompt Enhancement Evaluation

Run the repository's broader, credential-free regression baseline:

```bash
pnpm eval:prompt-enhancement
```

The evaluation covers representative coding, analysis, planning, writing,
research, general, English, and Chinese requests. It checks profile and
language behavior, signal compilation, original-input preservation,
determinism, and `providerCalls=0`. This is a contract and safety baseline,
not a claim that every model will produce a better answer.

### Go Standard Library

The dependency-free Go example performs the same provider-free checks using
only Go's standard library:

```bash
go run docs/examples/prompt-enhancement.go "Help me plan a small API for my team" --profile planning --language en
```

It accepts `--base-url`, `--profile`, and `--language`, checks `/health/check`
before calling `/prompts/enhance`, preserves the original request, and exits
non-zero unless the response proves `providerCalled=false`,
`credentialRequired=false`, and `deterministic=true`.

### C# / .NET Standard Library

The .NET example uses only `HttpClient` and `System.Text.Json`. It checks the
provider-free health state, preserves the original request, and exits non-zero
unless the response proves `providerCalled=false`, `credentialRequired=false`,
and `deterministic=true`:

```bash
dotnet run --project docs/examples/prompt-enhancement.csproj -- \
  "Help me plan a small API for my team" --profile planning --language en
```

It targets .NET 8 or newer and requires no NuGet package or provider key.

Supported profiles are `auto`, `general`, `coding`, `analysis`, `writing`,
`research`, and `planning`. Supported language settings are `auto`, `zh-CN`,
and `en`. Supported targets are `model` (default) and `agent`. In `auto`
mode, an explicit output-language request such as
`Please answer in Chinese` or `请用英文回答` takes precedence over character-based
language detection. An explicit API or CLI `language` value remains authoritative.
Input is limited to 20,000 characters.

## Opt In For Chat

Plain `/chat` behavior is unchanged. Apply enhancement only by sending an
explicit option:

```json
{
  "taskType": "chat",
  "messages": [
    {
      "role": "user",
      "content": "Build a Node API with tests"
    }
  ],
  "promptEnhancement": {
    "enabled": true,
    "profile": "coding",
    "language": "auto",
    "target": "model"
  }
}
```

`target: "agent"` is available in chat as well when the enhanced message will
be consumed by an agent runtime.

The gateway enhances only the latest non-empty user message. Earlier user,
assistant, system, and tool messages remain unchanged. JSON chat responses
include a `data.promptEnhancement` summary. Streaming events include the same
summary under `meta.promptEnhancement`.

The terminal equivalent is:

```bash
pnpm gateway chat "Build a Node API with tests" --enhance --profile coding
```

## Shared SDK

```js
import {
  createGatewayChatRequest,
  createGatewayClient,
} from "@unified-ai-system/shared-sdk";

const gateway = createGatewayClient({
  baseUrl: "http://127.0.0.1:3100",
});

const preview = await gateway.enhancePrompt({
  input: "Analyze our deployment options",
  profile: "analysis",
});

const response = await gateway.chat(createGatewayChatRequest({
  prompt: "Analyze our deployment options",
  promptEnhancement: {
    enabled: true,
    profile: "analysis",
  },
}));
```

## Codex And MCP

The source build and published `0.5.0` container expose
`gateway_prompt_enhance` as a read-only MCP tool. It returns a preview without
checking provider health because it cannot call a provider. The tool accepts
`input`, `profile`, `language`, and `target` (`model` or `agent`);
`gateway_prompt_enhance_llm` adds `providerId` and `modelId` and falls back to
this deterministic engine when no provider is configured.

## Safety And Governance

- The enhancer does not call a model, access a network provider, or require a
  credential.
- The original request is included verbatim inside the enhanced prompt and is
  also returned separately by the preview API.
- Enhancement cannot enable a real provider or bypass chat authorization.
- `/prompts/enhance` uses the existing `chat:use` enterprise permission.
- Invalid profiles, languages, targets, empty input, and oversized input fail
  with a validation error instead of silently falling back.
