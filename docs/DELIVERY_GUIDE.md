# PME 移动地球 Delivery Guide

This guide is the current delivery-facing operating manual for PME 移动地球.
It describes the bounded system that is ready for daily use after the
default command set, local knowledge path, and explicit vector production path
were verified.

## What This System Is

PME 移动地球 is a monorepo containing:

- `apps/agent-console`: the upper interaction entrypoint.
- `apps/ai-gateway-service`: the AI Gateway service and knowledge API.
- `packages/shared-sdk`: the shared client surface used by the console.
- `packages/shared-contracts`: the public protocol and result shapes.

The service `/chat` path remains NVIDIA single-provider. The knowledge path is
a separate API surface. The Web UI now uses the bounded service-side
`/chat/rag` entry: the service retrieves local knowledge, injects structured
citations, and then routes the augmented prompt through the existing gateway
provider path. This does not change the default `/chat` contract or provider
lane.

## What It Can Do

- Start the managed service/console chain.
- Report status, health, logs, doctor checks, restart, idle, and stop.
- Run bounded integration and readiness checks.
- Load local knowledge source documents through `/knowledge/load`.
- Retrieve local keyword results through `/knowledge/retrieve`.
- Return ranked knowledge results with `topHit`, `topChunk`, `topDocument`,
  snippets, highlights, matched terms, score breakdown, and metadata.
- Use `POST /chat/rag` for bounded service-side RAG chat with structured
  citations.
- Use `POST /chat/rag/stream` for ChatGPT-style streaming output in the Web
  console.
- Inspect provider visibility/selection, runtime dashboard status, optional
  auth status, long-term memory, explicit text connector import,
  evaluation/scoring, query-time knowledge graph retrieval, and the safe local
  workflow loop through bounded Phase 31A surfaces.
- Enable a bounded enterprise governance foundation with optional token auth,
  tenant identity, RBAC checks, protected enterprise routes, and JSONL audit
  logging through Phase 32A.
- Inspect the enterprise governance foundation from the Web console through a
  bounded Phase 33A enterprise admin panel.
- Harden the enterprise foundation with token expiry, revoked-token rejection,
  cross-tenant denial checks, protected security readiness diagnostics, and Web
  console security visibility through Phase 34A.
- Manage local enterprise users/tokens through a hash-only persistent user
  store, admin-only lifecycle routes, revocation, and Web console controls
  through Phase 35A.
- Query and export bounded enterprise audit evidence as filtered JSON/JSONL
  through Phase 36A.
- Check enterprise deployment readiness, create hash-only local enterprise
  backups, and validate those backups with a restore dry-run through Phase 37A.
- Check redacted enterprise production startup readiness through Phase 38A,
  including real NVIDIA startup config, enterprise auth posture, durable
  knowledge storage, audit path, backup path, and secret presence without
  exposing secret values.
- Run a read-only enterprise deployment preflight view in the Web console
  through Phase 40A, aggregating existing readiness endpoints into a Go/No-Go
  panel without adding backend business behavior.
- Use a browser-local enterprise config wizard through Phase 41A to check a
  pasted `.env` draft for missing required settings and secret presence without
  uploading, saving, or echoing secret values.
- Verify the enterprise handoff manifest through Phase 42A so the deployment
  docs, safe environment template, default scripts, and boundary wording remain
  aligned without adding release automation.
- Generate the enterprise acceptance report through Phase 43A so existing
  evidence, docs, commands, and boundaries are summarized in a single
  read-only handoff report.
- View the same acceptance report from the Web console through Phase 44A using
  a protected read-only route over the existing Phase43A report/evidence.
- Run a Phase 45A enterprise release-candidate dry-run that checks delivery
  docs, scripts, evidence, UI markers, and boundary wording without creating a
  package or running release automation.
- View the Phase45A dry-run result from the Web console through Phase 46A using
  a protected read-only route over existing evidence.
- View a Phase 47A enterprise overview from the Web console using a protected
  read-only route that aggregates readiness, acceptance, and release-candidate
  evidence without provider calls, packaging, or release automation.
- With explicit vector configuration, run a real Gemini embedding plus
  pgvector write/read/retrieve production probe through `verify:phase23`.
- Open a minimal Web visual operation console at `http://127.0.0.1:3100/ui`
  after the service is running.

## Default Command Set

