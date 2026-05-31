# Phase332E Provider Onboarding Guided Test Script

## happyPathCredentialRefOnly

- persona: limited_beta_reviewer
- expectedResult: ONBOARDING_INPUT_ACCEPTED_FOR_BACKEND_GATE
- blockedReasonExpected: none
- steps:
  - Open provider onboarding wizard
  - Enter credential reference only
  - Run local validation

## rawSecretRejected

- persona: limited_beta_reviewer
- expectedResult: RAW_SECRET_REJECTED
- blockedReasonExpected: RAW_SECRET_REJECTED
- steps:
  - Open provider onboarding wizard
  - Enter credential reference only
  - Run local validation

## missingCredentialRefBlocked

- persona: limited_beta_reviewer
- expectedResult: CREDENTIAL_REF_MISSING
- blockedReasonExpected: none
- steps:
  - Open provider onboarding wizard
  - Enter credential reference only
  - Run local validation

## unsupportedProviderRejected

- persona: limited_beta_reviewer
- expectedResult: UNSUPPORTED_PROVIDER
- blockedReasonExpected: none
- steps:
  - Open provider onboarding wizard
  - Enter credential reference only
  - Run local validation

## disabledProviderBlocked

- persona: limited_beta_reviewer
- expectedResult: EXPLICIT_CONFIRMATION_REQUIRED
- blockedReasonExpected: none
- steps:
  - Open provider onboarding wizard
  - Enter credential reference only
  - Run local validation

## productionEnablementBlocked

- persona: limited_beta_reviewer
- expectedResult: PRODUCTION_ENABLEMENT_BLOCKED_FROM_BETA_UI
- blockedReasonExpected: PRODUCTION_ENABLEMENT_BLOCKED_FROM_BETA_UI
- steps:
  - Open provider onboarding wizard
  - Enter credential reference only
  - Run local validation

## quotaWarningShown

- persona: limited_beta_reviewer
- expectedResult: VISIBLE
- blockedReasonExpected: none
- steps:
  - Open provider onboarding wizard
  - Inspect visible beta guidance

## budgetWarningShown

- persona: limited_beta_reviewer
- expectedResult: VISIBLE
- blockedReasonExpected: none
- steps:
  - Open provider onboarding wizard
  - Inspect visible beta guidance

## revokeFlowExplained

- persona: limited_beta_reviewer
- expectedResult: VISIBLE
- blockedReasonExpected: none
- steps:
  - Open provider onboarding wizard
  - Inspect visible beta guidance

## rotateFlowExplained

- persona: limited_beta_reviewer
- expectedResult: VISIBLE
- blockedReasonExpected: none
- steps:
  - Open provider onboarding wizard
  - Inspect visible beta guidance

## betaOnlyMessagingVisible

- persona: limited_beta_reviewer
- expectedResult: VISIBLE
- blockedReasonExpected: none
- steps:
  - Open provider onboarding wizard
  - Inspect visible beta guidance

## noProviderCallFromUi

- persona: limited_beta_reviewer
- expectedResult: VISIBLE
- blockedReasonExpected: none
- steps:
  - Open provider onboarding wizard
  - Inspect visible beta guidance
