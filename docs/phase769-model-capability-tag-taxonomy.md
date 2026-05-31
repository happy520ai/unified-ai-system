# Phase769 Model Capability Tag Taxonomy

## Goal

建立统一模型能力标签体系。

## Verified facts

- capability tag: chat
- capability tag: completion
- capability tag: reasoning
- capability tag: coding
- capability tag: vision
- capability tag: audio
- capability tag: image
- capability tag: video
- capability tag: embedding
- capability tag: rerank
- capability tag: toolCalling
- capability tag: jsonMode
- capability tag: longContext
- capability tag: chineseOptimized
- capability tag: lowLatency
- capability tag: lowCost

## Boundaries

- seedTagInferenceIsHeuristic=true
- task tool tags cannot enter ordinary Chat dropdown without future gate

## Outputs

- modelCapabilityTagTaxonomyReady=true

## Non-claims

- This phase does not call any Provider.
- This phase does not read API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not modify selectable model status.
- This phase does not modify default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