```powershell
cmd /c pnpm help:phase14a
cmd /c pnpm dev:phase7b
cmd /c pnpm status:phase10a
cmd /c pnpm health:phase12a
cmd /c pnpm doctor:phase13a
cmd /c pnpm logs:phase16a
cmd /c pnpm restart:phase11a
cmd /c pnpm idle:phase15a
cmd /c pnpm stop:phase9c
cmd /c pnpm verify:phase7a
cmd /c pnpm verify:phase8a-4
cmd /c pnpm verify:phase21
cmd /c pnpm verify:phase22
cmd /c pnpm verify:phase23
cmd /c pnpm verify:phase24
cmd /c pnpm verify:phase25a
cmd /c pnpm verify:phase26a
cmd /c pnpm verify:phase27
cmd /c pnpm verify:phase28a
cmd /c pnpm verify:phase29a
cmd /c pnpm verify:phase30a
cmd /c pnpm verify:phase31a
cmd /c pnpm verify:phase32a
cmd /c pnpm verify:phase33a
cmd /c pnpm verify:phase34a
cmd /c pnpm verify:phase35a
cmd /c pnpm verify:phase36a
cmd /c pnpm verify:phase37a
cmd /c pnpm verify:phase38a
cmd /c pnpm verify:phase40a
cmd /c pnpm verify:phase41a
cmd /c pnpm verify:phase42a
cmd /c pnpm verify:phase43a
cmd /c pnpm verify:phase44a
cmd /c pnpm verify:phase45a
cmd /c pnpm verify:phase46a
cmd /c pnpm verify:phase47a
cmd /c pnpm verify:phase48a
cmd /c pnpm verify:phase49a
cmd /c pnpm verify:phase50a
cmd /c pnpm verify:phase51a
cmd /c pnpm verify:phase52a
cmd /c pnpm verify:phase53a
cmd /c pnpm verify:phase54a
cmd /c pnpm verify:phase55a
cmd /c pnpm verify:phase56a
cmd /c pnpm verify:phase57a
cmd /c pnpm verify:phase58a
cmd /c pnpm verify:phase59a
cmd /c pnpm verify:phase60a
cmd /c pnpm verify:phase61a
cmd /c pnpm verify:phase62a
cmd /c pnpm verify:phase63a
cmd /c pnpm verify:phase64a
cmd /c pnpm verify:phase65a
cmd /c pnpm verify:phase66a
cmd /c pnpm verify:phase67a
cmd /c pnpm verify:phase68a
cmd /c pnpm verify:phase69a
cmd /c pnpm verify:phase70a
cmd /c pnpm verify:phase71a
cmd /c pnpm verify:phase72a
cmd /c pnpm verify:phase73a
cmd /c pnpm verify:phase74a
cmd /c pnpm verify:phase75a
cmd /c pnpm verify:phase76a
cmd /c pnpm verify:phase76b
cmd /c pnpm verify:phase76c
cmd /c pnpm verify:phase76d
cmd /c pnpm verify:phase76e
cmd /c pnpm verify:phase76f
cmd /c pnpm verify:phase76g
cmd /c pnpm verify:phase76h
cmd /c pnpm verify:phase76i
cmd /c pnpm verify:phase76j
cmd /c pnpm verify:phase76k
cmd /c pnpm verify:phase76l
cmd /c pnpm verify:enterprise
cmd /c pnpm verify:phase21a
cmd /c pnpm verify:phase21b
cmd /c pnpm verify:phase21c
```

Phase 24 adds a delivery/sample validation command:

```powershell
cmd /c pnpm verify:phase24
```

Phase 25A adds a Web console validation command:

```powershell
cmd /c pnpm verify:phase25a
```

Phase 28A adds a documented feature closure validation command:

```powershell
cmd /c pnpm verify:phase28a
```

It checks that the current delivery docs, Web UI, service health, knowledge
health, file-type discovery, bounded file import, local keyword retrieval,
file-sqlite persistence wording, and infra readiness are connected. It does
not validate excluded future capabilities.

Phase 29A adds a service RAG chat validation command:

```powershell
cmd /c pnpm verify:phase29a
```

### 本地业务流程自动化最小安全闭环

```powershell
cmd /c pnpm verify:phase30a
```

Phase 30A 验证 `GET /workflow/health`、`GET /workflow/actions`、
`POST /workflow/plan` 和 `POST /workflow/run`。当前只允许一条安全动作链：
`knowledge.retrieve` -> `report.compose` -> `artifact.write`。输出文件只能写入
受控 workflow 输出目录，不允许任意 shell、本机系统自动化、广谱文件扫描或外部
connector。

It checks `POST /chat/rag` end to end: local knowledge retrieve, structured
citations, gateway provider answer, and Web UI wiring.

Phase 31A adds the bounded experience capability validation command:

```powershell
cmd /c pnpm verify:phase31a
```

It checks real user-facing loops for streaming RAG chat, provider visibility,
retryable fallback execution, dashboard status, heuristic evaluation/scoring,
long-term memory backed by the knowledge store, explicit text connector import,
optional auth/tenant headers, query-time graph retrieval, and the safe local
workflow loop. These are minimum usable surfaces, not enterprise-grade
DataEyes, governance, arbitrary connector crawling, production GraphRAG, full
IAM, or release automation.

