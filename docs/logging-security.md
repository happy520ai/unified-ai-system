# Logging security and resource bounds

Gateway logs are an operational signal, not a second copy of request data.
Logging must remain safe when callers control headers, prompts, provider IDs,
model IDs, URLs, errors, and nested tool payloads.

## Runtime contract

- Request and response body logging is disabled by default.
- Explicit body previews pass through the shared recursive sanitization policy
  before truncation.
- Authorization, cookie, API-key, token, password, secret, credential, private
  key, and master-key fields are replaced with `[REDACTED]`.
- Bearer values, common provider-key forms, JWT-shaped values, AWS access-key
  IDs, and secret-bearing URL query parameters are also redacted from free
  text.
- Object depth, collection size, string length, Buffer rendering, and circular
  references are bounded.
- Identity logging is separately opt-in. The default ledger omits user agent,
  client IP, and user ID.
- Usage records carry a tenant ID. Tenant-facing summary, log, and metrics
  routes always query the authenticated tenant.
- Public health data reports storage mode and byte counts, never an absolute
  log directory.

## Resource contract

- The active request-log file defaults to 16 MiB and is capped at 1 GiB even
  when configured.
- One bounded rotation is retained for the current day.
- Daily files default to seven days of retention; configuration is clamped to
  1 through 90 days.
- Reads load only a bounded tail from the active and rotated files.
- Query limit and offset are bounded to 10,000 records.
- If local storage is disabled or unavailable, at most 200 records remain in
  memory.
- `close()` removes timers and process listeners, preventing logger-instance
  leaks in embedded runtimes and tests.

These limits control gateway-owned files. External log collectors must enforce
their own retention, encryption, tenant access, and deletion policies.

## Backup and restore boundary

Enterprise backup artifacts contain audit events and password/token hashes.
New files use owner-only POSIX mode as defense in depth. The current restore
surface validates a backup but does not apply state. Any future state-applying
restore must add authenticated backup envelopes, anti-rollback/version checks,
atomic application, an approval boundary, and adversarial restore tests before
it is enabled.

## Language Selection

- **Workload:** recursive untrusted-value sanitization shared by Pino, request
  ledgers, provider errors, and future agent/tool logs.
- **Primary path:** TypeScript policy with focused adapters in existing
  JavaScript loggers.
- **Alternatives considered:** local JavaScript regexes duplicate policy and
  miss nested values; a Rust logging sidecar adds serialization and deployment
  overhead while secrets would still cross the Node boundary.
- **Chosen language:** TypeScript. Domain fit 5/5, maintenance 5/5,
  operability 5/5, safety 4/5, migration debt 5/5, ecosystem fit 5/5.
- **Compatibility/rollback boundary:** log method names and usage response
  shapes remain; body and identity previews become explicit opt-ins, health
  omits host paths, and tenant routes return only caller-scoped records.
- **Policy impact:** no provider execution, fake-provider behavior, or public
  prompt contract changes.
- **Quantified risk mitigation:** sanitizer attack tests, Pino serialization
  tests, body opt-in tests, tenant-isolation tests, bounded persistence tests,
  focused Vitest, and all repository release gates.
