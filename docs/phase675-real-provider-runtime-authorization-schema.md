# Phase675 Real Provider Runtime Authorization Schema

Phase675 defines the guarded real Provider runtime v0 authorization schema.

The default posture is blocked. Real Provider execution requires `docs/phase675_682-real-provider-runtime-approval.input.json` with a complete human approval packet.

Hard requirements:
- providerId=nvidia
- credentialRef only
- maxRequests default 1, maximum 3
- maxRetries=0
- maxEstimatedCostUsd present
- allowProviderCall=true
- allowSecretRead=false
- allowDeploy=false
- allowChatMutation=false
- allowChatGatewayExecuteMutation=false
- allowCodexConfigMutation=false
- capability self-approval forbidden