Phase 32A adds the enterprise governance foundation validation command:

```powershell
cmd /c pnpm verify:phase32a
```

It checks optional token authentication, tenant context, role-based access
control, protected enterprise session/roles/audit endpoints, and JSONL audit
recording. This is the first real enterprise safety layer. It is not a full
IAM/SSO/SAML/OIDC system, policy administration console, compliance workflow
engine, or complete governance dashboard.

Phase 33A adds the enterprise admin console validation command:

```powershell
cmd /c pnpm verify:phase33a
```

It checks that `/ui` includes the enterprise governance panel and that the
operator-facing buttons map to governance health, current session,
roles/permissions, and audit log routes. It is a bounded console view over
Phase 32A, not user lifecycle management or SSO administration.

Phase 34A adds the enterprise security hardening validation command:

```powershell
cmd /c pnpm verify:phase34a
```

It checks token expiry rejection, revoked-token rejection, cross-tenant denial,
protected security readiness diagnostics, protected audit visibility, and the
Web console security-readiness button. It is a bounded security hardening layer
over the Phase 32A/33A foundation, not full IAM, SSO/SAML/OIDC, user lifecycle
management, policy administration, SIEM, or compliance workflow automation.

Phase 35A adds the enterprise managed user/token lifecycle validation command:

```powershell
cmd /c pnpm verify:phase35a
```

It checks admin-only managed user listing, create/update, hash-only token
storage, authentication with a managed token, revocation, persistence across a
fresh service application instance, audit records, and Web console managed user
controls. Token values must not be returned by the API, written to evidence, or
stored as plaintext.

Phase 36A adds the enterprise audit query/export validation command:

```powershell
cmd /c pnpm verify:phase36a
```

It checks filtered audit listing by outcome/path/user/tenant/time-compatible
query fields plus JSON and JSONL audit export. It is bounded local audit
evidence, not SIEM, tamper-proof storage, retention automation, or compliance
case management.

Phase 37A adds the enterprise deployment/ops readiness validation command:

```powershell
cmd /c pnpm verify:phase37a
```

It checks protected deployment readiness, admin-only backup creation,
hash-only managed user backup content, restore validation dry-run, restore path
containment, and Web console readiness/backup controls. The backup is a
bounded JSON enterprise snapshot under the configured backup directory; it is
not broad filesystem backup, release automation, or infrastructure
provisioning. Restore validation does not mutate the live service.

Phase 38A adds the enterprise production startup readiness validation command:

```powershell
cmd /c pnpm verify:phase38a
```

It checks protected startup readiness for real NVIDIA provider configuration,
enterprise auth/token posture, durable knowledge storage, audit path, backup
path, and redacted secret presence. It does not call the provider, print API
keys, provision infrastructure, or mutate live data.

Phase 40A adds the enterprise deployment preflight UI validation command:

```powershell
cmd /c pnpm verify:phase40a
```

It checks that `/ui` exposes a read-only deployment preflight panel over
existing service health, deployment readiness, startup readiness, security
readiness, and vector readiness endpoints. It does not add a new backend
business route, create backups, mutate enterprise state, call providers, or
print secrets.

Phase 41A adds the enterprise config wizard UI validation command:

```powershell
cmd /c pnpm verify:phase41a
```

It checks that `/ui` exposes a browser-local `.env` draft checker. Pasted
configuration is parsed in the browser only; the UI reports missing required
settings and secret presence, but it does not upload, save, or echo secret
values.

Phase 42A adds the enterprise handoff manifest validation command:

```powershell
cmd /c pnpm verify:phase42a
```

It checks the handoff manifest, delivery guide, runbook, operation manual,
safe environment template, enterprise scripts, and Web console safety markers.
It is read-only and does not provision infrastructure, create releases, run
release automation, mutate runtime configuration, or record secret values.

Phase 43A adds the enterprise acceptance report validation command:

```powershell
cmd /c pnpm verify:phase43a
```

It summarizes existing evidence, required docs, command coverage, and boundary
markers into `docs/ENTERPRISE_ACCEPTANCE_REPORT.md`. It is read-only over
existing artifacts and does not call providers, provision infrastructure,
create releases, run release automation, mutate runtime data, or record secret
values.

Phase 44A adds the enterprise acceptance report UI validation command:

```powershell
cmd /c pnpm verify:phase44a
```

It checks the protected read-only `GET /enterprise/acceptance/report` route and
the Web console panel that displays the existing Phase43A report/evidence. It
does not call providers, mutate runtime data, provision infrastructure, run
release automation, or record secret values.

Phase 45A adds the enterprise release-candidate dry-run validation command:

```powershell
cmd /c pnpm verify:phase45a
```

