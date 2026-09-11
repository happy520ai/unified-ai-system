# Native protected PoP replay storage

The optional Windows profile connects the existing protected authority service to
the gateway's SQLite PoP replay guard. It uses a schema-4 checkpoint, durable
mutation intent and fresh native challenge before and after each replay consume.
`memory` and ordinary `sqlite` configurations retain their existing behavior.
This profile is single-host; it does not satisfy distributed replay requirements.

## Configure and enroll

First install or upgrade a separately verified authority package using the
[Windows maintenance guide](local-client-windows-authority-maintenance.md).
The gateway never installs or elevates the service. Use the actual installation's
bound operator identity. The addon is trusted native code: its configured hash
must come from the verified package's `bin/local-client-authority.node` entry.
That addon hash does not replace the full installed-package/SCM/ACL verification.

Keep the gateway's existing loopback client configuration and registry integrity
secret reference. Select these additional settings in the same process environment:

```text
AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_STORE_MODE=sqlite
AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_PROTECTION_MODE=windows-native
AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH=<absolute path to a dedicated replay.sqlite>
AI_GATEWAY_LOCAL_CLIENT_HOST_ID=<stable configured host ID>
AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_NAMESPACE=local-client-pop-replay
AI_GATEWAY_LOCAL_CLIENT_NATIVE_AUTHORITY_ADDON_PATH=<ProgramData>/UnifiedAISystem/LocalClientAuthority/bin/local-client-authority.node
AI_GATEWAY_LOCAL_CLIENT_NATIVE_AUTHORITY_ADDON_SHA256=<verified addon SHA-256>
```

Keep any configured capacity and busy-timeout values identical during enrollment
and gateway startup. Other state stores must use different paths. Registry secret
references retain the existing `hex:` byte format; no key value belongs in this
document, arguments, command output or an evidence report. The management command
uses the same reference resolver and registry/replay HMAC domains as the gateway.

For a new protected store, explicitly enroll its generation-one baseline from
the gateway's working directory and environment:

```powershell
node tools/local-client-native-pop-replay.mjs enroll-baseline --yes
```

Only a new store or an identical generation-one enrollment may succeed. A used
generation, changed identity/key/namespace/configuration or conflicting native
checkpoint is rejected. The command returns checkpoint hashes and generation;
it does not print keys or raw checkpoint content. An unconfirmed result requires
inspection before an explicit retry. No command resets a store or an anchor.

Schema-3 databases are not migrated or silently upgraded. Do not point this mode
at an active legacy store, delete a database, or create a new replay namespace to
evade a retained nonce. Existing deployments need a separately reviewed transition
that preserves outstanding proof validity and replay history. This implementation
provides new protected-store enrollment, not a general schema-3 migration.

## Startup, expiry and recovery

The synchronous application constructor receives an initially unavailable native
runtime. Only that module's private source marker allows it through the identity
constructor; arbitrary unavailable or lookalike guards remain rejected. No ready
or protected status is reported until recovery and challenge validation succeed.

Ordinary startup requires an existing, nonempty schema-4 main database header.
It never enrolls a baseline or creates a missing database/parent. It checks file
identity again after asynchronous native bootstrap and opens existing storage
using SQLite's [`mode=rw` URI option](https://sqlite.org/uri.html). It reads the
header directly for preliminary validation because a read-only WAL connection
can still create auxiliary files; see [SQLite WAL behavior](https://sqlite.org/wal.html#read_only_databases).
An interrupted initial enrollment whose main header has not reached schema 4
requires explicit operator reconciliation, not automatic adoption.

Idle native observations expire. For a server-bound protocol caller, the gateway
prepares or refreshes the configured native runtime before checking every existing
dispatch blocker and then verifies the PoP signature/raw request. Wrong or missing
server bindings cannot trigger that preparation. The replay consume itself still
performs fresh before/after attestation; a readiness boolean never replaces it.

After a consume failure, that consume is not retried. Its old native/SQLite
connection is closed and remains unavailable. A later preparation may bootstrap a
new service instance and reconcile already recorded state before a new request.
It cannot reset a rollback, mismatched key, missing state or unconfirmed cleanup.
Stop and inspect an unconfirmed cleanup; queued recovery cannot bypass that state.
Closing waits for outstanding initialization/operations and clears the retained
reconnection key. A late completion cannot publish ready after close.

## Language Selection and validation boundaries

This is bounded TypeScript composition of the existing native transport, SQLite
coordinator and identity/HTTP gates. The shared configuration module is necessary
to keep startup and explicit enrollment on identical settings and key domains.
The management entry remains Node.js ESM. No dependency, daemon, database format
or generic capability framework is added. The file-count/500-line review points
are necessary for those existing cross-module initialization gates, asynchronous
ownership, the explicit command and their actual integration tests.

Rollback restores the source/configuration selection while retaining all state.
A protected schema-4 store cannot be reopened as an ordinary schema-3 store, and
the authority protocol floor/keys must not be deleted. Keep existing data and use
the reviewed native maintenance path when changing installed packages.

Tests distinguish the actual TS/temporary SQLite chain with a modeled native API,
private command/HTTP routing controls and linked native packages from installed
Windows operation. SQLite existing-only URI behavior was checked on Windows
Node 25.8.1 and a pinned Linux Node 22.23.2 container. These checks do not establish
real SCM/ACL/DPAPI durability, native throughput, a real Provider call or production
readiness; those acceptance layers remain separate.
