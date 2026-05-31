# Phase324I Model Library Routing Preference Report

- Runtime status: read-only recommendation report.
- Provider calls made: false.
- Selectable and router runtime were not modified.
- Capability labels that come from names are marked as `model_id_heuristic`.

## Default General Chat

- meta/llama-3.2-1b-instruct: stable selectable smoke_passed model with evidence; evidence=phase324b6-meta_llama_3_2_1b_instruct-20260506155545
- nvidia/nemotron-mini-4b-instruct: stable selectable smoke_passed model with evidence; evidence=phase324b-nvidia_nemotron_mini_4b_instruct-20260506124316
- microsoft/phi-4-mini-instruct: stable selectable smoke_passed model with evidence; evidence=phase324b3-microsoft_phi_4_mini_instruct-20260506130704
- meta/llama-3.2-3b-instruct: stable selectable smoke_passed model with evidence; evidence=phase324b6-meta_llama_3_2_3b_instruct-20260506155547
- meta/llama-4-maverick-17b-128e-instruct: stable selectable smoke_passed model with evidence; evidence=phase324b6-meta_llama_4_maverick_17b_128e_instruct-20260506155549

## Low Latency

- meta/llama-3.2-1b-instruct: lowest recorded smoke latency among selectable models; evidence=phase324b6-meta_llama_3_2_1b_instruct-20260506155545
- nvidia/nemotron-mini-4b-instruct: lowest recorded smoke latency among selectable models; evidence=phase324b-nvidia_nemotron_mini_4b_instruct-20260506124316
- microsoft/phi-4-mini-instruct: lowest recorded smoke latency among selectable models; evidence=phase324b3-microsoft_phi_4_mini_instruct-20260506130704
- meta/llama-3.2-3b-instruct: lowest recorded smoke latency among selectable models; evidence=phase324b6-meta_llama_3_2_3b_instruct-20260506155547
- meta/llama-4-maverick-17b-128e-instruct: lowest recorded smoke latency among selectable models; evidence=phase324b6-meta_llama_4_maverick_17b_128e_instruct-20260506155549

## Reasoning

- nvidia/nemotron-mini-4b-instruct: reasoning-oriented candidate by model id heuristic; evidence=phase324b-nvidia_nemotron_mini_4b_instruct-20260506124316
- nvidia/llama-3.3-nemotron-super-49b-v1: reasoning-oriented candidate by model id heuristic; evidence=phase-313a-model-usability-matrix
- deepseek-ai/deepseek-v4-pro: reasoning-oriented candidate by model id heuristic; evidence=phase324b4-deepseek_ai_deepseek_v4_pro-20260506151431
- nvidia/nemotron-3-super-120b-a12b: reasoning-oriented candidate by model id heuristic; evidence=phase324b-nvidia_nemotron_3_super_120b_a12b-20260506124314
- abacusai/dracarys-llama-3.1-70b-instruct: reasoning-oriented candidate by model id heuristic; evidence=phase324b2-abacusai_dracarys_llama_3_1_70b_instruct-20260506130555

## Coding

- meta/llama-3.2-1b-instruct: coding-oriented candidate by model id heuristic; evidence=phase324b6-meta_llama_3_2_1b_instruct-20260506155545
- microsoft/phi-4-mini-instruct: coding-oriented candidate by model id heuristic; evidence=phase324b3-microsoft_phi_4_mini_instruct-20260506130704
- meta/llama-3.2-3b-instruct: coding-oriented candidate by model id heuristic; evidence=phase324b6-meta_llama_3_2_3b_instruct-20260506155547
- meta/llama-4-maverick-17b-128e-instruct: coding-oriented candidate by model id heuristic; evidence=phase324b6-meta_llama_4_maverick_17b_128e_instruct-20260506155549
- nvidia/llama-3.3-nemotron-super-49b-v1: coding-oriented candidate by model id heuristic; evidence=phase-313a-model-usability-matrix

## Long Context

- meta/llama-4-maverick-17b-128e-instruct: long-context candidate by model id heuristic; evidence=phase324b6-meta_llama_4_maverick_17b_128e_instruct-20260506155549
- minimaxai/minimax-m2.7: long-context candidate by model id heuristic; evidence=phase324b7-minimaxai_minimax_m2_7-20260506164801

## Large Model

- meta/llama-4-maverick-17b-128e-instruct: large-model candidate by model id heuristic; evidence=phase324b6-meta_llama_4_maverick_17b_128e_instruct-20260506155549
- nvidia/llama-3.3-nemotron-super-49b-v1: large-model candidate by model id heuristic; evidence=phase-313a-model-usability-matrix
- nvidia/nemotron-3-super-120b-a12b: large-model candidate by model id heuristic; evidence=phase324b-nvidia_nemotron_3_super_120b_a12b-20260506124314
- abacusai/dracarys-llama-3.1-70b-instruct: large-model candidate by model id heuristic; evidence=phase324b2-abacusai_dracarys_llama_3_1_70b_instruct-20260506130555
- meta/llama-3.1-70b-instruct: large-model candidate by model id heuristic; evidence=phase324b2-meta_llama_3_1_70b_instruct-20260506130559

