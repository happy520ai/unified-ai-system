# Phase615R-Fix Emergency Disable Plan

## Immediate Actions

- disable runtime candidate route.
- block new requests.
- preserve logs/evidence.
- mark capability as disabled.
- do not delete evidence.
- do not access auth.json.
- do not expose secrets.

## Disable Triggers

- secret exposure suspected.
- auth.json access attempted.
- Codex config write attempted.
- `/chat` route mutation detected.
- `/chat-gateway/execute` mutation detected.
- provider runtime mutation detected.
- uncontrolled provider call detected.
- timeout or invalid response in a future runtime gate.
