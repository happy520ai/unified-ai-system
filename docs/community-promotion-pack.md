# Community Promotion Pack

## 1) 60-Second Prompt Enhancement

```text
If your team uses AI tools but prompt quality is unstable, this is a quick proof:

docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.6.0 pnpm gateway demo "Build a small API for my team" --enhance --profile coding --evidence

What you should see:
- no API key required
- the original request preserved alongside an enhanced prompt
- assumptions, constraints, outputs, and ambiguity questions
- a shareable evidence packet with detected signals and compiled sections

Repo: https://github.com/happy520ai/unified-ai-system
```

## 2) Prompt Enhancement

~~~~text
Want rough language to become executable tasks?

docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.6.0 pnpm gateway demo "Build a small API for my team" --enhance --profile coding --evidence

This is a no-clone, no-API-key first run. The container exits after printing
the result.

Windows PowerShell request-file path:

```powershell
Get-Content .\request.txt -Raw |
  docker run --rm -i ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.6.0 `
    pnpm --silent gateway demo --enhance --profile planning --language en --json
```

This converts intent into:
- assumptions
- constraints
- expected outputs
- questions for ambiguity
- detected signals and compiled sections for review

Repo: https://github.com/happy520ai/unified-ai-system
~~~~

## 3) Python Standard Library

```text
Prefer Python? After starting a local gateway, run:

python docs/examples/prompt-enhancement.py "Help me plan a small API for my team" --profile planning --language en

This uses only Python's standard library and prints a deterministic JSON
response. Check data.metadata.providerCalled=false; no provider key is needed.

Repo: https://github.com/happy520ai/unified-ai-system
```

## 4) C# / .NET Standard Library

```text
Prefer C# or .NET? After starting a local gateway, run:

dotnet run --project docs/examples/prompt-enhancement.csproj -- "Help me plan a small API for my team" --profile planning --language en

This uses only HttpClient and System.Text.Json. It checks provider-free health,
preserves the original request, and exits non-zero unless the response proves
providerCalled=false, credentialRequired=false, and deterministic=true.

Repo: https://github.com/happy520ai/unified-ai-system
```

## 5) Codex / MCP

```text
Want to verify the gateway inside Codex?

codex mcp add unified-ai-system -- docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.6.0

Restart Codex, run /mcp verbose, and confirm the twelve published tools. Then
use gateway_prompt_enhance for a provider-free natural-language test.

Guide: https://happy520ai.github.io/unified-ai-system/codex-mcp-docker-quickstart.html
Chinese guide: https://happy520ai.github.io/unified-ai-system/codex-mcp-docker-quickstart.zh-CN.html
Usage report: https://github.com/happy520ai/unified-ai-system/issues/new?template=usage-verification-report.yml
Repo: https://github.com/happy520ai/unified-ai-system
```

## 6) Conversion CTA

```text
If this helped you, share one reproducible output line, then:
1) Star: https://github.com/happy520ai/unified-ai-system
2) Submit OS + output through the structured Usage Report:
   https://github.com/happy520ai/unified-ai-system/issues/new?template=usage-verification-report.yml
3) Ask one teammate to run the same command once

docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.6.0 pnpm gateway demo "Build a small API for my team" --enhance --profile coding --evidence
```

## 7) Follow-up Reply

```text
Thanks for trying it.
- If output looks good, I'll publish a follow-up fix within 24h.
- If anything is unclear, please submit OS + output through the structured Usage Report:
  https://github.com/happy520ai/unified-ai-system/issues/new?template=usage-verification-report.yml.

Repo: https://github.com/happy520ai/unified-ai-system
```

## 8) Directory Submission

For MCP discovery directories, submit only the public repository name, URL,
and an accurate description. Never include provider keys, `.env` contents,
private authorization records, or raw webhook data.

Suggested public submission:

```text
Name: Unified AI System MCP Gateway
URL: https://github.com/happy520ai/unified-ai-system
Description: Self-hosted MCP and AI gateway for Codex, Cursor, and Cline. It turns ordinary language into structured prompts locally, exposes MCP tools, and keeps provider calls explicit. The first run is provider-free and requires no API key.
```

Free public submission forms currently available include:

- MCP Server Directory: https://mcpserver.cc/submit
- Awesome MCP Servers: https://mcpservers.org/submit

For Awesome MCP Servers, choose the free listing. The site also offers a paid
review upgrade, but it is not required for an open-source submission.

An HTTP success response means the entry was submitted for review; it does not
prove publication, traffic, or Star growth. Record the review status separately.

## Sequence Guide

1. Run `pnpm growth:campaign`.
2. Publish one English + one community post from this pack in different channels.
3. Use the `--evidence` demo path when asking for a reproducible result.
4. Reply within 24 hours.
5. Keep the generated snapshot under the ignored `.tmp/growth/` directory; do not commit metrics ledgers.

## Suggested Hashtags

- #AIInfrastructure
- #MCP
- #OpenSource
- #DeveloperTools
- #PromptEngineering
