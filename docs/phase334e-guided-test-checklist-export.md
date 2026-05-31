# Phase334E Provider Onboarding Guided Test Checklist

Use credential reference names only, such as OPENAI_API_KEY. Do not enter real API key values.

## happyPathCredentialRefOnly
- expectedResult: ONBOARDING_INPUT_ACCEPTED_FOR_BACKEND_GATE
- blockedReasonExpected: none
- status: not_run

## rawSecretRejected
- expectedResult: RAW_SECRET_REJECTED
- blockedReasonExpected: RAW_SECRET_REJECTED
- status: not_run

## missingCredentialRefBlocked
- expectedResult: CREDENTIAL_REF_MISSING
- blockedReasonExpected: none
- status: not_run

## unsupportedProviderRejected
- expectedResult: UNSUPPORTED_PROVIDER
- blockedReasonExpected: none
- status: not_run

## disabledProviderBlocked
- expectedResult: EXPLICIT_CONFIRMATION_REQUIRED
- blockedReasonExpected: none
- status: not_run

## productionEnablementBlocked
- expectedResult: PRODUCTION_ENABLEMENT_BLOCKED_FROM_BETA_UI
- blockedReasonExpected: PRODUCTION_ENABLEMENT_BLOCKED_FROM_BETA_UI
- status: not_run

## quotaWarningShown
- expectedResult: VISIBLE
- blockedReasonExpected: none
- status: not_run

## budgetWarningShown
- expectedResult: VISIBLE
- blockedReasonExpected: none
- status: not_run

## revokeFlowExplained
- expectedResult: VISIBLE
- blockedReasonExpected: none
- status: not_run

## rotateFlowExplained
- expectedResult: VISIBLE
- blockedReasonExpected: none
- status: not_run

## betaOnlyMessagingVisible
- expectedResult: VISIBLE
- blockedReasonExpected: none
- status: not_run

## noProviderCallFromUi
- expectedResult: VISIBLE
- blockedReasonExpected: none
- status: not_run
