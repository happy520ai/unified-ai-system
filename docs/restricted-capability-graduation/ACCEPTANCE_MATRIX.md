# Phase3981A Acceptance Matrix

| capabilityId | first real acceptance | max first-run blast radius | evidence required | pass condition | blocker condition |
| --- | --- | --- | --- | --- | --- |
| workforce.multi_agent.execution | Run 1-3 workers against a bounded low-risk task, collect per-worker result, aggregate output, stop on first failed worker, and write evidence. | 1-3 workers, one bounded task, no 144-worker fanout | result.json plus command log summary, no raw secret | bounded real run completed and verifier passes | approval missing, limit exceeded, secret exposure risk, route mutation risk, verifier failure |
| gvc.automatic_repair_cycle | Select one low-risk file, run preflight, apply a minimal repair, run verifier, and write rollback evidence. | one low-risk file, one repair, rollback hash required | result.json plus command log summary, no raw secret | bounded real run completed and verifier passes | approval missing, limit exceeded, secret exposure risk, route mutation risk, verifier failure |
| provider.multi_provider.real_call | Perform one bounded smoke per approved provider through CredentialRef, record HTTP/provider status without raw secret, stop on timeout/rate-limit/failure. | maxRequests=1 per approved provider for first smoke | result.json plus command log summary, no raw secret | bounded real run completed and verifier passes | approval missing, limit exceeded, secret exposure risk, route mutation risk, verifier failure |
| mode.normal_god_tianshu.runtime | Run one isolated Normal, God, and Tianshu route smoke; verify mode label, route decision, evidenceId, and no default chat behavior change. | isolated non-default route or command only | result.json plus command log summary, no raw secret | bounded real run completed and verifier passes | approval missing, limit exceeded, secret exposure risk, route mutation risk, verifier failure |
| nightly.scheduler.real_registration | Register Windows Task Scheduler entry, run once, intake sanitized scheduler result, verify scheduledTaskRegistered=true only from result evidence. | one local Windows scheduled task, manual unregister path | result.json plus command log summary, no raw secret | bounded real run completed and verifier passes | approval missing, limit exceeded, secret exposure risk, route mutation risk, verifier failure |

## Required Verification Chain

- `node --check tools/phase3981a/generate-restricted-capability-graduation.mjs`
- `node --check tools/phase3981a/verify-restricted-capability-graduation.mjs`
- `pnpm run run:phase3981a-restricted-capability-graduation`
- `pnpm run verify:phase3981a-restricted-capability-graduation`
- `pnpm run verify:phase3977c-mimo-credentialref-resolver-contract`
- `pnpm run status:phase3979a-opencode-autopilot`
- `pnpm run verify:phase3979a-opencode-autopilot-governor`
- `pnpm -r --if-present check`
