# Phase604R-Fix One-Shot Evidence Preservation

## Preservation Goal

Phase604R-Fix preserves the observed result of the first Phase604 custom provider one-shot
attempt without executing another one-shot request.

The first observed one-shot attempt is recorded in Phase604R-Fix evidence as:

- `firstOneShotAttemptPreserved=true`
- `firstOneShotStatus=failed`
- `firstOneShotBlocker=custom_provider_one_shot_failed`
- `firstOneShotRootCause=stdin_is_not_a_terminal`

## Second Verify Context

After the first one-shot failure, a later Phase604 aggregate verification was run while the
confirmation JSON contained a UTF-8 BOM. Because the loader did not strip the BOM, that run
blocked before negative-control or one-shot execution.

Phase604R-Fix records that later verify behavior as:

- `secondVerifyDidNotExecuteOneShot=true`
- `secondVerifyBlockedByBomParse=true`
- `noAdditionalRequestMade=true`
- `requestAttemptCountIncreaseDetected=false`

## Non-Rerun Policy

This fix must not execute:

- bad model_provider negative-control
- custom provider one-shot
- real provider requests
- relay or proxy startup

The only executable validation in this phase is local loader/verifier validation plus the
requested non-provider safety regressions.