It checks the delivery docs, operation manual, safe environment template,
enterprise scripts, existing evidence, Web console safety markers, and boundary
wording. It is a read-only dry-run and does not create a package, publish a
release, call providers, provision infrastructure, mutate runtime data, run
release automation, or record secret values.

Phase 46A adds the enterprise release-candidate UI validation command:

```powershell
cmd /c pnpm verify:phase46a
```

It checks the protected read-only
`GET /enterprise/release-candidate/dry-run` route and the Web console panel
that displays existing Phase45A dry-run evidence. It does not create packages,
publish releases, call providers, mutate runtime data, provision
infrastructure, run release automation, or record secret values.

Phase 47A adds the enterprise overview UI validation command:

```powershell
cmd /c pnpm verify:phase47a
```

It checks the protected read-only `GET /enterprise/overview` route and the Web
console panel that consolidates governance health, deployment readiness,
startup readiness, security readiness, vector readiness, acceptance evidence,
and release-candidate dry-run evidence. It does not call providers, mutate
runtime data, create packages, publish releases, provision infrastructure, run
release automation, or record secret values.

Phase 48A adds the enterprise overview readability validation command:

```powershell
cmd /c pnpm verify:phase48a
```

It checks that `/ui` renders the existing enterprise overview as a readable
one-screen status summary while preserving raw JSON for diagnosis. It does not
add backend business behavior, call providers, mutate runtime data, create
packages, publish releases, provision infrastructure, run release automation,
or record secret values.

Phase 49A adds the Web Chinese readability validation command:

```powershell
cmd /c pnpm verify:phase49a
```

It checks that the Chat-first foreground and hidden capability panel use
Chinese-first visible labels for ordinary daily use. It is display-only and
does not add backend routes, call providers, mutate runtime data, publish
releases, provision infrastructure, or run release automation.

Phase 50A adds the help readability validation command:

```powershell
cmd /c pnpm verify:phase50a
```

It checks that `help:phase14a` uses the UTF-8 `tools/phase14a/help.mjs` script
and prints readable Chinese command and boundary text. It is read-only and
does not start services, stop processes, call providers, mutate runtime data,
publish releases, provision infrastructure, or run release automation.

Phase 51A adds the Web user readability validation command:

```powershell
cmd /c pnpm verify:phase51a
```

It checks that the `/ui` first screen tells ordinary users the recommended
daily command flow, keeps advanced capabilities hidden in the side panel by
default, and keeps direct file/chat usage as the main path. It is display-only
and does not add backend routes, call providers, mutate runtime data, publish
releases, provision infrastructure, or run release automation.

Phase 52A adds the Web browser visual validation command:

```powershell
cmd /c pnpm verify:phase52a
```

It renders `/ui` with a local headless Chrome/Edge browser and saves a
screenshot evidence PNG. It is browser-render only and does not add backend
routes, call providers, mutate runtime data, publish releases, provision
infrastructure, or run release automation.

Phase 53A adds the Web chat interaction validation command:

```powershell
cmd /c pnpm verify:phase53a
```

It renders `/ui` in a local headless browser, submits a prompt through the real
Chat-first form, and verifies that the page receives a bounded service-side RAG
answer through `/chat/rag/stream`. It uses the local fake provider only and
does not change the default NVIDIA `/chat` lane, add backend routes, call real
providers, publish releases, provision infrastructure, or run release
automation.

Phase 54A adds the Web file upload interaction validation command:

```powershell
cmd /c pnpm verify:phase54a
```

It renders `/ui` in a local headless browser, injects a small text file through
the real file input, verifies `/knowledge/load/file`, then asks through
Chat-first and verifies `/chat/rag/stream` can retrieve the uploaded content.
It uses the local fake provider only and does not change the default NVIDIA
`/chat` lane, add backend routes, call real providers, publish releases,
provision infrastructure, or run release automation.

Phase 55A adds the Web multi-file upload and oversize skip validation command:

```powershell
cmd /c pnpm verify:phase55a
```

It renders `/ui` in a local headless browser, injects multiple files through
the real file input, verifies one small file is loaded through
`/knowledge/load/file`, verifies an oversized file is skipped with the 100MB
message, then asks through Chat-first and verifies `/chat/rag/stream` can
retrieve the loaded content. It uses the local fake provider only and does not
change the default NVIDIA `/chat` lane, add backend routes, call real
providers, publish releases, provision infrastructure, or run release
automation.

Phase 56A adds the Web chat error readability validation command:

```powershell
cmd /c pnpm verify:phase56a
```

It renders `/ui` in a local headless browser, simulates a bounded
`/chat/rag/stream` plus fallback `/chat/rag` failure inside the browser, and
verifies the Chat-first surface shows a readable error state with HTTP status
and error code. It does not call real providers, add backend routes, change the
default NVIDIA `/chat` lane, publish releases, provision infrastructure, or run
release automation.

