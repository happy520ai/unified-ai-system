# Phase672 Runtime Failure Injection + Kill Switch

Phase672 injects controlled sandbox failures for:
- runtime timeout
- budget exceeded
- verifier failed
- unsafe manifest
- secret-like output
- recursive spawn attempt
- missing rollback plan

Each failure writes disabled evidence under `capabilities/_runtime_disabled/` and stops execution.

Global disable flag reference:
`TAIJI_BEIDOU_AUTO_RUNTIME_ENABLED=false`

This is a dry-run policy reference only. The phase does not modify real environment variables.
