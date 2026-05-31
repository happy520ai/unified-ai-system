# Phase328D Guarded Real Call Policy

Default state: blocked.

Real non-NVIDIA provider calls require an explicit guarded switch and complete user-owned provider configuration.

Blocked requests record safe evidence with `providerCallsMade=false` and `secretValueExposed=false`.