Phase 57A adds the Web chat no-hit readability validation command:

```powershell
cmd /c pnpm verify:phase57a
```

It renders `/ui` in a local headless browser, asks a query that should not
match local knowledge, and verifies `/chat/rag/stream` returns a readable
no-hit / insufficient-data instruction. It uses the local fake provider only
and does not call real providers, add backend routes, change the default NVIDIA
`/chat` lane, publish releases, provision infrastructure, or run release
automation.

Phase 58A adds the Web chat empty-input readability validation command:

```powershell
cmd /c pnpm verify:phase58a
```

It renders `/ui` in a local headless browser, submits a whitespace-only chat
message, and verifies the Chat-first surface shows a clear system hint without
sending `/chat/rag/stream`, `/chat/rag`, or `/chat` requests. It does not call
providers, add backend routes, change the default NVIDIA `/chat` lane, publish
releases, provision infrastructure, or run release automation.

Phase 59A adds the Web provider-list failure readability validation command:

```powershell
cmd /c pnpm verify:phase59a
```

It renders `/ui` in a local headless browser, simulates a bounded `/providers`
failure before the page loads, and verifies the Chat-first surface explains
that the provider list is unavailable while the service will continue with the
server-side default route. It does not send chat requests, call providers, add
backend routes, change the default NVIDIA `/chat` lane, publish releases,
provision infrastructure, or run release automation.

Phase 60A adds the Web chat sending-state validation command:

```powershell
cmd /c pnpm verify:phase60a
```

It renders `/ui` in a local headless browser, simulates a slow streaming chat
response, verifies the send button switches to `生成中`, and verifies a duplicate
submit is blocked with a readable system hint while only one `/chat/rag/stream`
request is sent. It does not call real providers, add backend routes, change
the default NVIDIA `/chat` lane, publish releases, provision infrastructure, or
run release automation.

Phase 61A adds the Web chat complete-readability validation command:

```powershell
cmd /c pnpm verify:phase61a
```

It renders `/ui` in a local headless browser and verifies the remaining
user-visible chat recovery paths: SSE `error` events are treated as real
failures, streaming failure can fall back to ordinary RAG, fallback failure
shows a readable next-step message, empty streams get a clear no-text message,
and the send button always returns to `发送`. It does not call real providers,
add backend routes, change the default NVIDIA `/chat` lane, publish releases,
provision infrastructure, or run release automation.

Phase 62A adds the Web chat session-persistence validation command:

```powershell
cmd /c pnpm verify:phase62a
```

It renders `/ui` in a local headless browser, simulates one bounded chat answer,
verifies the prompt and answer are saved in current-browser local storage,
verifies they are restored after reload, and verifies the clear button removes
the stored messages. It does not call real providers, add backend routes,
change the default NVIDIA `/chat` lane, publish releases, provision
infrastructure, or run release automation.

Phase 63A adds the Web chat stop-generation validation command:

```powershell
cmd /c pnpm verify:phase63a
```

It renders `/ui` in a local headless browser, simulates a long streaming answer,
clicks `停止生成`, verifies the stream abort path, confirms no ordinary RAG
fallback request is sent after the user stops generation, and verifies the page
returns to a send-ready state with a readable stopped message. It does not call
real providers, add backend routes, change the default NVIDIA `/chat` lane,
publish releases, provision infrastructure, or run release automation.

Phase 64A adds the Web chat keyboard interaction validation command:

```powershell
cmd /c pnpm verify:phase64a
```

It renders `/ui` in a local headless browser, verifies `Enter` sends the chat,
verifies `Shift+Enter` keeps a newline before sending, and verifies focus
returns to the chat input after the answer. It does not call real providers,
add backend routes, change the default NVIDIA `/chat` lane, publish releases,
provision infrastructure, or run release automation.

Phase 65A adds the Web chat message actions validation command:

```powershell
cmd /c pnpm verify:phase65a
```

It renders `/ui` in a local headless browser and verifies that assistant
messages support copying the answer, copying citations, and retrying the
previous prompt. The check uses simulated stream output only and does not call
real providers, add backend routes, change the default NVIDIA `/chat` lane,
publish releases, provision infrastructure, or run release automation.

Phase 66A adds the Web chat citation readability validation command:

```powershell
cmd /c pnpm verify:phase66a
```

It renders `/ui` in a local headless browser and verifies that retrieved
citations appear as a readable expandable list with source/document metadata,
snippet text, and per-citation copy actions. The check uses simulated stream
output only and does not call real providers, add backend routes, change the
default NVIDIA `/chat` lane, publish releases, provision infrastructure, or run
release automation.

