# Phase604R-Fix Final Confirmation BOM-safe Loader

## Scope

Phase604R-Fix repairs the Phase604 final confirmation loader so a UTF-8 BOM at the start of
`docs/phase604-final-execution-confirmation.input.json` does not make an otherwise valid
confirmation unreadable.

This fix is loader-only. It does not rerun the Phase604 bad model_provider negative-control,
does not rerun the Phase604 custom provider one-shot, does not call a provider, and does not
write persistent Codex config.

## Loader Behavior

- Read the confirmation JSON as UTF-8 text.
- Strip only a leading UTF-8 BOM with `text.replace(/^\uFEFF/, "")`.
- Parse the stripped text.
- Record `bomStripped=true` when a BOM was removed.
- Record `parseErrorReason` when JSON parsing fails.
- Classify JSON parse failures as `final_confirmation_invalid`.
- Do not misclassify JSON parse failures as `provider_call_not_authorized_for_one_shot`.

## Safety Boundary

- `authJsonRead=false`
- `authJsonTouched=false`
- `providerCallsMade=false`
- `userCodexConfigModified=false`
- `projectCodexConfigModified=false`
- `chatModified=false`
- `chatGatewayExecuteModified=false`
- `deployExecuted=false`
- `releaseExecuted=false`
- `tagCreated=false`
- `pushExecuted=false`
- `commitCreated=false`
- `workspaceCleanClaimed=false`

## Verification

The Phase604R-Fix verifier creates temporary BOM and invalid JSON fixtures under the
Phase604R evidence directory, validates loader behavior, removes the fixtures, and writes:

`apps/ai-gateway-service/evidence/phase604r/final-confirmation-bom-safe-loader-result.json`