## Stable Fallback Chain

- meta/llama-3.2-1b-instruct: fallback chain candidate ordered by latency and smoke evidence; evidence=phase324b6-meta_llama_3_2_1b_instruct-20260506155545
- nvidia/nemotron-mini-4b-instruct: fallback chain candidate ordered by latency and smoke evidence; evidence=phase324b-nvidia_nemotron_mini_4b_instruct-20260506124316
- microsoft/phi-4-mini-instruct: fallback chain candidate ordered by latency and smoke evidence; evidence=phase324b3-microsoft_phi_4_mini_instruct-20260506130704
- meta/llama-3.2-3b-instruct: fallback chain candidate ordered by latency and smoke evidence; evidence=phase324b6-meta_llama_3_2_3b_instruct-20260506155547
- meta/llama-4-maverick-17b-128e-instruct: fallback chain candidate ordered by latency and smoke evidence; evidence=phase324b6-meta_llama_4_maverick_17b_128e_instruct-20260506155549
- google/gemma-3n-e4b-it: fallback chain candidate ordered by latency and smoke evidence; evidence=phase324b5-google_gemma_3n_e4b_it-20260506153308
- nvidia/llama-3.3-nemotron-super-49b-v1: fallback chain candidate ordered by latency and smoke evidence; evidence=phase-313a-model-usability-matrix

## God Mode Candidate Pool

- meta/llama-3.2-1b-instruct: candidate for future God Mode dry-run pool; runtime not enabled; evidence=phase324b6-meta_llama_3_2_1b_instruct-20260506155545
- nvidia/nemotron-mini-4b-instruct: candidate for future God Mode dry-run pool; runtime not enabled; evidence=phase324b-nvidia_nemotron_mini_4b_instruct-20260506124316
- microsoft/phi-4-mini-instruct: candidate for future God Mode dry-run pool; runtime not enabled; evidence=phase324b3-microsoft_phi_4_mini_instruct-20260506130704
- meta/llama-3.2-3b-instruct: candidate for future God Mode dry-run pool; runtime not enabled; evidence=phase324b6-meta_llama_3_2_3b_instruct-20260506155547
- meta/llama-4-maverick-17b-128e-instruct: candidate for future God Mode dry-run pool; runtime not enabled; evidence=phase324b6-meta_llama_4_maverick_17b_128e_instruct-20260506155549
- nvidia/llama-3.3-nemotron-super-49b-v1: candidate for future God Mode dry-run pool; runtime not enabled; evidence=phase-313a-model-usability-matrix
- deepseek-ai/deepseek-v4-pro: candidate for future God Mode dry-run pool; runtime not enabled; evidence=phase324b4-deepseek_ai_deepseek_v4_pro-20260506151431
- nvidia/nemotron-3-super-120b-a12b: candidate for future God Mode dry-run pool; runtime not enabled; evidence=phase324b-nvidia_nemotron_3_super_120b_a12b-20260506124314

## Tianshu Candidate Pool

- meta/llama-3.2-1b-instruct: candidate for future Tianshu capability index seed; runtime not enabled; evidence=phase324b6-meta_llama_3_2_1b_instruct-20260506155545
- nvidia/nemotron-mini-4b-instruct: candidate for future Tianshu capability index seed; runtime not enabled; evidence=phase324b-nvidia_nemotron_mini_4b_instruct-20260506124316
- microsoft/phi-4-mini-instruct: candidate for future Tianshu capability index seed; runtime not enabled; evidence=phase324b3-microsoft_phi_4_mini_instruct-20260506130704
- meta/llama-3.2-3b-instruct: candidate for future Tianshu capability index seed; runtime not enabled; evidence=phase324b6-meta_llama_3_2_3b_instruct-20260506155547
- meta/llama-4-maverick-17b-128e-instruct: candidate for future Tianshu capability index seed; runtime not enabled; evidence=phase324b6-meta_llama_4_maverick_17b_128e_instruct-20260506155549
- google/gemma-3n-e4b-it: candidate for future Tianshu capability index seed; runtime not enabled; evidence=phase324b5-google_gemma_3n_e4b_it-20260506153308
- nvidia/llama-3.3-nemotron-super-49b-v1: candidate for future Tianshu capability index seed; runtime not enabled; evidence=phase-313a-model-usability-matrix
- deepseek-ai/deepseek-v4-pro: candidate for future Tianshu capability index seed; runtime not enabled; evidence=phase324b4-deepseek_ai_deepseek_v4_pro-20260506151431

## Missing Sources

- none

