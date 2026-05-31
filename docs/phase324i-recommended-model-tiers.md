# Phase324I Recommended Model Tiers

- default_general_chat_recommendation uses stable selectable models with evidence.
- low_latency_recommendation sorts by recorded smoke latency.
- reasoning/coding/long_context/large_model use conservative model-id heuristic notes, not real benchmark claims.

## defaultGeneralChat

1. meta/llama-3.2-1b-instruct (model_id_heuristic)
2. nvidia/nemotron-mini-4b-instruct (model_id_heuristic)
3. microsoft/phi-4-mini-instruct (model_id_heuristic)
4. meta/llama-3.2-3b-instruct (model_id_heuristic)
5. meta/llama-4-maverick-17b-128e-instruct (model_id_heuristic)

## lowLatency

1. meta/llama-3.2-1b-instruct (model_id_heuristic)
2. nvidia/nemotron-mini-4b-instruct (model_id_heuristic)
3. microsoft/phi-4-mini-instruct (model_id_heuristic)
4. meta/llama-3.2-3b-instruct (model_id_heuristic)
5. meta/llama-4-maverick-17b-128e-instruct (model_id_heuristic)

## reasoning

1. nvidia/nemotron-mini-4b-instruct (model_id_heuristic)
2. nvidia/llama-3.3-nemotron-super-49b-v1 (model_id_heuristic)
3. deepseek-ai/deepseek-v4-pro (model_id_heuristic)
4. nvidia/nemotron-3-super-120b-a12b (model_id_heuristic)
5. abacusai/dracarys-llama-3.1-70b-instruct (model_id_heuristic)

## coding

1. meta/llama-3.2-1b-instruct (model_id_heuristic)
2. microsoft/phi-4-mini-instruct (model_id_heuristic)
3. meta/llama-3.2-3b-instruct (model_id_heuristic)
4. meta/llama-4-maverick-17b-128e-instruct (model_id_heuristic)
5. nvidia/llama-3.3-nemotron-super-49b-v1 (model_id_heuristic)

## longContext

1. meta/llama-4-maverick-17b-128e-instruct (model_id_heuristic)
2. minimaxai/minimax-m2.7 (model_id_heuristic)

## largeModel

1. meta/llama-4-maverick-17b-128e-instruct (model_id_heuristic)
2. nvidia/llama-3.3-nemotron-super-49b-v1 (model_id_heuristic)
3. nvidia/nemotron-3-super-120b-a12b (model_id_heuristic)
4. abacusai/dracarys-llama-3.1-70b-instruct (model_id_heuristic)
5. meta/llama-3.1-70b-instruct (model_id_heuristic)

## stableFallbackChain

1. meta/llama-3.2-1b-instruct (model_id_heuristic)
2. nvidia/nemotron-mini-4b-instruct (model_id_heuristic)
3. microsoft/phi-4-mini-instruct (model_id_heuristic)
4. meta/llama-3.2-3b-instruct (model_id_heuristic)
5. meta/llama-4-maverick-17b-128e-instruct (model_id_heuristic)
6. google/gemma-3n-e4b-it (model_id_heuristic)
7. nvidia/llama-3.3-nemotron-super-49b-v1 (model_id_heuristic)

## godModeCandidatePool

1. meta/llama-3.2-1b-instruct (model_id_heuristic)
2. nvidia/nemotron-mini-4b-instruct (model_id_heuristic)
3. microsoft/phi-4-mini-instruct (model_id_heuristic)
4. meta/llama-3.2-3b-instruct (model_id_heuristic)
5. meta/llama-4-maverick-17b-128e-instruct (model_id_heuristic)
6. nvidia/llama-3.3-nemotron-super-49b-v1 (model_id_heuristic)
7. deepseek-ai/deepseek-v4-pro (model_id_heuristic)
8. nvidia/nemotron-3-super-120b-a12b (model_id_heuristic)

## tianshuCandidatePool

1. meta/llama-3.2-1b-instruct (model_id_heuristic)
2. nvidia/nemotron-mini-4b-instruct (model_id_heuristic)
3. microsoft/phi-4-mini-instruct (model_id_heuristic)
4. meta/llama-3.2-3b-instruct (model_id_heuristic)
5. meta/llama-4-maverick-17b-128e-instruct (model_id_heuristic)
6. google/gemma-3n-e4b-it (model_id_heuristic)
7. nvidia/llama-3.3-nemotron-super-49b-v1 (model_id_heuristic)
8. deepseek-ai/deepseek-v4-pro (model_id_heuristic)

