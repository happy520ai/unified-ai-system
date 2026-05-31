# Phase327A Secret Safety And Storage Boundary

## Rules

- do not store plaintext API Key
- do not write secrets into evidence
- do not write secrets into logs
- do not write secrets into docs examples
- do not write secrets into error messages
- allow credentialRef only
- credentialRef is not the secret
- redact every credential display

## Rotation / Revoke / Disable

Users must be able to:

- rotate credentialRef
- revoke credentialRef
- disable provider
- disable model route eligibility
- remove provider from fallback chain

## Breach Response

If secret exposure is suspected:

- disable affected provider
- rotate or revoke credentialRef
- preserve audit evidence
- run secret safety scan
- notify operator and user according to future policy

## Audit Requirements

Audit may record:

- providerId
- credentialRef type
- operation type
- actor
- timestamp
- redaction confirmation

Audit must not record secret values.

