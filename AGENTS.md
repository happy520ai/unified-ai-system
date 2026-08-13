# Repository Guidance

## Ownership

- `apps/agent-console` owns operator interaction.
- `apps/ai-gateway-service` owns gateway runtime and Workbench behavior.
- `packages/shared-contracts` owns public protocol types.
- `packages/shared-sdk` owns reusable clients and adapters.
- `packages/shared-config` owns shared configuration.
- `packages/shared-utils` owns implementation-neutral helpers.

## Language and Module Policy

- For new changes, `apps/agent-console` and `apps/ai-gateway-service` should
  prefer TypeScript for runtime behavior and refactors.
- `packages/*` should remain TypeScript-first for contracts, SDKs, shared engines,
  and utility layers.
- Tooling scripts under `tools/*.mjs` should remain Node.js ESM JavaScript.
- Use JSON for schema and contract payloads, and Markdown for runbooks,
  evidence, and operator documentation.
- Introducing a new runtime language (for example Go or Rust) requires a measured
  rationale, migration boundary, and compatibility plan in the PR.
- For every PR that touches runtime code or scripts, follow
  [Language Selection Playbook](/docs/language-selection-playbook.md):
  define the workload, compare alternatives, document why the selected language is
  the best fit, and capture rollback/compatibility impact.  
  PRs that do not include a `Language Selection` section using the playbook
  checklist are not considered merge-ready.

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
