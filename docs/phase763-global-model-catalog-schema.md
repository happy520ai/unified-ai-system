# Phase763 Global Model Catalog Schema

## Goal

建立 Global Model Catalog Schema，支持 credentialPolicy、capabilities、limits、pricing、risk、evidence 和 selectableGate。

## Verified facts

- required field: modelId
- required field: canonicalModelId
- required field: providerFamily
- required field: providerId
- required field: source
- required field: status
- required field: credentialPolicy
- required field: capabilities
- required field: limits
- required field: pricing
- required field: risk
- required field: evidence
- required field: selectableGate

## Boundaries

- rawSecretAllowed=false
- selectableRequiresSmokePassed=true
- seedModelsSelectableByDefault=false
- credentialMissingIsNotUsable=true
- dryRunImportIsNotRuntime=true

## Outputs

- apps/ai-gateway-service/evidence/phase761_780/global-model-catalog-schema-result.json

## Non-claims

- This phase does not call any Provider.
- This phase does not read API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not modify selectable model status.
- This phase does not modify default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
