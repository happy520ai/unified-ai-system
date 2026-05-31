# Phase1313A ONNX/GGUF/WASM Backend Decision Packet

## Goal

Compare ONNX Runtime, GGUF/llama.cpp, and WASM/WebGPU as future Neural Fabric backend candidates. This packet is a route and risk decision only. It does not install backend dependencies, download model artifacts, or run real inference.

## Scope

- decision docs only
- 不安装重依赖
- 不下载模型
- 不运行真实推理
- No backend runtime implementation.
- No model execution.
- No training.
- No Provider calls.
- No secret, API key, token, `.env`, or `auth.json` reads.
- No main-chain integration.
- No `/chat` or `/chat-gateway/execute` integration.

## Route Decision

Primary local LLM candidate: GGUF/llama.cpp.

Rationale: GGUF/llama.cpp is the most direct fit for future local LLM experiments because it is focused on LLM inference, uses GGUF as its native model storage route, and has broad local hardware backend coverage. It should remain behind an explicit local backend gate and must not become default `/chat`.

Secondary general graph candidate: ONNX Runtime.

Rationale: ONNX Runtime has a mature Execution Provider model across CPU, GPU, mobile, edge, and specialized accelerators. It is a better fit for general tensor graph workloads or non-LLM model families than for immediate local LLM UX.

Browser/client preview candidate: WASM/WebGPU.

Rationale: WASM/WebGPU is useful for future browser-side preview or lightweight local demos. It should not be treated as the default local LLM backend because WebGPU availability, secure-context requirements, browser compatibility, GPU memory, and model packaging remain substantial constraints.

## Risk Matrix

| Backend | Strength | Risk | Route |
| --- | --- | --- | --- |
| ONNX Runtime | Broad Execution Provider abstraction; can target CPU/GPU/edge/mobile/special accelerators through one API family. | Requires ONNX-format compatibility, EP-specific dependency packaging, and hardware/provider option testing. Some EPs are preview or hardware-specific. | Secondary general graph candidate; design a future adapter contract first. |
| GGUF/llama.cpp | Strong local LLM focus, native GGUF route, broad local acceleration backends including Metal, BLAS, CUDA, HIP, Vulkan, OpenCL, and WebGPU. | Model format conversion and quantization governance are required; CLI/server usage can download from model hosts if not guarded; backend behavior varies by hardware. | Primary local LLM candidate; only future gated local dry-run, never main chain by default. |
| WASM/WebGPU | Browser/client-side compute path; ONNX Runtime Web can use default WASM for lightweight models and WebGPU for heavier client GPU work. | WebGPU is limited availability, requires secure context, has browser/device fragmentation, GPU memory lifecycle risks, and client UX variability. | Browser/client preview candidate; keep as preview-only until browser matrix is proven. |

## Candidate Notes

### ONNX Runtime

ONNX Runtime uses Execution Providers to map supported graph nodes or subgraphs to hardware-specific libraries. This makes it useful for a future Neural Fabric adapter layer where the same manifest can declare a desired backend policy while actual EP capability remains runtime-detected and evidence-gated.

Phase1313A does not add `onnxruntime-node`, `onnxruntime-web`, CUDA, TensorRT, DirectML, OpenVINO, or any other heavy dependency. A future ONNX phase must first define a fixture-only no-model contract, dependency budget, hardware detection policy, rollback, and evidence schema.

### GGUF/llama.cpp

llama.cpp is optimized around local LLM inference and requires GGUF as the model storage route. Its README documents local file usage, optional model-host download routes, OpenAI-compatible server mode, and many supported backends. For PME this is powerful but risky: any future integration must disable implicit model downloads, require explicit local fixture permission, and keep OpenAI-compatible server mode out of the default AI Gateway main chain.

Phase1313A does not install llama.cpp, compile native code, download GGUF artifacts, launch a server, or run inference.

### WASM/WebGPU

WASM/WebGPU is a candidate for browser-side preview surfaces and small demos. ONNX Runtime Web positions WASM as the default lightweight path and WebGPU as a more compute-intensive GPU path. MDN records WebGPU as limited availability and secure-context-only, so PME must treat it as an optional client capability, not a guaranteed backend.

Phase1313A does not add browser runtime code, WASM bundles, WebGPU feature detection, shader code, or model execution.

## Implementation Not Allowed In This Phase

- Do not install ONNX Runtime packages.
- Do not install llama.cpp packages or build native binaries.
- Do not install WASM/WebGPU inference packages.
- Do not download models.
- Do not convert or quantize models.
- Do not execute real inference.
- Do not add `/chat` or `/chat-gateway/execute` wiring.
- Do not add runtime buttons, training buttons, or provider execution buttons.

## Future Route Sketch

1. Backend capability registry spec: describe backend ID, supported artifact type, local-only flag, allowed execution mode, and evidence requirements.
2. Fixture-only backend probe: no model execution, only dependency absence/presence and policy simulation.
3. Explicit approval gate: require allowed files, artifact fixture manifest, no network, no Provider, no secret reads.
4. Mock execution adapter: reuse Phase1312A worker isolation for timeout and transcript behavior.
5. Tiny fixture real-run gate: only after separate approval; still no default `/chat` integration.

## Evidence Flags

- heavyDependenciesInstalled=false
- modelDownloaded=false
- realInferenceExecuted=false
- providerCallsMade=false
- secretRead=false
- chatModified=false
- chatGatewayExecuteModified=false

## Official Sources Reviewed

- ONNX Runtime Execution Providers: https://onnxruntime.ai/docs/execution-providers/
- ONNX Runtime WebGPU EP: https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html
- llama.cpp README: https://github.com/ggml-org/llama.cpp
- MDN WebGPU API: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API

## Evidence

`apps/ai-gateway-service/evidence/phase1313a/backend-decision-packet-result.json`

## Verification

```powershell
node --check tools/phase1313a/verify-backend-decision-packet.mjs
pnpm run verify:phase1313a-backend-decision-packet
pnpm run verify:phase107a-secret-safety
pnpm -r --if-present check
```
