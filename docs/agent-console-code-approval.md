# Reviewing code delivery in the console

`pnpm gateway agents approvals --url <gateway>` displays the complete code
delivery contract supplied by the gateway: profile and project, baseline commit,
repository and employee bindings, every exact read/write path, immutable test
hashes, the full fixed command and image digest, resource limits and artifact
limits. Commands and paths are quoted so spaces remain visible and unchanged.
The scope permits a code artifact; it does not select automatic merge.

The console independently validates the complete code and employee profile
hashes and their binding. Unknown fields, missing tests, changed settings,
unreviewable effects and unsafe terminal text are rejected before the review is
printed. `--json` returns the same complete validated contract. Unrelated
credential fields remain redacted. A readable review does not prove container
availability, approval validity or successful verification; the gateway checks
those at execution time.

## Language Selection

The workload is bounded transport validation and terminal formatting. A small
TypeScript module preserves typed parsing and explicit numeric/string limits;
the existing JavaScript CLI entrypoint keeps its imports and command behavior.
Validation stays in the console rather than importing the gateway runtime into
the client. No new dependency, service, persistence or execution command is added.
The four-file change can be rolled back by restoring the CLI/tests and removing
this helper and guide. Real child-process CLI tests cover complete 32-file scope,
a command longer than 256 characters, exact JSON, malformed hashes and signed
unsafe-text counterexamples; the full CLI suite covers existing commands.
