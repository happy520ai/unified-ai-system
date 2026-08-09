#!/usr/bin/env node

import assert from "node:assert/strict";
import { enhanceNaturalLanguagePrompt } from "../../apps/ai-gateway-service/src/prompts/naturalLanguagePromptEnhancer.js";

export const PROMPT_ENHANCEMENT_CONTRACT_FIXTURE = Object.freeze({
  input: "Help me plan a small API for my team",
  profile: "planning",
  language: "en",
});

export function createPromptEnhancementContractFixture() {
  const request = { ...PROMPT_ENHANCEMENT_CONTRACT_FIXTURE };
  const response = enhanceNaturalLanguagePrompt(request);

  return {
    request,
    response,
  };
}

function assertContract(fixture) {
  assert.equal(fixture.request.input, PROMPT_ENHANCEMENT_CONTRACT_FIXTURE.input);
  assert.equal(fixture.request.profile, "planning");
  assert.equal(fixture.request.language, "en");
  assert.equal(fixture.response.original, fixture.request.input);
  assert.equal(fixture.response.profile, fixture.request.profile);
  assert.equal(fixture.response.language, fixture.request.language);
  assert.ok(fixture.response.enhancedPrompt.includes(fixture.request.input));
  assert.deepEqual(fixture.response.metadata, {
    engine: "local-deterministic",
    version: "prompt-enhancer-v1",
    providerCalled: false,
    credentialRequired: false,
    originalPreserved: true,
    deterministic: true,
  });
}

const fixture = createPromptEnhancementContractFixture();
assertContract(fixture);
console.log(JSON.stringify(fixture, null, 2));
