# Phase1958P-Fix OpenRouter Owner Credential Setup

## Required Binding

- providerId: openrouter
- credentialRef: credentialRef:openrouter:default
- modelId for next one-shot: openai/gpt-4o-mini

## Owner Action

Configure the OpenRouter credential through the existing product credential configuration path or another approved CredentialRef-only setup flow. Do not paste the key into docs, evidence, chat, terminal logs, or approval text. The setup must bind the secret value to credentialRef:openrouter:default without exposing the value.

## Safety Rules

- Do not store raw keys in this repository.
- Do not include keys in JSON approval files.
- Do not print keys or authorization headers.
- Do not reuse the Phase1957P approval.
- Do not run a Provider one-shot until a fresh text approval is created after setup.
