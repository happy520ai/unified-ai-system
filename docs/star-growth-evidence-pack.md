# Star Growth Evidence Pack

Use this file as the single source of truth for public growth evidence.

## Repository Snapshot

- Repository: https://github.com/happy520ai/unified-ai-system
- Snapshot date: 2026-08-08
- Source of truth: `gh api repos/happy520ai/unified-ai-system --jq ...`

## Current Public Signals

- Stars: 3
- Forks: 1
- Watchers: 0
- Open issues (non-PR): 4
- Open pull requests: 4
- Latest release: v0.4.1
- MCP official registry entry: [v0.4.1](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.happy520ai%2Funified-ai-system/versions/0.4.1)

## How We Prove Growth

We only publish evidence we can reproduce:

- 60-second demo command output
- one week-over-week metric snapshot
- one usage verification report
- one fix or clarification based on feedback
- one outbound channel update
- one feedback table refresh: `docs/star-growth-feedback.md`

Update command:

```sh
pnpm growth:campaign
```

or:

```sh
pnpm growth:feedback
```

For evidence-pack maintenance:

```sh
pnpm growth:evidence-pack
```

## Weekly Evidence Checklist

1. Run:

   ```sh
   pnpm growth:campaign
   ```

2. Save one fresh command output or screenshot.
3. Run `pnpm growth:feedback` if there is new feedback to record.
4. Run `pnpm growth:evidence-pack` after you have a fresh update to append.
5. Save the updated values from `docs/star-growth-check.md` in this file.
6. Post one short status update with the current repo metrics and one next action.
7. Close the loop on any pending comments from community posts.

## Weekly Status Log

### 2026-08-03

- Issue #20 opened as the public verification thread.
- Campaign updates were published to keep the repo entry point visible.

### 2026-08-08

- Current public snapshot verified at 3 stars / 1 fork / 0 watchers / 4 open issues / 4 open PRs.
- The public thread remains open for reproducible output and follow-up feedback.

## Monthly Update Template

```text
## YYYY-MM-DD

## Repo
- Stars: <count>
- Forks: <count>
- Watchers: <count>

## Evidence
- External mentions: <links / channels>
- Reproducible outputs received: <count>
- User stories collected: <count>
- Code/docs changes shipped from feedback: <count>

## Actions
- Next priority:
- Blockers:
```

## Where to publish updates

- GitHub Discussion, if available
- Project Issues / discussion in this repo
- One technical community thread in English or Chinese
