# Phase324D-2F Model Selection Strategy

## Boundary

- Strategy only: does not change real default model, Chat route, selectedModel localStorage, or selectable gate.
- Provider scope: NVIDIA-only.
- OpenAI / Claude / OpenRouter / MiMo / local are future-provider-slot and not open for real calls.

## Default Recommended

- nvidia/nemotron-3-super-120b-a12b | provider=nvidia | latencyMs=974 | evidenceId=phase324b-nvidia_nemotron_3_super_120b_a12b-20260506124314 | Evidence-backed selectable model with a balanced latency/quality profile. Strategy only; does not change real default route.

## Fast Models

- nvidia/nemotron-mini-4b-instruct | provider=nvidia | latencyMs=428 | evidenceId=phase324b-nvidia_nemotron_mini_4b_instruct-20260506124316 | Low latency in current smoke evidence; not a long-term SLA.
- microsoft/phi-4-mini-instruct | provider=nvidia | latencyMs=446 | evidenceId=phase324b3-microsoft_phi_4_mini_instruct-20260506130704 | Low latency in current smoke evidence; not a long-term SLA.
- nvidia/nemotron-3-super-120b-a12b | provider=nvidia | latencyMs=974 | evidenceId=phase324b-nvidia_nemotron_3_super_120b_a12b-20260506124314 | Low latency in current smoke evidence; not a long-term SLA.
- abacusai/dracarys-llama-3.1-70b-instruct | provider=nvidia | latencyMs=1011 | evidenceId=phase324b2-abacusai_dracarys_llama_3_1_70b_instruct-20260506130555 | Low latency in current smoke evidence; not a long-term SLA.

## High Quality Models

- abacusai/dracarys-llama-3.1-70b-instruct | provider=nvidia | latencyMs=1011 | evidenceId=phase324b2-abacusai_dracarys_llama_3_1_70b_instruct-20260506130555 | High-capability candidate with evidence-backed selectable status.
- meta/llama-3.1-70b-instruct | provider=nvidia | latencyMs=2143 | evidenceId=phase324b2-meta_llama_3_1_70b_instruct-20260506130559 | High-capability candidate with evidence-backed selectable status.
- meta/llama-3.3-70b-instruct | provider=nvidia | latencyMs=18410 | evidenceId=phase324b2-meta_llama_3_3_70b_instruct-20260506130650 | High-capability candidate with high-latency warning.
- nvidia/llama-3.3-nemotron-super-49b-v1 | provider=nvidia | latencyMs=n/a | evidenceId=phase-313a-model-usability-matrix | High-capability candidate with evidence-backed selectable status.
- nvidia/nemotron-3-super-120b-a12b | provider=nvidia | latencyMs=974 | evidenceId=phase324b-nvidia_nemotron_3_super_120b_a12b-20260506124314 | High-capability candidate with evidence-backed selectable status.

## Low Latency Models

- nvidia/nemotron-mini-4b-instruct | provider=nvidia | latencyMs=428 | evidenceId=phase324b-nvidia_nemotron_mini_4b_instruct-20260506124316 | Latency comes from smoke evidence; not a long-term SLA.
- microsoft/phi-4-mini-instruct | provider=nvidia | latencyMs=446 | evidenceId=phase324b3-microsoft_phi_4_mini_instruct-20260506130704 | Latency comes from smoke evidence; not a long-term SLA.
- nvidia/nemotron-3-super-120b-a12b | provider=nvidia | latencyMs=974 | evidenceId=phase324b-nvidia_nemotron_3_super_120b_a12b-20260506124314 | Latency comes from smoke evidence; not a long-term SLA.
- abacusai/dracarys-llama-3.1-70b-instruct | provider=nvidia | latencyMs=1011 | evidenceId=phase324b2-abacusai_dracarys_llama_3_1_70b_instruct-20260506130555 | Latency comes from smoke evidence; not a long-term SLA.
- meta/llama-3.1-70b-instruct | provider=nvidia | latencyMs=2143 | evidenceId=phase324b2-meta_llama_3_1_70b_instruct-20260506130559 | Latency comes from smoke evidence; not a long-term SLA.

## Balanced Models

