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
): PromptEnhancementResult => {
  const { original, profile, language, enhancedPrompt, metadata } = fixture.response;

  const providerCalled: false = metadata.providerCalled;
  const credentialRequired: false = metadata.credentialRequired;
  const deterministic: true = metadata.deterministic;

  console.log({
    original,
    profile,
    language,
    enhancedPrompt,
    providerCalled,
    credentialRequired,
    deterministic,
  });

  return fixture.response;
};
```

The provider-free runtime proof is available at
[`docs/examples/prompt-enhancement-contract.mjs`](../../docs/examples/prompt-enhancement-contract.mjs).
It preserves the original request and asserts `original`, `profile`, `language`,
and `enhancedPrompt`, plus `providerCalled=false`, `credentialRequired=false`,
`originalPreserved=true`, and `deterministic=true`.

## Managed local-client receipt wire contract

The package owns the public wire versions and TypeScript shapes for:

- `LocalClientDispatchIntent`
- `LocalClientDurableExecutionReceipt`
- `LocalClientReceiptReconciliationQuery`
- `LocalClientReceiptReconciliationResponse`
- `LocalClientReceiptReconciliationState`

The corresponding `LOCAL_CLIENT_*_VERSION` constants are runtime exports from
the package as well as literal types. These contracts describe authenticated
wire data only. They do not claim that a client has durably stored an intent,
atomically coupled an effect with its receipt, or implemented replay fencing.
Those guarantees remain the external managed client's responsibility.

## Language Selection

- Workload: a side-effect-free runtime constant bridge consumed by both the
  JavaScript SDK and TypeScript contracts.
- Alternatives considered: a TypeScript-only source entry would require every
  Node consumer and public-clone check to install a TypeScript loader or a
  generated `dist` tree; duplicating the literals in the SDK and gateway would
  remove the single source of truth.
- Selection: the seven immutable runtime constants live in one small ESM
  JavaScript file, while all wire structures and public function signatures
  remain TypeScript-first.
- Compatibility and rollback: the package retains its TypeScript `types`
  entry, exposes the runtime file through the existing default export, and can
  roll back by restoring the prior default entry together with the gateway and
  SDK imports. No protocol version changed in this move.

## Development

```bash
# From repo root
pnpm --filter @unified-ai-system/shared-contracts test
pnpm --filter @unified-ai-system/shared-contracts check
```
