# Repository Guidance

## Ownership

- `apps/agent-console` owns operator interaction.
- `apps/ai-gateway-service` owns gateway runtime and Workbench behavior.
- `packages/shared-contracts` owns public protocol types.
- `packages/shared-sdk` owns reusable clients and adapters.
- `packages/shared-config` owns shared configuration.
- `packages/shared-utils` owns implementation-neutral helpers.

## Public Repository Rules

- Keep application entrypoints under `apps/`.
- Keep reusable contracts, SDKs, configuration, and engines under `packages/`.
- Do not add generated phase ledgers, one-off verifier trees, or committed
  runtime evidence to `master`.
- Generated evidence belongs under `apps/ai-gateway-service/evidence/` and is
  ignored except for its README.
- Historical engineering artifacts belong on the archive branch, not in the
  public product tree.
- Do not recreate `legacy/`.

## Safety

- Never read, print, or commit provider keys, `.env`, raw webhooks, or private
  authorization records.
- Real provider calls require explicit scoped authorization.
- Keep the local fake provider as the credential-free default.
- Do not silently modify `/chat`, provider selection, deployment, or release
  behavior.
- Do not claim production readiness, L5 autonomy, or AGI without independent
  evidence.

## Change Discipline

- Keep changes focused, reversible, and consistent with existing ownership.
- Do not delete runtime code merely because a filename looks old.
- Use structured parsers for JSON and configuration changes.
- Preserve user changes in a dirty worktree.

## Required Checks

Run these before publishing:

```bash
pnpm check
pnpm test
pnpm check:public
pnpm verify:public-clone
```

The public-clone verifier must run without credentials and must leave no
service process behind.