- nvidia/nemotron-3-super-120b-a12b | provider=nvidia | latencyMs=974 | evidenceId=phase324b-nvidia_nemotron_3_super_120b_a12b-20260506124314 | Balanced recommendation from selectable status, evidenceId, capability, and latency.
- abacusai/dracarys-llama-3.1-70b-instruct | provider=nvidia | latencyMs=1011 | evidenceId=phase324b2-abacusai_dracarys_llama_3_1_70b_instruct-20260506130555 | Balanced recommendation from selectable status, evidenceId, capability, and latency.
- meta/llama-3.1-70b-instruct | provider=nvidia | latencyMs=2143 | evidenceId=phase324b2-meta_llama_3_1_70b_instruct-20260506130559 | Balanced recommendation from selectable status, evidenceId, capability, and latency.
- nvidia/nemotron-mini-4b-instruct | provider=nvidia | latencyMs=428 | evidenceId=phase324b-nvidia_nemotron_mini_4b_instruct-20260506124316 | Balanced recommendation from selectable status, evidenceId, capability, and latency.

## Fallback Candidates

- nvidia/nemotron-mini-4b-instruct | provider=nvidia | latencyMs=428 | evidenceId=phase324b-nvidia_nemotron_mini_4b_instruct-20260506124316 | Selectable evidence-backed fallback candidate.
- microsoft/phi-4-mini-instruct | provider=nvidia | latencyMs=446 | evidenceId=phase324b3-microsoft_phi_4_mini_instruct-20260506130704 | Selectable evidence-backed fallback candidate.
- nvidia/nemotron-3-super-120b-a12b | provider=nvidia | latencyMs=974 | evidenceId=phase324b-nvidia_nemotron_3_super_120b_a12b-20260506124314 | Selectable evidence-backed fallback candidate.

## High Latency Warning

- meta/llama-3.1-8b-instruct | provider=nvidia | latencyMs=30503 | evidenceId=phase324b2-meta_llama_3_1_8b_instruct-20260506130631 | Latency is from smoke evidence only and may affect UX; do not treat as SLA.
- meta/llama-3.3-70b-instruct | provider=nvidia | latencyMs=18410 | evidenceId=phase324b2-meta_llama_3_3_70b_instruct-20260506130650 | Latency is from smoke evidence only and may affect UX; do not treat as SLA.

## Not Recommended Now

- meta/llama2-70b | provider=nvidia | latencyMs=n/a | evidenceId=phase324b2-meta_llama2_70b-20260506130652 | httpStatus=404; assistantTextPresent=false; not eligible for selectable
- meta/llama3-8b | provider=nvidia | latencyMs=n/a | evidenceId=phase324b3-meta_llama3_8b-20260506130700 | httpStatus=404; assistantTextPresent=false; not eligible for selectable
- microsoft/phi-3-mini-4k-instruct | provider=nvidia | latencyMs=n/a | evidenceId=phase324b3-microsoft_phi_3_mini_4k_instruct-20260506130702 | httpStatus=410; assistantTextPresent=false; not eligible for selectable
- mistralai/mistral-7b-instruct | provider=nvidia | latencyMs=n/a | evidenceId=phase324b3-mistralai_mistral_7b_instruct-20260506130705 | httpStatus=404; assistantTextPresent=false; not eligible for selectable
- mistralai/mistral-7b-instruct-v0.3 | provider=nvidia | latencyMs=n/a | evidenceId=phase324b3-mistralai_mistral_7b_instruct_v0_3-20260506130707 | httpStatus=404; assistantTextPresent=false; not eligible for selectable
- nvidia/llama-3.1-nemotron-ultra-253b-v1 | provider=nvidia | latencyMs=n/a | evidenceId=phase-313a-model-usability-matrix | NVIDIA call did not complete successfully (HTTP 404).
- nvidia/llama-3.3-nemotron-super-49b-v1.5 | provider=nvidia | latencyMs=n/a | evidenceId=phase324b-nvidia_llama_3_3_nemotron_super_49b_v1_5-20260506124310 | completionVerified=false; assistantTextPresent=false; not eligible for selectable
- nvidia/nemotron-3-nano-30b-a3b | provider=nvidia | latencyMs=n/a | evidenceId=phase324b-nvidia_nemotron_3_nano_30b_a3b-20260506124312 | completionVerified=false; assistantTextPresent=false; not eligible for selectable
- nvidia/nvidia-nemotron-nano-9b-v2 | provider=nvidia | latencyMs=n/a | evidenceId=phase324b-nvidia_nvidia_nemotron_nano_9b_v2-20260506124319 | completionVerified=false; assistantTextPresent=false; not eligible for selectable

## Multi Provider Status

- nvidia: enabled-real-provider
- openai: future-provider-slot-not-open
- claude: future-provider-slot-not-open
- openrouter: future-provider-slot-not-open
- mimo: future-provider-slot-not-open
- local: future-provider-slot-not-open
