# Phase653 Natural Language Neurogenesis Compiler

The compiler is deterministic and local. It maps simple natural-language requests into structured capability specs without model calls.
Fixtures cover risk classification, God Mode need detection, context compression, rollback advice, and disabled-capability explanations.

## Safety Boundary

- Dry-run / preview only; this is not production runtime enablement.
- No Provider call is made.
- No secret, auth.json, webhook, or raw base_url is read or printed.
- Codex config and Codex base_url are not modified.
- `/chat`, `/chat-gateway/execute`, provider runtime, and CredentialRef logic stay unchanged.
- No deploy, release, tag, artifact upload, push, or commit is performed.
- Capability runtime auto-enable is blocked; human approval is required before any future runtime use.
