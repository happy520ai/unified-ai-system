# Phase784 Discovery Approval Packet Schema

## Goal

定义 bounded provider discovery approval 输入格式。

## Verified facts

- required: decision
- required: providerId
- required: providerFamily
- required: credentialRef
- required: allowDiscoveryCall
- required: allowSmokeCall
- required: allowSecretRead
- required: allowDeploy
- required: allowChatMutation
- required: allowChatGatewayExecuteMutation
- required: maxDiscoveryRequests
- required: maxEstimatedCostUsd
- required: expiresAt
- required: approvalOwner
- required: acknowledgements

## Boundaries

- allowSecretRead=false
- maxDiscoveryRequests<=3
- maxEstimatedCostUsd=0

## Outputs

- provider-expansion/approvals/discovery-approval-schema.json

## Non-claims

- This phase does not read or print API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not bypass CredentialRef.
- This phase does not automatically add selectable models.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
