# Phase328D User-Owned Provider Guarded Beta Design

Phase328D adds credential vault adapter interfaces and user-owned provider governance checks.

Non-NVIDIA real calls stay disabled unless all guarded beta requirements pass:

- `PHASE328D_GUARDED_REAL_CALLS=1`
- provider is user-owned
- provider is enabled
- provider allows real calls
- governance stage allows guarded test or limited beta
- credentialRef exists
- credentialRef resolves without exposing secret value
- request contains no secret value

This phase does not store or print secret values.
