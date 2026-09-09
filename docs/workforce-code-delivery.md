# Workforce code delivery profiles: non-executable first batch

The executor can now describe a server-configured code delivery intent. **Code delivery cannot run or receive an execution approval yet.** Its Forge implementation, approved-file validation snapshot and durable artifact runtime are not connected.

The production application does not load a new environment setting or enable a factory in this batch. Internal callers may provide `codeDeliveryProfiles` to `createControlledExecutor`; a request can select only `codeDelivery: { profileId }`. A profile, root, policy, container, callback or `ready` object supplied in request JSON grants no authority.

A valid description includes the complete frozen profile, configured repository hash, selected employee profile hash and `codeDeliveryReadiness.executionAllowed: false`. Approval, approval lookup and execution reject `WORKFORCE_CODE_DELIVERY_IMPLEMENTATION_UNAVAILABLE` before their stores, model operations or worktree creation. Both HTTP approval paths also stop before Tool Proxy admission. A description is not permission.

The profile binds exact relative read/write files, an immutable test set, baseline revision, fixed container command and digest-pinned image, no network, read-only validation and bounded resources/artifact sizes. Path and hash validation only describe intent. They do not attest filesystem ownership, a running container, current policy permission, budget availability or test success. Future validation must use a snapshot containing only the approved exact files; this profile does not authorize mounting the entire repository.

The backend employee must have at least three model requests available in its configured role limit, at least 16,384 output tokens per request, and the run limit must cover one request per selected role plus two for implementation. These are minimum configuration checks for analysis, Forge compilation and one worker; they do not guarantee completion. Existing per-role maximums are unchanged.

## Compatibility and recovery

Requests without `codeDelivery` retain the existing v1/v2/v3 approval digests and analysis behavior. Code descriptions use v4 and bind the full profile. Changing project configuration, baseline, allowed paths, verification settings or selected role profile changes that digest. The readiness projection is not an approval parameter.

The durable Agent approval serializer understands the complete new review and still rejects unknown fields or mismatched hashes. This supports contract validation; it does not permit the executor to issue code approvals. Existing records remain readable without migration or re-signing.

Before enabling the later execution batch, the CLI operator review must display the complete code scope and verification settings. Its current employee-only summary is insufficient for approving code changes. The actual Forge `orchestrate` adapter, task/Agent fences, shared role budget, per-action Tool Proxy, bounded container verification, persistent evidence and confirmed cleanup remain required.

Rollback is a source revert of this bounded addition. This batch performs no code execution, does not create code-delivery worktrees or approvals, and adds no database migration. Do not delete existing approval records or user data to roll it back.

## Language Selection

Workload: canonicalize an untrusted selector and a server configuration into a typed, immutable approval contract, then stop unavailable execution before effects.

New validation and public contracts use TypeScript; existing executor and HTTP ESM files receive only their local integration changes. No new runtime language, dependency, service or generalized execution API is introduced.

| Option | Domain fit | Maintenance | Operability | Safety | Migration | Ecosystem | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| TypeScript for the new validator/contracts | 5 | 5 | 5 | 5 | 5 | 5 | 30 |
| ESM JavaScript for the new validator | 5 | 4 | 5 | 3 | 5 | 5 | 27 |

These are design scores, not performance measurements. TypeScript keeps the shared review and the persisted parser aligned; retaining small ESM call-site edits avoids an unrelated module rewrite.

The file-count and net-line review thresholds are necessary: the same contract crosses the profile parser, descriptor, executor, two HTTP approval paths, persisted approval validation and two shared type modules. Direct profile/store and real HTTP refusal tests cover these boundaries. The implementation is still only the first batch; module checks and repository gates must be reported separately, and no result here proves code delivery or production readiness.