Phase 67A adds the Web chat status feedback validation command:

```powershell
cmd /c pnpm verify:phase67a
```

It renders `/ui` in a local headless browser and verifies that each assistant
answer shows connection, knowledge retrieval, generation, and completion status
separately from the saved answer text. The check uses simulated stream output
only and does not call real providers, add backend routes, change the default
NVIDIA `/chat` lane, publish releases, provision infrastructure, or run release
automation.

Phase 68A adds the Web chat Markdown-lite rendering validation command:

```powershell
cmd /c pnpm verify:phase68a
```

It renders `/ui` in a local headless browser and verifies that assistant
answers safely display paragraphs, bullet lists, numbered lists, code blocks,
and http/https links while unsafe links render as plain text and raw answer
text remains available for copy/history. The check uses simulated stream output
only and does not call real providers, add backend routes, change the default
NVIDIA `/chat` lane, publish releases, provision infrastructure, or run release
automation.

Phase 69A adds the Web chat code-block tools validation command:

```powershell
cmd /c pnpm verify:phase69a
```

It renders `/ui` in a local headless browser and verifies that assistant
answers support inline code, fenced code blocks with a language toolbar,
per-code-block copy, and horizontal scrolling for long code lines. The check
uses simulated stream output only and does not call real providers, add backend
routes, change the default NVIDIA `/chat` lane, publish releases, provision
infrastructure, or run release automation.

Phase 70A adds the Web chat Markdown block readability validation command:

```powershell
cmd /c pnpm verify:phase70a
```

It renders `/ui` in a local headless browser and verifies that assistant
answers support blockquotes, Markdown tables, and horizontal dividers while
preserving raw answer text for copy/history. The check uses simulated stream
output only and does not call real providers, add backend routes, change the
default NVIDIA `/chat` lane, publish releases, provision infrastructure, or run
release automation.

Phase 71A adds the Web chat long-answer viewport validation command:

```powershell
cmd /c pnpm verify:phase71a
```

It renders `/ui` in a local headless browser and verifies that long streaming
answers auto-follow while the user is at the bottom, do not yank the viewport
when the user has manually scrolled up, and keep the final answer visible after
completion. The check uses simulated stream output only and does not call real
providers, add backend routes, change the default NVIDIA `/chat` lane, publish
releases, provision infrastructure, or run release automation.

Phase 72A adds the Web chat composer polish validation command:

```powershell
cmd /c pnpm verify:phase72a
```

It renders `/ui` in a local headless browser and verifies that the Chat input
area prevents empty sends, auto-resizes for multi-line drafts, shows shortcut
and character-count feedback, keeps Shift+Enter as a newline, supports
Ctrl/Cmd+Enter send, and restores focus after sending. The check uses simulated
stream output only and does not call real providers, add backend routes, change
the default NVIDIA `/chat` lane, publish releases, provision infrastructure, or
run release automation.

Phase 73A adds the Web chat mobile viewport validation command:

```powershell
cmd /c pnpm verify:phase73a
```

It renders `/ui` at a phone-sized viewport and verifies that the page avoids
horizontal and whole-document scrolling, keeps the chat shell/history/composer
inside the viewport, compacts mobile quick-start content, and keeps primary
controls visible. The check is UI-only and does not call real providers, add
backend routes, change the default NVIDIA `/chat` lane, publish releases,
provision infrastructure, or run release automation.

Phase 74A adds the Web chat first-screen polish validation command:

```powershell
cmd /c pnpm verify:phase74a
```

It renders `/ui` at a desktop viewport and verifies that the opening screen
stays focused on chatting: the command checklist is collapsed by default, the
initial assistant greeting is short, the side panel is hidden, and the input is
the primary action. The check is UI-only and does not call real providers, add
backend routes, change the default NVIDIA `/chat` lane, publish releases,
provision infrastructure, or run release automation.

Phase 75A adds the Web chat final experience validation command:

```powershell
cmd /c pnpm verify:phase75a
```

It renders `/ui`, sends a simulated streaming chat request, and verifies the
final chat surface: structured user/assistant bubbles with labels and
timestamps, readable citations, copy/retry actions, long-answer overflow
handling, and a scroll-to-bottom recovery control. The check is UI-only and
does not call real providers, add backend routes, change the default NVIDIA
`/chat` lane, publish releases, provision infrastructure, or run release
automation.

Phase 76A adds the Web chat command-center validation command:

```powershell
cmd /c pnpm verify:phase76a
```

It renders `/ui` in a local browser and verifies chat-window command cards for
model configuration, service status, health, and knowledge status. The cards
reuse existing safe HTTP APIs only, do not persist API keys, do not add backend
routes, and do not change the default NVIDIA `/chat` lane.

Phase 76B adds the Web chat model preference persistence validation command:

