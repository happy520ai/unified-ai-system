# Contributing

Thank you for helping build an open control plane for models, agents, tools,
knowledge, and governed automation.

## Start Here

1. Search existing issues and discussions before opening a new thread.
2. Use Discussions for questions, ideas, and early design exploration.
3. Use Issues for reproducible bugs and scoped implementation work.
4. Keep pull requests focused, reviewable, and tied to an observable outcome.

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
- Workbench usability and accessibility
- Deployment, observability, examples, and documentation

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

## Pull Requests

A useful pull request explains:

- the user or operator problem;
- what changed and why;
- how the behavior was verified;
- any safety, compatibility, or migration impact;
- screenshots for visible Workbench changes.

By contributing, you agree that your contribution is licensed under
[Apache-2.0](LICENSE).
