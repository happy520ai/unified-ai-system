# Prompt-Injection Trust Boundary

All message roles accepted by compatibility APIs are client controlled at the
gateway boundary. `system` and `assistant` therefore receive the same content
security inspection as `user` and `tool` before provider selection or provider
execution. A role name never grants trust.

Detection canonicalizes NFKC text, invisible formatting controls, selected
Greek/Cyrillic visual confusables, separator-obfuscated tokens, common
leetspeak, percent encoding, HTML numeric entities, escaped Unicode/hex text,
and bounded printable Base64 candidates. Only high-confidence instruction
override, policy bypass, control-token, and prompt-exfiltration rules block by
default. Error envelopes contain rule classes and roles, never the rejected
content.

## Retrieved knowledge

Knowledge records are untrusted data even when retrieval access is authorized.
Before RAG provider execution, every rendered title, snippet, and matched term
is inspected. A detection fails closed with
`RAG_CONTEXT_INJECTION_DETECTED`, citation indexes, and rule IDs; poisoned text
is not sent to a provider or echoed in the error.

Safe retrieval results are no longer concatenated into the ordinary user
question. Provider input uses three explicit messages:

1. a server-authored system policy that declares retrieval data untrusted;
2. a tool message containing structured retrieved records;
3. the original user question.

This structure reduces instruction/data ambiguity but does not make model
behavior formally safe. Deterministic detection cannot recognize every
paraphrase or future attack language. Agentic tools must still enforce
server-side authorization, approvals, least privilege, argument validation,
and dry-run defaults independently of model output.

## Language selection

The existing JavaScript guardrail and HTTP utility boundaries are modified in
place to preserve their stable runtime imports. New adversarial tests use
TypeScript. A separate classifier service in Go or Rust would add network,
deployment, credential, telemetry, and availability boundaries without a
measured need; an optional independently evaluated classifier can be added
later behind the same fail-closed interface.