```powershell
cmd /c pnpm verify:phase76b
```

It verifies that the chat model configuration card can remember provider/model
choice in current-browser storage across reloads. It intentionally does not
persist API key draft values; generated startup templates are redacted.

Phase 76C adds the Web chat model configuration wizard polish validation
command:

```powershell
cmd /c pnpm verify:phase76c
```

It verifies that model setup appears as a guided three-step chat card with
current status, model selection, safe secret handling, and a copyable redacted
startup template. It is UI polish only and does not change backend chat routing
or persist API keys.

Phase 76D adds the Web chat model configuration effect-status validation
command:

```powershell
cmd /c pnpm verify:phase76d
```

It verifies that users can see whether the selected model is already effective
for the current chat, remembered for the next browser session, or only ready for
long-lived service startup after copying the startup template and restarting the
managed service. It remains UI feedback only.

Phase 76E adds the Web chat model availability-probe validation command:

```powershell
cmd /c pnpm verify:phase76e
```

It verifies that the chat model configuration wizard has a user-triggered
“检测当前模型是否可用” action. The action reuses the existing `/chat` route for a
small provider/model probe and shows pass/fail feedback in the card without
storing API key drafts, adding backend routes, or changing the default chat
main lane.

Phase 76F adds the Web chat one-click model apply/probe validation command:

```powershell
cmd /c pnpm verify:phase76f
```

It verifies that ordinary users can use one primary “一键应用并检测” action to
apply the selected model to the current browser chat and immediately check
whether it can answer through the existing `/chat` path. It is UI convenience
only and does not persist API keys, add backend routes, or mutate service
runtime configuration.

```powershell
cmd /c pnpm verify:phase76g
```

It verifies that the model configuration wizard keeps the everyday path simple:
the first screen shows the primary apply-and-probe flow, while single apply,
single probe, preference clearing, startup templates, API key draft checks, and
raw diagnostics are collapsed under advanced options. It is UI convenience only
and does not persist API keys, add backend routes, or mutate service runtime
configuration.

```powershell
cmd /c pnpm verify:phase76h
```

It verifies that the chat input area itself shows the current model, whether it
has passed a model probe, and whether the choice is remembered for the current
browser. The “配置模型” button beside the input opens the same chat-native model
wizard, and one-click apply/probe syncs the result back to the composer.

```powershell
cmd /c pnpm verify:phase76i
```

It verifies that the chat input hint behaves like a small pre-send guide: empty
input, typed input, model checking, model probe success/failure, and active
generation each show a clearer next-step prompt without changing the chat route
or provider configuration.

```powershell
cmd /c pnpm verify:phase76j
```

It verifies that the header provider dropdown no longer dominates the first
screen. The same `provider-select` is still present, but it is collapsed behind
a lightweight “模型设置” entry unless the user explicitly opens it.

```powershell
cmd /c pnpm verify:phase76k
```

It verifies that the chat input action area stays lightweight for daily use:
upload remains visible, clear-chat is tucked behind a “更多” menu, and
stop-generation only appears while an answer is actively being generated.

```powershell
cmd /c pnpm verify:phase76l
```

It verifies that file upload feels chat-native: after a file is loaded, the
chat shows a readable knowledge-base receipt, the input placeholder/hint tell
the user they can ask about the uploaded file, and the next chat retrieves the
uploaded content through the existing RAG stream.

```powershell
cmd /c pnpm verify:phase76m
```

It verifies that Web chat citations feel like readable knowledge hits: each
card shows source/document metadata, score, matched terms, score breakdown, and
highlighted snippets. This is UI polish only and does not change the default
NVIDIA `/chat` lane, knowledge retrieval contract, backend routes, provider
execution, or infrastructure provisioning.

The enterprise aggregate check is:

```powershell
cmd /c pnpm verify:enterprise
```

It only chains Phase 32A through Phase 48A enterprise checks and does not add a
second enterprise implementation path or release automation path.

Phase 39A adds the deployment-facing runbook and safe environment template:

```text
docs/ENTERPRISE_DEPLOYMENT_RUNBOOK.md
docs/ENTERPRISE_HANDOFF_MANIFEST.md
docs/ENTERPRISE_ACCEPTANCE_REPORT.md
.env.enterprise.example
```

Use them to prepare enterprise startup configuration, secret handling,
knowledge persistence, optional vector/pgvector settings, backup paths, and
go/no-go checks. They are documentation/template artifacts only; they do not
add a new command family or claim SSO/IAM, SIEM, infrastructure provisioning,
or release automation is complete.

## Daily Operation

Start and inspect:

```powershell
cmd /c pnpm dev:phase7b
cmd /c pnpm status:phase10a
cmd /c pnpm health:phase12a
cmd /c pnpm logs:phase16a
```

