# Phase1955P One-Shot Result Classification

## Success

The one-shot is classified as passed only when:

- owner approval input is present and valid;
- exactly one provider attempt is made;
- retry count is zero;
- the call uses NVIDIA and the approved model;
- the response is sanitized;
- the sanitized response contains `PME_PROVIDER_ONE_SHOT_OK`.

## Failure

The one-shot is classified as failed when:

- owner approval input is missing or invalid;
- no credential is available through the approved CredentialRef path;
- the provider rejects the request;
- the request times out;
- the response does not contain the expected marker.

Failures are evidence, not success. A failed one-shot must preserve safety fields and must not be converted into a stability claim.
