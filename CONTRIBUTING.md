# Contributing

Thank you for helping build an open control plane for models, agents, tools,
knowledge, and governed automation.

## Start Here

New contributors can start by submitting a [structured usage report](https://github.com/happy520ai/unified-ai-system/issues/new?template=usage-verification-report.yml), joining a [GitHub Discussion](https://github.com/happy520ai/unified-ai-system/discussions), or browsing the [open good first issues](https://github.com/happy520ai/unified-ai-system/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22good%20first%20issue%22).
When a first-run command fails, capture the details using the [first-run troubleshooting matrix](docs/first-run-troubleshooting.md) before opening an issue.

1. Search existing issues and discussions before opening a new thread.
2. Use Discussions for questions, ideas, and early design exploration.
3. Use Issues for reproducible bugs and scoped implementation work.
4. Keep pull requests focused, reviewable, and tied to an observable outcome.

## First Contribution Path

Use this short path when you want to make a first change without learning the
whole repository first:

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install --frozen-lockfile
pnpm check:public
```

Choose one bounded task:

- A [structured usage report](https://github.com/happy520ai/unified-ai-system/issues/new?template=usage-verification-report.yml) adds a reproducible environment, output line, or first-run correction.
- A focused [good first issue](https://github.com/happy520ai/unified-ai-system/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22good%20first%20issue%22) adds a small, reviewable improvement.

Before opening a pull request, run the focused check for your change and then
the four repository gates below. Keep the default fake provider enabled; no
API key or real provider call is needed for these contribution paths.

## Local Development

Requirements:

- Node.js 20 or newer. Node.js 22 is recommended.
- pnpm 9.15.4 or newer.

```bash
git clone https://github.com/happy520ai/unified-ai-system.git
cd unified-ai-system
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install --frozen-lockfile
pnpm verify:public-clone
pnpm start
```

The default fake provider requires no API key and makes no external provider
request.

## Good Contribution Areas

- Provider and tool adapters
- Agent protocols and workforce coordination
- Evaluation, safety, approval, and evidence systems
- Knowledge, memory, retrieval, and context shaping
- Terminal CLI and future TUI workflows
- MCP tools, host compatibility, and protocol-level verification
- Deployment, observability, examples, and documentation

For provider-specific work, start with the
[provider adapter contribution guide](docs/provider-adapter-contribution.md).
It explains the current adapter contract, runtime registration path, safe
testing pattern, and review checklist.

## Safety Boundaries

- Never commit `.env`, provider keys, tokens, raw webhooks, or private
  authorization records.
- Keep the local fake provider as the credential-free default.
- Real provider calls require explicit, scoped authorization.
- Do not silently change `/chat`, provider selection, deployment, or release
  behavior.
- Do not claim production readiness, L5 autonomy, or AGI without independent
  evidence.
- Generated runtime evidence does not belong on `master`.

## Language and Module Ownership

- `apps/ai-gateway-service` and `apps/agent-console` changes should prefer
  TypeScript for new work; existing JavaScript code paths are permitted during
  migration and should be modernized with incremental PRs.
- `packages/*` should remain TypeScript-first for contracts, SDKs, helpers, and
  shared engines; existing JavaScript modules are acceptable while migration is
  actively tracked.
- `tools/*.mjs` should use Node.js ESM JavaScript for orchestration, quality,
  and release tooling.
- Use JSON for schema/data contracts and Markdown for evidence, runbooks, and
  protocol documentation.
- If a change introduces a new runtime language (for example Go or Rust), the PR
  must include:
  - a measured reason versus TypeScript/Node.js,
  - a boundary diagram or migration path,
  - and compatibility/safety plan for the new runtime boundary.
- Language decisions for new runtime or tooling changes should be justified with the
  [Language Selection Playbook](/docs/language-selection-playbook.md), including
  workload profile, at least one alternative language review, and rollback impact.

## Required Checks

Run all four checks before opening a pull request:

```bash
pnpm check
pnpm test
pnpm check:public
pnpm verify:public-clone
```

The clean-clone verifier must complete without credentials and leave no service
process behind.

Changes under `packages/mcp-server` must also pass `pnpm verify:mcp`.

## Pull Requests

A useful pull request explains:

- the user or operator problem;
- what changed and why;
- how the behavior was verified;
- any safety, compatibility, or migration impact;
- terminal transcripts or screenshots when visible behavior changes.

By contributing, you agree that your contribution is licensed under
[Apache-2.0](LICENSE).