Self-check and cleanup:

```powershell
cmd /c pnpm doctor:phase13a
cmd /c pnpm idle:phase15a
cmd /c pnpm status:phase10a
```

Restart only when needed:

```powershell
cmd /c pnpm restart:phase11a
```

Open the Web console after startup:

```text
http://127.0.0.1:3100/ui
```

The Web console is static HTML/CSS/JS served by `ai-gateway-service`. It is now
Chat-first: prompts call `/chat/rag`, local knowledge retrieve results are
returned as references, and workflow automation is limited to the Phase 30A
safe local loop. The loop can retrieve local knowledge, compose a report, and
write one managed artifact; it does not execute arbitrary commands or scan
arbitrary files.
It also calls health and knowledge APIs, including bounded document file
import through `POST /knowledge/load/file`. The parser supports
text-like files, PDF, Word `.docx`, and Excel `.xls` / `.xlsx` up to 100MB per
file; legacy binary `.doc` is not part of the minimal parser.

## Knowledge Use

The default knowledge path is local keyword retrieval:

```powershell
cmd /c pnpm verify:phase21
cmd /c pnpm verify:phase22
```

The service exposes:

- `GET /knowledge/health`
- `GET /knowledge/sources`
- `GET /knowledge/infra/readiness`
- `POST /knowledge/load`
- `POST /knowledge/retrieve`

Load requests use a bounded source/document shape with `sourceId`,
`documentId`, `title`, `content` or `text`, and `metadata`. Retrieval remains
keyword mode unless a future explicit mainline changes it.

## Local Keyword Mode

Default knowledge mode is:

- `mode: local-keyword`
- `storage: in-memory` for isolated verification services
- `storage: file-sqlite` for managed daily startup through `dev:phase7b`
- `embedding: not-configured`
- `retrieveMode: keyword`

This mode is safe for daily use and does not require external embeddings,
vector databases, or pgvector.

## Local Durable Persistence

Managed daily startup now enables local durable knowledge persistence:

```powershell
cmd /c pnpm dev:phase7b
cmd /c pnpm verify:phase27
```

Unless overridden, `dev:phase7b` sets `KNOWLEDGE_STORAGE_MODE=file-sqlite` and
uses `.data/knowledge` for imported knowledge documents. The service writes
uploaded/imported documents to both `knowledge-documents.json` and
`knowledge-documents.sqlite`, then restores them on the next service start.
This means documents imported through the Web chat/file import path survive a
service restart and machine reboot when using the managed default startup.

## Explicit Vector Mode

Vector production readiness is explicit and off the default path. Set the
required external configuration before running:

```powershell
$env:KNOWLEDGE_INFRA_MODE='vector'
$env:KNOWLEDGE_EMBEDDING_PROVIDER='<provider>'
$env:KNOWLEDGE_EMBEDDING_MODEL='<model>'
$env:KNOWLEDGE_EMBEDDING_API_KEY='<secret>'
$env:KNOWLEDGE_VECTOR_STORE='pgvector'
$env:PGVECTOR_CONNECTION_STRING='<postgres-pooler-uri>'
$env:PGVECTOR_TABLE='knowledge_chunks'
$env:KNOWLEDGE_VECTOR_NAMESPACE='default'
cmd /c pnpm verify:phase23
```

Phase 23Z has passed with real Gemini embedding plus pgvector
write/read/retrieve when those prerequisites are present. Secrets must stay in
the shell environment and must not be committed.

## Boundaries

This delivery state now includes bounded minimum loops for streaming chat,
multi-provider visibility/selection, retryable fallback execution, dashboard,
heuristic evaluation/scoring, long-term memory, explicit text connector import,
optional auth/tenant headers, and query-time graph retrieval. It still does
not complete or enter:

- DataEyes
- enterprise multi-provider management
- enterprise fallback policy/governance
- enterprise evaluation platform
- enterprise governance/dashboard beyond the Phase 32A-36A protected-route,
  console, security hardening, local managed-token, and audit evidence
  foundation
- unbounded production RAG platform
- full production GraphRAG
- cross-session memory governance beyond the local knowledge-backed memory path
- full auth/tenant/IAM beyond the Phase 32A-35A token/RBAC/audit/security
  hardening/local lifecycle foundation
- external connector crawling/sync
- streaming platform infrastructure
- release automation

Knowledge remains separate from the default `/chat` NVIDIA lane. The bounded
`/chat/rag` entry may retrieve local knowledge and pass citations into the
gateway provider path, but it does not add full production GraphRAG, arbitrary
external connector crawling, or full tenant auth.

## Defect Report Template

Use one concrete report at a time:

```text
Reproduction command:
Actual failure:
Expected behavior:
Single failure point:
Key output:
```
