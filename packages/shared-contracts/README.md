# @unified-ai-system/shared-contracts

Part of the unified-ai-system monorepo.

## Usage

The gateway's prompt-enhancement response is described by the exported
`PromptEnhancementResult` type. The fixture shape is available when an
integration needs to carry the original request alongside its response:

```ts
import type {
  PromptEnhancementContractFixture,
  PromptEnhancementRequest,
  PromptEnhancementResult,
} from "@unified-ai-system/shared-contracts";

const request: PromptEnhancementRequest = {
  input: "Help me plan a small API for my team",
  profile: "planning",
  language: "en",
};

const consumePreview = (
  fixture: PromptEnhancementContractFixture,
): PromptEnhancementResult => fixture.response;
```

The provider-free runtime proof is available at
[`docs/examples/prompt-enhancement-contract.mjs`](../../docs/examples/prompt-enhancement-contract.mjs).
It preserves the original request and asserts
`providerCalled=false`, `credentialRequired=false`, and `deterministic=true`.

## Development

```bash
# From repo root
pnpm --filter @unified-ai-system/shared-contracts test
pnpm --filter @unified-ai-system/shared-contracts check
```
