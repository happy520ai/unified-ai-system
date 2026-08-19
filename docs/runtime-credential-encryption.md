# Runtime credential encryption

Runtime provider keys are high-value bearer credentials. This boundary keeps
them memory-only by default and uses authenticated encryption whenever an
operator explicitly enables local persistence.

## Security contract

- Default mode: `PME_RUNTIME_CREDENTIAL_STORE_MODE=memory`.
- Persistent modes: `local-file` and same-host `sqlite`.
- Cipher: AES-256-GCM with a fresh 96-bit nonce per record.
- Authentication: provider identity, schema version, and ciphertext are bound
  together; record swapping and ciphertext modification fail closed.
- Key separation: the master key is never written to the credential store.
- Failure behavior: malformed, mixed plaintext/ciphertext, wrong-key, failed
  writes, and failed deletes are errors rather than silent memory fallbacks.
- Bounds: key files are limited to 4 KiB, records to 1 MiB, provider IDs to 128
  characters, API keys to 16 KiB, and endpoints to 8 KiB.
- Metadata: provider IDs and key fingerprints remain visible. Credential
  values, endpoints, model metadata, and timestamps are encrypted.

Encryption at rest does not protect a running process from a host
administrator, debugger, memory dump, malicious dependency executing in the
gateway process, or a compromised secret manager. Those remain deployment and
supply-chain boundaries.

## Provisioning

Keep the default for ephemeral development:

```text
PME_RUNTIME_CREDENTIAL_STORE_MODE=memory
```

For encrypted JSON persistence:

```text
PME_RUNTIME_CREDENTIAL_STORE_MODE=local-file
PME_RUNTIME_CREDENTIAL_STORE_PATH=/restricted/runtime-credentials.json
PME_RUNTIME_CREDENTIAL_MASTER_KEY_FILE=/run/secrets/runtime-credential-key
```

For encrypted same-host SQLite:

```text
PME_RUNTIME_CREDENTIAL_STORE_MODE=sqlite
PME_RUNTIME_CREDENTIAL_STORE_PATH=/restricted/runtime-credentials.db
PME_RUNTIME_CREDENTIAL_MASTER_KEY_FILE=/run/secrets/runtime-credential-key
```

The key must decode to exactly 32 bytes and may be canonical base64 or 64 hex
characters. An inline `PME_RUNTIME_CREDENTIAL_MASTER_KEY` is supported for
secret-manager injection. Do not commit it, print it, pass it as a command-line
argument, or place it beside a backup. Configure either the inline key or key
file, never both. On POSIX, key files with group or other permissions are
rejected.

## One-time plaintext migration

Version 1 stores contained plaintext. They are rejected by default.

1. Stop all gateway replicas that share the store.
2. Back up the old store into a separately protected, access-audited location.
3. Configure the new master key and
   `PME_RUNTIME_CREDENTIAL_ALLOW_PLAINTEXT_MIGRATION=true`.
4. Start exactly one gateway. Startup reads the legacy records and atomically
   rewrites them as version 2 ciphertext. SQLite additionally checkpoints and
   vacuums the database.
5. Stop that gateway, remove the migration flag, and restart normally.
6. Verify provider detection without making a real provider call.
7. Securely retire legacy copies and rotate provider keys if plaintext backups
   may have escaped the intended trust boundary.

Migration is deliberately not automatic. A stale plaintext file must never
silently regain authority after an upgrade.

## Master-key rotation

1. Stop writers or place every replica in the same maintenance window.
2. Set the new primary key.
3. Put the old key in
   `PME_RUNTIME_CREDENTIAL_PREVIOUS_MASTER_KEYS` for one startup. At most
   three previous keys are accepted.
4. Startup decrypts with the matching old key and atomically reseals every
   record with the new primary key.
5. Restart with only the new primary key. The old key must now fail.
6. Retire the old key through the secret manager's audited process.

Do not perform a staggered rotation where old-primary and new-primary writers
share one SQLite database. An old process cannot read records already resealed
by the new primary.

## Backup and rollback

- Back up ciphertext and the master key through separate systems and access
  policies.
- Test restore with a fake provider and an isolated store path.
- A missing or wrong key is a recovery failure, not permission to create a new
  empty persistent store.
- Rollback to memory mode is safe for availability but intentionally does not
  load persisted credentials.
- Rolling back application code to a plaintext-store release is prohibited
  while version 2 data exists. Reprovision provider credentials instead of
  decrypting them into a legacy store.

## Language Selection

- **Workload:** authenticated encryption, strict key parsing, encrypted record
  migration, and integration with the existing Node gateway store.
- **Primary path:** TypeScript security policy plus a focused adapter in the
  existing JavaScript credential store.
- **Alternatives considered:** JavaScript scored lower on typed envelope and
  error contracts; Rust scored well for memory safety but added a native build,
  FFI/key-transfer boundary, and deployment cost without isolating the Node
  process from a compromised dependency.
- **Chosen language:** TypeScript. Domain fit 5/5, maintenance 5/5,
  operability 5/5, safety 4/5, migration debt 5/5, ecosystem fit 5/5.
  JavaScript scored 24/30; Rust scored 18/30 for this in-process boundary.
- **Compatibility/rollback boundary:** memory mode remains credential-free and
  default; persistent deployments add an explicit master-key requirement and
  a one-time migration. Rollback is memory-only or provider reprovisioning.
- **Policy impact:** fake-provider defaults and public API payloads are
  unchanged. Persistent storage descriptors now report encrypted modes.
- **Quantified risk mitigation:** cipher tamper tests, wrong-key tests,
  disk-secret-search tests, plaintext rejection/migration tests, rotation tests,
  SQLite restart tests, static checks, and the repository release gates.
