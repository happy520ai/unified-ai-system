# Community Promotion Pack

## 1) 60-Second Baseline

```text
If your team uses AI tools but prompt quality is unstable, this is a quick proof:

docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.3 pnpm gateway demo

What you should see:
- no API key required for baseline
- local deterministic fake-provider path
- clear command output

Repo: https://github.com/happy520ai/unified-ai-system
```

## 2) Prompt Enhancement

```text
Want rough language to become executable tasks?

docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.3 pnpm gateway demo "Build a small API for my team" --enhance --profile coding

This is a no-clone, no-API-key first run. The container exits after printing
the result.

This converts intent into:
- assumptions
- constraints
- expected outputs
- questions for ambiguity

Repo: https://github.com/happy520ai/unified-ai-system
```

## 3) Python Standard Library

```text
Prefer Python? After starting a local gateway, run:

python docs/examples/prompt-enhancement.py "Help me plan a small API for my team" --profile planning --language en

This uses only Python's standard library and prints a deterministic JSON
response. Check data.metadata.providerCalled=false; no provider key is needed.

Repo: https://github.com/happy520ai/unified-ai-system
```

## 4) Conversion CTA

```text
If this helped you, share one reproducible output line, then:
1) Star: https://github.com/happy520ai/unified-ai-system
2) Submit OS + output through the structured Usage Report:
   https://github.com/happy520ai/unified-ai-system/issues/new?template=usage-verification-report.yml
3) Ask one teammate to run the same command once

docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.3 pnpm gateway demo
```

## 5) Follow-up Reply

```text
Thanks for trying it.
- If output looks good, I'll publish a follow-up fix within 24h.
- If anything is unclear, please submit OS + output through the structured Usage Report:
  https://github.com/happy520ai/unified-ai-system/issues/new?template=usage-verification-report.yml.

Repo: https://github.com/happy520ai/unified-ai-system
```

## Sequence Guide

1. Run `pnpm growth:campaign`.
2. Publish one English + one community post from this pack in different channels.
3. Ask for one reproducible output line.
4. Reply within 24 hours.
5. Update `docs/star-growth-checklist.md` and `docs/star-growth-evidence-pack.md`.

## Suggested Hashtags

- #AIInfrastructure
- #MCP
- #OpenSource
- #DeveloperTools
- #PromptEngineering
