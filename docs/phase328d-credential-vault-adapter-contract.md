# Phase328D Credential Vault Adapter Contract

Required interface:

- `resolveCredentialRef(credentialRef)`
- `validateCredentialRef(credentialRef)`
- `redactSecret(value)`
- `auditCredentialAccess(event)`

Supported reference types:

- `env_key_name`
- `encrypted_reference`
- `vault_reference`
- `user_secret_store_reference`

MVP behavior:

- `env_key_name` resolves presence only and does not output env value
- other reference types return `CREDENTIAL_RESOLVER_NOT_IMPLEMENTED`
