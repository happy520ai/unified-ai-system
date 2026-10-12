# TasteRouter — agents, but with taste

Taste-aware agent tools for **unified-ai-system**, built for the [Qloo Agentic Hackathon 2026](https://qloo.devpost.com/).

TasteRouter gives any agent (Codex, Claude, Cursor, or the unified-ai-system gateway) a sense of what a person actually likes. Tell it a few things someone loves, and it uses **Qloo Taste AI** to plan picks across music, film, TV, books, dining, travel and brands.

## How the agent works

1. **Understand** – reads the goal ("date night", "a gift", "weekend trip") and plans which domains to query.
2. **Resolve** – turns free-text likes into Qloo entities via `GET /search`.
3. **Fan out** – calls `GET /v2/insights` per domain with `signal.interests.entities`, in parallel (dining also uses `signal.location.query`).
4. **Rank** – drops the seeds, keeps the top picks per domain.
5. **Explain** – an optional LLM (any OpenAI-compatible endpoint) writes a plan grounded only in Qloo results; otherwise a deterministic summary.

Every response includes an agent `trace` so judges can see each step.

## Run it

```bash
export QLOO_API_KEY=your-hackathon-key           # from the Qloo developer guide form
# optional LLM explanations:
export LLM_API_KEY=... LLM_BASE_URL=https://openrouter.ai/api/v1 LLM_MODEL=openai/gpt-4o-mini

node packages/taste-router/src/server.js          # demo UI on http://localhost:8787
node packages/taste-router/src/mcp.js             # MCP server over stdio
node --test packages/taste-router/test/*.test.js  # tests (no network)
```

Zero runtime dependencies; Node 20+.

## Use as an MCP tool

```json
{
  "mcpServers": {
    "taste-router": {
      "command": "node",
      "args": ["packages/taste-router/src/mcp.js"],
      "env": { "QLOO_API_KEY": "your-key" }
    }
  }
}
```

Tools: `taste_recommend` (likes, goal, domains, location, take) and `taste_resolve` (likes).

## HTTP API

`POST /api/recommend`

```json
{ "likes": ["Wong Kar-wai", "Radiohead"], "goal": "date night", "location": "Shanghai" }
```

## License

Apache-2.0, same as the rest of unified-ai-system.
